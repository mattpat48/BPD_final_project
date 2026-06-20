package it.univaq.disim.bpd;

import java.util.HashMap;
import java.util.Map;

import org.camunda.bpm.engine.RuntimeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProcessController {

    @Autowired
    private RuntimeService runtimeService;

    @GetMapping("/api/request/start")
    public ResponseEntity<String> triggerRequest() {
        Map<String, Object> variables = new HashMap<>();
        variables.put("type", "request");
        runtimeService.startProcessInstanceByKey("PosterCamundaProcess", variables);
        return ResponseEntity.ok("Request process instance started");
    }

    @GetMapping("/api/decision/start")
    public ResponseEntity<String> triggerDecision() {
        Map<String, Object> variables = new HashMap<>();
        variables.put("type", "decision");
        runtimeService.startProcessInstanceByKey("PosterCamundaProcess", variables);
        return ResponseEntity.ok("Decision process instance started");
    }
}