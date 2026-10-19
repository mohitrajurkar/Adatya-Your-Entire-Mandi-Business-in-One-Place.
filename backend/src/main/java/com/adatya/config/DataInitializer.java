package com.adatya.config;

import com.adatya.model.User;
import com.adatya.repository.UserRepository;
import com.adatya.security.AuthenticatedUser;
import com.adatya.security.PasswordPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Optional one-time seeding of the platform owner account.
 *
 * What this class no longer does, and why:
 *
 *  - It no longer carries a real mobile number and password as compiled-in
 *    defaults. Both must be supplied through the environment, or no seeding
 *    happens at all.
 *  - It no longer re-encodes the admin password on every startup. That silently
 *    reverted any password the owner had changed and pinned the account to the
 *    compiled-in value forever.
 *  - It no longer deletes user rows or rewrites business profiles that match
 *    hard-coded names and mobile numbers. Startup code must never destroy data.
 *  - It no longer seeds a shared global business profile or a shared commodity
 *    list. Each trader now owns their own profile, and commodities are created
 *    per tenant on first use.
 */
@Component
@Profile("!test")
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Value("${admin.default.mobile:}")
    private String defaultAdminMobile;

    @Value("${admin.default.password:}")
    private String defaultAdminPassword;

    @Value("${admin.default.name:Administrator}")
    private String defaultAdminName;

    public DataInitializer(UserRepository userRepository,
                           org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (defaultAdminMobile == null || defaultAdminMobile.isBlank()
                || defaultAdminPassword == null || defaultAdminPassword.isBlank()) {
            log.info("No seed administrator configured (DEFAULT_ADMIN_MOBILE / DEFAULT_ADMIN_PASSWORD "
                   + "not set). Skipping initial account setup.");
            return;
        }

        String mobile = defaultAdminMobile.trim();

        Optional<User> existing = userRepository.findByMobile(mobile);
        if (existing.isPresent()) {
            // Deliberately a no-op. The account already exists, and its password
            // belongs to whoever owns it, not to this configuration file.
            log.info("Seed administrator already exists; leaving the account untouched.");
            return;
        }

        String passwordProblem = PasswordPolicy.validate(defaultAdminPassword);
        if (passwordProblem != null) {
            log.error("Refusing to seed the administrator account: configured "
                    + "DEFAULT_ADMIN_PASSWORD is not strong enough ({}).", passwordProblem);
            return;
        }

        User admin = new User();
        admin.setName(defaultAdminName);
        admin.setBusinessName(defaultAdminName);
        admin.setApmcLocation("APMC Mandi Headquarters");
        admin.setRole(AuthenticatedUser.ROLE_SUPER_ADMIN);
        admin.setMobile(mobile);
        admin.setPassword(passwordEncoder.encode(defaultAdminPassword));
        userRepository.save(admin);

        log.info("Seed administrator account created. Change this password after first sign-in, "
               + "then remove DEFAULT_ADMIN_PASSWORD from the environment.");
    }
}
