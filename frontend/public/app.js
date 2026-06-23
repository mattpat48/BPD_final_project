const state = {
  logs: [],
  latestRequestId: "",
  requestEntries: [],
  decisionEntries: [],
  requestExpanded: false,
  decisionExpanded: false
};

// Each preset declares the form values and the outcome we expect, so the dashboard can
// demonstrate, side by side, both the happy path and every managed error scenario.
const presets = {
  standard: {
    label: "Valido · L'Aquila + Rome",
    expect: "OK 200 — richiesta valida, requestId generato",
    kind: "ok",
    username: "mariorossi",
    posterFormat: "60x80",
    cities: "L'Aquila, Rome",
    maxPrice: "20"
  },
  milan: {
    label: "Valido · Milan budget alto",
    expect: "OK 200 — seleziona piu zone fino al budget",
    kind: "ok",
    username: "mariorossi",
    posterFormat: "60x80",
    cities: "Milan",
    maxPrice: "130"
  },
  userNotFound: {
    label: "Errore · Utente inesistente",
    expect: "404 Not Found — USER_NOT_FOUND",
    kind: "error",
    username: "ghostuser",
    posterFormat: "60x80",
    cities: "Rome",
    maxPrice: "50"
  },
  cityNotServed: {
    label: "Errore · Citta non servita",
    expect: "422 Unprocessable — NO_AFFORDABLE_ZONES",
    kind: "error",
    username: "mariorossi",
    posterFormat: "60x80",
    cities: "Napoli",
    maxPrice: "50"
  },
  budgetTooLow: {
    label: "Errore · Budget troppo basso",
    expect: "422 Unprocessable — NO_AFFORDABLE_ZONES",
    kind: "error",
    username: "mariorossi",
    posterFormat: "60x80",
    cities: "Milan",
    maxPrice: "1"
  },
  invalid: {
    label: "Errore · Input non valido",
    expect: "400 Bad Request — validazione API (campi mancanti)",
    kind: "error",
    username: "",
    posterFormat: "60x80",
    cities: "",
    maxPrice: "0"
  }
};

const elements = {
  healthGrid: document.querySelector("#healthGrid"),
  requestResponseOutput: document.querySelector("#requestResponseOutput"),
  decisionResponseOutput: document.querySelector("#decisionResponseOutput"),
  requestStatus: document.querySelector("#requestStatus"),
  decisionStatus: document.querySelector("#decisionStatus"),
  requestForm: document.querySelector("#requestForm"),
  presetSelect: document.querySelector("#presetSelect"),
  presetHint: document.querySelector("#presetHint"),
  username: document.querySelector("#username"),
  posterFormat: document.querySelector("#posterFormat"),
  cities: document.querySelector("#cities"),
  maxPrice: document.querySelector("#maxPrice"),
  strategy: document.querySelector("#strategy"),
  deferStrategy: document.querySelector("#deferStrategy"),
  strategyStep: document.querySelector("#strategyStep"),
  strategyTicketId: document.querySelector("#strategyTicketId"),
  strategyChoice: document.querySelector("#strategyChoice"),
  requestId: document.querySelector("#requestId"),
  requestTimeline: document.querySelector("#requestTimeline"),
  decisionTimeline: document.querySelector("#decisionTimeline"),
  confirmedOrdersList: document.querySelector("#confirmedOrdersList"),
  cancelledOrdersList: document.querySelector("#cancelledOrdersList"),
  confirmedCount: document.querySelector("#confirmedCount"),
  cancelledCount: document.querySelector("#cancelledCount"),
  ordersSummary: document.querySelector("#ordersSummary"),
  logSelect: document.querySelector("#logSelect"),
  logOutput: document.querySelector("#logOutput")
};

function setBusy(button, isBusy) {
  if (!button) return;
  button.disabled = isBusy;
}

function formatJson(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRequestId(payload, fallback = "") {
  if (!payload || typeof payload !== "object") return fallback;
  return payload.requestId || payload.id || fallback;
}

function addTimelineEntry(entries, label, payload, ok, context = {}) {
  entries.push({
    label,
    payload,
    ok,
    request: context.request || null,
    requestId: context.requestId || getRequestId(payload, state.latestRequestId),
    createdAt: new Date(),
    sequence: entries.length + 1
  });
}

function createJsonDetail(label, value) {
  const detail = document.createElement("div");
  detail.className = "response-detail";

  const title = document.createElement("div");
  title.className = "response-detail-label";
  title.textContent = label;

  const pre = document.createElement("pre");
  pre.textContent = formatJson(value);

  detail.append(title, pre);
  return detail;
}

function renderTimeline(container, entries, emptyText, titlePrefix, expandKey) {
  container.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  // Newest first; by default only the latest entry is shown, the rest stay behind the toggle.
  const expanded = expandKey ? state[expandKey] : true;
  const ordered = entries.slice().reverse();
  const visible = expanded ? ordered : ordered.slice(0, 1);

  visible.forEach(entry => {
    const card = document.createElement("article");
    card.className = `response-card ${entry.ok ? "success" : "error"}`;

    const header = document.createElement("div");
    header.className = "response-card-header";

    const titleRow = document.createElement("div");
    titleRow.className = "response-card-title";

    const title = document.createElement("span");
    title.textContent = `${titlePrefix} ${entry.sequence}`;

    const status = document.createElement("span");
    status.className = "pill";
    status.textContent = entry.ok ? "OK" : "Errore";
    status.style.background = entry.ok ? "#ecfdf3" : "#fff1f0";
    status.style.color = entry.ok ? "#067647" : "#b42318";

    const meta = document.createElement("div");
    meta.className = "response-card-meta";
    meta.textContent = entry.requestId
      ? `${formatDateTime(entry.createdAt)} - requestId ${entry.requestId}`
      : formatDateTime(entry.createdAt);

    titleRow.append(title, status);
    header.append(titleRow, meta);

    const body = document.createElement("div");
    body.className = "response-card-body";
    if (entry.request) body.appendChild(createJsonDetail("Dati inviati", entry.request));
    body.appendChild(createJsonDetail("Risposta ricevuta", entry.payload));

    card.append(header, body);
    container.appendChild(card);
  });

  if (expandKey && entries.length > 1) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary timeline-toggle";
    toggle.textContent = expanded
      ? "Mostra solo l'ultima"
      : `Mostra storico (${entries.length - 1} precedenti)`;
    toggle.addEventListener("click", () => {
      state[expandKey] = !state[expandKey];
      renderTimeline(container, entries, emptyText, titlePrefix, expandKey);
    });
    container.appendChild(toggle);
  }
}

function setStatus(element, label, ok) {
  element.textContent = label;
  element.style.background = ok ? "#e6eeed" : "#fff1f0";
  element.style.color = ok ? "#0b5f59" : "#b42318";
}

function showRequestResponse(label, payload, ok = true, context = {}) {
  setStatus(elements.requestStatus, label, ok);
  elements.requestResponseOutput.textContent = formatJson(payload);
  if (context.track) {
    addTimelineEntry(state.requestEntries, label, payload, ok, context);
    renderTimeline(
      elements.requestTimeline,
      state.requestEntries,
      "Invia una richiesta per vedere qui dati inviati, request ID e risposta ricevuta.",
      "Richiesta",
      "requestExpanded"
    );
  }
}

function showDecisionResponse(label, payload, ok = true, context = {}) {
  setStatus(elements.decisionStatus, label, ok);
  elements.decisionResponseOutput.textContent = formatJson(payload);
  if (context.track) {
    addTimelineEntry(state.decisionEntries, label, payload, ok, context);
    renderTimeline(
      elements.decisionTimeline,
      state.decisionEntries,
      "Conferma o annulla una richiesta per vedere qui dati inviati e risposta ricevuta.",
      "Decisione",
      "decisionExpanded"
    );
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
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

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

function populatePresetOptions() {
  elements.presetSelect.innerHTML = "";
  Object.entries(presets).forEach(([value, preset]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = preset.label;
    elements.presetSelect.appendChild(option);
  });
}

function applyPreset(name) {
  const preset = presets[name] || presets.standard;
  elements.username.value = preset.username;
  elements.posterFormat.value = preset.posterFormat;
  elements.cities.value = preset.cities;
  elements.maxPrice.value = preset.maxPrice;
  elements.strategy.value = preset.strategy || "MOST_EXPENSIVE";
  elements.deferStrategy.checked = preset.deferStrategy === true;

  if (elements.presetHint) {
    elements.presetHint.textContent = `Esito atteso: ${preset.expect}`;
    elements.presetHint.classList.toggle("is-error", preset.kind === "error");
    elements.presetHint.classList.toggle("is-ok", preset.kind !== "error");
  }
}

function requestPayloadFromForm() {
  return {
    username: elements.username.value.trim(),
    posterFormat: elements.posterFormat.value,
    cities: elements.cities.value
      .split(",")
      .map(city => city.trim())
      .filter(Boolean),
    maxPrice: Number(elements.maxPrice.value),
    strategy: elements.strategy.value,
    deferStrategy: elements.deferStrategy.checked
  };
}

async function refreshHealth() {
  elements.healthGrid.innerHTML = "<div class=\"service-tile\"><strong>Controllo servizi...</strong></div>";
  try {
    const data = await api("/api/health");
    elements.healthGrid.innerHTML = "";
    data.services.forEach(service => {
      const tile = document.createElement("article");
      tile.className = `service-tile ${service.status}`;
      tile.innerHTML = `
        <div class="service-name"><span>${service.name}</span><i class="dot"></i></div>
        <div class="service-detail">${service.detail}</div>
        <div class="service-detail">${service.ms} ms</div>
      `;
      elements.healthGrid.appendChild(tile);
    });
  } catch (error) {
    elements.healthGrid.innerHTML = `<div class="service-tile offline"><strong>Errore health</strong><span>${error.message}</span></div>`;
  }
}

async function sendRequest(event) {
  event.preventDefault();
  const button = event.submitter;
  const payload = requestPayloadFromForm();
  setBusy(button, true);
  try {
    const data = await api("/api/request", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (data.awaitingStrategy) {
      // Deferred mode: reveal the strategy step and pre-fill it with the ticketId.
      elements.strategyStep.hidden = false;
      elements.strategyTicketId.value = data.ticketId || "";
      elements.strategyChoice.value = payload.strategy || "MOST_EXPENSIVE";
      showRequestResponse("Richiesta differita — scegli strategia", data, true, {
        request: payload,
        requestId: data.ticketId,
        track: true
      });
    } else {
      elements.strategyStep.hidden = true;
      if (data.requestId) {
        state.latestRequestId = data.requestId;
        elements.requestId.value = data.requestId;
      }
      showRequestResponse("Richiesta inviata", data, true, {
        request: payload,
        requestId: data.requestId,
        track: true
      });
    }
    await refreshAllSecondary();
  } catch (error) {
    showRequestResponse("Errore richiesta", error.payload || error.message, false, {
      request: payload,
      track: true
    });
  } finally {
    setBusy(button, false);
  }
}

async function sendDecision(decision, button) {
  const requestId = elements.requestId.value.trim();
  if (!requestId) {
    showDecisionResponse("requestId mancante", { error: "Inserisci o genera un requestId prima della decisione." }, false, {
      request: { requestId, decision },
      track: true
    });
    return;
  }

  setBusy(button, true);
  try {
    const payload = { requestId, decision };
    const data = await api("/api/decision", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showDecisionResponse(`Decisione: ${decision}`, data, true, {
      request: payload,
      requestId,
      track: true
    });
    await refreshAllSecondary();
  } catch (error) {
    showDecisionResponse("Errore decisione", error.payload || error.message, false, {
      request: { requestId, decision },
      requestId,
      track: true
    });
  } finally {
    setBusy(button, false);
  }
}

async function sendStrategy(button) {
  const ticketId = elements.strategyTicketId.value.trim();
  const strategy = elements.strategyChoice.value;
  if (!ticketId) {
    showRequestResponse("ticketId mancante", { error: "Esegui prima una richiesta differita." }, false, { track: true });
    return;
  }

  setBusy(button, true);
  try {
    const payload = { ticketId, strategy };
    const data = await api("/api/strategy", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (data.requestId) {
      state.latestRequestId = data.requestId;
      elements.requestId.value = data.requestId;
    }
    elements.strategyStep.hidden = true;
    showRequestResponse(`Strategia applicata: ${strategy}`, data, true, {
      request: payload,
      requestId: data.requestId,
      track: true
    });
    await refreshAllSecondary();
  } catch (error) {
    showRequestResponse("Errore strategia", error.payload || error.message, false, {
      request: { ticketId, strategy },
      track: true
    });
  } finally {
    setBusy(button, false);
  }
}

function createOrderMeta(label, value) {
  const item = document.createElement("div");
  item.className = "order-meta";
  if (label === "Zone") item.classList.add("wide-order-meta");

  const strong = document.createElement("strong");
  strong.textContent = value || "-";

  const span = document.createElement("span");
  span.textContent = label;

  item.append(strong, span);
  return item;
}

function formatZones(value) {
  if (!value) return "";
  try {
    const zones = JSON.parse(value);
    if (!Array.isArray(zones)) return value;
    return zones
      .map(zone => `${zone.city || ""} - ${zone.name || ""}${zone.price ? ` (${zone.price})` : ""}`.trim())
      .join("\n");
  } catch {
    return value;
  }
}

function renderOrderList(container, orders, emptyText) {
  container.innerHTML = "";
  if (!orders.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const template = document.querySelector("#orderTemplate");
  orders.forEach(order => {
    const node = template.content.cloneNode(true);
    const article = node.querySelector(".order-item");
    const title = node.querySelector("strong");
    const status = node.querySelector("span");
    const details = node.querySelector(".order-details");
    const body = node.querySelector("pre");
    const isConfirmed = order.type === "confirmed";

    article.classList.add(order.type);
    status.className = "order-status";
    status.textContent = isConfirmed ? "Confermato" : "Cancellato";
    title.textContent = order.requestId || order.fileName;

    details.append(
      createOrderMeta("Importo", order.amount),
      createOrderMeta("Username", order.username),
      createOrderMeta("Formato", order.format),
      createOrderMeta("Aggiornato", formatDateTime(order.modifiedAt))
    );

    if (order.selectedZones) {
      details.appendChild(createOrderMeta("Zone", formatZones(order.selectedZones)));
    }

    body.textContent = order.content;
    container.appendChild(node);
  });
}

async function refreshOrders() {
  try {
    const data = await api("/api/orders");
    const confirmed = data.orders.filter(order => order.type === "confirmed");
    const cancelled = data.orders.filter(order => order.type === "cancelled");

    elements.confirmedCount.textContent = confirmed.length;
    elements.cancelledCount.textContent = cancelled.length;
    elements.ordersSummary.textContent = `${confirmed.length} confermati - ${cancelled.length} cancellati`;

    renderOrderList(elements.confirmedOrdersList, confirmed, "Nessun ordine confermato trovato.");
    renderOrderList(elements.cancelledOrdersList, cancelled, "Nessun ordine cancellato trovato.");
  } catch (error) {
    elements.confirmedOrdersList.textContent = error.message;
    elements.cancelledOrdersList.textContent = "";
  }
}

async function refreshLogs() {
  try {
    const data = await api("/api/logs");
    state.logs = data.logs;
    const previous = elements.logSelect.value;
    elements.logSelect.innerHTML = "";

    data.logs.forEach(log => {
      const option = document.createElement("option");
      option.value = log.name;
      option.textContent = `${log.name} (${log.size} B)`;
      elements.logSelect.appendChild(option);
    });

    if (previous && data.logs.some(log => log.name === previous)) {
      elements.logSelect.value = previous;
    }

    renderSelectedLog();
  } catch (error) {
    elements.logOutput.textContent = error.message;
  }
}

function renderSelectedLog() {
  const selected = elements.logSelect.value;
  const log = state.logs.find(item => item.name === selected) || state.logs[0];
  elements.logOutput.textContent = log ? log.content || "(log vuoto)" : "Nessun log trovato.";
}

async function refreshTasks(button) {
  setBusy(button, true);
  try {
    const [tasks, instances] = await Promise.all([
      api("/api/camunda/tasks"),
      api("/api/camunda/process-instances")
    ]);
    showRequestResponse("Stato Camunda", { tasks, processInstances: instances }, true);
  } catch (error) {
    showRequestResponse("Errore Camunda", error.payload || error.message, false);
  } finally {
    setBusy(button, false);
  }
}

async function runProjectAction(path, label, button) {
  setBusy(button, true);
  try {
    const data = await api(path, { method: "POST", body: "{}" });
    showRequestResponse(label, data, data.ok);
    await refreshAllSecondary();
    await refreshHealth();
  } catch (error) {
    showRequestResponse(`errore ${label}`, error.payload || error.message, false);
  } finally {
    setBusy(button, false);
  }
}

async function refreshAllSecondary() {
  await Promise.all([refreshOrders(), refreshLogs()]);
}

async function refreshAll() {
  await Promise.all([refreshHealth(), refreshOrders(), refreshLogs()]);
}

document.querySelector("#refreshAll").addEventListener("click", refreshAll);
document.querySelector("#refreshOrders").addEventListener("click", refreshOrders);
document.querySelector("#refreshLogs").addEventListener("click", refreshLogs);
document.querySelector("#loadTasks").addEventListener("click", event => refreshTasks(event.currentTarget));
document.querySelector("#sendStrategy").addEventListener("click", event => sendStrategy(event.currentTarget));
document.querySelector("#confirmDecision").addEventListener("click", event => sendDecision("confirm", event.currentTarget));
document.querySelector("#cancelDecision").addEventListener("click", event => sendDecision("cancel", event.currentTarget));
document.querySelector("#startStack").addEventListener("click", event => runProjectAction("/api/project/start", "start stack", event.currentTarget));
document.querySelector("#stopStack").addEventListener("click", event => runProjectAction("/api/project/stop", "stop stack", event.currentTarget));
elements.logSelect.addEventListener("change", renderSelectedLog);
elements.presetSelect.addEventListener("change", event => applyPreset(event.target.value));
elements.requestForm.addEventListener("submit", sendRequest);

populatePresetOptions();
applyPreset("standard");
refreshAll();
setInterval(refreshHealth, 15000);
setInterval(refreshAllSecondary, 12000);
