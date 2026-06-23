const state = {
  logs: [],
  latestRequestId: "",
  requestEntries: [],
  decisionEntries: [],
  requestExpanded: false,
  decisionExpanded: false,
  logsVisible: false
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

// Human-readable labels for the zone-selection algorithms returned by the backend.
const STRATEGY_LABELS = {
  GREEDY: "Greedy — piu costose",
  MAX_ZONES: "Piu zone possibili",
  BALANCED_COVERAGE: "Copertura bilanciata",
  LOWEST_TOTAL: "Spesa minima"
};

const elements = {
  healthGrid: document.querySelector("#healthGrid"),
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
  requestId: document.querySelector("#requestId"),
  decisionNote: document.querySelector("#decisionNote"),
  confirmDecision: document.querySelector("#confirmDecision"),
  cancelDecision: document.querySelector("#cancelDecision"),
  requestTimeline: document.querySelector("#requestTimeline"),
  decisionTimeline: document.querySelector("#decisionTimeline"),
  confirmedOrdersList: document.querySelector("#confirmedOrdersList"),
  cancelledOrdersList: document.querySelector("#cancelledOrdersList"),
  confirmedCount: document.querySelector("#confirmedCount"),
  cancelledCount: document.querySelector("#cancelledCount"),
  ordersSummary: document.querySelector("#ordersSummary"),
  clearOrders: document.querySelector("#clearOrders"),
  logsToggle: document.querySelector("#logsToggle"),
  logsContent: document.querySelector("#logsContent"),
  logSelect: document.querySelector("#logSelect"),
  refreshLogs: document.querySelector("#refreshLogs"),
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

function formatPrice(value) {
  const n = Number(value);
  if (value == null || value === "" || Number.isNaN(n)) return value == null ? "—" : String(value);
  return "€ " + n.toFixed(2);
}

function strategyLabel(value) {
  if (!value) return "—";
  return STRATEGY_LABELS[value] || value;
}

function parseZones(json) {
  if (!json) return [];
  try {
    const zones = JSON.parse(json);
    return Array.isArray(zones) ? zones : [];
  } catch {
    return [];
  }
}

// skippedCities arrives as a JSON string (e.g. '["Milan"]') or already as an array.
function parseCityList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function getRequestId(payload, fallback = "") {
  if (!payload || typeof payload !== "object") return fallback;
  return payload.requestId || payload.id || fallback;
}

function addTimelineEntry(entries, kind, label, payload, ok, context = {}) {
  entries.push({
    kind,
    label,
    payload,
    ok,
    request: context.request || null,
    requestId: context.requestId || getRequestId(payload, state.latestRequestId),
    createdAt: new Date(),
    sequence: entries.length + 1
  });
}

// --- Friendly rendering helpers ---------------------------------------------

function createFact(label, value, variant = "") {
  const fact = document.createElement("div");
  fact.className = "fact" + (variant ? ` ${variant}` : "");

  const strong = document.createElement("strong");
  strong.textContent = value == null || value === "" ? "—" : String(value);

  const span = document.createElement("span");
  span.textContent = label;

  fact.append(strong, span);
  return fact;
}

function createFactGrid(facts) {
  const grid = document.createElement("div");
  grid.className = "fact-grid";
  facts.forEach(([label, value, variant]) => grid.appendChild(createFact(label, value, variant)));
  return grid;
}

function createZoneList(zones) {
  const wrap = document.createElement("div");
  wrap.className = "zone-block";

  const title = document.createElement("span");
  title.className = "zone-block-title";
  title.textContent = `Zone selezionate (${zones.length})`;
  wrap.appendChild(title);

  const list = document.createElement("div");
  list.className = "zone-list";
  zones.forEach(zone => {
    const chip = document.createElement("span");
    chip.className = "zone-chip";

    const name = document.createElement("span");
    name.className = "zone-chip-name";
    name.textContent = `${zone.city || ""}${zone.name ? " · " + zone.name : ""}`.trim() || "Zona";

    const price = document.createElement("span");
    price.className = "zone-chip-price";
    price.textContent = formatPrice(zone.price);

    chip.append(name, price);
    list.appendChild(chip);
  });

  wrap.appendChild(list);
  return wrap;
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

function buildFriendly(entry) {
  const wrap = document.createElement("div");
  wrap.className = "friendly";

  const payload = entry.payload;

  // Error: surface the message (and business code) instead of a raw JSON dump.
  if (!entry.ok) {
    const box = document.createElement("div");
    box.className = "friendly-error";

    const msg = document.createElement("strong");
    const text = payload && typeof payload === "object"
      ? (payload.error || payload.message || "Errore")
      : (typeof payload === "string" && payload ? payload : "Errore");
    msg.textContent = text;
    box.appendChild(msg);

    if (payload && typeof payload === "object" && payload.errorCode) {
      const code = document.createElement("span");
      code.className = "code-badge";
      code.textContent = payload.errorCode;
      box.appendChild(code);
    }

    wrap.appendChild(box);
    return wrap;
  }

  if (entry.kind === "request") {
    wrap.appendChild(createFactGrid([
      ["Request ID", payload.requestId || "—", "mono"],
      ["Strategia usata", strategyLabel(payload.usedStrategy)],
      ["Totale", formatPrice(payload.totalPrice), "accent"]
    ]));
    const skipped = parseCityList(payload.skippedCities);
    if (skipped.length) {
      const warn = document.createElement("div");
      warn.className = "warn-banner";
      warn.textContent = `⚠ Nessuna zona entro il budget per: ${skipped.join(", ")}`;
      wrap.appendChild(warn);
    }
    const zones = parseZones(payload.selectedZonesJSON);
    if (zones.length) wrap.appendChild(createZoneList(zones));
    return wrap;
  }

  // decision
  const decision = entry.request && entry.request.decision;
  const confirmed = decision === "confirm";

  const banner = document.createElement("div");
  banner.className = `outcome-banner ${confirmed ? "ok" : "cancel"}`;
  banner.textContent = confirmed ? "✓ Affissione confermata" : "✕ Richiesta annullata";
  wrap.appendChild(banner);

  if (confirmed) {
    wrap.appendChild(createFactGrid([
      ["Intestatario", payload.accountHolder || "—"],
      ["N° fattura", payload.invoiceNumber || "—", "mono"],
      ["Importo", formatPrice(payload.amountDue), "accent"]
    ]));
  }
  return wrap;
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
      ? `${formatDateTime(entry.createdAt)} · requestId ${entry.requestId}`
      : formatDateTime(entry.createdAt);

    titleRow.append(title, status);
    header.append(titleRow, meta);

    const body = document.createElement("div");
    body.className = "response-card-body";
    body.appendChild(buildFriendly(entry));

    // Raw request/response stay available, but collapsed, for the technical view.
    const details = document.createElement("details");
    details.className = "tech-details";
    const summary = document.createElement("summary");
    summary.textContent = "Dettagli tecnici (JSON)";
    details.appendChild(summary);

    const techGrid = document.createElement("div");
    techGrid.className = "tech-grid";
    if (entry.request) techGrid.appendChild(createJsonDetail("Dati inviati", entry.request));
    techGrid.appendChild(createJsonDetail("Risposta ricevuta", entry.payload));
    details.appendChild(techGrid);
    body.appendChild(details);

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
  if (context.track) {
    addTimelineEntry(state.requestEntries, "request", label, payload, ok, context);
    renderTimeline(
      elements.requestTimeline,
      state.requestEntries,
      "Invia una richiesta per vedere qui l'esito, il Request ID e le zone selezionate.",
      "Richiesta",
      "requestExpanded"
    );
  }
}

function showDecisionResponse(label, payload, ok = true, context = {}) {
  setStatus(elements.decisionStatus, label, ok);
  if (context.track) {
    addTimelineEntry(state.decisionEntries, "decision", label, payload, ok, context);
    renderTimeline(
      elements.decisionTimeline,
      state.decisionEntries,
      "Conferma o annulla una richiesta per vedere qui l'esito.",
      "Decisione",
      "decisionExpanded"
    );
  }
}

// Keep step 2 locked until a Request ID exists, and explain why in plain language.
function updateDecisionState() {
  const id = elements.requestId.value.trim();
  const ready = id.length > 0;
  elements.confirmDecision.disabled = !ready;
  elements.cancelDecision.disabled = !ready;
  elements.decisionNote.classList.toggle("ready", ready);
  elements.decisionNote.textContent = ready
    ? `Request ID "${id}" pronto: ora puoi confermare o annullare l'affissione.`
    : "Prima invia una richiesta (passo 1): otterrai un Request ID, che comparira qui in automatico. Solo allora potrai confermare o annullare.";
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
  // Default to the empty option => no `strategy` field is sent (backend uses greedy).
  elements.strategy.value = preset.strategy || "";

  if (elements.presetHint) {
    elements.presetHint.textContent = `Esito atteso: ${preset.expect}`;
    elements.presetHint.classList.toggle("is-error", preset.kind === "error");
    elements.presetHint.classList.toggle("is-ok", preset.kind !== "error");
  }
}

function requestPayloadFromForm() {
  const payload = {
    username: elements.username.value.trim(),
    posterFormat: elements.posterFormat.value,
    cities: elements.cities.value
      .split(",")
      .map(city => city.trim())
      .filter(Boolean),
    maxPrice: Number(elements.maxPrice.value)
  };
  // Include `strategy` only when explicitly chosen. The empty option omits the field
  // entirely, so the backend falls back to its default GREEDY algorithm.
  const strategy = elements.strategy.value;
  if (strategy) payload.strategy = strategy;
  return payload;
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

    if (data.requestId) {
      state.latestRequestId = data.requestId;
      elements.requestId.value = data.requestId;
      updateDecisionState();
    }
    showRequestResponse("Richiesta inviata", data, true, {
      request: payload,
      requestId: data.requestId,
      track: true
    });
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

async function clearOrders(button) {
  const ok = window.confirm("Eliminare TUTTI i file generati (confermati e cancellati)? L'operazione non e reversibile.");
  if (!ok) return;

  setBusy(button, true);
  try {
    const data = await api("/api/orders", { method: "DELETE" });
    elements.ordersSummary.textContent = `${data.deleted || 0} file eliminati`;
    await refreshOrders();
  } catch (error) {
    elements.ordersSummary.textContent = `Errore eliminazione: ${error.message}`;
  } finally {
    setBusy(button, false);
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

function toggleLogs() {
  state.logsVisible = !state.logsVisible;
  elements.logsContent.hidden = !state.logsVisible;
  elements.logsToggle.setAttribute("aria-expanded", String(state.logsVisible));
  elements.logsToggle.textContent = state.logsVisible ? "Nascondi log" : "Mostra log";
  if (state.logsVisible) refreshLogs();
}

async function refreshAllSecondary() {
  const tasks = [refreshOrders()];
  if (state.logsVisible) tasks.push(refreshLogs());
  await Promise.all(tasks);
}

async function refreshAll() {
  const tasks = [refreshHealth(), refreshOrders()];
  if (state.logsVisible) tasks.push(refreshLogs());
  await Promise.all(tasks);
}

document.querySelector("#refreshAll").addEventListener("click", refreshAll);
document.querySelector("#refreshOrders").addEventListener("click", refreshOrders);
elements.clearOrders.addEventListener("click", event => clearOrders(event.currentTarget));
elements.refreshLogs.addEventListener("click", refreshLogs);
elements.logsToggle.addEventListener("click", toggleLogs);
elements.confirmDecision.addEventListener("click", event => sendDecision("confirm", event.currentTarget));
elements.cancelDecision.addEventListener("click", event => sendDecision("cancel", event.currentTarget));
elements.requestId.addEventListener("input", updateDecisionState);
elements.logSelect.addEventListener("change", renderSelectedLog);
elements.presetSelect.addEventListener("change", event => applyPreset(event.target.value));
elements.requestForm.addEventListener("submit", sendRequest);

populatePresetOptions();
applyPreset("standard");
updateDecisionState();
refreshAll();
setInterval(refreshHealth, 15000);
setInterval(refreshAllSecondary, 12000);
