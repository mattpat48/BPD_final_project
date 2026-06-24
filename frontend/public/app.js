const state = {
  logs: [],
  latestRequestId: "",
  requestEntries: [],
  decisionEntries: [],
  requestExpanded: false,
  decisionExpanded: false,
  logsVisible: false
};

// --- i18n -------------------------------------------------------------------
// Hardcoded IT/EN dictionary. Plain strings are used as-is; functions build
// parameterized strings. Missing keys fall back to Italian, then to the key.
const translations = {
  it: {
    "app.title": "Dashboard di simulazione",
    "btn.openCamunda": "Apri Camunda",
    "btn.refreshAll": "Aggiorna tutto",
    "flow.step1.title": "Invia una richiesta",
    "flow.step1.desc": "Ottieni un Request ID e le zone selezionate",
    "flow.step2.title": "Conferma o annulla",
    "flow.step2.desc": "Usando il Request ID del passo 1",
    "flow.step3.title": "Ordine generato",
    "flow.step3.desc": "Compare nella sezione \"File generati\"",
    "req.eyebrow": "Simulatore processo",
    "req.title": "Nuova richiesta affissione",
    "f.username": "Username",
    "f.posterFormat": "Formato manifesto",
    "f.cities": "Citta, separate da virgola",
    "f.maxPrice": "Prezzo max per citta",
    "f.perCity": "Prezzo massimo diverso per singola citta (sovrascrive il prezzo globale)",
    "f.strategy": "Strategia selezione zone",
    "strat.default": "Predefinita — nessun parametro (usa greedy)",
    "strat.greedy": "Greedy — piu costose",
    "strat.maxzones": "Piu zone possibili",
    "strat.balanced": "Copertura bilanciata",
    "strat.lowest": "Spesa minima",
    "btn.sendRequest": "Invia richiesta",
    "common.outcome": "Esito",
    "req.sentTitle": "Richieste inviate",
    "status.waiting": "in attesa",
    "req.empty": "Invia una richiesta per vedere qui l'esito, il Request ID e le zone selezionate.",
    "dec.eyebrow": "Decisione cliente",
    "dec.title": "Conferma o annulla",
    "f.requestId": "Request ID",
    "ph.requestId": "Generato dal passo 1",
    "btn.confirm": "Conferma",
    "btn.cancel": "Annulla",
    "dec.sentTitle": "Decisioni inviate",
    "dec.empty": "Conferma o annulla una richiesta per vedere qui l'esito.",
    "orders.eyebrow": "Ordini",
    "orders.title": "File generati",
    "btn.refreshOrders": "Aggiorna ordini",
    "btn.deleteAll": "Elimina tutti",
    "orders.confirmed": "Confermati",
    "orders.cancelled": "Cancellati",
    "diag.eyebrow": "Diagnostica",
    "diag.title": "Log runtime",
    "btn.showLogs": "Mostra log",
    "btn.hideLogs": "Nascondi log",
    "btn.refreshLogs": "Aggiorna log",
    "strategyLabel.GREEDY": "Greedy — piu costose",
    "strategyLabel.MAX_ZONES": "Piu zone possibili",
    "strategyLabel.BALANCED_COVERAGE": "Copertura bilanciata",
    "strategyLabel.LOWEST_TOTAL": "Spesa minima",
    "preset.expectPrefix": "Esito atteso",
    "preset.standard.label": "Valido · L'Aquila + Rome",
    "preset.standard.expect": "OK 200 — richiesta valida, requestId generato",
    "preset.milan.label": "Valido · Milan budget alto",
    "preset.milan.expect": "OK 200 — seleziona piu zone fino al budget",
    "preset.userNotFound.label": "Errore · Utente inesistente",
    "preset.userNotFound.expect": "404 Not Found — USER_NOT_FOUND",
    "preset.cityNotServed.label": "Errore · Citta non servita",
    "preset.cityNotServed.expect": "422 Unprocessable — NO_AFFORDABLE_ZONES",
    "preset.budgetTooLow.label": "Errore · Budget troppo basso",
    "preset.budgetTooLow.expect": "422 Unprocessable — NO_AFFORDABLE_ZONES",
    "preset.invalid.label": "Errore · Input non valido",
    "preset.invalid.expect": "400 Bad Request — validazione API (campi mancanti)",
    "note.ready": id => `Request ID "${id}" pronto: ora puoi confermare o annullare l'affissione.`,
    "note.notReady": "Prima invia una richiesta (passo 1): otterrai un Request ID, che comparira qui in automatico. Solo allora potrai confermare o annullare.",
    "resp.requestSent": "Richiesta inviata",
    "resp.requestError": "Errore richiesta",
    "resp.decisionPrefix": "Decisione",
    "resp.decisionError": "Errore decisione",
    "resp.requestIdMissing": "requestId mancante",
    "resp.requestIdMissingBody": "Inserisci o genera un requestId prima della decisione.",
    "tl.request": "Richiesta",
    "tl.decision": "Decisione",
    "tl.ok": "OK",
    "tl.error": "Errore",
    "tl.showLatest": "Mostra solo l'ultima",
    "tl.showHistory": n => `Mostra storico (${n} precedenti)`,
    "tl.techDetails": "Dettagli tecnici (JSON)",
    "tl.sent": "Dati inviati",
    "tl.received": "Risposta ricevuta",
    "fr.requestId": "Request ID",
    "fr.strategyUsed": "Strategia usata",
    "fr.total": "Totale",
    "fr.warnBudget": cities => `⚠ Nessuna zona entro il budget per: ${cities}`,
    "fr.zonesSelected": n => `Zone selezionate (${n})`,
    "fr.zone": "Zona",
    "fr.confirmed": "✓ Affissione confermata",
    "fr.cancelled": "✕ Richiesta annullata",
    "fr.accountHolder": "Intestatario",
    "fr.invoice": "N° fattura",
    "fr.amount": "Importo",
    "fr.errorWord": "Errore",
    "order.confirmed": "Confermato",
    "order.cancelled": "Cancellato",
    "meta.amount": "Importo",
    "meta.username": "Username",
    "meta.format": "Formato",
    "meta.updated": "Aggiornato",
    "meta.zones": "Zone",
    "orders.emptyConfirmed": "Nessun ordine confermato trovato.",
    "orders.emptyCancelled": "Nessun ordine cancellato trovato.",
    "orders.summary": (c, x) => `${c} confermati - ${x} cancellati`,
    "orders.deleteConfirm": "Eliminare TUTTI i file generati (confermati e cancellati)? L'operazione non e reversibile.",
    "orders.deleted": n => `${n} file eliminati`,
    "orders.deleteError": msg => `Errore eliminazione: ${msg}`,
    "health.checking": "Controllo servizi...",
    "health.error": "Errore health",
    "log.empty": "(log vuoto)",
    "log.none": "Nessun log trovato.",
    "perCity.placeholder": "usa globale",
    "perCity.enterCities": "Inserisci prima una o piu citta qui sopra."
  },
  en: {
    "app.title": "Simulation dashboard",
    "btn.openCamunda": "Open Camunda",
    "btn.refreshAll": "Refresh all",
    "flow.step1.title": "Send a request",
    "flow.step1.desc": "Get a Request ID and the selected zones",
    "flow.step2.title": "Confirm or cancel",
    "flow.step2.desc": "Using the Request ID from step 1",
    "flow.step3.title": "Order generated",
    "flow.step3.desc": "Appears in the \"Generated files\" section",
    "req.eyebrow": "Process simulator",
    "req.title": "New billposting request",
    "f.username": "Username",
    "f.posterFormat": "Poster format",
    "f.cities": "Cities, comma-separated",
    "f.maxPrice": "Max price per city",
    "f.perCity": "Different max price per city (overrides the global price)",
    "f.strategy": "Zone-selection strategy",
    "strat.default": "Default — no parameter (uses greedy)",
    "strat.greedy": "Greedy — most expensive",
    "strat.maxzones": "Most zones possible",
    "strat.balanced": "Balanced coverage",
    "strat.lowest": "Minimum spend",
    "btn.sendRequest": "Send request",
    "common.outcome": "Outcome",
    "req.sentTitle": "Requests sent",
    "status.waiting": "waiting",
    "req.empty": "Send a request to see the outcome, the Request ID and the selected zones here.",
    "dec.eyebrow": "Customer decision",
    "dec.title": "Confirm or cancel",
    "f.requestId": "Request ID",
    "ph.requestId": "Generated in step 1",
    "btn.confirm": "Confirm",
    "btn.cancel": "Cancel",
    "dec.sentTitle": "Decisions sent",
    "dec.empty": "Confirm or cancel a request to see the outcome here.",
    "orders.eyebrow": "Orders",
    "orders.title": "Generated files",
    "btn.refreshOrders": "Refresh orders",
    "btn.deleteAll": "Delete all",
    "orders.confirmed": "Confirmed",
    "orders.cancelled": "Cancelled",
    "diag.eyebrow": "Diagnostics",
    "diag.title": "Runtime logs",
    "btn.showLogs": "Show logs",
    "btn.hideLogs": "Hide logs",
    "btn.refreshLogs": "Refresh logs",
    "strategyLabel.GREEDY": "Greedy — most expensive",
    "strategyLabel.MAX_ZONES": "Most zones possible",
    "strategyLabel.BALANCED_COVERAGE": "Balanced coverage",
    "strategyLabel.LOWEST_TOTAL": "Minimum spend",
    "preset.expectPrefix": "Expected outcome",
    "preset.standard.label": "Valid · L'Aquila + Rome",
    "preset.standard.expect": "OK 200 — valid request, requestId generated",
    "preset.milan.label": "Valid · Milan high budget",
    "preset.milan.expect": "OK 200 — selects more zones up to budget",
    "preset.userNotFound.label": "Error · Non-existent user",
    "preset.userNotFound.expect": "404 Not Found — USER_NOT_FOUND",
    "preset.cityNotServed.label": "Error · Unserved city",
    "preset.cityNotServed.expect": "422 Unprocessable — NO_AFFORDABLE_ZONES",
    "preset.budgetTooLow.label": "Error · Budget too low",
    "preset.budgetTooLow.expect": "422 Unprocessable — NO_AFFORDABLE_ZONES",
    "preset.invalid.label": "Error · Invalid input",
    "preset.invalid.expect": "400 Bad Request — API validation (missing fields)",
    "note.ready": id => `Request ID "${id}" ready: you can now confirm or cancel the billposting.`,
    "note.notReady": "First send a request (step 1): you will get a Request ID, which appears here automatically. Only then can you confirm or cancel.",
    "resp.requestSent": "Request sent",
    "resp.requestError": "Request error",
    "resp.decisionPrefix": "Decision",
    "resp.decisionError": "Decision error",
    "resp.requestIdMissing": "missing requestId",
    "resp.requestIdMissingBody": "Enter or generate a requestId before the decision.",
    "tl.request": "Request",
    "tl.decision": "Decision",
    "tl.ok": "OK",
    "tl.error": "Error",
    "tl.showLatest": "Show only the latest",
    "tl.showHistory": n => `Show history (${n} previous)`,
    "tl.techDetails": "Technical details (JSON)",
    "tl.sent": "Data sent",
    "tl.received": "Response received",
    "fr.requestId": "Request ID",
    "fr.strategyUsed": "Strategy used",
    "fr.total": "Total",
    "fr.warnBudget": cities => `⚠ No zone within budget for: ${cities}`,
    "fr.zonesSelected": n => `Selected zones (${n})`,
    "fr.zone": "Zone",
    "fr.confirmed": "✓ Billposting confirmed",
    "fr.cancelled": "✕ Request cancelled",
    "fr.accountHolder": "Account holder",
    "fr.invoice": "Invoice no.",
    "fr.amount": "Amount",
    "fr.errorWord": "Error",
    "order.confirmed": "Confirmed",
    "order.cancelled": "Cancelled",
    "meta.amount": "Amount",
    "meta.username": "Username",
    "meta.format": "Format",
    "meta.updated": "Updated",
    "meta.zones": "Zones",
    "orders.emptyConfirmed": "No confirmed order found.",
    "orders.emptyCancelled": "No cancelled order found.",
    "orders.summary": (c, x) => `${c} confirmed - ${x} cancelled`,
    "orders.deleteConfirm": "Delete ALL generated files (confirmed and cancelled)? This cannot be undone.",
    "orders.deleted": n => `${n} files deleted`,
    "orders.deleteError": msg => `Deletion error: ${msg}`,
    "health.checking": "Checking services...",
    "health.error": "Health error",
    "log.empty": "(empty log)",
    "log.none": "No log found.",
    "perCity.placeholder": "use global",
    "perCity.enterCities": "Enter one or more cities above first."
  }
};

let currentLang = localStorage.getItem("bpdLang") || "it";

function t(key, ...args) {
  const dict = translations[currentLang] || translations.it;
  let value = dict[key];
  if (value == null) value = translations.it[key];
  if (value == null) return key;
  return typeof value === "function" ? value(...args) : value;
}

// Each preset declares the form values and the kind of outcome we expect. The human-readable
// label/hint live in the i18n dictionary (keys preset.<name>.label / .expect).
const presets = {
  standard: { kind: "ok", username: "mariorossi", posterFormat: "60x80", cities: "L'Aquila, Rome", maxPrice: "20" },
  milan: { kind: "ok", username: "mariorossi", posterFormat: "60x80", cities: "Milan", maxPrice: "130" },
  userNotFound: { kind: "error", username: "ghostuser", posterFormat: "60x80", cities: "Rome", maxPrice: "50" },
  cityNotServed: { kind: "error", username: "mariorossi", posterFormat: "60x80", cities: "Napoli", maxPrice: "50" },
  budgetTooLow: { kind: "error", username: "mariorossi", posterFormat: "60x80", cities: "Milan", maxPrice: "1" },
  invalid: { kind: "error", username: "", posterFormat: "60x80", cities: "", maxPrice: "0" }
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
  perCityToggle: document.querySelector("#perCityToggle"),
  perCityContainer: document.querySelector("#perCityContainer"),
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
  logOutput: document.querySelector("#logOutput"),
  langIt: document.querySelector("#langIt"),
  langEn: document.querySelector("#langEn")
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
  return date.toLocaleString(currentLang === "en" ? "en-GB" : "it-IT", {
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
  const key = "strategyLabel." + value;
  const dict = translations[currentLang] || translations.it;
  return dict[key] != null ? dict[key] : (translations.it[key] != null ? translations.it[key] : value);
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
  title.textContent = t("fr.zonesSelected", zones.length);
  wrap.appendChild(title);

  const list = document.createElement("div");
  list.className = "zone-list";
  zones.forEach(zone => {
    const chip = document.createElement("span");
    chip.className = "zone-chip";

    const name = document.createElement("span");
    name.className = "zone-chip-name";
    name.textContent = `${zone.city || ""}${zone.name ? " · " + zone.name : ""}`.trim() || t("fr.zone");

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
      ? (payload.error || payload.message || t("fr.errorWord"))
      : (typeof payload === "string" && payload ? payload : t("fr.errorWord"));
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
      [t("fr.requestId"), payload.requestId || "—", "mono"],
      [t("fr.strategyUsed"), strategyLabel(payload.usedStrategy)],
      [t("fr.total"), formatPrice(payload.totalPrice), "accent"]
    ]));
    const skipped = parseCityList(payload.skippedCities);
    if (skipped.length) {
      const warn = document.createElement("div");
      warn.className = "warn-banner";
      warn.textContent = t("fr.warnBudget", skipped.join(", "));
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
  banner.textContent = confirmed ? t("fr.confirmed") : t("fr.cancelled");
  wrap.appendChild(banner);

  if (confirmed) {
    wrap.appendChild(createFactGrid([
      [t("fr.accountHolder"), payload.accountHolder || "—"],
      [t("fr.invoice"), payload.invoiceNumber || "—", "mono"],
      [t("fr.amount"), formatPrice(payload.amountDue), "accent"]
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
    status.textContent = entry.ok ? t("tl.ok") : t("tl.error");
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
    summary.textContent = t("tl.techDetails");
    details.appendChild(summary);

    const techGrid = document.createElement("div");
    techGrid.className = "tech-grid";
    if (entry.request) techGrid.appendChild(createJsonDetail(t("tl.sent"), entry.request));
    techGrid.appendChild(createJsonDetail(t("tl.received"), entry.payload));
    details.appendChild(techGrid);
    body.appendChild(details);

    card.append(header, body);
    container.appendChild(card);
  });

  if (expandKey && entries.length > 1) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary timeline-toggle";
    toggle.textContent = expanded ? t("tl.showLatest") : t("tl.showHistory", entries.length - 1);
    toggle.addEventListener("click", () => {
      state[expandKey] = !state[expandKey];
      renderTimeline(container, entries, emptyText, titlePrefix, expandKey);
    });
    container.appendChild(toggle);
  }
}

function renderRequestTimeline() {
  renderTimeline(elements.requestTimeline, state.requestEntries, t("req.empty"), t("tl.request"), "requestExpanded");
}

function renderDecisionTimeline() {
  renderTimeline(elements.decisionTimeline, state.decisionEntries, t("dec.empty"), t("tl.decision"), "decisionExpanded");
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
    renderRequestTimeline();
  }
}

function showDecisionResponse(label, payload, ok = true, context = {}) {
  setStatus(elements.decisionStatus, label, ok);
  if (context.track) {
    addTimelineEntry(state.decisionEntries, "decision", label, payload, ok, context);
    renderDecisionTimeline();
  }
}

// Keep step 2 locked until a Request ID exists, and explain why in plain language.
function updateDecisionState() {
  const id = elements.requestId.value.trim();
  const ready = id.length > 0;
  elements.confirmDecision.disabled = !ready;
  elements.cancelDecision.disabled = !ready;
  elements.decisionNote.classList.toggle("ready", ready);
  elements.decisionNote.textContent = ready ? t("note.ready", id) : t("note.notReady");
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
  const previous = elements.presetSelect.value;
  elements.presetSelect.innerHTML = "";
  Object.keys(presets).forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = t(`preset.${value}.label`);
    elements.presetSelect.appendChild(option);
  });
  if (previous) elements.presetSelect.value = previous;
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
    elements.presetHint.textContent = `${t("preset.expectPrefix")}: ${t(`preset.${name}.expect`)}`;
    elements.presetHint.classList.toggle("is-error", preset.kind === "error");
    elements.presetHint.classList.toggle("is-ok", preset.kind !== "error");
  }
  elements.presetHint.dataset.preset = name;

  // Keep the per-city inputs in sync with the preset's cities.
  renderPerCityInputs();
}

// --- Per-city max price overrides -------------------------------------------
function citiesFromForm() {
  return elements.cities.value.split(",").map(city => city.trim()).filter(Boolean);
}

// Re-render the per-city inputs to match the cities currently typed, preserving any value
// the user already entered for a city that is still present.
function renderPerCityInputs() {
  const enabled = elements.perCityToggle.checked;
  elements.perCityContainer.hidden = !enabled;
  if (!enabled) {
    elements.perCityContainer.innerHTML = "";
    return;
  }

  // Snapshot existing values so they survive the re-render.
  const previous = {};
  elements.perCityContainer.querySelectorAll("input[data-city]").forEach(input => {
    if (input.value !== "") previous[input.dataset.city] = input.value;
  });

  elements.perCityContainer.innerHTML = "";
  const cities = citiesFromForm();

  if (!cities.length) {
    const hint = document.createElement("p");
    hint.className = "per-city-empty";
    hint.textContent = t("perCity.enterCities");
    elements.perCityContainer.appendChild(hint);
    return;
  }

  cities.forEach(city => {
    const label = document.createElement("label");
    label.className = "per-city-item";

    const name = document.createElement("span");
    name.className = "per-city-name";
    name.textContent = city;
    name.title = city;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.1";
    input.dataset.city = city;
    input.placeholder = t("perCity.placeholder");
    if (previous[city] != null) input.value = previous[city];

    label.append(name, input);
    elements.perCityContainer.appendChild(label);
  });
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
  // When the per-city toggle is on, collect the overrides (city -> price). Cities left blank
  // keep using the global maxPrice, so we only send the ones the user actually filled in.
  if (elements.perCityToggle.checked) {
    const maxPrices = {};
    elements.perCityContainer.querySelectorAll("input[data-city]").forEach(input => {
      const raw = input.value.trim();
      if (raw !== "") {
        const value = Number(raw);
        if (!Number.isNaN(value)) maxPrices[input.dataset.city] = value;
      }
    });
    if (Object.keys(maxPrices).length) payload.maxPrices = maxPrices;
  }
  // Include `strategy` only when explicitly chosen. The empty option omits the field
  // entirely, so the backend falls back to its default GREEDY algorithm.
  const strategy = elements.strategy.value;
  if (strategy) payload.strategy = strategy;
  return payload;
}

async function refreshHealth() {
  elements.healthGrid.innerHTML = `<div class="service-tile"><strong>${t("health.checking")}</strong></div>`;
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
    elements.healthGrid.innerHTML = `<div class="service-tile offline"><strong>${t("health.error")}</strong><span>${error.message}</span></div>`;
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
    showRequestResponse(t("resp.requestSent"), data, true, {
      request: payload,
      requestId: data.requestId,
      track: true
    });
    await refreshAllSecondary();
  } catch (error) {
    showRequestResponse(t("resp.requestError"), error.payload || error.message, false, {
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
    showDecisionResponse(t("resp.requestIdMissing"), { error: t("resp.requestIdMissingBody") }, false, {
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
    showDecisionResponse(`${t("resp.decisionPrefix")}: ${decision}`, data, true, {
      request: payload,
      requestId,
      track: true
    });
    await refreshAllSecondary();
  } catch (error) {
    showDecisionResponse(t("resp.decisionError"), error.payload || error.message, false, {
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
  if (label === t("meta.zones")) item.classList.add("wide-order-meta");

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
    status.textContent = isConfirmed ? t("order.confirmed") : t("order.cancelled");
    title.textContent = order.requestId || order.fileName;

    details.append(
      createOrderMeta(t("meta.amount"), order.amount),
      createOrderMeta(t("meta.username"), order.username),
      createOrderMeta(t("meta.format"), order.format),
      createOrderMeta(t("meta.updated"), formatDateTime(order.modifiedAt))
    );

    if (order.selectedZones) {
      details.appendChild(createOrderMeta(t("meta.zones"), formatZones(order.selectedZones)));
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
    elements.ordersSummary.textContent = t("orders.summary", confirmed.length, cancelled.length);

    renderOrderList(elements.confirmedOrdersList, confirmed, t("orders.emptyConfirmed"));
    renderOrderList(elements.cancelledOrdersList, cancelled, t("orders.emptyCancelled"));
  } catch (error) {
    elements.confirmedOrdersList.textContent = error.message;
    elements.cancelledOrdersList.textContent = "";
  }
}

async function clearOrders(button) {
  const ok = window.confirm(t("orders.deleteConfirm"));
  if (!ok) return;

  setBusy(button, true);
  try {
    const data = await api("/api/orders", { method: "DELETE" });
    elements.ordersSummary.textContent = t("orders.deleted", data.deleted || 0);
    await refreshOrders();
  } catch (error) {
    elements.ordersSummary.textContent = t("orders.deleteError", error.message);
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
  elements.logOutput.textContent = log ? log.content || t("log.empty") : t("log.none");
}

function toggleLogs() {
  state.logsVisible = !state.logsVisible;
  elements.logsContent.hidden = !state.logsVisible;
  elements.logsToggle.setAttribute("aria-expanded", String(state.logsVisible));
  elements.logsToggle.textContent = state.logsVisible ? t("btn.hideLogs") : t("btn.showLogs");
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

// --- Language switch --------------------------------------------------------
// Apply translations to every element carrying a data-i18n / data-i18n-ph attribute.
function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    el.setAttribute("placeholder", t(el.dataset.i18nPh));
  });
  document.documentElement.lang = currentLang;
}

function setLanguage(lang) {
  currentLang = translations[lang] ? lang : "it";
  localStorage.setItem("bpdLang", currentLang);

  elements.langIt.classList.toggle("active", currentLang === "it");
  elements.langEn.classList.toggle("active", currentLang === "en");

  applyStaticI18n();

  // Re-render every dynamic piece so the chosen language takes effect immediately.
  populatePresetOptions();
  const activePreset = elements.presetHint.dataset.preset;
  if (activePreset && elements.presetHint.textContent) {
    elements.presetHint.textContent = `${t("preset.expectPrefix")}: ${t(`preset.${activePreset}.expect`)}`;
  }
  updateDecisionState();
  renderRequestTimeline();
  renderDecisionTimeline();
  renderPerCityInputs();
  if (state.logsVisible) {
    elements.logsToggle.textContent = t("btn.hideLogs");
  } else {
    elements.logsToggle.textContent = t("btn.showLogs");
  }
  renderSelectedLog();
  refreshOrders();
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
elements.perCityToggle.addEventListener("change", renderPerCityInputs);
elements.cities.addEventListener("input", () => {
  if (elements.perCityToggle.checked) renderPerCityInputs();
});
elements.langIt.addEventListener("click", () => setLanguage("it"));
elements.langEn.addEventListener("click", () => setLanguage("en"));

applyStaticI18n();
elements.langIt.classList.toggle("active", currentLang === "it");
elements.langEn.classList.toggle("active", currentLang === "en");
populatePresetOptions();
applyPreset("standard");
updateDecisionState();
refreshAll();
setInterval(refreshHealth, 15000);
setInterval(refreshAllSecondary, 12000);
