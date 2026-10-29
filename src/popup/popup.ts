/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/popup/popup.ts
    Description: Popup user interface for the Valora Chrome extension.
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
import { CALCULATORS, GROUPS, getCalculator, isCalculatorId } from "../core/calculators";
import { evaluate, readField, readInputs, type FieldError } from "../core/inputs";
import type { DecimalSeparator } from "../core/parse";
import type { Calculator, FieldSpec, Rating, Result, Values } from "../core/types";
import { clearDraft, loadDraft, saveDraft, type Draft } from "../shared/draft";
import {
    NO_CURRENCY,
    buildReport,
    currencySymbol,
    decimalSeparator,
    formatInputValue,
    formatValue,
    type FormatOptions,
    type ReportRow,
} from "../shared/format";
import {
    applyTranslations,
    browserLanguage,
    languageTag,
    setLanguage,
    t,
    textDirection,
    type MessageKey,
} from "../shared/i18n";
import { LOCALES } from "../shared/locales";
import {
    MARKET_PERMISSIONS,
    clearRates,
    fetchRates,
    hasMarketPermission,
    isFresh,
    loadRates,
    saveRates,
    type MarketRates,
} from "../shared/market";
import {
    calculatorDescriptionKey,
    calculatorFormulaKey,
    calculatorNameKey,
    categoryKey,
    choiceKey,
    fieldKey,
    groupKey,
    outputKey,
} from "../shared/labels";
import {
    CURRENCIES,
    DECIMAL_CHOICES,
    loadSettings,
    sanitizeSettings,
    saveSettings,
    type Settings,
} from "../shared/settings";

/** Delay before persisting, so typing does not hammer the storage. */
const SAVE_DEBOUNCE_MS = 250;

/** How long a confirmation stays on the status line. */
const STATUS_MS = 3000;

/** A drop-down whose longest option has more characters than this is shown at the full width of the form. */
const WIDE_OPTION_LENGTH = 16;

/** A form control created for a field. */
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Finds an element by id.
 *
 * @typeParam T - Expected element type.
 * @param id - Value of the element's `id` attribute.
 * @returns The element.
 * @throws Error when the page has no element with that id.
 */
function el<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing element #${id}`);
    return node as T;
}

const ui = {
    mainView: el<HTMLElement>("main-view"),
    settingsView: el<HTMLElement>("settings-view"),
    settingsOpen: el<HTMLButtonElement>("settings-open"),
    settingsBack: el<HTMLButtonElement>("settings-back"),
    calculator: el<HTMLSelectElement>("calculator"),
    example: el<HTMLButtonElement>("example"),
    reset: el<HTMLButtonElement>("reset"),
    description: el<HTMLElement>("description"),
    fields: el<HTMLElement>("fields"),
    market: el<HTMLElement>("market"),
    marketText: el<HTMLElement>("market-text"),
    marketAction: el<HTMLButtonElement>("market-action"),
    resultsEmpty: el<HTMLElement>("results-empty"),
    resultsBody: el<HTMLElement>("results-body"),
    headlineLabel: el<HTMLElement>("headline-label"),
    headlineValue: el<HTMLOutputElement>("headline-value"),
    resultList: el<HTMLElement>("result-list"),
    formula: el<HTMLElement>("formula"),
    copy: el<HTMLButtonElement>("copy"),
    status: el<HTMLElement>("status"),
    language: el<HTMLSelectElement>("language"),
    currency: el<HTMLSelectElement>("currency"),
    decimals: el<HTMLSelectElement>("decimals"),
    rememberInputs: el<HTMLInputElement>("remember-inputs"),
    liveRates: el<HTMLInputElement>("live-rates"),
    settingsStatus: el<HTMLElement>("settings-status"),
};

/** BCP 47 tag of the active language, for number and date formats. Set by {@link refreshLanguage}. */
let language = "en-US";
/** Decimal mark of the active language. */
let decimal: DecimalSeparator = ".";

let settings: Settings;
let calculator: Calculator;
/** What is typed in every calculator. It is the source of truth; the controls only display it. */
let draft: Draft = {};
/** The controls of the calculator on screen, by field id. */
const controls = new Map<string, Control>();
/** The error line under each control, by field id. */
const errorLines = new Map<string, HTMLElement>();
/** Fields the user has left, so errors are not shown on fields they have not finished with. */
const reported = new Set<string>();
/** The results on screen; `null` while the form is incomplete or invalid. */
let current: Result[] | null = null;
/** The Selic rate and dollar quote from the Central Bank; `null` until live rates are on and downloaded. */
let rates: MarketRates | null = null;
/** Whether the last attempt to download the rates failed. */
let ratesFailed = false;
/** Whether a download is in progress. */
let ratesLoading = false;
let saveTimer: number | undefined;
let statusTimer: number | undefined;

/** How to display numbers, derived from the settings. */
function formatOptions(): FormatOptions {
    return { locale: language, currency: settings.currency, decimals: settings.decimals };
}

/**
 * Shows a message on the status line of the visible view.
 *
 * @param text - Localized message; an empty string clears the line.
 * @param isError - Whether to style the message as an error.
 */
function setStatus(text: string, isError = false): void {
    window.clearTimeout(statusTimer);
    const target = ui.settingsView.hidden ? ui.status : ui.settingsStatus;
    target.textContent = text;
    target.classList.toggle("error", isError);
    if (text !== "" && !isError) {
        statusTimer = window.setTimeout(() => {
            target.textContent = "";
        }, STATUS_MS);
    }
}

/** The text of every control of the calculator on screen, by field id. */
function currentTexts(): Record<string, string> {
    return Object.fromEntries([...controls].map(([id, control]) => [id, control.value]));
}

/**
 * Formats a field's starting value (its default or its example) as input text.
 *
 * @param value - The value in stored units.
 * @param field - The field.
 * @returns Text the parser reads back to the same value.
 */
function textOf(value: number | readonly number[], field: FieldSpec): string {
    return formatInputValue(value, field.kind, language);
}

/**
 * Text a field has when nothing was typed: its default, the first choice of a drop-down, or nothing.
 *
 * @param field - The field.
 * @returns The default text; empty when the field starts blank.
 */
function defaultText(field: FieldSpec): string {
    if (field.kind === "choice") return textOf(field.choices?.[0] ?? 0, field);
    return field.default === undefined ? "" : textOf(field.default, field);
}

/**
 * Text of a field that can be filled in from the market data.
 *
 * @param field - The field.
 * @returns The current Selic rate or dollar quote as input text, or `undefined` when the field has no market source or no rates are loaded.
 */
function marketText(field: FieldSpec): string | undefined {
    if (!field.source || !rates) return undefined;
    return field.source === "selic"
        ? formatInputValue(rates.selic, "percent", language)
        : formatInputValue(rates.usdBrl, "number", language);
}

/**
 * Describes a rejected field in the user's language.
 *
 * @param field - The field.
 * @param error - Why it was rejected.
 * @returns A localized message.
 */
function describeError(field: FieldSpec, error: FieldError): string {
    const bound = error.bound ?? 0;
    const shown =
        field.kind === "currency"
            ? formatValue(bound, "currency", formatOptions(), field.currency)
            : `${textOf(bound, field)}${field.kind === "percent" ? "%" : ""}`;
    switch (error.code) {
        case "REQUIRED":
            return "";
        case "NOT_A_NUMBER":
            return t("errorNotNumber");
        case "NOT_AN_INTEGER":
            return t("errorNotInteger");
        case "BELOW_MIN":
            return t(error.exclusive === true ? "errorMinExclusive" : "errorMin", shown);
        case "ABOVE_MAX":
            return t("errorMax", shown);
        case "NOT_ALLOWED":
            return t("errorNotAllowed");
        case "TOO_FEW_ENTRIES":
            return t("errorTooFewEntries", String(bound));
        case "TOO_MANY_ENTRIES":
            return t("errorTooManyEntries", String(bound));
        case "INVALID_ENTRY":
            return t("errorInvalidEntry", String(bound));
    }
}

/**
 * Creates the control for a field.
 *
 * @param field - The field.
 * @param describedBy - Id of the element holding the field's error message.
 * @returns A drop-down for a choice, a text area for a list, otherwise a text input.
 */
function createControl(field: FieldSpec, describedBy: string): Control {
    const id = `field-${field.id}`;
    let control: Control;

    if (field.kind === "choice") {
        const select = document.createElement("select");
        for (const choice of field.choices ?? []) {
            const option = document.createElement("option");
            option.value = textOf(choice, field);
            option.textContent = t(choiceKey(calculator.id, field.id, choice));
            select.append(option);
        }
        control = select;
    } else if (field.kind === "series") {
        const area = document.createElement("textarea");
        area.rows = 4;
        area.placeholder = textOf(field.example, field);
        control = area;
    } else {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = field.kind === "integer" ? "numeric" : "decimal";
        input.placeholder = textOf(field.example, field);
        control = input;
    }

    control.id = id;
    control.name = field.id;
    control.setAttribute("aria-describedby", describedBy);
    if (!(control instanceof HTMLSelectElement)) {
        control.setAttribute("autocomplete", "off");
        control.spellcheck = false;
    }
    control.value = draft[calculator.id]?.[field.id] ?? marketText(field) ?? defaultText(field);
    // A remembered value that is no longer one of the choices would leave the drop-down blank.
    if (control instanceof HTMLSelectElement && control.selectedIndex === -1) control.selectedIndex = 0;
    return control;
}

/**
 * Builds the row of one field: label, control with its currency or percent sign, and the error line.
 *
 * @param field - The field.
 * @returns The element to add to the form.
 */
function createField(field: FieldSpec): HTMLElement {
    const wrapper = document.createElement("div");

    const errorId = `error-${field.id}`;
    const control = createControl(field, errorId);
    // Lists need the room for several lines, and drop-downs with long options would be cut off at half width.
    const longOptions =
        control instanceof HTMLSelectElement &&
        [...control.options].some((option) => (option.textContent ?? "").length > WIDE_OPTION_LENGTH);
    wrapper.className = field.kind === "series" || longOptions ? "field wide" : "field";
    const label = document.createElement("label");
    label.htmlFor = control.id;
    label.textContent = t(fieldKey(calculator.id, field.id));

    const row = document.createElement("div");
    row.className = "input-wrap";
    const prefix = field.kind === "currency" ? currencySymbol(language, field.currency ?? settings.currency) : "";
    if (prefix !== "") row.append(affix(prefix));
    row.append(control);
    if (field.kind === "percent") row.append(affix("%"));

    const error = document.createElement("p");
    error.id = errorId;
    error.className = "field-error";

    controls.set(field.id, control);
    errorLines.set(field.id, error);
    control.addEventListener("input", () => onFieldInput(field, control));
    control.addEventListener("change", () => onFieldInput(field, control));
    control.addEventListener("blur", () => {
        reported.add(field.id);
        refresh();
    });

    wrapper.append(label, row);
    if (field.kind === "series") {
        const hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = t("seriesHint");
        wrapper.append(hint);
    }
    wrapper.append(error);
    return wrapper;
}

/**
 * Creates the sign shown next to a control.
 *
 * @param text - A currency symbol or `%`.
 * @returns The element.
 */
function affix(text: string): HTMLElement {
    const span = document.createElement("span");
    span.className = "affix";
    span.textContent = text;
    return span;
}

/** Rebuilds the form for the selected calculator. */
function buildForm(): void {
    controls.clear();
    errorLines.clear();
    reported.clear();
    ui.fields.replaceChildren(...calculator.fields.map(createField));
    ui.description.textContent = t(calculatorDescriptionKey(calculator.id));
    ui.formula.textContent = t(calculatorFormulaKey(calculator.id));
    renderMarket();
}

/** Fills the calculator selector, grouped by topic. */
function buildCalculatorSelect(): void {
    ui.calculator.replaceChildren(
        ...GROUPS.map((group) => {
            const optgroup = document.createElement("optgroup");
            optgroup.label = t(groupKey(group));
            for (const item of CALCULATORS.filter((candidate) => candidate.group === group)) {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = t(calculatorNameKey(item.id));
                optgroup.append(option);
            }
            return optgroup;
        })
    );
    ui.calculator.value = calculator.id;
}

/**
 * Formats one result for display.
 *
 * @param result - The result.
 * @returns The text, or the localized "not defined" text when the value is undefined.
 */
function resultText(result: Result): string {
    if (result.kind === "category" && result.value !== null) {
        return t(categoryKey(calculator.id, result.id, result.value));
    }
    return result.value === null
        ? t("resultUndefined")
        : formatValue(result.value, result.kind, formatOptions(), result.currency);
}

/** Message keys of the rating names. */
const RATING_MESSAGES = {
    good: "ratingGood",
    neutral: "ratingNeutral",
    bad: "ratingBad",
} as const satisfies Record<Rating, MessageKey>;

/**
 * Writes the rule behind a rating in words, with the limits formatted like the result.
 *
 * @param result - The rated result.
 * @returns For a band rule, the limits ("Below 1: bad · 1 to 1.5: neutral · Above 1.5: good"); for a category rule,
 * the names of the categories grouped by rating; otherwise an empty string.
 */
function ratingRule(result: Result): string {
    const options = formatOptions();
    if (result.bands) {
        const { direction, bad, good } = result.bands;
        const show = (limit: number) => formatValue(limit, result.kind, options, result.currency);
        if (bad === good) {
            return t(direction === "higher" ? "ratingRuleSplitHigher" : "ratingRuleSplitLower", show(bad));
        }
        return t(direction === "higher" ? "ratingRuleHigher" : "ratingRuleLower", [show(bad), show(good)]);
    }
    const rule = calculator.outputs.find((output) => output.id === result.id)?.rating;
    if (!rule || !("byCategory" in rule)) return "";
    return (["good", "neutral", "bad"] as const)
        .map((level) => {
            const names = Object.entries(rule.byCategory)
                .filter(([, rated]) => rated === level)
                .map(([category]) => t(categoryKey(calculator.id, result.id, Number(category))));
            return names.length === 0 ? "" : `${t(RATING_MESSAGES[level])}: ${names.join(", ")}`;
        })
        .filter((part) => part !== "")
        .join(" \u00b7 ");
}

/**
 * Builds the legend shown when the pointer rests on a rated result: how it reads, the rule, and what the colours mean.
 *
 * @param result - The rated result.
 * @param level - How the result reads.
 * @returns A multi-line text for the `title` attribute.
 */
function ratingTooltip(result: Result, level: Rating): string {
    return [t(RATING_MESSAGES[level]), ratingRule(result), t("ratingLegend"), t("ratingDisclaimer")]
        .filter((line) => line !== "")
        .join("\n");
}

/**
 * Shows a result value, flagging undefined values and colouring rated indicators: red is bad, green is good and the
 * normal text colour is neutral. Hovering a rated value explains the colours.
 *
 * @param node - Element that displays the value.
 * @param result - The result.
 */
function showValue(node: HTMLElement, result: Result): void {
    const text = resultText(result);
    node.textContent = text;
    // A figure keeps its own left-to-right order inside a right-to-left page; a translated name follows its own script.
    node.dir = "auto";
    node.classList.toggle("undefined", result.value === null);
    node.classList.toggle("text", result.kind === "category");
    node.removeAttribute("title");
    node.removeAttribute("aria-label");

    if (result.value === null) {
        node.removeAttribute("data-rating");
        node.title = t("resultUndefinedHint");
    } else if (result.ratingLevel !== null) {
        node.dataset.rating = result.ratingLevel;
        node.title = ratingTooltip(result, result.ratingLevel);
        node.setAttribute("aria-label", `${text}: ${t(RATING_MESSAGES[result.ratingLevel])}`);
    } else {
        node.removeAttribute("data-rating");
    }
}

/**
 * Displays the results, or the empty state when there are none.
 *
 * @param values - The validated inputs, or `null` when the form is incomplete or invalid.
 */
function renderResults(values: Values | null): void {
    current = values === null ? null : evaluate(calculator, values);
    ui.resultsEmpty.hidden = current !== null;
    ui.resultsBody.hidden = current === null;
    ui.copy.disabled = current === null;
    if (current === null) return;

    const [headline, ...rest] = current;
    if (headline) {
        ui.headlineLabel.textContent = t(outputKey(calculator.id, headline.id));
        showValue(ui.headlineValue, headline);
    }
    ui.resultList.replaceChildren(
        ...rest.flatMap((result) => {
            const term = document.createElement("dt");
            term.textContent = t(outputKey(calculator.id, result.id));
            const value = document.createElement("dd");
            showValue(value, result);
            return [term, value];
        })
    );
}

/** Validates the form, shows the errors of the fields the user has left, and updates the results. */
function refresh(): void {
    const reading = readInputs(calculator, currentTexts(), decimal);
    for (const field of calculator.fields) {
        const error = reading.errors[field.id];
        const message = error && reported.has(field.id) ? describeError(field, error) : "";
        const line = errorLines.get(field.id);
        const control = controls.get(field.id);
        if (line) line.textContent = message;
        if (control) {
            if (message === "") control.removeAttribute("aria-invalid");
            else control.setAttribute("aria-invalid", "true");
        }
    }
    renderResults(reading.values);
}

/**
 * Records what was typed in a field and recalculates.
 *
 * @param field - The field that changed.
 * @param control - Its control.
 */
function onFieldInput(field: FieldSpec, control: Control): void {
    draft[calculator.id] = { ...draft[calculator.id], [field.id]: control.value };
    refresh();
    scheduleSave();
}

/** Persists the settings, and the draft when the user allows it. */
async function persist(): Promise<void> {
    try {
        await saveSettings(settings);
        if (settings.rememberInputs) await saveDraft(draft);
    } catch {
        setStatus(t("statusSaveFailed"), true);
    }
}

/** Persists shortly after the last change. */
function scheduleSave(): void {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
}

/**
 * Fills every field of the calculator on screen.
 *
 * @param pick - Chooses the text of a field; an empty string leaves it blank.
 */
function fillForm(pick: (field: FieldSpec) => string): void {
    draft[calculator.id] = Object.fromEntries(calculator.fields.map((field) => [field.id, pick(field)]));
    buildForm();
    refresh();
    scheduleSave();
}

/**
 * Switches to another calculator.
 *
 * @param id - Calculator id.
 */
function selectCalculator(id: string): void {
    if (!isCalculatorId(id)) return;
    calculator = getCalculator(id);
    settings = { ...settings, lastCalculator: id };
    buildForm();
    refresh();
    setStatus("");
    scheduleSave();
}

/** Copies the inputs and results of the calculator on screen as plain text. */
async function copyResults(): Promise<void> {
    if (current === null) return;
    const texts = currentTexts();
    const inputs: ReportRow[] = calculator.fields.map((field) => {
        const label = t(fieldKey(calculator.id, field.id));
        const control = controls.get(field.id);
        const text = (texts[field.id] ?? "")
            .trim()
            .split(/\s*[\r\n]+\s*/)
            .join("; ");
        if (control instanceof HTMLSelectElement) return [label, control.selectedOptions[0]?.textContent ?? text];
        if (field.kind === "percent") return [label, `${text}%`];
        const symbol = field.kind === "currency" ? currencySymbol(language, field.currency ?? settings.currency) : "";
        return [label, `${symbol}${text}`];
    });
    const results: ReportRow[] = current.map((result) => [t(outputKey(calculator.id, result.id)), resultText(result)]);
    try {
        await navigator.clipboard.writeText(buildReport(t(calculatorNameKey(calculator.id)), inputs, results));
        setStatus(t("statusCopied"));
    } catch {
        setStatus(t("statusCopyFailed"), true);
    }
}

/**
 * Switches between the calculator and the settings.
 *
 * @param visible - `true` to show the settings, `false` to return to the calculator.
 */
function showSettings(visible: boolean): void {
    ui.mainView.hidden = visible;
    ui.settingsView.hidden = !visible;
    ui.settingsOpen.hidden = visible;
    setStatus("");
    if (!visible) {
        // The currency and the number of decimals may have changed.
        draft[calculator.id] = currentTexts();
        buildForm();
        refresh();
    }
}

/**
 * Formats a `YYYY-MM-DD` date for the user's language.
 *
 * @param iso - The date.
 * @returns A short date such as `23/10/2026`.
 */
function formatDay(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, day).toLocaleDateString(language, { dateStyle: "short", numberingSystem: "latn" });
}

/** Shows or hides the market bar and describes the state of the rates. */
function renderMarket(): void {
    const usesMarket = calculator.fields.some((field) => field.source !== undefined);
    ui.market.hidden = !usesMarket;
    if (!usesMarket) return;

    ui.marketAction.disabled = ratesLoading;
    ui.marketText.classList.toggle("error", ratesFailed && rates === null);
    if (!settings.liveRates) {
        ui.marketText.textContent = t("marketOff");
        ui.marketAction.textContent = t("marketEnable");
    } else if (ratesLoading) {
        ui.marketText.textContent = t("marketLoading");
        ui.marketAction.textContent = t("marketUse");
    } else if (rates === null) {
        ui.marketText.textContent = t(ratesFailed ? "marketFailed" : "marketLoading");
        ui.marketAction.textContent = t("marketRetry");
    } else {
        const options = formatOptions();
        ui.marketText.textContent = t("marketRates", [
            formatValue(rates.selic, "percent", options),
            formatValue(rates.usdBrl, "exchangeRate", options, "BRL"),
            formatDay(rates.usdBrlDate),
        ]);
        ui.marketAction.textContent = t(ratesFailed ? "marketRetry" : "marketUse");
    }
}

/**
 * Puts the market figures into the fields that can use them.
 *
 * @param overwrite - `true` replaces what is in the fields; `false` only fills empty ones.
 */
function applyMarket(overwrite: boolean): void {
    for (const field of calculator.fields) {
        const control = controls.get(field.id);
        const text = marketText(field);
        if (!control || text === undefined || (!overwrite && control.value !== "")) continue;
        control.value = text;
        draft[calculator.id] = { ...draft[calculator.id], [field.id]: text };
    }
    refresh();
    scheduleSave();
}

/** Downloads the rates, keeps them for offline use and fills the empty fields that use them. */
async function refreshRates(): Promise<void> {
    ratesLoading = true;
    ratesFailed = false;
    renderMarket();
    try {
        rates = await fetchRates();
        await saveRates(rates).catch(() => undefined);
        applyMarket(false);
    } catch {
        ratesFailed = true;
    }
    ratesLoading = false;
    renderMarket();
}

/**
 * Turns on live rates: asks for the permission to contact the Central Bank, then downloads the rates.
 * Must run directly from a click, because Chrome only shows the permission prompt for a user gesture.
 */
async function enableLiveRates(): Promise<void> {
    const granted = await chrome.permissions.request(MARKET_PERMISSIONS).catch(() => false);
    if (!granted) {
        settings = { ...settings, liveRates: false };
        ui.liveRates.checked = false;
        renderMarket();
        setStatus(t("statusMarketPermissionDenied"), true);
        return;
    }
    settings = { ...settings, liveRates: true };
    ui.liveRates.checked = true;
    scheduleSave();
    await refreshRates();
}

/** Turns off live rates and removes the permission and the downloaded figures. */
async function disableLiveRates(): Promise<void> {
    settings = { ...settings, liveRates: false };
    rates = null;
    ratesFailed = false;
    scheduleSave();
    await chrome.permissions.remove(MARKET_PERMISSIONS).catch(() => false);
    await clearRates().catch(() => undefined);
    renderMarket();
}

/** Handles the button of the market bar: turn live rates on, retry, or put the rates in the fields. */
async function onMarketAction(): Promise<void> {
    if (!settings.liveRates) {
        await enableLiveRates();
    } else if (rates === null || ratesFailed || !isFresh(rates)) {
        await refreshRates();
        if (rates !== null) applyMarket(true);
    } else {
        applyMarket(true);
    }
}

/** Loads the downloaded rates and refreshes them when they are old, if live rates are on and still permitted. */
async function initMarket(): Promise<void> {
    if (!settings.liveRates) return;
    if (!(await hasMarketPermission())) {
        // The permission was revoked in chrome://extensions.
        settings = { ...settings, liveRates: false };
        ui.liveRates.checked = false;
        scheduleSave();
        renderMarket();
        return;
    }
    rates = await loadRates();
    if (rates !== null) applyMarket(false);
    renderMarket();
    if (rates === null || !isFresh(rates)) await refreshRates();
}

/** Reads the settings controls and applies them. */
async function onSettingsChanged(): Promise<void> {
    const wasRemembering = settings.rememberInputs;
    settings = sanitizeSettings(
        {
            ...settings,
            currency: ui.currency.value,
            decimals: Number(ui.decimals.value),
            rememberInputs: ui.rememberInputs.checked,
        },
        browserLanguage()
    );
    scheduleSave();
    if (wasRemembering && !settings.rememberInputs) {
        window.clearTimeout(saveTimer);
        await saveSettings(settings).catch(() => setStatus(t("statusSaveFailed"), true));
        await clearDraft().catch(() => undefined);
    }
}

/** Fills the language selector with "automatic" and every supported language, each named in its own language. */
function populateLanguages(): void {
    const automatic = document.createElement("option");
    automatic.value = "auto";
    automatic.textContent = t("languageAuto");
    ui.language.replaceChildren(
        automatic,
        ...LOCALES.map((locale) => {
            const option = document.createElement("option");
            option.value = locale.code;
            option.textContent = locale.name;
            option.lang = locale.tag;
            return option;
        })
    );
    ui.language.value = settings.language;
}

/**
 * Rewrites what the user typed in every calculator in the number format of a new language, so that a value typed as
 * `1.234,5` in Portuguese is still 1,234.5 after switching to English instead of being read as 1.2345.
 *
 * @param from - Decimal mark of the language the texts were typed in.
 */
function reformatDraft(from: DecimalSeparator): void {
    for (const [id, texts] of Object.entries(draft)) {
        const typed = CALCULATORS.find((candidate) => candidate.id === id);
        if (!typed) continue;
        for (const field of typed.fields) {
            const text = texts[field.id];
            if (text === undefined || text.trim() === "") continue;
            const reading = readField(field, text, from);
            if (reading.ok) texts[field.id] = formatInputValue(reading.value, field.kind, language);
        }
    }
}

/**
 * Switches the whole interface to the language in the settings: the page's language and reading direction, every
 * translated text, the number format of the fields and the texts that are built in code.
 */
function refreshLanguage(): void {
    const firstTime = controls.size === 0;
    if (!firstTime) draft[calculator.id] = currentTexts();
    const previousDecimal = decimal;

    setLanguage(settings.language, browserLanguage());
    language = languageTag();
    decimal = decimalSeparator(language);
    document.documentElement.lang = language;
    document.documentElement.dir = textDirection();
    applyTranslations(document);
    if (!firstTime && previousDecimal !== decimal) reformatDraft(previousDecimal);

    renderSettings();
    buildCalculatorSelect();
    buildForm();
    refresh();
}

/** Applies the language selector: every text of the popup switches immediately. */
function onLanguageChanged(): void {
    settings = sanitizeSettings({ ...settings, language: ui.language.value }, browserLanguage());
    refreshLanguage();
    scheduleSave();
}

/** Fills the currency and decimals selectors and shows the current settings. */
function renderSettings(): void {
    let names: Intl.DisplayNames | undefined;
    try {
        names = new Intl.DisplayNames(language, { type: "currency" });
    } catch {
        names = undefined;
    }
    const options = [{ value: NO_CURRENCY, text: t("currencyNone") }].concat(
        CURRENCIES.map((code) => ({ value: code as string, text: `${code} – ${names?.of(code) ?? code}` }))
    );
    ui.currency.replaceChildren(
        ...options.map(({ value, text }) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = text;
            return option;
        })
    );
    ui.decimals.replaceChildren(
        ...DECIMAL_CHOICES.map((count) => {
            const option = document.createElement("option");
            option.value = String(count);
            option.textContent = String(count);
            return option;
        })
    );
    populateLanguages();
    ui.currency.value = settings.currency;
    ui.decimals.value = String(settings.decimals);
    ui.rememberInputs.checked = settings.rememberInputs;
    ui.liveRates.checked = settings.liveRates;
}

/** Attaches every event listener of the popup. */
function bindEvents(): void {
    ui.calculator.addEventListener("change", () => selectCalculator(ui.calculator.value));
    ui.example.addEventListener("click", () => fillForm((field) => textOf(field.example, field)));
    ui.reset.addEventListener("click", () => fillForm(defaultText));
    ui.copy.addEventListener("click", () => void copyResults());
    ui.settingsOpen.addEventListener("click", () => showSettings(true));
    ui.settingsBack.addEventListener("click", () => showSettings(false));
    for (const control of [ui.currency, ui.decimals, ui.rememberInputs]) {
        control.addEventListener("change", () => void onSettingsChanged());
    }
    ui.language.addEventListener("change", onLanguageChanged);
    ui.liveRates.addEventListener("change", () => void (ui.liveRates.checked ? enableLiveRates() : disableLiveRates()));
    ui.marketAction.addEventListener("click", () => void onMarketAction());
    // The popup can close before the debounce fires; write what is pending.
    window.addEventListener("pagehide", () => void persist());
}

/** Localizes the page, loads the settings and the draft, and shows the last calculator used. */
async function init(): Promise<void> {
    settings = await loadSettings(browserLanguage());
    draft = settings.rememberInputs ? await loadDraft() : {};
    calculator = getCalculator(settings.lastCalculator);

    refreshLanguage();
    bindEvents();
    controls.values().next().value?.focus();
    await initMarket();
}

void init();
