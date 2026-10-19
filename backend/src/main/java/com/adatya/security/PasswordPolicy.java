package com.adatya.security;

/**
 * Minimum strength rules for new and changed passwords.
 *
 * Existing accounts are not forced to reset, but any password set from now on
 * must satisfy these rules. The previous 4-character minimum left accounts
 * (identified by publicly known mobile numbers) trivially guessable.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 100;

    private PasswordPolicy() {
    }

    /**
     * Returns null when the password is acceptable, otherwise a message that is
     * safe to show to the user.
     */
    public static String validate(String password) {
        if (password == null || password.isBlank()) {
            return "Password is required";
        }
        if (password.length() < MIN_LENGTH) {
            return "Password must be at least " + MIN_LENGTH + " characters";
        }
        if (password.length() > MAX_LENGTH) {
            return "Password must be at most " + MAX_LENGTH + " characters";
        }

        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) {
                hasLetter = true;
            } else if (Character.isDigit(c)) {
                hasDigit = true;
            }
        }

        if (!hasLetter || !hasDigit) {
            return "Password must contain at least one letter and one number";
        }
        return null;
    }
}
