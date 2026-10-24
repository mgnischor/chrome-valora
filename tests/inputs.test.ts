/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/inputs.test.ts
    Description: Unit tests for field validation and result evaluation.
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
import { MAX_MAGNITUDE, evaluate, readField, readInputs } from "../src/core/inputs";
import type { Calculator, FieldSpec } from "../src/core/types";

const money: FieldSpec = { id: "amount", kind: "currency", min: 0, example: 1 };
const positive: FieldSpec = { id: "positive", kind: "currency", min: 0, minExclusive: true, example: 1 };
const rate: FieldSpec = { id: "rate", kind: "percent", min: -0.5, max: 2, example: 0.1 };
const whole: FieldSpec = { id: "whole", kind: "integer", min: 1, max: 10, example: 1 };
const pick: FieldSpec = { id: "pick", kind: "choice", choices: [12, 1, 4], example: 12 };
const flows: FieldSpec = { id: "flows", kind: "series", minItems: 2, maxItems: 4, example: [1, 2] };
const free: FieldSpec = { id: "free", kind: "number", example: 0 };

describe("readField", () => {
    it("reads a number in the locale of the user", () => {
        expect(readField(money, "1.234,56", ",")).toEqual({ ok: true, value: 1234.56 });
        expect(readField(money, "1,234.56", ".")).toEqual({ ok: true, value: 1234.56 });
    });

    it("reports an empty field as required", () => {
        expect(readField(money, "", ".")).toEqual({ ok: false, error: { code: "REQUIRED" } });
        expect(readField(flows, "  \n ", ".")).toEqual({ ok: false, error: { code: "REQUIRED" } });
    });

    it("rejects text that is not a number", () => {
        expect(readField(money, "abc", ".")).toEqual({ ok: false, error: { code: "NOT_A_NUMBER" } });
    });

    it("converts a percentage to a fraction", () => {
        expect(readField(rate, "12.5", ".")).toEqual({ ok: true, value: 0.125 });
        expect(readField(rate, "-50", ".")).toEqual({ ok: true, value: -0.5 });
    });

    it("enforces inclusive limits, in stored units", () => {
        expect(readField(money, "0", ".").ok).toBe(true);
        expect(readField(money, "-1", ".")).toEqual({
            ok: false,
            error: { code: "BELOW_MIN", bound: 0, exclusive: false },
        });
        expect(readField(rate, "-51", ".")).toEqual({
            ok: false,
            error: { code: "BELOW_MIN", bound: -0.5, exclusive: false },
        });
        expect(readField(rate, "200", ".").ok).toBe(true);
        expect(readField(rate, "201", ".")).toEqual({ ok: false, error: { code: "ABOVE_MAX", bound: 2 } });
    });

    it("enforces an exclusive minimum", () => {
        expect(readField(positive, "0", ".")).toEqual({
            ok: false,
            error: { code: "BELOW_MIN", bound: 0, exclusive: true },
        });
        expect(readField(positive, "0.01", ".").ok).toBe(true);
    });

    it("caps every field at the maximum magnitude", () => {
        expect(readField(free, String(MAX_MAGNITUDE), ".").ok).toBe(true);
        expect(readField(free, String(MAX_MAGNITUDE * 10), ".")).toEqual({
            ok: false,
            error: { code: "ABOVE_MAX", bound: MAX_MAGNITUDE },
        });
        expect(readField(free, String(-MAX_MAGNITUDE * 10), ".").ok).toBe(false);
    });

    it("requires whole numbers for integer fields", () => {
        expect(readField(whole, "5", ".")).toEqual({ ok: true, value: 5 });
        expect(readField(whole, "5.5", ".")).toEqual({ ok: false, error: { code: "NOT_AN_INTEGER" } });
        expect(readField(whole, "11", ".").ok).toBe(false);
    });

    it("accepts only the listed values of a choice", () => {
        expect(readField(pick, "4", ".")).toEqual({ ok: true, value: 4 });
        expect(readField(pick, "5", ".")).toEqual({ ok: false, error: { code: "NOT_ALLOWED" } });
    });

    it("reads a list and checks its length", () => {
        expect(readField(flows, "1\n2\n3", ".")).toEqual({ ok: true, value: [1, 2, 3] });
        expect(readField(flows, "1", ".")).toEqual({ ok: false, error: { code: "TOO_FEW_ENTRIES", bound: 2 } });
        expect(readField(flows, "1\n2\n3\n4\n5", ".")).toEqual({
            ok: false,
            error: { code: "TOO_MANY_ENTRIES", bound: 4 },
        });
    });

    it("points at the first bad entry of a list", () => {
        expect(readField(flows, "1\nx\n3", ".")).toEqual({ ok: false, error: { code: "INVALID_ENTRY", bound: 2 } });
    });

    it("applies the limits of a list field to each entry", () => {
        const bounded: FieldSpec = { ...flows, min: 0 };
        expect(readField(bounded, "1\n-2", ".")).toEqual({
            ok: false,
            error: { code: "BELOW_MIN", bound: 0, exclusive: false },
        });
    });
});

describe("readInputs", () => {
    const calculator: Calculator = {
        id: "test",
        group: "returns",
        fields: [money, rate],
        outputs: [{ id: "double", kind: "currency" }],
        calculate: (values) => ({ double: (values.amount as number) * 2 }),
    };

    it("returns the values when every field is valid", () => {
        const reading = readInputs(calculator, { amount: "10", rate: "5" }, ".");
        expect(reading.values).toEqual({ amount: 10, rate: 0.05 });
        expect(reading.errors).toEqual({});
    });

    it("returns the errors by field, and no values, when any field is invalid", () => {
        const reading = readInputs(calculator, { amount: "x" }, ".");
        expect(reading.values).toBeNull();
        expect(reading.errors).toEqual({ amount: { code: "NOT_A_NUMBER" }, rate: { code: "REQUIRED" } });
    });
});

describe("evaluate", () => {
    it("pairs each output with its value in specification order", () => {
        const calculator: Calculator = {
            id: "test",
            group: "returns",
            fields: [],
            outputs: [
                { id: "b", kind: "percent" },
                { id: "a", kind: "currency" },
            ],
            calculate: () => ({ a: 1, b: 2 }),
        };
        expect(evaluate(calculator, {})).toEqual([
            { id: "b", kind: "percent", value: 2, ratingLevel: null, bands: null },
            { id: "a", kind: "currency", value: 1, ratingLevel: null, bands: null },
        ]);
    });

    it("turns anything that is not a finite number into null", () => {
        const calculator: Calculator = {
            id: "test",
            group: "returns",
            fields: [],
            outputs: [
                { id: "nan", kind: "ratio" },
                { id: "infinite", kind: "ratio" },
                { id: "missing", kind: "ratio" },
                { id: "nothing", kind: "ratio" },
            ],
            calculate: () => ({ nan: NaN, infinite: Infinity, nothing: null }),
        };
        expect(evaluate(calculator, {}).map((result) => result.value)).toEqual([null, null, null, null]);
    });
});
