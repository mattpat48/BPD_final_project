package com.example.billposting.domain;

import java.math.BigDecimal;

public class BillingInformation {

    private final String invoiceNumber;
    private final BigDecimal amountDue;

    public BillingInformation(String invoiceNumber, BigDecimal amountDue) {
        this.invoiceNumber = invoiceNumber;
        this.amountDue = amountDue;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public BigDecimal getAmountDue() {
        return amountDue;
    }
}
