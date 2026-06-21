package it.univaq.disim.bpd;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
                    .body(java.util.Collections.singletonMap("error", "Missing data: username, cities list, and maxPrice (greater than 0) are mandatory."));
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

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("message", "Zone selection completed!");
            responseData.put("processInstanceId", instance.getId());
            responseData.put("selectedZonesJSON", selectedZones);
            responseData.put("totalPrice", totalPrice);

            return ResponseEntity.ok(responseData);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Collections.singletonMap("error", "Error during process execution: " + e.getMessage()));
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
}