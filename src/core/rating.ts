/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/rating.ts
    Description: Rates indicators as bad, neutral or good so the popup can colour them.
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
import type { Rating, RatingBands, RatingRule, ResolvedBands, Values } from "./types";

/** The outcome of rating one result. */
export interface Rated {
    level: Rating;
    /** The limits behind the rating, for a band rule. */
    bands: ResolvedBands | null;
}

/**
 * Tells whether a rule is a band rule (as opposed to one that rates categories).
 *
 * @param rule - The rule.
 * @returns `true` for a {@link RatingBands}.
 */
export function isBands(rule: RatingRule): rule is RatingBands {
    return "direction" in rule;
}

/**
 * Replaces the field references of a band rule by the values the user entered.
 *
 * @param rule - The band rule.
 * @param values - The validated inputs.
 * @returns The limits as numbers, or `null` when a referenced field is missing or is not a number.
 */
export function resolveBands(rule: RatingBands, values: Values): ResolvedBands | null {
    const limit = (reference: number | string): number | null => {
        if (typeof reference === "number") return reference;
        const value = values[reference];
        return typeof value === "number" ? value : null;
    };
    const bad = limit(rule.bad);
    const good = limit(rule.good);
    return bad === null || good === null ? null : { direction: rule.direction, bad, good };
}

/**
 * Rates a value against a band rule. The limits themselves are neutral.
 *
 * @param bands - The resolved limits.
 * @param value - The value to rate.
 * @returns `"bad"`, `"neutral"` or `"good"`.
 */
export function rateAgainst(bands: ResolvedBands, value: number): Rating {
    if (bands.direction === "higher") {
        if (value < bands.bad) return "bad";
        return value > bands.good ? "good" : "neutral";
    }
    if (value > bands.bad) return "bad";
    return value < bands.good ? "good" : "neutral";
}

/**
 * Rates one result.
 *
 * @param rule - The output's rule.
 * @param value - The computed value.
 * @param values - The validated inputs, for rules that compare with an input.
 * @returns The rating, or `null` when the rule cannot be applied (an unknown category or a missing input).
 */
export function rateResult(rule: RatingRule, value: number, values: Values): Rated | null {
    if (!isBands(rule)) {
        const level = rule.byCategory[value];
        return level === undefined ? null : { level, bands: null };
    }
    const bands = resolveBands(rule, values);
    return bands === null ? null : { level: rateAgainst(bands, value), bands };
}
