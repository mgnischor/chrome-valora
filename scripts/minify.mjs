/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/minify.mjs
    Description: Minifiers for the HTML, CSS and JSON files of the packaged extension.
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
 * Minifiers used when building the package. JavaScript is minified by esbuild
 * in `build.mjs`. The HTML minifier is deliberately conservative and has no
 * dependencies: it only removes comments and collapses whitespace, which never
 * changes how a page renders, so the extension's markup needs no special care.
 */
import { transform } from "esbuild";

/** A start tag, end tag, doctype or comment-free declaration; quoted attribute values may contain `>`. */
const TAG = /<(?:"[^"]*"|'[^']*'|[^'">])*>/g;

/** Elements whose content is whitespace-sensitive or not HTML. Kept byte for byte. */
const RAW_ELEMENT = /(<(script|style|textarea|pre)\b(?:"[^"]*"|'[^']*'|[^'">])*>)([\s\S]*?)(<\/\2\s*>)/gi;

/** Page structure tags around which whitespace is never rendered. */
const STRUCTURE_TAG = /\s*(<\/?(?:html|head|body|meta|link|title)\b(?:"[^"]*"|'[^']*'|[^'">])*>)\s*/gi;

/** Marks where a preserved raw element was lifted out of the markup. */
const PLACEHOLDER = "\u0000";

/**
 * Minifies a tag by collapsing the whitespace between its attributes. Quoted
 * attribute values are left untouched.
 *
 * @param tag - A complete tag such as `<input id="a"   type="text" />`.
 * @returns The tag with single spaces between attributes and no space before `>` or `/>`.
 */
function minifyTag(tag) {
    return tag.replace(/("[^"]*"|'[^']*')|\s+/g, (match, quoted) => quoted ?? " ").replace(/\s+(\/?>)$/, "$1");
}

/**
 * Minifies an HTML document: removes comments (including the license header)
 * and collapses runs of whitespace to a single space. The contents of
 * `<script>`, `<style>`, `<textarea>` and `<pre>` are preserved exactly.
 *
 * @param html - The HTML source.
 * @returns The minified HTML.
 */
export function minifyHtml(html) {
    const raw = [];
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
    const lifted = withoutComments.replace(RAW_ELEMENT, (_match, open, _name, content, close) => {
        raw.push(open + content + close);
        return `${PLACEHOLDER}${raw.length - 1}${PLACEHOLDER}`;
    });

    let output = "";
    let last = 0;
    for (const match of lifted.matchAll(TAG)) {
        output += lifted.slice(last, match.index).replace(/\s+/g, " ") + minifyTag(match[0]);
        last = match.index + match[0].length;
    }
    output += lifted.slice(last).replace(/\s+/g, " ");

    return output
        .replace(STRUCTURE_TAG, "$1")
        .replace(new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, "g"), (_match, index) => raw[Number(index)])
        .trim();
}

/**
 * Minifies a stylesheet with esbuild. Comments (including the license header) are removed.
 *
 * @param css - The CSS source.
 * @returns The minified CSS.
 */
export async function minifyCss(css) {
    const result = await transform(css, { loader: "css", minify: true, legalComments: "none", target: "chrome116" });
    return result.code.trim();
}

/**
 * Re-serializes JSON without any insignificant whitespace.
 *
 * @param text - JSON source.
 * @returns Compact JSON.
 */
export function minifyJson(text) {
    return JSON.stringify(JSON.parse(text));
}

/**
 * Removes the notes that only help translators (`description` of each message
 * and `example` of each placeholder) from a Chrome `messages.json` object.
 * Chrome ignores them at runtime, so the package does not need to ship them.
 *
 * @param messages - Parsed `messages.json`.
 * @returns A copy of the messages without translator notes.
 */
export function stripTranslatorNotes(messages) {
    return Object.fromEntries(
        Object.entries(messages).map(([key, entry]) => {
            const { description: _description, placeholders, ...rest } = entry;
            if (!placeholders) return [key, rest];
            const cleaned = Object.fromEntries(
                Object.entries(placeholders).map(([name, { example: _example, ...placeholder }]) => [name, placeholder])
            );
            return [key, { ...rest, placeholders: cleaned }];
        })
    );
}
