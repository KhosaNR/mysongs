/**
 * Generates the optimized My Songs brand-logo assets from the raw source image.
 *
 * The source artwork (`raw_files/Music logo.png`, 1719×1599 RGBA) is a black
 * logo mark with green accents on a transparent background. This script emits
 * the ready-to-ship assets into `public/` (served from the site root):
 *
 * - `brand-logo.png`         Content-sized PNG (largest dimension 512, no
 *                            padding) — original colors, used on the light
 *                            theme.
 * - `brand-logo-light.png`   Content-sized PNG (largest dimension 512, no
 *                            padding) — recolored variant for the dark and
 *                            high-contrast themes: dark neutral pixels become
 *                            white and dark green accents are brightened so the
 *                            mark stays legible on the pure-black surfaces.
 * - `favicon-32x32.png`      Original colors, 32×32 (transparent-padded square).
 * - `apple-touch-icon.png`   Original colors centered on a white 180×180 canvas
 *                            (iOS expects a fully opaque icon).
 *
 * Recolor rule (HSL, per pixel, alpha preserved):
 * - Neutral pixels (saturation < 0.12) with lightness < 0.5 → white.
 * - Colored pixels with lightness < 0.55 → same hue/saturation, lightness 0.55.
 * - Bright pixels and transparency are preserved unchanged.
 *
 * @runbook
 *   npm i -D sharp              # dev-only dependency, required to re-run this generator
 *   npx tsx scripts/optimize-logo.ts
 */

import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAW_SOURCE = resolve('raw_files/Music logo.png');
const OUT_DIR = resolve('public');

const BRAND_SIZE = 512;
const FAVICON_SIZE = 32;
const APPLE_TOUCH_SIZE = 180;
const APPLE_TOUCH_MARGIN = 20;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Converts an 8-bit RGB triplet to HSL (h in [0,1), s and l in [0,1]). */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, l];

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / delta + 2) / 6;
  } else {
    h = ((rn - gn) / delta + 4) / 6;
  }
  return [h, s, l];
}

/** Converts an HSL triplet back to an 8-bit RGB triplet. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}

/**
 * Trims transparent margins and resizes the artwork so its largest dimension
 * equals `maxSize` (Lanczos3). The output keeps the artwork's native aspect
 * ratio with no added padding.
 */
async function fitToSize(input: string | Buffer, maxSize: number): Promise<Buffer> {
  const trimmed = await sharp(input).trim().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w === 0 || h === 0) {
    throw new Error(`Failed to read trimmed dimensions for ${input}`);
  }

  const scale = Math.min(maxSize / w, maxSize / h);
  const rw = Math.max(1, Math.round(w * scale));
  const rh = Math.max(1, Math.round(h * scale));

  console.log(`  trimmed bounds: ${w}×${h} → resized ${rw}×${rh}`);

  return sharp(trimmed)
    .resize(rw, rh, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Trims transparent margins, resizes the artwork to fit inside a square of the
 * given `size` (Lanczos3), then centers it on a `size`×`size` canvas filled
 * with `background`.
 */
async function fitToSquare(
  input: string | Buffer,
  size: number,
  background: { r: number; g: number; b: number; alpha: number },
): Promise<Buffer> {
  const trimmed = await sharp(input).trim().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w === 0 || h === 0) {
    throw new Error(`Failed to read trimmed dimensions for ${input}`);
  }

  const scale = Math.min(size / w, size / h);
  const rw = Math.max(1, Math.round(w * scale));
  const rh = Math.max(1, Math.round(h * scale));
  const padX = Math.floor((size - rw) / 2);
  const padY = Math.floor((size - rh) / 2);

  console.log(`  trimmed bounds: ${w}×${h} → resized ${rw}×${rh}, padded to ${size}×${size}`);

  return sharp(trimmed)
    .resize(rw, rh, { kernel: sharp.kernel.lanczos3 })
    .extend({
      top: padY,
      bottom: size - rh - padY,
      left: padX,
      right: size - rw - padX,
      background,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Produces the dark-theme variant: dark neutral pixels become white and dark
 * green accents are brightened, keeping alpha untouched.
 */
async function recolorForDarkTheme(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);

    if (s < 0.12) {
      if (l < 0.5) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    } else if (l < 0.55) {
      const [nr, ng, nb] = hslToRgb(h, s, 0.55);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main(): Promise<void> {
  if (!existsSync(RAW_SOURCE)) {
    throw new Error(`Source logo not found at ${RAW_SOURCE}`);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Optimizing My Songs brand logo...');
  console.log();

  const logo = await fitToSize(RAW_SOURCE, BRAND_SIZE);
  console.log('  recoloring dark-theme variant...');
  const logoLight = await recolorForDarkTheme(logo);

  console.log();
  const favicon = await fitToSquare(RAW_SOURCE, FAVICON_SIZE, TRANSPARENT);
  console.log();
  const appleInner = await fitToSize(RAW_SOURCE, APPLE_TOUCH_SIZE - APPLE_TOUCH_MARGIN);
  const appleTouch = await sharp({
    create: {
      width: APPLE_TOUCH_SIZE,
      height: APPLE_TOUCH_SIZE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: appleInner, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outputs: ReadonlyArray<[string, Buffer]> = [
    ['brand-logo.png', logo],
    ['brand-logo-light.png', logoLight],
    ['favicon-32x32.png', favicon],
    ['apple-touch-icon.png', appleTouch],
  ];

  console.log();
  for (const [name, buffer] of outputs) {
    const out = resolve(OUT_DIR, name);
    writeFileSync(out, buffer);
    const meta = await sharp(out).metadata();
    console.log(
      `✓ public/${name} — ${meta.width}×${meta.height}, ${Math.round(buffer.length / 1024)} KB`,
    );
  }
}

main().catch((error) => {
  console.error('Logo optimization failed:', error);
  process.exit(1);
});
