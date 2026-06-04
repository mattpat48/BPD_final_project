package com.example.billposting.application;

import com.example.billposting.api.dto.AvailabilityRequest;
import com.example.billposting.api.dto.AvailabilityResponse;
import com.example.billposting.api.dto.DecisionRequest;
import com.example.billposting.api.dto.DecisionResponse;
import java.util.HashMap;
import java.util.Map;
import org.camunda.bpm.engine.RuntimeService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class BookingWorkflowService {

    private final BookingApplicationService bookingApplicationService;
    private final RuntimeService runtimeService;
    private final String availabilityMessageName;
    private final String decisionMessageName;

    public BookingWorkflowService(BookingApplicationService bookingApplicationService,
                                  RuntimeService runtimeService,
                                  @Value("${app.camunda.messages.availability-request:availability-request-message}") String availabilityMessageName,
                                  @Value("${app.camunda.messages.decision:decision-received-message}") String decisionMessageName) {
        this.bookingApplicationService = bookingApplicationService;
        this.runtimeService = runtimeService;
        this.availabilityMessageName = availabilityMessageName;
        this.decisionMessageName = decisionMessageName;
    }

    public AvailabilityResponse requestAvailability(AvailabilityRequest request) {
        AvailabilityResponse response = bookingApplicationService.requestAvailability(request);

        Map<String, Object> variables = new HashMap<String, Object>();
        variables.put("requestId", response.requestId);
        variables.put("username", request.username);
        variables.put("posterFormat", request.posterFormat);
        variables.put("totalPrice", response.totalPrice);
        variables.put("selectedZonesCount", response.selectedZones.size());

        runtimeService.createMessageCorrelation(availabilityMessageName)
                .setVariables(variables)
                .correlateStartMessage();

        return response;
    }

    public DecisionResponse handleDecision(DecisionRequest request) {
        runtimeService.createMessageCorrelation(decisionMessageName)
                .processInstanceVariableEquals("requestId", request.requestId)
                .setVariable("decision", request.decision)
                .correlate();

        return bookingApplicationService.handleDecision(request);
    }
}