import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const palette = {
  bg: [5, 7, 5, 255],
  bgTransparent: [5, 7, 5, 0],
  amber: [214, 168, 79, 255],
  bone: [245, 230, 200, 255],
  moss: [143, 175, 138, 255],
};

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function png(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function createCanvas(size, transparent = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const bg = transparent ? palette.bgTransparent : palette.bg;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = bg[0];
    pixels[i + 1] = bg[1];
    pixels[i + 2] = bg[2];
    pixels[i + 3] = bg[3];
  }
  return { size, pixels };
}

function put(canvas, x, y, color, alpha = 1) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= canvas.size || py >= canvas.size) return;
  const idx = (py * canvas.size + px) * 4;
  const a = Math.max(0, Math.min(1, alpha)) * (color[3] / 255);
  const inv = 1 - a;
  canvas.pixels[idx] = Math.round(color[0] * a + canvas.pixels[idx] * inv);
  canvas.pixels[idx + 1] = Math.round(color[1] * a + canvas.pixels[idx + 1] * inv);
  canvas.pixels[idx + 2] = Math.round(color[2] * a + canvas.pixels[idx + 2] * inv);
  canvas.pixels[idx + 3] = Math.round(255 * a + canvas.pixels[idx + 3] * inv);
}

function brush(canvas, x, y, radius, color) {
  const minX = Math.floor(x - radius);
  const maxX = Math.ceil(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.ceil(y + radius);
  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const d = Math.hypot(px - x, py - y);
      if (d <= radius) put(canvas, px, py, color, Math.min(1, radius - d + 0.8));
    }
  }
}

function line(canvas, x1, y1, x2, y2, width, color) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    brush(canvas, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
  }
}

function circle(canvas, cx, cy, radius, width, color) {
  const steps = Math.ceil(radius * 7);
  for (let i = 0; i < steps; i += 1) {
    const a = (Math.PI * 2 * i) / steps;
    brush(canvas, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, width / 2, color);
  }
}

function drawMark(canvas, scale = 1) {
  const s = canvas.size;
  const cx = s / 2;
  const cy = s / 2;
  circle(canvas, cx, cy, s * 0.355 * scale, s * 0.055 * scale, palette.amber);
  line(canvas, s * 0.245, s * 0.59, s * 0.42, s * 0.28, s * 0.056 * scale, palette.amber);
  line(canvas, s * 0.42, s * 0.28, s * 0.58, s * 0.28, s * 0.056 * scale, palette.amber);
  line(canvas, s * 0.58, s * 0.28, s * 0.755, s * 0.59, s * 0.056 * scale, palette.amber);
  line(canvas, s * 0.31, s * 0.59, s * 0.445, s * 0.725, s * 0.052 * scale, palette.bone);
  line(canvas, s * 0.445, s * 0.725, s * 0.72, s * 0.365, s * 0.052 * scale, palette.bone);
  line(canvas, s * 0.39, s * 0.555, s * 0.71, s * 0.555, s * 0.046 * scale, palette.moss);
}

function save(path, size, transparent = false) {
  const canvas = createCanvas(size, transparent);
  drawMark(canvas, size / 1024);
  writeFileSync(path, png(size, size, canvas.pixels));
}

save('assets/images/icon.png', 1024);
save('assets/images/splash.png', 1024, true);
save('assets/images/adaptive-icon.png', 1024, true);
save('assets/images/favicon.png', 128);
