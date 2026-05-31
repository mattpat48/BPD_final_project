package com.example.billposting.infrastructure.file;

import com.example.billposting.domain.BillingInformation;
import com.example.billposting.domain.BookingSession;

public interface BookingFileWriter {

    void appendConfirmedRequest(BookingSession session, BillingInformation billingInformation);
}
