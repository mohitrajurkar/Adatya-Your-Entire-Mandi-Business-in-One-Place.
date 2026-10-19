package com.adatya.service;

import com.adatya.domain.Money;
import com.adatya.dto.PurchaseRequests.AddPayment;
import com.adatya.dto.PurchaseRequests.CreatePurchase;
import com.adatya.dto.PurchaseRequests.PurchaseLine;
import com.adatya.model.*;
import com.adatya.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * All purchase and payment money rules live here.
 *
 * Previously this logic sat inline in the controller and trusted the client
 * for every figure. The rules now enforced:
 *
 *   - line amount is quantity x rate, computed here, never sent by the client
 *   - the bill total is the sum of its lines
 *   - the advance cannot exceed the bill total
 *   - a payment cannot exceed what is still outstanding
 *   - remaining is always total - paid, so the ledger invariant holds
 *   - the farmer balance is recalculated from their open bills rather than
 *     incremented, so it cannot drift away from the underlying records
 */
@Service
public class PurchaseService {

    private static final Logger log = LoggerFactory.getLogger(PurchaseService.class);

    /** A repeated identical payment inside this window is treated as a double submit. */
    private static final long DUPLICATE_PAYMENT_WINDOW_SECONDS = 60;

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final PaymentRepository paymentRepository;
    private final FarmerRepository farmerRepository;
    private final CommodityRepository commodityRepository;

    public PurchaseService(PurchaseRepository purchaseRepository,
                           PurchaseItemRepository purchaseItemRepository,
                           PaymentRepository paymentRepository,
                           FarmerRepository farmerRepository,
                           CommodityRepository commodityRepository) {
        this.purchaseRepository = purchaseRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.paymentRepository = paymentRepository;
        this.farmerRepository = farmerRepository;
        this.commodityRepository = commodityRepository;
    }

    @Transactional
    public Purchase createPurchase(Long userId, CreatePurchase request) {
        // A retry of a submission already accepted returns the original bill.
        // Checked before anything else so a retry does no work at all.
        String requestKey = normaliseKey(request.clientRequestId());
        if (requestKey != null) {
            Optional<Purchase> alreadyBooked =
                    purchaseRepository.findByUserIdAndClientRequestId(userId, requestKey);
            if (alreadyBooked.isPresent()) {
                log.info("Purchase request {} already booked for account {}; returning the original",
                        requestKey, userId);
                return alreadyBooked.get();
            }
        }

        Farmer farmer = farmerRepository.findByIdAndUserId(request.farmerId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("Farmer not found"));

        // Resolve every line to a commodity owned by this trader, and compute
        // the amount here rather than trusting the request.
        List<PurchaseItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (PurchaseLine line : request.items()) {
            Commodity commodity = resolveCommodity(userId, line);
            BigDecimal quantity = Money.scaleQuantity(line.quantity());
            BigDecimal rate = Money.scaleMoney(line.rate());
            BigDecimal amount = Money.lineAmount(quantity, rate);

            if (!Money.isPositive(quantity)) {
                throw new IllegalArgumentException("Quantity must be greater than zero");
            }
            if (Money.isNegative(rate)) {
                throw new IllegalArgumentException("Rate cannot be negative");
            }

            PurchaseItem item = new PurchaseItem();
            item.setUserId(userId);
            item.setCommodityId(commodity.getId());
            item.setQuantity(quantity);
            item.setRate(rate);
            item.setAmount(amount);
            items.add(item);

            total = total.add(amount);
        }

        total = Money.scaleMoney(total);
        if (Money.gt(total, Money.MAX_AMOUNT)) {
            throw new IllegalArgumentException("Bill total is larger than this system supports");
        }

        BigDecimal advance = Money.scaleMoney(request.advancePaid());
        if (Money.isNegative(advance)) {
            throw new IllegalArgumentException("Advance paid cannot be negative");
        }
        // The overpayment that silently produced a negative balance before.
        if (Money.gt(advance, total)) {
            throw new IllegalArgumentException(
                    "Advance paid (" + advance.toPlainString() + ") cannot be more than the bill total ("
                  + total.toPlainString() + ")");
        }

        String billNumber = resolveBillNumber(userId, request.purchaseNumber());

        // Re-submitting the same bill number returns the original rather than
        // booking the purchase twice.
        Optional<Purchase> existing = purchaseRepository.findByPurchaseNumberAndUserId(billNumber, userId);
        if (existing.isPresent()) {
            log.info("Purchase {} already exists for account {}; returning the original", billNumber, userId);
            return existing.get();
        }

        BigDecimal remaining = Money.scaleMoney(total.subtract(advance));

        Purchase purchase = new Purchase();
        purchase.setUserId(userId);
        purchase.setFarmerId(farmer.getId());
        purchase.setDate(request.date());
        purchase.setPurchaseNumber(billNumber);
        purchase.setTotalAmount(total);
        purchase.setAdvancePaid(advance);
        purchase.setRemainingAmount(remaining);
        purchase.setStatus(statusFor(total, remaining));
        purchase.setClientRequestId(requestKey);
        purchase.setCreatedAt(LocalDateTime.now());

        Purchase saved;
        try {
            saved = purchaseRepository.saveAndFlush(purchase);
        } catch (DataIntegrityViolationException e) {
            // Lost the race against a concurrent identical submit: whichever
            // uniqueness rule fired, resolve to the record that won.
            if (requestKey != null) {
                Optional<Purchase> winner =
                        purchaseRepository.findByUserIdAndClientRequestId(userId, requestKey);
                if (winner.isPresent()) {
                    return winner.get();
                }
            }
            return purchaseRepository.findByPurchaseNumberAndUserId(billNumber, userId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Bill number " + billNumber + " is already used"));
        }

        for (PurchaseItem item : items) {
            item.setPurchaseId(saved.getId());
            purchaseItemRepository.save(item);
        }

        if (Money.isPositive(advance)) {
            Payment payment = new Payment();
            payment.setUserId(userId);
            payment.setPurchaseId(saved.getId());
            payment.setAmount(advance);
            payment.setPaymentMode(defaultMode(request.paymentMode()));
            payment.setPaymentDate(request.date());
            payment.setCreatedAt(LocalDateTime.now());
            paymentRepository.save(payment);
        }

        recalculateFarmerBalance(userId, farmer.getId());
        return saved;
    }

    @Transactional
    public Payment addPayment(Long userId, Long purchaseId, AddPayment request) {
        String requestKey = normaliseKey(request.clientRequestId());
        if (requestKey != null) {
            Optional<Payment> alreadyRecorded =
                    paymentRepository.findByUserIdAndClientRequestId(userId, requestKey);
            if (alreadyRecorded.isPresent()) {
                log.info("Payment request {} already recorded for account {}; returning the original",
                        requestKey, userId);
                return alreadyRecorded.get();
            }
        }

        Purchase purchase = purchaseRepository.findByIdAndUserId(purchaseId, userId)
                .orElseThrow(() -> new PurchaseNotFoundException());

        BigDecimal amount = Money.scaleMoney(request.amount());
        if (!Money.isPositive(amount)) {
            throw new IllegalArgumentException("Payment must be greater than zero");
        }

        BigDecimal outstanding = Money.scaleMoney(purchase.getRemainingAmount());
        if (!Money.isPositive(outstanding)) {
            throw new IllegalArgumentException("This bill is already fully paid");
        }
        // The hole that accepted a 1 crore payment against a 1.7 lakh bill.
        if (Money.gt(amount, outstanding)) {
            throw new IllegalArgumentException(
                    "Payment of " + amount.toPlainString() + " is more than the outstanding balance of "
                  + outstanding.toPlainString());
        }

        String paymentDate = request.paymentDate() != null && !request.paymentDate().isBlank()
                ? request.paymentDate() : purchase.getDate();

        // Fallback for callers that send no key. It cannot distinguish a retry
        // from two identical payments a trader genuinely made, so it applies
        // only when there is no explicit key to go on.
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(DUPLICATE_PAYMENT_WINDOW_SECONDS);
        boolean duplicate = requestKey == null
                && paymentRepository.findAllByPurchaseId(purchaseId).stream()
                .anyMatch(p -> Money.eq(Money.scaleMoney(p.getAmount()), amount)
                            && Objects.equals(p.getPaymentDate(), paymentDate)
                            && p.getCreatedAt() != null
                            && p.getCreatedAt().isAfter(cutoff));
        if (duplicate) {
            throw new IllegalArgumentException(
                    "An identical payment was just recorded for this bill. Please check the bill before retrying.");
        }

        Payment payment = new Payment();
        payment.setUserId(userId);
        payment.setPurchaseId(purchaseId);
        payment.setAmount(amount);
        payment.setPaymentMode(defaultMode(request.paymentMode()));
        payment.setPaymentDate(paymentDate);
        payment.setClientRequestId(requestKey);
        payment.setCreatedAt(LocalDateTime.now());
        Payment saved = paymentRepository.save(payment);

        BigDecimal paid = Money.scaleMoney(purchase.getAdvancePaid().add(amount));
        BigDecimal remaining = Money.scaleMoney(purchase.getTotalAmount().subtract(paid));
        purchase.setAdvancePaid(paid);
        purchase.setRemainingAmount(remaining);
        purchase.setStatus(statusFor(purchase.getTotalAmount(), remaining));
        purchaseRepository.save(purchase);

        recalculateFarmerBalance(userId, purchase.getFarmerId());
        return saved;
    }

    @Transactional
    public void deletePurchase(Long userId, Long purchaseId) {
        Purchase purchase = purchaseRepository.findByIdAndUserId(purchaseId, userId)
                .orElseThrow(() -> new PurchaseNotFoundException());
        Long farmerId = purchase.getFarmerId();

        paymentRepository.deleteAllByPurchaseId(purchaseId);
        purchaseItemRepository.deleteAllByPurchaseId(purchaseId);
        purchaseRepository.deleteById(purchaseId);
        purchaseRepository.flush();

        recalculateFarmerBalance(userId, farmerId);
    }

    /**
     * Rebuilds a farmer balance from their outstanding bills.
     *
     * The old code added and subtracted deltas as events happened, so any
     * missed or double-counted step left the balance permanently wrong.
     */
    @Transactional
    public void recalculateFarmerBalance(Long userId, Long farmerId) {
        BigDecimal outstanding = purchaseRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(p -> Objects.equals(p.getFarmerId(), farmerId))
                .map(p -> Money.scaleMoney(p.getRemainingAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        farmerRepository.findByIdAndUserId(farmerId, userId).ifPresent(farmer -> {
            farmer.setOutstandingBalance(Money.scaleMoney(outstanding));
            farmerRepository.save(farmer);
        });
    }

    private Commodity resolveCommodity(Long userId, PurchaseLine line) {
        Long commodityId = parseCommodityId(line.commodityId());
        if (commodityId != null) {
            Optional<Commodity> owned = commodityRepository.findById(commodityId)
                    .filter(c -> Objects.equals(c.getUserId(), userId));
            if (owned.isPresent()) {
                return owned.get();
            }
        }

        String name = line.customCommodityName() != null && !line.customCommodityName().isBlank()
                ? line.customCommodityName().trim()
                : null;
        if (name == null) {
            throw new IllegalArgumentException("Select a commodity or enter a name for it");
        }

        return commodityRepository.findByNameAndUserId(name, userId)
                .orElseGet(() -> commodityRepository.save(
                        new Commodity(userId, name, Money.scaleMoney(line.rate()))));
    }

    /** Blank keys are treated as absent. */
    private String normaliseKey(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    /** Null for the "other" sentinel or anything non-numeric. */
    private Long parseCommodityId(String raw) {
        if (raw == null || raw.isBlank() || "other".equalsIgnoreCase(raw.trim())) {
            return null;
        }
        try {
            return Long.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Uses the supplied bill number, or allocates the next free one. */
    private String resolveBillNumber(Long userId, String requested) {
        if (requested != null && !requested.isBlank()) {
            return requested.trim();
        }
        int year = LocalDate.now().getYear();
        long next = purchaseRepository.countByUserId(userId) + 1;
        String candidate;
        do {
            candidate = String.format("PUR-%d-%03d", year, next);
            next++;
        } while (purchaseRepository.findByPurchaseNumberAndUserId(candidate, userId).isPresent());
        return candidate;
    }

    private String statusFor(BigDecimal total, BigDecimal remaining) {
        if (!Money.isPositive(remaining)) {
            return "Paid";
        }
        if (Money.eq(remaining, Money.scaleMoney(total))) {
            return "Pending";
        }
        return "Partial";
    }

    private String defaultMode(String mode) {
        return mode == null || mode.isBlank() ? "Cash" : mode.trim();
    }

    /** Signals a missing or not-owned purchase, mapped to 404 by the controller. */
    public static class PurchaseNotFoundException extends RuntimeException {
        public PurchaseNotFoundException() {
            super("Purchase not found");
        }
    }
}
