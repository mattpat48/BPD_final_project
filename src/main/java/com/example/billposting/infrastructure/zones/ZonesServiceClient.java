package com.example.billposting.infrastructure.zones;

import com.example.billposting.domain.ZoneOffer;
import java.util.List;

public interface ZonesServiceClient {

    List<ZoneOffer> getAvailableZones(String city, String posterFormat);
}
