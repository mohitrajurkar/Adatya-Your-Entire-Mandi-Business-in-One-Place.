package com.adatya.controller;

import com.adatya.domain.Money;
import com.adatya.model.*;
import com.adatya.repository.*;
import com.adatya.security.AuthenticatedUser;
import com.adatya.security.CurrentUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * Platform administration.
 *
 * Every endpoint here was previously reachable anonymously: anyone could list
 * all registered businesses with their mobile numbers, dump a business's entire
 * ledger, or delete an account. The class-level @PreAuthorize enforces the
 * SUPER_ADMIN role on each method, in addition to the URL rule in
 * SecurityConfig, so the restriction survives any future change to either one.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    private final UserRepository userRepository;
    private final BusinessProfileRepository profileRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final FarmerRepository farmerRepository;
    private final CommodityRepository commodityRepository;
    private final PaymentRepository paymentRepository;
    private final MandiSaleRepository mandiSaleRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final CurrentUser currentUser;

    public AdminController(UserRepository userRepository,
                           BusinessProfileRepository profileRepository,
                           PurchaseRepository purchaseRepository,
                           PurchaseItemRepository purchaseItemRepository,
                           FarmerRepository farmerRepository,
                           CommodityRepository commodityRepository,
                           PaymentRepository paymentRepository,
                           MandiSaleRepository mandiSaleRepository,
                           StockAdjustmentRepository stockAdjustmentRepository,
                           CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.farmerRepository = farmerRepository;
        this.commodityRepository = commodityRepository;
        this.paymentRepository = paymentRepository;
        this.mandiSaleRepository = mandiSaleRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.currentUser = currentUser;
    }

    /**
     * Platform-wide aggregated metrics for the platform owner.
     */
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getPlatformOverview() {
        List<Purchase> allPurchases = purchaseRepository.findAll();

        BigDecimal totalProcurementValue = allPurchases.stream()
                .map(p -> Money.scaleMoney(p.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalAdvancePaid = allPurchases.stream()
                .map(p -> Money.scaleMoney(p.getAdvancePaid()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalRemainingDue = allPurchases.stream()
                .map(p -> Money.scaleMoney(p.getRemainingAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSalesRevenue = mandiSaleRepository.findAll().stream()
                .map(s -> Money.scaleMoney(s.getNetAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPurchasedQuintals = purchaseItemRepository.findAll().stream()
                .map(i -> Money.scaleQuantity(i.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> overview = new HashMap<>();
        overview.put("totalBusinesses", userRepository.count());
        overview.put("totalFarmers", farmerRepository.count());
        overview.put("totalPurchases", purchaseRepository.count());
        overview.put("totalProcurementValue", totalProcurementValue);
        overview.put("totalAdvancePaid", totalAdvancePaid);
        overview.put("totalRemainingDue", totalRemainingDue);
        overview.put("totalMandiSales", mandiSaleRepository.count());
        overview.put("totalSalesRevenue", totalSalesRevenue);
        overview.put("totalPurchasedQuintals", totalPurchasedQuintals);
        overview.put("commoditiesCount", commodityRepository.count());

        return ResponseEntity.ok(overview);
    }

    /**
     * Lists registered businesses with their own operational summary.
     *
     * The per-business figures were previously computed from global findAll()
     * counts, so every row reported the same platform-wide totals. Each row is
     * now scoped to that business.
     */
    @GetMapping("/businesses")
    public ResponseEntity<List<Map<String, Object>>> getAllBusinesses() {
        List<Map<String, Object>> result = new ArrayList<>();

        for (User u : userRepository.findAll()) {
            Long businessId = u.getId();

            BigDecimal procurementAmount = purchaseRepository
                    .findAllByUserIdOrderByCreatedAtDesc(businessId).stream()
                    .map(p -> Money.scaleMoney(p.getTotalAmount()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> map = new HashMap<>();
            map.put("id", businessId);
            map.put("name", u.getName());
            map.put("businessName", u.getBusinessName() != null
                    ? u.getBusinessName() : u.getName() + " Traders");
            map.put("apmcLocation", u.getApmcLocation() != null ? u.getApmcLocation() : "APMC Yard");
            map.put("mobile", u.getMobile());
            map.put("role", AuthenticatedUser.normalizeRole(u.getRole()));
            map.put("createdAt", u.getCreatedAt());

            map.put("totalPurchases", purchaseRepository.countByUserId(businessId));
            map.put("totalProcurementAmount", procurementAmount);
            map.put("totalFarmers", farmerRepository.countByUserId(businessId));
            map.put("totalMandiSales", mandiSaleRepository.countByUserId(businessId));

            // Determined by role only. A specific mobile number was previously
            // hard-coded here as the privileged identity.
            map.put("isSuperAdmin",
                    AuthenticatedUser.ROLE_SUPER_ADMIN.equals(AuthenticatedUser.normalizeRole(u.getRole())));

            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Full data breakdown for one business, scoped to that business.
     *
     * This previously returned every row in every table regardless of the id in
     * the path.
     */
    @GetMapping("/businesses/{id}/data")
    public ResponseEntity<Map<String, Object>> getCompleteBusinessData(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> data = new HashMap<>();
        data.put("business", toSafeBusiness(userOpt.get()));
        data.put("purchases", purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(id));
        data.put("purchaseItems", purchaseItemRepository.findAllByUserId(id));
        data.put("farmers", farmerRepository.findAllByUserId(id));
        data.put("commodities", commodityRepository.findAllByUserId(id));
        data.put("payments", paymentRepository.findAllByUserId(id));
        data.put("mandiSales", mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(id));
        data.put("stockAdjustments", stockAdjustmentRepository.findAllByUserId(id));
        data.put("profile", profileRepository.findByUserId(id).orElse(null));

        return ResponseEntity.ok(data);
    }

    /**
     * Removes a business account.
     *
     * Note: this deletes the account only. The business's ledger rows remain in
     * the database and are no longer reachable through the application; a
     * reviewed cascade or archival policy is deferred to the data-integrity
     * phase rather than bolted on here.
     */
    @DeleteMapping("/businesses/{id}")
    public ResponseEntity<Map<String, Object>> deleteBusiness(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();

        if (Objects.equals(id, currentUser.id())) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "You cannot delete the account you are signed in with."
            ));
        }

        if (AuthenticatedUser.ROLE_SUPER_ADMIN.equals(AuthenticatedUser.normalizeRole(user.getRole()))) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Platform administrator accounts cannot be removed here."
            ));
        }

        userRepository.deleteById(id);
        log.warn("Business account {} removed by administrator {}", id, currentUser.id());

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Business account removed successfully."
        ));
    }

    /** Never expose the password hash, even to an administrator. */
    private Map<String, Object> toSafeBusiness(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("name", user.getName());
        map.put("businessName", user.getBusinessName());
        map.put("apmcLocation", user.getApmcLocation());
        map.put("mobile", user.getMobile());
        map.put("role", AuthenticatedUser.normalizeRole(user.getRole()));
        map.put("createdAt", user.getCreatedAt());
        return map;
    }
}
