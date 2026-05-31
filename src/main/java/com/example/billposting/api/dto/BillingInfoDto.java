package com.example.billposting.api.dto;

import java.math.BigDecimal;

public class BillingInfoDto {

    public String invoiceNumber;
    public BigDecimal amountDue;

    public BillingInfoDto() {
    }

    public BillingInfoDto(String invoiceNumber, BigDecimal amountDue) {
        this.invoiceNumber = invoiceNumber;
        this.amountDue = amountDue;
    }
}
