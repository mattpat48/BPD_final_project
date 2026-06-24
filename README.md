# Public Billposting Process — Project Report

**Course:** Business Process Development (BPD) — DISIM, University of L'Aquila
**Scenario:** *Public Billposting Service* — handling requests for public poster billposting
**Technologies:** Spring Boot 2.7.9 · Camunda Platform 7.19 (embedded) · REST/SOAP connectors · FreeMarker · H2
**Author:** Giovanni Altieri

> This document is the full project report: it describes *what* the system does, *how* it is built and *why* each design decision was made. It is meant to be read and discussed during the exam.

---

## Table of contents

1. [Introduction and scenario](#1-introduction-and-scenario)
2. [Assignment requirements and their coverage](#2-assignment-requirements-and-their-coverage)
3. [System architecture](#3-system-architecture)
4. [Technology stack and baseline choices](#4-technology-stack-and-baseline-choices)
5. [Repository structure](#5-repository-structure)
6. [The BPMN process, step by step](#6-the-bpmn-process-step-by-step)
7. [Process variables](#7-process-variables)
8. [The two REST endpoints and message correlation](#8-the-two-rest-endpoints-and-message-correlation)
9. [Communicating with external services: the connectors](#9-communicating-with-external-services-the-connectors)
10. [The Script Tasks (JavaScript)](#10-the-script-tasks-javascript)
11. [The FreeMarker templates](#11-the-freemarker-templates)
12. [The zone-selection strategies](#12-the-zone-selection-strategies)
13. [Per-city maximum price](#13-per-city-maximum-price)
14. [Error handling](#14-error-handling)
15. [File persistence](#15-file-persistence)
16. [The frontend dashboard](#16-the-frontend-dashboard)
17. [Summary of design choices](#17-summary-of-design-choices)
18. [How to build and run](#18-how-to-build-and-run)
19. [Example calls and outcomes](#19-example-calls-and-outcomes)
20. [Possible future extensions](#20-possible-future-extensions)

---

## 1. Introduction and scenario

The project models and automates the process of **public poster billposting** across one or more cities, exposing it as a service. A customer:

1. submits a request specifying their username, the poster format, the list of cities and the maximum price they are willing to spend for each city;
2. the system retrieves the customer's personal data and the list of available billposting zones (with their prices) from two external services;
3. for each city the process **automatically selects the zones** within budget, according to a chosen strategy;
4. queries a *posting* service to verify the actual availability of the selected zones, obtaining a **request identifier** (`requestId`);
5. returns to the customer the selected zones, the total and the `requestId`;
6. later, the customer **confirms** or **cancels** the request using the `requestId`:
   - on **confirmation**, the posting service issues an **invoice** (account holder, invoice number, amount), which is saved to a file and returned to the customer;
   - on **cancellation**, the request is revoked and an empty invoice is returned.

The core of the system is an **executable BPMN process** orchestrated by the Camunda engine, embedded in a Spring Boot application.

---

## 2. Assignment requirements and their coverage

The assignment requires, in short:

| Assignment requirement | How it is satisfied |
|---|---|
| Model the process in **BPMN** | `PublicBillposting.bpmn` |
| Run it with **embedded Camunda** in Spring Boot | the `it.univaq.disim.bpd` application |
| Expose **two APIs** (REST or SOAP) | two REST endpoints: `POST /api/request` and `POST /api/decision` |
| The APIs **start/resume** the process **via correlated messages** | *message start event* (`StartRequest`) + *message catch event* (`DecisionMessage`) |
| Talk to external services through **connectors** | `http-connector` (REST) and `soap-http-connector` (SOAP) |
| **Additional tasks** for the extra computation | zone-selection Script Task, validations, logging |
| **Robustness / error handling** (no raw 500s, semantic HTTP statuses) | validations + *error event sub-process* + `errorCode → HTTP` mapping |
| **Multiple strategies** for zone selection, chosen by the user | 4 strategies selectable via the `strategy` field |
| Use **templates** for complex inputs and the generated file | 3 SOAP templates + 1 order-file template (FreeMarker) |
| **Extend** the system with useful features | web dashboard, per-city price, multiple strategies |

> The *robustness, templates and multiple strategies* part (page 12 of the assignment) is mandatory in the absence of the midterm: it has been implemented in full.

---

## 3. System architecture

The system consists of a central application (process engine + APIs), three simulated external services and a supporting dashboard.

```
                         ┌───────────────────────────────────────────────┐
  Web dashboard          │   Spring Boot + Camunda Engine (port 8080)     │
  (Node, port 5174)      │                                               │
        │  HTTP           │   ProcessController (REST)                    │
        └────────────────▶│     POST /api/request   → start message      │
                          │     POST /api/decision  → decision message   │
                          │                ▼                             │
                          │   BPMN process  "PublicBillposting"           │
                          │   ┌────────────────────────────────────────┐ │
                          │   │ GetUser → ValidateUser → GetZones →     │ │
                          │   │ SelectZones → CheckAvail → ValidateAvail│ │
                          │   │  → (await decision) → confirm/cancel    │ │
                          │   └────────────────────────────────────────┘ │
                          └──────┬───────────────┬───────────────┬────────┘
              http-connector     │               │               │ soap-http-connector
                                 ▼               ▼               ▼
                         user-service      zones-service    posting-service
                         REST  :9080        REST  :9090       SOAP  :8888
                         /user/<username>   /zones/<format>   /postingservice
```

| Component | Type | Port | Role |
|---|---|---|---|
| Main application | Spring Boot + Camunda | 8080 | Exposes the 2 APIs and runs the process |
| `user-service.jar` | REST | 9080 | `GET /user/<username>` → personal data |
| `zones-service.jar` | REST | 9090 | `GET /zones/<format>` → available zones and prices |
| `posting-service.jar` | SOAP | 8888 | availability / confirmation / cancellation + invoice |
| Dashboard | Node.js (extra) | 5174 | UI to try the APIs, health, orders, logs |

**Why this separation.** The three services represent third-party systems (customer registry, zone catalogue, billposting/invoicing system) that in the real world would be operated by different parties. Keeping them as separate processes, invoked only through connectors, makes the BPMN process **agnostic** to their implementation and respects the principle of loose coupling.

---

## 4. Technology stack and baseline choices

| Technology | Version | Rationale |
|---|---|---|
| **Java** | 8 | The target version required by the course toolchain; `maven.compiler.source/target = 8`. |
| **Spring Boot** | 2.7.9 | Fast startup, embedded Tomcat, native integration with Camunda. |
| **Camunda Platform** | 7.19 | Standard BPMN 2.0 engine, embeddable, with the Cockpit/Tasklist webapp for inspection. |
| **Spin + Connect plugins** | from BOM | `Spin` for JSON/XML parsing inside scripts; `Connect` for the HTTP/SOAP connectors. |
| **FreeMarker template engine** | from BOM | Generation of XML payloads and text files, separating *layout* from logic. |
| **H2** | in-memory | Process database (runtime + history) with no external dependency, ideal for a demo. |

**Configuration choices** (`application.properties`):
- in-memory H2 database with `DB_CLOSE_DELAY=-1` to keep the state alive as long as the application is running;
- Camunda admin user `demo/demo` to access the webapp;
- `historyTimeToLive=1` on the process: history is kept long enough to read the variables after the instance ends (e.g. the invoice) but is subject to cleanup, avoiding unbounded database growth.

**Why embedded Camunda and not standalone.** Embedding the engine in the Spring Boot application yields a single deployable artifact; the REST APIs and the process share the same in-process `RuntimeService`/`HistoryService` (no network latency between controller and engine) and transaction management is unified.

---

## 5. Repository structure

```
BPD_final_project/
├── pom.xml                         # Maven build, Camunda/Spring dependencies
├── start.ps1 / stop.ps1            # start/stop the whole stack (Windows)
├── start_all.sh / stop_all.sh      # Unix equivalents
├── services/                       # the three simulated external services (jars)
│   ├── user-service.jar
│   ├── zones-service.jar
│   └── posting-service.jar
├── src/main/java/it/univaq/disim/bpd/
│   ├── Application.java             # Spring Boot main
│   └── ProcessController.java       # the two REST endpoints
├── src/main/resources/
│   ├── application.properties       # Spring/Camunda/H2 configuration
│   ├── processes/
│   │   └── PublicBillposting.bpmn    # the process model
│   ├── scripts/                     # Script Tasks (JavaScript)
│   │   ├── validateUser.js
│   │   ├── zoneStrategies.js
│   │   ├── validateAvailability.js
│   │   ├── validateConfirmation.js
│   │   ├── extractAvailability.js / extractRequestId.js
│   │   ├── extractAccountHolder.js / extractInvoiceNumber.js / extractAmountDue.js
│   │   ├── saveOrderFile.js / logCancellation.js
│   │   └── handleError.js
│   └── templates/                   # FreeMarker templates (.ftl)
│       ├── availabilityRequest.ftl
│       ├── confirmationRequest.ftl
│       ├── cancellationRequest.ftl
│       └── orderFile.ftl
├── frontend/                        # web dashboard (extra)
│   ├── server.js                    # Node server + proxy to the backend
│   └── public/ (index.html, app.js, styles.css)
├── data/orders/                     # generated files (confirmed / cancelled)
└── docs/Documentazione_Progetto.md  # gap analysis and technical changelog
```

**Why scripts and templates are external files** (and not inlined in the BPMN XML): to keep the model readable, version the logic separately, and be able to test/modify it without touching the diagram. In the BPMN they are referenced with `camunda:resource="classpath:scripts/..."`.

---

## 6. The BPMN process, step by step

The `PublicBillposting` process consists of a linear main flow, two decision branches (confirm/cancel) and an error-handling sub-process.

**Legend:** `( )` event · `[ ]` Service Task (connector) · `< >` Script Task · `○` message event · `◇` gateway

```
(Start: StartRequest message)
   → [Get User Data]  → <Validate User>
   → [Get Zone List]  → <Select Zones (strategy)>
   → [Check Availability (SOAP)] → <Validate Availability>
   → ○(Wait for user decision : DecisionMessage)
   → ◇ Decision?
        ├── confirm ──> [Confirm Request (SOAP)] → <Validate Confirmation> → <Save Order Details> → (End: Order Confirmed)
        └── cancel  ──> [Cancel Request (SOAP)]  → <Log Cancellation>      → (End: Order Cancelled)

   Event Sub-Process (interrupting, triggered by error):
   (Business error) → <Record Error> → (End: Process Ended (Error))
```

### 6.1 Start — *Message Start Event* `StartRequest`
The process is **not** started "by key", but by **correlating** a `StartRequest` message sent by the `POST /api/request` endpoint. This way **both** interactions with the process (start and resume) happen via message, as the assignment requires.

### 6.2 `Get User Data` — Service Task (http-connector)
Performs `GET http://localhost:9080/user/${username}`. Maps the response body into the `userResponse` variable and the HTTP status into `userStatusCode`.
*Why a Service Task with a connector:* it is a synchronous request/response call to a REST service; the HTTP connector is the Camunda construct designed exactly for this.

### 6.3 `Validate User` — Script Task
Checks that the status is 200 and the body is non-empty. If the user does not exist (404/empty body) it raises a `BpmnError` `USER_NOT_FOUND`; otherwise it converts the JSON into a reusable **Spin** object (`userData`) for the templates.
*Why here:* the connector cannot tell a "non-existent user" from a technical error; semantic validation is business logic and belongs in a dedicated task.

### 6.4 `Get Zone List` — Service Task (http-connector)
Performs `GET http://localhost:9090/zones/${posterFormat}` and stores the zone list in `availableZonesJSON`.

### 6.5 `Select Zones (strategy)` — Script Task
This is the **extra-computation task** required by the assignment. For each city it selects the zones within budget according to the chosen strategy (default *greedy*, most expensive first). It produces `selectedZonesJSON`, `selectedZonesSpin`, `totalPrice`, `usedStrategy` and `skippedCities`. If no zone can be selected it raises `NO_AFFORDABLE_ZONES`; if the catalogue is empty it raises `NO_ZONES_AVAILABLE`.

### 6.6 `Check Availability (SOAP)` — Service Task (soap-http-connector)
Sends an `availabilityRequest` SOAP message to the posting service, built with a FreeMarker template (customer data + zones). It extracts `isAvailable` and `requestId` from the response.

### 6.7 `Validate Availability` — Script Task
If the `requestId` is missing or the zones are not available, it raises `POSTING_SERVICE_ERROR` or `NOT_AVAILABLE` respectively. This prevents the process from proceeding to the wait state with an unusable identifier.

### 6.8 `Wait for user decision` — *Intermediate Message Catch Event*
The process **suspends** and waits for the `DecisionMessage`, correlated by `requestId`. This is the state where the instance sits between the first and the second API call.
*Why a message catch event:* the customer's decision is asynchronous (it may arrive much later); the "wait for a correlated message" pattern is the natural BPMN translation of this wait.

### 6.9 `Decision?` — Exclusive Gateway
Routes to the *confirm* or *cancel* branch based on the `decision` variable set by the message.

### 6.10 *Confirm* branch
- `Confirm Request (SOAP)`: sends `confirmationRequest` and obtains the invoice (`accountHolder`, `invoiceNumber`, `amountDue`).
- `Validate Confirmation` (Script): checks that the invoice is valid; otherwise it raises `POSTING_SERVICE_ERROR`.
- `Save Order Details` (Script + template): generates the order file from the `orderFile.ftl` template and writes it to disk.
- End: `Order Confirmed`.

### 6.11 *Cancel* branch
- `Cancel Request (SOAP)`: sends `cancelRequest` to revoke the booking.
- `Log Cancellation` (Script): prints the notice and writes a cancellation file.
- End: `Order Cancelled`.

### 6.12 `Error Handling` — *Event Sub-Process* (interrupting)
Catches **any** business `BpmnError` raised by the validation tasks. The `Record Error` script logs `errorCode`/`errorMessage` and the instance ends cleanly, without leaving technical incidents behind. It is interrupting: it stops the main flow.
*Why an event sub-process and not individual boundary events:* a single centralized handler catches errors from anywhere in the process, avoiding attaching a boundary event to every task and keeping the diagram readable.

---

## 7. Process variables

| Variable | Origin | Meaning |
|---|---|---|
| `username`, `posterFormat`, `cities`, `maxPrice` | API input | request data |
| `maxPricesJSON` | API input (optional) | per-city price override (JSON map) |
| `strategy` | API input (optional) | zone-selection algorithm |
| `userResponse`, `userStatusCode` | Get User Data | raw response + status |
| `userData` | Validate User | personal data as a Spin object |
| `availableZonesJSON` | Get Zone List | zone catalogue for the format |
| `selectedZonesJSON`, `selectedZonesSpin` | Select Zones | selected zones (string + Spin) |
| `totalPrice`, `usedStrategy`, `skippedCities` | Select Zones | total, strategy used, unserved cities |
| `isAvailable`, `requestId` | Check Availability | availability outcome + identifier |
| `decision` | DecisionMessage | `confirm` / `cancel` |
| `accountHolder`, `invoiceNumber`, `amountDue` | Confirm Request | invoicing data |
| `fileContent` | Save Order input mapping | file text rendered by the template |
| `errorCode`, `errorMessage`, `processError` | validations / handler | error handling |

**Why `userData` and `selectedZonesSpin` are Spin objects:** the FreeMarker templates of the SOAP payloads must iterate over and read structured fields (`userData.prop("name")`, `selectedZonesSpin.elements()`); Spin provides this navigable access to JSON/XML directly inside the engine.

---

## 8. The two REST endpoints and message correlation

The `ProcessController` exposes:

### `POST /api/request`
**Input:** `username`, `posterFormat`, `cities[]`, `maxPrice` (mandatory); `maxPrices` (city→price map) and `strategy` (optional).
**Behaviour:**
1. validates the input (mandatory fields, allowed strategy, positive price overrides);
2. **starts the process by correlating** the `StartRequest` message with the variables, synchronously:
   ```java
   MessageCorrelationResultWithVariables result = runtimeService
       .createMessageCorrelation("StartRequest")
       .setVariables(variables)
       .correlateWithResultAndVariables(true);
   ```
3. if the process ended due to a business error, it translates `errorCode` into the corresponding HTTP status; otherwise it returns `requestId`, `selectedZonesJSON`, `totalPrice`, `usedStrategy`, `skippedCities`.

### `POST /api/decision`
**Input:** `requestId`, `decision` (`confirm`/`cancel`).
**Behaviour:** validates the input and **resumes the process by correlating** the `DecisionMessage` by `requestId`:
```java
runtimeService.createMessageCorrelation("DecisionMessage")
    .processInstanceVariableEquals("requestId", requestId)
    .setVariable("decision", decision)
    .correlateWithResult();
```
On confirmation it retrieves the invoice from the history and returns it; it handles business errors (502) and connectivity faults (503).

**Why two `POST`s and not `GET`s.**
- *State change:* both operations change the system state (they create or advance a process instance). In REST, non-idempotent create/modify operations use `POST`, not `GET`.
- *Complex payload:* the first call sends a JSON structure (lists/maps of cities and prices): it is clean in a `POST` body; in a query string it would be unmanageable.
- *Confidentiality:* the data (username, decision) travels in the body and does not end up in the URL, browser history or proxy logs.

**Why message correlation (and not `startProcessInstanceByKey`).** The assignment explicitly requires the APIs to *"start/resume through messages, correlated"*. Using a *message start event* and a *message catch event* makes the two interactions homogeneous and decouples the caller from the internal process name: the controller "sends a message", the model decides who and how reacts. The second message is correlated on the `requestId`, the business identifier generated by the posting service.

**Why REST and not SOAP for the exposed APIs.** The assignment leaves it open; REST + JSON integrates immediately with a JavaScript frontend, is easier to test (curl/Postman) and is the de-facto standard for application APIs. SOAP is kept only where the posting service mandates it.

---

## 9. Communicating with external services: the connectors

All calls to the outside use **Camunda connectors**, as required.

- **`http-connector`** for the REST services (`Get User Data`, `Get Zone List`): URL built with FreeMarker, `GET` method, output mapped into variables through small extraction scripts.
- **`soap-http-connector`** for the posting service (`Check Availability`, `Confirm`, `Cancel`): fixed URL (`:8888/postingservice`), the `payload` is a SOAP envelope generated from FreeMarker templates, with the `Content-Type: text/xml` header. The output (response envelope) is parsed with Spin in the extraction scripts.

**Why connectors and not a `JavaDelegate` with a hand-written HTTP client:** connectors are declarative in the model, require no Java code to compile, are visible and configurable directly on the task, and make it clear — even to someone reading only the BPMN — *which* external systems the process contacts.

---

## 10. The Script Tasks (JavaScript)

The Script Tasks use **JavaScript** (the built-in Nashorn/Rhino engine) because the logic is lightweight (parsing, validations, small computations) and writing it inline in the project avoids creating and compiling a dedicated Java class for every micro-operation. It also keeps the logic close to the model.

| Script | Role |
|---|---|
| `validateUser.js` | validates the user response, builds `userData` (Spin), raises `USER_NOT_FOUND` |
| `zoneStrategies.js` | **zone selection** with the 4 strategies and the per-city budget |
| `extractAvailability.js`, `extractRequestId.js` | extract `isAvailable` and `requestId` from the SOAP envelope |
| `validateAvailability.js` | validates availability/`requestId`, raises `NOT_AVAILABLE` / `POSTING_SERVICE_ERROR` |
| `extractAccountHolder.js`, `extractInvoiceNumber.js`, `extractAmountDue.js` | extract the invoice fields |
| `validateConfirmation.js` | validates the invoice, raises `POSTING_SERVICE_ERROR` if it is `N/A`/`0.0` |
| `saveOrderFile.js` | writes the content rendered by the `orderFile.ftl` template to a file |
| `logCancellation.js` | logs the cancellation and writes the related file |
| `handleError.js` | records `errorCode`/`errorMessage` in the error sub-process |

**Why the extraction scripts are separate from the connectors:** the connector's output parameters (`outputParameter`) reference these scripts as resources; isolating them makes the XML parsing reusable and readable, and the empty/malformed-response cases are handled with robust defaults ("N/A") instead of blowing up the parser.

---

## 11. The FreeMarker templates

**Templates** are used wherever the output is structured, repetitive text, as the assignment suggests.

| Template | Purpose |
|---|---|
| `availabilityRequest.ftl` | SOAP envelope of the availability request (personal data + zone list) |
| `confirmationRequest.ftl` | SOAP envelope of the confirmation (`requestId`) |
| `cancellationRequest.ftl` | SOAP envelope of the cancellation (`cancelRequest`) |
| `orderFile.ftl` | **confirmed order file**: full personal data, zones, invoicing |

**Why templates.**
- *Separation of concerns:* the *layout* (SOAP XML or file text) lives in the template, the logic stays in the scripts. Changing a document format requires no code changes.
- *Complex connector inputs:* the SOAP envelopes contain nested lists (`<#list selectedZonesSpin.elements() as zone>`): FreeMarker iterates over them declaratively.
- *Generated file:* the order file is produced from `orderFile.ftl` rendered into a `fileContent` variable through an *input mapping* on the save task; the script simply writes that text. This way the file neatly includes **all** the required information (user data, request, zones, invoice number, amount).

**Correctness note:** the cancellation template uses the `cancelRequest` element in the `http://disim.univaq.it/services/postingservice` namespace, consistent with the service's real schema (`schema.xsd`), so the cancellation is actually accepted by the posting service.

---

## 12. The zone-selection strategies

Zone selection is where the process adds value. **Four strategies** are implemented, selectable by the customer via the `strategy` field (default `GREEDY`):

| Strategy | Logic | Customer goal |
|---|---|---|
| `GREEDY` (default) | most expensive zones first, filling the budget | maximum visibility/quality of the spots |
| `MAX_ZONES` | cheapest zones first | maximum number of postings |
| `BALANCED_COVERAGE` | guarantees the cheapest zone (coverage) then adds the most expensive affordable ones | coverage + premium-spot mix |
| `LOWEST_TOTAL` | a single zone, the cheapest one | minimum spend |

**Why multiple strategies.** The assignment explicitly asks to offer several algorithms and let the user choose. Moreover, from a domain standpoint, different customers have different goals (broad presence vs prime spots vs tight budget): exposing the strategy makes the service flexible. The function-based architecture (`selectForCity`, `pickGreedy`) makes adding new strategies trivial in the future.

**Validation:** the controller accepts only known strategies (`GREEDY`, `MAX_ZONES`, `BALANCED_COVERAGE`, `LOWEST_TOTAL`); an unknown strategy produces a `400`.

---

## 13. Per-city maximum price

**Interpretation of the requirement.** The assignment mentions *"maximum price for each of the listed cities"*: `maxPrice` is therefore intended as the **per-city budget** (specifying `maxPrice=20` with two cities means each city has a budget of 20, not 20 in total).

**Implemented extension.** Besides the global `maxPrice` (applied to all cities), the API accepts an optional `maxPrices` field: a **city→price map** that **overrides** the budget of the listed cities only. Cities not present in the map use the global budget.

```json
{ "username": "mariorossi", "posterFormat": "60x80",
  "cities": ["L'Aquila", "Rome"], "maxPrice": 20,
  "maxPrices": { "Rome": 50 } }      // L'Aquila→20, Rome→50
```

**Implementation.** The controller validates each override (> 0) and serializes it into `maxPricesJSON`; the `zoneStrategies.js` script uses `budgetFor(city)`, which returns the override if present, otherwise the global `maxPrice`. The feature is **backward-compatible**: a request with only `maxPrice` behaves exactly as before.

**Why a map and not a positional list.** A city→price map is order-independent, does not suffer from misalignment between the two lists and is more readable on the client side.

---

## 14. Error handling

Robustness is a central requirement: the user must **never** receive a stack trace or a raw `500`. The strategy distinguishes two categories.

### 14.1 Business errors (modeled)
The validation tasks raise a `BpmnError`, setting `errorCode`/`errorMessage`. The **event sub-process** catches them, records the error and ends the instance cleanly. The controller reads `errorCode` and translates it into a **semantic HTTP status**:

| `errorCode` | HTTP | Meaning |
|---|---|---|
| `USER_NOT_FOUND` | 404 | non-existent user |
| `NO_AFFORDABLE_ZONES` | 422 | no zone within budget |
| `NOT_AVAILABLE` | 409 | zones not available |
| `NO_ZONES_AVAILABLE` | 502 | empty zone catalogue |
| `POSTING_SERVICE_ERROR` | 502 | unusable posting-service response/invalid invoice |
| (invalid input) | 400 | API validation |

### 14.2 Technical faults (not modeled)
If an external service is **unreachable**, the connector throws a connection exception. The controller recognizes it (`isConnectivityFault`) and answers **503 Service Unavailable** instead of the generic `500`, on both `/request` and `/decision`.

### 14.3 Robustness of the confirm/cancel branch
Robustness is guaranteed even after the wait: a confirmation with an invalid invoice produces a `502` (via `validateConfirmation.js`), and a posting service that is down during confirm/cancel produces a `503`. This way a "fake" invoice is never saved or returned.

**Why this two-level architecture.** Separating *domain* errors (expected, modeled in the process) from *technical* errors (unexpected, infrastructural) lets us give the client meaningful responses: a `404` for a non-existent user is useful information; a `503` for a service that is down invites a retry; neither is an opaque `500`.

---

## 15. File persistence

The assignment requires writing the order information to a file. Between the two options (a single append file or **one file per request**), the latter was chosen:

- confirmed orders → `data/orders/confirmed/order_<requestId>.txt` (generated from the `orderFile.ftl` template);
- cancellations → `data/orders/cancelled/order_<requestId>_CANCELLED.txt`.

**Why one file per request.** Each order is a self-contained, traceable artifact, easily found by its `requestId`, with no concurrency issues writing to a shared file and no need to parse a file that grows indefinitely. The dashboard leverages exactly this structure to list and display individual orders.

---

## 16. The frontend dashboard

As an extension (not required by the assignment) a **web dashboard** was built in Node.js, which also acts as a proxy to the backend:

- **Request simulator:** a form with username, format, cities, price, strategy and — through a **checkbox** — **per-city** price inputs generated dynamically based on the entered cities (with values preserved when the cities change). *Presets* are provided to demonstrate both the happy path and every error scenario.
- **Decision:** a section to confirm/cancel using the `requestId`, unlocked only after a valid request.
- **Service health, list of generated orders, log viewer** in real time.
- **Bilingual UI (Italian/English)** with a language switch in the top bar; the choice is applied live and persisted in `localStorage`.

**Why a frontend.** It makes the whole flow immediately demonstrable during the exam, shows the outcomes in a "friendly" way (zones, total, skipped cities, invoice) and covers the assignment's point about extending the system with useful features.

---

## 17. Summary of design choices

| Decision | Discarded alternative | Rationale |
|---|---|---|
| **REST** APIs | SOAP | simple integration with the frontend, easy testing, application standard |
| **Two POSTs** | GET | state-changing operations, complex payload, confidentiality |
| **Start via message** | `startProcessInstanceByKey` | assignment requirement; homogeneity and decoupling of the two interactions |
| **Service Task + connectors** | `JavaDelegate` with HTTP client | declarativeness in the model, no code to compile, clarity |
| **Script Tasks in JavaScript** | Java `JavaDelegate` | lightweight logic, closeness to the model, fast iteration |
| **FreeMarker templates** | concatenated strings | separation of layout/logic, handling complex XML and the order file |
| **Spin** for JSON/XML | manual parsing | navigable access to data inside scripts and templates |
| **Event sub-process** for errors | boundary events on each task | centralized handler, cleaner diagram |
| **errorCode → HTTP** + **503** on faults | generic `500` | semantic responses, the robustness required by page 12 |
| **One file per request** | single append file | traceability, no concurrency/parsing of growing files |
| **4 strategies** selectable | a single one | flexibility for different business goals |
| **Per-city price** (optional map) | single global price | faithfulness to "for each city", backward-compatible |
| **In-memory H2** | external DB | simplicity for the demo, no dependency |

---

## 18. How to build and run

> The project requires **Java 8** (e.g. `C:\Program Files\Java\jdk1.8.0_202`).

**Full startup (services + Camunda + dashboard)** with the PowerShell script:
```powershell
.\start.ps1 -JavaHome "C:\Program Files\Java\jdk1.8.0_202"
```
The script starts the three services, builds and runs the engine, starts the dashboard and shows the health.

**Engine-only startup (development):**
```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk1.8.0_202'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
mvn spring-boot:run
```
- Camunda webapp: <http://localhost:8080/camunda> (login `demo`/`demo`)
- Dashboard: <http://127.0.0.1:5174>

**Shutdown:** `.\stop.ps1`.

---

## 19. Example calls and outcomes

**Valid request:**
```bash
curl -X POST http://localhost:8080/api/request -H "Content-Type: application/json" \
  -d '{ "username":"mariorossi", "posterFormat":"60x80", "cities":["L'\''Aquila","Rome"], "maxPrice":20.0 }'
```
→ `200 OK` with `requestId`, selected zones, `totalPrice`, `usedStrategy`, `skippedCities`.

**Request with per-city price:**
```bash
curl -X POST http://localhost:8080/api/request -H "Content-Type: application/json" \
  -d '{ "username":"mariorossi", "posterFormat":"60x80", "cities":["L'\''Aquila","Rome"], "maxPrice":20.0, "maxPrices":{"Rome":50.0} }'
```

**Decision (confirm):**
```bash
curl -X POST http://localhost:8080/api/decision -H "Content-Type: application/json" \
  -d '{ "requestId":"<REQUEST_ID>", "decision":"confirm" }'
```
→ `200 OK` with `accountHolder`, `invoiceNumber`, `amountDue`; generates the order file.

**Main error scenarios:**

| Scenario | Outcome |
|---|---|
| Non-existent username | `404 USER_NOT_FOUND` |
| Budget too low / unserved city | `422 NO_AFFORDABLE_ZONES` |
| Zones not available | `409 NOT_AVAILABLE` |
| Missing `posterFormat`/fields, invalid strategy or price | `400` |
| External service down | `503` |
| Invalid confirmation invoice | `502 POSTING_SERVICE_ERROR` |

Valid users: `mariorossi`, `sarabianchi`, `johndoe`. Served cities: `L'Aquila`, `Rome`, `Milan`.

---

## 20. Possible future extensions

- **Database persistence** of orders (besides the files) for search and reporting.
- **Authentication** on the APIs (token) and roles for the decision.
- **Wait timeout**: a *timer boundary event* on the message catch that automatically cancels requests not confirmed within N days.
- **Per-city price from the frontend with dedicated presets** and client-side validation.
- **Customer notification** (email) on confirmation, leveraging the already-available personal data.

---

*Project summary document. For the technical detail of the changes and the gap analysis, see also `docs/Documentazione_Progetto.md` (in Italian). An Italian version of this report is available in `Readme_ita.md`.*
