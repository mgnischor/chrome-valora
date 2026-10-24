/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/calculators.ts
    Description: The catalogue of business calculators: inputs, outputs and formulas.
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
 * Every calculator is plain data plus one pure function, so adding one means
 * adding an entry here and its texts to the locale files; the popup builds the
 * form and the results from the specification. Names, labels and formula
 * descriptions are looked up by convention in `messages.json`:
 *
 * - `calc_<id>_name`, `calc_<id>_desc`, `calc_<id>_formula`
 * - `field_<id>_<field>` and `out_<id>_<output>`
 */
import {
    ALTMAN_EMERGING_CUTOFFS,
    ALTMAN_Z_CUTOFFS,
    DEPRECIATION_DOUBLE_DECLINING,
    DEPRECIATION_STRAIGHT_LINE,
    DEPRECIATION_SUM_OF_YEARS,
    altmanEmergingZ,
    altmanZ,
    altmanZone,
    bondMetrics,
    depreciationSchedule,
    fleurietType,
    priceLoanPlan,
    sacLoanPlan,
} from "./accounting";
import {
    BUSINESS_DAYS_PER_YEAR,
    accrualFactor,
    breakEvenPercentOfRate,
    calendarDays,
    incomeTaxRate,
    savingsFactor,
} from "./brazil";
import {
    ceilStable,
    compoundGrowthRate,
    divide,
    futureValue,
    internalRateOfReturn,
    loanPayment,
    netPresentValue,
    paybackPeriods,
    presentValue,
} from "./finance";
import type { Calculator, CategoryRatings, FieldSpec, GroupId, RatingBands, Values } from "./types";

/** Calculators are listed under these headings, in this order. */
export const GROUPS: readonly GroupId[] = [
    "returns",
    "profitability",
    "liquidity",
    "accounting",
    "investment",
    "markets",
];

/** Largest number of cash flows accepted by the investment analysis. */
export const MAX_CASH_FLOWS = 120;

/**
 * Reads a numeric input. Inputs were validated against the field specification
 * before `calculate` runs, so a missing or mistyped value is a programming error.
 *
 * @param values - The validated inputs.
 * @param id - Field id.
 * @returns The value of the field.
 */
function num(values: Values, id: string): number {
    const value = values[id];
    if (typeof value !== "number") throw new Error(`Expected a number for "${id}"`);
    return value;
}

/**
 * Reads a `series` input.
 *
 * @param values - The validated inputs.
 * @param id - Field id.
 * @returns The list of numbers.
 */
function list(values: Values, id: string): readonly number[] {
    const value = values[id];
    if (typeof value === "number" || value === undefined) throw new Error(`Expected a list for "${id}"`);
    return value;
}

/** Rates a result by its sign: below zero is bad, above zero is good. */
const SIGN: RatingBands = { direction: "higher", bad: 0, good: 0 };

/**
 * Rates a result against two limits, where more is better.
 *
 * @param bad - Below this is bad (a number, or the id of an input field).
 * @param good - Above this is good (a number, or the id of an input field).
 * @returns The rule.
 */
const higher = (bad: number | string, good: number | string): RatingBands => ({ direction: "higher", bad, good });

/**
 * Rates a result against two limits, where less is better.
 *
 * @param bad - Above this is bad (a number, or the id of an input field).
 * @param good - Below this is good (a number, or the id of an input field).
 * @returns The rule.
 */
const lower = (bad: number | string, good: number | string): RatingBands => ({ direction: "lower", bad, good });

/** The three Altman zones: distress is bad, the grey zone is neutral and the safe zone is good. */
const ZONE_RATINGS: CategoryRatings = { byCategory: { 0: "bad", 1: "neutral", 2: "good" } };

/** An amount of money that cannot be negative. */
const amount = (id: string, example: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({
    id,
    kind: "currency",
    min: 0,
    example,
    ...extra,
});

/** An amount of money greater than zero, for fields that are used as a divisor. */
const positiveAmount = (id: string, example: number, extra: Partial<FieldSpec> = {}): FieldSpec =>
    amount(id, example, { minExclusive: true, ...extra });

/** An amount of money that may be negative, such as a profit or a loss. */
const signedAmount = (id: string, example: number): FieldSpec => ({ id, kind: "currency", example });

/** A percentage; it is typed as `12.5` and stored as `0.125`. */
const percent = (id: string, example: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({
    id,
    kind: "percent",
    example,
    ...extra,
});

/**
 * Identity function that keeps the literal type of each calculator's `id`, so
 * that {@link CalculatorId} is a union of the ids and not just `string`.
 *
 * @param calculator - The calculator definition.
 * @returns The same definition.
 */
function define<const T extends Calculator>(calculator: T): T {
    return calculator;
}

const roi = define({
    id: "roi",
    group: "returns",
    fields: [positiveAmount("invested", 10_000), amount("returned", 12_500)],
    outputs: [
        { id: "roi", kind: "percent", rating: SIGN },
        { id: "netProfit", kind: "currency", rating: SIGN },
        { id: "multiple", kind: "multiple" },
    ],
    calculate(values) {
        const invested = num(values, "invested");
        const returned = num(values, "returned");
        const netProfit = returned - invested;
        return { roi: divide(netProfit, invested), netProfit, multiple: divide(returned, invested) };
    },
});

const cagr = define({
    id: "cagr",
    group: "returns",
    fields: [
        positiveAmount("startValue", 10_000),
        amount("endValue", 20_000),
        { id: "years", kind: "number", min: 0, minExclusive: true, max: 1000, example: 5 },
    ],
    outputs: [
        { id: "cagr", kind: "percent", rating: SIGN },
        { id: "totalGrowth", kind: "percent" },
    ],
    calculate(values) {
        const start = num(values, "startValue");
        const end = num(values, "endValue");
        return {
            cagr: compoundGrowthRate(start, end, num(values, "years")),
            totalGrowth: divide(end - start, start),
        };
    },
});

const roe = define({
    id: "roe",
    group: "returns",
    fields: [
        signedAmount("netIncome", 120_000),
        positiveAmount("equity", 800_000),
        positiveAmount("assets", 2_000_000),
    ],
    outputs: [
        { id: "roe", kind: "percent", rating: higher(0, 0.1) },
        { id: "roa", kind: "percent", rating: higher(0, 0.05) },
        { id: "equityMultiplier", kind: "multiple" },
    ],
    calculate(values) {
        const netIncome = num(values, "netIncome");
        const equity = num(values, "equity");
        const assets = num(values, "assets");
        return {
            roe: divide(netIncome, equity),
            roa: divide(netIncome, assets),
            equityMultiplier: divide(assets, equity),
        };
    },
});

const margin = define({
    id: "margin",
    group: "profitability",
    fields: [amount("cost", 60), positiveAmount("price", 100)],
    outputs: [
        { id: "margin", kind: "percent", rating: SIGN },
        { id: "markup", kind: "percent" },
        { id: "profit", kind: "currency", rating: SIGN },
    ],
    calculate(values) {
        const cost = num(values, "cost");
        const price = num(values, "price");
        const profit = price - cost;
        return { margin: divide(profit, price), markup: divide(profit, cost), profit };
    },
});

const pricing = define({
    id: "pricing",
    group: "profitability",
    fields: [positiveAmount("cost", 60), percent("targetMargin", 0.3, { min: 0, max: 0.99 })],
    outputs: [
        { id: "price", kind: "currency" },
        { id: "markup", kind: "percent" },
        { id: "profit", kind: "currency" },
    ],
    calculate(values) {
        const cost = num(values, "cost");
        const targetMargin = num(values, "targetMargin");
        const price = divide(cost, 1 - targetMargin);
        return {
            price,
            markup: divide(targetMargin, 1 - targetMargin),
            profit: price === null ? null : price - cost,
        };
    },
});

const breakeven = define({
    id: "breakeven",
    group: "profitability",
    fields: [
        amount("fixedCosts", 50_000),
        positiveAmount("price", 25),
        amount("variableCost", 10),
        amount("targetProfit", 5_000, { default: 0 }),
    ],
    outputs: [
        { id: "units", kind: "number" },
        { id: "revenue", kind: "currency" },
        { id: "contributionMargin", kind: "currency", rating: SIGN },
        { id: "contributionMarginRatio", kind: "percent" },
    ],
    calculate(values) {
        const price = num(values, "price");
        const toCover = num(values, "fixedCosts") + num(values, "targetProfit");
        const contributionMargin = price - num(values, "variableCost");
        const viable = contributionMargin > 0;
        const units = viable ? divide(toCover, contributionMargin) : null;
        return {
            units: units === null ? null : ceilStable(units),
            revenue: units === null ? null : units * price,
            contributionMargin,
            contributionMarginRatio: divide(contributionMargin, price),
        };
    },
});

const liquidity = define({
    id: "liquidity",
    group: "liquidity",
    fields: [
        amount("cash", 50_000),
        amount("receivables", 80_000),
        amount("inventory", 70_000),
        amount("otherCurrentAssets", 10_000, { default: 0 }),
        positiveAmount("currentLiabilities", 150_000),
    ],
    outputs: [
        { id: "currentRatio", kind: "ratio", rating: higher(1, 1.5) },
        { id: "quickRatio", kind: "ratio", rating: higher(0.8, 1) },
        { id: "cashRatio", kind: "ratio", rating: higher(0.2, 0.5) },
        { id: "workingCapital", kind: "currency", rating: SIGN },
    ],
    calculate(values) {
        const cash = num(values, "cash");
        const receivables = num(values, "receivables");
        const currentAssets = cash + receivables + num(values, "inventory") + num(values, "otherCurrentAssets");
        const liabilities = num(values, "currentLiabilities");
        return {
            currentRatio: divide(currentAssets, liabilities),
            quickRatio: divide(cash + receivables, liabilities),
            cashRatio: divide(cash, liabilities),
            workingCapital: currentAssets - liabilities,
        };
    },
});

const cashCycle = define({
    id: "cashCycle",
    group: "liquidity",
    fields: [
        positiveAmount("revenue", 1_200_000),
        positiveAmount("cogs", 800_000),
        amount("inventory", 120_000),
        amount("receivables", 150_000),
        amount("payables", 90_000),
        { id: "periodDays", kind: "choice", choices: [365, 360, 90, 30], example: 365 },
    ],
    outputs: [
        { id: "cashConversionCycle", kind: "days", rating: lower(60, 0) },
        { id: "daysInventory", kind: "days" },
        { id: "daysReceivables", kind: "days" },
        { id: "daysPayables", kind: "days" },
        { id: "inventoryTurnover", kind: "multiple" },
    ],
    calculate(values) {
        const days = num(values, "periodDays");
        const revenue = num(values, "revenue");
        const cogs = num(values, "cogs");
        const inventory = num(values, "inventory");
        const daysInventory = (inventory / cogs) * days;
        const daysReceivables = (num(values, "receivables") / revenue) * days;
        const daysPayables = (num(values, "payables") / cogs) * days;
        return {
            cashConversionCycle: daysInventory + daysReceivables - daysPayables,
            daysInventory,
            daysReceivables,
            daysPayables,
            inventoryTurnover: divide(cogs, inventory),
        };
    },
});

const leverage = define({
    id: "leverage",
    group: "liquidity",
    fields: [
        amount("totalDebt", 400_000),
        positiveAmount("equity", 600_000),
        signedAmount("ebit", 150_000),
        amount("interestExpense", 40_000),
    ],
    outputs: [
        { id: "debtToEquity", kind: "ratio", rating: lower(2, 1) },
        { id: "debtToCapital", kind: "percent" },
        { id: "interestCoverage", kind: "multiple", rating: higher(1.5, 3) },
    ],
    calculate(values) {
        const debt = num(values, "totalDebt");
        const equity = num(values, "equity");
        return {
            debtToEquity: divide(debt, equity),
            debtToCapital: divide(debt, debt + equity),
            interestCoverage: divide(num(values, "ebit"), num(values, "interestExpense")),
        };
    },
});

const investment = define({
    id: "investment",
    group: "investment",
    fields: [
        percent("rate", 0.1, { min: -0.99, max: 10 }),
        amount("initialInvestment", 1_000),
        {
            id: "cashFlows",
            kind: "series",
            minItems: 1,
            maxItems: MAX_CASH_FLOWS,
            example: [400, 400, 400, 300],
        },
    ],
    outputs: [
        { id: "npv", kind: "currency", rating: SIGN },
        { id: "irr", kind: "percent", rating: higher("rate", "rate") },
        { id: "profitabilityIndex", kind: "ratio", rating: higher(1, 1) },
        { id: "payback", kind: "number" },
        { id: "discountedPayback", kind: "number" },
    ],
    calculate(values) {
        const rate = num(values, "rate");
        const initial = num(values, "initialInvestment");
        const flows = list(values, "cashFlows");
        return {
            npv: netPresentValue(rate, initial, flows),
            irr: internalRateOfReturn(initial, flows),
            profitabilityIndex: divide(presentValue(rate, flows), initial),
            payback: paybackPeriods(initial, flows),
            discountedPayback: paybackPeriods(initial, flows, rate),
        };
    },
});

const futureValueCalculator = define({
    id: "futureValue",
    group: "investment",
    fields: [
        amount("presentValue", 10_000),
        amount("contribution", 500, { default: 0 }),
        percent("annualRate", 0.07, { min: -0.99, max: 10 }),
        { id: "years", kind: "number", min: 0, minExclusive: true, max: 200, example: 10 },
        { id: "frequency", kind: "choice", choices: [12, 1, 2, 4, 52, 365], example: 12 },
    ],
    outputs: [
        { id: "futureValue", kind: "currency" },
        { id: "totalContributions", kind: "currency" },
        { id: "interestEarned", kind: "currency" },
    ],
    calculate(values) {
        const frequency = num(values, "frequency");
        const periods = num(values, "years") * frequency;
        const contribution = num(values, "contribution");
        const deposits = num(values, "presentValue") + contribution * periods;
        const total = futureValue(
            num(values, "presentValue"),
            num(values, "annualRate") / frequency,
            periods,
            contribution
        );
        return {
            futureValue: total,
            totalContributions: deposits,
            interestEarned: total === null ? null : total - deposits,
        };
    },
});

const loan = define({
    id: "loan",
    group: "investment",
    fields: [
        positiveAmount("principal", 200_000),
        percent("annualRate", 0.065, { min: 0, max: 10 }),
        { id: "termMonths", kind: "integer", min: 1, max: 600, example: 360 },
    ],
    outputs: [
        { id: "monthlyPayment", kind: "currency" },
        { id: "totalPaid", kind: "currency" },
        { id: "totalInterest", kind: "currency" },
    ],
    calculate(values) {
        const principal = num(values, "principal");
        const months = num(values, "termMonths");
        const payment = loanPayment(principal, num(values, "annualRate") / 12, months);
        const totalPaid = payment === null ? null : payment * months;
        return {
            monthlyPayment: payment,
            totalPaid,
            totalInterest: totalPaid === null ? null : totalPaid - principal,
        };
    },
});

/** An amount in Brazilian reais; the market calculators are about the Brazilian market. */
const reais = (id: string, example: number): FieldSpec => positiveAmount(id, example, { currency: "BRL" });

/** The Selic rate, which can be filled in from the Central Bank of Brazil. */
const selicField: FieldSpec = percent("selic", 0.1375, { min: 0, max: 1, source: "selic" });

/** The investment horizon in whole months. */
const monthsField: FieldSpec = { id: "months", kind: "integer", min: 1, max: 600, example: 12 };

const selicYield = define({
    id: "selicYield",
    group: "markets",
    fields: [
        reais("amount", 10_000),
        monthsField,
        selicField,
        percent("percentOfRate", 1, { min: 0, max: 5, default: 1 }),
        { id: "taxTreatment", kind: "choice", choices: [1, 0], example: 1 },
    ],
    outputs: [
        { id: "netFinal", kind: "currency", currency: "BRL" },
        { id: "netProfit", kind: "currency", currency: "BRL" },
        { id: "incomeTax", kind: "currency", currency: "BRL" },
        { id: "taxRate", kind: "percent" },
        { id: "netAnnualRate", kind: "percent" },
    ],
    calculate(values) {
        const amount = num(values, "amount");
        const months = num(values, "months");
        const grossProfit = amount * (accrualFactor(num(values, "selic"), num(values, "percentOfRate"), months) - 1);
        const taxRate = num(values, "taxTreatment") === 1 ? incomeTaxRate(calendarDays(months)) : 0;
        const incomeTax = grossProfit * taxRate;
        const netProfit = grossProfit - incomeTax;
        return {
            netFinal: amount + netProfit,
            netProfit,
            incomeTax,
            taxRate,
            netAnnualRate: compoundGrowthRate(amount, amount + netProfit, months / 12),
        };
    },
});

const savings = define({
    id: "savings",
    group: "markets",
    fields: [
        reais("amount", 10_000),
        monthsField,
        selicField,
        percent("percentOfRate", 1.1, { min: 0, max: 5, default: 1 }),
    ],
    outputs: [
        { id: "advantage", kind: "currency", rating: SIGN, currency: "BRL" },
        { id: "savingsFinal", kind: "currency", currency: "BRL" },
        { id: "fixedIncomeFinal", kind: "currency", currency: "BRL" },
        { id: "breakEvenPercent", kind: "percent" },
    ],
    calculate(values) {
        const amount = num(values, "amount");
        const months = num(values, "months");
        const selic = num(values, "selic");
        const savingsGrowth = savingsFactor(selic, months);
        const grossProfit = amount * (accrualFactor(selic, num(values, "percentOfRate"), months) - 1);
        const fixedIncomeFinal = amount + grossProfit * (1 - incomeTaxRate(calendarDays(months)));
        const savingsFinal = amount * savingsGrowth;
        return {
            advantage: fixedIncomeFinal - savingsFinal,
            savingsFinal,
            fixedIncomeFinal,
            breakEvenPercent: breakEvenPercentOfRate(selic, months, savingsGrowth),
        };
    },
});

const dollarConversion = define({
    id: "dollarConversion",
    group: "markets",
    fields: [
        reais("amount", 5_000),
        positiveAmount("rate", 5.04, { currency: "BRL", source: "usdBrl" }),
        percent("spread", 0.01, { min: 0, max: 0.5, default: 0 }),
        percent("iof", 0.035, { min: 0, max: 0.5, default: 0 }),
    ],
    outputs: [
        { id: "usdReceived", kind: "currency", currency: "USD" },
        { id: "effectiveRate", kind: "exchangeRate", currency: "BRL" },
        { id: "cost", kind: "currency", currency: "BRL" },
        { id: "costPercent", kind: "percent" },
    ],
    calculate(values) {
        const amount = num(values, "amount");
        const rate = num(values, "rate");
        const effectiveRate = rate * (1 + num(values, "spread")) * (1 + num(values, "iof"));
        const usdReceived = amount / effectiveRate;
        const cost = amount - usdReceived * rate;
        return { usdReceived, effectiveRate, cost, costPercent: divide(cost, amount) };
    },
});

const dollarVsSelic = define({
    id: "dollarVsSelic",
    group: "markets",
    fields: [
        reais("amount", 10_000),
        monthsField,
        positiveAmount("spot", 5.04, { currency: "BRL", source: "usdBrl" }),
        positiveAmount("expected", 5.5, { currency: "BRL" }),
        selicField,
        percent("usdYield", 0.045, { min: -0.5, max: 1 }),
    ],
    outputs: [
        { id: "breakEvenRate", kind: "exchangeRate", currency: "BRL" },
        { id: "requiredChange", kind: "percent" },
        { id: "selicFinal", kind: "currency", currency: "BRL" },
        { id: "dollarFinal", kind: "currency", currency: "BRL" },
        { id: "difference", kind: "currency", rating: SIGN, currency: "BRL" },
    ],
    calculate(values) {
        const amount = num(values, "amount");
        const months = num(values, "months");
        const spot = num(values, "spot");
        const selicFinal = amount * accrualFactor(num(values, "selic"), 1, months);
        const dollarsAtEnd = (amount / spot) * (1 + num(values, "usdYield")) ** (months / 12);
        const breakEvenRate = divide(selicFinal, dollarsAtEnd);
        return {
            breakEvenRate,
            requiredChange: breakEvenRate === null ? null : breakEvenRate / spot - 1,
            selicFinal,
            dollarFinal: dollarsAtEnd * num(values, "expected"),
            difference: dollarsAtEnd * num(values, "expected") - selicFinal,
        };
    },
});

/** The income tax rate of a company, typed as a percentage. */
const taxRateField: FieldSpec = percent("taxRate", 0.25, { min: 0, max: 1 });

const incomeStatement = define({
    id: "incomeStatement",
    group: "accounting",
    fields: [
        positiveAmount("revenue", 1_000_000),
        amount("cogs", 600_000),
        amount("operatingExpenses", 150_000),
        amount("depreciation", 50_000),
        amount("interestExpense", 40_000),
        taxRateField,
    ],
    outputs: [
        { id: "netIncome", kind: "currency", rating: SIGN },
        { id: "grossMargin", kind: "percent" },
        { id: "ebitdaMargin", kind: "percent" },
        { id: "operatingMargin", kind: "percent", rating: SIGN },
        { id: "netMargin", kind: "percent", rating: SIGN },
    ],
    calculate(values) {
        const revenue = num(values, "revenue");
        const grossProfit = revenue - num(values, "cogs");
        const ebitda = grossProfit - num(values, "operatingExpenses");
        const ebit = ebitda - num(values, "depreciation");
        const pretax = ebit - num(values, "interestExpense");
        // A loss pays no tax; it is not turned into a refund.
        const netIncome = pretax - Math.max(pretax, 0) * num(values, "taxRate");
        return {
            netIncome,
            grossMargin: divide(grossProfit, revenue),
            ebitdaMargin: divide(ebitda, revenue),
            operatingMargin: divide(ebit, revenue),
            netMargin: divide(netIncome, revenue),
        };
    },
});

const dupont = define({
    id: "dupont",
    group: "accounting",
    fields: [
        signedAmount("netIncome", 120_000),
        positiveAmount("revenue", 1_500_000),
        positiveAmount("assets", 1_000_000),
        positiveAmount("equity", 600_000),
    ],
    outputs: [
        { id: "roe", kind: "percent", rating: higher(0, 0.1) },
        { id: "netMargin", kind: "percent", rating: SIGN },
        { id: "assetTurnover", kind: "multiple" },
        { id: "equityMultiplier", kind: "multiple" },
        { id: "roa", kind: "percent", rating: higher(0, 0.05) },
    ],
    calculate(values) {
        const netIncome = num(values, "netIncome");
        const revenue = num(values, "revenue");
        const assets = num(values, "assets");
        const equity = num(values, "equity");
        return {
            roe: divide(netIncome, equity),
            netMargin: divide(netIncome, revenue),
            assetTurnover: divide(revenue, assets),
            equityMultiplier: divide(assets, equity),
            roa: divide(netIncome, assets),
        };
    },
});

const dupont5 = define({
    id: "dupont5",
    group: "accounting",
    fields: [
        signedAmount("netIncome", 120_000),
        signedAmount("pretaxIncome", 180_000),
        signedAmount("ebit", 220_000),
        positiveAmount("revenue", 1_500_000),
        positiveAmount("assets", 1_000_000),
        positiveAmount("equity", 600_000),
    ],
    outputs: [
        { id: "roe", kind: "percent", rating: higher(0, 0.1) },
        { id: "taxBurden", kind: "ratio" },
        { id: "interestBurden", kind: "ratio" },
        { id: "operatingMargin", kind: "percent" },
        { id: "assetTurnover", kind: "multiple" },
        { id: "equityMultiplier", kind: "multiple" },
    ],
    calculate(values) {
        const netIncome = num(values, "netIncome");
        const pretax = num(values, "pretaxIncome");
        const ebit = num(values, "ebit");
        const revenue = num(values, "revenue");
        const assets = num(values, "assets");
        const equity = num(values, "equity");
        return {
            roe: divide(netIncome, equity),
            taxBurden: divide(netIncome, pretax),
            interestBurden: divide(pretax, ebit),
            operatingMargin: divide(ebit, revenue),
            assetTurnover: divide(revenue, assets),
            equityMultiplier: divide(assets, equity),
        };
    },
});

const fleuriet = define({
    id: "fleuriet",
    group: "accounting",
    fields: [
        amount("operatingCurrentAssets", 500_000),
        amount("operatingCurrentLiabilities", 300_000),
        amount("nonCurrentAssets", 700_000),
        amount("permanentFunds", 1_000_000),
    ],
    outputs: [
        {
            id: "structureType",
            kind: "category",
            rating: { byCategory: { 1: "good", 2: "good", 3: "neutral", 4: "bad", 5: "bad", 6: "bad" } },
            categories: [1, 2, 3, 4, 5, 6],
        },
        { id: "workingCapital", kind: "currency", rating: SIGN },
        { id: "workingCapitalNeed", kind: "currency" },
        { id: "treasury", kind: "currency", rating: SIGN },
    ],
    calculate(values) {
        const workingCapital = num(values, "permanentFunds") - num(values, "nonCurrentAssets");
        const workingCapitalNeed = num(values, "operatingCurrentAssets") - num(values, "operatingCurrentLiabilities");
        const treasury = workingCapital - workingCapitalNeed;
        return {
            structureType: fleurietType(workingCapital, workingCapitalNeed, treasury),
            workingCapital,
            workingCapitalNeed,
            treasury,
        };
    },
});

const altman = define({
    id: "altman",
    group: "accounting",
    fields: [
        signedAmount("workingCapital", 200_000),
        signedAmount("retainedEarnings", 300_000),
        signedAmount("ebit", 180_000),
        positiveAmount("equityValue", 800_000),
        amount("sales", 1_500_000),
        positiveAmount("totalAssets", 1_200_000),
        positiveAmount("totalLiabilities", 600_000),
    ],
    outputs: [
        { id: "zScore", kind: "ratio", rating: higher(1.81, 2.99) },
        { id: "zZone", kind: "category", rating: ZONE_RATINGS, categories: [0, 1, 2] },
        { id: "emergingScore", kind: "ratio", rating: higher(4.35, 5.85) },
        { id: "emergingZone", kind: "category", rating: ZONE_RATINGS, categories: [0, 1, 2] },
    ],
    calculate(values) {
        const assets = num(values, "totalAssets");
        const x1 = num(values, "workingCapital") / assets;
        const x2 = num(values, "retainedEarnings") / assets;
        const x3 = num(values, "ebit") / assets;
        const x4 = num(values, "equityValue") / num(values, "totalLiabilities");
        const x5 = num(values, "sales") / assets;
        const zScore = altmanZ([x1, x2, x3, x4, x5]);
        const emergingScore = altmanEmergingZ([x1, x2, x3, x4]);
        return {
            zScore,
            zZone: altmanZone(zScore, ALTMAN_Z_CUTOFFS.distressBelow, ALTMAN_Z_CUTOFFS.safeAbove),
            emergingScore,
            emergingZone: altmanZone(
                emergingScore,
                ALTMAN_EMERGING_CUTOFFS.distressBelow,
                ALTMAN_EMERGING_CUTOFFS.safeAbove
            ),
        };
    },
});

const leverageDegrees = define({
    id: "leverageDegrees",
    group: "accounting",
    fields: [
        positiveAmount("revenue", 1_000_000),
        amount("variableCosts", 500_000),
        amount("fixedCosts", 300_000),
        amount("interestExpense", 50_000),
    ],
    outputs: [
        { id: "operatingLeverage", kind: "multiple" },
        { id: "financialLeverage", kind: "multiple" },
        { id: "combinedLeverage", kind: "multiple" },
        { id: "ebit", kind: "currency", rating: SIGN },
    ],
    calculate(values) {
        const contribution = num(values, "revenue") - num(values, "variableCosts");
        const ebit = contribution - num(values, "fixedCosts");
        const operatingLeverage = divide(contribution, ebit);
        const financialLeverage = divide(ebit, ebit - num(values, "interestExpense"));
        return {
            operatingLeverage,
            financialLeverage,
            combinedLeverage:
                operatingLeverage === null || financialLeverage === null ? null : operatingLeverage * financialLeverage,
            ebit,
        };
    },
});

const depreciation = define({
    id: "depreciation",
    group: "accounting",
    fields: [
        positiveAmount("cost", 100_000),
        amount("salvage", 10_000),
        { id: "lifeYears", kind: "integer", min: 1, max: 100, example: 5 },
        {
            id: "method",
            kind: "choice",
            choices: [DEPRECIATION_STRAIGHT_LINE, DEPRECIATION_DOUBLE_DECLINING, DEPRECIATION_SUM_OF_YEARS],
            example: DEPRECIATION_STRAIGHT_LINE,
        },
        { id: "year", kind: "integer", min: 1, max: 100, example: 2 },
    ],
    outputs: [
        { id: "charge", kind: "currency" },
        { id: "accumulated", kind: "currency" },
        { id: "bookValue", kind: "currency" },
    ],
    calculate(values) {
        const schedule = depreciationSchedule(
            num(values, "method"),
            num(values, "cost"),
            num(values, "salvage"),
            num(values, "lifeYears"),
            num(values, "year")
        );
        return { ...schedule };
    },
});

const wacc = define({
    id: "wacc",
    group: "investment",
    fields: [
        positiveAmount("equityValue", 600_000),
        amount("debtValue", 400_000),
        percent("riskFree", 0.1, { min: 0, max: 1 }),
        { id: "beta", kind: "number", min: -5, max: 10, example: 1.2 },
        percent("marketPremium", 0.06, { min: -0.5, max: 1 }),
        percent("costOfDebt", 0.14, { min: 0, max: 1 }),
        taxRateField,
    ],
    outputs: [
        { id: "wacc", kind: "percent" },
        { id: "costOfEquity", kind: "percent" },
        { id: "afterTaxCostOfDebt", kind: "percent" },
        { id: "equityWeight", kind: "percent" },
        { id: "debtWeight", kind: "percent" },
    ],
    calculate(values) {
        const equity = num(values, "equityValue");
        const debt = num(values, "debtValue");
        const capital = equity + debt;
        const costOfEquity = num(values, "riskFree") + num(values, "beta") * num(values, "marketPremium");
        const afterTaxCostOfDebt = num(values, "costOfDebt") * (1 - num(values, "taxRate"));
        const equityWeight = equity / capital;
        const debtWeight = debt / capital;
        return {
            wacc: equityWeight * costOfEquity + debtWeight * afterTaxCostOfDebt,
            costOfEquity,
            afterTaxCostOfDebt,
            equityWeight,
            debtWeight,
        };
    },
});

const eva = define({
    id: "eva",
    group: "investment",
    fields: [
        signedAmount("ebit", 250_000),
        taxRateField,
        positiveAmount("investedCapital", 1_000_000),
        percent("wacc", 0.15, { min: 0, max: 1 }),
    ],
    outputs: [
        { id: "eva", kind: "currency", rating: SIGN },
        { id: "nopat", kind: "currency" },
        { id: "roic", kind: "percent" },
        { id: "spread", kind: "percent", rating: SIGN },
        { id: "capitalCharge", kind: "currency" },
    ],
    calculate(values) {
        const nopat = num(values, "ebit") * (1 - num(values, "taxRate"));
        const capital = num(values, "investedCapital");
        const wacc = num(values, "wacc");
        const roic = nopat / capital;
        return { eva: nopat - capital * wacc, nopat, roic, spread: roic - wacc, capitalCharge: capital * wacc };
    },
});

const freeCashFlow = define({
    id: "freeCashFlow",
    group: "investment",
    fields: [
        signedAmount("ebit", 250_000),
        taxRateField,
        amount("depreciation", 50_000),
        amount("capex", 80_000),
        signedAmount("changeInWorkingCapital", 20_000),
        amount("interestExpense", 40_000),
        signedAmount("netBorrowing", 30_000),
    ],
    outputs: [
        { id: "fcff", kind: "currency", rating: SIGN },
        { id: "fcfe", kind: "currency", rating: SIGN },
        { id: "nopat", kind: "currency" },
    ],
    calculate(values) {
        const taxRate = num(values, "taxRate");
        const nopat = num(values, "ebit") * (1 - taxRate);
        const fcff = nopat + num(values, "depreciation") - num(values, "capex") - num(values, "changeInWorkingCapital");
        return {
            fcff,
            fcfe: fcff - num(values, "interestExpense") * (1 - taxRate) + num(values, "netBorrowing"),
            nopat,
        };
    },
});

const bond = define({
    id: "bond",
    group: "investment",
    fields: [
        positiveAmount("faceValue", 1_000),
        percent("couponRate", 0.1, { min: 0, max: 1 }),
        percent("yieldToMaturity", 0.12, { min: -0.5, max: 2 }),
        { id: "years", kind: "number", min: 0, minExclusive: true, max: 100, example: 5 },
        { id: "frequency", kind: "choice", choices: [2, 1, 4, 12], example: 2 },
    ],
    outputs: [
        { id: "price", kind: "currency" },
        { id: "premium", kind: "percent" },
        { id: "currentYield", kind: "percent" },
        { id: "macaulayDuration", kind: "number" },
        { id: "modifiedDuration", kind: "number" },
    ],
    calculate(values) {
        const face = num(values, "faceValue");
        const coupon = num(values, "couponRate");
        const metrics = bondMetrics(
            face,
            coupon,
            num(values, "yieldToMaturity"),
            num(values, "years"),
            num(values, "frequency")
        );
        if (metrics === null) {
            return { price: null, premium: null, currentYield: null, macaulayDuration: null, modifiedDuration: null };
        }
        return {
            price: metrics.price,
            premium: metrics.price / face - 1,
            currentYield: divide(face * coupon, metrics.price),
            macaulayDuration: metrics.macaulayDuration,
            modifiedDuration: metrics.modifiedDuration,
        };
    },
});

const rates = define({
    id: "rates",
    group: "investment",
    fields: [
        percent("nominalRate", 0.12, { min: -0.99, max: 10 }),
        { id: "compounding", kind: "choice", choices: [12, 1, 2, 4, 365], example: 12 },
        percent("inflation", 0.045, { min: -0.5, max: 10 }),
    ],
    outputs: [
        { id: "effectiveAnnual", kind: "percent" },
        { id: "monthlyEquivalent", kind: "percent" },
        { id: "dailyEquivalent", kind: "percent" },
        { id: "realRate", kind: "percent", rating: SIGN },
    ],
    calculate(values) {
        const compounding = num(values, "compounding");
        const effectiveAnnual = (1 + num(values, "nominalRate") / compounding) ** compounding - 1;
        return {
            effectiveAnnual,
            monthlyEquivalent: (1 + effectiveAnnual) ** (1 / 12) - 1,
            dailyEquivalent: (1 + effectiveAnnual) ** (1 / BUSINESS_DAYS_PER_YEAR) - 1,
            realRate: (1 + effectiveAnnual) / (1 + num(values, "inflation")) - 1,
        };
    },
});

const amortization = define({
    id: "amortization",
    group: "investment",
    fields: [
        positiveAmount("principal", 200_000),
        percent("annualRate", 0.12, { min: 0, max: 10 }),
        { id: "termMonths", kind: "integer", min: 1, max: 600, example: 120 },
    ],
    outputs: [
        { id: "pricePayment", kind: "currency" },
        { id: "priceTotalInterest", kind: "currency" },
        { id: "sacFirstPayment", kind: "currency" },
        { id: "sacLastPayment", kind: "currency" },
        { id: "sacTotalInterest", kind: "currency" },
    ],
    calculate(values) {
        const principal = num(values, "principal");
        const rate = num(values, "annualRate") / 12;
        const months = num(values, "termMonths");
        const price = priceLoanPlan(principal, rate, months);
        const sac = sacLoanPlan(principal, rate, months);
        return {
            pricePayment: price?.firstPayment ?? null,
            priceTotalInterest: price?.totalInterest ?? null,
            sacFirstPayment: sac?.firstPayment ?? null,
            sacLastPayment: sac?.lastPayment ?? null,
            sacTotalInterest: sac?.totalInterest ?? null,
        };
    },
});

/** Every calculator, in the order they are listed in the popup. */
export const CALCULATORS = [
    roi,
    cagr,
    roe,
    margin,
    pricing,
    breakeven,
    liquidity,
    cashCycle,
    leverage,
    investment,
    futureValueCalculator,
    loan,
    incomeStatement,
    dupont,
    dupont5,
    fleuriet,
    altman,
    leverageDegrees,
    depreciation,
    wacc,
    eva,
    freeCashFlow,
    bond,
    rates,
    amortization,
    selicYield,
    savings,
    dollarConversion,
    dollarVsSelic,
] as const;

/** The id of a calculator. */
export type CalculatorId = (typeof CALCULATORS)[number]["id"];

/**
 * Finds a calculator.
 *
 * @param id - Calculator id.
 * @returns The calculator.
 * @throws Error when no calculator has that id.
 */
export function getCalculator(id: string): Calculator {
    const found = CALCULATORS.find((calculator) => calculator.id === id);
    if (!found) throw new Error(`Unknown calculator "${id}"`);
    return found;
}

/**
 * Checks whether a value is the id of a calculator.
 *
 * @param value - Value to check, typically read from storage.
 * @returns `true` when `value` is a calculator id.
 */
export function isCalculatorId(value: unknown): value is CalculatorId {
    return CALCULATORS.some((calculator) => calculator.id === value);
}

/** The calculator shown the first time the popup opens. */
export const DEFAULT_CALCULATOR: CalculatorId = "roi";
