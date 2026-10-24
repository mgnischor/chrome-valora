/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/calculators.test.ts
    Description: Unit tests for the calculator catalogue: known answers and structural invariants.
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
import { describe, expect, it } from "vitest";
import {
    CALCULATORS,
    DEFAULT_CALCULATOR,
    GROUPS,
    MAX_CASH_FLOWS,
    getCalculator,
    isCalculatorId,
} from "../src/core/calculators";
import { evaluate, readField } from "../src/core/inputs";
import type { Values } from "../src/core/types";

/**
 * Runs a calculator on the given inputs and returns the results by output id.
 *
 * @param id - Calculator id.
 * @param values - Validated inputs.
 * @returns The value of each output; `null` where it is undefined.
 */
function run(id: string, values: Values): Record<string, number | null> {
    return Object.fromEntries(evaluate(getCalculator(id), values).map((result) => [result.id, result.value]));
}

describe("catalogue structure", () => {
    it("has unique calculator ids", () => {
        const ids = CALCULATORS.map((calculator) => calculator.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("puts every calculator in a known group and uses every group", () => {
        for (const calculator of CALCULATORS) expect(GROUPS).toContain(calculator.group);
        for (const group of GROUPS) expect(CALCULATORS.some((calculator) => calculator.group === group)).toBe(true);
    });

    it("has unique field and output ids inside each calculator", () => {
        for (const calculator of CALCULATORS) {
            const fields = calculator.fields.map((field) => field.id);
            const outputs = calculator.outputs.map((output) => output.id);
            expect(new Set(fields).size, calculator.id).toBe(fields.length);
            expect(new Set(outputs).size, calculator.id).toBe(outputs.length);
        }
    });

    it("recognizes calculator ids", () => {
        expect(isCalculatorId(DEFAULT_CALCULATOR)).toBe(true);
        expect(isCalculatorId("nope")).toBe(false);
        expect(isCalculatorId(undefined)).toBe(false);
        expect(() => getCalculator("nope")).toThrow();
    });

    it.each(CALCULATORS.map((calculator) => calculator.id))("%s: examples satisfy their own field rules", (id) => {
        const calculator = getCalculator(id);
        for (const field of calculator.fields) {
            const example = field.example;
            if (field.kind === "series") {
                expect(Array.isArray(example), field.id).toBe(true);
                const length = (example as readonly number[]).length;
                expect(length).toBeGreaterThanOrEqual(field.minItems ?? 1);
                expect(length).toBeLessThanOrEqual(field.maxItems ?? Infinity);
            } else {
                expect(typeof example, field.id).toBe("number");
                if (field.min !== undefined) expect(example as number).toBeGreaterThanOrEqual(field.min);
                if (field.min !== undefined && field.minExclusive) expect(example as number).toBeGreaterThan(field.min);
                if (field.max !== undefined) expect(example as number).toBeLessThanOrEqual(field.max);
                if (field.kind === "choice") expect(field.choices).toContain(example);
            }
            if (typeof field.default === "number" && field.min !== undefined) {
                expect(field.default).toBeGreaterThanOrEqual(field.min);
            }
        }
    });

    it.each(CALCULATORS.map((calculator) => calculator.id))(
        "%s: gives a finite number for every output with the example inputs",
        (id) => {
            const calculator = getCalculator(id);
            const values = Object.fromEntries(calculator.fields.map((field) => [field.id, field.example]));
            const results = evaluate(calculator, values);
            expect(results.map((result) => result.id)).toEqual(calculator.outputs.map((output) => output.id));
            for (const result of results) {
                expect(result.value, `${id}.${result.id}`).not.toBeNull();
                expect(Number.isFinite(result.value), `${id}.${result.id}`).toBe(true);
            }
        }
    );

    it.each(CALCULATORS.map((calculator) => calculator.id))(
        "%s: reports every declared output and nothing else",
        (id) => {
            const calculator = getCalculator(id);
            const values = Object.fromEntries(calculator.fields.map((field) => [field.id, field.example]));
            expect(Object.keys(calculator.calculate(values)).sort()).toEqual(
                calculator.outputs.map((output) => output.id).sort()
            );
        }
    );
});

describe("roi", () => {
    it("computes net profit, ROI and the return multiple", () => {
        const results = run("roi", { invested: 1000, returned: 1250 });
        expect(results.roi).toBeCloseTo(0.25, 12);
        expect(results.netProfit).toBe(250);
        expect(results.multiple).toBeCloseTo(1.25, 12);
    });

    it("reports a loss as a negative ROI", () => {
        expect(run("roi", { invested: 1000, returned: 400 }).roi).toBeCloseTo(-0.6, 12);
    });
});

describe("cagr", () => {
    it("computes the yearly rate and the total growth", () => {
        const results = run("cagr", { startValue: 10_000, endValue: 20_000, years: 5 });
        expect(results.cagr).toBeCloseTo(0.148698, 6);
        expect(results.totalGrowth).toBeCloseTo(1, 12);
    });

    it("accepts fractional years", () => {
        expect(run("cagr", { startValue: 100, endValue: 110, years: 0.5 }).cagr).toBeCloseTo(0.21, 12);
    });
});

describe("roe", () => {
    it("computes ROE, ROA and the equity multiplier, which tie together as ROE = ROA × multiplier", () => {
        const results = run("roe", { netIncome: 120_000, equity: 800_000, assets: 2_000_000 });
        expect(results.roe).toBeCloseTo(0.15, 12);
        expect(results.roa).toBeCloseTo(0.06, 12);
        expect(results.equityMultiplier).toBeCloseTo(2.5, 12);
        expect(results.roa! * results.equityMultiplier!).toBeCloseTo(results.roe!, 12);
    });

    it("accepts a loss", () => {
        expect(run("roe", { netIncome: -50_000, equity: 500_000, assets: 1_000_000 }).roe).toBeCloseTo(-0.1, 12);
    });
});

describe("margin", () => {
    it("distinguishes margin (on price) from markup (on cost)", () => {
        const results = run("margin", { cost: 60, price: 100 });
        expect(results.margin).toBeCloseTo(0.4, 12);
        expect(results.markup).toBeCloseTo(2 / 3, 12);
        expect(results.profit).toBe(40);
    });

    it("leaves the markup undefined when the cost is zero", () => {
        const results = run("margin", { cost: 0, price: 100 });
        expect(results.markup).toBeNull();
        expect(results.margin).toBe(1);
    });

    it("shows a loss", () => {
        const results = run("margin", { cost: 120, price: 100 });
        expect(results.margin).toBeCloseTo(-0.2, 12);
        expect(results.profit).toBe(-20);
    });
});

describe("pricing", () => {
    it("finds the price for a target margin and the markup it requires", () => {
        const results = run("pricing", { cost: 60, targetMargin: 0.4 });
        expect(results.price).toBeCloseTo(100, 10);
        expect(results.markup).toBeCloseTo(2 / 3, 12);
        expect(results.profit).toBeCloseTo(40, 10);
    });

    it("is consistent with the margin calculator", () => {
        const price = run("pricing", { cost: 83, targetMargin: 0.27 }).price!;
        expect(run("margin", { cost: 83, price }).margin).toBeCloseTo(0.27, 12);
    });

    it("needs no markup for a zero margin", () => {
        const results = run("pricing", { cost: 50, targetMargin: 0 });
        expect(results.price).toBe(50);
        expect(results.markup).toBe(0);
    });
});

describe("breakeven", () => {
    it("rounds the units up to whole units", () => {
        const results = run("breakeven", { fixedCosts: 50_000, price: 25, variableCost: 10, targetProfit: 0 });
        expect(results.units).toBe(3334);
        expect(results.contributionMargin).toBe(15);
        expect(results.contributionMarginRatio).toBeCloseTo(0.6, 12);
        expect(results.revenue).toBeCloseTo((50_000 / 15) * 25, 6);
    });

    it("does not round an exact answer up", () => {
        expect(run("breakeven", { fixedCosts: 15_000, price: 25, variableCost: 10, targetProfit: 0 }).units).toBe(1000);
    });

    it("adds the profit goal to the amount to cover", () => {
        expect(run("breakeven", { fixedCosts: 10_000, price: 20, variableCost: 10, targetProfit: 5_000 }).units).toBe(
            1500
        );
    });

    it("is undefined when each unit loses money or breaks even", () => {
        for (const variableCost of [25, 30]) {
            const results = run("breakeven", { fixedCosts: 1000, price: 25, variableCost, targetProfit: 0 });
            expect(results.units).toBeNull();
            expect(results.revenue).toBeNull();
        }
    });
});

describe("liquidity", () => {
    const inputs = {
        cash: 50_000,
        receivables: 80_000,
        inventory: 70_000,
        otherCurrentAssets: 10_000,
        currentLiabilities: 150_000,
    };

    it("computes the current, quick and cash ratios and the working capital", () => {
        const results = run("liquidity", inputs);
        expect(results.currentRatio).toBeCloseTo(210 / 150, 12);
        expect(results.quickRatio).toBeCloseTo(130 / 150, 12);
        expect(results.cashRatio).toBeCloseTo(50 / 150, 12);
        expect(results.workingCapital).toBe(60_000);
    });

    it("orders the ratios from the strictest to the loosest", () => {
        const results = run("liquidity", inputs);
        expect(results.cashRatio!).toBeLessThanOrEqual(results.quickRatio!);
        expect(results.quickRatio!).toBeLessThanOrEqual(results.currentRatio!);
    });

    it("reports negative working capital", () => {
        expect(run("liquidity", { ...inputs, currentLiabilities: 300_000 }).workingCapital).toBe(-90_000);
    });
});

describe("cashCycle", () => {
    it("adds the days of inventory and receivables and subtracts the days of payables", () => {
        const results = run("cashCycle", {
            revenue: 1_200_000,
            cogs: 800_000,
            inventory: 120_000,
            receivables: 150_000,
            payables: 90_000,
            periodDays: 365,
        });
        expect(results.daysInventory).toBeCloseTo((120_000 / 800_000) * 365, 10);
        expect(results.daysReceivables).toBeCloseTo((150_000 / 1_200_000) * 365, 10);
        expect(results.daysPayables).toBeCloseTo((90_000 / 800_000) * 365, 10);
        expect(results.cashConversionCycle).toBeCloseTo(54.75 + 45.625 - 41.0625, 10);
        expect(results.inventoryTurnover).toBeCloseTo(800_000 / 120_000, 12);
    });

    it("scales with the length of the period", () => {
        const base = { revenue: 100, cogs: 80, inventory: 10, receivables: 20, payables: 5 };
        const year = run("cashCycle", { ...base, periodDays: 360 }).cashConversionCycle!;
        const quarter = run("cashCycle", { ...base, periodDays: 90 }).cashConversionCycle!;
        expect(year / quarter).toBeCloseTo(4, 12);
    });

    it("leaves the turnover undefined without inventory", () => {
        const results = run("cashCycle", {
            revenue: 100,
            cogs: 80,
            inventory: 0,
            receivables: 20,
            payables: 5,
            periodDays: 365,
        });
        expect(results.inventoryTurnover).toBeNull();
        expect(results.daysInventory).toBe(0);
    });
});

describe("leverage", () => {
    it("computes debt-to-equity, debt-to-capital and the interest coverage", () => {
        const results = run("leverage", {
            totalDebt: 400_000,
            equity: 600_000,
            ebit: 150_000,
            interestExpense: 40_000,
        });
        expect(results.debtToEquity).toBeCloseTo(2 / 3, 12);
        expect(results.debtToCapital).toBeCloseTo(0.4, 12);
        expect(results.interestCoverage).toBeCloseTo(3.75, 12);
    });

    it("leaves the coverage undefined when there is no interest", () => {
        expect(
            run("leverage", { totalDebt: 0, equity: 100, ebit: 10, interestExpense: 0 }).interestCoverage
        ).toBeNull();
    });
});

describe("investment", () => {
    const base = { rate: 0.1, initialInvestment: 1000, cashFlows: [400, 400, 400, 300] };

    it("computes the NPV, the IRR and the profitability index", () => {
        const results = run("investment", base);
        expect(results.npv).toBeCloseTo(199.645, 3);
        expect(results.profitabilityIndex).toBeCloseTo(1.199645, 5);
        // The IRR is the rate at which the NPV is zero.
        const atIrr = run("investment", { ...base, rate: results.irr! });
        expect(atIrr.npv).toBeCloseTo(0, 6);
        expect(results.irr!).toBeGreaterThan(base.rate);
    });

    it("computes the simple and the discounted payback", () => {
        const results = run("investment", base);
        expect(results.payback).toBeCloseTo(2.5, 10);
        expect(results.discountedPayback).toBeGreaterThan(results.payback!);
    });

    it("rejects a project whose NPV is negative: IRR below the discount rate", () => {
        const results = run("investment", { ...base, rate: 0.3 });
        expect(results.npv!).toBeLessThan(0);
        expect(results.irr!).toBeLessThan(0.3);
        expect(results.profitabilityIndex!).toBeLessThan(1);
    });

    it("has no payback when the investment is not recovered, and no IRR when nothing is received", () => {
        const results = run("investment", { rate: 0.1, initialInvestment: 1000, cashFlows: [100, 100] });
        expect(results.irr).toBeLessThan(0);
        expect(results.payback).toBeNull();
        expect(results.discountedPayback).toBeNull();
        expect(run("investment", { rate: 0.1, initialInvestment: 1000, cashFlows: [0, 0] }).irr).toBeNull();
    });

    it("leaves the profitability index undefined without an initial investment", () => {
        expect(run("investment", { ...base, initialInvestment: 0 }).profitabilityIndex).toBeNull();
    });

    it("accepts as many cash flows as the field allows", () => {
        const results = run("investment", {
            rate: 0.01,
            initialInvestment: 100,
            cashFlows: Array.from({ length: MAX_CASH_FLOWS }, () => 5),
        });
        expect(Number.isFinite(results.npv)).toBe(true);
        expect(results.irr).not.toBeNull();
    });
});

describe("futureValue", () => {
    it("compounds the initial amount and the deposits", () => {
        const results = run("futureValue", {
            presentValue: 1000,
            contribution: 100,
            annualRate: 0.05,
            years: 10,
            frequency: 12,
        });
        expect(results.futureValue).toBeCloseTo(1647.0095 + 15528.2278, 3);
        expect(results.totalContributions).toBe(1000 + 100 * 120);
        expect(results.interestEarned).toBeCloseTo(results.futureValue! - results.totalContributions!, 8);
    });

    it("compounds more often for the same annual rate to grow slightly more", () => {
        const at = (frequency: number) =>
            run("futureValue", { presentValue: 1000, contribution: 0, annualRate: 0.08, years: 5, frequency })
                .futureValue!;
        expect(at(12)).toBeGreaterThan(at(4));
        expect(at(4)).toBeGreaterThan(at(1));
        expect(at(1)).toBeCloseTo(1000 * 1.08 ** 5, 8);
    });

    it("earns no interest at a zero rate", () => {
        const results = run("futureValue", {
            presentValue: 1000,
            contribution: 50,
            annualRate: 0,
            years: 2,
            frequency: 12,
        });
        expect(results.futureValue).toBe(1000 + 50 * 24);
        expect(results.interestEarned).toBe(0);
    });
});

describe("loan", () => {
    it("matches the standard mortgage example", () => {
        const results = run("loan", { principal: 200_000, annualRate: 0.06, termMonths: 360 });
        expect(results.monthlyPayment).toBeCloseTo(1199.101, 3);
        expect(results.totalPaid).toBeCloseTo(1199.101 * 360, 0);
        expect(results.totalInterest).toBeCloseTo(results.totalPaid! - 200_000, 8);
    });

    it("charges no interest at a zero rate", () => {
        const results = run("loan", { principal: 12_000, annualRate: 0, termMonths: 24 });
        expect(results.monthlyPayment).toBe(500);
        expect(results.totalInterest).toBe(0);
    });
});

describe("field rules protect the formulas from undefined results", () => {
    it("rejects the zero divisors that the calculators divide by", () => {
        const zero = (id: string, field: string) =>
            readField(
                getCalculator(id).fields.find((candidate) => candidate.id === field)!,
                "0",
                "."
            );
        expect(zero("roi", "invested").ok).toBe(false);
        expect(zero("cagr", "startValue").ok).toBe(false);
        expect(zero("cagr", "years").ok).toBe(false);
        expect(zero("roe", "equity").ok).toBe(false);
        expect(zero("margin", "price").ok).toBe(false);
        expect(zero("breakeven", "price").ok).toBe(false);
        expect(zero("liquidity", "currentLiabilities").ok).toBe(false);
        expect(zero("cashCycle", "cogs").ok).toBe(false);
        expect(zero("leverage", "equity").ok).toBe(false);
        expect(zero("loan", "principal").ok).toBe(false);
        expect(zero("loan", "termMonths").ok).toBe(false);
    });
});
