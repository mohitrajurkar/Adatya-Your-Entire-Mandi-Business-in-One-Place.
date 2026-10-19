package com.adatya.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "purchases")
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "purchase_number", nullable = false)
    private String purchaseNumber;

    @Column(nullable = false)
    private String date;

    @Column(name = "farmer_id", nullable = false)
    private Long farmerId;

    @Column(name = "total_amount", nullable = false, precision=14, scale=2)
    private BigDecimal totalAmount;

    @Column(name = "advance_paid", nullable = false, precision=14, scale=2)
    private BigDecimal advancePaid;

    @Column(name = "remaining_amount", nullable = false, precision=14, scale=2)
    private BigDecimal remainingAmount;

    @Column(nullable = false)
    private String status; // 'Paid', 'Partial', 'Pending'

    /**
     * Idempotency key for one client submission. When the same key arrives
     * again the original record is returned instead of a second one being
     * created, which is what a double tap on a slow connection produces.
     */
    @Column(name = "client_request_id", length = 100)
    private String clientRequestId;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Purchase() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getPurchaseNumber() { return purchaseNumber; }
    public void setPurchaseNumber(String purchaseNumber) { this.purchaseNumber = purchaseNumber; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public Long getFarmerId() { return farmerId; }
    public void setFarmerId(Long farmerId) { this.farmerId = farmerId; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getAdvancePaid() { return advancePaid; }
    public void setAdvancePaid(BigDecimal advancePaid) { this.advancePaid = advancePaid; }

    public BigDecimal getRemainingAmount() { return remainingAmount; }
    public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getClientRequestId() { return clientRequestId; }
    public void setClientRequestId(String clientRequestId) { this.clientRequestId = clientRequestId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
