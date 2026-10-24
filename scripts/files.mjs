/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/files.mjs
    Description: File system helper shared by the build and packaging scripts.
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
import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Lists every file below a directory.
 *
 * @param dir - Directory to walk.
 * @returns Paths relative to `dir`, with forward slashes, sorted alphabetically.
 */
export async function listFiles(dir) {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
        .sort();
}
