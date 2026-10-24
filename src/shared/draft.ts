/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/draft.ts
    Description: Memory-only draft of what was typed into each calculator.
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
import { CALCULATORS } from "../core/calculators";

/** What was typed, by calculator id and then by field id. */
export type Draft = Record<string, Record<string, string>>;

/** Longest text kept for one field. Matches the longest accepted list of cash flows with room to spare. */
export const MAX_FIELD_TEXT = 4000;

const STORAGE_KEY = "calculatorDraft";

/**
 * Resolves the storage area that holds the draft. It is looked up lazily so
 * that importing this module never touches `chrome` (for example in tests).
 *
 * `storage.session` is memory only: it is never written to disk and disappears
 * when the browser closes, which is the right lifetime for business figures
 * that were typed in to try something out.
 *
 * @returns The storage area used for the draft.
 */
const storageArea = () => chrome.storage.session;

/**
 * Turns untrusted stored data into a valid draft. Only fields that exist in a
 * known calculator are kept, and every value must be a short string.
 *
 * @param raw - Value read from storage.
 * @returns A valid draft.
 */
export function sanitizeDraft(raw: unknown): Draft {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
    const input = raw as Record<string, unknown>;
    const draft: Draft = {};
    for (const calculator of CALCULATORS) {
        const stored = input[calculator.id];
        if (typeof stored !== "object" || stored === null || Array.isArray(stored)) continue;
        const texts: Record<string, string> = {};
        for (const field of calculator.fields) {
            const text = (stored as Record<string, unknown>)[field.id];
            if (typeof text === "string" && text.length <= MAX_FIELD_TEXT) texts[field.id] = text;
        }
        if (Object.keys(texts).length > 0) draft[calculator.id] = texts;
    }
    return draft;
}

/**
 * Reads the draft from storage.
 *
 * @returns The stored draft; empty when none exists or storage is unavailable.
 */
export async function loadDraft(): Promise<Draft> {
    try {
        const stored = await storageArea().get(STORAGE_KEY);
        return sanitizeDraft(stored[STORAGE_KEY]);
    } catch {
        return {};
    }
}

/**
 * Writes the draft to storage.
 *
 * @param draft - What was typed into each calculator.
 */
export async function saveDraft(draft: Draft): Promise<void> {
    await storageArea().set({ [STORAGE_KEY]: draft });
}

/** Deletes the draft. */
export async function clearDraft(): Promise<void> {
    await storageArea().remove(STORAGE_KEY);
}
