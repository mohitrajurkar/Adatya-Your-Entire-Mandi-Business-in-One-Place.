package com.adatya.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_adjustments")
public class StockAdjustment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "commodity_id", nullable = false)
    private Long commodityId;

    @Column(nullable = false)
    private String type; // 'opening', 'inward', 'outward', 'adjustment'

    @Column(nullable = false)
    private Integer bags = 0;

    @Column(name = "weight_quintals", nullable = false, precision=12, scale=3)
    private BigDecimal weightQuintals;

    @Column(nullable = false, precision=14, scale=2)
    private BigDecimal rate = BigDecimal.ZERO;

    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private String date;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public StockAdjustment() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getCommodityId() { return commodityId; }
    public void setCommodityId(Long commodityId) { this.commodityId = commodityId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Integer getBags() { return bags; }
    public void setBags(Integer bags) { this.bags = bags; }

    public BigDecimal getWeightQuintals() { return weightQuintals; }
    public void setWeightQuintals(BigDecimal weightQuintals) { this.weightQuintals = weightQuintals; }

    public BigDecimal getRate() { return rate; }
    public void setRate(BigDecimal rate) { this.rate = rate; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
