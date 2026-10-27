import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

function createPng(width, height, isMaskable = false) {
  // RGBA buffer: width * 4 per row + 1 filter byte per scanline
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Dark slate background
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      // Outer margin for maskable icon vs standard
      const pad = isMaskable ? width * 0.15 : width * 0.08;

      // Sheet area
      if (x >= pad && x <= width - pad && y >= pad && y <= height - pad) {
        // Document page
        r = 30;
        g = 41;
        b = 59;

        // Accent header strip
        if (y >= pad + 15 && y <= pad + 45) {
          r = 56;
          g = 189;
          b = 248;
        }

        // Form field box 1
        if (y >= height * 0.38 && y <= height * 0.46 && x >= width * 0.25 && x <= width * 0.75) {
          r = 2;
          g = 132;
          b = 199;
        }

        // Form field box 2
        if (y >= height * 0.50 && y <= height * 0.58 && x >= width * 0.25 && x <= width * 0.60) {
          r = 16;
          g = 185;
          b = 129;
        }

        // Badge banner
        if (y >= height * 0.65 && y <= height * 0.78 && x >= width * 0.20 && x <= width * 0.80) {
          r = 56;
          g = 189;
          b = 248;
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // Compression deflate
  ihdrData[11] = 0; // Filter default
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', deflated);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(32, 32, false));

console.log('Generated PNG icons successfully');
