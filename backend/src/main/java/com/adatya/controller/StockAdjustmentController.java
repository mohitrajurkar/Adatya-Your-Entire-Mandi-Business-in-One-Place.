package com.adatya.controller;

import com.adatya.dto.TradeRequests.CreateStockAdjustment;
import com.adatya.model.Commodity;
import com.adatya.model.StockAdjustment;
import com.adatya.repository.CommodityRepository;
import com.adatya.repository.StockAdjustmentRepository;
import com.adatya.security.CurrentUser;
import com.adatya.service.MandiSaleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/stock-adjustments")
public class StockAdjustmentController {

    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final CommodityRepository commodityRepository;
    private final MandiSaleService mandiSaleService;
    private final CurrentUser currentUser;

    public StockAdjustmentController(StockAdjustmentRepository stockAdjustmentRepository,
                                     CommodityRepository commodityRepository,
                                     MandiSaleService mandiSaleService,
                                     CurrentUser currentUser) {
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.commodityRepository = commodityRepository;
        this.mandiSaleService = mandiSaleService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllAdjustments() {
        Long userId = currentUser.id();

        Map<Long, String> names = new HashMap<>();
        for (Commodity c : commodityRepository.findAllByUserId(userId)) {
            names.put(c.getId(), c.getName());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (StockAdjustment a : stockAdjustmentRepository.findAllByUserIdOrderByCreatedAtDesc(userId)) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", a.getId());
            map.put("commodityId", a.getCommodityId());
            map.put("commodityName", names.getOrDefault(a.getCommodityId(), "Grain"));
            map.put("type", a.getType());
            map.put("bags", a.getBags());
            map.put("weightQuintals", a.getWeightQuintals());
            map.put("rate", a.getRate());
            map.put("reason", a.getReason());
            map.put("date", a.getDate());
            map.put("createdAt", a.getCreatedAt());
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createAdjustment(@Valid @RequestBody CreateStockAdjustment request) {
        StockAdjustment saved = mandiSaleService.createAdjustment(currentUser.id(), request);
        return ResponseEntity.ok(Map.of("success", true, "adjustment", saved));
    }
}
