/**
 * 生成 PWA 图标（无第三方依赖，直接写 PNG）
 * 运行：npm run icons  →  owner/public/icons/{icon-192,icon-512,icon-maskable-512}.png
 * 设计：品牌橙渐变底 + 两条白色斜杠（“双味”抽象）
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};

/** rgb: Buffer, length = w*h*3 */
const encodePng = (w, h, rgb) => {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/* ---------- 绘制 ---------- */
const TOP = [0xfb, 0x92, 0x3c];
const BOT = [0xea, 0x58, 0x0c];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 旋转圆角矩形的有向距离（归一化坐标，负值=内部） */
const sdRoundBox = (x, y, hw, hh, r, ang) => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const px = x * c + y * s;
  const py = -x * s + y * c;
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
};

const ANG = -0.21; // ≈ -12°
const BAR_HW = 0.26;
const BAR_HH = 0.045;
const BAR_DY = 0.08;

const markDistance = (u, v, scale) => {
  const x = u - 0.5;
  const y = v - 0.5;
  const d1 = sdRoundBox(x, y + BAR_DY * scale, BAR_HW * scale, BAR_HH * scale, BAR_HH * scale, ANG);
  const d2 = sdRoundBox(x, y - BAR_DY * scale, BAR_HW * scale, BAR_HH * scale, BAR_HH * scale, ANG);
  return Math.min(d1, d2);
};

/** @returns {Buffer} RGB */
const render = (size, scale) => {
  const SS = 4;
  const out = Buffer.alloc(size * size * 3);
  const edge = 1.2 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          const t = clamp01(u * 0.55 + v * 0.45);
          let br = TOP[0] + (BOT[0] - TOP[0]) * t;
          let bg = TOP[1] + (BOT[1] - TOP[1]) * t;
          let bb = TOP[2] + (BOT[2] - TOP[2]) * t;
          const d = markDistance(u, v, scale);
          const a = clamp01(0.5 - d / edge);
          if (a > 0) {
            br = br + (255 - br) * a;
            bg = bg + (255 - bg) * a;
            bb = bb + (255 - bb) * a;
          }
          r += br;
          g += bg;
          b += bb;
        }
      }
      const n = SS * SS;
      const o = (py * size + px) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return out;
};

const writeIcon = (name, size, scale) => {
  const png = encodePng(size, size, render(size, scale));
  writeFileSync(join(OUT, name), png);
  console.log(`✓ ${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)}KB`);
};

mkdirSync(OUT, { recursive: true });
writeIcon("icon-192.png", 192, 1);
writeIcon("icon-512.png", 512, 1);
writeIcon("icon-maskable-512.png", 512, 0.72);

/* ---------- SVG（favicon / manifest any） ---------- */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="双味居">
  <defs>
    <linearGradient id="sw" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fb923c"/>
      <stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#sw)"/>
  <g transform="rotate(-12 256 256)" fill="#ffffff">
    <rect x="123" y="193" width="266" height="46" rx="23"/>
    <rect x="123" y="273" width="266" height="46" rx="23"/>
  </g>
</svg>
`;
writeFileSync(join(OUT, "icon.svg"), svg, "utf8");
console.log("✓ icon.svg");
