/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/brazil.test.ts
    Description: Unit tests for the Brazilian fixed-income rules and the Selic and dollar calculators.
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
import { accrualFactor, breakEvenPercentOfRate, calendarDays, incomeTaxRate, savingsFactor } from "../src/core/brazil";
import { getCalculator } from "../src/core/calculators";
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

describe("incomeTaxRate", () => {
    it.each([
        [1, 0.225],
        [180, 0.225],
        [181, 0.2],
        [360, 0.2],
        [361, 0.175],
        [720, 0.175],
        [721, 0.15],
        [3650, 0.15],
    ])("charges the regressive rate for %d days", (days, rate) => {
        expect(incomeTaxRate(days)).toBe(rate);
    });
});

describe("calendarDays", () => {
    it("uses an average month, so six months fall in the 181 to 360 day bracket", () => {
        expect(calendarDays(6)).toBe(183);
        expect(calendarDays(12)).toBe(365);
        expect(calendarDays(24)).toBe(730);
        expect(incomeTaxRate(calendarDays(6))).toBe(0.2);
        expect(incomeTaxRate(calendarDays(12))).toBe(0.175);
        expect(incomeTaxRate(calendarDays(24))).toBe(0.15);
    });
});

describe("accrualFactor", () => {
    it("grows by exactly the annual rate over twelve months at 100 %", () => {
        expect(accrualFactor(0.1375, 1, 12)).toBeCloseTo(1.1375, 12);
        expect(accrualFactor(0.1375, 1, 24)).toBeCloseTo(1.1375 ** 2, 12);
    });

    it("pays a share of the daily rate, which is not the same as a share of the annual rate", () => {
        const daily = 1.1375 ** (1 / 252) - 1;
        expect(accrualFactor(0.1375, 1.1, 12)).toBeCloseTo((1 + 1.1 * daily) ** 252, 10);
        expect(accrualFactor(0.1375, 1.1, 12)).not.toBeCloseTo(1 + 1.1 * 0.1375, 3);
    });

    it("does not grow at 0 % of the rate or at a zero rate", () => {
        expect(accrualFactor(0.1375, 0, 12)).toBe(1);
        expect(accrualFactor(0, 1, 12)).toBe(1);
    });
});

describe("savingsFactor", () => {
    it("pays 0.5 % a month while the Selic is above 8.5 %", () => {
        expect(savingsFactor(0.1375, 12)).toBeCloseTo(1.005 ** 12, 12);
        expect(savingsFactor(0.0851, 1)).toBeCloseTo(1.005, 12);
    });

    it("pays 70 % of the Selic when it is 8.5 % or lower", () => {
        expect(savingsFactor(0.08, 12)).toBeCloseTo(1 + 0.7 * 0.08, 12);
        expect(savingsFactor(0.085, 12)).toBeCloseTo(1 + 0.7 * 0.085, 12);
    });
});

describe("breakEvenPercentOfRate", () => {
    it("finds the share of the Selic at which a taxed product matches a target", () => {
        const months = 12;
        const target = savingsFactor(0.1375, months);
        const percent = breakEvenPercentOfRate(0.1375, months, target)!;
        const gross = accrualFactor(0.1375, percent, months) - 1;
        const net = 1 + gross * (1 - incomeTaxRate(calendarDays(months)));
        expect(net).toBeCloseTo(target, 10);
        expect(percent).toBeGreaterThan(0);
        expect(percent).toBeLessThan(1);
    });

    it("is undefined without a positive rate", () => {
        expect(breakEvenPercentOfRate(0, 12, 1.05)).toBeNull();
    });
});

describe("selicYield", () => {
    const base = { amount: 10_000, months: 12, selic: 0.1375, percentOfRate: 1, taxTreatment: 1 };

    it("applies the regressive income tax to the gross profit", () => {
        const results = run("selicYield", base);
        const gross = 10_000 * 0.1375;
        expect(results.incomeTax).toBeCloseTo(gross * 0.175, 8);
        expect(results.taxRate).toBe(0.175);
        expect(results.netProfit).toBeCloseTo(gross * (1 - 0.175), 8);
        expect(results.netFinal).toBeCloseTo(10_000 + gross * (1 - 0.175), 8);
        expect(results.netAnnualRate).toBeCloseTo(0.1375 * (1 - 0.175), 8);
    });

    it("charges no tax on exempt products", () => {
        const results = run("selicYield", { ...base, taxTreatment: 0 });
        expect(results.incomeTax).toBe(0);
        expect(results.netProfit).toBeCloseTo(1375, 8);
    });

    it("pays less tax the longer the money stays", () => {
        const rate = (months: number) => run("selicYield", { ...base, months }).taxRate;
        expect(rate(3)).toBe(0.225);
        expect(rate(6)).toBe(0.2);
        expect(rate(12)).toBe(0.175);
        expect(rate(36)).toBe(0.15);
    });

    it("pays nothing at 0 % of the Selic", () => {
        expect(run("selicYield", { ...base, percentOfRate: 0 }).netProfit).toBe(0);
    });
});

describe("savings", () => {
    const base = { amount: 10_000, months: 12, selic: 0.1375, percentOfRate: 1 };

    it("compares the tax-exempt savings account with the taxed fixed income", () => {
        const results = run("savings", base);
        expect(results.savingsFinal).toBeCloseTo(10_000 * 1.005 ** 12, 6);
        expect(results.fixedIncomeFinal).toBeCloseTo(10_000 + 1375 * (1 - 0.175), 6);
        expect(results.advantage).toBeCloseTo(results.fixedIncomeFinal! - results.savingsFinal!, 8);
        expect(results.advantage!).toBeGreaterThan(0);
    });

    it("reports a tie at the break-even share of the Selic", () => {
        const tie = run("savings", base).breakEvenPercent!;
        expect(run("savings", { ...base, percentOfRate: tie }).advantage).toBeCloseTo(0, 6);
    });

    it("shows savings winning when the product pays too little", () => {
        expect(run("savings", { ...base, percentOfRate: 0.5 }).advantage!).toBeLessThan(0);
    });
});

describe("dollarConversion", () => {
    it("divides the reais by the effective rate, with the spread and the IOF on top", () => {
        const results = run("dollarConversion", { amount: 5000, rate: 5, spread: 0.01, iof: 0.035 });
        expect(results.effectiveRate).toBeCloseTo(5 * 1.01 * 1.035, 12);
        expect(results.usdReceived).toBeCloseTo(5000 / (5 * 1.01 * 1.035), 8);
        expect(results.cost).toBeCloseTo(5000 - results.usdReceived! * 5, 8);
        expect(results.costPercent).toBeCloseTo(results.cost! / 5000, 12);
    });

    it("costs nothing without spread or IOF", () => {
        const results = run("dollarConversion", { amount: 5000, rate: 5, spread: 0, iof: 0 });
        expect(results.usdReceived).toBe(1000);
        expect(results.cost).toBeCloseTo(0, 10);
    });
});

describe("dollarVsSelic", () => {
    const base = { amount: 10_000, months: 12, spot: 5, expected: 5.5, selic: 0.1375, usdYield: 0.045 };

    it("finds the dollar at which holding dollars ties with the Selic", () => {
        const results = run("dollarVsSelic", base);
        expect(results.selicFinal).toBeCloseTo(11_375, 6);
        expect(results.breakEvenRate).toBeCloseTo(11_375 / (2000 * 1.045), 8);
        expect(results.requiredChange).toBeCloseTo(results.breakEvenRate! / 5 - 1, 12);
        const atBreakEven = run("dollarVsSelic", { ...base, expected: results.breakEvenRate! });
        expect(atBreakEven.difference).toBeCloseTo(0, 6);
    });

    it("computes the dollar investment in reais at the expected rate", () => {
        const results = run("dollarVsSelic", base);
        expect(results.dollarFinal).toBeCloseTo(2000 * 1.045 * 5.5, 8);
        expect(results.difference).toBeCloseTo(results.dollarFinal! - results.selicFinal!, 8);
    });

    it("needs a smaller rise of the dollar the more the dollar investment yields", () => {
        const change = (usdYield: number) => run("dollarVsSelic", { ...base, usdYield }).requiredChange!;
        expect(change(0.08)).toBeLessThan(change(0.02));
    });
});

describe("market fields", () => {
    it("marks the fields that can be filled in from the market", () => {
        const sources = (id: string) =>
            Object.fromEntries(
                getCalculator(id)
                    .fields.filter((field) => field.source)
                    .map((field) => [field.id, field.source])
            );
        expect(sources("selicYield")).toEqual({ selic: "selic" });
        expect(sources("savings")).toEqual({ selic: "selic" });
        expect(sources("dollarConversion")).toEqual({ rate: "usdBrl" });
        expect(sources("dollarVsSelic")).toEqual({ spot: "usdBrl", selic: "selic" });
        expect(sources("roi")).toEqual({});
    });

    it("keeps the money of the market calculators in reais and dollars, whatever the display currency", () => {
        for (const id of ["selicYield", "savings", "dollarConversion", "dollarVsSelic"]) {
            const calculator = getCalculator(id);
            for (const field of calculator.fields.filter((item) => item.kind === "currency")) {
                expect(field.currency, `${id}.${field.id}`).toBe("BRL");
            }
            for (const output of calculator.outputs.filter((item) => item.kind === "currency")) {
                expect(output.currency, `${id}.${output.id}`).toMatch(/^(BRL|USD)$/);
            }
        }
    });
});
