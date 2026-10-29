# Localization

Valora is translated into the same 31 languages as Padlock. This page records the decisions behind the
translations, so that later edits stay consistent. How the translations are stored and loaded is described in
the README ([Localization](../README.md#localization)).

## Principles

1. **Translate the meaning, not the words.** The calculators are textbook finance, so every language uses the
   term a local accountant or banker would use (_taux directeur_, _Leitzins_, _ключевая ставка_), not a literal
   rendering of the English.
2. **Adapt the Brazilian market data to the reader.** The Selic rate and the dollar quote come from the Central
   Bank of Brazil, but a reader in India or Germany thinks in terms of their own central bank. Wherever the
   English says _policy rate_, each language uses the policy-rate term of its main market and mentions Selic
   only where the number itself is meant (the field that is filled from the Central Bank of Brazil, the
   indicator in the market status line, the rules of the calculators).
3. **Keep the proper names that have no equivalent.** _Selic_, _CDB_, _LCI_, _LCA_, _IOF_, _poupança_,
   _SAC_ and _Price_ are Brazilian products, taxes or amortization systems. They are kept in Latin letters and
   explained in the same sentence, for instance _Savings account (poupança)_ or _IOF (Brazilian exchange tax)_.
4. **Keep formulas and acronyms in Latin letters.** `ROI`, `CAGR`, `NPV`, `IRR`, `WACC`, `EBITDA`, `CCC` and the
   symbols `× ÷ − Σ` are the same everywhere. Only the words around them are translated. Languages that write
   a decimal comma use it in the constants of the formulas (`0,5`).
5. **Respect the Web Store limits.** The name stays below 45 characters, the description below 132, and the
   product name is always the Latin word _Valora_. `tests/i18n.test.ts` enforces this.

## The policy rate in each language

| Language              | Term used            | Main market it refers to                                 |
| --------------------- | -------------------- | -------------------------------------------------------- |
| English               | policy rate (Selic)  | any central bank; Selic named for the Brazilian rate     |
| Portuguese (Brazil)   | taxa Selic           | Brazil                                                   |
| Spanish               | tasa de política     | Latin America and Spain                                  |
| French                | taux directeur       | ECB                                                      |
| German                | Leitzins             | ECB                                                      |
| Italian               | tasso di riferimento | ECB                                                      |
| Polish                | stopa referencyjna   | National Bank of Poland                                  |
| Russian               | ключевая ставка      | Bank of Russia                                           |
| Ukrainian             | облікова ставка      | National Bank of Ukraine                                 |
| Turkish               | politika faizi       | Central Bank of Turkey                                   |
| Japanese              | 政策金利             | Bank of Japan                                            |
| Korean                | 기준금리             | Bank of Korea                                            |
| Chinese (Simplified)  | 政策利率             | People's Bank of China                                   |
| Chinese (Traditional) | 政策利率             | Central Bank of the Republic of China (Taiwan)           |
| Vietnamese            | lãi suất điều hành   | State Bank of Vietnam                                    |
| Indonesian            | suku bunga acuan     | Bank Indonesia                                           |
| Javanese              | bunga acuan          | Bank Indonesia                                           |
| Hindi                 | रेपो दर              | Reserve Bank of India (repo rate)                        |
| Bhojpuri              | रेपो दर              | Reserve Bank of India (repo rate)                        |
| Marathi               | रेपो दर              | Reserve Bank of India (repo rate)                        |
| Gujarati              | રેપો દર              | Reserve Bank of India (repo rate)                        |
| Kannada               | ರೆಪೊ ದರ              | Reserve Bank of India (repo rate)                        |
| Malayalam             | റിപ്പോ നിരക്ക്       | Reserve Bank of India (repo rate)                        |
| Tamil                 | ரெப்போ விகிதம்       | Reserve Bank of India (repo rate)                        |
| Telugu                | రెపో రేటు            | Reserve Bank of India (repo rate)                        |
| Punjabi               | ਰੇਪੋ ਦਰ              | Reserve Bank of India (repo rate)                        |
| Bengali               | রেপো হার             | Bangladesh Bank (repo rate); the Indian term is the same |
| Urdu                  | پالیسی شرحِ سود      | State Bank of Pakistan (policy rate)                     |
| Arabic                | سعر الفائدة الرئيسي  | generic: every Arab central bank names its own rate      |
| Persian               | نرخ بهرهٔ سیاستی     | generic policy rate                                      |
| Hausa                 | Ƙimar manufofi (MPR) | Central Bank of Nigeria (Monetary Policy Rate)           |

Where the table says _generic_, the countries that speak the language have different official rates, so the
translation uses the general term rather than favouring one of them.

## Other adaptations

- **Savings and fixed-income products.** The Brazilian savings account (_poupança_) is described as a savings
  account in each language, and the _CDB_ and _Tesouro_ tax table is called a _regressive tax table_ (a
  table whose rate falls as the holding period grows). _LCI_ and _LCA_ are explained as tax-exempt.
- **Currency and rates.** The dollar quote is always labelled _R$ per US$_ and keeps the Brazilian real symbol,
  because the Central Bank of Brazil publishes it in that form. The currency chosen in the settings is only used
  for amounts the user types and for results that are not fixed to the real.
- **Business-day count.** The 252 business days of the Brazilian year are written as a number, not translated.
- **Accounting terms.** Fleuriet's model keeps the abbreviations of the Brazilian literature (`CDG`, `NCG`, `T`),
  which are explained in the field names.
- **Numbers.** Results always use Latin digits so they match the formulas and can be read back by the
  parser. Decimal and thousands marks follow the language (`1.234,56` in Portuguese, `1,234.56` in English).
  The parser also accepts Arabic-Indic, Persian, Devanagari, Bengali and the other native digits when the user
  types them, Indian grouping (`12,34,567`), Arabic decimal and thousands marks, and ignores invisible
  direction marks.
- **Right-to-left languages.** Arabic, Persian and Urdu set `dir="rtl"` on the page and mirror the layout.
  Inputs, formulas and result values stay left-to-right, and the invisible direction marks that the platform
  adds to Arabic-language numbers are removed so that a Latin currency symbol such as `R$` is not mirrored.

## Review status

The translations were prepared for this release and checked by tests (same keys and placeholders as English,
Web Store limits, not a copy of English, Brazilian proper names kept) and by a layout audit of all 31
languages at the popup's fixed width of 640 px. They have **not** been reviewed by native speakers. Native
review is most valuable for Bhojpuri, Hausa, Javanese, Punjabi and Urdu, which have the fewest reference
texts, and for the accounting vocabulary of every language.

To correct a translation, edit `src/locales/<code>.json` and keep the placeholders (`$VALUE$`, `$COUNT$`,
`$POSITION$`, `$SELIC$`, `$USD$`, `$DATE$`, `$BAD$`, `$GOOD$`) exactly as in English. Run `npm run check`.

## Store listing

The per-language Chrome Web Store listing (long description, screenshots) is not part of this repository
yet. The extension name and description of the 26 languages that Chrome supports are generated from the
catalogs into `_locales` at build time; Punjabi, Urdu, Javanese, Bhojpuri and Hausa show English in Chrome's own
screens because Chrome has no UI language for them. The extension itself is fully translated.
