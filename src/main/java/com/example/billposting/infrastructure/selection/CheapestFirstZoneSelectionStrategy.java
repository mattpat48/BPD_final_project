package com.example.billposting.infrastructure.selection;

import com.example.billposting.domain.SelectedZone;
import com.example.billposting.domain.ZoneOffer;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CheapestFirstZoneSelectionStrategy implements ZoneSelectionStrategy {

    @Override
    public String getName() {
        return "cheapest-first";
    }

    @Override
    public List<SelectedZone> select(String city, String posterFormat, List<ZoneOffer> offers, BigDecimal maxPrice) {
        List<ZoneOffer> sorted = new ArrayList<>(offers);
        sorted.sort(Comparator.comparing(ZoneOffer::getPrice));

        List<SelectedZone> selectedZones = new ArrayList<>();
        BigDecimal runningTotal = BigDecimal.ZERO;
        for (ZoneOffer offer : sorted) {
            BigDecimal nextTotal = runningTotal.add(offer.getPrice());
            if (nextTotal.compareTo(maxPrice) <= 0) {
                selectedZones.add(new SelectedZone(city, offer.getZoneId(), offer.getDescription(), posterFormat, offer.getPrice()));
                runningTotal = nextTotal;
            }
        }
        return selectedZones;
    }
}
