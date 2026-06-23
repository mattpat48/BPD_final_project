const http = require("http");
const net = require("net");
const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const PREFERRED_PORT = Number(process.env.PORT || 5174);
const HOST = "127.0.0.1";
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const LOG_DIR = path.join(ROOT, "logs");
const ORDERS_DIR = path.join(ROOT, "data", "orders");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon"
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

async function proxyJson(req, res, targetUrl) {
  const rawBody = await readBody(req);
  const result = await fetchJson(targetUrl, {
    method: req.method,
    body: rawBody || "{}"
  });
  sendJson(res, result.status, result.payload);
}

async function probeHttp(name, url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return {
      name,
      status: response.ok ? "online" : "warning",
      detail: `HTTP ${response.status}`,
      ms: Date.now() - startedAt
    };
  } catch (error) {
    return {
      name,
      status: "offline",
      detail: error.message,
      ms: Date.now() - startedAt
    };
  }
}

function probeTcp(name, host, port) {
  const startedAt = Date.now();
  return new Promise(resolve => {
    const socket = new net.Socket();
    const done = (status, detail) => {
      socket.destroy();
      resolve({ name, status, detail, ms: Date.now() - startedAt });
    };

    socket.setTimeout(4000);
    socket.once("connect", () => done("online", `TCP ${host}:${port} open`));
    socket.once("timeout", () => done("offline", "TCP timeout"));
    socket.once("error", error => done("offline", error.message));
    socket.connect(port, host);
  });
}

async function getHealth() {
  const services = await Promise.all([
    probeHttp("Camunda REST", "http://localhost:8080/engine-rest/engine"),
    probeHttp("User service", "http://localhost:9080/user/mariorossi"),
    probeHttp("Zones service", "http://localhost:9090/zones/60x80"),
    probeTcp("Posting service", "localhost", 8888)
  ]);

  return {
    checkedAt: new Date().toISOString(),
    services
  };
}

async function tailFile(filePath, maxBytes = 24000) {
  const stat = await fs.stat(filePath);
  const handle = await fs.open(filePath, "r");
  try {
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, stat.size - length);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

async function listLogs() {
  try {
    const entries = await fs.readdir(LOG_DIR, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile())
      .filter(entry => entry.name.endsWith(".log"))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Promise.all(files.map(async file => {
      const filePath = path.join(LOG_DIR, file.name);
      const stat = await fs.stat(filePath);
      return {
        name: file.name,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        content: await tailFile(filePath)
      };
    }));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function parseOrder(content, fileName, type) {
  const lineValue = label => {
    const line = content.split(/\r?\n/).find(row => row.startsWith(label));
    return line ? line.split(":").slice(1).join(":").trim() : "";
  };

  return {
    fileName,
    type,
    requestId: lineValue("Request ID"),
    username: lineValue("Username"),
    invoiceNumber: lineValue("Invoice Number"),
    amount: lineValue("Total Amount") || lineValue("Amount Due"),
    format: lineValue("Format"),
    selectedZones: lineValue("Selected Zones"),
    content
  };
}

async function readOrderType(type) {
  const dir = path.join(ORDERS_DIR, type);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const orders = await Promise.all(entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".txt"))
      .map(async entry => {
        const filePath = path.join(dir, entry.name);
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf8");
        return {
          ...parseOrder(content, entry.name, type),
          modifiedAt: stat.mtime.toISOString()
        };
      }));
    return orders;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function listOrders() {
  const [confirmed, cancelled] = await Promise.all([
    readOrderType("confirmed"),
    readOrderType("cancelled")
  ]);

  return [...confirmed, ...cancelled]
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

// Deletes every generated order file. Scoped to the .txt files inside the two known
// order directories, so nothing outside data/orders can be removed.
async function clearOrders() {
  let deleted = 0;
  for (const type of ["confirmed", "cancelled"]) {
    const dir = path.join(ORDERS_DIR, type);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      await Promise.all(entries
        .filter(entry => entry.isFile() && entry.name.endsWith(".txt"))
        .map(async entry => {
          await fs.unlink(path.join(dir, entry.name));
          deleted += 1;
        }));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return { ok: true, deleted };
}

async function runProjectScript(scriptName) {
  const scriptPath = path.join(ROOT, scriptName);
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath];
  if (scriptName === "start.ps1") args.push("-NoMonitor");

  return new Promise(resolve => {
    const child = spawn("powershell.exe", args, { cwd: ROOT, windowsHide: true });
    let output = "";

    child.stdout.on("data", chunk => { output += chunk.toString(); });
    child.stderr.on("data", chunk => { output += chunk.toString(); });
    child.on("close", code => resolve({
      ok: code === 0,
      code,
      output: output.trim()
    }));
    child.on("error", error => resolve({
      ok: false,
      code: -1,
      output: error.message
    }));
  });
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requested}`);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, await getHealth());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/logs") {
    sendJson(res, 200, { logs: await listLogs() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/orders") {
    sendJson(res, 200, { orders: await listOrders() });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/orders") {
    sendJson(res, 200, await clearOrders());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/request") {
    await proxyJson(req, res, "http://localhost:8080/api/request");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/decision") {
    await proxyJson(req, res, "http://localhost:8080/api/decision");
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/external/user/")) {
    const username = encodeURIComponent(decodeURIComponent(url.pathname.split("/").pop()));
    const result = await fetchJson(`http://localhost:9080/user/${username}`);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/external/zones/")) {
    const format = encodeURIComponent(decodeURIComponent(url.pathname.split("/").pop()));
    const result = await fetchJson(`http://localhost:9090/zones/${format}`);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/camunda/tasks") {
    const result = await fetchJson("http://localhost:8080/engine-rest/task");
    sendJson(res, result.status, result.payload);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/camunda/process-instances") {
    const result = await fetchJson("http://localhost:8080/engine-rest/process-instance");
    sendJson(res, result.status, result.payload);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/project/start") {
    sendJson(res, 200, await runProjectScript("start.ps1"));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/project/stop") {
    sendJson(res, 200, await runProjectScript("stop.ps1"));
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

function listen(port, attemptsLeft = 20) {
  server.once("error", error => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.log(`Port ${port} already in use, trying ${port + 1}...`);
      listen(port + 1, attemptsLeft - 1);
      return;
    }

    console.error(error.message);
    process.exit(1);
  });

  server.listen(port, HOST, () => {
    console.log(`BPD dashboard running at http://${HOST}:${port}`);
  });
}

listen(PREFERRED_PORT);
