/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/locales.ts
    Description: The languages the extension is translated into, and the matching of browser languages to them.
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
/** Reading direction of a language. */
export type TextDirection = "ltr" | "rtl";

/** One language the extension is translated into. */
export interface LocaleInfo {
    /** Folder-style code that names the translation file in `src/locales`, such as `pt_BR`. */
    readonly code: string;
    /** The language's name in that language, shown in the language selector. */
    readonly name: string;
    /** BCP 47 tag for the `lang` attribute and date formatting. */
    readonly tag: string;
    readonly dir: TextDirection;
}

/**
 * Every supported language, ordered by number of native speakers (Chinese counts once, with a
 * Simplified and a Traditional variant). Polish is kept although it ranks lower.
 */
export const LOCALES = [
    { code: "en_US", name: "English", tag: "en-US", dir: "ltr" },
    { code: "zh_CN", name: "简体中文", tag: "zh-CN", dir: "ltr" },
    { code: "zh_TW", name: "繁體中文", tag: "zh-TW", dir: "ltr" },
    { code: "es", name: "Español", tag: "es", dir: "ltr" },
    { code: "hi", name: "हिन्दी", tag: "hi", dir: "ltr" },
    { code: "bn", name: "বাংলা", tag: "bn", dir: "ltr" },
    { code: "pt_BR", name: "Português (Brasil)", tag: "pt-BR", dir: "ltr" },
    { code: "ru", name: "Русский", tag: "ru", dir: "ltr" },
    { code: "ja", name: "日本語", tag: "ja", dir: "ltr" },
    { code: "pa", name: "ਪੰਜਾਬੀ", tag: "pa", dir: "ltr" },
    { code: "mr", name: "मराठी", tag: "mr", dir: "ltr" },
    { code: "te", name: "తెలుగు", tag: "te", dir: "ltr" },
    { code: "tr", name: "Türkçe", tag: "tr", dir: "ltr" },
    { code: "ko", name: "한국어", tag: "ko", dir: "ltr" },
    { code: "fr", name: "Français", tag: "fr", dir: "ltr" },
    { code: "de", name: "Deutsch", tag: "de", dir: "ltr" },
    { code: "vi", name: "Tiếng Việt", tag: "vi", dir: "ltr" },
    { code: "ta", name: "தமிழ்", tag: "ta", dir: "ltr" },
    { code: "ur", name: "اردو", tag: "ur", dir: "rtl" },
    { code: "jv", name: "Basa Jawa", tag: "jv", dir: "ltr" },
    { code: "it", name: "Italiano", tag: "it", dir: "ltr" },
    { code: "ar", name: "العربية", tag: "ar", dir: "rtl" },
    { code: "gu", name: "ગુજરાતી", tag: "gu", dir: "ltr" },
    { code: "fa", name: "فارسی", tag: "fa", dir: "rtl" },
    { code: "bho", name: "भोजपुरी", tag: "bho", dir: "ltr" },
    { code: "ha", name: "Hausa", tag: "ha", dir: "ltr" },
    { code: "kn", name: "ಕನ್ನಡ", tag: "kn", dir: "ltr" },
    { code: "id", name: "Bahasa Indonesia", tag: "id", dir: "ltr" },
    { code: "pl", name: "Polski", tag: "pl", dir: "ltr" },
    { code: "ml", name: "മലയാളം", tag: "ml", dir: "ltr" },
    { code: "uk", name: "Українська", tag: "uk", dir: "ltr" },
] as const satisfies readonly LocaleInfo[];

/** Code of a supported language. */
export type LocaleCode = (typeof LOCALES)[number]["code"];

/** Language used when nothing matches, and the source of every translation. */
export const DEFAULT_LOCALE: LocaleCode = "en_US";

/** The language setting value that follows the browser's UI language. */
export const AUTO_LANGUAGE = "auto";

/**
 * Checks whether a value is the code of a supported language.
 *
 * @param value - Value to check.
 * @returns `true` when `value` is one of the codes in {@link LOCALES}.
 */
export function isLocaleCode(value: unknown): value is LocaleCode {
    return LOCALES.some((locale) => locale.code === value);
}

/**
 * Looks up the details of a supported language.
 *
 * @param code - Language code.
 * @returns The language's entry in {@link LOCALES}.
 */
export function localeInfo(code: LocaleCode): LocaleInfo {
    return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0];
}

/**
 * Picks the supported language that best matches a browser language tag.
 *
 * An exact match wins (`pt-BR`, `zh-TW`); then Traditional Chinese regions and scripts select
 * `zh_TW` and every other Chinese tag `zh_CN`; then the base language decides (`es-419` gives
 * `es`, `pt-PT` gives `pt_BR`, `en-GB` gives `en_US`); anything else falls back to English.
 *
 * @param tag - A language tag such as the value of `chrome.i18n.getUILanguage()`.
 * @returns The code of the closest supported language.
 */
export function matchLocale(tag: string): LocaleCode {
    const parts = tag.split(/[-_]/);
    const normalized = parts.join("_").toLowerCase();
    const exact = LOCALES.find((locale) => locale.code.toLowerCase() === normalized);
    if (exact) return exact.code;

    const language = (parts[0] ?? "").toLowerCase();
    if (language === "zh") {
        return parts.slice(1).some((part) => /^(tw|hk|mo|hant)$/i.test(part)) ? "zh_TW" : "zh_CN";
    }
    const sameLanguage = LOCALES.find((locale) => locale.code.split("_")[0] === language);
    return sameLanguage?.code ?? DEFAULT_LOCALE;
}
