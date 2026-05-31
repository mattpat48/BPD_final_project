package com.example.billposting.api.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;

public class DecisionRequest {

    @NotBlank
    public String requestId;

    @NotBlank
    @Pattern(regexp = "(?i)confirm|cancel")
    public String decision;
}
