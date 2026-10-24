/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/draft.test.ts
    Description: Unit tests for the memory-only calculator draft.
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
import { MAX_FIELD_TEXT, clearDraft, loadDraft, sanitizeDraft, saveDraft } from "../src/shared/draft";

describe("sanitizeDraft", () => {
    it("keeps the texts of known fields", () => {
        const draft = { roi: { invested: "1000", returned: "1250" }, loan: { principal: "5" } };
        expect(sanitizeDraft(draft)).toEqual(draft);
    });

    it("returns an empty draft for anything that is not an object", () => {
        for (const raw of [undefined, null, "x", 5, [], [{ roi: {} }]]) expect(sanitizeDraft(raw)).toEqual({});
    });

    it("drops unknown calculators and fields", () => {
        expect(sanitizeDraft({ nope: { a: "1" }, roi: { invested: "1", nope: "2" } })).toEqual({
            roi: { invested: "1" },
        });
    });

    it("drops values that are not short strings", () => {
        const draft = sanitizeDraft({
            roi: { invested: 1000, returned: "x".repeat(MAX_FIELD_TEXT + 1) },
            loan: { principal: "ok", annualRate: null, termMonths: { a: 1 } },
        });
        expect(draft).toEqual({ loan: { principal: "ok" } });
    });

    it("drops calculators whose stored value is not an object", () => {
        expect(sanitizeDraft({ roi: "x", loan: [1], cagr: null })).toEqual({});
    });
});

describe("storage", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("uses the memory-only session area", async () => {
        const session = {
            get: vi.fn().mockResolvedValue({ calculatorDraft: { roi: { invested: "5" } } }),
            set: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
        };
        vi.stubGlobal("chrome", { storage: { session, local: {}, sync: {} } });

        expect(await loadDraft()).toEqual({ roi: { invested: "5" } });
        await saveDraft({ roi: { invested: "6" } });
        expect(session.set).toHaveBeenCalledWith({ calculatorDraft: { roi: { invested: "6" } } });
        await clearDraft();
        expect(session.remove).toHaveBeenCalledWith("calculatorDraft");
    });

    it("loads an empty draft when storage fails", async () => {
        vi.stubGlobal("chrome", { storage: { session: { get: vi.fn().mockRejectedValue(new Error("no")) } } });
        expect(await loadDraft()).toEqual({});
    });
});
