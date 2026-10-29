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

describe("numbers in other scripts and groupings", () => {
    /** Builds a digit string in a script from the Latin digits of a number. */
    const inScript = (zero: number, text: string) =>
        [...text].map((char) => (/\d/.test(char) ? String.fromCodePoint(zero + Number(char)) : char)).join("");

    it.each([
        ["Arabic-Indic", 0x0660],
        ["Persian", 0x06f0],
        ["Devanagari", 0x0966],
        ["Bengali", 0x09e6],
        ["Gurmukhi", 0x0a66],
        ["Gujarati", 0x0ae6],
        ["Tamil", 0x0be6],
        ["Telugu", 0x0c66],
        ["Kannada", 0x0ce6],
        ["Malayalam", 0x0d66],
        ["full-width", 0xff10],
    ])("reads %s digits", (_script, zero) => {
        expect(parseNumber(inScript(zero, "1234"), ".")).toBe(1234);
        expect(parseNumber(inScript(zero, "-12.5"), ".")).toBe(-12.5);
        expect(parseNumber(inScript(zero, "7,5"), ",")).toBe(7.5);
    });

    it("reads the Arabic decimal and thousands marks as the marks of the language", () => {
        const decimal = String.fromCodePoint(0x066b);
        const thousands = String.fromCodePoint(0x066c);
        expect(parseNumber(inScript(0x0660, `1${thousands}234${decimal}5`), ".")).toBe(1234.5);
        expect(parseNumber(inScript(0x0660, `1${thousands}234${decimal}5`), ",")).toBe(1234.5);
    });

    it("reads full-width punctuation and the Arabic percent sign", () => {
        const fullwidth = (text: string) =>
            [...text].map((c) => String.fromCodePoint(c.codePointAt(0)! + 0xfee0)).join("");
        expect(parseNumber(fullwidth("1,234.5"), ".")).toBe(1234.5);
        expect(parseNumber(fullwidth("-8"), ".")).toBe(-8);
        expect(parseNumber(`12${String.fromCodePoint(0x066a)}`, ".")).toBe(12);
    });

    it.each([
        ["12,34,567", 1234567],
        ["1,23,456", 123456],
        ["12,34,567.5", 1234567.5],
        ["1,00,00,000", 10000000],
    ])("reads the Indian grouping %s", (text, expected) => {
        expect(parseNumber(text, ".")).toBe(expected);
    });

    it("still rejects irregular grouping", () => {
        expect(parseNumber("1,2,34,567", ".")).toBeNull();
        expect(parseNumber("123,45,678", ".")).toBeNull();
    });

    it("leaves unknown scripts alone, so they are rejected", () => {
        expect(parseNumber(String.fromCodePoint(0x4e00), ".")).toBeNull();
    });

    it("ignores the invisible direction marks that right-to-left languages put around numbers", () => {
        const lrm = String.fromCodePoint(0x200e);
        const alm = String.fromCodePoint(0x061c);
        expect(parseNumber(`${lrm}-42.1`, ".")).toBe(-42.1);
        expect(parseNumber(`${alm}-42.1`, ".")).toBe(-42.1);
        expect(parseNumber(`${lrm}12${lrm}`, ".")).toBe(12);
    });
});
