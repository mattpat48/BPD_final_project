package com.example.billposting.api.dto;

import java.util.ArrayList;
import java.util.List;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;

public class AvailabilityRequest {

    @NotBlank
    public String username;

    @NotBlank
    public String posterFormat;

    public String selectionStrategy;

    @Valid
    @NotEmpty
    public List<CityBudgetRequest> cities = new ArrayList<>();
}
