// Generates the .icns. macOS shows this in every notification, so it can't be
// the Electron atom. Drawn in code because a checked-in binary nobody can edit
// is worse than 40 lines of pixel math.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(head));
  return Buffer.concat([len, head, crc]);
};

function png(size, mono) {
  const S = 4; // supersample; nothing here is curved enough to need more
  const R = size * 0.22; // corner radius, matching the macOS squircle closely enough
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let inside = 0;
      let dot = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S;
          const py = y + (sy + 0.5) / S;
          // rounded square
          const dx = Math.max(R - px, px - (size - R), 0);
          const dy = Math.max(R - py, py - (size - R), 0);
          if (dx * dx + dy * dy <= R * R) inside++;
          // three dots = "you have messages"
          for (const cx of [0.3, 0.5, 0.7]) {
            const ddx = px - size * cx;
            const ddy = py - size * 0.5;
            if (ddx * ddx + ddy * ddy <= (size * 0.075) ** 2) dot++;
          }
        }
      }
      const n = S * S;
      const a = inside / n;
      const d = dot / n;
      const o = 1 + x * 4;
      if (mono) {
        // template image for the menu bar: solid black, macOS does the tinting.
        // Punch the dots out as holes instead of coloring them — a filled
        // squircle reads as a blob at 16px, the notches make it legible.
        row[o] = row[o + 1] = row[o + 2] = 0;
        row[o + 3] = Math.round(a * (1 - d) * 255);
      } else {
        // blue plate, white dots composited over it
        row[o] = Math.round(0x0b + (0xff - 0x0b) * d);
        row[o + 1] = Math.round(0x63 + (0xff - 0x63) * d);
        row[o + 2] = Math.round(0xce + (0xff - 0xce) * d);
        row[o + 3] = Math.round(a * 255);
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Menu bar template icon: 16pt/32pt (@2x), black-on-transparent so macOS
// tints it to match light/dark menu bars automatically.
const trayPng = (scale = 1) => png(16 * scale, true);

// iconutil wants exactly these names.
const VARIANTS = [16, 32, 128, 256, 512].flatMap((s) => [
  [`icon_${s}x${s}.png`, s],
  [`icon_${s}x${s}@2x.png`, s * 2],
]);

function buildIcns(outFile) {
  const set = `${outFile}.iconset`;
  fs.rmSync(set, { recursive: true, force: true });
  fs.mkdirSync(set, { recursive: true });
  for (const [name, size] of VARIANTS) fs.writeFileSync(path.join(set, name), png(size));
  execFileSync('iconutil', ['-c', 'icns', set, '-o', outFile]);
  fs.rmSync(set, { recursive: true, force: true });
  return outFile;
}
module.exports = buildIcns;
module.exports.trayPng = trayPng;

if (require.main === module) {
  // self-check: the PNGs must be real PNGs and iconutil must accept them
  const out = buildIcns(path.join(require('os').tmpdir(), 'ofa-icon-check.icns'));
  const head = fs.readFileSync(out).subarray(0, 4).toString();
  if (head !== 'icns') throw new Error(`not an icns: ${head}`);
  console.log('ok', out, fs.statSync(out).size, 'bytes');
}
