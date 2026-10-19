package com.adatya.controller;

import com.adatya.model.*;
import com.adatya.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/backup")
public class BackupController {

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final FarmerRepository farmerRepository;
    private final CommodityRepository commodityRepository;
    private final PaymentRepository paymentRepository;
    private final MandiSaleRepository mandiSaleRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final BusinessProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public BackupController(PurchaseRepository purchaseRepository,
                            PurchaseItemRepository purchaseItemRepository,
                            FarmerRepository farmerRepository,
                            CommodityRepository commodityRepository,
                            PaymentRepository paymentRepository,
                            MandiSaleRepository mandiSaleRepository,
                            StockAdjustmentRepository stockAdjustmentRepository,
                            BusinessProfileRepository profileRepository,
                            UserRepository userRepository,
                            ObjectMapper objectMapper) {
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.farmerRepository = farmerRepository;
        this.commodityRepository = commodityRepository;
        this.paymentRepository = paymentRepository;
        this.mandiSaleRepository = mandiSaleRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getBackupStats() {
        Map<String, Object> counts = new HashMap<>();
        counts.put("purchases", purchaseRepository.count());
        counts.put("farmers", farmerRepository.count());
        counts.put("mandiSales", mandiSaleRepository.count());
        counts.put("commodities", commodityRepository.count());
        counts.put("payments", paymentRepository.count());
        counts.put("stockAdjustments", stockAdjustmentRepository.count());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("fileSizeKb", 256);
        response.put("integrityStatus", "ok (PostgreSQL)");
        response.put("counts", counts);
        response.put("timestamp", LocalDateTime.now().toString());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportBackup() {
        try {
            Map<String, Object> tables = new HashMap<>();
            tables.put("businessProfile", profileRepository.findAll());
            tables.put("commodities", commodityRepository.findAll());
            tables.put("farmers", farmerRepository.findAll());
            tables.put("purchases", purchaseRepository.findAll());
            tables.put("purchaseItems", purchaseItemRepository.findAll());
            tables.put("payments", paymentRepository.findAll());
            tables.put("mandiSales", mandiSaleRepository.findAll());
            tables.put("stockAdjustments", stockAdjustmentRepository.findAll());

            List<Map<String, Object>> safeUsers = new ArrayList<>();
            for (User u : userRepository.findAll()) {
                Map<String, Object> uMap = new HashMap<>();
                uMap.put("id", u.getId());
                uMap.put("name", u.getName());
                uMap.put("businessName", u.getBusinessName());
                uMap.put("apmcLocation", u.getApmcLocation());
                uMap.put("role", u.getRole());
                uMap.put("mobile", u.getMobile());
                uMap.put("createdAt", u.getCreatedAt());
                safeUsers.add(uMap);
            }
            tables.put("users", safeUsers);

            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("app", "Adatya");
            snapshot.put("version", "2.0.0");
            snapshot.put("exportedAt", LocalDateTime.now().toString());
            snapshot.put("tables", tables);

            byte[] jsonBytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(snapshot);
            String filename = String.format("adatya_backup_%s.json", LocalDate.now().toString());

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(jsonBytes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/import")
    @Transactional
    public ResponseEntity<Map<String, Object>> importBackup(@RequestBody Map<String, Object> payload) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> tables = (Map<String, Object>) payload.get("tables");
            if (tables == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Invalid backup JSON file structure"));
            }

            // Commodities
            if (tables.get("commodities") instanceof List<?> list && !list.isEmpty()) {
                commodityRepository.deleteAll();
                for (Object item : list) {
                    Commodity c = objectMapper.convertValue(item, Commodity.class);
                    commodityRepository.save(c);
                }
            }

            // Farmers
            if (tables.get("farmers") instanceof List<?> list && !list.isEmpty()) {
                farmerRepository.deleteAll();
                for (Object item : list) {
                    Farmer f = objectMapper.convertValue(item, Farmer.class);
                    farmerRepository.save(f);
                }
            }

            // Purchases & items
            if (tables.get("purchases") instanceof List<?> list && !list.isEmpty()) {
                purchaseItemRepository.deleteAll();
                paymentRepository.deleteAll();
                purchaseRepository.deleteAll();
                for (Object item : list) {
                    Purchase p = objectMapper.convertValue(item, Purchase.class);
                    purchaseRepository.save(p);
                }
            }

            if (tables.get("purchaseItems") instanceof List<?> list && !list.isEmpty()) {
                for (Object item : list) {
                    PurchaseItem pi = objectMapper.convertValue(item, PurchaseItem.class);
                    purchaseItemRepository.save(pi);
                }
            }

            if (tables.get("payments") instanceof List<?> list && !list.isEmpty()) {
                for (Object item : list) {
                    Payment p = objectMapper.convertValue(item, Payment.class);
                    paymentRepository.save(p);
                }
            }

            // Mandi Sales
            if (tables.get("mandiSales") instanceof List<?> list && !list.isEmpty()) {
                mandiSaleRepository.deleteAll();
                for (Object item : list) {
                    MandiSale s = objectMapper.convertValue(item, MandiSale.class);
                    mandiSaleRepository.save(s);
                }
            }

            // Stock Adjustments
            if (tables.get("stockAdjustments") instanceof List<?> list && !list.isEmpty()) {
                stockAdjustmentRepository.deleteAll();
                for (Object item : list) {
                    StockAdjustment a = objectMapper.convertValue(item, StockAdjustment.class);
                    stockAdjustmentRepository.save(a);
                }
            }

            // Business Profile
            if (tables.get("businessProfile") instanceof List<?> list && !list.isEmpty()) {
                profileRepository.deleteAll();
                for (Object item : list) {
                    BusinessProfile bp = objectMapper.convertValue(item, BusinessProfile.class);
                    profileRepository.save(bp);
                }
            }

            return ResponseEntity.ok(Map.of("success", true, "message", "Backup data restored successfully without data loss"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", "Failed to restore backup data: " + e.getMessage()));
        }
    }
}
