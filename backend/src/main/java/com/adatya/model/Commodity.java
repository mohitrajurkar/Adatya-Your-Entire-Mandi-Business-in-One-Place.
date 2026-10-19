package com.adatya.model;

import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "commodities")
public class Commodity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name;

    @Column(name = "default_rate", nullable = false, precision=14, scale=2)
    private BigDecimal defaultRate;

    public Commodity() {}

    public Commodity(String name, BigDecimal defaultRate) {
        this.name = name;
        this.defaultRate = defaultRate;
    }

    public Commodity(Long userId, String name, BigDecimal defaultRate) {
        this.userId = userId;
        this.name = name;
        this.defaultRate = defaultRate;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BigDecimal getDefaultRate() { return defaultRate; }
    public void setDefaultRate(BigDecimal defaultRate) { this.defaultRate = defaultRate; }
}
