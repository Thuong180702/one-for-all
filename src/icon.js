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
  const S = 4; // supersample
  const R = size * 0.22;
  const Rout = size * 0.42;
  const Rin = size * 0.25;
  const cx = size / 2;
  const cy = size / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let inside = 0;
      let dot = 0;
      let insideRing = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S;
          const py = y + (sy + 0.5) / S;
          if (mono) {
            const distSq = (px - cx) ** 2 + (py - cy) ** 2;
            if (distSq <= Rout ** 2 && distSq >= Rin ** 2) insideRing++;
          } else {
            const dx = Math.max(R - px, px - (size - R), 0);
            const dy = Math.max(R - py, py - (size - R), 0);
            if (dx * dx + dy * dy <= R * R) inside++;
            for (const cxx of [0.3, 0.5, 0.7]) {
              const ddx = px - size * cxx;
              const ddy = py - size * 0.5;
              if (ddx * ddx + ddy * ddy <= (size * 0.075) ** 2) dot++;
            }
          }
        }
      }
      const n = S * S;
      const o = 1 + x * 4;
      if (mono) {
        // template image for the menu bar: solid black circle ring, macOS does the tinting.
        const ringAlpha = insideRing / n;
        row[o] = row[o + 1] = row[o + 2] = 0;
        row[o + 3] = Math.round(ringAlpha * 255);
      } else {
        const a = inside / n;
        const d = dot / n;
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

const LOGO = path.join(__dirname, 'Logo.png');

function buildIcns(outFile) {
  const set = `${outFile}.iconset`;
  fs.rmSync(set, { recursive: true, force: true });
  fs.mkdirSync(set, { recursive: true });

  const hasLogo = fs.existsSync(LOGO);
  for (const [name, size] of VARIANTS) {
    const target = path.join(set, name);
    if (hasLogo) {
      try {
        execFileSync('sips', ['-z', String(size), String(size), LOGO, '--out', target], { stdio: 'ignore' });
      } catch {
        fs.writeFileSync(target, png(size));
      }
    } else {
      fs.writeFileSync(target, png(size));
    }
  }
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
