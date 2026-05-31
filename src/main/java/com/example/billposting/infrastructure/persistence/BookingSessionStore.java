package com.example.billposting.infrastructure.persistence;

import com.example.billposting.domain.BookingSession;
import java.util.Optional;

public interface BookingSessionStore {

    BookingSession save(BookingSession session);

    Optional<BookingSession> findByRequestId(String requestId);
}
