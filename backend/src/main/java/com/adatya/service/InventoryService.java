package com.adatya.service;

import com.adatya.domain.Money;
import com.adatya.model.*;
import com.adatya.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Derives stock positions in exact decimal arithmetic.
 *
 * Two things the previous implementation invented, now removed:
 *
 *   - bag counts were fabricated as quantity x 2 for purchased stock and then
 *     mixed with genuinely recorded bag counts from adjustments and sales.
 *     Purchased bags are now reported as unknown (null) rather than guessed,
 *     and only recorded bags are counted.
 *   - "low stock" was a hard-coded 10 quintals for every commodity. The
 *     threshold is now proportional to what has moved through that commodity,
 *     with a small floor, so a slow-moving pulse is not permanently flagged.
 */
@Service
public class InventoryService {

    /** Below this fraction of total inward movement, a commodity counts as low. */
    private static final BigDecimal LOW_STOCK_FRACTION = new BigDecimal("0.10");
    private static final BigDecimal LOW_STOCK_FLOOR = new BigDecimal("1.000");

    private final CommodityRepository commodityRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final MandiSaleRepository mandiSaleRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;

    public InventoryService(CommodityRepository commodityRepository,
                            PurchaseItemRepository purchaseItemRepository,
                            MandiSaleRepository mandiSaleRepository,
                            StockAdjustmentRepository stockAdjustmentRepository) {
        this.commodityRepository = commodityRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.mandiSaleRepository = mandiSaleRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
    }

    /** Quintals currently available for one commodity. May be negative only for legacy data. */
    @Transactional(readOnly = true)
    public BigDecimal availableQuintals(Long userId, Long commodityId) {
        BigDecimal purchased = purchaseItemRepository.findAllByUserId(userId).stream()
                .filter(i -> Objects.equals(i.getCommodityId(), commodityId))
                .map(i -> Money.scaleQuantity(i.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal inward = BigDecimal.ZERO;
        BigDecimal outward = BigDecimal.ZERO;
        for (StockAdjustment adj : stockAdjustmentRepository.findAllByUserId(userId)) {
            if (!Objects.equals(adj.getCommodityId(), commodityId)) {
                continue;
            }
            BigDecimal w = Money.scaleQuantity(adj.getWeightQuintals());
            if ("inward".equalsIgnoreCase(adj.getType()) || "opening".equalsIgnoreCase(adj.getType())) {
                inward = inward.add(w);
            } else {
                outward = outward.add(w);
            }
        }

        BigDecimal sold = mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(s -> Objects.equals(s.getCommodityId(), commodityId))
                .map(s -> Money.scaleQuantity(s.getWeightQuintals()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return Money.scaleQuantity(purchased.add(inward).subtract(outward).subtract(sold));
    }

    /** The full stock report shown on the inventory and dashboard screens. */
    @Transactional
    public Map<String, Object> stockReport(Long userId) {
        List<Commodity> commodities = commodityRepository.findAllByUserId(userId);
        if (commodities.isEmpty()) {
            commodities = commodityRepository.saveAll(defaultCommodities(userId));
        }

        List<PurchaseItem> items = purchaseItemRepository.findAllByUserId(userId);
        List<MandiSale> sales = mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        List<StockAdjustment> adjustments = stockAdjustmentRepository.findAllByUserId(userId);

        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal totalQuintals = BigDecimal.ZERO;
        BigDecimal totalValue = BigDecimal.ZERO;
        int totalBags = 0;

        for (Commodity commodity : commodities) {
            Long id = commodity.getId();

            BigDecimal purchasedQty = BigDecimal.ZERO;
            BigDecimal purchasedAmount = BigDecimal.ZERO;
            for (PurchaseItem item : items) {
                if (Objects.equals(item.getCommodityId(), id)) {
                    purchasedQty = purchasedQty.add(Money.scaleQuantity(item.getQuantity()));
                    purchasedAmount = purchasedAmount.add(Money.scaleMoney(item.getAmount()));
                }
            }

            BigDecimal inwardQty = BigDecimal.ZERO, outwardQty = BigDecimal.ZERO;
            int inwardBags = 0, outwardBags = 0;
            for (StockAdjustment adj : adjustments) {
                if (!Objects.equals(adj.getCommodityId(), id)) {
                    continue;
                }
                BigDecimal w = Money.scaleQuantity(adj.getWeightQuintals());
                int b = adj.getBags() == null ? 0 : adj.getBags();
                if ("inward".equalsIgnoreCase(adj.getType()) || "opening".equalsIgnoreCase(adj.getType())) {
                    inwardQty = inwardQty.add(w);
                    inwardBags += b;
                } else {
                    outwardQty = outwardQty.add(w);
                    outwardBags += b;
                }
            }

            BigDecimal soldQty = BigDecimal.ZERO, soldAmount = BigDecimal.ZERO;
            int soldBags = 0;
            for (MandiSale sale : sales) {
                if (Objects.equals(sale.getCommodityId(), id)) {
                    soldQty = soldQty.add(Money.scaleQuantity(sale.getWeightQuintals()));
                    soldAmount = soldAmount.add(Money.scaleMoney(sale.getNetAmount()));
                    soldBags += sale.getBags() == null ? 0 : sale.getBags();
                }
            }

            BigDecimal available = Money.scaleQuantity(
                    purchasedQty.add(inwardQty).subtract(outwardQty).subtract(soldQty));
            BigDecimal avgPurchaseRate = Money.isPositive(purchasedQty)
                    ? purchasedAmount.divide(purchasedQty, Money.MONEY_SCALE, RoundingMode.HALF_UP)
                    : Money.scaleMoney(commodity.getDefaultRate());
            BigDecimal avgSaleRate = Money.isPositive(soldQty)
                    ? soldAmount.divide(soldQty, Money.MONEY_SCALE, RoundingMode.HALF_UP)
                    : Money.ZERO_MONEY;

            BigDecimal stockValue = Money.scaleMoney(available.max(BigDecimal.ZERO).multiply(avgPurchaseRate));
            BigDecimal totalInward = purchasedQty.add(inwardQty);

            // Only genuinely recorded bags are counted. Purchases do not record
            // bags, so bag figures are reported as recorded-only.
            int recordedBags = Math.max(0, inwardBags - outwardBags - soldBags);

            String status = statusFor(available, totalInward);

            Map<String, Object> row = new LinkedHashMap<>();
            // The commodity id is required: the sale and stock-adjustment forms
            // post commodityId, so without it neither flow can be completed.
            row.put("id", id);
            row.put("commodityName", commodity.getName());
            row.put("quintals", available);
            row.put("isLowStock", "low_stock".equals(status));
            row.put("isOutOfStock", "out_of_stock".equals(status));
            // Figures the inventory screen displays per commodity.
            row.put("kg", Money.scaleQuantity(available.multiply(new BigDecimal("100"))));
            row.put("bags", recordedBags);
            row.put("value", stockValue);
            row.put("defaultRate", Money.scaleMoney(commodity.getDefaultRate()));
            row.put("purchasedQuintals", purchasedQty);
            row.put("purchasedAmount", Money.scaleMoney(purchasedAmount));
            row.put("avgPurchaseRate", avgPurchaseRate);
            row.put("soldQuintals", soldQty);
            row.put("soldAmount", Money.scaleMoney(soldAmount));
            row.put("avgSaleRate", avgSaleRate);
            row.put("lowStockThreshold", lowStockThreshold(totalInward));
            rows.add(row);

            if (Money.isPositive(available)) {
                totalQuintals = totalQuintals.add(available);
            }
            totalBags += recordedBags;
            totalValue = totalValue.add(stockValue);
        }

        BigDecimal salesAmount = sales.stream()
                .map(s -> Money.scaleMoney(s.getNetAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Flat totals, rather than the previous nested "summary" object. Each
        // one is shown on the inventory or dashboard tiles.
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalQuintals", Money.scaleQuantity(totalQuintals));
        result.put("totalBags", totalBags);
        result.put("totalValue", Money.scaleMoney(totalValue));
        result.put("totalSalesAmount", Money.scaleMoney(salesAmount));
        result.put("salesCount", sales.size());
        result.put("commodityCount", commodities.size());
        result.put("lowStockCount", rows.stream().filter(r -> Boolean.TRUE.equals(r.get("isLowStock"))).count());
        result.put("outOfStockCount", rows.stream().filter(r -> Boolean.TRUE.equals(r.get("isOutOfStock"))).count());
        result.put("items", rows);
        return result;
    }

    /** 10% of everything ever taken in, with a 1 quintal floor. */
    private BigDecimal lowStockThreshold(BigDecimal totalInward) {
        BigDecimal proportional = Money.scaleQuantity(totalInward.multiply(LOW_STOCK_FRACTION));
        return proportional.max(LOW_STOCK_FLOOR);
    }

    private String statusFor(BigDecimal available, BigDecimal totalInward) {
        if (!Money.isPositive(available)) {
            return "out_of_stock";
        }
        return available.compareTo(lowStockThreshold(totalInward)) < 0 ? "low_stock" : "in_stock";
    }

    private List<Commodity> defaultCommodities(Long userId) {
        return List.of(
                new Commodity(userId, "Cotton", new BigDecimal("7050.00")),
                new Commodity(userId, "Soybean", new BigDecimal("4800.00")),
                new Commodity(userId, "Moong", new BigDecimal("7600.00")),
                new Commodity(userId, "Wheat", new BigDecimal("2500.00")),
                new Commodity(userId, "Gram", new BigDecimal("5600.00")),
                new Commodity(userId, "Tur", new BigDecimal("7000.00")));
    }
}
