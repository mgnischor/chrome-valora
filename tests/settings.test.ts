/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/settings.test.ts
    Description: Unit tests for settings validation, defaults and storage.
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
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CALCULATOR } from "../src/core/calculators";
import {
    CURRENCIES,
    defaultSettings,
    loadSettings,
    sanitizeSettings,
    saveSettings,
    suggestCurrency,
} from "../src/shared/settings";

describe("suggestCurrency", () => {
    it.each([
        ["en-US", "USD"],
        ["en-GB", "GBP"],
        ["pt-BR", "BRL"],
        ["pt_BR", "BRL"],
        ["pt-PT", "EUR"],
        ["es-MX", "MXN"],
        ["es-419", "EUR"],
        ["es", "EUR"],
        ["pt", "BRL"],
        ["ja", "JPY"],
        ["en", "USD"],
        ["xx-ZZ", "USD"],
        ["", "USD"],
    ])("suggests the currency for %s", (language, currency) => {
        expect(suggestCurrency(language)).toBe(currency);
    });

    it("only suggests currencies that the settings offer", () => {
        for (const language of ["en-US", "pt-BR", "es-AR", "de-DE", "fr-FR", "ja-JP", "zh-CN", "en-IN"]) {
            expect(CURRENCIES).toContain(suggestCurrency(language));
        }
    });
});

describe("sanitizeSettings", () => {
    it("uses the defaults for missing, null or non-object input", () => {
        const defaults = defaultSettings("en-US");
        expect(sanitizeSettings(undefined, "en-US")).toEqual(defaults);
        expect(sanitizeSettings(null, "en-US")).toEqual(defaults);
        expect(sanitizeSettings("nope", "en-US")).toEqual(defaults);
        expect(sanitizeSettings([1, 2], "en-US")).toEqual(defaults);
    });

    it("has sensible defaults", () => {
        expect(defaultSettings("pt-BR")).toEqual({
            currency: "BRL",
            decimals: 2,
            rememberInputs: true,
            lastCalculator: DEFAULT_CALCULATOR,
            liveRates: false,
        });
    });

    it("keeps valid values", () => {
        const stored = {
            currency: "EUR",
            decimals: 4,
            rememberInputs: false,
            lastCalculator: "loan",
            liveRates: true,
        };
        expect(sanitizeSettings(stored, "en-US")).toEqual(stored);
        expect(sanitizeSettings({ ...stored, currency: "none" }, "en-US").currency).toBe("none");
    });

    it("replaces unknown currencies, decimals and calculators with the defaults", () => {
        const result = sanitizeSettings(
            { currency: "XXX", decimals: 9, rememberInputs: "yes", lastCalculator: "removed-calculator", liveRates: 1 },
            "pt-BR"
        );
        expect(result).toEqual(defaultSettings("pt-BR"));
    });

    it("ignores unknown fields", () => {
        expect(sanitizeSettings({ extra: true }, "en-US")).toEqual(defaultSettings("en-US"));
    });
});

describe("storage", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("loads and sanitizes the stored settings", async () => {
        const get = vi.fn().mockResolvedValue({ settings: { currency: "CAD", decimals: 1 } });
        vi.stubGlobal("chrome", { storage: { sync: { get } } });
        expect(await loadSettings("en-US")).toEqual({ ...defaultSettings("en-US"), currency: "CAD", decimals: 1 });
        expect(get).toHaveBeenCalledWith("settings");
    });

    it("falls back to the defaults when storage fails", async () => {
        vi.stubGlobal("chrome", { storage: { sync: { get: vi.fn().mockRejectedValue(new Error("unavailable")) } } });
        expect(await loadSettings("pt-BR")).toEqual(defaultSettings("pt-BR"));
    });

    it("saves under a single key", async () => {
        const set = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("chrome", { storage: { sync: { set } } });
        const settings = defaultSettings("en-US");
        await saveSettings(settings);
        expect(set).toHaveBeenCalledWith({ settings });
    });
});
