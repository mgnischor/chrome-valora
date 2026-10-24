/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/market.test.ts
    Description: Unit tests for the Central Bank rate download, its validation and its cache.
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
import {
    MARKET_ORIGIN,
    MARKET_PERMISSIONS,
    MARKET_TTL_MS,
    MarketError,
    clearRates,
    fetchRates,
    hasMarketPermission,
    isFresh,
    latestUntil,
    loadRates,
    localDate,
    parseSgsDate,
    selicUrl,
    usdUrl,
    sanitizeRates,
    saveRates,
    type MarketRates,
} from "../src/shared/market";

const NOW = new Date(2026, 9, 24, 12, 0, 0).getTime();

const RATES: MarketRates = {
    selic: 0.1375,
    selicDate: "2026-10-23",
    usdBrl: 5.0377,
    usdBrlDate: "2026-10-23",
    fetchedAt: NOW,
};

/**
 * Builds a fake `fetch` that answers each series URL with the given JSON.
 *
 * @param responses - JSON by URL; a value of `Error` makes the request fail, a number sets the HTTP status.
 * @returns The fake and its mock.
 */
function fakeFetch(responses: Record<string, unknown>) {
    const mock = vi.fn(async (url: string) => {
        const body = responses[url];
        if (body instanceof Error) throw body;
        if (typeof body === "number") return { ok: false, status: body, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => body };
    });
    return { fetcher: mock as unknown as typeof fetch, mock };
}

describe("parseSgsDate", () => {
    it("converts dd/MM/yyyy to ISO", () => {
        expect(parseSgsDate("23/10/2026")).toBe("2026-10-23");
        expect(parseSgsDate("29/02/2028")).toBe("2028-02-29");
    });

    it.each(["31/02/2026", "2026-10-23", "1/1/2026", "", "32/01/2026", "00/01/2026", 5, null, undefined])(
        "rejects %j",
        (value) => {
            expect(parseSgsDate(value)).toBeNull();
        }
    );
});

describe("latestUntil", () => {
    const series = [
        { data: "02/11/2026", valor: "13.75" },
        { data: "22/10/2026", valor: "14.00" },
        { data: "04/11/2026", valor: "13.50" },
        { data: "23/10/2026", valor: "13.75" },
    ];

    it("ignores observations dated after today and picks the newest of the rest", () => {
        expect(latestUntil(series, "2026-10-24")).toEqual({ date: "2026-10-23", value: 13.75 });
    });

    it("accepts an observation dated today", () => {
        expect(latestUntil(series, "2026-11-02")).toEqual({ date: "2026-11-02", value: 13.75 });
    });

    it("skips malformed entries", () => {
        const messy = [
            null,
            5,
            { data: "bad", valor: "1" },
            { data: "01/01/2026", valor: "x" },
            { data: "02/01/2026", valor: 3 },
        ];
        expect(latestUntil(messy, "2026-12-31")).toBeNull();
        expect(latestUntil([...messy, { data: "03/01/2026", valor: "1.5" }], "2026-12-31")).toEqual({
            date: "2026-01-03",
            value: 1.5,
        });
    });

    it("returns null for anything that is not a list, or an empty one", () => {
        expect(latestUntil({}, "2026-10-24")).toBeNull();
        expect(latestUntil([], "2026-10-24")).toBeNull();
        expect(latestUntil("x", "2026-10-24")).toBeNull();
    });
});

describe("series URLs", () => {
    it("ask for the last 30 days ending today, so future-dated values are never returned", () => {
        expect(selicUrl(NOW)).toBe(
            "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=24/09/2026&dataFinal=24/10/2026"
        );
        expect(usdUrl(NOW)).toBe(
            "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=24/09/2026&dataFinal=24/10/2026"
        );
    });

    it("stay on the Central Bank origin", () => {
        expect(new URL(selicUrl(NOW)).origin).toBe(MARKET_ORIGIN);
        expect(new URL(usdUrl(NOW)).origin).toBe(MARKET_ORIGIN);
    });
});

describe("localDate", () => {
    it("formats the local calendar date", () => {
        expect(localDate(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05");
    });
});

describe("sanitizeRates", () => {
    it("keeps valid rates", () => {
        expect(sanitizeRates(RATES)).toEqual(RATES);
    });

    it.each([
        ["a Selic of zero", { ...RATES, selic: 0 }],
        ["a Selic above 100 %", { ...RATES, selic: 13.75 }],
        ["a negative dollar", { ...RATES, usdBrl: -1 }],
        ["an absurd dollar", { ...RATES, usdBrl: 5000 }],
        ["a dollar as text", { ...RATES, usdBrl: "5.03" }],
        ["a malformed date", { ...RATES, usdBrlDate: "23/10/2026" }],
        ["a missing timestamp", { ...RATES, fetchedAt: undefined }],
        ["NaN", { ...RATES, selic: NaN }],
    ])("rejects %s", (_name, raw) => {
        expect(sanitizeRates(raw)).toBeNull();
    });

    it("rejects data that is not an object", () => {
        for (const raw of [null, undefined, "x", 3, [RATES]]) expect(sanitizeRates(raw)).toBeNull();
    });
});

describe("fetchRates", () => {
    const answers = {
        [selicUrl(NOW)]: [
            { data: "23/10/2026", valor: "13.75" },
            { data: "04/11/2026", valor: "13.50" },
        ],
        [usdUrl(NOW)]: [
            { data: "22/10/2026", valor: "5.0383" },
            { data: "23/10/2026", valor: "5.0377" },
        ],
    };

    it("downloads the two series and converts the Selic from percent to a fraction", async () => {
        const { fetcher, mock } = fakeFetch(answers);
        expect(await fetchRates(fetcher, NOW)).toEqual(RATES);
        expect(mock.mock.calls.map(([url]) => url).sort()).toEqual([selicUrl(NOW), usdUrl(NOW)].sort());
    });

    it("only contacts the Central Bank, with a plain anonymous GET", async () => {
        const { fetcher, mock } = fakeFetch(answers);
        await fetchRates(fetcher, NOW);
        for (const [url, init] of mock.mock.calls as unknown as [string, RequestInit][]) {
            expect(new URL(url).origin).toBe(MARKET_ORIGIN);
            expect(init.credentials).toBe("omit");
            expect(init.method).toBeUndefined();
            expect(init.body).toBeUndefined();
        }
    });

    it("reports a network failure", async () => {
        const { fetcher } = fakeFetch({ ...answers, [usdUrl(NOW)]: new Error("offline") });
        await expect(fetchRates(fetcher, NOW)).rejects.toMatchObject({ name: "MarketError", code: "NETWORK" });
    });

    it("reports an HTTP error", async () => {
        const { fetcher } = fakeFetch({ ...answers, [selicUrl(NOW)]: 503 });
        await expect(fetchRates(fetcher, NOW)).rejects.toMatchObject({ code: "BAD_RESPONSE" });
    });

    it("rejects a response without a usable observation", async () => {
        const { fetcher } = fakeFetch({ ...answers, [usdUrl(NOW)]: [] });
        await expect(fetchRates(fetcher, NOW)).rejects.toBeInstanceOf(MarketError);
    });

    it("rejects implausible values instead of showing them", async () => {
        const { fetcher } = fakeFetch({ ...answers, [selicUrl(NOW)]: [{ data: "23/10/2026", valor: "1375" }] });
        await expect(fetchRates(fetcher, NOW)).rejects.toMatchObject({ code: "BAD_RESPONSE" });
    });
});

describe("isFresh", () => {
    it("is true for a recent download and false once the lifetime has passed", () => {
        expect(isFresh(RATES, NOW + MARKET_TTL_MS - 1)).toBe(true);
        expect(isFresh(RATES, NOW + MARKET_TTL_MS)).toBe(false);
    });

    it("distrusts a download that seems to be from the future", () => {
        expect(isFresh(RATES, NOW - 1)).toBe(false);
    });
});

describe("storage and permission", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("asks for the Central Bank origin and nothing else", () => {
        expect(MARKET_PERMISSIONS).toEqual({ origins: ["https://api.bcb.gov.br/*"] });
    });

    it("keeps the rates in local storage and sanitizes them on the way back", async () => {
        const local = {
            get: vi.fn().mockResolvedValue({ marketRates: RATES }),
            set: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
        };
        vi.stubGlobal("chrome", { storage: { local } });
        expect(await loadRates()).toEqual(RATES);
        await saveRates(RATES);
        expect(local.set).toHaveBeenCalledWith({ marketRates: RATES });
        await clearRates();
        expect(local.remove).toHaveBeenCalledWith("marketRates");
    });

    it("ignores corrupted or unavailable storage", async () => {
        vi.stubGlobal("chrome", {
            storage: { local: { get: vi.fn().mockResolvedValue({ marketRates: { selic: 5 } }) } },
        });
        expect(await loadRates()).toBeNull();
        vi.stubGlobal("chrome", { storage: { local: { get: vi.fn().mockRejectedValue(new Error("no")) } } });
        expect(await loadRates()).toBeNull();
    });

    it("reports whether the permission is granted", async () => {
        const contains = vi.fn().mockResolvedValue(true);
        vi.stubGlobal("chrome", { permissions: { contains } });
        expect(await hasMarketPermission()).toBe(true);
        expect(contains).toHaveBeenCalledWith(MARKET_PERMISSIONS);
        vi.stubGlobal("chrome", { permissions: { contains: vi.fn().mockRejectedValue(new Error("no")) } });
        expect(await hasMarketPermission()).toBe(false);
    });
});
