/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/market.ts
    Description: Optional download of the Selic rate and the US dollar quote from the Central Bank of Brazil.
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
/**
 * The only code in the extension that talks to the network, and only when the
 * user turns on "live rates" and grants the optional host permission. It reads
 * two public time series of the Central Bank of Brazil (SGS):
 *
 * - series 432: the Selic target, in % per year
 * - series 1: the commercial US dollar quote (selling), in R$ per US$
 *
 * Nothing about the user is sent: each request is a plain GET of a public URL.
 */

/** Origin of the Central Bank API, and the only host the extension may contact. */
export const MARKET_ORIGIN = "https://api.bcb.gov.br";

/** Optional permission requested when the user turns on live rates. */
export const MARKET_PERMISSIONS: chrome.permissions.Permissions = { origins: [`${MARKET_ORIGIN}/*`] };

/** How long downloaded rates are used before they are fetched again. The API itself caches for 15 minutes. */
export const MARKET_TTL_MS = 15 * 60 * 1000;

/** Give up on a request after this long. */
export const MARKET_TIMEOUT_MS = 8000;

/** The window of dates requested, ending today. Wide enough to span weekends, holidays and a delayed publication. */
const LOOKBACK_DAYS = 30;

const STORAGE_KEY = "marketRates";

/**
 * Formats a point in time as a date in the Central Bank's request format.
 *
 * @param time - Unix time in milliseconds.
 * @returns `dd/MM/yyyy` in the user's time zone.
 */
function sgsDate(time: number): string {
    const [year, month, day] = localDate(time).split("-") as [string, string, string];
    return `${day}/${month}/${year}`;
}

/**
 * Builds the URL of a series for the last {@link LOOKBACK_DAYS} days.
 *
 * @param code - SGS series code.
 * @param now - The current time in Unix milliseconds.
 * @returns A URL that returns `[{ "data": "dd/MM/yyyy", "valor": "..." }, ...]`, oldest first, never beyond today.
 */
function seriesUrl(code: number, now: number): string {
    const from = sgsDate(now - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    return `${MARKET_ORIGIN}/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${from}&dataFinal=${sgsDate(now)}`;
}

/**
 * URL of the Selic target series (SGS 432, % per year).
 *
 * @param now - The current time in Unix milliseconds.
 * @returns The request URL.
 */
export const selicUrl = (now: number): string => seriesUrl(432, now);

/**
 * URL of the commercial US dollar series, selling (SGS 1, R$ per US$).
 *
 * @param now - The current time in Unix milliseconds.
 * @returns The request URL.
 */
export const usdUrl = (now: number): string => seriesUrl(1, now);

/** One reading of a time series. */
export interface Observation {
    /** Date as `YYYY-MM-DD`. */
    date: string;
    value: number;
}

/** The market figures the calculators can use. */
export interface MarketRates {
    /** The Selic target per year, as a fraction (0.1375 is 13.75 %). */
    selic: number;
    /** Date of the Selic reading as `YYYY-MM-DD`. */
    selicDate: string;
    /** R$ per US$. */
    usdBrl: number;
    /** Date of the quote as `YYYY-MM-DD`. */
    usdBrlDate: string;
    /** Unix time in milliseconds when the figures were downloaded. */
    fetchedAt: number;
}

/** Why the rates could not be obtained. */
export type MarketErrorCode = "NETWORK" | "BAD_RESPONSE";

/** Thrown by {@link fetchRates}. */
export class MarketError extends Error {
    constructor(
        readonly code: MarketErrorCode,
        message: string
    ) {
        super(message);
        this.name = "MarketError";
    }
}

/**
 * Converts a date written by the Central Bank (`dd/MM/yyyy`) to ISO form.
 *
 * @param text - The date.
 * @returns `YYYY-MM-DD`, or `null` when the text is not a valid calendar date.
 */
export function parseSgsDate(text: unknown): string | null {
    const match = typeof text === "string" ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text) : null;
    if (!match) return null;
    const [, day, month, year] = match as unknown as [string, string, string, string];
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const valid =
        date.getUTCFullYear() === Number(year) &&
        date.getUTCMonth() === Number(month) - 1 &&
        date.getUTCDate() === Number(day);
    return valid ? `${year}-${month}-${day}` : null;
}

/**
 * Picks the most recent observation that is not dated in the future.
 *
 * The requests already end today, but the Selic series is published with dates
 * ahead of time (the target decided at a Copom meeting applies from a later
 * date), so the check is kept as a safeguard.
 *
 * @param raw - The parsed JSON of a SGS response: `[{ "data": "dd/MM/yyyy", "valor": "13.75" }, ...]`.
 * @param today - The current date as `YYYY-MM-DD`.
 * @returns The newest observation dated `today` or earlier, or `null` when there is none.
 */
export function latestUntil(raw: unknown, today: string): Observation | null {
    if (!Array.isArray(raw)) return null;
    let best: Observation | null = null;
    for (const item of raw) {
        const entry = item as { data?: unknown; valor?: unknown } | null;
        if (typeof entry !== "object" || entry === null) continue;
        const date = parseSgsDate(entry.data);
        const value = typeof entry.valor === "string" ? Number(entry.valor) : NaN;
        if (date === null || !Number.isFinite(value) || date > today) continue;
        if (best === null || date > best.date) best = { date, value };
    }
    return best;
}

/**
 * Formats a point in time as a local calendar date.
 *
 * @param time - Unix time in milliseconds.
 * @returns `YYYY-MM-DD` in the user's time zone.
 */
export function localDate(time: number): string {
    const date = new Date(time);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Downloads one series.
 *
 * @param url - The series URL.
 * @param fetcher - The `fetch` function; replaced in tests.
 * @returns The parsed JSON.
 * @throws MarketError when the request fails, times out or does not return JSON.
 */
async function getJson(url: string, fetcher: typeof fetch): Promise<unknown> {
    try {
        const response = await fetcher(url, {
            signal: AbortSignal.timeout(MARKET_TIMEOUT_MS),
            credentials: "omit",
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new MarketError("BAD_RESPONSE", `HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        if (error instanceof MarketError) throw error;
        throw new MarketError("NETWORK", error instanceof Error ? error.message : "Request failed");
    }
}

/**
 * Turns untrusted data (a response or stored data) into valid rates.
 *
 * @param raw - The value to check.
 * @returns The rates, or `null` when anything is missing or implausible: a Selic outside (0 %, 100 %], a dollar outside (0, 1000] or a malformed date.
 */
export function sanitizeRates(raw: unknown): MarketRates | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const input = raw as Record<string, unknown>;
    const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const { selic, usdBrl, selicDate, usdBrlDate, fetchedAt } = input;
    if (typeof selic !== "number" || !(selic > 0 && selic <= 1)) return null;
    if (typeof usdBrl !== "number" || !(usdBrl > 0 && usdBrl <= 1000)) return null;
    if (!isDate(selicDate) || !isDate(usdBrlDate)) return null;
    if (typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return null;
    return { selic, selicDate, usdBrl, usdBrlDate, fetchedAt };
}

/**
 * Downloads the Selic target and the dollar quote.
 *
 * @param fetcher - The `fetch` function; replaced in tests.
 * @param now - The current time in Unix milliseconds.
 * @returns The latest figures.
 * @throws MarketError when a request fails or a response is not a plausible reading.
 */
export async function fetchRates(fetcher: typeof fetch = fetch, now: number = Date.now()): Promise<MarketRates> {
    const [selicJson, usdJson] = await Promise.all([getJson(selicUrl(now), fetcher), getJson(usdUrl(now), fetcher)]);
    const today = localDate(now);
    const selic = latestUntil(selicJson, today);
    const usd = latestUntil(usdJson, today);
    if (!selic || !usd) throw new MarketError("BAD_RESPONSE", "No recent observation");
    const rates = sanitizeRates({
        selic: selic.value / 100,
        selicDate: selic.date,
        usdBrl: usd.value,
        usdBrlDate: usd.date,
        fetchedAt: now,
    });
    if (!rates) throw new MarketError("BAD_RESPONSE", "Implausible values");
    return rates;
}

/**
 * Tells whether downloaded rates are recent enough to use without fetching again.
 *
 * @param rates - The rates.
 * @param now - The current time in Unix milliseconds.
 * @returns `true` when they were downloaded less than {@link MARKET_TTL_MS} ago.
 */
export function isFresh(rates: MarketRates, now: number = Date.now()): boolean {
    return now - rates.fetchedAt >= 0 && now - rates.fetchedAt < MARKET_TTL_MS;
}

/**
 * Reads the rates from the last download.
 *
 * @returns The stored rates, or `null` when none exist or storage is unavailable.
 */
export async function loadRates(): Promise<MarketRates | null> {
    try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        return sanitizeRates(stored[STORAGE_KEY]);
    } catch {
        return null;
    }
}

/**
 * Stores the rates so they are available when the popup opens offline.
 *
 * @param rates - The rates to keep.
 */
export async function saveRates(rates: MarketRates): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: rates });
}

/** Deletes the stored rates. */
export async function clearRates(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
}

/**
 * Checks whether the optional host permission is currently granted.
 *
 * @returns `true` when the extension may contact the Central Bank API.
 */
export async function hasMarketPermission(): Promise<boolean> {
    try {
        return await chrome.permissions.contains(MARKET_PERMISSIONS);
    } catch {
        return false;
    }
}
