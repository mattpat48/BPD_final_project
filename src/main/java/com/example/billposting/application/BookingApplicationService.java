package com.example.billposting.application;

import com.example.billposting.api.dto.AvailabilityRequest;
import com.example.billposting.api.dto.AvailabilityResponse;
import com.example.billposting.api.dto.BillingInfoDto;
import com.example.billposting.api.dto.CityBudgetRequest;
import com.example.billposting.api.dto.DecisionRequest;
import com.example.billposting.api.dto.DecisionResponse;
import com.example.billposting.api.dto.SelectedZoneDto;
import com.example.billposting.api.dto.UserDetailsDto;
import com.example.billposting.domain.BillingInformation;
import com.example.billposting.domain.BookingSession;
import com.example.billposting.domain.BookingStatus;
import com.example.billposting.domain.SelectedZone;
import com.example.billposting.domain.UserDetails;
import com.example.billposting.domain.ZoneOffer;
import com.example.billposting.exception.InvalidSelectionStrategyException;
import com.example.billposting.exception.RequestAlreadyFinalizedException;
import com.example.billposting.exception.RequestNotFoundException;
import com.example.billposting.infrastructure.file.BookingFileWriter;
import com.example.billposting.infrastructure.persistence.BookingSessionStore;
import com.example.billposting.infrastructure.posting.PostingServiceClient;
import com.example.billposting.infrastructure.selection.ZoneSelectionStrategy;
import com.example.billposting.infrastructure.selection.ZoneSelectionStrategyResolver;
import com.example.billposting.infrastructure.user.UserServiceClient;
import com.example.billposting.infrastructure.zones.ZonesServiceClient;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class BookingApplicationService {

    private final UserServiceClient userServiceClient;
    private final ZonesServiceClient zonesServiceClient;
    private final PostingServiceClient postingServiceClient;
    private final ZoneSelectionStrategyResolver strategyResolver;
    private final BookingSessionStore bookingSessionStore;
    private final BookingFileWriter bookingFileWriter;
    private final String defaultStrategy;

    public BookingApplicationService(UserServiceClient userServiceClient,
                                     ZonesServiceClient zonesServiceClient,
                                     PostingServiceClient postingServiceClient,
                                     ZoneSelectionStrategyResolver strategyResolver,
                                     BookingSessionStore bookingSessionStore,
                                     BookingFileWriter bookingFileWriter,
                                     @Value("${app.selection.default-strategy:most-expensive-first}") String defaultStrategy) {
        this.userServiceClient = userServiceClient;
        this.zonesServiceClient = zonesServiceClient;
        this.postingServiceClient = postingServiceClient;
        this.strategyResolver = strategyResolver;
        this.bookingSessionStore = bookingSessionStore;
        this.bookingFileWriter = bookingFileWriter;
        this.defaultStrategy = defaultStrategy;
    }

    public AvailabilityResponse requestAvailability(AvailabilityRequest request) {
        UserDetails userDetails = userServiceClient.getUserDetails(request.username);
        String strategyName = StringUtils.hasText(request.selectionStrategy) ? request.selectionStrategy : defaultStrategy;
        ZoneSelectionStrategy strategy = strategyResolver.resolve(strategyName);

        List<SelectedZone> selectedZones = new ArrayList<>();
        BigDecimal totalPrice = BigDecimal.ZERO;

        for (CityBudgetRequest cityBudgetRequest : request.cities) {
            List<ZoneOffer> availableZones = zonesServiceClient.getAvailableZones(cityBudgetRequest.city, request.posterFormat);
            List<SelectedZone> citySelection = strategy.select(
                    cityBudgetRequest.city,
                    request.posterFormat,
                    availableZones,
                    cityBudgetRequest.maxPrice);
            selectedZones.addAll(citySelection);
            for (SelectedZone selectedZone : citySelection) {
                totalPrice = totalPrice.add(selectedZone.getPrice());
            }
        }

        String requestId = postingServiceClient.createPostingRequest(userDetails, selectedZones);
        BookingSession session = new BookingSession(
                requestId,
                request.username,
                request.posterFormat,
                strategyName.toLowerCase(Locale.ROOT),
                userDetails,
                selectedZones,
                totalPrice,
                BookingStatus.PENDING,
                Instant.now());
        bookingSessionStore.save(session);

        List<SelectedZoneDto> responseZones = new ArrayList<>();
        for (SelectedZone selectedZone : selectedZones) {
            responseZones.add(new SelectedZoneDto(
                    selectedZone.getCity(),
                    selectedZone.getZoneId(),
                    selectedZone.getDescription(),
                    selectedZone.getPosterFormat(),
                    selectedZone.getPrice()));
        }

        UserDetailsDto userDetailsDto = new UserDetailsDto(
                userDetails.getUsername(),
            userDetails.getName(),
            userDetails.getSurname(),
            userDetails.getTaxCode(),
            userDetails.getAddress(),
            userDetails.getCity(),
            userDetails.getZipCode(),
            userDetails.getFullName(),
                userDetails.getEmail(),
                userDetails.getPhone());

        return new AvailabilityResponse(requestId, totalPrice, responseZones, userDetailsDto);
    }

    public DecisionResponse handleDecision(DecisionRequest request) {
        BookingSession session = bookingSessionStore.findByRequestId(request.requestId)
                .orElseThrow(() -> new RequestNotFoundException("Unknown requestId: " + request.requestId));

        synchronized (session) {
            if (session.getStatus() != BookingStatus.PENDING) {
                throw new RequestAlreadyFinalizedException("Request already finalized: " + request.requestId);
            }

            if ("confirm".equalsIgnoreCase(request.decision)) {
                BillingInformation billingInformation = postingServiceClient.confirm(request.requestId, session);
                bookingFileWriter.appendConfirmedRequest(session, billingInformation);
                session.markConfirmed(billingInformation);
                return new DecisionResponse(request.requestId, "confirm", "CONFIRMED",
                        new BillingInfoDto(billingInformation.getInvoiceNumber(), billingInformation.getAmountDue()));
            }

            postingServiceClient.cancel(request.requestId, session);
            System.out.println("Cancellation notice for request " + request.requestId + " with username " + session.getUsername());
            session.markCancelled();
            return new DecisionResponse(request.requestId, "cancel", "CANCELLED", null);
        }
    }
}
