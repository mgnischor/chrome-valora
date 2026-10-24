/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/settings.ts
    Description: Persisted user settings with validation and storage helpers.
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
import { DEFAULT_CALCULATOR, isCalculatorId, type CalculatorId } from "../core/calculators";
import { NO_CURRENCY } from "./format";

/** Currencies offered in the settings, besides "no currency". */
export const CURRENCIES = [
    "USD",
    "EUR",
    "GBP",
    "BRL",
    "JPY",
    "CAD",
    "AUD",
    "CHF",
    "MXN",
    "ARS",
    "CLP",
    "COP",
    "INR",
    "CNY",
] as const;

/** Allowed numbers of decimal places for percentages, ratios and other non-monetary results. */
export const DECIMAL_CHOICES = [0, 1, 2, 3, 4] as const;

/** Currency suggested for a region, used to pick the initial setting. Anything else falls back to USD. */
const REGION_CURRENCY: Readonly<Record<string, (typeof CURRENCIES)[number]>> = {
    US: "USD",
    GB: "GBP",
    BR: "BRL",
    PT: "EUR",
    ES: "EUR",
    DE: "EUR",
    FR: "EUR",
    IT: "EUR",
    NL: "EUR",
    IE: "EUR",
    MX: "MXN",
    AR: "ARS",
    CL: "CLP",
    CO: "COP",
    JP: "JPY",
    CA: "CAD",
    AU: "AUD",
    CH: "CHF",
    IN: "INR",
    CN: "CNY",
};

/** Currency suggested for a bare language such as `pt`, when the region is not known. */
const LANGUAGE_CURRENCY: Readonly<Record<string, (typeof CURRENCIES)[number]>> = {
    pt: "BRL",
    es: "EUR",
    de: "EUR",
    fr: "EUR",
    it: "EUR",
    ja: "JPY",
    zh: "CNY",
};

/** Everything persisted between sessions. Calculator inputs are kept separately and only in memory. */
export interface Settings {
    /** ISO 4217 code from {@link CURRENCIES}, or `"none"` to show plain numbers. */
    currency: string;
    /** Decimal places of percentages, ratios and other non-monetary results. */
    decimals: number;
    /** Keep what was typed in each calculator (in memory only) so it is there when the popup reopens. */
    rememberInputs: boolean;
    /** The calculator that was open last. */
    lastCalculator: CalculatorId;
    /** Download the Selic rate and the dollar quote from the Central Bank of Brazil. Off until the user turns it on. */
    liveRates: boolean;
}

const STORAGE_KEY = "settings";

/**
 * Suggests a currency for a browser language.
 *
 * @param language - BCP 47 tag of the browser's UI language, such as `pt-BR`.
 * @returns The currency of the region, or of the language when the tag has no region, or `USD`.
 */
export function suggestCurrency(language: string): string {
    const [base = "", ...rest] = language.split(/[-_]/);
    const region = rest.find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
    return (region && REGION_CURRENCY[region]) || LANGUAGE_CURRENCY[base.toLowerCase()] || "USD";
}

/**
 * Builds the default settings for a browser language.
 *
 * @param language - BCP 47 tag of the browser's UI language.
 * @returns The defaults, with the currency suggested for the language.
 */
export function defaultSettings(language: string): Settings {
    return {
        currency: suggestCurrency(language),
        decimals: 2,
        rememberInputs: true,
        lastCalculator: DEFAULT_CALCULATOR,
        liveRates: false,
    };
}

/**
 * Turns untrusted stored data into valid settings. Unknown or malformed fields
 * fall back to their defaults so a corrupted store can never break the UI.
 *
 * @param raw - Value read from storage or assembled from form controls.
 * @param language - BCP 47 tag of the browser's UI language, used for the defaults.
 * @returns Valid settings: a known currency, an allowed number of decimals and an existing calculator.
 */
export function sanitizeSettings(raw: unknown, language: string): Settings {
    const isRecord = typeof raw === "object" && raw !== null && !Array.isArray(raw);
    const input = (isRecord ? raw : {}) as Record<string, unknown>;
    const defaults = defaultSettings(language);

    const currency = [NO_CURRENCY, ...CURRENCIES].find((choice) => choice === input.currency) ?? defaults.currency;
    const decimals = DECIMAL_CHOICES.find((choice) => choice === input.decimals) ?? defaults.decimals;
    return {
        currency,
        decimals,
        rememberInputs: typeof input.rememberInputs === "boolean" ? input.rememberInputs : defaults.rememberInputs,
        lastCalculator: isCalculatorId(input.lastCalculator) ? input.lastCalculator : defaults.lastCalculator,
        liveRates: typeof input.liveRates === "boolean" ? input.liveRates : defaults.liveRates,
    };
}

/**
 * Reads the settings from `chrome.storage.sync`.
 *
 * @param language - BCP 47 tag of the browser's UI language, used for the defaults.
 * @returns The stored settings, or the defaults when none exist or storage is unavailable.
 */
export async function loadSettings(language: string): Promise<Settings> {
    try {
        const stored = await chrome.storage.sync.get(STORAGE_KEY);
        return sanitizeSettings(stored[STORAGE_KEY], language);
    } catch {
        return defaultSettings(language);
    }
}

/**
 * Writes the settings to `chrome.storage.sync`.
 *
 * @param settings - Settings to persist.
 */
export async function saveSettings(settings: Settings): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}
