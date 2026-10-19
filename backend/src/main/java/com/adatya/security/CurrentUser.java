package com.adatya.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * The only supported way for application code to learn who is calling.
 *
 * This replaces the previous UserContextHelper, which trusted an X-User-Id
 * request header or a userId query parameter and silently fell back to the
 * super-admin account when neither was present. Both the spoofing hole and the
 * fallback (which collapsed every trader into one shared tenant) are gone:
 * there is no way to obtain a tenant id here other than a verified token.
 */
@Component
public class CurrentUser {

    /** Throws AccessDeniedException when the request is not authenticated. */
    public AuthenticatedUser require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new AccessDeniedException("This operation requires an authenticated user");
        }
        return user;
    }

    /** The authenticated tenant id that every query must be scoped to. */
    public Long id() {
        return require().getUserId();
    }

    public String mobile() {
        return require().getMobile();
    }

    public boolean isSuperAdmin() {
        return require().isSuperAdmin();
    }
}
