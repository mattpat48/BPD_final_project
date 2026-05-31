package com.example.billposting.infrastructure.zones;

import com.example.billposting.domain.ZoneOffer;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DemoZonesServiceClient implements ZonesServiceClient {

    @Override
    public List<ZoneOffer> getAvailableZones(String city, String posterFormat) {
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
}
