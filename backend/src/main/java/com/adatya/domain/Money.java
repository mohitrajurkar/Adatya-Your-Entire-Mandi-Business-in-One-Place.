package com.adatya.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Rounding and scale rules for the ledger.
 *
 * Every monetary figure is held to 2 decimal places and every weight to 3,
 * both rounded HALF_UP, which is how a mandi bill is written by hand. Doing
 * this in one place is what lets balances reconcile exactly; the previous
 * double-based arithmetic drifted, which is why the code compared balances
 * with "<= 0.001" tolerances instead of equality.
 */
public final class Money {

    public static final int MONEY_SCALE = 2;
    public static final int QUANTITY_SCALE = 3;

    /** Largest value the numeric(14,2) columns can hold. */
    public static final BigDecimal MAX_AMOUNT = new BigDecimal("999999999999.99");
    /** Largest value the numeric(12,3) columns can hold. */
    public static final BigDecimal MAX_QUANTITY = new BigDecimal("999999999.999");

    public static final BigDecimal ZERO_MONEY = scaleMoney(BigDecimal.ZERO);

    private Money() {
    }

    /** Rounds to 2 decimal places. Null becomes zero. */
    public static BigDecimal scaleMoney(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    /** Rounds to 3 decimal places. Null becomes zero. */
    public static BigDecimal scaleQuantity(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(QUANTITY_SCALE, RoundingMode.HALF_UP);
    }

    /** quantity x rate, rounded to money scale. */
    public static BigDecimal lineAmount(BigDecimal quantity, BigDecimal rate) {
        return scaleMoney(scaleQuantity(quantity).multiply(scaleMoney(rate)));
    }

    public static BigDecimal sum(BigDecimal... values) {
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal value : values) {
            total = total.add(value == null ? BigDecimal.ZERO : value);
        }
        return scaleMoney(total);
    }

    public static boolean isNegative(BigDecimal value) {
        return value != null && value.signum() < 0;
    }

    public static boolean isPositive(BigDecimal value) {
        return value != null && value.signum() > 0;
    }

    public static boolean isZero(BigDecimal value) {
        return value != null && value.signum() == 0;
    }

    /** Equality by value, ignoring differences in trailing zeros. */
    public static boolean eq(BigDecimal a, BigDecimal b) {
        if (a == null || b == null) {
            return a == b;
        }
        return a.compareTo(b) == 0;
    }

    public static boolean gt(BigDecimal a, BigDecimal b) {
        return a != null && b != null && a.compareTo(b) > 0;
    }
}
