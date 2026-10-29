/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/format.ts
    Description: Locale-aware formatting of calculator results and of the values shown in the input fields.
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
import type { DecimalSeparator } from "../core/parse";
import type { FieldKind, ValueKind } from "../core/types";

/** The value of the currency setting that shows plain numbers without a symbol. */
export const NO_CURRENCY = "none";

/** How results are displayed. */
export interface FormatOptions {
    /** BCP 47 tag such as `pt-BR`. */
    locale: string;
    /** ISO 4217 code such as `BRL`, or {@link NO_CURRENCY}. */
    currency: string;
    /** Decimal places of percentages, ratios and other non-monetary results. */
    decimals: number;
}

/** Digits kept when a stored value is turned back into text for an input field. */
const INPUT_DIGITS = 10;

/** The Arabic decimal separator (U+066B), which Arabic locales use when they write Arabic-Indic digits. */
const ARABIC_DECIMAL_SEPARATOR = String.fromCharCode(0x066b);

/**
 * The invisible marks (LRM, RLM, ALM) that Arabic, Persian and Urdu number formats add. They would force a right-to-left
 * base direction on text such as `11,134.38 R$` and mirror its Latin currency symbol, so results drop them and let the
 * browser pick the direction from the text itself.
 */
const DIRECTION_MARKS = new RegExp(`[${String.fromCharCode(0x200e, 0x200f, 0x061c)}]`, "g");

/**
 * Builds a number formatter that writes Latin digits whatever the language, so that numbers match the rest of the
 * interface and can be read back by the parser. Decimal and thousands marks still follow the language. When the
 * runtime does not know the language, English is used.
 *
 * @param tag - A BCP 47 language tag such as `pt-BR`.
 * @param options - Formatting options.
 * @returns A formatter.
 */
export function numberFormat(tag: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
    try {
        return new Intl.NumberFormat(tag, { numberingSystem: "latn", ...options });
    } catch {
        return new Intl.NumberFormat("en", { numberingSystem: "latn", ...options });
    }
}

/**
 * Finds the decimal mark of a locale.
 *
 * @param locale - BCP 47 tag.
 * @returns `","` for locales such as `pt-BR` or `es`, `"."` for `en-US`.
 */
export function decimalSeparator(locale: string): DecimalSeparator {
    const part = numberFormat(locale)
        .formatToParts(1.1)
        .find((item) => item.type === "decimal");
    return part?.value === "," || part?.value === ARABIC_DECIMAL_SEPARATOR ? "," : ".";
}

/**
 * Replaces a value that would be displayed as a negative zero (`-0.00`) by zero.
 *
 * @param value - The number to display.
 * @param fractionDigits - Number of decimal places that will be shown.
 * @returns `0` when the value rounds to zero at that precision, otherwise the value.
 */
function withoutNegativeZero(value: number, fractionDigits: number): number {
    return Math.abs(value) < 0.5 * 10 ** -fractionDigits ? 0 : value;
}

/**
 * Formats a number with a fixed or maximum count of decimal places.
 *
 * @param value - The number.
 * @param locale - BCP 47 tag.
 * @param style - Extra `Intl.NumberFormat` options.
 * @returns The formatted text.
 */
function formatNumber(value: number, locale: string, style: Intl.NumberFormatOptions): string {
    return numberFormat(locale, style).format(value).replace(DIRECTION_MARKS, "");
}

/**
 * Formats a calculator result.
 *
 * @param value - The value, in stored units (a percentage is a fraction).
 * @param kind - How the value is displayed.
 * @param options - Locale, currency and number of decimals.
 * @param fixedCurrency - ISO 4217 code that overrides the currency of the settings, for results that are always in one currency.
 * @returns Text such as `$1,234.56`, `12.50%`, `1.52`, `1.35×`, `45 days` or `R$ 5.0377`.
 */
export function formatValue(value: number, kind: ValueKind, options: FormatOptions, fixedCurrency?: string): string {
    const { locale, decimals } = options;
    const currency = fixedCurrency ?? options.currency;
    switch (kind) {
        case "exchangeRate": {
            const style: Intl.NumberFormatOptions = {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4,
                ...(currency === NO_CURRENCY ? {} : { style: "currency", currency }),
            };
            return formatNumber(withoutNegativeZero(value, 4), locale, style);
        }
        case "category":
            // Named by the popup, which has the translations; this is only a safe fallback.
            return String(value);
        case "currency": {
            const hasSymbol = currency !== NO_CURRENCY;
            const digits = hasSymbol ? currencyDigits(locale, currency) : 2;
            const style: Intl.NumberFormatOptions = {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
                ...(hasSymbol ? { style: "currency", currency } : {}),
            };
            return formatNumber(withoutNegativeZero(value, digits), locale, style);
        }
        case "percent":
            return formatNumber(withoutNegativeZero(value, decimals + 2), locale, {
                style: "percent",
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            });
        case "ratio":
            return formatNumber(withoutNegativeZero(value, decimals), locale, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            });
        case "multiple":
            return `${formatNumber(withoutNegativeZero(value, decimals), locale, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })}×`;
        case "number":
            return formatNumber(withoutNegativeZero(value, decimals), locale, { maximumFractionDigits: decimals });
        case "days":
            return formatNumber(withoutNegativeZero(value, decimals), locale, {
                style: "unit",
                unit: "day",
                unitDisplay: "long",
                maximumFractionDigits: decimals,
            });
    }
}

/**
 * Number of decimal places a currency normally uses (2 for dollars, 0 for yen).
 *
 * @param locale - BCP 47 tag.
 * @param currency - ISO 4217 code.
 * @returns The number of fraction digits.
 */
function currencyDigits(locale: string, currency: string): number {
    return numberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Finds the symbol a currency is written with in a locale.
 *
 * @param locale - BCP 47 tag.
 * @param currency - ISO 4217 code, or {@link NO_CURRENCY}.
 * @returns A symbol such as `$` or `R$`, or an empty string when no currency is selected.
 */
export function currencySymbol(locale: string, currency: string): string {
    if (currency === NO_CURRENCY) return "";
    const parts = numberFormat(locale, { style: "currency", currency }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
}

/**
 * Formats a stored value as the text of an input field: no thousands
 * separators, the locale's decimal mark, and percentages as percentage points.
 *
 * @param value - A number, or a list for a `series` field.
 * @param kind - The kind of the field.
 * @param locale - BCP 47 tag.
 * @returns Text the parser reads back to the same value; one entry per line for a series.
 */
export function formatInputValue(value: number | readonly number[], kind: FieldKind, locale: string): string {
    if (typeof value !== "number") return value.map((item) => formatInputValue(item, kind, locale)).join("\n");
    const shown = kind === "percent" ? Number((value * 100).toPrecision(12)) : value;
    return numberFormat(locale, { useGrouping: false, maximumFractionDigits: INPUT_DIGITS }).format(shown);
}

/** One line of a plain-text report: a label and its formatted value. */
export type ReportRow = readonly [label: string, value: string];

/**
 * Builds the plain text copied by the "Copy results" button.
 *
 * @param title - Name of the calculator.
 * @param inputs - The inputs the user entered.
 * @param results - The computed results.
 * @returns Text with a title, the inputs, a blank line and the results.
 */
export function buildReport(title: string, inputs: readonly ReportRow[], results: readonly ReportRow[]): string {
    const lines = (rows: readonly ReportRow[]) => rows.map(([label, value]) => `${label}: ${value}`);
    return [title, "", ...lines(inputs), "", ...lines(results)].join("\n");
}
