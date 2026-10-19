package com.adatya.controller;

import com.adatya.domain.Money;
import com.adatya.model.*;
import com.adatya.repository.*;
import com.adatya.security.CurrentUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Export and restore of one trader's own data.
 *
 * Previously both endpoints were anonymous and global. Export dumped every
 * business's farmers, mobile numbers, payments, GSTINs and signatures; import
 * called deleteAll() across eight tables and then inserted caller-supplied rows
 * using caller-supplied primary keys, which could overwrite another tenant's
 * records by id.
 *
 * Now: authentication is required, every read and write is scoped to the
 * signed-in trader, incoming rows are inserted as new records with their
 * foreign keys remapped (never written over an existing id), and a snapshot of
 * the current data is written to disk before a restore deletes anything.
 */
@RestController
@RequestMapping("/api/backup")
public class BackupController {

    private static final Logger log = LoggerFactory.getLogger(BackupController.class);
    private static final String CONFIRM_PHRASE = "RESTORE";

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final FarmerRepository farmerRepository;
    private final CommodityRepository commodityRepository;
    private final PaymentRepository paymentRepository;
    private final MandiSaleRepository mandiSaleRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final BusinessProfileRepository profileRepository;
    private final ObjectMapper objectMapper;
    private final CurrentUser currentUser;

    @Value("${backup.pre-restore-dir:${java.io.tmpdir}}")
    private String preRestoreDir;

    public BackupController(PurchaseRepository purchaseRepository,
                            PurchaseItemRepository purchaseItemRepository,
                            FarmerRepository farmerRepository,
                            CommodityRepository commodityRepository,
                            PaymentRepository paymentRepository,
                            MandiSaleRepository mandiSaleRepository,
                            StockAdjustmentRepository stockAdjustmentRepository,
                            BusinessProfileRepository profileRepository,
                            ObjectMapper objectMapper,
                            CurrentUser currentUser) {
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.farmerRepository = farmerRepository;
        this.commodityRepository = commodityRepository;
        this.paymentRepository = paymentRepository;
        this.mandiSaleRepository = mandiSaleRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.profileRepository = profileRepository;
        this.objectMapper = objectMapper;
        this.currentUser = currentUser;
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getBackupStats() {
        Long userId = currentUser.id();

        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("purchases", purchaseRepository.countByUserId(userId));
        counts.put("farmers", farmerRepository.countByUserId(userId));
        counts.put("mandiSales", mandiSaleRepository.countByUserId(userId));
        counts.put("commodities", commodityRepository.countByUserId(userId));
        counts.put("payments", paymentRepository.countByUserId(userId));
        counts.put("stockAdjustments", stockAdjustmentRepository.countByUserId(userId));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("integrityStatus", "ok (PostgreSQL)");
        response.put("counts", counts);
        response.put("timestamp", LocalDateTime.now().toString());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportBackup() throws IOException {
        Long userId = currentUser.id();

        byte[] jsonBytes = objectMapper.writerWithDefaultPrettyPrinter()
                .writeValueAsBytes(buildSnapshot(userId));

        String filename = String.format("adatya_backup_%s.json", LocalDate.now());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(jsonBytes);
    }

    /**
     * Replaces this trader's data with the contents of a backup file.
     *
     * Requires confirm = "RESTORE" in the request body so that a stray or
     * replayed request cannot wipe live records.
     */
    @PostMapping("/import")
    @Transactional
    public ResponseEntity<Map<String, Object>> importBackup(@RequestBody Map<String, Object> payload)
            throws IOException {

        Long userId = currentUser.id();

        if (!CONFIRM_PHRASE.equals(String.valueOf(payload.get("confirm")))) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "This will replace your current records. Send confirm=\"" + CONFIRM_PHRASE
                         + "\" to proceed."
            ));
        }

        Object rawTables = payload.get("tables");
        if (!(rawTables instanceof Map)) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Invalid backup file: the expected \"tables\" section is missing."
            ));
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> tables = (Map<String, Object>) rawTables;

        // Safety net: keep a copy of what is about to be replaced. If this
        // cannot be written, the restore is abandoned rather than risked.
        Path snapshotPath = writePreRestoreSnapshot(userId);

        // Remove only this trader's rows.
        paymentRepository.deleteAllByUserId(userId);
        purchaseItemRepository.deleteAllByUserId(userId);
        purchaseRepository.deleteAllByUserId(userId);
        mandiSaleRepository.deleteAllByUserId(userId);
        stockAdjustmentRepository.deleteAllByUserId(userId);
        farmerRepository.deleteAllByUserId(userId);
        commodityRepository.deleteAllByUserId(userId);

        // Old id -> newly inserted id. Incoming primary keys are never trusted,
        // so references inside the file are translated as rows are created.
        Map<Long, Long> commodityIds = new HashMap<>();
        Map<Long, Long> farmerIds = new HashMap<>();
        Map<Long, Long> purchaseIds = new HashMap<>();

        Map<String, Integer> restored = new LinkedHashMap<>();

        for (Map<String, Object> row : rows(tables, "commodities")) {
            Long oldId = readId(row.get("id"));
            Commodity entity = objectMapper.convertValue(row, Commodity.class);
            entity.setId(null);
            entity.setUserId(userId);
            if (entity.getName() == null || entity.getName().isBlank()) continue;
            if (entity.getDefaultRate() == null) entity.setDefaultRate(Money.ZERO_MONEY);
            Commodity saved = commodityRepository.save(entity);
            if (oldId != null) commodityIds.put(oldId, saved.getId());
        }
        restored.put("commodities", commodityIds.size());

        for (Map<String, Object> row : rows(tables, "farmers")) {
            Long oldId = readId(row.get("id"));
            Farmer entity = objectMapper.convertValue(row, Farmer.class);
            entity.setId(null);
            entity.setUserId(userId);
            if (entity.getName() == null || entity.getName().isBlank()) continue;
            if (entity.getOutstandingBalance() == null) entity.setOutstandingBalance(Money.ZERO_MONEY);
            Farmer saved = farmerRepository.save(entity);
            if (oldId != null) farmerIds.put(oldId, saved.getId());
        }
        restored.put("farmers", farmerIds.size());

        for (Map<String, Object> row : rows(tables, "purchases")) {
            Long oldId = readId(row.get("id"));
            Purchase entity = objectMapper.convertValue(row, Purchase.class);
            entity.setId(null);
            entity.setUserId(userId);
            Long mappedFarmer = farmerIds.get(readId(row.get("farmerId")));
            if (mappedFarmer == null) continue;
            entity.setFarmerId(mappedFarmer);
            Purchase saved = purchaseRepository.save(entity);
            if (oldId != null) purchaseIds.put(oldId, saved.getId());
        }
        restored.put("purchases", purchaseIds.size());

        int itemCount = 0;
        for (Map<String, Object> row : rows(tables, "purchaseItems")) {
            PurchaseItem entity = objectMapper.convertValue(row, PurchaseItem.class);
            entity.setId(null);
            entity.setUserId(userId);
            Long mappedPurchase = purchaseIds.get(readId(row.get("purchaseId")));
            Long mappedCommodity = commodityIds.get(readId(row.get("commodityId")));
            if (mappedPurchase == null || mappedCommodity == null) continue;
            entity.setPurchaseId(mappedPurchase);
            entity.setCommodityId(mappedCommodity);
            purchaseItemRepository.save(entity);
            itemCount++;
        }
        restored.put("purchaseItems", itemCount);

        int paymentCount = 0;
        for (Map<String, Object> row : rows(tables, "payments")) {
            Payment entity = objectMapper.convertValue(row, Payment.class);
            entity.setId(null);
            entity.setUserId(userId);
            Long mappedPurchase = purchaseIds.get(readId(row.get("purchaseId")));
            if (mappedPurchase == null) continue;
            entity.setPurchaseId(mappedPurchase);
            paymentRepository.save(entity);
            paymentCount++;
        }
        restored.put("payments", paymentCount);

        int saleCount = 0;
        for (Map<String, Object> row : rows(tables, "mandiSales")) {
            MandiSale entity = objectMapper.convertValue(row, MandiSale.class);
            entity.setId(null);
            entity.setUserId(userId);
            Long mappedCommodity = commodityIds.get(readId(row.get("commodityId")));
            if (mappedCommodity == null) continue;
            entity.setCommodityId(mappedCommodity);
            mandiSaleRepository.save(entity);
            saleCount++;
        }
        restored.put("mandiSales", saleCount);

        int adjustmentCount = 0;
        for (Map<String, Object> row : rows(tables, "stockAdjustments")) {
            StockAdjustment entity = objectMapper.convertValue(row, StockAdjustment.class);
            entity.setId(null);
            entity.setUserId(userId);
            Long mappedCommodity = commodityIds.get(readId(row.get("commodityId")));
            if (mappedCommodity == null) continue;
            entity.setCommodityId(mappedCommodity);
            stockAdjustmentRepository.save(entity);
            adjustmentCount++;
        }
        restored.put("stockAdjustments", adjustmentCount);

        // The profile row is updated in place so this trader keeps exactly one.
        List<Map<String, Object>> profileRows = rows(tables, "businessProfile");
        if (!profileRows.isEmpty()) {
            BusinessProfile incoming = objectMapper.convertValue(profileRows.get(0), BusinessProfile.class);
            BusinessProfile existing = profileRepository.findByUserIdAndArchivedFalse(userId).orElseGet(BusinessProfile::new);
            existing.setUserId(userId);
            if (incoming.getBusinessName() != null) existing.setBusinessName(incoming.getBusinessName());
            if (incoming.getProprietorName() != null) existing.setProprietorName(incoming.getProprietorName());
            if (incoming.getAddress() != null) existing.setAddress(incoming.getAddress());
            if (incoming.getMobile1() != null) existing.setMobile1(incoming.getMobile1());
            if (incoming.getMobile2() != null) existing.setMobile2(incoming.getMobile2());
            if (incoming.getMandiLicense() != null) existing.setMandiLicense(incoming.getMandiLicense());
            if (incoming.getGstin() != null) existing.setGstin(incoming.getGstin());
            if (incoming.getUpiId() != null) existing.setUpiId(incoming.getUpiId());
            if (incoming.getSignatureData() != null) existing.setSignatureData(incoming.getSignatureData());
            if (incoming.getSignatureType() != null) existing.setSignatureType(incoming.getSignatureType());
            if (incoming.getSignatureName() != null) existing.setSignatureName(incoming.getSignatureName());
            if (incoming.getTagline() != null) existing.setTagline(incoming.getTagline());
            existing.setUpdatedAt(LocalDateTime.now());
            profileRepository.save(existing);
        }

        log.info("Restore completed for account {} ({}). Pre-restore snapshot: {}",
                userId, restored, snapshotPath);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Your records were restored from the backup file.",
            "restored", restored
        ));
    }

    /** Builds the export document for one tenant. */
    private Map<String, Object> buildSnapshot(Long userId) {
        Map<String, Object> tables = new LinkedHashMap<>();
        tables.put("businessProfile", profileRepository.findAllByUserIdAndArchivedFalse(userId));
        tables.put("commodities", commodityRepository.findAllByUserId(userId));
        tables.put("farmers", farmerRepository.findAllByUserId(userId));
        tables.put("purchases", purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(userId));
        tables.put("purchaseItems", purchaseItemRepository.findAllByUserId(userId));
        tables.put("payments", paymentRepository.findAllByUserId(userId));
        tables.put("mandiSales", mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId));
        tables.put("stockAdjustments", stockAdjustmentRepository.findAllByUserId(userId));

        // The users table is no longer exported. It previously included every
        // registered business and their mobile numbers.
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("app", "Adatya");
        snapshot.put("version", "2.0.0");
        snapshot.put("exportedAt", LocalDateTime.now().toString());
        snapshot.put("accountId", userId);
        snapshot.put("tables", tables);
        return snapshot;
    }

    /**
     * Writes the pre-restore safety copy. Any failure propagates so that the
     * surrounding transaction rolls back and nothing is deleted.
     */
    private Path writePreRestoreSnapshot(Long userId) throws IOException {
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss").format(LocalDateTime.now());
        Path directory = Paths.get(preRestoreDir);
        Files.createDirectories(directory);
        Path target = directory.resolve(String.format("adatya_pre_restore_%d_%s.json", userId, stamp));
        Files.write(target, objectMapper.writerWithDefaultPrettyPrinter()
                .writeValueAsBytes(buildSnapshot(userId)));
        return target;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rows(Map<String, Object> tables, String key) {
        Object value = tables.get(key);
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map) {
                result.add((Map<String, Object>) item);
            }
        }
        return result;
    }

    private Long readId(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Long.valueOf(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
