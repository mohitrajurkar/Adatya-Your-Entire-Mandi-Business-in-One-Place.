package com.adatya.controller;

import com.adatya.model.Commodity;
import com.adatya.model.StockAdjustment;
import com.adatya.repository.CommodityRepository;
import com.adatya.repository.StockAdjustmentRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/stock-adjustments")
public class StockAdjustmentController {

    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final CommodityRepository commodityRepository;

    public StockAdjustmentController(StockAdjustmentRepository stockAdjustmentRepository, CommodityRepository commodityRepository) {
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.commodityRepository = commodityRepository;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllAdjustments() {
        List<StockAdjustment> adjustments = stockAdjustmentRepository.findAllByOrderByCreatedAtDesc();
        Map<Long, String> commodityNames = new HashMap<>();
        for (Commodity c : commodityRepository.findAll()) {
            commodityNames.put(c.getId(), c.getName());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (StockAdjustment a : adjustments) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", a.getId());
            map.put("commodityId", a.getCommodityId());
            map.put("commodityName", commodityNames.getOrDefault(a.getCommodityId(), "Grain"));
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
    public ResponseEntity<?> createAdjustment(@RequestBody Map<String, Object> body) {
        try {
            Long commodityId = Long.valueOf(body.get("commodityId").toString());
            Double weightQuintals = Double.valueOf(body.get("weightQuintals").toString());

            if (weightQuintals <= 0) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Please enter valid commodity and weight"));
            }

            String type = (String) body.getOrDefault("type", "opening");
            int bags = body.get("bags") != null ? Integer.parseInt(body.get("bags").toString()) : 0;
            double rate = body.get("rate") != null ? Double.parseDouble(body.get("rate").toString()) : 0.0;
            String reason = (String) body.getOrDefault("reason", "Opening stock entry");
            String date = (String) body.getOrDefault("date", LocalDate.now().toString());

            StockAdjustment adj = new StockAdjustment();
            adj.setCommodityId(commodityId);
            adj.setType(type);
            adj.setBags(bags);
            adj.setWeightQuintals(weightQuintals);
            adj.setRate(rate);
            adj.setReason(reason);
            adj.setDate(date);
            adj.setCreatedAt(LocalDateTime.now());

            StockAdjustment saved = stockAdjustmentRepository.save(adj);
            return ResponseEntity.ok(Map.of("success", true, "adjustment", saved));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", "Failed to add stock adjustment: " + e.getMessage()));
        }
    }
}
