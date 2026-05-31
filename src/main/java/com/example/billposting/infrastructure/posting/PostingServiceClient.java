package com.example.billposting.infrastructure.posting;

import com.example.billposting.domain.BillingInformation;
import com.example.billposting.domain.BookingSession;
import com.example.billposting.domain.SelectedZone;
import com.example.billposting.domain.UserDetails;
import java.util.List;

public interface PostingServiceClient {

    String createPostingRequest(UserDetails userDetails, List<SelectedZone> selectedZones);

    BillingInformation confirm(String requestId, BookingSession session);

    void cancel(String requestId, BookingSession session);
}
