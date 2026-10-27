package com.adatya.service;

import com.adatya.model.*;
import com.adatya.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock
    private CommodityRepository commodityRepository;

    @Mock
    private PurchaseItemRepository purchaseItemRepository;

    @Mock
    private MandiSaleRepository mandiSaleRepository;

    @Mock
    private StockAdjustmentRepository stockAdjustmentRepository;

    @InjectMocks
    private InventoryService inventoryService;

    private final Long userId = 2L;
    private final Long commodityId = 50L;
    private Commodity cottonCommodity;

    @BeforeEach
    void setUp() {
        cottonCommodity = new Commodity(userId, "Cotton", new BigDecimal("7000.00"));
        cottonCommodity.setId(commodityId);
    }

    @Test
    @DisplayName("availableQuintals accurately sums purchases, inward adjustments, and subtracts outward adjustments and sales")
    void availableQuintalsCalculatesExactNetMovement() {
        // Purchases: 50 quintals
        PurchaseItem p1 = new PurchaseItem();
        p1.setUserId(userId);
        p1.setCommodityId(commodityId);
        p1.setQuantity(new BigDecimal("50.000"));

        when(purchaseItemRepository.findAllByUserId(userId)).thenReturn(List.of(p1));

        // Inward adjustment: +10 quintals; Outward adjustment: -5 quintals
        StockAdjustment inAdj = new StockAdjustment();
        inAdj.setUserId(userId);
        inAdj.setCommodityId(commodityId);
        inAdj.setType("inward");
        inAdj.setWeightQuintals(new BigDecimal("10.000"));

        StockAdjustment outAdj = new StockAdjustment();
        outAdj.setUserId(userId);
        outAdj.setCommodityId(commodityId);
        outAdj.setType("outward");
        outAdj.setWeightQuintals(new BigDecimal("5.000"));

        when(stockAdjustmentRepository.findAllByUserId(userId)).thenReturn(List.of(inAdj, outAdj));

        // Mandi sale: -20 quintals
        MandiSale sale = new MandiSale();
        sale.setUserId(userId);
        sale.setCommodityId(commodityId);
        sale.setWeightQuintals(new BigDecimal("20.000"));

        when(mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(sale));

        // Net: 50 + 10 - 5 - 20 = 35.000 quintals
        BigDecimal available = inventoryService.availableQuintals(userId, commodityId);

        assertEquals(new BigDecimal("35.000"), available);
    }

    @Test
    @DisplayName("stockReport generates overall summaries and flags low stock when below threshold")
    void stockReportGeneratesSummaryAndFlagsLowStock() {
        when(commodityRepository.findAllByUserId(userId)).thenReturn(List.of(cottonCommodity));

        // 100 quintals purchased at Rs 7000 = Rs 700,000
        PurchaseItem p1 = new PurchaseItem();
        p1.setUserId(userId);
        p1.setCommodityId(commodityId);
        p1.setQuantity(new BigDecimal("100.000"));
        p1.setRate(new BigDecimal("7000.00"));
        p1.setAmount(new BigDecimal("700000.00"));
        when(purchaseItemRepository.findAllByUserId(userId)).thenReturn(List.of(p1));

        // Mandi sale: 95 quintals sold, leaving 5 quintals (< 10% of 100 quintals)
        MandiSale sale = new MandiSale();
        sale.setUserId(userId);
        sale.setCommodityId(commodityId);
        sale.setWeightQuintals(new BigDecimal("95.000"));
        sale.setBags(190);
        when(mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(sale));

        // 200 bags inward opening
        StockAdjustment adj = new StockAdjustment();
        adj.setUserId(userId);
        adj.setCommodityId(commodityId);
        adj.setType("opening");
        adj.setBags(200);
        adj.setWeightQuintals(BigDecimal.ZERO);
        when(stockAdjustmentRepository.findAllByUserId(userId)).thenReturn(List.of(adj));

        Map<String, Object> report = inventoryService.stockReport(userId);

        assertNotNull(report);
        assertEquals(new BigDecimal("5.000"), report.get("totalQuintals"));
        assertEquals(10, report.get("totalBags")); // 200 opening - 190 sold = 10 bags

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) report.get("items");
        assertEquals(1, items.size());
        Map<String, Object> item = items.get(0);
        assertEquals("Cotton", item.get("commodityName"));
        assertEquals(new BigDecimal("5.000"), item.get("quintals"));
        assertTrue((Boolean) item.get("isLowStock"), "Remaining 5q is < 10% of 100q inward; must be marked low stock");
    }
}
