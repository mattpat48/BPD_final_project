package com.example.billposting.api.controller;

import com.example.billposting.api.dto.AvailabilityRequest;
import com.example.billposting.api.dto.AvailabilityResponse;
import com.example.billposting.api.dto.DecisionRequest;
import com.example.billposting.api.dto.DecisionResponse;
import com.example.billposting.application.BookingWorkflowService;
import javax.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/requests")
@Validated
public class BookingController {

    private final BookingWorkflowService bookingWorkflowService;

    public BookingController(BookingWorkflowService bookingWorkflowService) {
        this.bookingWorkflowService = bookingWorkflowService;
    }

    @PostMapping("/availability")
    public ResponseEntity<AvailabilityResponse> requestAvailability(@Valid @RequestBody AvailabilityRequest request) {
        return ResponseEntity.ok(bookingWorkflowService.requestAvailability(request));
    }

    @PostMapping("/decision")
    public ResponseEntity<DecisionResponse> sendDecision(@Valid @RequestBody DecisionRequest request) {
        return ResponseEntity.ok(bookingWorkflowService.handleDecision(request));
    }
}
