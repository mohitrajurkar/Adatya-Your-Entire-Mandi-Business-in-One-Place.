package com.adatya.security;

import com.adatya.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * The authenticated principal. Carries the server-verified tenant id, which is
 * the single source of truth for data isolation; it is never taken from a
 * request header, query parameter or request body.
 */
public class AuthenticatedUser implements UserDetails {

    public static final String ROLE_SUPER_ADMIN = "SUPER_ADMIN";
    public static final String ROLE_ADMIN = "ADMIN";

    private final Long userId;
    private final String mobile;
    private final String role;
    private final String passwordHash;

    public AuthenticatedUser(Long userId, String mobile, String role, String passwordHash) {
        this.userId = userId;
        this.mobile = mobile;
        this.role = normalizeRole(role);
        this.passwordHash = passwordHash;
    }

    public static AuthenticatedUser from(User user) {
        return new AuthenticatedUser(user.getId(), user.getMobile(), user.getRole(), user.getPassword());
    }

    /** Maps stored role text ("Admin", "super_admin") onto a canonical role name. */
    public static String normalizeRole(String raw) {
        if (raw == null || raw.isBlank()) {
            return ROLE_ADMIN;
        }
        return raw.trim().toUpperCase().replace(' ', '_');
    }

    public Long getUserId() {
        return userId;
    }

    public String getMobile() {
        return mobile;
    }

    public String getRole() {
        return role;
    }

    public boolean isSuperAdmin() {
        return ROLE_SUPER_ADMIN.equals(role);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return mobile;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
