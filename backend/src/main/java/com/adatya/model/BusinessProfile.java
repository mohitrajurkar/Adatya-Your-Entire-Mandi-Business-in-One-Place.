package com.adatya.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "business_profile")
public class BusinessProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "business_name", nullable = false)
    private String businessName = "Adatya Trader";

    @Column(name = "proprietor_name", nullable = false)
    private String proprietorName = "Trader";

    @Column(nullable = false)
    private String address = "APMC Mandi Yard";

    @Column(nullable = false)
    private String mobile1 = "";

    private String mobile2 = "";

    @Column(name = "mandi_license")
    private String mandiLicense = "";

    private String gstin = "";

    @Column(name = "upi_id")
    private String upiId = "";

    @Column(name = "signature_data", columnDefinition = "TEXT")
    private String signatureData;

    @Column(name = "signature_type")
    private String signatureType = "draw";

    @Column(name = "signature_name")
    private String signatureName = "";

    private String tagline = "Agricultural Procurement & Mandi Commission Ledger";

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public BusinessProfile() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getBusinessName() { return businessName; }
    public void setBusinessName(String businessName) { this.businessName = businessName; }

    public String getProprietorName() { return proprietorName; }
    public void setProprietorName(String proprietorName) { this.proprietorName = proprietorName; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getMobile1() { return mobile1; }
    public void setMobile1(String mobile1) { this.mobile1 = mobile1; }

    public String getMobile2() { return mobile2; }
    public void setMobile2(String mobile2) { this.mobile2 = mobile2; }

    public String getMandiLicense() { return mandiLicense; }
    public void setMandiLicense(String mandiLicense) { this.mandiLicense = mandiLicense; }

    public String getGstin() { return gstin; }
    public void setGstin(String gstin) { this.gstin = gstin; }

    public String getUpiId() { return upiId; }
    public void setUpiId(String upiId) { this.upiId = upiId; }

    public String getSignatureData() { return signatureData; }
    public void setSignatureData(String signatureData) { this.signatureData = signatureData; }

    public String getSignatureType() { return signatureType; }
    public void setSignatureType(String signatureType) { this.signatureType = signatureType; }

    public String getSignatureName() { return signatureName; }
    public void setSignatureName(String signatureName) { this.signatureName = signatureName; }

    public String getTagline() { return tagline; }
    public void setTagline(String tagline) { this.tagline = tagline; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
