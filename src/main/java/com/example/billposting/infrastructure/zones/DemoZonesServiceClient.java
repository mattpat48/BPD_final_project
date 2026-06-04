package com.example.billposting.infrastructure.zones;

import com.example.billposting.domain.ZoneOffer;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

@Component
public class DemoZonesServiceClient implements ZonesServiceClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String baseUrl;

    public DemoZonesServiceClient(@Value("${app.services.zones-base-url:}") String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public List<ZoneOffer> getAvailableZones(String city, String posterFormat) {
        if (StringUtils.hasText(baseUrl)) {
            try {
                @SuppressWarnings("unchecked")
                List<Map> response = restTemplate.getForObject(baseUrl + "/zones/{format}", List.class, posterFormat);
                if (response != null && !response.isEmpty()) {
                    List<ZoneOffer> offers = new ArrayList<ZoneOffer>();
                    for (Map zone : response) {
                        offers.add(new ZoneOffer(
                                city,
                                String.valueOf(zone.get("id")),
                                String.valueOf(zone.get("name")),
                                posterFormat,
                                BigDecimal.valueOf(asDouble(zone.get("price")))));
                    }
                    return offers;
                }
            } catch (Exception exception) {
                // Fall back to the demo behavior when the external jar is not available.
            }
        }

        int seed = Math.abs((city + "|" + posterFormat).hashCode());
        BigDecimal basePrice = BigDecimal.valueOf(12 + (seed % 8));

        List<ZoneOffer> offers = new ArrayList<>();
        for (int index = 0; index < 6; index++) {
            BigDecimal price = basePrice.add(BigDecimal.valueOf(index * 6L)).add(BigDecimal.valueOf(seed % 3));
            offers.add(new ZoneOffer(
                    city,
                    city.toUpperCase().replaceAll("[^A-Z0-9]", "") + "-Z" + (index + 1),
                    city + " zone " + (index + 1),
                    posterFormat,
                    price));
        }
        return offers;
    }

    private double asDouble(Object value) {
        if (value == null) {
            return 0.0d;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return Double.parseDouble(String.valueOf(value));
    }
}
