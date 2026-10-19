package com.adatya.config;

import com.adatya.model.BusinessProfile;
import com.adatya.model.Commodity;
import com.adatya.model.User;
import com.adatya.repository.BusinessProfileRepository;
import com.adatya.repository.CommodityRepository;
import com.adatya.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class DataInitializer implements CommandLineRunner {

    private final BusinessProfileRepository profileRepository;
    private final CommodityRepository commodityRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.default.mobile:9356893989}")
    private String defaultAdminMobile;

    @Value("${admin.default.password:Mohit@2810}")
    private String defaultAdminPassword;

    public DataInitializer(BusinessProfileRepository profileRepository,
                           CommodityRepository commodityRepository,
                           UserRepository userRepository,
                           PasswordEncoder passwordEncoder) {
        this.profileRepository = profileRepository;
        this.commodityRepository = commodityRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        // 1. Clean up legacy admin profiles if any exist with old demo mobile numbers (e.g. 8805978780)
        List<User> legacyUsers = userRepository.findAll();
        for (User u : legacyUsers) {
            if ("8805978780".equals(u.getMobile()) || "Maroti Bodhale".equalsIgnoreCase(u.getName())) {
                userRepository.delete(u);
                System.out.println("Removed legacy demo admin account: " + u.getMobile());
            }
        }

        // 2. Setup / Ensure Super Admin Profile (9356893989 / Mohit@2810)
        Optional<User> superAdminOpt = userRepository.findByMobile(defaultAdminMobile);
        if (superAdminOpt.isEmpty()) {
            User superAdmin = new User();
            superAdmin.setName("Mohit");
            superAdmin.setBusinessName("Mohit Traders & Mandi Broker");
            superAdmin.setApmcLocation("APMC Mandi Headquarters");
            superAdmin.setRole("SUPER_ADMIN");
            superAdmin.setMobile(defaultAdminMobile);
            superAdmin.setPassword(passwordEncoder.encode(defaultAdminPassword));
            userRepository.save(superAdmin);
            System.out.println("Super Admin profile initialized: " + defaultAdminMobile);
        } else {
            // Update password & role to ensure credentials match exactly
            User superAdmin = superAdminOpt.get();
            superAdmin.setName("Mohit");
            superAdmin.setRole("SUPER_ADMIN");
            superAdmin.setPassword(passwordEncoder.encode(defaultAdminPassword));
            userRepository.save(superAdmin);
            System.out.println("Super Admin profile verified & updated: " + defaultAdminMobile);
        }

        // 3. Seed / Update Business Profile
        if (profileRepository.count() == 0) {
            BusinessProfile profile = new BusinessProfile();
            profile.setBusinessName("Mohit Traders");
            profile.setProprietorName("Mohit");
            profile.setAddress("APMC Mandi Yard");
            profile.setMobile1(defaultAdminMobile);
            profile.setMandiLicense("APMC/MH/2026-01");
            profile.setGstin("27AAAPM2810M1Z8");
            profile.setUpiId(defaultAdminMobile + "@upi");
            profile.setSignatureName("Mohit");
            profile.setTagline("Agricultural Procurement & Mandi Commission Ledger");
            profileRepository.save(profile);
            System.out.println("Business profile initialized for Mohit Traders.");
        } else {
            List<BusinessProfile> profiles = profileRepository.findAll();
            for (BusinessProfile bp : profiles) {
                if ("8805978780".equals(bp.getMobile1()) || "Bodhale Purchaser".equalsIgnoreCase(bp.getBusinessName())) {
                    bp.setBusinessName("Mohit Traders");
                    bp.setProprietorName("Mohit");
                    bp.setMobile1(defaultAdminMobile);
                    bp.setUpiId(defaultAdminMobile + "@upi");
                    bp.setSignatureName("Mohit");
                    profileRepository.save(bp);
                    System.out.println("Updated business profile to Mohit Traders.");
                }
            }
        }

        // 4. Seed Default Commodities if none exist
        if (commodityRepository.count() == 0) {
            commodityRepository.saveAll(List.of(
                new Commodity("Cotton", 7050.0),
                new Commodity("Soybean", 4800.0),
                new Commodity("Moong", 7600.0),
                new Commodity("Wheat", 2500.0),
                new Commodity("Gram", 5600.0),
                new Commodity("Tur", 7000.0)
            ));
            System.out.println("Default commodities seeded.");
        }
    }
}
