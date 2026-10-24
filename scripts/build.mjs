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
 * JSON, including the manifest and the translations) with `minify.mjs`.
 * `--watch` produces a readable development build with inline source maps and
 * rebuilds the JavaScript on change.
 */
import { build, context } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { listFiles } from "./files.mjs";
import { minifyCss, minifyHtml, minifyJson, stripTranslatorNotes } from "./minify.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const publicDir = path.join(root, "public");
const watch = process.argv.includes("--watch");
const minify = !watch;

const buildOptions = {
    entryPoints: {
        popup: path.join(root, "src/popup/popup.ts"),
    },
    outdir: dist,
    bundle: true,
    format: "iife",
    target: "chrome116",
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
    if (file.startsWith("_locales/") && file.endsWith(".json")) {
        return minifyJson(JSON.stringify(stripTranslatorNotes(JSON.parse(content.toString("utf8")))));
    }
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

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyStatic();

if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes. Reload the extension in chrome://extensions after rebuilds.");
} else {
    await build(buildOptions);
    console.log(`Extension built in ${path.relative(process.cwd(), dist) || "."}`);
}
