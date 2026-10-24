# Valora – Business Calculator

**English** · [Português (Brasil)](README.pt-BR.md) · [Español](README.es-ES.md)

A Chrome (Manifest V3) extension, written in TypeScript, with business calculators for return on
investment, margins and pricing, liquidity, leverage, investment appraisal and financing. Everything is
computed on your device.

## Features

- **16 calculators in five groups**, each with its formula shown under the results:

    | Group                   | Calculators                                                                             |
    | ----------------------- | --------------------------------------------------------------------------------------- |
    | Returns                 | ROI · CAGR · ROE & ROA (with the equity multiplier)                                     |
    | Profitability & pricing | Margin & markup · Price for a target margin · Break-even point                          |
    | Liquidity & solvency    | Current / quick / cash ratios and working capital · Cash conversion cycle · Leverage    |
    | Investment & financing  | NPV, IRR, profitability index and (discounted) payback · Future value · Loan payment    |
    | Selic & dollar          | Selic-linked fixed income · Savings account vs Selic · Buying dollars · Dollar vs Selic |

- **Numbers the way you type them** – `1,234.56`, `1.234,56`, `1 234,56`, `R$ 1.500`, `12,5%` and
  `(300)` for −300 are all understood, and ambiguous cases such as `1.234` are resolved by your browser's
  language (`src/core/parse.ts`).
- **Selic and dollar rates from the Central Bank of Brazil** (optional, off by default) – turn on _live
  rates_ and the Selic and dollar fields of the market calculators fill themselves in. Chrome asks you
  to allow one host, `api.bcb.gov.br`, and the extension then reads two public time series. See
  [Live rates](#live-rates).
- **Honest results** – anything that cannot be computed (a zero divisor, an IRR that does not exist, a
  payback that is never reached) is shown as _Not defined_ instead of `NaN`, `Infinity` or a made-up
  number. Fields that are used as divisors reject zero up front.
- **Exact conventions** – ROI, margin and markup are different things and are labelled as such;
  percentages are typed as percentages and stored as fractions; the break-even point rounds up to whole
  units without floating-point noise.
- **Display options** – 16 currencies (or none), 0–4 decimal places for percentages and ratios, and a
  currency symbol that follows your locale.
- **Copy results** – copies the calculator's name, your inputs and the results as plain text.
- **Example / Reset** – fill a calculator with sample figures to see how it works, or clear it.
- **Remembers what you typed** (optional, on by default) – kept in browser memory only and erased when
  Chrome closes. See [Privacy](#privacy).
- **Roomy popup** that uses the full 640 × 400 px an extension popup can have.
- **Localized** in English (US), Brazilian Portuguese, Spanish, French, German, Italian, Russian and Polish.
  The extension follows the browser's UI
  language automatically; any other language falls back to English. See [Localization](#localization).
- **Light / dark theme**, keyboard accessible, no analytics, and no network access unless you turn on
  live rates.
- Open the popup with `Ctrl+Shift+K` (`Command+Shift+K` on macOS); rebind it at
  `chrome://extensions/shortcuts`.

## Install (from source)

Requires Node.js 20.12 or newer.

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the
`dist/` folder.

## Development

| Command             | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `npm run build`     | Production build into `dist/`: JS, HTML, CSS and JSON minified |
| `npm run package`   | Build, verify and zip into `release/valora-<version>.zip`      |
| `npm run watch`     | Rebuild on change (unminified, inline source maps)             |
| `npm run typecheck` | Run `tsc --noEmit` in strict mode                              |
| `npm test`          | Run the unit tests (Vitest)                                    |
| `npm run icons`     | Regenerate `public/icons/*.png` (dependency-free generator)    |
| `npm run check`     | Typecheck, test and build                                      |

After a rebuild, press the reload button on the extension's card in `chrome://extensions`.

### Project layout

```
public/                 Static files copied to dist/ (manifest, HTML, CSS, icons)
public/_locales/        Translations: en_US (default), pt_BR, es, fr, de, it, ru and pl
scripts/                Build tooling: build, package, minify, zip and icon generator
src/core/               Pure, DOM-free logic: parser, finance math, Brazilian rules, calculators, validation
src/shared/             Settings, draft, formatting, i18n helpers, optional Central Bank client
src/popup/              Popup UI
docs/                   Chrome Web Store answers and the privacy policy
tests/                  Vitest unit tests for core/, shared/, the locales, the manifest and the build
```

## Design notes

### A calculator is data plus one function

Each entry of `src/core/calculators.ts` declares its input fields (kind, limits, default, example), its
outputs (kind) and a pure `calculate` function. The popup builds the form, the validation messages, the
results and the copy-to-clipboard text from that description, so the UI has no per-calculator code.
`readInputs` validates the typed text field by field; `evaluate` runs the calculator and maps every
output that is not a finite number to `null`.

### The core knows nothing about languages or display

The calculators return numbers and a _kind_ (`currency`, `percent`, `ratio`, `multiple`, `number`,
`days`); validation reports error _codes_. Labels, units, locale-specific number formats and error
messages are produced by `src/shared/` and the popup.

### Rates are fractions

`12.5 %` is typed by the user and stored as `0.125`. All the maths in `src/core/finance.ts` uses
fractions per period, so the same functions serve a yearly CAGR and a monthly loan.

### IRR

The IRR is the rate where the NPV is zero. It has no closed form, and cash flows that change sign more
than once can have several answers. `internalRateOfReturn` scans the growth factor `1 + r` on a
logarithmic grid (from about −99.9 % to +109 500 %), refines every sign change by bisection, and returns
the root closest to zero. It returns `null` when the cash flows never change sign, instead of
diverging like a plain Newton iteration would.

### Payback

The (discounted) payback interpolates linearly inside the period in which the cumulative cash flow turns
non-negative, for example 2.5 periods when half of the third period's cash flow is needed. It is `null`
when the investment is not recovered within the cash flows given.

### Number parsing

When both `.` and `,` appear, the last one is the decimal mark. When only one kind appears more than
once it is a thousands separator. When it appears once, it is the decimal mark unless it is the
_other_ locale's separator followed by exactly three digits and a leading group of one to three digits
(so `1.234` is 1,234 in Brazil and 1.234 in the United States, while `1.5` is 1.5 everywhere). Lists of
cash flows are separated by new lines or semicolons, never by commas, which are decimal marks in many
locales.

### Live rates

`src/shared/market.ts` is the only code that touches the network. It runs only after the user turns on
**live rates** and Chrome grants the optional host permission for `https://api.bcb.gov.br/*`.

- **What is requested:** two anonymous `GET`s of public time series from the Central Bank's SGS API: the
  Selic target (series 432, % per year) and the commercial US dollar quote, selling (series 1, R$ per
  US$), each for the last 30 days. No cookies, no credentials, nothing about the user.
- **Future-dated values:** the Selic series is published with dates ahead of time (the target decided at
  a Copom meeting applies from a later date). The requests end today, and `latestUntil` also ignores
  anything dated after today, then takes the newest remaining observation.
- **Validation:** a response is accepted only if it is a list of well-formed observations and the values
  are plausible (a Selic above 0 % and up to 100 %, a dollar above 0 and up to 1,000). Anything else is
  discarded and shown as a failure, never used.
- **Cache:** the last good download is kept in `chrome.storage.local` for 15 minutes, and for offline use.
- **Filling fields:** a field marked with a `source` in `src/core/calculators.ts` (`selic` or `usdBrl`)
  is filled in when it is empty. The **Use rates** button overwrites the fields. Fields the user has
  typed in are never changed behind their back.
- **Turning it off** removes the permission and deletes the downloaded figures. If the permission is
  revoked in `chrome://extensions`, the setting switches itself off the next time the popup opens.

### The Selic and dollar calculators

They follow Brazilian conventions, simplified for planning (`src/core/brazil.ts`):

- Rates are annual, on a 252 business-day basis, and a product paying "110 % of the Selic" pays 110 % of
  the _daily_ rate, which is not 110 % of the annual rate. A month is 21 business days.
- Income tax follows the regressive table: 22.5 % up to 180 days, 20 % up to 360, 17.5 % up to 720 and
  15 % beyond, with an average month of 365 ÷ 12 days (so six months is 183 days, in the 20 % bracket).
  Products such as LCI and LCA are exempt.
- The savings account pays 0.5 % a month while the Selic target is above 8.5 % a year, and 70 % of the
  Selic otherwise (Law 12,703/2012). The Transfer Rate (TR) is taken as zero.
- _Dollar vs Selic_ compares both sides before taxes, and finds the dollar quote at which holding dollars
  ties with the Selic. It assumes the dollar investment yields the rate you enter, in dollars.
- _Buying dollars_ puts the bank's spread on the exchange rate and the IOF on top of the operation, so
  the dollars received are `reais ÷ (rate × (1 + spread) × (1 + IOF))`.

The rates and rules change over time: the tax table, the savings rule and the IOF rates are the user's to
check. The IOF and the spread are inputs, not defaults.

### Permissions

| Permission                                   | Why                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `storage`                                    | Remember your display options, and hold what you typed in memory only        |
| `https://api.bcb.gov.br/*` _(optional host)_ | Download the Selic rate and the dollar quote, only if you turn on live rates |

No required host permissions, no content scripts and no service worker. The extension has nothing to do
while the popup is closed. `tests/manifest.test.ts` fails if a permission is added without a matching
justification in `docs/chrome-web-store.md`, and checks that the content security policy allows
connections to that one origin and no other. `npm run package` also fails if the bundled code mentions
any web address outside the origins the manifest allows.

### Privacy

The figures you type are used to compute the results and are discarded when the popup closes, unless you
leave **Remember what I typed while the browser is open** on. In that case they live in
`chrome.storage.session`: browser memory only, never written to disk, erased when Chrome closes, and
deleted immediately when you turn the option off. Only your display options (currency, decimals, last
calculator, whether live rates are on) are persisted, through `chrome.storage.sync`, so they follow
your Chrome profile. The extension makes no network requests unless you turn on live rates, and those
requests carry nothing about you. See [`docs/privacy-policy.md`](docs/privacy-policy.md).

### Not financial advice

The results are mathematical estimates from textbook formulas. Apart from the income tax of the
Selic-linked calculators, they ignore taxes, fees, inflation and risk, and downloaded rates can be delayed
or revised. Check important decisions with a qualified professional.

### Localization

The extension uses Chrome's built-in `chrome.i18n` system, so the language always follows the browser's
UI language and needs no setting. Chrome picks the best match: an exact locale such as `pt_BR`, then the
base language such as `es`, then the default locale `en_US`.

- **Messages** live in `public/_locales/<locale>/messages.json`. The manifest (name, description,
  toolbar tooltip, shortcut description) uses `__MSG_<key>__` references.
- **Static popup text** is localized at startup by `applyTranslations` in `src/shared/i18n.ts`, through
  `data-i18n` attributes in the HTML. Messages built in code use `t("key", substitutions)`, and message
  keys are type-checked against `en_US/messages.json`.
- **Calculator texts follow a naming convention**, built in `src/shared/labels.ts`: `calc_<id>_name`,
  `calc_<id>_desc`, `calc_<id>_formula`, `field_<id>_<field>`, `out_<id>_<output>`,
  `choice_<id>_<field>_<value>` and `group_<group>`. The compiler cannot check these keys, so
  `tests/i18n.test.ts` verifies that every calculator, field, output and choice has a message in every
  locale, and that no message is unused.
- **Numbers and currencies** are formatted with `Intl.NumberFormat` in the browser's UI language.
- **Adding a language:** copy `public/_locales/en_US` to a new folder named after the locale (for
  example `fr` or `de`), translate every `message`, and keep the `placeholders` blocks unchanged. Then
  add the folder name to `EXPECTED_LOCALES` in `tests/i18n.test.ts`.
- **Testing a language:** start Chrome with `--lang=pt-BR` (or change the language in
  `chrome://settings/languages` and restart Chrome), then reload the extension.

### Adding a calculator

1. Add an entry to `src/core/calculators.ts` (fields, outputs, `calculate`) and to the `CALCULATORS`
   list. Reuse the functions of `src/core/finance.ts` where you can, and add known-answer tests to
   `tests/calculators.test.ts`.
2. Add its messages to every locale, following the naming convention above (`npm test` lists what is
   missing).
3. Run `npm run check`.

## License

Apache License 2.0. See [`LICENSE.md`](LICENSE.md).
