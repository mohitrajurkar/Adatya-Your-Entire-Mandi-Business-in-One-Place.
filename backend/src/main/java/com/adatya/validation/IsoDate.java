package com.adatya.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.ANNOTATION_TYPE;
import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * A real calendar date, written as YYYY-MM-DD.
 *
 * The fields this replaces were checked with a regular expression, which only
 * ever confirmed the shape. "2026-99-99" and "2026-02-31" both matched and were
 * stored happily, and neither is a date. The damage showed up in the browser:
 * formatting an impossible date throws, and a throw while drawing a table cell
 * blanked the whole page, so one bad bill took the purchase list down with it.
 *
 * Dates are held as text rather than a date column, so nothing below this
 * layer would have caught it either.
 */
@Documented
@Constraint(validatedBy = IsoDateValidator.class)
@Target({FIELD, PARAMETER, ANNOTATION_TYPE})
@Retention(RUNTIME)
public @interface IsoDate {

    String message() default "Date must be a real date in YYYY-MM-DD format";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
