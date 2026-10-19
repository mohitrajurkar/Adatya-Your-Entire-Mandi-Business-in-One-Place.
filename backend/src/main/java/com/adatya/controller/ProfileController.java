package com.adatya.controller;

import com.adatya.model.BusinessProfile;
import com.adatya.model.User;
import com.adatya.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class ProfileController {

    private final BusinessProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final FarmerRepository farmerRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final PaymentRepository paymentRepository;
    private final MandiSaleRepository mandiSaleRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final CommodityRepository commodityRepository;
    private final PasswordEncoder passwordEncoder;

    public ProfileController(BusinessProfileRepository profileRepository,
                             UserRepository userRepository,
                             FarmerRepository farmerRepository,
                             PurchaseRepository purchaseRepository,
                             PurchaseItemRepository purchaseItemRepository,
                             PaymentRepository paymentRepository,
                             MandiSaleRepository mandiSaleRepository,
                             StockAdjustmentRepository stockAdjustmentRepository,
                             CommodityRepository commodityRepository,
                             PasswordEncoder passwordEncoder) {
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
        this.farmerRepository = farmerRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.paymentRepository = paymentRepository;
        this.mandiSaleRepository = mandiSaleRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.commodityRepository = commodityRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/profile")
    public ResponseEntity<BusinessProfile> getProfile() {
        var profiles = profileRepository.findAll();
        if (!profiles.isEmpty()) {
            return ResponseEntity.ok(profiles.get(0));
        }
        BusinessProfile def = new BusinessProfile();
        return ResponseEntity.ok(def);
    }

    @PostMapping("/profile")
    public ResponseEntity<BusinessProfile> updateProfile(@RequestBody BusinessProfile payload) {
        var profiles = profileRepository.findAll();
        BusinessProfile target = profiles.isEmpty() ? new BusinessProfile() : profiles.get(0);

        if (payload.getBusinessName() != null) target.setBusinessName(payload.getBusinessName());
        if (payload.getProprietorName() != null) target.setProprietorName(payload.getProprietorName());
        if (payload.getAddress() != null) target.setAddress(payload.getAddress());
        if (payload.getMobile1() != null) target.setMobile1(payload.getMobile1());
        if (payload.getMobile2() != null) target.setMobile2(payload.getMobile2());
        if (payload.getMandiLicense() != null) target.setMandiLicense(payload.getMandiLicense());
        if (payload.getGstin() != null) target.setGstin(payload.getGstin());
        if (payload.getUpiId() != null) target.setUpiId(payload.getUpiId());
        if (payload.getSignatureData() != null) target.setSignatureData(payload.getSignatureData());
        if (payload.getSignatureType() != null) target.setSignatureType(payload.getSignatureType());
        if (payload.getSignatureName() != null) target.setSignatureName(payload.getSignatureName());
        if (payload.getTagline() != null) target.setTagline(payload.getTagline());
        target.setUpdatedAt(LocalDateTime.now());

        BusinessProfile saved = profileRepository.save(target);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/user/profile")
    public ResponseEntity<Map<String, Object>> updateUserProfile(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String businessName = (String) body.get("businessName");
        String address = (String) body.get("address");
        String mobile = (String) body.get("mobile");
        String mobile2 = (String) body.get("mobile2");
        String mandiLicense = (String) body.get("mandiLicense");
        String gstin = (String) body.get("gstin");
        String upiId = (String) body.get("upiId");
        String newPassword = (String) body.get("newPassword");
        Object userIdObj = body.get("userId");

        // 1. Update business profile
        var profiles = profileRepository.findAll();
        BusinessProfile bp = profiles.isEmpty() ? new BusinessProfile() : profiles.get(0);
        if (businessName != null) bp.setBusinessName(businessName);
        if (name != null) {
            bp.setProprietorName(name);
            bp.setSignatureName(name);
        }
        if (address != null) bp.setAddress(address);
        if (mobile != null) bp.setMobile1(mobile);
        if (mobile2 != null) bp.setMobile2(mobile2);
        if (mandiLicense != null) bp.setMandiLicense(mandiLicense);
        if (gstin != null) bp.setGstin(gstin);
        if (upiId != null) bp.setUpiId(upiId);
        bp.setUpdatedAt(LocalDateTime.now());
        profileRepository.save(bp);

        // 2. Update user record if found
        Long userId = null;
        if (userIdObj != null) {
            try {
                userId = Long.valueOf(userIdObj.toString());
            } catch (Exception ignored) {}
        }

        Optional<User> userOpt = Optional.empty();
        if (userId != null) {
            userOpt = userRepository.findById(userId);
        } else if (mobile != null) {
            userOpt = userRepository.findByMobile(mobile);
        }

        if (userOpt.isPresent()) {
            User u = userOpt.get();
            if (name != null) u.setName(name);
            if (businessName != null) u.setBusinessName(businessName);
            if (address != null) u.setApmcLocation(address);
            if (newPassword != null && newPassword.trim().length() >= 4) {
                u.setPassword(passwordEncoder.encode(newPassword.trim()));
            }
            userRepository.save(u);
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "Broker info updated successfully"));
    }

    /**
     * DELETE ACCOUNT — wipes ALL data: purchases, items, payments, farmers,
     * mandi sales, stock adjustments, commodities, profile, and the user account.
     * Requires the user's current password as confirmation.
     */
    @PostMapping("/account/delete")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteAccount(@RequestBody Map<String, Object> body) {
        Object userIdObj = body.get("userId");
        String confirmPassword = (String) body.get("password");

        if (userIdObj == null || confirmPassword == null || confirmPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "User ID and password are required for account deletion."
            ));
        }

        Long userId;
        try {
            userId = Long.valueOf(userIdObj.toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Invalid user ID."));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Account not found."));
        }

        User user = userOpt.get();
        boolean passwordMatches = passwordEncoder.matches(confirmPassword, user.getPassword());
        // Also accept plaintext for accounts not yet BCrypt-migrated
        if (!passwordMatches && confirmPassword.equals(user.getPassword())) {
            passwordMatches = true;
        }

        if (!passwordMatches) {
            return ResponseEntity.status(401).body(Map.of(
                "success", false,
                "error", "Incorrect password. Account deletion cancelled."
            ));
        }

        // Wipe all application data in safe order (foreign keys first)
        try {
            paymentRepository.deleteAll();
            purchaseItemRepository.deleteAll();
            purchaseRepository.deleteAll();
            mandiSaleRepository.deleteAll();
            stockAdjustmentRepository.deleteAll();
            farmerRepository.deleteAll();
            commodityRepository.deleteAll();
            profileRepository.deleteAll();
            userRepository.deleteAll();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "error", "Failed to delete account data: " + e.getMessage()
            ));
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "Account and all data deleted successfully."));
    }
}
