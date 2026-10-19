package com.adatya.controller;

import com.adatya.model.*;
import com.adatya.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final BusinessProfileRepository profileRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final FarmerRepository farmerRepository;
    private final CommodityRepository commodityRepository;
    private final PaymentRepository paymentRepository;
    private final MandiSaleRepository mandiSaleRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;

    public AdminController(UserRepository userRepository,
                           BusinessProfileRepository profileRepository,
                           PurchaseRepository purchaseRepository,
                           PurchaseItemRepository purchaseItemRepository,
                           FarmerRepository farmerRepository,
                           CommodityRepository commodityRepository,
                           PaymentRepository paymentRepository,
                           MandiSaleRepository mandiSaleRepository,
                           StockAdjustmentRepository stockAdjustmentRepository) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.farmerRepository = farmerRepository;
        this.commodityRepository = commodityRepository;
        this.paymentRepository = paymentRepository;
        this.mandiSaleRepository = mandiSaleRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
    }

    /**
     * Platform-wide aggregated metrics for the Super Admin
     */
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getPlatformOverview() {
        long totalBusinesses = userRepository.count();
        long totalFarmers = farmerRepository.count();
        long totalPurchases = purchaseRepository.count();
        long totalSales = mandiSaleRepository.count();

        List<Purchase> allPurchases = purchaseRepository.findAll();
        double totalProcurementValue = allPurchases.stream()
                .mapToDouble(p -> p.getTotalAmount() != null ? p.getTotalAmount() : 0.0)
                .sum();
        double totalAdvancePaid = allPurchases.stream()
                .mapToDouble(p -> p.getAdvancePaid() != null ? p.getAdvancePaid() : 0.0)
                .sum();
        double totalRemainingDue = allPurchases.stream()
                .mapToDouble(p -> p.getRemainingAmount() != null ? p.getRemainingAmount() : 0.0)
                .sum();

        List<MandiSale> allSalesList = mandiSaleRepository.findAll();
        double totalSalesRevenue = allSalesList.stream()
                .mapToDouble(s -> s.getNetAmount() != null ? s.getNetAmount() : 0.0)
                .sum();

        List<PurchaseItem> allItems = purchaseItemRepository.findAll();
        double totalPurchasedQuintals = allItems.stream()
                .mapToDouble(i -> i.getQuantity() != null ? i.getQuantity() : 0.0)
                .sum();

        Map<String, Object> overview = new HashMap<>();
        overview.put("totalBusinesses", totalBusinesses);
        overview.put("totalFarmers", totalFarmers);
        overview.put("totalPurchases", totalPurchases);
        overview.put("totalProcurementValue", totalProcurementValue);
        overview.put("totalAdvancePaid", totalAdvancePaid);
        overview.put("totalRemainingDue", totalRemainingDue);
        overview.put("totalMandiSales", totalSales);
        overview.put("totalSalesRevenue", totalSalesRevenue);
        overview.put("totalPurchasedQuintals", totalPurchasedQuintals);
        overview.put("commoditiesCount", commodityRepository.count());

        return ResponseEntity.ok(overview);
    }

    /**
     * List all registered businesses & accounts with operational summary metrics
     */
    @GetMapping("/businesses")
    public ResponseEntity<List<Map<String, Object>>> getAllBusinesses() {
        List<User> users = userRepository.findAll();
        List<Purchase> allPurchases = purchaseRepository.findAll();
        long totalFarmers = farmerRepository.count();
        long totalSales = mandiSaleRepository.count();

        List<Map<String, Object>> result = new ArrayList<>();
        for (User u : users) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("name", u.getName());
            map.put("businessName", u.getBusinessName() != null ? u.getBusinessName() : u.getName() + " Traders");
            map.put("apmcLocation", u.getApmcLocation() != null ? u.getApmcLocation() : "APMC Yard");
            map.put("mobile", u.getMobile());
            map.put("role", u.getRole());
            map.put("createdAt", u.getCreatedAt());

            // Activity metrics for this business
            map.put("totalPurchases", allPurchases.size());
            double totalVolume = allPurchases.stream().mapToDouble(p -> p.getTotalAmount() != null ? p.getTotalAmount() : 0.0).sum();
            map.put("totalProcurementAmount", totalVolume);
            map.put("totalFarmers", totalFarmers);
            map.put("totalMandiSales", totalSales);
            map.put("isSuperAdmin", "9356893989".equals(u.getMobile()) || "SUPER_ADMIN".equalsIgnoreCase(u.getRole()));

            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Get complete business data breakdown (Purchases, Farmers, Sales, Inventory, Ledger)
     */
    @GetMapping("/businesses/{id}/data")
    public ResponseEntity<Map<String, Object>> getCompleteBusinessData(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User user = userOpt.get();

        Map<String, Object> data = new HashMap<>();
        data.put("business", user);
        data.put("purchases", purchaseRepository.findAllByOrderByCreatedAtDesc());
        data.put("purchaseItems", purchaseItemRepository.findAll());
        data.put("farmers", farmerRepository.findAll());
        data.put("commodities", commodityRepository.findAll());
        data.put("payments", paymentRepository.findAll());
        data.put("mandiSales", mandiSaleRepository.findAll());
        data.put("stockAdjustments", stockAdjustmentRepository.findAll());
        data.put("profile", profileRepository.findAll().stream().findFirst().orElse(null));

        return ResponseEntity.ok(data);
    }

    /**
     * Super Admin delete/remove a registered user/business account
     */
    @DeleteMapping("/businesses/{id}")
    public ResponseEntity<Map<String, Object>> deleteBusiness(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User user = userOpt.get();
        if ("9356893989".equals(user.getMobile())) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Cannot delete the master Super Admin profile."
            ));
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Business account removed successfully."
        ));
    }
}
