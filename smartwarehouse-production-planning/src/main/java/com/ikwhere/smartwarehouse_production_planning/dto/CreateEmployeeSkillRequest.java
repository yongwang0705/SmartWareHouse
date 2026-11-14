package com.ikwhere.smartwarehouse_production_planning.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateEmployeeSkillRequest(
        @NotBlank String skillCode,
        String proficiency
) {
}
