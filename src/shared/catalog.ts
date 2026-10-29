/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/catalog.ts
    Description: Every translation of the extension, bundled so the language can be switched at runtime.
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
import ar from "../locales/ar.json";
import bho from "../locales/bho.json";
import bn from "../locales/bn.json";
import de from "../locales/de.json";
import en_US from "../locales/en_US.json";
import es from "../locales/es.json";
import fa from "../locales/fa.json";
import fr from "../locales/fr.json";
import gu from "../locales/gu.json";
import ha from "../locales/ha.json";
import hi from "../locales/hi.json";
import id from "../locales/id.json";
import it from "../locales/it.json";
import ja from "../locales/ja.json";
import jv from "../locales/jv.json";
import kn from "../locales/kn.json";
import ko from "../locales/ko.json";
import ml from "../locales/ml.json";
import mr from "../locales/mr.json";
import pa from "../locales/pa.json";
import pl from "../locales/pl.json";
import pt_BR from "../locales/pt_BR.json";
import ru from "../locales/ru.json";
import ta from "../locales/ta.json";
import te from "../locales/te.json";
import tr from "../locales/tr.json";
import uk from "../locales/uk.json";
import ur from "../locales/ur.json";
import vi from "../locales/vi.json";
import zh_CN from "../locales/zh_CN.json";
import zh_TW from "../locales/zh_TW.json";
import type { LocaleCode } from "./locales";

/** One message of a `<code>.json` file, in the format of Chrome's `messages.json`. */
export interface MessageEntry {
    message: string;
    description?: string;
    placeholders?: Record<string, { content: string; example?: string }>;
}

/** The messages of one language, keyed by message name. */
export type Messages = Record<keyof typeof en_US, MessageEntry>;

/**
 * All translations. Typing every file as `Messages` makes the compiler reject a language that
 * lacks a message the default language has. The build strips the translator notes (`description`,
 * placeholder `example`) while bundling.
 */
export const CATALOG: Record<LocaleCode, Messages> = {
    en_US,
    zh_CN,
    zh_TW,
    es,
    hi,
    bn,
    pt_BR,
    ru,
    ja,
    pa,
    mr,
    te,
    tr,
    ko,
    fr,
    de,
    vi,
    ta,
    ur,
    jv,
    it,
    ar,
    gu,
    fa,
    bho,
    ha,
    kn,
    id,
    pl,
    ml,
    uk,
};
