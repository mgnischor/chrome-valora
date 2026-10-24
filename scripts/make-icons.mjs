/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/make-icons.mjs
    Description: Dependency-free generator for the extension's PNG icons.
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
 * Generates the Valora PNG icons (a bar chart on a rounded square) into `./public/icons` with no external dependencies.
 * Shapes are described in unit coordinates and rasterised with 4x4 supersampling.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { crc32 } from "./crc32.mjs";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");
const SIZES = [16, 32, 48, 128];
const SAMPLES = 4;

const BACKGROUND = [11, 122, 98]; // green
const BARS = [255, 255, 255];

/** Bars of the chart as `[left, top]` in unit coordinates; all bars share the width and the baseline below. */
const BAR_TOPS = [
    [0.2, 0.58],
    [0.43, 0.43],
    [0.66, 0.26],
];
const BAR_WIDTH = 0.14;
const BAR_BASELINE = 0.78;

/**
 * Tests whether a point lies inside a rounded rectangle.
 *
 * @param x - Point x coordinate.
 * @param y - Point y coordinate.
 * @param x0 - Left edge.
 * @param y0 - Top edge.
 * @param x1 - Right edge.
 * @param y1 - Bottom edge.
 * @param r - Corner radius.
 * @returns `true` when the point is inside the shape.
 */
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * Looks up the colour at a point of the unit square.
 *
 * @param x - Point x coordinate in the unit square.
 * @param y - Point y coordinate in the unit square.
 * @returns An `[r, g, b]` triple, or `null` where the icon is transparent.
 */
function colourAt(x, y) {
    if (!inRoundedRect(x, y, 0.06, 0.06, 0.94, 0.94, 0.2)) return null;
    for (const [left, top] of BAR_TOPS) {
        if (inRoundedRect(x, y, left, top, left + BAR_WIDTH, BAR_BASELINE, 0.025)) return BARS;
    }
    return BACKGROUND;
}

/**
 * Renders the icon to raw pixels with 4x4 supersampling for smooth edges.
 *
 * @param size - Width and height of the square icon in pixels.
 * @returns RGBA pixel data, `size * size * 4` bytes, with straight (non-premultiplied) alpha.
 */
function rasterise(size) {
    const pixels = Buffer.alloc(size * size * 4);
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let r = 0;
            let g = 0;
            let b = 0;
            let covered = 0;
            for (let sy = 0; sy < SAMPLES; sy++) {
                for (let sx = 0; sx < SAMPLES; sx++) {
                    const colour = colourAt((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size);
                    if (!colour) continue;
                    r += colour[0];
                    g += colour[1];
                    b += colour[2];
                    covered++;
                }
            }
            const offset = (py * size + px) * 4;
            if (covered > 0) {
                pixels[offset] = Math.round(r / covered);
                pixels[offset + 1] = Math.round(g / covered);
                pixels[offset + 2] = Math.round(b / covered);
                pixels[offset + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
            }
        }
    }
    return pixels;
}

/**
 * Builds one PNG chunk (length, type, data and CRC).
 *
 * @param type - Four-character chunk type such as `IHDR`.
 * @param data - Chunk payload.
 * @returns The serialized chunk.
 */
function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

/**
 * Encodes RGBA pixels as a PNG file.
 *
 * @param size - Width and height of the square image in pixels.
 * @param rgba - Pixel data from {@link rasterise}.
 * @returns The complete PNG file contents.
 */
function encodePng(size, rgba) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8; // bit depth
    header[9] = 6; // RGBA
    const stride = size * 4;
    const raw = Buffer.alloc((stride + 1) * size);
    for (let y = 0; y < size; y++) {
        raw[y * (stride + 1)] = 0; // filter: none
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

await mkdir(outDir, { recursive: true });
for (const size of SIZES) {
    const file = path.join(outDir, `icon-${size}.png`);
    await writeFile(file, encodePng(size, rasterise(size)));
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
