package com.adatya.config;

import com.adatya.model.User;
import com.adatya.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class UserContextHelper {

    private final UserRepository userRepository;

    public UserContextHelper(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Long resolveUserId(HttpServletRequest request) {
        if (request != null) {
            String headerVal = request.getHeader("X-User-Id");
            if (headerVal != null && !headerVal.isBlank()) {
                try {
                    return Long.valueOf(headerVal.trim());
                } catch (Exception ignored) {}
            }

            String paramVal = request.getParameter("userId");
            if (paramVal != null && !paramVal.isBlank()) {
                try {
                    return Long.valueOf(paramVal.trim());
                } catch (Exception ignored) {}
            }
        }

        // Fallback: look up default active user
        Optional<User> superAdmin = userRepository.findByMobile("9356893989");
        if (superAdmin.isPresent()) {
            return superAdmin.get().getId();
        }

        return userRepository.findAll().stream()
                .findFirst()
                .map(User::getId)
                .orElse(1L);
    }
}
