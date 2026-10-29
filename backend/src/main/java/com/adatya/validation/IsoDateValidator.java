package com.adatya.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * Checks that a date string is a date the calendar actually has.
 *
 * LocalDate.parse is strict by default, so it rejects 2026-02-31 and
 * 2026-99-99 where a regular expression waves both through.
 *
 * An empty value passes. Whether a date is required is a separate question,
 * answered by @NotBlank on the fields that need it, and a validator that
 * decided both would make "optional" impossible to express.
 */
public class IsoDateValidator implements ConstraintValidator<IsoDate, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        try {
            LocalDate.parse(value.trim());
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
