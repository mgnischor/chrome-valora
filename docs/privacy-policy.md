# Valora Privacy Policy

**Effective date:** October 24, 2026

Valora is a Chrome extension with business calculators (ROI, liquidity ratios, break-even, NPV, IRR,
loan payments, Selic and dollar investments and more). This policy explains what the extension does
with your information.

## Summary

- Valora **does not collect, transmit, sell or share any personal data**.
- Everything happens locally in your browser. The extension has no server, no account system, no
  analytics and no tracking. **By default it makes no network requests.**
- If you turn on the optional **live rates**, it downloads two public figures (the Selic rate and the
  dollar quote) from the Central Bank of Brazil. Those requests carry no information about you. See
  [Optional network requests](#optional-network-requests).
- The figures you type are used to compute the results and are discarded when you close the popup,
  unless you leave the optional memory on, which keeps them in browser memory only.

## What Valora does

Valora shows a list of calculators. You type figures such as an amount invested, a discount rate or a
list of cash flows, and Valora computes the results on your device. You can copy the inputs and
results as text with the **Copy results** button. The Selic and dollar calculators can fill in the
current Selic rate and dollar quote for you if you allow it.

## Information we collect

None. The developer never receives any information from the extension: no figures you type, no results,
no browsing activity, no page content, no clipboard content, no device or usage data.

## Information stored on your device

| Information                                                                                                                          | Where it is stored                                                   | Purpose                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Your preferences (currency, decimal places, whether to remember what you typed, whether live rates are on, the last calculator used) | `chrome.storage.sync`                                                | Remember your settings between sessions. Contains no business data.   |
| The text you typed into each calculator, **only if "Remember what I typed" is on** (it is on by default)                             | `chrome.storage.session`: browser memory only, never written to disk | Show your figures again when you reopen the popup.                    |
| The last downloaded Selic rate and dollar quote, **only if you turn on live rates**                                                  | `chrome.storage.local`: your browser profile, on disk                | Fill in the calculators, and work offline. Public data, not personal. |

Details:

- **Preferences and Chrome Sync.** `chrome.storage.sync` is a feature of Chrome. If you are signed in to
  Chrome with sync enabled, Chrome may sync these preferences across your devices through your Google
  account. That is handled by Google under its own privacy policy; the developer has no access to it.
- **What you typed.** It is kept unencrypted in browser memory and is erased when Chrome closes.
  Turning off **Remember what I typed while the browser is open** in the settings deletes it
  immediately, and **Reset** clears the fields of the calculator you are using.
- **Figures you do not save.** With the memory off, what you type exists only while the popup is open.
- **Downloaded rates.** They are public market data and are not linked to you. Turning live rates off
  deletes them.

## Optional network requests

Live rates are **off by default**. When you turn them on (in the settings, or with the **Fetch rates**
button of a Selic or dollar calculator), Chrome asks you to allow Valora to contact `api.bcb.gov.br`,
the open-data API of the Central Bank of Brazil. Valora then makes two anonymous `GET` requests for
public time series: the Selic target rate and the commercial US dollar quote.

- The requests contain no cookies, no credentials, no figures you typed and no information about you.
  Like any web request, they reveal your IP address to the Central Bank's servers, which are operated
  by the Central Bank under its own policies, not by the developer.
- The extension's content security policy allows connections to this one host and no other.
- The downloaded figures are validated, kept for offline use, and used only to fill in fields.
- Turning live rates off removes the permission and deletes the downloaded figures. You can also
  revoke the permission at any time in `chrome://extensions`.

## Clipboard

When you press **Copy results**, Valora writes the inputs and results to your clipboard. This uses your
click and needs no special permission. Valora never reads the clipboard.

## Web page content

Valora does not read, collect or transmit the content of the pages you visit. It declares no content
scripts and requests no permission to access websites other than the optional Central Bank API above.

## Permissions

| Permission                                 | Why Valora needs it                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `storage`                                  | Save your preferences, and hold what you typed in memory while the browser is open. |
| `https://api.bcb.gov.br/*` (optional host) | Download the Selic rate and the dollar quote, only if you turn on live rates.       |

Valora requests no other permissions and declares no content scripts.

## Third parties

Valora does not use third-party services, SDKs, advertising or analytics, and it does not sell or share
data with anyone. The only external service it can contact is the open-data API of the Central Bank of
Brazil, only if you turn on live rates. Its use of information complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements.

## Not financial advice

Valora's results are mathematical estimates based on the figures you enter and on standard textbook
formulas. They do not account for taxes (except the income tax of the Selic-linked calculators, which
uses the regressive table in force when the extension was written), fees, inflation, risk or your
particular situation, and they are not financial, tax, legal or investment advice. Rates downloaded
from the Central Bank may be delayed or revised. Check important decisions with a qualified
professional.

## Security

Because the extension never sends your data off your device, there is nothing for the developer to store
or leak. You remain responsible for keeping your device and browser profile secure.

## Children's privacy

Valora is a general-purpose utility and is not directed at children. It does not knowingly collect
information from anyone.

## Changes to this policy

If the extension's data practices change (for example, if a future version stores figures on disk or
connects to another service), this policy will be updated before that version is released, and the
effective date above will change.

## Contact

Questions about this policy: Miguel Nischor, [miguel@nischor.com.br](mailto:miguel@nischor.com.br).
