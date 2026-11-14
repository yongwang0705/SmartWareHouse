package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.dto.CancelPlanResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.ConfirmPlanResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.GeneratePlanRequest;
import com.ikwhere.smartwarehouse_production_planning.dto.PlanDetailsResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.PlanSummaryResponse;
import com.ikwhere.smartwarehouse_production_planning.service.PlanningWorkflowService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/production/plans")
public class ProductionPlanController {

    private final PlanningWorkflowService planningWorkflowService;

    public ProductionPlanController(
            PlanningWorkflowService planningWorkflowService) {
        this.planningWorkflowService = planningWorkflowService;
    }

    @PostMapping("/generate")
    public ResponseEntity<PlanSummaryResponse> generatePlan(
            @Valid @RequestBody GeneratePlanRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(planningWorkflowService.generatePlan(request));
    }

    @GetMapping
    public ResponseEntity<List<PlanSummaryResponse>> listPlans() {
        return ResponseEntity.ok(planningWorkflowService.listPlans());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlanDetailsResponse> getPlan(@PathVariable Long id) {
        return ResponseEntity.ok(planningWorkflowService.getPlan(id));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<ConfirmPlanResponse> confirmPlan(
            @PathVariable Long id) {

        return ResponseEntity.ok(planningWorkflowService.confirmPlan(id));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<CancelPlanResponse> cancelPlan(
            @PathVariable Long id) {

        return ResponseEntity.ok(planningWorkflowService.cancelPlan(id));
    }
}
