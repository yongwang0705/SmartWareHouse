package com.ikwhere.smartwarehouse_production_planning.controller;

import com.ikwhere.smartwarehouse_production_planning.dto.CreateProductionLineRequest;
import com.ikwhere.smartwarehouse_production_planning.exception.ApiException;
import com.ikwhere.smartwarehouse_production_planning.model.ProductionLine;
import com.ikwhere.smartwarehouse_production_planning.repository.ProductionLineRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/production/lines")
public class ProductionLineController {

    private final ProductionLineRepository productionLineRepository;

    public ProductionLineController(
            ProductionLineRepository productionLineRepository) {
        this.productionLineRepository = productionLineRepository;
    }

    @GetMapping
    public ResponseEntity<List<ProductionLine>> listLines() {
        return ResponseEntity.ok(productionLineRepository.findAllActive());
    }

    @PostMapping
    public ResponseEntity<ProductionLine> createLine(
            @Valid @RequestBody CreateProductionLineRequest request) {

        String code = request.code().trim().toUpperCase();

        if (productionLineRepository.findByCode(code).isPresent()) {
            throw ApiException.conflict(
                    "A production line with code " + code + " already exists"
            );
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(productionLineRepository.save(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductionLine> updateLine(
            @PathVariable Long id,
            @Valid @RequestBody CreateProductionLineRequest request) {

        productionLineRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound(
                        "Production line not found: " + id
                ));

        return ResponseEntity.ok(
                productionLineRepository.update(id, request)
        );
    }
}
