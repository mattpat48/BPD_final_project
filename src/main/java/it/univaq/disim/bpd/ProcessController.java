package it.univaq.disim.bpd;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Collections;

import org.camunda.bpm.engine.RuntimeService;
import org.camunda.bpm.engine.HistoryService;
import org.camunda.bpm.engine.history.HistoricVariableInstance;
import org.camunda.bpm.engine.runtime.MessageCorrelationResult;
import org.camunda.bpm.engine.runtime.MessageCorrelationResultWithVariables;
import org.camunda.bpm.engine.runtime.ProcessInstance;
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

    /** Zone-selection algorithms the user may choose inline on the initial request.
     *  When none is supplied the process falls back to GREEDY (most-expensive-first). */
    private static final Set<String> ALLOWED_STRATEGIES = new HashSet<>(Arrays.asList(
            "GREEDY", "MAX_ZONES", "BALANCED_COVERAGE", "LOWEST_TOTAL"));

    /** Serializes the optional per-city budget map into the JSON string the BPMN script reads. */
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON =
            new com.fasterxml.jackson.databind.ObjectMapper();

    @PostMapping("/request")
    public ResponseEntity<?> requestAvailability(@RequestBody AvailabilityRequestDto input) {

        if (input.getUsername() == null || input.getUsername().isEmpty() ||
            input.getCities() == null || input.getCities().isEmpty() ||
            input.getMaxPrice() == null || input.getMaxPrice() <= 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Missing data: username, cities list, and maxPrice (greater than 0) are mandatory."));
        }

        // An inline strategy, when supplied, must be one of the known algorithms.
        // If omitted, the process defaults to GREEDY.
        if (input.getStrategy() != null && !input.getStrategy().isEmpty()
                && !ALLOWED_STRATEGIES.contains(input.getStrategy())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Unknown strategy. Allowed values: " + ALLOWED_STRATEGIES));
        }

        try {
            Map<String, Object> variables = new HashMap<>();
            variables.put("username", input.getUsername());
            variables.put("posterFormat", input.getPosterFormat());
            variables.put("cities", input.getCities());
            variables.put("maxPrice", input.getMaxPrice());
            if (input.getStrategy() != null && !input.getStrategy().isEmpty()) {
                variables.put("strategy", input.getStrategy());
            }

            // Start the process by correlating the "StartRequest" message to its message start
            // event. correlateWithResultAndVariables(true) runs the flow synchronously up to the
            // wait state (or to the end, if the error sub-process fires) and returns the variables,
            // so we can still read requestId/totalPrice/selectedZones in the same call.
            MessageCorrelationResultWithVariables result = runtimeService.createMessageCorrelation("StartRequest")
                    .setVariables(variables)
                    .correlateWithResultAndVariables(true);

            ProcessInstance processInstance = result.getProcessInstance();
            String processInstanceId = processInstance != null ? processInstance.getId() : null;
            Map<String, Object> vars = result.getVariables();

            // The process may have ended through the error sub-process: in that case a validation
            // task recorded an errorCode. We translate it into a meaningful HTTP status instead of
            // returning a meaningless requestId (or a raw 500).
            Object errorCode = readVar(vars, processInstanceId, "errorCode");
            if (errorCode != null) {
                Object errorMessage = readVar(vars, processInstanceId, "errorMessage");
                HttpStatus status = mapBusinessError(errorCode.toString());
                Map<String, Object> errorBody = new HashMap<>();
                errorBody.put("error", errorMessage != null ? errorMessage : errorCode);
                errorBody.put("errorCode", errorCode);
                return ResponseEntity.status(status).body(errorBody);
            }

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("requestId", vars.get("requestId"));
            responseData.put("selectedZonesJSON", vars.get("selectedZonesJSON"));
            responseData.put("totalPrice", vars.get("totalPrice"));
            responseData.put("usedStrategy", vars.get("usedStrategy"));
            // List (JSON string) of requested cities that had no affordable zone within budget.
            responseData.put("skippedCities", vars.get("skippedCities"));

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
        if (processInstanceId == null) {
            return null;
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

            // A fault on the confirm/cancel branch (e.g. an invalid bill from the posting service)
            // is raised as a BPMN error and recorded by the error sub-process. We translate it into
            // a semantic HTTP status instead of returning a fake "N/A" bill (or a raw 500), exactly
            // as /request does.
            Object errorCode = readVar(null, processInstanceId, "errorCode");
            if (errorCode != null) {
                Object errorMessage = readVar(null, processInstanceId, "errorMessage");
                Map<String, Object> errorBody = new HashMap<>();
                errorBody.put("error", errorMessage != null ? errorMessage : errorCode);
                errorBody.put("errorCode", errorCode);
                return ResponseEntity.status(mapBusinessError(errorCode.toString())).body(errorBody);
            }

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
            // A confirm/cancel that reaches an unavailable posting service surfaces here as a
            // connector exception: map it to 503 instead of a raw 500, just like /request.
            if (isConnectivityFault(e)) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Collections.singletonMap("error", "An external service is currently unavailable. Please retry later."));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Error correlating message: " + e.getMessage()));
        }
    }

    public static class AvailabilityRequestDto {
        private String username;
        private String posterFormat;
        private List<String> cities;
        private Double maxPrice;
        private String strategy;        // optional: pick the algorithm inline (defaults to GREEDY)

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
