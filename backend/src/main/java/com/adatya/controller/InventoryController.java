package com.adatya.controller;

import com.adatya.security.CurrentUser;
import com.adatya.model.*;
import com.adatya.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final CommodityRepository commodityRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final MandiSaleRepository mandiSaleRepository;
    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final CurrentUser currentUser;

    public InventoryController(CommodityRepository commodityRepository,
                               PurchaseItemRepository purchaseItemRepository,
                               MandiSaleRepository mandiSaleRepository,
                               StockAdjustmentRepository stockAdjustmentRepository,
                               CurrentUser currentUser) {
        this.commodityRepository = commodityRepository;
        this.purchaseItemRepository = purchaseItemRepository;
        this.mandiSaleRepository = mandiSaleRepository;
        this.stockAdjustmentRepository = stockAdjustmentRepository;
        this.currentUser = currentUser;
    }

    @GetMapping("/stock")
    public ResponseEntity<Map<String, Object>> getStock() {
        Long userId = currentUser.id();

        List<Commodity> allCommodities = commodityRepository.findAllByUserId(userId);
        if (allCommodities.isEmpty()) {
            // Auto seed commodities for this user
            allCommodities = commodityRepository.saveAll(List.of(
                new Commodity(userId, "Cotton", 7050.0),
                new Commodity(userId, "Soybean", 4800.0),
                new Commodity(userId, "Moong", 7600.0),
                new Commodity(userId, "Wheat", 2500.0),
                new Commodity(userId, "Gram", 5600.0),
                new Commodity(userId, "Tur", 7000.0)
            ));
        }

        List<PurchaseItem> allPurchaseItems = purchaseItemRepository.findAllByUserId(userId);
        List<MandiSale> allSales = mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        List<StockAdjustment> allAdjustments = stockAdjustmentRepository.findAllByUserId(userId);

        List<Map<String, Object>> stockPerCommodity = new ArrayList<>();
        double totalStockQuintals = 0.0;
        int totalStockBags = 0;
        double totalStockValue = 0.0;

        for (Commodity comm : allCommodities) {
            Long cId = comm.getId();

            double purchasedQuintals = 0.0;
            double purchasedAmount = 0.0;
            int purchasedBags = 0;

            for (PurchaseItem pi : allPurchaseItems) {
                if (Objects.equals(pi.getCommodityId(), cId)) {
                    double q = pi.getQuantity() != null ? pi.getQuantity() : 0.0;
                    purchasedQuintals += q;
                    purchasedAmount += (pi.getAmount() != null ? pi.getAmount() : 0.0);
                    purchasedBags += Math.round(q * 2);
                }
            }

            double avgPurchaseRate = purchasedQuintals > 0 ? (purchasedAmount / purchasedQuintals) : comm.getDefaultRate();

            double adjInwardQuintals = 0.0;
            int adjInwardBags = 0;
            double adjOutwardQuintals = 0.0;
            int adjOutwardBags = 0;

            for (StockAdjustment adj : allAdjustments) {
                if (Objects.equals(adj.getCommodityId(), cId)) {
                    double w = adj.getWeightQuintals() != null ? adj.getWeightQuintals() : 0.0;
                    int b = adj.getBags() != null ? adj.getBags() : 0;
                    if ("inward".equalsIgnoreCase(adj.getType()) || "opening".equalsIgnoreCase(adj.getType())) {
                        adjInwardQuintals += w;
                        adjInwardBags += b;
                    } else {
                        adjOutwardQuintals += w;
                        adjOutwardBags += b;
                    }
                }
            }

            double soldQuintals = 0.0;
            int soldBags = 0;
            double soldAmount = 0.0;

            for (MandiSale sale : allSales) {
                if (Objects.equals(sale.getCommodityId(), cId)) {
                    soldQuintals += (sale.getWeightQuintals() != null ? sale.getWeightQuintals() : 0.0);
                    soldBags += (sale.getBags() != null ? sale.getBags() : 0);
                    soldAmount += (sale.getNetAmount() != null ? sale.getNetAmount() : 0.0);
                }
            }

            double avgSaleRate = soldQuintals > 0 ? (soldAmount / soldQuintals) : 0.0;

            double totalInwardQuintals = purchasedQuintals + adjInwardQuintals;
            double totalOutwardQuintals = soldQuintals + adjOutwardQuintals;
            double availableQuintals = Math.round((totalInwardQuintals - totalOutwardQuintals) * 100.0) / 100.0;
            double availableKg = Math.round(availableQuintals * 100.0 * 10.0) / 10.0;
            int totalInwardBags = purchasedBags + adjInwardBags;
            int totalOutwardBags = soldBags + adjOutwardBags;
            int availableBags = Math.max(0, totalInwardBags - totalOutwardBags);

            double stockValue = Math.round(Math.max(0.0, availableQuintals) * avgPurchaseRate * 100.0) / 100.0;

            String status = availableQuintals <= 0 ? "out_of_stock" : (availableQuintals < 10 ? "low_stock" : "in_stock");

            totalStockQuintals += Math.max(0.0, availableQuintals);
            totalStockBags += availableBags;
            totalStockValue += stockValue;

            Map<String, Object> cMap = new HashMap<>();
            cMap.put("id", comm.getId());
            cMap.put("name", comm.getName());
            cMap.put("defaultRate", comm.getDefaultRate());
            cMap.put("purchasedQuintals", Math.round(purchasedQuintals * 100.0) / 100.0);
            cMap.put("purchasedBags", purchasedBags);
            cMap.put("purchasedAmount", Math.round(purchasedAmount * 100.0) / 100.0);
            cMap.put("avgPurchaseRate", Math.round(avgPurchaseRate * 100.0) / 100.0);
            cMap.put("soldQuintals", Math.round(soldQuintals * 100.0) / 100.0);
            cMap.put("soldBags", soldBags);
            cMap.put("soldAmount", Math.round(soldAmount * 100.0) / 100.0);
            cMap.put("avgSaleRate", Math.round(avgSaleRate * 100.0) / 100.0);
            cMap.put("adjInwardQuintals", Math.round(adjInwardQuintals * 100.0) / 100.0);
            cMap.put("adjOutwardQuintals", Math.round(adjOutwardQuintals * 100.0) / 100.0);
            cMap.put("availableQuintals", availableQuintals);
            cMap.put("availableKg", availableKg);
            cMap.put("availableBags", availableBags);
            cMap.put("stockValue", stockValue);
            cMap.put("status", status);

            stockPerCommodity.add(cMap);
        }

        double totalMandiSalesAmount = allSales.stream().mapToDouble(s -> s.getNetAmount() != null ? s.getNetAmount() : 0.0).sum();

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalStockQuintals", Math.round(totalStockQuintals * 100.0) / 100.0);
        summary.put("totalStockBags", totalStockBags);
        summary.put("totalStockValue", Math.round(totalStockValue * 100.0) / 100.0);
        summary.put("totalMandiSalesAmount", Math.round(totalMandiSalesAmount * 100.0) / 100.0);
        summary.put("totalSalesCount", allSales.size());
        summary.put("commoditiesCount", allCommodities.size());

        return ResponseEntity.ok(Map.of(
            "success", true,
            "stock", stockPerCommodity,
            "summary", summary
        ));
    }
}
