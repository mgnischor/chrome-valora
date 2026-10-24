/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/format.test.ts
    Description: Unit tests for result formatting, input text and the plain-text report.
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
import { parseNumber } from "../src/core/parse";
import {
    NO_CURRENCY,
    buildReport,
    currencySymbol,
    decimalSeparator,
    formatInputValue,
    formatValue,
    type FormatOptions,
} from "../src/shared/format";

const US: FormatOptions = { locale: "en-US", currency: "USD", decimals: 2 };
const BR: FormatOptions = { locale: "pt-BR", currency: "BRL", decimals: 2 };

/**
 * Replaces every kind of space (including the no-break spaces Intl inserts) by a plain space.
 *
 * @param text - Formatted text.
 * @returns The text with plain spaces.
 */
const plain = (text: string): string => text.replace(/\s/g, " ");

describe("decimalSeparator", () => {
    it("follows the locale", () => {
        expect(decimalSeparator("en-US")).toBe(".");
        expect(decimalSeparator("pt-BR")).toBe(",");
        expect(decimalSeparator("es")).toBe(",");
        expect(decimalSeparator("de-DE")).toBe(",");
    });
});

describe("formatValue", () => {
    it("formats money with the currency of the settings", () => {
        expect(formatValue(1234.5, "currency", US)).toBe("$1,234.50");
        expect(plain(formatValue(1234.5, "currency", BR))).toBe("R$ 1.234,50");
        expect(formatValue(-50, "currency", US)).toBe("-$50.00");
    });

    it("uses the natural number of decimals of the currency", () => {
        expect(formatValue(1234.5, "currency", { ...US, currency: "JPY" })).toBe("¥1,235");
    });

    it("shows plain numbers when no currency is selected", () => {
        expect(formatValue(1234.5, "currency", { ...US, currency: NO_CURRENCY })).toBe("1,234.50");
        expect(formatValue(1234.5, "currency", { ...BR, currency: NO_CURRENCY })).toBe("1.234,50");
    });

    it("formats fractions as percentages with the chosen decimals", () => {
        expect(formatValue(0.125, "percent", US)).toBe("12.50%");
        expect(formatValue(0.125, "percent", { ...US, decimals: 0 })).toBe("13%");
        expect(formatValue(0.12345, "percent", { ...US, decimals: 3 })).toBe("12.345%");
        expect(plain(formatValue(0.125, "percent", BR))).toBe("12,50%");
    });

    it("formats ratios, multiples, counts and durations", () => {
        expect(formatValue(1.4, "ratio", US)).toBe("1.40");
        expect(formatValue(1.355, "multiple", { ...US, decimals: 1 })).toBe("1.4×");
        expect(formatValue(3334, "number", US)).toBe("3,334");
        expect(formatValue(2.5, "number", US)).toBe("2.5");
        expect(formatValue(45.25, "days", US)).toBe("45.25 days");
        expect(plain(formatValue(45.25, "days", BR))).toBe("45,25 dias");
    });

    it("never shows a negative zero", () => {
        expect(formatValue(-0.0000001, "currency", US)).toBe("$0.00");
        expect(formatValue(-0.00001, "percent", US)).toBe("0.00%");
        expect(formatValue(-0.001, "ratio", US)).toBe("0.00");
        expect(formatValue(-0, "number", US)).toBe("0");
    });

    it("keeps real small losses visible", () => {
        expect(formatValue(-0.01, "currency", US)).toBe("-$0.01");
    });
});

describe("currencySymbol", () => {
    it("returns the symbol in the locale", () => {
        expect(currencySymbol("en-US", "USD")).toBe("$");
        expect(currencySymbol("pt-BR", "BRL")).toBe("R$");
        expect(currencySymbol("en-US", "EUR")).toBe("€");
    });

    it("is empty when no currency is selected", () => {
        expect(currencySymbol("en-US", NO_CURRENCY)).toBe("");
    });
});

describe("formatInputValue", () => {
    it("writes numbers without thousands separators and with the locale's decimal mark", () => {
        expect(formatInputValue(1234.5, "currency", "en-US")).toBe("1234.5");
        expect(formatInputValue(1234.5, "currency", "pt-BR")).toBe("1234,5");
    });

    it("shows percentages as percentage points without floating-point noise", () => {
        expect(formatInputValue(0.07, "percent", "en-US")).toBe("7");
        expect(formatInputValue(0.1 + 0.2, "percent", "en-US")).toBe("30");
        expect(formatInputValue(0.065, "percent", "pt-BR")).toBe("6,5");
    });

    it("writes a series one entry per line", () => {
        expect(formatInputValue([400, -1000.5], "series", "en-US")).toBe("400\n-1000.5");
    });

    it("round-trips through the parser in every supported locale", () => {
        for (const locale of ["en-US", "pt-BR", "es", "es-MX", "de-DE", "de-CH", "fr-FR", "it-IT", "ru-RU", "pl-PL"]) {
            for (const value of [0, 1, 0.5, 1234.5678, -42.1, 1_000_000, 0.000123]) {
                const text = formatInputValue(value, "number", locale);
                expect(parseNumber(text, decimalSeparator(locale)), `${locale}: ${text}`).toBeCloseTo(value, 9);
            }
        }
    });
});

describe("buildReport", () => {
    it("lists the title, the inputs and the results", () => {
        expect(
            buildReport(
                "ROI",
                [
                    ["Amount invested", "$1,000"],
                    ["Amount returned", "$1,250"],
                ],
                [["ROI", "25.00%"]]
            )
        ).toBe("ROI\n\nAmount invested: $1,000\nAmount returned: $1,250\n\nROI: 25.00%");
    });
});
