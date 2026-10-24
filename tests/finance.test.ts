/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/finance.test.ts
    Description: Unit tests for the financial mathematics.
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
    ceilStable,
    compoundGrowthRate,
    divide,
    futureValue,
    internalRateOfReturn,
    loanPayment,
    netPresentValue,
    paybackPeriods,
    presentValue,
} from "../src/core/finance";

describe("divide", () => {
    it("divides", () => {
        expect(divide(10, 4)).toBe(2.5);
        expect(divide(-3, 2)).toBe(-1.5);
    });

    it("returns null for a zero divisor or a result that is not finite", () => {
        expect(divide(1, 0)).toBeNull();
        expect(divide(0, 0)).toBeNull();
        expect(divide(1e308, 1e-10)).toBeNull();
    });
});

describe("presentValue and netPresentValue", () => {
    it("discounts each cash flow by its period", () => {
        expect(presentValue(0.1, [110, 121])).toBeCloseTo(200, 10);
    });

    it("is the plain sum at a zero rate", () => {
        expect(presentValue(0, [100, 200, 300])).toBe(600);
    });

    it("subtracts the initial investment", () => {
        // 400/1.1 + 400/1.21 + 400/1.331 + 300/1.4641 - 1000
        expect(netPresentValue(0.1, 1000, [400, 400, 400, 300])).toBeCloseTo(199.645, 3);
    });

    it("grows when the discount rate falls", () => {
        const flows = [300, 300, 300, 300];
        expect(netPresentValue(0.05, 1000, flows)).toBeGreaterThan(netPresentValue(0.15, 1000, flows));
    });
});

describe("internalRateOfReturn", () => {
    it("finds the rate that makes the NPV zero", () => {
        const flows = [300, 420, 680];
        const irr = internalRateOfReturn(1000, flows)!;
        expect(irr).toBeCloseTo(0.1634, 3);
        expect(Math.abs(netPresentValue(irr, 1000, flows))).toBeLessThan(1e-6);
    });

    it("is exact for a single payment", () => {
        expect(internalRateOfReturn(1000, [1100])).toBeCloseTo(0.1, 10);
        expect(internalRateOfReturn(1000, [0, 1210])).toBeCloseTo(0.1, 10);
    });

    it("can be negative", () => {
        const irr = internalRateOfReturn(1000, [500, 400])!;
        expect(irr).toBeLessThan(0);
        expect(Math.abs(netPresentValue(irr, 1000, [500, 400]))).toBeLessThan(1e-6);
    });

    it("can be very large", () => {
        expect(internalRateOfReturn(1, [100])).toBeCloseTo(99, 8);
    });

    it("is zero when the investment is exactly returned", () => {
        expect(internalRateOfReturn(1000, [400, 600])).toBeCloseTo(0, 8);
    });

    it("returns null when the cash flows never change sign", () => {
        expect(internalRateOfReturn(1000, [])).toBeNull();
        expect(internalRateOfReturn(1000, [-100, -200])).toBeNull();
        expect(internalRateOfReturn(0, [100, 200])).toBeNull();
        expect(internalRateOfReturn(1000, [0, 0])).toBeNull();
    });

    it("returns the root closest to zero when there are several", () => {
        // -1000, +3600, -4310, +1716 has roots at 10 %, 20 % and 30 %.
        const irr = internalRateOfReturn(1000, [3600, -4310, 1716])!;
        expect(irr).toBeCloseTo(0.1, 6);
    });

    it("handles the longest supported series", () => {
        const flows = Array.from({ length: 120 }, () => 10);
        const irr = internalRateOfReturn(100, flows)!;
        expect(Math.abs(netPresentValue(irr, 100, flows))).toBeLessThan(1e-6);
    });
});

describe("paybackPeriods", () => {
    it("interpolates inside the period that recovers the investment", () => {
        expect(paybackPeriods(1000, [400, 400, 400])).toBeCloseTo(2.5, 10);
        expect(paybackPeriods(1000, [1000])).toBe(1);
    });

    it("is zero when nothing was invested", () => {
        expect(paybackPeriods(0, [100])).toBe(0);
    });

    it("returns null when the investment is never recovered", () => {
        expect(paybackPeriods(1000, [100, 100])).toBeNull();
        expect(paybackPeriods(1000, [])).toBeNull();
    });

    it("takes longer once the cash flows are discounted", () => {
        const simple = paybackPeriods(1000, [400, 400, 400, 400])!;
        const discounted = paybackPeriods(1000, [400, 400, 400, 400], 0.1)!;
        expect(discounted).toBeGreaterThan(simple);
        expect(discounted).toBeCloseTo(3 + (1000 - (400 / 1.1 + 400 / 1.21 + 400 / 1.331)) / (400 / 1.4641), 6);
    });

    it("returns null when discounting makes recovery impossible", () => {
        expect(paybackPeriods(1000, [330, 330, 330], 0.1)).toBeNull();
    });

    it("finds the first moment the balance turns positive even if later flows are negative", () => {
        expect(paybackPeriods(100, [150, -200, 300])).toBeCloseTo(100 / 150, 10);
    });
});

describe("compoundGrowthRate", () => {
    it("computes the constant yearly rate", () => {
        expect(compoundGrowthRate(10_000, 20_000, 5)).toBeCloseTo(0.148698, 6);
        expect(compoundGrowthRate(100, 121, 2)).toBeCloseTo(0.1, 12);
    });

    it("can be negative, and is -100 % when the end value is zero", () => {
        expect(compoundGrowthRate(100, 50, 1)).toBeCloseTo(-0.5, 12);
        expect(compoundGrowthRate(100, 0, 3)).toBe(-1);
    });

    it("returns null for inputs outside its domain", () => {
        expect(compoundGrowthRate(0, 100, 1)).toBeNull();
        expect(compoundGrowthRate(-1, 100, 1)).toBeNull();
        expect(compoundGrowthRate(100, -1, 1)).toBeNull();
        expect(compoundGrowthRate(100, 200, 0)).toBeNull();
    });
});

describe("futureValue", () => {
    it("compounds a lump sum", () => {
        expect(futureValue(1000, 0.05 / 12, 120, 0)).toBeCloseTo(1647.0095, 3);
    });

    it("adds an ordinary annuity", () => {
        expect(futureValue(0, 0.05 / 12, 120, 100)).toBeCloseTo(15528.2278, 3);
        expect(futureValue(1000, 0.05 / 12, 120, 100)).toBeCloseTo(1647.0095 + 15528.2278, 3);
    });

    it("is a plain sum at a zero rate", () => {
        expect(futureValue(1000, 0, 10, 50)).toBe(1500);
    });

    it("returns null instead of Infinity on overflow", () => {
        expect(futureValue(1e15, 10, 5000, 0)).toBeNull();
    });
});

describe("loanPayment", () => {
    it("matches the standard mortgage example", () => {
        expect(loanPayment(200_000, 0.06 / 12, 360)).toBeCloseTo(1199.101, 3);
    });

    it("splits the principal evenly at a zero rate", () => {
        expect(loanPayment(1200, 0, 12)).toBe(100);
    });

    it("repays the loan: the payments are worth the principal at the loan rate", () => {
        const rate = 0.0725 / 12;
        const payment = loanPayment(350_000, rate, 240)!;
        expect(
            presentValue(
                rate,
                Array.from({ length: 240 }, () => payment)
            )
        ).toBeCloseTo(350_000, 4);
    });

    it("returns null without a positive number of periods", () => {
        expect(loanPayment(1000, 0.01, 0)).toBeNull();
    });
});

describe("ceilStable", () => {
    it("rounds up", () => {
        expect(ceilStable(2.1)).toBe(3);
        expect(ceilStable(0)).toBe(0);
    });

    it("ignores floating-point noise", () => {
        expect(ceilStable(100.00000000000001)).toBe(100);
        expect(ceilStable(0.1 * 3 * 10)).toBe(3);
        expect(ceilStable(2 / 3 + 1 / 3)).toBe(1);
    });
});
