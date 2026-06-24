# Public Billposting Process — Relazione di progetto

**Corso:** Business Process Development (BPD) — DISIM, Università degli Studi dell'Aquila
**Scenario:** *Public Billposting Service* — gestione delle richieste di affissione pubblica di manifesti
**Tecnologie:** Spring Boot 2.7.9 · Camunda Platform 7.19 (embedded) · connettori REST/SOAP · FreeMarker · H2
**Autore:** Giovanni Altieri

> Questo documento è la relazione completa del progetto: descrive *cosa* fa il sistema, *come* è realizzato e *perché* sono state prese le singole scelte progettuali. È pensato per essere letto e discusso in sede d'esame.

---

## Indice

1. [Introduzione e scenario](#1-introduzione-e-scenario)
2. [Requisiti della consegna e loro copertura](#2-requisiti-della-consegna-e-loro-copertura)
3. [Architettura del sistema](#3-architettura-del-sistema)
4. [Stack tecnologico e scelte di base](#4-stack-tecnologico-e-scelte-di-base)
5. [Struttura del repository](#5-struttura-del-repository)
6. [Il processo BPMN passo-passo](#6-il-processo-bpmn-passo-passo)
7. [Le variabili di processo](#7-le-variabili-di-processo)
8. [I due endpoint REST e la correlazione dei messaggi](#8-i-due-endpoint-rest-e-la-correlazione-dei-messaggi)
9. [Comunicazione con i servizi esterni: i connettori](#9-comunicazione-con-i-servizi-esterni-i-connettori)
10. [Gli Script Task (JavaScript)](#10-gli-script-task-javascript)
11. [I template FreeMarker](#11-i-template-freemarker)
12. [Le strategie di selezione delle zone](#12-le-strategie-di-selezione-delle-zone)
13. [Il prezzo massimo per città](#13-il-prezzo-massimo-per-città)
14. [La gestione degli errori](#14-la-gestione-degli-errori)
15. [La persistenza su file](#15-la-persistenza-su-file)
16. [Il frontend dashboard](#16-il-frontend-dashboard)
17. [Riepilogo delle scelte implementative](#17-riepilogo-delle-scelte-implementative)
18. [Come compilare ed eseguire](#18-come-compilare-ed-eseguire)
19. [Esempi di chiamate ed esiti](#19-esempi-di-chiamate-ed-esiti)
20. [Possibili estensioni future](#20-possibili-estensioni-future)

---

## 1. Introduzione e scenario

Il progetto modella e automatizza il processo di **affissione pubblica di manifesti** in una o più città, esponendolo come servizio. Un cliente:

1. invia una richiesta indicando il proprio username, il formato del manifesto, l'elenco delle città e il prezzo massimo che è disposto a spendere per ciascuna città;
2. il sistema recupera i dati anagrafici del cliente e l'elenco delle zone affiggibili (con i relativi prezzi) da due servizi esterni;
3. per ogni città il processo **seleziona automaticamente le zone** rispettando il budget, secondo una strategia scelta;
4. interroga un servizio di *posting* per verificare la disponibilità effettiva delle zone selezionate, ottenendo un **identificativo di richiesta** (`requestId`);
5. restituisce al cliente le zone selezionate, il totale e il `requestId`;
6. il cliente, in un secondo momento, **conferma** o **annulla** la richiesta usando il `requestId`:
   - in caso di **conferma**, il servizio di posting emette una **fattura** (intestatario, numero fattura, importo), che viene salvata su file e restituita al cliente;
   - in caso di **annullamento**, la richiesta viene revocata e viene restituita una fattura vuota.

Il cuore del sistema è un **processo BPMN eseguibile** orchestrato dal motore Camunda, embeddato in un'applicazione Spring Boot.

---

## 2. Requisiti della consegna e loro copertura

La traccia richiede, in sintesi:

| Requisito della traccia | Come è stato soddisfatto |
|---|---|
| Modellare il processo in **BPMN** | `PublicBillposting.bpmn` |
| Eseguirlo con **Camunda embedded** in Spring Boot | applicazione `it.univaq.disim.bpd` |
| Esporre **due API** (REST o SOAP) | due endpoint REST: `POST /api/request` e `POST /api/decision` |
| Le API **avviano/riprendono** il processo **tramite messaggi correlati** | *message start event* (`StartRequest`) + *message catch event* (`DecisionMessage`) |
| Comunicare con i servizi esterni tramite **connettori** | `http-connector` (REST) e `soap-http-connector` (SOAP) |
| **Task aggiuntivi** per la computazione extra | Script Task di selezione zone, validazioni, logging |
| **Robustezza / gestione errori** (niente 500 grezzi, status HTTP semantici) | validazioni + *error event sub-process* + mappatura `errorCode → HTTP` |
| **Più strategie** di selezione zone, scelte dall'utente | 4 strategie selezionabili via campo `strategy` |
| Uso di **template** per input complessi e per il file generato | 3 template SOAP + 1 template per il file ordine (FreeMarker) |
| **Estendere** il sistema con funzionalità utili | dashboard web, prezzo per città, più strategie |

> La parte di *robustezza, template e strategie multiple* (pag. 12 della traccia) è obbligatoria in assenza del midterm: è stata implementata integralmente.

---

## 3. Architettura del sistema

Il sistema è composto da un'applicazione centrale (motore di processo + API), tre servizi esterni simulati e una dashboard di supporto.

```
                         ┌───────────────────────────────────────────────┐
  Dashboard web          │   Spring Boot + Camunda Engine (porta 8080)    │
  (Node, porta 5174)     │                                               │
        │  HTTP           │   ProcessController (REST)                    │
        └────────────────▶│     POST /api/request   → start message      │
                          │     POST /api/decision  → decision message   │
                          │                ▼                             │
                          │   Processo BPMN  "PublicBillposting"          │
                          │   ┌────────────────────────────────────────┐ │
                          │   │ GetUser → ValidateUser → GetZones →     │ │
                          │   │ SelectZones → CheckAvail → ValidateAvail│ │
                          │   │  → (attesa decisione) → confirm/cancel  │ │
                          │   └────────────────────────────────────────┘ │
                          └──────┬───────────────┬───────────────┬────────┘
              http-connector     │               │               │ soap-http-connector
                                 ▼               ▼               ▼
                         user-service      zones-service    posting-service
                         REST  :9080        REST  :9090       SOAP  :8888
                         /user/<username>   /zones/<format>   /postingservice
```

| Componente | Tipo | Porta | Ruolo |
|---|---|---|---|
| Applicazione principale | Spring Boot + Camunda | 8080 | Espone le 2 API ed esegue il processo |
| `user-service.jar` | REST | 9080 | `GET /user/<username>` → dati anagrafici |
| `zones-service.jar` | REST | 9090 | `GET /zones/<format>` → zone disponibili e prezzi |
| `posting-service.jar` | SOAP | 8888 | disponibilità / conferma / annullamento + fattura |
| Dashboard | Node.js (extra) | 5174 | UI per provare le API, health, ordini, log |

**Perché questa separazione.** I tre servizi rappresentano sistemi terzi (anagrafe clienti, catalogo zone, sistema di affissione/fatturazione) che nella realtà sarebbero gestiti da enti diversi. Tenerli come processi separati, richiamati solo via connettori, rende il processo BPMN **agnostico** rispetto alla loro implementazione e rispetta il principio di basso accoppiamento.

---

## 4. Stack tecnologico e scelte di base

| Tecnologia | Versione | Motivazione |
|---|---|---|
| **Java** | 8 | È la versione di destinazione richiesta dal toolchain del corso; `maven.compiler.source/target = 8`. |
| **Spring Boot** | 2.7.9 | Avvio rapido, embedded Tomcat, integrazione nativa con Camunda. |
| **Camunda Platform** | 7.19 | Motore BPMN 2.0 standard, embeddabile, con webapp Cockpit/Tasklist per ispezione. |
| **Plugin Spin + Connect** | da BOM | `Spin` per il parsing JSON/XML dentro gli script; `Connect` per i connettori HTTP/SOAP. |
| **Template Engine FreeMarker** | da BOM | Generazione di payload XML e file di testo separando il *layout* dalla logica. |
| **H2** | in-memory | Database di processo (runtime + history) senza dipendenze esterne, ideale per una demo. |

**Scelte di configurazione** (`application.properties`):
- database H2 in-memory con `DB_CLOSE_DELAY=-1` per mantenere lo stato finché l'applicazione è viva;
- utente amministratore Camunda `demo/demo` per accedere alla webapp;
- `historyTimeToLive=1` sul processo: la history viene mantenuta abbastanza per leggere le variabili a istanza conclusa (es. la fattura) ma è soggetta a pulizia, evitando crescita illimitata del DB.

**Perché Camunda embedded e non standalone.** Embeddando il motore nell'applicazione Spring Boot si ottiene un unico artefatto deployabile, le API REST e il processo condividono lo stesso `RuntimeService`/`HistoryService` in-process (nessuna latenza di rete tra controller e motore) e la gestione transazionale è unificata.

---

## 5. Struttura del repository

```
BPD_final_project/
├── pom.xml                         # build Maven, dipendenze Camunda/Spring
├── start.ps1 / stop.ps1            # avvio/arresto dell'intero stack (Windows)
├── start_all.sh / stop_all.sh      # equivalenti per ambienti Unix
├── services/                       # i tre servizi esterni simulati (jar)
│   ├── user-service.jar
│   ├── zones-service.jar
│   └── posting-service.jar
├── src/main/java/it/univaq/disim/bpd/
│   ├── Application.java             # main Spring Boot
│   └── ProcessController.java       # i due endpoint REST
├── src/main/resources/
│   ├── application.properties       # configurazione Spring/Camunda/H2
│   ├── processes/
│   │   └── PublicBillposting.bpmn    # il modello di processo
│   ├── scripts/                     # Script Task (JavaScript)
│   │   ├── validateUser.js
│   │   ├── zoneStrategies.js
│   │   ├── validateAvailability.js
│   │   ├── validateConfirmation.js
│   │   ├── extractAvailability.js / extractRequestId.js
│   │   ├── extractAccountHolder.js / extractInvoiceNumber.js / extractAmountDue.js
│   │   ├── saveOrderFile.js / logCancellation.js
│   │   └── handleError.js
│   └── templates/                   # template FreeMarker (.ftl)
│       ├── availabilityRequest.ftl
│       ├── confirmationRequest.ftl
│       ├── cancellationRequest.ftl
│       └── orderFile.ftl
├── frontend/                        # dashboard web (extra)
│   ├── server.js                    # server Node + proxy verso il backend
│   └── public/ (index.html, app.js, styles.css)
├── data/orders/                     # file generati (confirmed / cancelled)
└── docs/Documentazione_Progetto.md  # gap analysis e changelog tecnico
```

**Perché gli script e i template sono file esterni** (e non incorporati nell'XML del BPMN): mantenere il modello leggibile, versionare separatamente la logica, e poterla testare/modificare senza toccare il diagramma. Nel BPMN sono referenziati con `camunda:resource="classpath:scripts/..."`.

---

## 6. Il processo BPMN passo-passo

Il processo `PublicBillposting` è composto da un flusso principale lineare, due rami decisionali (conferma/annulla) e un sotto-processo di gestione errori.

**Legenda:** `( )` evento · `[ ]` Service Task (connettore) · `< >` Script Task · `○` evento messaggio · `◇` gateway

```
(Start: messaggio StartRequest)
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

### 6.1 Avvio — *Message Start Event* `StartRequest`
Il processo **non** viene avviato "per chiave", ma tramite la **correlazione di un messaggio** `StartRequest`, inviato dall'endpoint `POST /api/request`. In questo modo **entrambe** le interazioni con il processo (avvio e ripresa) avvengono via messaggio, come richiede la traccia.

### 6.2 `Get User Data` — Service Task (http-connector)
Esegue `GET http://localhost:9080/user/${username}`. Mappa il corpo della risposta nella variabile `userResponse` e lo status HTTP in `userStatusCode`.
*Perché Service Task con connettore:* è una chiamata sincrona request/response a un servizio REST; il connettore HTTP è il costrutto Camunda pensato esattamente per questo.

### 6.3 `Validate User` — Script Task
Verifica che lo status sia 200 e il corpo non vuoto. Se l'utente non esiste (404/corpo vuoto) solleva un `BpmnError` `USER_NOT_FOUND`; altrimenti converte il JSON in un oggetto **Spin** (`userData`) riutilizzabile dai template.
*Perché qui:* il connettore non sa distinguere un "utente inesistente" da un errore tecnico; la validazione semantica è logica di business e va isolata in un task dedicato.

### 6.4 `Get Zone List` — Service Task (http-connector)
Esegue `GET http://localhost:9090/zones/${posterFormat}` e salva l'elenco zone in `availableZonesJSON`.

### 6.5 `Select Zones (strategy)` — Script Task
È il **task di computazione extra** richiesto dalla traccia. Per ogni città seleziona le zone entro il budget secondo la strategia scelta (default *greedy*, le più costose prima). Produce `selectedZonesJSON`, `selectedZonesSpin`, `totalPrice`, `usedStrategy` e `skippedCities`. Se nessuna zona è selezionabile solleva `NO_AFFORDABLE_ZONES`; se il catalogo è vuoto solleva `NO_ZONES_AVAILABLE`.

### 6.6 `Check Availability (SOAP)` — Service Task (soap-http-connector)
Invia al posting service una `availabilityRequest` SOAP costruita con un template FreeMarker (dati cliente + zone). Estrae `isAvailable` e `requestId` dalla risposta.

### 6.7 `Validate Availability` — Script Task
Se il `requestId` manca o le zone non sono disponibili, solleva rispettivamente `POSTING_SERVICE_ERROR` o `NOT_AVAILABLE`. Così il processo non prosegue verso l'attesa con un identificativo inutilizzabile.

### 6.8 `Wait for user decision` — *Intermediate Message Catch Event*
Il processo si **sospende** e attende il messaggio `DecisionMessage`, correlato per `requestId`. È lo stato in cui l'istanza rimane tra la prima e la seconda chiamata API.
*Perché un message catch event:* la decisione del cliente è asincrona (può arrivare anche molto dopo); il pattern "attendi un messaggio correlato" è la traduzione BPMN naturale di questa attesa.

### 6.9 `Decision?` — Exclusive Gateway
Instrada verso il ramo *confirm* o *cancel* in base alla variabile `decision` impostata dal messaggio.

### 6.10 Ramo *confirm*
- `Confirm Request (SOAP)`: invia `confirmationRequest` e ottiene la fattura (`accountHolder`, `invoiceNumber`, `amountDue`).
- `Validate Confirmation` (Script): verifica che la fattura sia valida; in caso contrario solleva `POSTING_SERVICE_ERROR`.
- `Save Order Details` (Script + template): genera il file dell'ordine dal template `orderFile.ftl` e lo scrive su disco.
- Fine: `Order Confirmed`.

### 6.11 Ramo *cancel*
- `Cancel Request (SOAP)`: invia `cancelRequest` per revocare la prenotazione.
- `Log Cancellation` (Script): stampa l'avviso a video e scrive un file di annullamento.
- Fine: `Order Cancelled`.

### 6.12 `Error Handling` — *Event Sub-Process* (interrupting)
Cattura **qualsiasi** `BpmnError` di business sollevato dai task di validazione. Lo script `Record Error` registra `errorCode`/`errorMessage` e l'istanza termina in modo pulito, senza lasciare incidenti tecnici. È interrupting: ferma il flusso principale.
*Perché un event sub-process e non singoli boundary event:* un solo gestore centralizzato cattura gli errori da qualunque punto del processo, evitando di "appendere" un boundary event a ogni task e mantenendo il diagramma leggibile.

---

## 7. Le variabili di processo

| Variabile | Origine | Significato |
|---|---|---|
| `username`, `posterFormat`, `cities`, `maxPrice` | input API | dati della richiesta |
| `maxPricesJSON` | input API (opzionale) | override prezzo per città (mappa JSON) |
| `strategy` | input API (opzionale) | algoritmo di selezione zone |
| `userResponse`, `userStatusCode` | Get User Data | risposta grezza + status |
| `userData` | Validate User | anagrafica come oggetto Spin |
| `availableZonesJSON` | Get Zone List | catalogo zone per il formato |
| `selectedZonesJSON`, `selectedZonesSpin` | Select Zones | zone scelte (stringa + Spin) |
| `totalPrice`, `usedStrategy`, `skippedCities` | Select Zones | totale, strategia usata, città non servite |
| `isAvailable`, `requestId` | Check Availability | esito disponibilità + identificativo |
| `decision` | DecisionMessage | `confirm` / `cancel` |
| `accountHolder`, `invoiceNumber`, `amountDue` | Confirm Request | dati di fatturazione |
| `fileContent` | input mapping di Save Order | testo del file reso dal template |
| `errorCode`, `errorMessage`, `processError` | validazioni / handler | gestione errori |

**Perché `userData` e `selectedZonesSpin` come oggetti Spin:** i template FreeMarker dei payload SOAP devono iterare e leggere campi strutturati (`userData.prop("name")`, `selectedZonesSpin.elements()`); Spin offre questo accesso navigabile a JSON/XML direttamente dentro il motore.

---

## 8. I due endpoint REST e la correlazione dei messaggi

Il `ProcessController` espone:

### `POST /api/request`
**Input:** `username`, `posterFormat`, `cities[]`, `maxPrice` (obbligatori); `maxPrices` (mappa città→prezzo) e `strategy` (opzionali).
**Comportamento:**
1. valida l'input (campi obbligatori, strategia ammessa, override di prezzo positivi);
2. **avvia il processo correlando il messaggio** `StartRequest` con le variabili, in modo sincrono:
   ```java
   MessageCorrelationResultWithVariables result = runtimeService
       .createMessageCorrelation("StartRequest")
       .setVariables(variables)
       .correlateWithResultAndVariables(true);
   ```
3. se il processo è terminato per errore di business, traduce `errorCode` nello status HTTP corrispondente; altrimenti restituisce `requestId`, `selectedZonesJSON`, `totalPrice`, `usedStrategy`, `skippedCities`.

### `POST /api/decision`
**Input:** `requestId`, `decision` (`confirm`/`cancel`).
**Comportamento:** valida l'input e **riprende il processo correlando il messaggio** `DecisionMessage` per `requestId`:
```java
runtimeService.createMessageCorrelation("DecisionMessage")
    .processInstanceVariableEquals("requestId", requestId)
    .setVariable("decision", decision)
    .correlateWithResult();
```
In caso di conferma, recupera la fattura dalla history e la restituisce; gestisce gli errori di business (502) e i guasti di connettività (503).

**Perché due `POST` e non `GET`.**
- *Cambiamento di stato:* entrambe le operazioni modificano lo stato del sistema (creano o fanno avanzare un'istanza di processo). Per REST, le operazioni non idempotenti di creazione/modifica usano `POST`, non `GET`.
- *Payload complesso:* la prima chiamata invia una struttura JSON (liste/mappe di città e prezzi): nel body di una `POST` è pulito; in una query string sarebbe ingestibile.
- *Riservatezza:* i dati (username, decisione) viaggiano nel body e non finiscono nell'URL, nella cronologia o nei log dei proxy.

**Perché la correlazione per messaggi (e non `startProcessInstanceByKey`).** La traccia richiede esplicitamente che le API *"start/resume through messages, correlated"*. Usare un *message start event* e un *message catch event* rende le due interazioni omogenee e disaccoppia il chiamante dal nome interno del processo: il controller "spedisce un messaggio", il modello decide chi e come reagisce. La correlazione del secondo messaggio avviene sul `requestId`, identificativo di business generato dal posting service.

**Perché REST e non SOAP per le API esposte.** La traccia lascia libertà; REST + JSON si integra in modo immediato con un frontend JavaScript, è più leggero da testare (curl/Postman) ed è lo standard de-facto per le API applicative. SOAP resta invece dov'è imposto dal servizio di posting.

---

## 9. Comunicazione con i servizi esterni: i connettori

Tutte le chiamate verso l'esterno usano **connettori Camunda**, come richiesto.

- **`http-connector`** per i servizi REST (`Get User Data`, `Get Zone List`): URL costruito con FreeMarker, metodo `GET`, output mappato in variabili tramite piccoli script di estrazione.
- **`soap-http-connector`** per il posting service (`Check Availability`, `Confirm`, `Cancel`): l'URL è fisso (`:8888/postingservice`), il `payload` è un envelope SOAP generato da template FreeMarker, l'header `Content-Type: text/xml`. L'output (envelope di risposta) è parsato con Spin negli script di estrazione.

**Perché connettori e non un `JavaDelegate` con un client HTTP scritto a mano:** i connettori sono dichiarativi nel modello, non richiedono codice Java da compilare, sono visibili e configurabili direttamente sul task e rendono evidente — anche a chi legge solo il BPMN — *quali* sistemi esterni il processo contatta.

---

## 10. Gli Script Task (JavaScript)

Gli Script Task usano **JavaScript** (motore Nashorn/Rhino integrato) perché la logica è leggera (parsing, validazioni, piccoli calcoli) e scriverla inline nel progetto evita di creare e compilare classi Java dedicate per ogni micro-operazione. Mantiene inoltre la logica vicino al modello.

| Script | Ruolo |
|---|---|
| `validateUser.js` | valida la risposta utente, costruisce `userData` (Spin), solleva `USER_NOT_FOUND` |
| `zoneStrategies.js` | **selezione zone** con le 4 strategie e il budget per città |
| `extractAvailability.js`, `extractRequestId.js` | estraggono `isAvailable` e `requestId` dall'envelope SOAP |
| `validateAvailability.js` | valida disponibilità/`requestId`, solleva `NOT_AVAILABLE` / `POSTING_SERVICE_ERROR` |
| `extractAccountHolder.js`, `extractInvoiceNumber.js`, `extractAmountDue.js` | estraggono i campi della fattura |
| `validateConfirmation.js` | valida la fattura, solleva `POSTING_SERVICE_ERROR` se è `N/A`/`0.0` |
| `saveOrderFile.js` | scrive su file il contenuto reso dal template `orderFile.ftl` |
| `logCancellation.js` | logga l'annullamento e scrive il relativo file |
| `handleError.js` | registra `errorCode`/`errorMessage` nel sotto-processo errori |

**Perché gli script di estrazione sono separati dai connettori:** i parametri di output del connettore (`outputParameter`) referenziano questi script come risorse; isolarli rende il parsing dell'XML riutilizzabile e leggibile, e i casi di risposta vuota/malformata sono gestiti con dei default robusti ("N/A") invece di far esplodere il parser.

---

## 11. I template FreeMarker

Sono usati **template** ovunque l'output sia un testo strutturato e ripetitivo, come suggerisce la traccia.

| Template | Scopo |
|---|---|
| `availabilityRequest.ftl` | envelope SOAP della richiesta di disponibilità (anagrafica + lista zone) |
| `confirmationRequest.ftl` | envelope SOAP della conferma (`requestId`) |
| `cancellationRequest.ftl` | envelope SOAP dell'annullamento (`cancelRequest`) |
| `orderFile.ftl` | **file dell'ordine confermato**: anagrafica completa, zone, fatturazione |

**Perché i template.**
- *Separazione delle responsabilità:* il *layout* (XML SOAP o testo del file) sta nel template, la logica resta negli script. Cambiare il formato di un documento non richiede toccare codice.
- *Input complessi del connettore:* gli envelope SOAP contengono liste annidate (`<#list selectedZonesSpin.elements() as zone>`): FreeMarker le itera in modo dichiarativo.
- *File generato:* il file dell'ordine è prodotto da `orderFile.ftl` reso in una variabile `fileContent` tramite un *input mapping* del task di salvataggio; lo script si limita a scrivere quel testo. Così il file include in modo ordinato **tutte** le informazioni richieste (dati utente, richiesta, zone, numero fattura, importo).

**Nota di correttezza:** il template di annullamento usa l'elemento `cancelRequest` nel namespace `http://disim.univaq.it/services/postingservice`, coerente con lo schema reale del servizio (`schema.xsd`), così l'annullamento è effettivamente accettato dal posting service.

---

## 12. Le strategie di selezione delle zone

La selezione delle zone è il punto in cui il processo aggiunge valore. Sono state implementate **quattro strategie**, scegliibili dal cliente tramite il campo `strategy` (default `GREEDY`):

| Strategia | Logica | Obiettivo del cliente |
|---|---|---|
| `GREEDY` (default) | zone più costose prima, riempiendo il budget | massima visibilità/qualità degli spazi |
| `MAX_ZONES` | zone più economiche prima | massimo numero di affissioni |
| `BALANCED_COVERAGE` | garantisce la zona più economica (copertura) poi aggiunge le più costose possibili | mix copertura + spazi premium |
| `LOWEST_TOTAL` | una sola zona, la più economica | spesa minima |

**Perché più strategie.** La traccia chiede esplicitamente di offrire più algoritmi e far scegliere all'utente. Inoltre, dal punto di vista del dominio, clienti diversi hanno obiettivi diversi (presenza capillare vs spazi di pregio vs budget contenuto): esporre la strategia rende il servizio flessibile. L'architettura a funzioni (`selectForCity`, `pickGreedy`) rende banale aggiungere nuove strategie in futuro.

**Validazione:** il controller accetta solo strategie note (`GREEDY`, `MAX_ZONES`, `BALANCED_COVERAGE`, `LOWEST_TOTAL`); una strategia sconosciuta produce un `400`.

---

## 13. Il prezzo massimo per città

**Interpretazione del requisito.** La traccia parla di *"maximum price for each of the listed cities"*: il `maxPrice` è quindi inteso come **budget per singola città** (indicando `maxPrice=20` con due città, ogni città ha 20 di budget, non 20 in totale).

**Estensione implementata.** Oltre al `maxPrice` globale (applicato a tutte le città), l'API accetta un campo opzionale `maxPrices`: una **mappa città→prezzo** che **sovrascrive** il budget delle sole città indicate. Le città non presenti nella mappa usano il budget globale.

```json
{ "username": "mariorossi", "posterFormat": "60x80",
  "cities": ["L'Aquila", "Rome"], "maxPrice": 20,
  "maxPrices": { "Rome": 50 } }      // L'Aquila→20, Rome→50
```

**Implementazione.** Il controller valida ogni override (> 0) e lo serializza in `maxPricesJSON`; lo script `zoneStrategies.js` usa `budgetFor(city)` che restituisce l'override se presente, altrimenti il `maxPrice` globale. La feature è **retro-compatibile**: una richiesta con il solo `maxPrice` si comporta esattamente come prima.

**Perché una mappa e non una lista posizionale.** Una mappa città→prezzo è indipendente dall'ordine, non soffre di disallineamenti tra le due liste ed è più leggibile lato client.

---

## 14. La gestione degli errori

La robustezza è un requisito centrale: l'utente non deve **mai** ricevere uno stack trace o un `500` grezzo. La strategia distingue due categorie.

### 14.1 Errori di business (modellati)
I task di validazione sollevano un `BpmnError` impostando `errorCode`/`errorMessage`. L'**event sub-process** li cattura, registra l'errore e termina l'istanza in modo pulito. Il controller legge `errorCode` e lo traduce in uno **status HTTP semantico**:

| `errorCode` | HTTP | Significato |
|---|---|---|
| `USER_NOT_FOUND` | 404 | utente inesistente |
| `NO_AFFORDABLE_ZONES` | 422 | nessuna zona entro il budget |
| `NOT_AVAILABLE` | 409 | zone non disponibili |
| `NO_ZONES_AVAILABLE` | 502 | catalogo zone vuoto |
| `POSTING_SERVICE_ERROR` | 502 | risposta del posting service inutilizzabile/fattura invalida |
| (input non valido) | 400 | validazione dell'API |

### 14.2 Guasti tecnici (non modellati)
Se un servizio esterno è **irraggiungibile**, il connettore lancia un'eccezione di connessione. Il controller la riconosce (`isConnectivityFault`) e risponde **503 Service Unavailable** invece del `500` generico, sia su `/request` sia su `/decision`.

### 14.3 Robustezza del ramo confirm/cancel
Anche dopo l'attesa la robustezza è garantita: una conferma con fattura non valida produce un `502` (via `validateConfirmation.js`), e un posting service spento durante confirm/cancel produce un `503`. Così non viene mai salvata né restituita una fattura "finta".

**Perché questa architettura a due livelli.** Separare gli errori *di dominio* (previsti, modellati nel processo) dagli errori *tecnici* (imprevisti, di infrastruttura) permette di dare al client risposte significative: un `404` per un utente inesistente è informazione utile; un `503` per un servizio giù invita a riprovare; nessuno dei due è un `500` opaco.

---

## 15. La persistenza su file

La traccia chiede di scrivere su file le informazioni dell'ordine. Tra le due opzioni (un unico file in append oppure **un file per richiesta**) è stata scelta la seconda:

- ordini confermati → `data/orders/confirmed/order_<requestId>.txt` (generato dal template `orderFile.ftl`);
- annullamenti → `data/orders/cancelled/order_<requestId>_CANCELLED.txt`.

**Perché un file per richiesta.** Ogni ordine è un artefatto autonomo e tracciabile, facilmente individuabile dal `requestId`, senza problemi di concorrenza in scrittura su un file condiviso e senza dover effettuare il parsing di un file che cresce indefinitamente. La dashboard sfrutta proprio questa struttura per elencare e mostrare i singoli ordini.

---

## 16. Il frontend dashboard

Come estensione (non richiesta dalla traccia) è stata realizzata una **dashboard web** in Node.js che funge anche da proxy verso il backend:

- **Simulatore di richiesta:** form con username, formato, città, prezzo, strategia e — tramite un **checkbox** — input di prezzo **per singola città** generati dinamicamente in base alle città inserite (con i valori preservati al cambio delle città). Sono presenti dei *preset* per dimostrare sia il caso felice sia ogni scenario di errore.
- **Decisione:** sezione per confermare/annullare usando il `requestId`, sbloccata solo dopo una richiesta valida.
- **Health dei servizi, elenco ordini generati, viewer dei log** in tempo reale.
- **Interfaccia bilingue (italiano/inglese)** con uno switch di lingua nella barra superiore; la scelta è applicata in tempo reale e salvata in `localStorage`.

**Perché un frontend.** Rende immediatamente dimostrabile l'intero flusso in sede d'esame, mostra in modo "amichevole" gli esiti (zone, totale, città saltate, fattura) e copre il punto della traccia sull'estensione del sistema con funzionalità utili.

---

## 17. Riepilogo delle scelte implementative

| Decisione | Alternativa scartata | Motivazione |
|---|---|---|
| API **REST** | SOAP | integrazione semplice con il frontend, test agevole, standard applicativo |
| **Due POST** | GET | operazioni con cambiamento di stato, payload complesso, riservatezza |
| **Avvio via messaggio** | `startProcessInstanceByKey` | requisito della traccia; omogeneità e disaccoppiamento delle due interazioni |
| **Service Task + connettori** | `JavaDelegate` con client HTTP | dichiaratività nel modello, nessun codice da compilare, chiarezza |
| **Script Task in JavaScript** | `JavaDelegate` Java | logica leggera, vicinanza al modello, iterazione rapida |
| **Template FreeMarker** | stringhe concatenate | separazione layout/logica, gestione di XML complessi e del file ordine |
| **Spin** per JSON/XML | parsing manuale | accesso navigabile ai dati dentro script e template |
| **Event sub-process** per gli errori | boundary event sui singoli task | gestore centralizzato, diagramma più pulito |
| **errorCode → HTTP** + **503** sui guasti | `500` generico | risposte semantiche, robustezza richiesta da pag. 12 |
| **File per richiesta** | unico file in append | tracciabilità, niente concorrenza/parse di file crescenti |
| **4 strategie** selezionabili | una sola | flessibilità per obiettivi di business diversi |
| **Prezzo per città** (mappa opzionale) | unico prezzo globale | fedeltà al testo "for each city", retro-compatibile |
| **H2 in-memory** | DB esterno | semplicità per la demo, nessuna dipendenza |

---

## 18. Come compilare ed eseguire

> Il progetto richiede **Java 8** (es. `C:\Program Files\Java\jdk1.8.0_202`).

**Avvio completo (servizi + Camunda + dashboard)** con lo script PowerShell:
```powershell
.\start.ps1 -JavaHome "C:\Program Files\Java\jdk1.8.0_202"
```
Lo script avvia i tre servizi, compila ed esegue il motore, avvia la dashboard e mostra l'health.

**Avvio del solo motore (sviluppo):**
```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk1.8.0_202'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
mvn spring-boot:run
```
- Webapp Camunda: <http://localhost:8080/camunda> (login `demo`/`demo`)
- Dashboard: <http://127.0.0.1:5174>

**Arresto:** `.\stop.ps1`.

---

## 19. Esempi di chiamate ed esiti

**Richiesta valida:**
```bash
curl -X POST http://localhost:8080/api/request -H "Content-Type: application/json" \
  -d '{ "username":"mariorossi", "posterFormat":"60x80", "cities":["L'\''Aquila","Rome"], "maxPrice":20.0 }'
```
→ `200 OK` con `requestId`, zone selezionate, `totalPrice`, `usedStrategy`, `skippedCities`.

**Richiesta con prezzo per città:**
```bash
curl -X POST http://localhost:8080/api/request -H "Content-Type: application/json" \
  -d '{ "username":"mariorossi", "posterFormat":"60x80", "cities":["L'\''Aquila","Rome"], "maxPrice":20.0, "maxPrices":{"Rome":50.0} }'
```

**Decisione (conferma):**
```bash
curl -X POST http://localhost:8080/api/decision -H "Content-Type: application/json" \
  -d '{ "requestId":"<REQUEST_ID>", "decision":"confirm" }'
```
→ `200 OK` con `accountHolder`, `invoiceNumber`, `amountDue`; genera il file dell'ordine.

**Scenari di errore principali:**

| Scenario | Esito |
|---|---|
| Username inesistente | `404 USER_NOT_FOUND` |
| Budget troppo basso / città non servita | `422 NO_AFFORDABLE_ZONES` |
| Zone non disponibili | `409 NOT_AVAILABLE` |
| `posterFormat`/campi mancanti, strategia o prezzo non validi | `400` |
| Servizio esterno spento | `503` |
| Fattura di conferma non valida | `502 POSTING_SERVICE_ERROR` |

Utenti validi: `mariorossi`, `sarabianchi`, `johndoe`. Città servite: `L'Aquila`, `Rome`, `Milan`.

---

## 20. Possibili estensioni future

- **Persistenza su DB** degli ordini (oltre ai file) per ricerche e reportistica.
- **Autenticazione** sulle API (token) e ruoli per la decisione.
- **Scadenza dell'attesa**: un *timer boundary event* sul message catch che annulla automaticamente le richieste non confermate entro N giorni.
- **Prezzo per città dal frontend con preset** dedicati e validazione lato client.
- **Notifica al cliente** (email) alla conferma, sfruttando i dati anagrafici già disponibili.

---

*Documento di sintesi del progetto. Per il dettaglio tecnico degli interventi e la gap analysis, vedere anche `docs/Documentazione_Progetto.md`.*
