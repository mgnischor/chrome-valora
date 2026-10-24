/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/i18n.test.ts
    Description: Unit tests for the locale files and the translation helpers.
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
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CALCULATORS, GROUPS, getCalculator } from "../src/core/calculators";
import { t } from "../src/shared/i18n";
import {
    calculatorDescriptionKey,
    calculatorFormulaKey,
    calculatorNameKey,
    categoryKey,
    choiceKey,
    fieldKey,
    groupKey,
    outputKey,
} from "../src/shared/labels";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES_DIR = path.join(ROOT, "public", "_locales");
const DEFAULT_LOCALE = "en_US";
const EXPECTED_LOCALES = ["de", "en_US", "es", "fr", "it", "pl", "pt_BR", "ru"];

/** Shape of one entry of a `messages.json` file. */
interface Message {
    message: string;
    placeholders?: Record<string, { content: string }>;
}

/**
 * Reads the messages of one locale.
 *
 * @param locale - Locale folder name such as `pt_BR`.
 * @returns The parsed `messages.json`.
 */
function loadLocale(locale: string): Record<string, Message> {
    return JSON.parse(readFileSync(path.join(LOCALES_DIR, locale, "messages.json"), "utf8"));
}

/**
 * Lists the `$NAME$` placeholders referenced by a message, lowercased and sorted.
 *
 * @param text - Message text.
 * @returns The referenced placeholder names.
 */
function referencedPlaceholders(text: string): string[] {
    return [...text.matchAll(/\$([A-Za-z0-9_@]+)\$/g)].map((match) => match[1]!.toLowerCase()).sort();
}

/**
 * Collects the files under a directory whose name matches an extension.
 *
 * @param dir - Directory to walk.
 * @param extensions - Accepted file extensions, including the dot.
 * @returns Absolute paths of the matching files.
 */
function listFiles(dir: string, extensions: readonly string[]): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(full, extensions);
        return extensions.includes(path.extname(entry.name)) ? [full] : [];
    });
}

/**
 * Lists the message keys that the catalogue of calculators needs, built the same way the popup builds them.
 *
 * @returns Every group, calculator, field, output and choice key.
 */
function calculatorKeys(): string[] {
    const keys: string[] = GROUPS.map(groupKey);
    for (const calculator of CALCULATORS.map((item) => getCalculator(item.id))) {
        keys.push(
            calculatorNameKey(calculator.id),
            calculatorDescriptionKey(calculator.id),
            calculatorFormulaKey(calculator.id)
        );
        for (const field of calculator.fields) {
            keys.push(fieldKey(calculator.id, field.id));
            for (const choice of field.choices ?? []) keys.push(choiceKey(calculator.id, field.id, choice));
        }
        for (const output of calculator.outputs) {
            keys.push(outputKey(calculator.id, output.id));
            for (const category of output.categories ?? []) keys.push(categoryKey(calculator.id, output.id, category));
        }
    }
    return keys;
}

const defaults = loadLocale(DEFAULT_LOCALE);

describe("locales", () => {
    it("ships exactly the supported languages", () => {
        expect(readdirSync(LOCALES_DIR).sort()).toEqual(EXPECTED_LOCALES);
    });

    it.each(EXPECTED_LOCALES)("%s defines the same keys as the default locale", (locale) => {
        expect(Object.keys(loadLocale(locale)).sort()).toEqual(Object.keys(defaults).sort());
    });

    it.each(EXPECTED_LOCALES)("%s has no empty messages", (locale) => {
        for (const [key, entry] of Object.entries(loadLocale(locale))) {
            expect(entry.message.trim(), `${locale}.${key}`).not.toBe("");
        }
    });

    it.each(EXPECTED_LOCALES)("%s uses the same placeholders as the default locale", (locale) => {
        const messages = loadLocale(locale);
        for (const [key, entry] of Object.entries(defaults)) {
            const translated = messages[key]!;
            expect(Object.keys(translated.placeholders ?? {}).sort(), `${locale}.${key}`).toEqual(
                Object.keys(entry.placeholders ?? {}).sort()
            );
            expect(referencedPlaceholders(translated.message), `${locale}.${key}`).toEqual(
                referencedPlaceholders(entry.message)
            );
            for (const name of referencedPlaceholders(translated.message)) {
                const declared = Object.keys(translated.placeholders ?? {}).map((n) => n.toLowerCase());
                expect(declared, `${locale}.${key} references $${name}$`).toContain(name);
            }
        }
    });

    it.each(EXPECTED_LOCALES)("%s respects the Chrome Web Store length limits", (locale) => {
        const messages = loadLocale(locale);
        expect(messages.extDescription!.message.length).toBeLessThanOrEqual(132);
        expect(messages.extName!.message.length).toBeLessThanOrEqual(45);
        expect(messages.extShortName!.message.length).toBeLessThanOrEqual(12);
    });

    it.each(EXPECTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE))(
        "%s translates the messages instead of copying the English text",
        (locale) => {
            const messages = loadLocale(locale);
            const untranslated = Object.keys(defaults).filter(
                (key) => messages[key]!.message === defaults[key]!.message && /[a-z]{4,}/i.test(defaults[key]!.message)
            );
            // Names that are the same in every language (ROI, CAGR, Markup, "Selic $SELIC$ · Dollar $USD$", ...) are
            // allowed; sentences are not. Placeholders and symbols do not count as words.
            const wordCount = (text: string) => (text.replace(/\$[A-Z]+\$/g, "").match(/\p{L}{2,}/gu) ?? []).length;
            expect(
                untranslated.filter((key) => wordCount(defaults[key]!.message) > 3),
                locale
            ).toEqual([]);
        }
    );
});

describe("calculator texts", () => {
    it.each(EXPECTED_LOCALES)("%s has a message for every calculator, field, output, choice and group", (locale) => {
        const messages = loadLocale(locale);
        for (const key of calculatorKeys()) expect(messages, `${locale} is missing "${key}"`).toHaveProperty(key);
    });

    it("keeps the formula of each calculator to a readable length", () => {
        for (const locale of EXPECTED_LOCALES) {
            for (const calculator of CALCULATORS) {
                const formula = loadLocale(locale)[calculatorFormulaKey(calculator.id)]!.message;
                expect(formula.length, `${locale}.${calculator.id}`).toBeLessThanOrEqual(190);
            }
        }
    });

    it("leaves no message without a user: every key is either static, derived from a calculator or referenced", () => {
        const sources = [
            ...listFiles(path.join(ROOT, "src"), [".ts"]).filter((file) => !file.endsWith("i18n.ts")),
            ...listFiles(path.join(ROOT, "public"), [".html", ".json"]).filter((file) => !file.includes("_locales")),
        ]
            .map((file) => readFileSync(file, "utf8"))
            .join("\n");
        const derived = new Set(calculatorKeys());
        for (const key of Object.keys(defaults)) {
            const used = derived.has(key) || sources.includes(`"${key}"`) || sources.includes(`__MSG_${key}__`);
            expect(used, `unused "${key}"`).toBe(true);
        }
    });
});

describe("message usage", () => {
    const sources = [
        // The helper's own documentation contains example markup such as data-i18n="key".
        ...listFiles(path.join(ROOT, "src"), [".ts"]).filter((file) => !file.endsWith("i18n.ts")),
        ...listFiles(path.join(ROOT, "public"), [".html", ".json"]).filter((file) => !file.includes("_locales")),
    ].map((file) => readFileSync(file, "utf8"));
    const allSource = sources.join("\n");

    it("defines every key referenced from HTML data attributes, the manifest and t() calls", () => {
        const referenced = new Set<string>();
        for (const match of allSource.matchAll(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9_]+)"/g)) referenced.add(match[1]!);
        for (const match of allSource.matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)) referenced.add(match[1]!);
        for (const match of allSource.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)) referenced.add(match[1]!);
        for (const match of allSource.matchAll(/\bt\(\s*[^"]*\?\s*"([A-Za-z0-9_]+)"\s*:\s*"([A-Za-z0-9_]+)"/g)) {
            referenced.add(match[1]!);
            referenced.add(match[2]!);
        }

        expect(referenced.size).toBeGreaterThan(0);
        for (const key of referenced) expect(Object.keys(defaults), `missing message "${key}"`).toContain(key);
    });

    it("declares the default locale in the manifest", () => {
        const manifest = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.json"), "utf8"));
        expect(manifest.default_locale).toBe(DEFAULT_LOCALE);
    });
});

describe("t", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("returns the localized message", () => {
        vi.stubGlobal("chrome", { i18n: { getMessage: () => "Copiar resultados" } });
        expect(t("copyResults")).toBe("Copiar resultados");
    });

    it("passes substitutions through to chrome.i18n", () => {
        const getMessage = vi.fn(() => "Deve ser no mínimo 0");
        vi.stubGlobal("chrome", { i18n: { getMessage } });
        t("errorMin", "0");
        expect(getMessage).toHaveBeenCalledWith("errorMin", "0");
    });

    it("falls back to the key when the message is missing", () => {
        vi.stubGlobal("chrome", { i18n: { getMessage: () => "" } });
        expect(t("copyResults")).toBe("copyResults");
    });
});
