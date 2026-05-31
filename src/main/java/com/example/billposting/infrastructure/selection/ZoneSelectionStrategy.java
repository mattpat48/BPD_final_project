package com.example.billposting.infrastructure.selection;

import com.example.billposting.domain.SelectedZone;
import com.example.billposting.domain.ZoneOffer;
import java.math.BigDecimal;
import java.util.List;

public interface ZoneSelectionStrategy {

    String getName();

    List<SelectedZone> select(String city, String posterFormat, List<ZoneOffer> offers, BigDecimal maxPrice);
}
