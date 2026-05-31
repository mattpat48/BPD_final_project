package com.example.billposting.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class BookingSession {

    private final String requestId;
    private final String username;
    private final String posterFormat;
    private final String strategy;
    private final UserDetails userDetails;
    private final List<SelectedZone> selectedZones;
    private final BigDecimal totalPrice;
    private final Instant createdAt;
    private volatile BookingStatus status;
    private volatile BillingInformation billingInformation;

    public BookingSession(String requestId,
                          String username,
                          String posterFormat,
                          String strategy,
                          UserDetails userDetails,
                          List<SelectedZone> selectedZones,
                          BigDecimal totalPrice,
                          BookingStatus status,
                          Instant createdAt) {
        this.requestId = requestId;
        this.username = username;
        this.posterFormat = posterFormat;
        this.strategy = strategy;
        this.userDetails = userDetails;
        this.selectedZones = selectedZones;
        this.totalPrice = totalPrice;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String getRequestId() {
        return requestId;
    }

    public String getUsername() {
        return username;
    }

    public String getPosterFormat() {
        return posterFormat;
    }

    public String getStrategy() {
        return strategy;
    }

    public UserDetails getUserDetails() {
        return userDetails;
    }

    public List<SelectedZone> getSelectedZones() {
        return selectedZones;
    }

    public BigDecimal getTotalPrice() {
        return totalPrice;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public BillingInformation getBillingInformation() {
        return billingInformation;
    }

    public synchronized void markConfirmed(BillingInformation billingInformation) {
        this.billingInformation = billingInformation;
        this.status = BookingStatus.CONFIRMED;
    }

    public synchronized void markCancelled() {
        this.status = BookingStatus.CANCELLED;
    }
}
