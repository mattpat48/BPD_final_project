package it.univaq.disim.bpd;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Collections;

import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.history.HistoricVariableInstance;
import org.camunda.bpm.engine.runtime.MessageCorrelationResult;
import org.camunda.bpm.engine.runtime.ProcessInstanceWithVariables;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ProcessController {

    @Autowired
    private RuntimeService runtimeService;

    @Autowired
    private HistoryService historyService;

    /** Zone-selection algorithms the user is allowed to pick. */
    private static final Set<String> ALLOWED_STRATEGIES = new HashSet<>(Arrays.asList(
            "MOST_EXPENSIVE", "MAX_ZONES", "BALANCED_COVERAGE", "LOWEST_TOTAL"));

    @PostMapping("/request")
    public ResponseEntity<?> requestAvailability(@RequestBody AvailabilityRequestDto input) {

        if (input.getUsername() == null || input.getUsername().isEmpty() ||
            input.getCities() == null || input.getCities().isEmpty() ||
            input.getMaxPrice() == null || input.getMaxPrice() <= 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Missing data: username, cities list, and maxPrice (greater than 0) are mandatory."));
        }

        // A strategy supplied inline must be one of the known algorithms.
        if (input.getStrategy() != null && !input.getStrategy().isEmpty()
                && !ALLOWED_STRATEGIES.contains(input.getStrategy())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Unknown strategy. Allowed values: " + ALLOWED_STRATEGIES));
        }

        try {
            boolean defer = Boolean.TRUE.equals(input.getDeferStrategy());

            // A ticketId is generated up-front and used as the process business key: it lets the
            // user correlate the (optional) deferred strategy choice before a requestId even exists.
            String ticketId = UUID.randomUUID().toString().replace("-", "").substring(0, 10);

            Map<String, Object> variables = new HashMap<>();
            variables.put("username", input.getUsername());
            variables.put("posterFormat", input.getPosterFormat());
            variables.put("cities", input.getCities());
            variables.put("maxPrice", input.getMaxPrice());
            variables.put("deferStrategy", defer);
            if (input.getStrategy() != null && !input.getStrategy().isEmpty()) {
                variables.put("strategy", input.getStrategy());
            }

            ProcessInstanceWithVariables instance = runtimeService.createProcessInstanceByKey("PublicBillposting")
                    .businessKey(ticketId)
                    .setVariables(variables)
                    .executeWithVariablesInReturn();

            Map<String, Object> vars = instance.getVariables();

            // The process may have ended through the error sub-process: in that case a validation
            // task recorded an errorCode. We translate it into a meaningful HTTP status instead of
            // returning a meaningless requestId (or a raw 500).
            Object errorCode = readVar(vars, instance.getId(), "errorCode");
            if (errorCode != null) {
                Object errorMessage = readVar(vars, instance.getId(), "errorMessage");
                HttpStatus status = mapBusinessError(errorCode.toString());
                Map<String, Object> errorBody = new HashMap<>();
                errorBody.put("error", errorMessage != null ? errorMessage : errorCode);
                errorBody.put("errorCode", errorCode);
                errorBody.put("ticketId", ticketId);
                return ResponseEntity.status(status).body(errorBody);
            }

            Object requestId = vars.get("requestId");

            // No requestId yet => the instance paused at "Wait for strategy choice" (deferred mode).
            if (requestId == null) {
                Map<String, Object> pending = new HashMap<>();
                pending.put("ticketId", ticketId);
                pending.put("awaitingStrategy", true);
                pending.put("availableStrategies", ALLOWED_STRATEGIES);
                pending.put("message", "Send the chosen strategy to /api/strategy using this ticketId.");
                return ResponseEntity.accepted().body(pending);
            }

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("ticketId", ticketId);
            responseData.put("requestId", requestId);
            responseData.put("selectedZonesJSON", vars.get("selectedZonesJSON"));
            responseData.put("totalPrice", vars.get("totalPrice"));
            responseData.put("usedStrategy", vars.get("usedStrategy"));

            return ResponseEntity.ok(responseData);

        } catch (Exception e) {
            // Technical faults (e.g. an external service is down) surface here as exceptions,
            // never as a modeled BPMN error. We map connectivity problems to 503 and keep the
            // generic 500 only as a last resort, so the user is never left with a raw stack trace.
            if (isConnectivityFault(e)) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Collections.singletonMap("error", "An external service is currently unavailable. Please retry later."));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Error during process execution: " + e.getMessage()));
        }
    }

    /** Maps a business error code raised by a BPMN validation task to an HTTP status. */
    private HttpStatus mapBusinessError(String errorCode) {
        switch (errorCode) {
            case "USER_NOT_FOUND":        return HttpStatus.NOT_FOUND;             // 404
            case "NO_AFFORDABLE_ZONES":   return HttpStatus.UNPROCESSABLE_ENTITY;  // 422
            case "NOT_AVAILABLE":         return HttpStatus.CONFLICT;              // 409
            case "NO_ZONES_AVAILABLE":    return HttpStatus.BAD_GATEWAY;           // 502
            case "POSTING_SERVICE_ERROR": return HttpStatus.BAD_GATEWAY;           // 502
            default:                      return HttpStatus.INTERNAL_SERVER_ERROR; // 500
        }
    }

    /** Reads a variable from the returned map, falling back to history if the instance has ended. */
    private Object readVar(Map<String, Object> vars, String processInstanceId, String name) {
        if (vars != null && vars.get(name) != null) {
            return vars.get(name);
        }
        HistoricVariableInstance hv = historyService.createHistoricVariableInstanceQuery()
                .processInstanceId(processInstanceId)
                .variableName(name)
                .singleResult();
        return hv != null ? hv.getValue() : null;
    }

    /** Walks the exception chain looking for a connection/connector failure. */
    private boolean isConnectivityFault(Throwable e) {
        Throwable cur = e;
        while (cur != null) {
            String name = cur.getClass().getName();
            String msg = cur.getMessage() != null ? cur.getMessage() : "";
            if (name.contains("ConnectException")
                    || name.contains("ConnectorException")
                    || name.contains("UnknownHostException")
                    || msg.contains("Connection refused")
                    || msg.contains("Connect to ")) {
                return true;
            }
            cur = cur.getCause();
        }
        return false;
    }

    @PostMapping("/strategy")
    public ResponseEntity<?> chooseStrategy(@RequestBody StrategyRequestDto input) {
        if (input.getTicketId() == null || input.getTicketId().isEmpty()
                || input.getStrategy() == null || !ALLOWED_STRATEGIES.contains(input.getStrategy())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Invalid data: ticketId and a valid strategy are required. Allowed: " + ALLOWED_STRATEGIES));
        }

        try {
            // Wake up the instance waiting at "Wait for strategy choice", correlated by business key.
            MessageCorrelationResult result = runtimeService.createMessageCorrelation("StrategyMessage")
                    .processInstanceBusinessKey(input.getTicketId())
                    .setVariable("strategy", input.getStrategy())
                    .correlateWithResult();

            String processInstanceId = result.getExecution().getProcessInstanceId();

            // Selecting zones may fail (NO_AFFORDABLE_ZONES / NOT_AVAILABLE): handle it like /request.
            Object errorCode = readVar(null, processInstanceId, "errorCode");
            if (errorCode != null) {
                Object errorMessage = readVar(null, processInstanceId, "errorMessage");
                Map<String, Object> errorBody = new HashMap<>();
                errorBody.put("error", errorMessage != null ? errorMessage : errorCode);
                errorBody.put("errorCode", errorCode);
                errorBody.put("ticketId", input.getTicketId());
                return ResponseEntity.status(mapBusinessError(errorCode.toString())).body(errorBody);
            }

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("ticketId", input.getTicketId());
            responseData.put("requestId", readVar(null, processInstanceId, "requestId"));
            responseData.put("selectedZonesJSON", readVar(null, processInstanceId, "selectedZonesJSON"));
            responseData.put("totalPrice", readVar(null, processInstanceId, "totalPrice"));
            responseData.put("usedStrategy", readVar(null, processInstanceId, "usedStrategy"));
            return ResponseEntity.ok(responseData);

        } catch (org.camunda.bpm.engine.MismatchingMessageCorrelationException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Collections.singletonMap("error", "No process awaiting a strategy choice for ticketId: " + input.getTicketId()));
        } catch (Exception e) {
            if (isConnectivityFault(e)) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Collections.singletonMap("error", "An external service is currently unavailable. Please retry later."));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Error applying strategy: " + e.getMessage()));
        }
    }

    @PostMapping("/decision")
    public ResponseEntity<?> submitDecision(@RequestBody DecisionRequestDto input) {
        if (input.getRequestId() == null || input.getRequestId().isEmpty() ||
            input.getDecision() == null || 
            (!input.getDecision().equals("confirm") && !input.getDecision().equals("cancel"))) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Invalid data: requestId and decision ('confirm' or 'cancel') are required."));
        }

        try {
            // correlateWithResult() allows us to get the Execution reference even if the process ends instantly
            MessageCorrelationResult result = runtimeService.createMessageCorrelation("DecisionMessage")
                    .processInstanceVariableEquals("requestId", input.getRequestId())
                    .setVariable("decision", input.getDecision())
                    .correlateWithResult();

            String processInstanceId = result.getExecution().getProcessInstanceId();
            Map<String, Object> responseData = new HashMap<>();
            //responseData.put("message", "Decision applied successfully.");

            // If confirmed, fetch the billing variables from the History Database
            if ("confirm".equals(input.getDecision())) {
                HistoricVariableInstance accountHolderVar = historyService.createHistoricVariableInstanceQuery()
                        .processInstanceId(processInstanceId)
                        .variableName("accountHolder")
                        .singleResult();

                HistoricVariableInstance invoiceVar = historyService.createHistoricVariableInstanceQuery()
                        .processInstanceId(processInstanceId)
                        .variableName("invoiceNumber")
                        .singleResult();
                
                HistoricVariableInstance amountVar = historyService.createHistoricVariableInstanceQuery()
                        .processInstanceId(processInstanceId)
                        .variableName("amountDue")
                        .singleResult();

                if (accountHolderVar != null) responseData.put("accountHolder", accountHolderVar.getValue());
                if (invoiceVar != null) responseData.put("invoiceNumber", invoiceVar.getValue());
                if (amountVar != null) responseData.put("amountDue", amountVar.getValue());
            } else if ("cancel".equals(input.getDecision())) {
                responseData.put("accountHolder", "N/A");
                responseData.put("invoiceNumber", "N/A");
                responseData.put("amountDue", "0.0");
            }

            return ResponseEntity.ok(responseData);
            
        } catch (org.camunda.bpm.engine.MismatchingMessageCorrelationException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Collections.singletonMap("error", "No active process found waiting for decision with request ID: " + input.getRequestId()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Error correlating message: " + e.getMessage()));
        }
    }

    public static class AvailabilityRequestDto {
        private String username;
        private String posterFormat;
        private List<String> cities;
        private Double maxPrice;
        private String strategy;        // optional: pick the algorithm inline
        private Boolean deferStrategy;  // optional: choose the algorithm in a later /strategy call

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }

        public String getPosterFormat() { return posterFormat; }
        public void setPosterFormat(String posterFormat) { this.posterFormat = posterFormat; }

        public List<String> getCities() { return cities; }
        public void setCities(List<String> cities) { this.cities = cities; }

        public Double getMaxPrice() { return maxPrice; }
        public void setMaxPrice(Double maxPrice) { this.maxPrice = maxPrice; }

        public String getStrategy() { return strategy; }
        public void setStrategy(String strategy) { this.strategy = strategy; }

        public Boolean getDeferStrategy() { return deferStrategy; }
        public void setDeferStrategy(Boolean deferStrategy) { this.deferStrategy = deferStrategy; }
    }

    public static class StrategyRequestDto {
        private String ticketId;
        private String strategy;

        public String getTicketId() { return ticketId; }
        public void setTicketId(String ticketId) { this.ticketId = ticketId; }

        public String getStrategy() { return strategy; }
        public void setStrategy(String strategy) { this.strategy = strategy; }
    }

    public static class DecisionRequestDto {
        private String requestId;
        private String decision;

        public String getRequestId() { return requestId; }
        public void setRequestId(String requestId) { this.requestId = requestId; }

        public String getDecision() { return decision; }
        public void setDecision(String decision) { this.decision = decision; }
    }
}