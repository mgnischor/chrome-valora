/*
    Valora Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/zip.mjs
    Description: Dependency-free, reproducible zip archive writer used to package the extension.
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
import { deflateRawSync } from "node:zlib";
import { crc32 } from "./crc32.mjs";

/** MS-DOS time of every entry: 00:00:00. A fixed value keeps the archive reproducible. */
const DOS_TIME = 0;

/** MS-DOS date of every entry: 1980-01-01, the earliest date a zip can store. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** General purpose flag: file names are UTF-8. */
const UTF8_FLAG = 0x0800;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

/**
 * Builds a zip archive in memory.
 *
 * Entries keep the order they are given in, timestamps are fixed and file
 * names use forward slashes, so the same input always produces the same bytes.
 *
 * @param entries - Files to store; `name` is the path inside the archive.
 * @returns The complete zip file.
 */
export function createZip(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const { name, data } of entries) {
        const nameBytes = Buffer.from(name, "utf8");
        const deflated = deflateRawSync(data, { level: 9 });
        const useDeflate = deflated.length < data.length;
        const body = useDeflate ? deflated : Buffer.from(data);
        const method = useDeflate ? METHOD_DEFLATE : METHOD_STORE;
        const checksum = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed to extract
        local.writeUInt16LE(UTF8_FLAG, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(0, 28); // extra field length
        chunks.push(local, nameBytes, body);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4); // version made by
        entry.writeUInt16LE(20, 6); // version needed to extract
        entry.writeUInt16LE(UTF8_FLAG, 8);
        entry.writeUInt16LE(method, 10);
        entry.writeUInt16LE(DOS_TIME, 12);
        entry.writeUInt16LE(DOS_DATE, 14);
        entry.writeUInt32LE(checksum, 16);
        entry.writeUInt32LE(body.length, 20);
        entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(nameBytes.length, 28);
        entry.writeUInt32LE(offset, 42); // offset of the local header
        central.push(entry, nameBytes);

        offset += local.length + nameBytes.length + body.length;
    }

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8); // entries on this disk
    end.writeUInt16LE(entries.length, 10); // entries in total
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...chunks, ...central, end]);
}
