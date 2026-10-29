/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/build.mjs
    Description: Build script that bundles the extension into the dist folder.
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
 * Builds the extension into `./dist`.
 *
 * The default (production) build is what gets packaged and minifies everything:
 * JavaScript with esbuild, and the static files from `./public` (HTML, CSS and
 * the manifest) with `minify.mjs`. The translations from `./src/locales` are
 * bundled into the JavaScript, and the few strings Chrome reads itself are
 * written to `_locales`. `--watch` produces a readable development build with
 * inline source maps and rebuilds the JavaScript on change.
 */
import { build, context } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { listFiles } from "./files.mjs";
import { MANIFEST_KEYS, MANIFEST_LOCALES } from "./manifest-locales.mjs";
import { minifyCss, minifyHtml, stripTranslatorNotes } from "./minify.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const publicDir = path.join(root, "public");
const watch = process.argv.includes("--watch");
const minify = !watch;

/**
 * esbuild plugin that drops the translator-only notes (`description`, placeholder `example`)
 * from the translation files while they are bundled into the JavaScript.
 */
const stripNotes = {
    name: "strip-translator-notes",
    setup(build) {
        build.onLoad({ filter: /[\\/]src[\\/]locales[\\/][^\\/]+\.json$/ }, async (args) => ({
            contents: JSON.stringify(stripTranslatorNotes(JSON.parse(await readFile(args.path, "utf8")))),
            loader: "json",
        }));
    },
};

const buildOptions = {
    entryPoints: {
        popup: path.join(root, "src/popup/popup.ts"),
    },
    outdir: dist,
    bundle: true,
    format: "iife",
    target: "chrome116",
    // Keep non-Latin text as UTF-8 instead of \uXXXX escapes, which would triple its size.
    charset: "utf8",
    plugins: [stripNotes],
    minify,
    sourcemap: minify ? false : "inline",
    legalComments: "none",
    logLevel: "info",
};

/**
 * Prepares one static file for the package.
 *
 * @param file - Path of the file inside `public`, with forward slashes.
 * @param content - The file's bytes.
 * @param version - Version from `package.json`, stamped into the manifest.
 * @returns The bytes to write to `dist`.
 */
async function prepareStatic(file, content, version) {
    if (file === "manifest.json") {
        const manifest = JSON.parse(content.toString("utf8"));
        manifest.version = version;
        return minify ? JSON.stringify(manifest) : JSON.stringify(manifest, null, 2) + "\n";
    }
    if (!minify) return content;
    if (file.endsWith(".html")) return minifyHtml(content.toString("utf8"));
    if (file.endsWith(".css")) return minifyCss(content.toString("utf8"));
    return content;
}

/** Copies the static files into `dist`, minifying them in a production build and stamping the manifest version. */
async function copyStatic() {
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    for (const file of await listFiles(publicDir)) {
        const target = path.join(dist, file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, await prepareStatic(file, await readFile(path.join(publicDir, file)), pkg.version));
    }
}

/**
 * Writes the `_locales` folders Chrome reads for the manifest strings: only the manifest's
 * messages, only for the languages Chrome supports.
 */
async function writeManifestLocales() {
    for (const code of MANIFEST_LOCALES) {
        const messages = JSON.parse(await readFile(path.join(root, "src", "locales", `${code}.json`), "utf8"));
        const manifestMessages = Object.fromEntries(
            MANIFEST_KEYS.map((key) => {
                if (!messages[key]) throw new Error(`src/locales/${code}.json has no "${key}" message`);
                return [key, messages[key]];
            })
        );
        const body = stripTranslatorNotes(manifestMessages);
        const target = path.join(dist, "_locales", code, "messages.json");
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, minify ? JSON.stringify(body) : JSON.stringify(body, null, 2) + "\n");
    }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyStatic();
await writeManifestLocales();

if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes. Reload the extension in chrome://extensions after rebuilds.");
} else {
    await build(buildOptions);
    console.log(`Extension built in ${path.relative(process.cwd(), dist) || "."}`);
}
