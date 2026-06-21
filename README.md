# Note
- Non serve una richiesta inizializzatrice, bastano due endpoint REST per Request e Decision
- I messaggi sono costrutti interni del BPMN, servono a comunicare con questo.
- Utilizzare dei DTO per scambiare dati (tipo dati dell'utente nella request), ne servono 2
- Necessario salvare request ID come process variable per svegliare il giusto processo
- Per far funzionare l'endpoint /api/decision, devi avere un Intermediate Catch Message Event nel tuo BPMN. Nelle proprietà di questo evento, devi creare un Message il cui Nome (non l'ID, ma il Message Name) deve essere esattamente DecisionMessage (che è quello richiamato nel codice Java).