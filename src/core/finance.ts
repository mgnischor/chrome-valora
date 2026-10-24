/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/finance.ts
    Description: Financial mathematics shared by the calculators: time value of money, NPV, IRR and payback.
    Author: Miguel Nischor <miguel@nischor.com.br>

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
/**
 * Pure financial functions. Rates are fractions (`0.05` is 5 %) and apply to one
 * period; the caller decides whether a period is a month or a year. Functions
 * return `null` instead of `NaN` or `Infinity` when a result is undefined.
 */

/** Bounds of the IRR search, as the natural logarithm of the growth factor `1 + r`: rates from about -99.9 % to +109 500 %. */
const IRR_LOG_RANGE = 7;

/** Spacing of the IRR scan, in the same logarithmic units. */
const IRR_LOG_STEP = 0.05;

/** Bisection steps after a sign change is found; far more than needed for double precision. */
const IRR_BISECTION_STEPS = 100;

/**
 * Divides two numbers.
 *
 * @param numerator - The dividend.
 * @param denominator - The divisor.
 * @returns The quotient, or `null` when the divisor is zero or the result is not finite.
 */
export function divide(numerator: number, denominator: number): number | null {
    if (denominator === 0) return null;
    const quotient = numerator / denominator;
    return Number.isFinite(quotient) ? quotient : null;
}

/**
 * Present value of a series of cash flows received at the end of periods 1, 2, ..., n.
 *
 * @param rate - Discount rate per period; must be greater than -1.
 * @param cashFlows - Cash flows of periods 1..n.
 * @returns The sum of the discounted cash flows.
 */
export function presentValue(rate: number, cashFlows: readonly number[]): number {
    let total = 0;
    for (const [index, flow] of cashFlows.entries()) total += flow / (1 + rate) ** (index + 1);
    return total;
}

/**
 * Net present value of an investment: the present value of its future cash
 * flows minus the amount paid at time zero.
 *
 * @param rate - Discount rate per period; must be greater than -1.
 * @param initialInvestment - Amount paid at time zero (a positive number).
 * @param cashFlows - Cash flows of periods 1..n.
 * @returns The NPV.
 */
export function netPresentValue(rate: number, initialInvestment: number, cashFlows: readonly number[]): number {
    return presentValue(rate, cashFlows) - initialInvestment;
}

/**
 * Internal rate of return: the rate at which the NPV is zero.
 *
 * Several rates can satisfy that equation when the cash flows change sign more
 * than once. The function scans the plausible range for sign changes of the
 * NPV, refines each one by bisection, and returns the root closest to zero,
 * which is the one people normally mean.
 *
 * @param initialInvestment - Amount paid at time zero (a positive number).
 * @param cashFlows - Cash flows of periods 1..n.
 * @returns The IRR per period, or `null` when no rate makes the NPV zero (for example, when nothing is ever received).
 */
export function internalRateOfReturn(initialInvestment: number, cashFlows: readonly number[]): number | null {
    const all = [-initialInvestment, ...cashFlows];
    if (!all.some((flow) => flow > 0) || !all.some((flow) => flow < 0)) return null;

    // Work with the growth factor x = 1 + r = e^u so that the scan covers very
    // negative and very large rates evenly.
    const npvAt = (u: number): number => {
        const factor = Math.exp(u);
        let total = 0;
        for (const [period, flow] of all.entries()) total += flow / factor ** period;
        return total;
    };

    const roots: number[] = [];
    let previousU = -IRR_LOG_RANGE;
    let previousValue = npvAt(previousU);
    for (let u = previousU + IRR_LOG_STEP; u <= IRR_LOG_RANGE + 1e-9; u += IRR_LOG_STEP) {
        const value = npvAt(u);
        if (Number.isFinite(previousValue) && Number.isFinite(value)) {
            if (value === 0) {
                roots.push(Math.exp(u) - 1);
            } else if (previousValue * value < 0) {
                let low = previousU;
                let high = u;
                let lowValue = previousValue;
                for (let step = 0; step < IRR_BISECTION_STEPS; step++) {
                    const middle = (low + high) / 2;
                    const middleValue = npvAt(middle);
                    if (lowValue * middleValue <= 0) {
                        high = middle;
                    } else {
                        low = middle;
                        lowValue = middleValue;
                    }
                }
                roots.push(Math.exp((low + high) / 2) - 1);
            }
        }
        previousU = u;
        previousValue = value;
    }

    if (roots.length === 0) return null;
    return roots.reduce((best, root) => (Math.abs(root) < Math.abs(best) ? root : best));
}

/**
 * Number of periods needed to recover an investment, with linear
 * interpolation inside the period in which the balance turns positive.
 *
 * @param initialInvestment - Amount paid at time zero (a positive number).
 * @param cashFlows - Cash flows of periods 1..n.
 * @param rate - Discount rate per period. 0 gives the simple payback, a positive rate the discounted payback.
 * @returns Periods until the cumulative (discounted) cash flow reaches zero, or `null` when it never does.
 */
export function paybackPeriods(initialInvestment: number, cashFlows: readonly number[], rate = 0): number | null {
    let balance = -initialInvestment;
    if (balance >= 0) return 0;
    for (const [index, flow] of cashFlows.entries()) {
        const period = index + 1;
        const discounted = flow / (1 + rate) ** period;
        if (balance + discounted >= 0) return index + -balance / discounted;
        balance += discounted;
    }
    return null;
}

/**
 * Compound annual growth rate.
 *
 * @param start - Starting value (greater than zero).
 * @param end - Ending value (zero or more).
 * @param years - Length of the period in years (greater than zero).
 * @returns The constant yearly growth rate that turns `start` into `end`, or `null` when undefined.
 */
export function compoundGrowthRate(start: number, end: number, years: number): number | null {
    if (start <= 0 || end < 0 || years <= 0) return null;
    const rate = (end / start) ** (1 / years) - 1;
    return Number.isFinite(rate) ? rate : null;
}

/**
 * Future value of a lump sum plus a level payment made at the end of every period.
 *
 * @param presentAmount - Amount invested at time zero.
 * @param rate - Interest rate per period.
 * @param periods - Number of periods (may be fractional).
 * @param payment - Payment made at the end of each period.
 * @returns The accumulated amount, or `null` when it is not a finite number.
 */
export function futureValue(presentAmount: number, rate: number, periods: number, payment: number): number | null {
    const total =
        rate === 0
            ? presentAmount + payment * periods
            : presentAmount * (1 + rate) ** periods + (payment * ((1 + rate) ** periods - 1)) / rate;
    return Number.isFinite(total) ? total : null;
}

/**
 * Level payment of a fully amortizing loan, paid at the end of every period.
 *
 * @param principal - Amount borrowed.
 * @param rate - Interest rate per period.
 * @param periods - Number of payments (greater than zero).
 * @returns The payment, or `null` when it is not a finite number.
 */
export function loanPayment(principal: number, rate: number, periods: number): number | null {
    if (periods <= 0) return null;
    if (rate === 0) return principal / periods;
    const payment = (principal * rate) / (1 - (1 + rate) ** -periods);
    return Number.isFinite(payment) ? payment : null;
}

/**
 * Rounds away floating-point noise before a value is rounded up, so that an
 * exact `100` computed as `100.00000000000001` still gives 100 and not 101.
 *
 * @param value - A non-negative quotient.
 * @returns The smallest integer that is not below `value`, ignoring noise beyond 12 significant digits.
 */
export function ceilStable(value: number): number {
    return Math.ceil(Number(value.toPrecision(12)));
}
