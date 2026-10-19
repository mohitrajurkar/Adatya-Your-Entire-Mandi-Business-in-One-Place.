package com.adatya.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "purchases")
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "purchase_number", nullable = false)
    private String purchaseNumber;

    @Column(nullable = false)
    private String date;

    @Column(name = "farmer_id", nullable = false)
    private Long farmerId;

    @Column(name = "total_amount", nullable = false)
    private Double totalAmount;

    @Column(name = "advance_paid", nullable = false)
    private Double advancePaid;

    @Column(name = "remaining_amount", nullable = false)
    private Double remainingAmount;

    @Column(nullable = false)
    private String status; // 'Paid', 'Partial', 'Pending'

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

    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }

    public Double getAdvancePaid() { return advancePaid; }
    public void setAdvancePaid(Double advancePaid) { this.advancePaid = advancePaid; }

    public Double getRemainingAmount() { return remainingAmount; }
    public void setRemainingAmount(Double remainingAmount) { this.remainingAmount = remainingAmount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
