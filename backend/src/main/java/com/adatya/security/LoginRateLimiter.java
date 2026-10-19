package com.adatya.security;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Throttles repeated failed logins, which were previously unlimited.
 *
 * Counting is per mobile number and per client address, in a sliding window
 * held in memory. That is sufficient for a single-instance deployment; a
 * shared store would be needed if Adatya is ever scaled horizontally.
 */
@Component
public class LoginRateLimiter {

    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_TRACKED_KEYS = 10000;

    private final Map<String, Window> failures = new ConcurrentHashMap<>();

    private static final class Window {
        final AtomicInteger count = new AtomicInteger();
        volatile Instant firstFailure = Instant.now();
    }

    public boolean isBlocked(String key) {
        Window window = failures.get(key);
        if (window == null) {
            return false;
        }
        if (isExpired(window)) {
            failures.remove(key);
            return false;
        }
        return window.count.get() >= MAX_FAILURES;
    }

    public void recordFailure(String key) {
        purgeIfCrowded();
        Window window = failures.computeIfAbsent(key, k -> new Window());
        if (isExpired(window)) {
            window.count.set(0);
            window.firstFailure = Instant.now();
        }
        window.count.incrementAndGet();
    }

    public void recordSuccess(String key) {
        failures.remove(key);
    }

    /** Seconds the caller must wait, for the Retry-After response header. */
    public long retryAfterSeconds(String key) {
        Window window = failures.get(key);
        if (window == null) {
            return 0;
        }
        long remaining = WINDOW.minus(Duration.between(window.firstFailure, Instant.now())).getSeconds();
        return Math.max(0, remaining);
    }

    private boolean isExpired(Window window) {
        return Duration.between(window.firstFailure, Instant.now()).compareTo(WINDOW) > 0;
    }

    /** Keeps the map bounded so it cannot be grown without limit by random logins. */
    private void purgeIfCrowded() {
        if (failures.size() < MAX_TRACKED_KEYS) {
            return;
        }
        failures.entrySet().removeIf(entry -> isExpired(entry.getValue()));
    }
}
