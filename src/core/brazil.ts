/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/brazil.ts
    Description: Rules of Brazilian fixed income: CDI-style accrual, regressive income tax and the savings account.
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
 * Conventions used by Brazilian fixed income, simplified for planning:
 *
 * - Rates are quoted per year on a 252 business-day basis and accrue daily.
 * - An instrument "paying 110 % of the Selic" pays 110 % of the *daily* rate, not of the annual one.
 * - Income tax on most fixed income falls with the holding period (regressive table).
 * - A month is taken as 21 business days and `365 / 12` calendar days.
 *
 * Real products add custody fees, spreads and holidays that are not modelled here.
 */

/** Business days in a year, the basis of Brazilian rate quotes. */
export const BUSINESS_DAYS_PER_YEAR = 252;

/** Business days in a month, so that twelve months are exactly one quoted year. */
export const BUSINESS_DAYS_PER_MONTH = BUSINESS_DAYS_PER_YEAR / 12;

/** The Selic target above which the savings account pays a fixed 0.5 % a month (Law 12,703/2012). */
export const SAVINGS_SELIC_THRESHOLD = 0.085;

/** Monthly yield of the savings account while the Selic target is above the threshold. */
export const SAVINGS_FIXED_MONTHLY_YIELD = 0.005;

/** Share of the Selic target the savings account pays when the target is at or below the threshold. */
export const SAVINGS_SELIC_SHARE = 0.7;

/**
 * Income tax rate of a fixed-income investment under the regressive table.
 *
 * @param calendarDays - Days the money was invested.
 * @returns 22.5 % up to 180 days, 20 % up to 360, 17.5 % up to 720 and 15 % beyond.
 */
export function incomeTaxRate(calendarDays: number): number {
    if (calendarDays <= 180) return 0.225;
    if (calendarDays <= 360) return 0.2;
    if (calendarDays <= 720) return 0.175;
    return 0.15;
}

/**
 * Number of calendar days in a number of months, rounded to a whole day.
 *
 * @param months - Length of the investment in months.
 * @returns Days, using an average month of `365 / 12` days (6 months is 183 days).
 */
export function calendarDays(months: number): number {
    return Math.round((months * 365) / 12);
}

/**
 * Growth factor of an investment that pays a percentage of an annual rate, accruing daily
 * (how CDI and Selic-linked products work).
 *
 * @param annualRate - The reference rate per year, as a fraction (0.1375 is 13.75 %).
 * @param percentOfRate - The share of the rate that is paid, as a fraction (1.1 is 110 %).
 * @param months - Length of the investment in months.
 * @returns The factor by which the amount grows over the period.
 */
export function accrualFactor(annualRate: number, percentOfRate: number, months: number): number {
    const dailyRate = (1 + annualRate) ** (1 / BUSINESS_DAYS_PER_YEAR) - 1;
    return (1 + percentOfRate * dailyRate) ** (months * BUSINESS_DAYS_PER_MONTH);
}

/**
 * Growth factor of the savings account (poupança), which is exempt from income tax.
 * The Transfer Rate (TR) is assumed to be zero, as it has been for years.
 *
 * @param selicTarget - The Selic target per year, as a fraction.
 * @param months - Length of the deposit in months; the account credits interest on each monthly anniversary.
 * @returns The factor by which the deposit grows over the period.
 */
export function savingsFactor(selicTarget: number, months: number): number {
    const monthlyYield =
        selicTarget > SAVINGS_SELIC_THRESHOLD
            ? SAVINGS_FIXED_MONTHLY_YIELD
            : (1 + SAVINGS_SELIC_SHARE * selicTarget) ** (1 / 12) - 1;
    return (1 + monthlyYield) ** months;
}

/**
 * Percentage of the Selic that a taxed fixed-income product must pay to match a target growth factor after tax.
 *
 * @param selic - The Selic rate per year, as a fraction.
 * @param months - Length of the investment in months.
 * @param netFactor - The after-tax growth factor to match.
 * @returns The required percentage as a fraction (0.8 is 80 %), or `null` when undefined (no gain to match, or a zero rate).
 */
export function breakEvenPercentOfRate(selic: number, months: number, netFactor: number): number | null {
    const dailyRate = (1 + selic) ** (1 / BUSINESS_DAYS_PER_YEAR) - 1;
    if (dailyRate <= 0) return null;
    const taxRate = incomeTaxRate(calendarDays(months));
    const grossFactor = 1 + (netFactor - 1) / (1 - taxRate);
    if (grossFactor <= 0) return null;
    const required = (grossFactor ** (1 / (months * BUSINESS_DAYS_PER_MONTH)) - 1) / dailyRate;
    return Number.isFinite(required) ? required : null;
}
