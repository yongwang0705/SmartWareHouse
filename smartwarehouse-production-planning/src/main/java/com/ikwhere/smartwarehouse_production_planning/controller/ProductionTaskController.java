package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.dto.AssignmentResponse;
import com.ikwhere.smartwarehouse_production_planning.dto.TaskResponse;
import com.ikwhere.smartwarehouse_production_planning.service.PlanningWorkflowService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/production")
public class ProductionTaskController {

    private final PlanningWorkflowService planningWorkflowService;

    public ProductionTaskController(
            PlanningWorkflowService planningWorkflowService) {
        this.planningWorkflowService = planningWorkflowService;
    }

    @GetMapping("/tasks")
    public ResponseEntity<List<TaskResponse>> listTasks(
            @RequestParam(required = false) Long planId) {

        return ResponseEntity.ok(
                planningWorkflowService.listTasks(planId)
        );
    }

    @GetMapping("/tasks/{id}")
    public ResponseEntity<TaskResponse> getTask(@PathVariable Long id) {
        return ResponseEntity.ok(planningWorkflowService.getTask(id));
    }

    @PostMapping("/tasks/{id}/start")
    public ResponseEntity<TaskResponse> startTask(@PathVariable Long id) {
        return ResponseEntity.ok(planningWorkflowService.startTask(id));
    }

    @PostMapping("/tasks/{id}/complete")
    public ResponseEntity<TaskResponse> completeTask(@PathVariable Long id) {
        return ResponseEntity.ok(planningWorkflowService.completeTask(id));
    }

    @GetMapping("/resources")
    public ResponseEntity<List<AssignmentResponse>> listResources(
            @RequestParam(required = false) Long planId) {

        return ResponseEntity.ok(
                planningWorkflowService.listResources(planId)
        );
    }
}
