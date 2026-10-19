package com.adatya.controller;

import com.adatya.model.BusinessProfile;
import com.adatya.model.User;
import com.adatya.repository.BusinessProfileRepository;
import com.adatya.repository.UserRepository;
import com.adatya.security.AuthenticatedUser;
import com.adatya.security.CurrentUser;
import com.adatya.security.JwtService;
import com.adatya.security.LoginRateLimiter;
import com.adatya.security.PasswordPolicy;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final BusinessProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginRateLimiter rateLimiter;
    private final CurrentUser currentUser;

    public AuthController(UserRepository userRepository,
                          BusinessProfileRepository profileRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService,
                          LoginRateLimiter rateLimiter,
                          CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
        this.currentUser = currentUser;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body,
                                                     HttpServletRequest request) {
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

        String throttleKey = userKey + "|" + clientAddress(request);
        if (rateLimiter.isBlocked(throttleKey)) {
            long retryAfter = rateLimiter.retryAfterSeconds(throttleKey);
            log.warn("Login throttled for mobile ending {} after repeated failures", maskMobile(userKey));
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(retryAfter))
                    .body(Map.of(
                        "success", false,
                        "error", "Too many failed attempts. Please try again in "
                                 + Math.max(1, retryAfter / 60) + " minute(s)."
                    ));
        }

        Optional<User> userOpt = userRepository.findByMobile(userKey);

        // Plaintext password comparison has been removed: only BCrypt hashes are
        // accepted, so a row holding a plaintext password can no longer sign in.
        if (userOpt.isPresent() && passwordEncoder.matches(password, userOpt.get().getPassword())) {
            rateLimiter.recordSuccess(throttleKey);
            User user = userOpt.get();

            String token = jwtService.issueToken(
                    user.getId(), user.getMobile(), AuthenticatedUser.normalizeRole(user.getRole()));

            return ResponseEntity.ok(Map.of(
                "success", true,
                "token", token,
                "expiresInSeconds", jwtService.getTtlSeconds(),
                "user", toUserPayload(user)
            ));
        }

        rateLimiter.recordFailure(throttleKey);

        // Deliberately identical response whether or not the account exists, so
        // the endpoint cannot be used to enumerate registered mobile numbers.
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
            "success", false,
            "error", "Invalid credentials. Please check your mobile number and password."
        ));
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body,
                                                        HttpServletRequest request) {
        String name = body.getOrDefault("name", "").trim();
        String mobile = body.getOrDefault("mobile", "").trim();
        String password = body.getOrDefault("password", "");
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

        if (!mobile.matches("\\d{10}")) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Please enter a valid 10-digit mobile number"
            ));
        }

        String passwordProblem = PasswordPolicy.validate(password);
        if (passwordProblem != null) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", passwordProblem
            ));
        }

        String throttleKey = "register|" + clientAddress(request);
        if (rateLimiter.isBlocked(throttleKey)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                "success", false,
                "error", "Too many registration attempts. Please try again later."
            ));
        }

        if (userRepository.findByMobile(mobile).isPresent()) {
            rateLimiter.recordFailure(throttleKey);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "An account with this mobile number already exists. Please login."
            ));
        }

        User newUser = new User();
        newUser.setName(name);
        newUser.setMobile(mobile);
        newUser.setPassword(passwordEncoder.encode(password));
        // Role is assigned by the server. It was previously taken from the
        // request body, which let anyone register themselves as SUPER_ADMIN.
        newUser.setRole(AuthenticatedUser.ROLE_ADMIN);
        newUser.setBusinessName(businessName);
        newUser.setApmcLocation(apmcLocation);

        User savedUser = userRepository.save(newUser);

        // Each trader gets their OWN business profile. Registration used to
        // overwrite the single shared profile row, replacing the firm name,
        // GSTIN, licence and signature belonging to another trader.
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(savedUser.getId());
        profile.setBusinessName(businessName);
        profile.setProprietorName(name);
        profile.setAddress(apmcLocation);
        profile.setMobile1(mobile);
        profile.setSignatureName(name);
        profile.setTagline("Authorised Agricultural Commodity Purchaser & Mandi Commission Agent");
        profileRepository.save(profile);

        String token = jwtService.issueToken(
                savedUser.getId(), savedUser.getMobile(), AuthenticatedUser.normalizeRole(savedUser.getRole()));

        log.info("New trader account registered (id={})", savedUser.getId());

        return ResponseEntity.ok(Map.of(
            "success", true,
            "token", token,
            "expiresInSeconds", jwtService.getTtlSeconds(),
            "user", toUserPayload(savedUser)
        ));
    }

    /**
     * Returns the signed-in account. The frontend uses this to confirm a stored
     * token is still valid instead of trusting its own local storage.
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me() {
        return userRepository.findById(currentUser.id())
                .map(user -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "user", toUserPayload(user))))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                        "success", false,
                        "error", "Session is no longer valid. Please sign in again.")));
    }

    private Map<String, Object> toUserPayload(User user) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", user.getId());
        payload.put("name", user.getName());
        payload.put("businessName", user.getBusinessName() != null
                ? user.getBusinessName() : user.getName() + " Traders");
        payload.put("apmcLocation", user.getApmcLocation() != null ? user.getApmcLocation() : "APMC Yard");
        payload.put("role", AuthenticatedUser.normalizeRole(user.getRole()));
        payload.put("mobile", user.getMobile());
        return payload;
    }

    private String clientAddress(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private String maskMobile(String mobile) {
        if (mobile == null || mobile.length() < 4) {
            return "****";
        }
        return "****" + mobile.substring(mobile.length() - 4);
    }
}
