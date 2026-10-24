/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/inputs.ts
    Description: Validation of the text typed into a calculator and evaluation of its results.
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
import { parseNumber, parseSeries, type DecimalSeparator } from "./parse";
import { rateResult } from "./rating";
import type { Calculator, FieldSpec, Result, Values } from "./types";

/**
 * Largest magnitude accepted in any field. It keeps intermediate results
 * inside the range where doubles are meaningful (about 15 significant digits).
 */
export const MAX_MAGNITUDE = 1e15;

/** Why a field was rejected. The popup turns the code into a localized message. */
export type FieldErrorCode =
    | "REQUIRED"
    | "NOT_A_NUMBER"
    | "NOT_AN_INTEGER"
    | "BELOW_MIN"
    | "ABOVE_MAX"
    | "NOT_ALLOWED"
    | "TOO_FEW_ENTRIES"
    | "TOO_MANY_ENTRIES"
    | "INVALID_ENTRY";

/** A rejected field. */
export interface FieldError {
    code: FieldErrorCode;
    /**
     * The limit that was violated (`BELOW_MIN`, `ABOVE_MAX`, `TOO_FEW_ENTRIES`, `TOO_MANY_ENTRIES`) or the 1-based
     * position of the offending entry (`INVALID_ENTRY`). Percentage limits are fractions, like the values.
     */
    bound?: number;
    /** For `BELOW_MIN`: whether the value must be strictly greater than `bound`. */
    exclusive?: boolean;
}

/** The outcome of reading one field. */
export type FieldReading = { ok: true; value: number | readonly number[] } | { ok: false; error: FieldError };

/** The outcome of reading every field of a calculator. */
export interface InputReading {
    /** The validated values, or `null` when at least one field has an error. */
    values: Values | null;
    /** The error of each rejected field, by field id. */
    errors: Readonly<Record<string, FieldError>>;
}

/**
 * Checks a number against the bounds of a field.
 *
 * @param field - Field specification.
 * @param value - Number in stored units.
 * @returns The violated bound, or `null` when the number is acceptable.
 */
function checkBounds(field: FieldSpec, value: number): FieldError | null {
    const min = field.min ?? -MAX_MAGNITUDE;
    const max = field.max ?? MAX_MAGNITUDE;
    if (value < min || (field.minExclusive === true && value === min)) {
        return { code: "BELOW_MIN", bound: min, exclusive: field.minExclusive === true };
    }
    if (value > max) return { code: "ABOVE_MAX", bound: max };
    return null;
}

/**
 * Reads one field from the text the user typed.
 *
 * @param field - Field specification.
 * @param text - Raw text of the input.
 * @param decimal - Decimal mark of the user's locale.
 * @returns The value in stored units (percentages as fractions) or the reason it was rejected.
 */
export function readField(field: FieldSpec, text: string, decimal: DecimalSeparator): FieldReading {
    if (text.trim() === "") return { ok: false, error: { code: "REQUIRED" } };

    if (field.kind === "series") {
        const { values, firstInvalid } = parseSeries(text, decimal);
        if (firstInvalid !== null) return { ok: false, error: { code: "INVALID_ENTRY", bound: firstInvalid } };
        const minItems = field.minItems ?? 1;
        const maxItems = field.maxItems ?? Infinity;
        if (values.length < minItems) return { ok: false, error: { code: "TOO_FEW_ENTRIES", bound: minItems } };
        if (values.length > maxItems) return { ok: false, error: { code: "TOO_MANY_ENTRIES", bound: maxItems } };
        const outOfRange = values.map((value) => checkBounds(field, value)).find((error) => error !== null);
        return outOfRange ? { ok: false, error: outOfRange } : { ok: true, value: values };
    }

    const parsed = parseNumber(text, decimal);
    if (parsed === null) return { ok: false, error: { code: "NOT_A_NUMBER" } };

    if (field.kind === "choice") {
        return field.choices?.includes(parsed)
            ? { ok: true, value: parsed }
            : { ok: false, error: { code: "NOT_ALLOWED" } };
    }
    if (field.kind === "integer" && !Number.isInteger(parsed)) return { ok: false, error: { code: "NOT_AN_INTEGER" } };

    // A percentage is typed as 12.5 and used as 0.125.
    const value = field.kind === "percent" ? parsed / 100 : parsed;
    const error = checkBounds(field, value);
    return error ? { ok: false, error } : { ok: true, value };
}

/**
 * Reads every field of a calculator.
 *
 * @param calculator - The calculator.
 * @param texts - Raw text of each input by field id; a missing field counts as empty.
 * @param decimal - Decimal mark of the user's locale.
 * @returns The validated values, or the errors by field id.
 */
export function readInputs(
    calculator: Calculator,
    texts: Readonly<Record<string, string>>,
    decimal: DecimalSeparator
): InputReading {
    const values: Record<string, number | readonly number[]> = {};
    const errors: Record<string, FieldError> = {};
    for (const field of calculator.fields) {
        const reading = readField(field, texts[field.id] ?? "", decimal);
        if (reading.ok) values[field.id] = reading.value;
        else errors[field.id] = reading.error;
    }
    return Object.keys(errors).length > 0 ? { values: null, errors } : { values, errors };
}

/**
 * Runs a calculator and pairs each output with its specification.
 *
 * A result that is not a finite number (an overflow, for instance) is reported
 * as `null`, so the UI never has to display `NaN` or `Infinity`.
 *
 * @param calculator - The calculator.
 * @param values - Validated inputs.
 * @returns One result per output, in the order of the calculator's specification.
 */
export function evaluate(calculator: Calculator, values: Values): Result[] {
    const outputs = calculator.calculate(values);
    return calculator.outputs.map((spec) => {
        const raw = outputs[spec.id];
        const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
        const rated = value !== null && spec.rating ? rateResult(spec.rating, value, values) : null;
        return { ...spec, value, ratingLevel: rated?.level ?? null, bands: rated?.bands ?? null };
    });
}
