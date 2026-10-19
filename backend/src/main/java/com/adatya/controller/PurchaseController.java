package com.adatya.controller;

import com.adatya.domain.Money;
import com.adatya.dto.PurchaseRequests.AddPayment;
import com.adatya.dto.PurchaseRequests.CreatePurchase;
import com.adatya.model.*;
import com.adatya.repository.*;
import com.adatya.security.CurrentUser;
import com.adatya.service.PurchaseService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Purchases and their payments.
 *
 * The money rules now live in PurchaseService; this class only resolves the
 * tenant, delegates, and shapes the response. The request body no longer
 * carries line amounts or a bill total, because the server computes them.
 */
@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final PaymentRepository paymentRepository;
    private final FarmerRepository farmerRepository;
    private final CommodityRepository commodityRepository;
    private final BusinessProfileRepository profileRepository;
    private final PurchaseService purchaseService;
    private final CurrentUser currentUser;

    public PurchaseController(PurchaseRepository purchaseRepository,
                              PurchaseItemRepository purchaseItemRepository,
                              PaymentRepository paymentRepository,
                              FarmerRepository farmerRepository,
                              CommodityRepository commodityRepository,
                              BusinessProfileRepository profileRepository,
                              PurchaseService purchaseService,
                              CurrentUser currentUser) {
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.paymentRepository = paymentRepository;
        this.farmerRepository = farmerRepository;
        this.commodityRepository = commodityRepository;
        this.profileRepository = profileRepository;
        this.purchaseService = purchaseService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllPurchases() {
        Long userId = currentUser.id();
        List<Purchase> purchases = purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(userId);

        Map<Long, Farmer> farmers = new HashMap<>();
        for (Farmer f : farmerRepository.findAllByUserId(userId)) {
            farmers.put(f.getId(), f);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Purchase p : purchases) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", p.getId());
            map.put("purchaseNumber", p.getPurchaseNumber());
            map.put("date", p.getDate());
            map.put("farmerId", p.getFarmerId());
            map.put("totalAmount", p.getTotalAmount());
            map.put("advancePaid", p.getAdvancePaid());
            map.put("remainingAmount", p.getRemainingAmount());
            map.put("status", p.getStatus());
            map.put("createdAt", p.getCreatedAt());

            Farmer f = farmers.get(p.getFarmerId());
            map.put("farmerName", f != null ? f.getName() : "Unknown");
            map.put("farmerVillage", f != null && f.getVillage() != null ? f.getVillage() : "");
            map.put("farmerMobile", f != null && f.getMobile() != null ? f.getMobile() : "");
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Totals computed by the server, so every screen quotes the same figures
     * instead of each one summing the rows itself.
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        Long userId = currentUser.id();
        List<Purchase> purchases = purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(userId);

        var totalValue = purchases.stream().map(p -> Money.scaleMoney(p.getTotalAmount()))
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        var totalPaid = purchases.stream().map(p -> Money.scaleMoney(p.getAdvancePaid()))
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        var totalOutstanding = purchases.stream().map(p -> Money.scaleMoney(p.getRemainingAmount()))
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalPurchases", purchases.size());
        summary.put("totalValue", Money.scaleMoney(totalValue));
        summary.put("totalPaid", Money.scaleMoney(totalPaid));
        summary.put("totalOutstanding", Money.scaleMoney(totalOutstanding));
        return ResponseEntity.ok(summary);
    }

    @PostMapping
    public ResponseEntity<?> createPurchase(@Valid @RequestBody CreatePurchase request) {
        Purchase saved = purchaseService.createPurchase(currentUser.id(), request);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPurchaseById(@PathVariable Long id) {
        Long userId = currentUser.id();
        Optional<Purchase> found = purchaseRepository.findByIdAndUserId(id, userId);
        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Purchase not found"));
        }
        Purchase purchase = found.get();

        Map<Long, String> commodityNames = new HashMap<>();
        for (Commodity c : commodityRepository.findAllByUserId(userId)) {
            commodityNames.put(c.getId(), c.getName());
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (PurchaseItem item : purchaseItemRepository.findAllByPurchaseId(id)) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", item.getId());
            map.put("commodityId", item.getCommodityId());
            map.put("quantity", item.getQuantity());
            map.put("rate", item.getRate());
            map.put("amount", item.getAmount());
            map.put("commodityName", commodityNames.getOrDefault(item.getCommodityId(), "Grain"));
            items.add(map);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", purchase.getId());
        response.put("purchaseNumber", purchase.getPurchaseNumber());
        response.put("date", purchase.getDate());
        response.put("farmerId", purchase.getFarmerId());
        response.put("totalAmount", purchase.getTotalAmount());
        response.put("advancePaid", purchase.getAdvancePaid());
        response.put("remainingAmount", purchase.getRemainingAmount());
        response.put("status", purchase.getStatus());
        response.put("createdAt", purchase.getCreatedAt());
        response.put("items", items);
        response.put("farmer", farmerRepository.findByIdAndUserId(purchase.getFarmerId(), userId).orElse(null));
        response.put("payments", paymentRepository.findAllByPurchaseId(id));
        response.put("profile", profileRepository.findByUserIdAndArchivedFalse(userId).orElse(null));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/payments")
    public ResponseEntity<?> addPayment(@PathVariable Long id, @Valid @RequestBody AddPayment request) {
        try {
            return ResponseEntity.ok(purchaseService.addPayment(currentUser.id(), id, request));
        } catch (PurchaseService.PurchaseNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Purchase not found"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePurchase(@PathVariable Long id) {
        try {
            purchaseService.deletePurchase(currentUser.id(), id);
            return ResponseEntity.ok(Map.of("success", true, "message", "Purchase removed successfully"));
        } catch (PurchaseService.PurchaseNotFoundException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Purchase not found"));
        }
    }
}
