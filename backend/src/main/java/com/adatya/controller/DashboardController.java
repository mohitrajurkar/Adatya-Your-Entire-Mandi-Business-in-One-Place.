package com.adatya.controller;

import com.adatya.domain.Money;
import com.adatya.model.Farmer;
import com.adatya.model.Purchase;
import com.adatya.repository.FarmerRepository;
import com.adatya.repository.PurchaseRepository;
import com.adatya.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final PurchaseRepository purchaseRepository;
    private final FarmerRepository farmerRepository;
    private final CurrentUser currentUser;

    public DashboardController(PurchaseRepository purchaseRepository,
                               FarmerRepository farmerRepository,
                               CurrentUser currentUser) {
        this.purchaseRepository = purchaseRepository;
        this.farmerRepository = farmerRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDashboardData() {
        Long userId = currentUser.id();
        List<Purchase> purchases = purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(userId);

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;
        BigDecimal pendingPayments = BigDecimal.ZERO;

        for (Purchase p : purchases) {
            totalAmount = totalAmount.add(Money.scaleMoney(p.getTotalAmount()));
            totalPaid = totalPaid.add(Money.scaleMoney(p.getAdvancePaid()));
            // Summed over every bill, so this agrees with the purchases screen.
            pendingPayments = pendingPayments.add(Money.scaleMoney(p.getRemainingAmount()));
        }

        // Value by date, for the trend chart.
        Map<String, BigDecimal> byDate = new TreeMap<>();
        for (Purchase p : purchases) {
            String key = (p.getDate() != null && p.getDate().length() >= 5)
                    ? p.getDate().substring(5) : "Recent";
            byDate.merge(key, Money.scaleMoney(p.getTotalAmount()), BigDecimal::add);
        }

        List<Map<String, Object>> chartData = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : byDate.entrySet()) {
            chartData.add(Map.of("name", entry.getKey(), "value", entry.getValue()));
        }
        if (chartData.size() > 7) {
            chartData = new ArrayList<>(chartData.subList(chartData.size() - 7, chartData.size()));
        }
        if (chartData.isEmpty()) {
            for (String day : List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")) {
                chartData.add(Map.of("name", day, "value", BigDecimal.ZERO));
            }
        }

        Map<Long, Farmer> farmers = new HashMap<>();
        for (Farmer f : farmerRepository.findAllByUserId(userId)) {
            farmers.put(f.getId(), f);
        }

        List<Map<String, Object>> recent = new ArrayList<>();
        for (Purchase p : purchases.subList(0, Math.min(6, purchases.size()))) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", p.getId());
            map.put("purchaseNumber", p.getPurchaseNumber());
            map.put("date", p.getDate());
            map.put("totalAmount", p.getTotalAmount());
            map.put("advancePaid", p.getAdvancePaid());
            map.put("remainingAmount", p.getRemainingAmount());
            map.put("status", p.getStatus());

            Farmer f = farmers.get(p.getFarmerId());
            map.put("farmerName", f != null ? f.getName() : "Unknown");
            map.put("farmerVillage", f != null && f.getVillage() != null ? f.getVillage() : "");
            map.put("farmerMobile", f != null && f.getMobile() != null ? f.getMobile() : "");
            recent.add(map);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalPurchases", purchases.size());
        response.put("totalAmount", Money.scaleMoney(totalAmount));
        response.put("totalPaid", Money.scaleMoney(totalPaid));
        response.put("activeFarmers", farmerRepository.countByUserId(userId));
        response.put("pendingPayments", Money.scaleMoney(pendingPayments));
        response.put("recentPurchases", recent);
        response.put("chartData", chartData);
        return ResponseEntity.ok(response);
    }
}
