/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/accounting.ts
    Description: Accounting and corporate-finance models: Fleuriet, Altman Z-score, depreciation, bonds and amortization.
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
 * Models used by the accounting calculators. Like the rest of the core they are pure functions that take and
 * return numbers; the names of the categories they report are in the locale files.
 */

/** Fleuriet structure types, numbered like the Roman numerals I to VI of the model. */
export type FleurietType = 1 | 2 | 3 | 4 | 5 | 6;

/** The Altman zones: 0 is distress, 1 is the grey zone and 2 is safe. */
export type AltmanZone = 0 | 1 | 2;

/** Depreciation methods, as numbered in the calculator's drop-down. */
export const DEPRECIATION_STRAIGHT_LINE = 1;
export const DEPRECIATION_DOUBLE_DECLINING = 2;
export const DEPRECIATION_SUM_OF_YEARS = 3;

/**
 * Classifies a company's financial structure with the Fleuriet model.
 *
 * | Type | Working capital (CDG) | Need (NCG) | Treasury (T) | Reading        |
 * | ---- | --------------------- | ---------- | ------------ | -------------- |
 * | I    | +                     | −          | +            | Excellent      |
 * | II   | +                     | +          | +            | Solid          |
 * | III  | +                     | +          | −            | Unsatisfactory |
 * | IV   | −                     | +          | −            | Bad            |
 * | V    | −                     | −          | −            | Very bad       |
 * | VI   | −                     | −          | +            | High risk      |
 *
 * Zero counts as positive, so a company with no need for working capital is not told it has a surplus.
 *
 * @param workingCapital - CDG: permanent funds minus non-current assets.
 * @param workingCapitalNeed - NCG: operating current assets minus operating current liabilities.
 * @param treasury - T: CDG minus NCG.
 * @returns The structure type.
 */
export function fleurietType(workingCapital: number, workingCapitalNeed: number, treasury: number): FleurietType {
    const cdgPositive = workingCapital >= 0;
    const ncgPositive = workingCapitalNeed >= 0;
    const treasuryPositive = treasury >= 0;
    if (cdgPositive && !ncgPositive) return 1;
    if (cdgPositive) return treasuryPositive ? 2 : 3;
    if (ncgPositive) return 4;
    return treasuryPositive ? 6 : 5;
}

/**
 * Altman's original Z-score for listed manufacturers.
 *
 * Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5, where X1 is working capital, X2 retained earnings and X3 EBIT, each
 * over total assets, X4 the equity value over total liabilities and X5 sales over total assets.
 *
 * @param ratios - The five ratios X1 to X5.
 * @returns The score.
 */
export function altmanZ(ratios: readonly [number, number, number, number, number]): number {
    const [x1, x2, x3, x4, x5] = ratios;
    return 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;
}

/**
 * Altman's Z″-score (emerging markets, non-manufacturers). It leaves out the sales ratio, which depends heavily on the
 * industry, and adds a constant.
 *
 * Z″ = 3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4
 *
 * @param ratios - The four ratios X1 to X4.
 * @returns The score.
 */
export function altmanEmergingZ(ratios: readonly [number, number, number, number]): number {
    const [x1, x2, x3, x4] = ratios;
    return 3.25 + 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
}

/**
 * Reads a score against the two cut-offs of an Altman model.
 *
 * @param score - The Z or Z″ score.
 * @param distressBelow - Scores below this are in the distress zone.
 * @param safeAbove - Scores above this are in the safe zone.
 * @returns 0 for distress, 1 for the grey zone and 2 for safe.
 */
export function altmanZone(score: number, distressBelow: number, safeAbove: number): AltmanZone {
    if (score < distressBelow) return 0;
    return score > safeAbove ? 2 : 1;
}

/** The cut-offs of the original Z-score. */
export const ALTMAN_Z_CUTOFFS = { distressBelow: 1.81, safeAbove: 2.99 } as const;

/** The cut-offs of the emerging-market Z″-score. */
export const ALTMAN_EMERGING_CUTOFFS = { distressBelow: 4.35, safeAbove: 5.85 } as const;

/**
 * Depreciation charged in one year of an asset's life.
 *
 * - Straight line: the same amount every year.
 * - Double declining balance: twice the straight-line rate on the remaining book value, never taking the book value
 *   below the salvage value. It is not switched to straight line near the end of the life.
 * - Sum of the years' digits: the depreciable base times the remaining life over the sum 1 + 2 + … + life.
 *
 * @param method - One of the `DEPRECIATION_*` constants.
 * @param cost - What the asset cost.
 * @param salvage - What it is expected to be worth at the end of its life.
 * @param life - Useful life in whole years.
 * @param year - Year of the life, starting at 1.
 * @returns The charge for that year; 0 outside the life of the asset.
 */
export function depreciationInYear(method: number, cost: number, salvage: number, life: number, year: number): number {
    const base = Math.max(cost - salvage, 0);
    if (year < 1 || year > life) return 0;
    if (method === DEPRECIATION_STRAIGHT_LINE) return base / life;
    if (method === DEPRECIATION_SUM_OF_YEARS) return (base * (life - year + 1)) / ((life * (life + 1)) / 2);

    let bookValue = cost;
    let charge = 0;
    for (let current = 1; current <= year; current++) {
        charge = Math.max(Math.min(bookValue * (2 / life), bookValue - salvage), 0);
        bookValue -= charge;
    }
    return charge;
}

/** What an asset has depreciated up to and including a year. */
export interface DepreciationSchedule {
    /** Charge for the year. */
    charge: number;
    /** Total depreciation up to and including the year. */
    accumulated: number;
    /** Cost minus the accumulated depreciation. */
    bookValue: number;
}

/**
 * Depreciation of one year, with the total so far and the remaining book value.
 *
 * @param method - One of the `DEPRECIATION_*` constants.
 * @param cost - What the asset cost.
 * @param salvage - What it is expected to be worth at the end of its life.
 * @param life - Useful life in whole years.
 * @param year - Year of the life, starting at 1. Years after the end of the life show the fully depreciated asset.
 * @returns The charge, the accumulated depreciation and the book value.
 */
export function depreciationSchedule(
    method: number,
    cost: number,
    salvage: number,
    life: number,
    year: number
): DepreciationSchedule {
    let accumulated = 0;
    for (let current = 1; current <= Math.min(year, life); current++) {
        accumulated += depreciationInYear(method, cost, salvage, life, current);
    }
    return {
        charge: depreciationInYear(method, cost, salvage, life, year),
        accumulated,
        bookValue: cost - accumulated,
    };
}

/** Measures of a bond. */
export interface BondMetrics {
    /** Price on a coupon date, per the face value given. */
    price: number;
    /** Macaulay duration in years: the average time to the cash flows, weighted by their present value. */
    macaulayDuration: number;
    /** Modified duration in years: the percentage change of the price for a one point change of the yield, divided by 100. */
    modifiedDuration: number;
}

/**
 * Prices a bond that pays level coupons and its face value at maturity, on a coupon date (no accrued interest).
 *
 * @param faceValue - Amount repaid at maturity.
 * @param couponRate - Annual coupon rate as a fraction of the face value.
 * @param yieldToMaturity - Annual yield as a fraction, compounded at the coupon frequency.
 * @param years - Years to maturity; rounded to a whole number of coupon periods, at least one.
 * @param frequency - Coupons per year.
 * @returns The price and the durations, or `null` when the yield makes the periodic rate -100 % or lower.
 */
export function bondMetrics(
    faceValue: number,
    couponRate: number,
    yieldToMaturity: number,
    years: number,
    frequency: number
): BondMetrics | null {
    const periods = Math.max(1, Math.round(years * frequency));
    const rate = yieldToMaturity / frequency;
    if (rate <= -1) return null;
    const coupon = (faceValue * couponRate) / frequency;

    let price = 0;
    let weighted = 0;
    for (let period = 1; period <= periods; period++) {
        const flow = period === periods ? coupon + faceValue : coupon;
        const present = flow / (1 + rate) ** period;
        price += present;
        weighted += period * present;
    }
    if (!(price > 0) || !Number.isFinite(price)) return null;
    const macaulayDuration = weighted / price / frequency;
    return { price, macaulayDuration, modifiedDuration: macaulayDuration / (1 + rate) };
}

/** What a loan costs under one amortization system. */
export interface LoanPlan {
    /** First payment. */
    firstPayment: number;
    /** Last payment. */
    lastPayment: number;
    /** Interest paid over the whole loan. */
    totalInterest: number;
}

/**
 * Price table (French system): equal payments, with the interest part falling and the principal part rising.
 *
 * @param principal - Amount borrowed.
 * @param rate - Interest rate per period.
 * @param periods - Number of payments.
 * @returns The payments and total interest, or `null` when there are no periods.
 */
export function priceLoanPlan(principal: number, rate: number, periods: number): LoanPlan | null {
    if (periods <= 0) return null;
    const payment = rate === 0 ? principal / periods : (principal * rate) / (1 - (1 + rate) ** -periods);
    if (!Number.isFinite(payment)) return null;
    return { firstPayment: payment, lastPayment: payment, totalInterest: payment * periods - principal };
}

/**
 * SAC (constant amortization): the same principal repaid every period, so the payments fall as the interest falls.
 *
 * @param principal - Amount borrowed.
 * @param rate - Interest rate per period.
 * @param periods - Number of payments.
 * @returns The payments and total interest, or `null` when there are no periods.
 */
export function sacLoanPlan(principal: number, rate: number, periods: number): LoanPlan | null {
    if (periods <= 0) return null;
    const amortization = principal / periods;
    return {
        firstPayment: amortization + principal * rate,
        lastPayment: amortization * (1 + rate),
        // Interest of period k is rate × principal × (periods − k + 1) ÷ periods; summed over k.
        totalInterest: (rate * principal * (periods + 1)) / 2,
    };
}
