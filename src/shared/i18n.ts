/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/i18n.ts
    Description: Localization helpers: the active language, message lookup and placeholder expansion for the extension pages.
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
import type defaultMessages from "../locales/en_US.json";
import { CATALOG, type MessageEntry } from "./catalog";
import {
    AUTO_LANGUAGE,
    DEFAULT_LOCALE,
    isLocaleCode,
    localeInfo,
    matchLocale,
    type LocaleCode,
    type TextDirection,
} from "./locales";

/**
 * Every message key defined in the default locale (`en_US`). Typing keys from
 * the JSON file makes a misspelled or removed key a compile-time error.
 */
export type MessageKey = keyof typeof defaultMessages;

/** Values substituted for `$1`, `$2`, ... in a message. */
export type Substitutions = string | readonly string[];

/** `[attribute to set, data attribute holding the message key]` pairs handled by {@link applyTranslations}. */
const ATTRIBUTE_BINDINGS = [
    ["title", "data-i18n-title"],
    ["aria-label", "data-i18n-aria-label"],
    ["placeholder", "data-i18n-placeholder"],
] as const;

/** The language the lookups below currently use. */
let activeLocale: LocaleCode = DEFAULT_LOCALE;

/**
 * Chooses the language used by {@link t} and friends.
 *
 * The extension can follow the browser or use a language of the user's choice. Chrome's own
 * `chrome.i18n` is not used for this, because it cannot be told to use another language.
 *
 * @param preference - `"auto"` to follow the browser, or the code of a supported language.
 * @param browserLanguage - The browser's UI language tag, used when `preference` is `"auto"`.
 * @returns The language that is now active.
 */
export function setLanguage(preference: string, browserLanguage: string): LocaleCode {
    activeLocale = preference !== AUTO_LANGUAGE && isLocaleCode(preference) ? preference : matchLocale(browserLanguage);
    return activeLocale;
}

/**
 * Reads the browser's UI language.
 *
 * @returns A BCP 47 tag such as `pt-BR`, `es` or `en-US`.
 */
export function browserLanguage(): string {
    return chrome.i18n.getUILanguage();
}

/**
 * Returns the BCP 47 tag of the active language, for the `lang` attribute and for date formatting.
 *
 * @returns A tag such as `pt-BR`.
 */
export function languageTag(): string {
    return localeInfo(activeLocale).tag;
}

/**
 * Returns the reading direction of the active language.
 *
 * @returns `"rtl"` for Arabic, Persian and Urdu, otherwise `"ltr"`.
 */
export function textDirection(): TextDirection {
    return localeInfo(activeLocale).dir;
}

/**
 * Expands a message the way Chrome does: `$name$` placeholders are replaced by their `content`,
 * `$1`..`$9` by the substitutions, and `$$` by a literal `$`.
 *
 * @param entry - The message and its placeholder definitions.
 * @param substitutions - Values for `$1`, `$2`, ...
 * @returns The final text.
 */
export function formatMessage(entry: MessageEntry, substitutions?: Substitutions): string {
    const values =
        substitutions === undefined ? [] : typeof substitutions === "string" ? [substitutions] : substitutions;
    const placeholders = new Map(
        Object.entries(entry.placeholders ?? {}).map(([name, placeholder]) => [name.toLowerCase(), placeholder.content])
    );
    /**
     * Replaces `$1`..`$9` in a text with the substitutions.
     *
     * @param text - Text that may contain positional markers.
     * @returns The text with every marker filled, or emptied when no value was given for it.
     */
    const fillValues = (text: string): string =>
        text.replace(/\$(\d)/g, (_, digit: string) => values[Number(digit) - 1] ?? "");

    return entry.message.replace(
        /\$(\$)|\$(\d)|\$([A-Za-z0-9_@]+)\$/g,
        (_match, dollar?: string, digit?: string, name?: string) => {
            if (dollar) return "$";
            if (digit) return values[Number(digit) - 1] ?? "";
            return fillValues(placeholders.get((name ?? "").toLowerCase()) ?? "");
        }
    );
}

/**
 * Looks up a message in the active language, falling back to English when the active language
 * lacks it.
 *
 * @param key - Message name defined in `src/locales/en_US.json`.
 * @param substitutions - Values for the message's `$1`, `$2`, ... placeholders.
 * @returns The localized text, or the key itself when the message is missing everywhere.
 */
export function t(key: MessageKey, substitutions?: Substitutions): string {
    const entry = CATALOG[activeLocale][key] ?? CATALOG[DEFAULT_LOCALE][key];
    return entry ? formatMessage(entry, substitutions) : key;
}

/**
 * Localizes an HTML subtree in place. The markup keeps its English text as a
 * fallback and opts in to translation with data attributes:
 *
 * - `data-i18n="key"` replaces the element's text content.
 * - `data-i18n-title`, `data-i18n-aria-label` and `data-i18n-placeholder`
 *   replace the attribute of the same name.
 *
 * @param root - Subtree to localize.
 * @param substitutions - Placeholder values for messages that need them, by message key.
 */
export function applyTranslations(
    root: ParentNode = document,
    substitutions: Partial<Record<MessageKey, Substitutions>> = {}
): void {
    for (const node of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
        const key = node.dataset.i18n as MessageKey;
        node.textContent = t(key, substitutions[key]);
    }
    for (const [attribute, dataAttribute] of ATTRIBUTE_BINDINGS) {
        for (const node of root.querySelectorAll<HTMLElement>(`[${dataAttribute}]`)) {
            const key = node.getAttribute(dataAttribute) as MessageKey;
            node.setAttribute(attribute, t(key, substitutions[key]));
        }
    }
}
