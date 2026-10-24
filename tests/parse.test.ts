/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/parse.test.ts
    Description: Unit tests for the locale-aware number parser.
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
import { parseNumber, parseSeries } from "../src/core/parse";

describe("parseNumber", () => {
    it.each([
        ["0", 0],
        ["42", 42],
        ["3.14", 3.14],
        ["-7.5", -7.5],
        ["+7.5", 7.5],
        ["−7.5", -7.5],
        [".5", 0.5],
        ["5.", 5],
        ["  12  ", 12],
    ] as const)("reads %j as %d in a dot-decimal locale", (text, expected) => {
        expect(parseNumber(text, ".")).toBe(expected);
    });

    it.each([
        ["1,234.56", 1234.56],
        ["1,234,567.89", 1234567.89],
        ["1,234", 1234],
        ["12,345", 12345],
        ["1,5", 1.5],
        ["0,500", 0.5],
        ["1.234", 1.234],
        ["1,234,567", 1234567],
    ] as const)("resolves %j to %d in a dot-decimal locale", (text, expected) => {
        expect(parseNumber(text, ".")).toBe(expected);
    });

    it.each([
        ["1.234,56", 1234.56],
        ["1.234.567,89", 1234567.89],
        ["1.234", 1234],
        ["12.345", 12345],
        ["1,5", 1.5],
        ["0.500", 0.5],
        ["1.5", 1.5],
        ["1.234.567", 1234567],
        ["1234,5", 1234.5],
    ] as const)("resolves %j to %d in a comma-decimal locale", (text, expected) => {
        expect(parseNumber(text, ",")).toBe(expected);
    });

    it("ignores spaces, apostrophes, percent signs and currency symbols", () => {
        expect(parseNumber("R$ 1.500,25", ",")).toBe(1500.25);
        expect(parseNumber("$1,500.25", ".")).toBe(1500.25);
        expect(parseNumber("€ 2 000,50", ",")).toBe(2000.5);
        expect(parseNumber("1 234,5", ",")).toBe(1234.5);
        expect(parseNumber("1'234.5", ".")).toBe(1234.5);
        expect(parseNumber("12,5%", ",")).toBe(12.5);
    });

    it("ignores currency codes before or after the number", () => {
        expect(parseNumber("US$ 1.5", ".")).toBe(1.5);
        expect(parseNumber("BRL 100", ".")).toBe(100);
        expect(parseNumber("100 USD", ".")).toBe(100);
        expect(parseNumber("1.500,25 EUR", ",")).toBe(1500.25);
    });

    it("treats parentheses as a negative number", () => {
        expect(parseNumber("(300)", ".")).toBe(-300);
        expect(parseNumber("($1,250.50)", ".")).toBe(-1250.5);
    });

    it("never returns negative zero", () => {
        expect(Object.is(parseNumber("-0", "."), 0)).toBe(true);
        expect(Object.is(parseNumber("(0)", "."), 0)).toBe(true);
    });

    it.each([
        "",
        "   ",
        "abc",
        "1e5",
        "1.2.3",
        "1,2,3",
        "--5",
        "5-",
        "1,234,56",
        "1.234,567.8",
        "..",
        ",",
        "-",
        "()",
        "1 2a",
        "abc 5x",
        "abcd 5",
    ])("rejects %j", (text) => {
        expect(parseNumber(text, ".")).toBeNull();
    });

    it("rejects numbers too large to be finite and absurdly long text", () => {
        expect(parseNumber("9".repeat(400), ".")).toBeNull();
        expect(parseNumber("1".repeat(1001), ".")).toBeNull();
    });
});

describe("parseSeries", () => {
    it("splits on new lines", () => {
        expect(parseSeries("-1000\n300\r\n420.5\n", ".")).toEqual({ values: [-1000, 300, 420.5], firstInvalid: null });
    });

    it("splits on semicolons", () => {
        expect(parseSeries("100; 200 ;300", ".")).toEqual({ values: [100, 200, 300], firstInvalid: null });
    });

    it("splits a single line on whitespace", () => {
        expect(parseSeries("100 200   300", ".")).toEqual({ values: [100, 200, 300], firstInvalid: null });
    });

    it("never treats a comma as a separator, because it is a decimal mark in many locales", () => {
        expect(parseSeries("1,5\n2,5", ",")).toEqual({ values: [1.5, 2.5], firstInvalid: null });
        expect(parseSeries("1,5,2", ",").firstInvalid).toBe(1);
    });

    it("reports the 1-based position of the first invalid entry", () => {
        expect(parseSeries("10\n20\nabc\n40", ".").firstInvalid).toBe(3);
    });

    it("returns an empty list for blank text", () => {
        expect(parseSeries("  \n ;; ", ".").values).toEqual([]);
    });
});
