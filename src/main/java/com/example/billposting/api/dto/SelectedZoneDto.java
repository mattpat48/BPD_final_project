package com.example.billposting.api.dto;

import java.math.BigDecimal;

public class SelectedZoneDto {

    public String city;
    public String zoneId;
    public String description;
    public String posterFormat;
    public BigDecimal price;

    public SelectedZoneDto() {
    }

    public SelectedZoneDto(String city, String zoneId, String description, String posterFormat, BigDecimal price) {
        this.city = city;
        this.zoneId = zoneId;
        this.description = description;
        this.posterFormat = posterFormat;
        this.price = price;
    }
}
