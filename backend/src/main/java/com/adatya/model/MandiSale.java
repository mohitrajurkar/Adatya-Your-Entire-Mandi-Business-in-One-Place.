package com.adatya.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "mandi_sales")
public class MandiSale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "sale_number", nullable = false)
    private String saleNumber;

    @Column(nullable = false)
    private String date;

    @Column(name = "commodity_id", nullable = false)
    private Long commodityId;

    @Column(name = "buyer_name", nullable = false)
    private String buyerName;

    @Column(name = "buyer_mobile")
    private String buyerMobile;

    @Column(name = "buyer_location")
    private String buyerLocation;

    @Column(name = "vehicle_number")
    private String vehicleNumber;

    @Column(nullable = false)
    private Integer bags = 0;

    @Column(name = "weight_quintals", nullable = false, precision=12, scale=3)
    private BigDecimal weightQuintals;

    @Column(name = "sale_rate", nullable = false, precision=14, scale=2)
    private BigDecimal saleRate;

    @Column(nullable = false, precision=14, scale=2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision=14, scale=2)
    private BigDecimal hamali = BigDecimal.ZERO;

    @Column(nullable = false, precision=14, scale=2)
    private BigDecimal transport = BigDecimal.ZERO;

    @Column(name = "mandi_cess", nullable = false, precision=14, scale=2)
    private BigDecimal mandiCess = BigDecimal.ZERO;

    @Column(name = "net_amount", nullable = false, precision=14, scale=2)
    private BigDecimal netAmount;

    @Column(name = "payment_status", nullable = false)
    private String paymentStatus = "Paid"; // 'Paid', 'Partial', 'Pending'

    @Column(name = "payment_mode", nullable = false)
    private String paymentMode = "Cash";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public MandiSale() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getSaleNumber() { return saleNumber; }
    public void setSaleNumber(String saleNumber) { this.saleNumber = saleNumber; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public Long getCommodityId() { return commodityId; }
    public void setCommodityId(Long commodityId) { this.commodityId = commodityId; }

    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }

    public String getBuyerMobile() { return buyerMobile; }
    public void setBuyerMobile(String buyerMobile) { this.buyerMobile = buyerMobile; }

    public String getBuyerLocation() { return buyerLocation; }
    public void setBuyerLocation(String buyerLocation) { this.buyerLocation = buyerLocation; }

    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }

    public Integer getBags() { return bags; }
    public void setBags(Integer bags) { this.bags = bags; }

    public BigDecimal getWeightQuintals() { return weightQuintals; }
    public void setWeightQuintals(BigDecimal weightQuintals) { this.weightQuintals = weightQuintals; }

    public BigDecimal getSaleRate() { return saleRate; }
    public void setSaleRate(BigDecimal saleRate) { this.saleRate = saleRate; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }

    public BigDecimal getHamali() { return hamali; }
    public void setHamali(BigDecimal hamali) { this.hamali = hamali; }

    public BigDecimal getTransport() { return transport; }
    public void setTransport(BigDecimal transport) { this.transport = transport; }

    public BigDecimal getMandiCess() { return mandiCess; }
    public void setMandiCess(BigDecimal mandiCess) { this.mandiCess = mandiCess; }

    public BigDecimal getNetAmount() { return netAmount; }
    public void setNetAmount(BigDecimal netAmount) { this.netAmount = netAmount; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
