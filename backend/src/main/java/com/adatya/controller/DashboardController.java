package com.adatya.controller;

import com.adatya.config.UserContextHelper;
import com.adatya.model.Farmer;
import com.adatya.model.Purchase;
import com.adatya.repository.FarmerRepository;
import com.adatya.repository.PurchaseRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final PurchaseRepository purchaseRepository;
    private final FarmerRepository farmerRepository;
    private final UserContextHelper userContextHelper;

    public DashboardController(PurchaseRepository purchaseRepository,
                               FarmerRepository farmerRepository,
                               UserContextHelper userContextHelper) {
        this.purchaseRepository = purchaseRepository;
        this.farmerRepository = farmerRepository;
        this.userContextHelper = userContextHelper;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDashboardData(HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);

        List<Purchase> allPurchases = purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        long activeFarmers = farmerRepository.countByUserId(userId);

        int totalPurchases = allPurchases.size();
        double totalAmount = allPurchases.stream().mapToDouble(p -> p.getTotalAmount() != null ? p.getTotalAmount() : 0.0).sum();
        double pendingPayments = allPurchases.stream()
                .filter(p -> !"Paid".equalsIgnoreCase(p.getStatus()))
                .mapToDouble(p -> p.getRemainingAmount() != null ? p.getRemainingAmount() : 0.0)
                .sum();

        // Chart data
        Map<String, Double> dateMap = new TreeMap<>();
        for (Purchase p : allPurchases) {
            String d = (p.getDate() != null && p.getDate().length() >= 5) ? p.getDate().substring(5) : "Recent";
            dateMap.put(d, dateMap.getOrDefault(d, 0.0) + (p.getTotalAmount() != null ? p.getTotalAmount() : 0.0));
        }

        List<Map<String, Object>> chartData = new ArrayList<>();
        for (Map.Entry<String, Double> entry : dateMap.entrySet()) {
            chartData.add(Map.of("name", entry.getKey(), "value", entry.getValue()));
        }
        if (chartData.size() > 7) {
            chartData = chartData.subList(chartData.size() - 7, chartData.size());
        }
        if (chartData.isEmpty()) {
            chartData = List.of(
                Map.of("name", "Mon", "value", 0),
                Map.of("name", "Tue", "value", 0),
                Map.of("name", "Wed", "value", 0),
                Map.of("name", "Thu", "value", 0),
                Map.of("name", "Fri", "value", 0),
                Map.of("name", "Sat", "value", 0),
                Map.of("name", "Sun", "value", 0)
            );
        }

        // Recent purchases (top 6)
        Map<Long, Farmer> farmerMap = new HashMap<>();
        for (Farmer f : farmerRepository.findAllByUserId(userId)) {
            farmerMap.put(f.getId(), f);
        }

        List<Map<String, Object>> recentPurchases = new ArrayList<>();
        int limit = Math.min(6, allPurchases.size());
        for (int i = 0; i < limit; i++) {
            Purchase p = allPurchases.get(i);
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("purchaseNumber", p.getPurchaseNumber());
            map.put("date", p.getDate());
            map.put("totalAmount", p.getTotalAmount());
            map.put("advancePaid", p.getAdvancePaid());
            map.put("remainingAmount", p.getRemainingAmount());
            map.put("status", p.getStatus());

            Farmer f = farmerMap.get(p.getFarmerId());
            if (f != null) {
                map.put("farmerName", f.getName());
                map.put("farmerVillage", f.getVillage());
                map.put("farmerMobile", f.getMobile());
            } else {
                map.put("farmerName", "Unknown");
                map.put("farmerVillage", "");
                map.put("farmerMobile", "");
            }
            recentPurchases.add(map);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("totalPurchases", totalPurchases);
        response.put("totalAmount", totalAmount);
        response.put("activeFarmers", activeFarmers);
        response.put("pendingPayments", pendingPayments);
        response.put("recentPurchases", recentPurchases);
        response.put("chartData", chartData);

        return ResponseEntity.ok(response);
    }
}
