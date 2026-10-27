package com.adatya.service;

import com.adatya.domain.Money;
import com.adatya.dto.PurchaseRequests.AddPayment;
import com.adatya.dto.PurchaseRequests.CreatePurchase;
import com.adatya.dto.PurchaseRequests.PurchaseLine;
import com.adatya.model.*;
import com.adatya.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PurchaseServiceTest {

    @Mock
    private PurchaseRepository purchaseRepository;

    @Mock
    private PurchaseItemRepository purchaseItemRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private FarmerRepository farmerRepository;

    @Mock
    private CommodityRepository commodityRepository;

    @InjectMocks
    private PurchaseService purchaseService;

    private final Long userId = 1L;
    private final Long farmerId = 10L;
    private Farmer testFarmer;
    private Commodity testCommodity;

    @BeforeEach
    void setUp() {
        testFarmer = new Farmer();
        testFarmer.setId(farmerId);
        testFarmer.setUserId(userId);
        testFarmer.setName("Ramesh Patil");
        testFarmer.setOutstandingBalance(BigDecimal.ZERO);

        testCommodity = new Commodity(userId, "Soybean", new BigDecimal("4500.00"));
        testCommodity.setId(100L);
    }

    @Test
    @DisplayName("Successfully creates purchase with correct line calculations, remaining balance and farmer ledger update")
    void createPurchaseSuccess() {
        when(farmerRepository.findByIdAndUserId(farmerId, userId)).thenReturn(Optional.of(testFarmer));
        when(commodityRepository.findById(100L)).thenReturn(Optional.of(testCommodity));

        Purchase savedPurchase = new Purchase();
        savedPurchase.setId(500L);
        savedPurchase.setUserId(userId);
        savedPurchase.setFarmerId(farmerId);
        when(purchaseRepository.saveAndFlush(any(Purchase.class))).thenAnswer(invocation -> {
            Purchase p = invocation.getArgument(0);
            p.setId(500L);
            return p;
        });

        // 10 quintals at Rs 4500.00 = Rs 45,000.00. Advance = Rs 10,000.00. Remaining = Rs 35,000.00.
        PurchaseLine line = new PurchaseLine("100", null, new BigDecimal("10.000"), new BigDecimal("4500.00"));
        CreatePurchase request = new CreatePurchase(
                farmerId, "2026-10-21", "PUR-001", List.of(line),
                new BigDecimal("10000.00"), "CASH", "req-uuid-1");

        Purchase result = purchaseService.createPurchase(userId, request);

        assertNotNull(result);
        assertEquals(new BigDecimal("45000.00"), result.getTotalAmount());
        assertEquals(new BigDecimal("10000.00"), result.getAdvancePaid());
        assertEquals(new BigDecimal("35000.00"), result.getRemainingAmount());
        assertEquals("Partial", result.getStatus());

        verify(purchaseItemRepository, times(1)).save(any(PurchaseItem.class));
        verify(paymentRepository, times(1)).save(any(Payment.class)); // Advance payment recorded
        verify(farmerRepository, times(1)).save(testFarmer);
    }

    @Test
    @DisplayName("Idempotent purchase creation returns existing purchase when clientRequestId was already processed")
    void createPurchaseIdempotentRetryReturnsExisting() {
        String requestId = "idemp-key-12345";
        Purchase existing = new Purchase();
        existing.setId(999L);
        existing.setClientRequestId(requestId);
        existing.setTotalAmount(new BigDecimal("25000.00"));

        when(purchaseRepository.findByUserIdAndClientRequestId(userId, requestId))
                .thenReturn(Optional.of(existing));

        PurchaseLine line = new PurchaseLine("100", null, new BigDecimal("5.000"), new BigDecimal("5000.00"));
        CreatePurchase request = new CreatePurchase(
                farmerId, "2026-10-21", "PUR-002", List.of(line),
                new BigDecimal("5000.00"), "ONLINE", requestId);

        Purchase result = purchaseService.createPurchase(userId, request);

        assertSame(existing, result);
        verify(purchaseRepository, never()).saveAndFlush(any(Purchase.class));
        verify(farmerRepository, never()).findByIdAndUserId(any(), any());
    }

    @Test
    @DisplayName("Throws IllegalArgumentException if quantity is zero or negative")
    void createPurchaseRejectsZeroOrNegativeQuantity() {
        when(farmerRepository.findByIdAndUserId(farmerId, userId)).thenReturn(Optional.of(testFarmer));
        when(commodityRepository.findById(100L)).thenReturn(Optional.of(testCommodity));

        PurchaseLine zeroLine = new PurchaseLine("100", null, BigDecimal.ZERO, new BigDecimal("4500.00"));
        CreatePurchase request = new CreatePurchase(
                farmerId, "2026-10-21", "PUR-003", List.of(zeroLine),
                BigDecimal.ZERO, "CASH", null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> purchaseService.createPurchase(userId, request));
        assertTrue(ex.getMessage().contains("Quantity must be greater than zero"));
    }

    @Test
    @DisplayName("Throws IllegalArgumentException if advance payment exceeds total bill amount")
    void createPurchaseRejectsAdvanceExceedingTotal() {
        when(farmerRepository.findByIdAndUserId(farmerId, userId)).thenReturn(Optional.of(testFarmer));
        when(commodityRepository.findById(100L)).thenReturn(Optional.of(testCommodity));

        // Total = 10 * 1000 = 10,000. Advance = 15,000 -> Exceeds total!
        PurchaseLine line = new PurchaseLine("100", null, new BigDecimal("10.000"), new BigDecimal("1000.00"));
        CreatePurchase request = new CreatePurchase(
                farmerId, "2026-10-21", "PUR-004", List.of(line),
                new BigDecimal("15000.00"), "CASH", null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> purchaseService.createPurchase(userId, request));
        assertTrue(ex.getMessage().contains("cannot be more than the bill total"),
                "Unexpected message: " + ex.getMessage());
    }

    @Test
    @DisplayName("addPayment successfully records installment, reduces remaining balance and marks as Paid when balance reaches zero")
    void addPaymentSuccess() {
        Long purchaseId = 777L;
        Purchase purchase = new Purchase();
        purchase.setId(purchaseId);
        purchase.setUserId(userId);
        purchase.setFarmerId(farmerId);
        purchase.setTotalAmount(new BigDecimal("50000.00"));
        purchase.setAdvancePaid(new BigDecimal("20000.00"));
        purchase.setRemainingAmount(new BigDecimal("30000.00"));
        purchase.setStatus("Partial");

        when(purchaseRepository.findByIdAndUserId(purchaseId, userId)).thenReturn(Optional.of(purchase));
        when(farmerRepository.findByIdAndUserId(farmerId, userId)).thenReturn(Optional.of(testFarmer));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));

        // Pay the remaining 30,000.00 in full
        AddPayment paymentRequest = new AddPayment(
                new BigDecimal("30000.00"), "BANK_TRANSFER", "2026-10-22", "pay-req-001");

        Payment payment = purchaseService.addPayment(userId, purchaseId, paymentRequest);

        assertNotNull(payment);
        assertEquals(new BigDecimal("30000.00"), payment.getAmount());
        assertEquals(new BigDecimal("50000.00"), purchase.getAdvancePaid());
        assertEquals(new BigDecimal("0.00"), purchase.getRemainingAmount());
        assertEquals("Paid", purchase.getStatus());

        verify(paymentRepository, times(1)).save(any(Payment.class));
        verify(farmerRepository, times(1)).save(testFarmer);
    }

    @Test
    @DisplayName("addPayment rejects payment that exceeds remaining bill balance")
    void addPaymentRejectsOverpayment() {
        Long purchaseId = 777L;
        Purchase purchase = new Purchase();
        purchase.setId(purchaseId);
        purchase.setUserId(userId);
        purchase.setRemainingAmount(new BigDecimal("1000.00"));

        when(purchaseRepository.findByIdAndUserId(purchaseId, userId)).thenReturn(Optional.of(purchase));

        AddPayment overpayRequest = new AddPayment(
                new BigDecimal("1500.00"), "CASH", "2026-10-22", null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> purchaseService.addPayment(userId, purchaseId, overpayRequest));
        assertTrue(ex.getMessage().contains("more than the outstanding balance"),
                "Unexpected message: " + ex.getMessage());
    }

    @Test
    @DisplayName("deletePurchase removes items, payments, purchase and updates farmer balance")
    void deletePurchaseSuccess() {
        Long purchaseId = 888L;
        Purchase purchase = new Purchase();
        purchase.setId(purchaseId);
        purchase.setUserId(userId);
        purchase.setFarmerId(farmerId);
        purchase.setTotalAmount(new BigDecimal("10000.00"));
        purchase.setRemainingAmount(new BigDecimal("10000.00"));

        when(purchaseRepository.findByIdAndUserId(purchaseId, userId)).thenReturn(Optional.of(purchase));
        when(farmerRepository.findByIdAndUserId(farmerId, userId)).thenReturn(Optional.of(testFarmer));

        purchaseService.deletePurchase(userId, purchaseId);

        verify(purchaseItemRepository).deleteAllByPurchaseId(purchaseId);
        verify(paymentRepository).deleteAllByPurchaseId(purchaseId);
        verify(purchaseRepository).deleteById(purchaseId);
        verify(farmerRepository).save(testFarmer);
    }
}
