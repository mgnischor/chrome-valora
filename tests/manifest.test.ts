/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/manifest.test.ts
    Description: Security regression tests for the extension manifest and its store documentation.
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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.json"), "utf8"));

/**
 * Reads the Chrome Web Store answers that justify each permission.
 *
 * @returns The contents of `docs/chrome-web-store.md`.
 */
function storeDocument(): string {
    return readFileSync(path.join(ROOT, "docs", "chrome-web-store.md"), "utf8");
}

describe("manifest permissions", () => {
    it("requests exactly the permissions that are justified in the store documentation", () => {
        expect([...manifest.permissions].sort()).toEqual(["storage"]);
        expect(manifest).not.toHaveProperty("optional_permissions");
        expect(manifest.optional_host_permissions).toEqual(["https://api.bcb.gov.br/*"]);
    });

    it("documents every permission in docs/chrome-web-store.md", () => {
        const document = storeDocument();
        for (const permission of manifest.permissions) {
            expect(document, `no justification for ${permission}`).toContain(`### ${permission}`);
        }
        for (const pattern of manifest.optional_host_permissions) {
            const host = new URL(pattern.replace("/*", "")).host;
            expect(document, `no justification for ${host}`).toContain(`### ${host}`);
        }
    });

    it("asks for no site access and exposes nothing to web pages", () => {
        for (const key of [
            "host_permissions",
            "content_scripts",
            "externally_connectable",
            "web_accessible_resources",
            "devtools_page",
            "update_url",
        ]) {
            expect(manifest, `${key} must not be declared`).not.toHaveProperty(key);
        }
    });
});

describe("background code", () => {
    it("has no service worker or offscreen document, because nothing needs to run while the popup is closed", () => {
        expect(manifest).not.toHaveProperty("background");
        expect(manifest.permissions).not.toContain("offscreen");
        expect(manifest.permissions).not.toContain("alarms");
    });
});

describe("content security policy", () => {
    const policy: string = manifest.content_security_policy.extension_pages;
    const directives = new Map(
        policy.split(";").map((part) => {
            const [name, ...sources] = part.trim().split(/\s+/);
            return [name!, sources] as const;
        })
    );

    it("only runs scripts packaged with the extension", () => {
        expect(directives.get("script-src")).toEqual(["'self'"]);
        expect(policy).not.toMatch(/unsafe-(inline|eval)|\*/);
        expect(directives.get("script-src")?.join(" ")).not.toMatch(/https?:/);
    });

    it("blocks plugins, base URL changes and form posts", () => {
        expect(directives.get("object-src")).toEqual(["'none'"]);
        expect(directives.get("base-uri")).toEqual(["'none'"]);
        expect(directives.get("form-action")).toEqual(["'none'"]);
    });

    it("allows network requests to the Central Bank API and nowhere else", () => {
        expect(directives.get("connect-src")).toEqual(["https://api.bcb.gov.br"]);
    });

    it("grants the optional host permission only to the origin that the policy allows", () => {
        const [origin] = directives.get("connect-src")!;
        expect(manifest.optional_host_permissions).toEqual([`${origin}/*`]);
    });
});
