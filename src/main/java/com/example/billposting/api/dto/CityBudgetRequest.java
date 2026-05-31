package com.example.billposting.api.dto;

import java.math.BigDecimal;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class CityBudgetRequest {

    @NotBlank
    public String city;

    @NotNull
    @DecimalMin(value = "0.01", inclusive = true)
    public BigDecimal maxPrice;
}
