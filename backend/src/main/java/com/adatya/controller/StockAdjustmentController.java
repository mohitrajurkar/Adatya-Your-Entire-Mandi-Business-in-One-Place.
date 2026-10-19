package com.adatya.controller;

import com.adatya.model.Commodity;
import com.adatya.model.StockAdjustment;
import com.adatya.repository.CommodityRepository;
import com.adatya.repository.StockAdjustmentRepository;
import com.adatya.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Stock adjustments (opening stock, inward, outward, wastage).
 *
 * This controller previously had no tenant scoping: it listed every adjustment
 * in the database and saved new ones with a null user_id. Because
 * InventoryController filters adjustments by user_id, every adjustment created
 * here was invisible to the stock calculation, so opening stock silently never
 * appeared in inventory figures. Scoping both sides fixes the leak and the
 * missing-stock bug together.
 */
@RestController
@RequestMapping("/api/stock-adjustments")
public class StockAdjustmentController {

    private static final Set<String> VALID_TYPES = Set.of("opening", "inward", "outward", "adjustment");

    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final CommodityRepository commodityRepository;
    private final CurrentUser currentUser;

    public StockAdjustmentController(StockAdjustmentRepository stockAdjustmentRepository,
                                     CommodityRepository commodityRepository,
                                     CurrentUser currentUser) {
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.commodityRepository = commodityRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllAdjustments() {
        Long userId = currentUser.id();

        List<StockAdjustment> adjustments =
                stockAdjustmentRepository.findAllByUserIdOrderByCreatedAtDesc(userId);

        Map<Long, String> commodityNames = new HashMap<>();
        for (Commodity c : commodityRepository.findAllByUserId(userId)) {
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
    @Transactional
    public ResponseEntity<?> createAdjustment(@RequestBody Map<String, Object> body) {
        Long userId = currentUser.id();

        Long commodityId = parseId(body.get("commodityId"));
        if (commodityId == null) {
            throw new IllegalArgumentException("Please select a commodity");
        }

        // The commodity must belong to the signed-in trader, otherwise an
        // adjustment could be attached to another business's commodity.
        Commodity commodity = commodityRepository.findById(commodityId)
                .filter(c -> Objects.equals(c.getUserId(), userId))
                .orElseThrow(() -> new IllegalArgumentException("Commodity not found"));

        Double weightQuintals = parseAmount(body.get("weightQuintals"));
        if (weightQuintals == null || weightQuintals <= 0) {
            throw new IllegalArgumentException("Weight must be greater than zero");
        }

        String type = String.valueOf(body.getOrDefault("type", "opening")).trim().toLowerCase();
        if (!VALID_TYPES.contains(type)) {
            throw new IllegalArgumentException("Adjustment type must be one of: opening, inward, outward, adjustment");
        }

        int bags = 0;
        Double parsedBags = parseAmount(body.get("bags"));
        if (parsedBags != null) {
            if (parsedBags < 0) {
                throw new IllegalArgumentException("Bags cannot be negative");
            }
            bags = parsedBags.intValue();
        }

        double rate = 0.0;
        Double parsedRate = parseAmount(body.get("rate"));
        if (parsedRate != null) {
            if (parsedRate < 0) {
                throw new IllegalArgumentException("Rate cannot be negative");
            }
            rate = parsedRate;
        }

        String reason = String.valueOf(body.getOrDefault("reason", "Opening stock entry")).trim();
        if (reason.isEmpty()) {
            reason = "Stock adjustment";
        }

        String date = String.valueOf(body.getOrDefault("date", LocalDate.now().toString())).trim();

        StockAdjustment adj = new StockAdjustment();
        adj.setUserId(userId);
        adj.setCommodityId(commodity.getId());
        adj.setType(type);
        adj.setBags(bags);
        adj.setWeightQuintals(weightQuintals);
        adj.setRate(rate);
        adj.setReason(reason);
        adj.setDate(date);
        adj.setCreatedAt(LocalDateTime.now());

        StockAdjustment saved = stockAdjustmentRepository.save(adj);
        return ResponseEntity.ok(Map.of("success", true, "adjustment", saved));
    }

    private Long parseId(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Long.valueOf(raw.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Double parseAmount(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Double.valueOf(raw.toString().trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Please enter a valid number");
        }
    }
}
