/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/manifest-locales.mjs
    Description: Which translations Chrome itself reads: the manifest strings, in the languages Chrome supports.
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
 * The extension translates its own screens from `src/locales` (see `src/shared/i18n.ts`). Chrome
 * only reads the strings of the manifest (name, description, toolbar tooltip, shortcut label)
 * from `_locales/<code>/messages.json`, and only for the languages it supports. The build
 * generates exactly those files, so the package never contains a locale folder the Chrome Web
 * Store does not accept.
 */

/** Messages the manifest refers to with `__MSG_<key>__`. */
export const MANIFEST_KEYS = ["extName", "extShortName", "extDescription", "actionTitle", "commandOpen"];

/**
 * Languages with a `_locales` folder in the package: those in Chrome's list of supported
 * locales (https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
 */
export const MANIFEST_LOCALES = [
    "ar",
    "bn",
    "de",
    "en_US",
    "es",
    "fa",
    "fr",
    "gu",
    "hi",
    "id",
    "it",
    "ja",
    "kn",
    "ko",
    "ml",
    "mr",
    "pl",
    "pt_BR",
    "ru",
    "ta",
    "te",
    "tr",
    "uk",
    "vi",
    "zh_CN",
    "zh_TW",
];
