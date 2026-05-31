package com.example.billposting.domain;

import java.math.BigDecimal;

public class SelectedZone {

    private final String city;
    private final String zoneId;
    private final String description;
    private final String posterFormat;
    private final BigDecimal price;

    public SelectedZone(String city, String zoneId, String description, String posterFormat, BigDecimal price) {
        this.city = city;
        this.zoneId = zoneId;
        this.description = description;
        this.posterFormat = posterFormat;
        this.price = price;
    }

    public String getCity() {
        return city;
    }

    public String getZoneId() {
        return zoneId;
    }

    public String getDescription() {
        return description;
    }

    public String getPosterFormat() {
        return posterFormat;
    }

    public BigDecimal getPrice() {
        return price;
    }
}
