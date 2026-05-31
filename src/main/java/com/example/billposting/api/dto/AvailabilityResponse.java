package com.example.billposting.api.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class AvailabilityResponse {

    public String requestId;
    public BigDecimal totalPrice;
    public List<SelectedZoneDto> selectedZones = new ArrayList<>();
    public UserDetailsDto userDetails;

    public AvailabilityResponse() {
    }

    public AvailabilityResponse(String requestId, BigDecimal totalPrice, List<SelectedZoneDto> selectedZones, UserDetailsDto userDetails) {
        this.requestId = requestId;
        this.totalPrice = totalPrice;
        this.selectedZones = selectedZones;
        this.userDetails = userDetails;
    }
}
