// generate.js — Run: node generate.js
// Creates the full project folder and compresses it into malka-express.zip
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createZip(files, outPath) {
  const fileEntries = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const header = Buffer.alloc(30);

    header.writeUInt32LE(0x04034b50, 0); // signature
    header.writeUInt16LE(20, 4); // min version
    header.writeUInt16LE(0, 6); // flags
    header.writeUInt16LE(0, 8); // compression: 0 (store)
    header.writeUInt16LE(0, 10); // time
    header.writeUInt16LE(0, 12); // date
    
    // CRC32
    let crc = ~0;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
    }
    crc = (~crc) >>> 0;

    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18); // compressed size
    header.writeUInt32LE(data.length, 22); // uncompressed size
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28); // extra field length

    fileEntries.push({ nameBuf, data, header, offset, crc });
    offset += header.length + nameBuf.length + data.length;
  }

  const centralDirParts = [];
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // central dir signature
    cdh.writeUInt16LE(20, 4); // made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0, 8); // flags
    cdh.writeUInt16LE(0, 10); // compression
    cdh.writeUInt16LE(0, 12); // time
    cdh.writeUInt16LE(0, 14); // date
    cdh.writeUInt32LE(entry.crc, 16);
    cdh.writeUInt32LE(entry.data.length, 20);
    cdh.writeUInt32LE(entry.data.length, 24);
    cdh.writeUInt16LE(entry.nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra length
    cdh.writeUInt16LE(0, 32); // comment length
    cdh.writeUInt16LE(0, 34); // disk number
    cdh.writeUInt16LE(0, 36); // internal attr
    cdh.writeUInt32LE(0, 38); // external attr
    cdh.writeUInt32LE(entry.offset, 42); // local header offset

    centralDirParts.push(cdh, entry.nameBuf);
    centralDirSize += 46 + entry.nameBuf.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(fileEntries.length, 8);
  eocd.writeUInt16LE(fileEntries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const out = [];
  for (const e of fileEntries) {
    out.push(e.header, e.nameBuf, e.data);
  }
  out.push(...centralDirParts, eocd);
  fs.writeFileSync(outPath, Buffer.concat(out));
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c >>> 0;
}

console.log('Building files...');
