# Note per andare avanti
- Della pagina 12 del pdf di consegna, i controlli già implementati sono solo il primo punto, ovvero quelli sui "wrong/inadmissible inputs or any other possible process-related fault" e parzialmente gli altri (come l'uso di templates)

# Testing

'''
curl -X POST http://localhost:8080/api/request -H "Content-Type: application/json" -d '{ "username": "mariorossi", "posterFormat": "60x80", "cities": ["L'\''Aquila", "Rome"], "maxPrice": 20.0 }'
'''

e poi

'''
curl -X POST http://localhost:8080/api/decision -H "Content-Type: application/json" -d '{ "requestId": "...", "decision": "cancel" }'
'''

ovviamente nel requestId va quello restituito dal processo

# Scelte implementative
## Logica
Abbiamo contatoo che il maxPrice si riferisse alla singola città, quindi se indichiamo maxPrice 20 e mettiamo due città, abbiamo 40 euro di budget totali. Per fare diversamente, basta inserire una mappa oppure una lista di prezzi a corrispondenza posizionale
## Richieste REST: perché due POST?
Gestione di dati complessi (Payload JSON): Nella prima API (/request) devi inviare una struttura dati complessa (una lista/mappa di città associate a dei prezzi, oltre a username e formato). Con una POST puoi inviare un comodo e pulito "corpo" (body) in formato JSON. Se avessimo usato una GET, avremmo dovuto incastrare tutti questi parametri direttamente nell'URL (es. ?username=mario&city1=Rome&price1=50&city2=Milan...), il che è estremamente scomodo e limitato.

Semantica REST (Cambiamento di Stato): Le regole standard delle API REST dicono che il metodo GET deve essere usato esclusivamente per leggere dati, senza modificare nulla sul server (idempotenza). Le nostre due API, invece, modificano pesantemente lo stato del sistema: la prima crea una nuova istanza di processo Camunda, la seconda sveglia e fa avanzare un processo esistente. Per le operazioni di creazione o modifica, il metodo corretto da usare è la POST.

Pulizia e Sicurezza: I parametri passati tramite GET finiscono visibili nell'URL. Questo significa che rimarrebbero salvati nella cronologia del browser o nei log dei server di rete. Utilizzando la POST, i dati dell'utente (come l'username o la decisione presa) viaggiano "nascosti" all'interno del corpo della richiesta HTTP.
## Selezione dei Task nel processo BPMN, TODO: aggiornare
### Service Tasks: Get User Data, Get Zones, Check Availability
Sono standard in Camunda per chiamate a sistemi esterni come APIs REST che forniscono risposte istantanee. Altre alternative potevano essere Send/Receive, però quelle sono pensate per task asincrone. Essendo che le chiamate API sono istantanee, il Service Task fitta meglio.
### Script Task: Select Zones
Avendo bisogno di fare calcoli, loopare nei dati e parsare HSON, la script task ci permette di scrivere JavaScript direttamente dentro il modeler, semplificando la situazione. Avremmo potuto usare un JavaDelegate, ma creare e compilare un nuovo intero file per una situaizone così semplice sarebbe stato overkill