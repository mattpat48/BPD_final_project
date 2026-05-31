package com.example.billposting.infrastructure.persistence;

import com.example.billposting.domain.BookingSession;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Component;

@Component
public class InMemoryBookingSessionStore implements BookingSessionStore {

    private final ConcurrentMap<String, BookingSession> sessions = new ConcurrentHashMap<>();

    @Override
    public BookingSession save(BookingSession session) {
        sessions.put(session.getRequestId(), session);
        return session;
    }

    @Override
    public Optional<BookingSession> findByRequestId(String requestId) {
        return Optional.ofNullable(sessions.get(requestId));
    }
}
