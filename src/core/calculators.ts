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
import { accrualFactor, breakEvenPercentOfRate, calendarDays, incomeTaxRate, savingsFactor } from "./brazil";
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
import type { Calculator, FieldSpec, GroupId, Values } from "./types";

/** Calculators are listed under these headings, in this order. */
export const GROUPS: readonly GroupId[] = ["returns", "profitability", "liquidity", "investment", "markets"];

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
        { id: "roi", kind: "percent" },
        { id: "netProfit", kind: "currency" },
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
        { id: "cagr", kind: "percent" },
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
        { id: "roe", kind: "percent" },
        { id: "roa", kind: "percent" },
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
        { id: "margin", kind: "percent" },
        { id: "markup", kind: "percent" },
        { id: "profit", kind: "currency" },
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
        { id: "contributionMargin", kind: "currency" },
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
        { id: "currentRatio", kind: "ratio" },
        { id: "quickRatio", kind: "ratio" },
        { id: "cashRatio", kind: "ratio" },
        { id: "workingCapital", kind: "currency" },
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
        { id: "cashConversionCycle", kind: "days" },
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
        { id: "debtToEquity", kind: "ratio" },
        { id: "debtToCapital", kind: "percent" },
        { id: "interestCoverage", kind: "multiple" },
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
        { id: "npv", kind: "currency" },
        { id: "irr", kind: "percent" },
        { id: "profitabilityIndex", kind: "ratio" },
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
        { id: "advantage", kind: "currency", currency: "BRL" },
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
        { id: "difference", kind: "currency", currency: "BRL" },
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
