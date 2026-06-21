package it.univaq.disim.bpd;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Collections;

import org.camunda.bpm.engine.RuntimeService;
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

            Object selectedZones = instance.getVariables().get("selectedZonesJSON");
            Object totalPrice = instance.getVariables().get("totalPrice");
            Object requestId = instance.getVariables().get("requestId");

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("message", "Zone selection and availability check completed. Waiting for decision.");
            responseData.put("processInstanceId", instance.getId());
            responseData.put("requestId", requestId);
            responseData.put("selectedZonesJSON", selectedZones);
            responseData.put("totalPrice", totalPrice);

            return ResponseEntity.ok(responseData);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Error during process execution: " + e.getMessage()));
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
            runtimeService.createMessageCorrelation("DecisionMessage")
                    .processInstanceVariableEquals("requestId", input.getRequestId())
                    .setVariable("decision", input.getDecision())
                    .correlate();

            return ResponseEntity.ok(Collections.singletonMap("message", "Decision applied for request " + input.getRequestId()));
            
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