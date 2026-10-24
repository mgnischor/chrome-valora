/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/rating.test.ts
    Description: Unit tests for the indicator ratings (bad, neutral, good) and the rules of every rated output.
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
import { CALCULATORS, getCalculator } from "../src/core/calculators";
import { evaluate } from "../src/core/inputs";
import { isBands, rateAgainst, rateResult, resolveBands } from "../src/core/rating";
import type { Rating, RatingBands, ResolvedBands, Values } from "../src/core/types";

/**
 * Runs a calculator and returns each result's rating by output id.
 *
 * @param id - Calculator id.
 * @param values - Validated inputs.
 * @returns The rating of each output; `null` where it has no rule or no value.
 */
function ratings(id: string, values: Values): Record<string, Rating | null> {
    return Object.fromEntries(evaluate(getCalculator(id), values).map((result) => [result.id, result.ratingLevel]));
}

describe("rateAgainst", () => {
    const higher: ResolvedBands = { direction: "higher", bad: 1, good: 1.5 };
    const lower: ResolvedBands = { direction: "lower", bad: 2, good: 1 };

    it("rates more-is-better indicators, with the limits themselves neutral", () => {
        expect(rateAgainst(higher, 0.99)).toBe("bad");
        expect(rateAgainst(higher, 1)).toBe("neutral");
        expect(rateAgainst(higher, 1.25)).toBe("neutral");
        expect(rateAgainst(higher, 1.5)).toBe("neutral");
        expect(rateAgainst(higher, 1.51)).toBe("good");
    });

    it("rates less-is-better indicators, with the limits themselves neutral", () => {
        expect(rateAgainst(lower, 2.01)).toBe("bad");
        expect(rateAgainst(lower, 2)).toBe("neutral");
        expect(rateAgainst(lower, 1.5)).toBe("neutral");
        expect(rateAgainst(lower, 1)).toBe("neutral");
        expect(rateAgainst(lower, 0.99)).toBe("good");
    });

    it("turns two equal limits into a sign test", () => {
        const sign: ResolvedBands = { direction: "higher", bad: 0, good: 0 };
        expect(rateAgainst(sign, -0.01)).toBe("bad");
        expect(rateAgainst(sign, 0)).toBe("neutral");
        expect(rateAgainst(sign, 0.01)).toBe("good");
    });
});

describe("resolveBands and rateResult", () => {
    const againstInput: RatingBands = { direction: "higher", bad: "rate", good: "rate" };

    it("replaces a field reference by the value the user entered", () => {
        expect(resolveBands(againstInput, { rate: 0.1 })).toEqual({ direction: "higher", bad: 0.1, good: 0.1 });
    });

    it("cannot resolve a reference to a missing field or to a list", () => {
        expect(resolveBands(againstInput, {})).toBeNull();
        expect(resolveBands(againstInput, { rate: [1, 2] })).toBeNull();
        expect(rateResult(againstInput, 0.2, {})).toBeNull();
    });

    it("rates the numbered categories of a category rule", () => {
        const rule = { byCategory: { 0: "bad", 1: "neutral", 2: "good" } } as const;
        expect(isBands(rule)).toBe(false);
        expect(rateResult(rule, 2, {})).toEqual({ level: "good", bands: null });
        expect(rateResult(rule, 9, {})).toBeNull();
    });

    it("keeps the resolved limits for the legend", () => {
        expect(rateResult(againstInput, 0.2, { rate: 0.1 })).toEqual({
            level: "good",
            bands: { direction: "higher", bad: 0.1, good: 0.1 },
        });
    });
});

describe("indicators of the calculators", () => {
    it("rates the liquidity ratios against the usual thresholds", () => {
        const healthy = ratings("liquidity", {
            cash: 100,
            receivables: 100,
            inventory: 100,
            otherCurrentAssets: 0,
            currentLiabilities: 100,
        });
        expect(healthy.currentRatio).toBe("good"); // 3.0
        expect(healthy.quickRatio).toBe("good"); // 2.0
        expect(healthy.cashRatio).toBe("good"); // 1.0
        expect(healthy.workingCapital).toBe("good");

        const strained = ratings("liquidity", {
            cash: 10,
            receivables: 30,
            inventory: 40,
            otherCurrentAssets: 0,
            currentLiabilities: 100,
        });
        expect(strained.currentRatio).toBe("bad"); // 0.8
        expect(strained.quickRatio).toBe("bad"); // 0.4
        expect(strained.cashRatio).toBe("bad"); // 0.1
        expect(strained.workingCapital).toBe("bad");

        const tight = ratings("liquidity", {
            cash: 20,
            receivables: 70,
            inventory: 30,
            otherCurrentAssets: 0,
            currentLiabilities: 100,
        });
        expect(tight.currentRatio).toBe("neutral"); // 1.2
        expect(tight.quickRatio).toBe("neutral"); // 0.9
        expect(tight.cashRatio).toBe("neutral"); // 0.2
    });

    it("rates debt, where less is better, and interest coverage, where more is better", () => {
        const inputs = { totalDebt: 400, equity: 600, ebit: 150, interestExpense: 40 };
        expect(ratings("leverage", inputs)).toMatchObject({ debtToEquity: "good", interestCoverage: "good" });
        expect(ratings("leverage", { ...inputs, totalDebt: 1500 })).toMatchObject({ debtToEquity: "bad" });
        expect(ratings("leverage", { ...inputs, totalDebt: 900 })).toMatchObject({ debtToEquity: "neutral" });
        expect(ratings("leverage", { ...inputs, ebit: 30 })).toMatchObject({ interestCoverage: "bad" });
    });

    it("rates a shorter cash conversion cycle as better", () => {
        const base = { revenue: 1000, cogs: 800, inventory: 0, receivables: 0, periodDays: 365 };
        expect(ratings("cashCycle", { ...base, payables: 400 }).cashConversionCycle).toBe("good"); // negative
        expect(ratings("cashCycle", { ...base, inventory: 100, payables: 0 }).cashConversionCycle).toBe("neutral"); // 45.6 days
        expect(ratings("cashCycle", { ...base, inventory: 300, payables: 0 }).cashConversionCycle).toBe("bad"); // 137 days
    });

    it("compares the IRR with the discount rate the user entered", () => {
        const base = { initialInvestment: 1000, cashFlows: [400, 400, 400, 300] };
        expect(ratings("investment", { ...base, rate: 0.1 }).irr).toBe("good");
        expect(ratings("investment", { ...base, rate: 0.3 }).irr).toBe("bad");
    });

    it("rates the NPV and the profitability index together", () => {
        const base = { initialInvestment: 1000, cashFlows: [400, 400, 400, 300] };
        expect(ratings("investment", { ...base, rate: 0.1 })).toMatchObject({
            npv: "good",
            profitabilityIndex: "good",
        });
        expect(ratings("investment", { ...base, rate: 0.3 })).toMatchObject({ npv: "bad", profitabilityIndex: "bad" });
    });

    it("leaves unrated outputs and undefined values without a rating", () => {
        expect(ratings("pricing", { cost: 60, targetMargin: 0.3 })).toEqual({
            price: null,
            markup: null,
            profit: null,
        });
        // A break-even calculation that cannot be solved has no units and therefore nothing to rate.
        const impossible = ratings("breakeven", { fixedCosts: 1, price: 5, variableCost: 9, targetProfit: 0 });
        expect(impossible.units).toBeNull();
        expect(impossible.contributionMargin).toBe("bad");
    });

    it("rates ROE and ROA against rules of thumb", () => {
        expect(ratings("roe", { netIncome: 150, equity: 1000, assets: 1000 })).toMatchObject({
            roe: "good",
            roa: "good",
        });
        expect(ratings("roe", { netIncome: 50, equity: 1000, assets: 1000 })).toMatchObject({
            roe: "neutral",
            roa: "neutral",
        });
        expect(ratings("roe", { netIncome: -50, equity: 1000, assets: 1000 })).toMatchObject({
            roe: "bad",
            roa: "bad",
        });
    });

    it("rates the Fleuriet types and the Altman zones through their categories", () => {
        const fleuriet = (cdg: number, ncg: number) =>
            ratings("fleuriet", {
                operatingCurrentAssets: Math.max(ncg, 0),
                operatingCurrentLiabilities: Math.max(-ncg, 0),
                nonCurrentAssets: 0,
                permanentFunds: cdg,
            });
        expect(fleuriet(300, 200).structureType).toBe("good"); // type II
        expect(fleuriet(100, 300).structureType).toBe("neutral"); // type III
        expect(fleuriet(-100, 50).structureType).toBe("bad"); // type IV
        expect(fleuriet(100, 300).treasury).toBe("bad");
    });

    it("colours the Altman scores the same way as their zones", () => {
        for (const worth of [-300, 100, 400]) {
            const results = ratings("altman", {
                workingCapital: worth,
                retainedEarnings: worth,
                ebit: worth / 2,
                equityValue: 500,
                sales: 1000,
                totalAssets: 1000,
                totalLiabilities: 500,
            });
            expect(results.zScore, `Z at ${worth}`).toBe(results.zZone);
            expect(results.emergingScore, `Z″ at ${worth}`).toBe(results.emergingZone);
        }
    });
});

describe("every rating rule in the catalogue", () => {
    const rated = CALCULATORS.flatMap((calculator) =>
        getCalculator(calculator.id)
            .outputs.filter((output) => output.rating !== undefined)
            .map((output) => ({ calculator: calculator.id, output }))
    );

    it("exists, and covers indicators from every group except the purely informational ones", () => {
        expect(rated.length).toBeGreaterThanOrEqual(30);
        const groups = new Set(rated.map((entry) => getCalculator(entry.calculator).group));
        expect([...groups].sort()).toEqual([
            "accounting",
            "investment",
            "liquidity",
            "markets",
            "profitability",
            "returns",
        ]);
    });

    it.each(rated.map((entry) => [`${entry.calculator}.${entry.output.id}`, entry] as const))(
        "%s has limits in the right order, and category rules cover every category",
        (_name, { calculator, output }) => {
            const rule = output.rating!;
            if (isBands(rule)) {
                expect(output.kind, "bands need a number").not.toBe("category");
                if (typeof rule.bad === "number" && typeof rule.good === "number") {
                    if (rule.direction === "higher") expect(rule.bad).toBeLessThanOrEqual(rule.good);
                    else expect(rule.bad).toBeGreaterThanOrEqual(rule.good);
                }
                for (const limit of [rule.bad, rule.good]) {
                    if (typeof limit === "string") {
                        const field = getCalculator(calculator).fields.find((candidate) => candidate.id === limit);
                        expect(field, `${limit} is not a field of ${calculator}`).toBeDefined();
                        expect(field!.kind).not.toBe("series");
                    }
                }
            } else {
                expect(output.kind).toBe("category");
                expect(Object.keys(rule.byCategory).map(Number).sort()).toEqual([...(output.categories ?? [])].sort());
            }
        }
    );

    it.each(rated.map((entry) => [`${entry.calculator}.${entry.output.id}`, entry] as const))(
        "%s is rated with the calculator's own example",
        (_name, { calculator, output }) => {
            const spec = getCalculator(calculator);
            const values = Object.fromEntries(spec.fields.map((field) => [field.id, field.example]));
            const result = evaluate(spec, values).find((candidate) => candidate.id === output.id)!;
            expect(result.value).not.toBeNull();
            expect(result.ratingLevel).not.toBeNull();
        }
    );
});
