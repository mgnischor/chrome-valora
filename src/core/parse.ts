/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/parse.ts
    Description: Locale-aware parsing of the numbers and number lists typed into the calculators.
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
/**
 * Turns text typed by a person into numbers. People type `1,234.56`, `1.234,56`,
 * `1 234,56`, `12,34,567` (Indian grouping), `R$ 1.500`, `12,5%` and `(300)` for
 * -300, and in some scripts they type digits that are not Latin (`١٢٣`, `۱۲۳`,
 * `१२३`, `১২৩`, full-width `１２３`), so the parser accepts all of them. It never
 * evaluates anything: the text is validated character by character and converted
 * with `Number`.
 */

/** The character a locale uses between the integer and the fractional digits. */
export type DecimalSeparator = "." | ",";

/** Result of parsing a list of numbers. */
export interface SeriesParse {
    /** The numbers that were read, in order. Only meaningful when `firstInvalid` is `null`. */
    values: number[];
    /** 1-based position of the first entry that is not a number, or `null` when every entry is valid. */
    firstInvalid: number | null;
}

/** Characters ignored anywhere in the text: whitespace (`\s` covers no-break and thin spaces too), apostrophe grouping, `%`, currency signs. */
const IGNORED = /[\s'’%\p{Sc}]/gu;

/** A currency code or abbreviation written before the number (`R$`, `US$`, `BRL 100`) ... */
const CURRENCY_PREFIX = /^\p{L}{1,3}(?=[\s\p{Sc}\d])/u;

/** ... or after it (`100 USD`). */
const CURRENCY_SUFFIX = /(?<=[\d\s])\p{L}{3}$/u;

/** Longest accepted text, so a pasted document cannot stall the page. */
const MAX_TEXT_LENGTH = 1000;

/** Groups after the first must have exactly three digits, as in `1,234,567`. */
const THREE_DIGIT_GROUPS = /^\d{1,3}([^\d]\d{3})*$/;

/** Indian grouping: groups of two digits and a final group of three, as in `12,34,567`. */
const INDIAN_GROUPS = /^\d{1,2}([^\d]\d{2})*[^\d]\d{3}$/;

/**
 * Tells whether a run of digits and separators is grouped the way numbers are written in some country, with
 * thousands separators between groups of three digits (`1,234,567`) or in the Indian way (`12,34,567`).
 *
 * @param digits - Digits and separators, with no decimal part.
 * @returns `true` when the grouping is regular.
 */
function isGrouped(digits: string): boolean {
    return THREE_DIGIT_GROUPS.test(digits) || INDIAN_GROUPS.test(digits);
}

/** First code point of each block of decimal digits that is not Latin, used to read the digits people type in their own script. */
const DIGIT_ZEROS = [
    0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0e50, 0x0ed0,
    0x0f20, 0x1040, 0x17e0, 0x1810, 0xff10,
] as const;

/** The code points of punctuation that other scripts use for the marks and signs of a number. */
const ARABIC_DECIMAL = 0x066b;
const ARABIC_THOUSANDS = 0x066c;
const ARABIC_PERCENT = 0x066a;
const ARABIC_COMMA = 0x060c;
const FULLWIDTH_PLUS = 0xff0b;
const FULLWIDTH_COMMA = 0xff0c;
const FULLWIDTH_MINUS = 0xff0d;
const FULLWIDTH_PERIOD = 0xff0e;
const FULLWIDTH_PERCENT = 0xff05;
const SMALL_MINUS = 0xfe63;

/**
 * Tells whether a code point is an invisible bidirectional control: the left-to-right and right-to-left marks, the
 * Arabic letter mark, and the embedding, override and isolate controls.
 *
 * @param code - A code point.
 * @returns `true` for the controls that formatted numbers in Arabic, Persian and Urdu can carry.
 */
function isDirectionMark(code: number): boolean {
    return (
        code === 0x200e ||
        code === 0x200f ||
        code === 0x061c ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
    );
}

/**
 * Rewrites the digits and marks of other scripts as the Latin digits and the ASCII marks the parser works with:
 * Arabic-Indic, Persian, Devanagari, Bengali and other digits become `0`-`9`, the Arabic decimal and thousands marks
 * become the decimal and thousands marks of the language, and full-width signs and punctuation become ASCII.
 *
 * @param text - What the user typed.
 * @param decimal - The decimal mark of the user's language.
 * @returns The text with Latin digits and ASCII marks.
 */
function normalizeScript(text: string, decimal: DecimalSeparator): string {
    const thousands = decimal === "." ? "," : ".";
    let out = "";
    for (const char of text) {
        const code = char.codePointAt(0)!;
        if (code < 0x80) {
            out += char;
        } else if (isDirectionMark(code)) {
            // Right-to-left languages put invisible direction marks around numbers, for example before a minus sign.
            continue;
        } else if (code === ARABIC_DECIMAL) {
            out += decimal;
        } else if (code === ARABIC_THOUSANDS) {
            out += thousands;
        } else if (code === FULLWIDTH_PERIOD) {
            out += ".";
        } else if (code === FULLWIDTH_COMMA || code === ARABIC_COMMA) {
            out += ",";
        } else if (code === FULLWIDTH_MINUS || code === SMALL_MINUS) {
            out += "-";
        } else if (code === FULLWIDTH_PLUS) {
            out += "+";
        } else if (code === ARABIC_PERCENT || code === FULLWIDTH_PERCENT) {
            out += "%";
        } else {
            const zero = DIGIT_ZEROS.find((start) => code >= start && code <= start + 9);
            out += zero === undefined ? char : String(code - zero);
        }
    }
    return out;
}

/**
 * Decides what the single separator in a number means when it is the one the
 * locale does *not* use as its decimal mark.
 *
 * `1.234` typed by a Brazilian user is 1,234 (a thousands separator), but `1.5`
 * is clearly 1.5. The separator is treated as a thousands separator only when
 * exactly three digits follow it and the integer part looks like a group
 * (one to three digits, no leading zero).
 *
 * @param integerPart - Digits before the separator.
 * @param fractionPart - Digits after the separator.
 * @returns `true` when the separator groups thousands.
 */
function isThousandsSeparator(integerPart: string, fractionPart: string): boolean {
    return fractionPart.length === 3 && /^[1-9]\d{0,2}$/.test(integerPart);
}

/**
 * Parses one number.
 *
 * Spaces, `%`, currency signs and currency codes such as `R$` or `USD` are ignored. A leading `-`, `+` or `−` sets
 * the sign and parentheses mean a negative number (accounting style). When
 * both `.` and `,` appear, the one that comes last is the decimal mark. When
 * only one kind appears more than once it is a thousands separator, and when it
 * appears once it is the decimal mark unless it is the locale's thousands
 * separator followed by exactly three digits (see {@link isThousandsSeparator}).
 *
 * @param text - What the user typed.
 * @param decimal - The decimal mark of the user's locale, used to resolve `1,234` versus `1.234`.
 * @returns The number, or `null` when the text is empty or is not a valid number.
 */
export function parseNumber(text: string, decimal: DecimalSeparator): number | null {
    if (text.length > MAX_TEXT_LENGTH) return null;
    let body = normalizeScript(text, decimal)
        .trim()
        .replace(CURRENCY_PREFIX, "")
        .replace(CURRENCY_SUFFIX, "")
        .replace(IGNORED, "");
    let negative = false;

    const parenthesized = /^\((.*)\)$/.exec(body);
    if (parenthesized) {
        negative = true;
        body = parenthesized[1]!;
    }
    const sign = /^[-+−]/.exec(body);
    if (sign) {
        negative = negative !== (sign[0] !== "+");
        body = body.slice(1);
    }
    if (!/^[\d.,]+$/.test(body) || !/\d/.test(body)) return null;

    const thousands = decimal === "." ? "," : ".";
    const lastDot = body.lastIndexOf(".");
    const lastComma = body.lastIndexOf(",");
    let integer: string;
    let fraction = "";

    if (lastDot !== -1 && lastComma !== -1) {
        // Both kinds present: the last one is the decimal mark, the other one groups thousands.
        const mark = lastDot > lastComma ? "." : ",";
        const grouping = mark === "." ? "," : ".";
        const at = body.lastIndexOf(mark);
        integer = body.slice(0, at);
        fraction = body.slice(at + 1);
        if (integer.includes(mark) || fraction.includes(grouping)) return null;
        if (!isGrouped(integer)) return null;
        integer = integer.split(grouping).join("");
    } else if (lastDot !== -1 || lastComma !== -1) {
        const mark = lastDot !== -1 ? "." : ",";
        const parts = body.split(mark);
        if (parts.length > 2) {
            // Repeated: it can only be a thousands separator.
            if (!isGrouped(body)) return null;
            integer = parts.join("");
        } else {
            const [left, right] = parts as [string, string];
            if (mark === thousands && isThousandsSeparator(left, right)) {
                integer = left + right;
            } else {
                integer = left;
                fraction = right;
            }
        }
    } else {
        integer = body;
    }

    if (integer === "" && fraction === "") return null;
    const value = Number(`${integer || "0"}.${fraction || "0"}`);
    if (!Number.isFinite(value)) return null;
    return negative && value !== 0 ? -value : value;
}

/**
 * Parses a list of numbers separated by new lines or semicolons. A single line
 * with only whitespace between the numbers (`-1000 300 400`) is accepted too.
 * Commas are never separators, because they are decimal marks in many locales.
 *
 * @param text - What the user typed.
 * @param decimal - The decimal mark of the user's locale.
 * @returns The numbers and, when an entry is not a number, its 1-based position.
 */
export function parseSeries(text: string, decimal: DecimalSeparator): SeriesParse {
    let tokens = text
        .split(/[\r\n;]+/)
        .map((token) => token.trim())
        .filter((token) => token !== "");
    if (tokens.length === 1) tokens = tokens[0]!.split(/\s+/);

    const values: number[] = [];
    for (const [index, token] of tokens.entries()) {
        const value = parseNumber(token, decimal);
        if (value === null) return { values, firstInvalid: index + 1 };
        values.push(value);
    }
    return { values, firstInvalid: null };
}
