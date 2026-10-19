package com.adatya.controller;

import com.adatya.config.UserContextHelper;
import com.adatya.model.*;
import com.adatya.repository.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final PaymentRepository paymentRepository;
    private final FarmerRepository farmerRepository;
    private final CommodityRepository commodityRepository;
    private final BusinessProfileRepository profileRepository;
    private final UserContextHelper userContextHelper;

    public PurchaseController(PurchaseRepository purchaseRepository,
                              PurchaseItemRepository purchaseItemRepository,
                              PaymentRepository paymentRepository,
                              FarmerRepository farmerRepository,
                              CommodityRepository commodityRepository,
                              BusinessProfileRepository profileRepository,
                              UserContextHelper userContextHelper) {
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.paymentRepository = paymentRepository;
        this.farmerRepository = farmerRepository;
        this.commodityRepository = commodityRepository;
        this.profileRepository = profileRepository;
        this.userContextHelper = userContextHelper;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllPurchases(HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        List<Purchase> purchases = purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        
        Map<Long, Farmer> farmerMap = new HashMap<>();
        for (Farmer f : farmerRepository.findAllByUserId(userId)) {
            farmerMap.put(f.getId(), f);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Purchase p : purchases) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("purchaseNumber", p.getPurchaseNumber());
            map.put("date", p.getDate());
            map.put("farmerId", p.getFarmerId());
            map.put("totalAmount", p.getTotalAmount());
            map.put("advancePaid", p.getAdvancePaid());
            map.put("remainingAmount", p.getRemainingAmount());
            map.put("status", p.getStatus());
            map.put("createdAt", p.getCreatedAt());

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
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createPurchase(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        try {
            Long userId = userContextHelper.resolveUserId(request);
            Long farmerId = Long.valueOf(body.get("farmerId").toString());
            String date = (String) body.get("date");
            String purchaseNumber = (String) body.get("purchaseNumber");
            Double totalAmount = Double.valueOf(body.get("totalAmount").toString());
            Double advancePaid = Double.valueOf(body.getOrDefault("advancePaid", 0.0).toString());
            String paymentMode = (String) body.getOrDefault("paymentMode", "Cash");

            Double remainingAmount = totalAmount - advancePaid;
            String status = remainingAmount <= 0.001 ? "Paid" : (Math.abs(remainingAmount - totalAmount) < 0.001 ? "Pending" : "Partial");

            Purchase purchase = new Purchase();
            purchase.setUserId(userId);
            purchase.setFarmerId(farmerId);
            purchase.setDate(date);
            purchase.setPurchaseNumber(purchaseNumber);
            purchase.setTotalAmount(totalAmount);
            purchase.setAdvancePaid(advancePaid);
            purchase.setRemainingAmount(remainingAmount);
            purchase.setStatus(status);
            purchase.setCreatedAt(LocalDateTime.now());

            Purchase savedPurchase = purchaseRepository.save(purchase);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
            if (items != null) {
                for (Map<String, Object> itemData : items) {
                    Object commIdObj = itemData.get("commodityId");
                    String customName = (String) itemData.get("customCommodityName");
                    Double quantity = Double.valueOf(itemData.get("quantity").toString());
                    Double rate = Double.valueOf(itemData.get("rate").toString());
                    Double amount = Double.valueOf(itemData.get("amount").toString());

                    Long finalCommodityId = null;
                    if (commIdObj != null && !"other".equals(commIdObj.toString())) {
                        try {
                            finalCommodityId = Long.valueOf(commIdObj.toString());
                        } catch (NumberFormatException ignored) {}
                    }

                    if (finalCommodityId == null || customName != null) {
                        String nameToSearch = (customName != null && !customName.trim().isEmpty()) ? customName.trim() : "Other Grain";
                        Optional<Commodity> existingCom = commodityRepository.findByNameAndUserId(nameToSearch, userId);
                        if (existingCom.isPresent()) {
                            finalCommodityId = existingCom.get().getId();
                        } else {
                            Commodity newCom = new Commodity(userId, nameToSearch, rate);
                            Commodity savedCom = commodityRepository.save(newCom);
                            finalCommodityId = savedCom.getId();
                        }
                    }

                    PurchaseItem pItem = new PurchaseItem();
                    pItem.setUserId(userId);
                    pItem.setPurchaseId(savedPurchase.getId());
                    pItem.setCommodityId(finalCommodityId);
                    pItem.setQuantity(quantity);
                    pItem.setRate(rate);
                    pItem.setAmount(amount);
                    purchaseItemRepository.save(pItem);
                }
            }

            // Update farmer balance
            farmerRepository.findByIdAndUserId(farmerId, userId).ifPresent(farmer -> {
                double currentBal = farmer.getOutstandingBalance() != null ? farmer.getOutstandingBalance() : 0.0;
                farmer.setOutstandingBalance(currentBal + remainingAmount);
                farmerRepository.save(farmer);
            });

            // If advance was paid, record payment
            if (advancePaid > 0) {
                Payment payment = new Payment();
                payment.setUserId(userId);
                payment.setPurchaseId(savedPurchase.getId());
                payment.setAmount(advancePaid);
                payment.setPaymentMode(paymentMode != null ? paymentMode : "Cash");
                payment.setPaymentDate(date);
                payment.setCreatedAt(LocalDateTime.now());
                paymentRepository.save(payment);
            }

            return ResponseEntity.ok(savedPurchase);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create purchase: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPurchaseById(@PathVariable Long id, HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        Optional<Purchase> pOpt = purchaseRepository.findByIdAndUserId(id, userId);
        if (pOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Purchase not found"));
        }
        Purchase purchase = pOpt.get();

        Map<Long, String> commodityNameMap = new HashMap<>();
        for (Commodity c : commodityRepository.findAllByUserId(userId)) {
            commodityNameMap.put(c.getId(), c.getName());
        }

        List<PurchaseItem> items = purchaseItemRepository.findAllByPurchaseId(id);
        List<Map<String, Object>> itemDTOs = new ArrayList<>();
        for (PurchaseItem item : items) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", item.getId());
            map.put("commodityId", item.getCommodityId());
            map.put("quantity", item.getQuantity());
            map.put("rate", item.getRate());
            map.put("amount", item.getAmount());
            map.put("commodityName", commodityNameMap.getOrDefault(item.getCommodityId(), "Grain"));
            itemDTOs.add(map);
        }

        Farmer farmer = farmerRepository.findByIdAndUserId(purchase.getFarmerId(), userId).orElse(null);
        List<Payment> payments = paymentRepository.findAllByPurchaseId(id);
        BusinessProfile profile = profileRepository.findByUserId(userId).orElse(null);

        Map<String, Object> response = new HashMap<>();
        response.put("id", purchase.getId());
        response.put("purchaseNumber", purchase.getPurchaseNumber());
        response.put("date", purchase.getDate());
        response.put("farmerId", purchase.getFarmerId());
        response.put("totalAmount", purchase.getTotalAmount());
        response.put("advancePaid", purchase.getAdvancePaid());
        response.put("remainingAmount", purchase.getRemainingAmount());
        response.put("status", purchase.getStatus());
        response.put("createdAt", purchase.getCreatedAt());
        response.put("items", itemDTOs);
        response.put("farmer", farmer);
        response.put("payments", payments);
        response.put("profile", profile);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/payments")
    @Transactional
    public ResponseEntity<?> addPayment(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        Optional<Purchase> pOpt = purchaseRepository.findByIdAndUserId(id, userId);
        if (pOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Purchase not found"));
        }
        Purchase purchase = pOpt.get();

        Double amount = Double.valueOf(body.get("amount").toString());
        String paymentMode = (String) body.getOrDefault("paymentMode", "Cash");
        String paymentDate = (String) body.getOrDefault("paymentDate", purchase.getDate());

        Double currentRemaining = purchase.getRemainingAmount();
        Double newRemaining = currentRemaining - amount;
        Double newAdvancePaid = purchase.getAdvancePaid() + amount;
        String newStatus = newRemaining <= 0.001 ? "Paid" : (Math.abs(newRemaining - purchase.getTotalAmount()) < 0.001 ? "Pending" : "Partial");

        Payment payment = new Payment();
        payment.setUserId(userId);
        payment.setPurchaseId(id);
        payment.setAmount(amount);
        payment.setPaymentMode(paymentMode);
        payment.setPaymentDate(paymentDate);
        payment.setCreatedAt(LocalDateTime.now());
        Payment savedPayment = paymentRepository.save(payment);

        purchase.setRemainingAmount(newRemaining);
        purchase.setAdvancePaid(newAdvancePaid);
        purchase.setStatus(newStatus);
        purchaseRepository.save(purchase);

        farmerRepository.findByIdAndUserId(purchase.getFarmerId(), userId).ifPresent(farmer -> {
            double currentBal = farmer.getOutstandingBalance() != null ? farmer.getOutstandingBalance() : 0.0;
            farmer.setOutstandingBalance(currentBal - amount);
            farmerRepository.save(farmer);
        });

        return ResponseEntity.ok(savedPayment);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deletePurchase(@PathVariable Long id, HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        Optional<Purchase> pOpt = purchaseRepository.findByIdAndUserId(id, userId);
        if (pOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Purchase not found"));
        }
        Purchase purchase = pOpt.get();

        if (purchase.getRemainingAmount() != null && purchase.getRemainingAmount() > 0) {
            farmerRepository.findByIdAndUserId(purchase.getFarmerId(), userId).ifPresent(farmer -> {
                double currentBal = farmer.getOutstandingBalance() != null ? farmer.getOutstandingBalance() : 0.0;
                farmer.setOutstandingBalance(Math.max(0.0, currentBal - purchase.getRemainingAmount()));
                farmerRepository.save(farmer);
            });
        }

        paymentRepository.deleteAllByPurchaseId(id);
        purchaseItemRepository.deleteAllByPurchaseId(id);
        purchaseRepository.deleteById(id);

        return ResponseEntity.ok(Map.of("success", true, "message", "Purchase removed successfully"));
    }
}
