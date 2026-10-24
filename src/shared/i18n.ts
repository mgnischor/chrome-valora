/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/i18n.ts
    Description: Localization helpers built on chrome.i18n for the extension pages.
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
import type defaultMessages from "../../public/_locales/en_US/messages.json";

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

/**
 * Looks up a message in the locale matching the browser's UI language.
 *
 * Chrome picks the locale on its own: an exact match such as `pt_BR` first,
 * then the base language such as `es`, and finally the default locale
 * (`en_US`).
 *
 * @param key - Message name defined in `_locales/<locale>/messages.json`.
 * @param substitutions - Values for the message's `$1`, `$2`, ... placeholders.
 * @returns The localized text, or the key itself when the message is missing.
 */
export function t(key: MessageKey, substitutions?: Substitutions): string {
    const message = chrome.i18n.getMessage(key, substitutions as string | string[] | undefined);
    return message || key;
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

/**
 * Returns the browser's UI language as a BCP 47 tag.
 *
 * @returns A tag such as `pt-BR`, `es` or `en-US`.
 */
export function uiLanguage(): string {
    return chrome.i18n.getUILanguage();
}
