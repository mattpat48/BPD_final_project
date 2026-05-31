package com.example.billposting.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class DecisionResponse {

    public String requestId;
    public String decision;
    public String status;
    public BillingInfoDto billingInfo;

    public DecisionResponse() {
    }

    public DecisionResponse(String requestId, String decision, String status, BillingInfoDto billingInfo) {
        this.requestId = requestId;
        this.decision = decision;
        this.status = status;
        this.billingInfo = billingInfo;
    }
}
