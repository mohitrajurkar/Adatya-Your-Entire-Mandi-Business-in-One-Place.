package com.adatya.controller;

import com.adatya.model.BusinessProfile;
import com.adatya.model.User;
import com.adatya.repository.BusinessProfileRepository;
import com.adatya.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final BusinessProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepository,
                          BusinessProfileRepository profileRepository,
                          PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String mobile = body.getOrDefault("mobile", "");
        String identifier = body.getOrDefault("identifier", "");
        String password = body.getOrDefault("password", "");

        String userKey = (!mobile.isBlank() ? mobile : identifier).trim();

        if (userKey.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Please enter mobile number and password"
            ));
        }

        Optional<User> userOpt = userRepository.findByMobile(userKey);
        if (userOpt.isPresent()) {
            User u = userOpt.get();
            boolean matches = passwordEncoder.matches(password, u.getPassword());
            
            // Backward compatibility: check plaintext and auto-migrate to BCrypt
            if (!matches && password.equals(u.getPassword())) {
                u.setPassword(passwordEncoder.encode(password));
                userRepository.save(u);
                matches = true;
            }

            if (matches) {
                // Generate a session/bearer token
                String token = UUID.randomUUID().toString().replace("-", "");

                Map<String, Object> userData = new HashMap<>();
                userData.put("id", u.getId());
                userData.put("name", u.getName());
                userData.put("businessName", u.getBusinessName() != null ? u.getBusinessName() : u.getName() + " Traders");
                userData.put("apmcLocation", u.getApmcLocation() != null ? u.getApmcLocation() : "APMC Yard");
                userData.put("role", u.getRole());
                userData.put("mobile", u.getMobile());
                userData.put("token", token);

                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "token", token,
                    "user", userData
                ));
            }
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
            "success", false,
            "error", "Invalid credentials. Please check your mobile number and password."
        ));
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        String mobile = body.getOrDefault("mobile", "").trim();
        String password = body.getOrDefault("password", "").trim();
        String role = body.getOrDefault("role", "Admin").trim();
        String businessName = body.getOrDefault("businessName", "").trim();
        String apmcLocation = body.getOrDefault("apmcLocation", "").trim();

        if (businessName.isEmpty()) businessName = name + " Trading Co.";
        if (apmcLocation.isEmpty()) apmcLocation = "APMC Yard";

        if (name.isEmpty() || mobile.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Name, 10-digit mobile number, and password are required"
            ));
        }

        if (mobile.length() < 10) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Please enter a valid 10-digit mobile number"
            ));
        }

        if (password.length() < 4) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Password must be at least 4 characters"
            ));
        }

        if (userRepository.findByMobile(mobile).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "An account with this mobile number already exists. Please login."
            ));
        }

        User newUser = new User();
        newUser.setName(name);
        newUser.setMobile(mobile);
        newUser.setPassword(passwordEncoder.encode(password));
        newUser.setRole(role);
        newUser.setBusinessName(businessName);
        newUser.setApmcLocation(apmcLocation);

        User savedUser = userRepository.save(newUser);

        // Sync business profile
        try {
            var profiles = profileRepository.findAll();
            BusinessProfile bp = profiles.isEmpty() ? new BusinessProfile() : profiles.get(0);
            bp.setBusinessName(businessName);
            bp.setProprietorName(name);
            bp.setAddress(apmcLocation);
            bp.setMobile1(mobile);
            bp.setSignatureName(name);
            bp.setTagline("Authorised Agricultural Commodity Purchaser & Mandi Commission Agent");
            profileRepository.save(bp);
        } catch (Exception e) {
            System.err.println("Profile sync error: " + e.getMessage());
        }

        String token = UUID.randomUUID().toString().replace("-", "");

        Map<String, Object> userData = new HashMap<>();
        userData.put("id", savedUser.getId());
        userData.put("name", savedUser.getName());
        userData.put("businessName", savedUser.getBusinessName());
        userData.put("apmcLocation", savedUser.getApmcLocation());
        userData.put("mobile", savedUser.getMobile());
        userData.put("role", savedUser.getRole());
        userData.put("token", token);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "token", token,
            "user", userData
        ));
    }
}
