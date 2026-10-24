/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/types.ts
    Description: Type definitions describing a calculator: its input fields, its outputs and its formula.
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

/** Calculators are listed under these headings. */
export type GroupId = "returns" | "profitability" | "liquidity" | "accounting" | "investment" | "markets";

/**
 * How an input field is read and displayed.
 *
 * - `currency`: an amount of money.
 * - `percent`: typed as a percentage (`12.5`) and stored as a fraction (`0.125`).
 * - `number`: any real number.
 * - `integer`: a whole number.
 * - `choice`: one of a fixed list of numbers.
 * - `series`: a list of numbers, one per line.
 */
export type FieldKind = "currency" | "percent" | "number" | "integer" | "choice" | "series";

/**
 * How an output is displayed.
 *
 * - `currency`: an amount of money.
 * - `percent`: a fraction shown as a percentage.
 * - `ratio`: a plain ratio such as a current ratio of 1.52.
 * - `multiple`: a ratio shown with a multiplication sign, such as 1.35×.
 * - `number`: a count or a number of periods.
 * - `days`: a duration in days.
 * - `exchangeRate`: an exchange rate such as R$ 5.0377, shown with four decimals.
 * - `category`: one of a few named outcomes, such as a Fleuriet structure type. The value is the number of the
 *   category and the popup shows its localized name (`OutputSpec.categories` lists the numbers).
 */
export type ValueKind = "currency" | "percent" | "ratio" | "multiple" | "number" | "days" | "exchangeRate" | "category";

/** Market figures that a field can be filled in with when live rates are enabled. */
export type MarketSource = "selic" | "usdBrl";

/** Validated input values by field id. Percentages are fractions; a `series` field is an array. */
export type Values = Readonly<Record<string, number | readonly number[]>>;

/** Describes one input of a calculator. Bounds are inclusive and given in stored units (fractions for percentages). */
export interface FieldSpec {
    id: string;
    kind: FieldKind;
    /** Smallest accepted value. */
    min?: number;
    /** Largest accepted value. */
    max?: number;
    /** When `true`, `min` itself is not accepted (the value must be strictly greater). */
    minExclusive?: boolean;
    /** The accepted values of a `choice` field; the first one is the default. */
    choices?: readonly number[];
    /** Fewest entries accepted in a `series` field. */
    minItems?: number;
    /** Most entries accepted in a `series` field. */
    maxItems?: number;
    /** Value the field starts with. Fields without one start empty. */
    default?: number | readonly number[];
    /** A sample value, shown as the placeholder and used by the "Example" button. */
    example: number | readonly number[];
    /** ISO 4217 code of a `currency` field that is always in one currency, such as `BRL`. Otherwise it follows the settings. */
    currency?: string;
    /** The market figure this field can be filled in with. */
    source?: MarketSource;
}

/** How an indicator reads: bad is shown in red, neutral in the normal text colour and good in green. */
export type Rating = "bad" | "neutral" | "good";

/**
 * Rates a number against two limits. With `direction: "higher"`, a value below `bad` is bad, a value above `good` is
 * good and anything in between (including the limits) is neutral. With `"lower"` it is the other way round: above
 * `bad` is bad and below `good` is good. Two equal limits make a sign test, such as "below zero is bad".
 *
 * A limit is a number in stored units (a fraction for a percentage), or the id of an input field whose value is the
 * limit, for example an IRR compared with the discount rate.
 */
export interface RatingBands {
    direction: "higher" | "lower";
    bad: number | string;
    good: number | string;
}

/** Rates the numbered categories of a `category` output. */
export interface CategoryRatings {
    byCategory: Readonly<Record<number, Rating>>;
}

/** The rule that colours an indicator. */
export type RatingRule = RatingBands | CategoryRatings;

/** The limits of a {@link RatingBands} once any field reference has been replaced by its value. */
export interface ResolvedBands {
    direction: "higher" | "lower";
    bad: number;
    good: number;
}

/** Describes one result of a calculator. The first output of a calculator is its headline result. */
export interface OutputSpec {
    id: string;
    kind: ValueKind;
    /** ISO 4217 code of a `currency` or `exchangeRate` output that is always in one currency. Otherwise it follows the settings. */
    currency?: string;
    /** For a `category` output: every number the calculator can report. Each one needs a message in the locale files. */
    categories?: readonly number[];
    /** How to colour the result. Outputs without a rule are shown in the normal colour. */
    rating?: RatingRule;
}

/** Computed results by output id. `null` marks a result that is not defined for the given inputs. */
export type Outputs = Readonly<Record<string, number | null>>;

/** A calculator: pure data plus one pure function. All user-facing text lives in the locale files. */
export interface Calculator {
    id: string;
    group: GroupId;
    fields: readonly FieldSpec[];
    outputs: readonly OutputSpec[];
    /**
     * Computes every output from validated inputs.
     *
     * @param values - Inputs that already satisfy the field specifications.
     * @returns A value, or `null` where the result is undefined, for each output id.
     */
    calculate(values: Values): Outputs;
}

/** One computed result, ready for display. */
export interface Result extends OutputSpec {
    /** The value, or `null` when it is undefined for the inputs. */
    value: number | null;
    /** How the value reads, or `null` when the output has no rule or the value is undefined. */
    ratingLevel: Rating | null;
    /** The limits behind a band rule, with field references resolved; `null` for other rules. */
    bands: ResolvedBands | null;
}
