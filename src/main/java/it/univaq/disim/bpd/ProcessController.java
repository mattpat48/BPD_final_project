package it.univaq.disim.bpd;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    @PostMapping("/request")
    public ResponseEntity<?> requestAvailability(@RequestBody AvailabilityRequestDto input) {
        
        if (input.getUsername() == null || input.getUsername().isEmpty() || 
            input.getCities() == null || input.getCities().isEmpty() ||
            input.getMaxPrice() == null || input.getMaxPrice() <= 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Missing data: username, cities list, and maxPrice (greater than 0) are mandatory."));
        }

        try {
            Map<String, Object> variables = new HashMap<>();
            variables.put("username", input.getUsername());
            variables.put("posterFormat", input.getPosterFormat());
            variables.put("cities", input.getCities());
            variables.put("maxPrice", input.getMaxPrice());

            ProcessInstanceWithVariables instance = runtimeService.createProcessInstanceByKey("PublicBillposting")
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
                return ResponseEntity.status(status).body(errorBody);
            }

            Object selectedZones = vars.get("selectedZonesJSON");
            Object totalPrice = vars.get("totalPrice");
            Object requestId = vars.get("requestId");

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("requestId", requestId);
            responseData.put("selectedZonesJSON", selectedZones);
            responseData.put("totalPrice", totalPrice);

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

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }

        public String getPosterFormat() { return posterFormat; }
        public void setPosterFormat(String posterFormat) { this.posterFormat = posterFormat; }

        public List<String> getCities() { return cities; }
        public void setCities(List<String> cities) { this.cities = cities; }

        public Double getMaxPrice() { return maxPrice; }
        public void setMaxPrice(Double maxPrice) { this.maxPrice = maxPrice; }
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