/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/accounting.test.ts
    Description: Unit tests for the accounting and corporate-finance models and their calculators.
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
    DEPRECIATION_DOUBLE_DECLINING,
    DEPRECIATION_STRAIGHT_LINE,
    DEPRECIATION_SUM_OF_YEARS,
    altmanEmergingZ,
    altmanZ,
    altmanZone,
    bondMetrics,
    depreciationInYear,
    depreciationSchedule,
    fleurietType,
    priceLoanPlan,
    sacLoanPlan,
} from "../src/core/accounting";
import { CALCULATORS, getCalculator } from "../src/core/calculators";
import { presentValue } from "../src/core/finance";
import { evaluate } from "../src/core/inputs";
import type { Values } from "../src/core/types";

/**
 * Runs a calculator and returns the results by output id.
 *
 * @param id - Calculator id.
 * @param values - Validated inputs.
 * @returns The value of each output.
 */
function run(id: string, values: Values): Record<string, number | null> {
    return Object.fromEntries(evaluate(getCalculator(id), values).map((result) => [result.id, result.value]));
}

describe("fleurietType", () => {
    it.each([
        ["I: surplus of working capital, negative need", 100, -200, 300, 1],
        ["II: working capital covers a positive need", 300, 200, 100, 2],
        ["III: positive need exceeds working capital", 100, 300, -200, 3],
        ["IV: negative working capital with a positive need", -100, 50, -150, 4],
        ["V: negative working capital and negative treasury", -300, -100, -200, 5],
        ["VI: negative working capital financed by a negative need", -100, -300, 200, 6],
    ])("classifies %s", (_name, cdg, ncg, treasury, expected) => {
        expect(fleurietType(cdg, ncg, treasury)).toBe(expected);
    });

    it("counts zero as positive", () => {
        expect(fleurietType(0, 0, 0)).toBe(2);
        expect(fleurietType(100, 0, 100)).toBe(2);
    });
});

describe("Altman", () => {
    it("weights the five ratios of the original model", () => {
        expect(altmanZ([0.1, 0.1, 0.1, 1, 1])).toBeCloseTo(0.12 + 0.14 + 0.33 + 0.6 + 1.0, 12);
    });

    it("adds the constant and drops the sales ratio in the emerging-market model", () => {
        expect(altmanEmergingZ([0.1, 0.1, 0.1, 1])).toBeCloseTo(3.25 + 0.656 + 0.326 + 0.672 + 1.05, 12);
    });

    it("reads a score against the two cut-offs", () => {
        expect(altmanZone(1.8, 1.81, 2.99)).toBe(0);
        expect(altmanZone(1.81, 1.81, 2.99)).toBe(1);
        expect(altmanZone(2.99, 1.81, 2.99)).toBe(1);
        expect(altmanZone(3, 1.81, 2.99)).toBe(2);
    });
});

describe("depreciation", () => {
    it("charges the same amount every year on a straight line", () => {
        expect(depreciationInYear(DEPRECIATION_STRAIGHT_LINE, 100_000, 10_000, 5, 3)).toBe(18_000);
    });

    it("front-loads the double declining balance and stops at the salvage value", () => {
        const charges = [1, 2, 3, 4, 5].map((year) =>
            depreciationInYear(DEPRECIATION_DOUBLE_DECLINING, 100_000, 10_000, 5, year)
        );
        expect(charges[0]).toBeCloseTo(40_000, 8);
        expect(charges[1]).toBeCloseTo(24_000, 8);
        expect(charges[2]).toBeCloseTo(14_400, 8);
        expect(charges[3]).toBeCloseTo(8_640, 8);
        expect(charges[4]).toBeCloseTo(2_960, 8);
        expect(charges.reduce((sum, charge) => sum + charge, 0)).toBeCloseTo(90_000, 8);
    });

    it("weights the sum of the years' digits", () => {
        expect(depreciationInYear(DEPRECIATION_SUM_OF_YEARS, 100_000, 10_000, 5, 1)).toBeCloseTo(30_000, 8);
        expect(depreciationInYear(DEPRECIATION_SUM_OF_YEARS, 100_000, 10_000, 5, 2)).toBeCloseTo(24_000, 8);
    });

    it.each([DEPRECIATION_STRAIGHT_LINE, DEPRECIATION_DOUBLE_DECLINING, DEPRECIATION_SUM_OF_YEARS])(
        "method %d depreciates exactly the depreciable base over the life, and nothing after it",
        (method) => {
            const end = depreciationSchedule(method, 100_000, 10_000, 5, 5);
            expect(end.accumulated).toBeCloseTo(90_000, 8);
            expect(end.bookValue).toBeCloseTo(10_000, 8);
            const after = depreciationSchedule(method, 100_000, 10_000, 5, 9);
            expect(after.charge).toBe(0);
            expect(after.bookValue).toBeCloseTo(10_000, 8);
        }
    );

    it("never depreciates below the salvage value, even when it exceeds the cost", () => {
        expect(depreciationInYear(DEPRECIATION_STRAIGHT_LINE, 1_000, 5_000, 4, 1)).toBe(0);
    });
});

describe("bondMetrics", () => {
    it("prices a bond at par when the coupon equals the yield", () => {
        const metrics = bondMetrics(1000, 0.1, 0.1, 5, 2)!;
        expect(metrics.price).toBeCloseTo(1000, 8);
        // Par-bond duration in periods: (1 + y) / y × (1 − (1 + y)^-n), with y = 5 % and n = 10.
        expect(metrics.macaulayDuration).toBeCloseTo(((1.05 / 0.05) * (1 - 1.05 ** -10)) / 2, 10);
        expect(metrics.modifiedDuration).toBeCloseTo(metrics.macaulayDuration / 1.05, 12);
    });

    it("sells below par when the yield is above the coupon, and above par when it is below", () => {
        expect(bondMetrics(1000, 0.1, 0.12, 5, 2)!.price).toBeLessThan(1000);
        expect(bondMetrics(1000, 0.1, 0.08, 5, 2)!.price).toBeGreaterThan(1000);
    });

    it("matches the present value of the cash flows", () => {
        const expected = Array.from({ length: 10 }, (_v, index) => 50 / 1.06 ** (index + 1)).reduce(
            (sum, value) => sum + value,
            0
        );
        expect(bondMetrics(1000, 0.1, 0.12, 5, 2)!.price).toBeCloseTo(expected + 1000 / 1.06 ** 10, 8);
    });

    it("has a duration equal to its maturity when there are no coupons", () => {
        const metrics = bondMetrics(1000, 0, 0.08, 5, 1)!;
        expect(metrics.price).toBeCloseTo(1000 / 1.08 ** 5, 8);
        expect(metrics.macaulayDuration).toBeCloseTo(5, 12);
    });

    it("rounds the maturity to whole coupon periods, with at least one", () => {
        expect(bondMetrics(1000, 0.1, 0.1, 0.1, 2)!.price).toBeCloseTo(1000, 8);
    });

    it("is undefined for a yield that would make the periodic rate -100 % or lower", () => {
        expect(bondMetrics(1000, 0.1, -2, 5, 2)).toBeNull();
    });
});

describe("loan plans", () => {
    it("computes the Price table", () => {
        const plan = priceLoanPlan(200_000, 0.01, 120)!;
        expect(plan.firstPayment).toBeCloseTo(2869.42, 2);
        expect(plan.lastPayment).toBe(plan.firstPayment);
        // The payments, discounted at the loan rate, are worth the amount borrowed.
        expect(
            presentValue(
                0.01,
                Array.from({ length: 120 }, () => plan.firstPayment)
            )
        ).toBeCloseTo(200_000, 4);
        expect(plan.totalInterest).toBeCloseTo(plan.firstPayment * 120 - 200_000, 8);
    });

    it("computes SAC, with falling payments", () => {
        const plan = sacLoanPlan(200_000, 0.01, 120)!;
        expect(plan.firstPayment).toBeCloseTo(200_000 / 120 + 2000, 8);
        expect(plan.lastPayment).toBeCloseTo((200_000 / 120) * 1.01, 8);
        expect(plan.totalInterest).toBeCloseTo(121_000, 6);
    });

    it("sums the interest of every SAC payment", () => {
        const principal = 12_000;
        const periods = 12;
        const rate = 0.02;
        let balance = principal;
        let interest = 0;
        for (let period = 0; period < periods; period++) {
            interest += balance * rate;
            balance -= principal / periods;
        }
        expect(sacLoanPlan(principal, rate, periods)!.totalInterest).toBeCloseTo(interest, 8);
    });

    it("charges less interest under SAC than under Price, at the same rate", () => {
        expect(sacLoanPlan(200_000, 0.01, 120)!.totalInterest).toBeLessThan(
            priceLoanPlan(200_000, 0.01, 120)!.totalInterest
        );
    });

    it("splits the principal evenly at a zero rate", () => {
        expect(priceLoanPlan(1200, 0, 12)!.firstPayment).toBe(100);
        expect(sacLoanPlan(1200, 0, 12)!.totalInterest).toBe(0);
    });

    it("has no plan without periods", () => {
        expect(priceLoanPlan(1000, 0.01, 0)).toBeNull();
        expect(sacLoanPlan(1000, 0.01, 0)).toBeNull();
    });
});

describe("incomeStatement", () => {
    const base = {
        revenue: 1_000_000,
        cogs: 600_000,
        operatingExpenses: 150_000,
        depreciation: 50_000,
        interestExpense: 40_000,
        taxRate: 0.25,
    };

    it("walks from revenue to net income and gives each margin", () => {
        const results = run("incomeStatement", base);
        expect(results.netIncome).toBeCloseTo(120_000, 8);
        expect(results.grossMargin).toBeCloseTo(0.4, 12);
        expect(results.ebitdaMargin).toBeCloseTo(0.25, 12);
        expect(results.operatingMargin).toBeCloseTo(0.2, 12);
        expect(results.netMargin).toBeCloseTo(0.12, 12);
    });

    it("pays no tax on a loss", () => {
        const results = run("incomeStatement", { ...base, cogs: 900_000 });
        // 1,000,000 - 900,000 - 150,000 - 50,000 - 40,000
        expect(results.netIncome).toBe(-140_000);
    });
});

describe("dupont", () => {
    it("breaks ROE into margin × turnover × equity multiplier", () => {
        const results = run("dupont", { netIncome: 120_000, revenue: 1_500_000, assets: 1_000_000, equity: 600_000 });
        expect(results.netMargin).toBeCloseTo(0.08, 12);
        expect(results.assetTurnover).toBeCloseTo(1.5, 12);
        expect(results.equityMultiplier).toBeCloseTo(1 / 0.6, 12);
        expect(results.roe).toBeCloseTo(0.2, 12);
        expect(results.netMargin! * results.assetTurnover! * results.equityMultiplier!).toBeCloseTo(results.roe!, 12);
        expect(results.roa).toBeCloseTo(0.12, 12);
    });
});

describe("dupont5", () => {
    const inputs = {
        netIncome: 120_000,
        pretaxIncome: 180_000,
        ebit: 220_000,
        revenue: 1_500_000,
        assets: 1_000_000,
        equity: 600_000,
    };

    it("breaks ROE into five factors whose product is the ROE", () => {
        const results = run("dupont5", inputs);
        expect(results.taxBurden).toBeCloseTo(2 / 3, 12);
        expect(results.interestBurden).toBeCloseTo(180 / 220, 12);
        expect(results.operatingMargin).toBeCloseTo(220 / 1500, 12);
        const product =
            results.taxBurden! *
            results.interestBurden! *
            results.operatingMargin! *
            results.assetTurnover! *
            results.equityMultiplier!;
        expect(product).toBeCloseTo(results.roe!, 12);
        expect(results.roe).toBeCloseTo(0.2, 12);
    });

    it("leaves the factors undefined where they divide by zero", () => {
        expect(run("dupont5", { ...inputs, pretaxIncome: 0 }).taxBurden).toBeNull();
        expect(run("dupont5", { ...inputs, ebit: 0 }).interestBurden).toBeNull();
    });
});

describe("fleuriet", () => {
    it("derives working capital, the need for it and the treasury balance", () => {
        const results = run("fleuriet", {
            operatingCurrentAssets: 500_000,
            operatingCurrentLiabilities: 300_000,
            nonCurrentAssets: 700_000,
            permanentFunds: 1_000_000,
        });
        expect(results.workingCapital).toBe(300_000);
        expect(results.workingCapitalNeed).toBe(200_000);
        expect(results.treasury).toBe(100_000);
        expect(results.structureType).toBe(2);
    });

    it("reports a company that finances its need with short-term debt as type III", () => {
        const results = run("fleuriet", {
            operatingCurrentAssets: 600_000,
            operatingCurrentLiabilities: 100_000,
            nonCurrentAssets: 500_000,
            permanentFunds: 700_000,
        });
        expect(results.treasury).toBe(-300_000);
        expect(results.structureType).toBe(3);
    });
});

describe("altman", () => {
    it("scores a healthy company in the safe zone under both models", () => {
        const results = run("altman", {
            workingCapital: 200_000,
            retainedEarnings: 300_000,
            ebit: 180_000,
            equityValue: 800_000,
            sales: 1_500_000,
            totalAssets: 1_200_000,
            totalLiabilities: 600_000,
        });
        expect(results.zScore).toBeCloseTo(3.095, 3);
        expect(results.zZone).toBe(2);
        expect(results.emergingScore).toBeCloseTo(7.5663, 3);
        expect(results.emergingZone).toBe(2);
    });

    it("scores a struggling company in the distress zone", () => {
        const results = run("altman", {
            workingCapital: -300,
            retainedEarnings: -200,
            ebit: -100,
            equityValue: 100,
            sales: 500,
            totalAssets: 1000,
            totalLiabilities: 900,
        });
        expect(results.zScore!).toBeLessThan(1.81);
        expect(results.zZone).toBe(0);
        expect(results.emergingZone).toBe(0);
    });

    it("finds the grey zone in between", () => {
        const results = run("altman", {
            workingCapital: 100,
            retainedEarnings: 100,
            ebit: 100,
            equityValue: 500,
            sales: 1000,
            totalAssets: 1000,
            totalLiabilities: 500,
        });
        expect(results.zScore).toBeCloseTo(2.19, 10);
        expect(results.zZone).toBe(1);
    });
});

describe("leverageDegrees", () => {
    it("computes the operating, financial and combined degrees of leverage", () => {
        const results = run("leverageDegrees", {
            revenue: 1_000_000,
            variableCosts: 500_000,
            fixedCosts: 300_000,
            interestExpense: 50_000,
        });
        expect(results.ebit).toBe(200_000);
        expect(results.operatingLeverage).toBeCloseTo(2.5, 12);
        expect(results.financialLeverage).toBeCloseTo(200 / 150, 12);
        expect(results.combinedLeverage).toBeCloseTo(2.5 * (200 / 150), 12);
    });

    it("is undefined at the break-even point, where the percentage change has no base", () => {
        const results = run("leverageDegrees", {
            revenue: 800_000,
            variableCosts: 500_000,
            fixedCosts: 300_000,
            interestExpense: 0,
        });
        expect(results.operatingLeverage).toBeNull();
        expect(results.combinedLeverage).toBeNull();
    });
});

describe("depreciation calculator", () => {
    const base = { cost: 100_000, salvage: 10_000, lifeYears: 5, method: DEPRECIATION_STRAIGHT_LINE, year: 2 };

    it("reports the charge, the total so far and the book value of a year", () => {
        const results = run("depreciation", base);
        expect(results.charge).toBe(18_000);
        expect(results.accumulated).toBe(36_000);
        expect(results.bookValue).toBe(64_000);
    });

    it("follows the chosen method", () => {
        expect(run("depreciation", { ...base, method: DEPRECIATION_DOUBLE_DECLINING }).accumulated).toBeCloseTo(
            64_000,
            8
        );
        expect(run("depreciation", { ...base, method: DEPRECIATION_SUM_OF_YEARS }).accumulated).toBeCloseTo(54_000, 8);
    });
});

describe("wacc", () => {
    it("weights the cost of equity from CAPM and the after-tax cost of debt", () => {
        const results = run("wacc", {
            equityValue: 600_000,
            debtValue: 400_000,
            riskFree: 0.1,
            beta: 1.2,
            marketPremium: 0.06,
            costOfDebt: 0.14,
            taxRate: 0.25,
        });
        expect(results.costOfEquity).toBeCloseTo(0.172, 12);
        expect(results.afterTaxCostOfDebt).toBeCloseTo(0.105, 12);
        expect(results.equityWeight).toBeCloseTo(0.6, 12);
        expect(results.debtWeight).toBeCloseTo(0.4, 12);
        expect(results.wacc).toBeCloseTo(0.6 * 0.172 + 0.4 * 0.105, 12);
    });

    it("equals the cost of equity for a company without debt", () => {
        const results = run("wacc", {
            equityValue: 100,
            debtValue: 0,
            riskFree: 0.05,
            beta: 1,
            marketPremium: 0.05,
            costOfDebt: 0.2,
            taxRate: 0.3,
        });
        expect(results.wacc).toBeCloseTo(0.1, 12);
    });
});

describe("eva", () => {
    it("subtracts the capital charge from the operating profit after tax", () => {
        const results = run("eva", { ebit: 250_000, taxRate: 0.25, investedCapital: 1_000_000, wacc: 0.15 });
        expect(results.nopat).toBeCloseTo(187_500, 8);
        expect(results.capitalCharge).toBeCloseTo(150_000, 8);
        expect(results.eva).toBeCloseTo(37_500, 8);
        expect(results.roic).toBeCloseTo(0.1875, 12);
        expect(results.spread).toBeCloseTo(0.0375, 12);
    });

    it("destroys value when the return is below the cost of capital", () => {
        expect(run("eva", { ebit: 100_000, taxRate: 0.25, investedCapital: 1_000_000, wacc: 0.15 }).eva!).toBeLessThan(
            0
        );
    });
});

describe("freeCashFlow", () => {
    it("derives the free cash flow to the firm and to equity", () => {
        const results = run("freeCashFlow", {
            ebit: 250_000,
            taxRate: 0.25,
            depreciation: 50_000,
            capex: 80_000,
            changeInWorkingCapital: 20_000,
            interestExpense: 40_000,
            netBorrowing: 30_000,
        });
        expect(results.nopat).toBeCloseTo(187_500, 8);
        expect(results.fcff).toBeCloseTo(137_500, 8);
        // FCFE = FCFF − interest × (1 − tax) + net borrowing
        expect(results.fcfe).toBeCloseTo(137_500 - 30_000 + 30_000, 8);
    });
});

describe("bond calculator", () => {
    it("shows a par bond", () => {
        const results = run("bond", { faceValue: 1000, couponRate: 0.1, yieldToMaturity: 0.1, years: 5, frequency: 2 });
        expect(results.price).toBeCloseTo(1000, 8);
        expect(results.premium).toBeCloseTo(0, 10);
        expect(results.currentYield).toBeCloseTo(0.1, 10);
        expect(results.modifiedDuration!).toBeLessThan(results.macaulayDuration!);
    });

    it("shows the discount and the higher current yield of a bond priced below par", () => {
        const results = run("bond", {
            faceValue: 1000,
            couponRate: 0.1,
            yieldToMaturity: 0.14,
            years: 5,
            frequency: 1,
        });
        expect(results.premium!).toBeLessThan(0);
        expect(results.currentYield!).toBeGreaterThan(0.1);
    });
});

describe("rates", () => {
    it("converts a nominal rate to the effective, monthly, daily and real rates", () => {
        const results = run("rates", { nominalRate: 0.12, compounding: 12, inflation: 0.045 });
        expect(results.effectiveAnnual).toBeCloseTo(1.01 ** 12 - 1, 12);
        expect(results.monthlyEquivalent).toBeCloseTo(0.01, 12);
        expect(results.dailyEquivalent).toBeCloseTo((1 + results.effectiveAnnual!) ** (1 / 252) - 1, 12);
        expect(results.realRate).toBeCloseTo((1 + results.effectiveAnnual!) / 1.045 - 1, 12);
    });

    it("leaves a yearly rate unchanged when it compounds once a year", () => {
        expect(run("rates", { nominalRate: 0.1, compounding: 1, inflation: 0 }).effectiveAnnual).toBeCloseTo(0.1, 12);
    });

    it("compounds more often to a higher effective rate", () => {
        const effective = (compounding: number) =>
            run("rates", { nominalRate: 0.12, compounding, inflation: 0 }).effectiveAnnual!;
        expect(effective(365)).toBeGreaterThan(effective(12));
        expect(effective(12)).toBeGreaterThan(effective(4));
        expect(effective(4)).toBeGreaterThan(effective(1));
    });

    it("shows a negative real rate when inflation is above the return", () => {
        expect(run("rates", { nominalRate: 0.05, compounding: 1, inflation: 0.08 }).realRate!).toBeLessThan(0);
    });
});

describe("amortization", () => {
    it("compares the Price table with SAC", () => {
        const results = run("amortization", { principal: 200_000, annualRate: 0.12, termMonths: 120 });
        expect(results.pricePayment).toBeCloseTo(2869.42, 2);
        expect(results.priceTotalInterest).toBeCloseTo(results.pricePayment! * 120 - 200_000, 6);
        expect(results.sacFirstPayment).toBeCloseTo(3666.67, 2);
        expect(results.sacLastPayment).toBeCloseTo(1683.33, 2);
        expect(results.sacTotalInterest).toBeCloseTo(121_000, 6);
        expect(results.sacTotalInterest!).toBeLessThan(results.priceTotalInterest!);
    });
});

describe("category outputs", () => {
    it.each(CALCULATORS.map((calculator) => calculator.id))("%s declares every category it can report", (id) => {
        const calculator = getCalculator(id);
        const values = Object.fromEntries(calculator.fields.map((field) => [field.id, field.example]));
        const results = evaluate(calculator, values);
        for (const output of calculator.outputs) {
            if (output.kind !== "category") {
                expect(output.categories, `${id}.${output.id} is not a category`).toBeUndefined();
                continue;
            }
            expect(output.categories?.length, `${id}.${output.id}`).toBeGreaterThan(1);
            const value = results.find((result) => result.id === output.id)!.value;
            expect(output.categories, `${id}.${output.id}`).toContain(value);
        }
    });
});
