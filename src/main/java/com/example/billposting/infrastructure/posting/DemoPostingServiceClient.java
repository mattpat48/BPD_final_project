package com.example.billposting.infrastructure.posting;

import com.example.billposting.domain.BillingInformation;
import com.example.billposting.domain.BookingSession;
import com.example.billposting.domain.SelectedZone;
import com.example.billposting.domain.UserDetails;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

@Component
public class DemoPostingServiceClient implements PostingServiceClient {

    @Override
    public String createPostingRequest(UserDetails userDetails, List<SelectedZone> selectedZones) {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    @Override
    public BillingInformation confirm(String requestId, BookingSession session) {
        return new BillingInformation(generateInvoiceNumber(), session.getTotalPrice());
    }

    @Override
    public void cancel(String requestId, BookingSession session) {
        // Demo client has no remote side effects.
    }

    private String generateInvoiceNumber() {
        long invoice = ThreadLocalRandom.current().nextLong(1_000_000_000L, 10_000_000_000L);
        return Long.toString(invoice);
    }
}
