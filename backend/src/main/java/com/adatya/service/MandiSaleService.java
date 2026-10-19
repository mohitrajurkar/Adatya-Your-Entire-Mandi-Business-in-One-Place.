package com.adatya.service;

import com.adatya.domain.Money;
import com.adatya.dto.TradeRequests.CreateSale;
import com.adatya.dto.TradeRequests.CreateStockAdjustment;
import com.adatya.model.Commodity;
import com.adatya.model.MandiSale;
import com.adatya.model.StockAdjustment;
import com.adatya.repository.CommodityRepository;
import com.adatya.repository.MandiSaleRepository;
import com.adatya.repository.StockAdjustmentRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;

/**
 * Mandi sales and stock adjustments.
 *
 * The rules added here:
 *   - subtotal and net amount are computed server-side from weight and rate
 *   - a sale cannot exceed the stock actually held, which previously drove
 *     inventory negative without complaint
 *   - deductions cannot exceed the subtotal, so a sale cannot net below zero
 *   - sale numbers are allocated without colliding after a deletion
 */
@Service
public class MandiSaleService {

    private final MandiSaleRepository mandiSaleRepository;
    private final CommodityRepository commodityRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final InventoryService inventoryService;

    public MandiSaleService(MandiSaleRepository mandiSaleRepository,
                            CommodityRepository commodityRepository,
                            StockAdjustmentRepository stockAdjustmentRepository,
                            InventoryService inventoryService) {
        this.mandiSaleRepository = mandiSaleRepository;
        this.commodityRepository = commodityRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional
    public MandiSale createSale(Long userId, CreateSale request) {
        // A retried submission returns the sale already recorded, rather than
        // selling the same stock twice.
        String requestKey = request.clientRequestId() == null || request.clientRequestId().isBlank()
                ? null : request.clientRequestId().trim();
        if (requestKey != null) {
            Optional<MandiSale> alreadyRecorded =
                    mandiSaleRepository.findByUserIdAndClientRequestId(userId, requestKey);
            if (alreadyRecorded.isPresent()) {
                return alreadyRecorded.get();
            }
        }

        Commodity commodity = ownedCommodity(userId, request.commodityId());

        BigDecimal weight = Money.scaleQuantity(request.weightQuintals());
        BigDecimal rate = Money.scaleMoney(request.saleRate());
        if (!Money.isPositive(weight)) {
            throw new IllegalArgumentException("Weight must be greater than zero");
        }
        if (Money.isNegative(rate)) {
            throw new IllegalArgumentException("Sale rate cannot be negative");
        }

        // Cannot sell stock that is not held.
        BigDecimal available = inventoryService.availableQuintals(userId, commodity.getId());
        if (weight.compareTo(available) > 0) {
            throw new IllegalArgumentException(
                    "Only " + available.toPlainString() + " quintal of " + commodity.getName()
                  + " is in stock; this sale is for " + weight.toPlainString() + " quintal");
        }

        BigDecimal hamali = Money.scaleMoney(request.hamali());
        BigDecimal transport = Money.scaleMoney(request.transport());
        BigDecimal cess = Money.scaleMoney(request.mandiCess());
        BigDecimal subtotal = Money.lineAmount(weight, rate);
        BigDecimal deductions = Money.sum(hamali, transport, cess);

        if (Money.gt(deductions, subtotal)) {
            throw new IllegalArgumentException(
                    "Hamali, transport and cess (" + deductions.toPlainString()
                  + ") cannot be more than the sale value (" + subtotal.toPlainString() + ")");
        }

        MandiSale sale = new MandiSale();
        sale.setUserId(userId);
        sale.setSaleNumber(nextSaleNumber(userId));
        sale.setDate(valueOrToday(request.date()));
        sale.setCommodityId(commodity.getId());
        sale.setBuyerName(request.buyerName().trim());
        sale.setBuyerMobile(request.buyerMobile());
        sale.setBuyerLocation(request.buyerLocation());
        sale.setVehicleNumber(request.vehicleNumber());
        sale.setBags(request.bags() == null ? 0 : request.bags());
        sale.setWeightQuintals(weight);
        sale.setSaleRate(rate);
        sale.setSubtotal(subtotal);
        sale.setHamali(hamali);
        sale.setTransport(transport);
        sale.setMandiCess(cess);
        sale.setNetAmount(Money.scaleMoney(subtotal.subtract(deductions)));
        sale.setPaymentStatus(request.paymentStatus() == null || request.paymentStatus().isBlank()
                ? "Paid" : request.paymentStatus());
        sale.setPaymentMode(request.paymentMode() == null || request.paymentMode().isBlank()
                ? "Cash" : request.paymentMode());
        sale.setNotes(request.notes());
        sale.setClientRequestId(requestKey);
        sale.setCreatedAt(LocalDateTime.now());

        try {
            return mandiSaleRepository.saveAndFlush(sale);
        } catch (DataIntegrityViolationException e) {
            // Either a concurrent retry won the idempotency key, or the sale
            // number collided. Resolve to the winner, else take a fresh number.
            if (requestKey != null) {
                Optional<MandiSale> winner =
                        mandiSaleRepository.findByUserIdAndClientRequestId(userId, requestKey);
                if (winner.isPresent()) {
                    return winner.get();
                }
            }
            sale.setSaleNumber(nextSaleNumber(userId));
            return mandiSaleRepository.saveAndFlush(sale);
        }
    }

    @Transactional
    public void deleteSale(Long userId, Long saleId) {
        MandiSale sale = mandiSaleRepository.findByIdAndUserId(saleId, userId)
                .orElseThrow(SaleNotFoundException::new);
        mandiSaleRepository.delete(sale);
    }

    @Transactional
    public StockAdjustment createAdjustment(Long userId, CreateStockAdjustment request) {
        Commodity commodity = ownedCommodity(userId, request.commodityId());

        BigDecimal weight = Money.scaleQuantity(request.weightQuintals());
        if (!Money.isPositive(weight)) {
            throw new IllegalArgumentException("Weight must be greater than zero");
        }

        String type = request.type().trim().toLowerCase();

        // Taking stock out cannot take it below zero either.
        if ("outward".equals(type) || "adjustment".equals(type)) {
            BigDecimal available = inventoryService.availableQuintals(userId, commodity.getId());
            if (weight.compareTo(available) > 0) {
                throw new IllegalArgumentException(
                        "Only " + available.toPlainString() + " quintal of " + commodity.getName()
                      + " is in stock; cannot remove " + weight.toPlainString() + " quintal");
            }
        }

        StockAdjustment adjustment = new StockAdjustment();
        adjustment.setUserId(userId);
        adjustment.setCommodityId(commodity.getId());
        adjustment.setType(type);
        adjustment.setBags(request.bags() == null ? 0 : request.bags());
        adjustment.setWeightQuintals(weight);
        adjustment.setRate(Money.scaleMoney(request.rate()));
        adjustment.setReason(request.reason() == null || request.reason().isBlank()
                ? "Stock adjustment" : request.reason().trim());
        adjustment.setDate(valueOrToday(request.date()));
        adjustment.setCreatedAt(LocalDateTime.now());

        return stockAdjustmentRepository.save(adjustment);
    }

    private Commodity ownedCommodity(Long userId, Long commodityId) {
        if (commodityId == null) {
            throw new IllegalArgumentException("Please select a commodity");
        }
        return commodityRepository.findById(commodityId)
                .filter(c -> Objects.equals(c.getUserId(), userId))
                .orElseThrow(() -> new IllegalArgumentException("Commodity not found"));
    }

    /** Allocates the next unused sale number, tolerating gaps left by deletions. */
    private String nextSaleNumber(Long userId) {
        int year = LocalDate.now().getYear();
        long next = mandiSaleRepository.countByUserId(userId) + 1;
        String candidate;
        do {
            candidate = String.format("MS-%d-%03d", year, next);
            next++;
        } while (saleNumberTaken(userId, candidate));
        return candidate;
    }

    private boolean saleNumberTaken(Long userId, String number) {
        return mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .anyMatch(s -> number.equals(s.getSaleNumber()));
    }

    private String valueOrToday(String date) {
        return date == null || date.isBlank() ? LocalDate.now().toString() : date;
    }

    public static class SaleNotFoundException extends RuntimeException {
        public SaleNotFoundException() {
            super("Sale not found");
        }
    }
}
