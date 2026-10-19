package com.adatya.controller;

import com.adatya.model.BusinessProfile;
import com.adatya.model.User;
import com.adatya.repository.*;
import com.adatya.security.CurrentUser;
import com.adatya.security.PasswordPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
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

    private static final Logger log = LoggerFactory.getLogger(ProfileController.class);

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
    private final CurrentUser currentUser;

    public ProfileController(BusinessProfileRepository profileRepository,
                             UserRepository userRepository,
                             FarmerRepository farmerRepository,
                             PurchaseRepository purchaseRepository,
                             PurchaseItemRepository purchaseItemRepository,
                             PaymentRepository paymentRepository,
                             MandiSaleRepository mandiSaleRepository,
                             StockAdjustmentRepository stockAdjustmentRepository,
                             CommodityRepository commodityRepository,
                             PasswordEncoder passwordEncoder,
                             CurrentUser currentUser) {
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
        this.currentUser = currentUser;
    }

    /**
     * The signed-in trader's own business profile.
     *
     * This used to return profiles.get(0) -- the first row in the table -- so
     * every trader was shown, and could overwrite, one shared profile.
     */
    @GetMapping("/profile")
    public ResponseEntity<BusinessProfile> getProfile() {
        return ResponseEntity.ok(loadOrCreateProfile(currentUser.id()));
    }

    @PostMapping("/profile")
    @Transactional
    public ResponseEntity<BusinessProfile> updateProfile(@RequestBody BusinessProfile payload) {
        BusinessProfile target = loadOrCreateProfile(currentUser.id());

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

        // The id and userId on the incoming payload are ignored; the row that is
        // written is always the one owned by the authenticated trader.
        return ResponseEntity.ok(profileRepository.save(target));
    }

    /**
     * Updates the trader's own broker details, and optionally their password.
     *
     * The target account is taken from the verified token. It was previously
     * taken from a "userId" field in the request body, which let any caller
     * rewrite another trader's details and set their password.
     */
    @PostMapping("/user/profile")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateUserProfile(@RequestBody Map<String, Object> body) {
        Long userId = currentUser.id();

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "success", false,
                "error", "Session is no longer valid. Please sign in again."
            ));
        }
        User user = userOpt.get();

        String name = asString(body.get("name"));
        String businessName = asString(body.get("businessName"));
        String address = asString(body.get("address"));
        String mobile2 = asString(body.get("mobile2"));
        String mandiLicense = asString(body.get("mandiLicense"));
        String gstin = asString(body.get("gstin"));
        String upiId = asString(body.get("upiId"));
        String newPassword = asString(body.get("newPassword"));
        String currentPassword = asString(body.get("currentPassword"));

        // A password change now requires proof of the existing password, so a
        // stolen or shared session cannot silently take over the account.
        if (newPassword != null && !newPassword.isBlank()) {
            if (currentPassword == null || currentPassword.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Enter your current password to set a new one"
                ));
            }
            if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "success", false,
                    "error", "Current password is incorrect"
                ));
            }
            String problem = PasswordPolicy.validate(newPassword);
            if (problem != null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "error", problem));
            }
            user.setPassword(passwordEncoder.encode(newPassword));
            log.info("Password changed for account {}", userId);
        }

        if (name != null) user.setName(name);
        if (businessName != null) user.setBusinessName(businessName);
        if (address != null) user.setApmcLocation(address);
        userRepository.save(user);

        // The login mobile number is intentionally not editable here: it is the
        // account identifier, and changing it would need its own verified flow.
        BusinessProfile profile = loadOrCreateProfile(userId);
        if (businessName != null) profile.setBusinessName(businessName);
        if (name != null) {
            profile.setProprietorName(name);
            profile.setSignatureName(name);
        }
        if (address != null) profile.setAddress(address);
        if (mobile2 != null) profile.setMobile2(mobile2);
        if (mandiLicense != null) profile.setMandiLicense(mandiLicense);
        if (gstin != null) profile.setGstin(gstin);
        if (upiId != null) profile.setUpiId(upiId);
        // The contact number printed on invoices is editable; the login mobile
        // number is the account identifier and is never changed here.
        String contactMobile = asString(body.get("mobile"));
        if (contactMobile != null) profile.setMobile1(contactMobile);
        profile.setUpdatedAt(LocalDateTime.now());
        profileRepository.save(profile);

        return ResponseEntity.ok(Map.of("success", true, "message", "Broker info updated successfully"));
    }

    /**
     * Deletes the signed-in trader's own account and their own records.
     *
     * Previously this called deleteAll() on every repository, including the
     * users table: one request destroyed the ledgers of every business on the
     * platform. Deletion is now restricted to rows owned by the authenticated
     * account, and the account id can no longer be supplied by the caller.
     */
    @PostMapping("/account/delete")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteAccount(@RequestBody Map<String, Object> body) {
        Long userId = currentUser.id();
        String confirmPassword = asString(body.get("password"));

        if (confirmPassword == null || confirmPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Your password is required to delete this account."
            ));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "success", false,
                "error", "Session is no longer valid. Please sign in again."
            ));
        }
        User user = userOpt.get();

        // Only a BCrypt match is accepted; the plaintext comparison that used to
        // sit here has been removed.
        if (!passwordEncoder.matches(confirmPassword, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "success", false,
                "error", "Incorrect password. Account deletion cancelled."
            ));
        }

        // Scoped to this tenant only, children before parents.
        paymentRepository.deleteAllByUserId(userId);
        purchaseItemRepository.deleteAllByUserId(userId);
        purchaseRepository.deleteAllByUserId(userId);
        mandiSaleRepository.deleteAllByUserId(userId);
        stockAdjustmentRepository.deleteAllByUserId(userId);
        farmerRepository.deleteAllByUserId(userId);
        commodityRepository.deleteAllByUserId(userId);
        profileRepository.deleteAllByUserId(userId);
        userRepository.deleteById(userId);

        log.warn("Account {} and its records were deleted at the owner request", userId);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Your account and all of your data have been deleted."
        ));
    }

    /**
     * Returns this trader's profile row, creating an empty one on first use.
     */
    private BusinessProfile loadOrCreateProfile(Long userId) {
        return profileRepository.findByUserId(userId).orElseGet(() -> {
            BusinessProfile fresh = new BusinessProfile();
            fresh.setUserId(userId);
            userRepository.findById(userId).ifPresent(user -> {
                if (user.getBusinessName() != null) fresh.setBusinessName(user.getBusinessName());
                if (user.getName() != null) {
                    fresh.setProprietorName(user.getName());
                    fresh.setSignatureName(user.getName());
                }
                if (user.getApmcLocation() != null) fresh.setAddress(user.getApmcLocation());
                fresh.setMobile1(user.getMobile());
            });
            return profileRepository.save(fresh);
        });
    }

    private String asString(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.toString();
        return value.isEmpty() ? null : value;
    }
}
