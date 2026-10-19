package com.adatya.controller;

import com.adatya.dto.TradeRequests.CreateSale;
import com.adatya.model.Commodity;
import com.adatya.model.MandiSale;
import com.adatya.repository.CommodityRepository;
import com.adatya.repository.MandiSaleRepository;
import com.adatya.security.CurrentUser;
import com.adatya.service.MandiSaleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/mandi-sales")
public class MandiSaleController {

    private final MandiSaleRepository mandiSaleRepository;
    private final CommodityRepository commodityRepository;
    private final MandiSaleService mandiSaleService;
    private final CurrentUser currentUser;

    public MandiSaleController(MandiSaleRepository mandiSaleRepository,
                               CommodityRepository commodityRepository,
                               MandiSaleService mandiSaleService,
                               CurrentUser currentUser) {
        this.mandiSaleRepository = mandiSaleRepository;
        this.commodityRepository = commodityRepository;
        this.mandiSaleService = mandiSaleService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllSales() {
        Long userId = currentUser.id();
        List<MandiSale> sales = mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId);

        Map<Long, String> names = new HashMap<>();
        for (Commodity c : commodityRepository.findAllByUserId(userId)) {
            names.put(c.getId(), c.getName());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (MandiSale s : sales) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", s.getId());
            map.put("saleNumber", s.getSaleNumber());
            map.put("date", s.getDate());
            map.put("commodityId", s.getCommodityId());
            map.put("commodityName", names.getOrDefault(s.getCommodityId(), "Grain"));
            map.put("buyerName", s.getBuyerName());
            map.put("buyerMobile", s.getBuyerMobile());
            map.put("buyerLocation", s.getBuyerLocation());
            map.put("vehicleNumber", s.getVehicleNumber());
            map.put("bags", s.getBags());
            map.put("weightQuintals", s.getWeightQuintals());
            map.put("saleRate", s.getSaleRate());
            map.put("subtotal", s.getSubtotal());
            map.put("hamali", s.getHamali());
            map.put("transport", s.getTransport());
            map.put("mandiCess", s.getMandiCess());
            map.put("netAmount", s.getNetAmount());
            map.put("paymentStatus", s.getPaymentStatus());
            map.put("paymentMode", s.getPaymentMode());
            map.put("notes", s.getNotes());
            map.put("createdAt", s.getCreatedAt());
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createSale(@Valid @RequestBody CreateSale request) {
        MandiSale saved = mandiSaleService.createSale(currentUser.id(), request);
        return ResponseEntity.ok(Map.of("success", true, "sale", saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSale(@PathVariable Long id) {
        try {
            mandiSaleService.deleteSale(currentUser.id(), id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Mandi sale removed and the quantity returned to stock."));
        } catch (MandiSaleService.SaleNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("success", false, "error", "Sale not found"));
        }
    }
}
