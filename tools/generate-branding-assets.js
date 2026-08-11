#!/usr/bin/env node
/**
 * Generate SASV Workspace branding derived assets from the canonical master.
 *
 * Source (never referenced by runtime):
 *   public/shared/assets/branding/source/sasv-workspace-icon-master.png
 *
 * Outputs (runtime consumers use these only):
 *   public/shared/assets/branding/derived/*
 *
 * Processing is limited to:
 *   1) making edge-connected outside-canvas pixels transparent
 *      (preserves the approved dark-green rounded-square tile)
 *   2) deterministic content-box trim of transparent padding
 *   3) resize / ICO pack
 *
 * Do not redraw, recolour, or restyle the approved artwork.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { default: pngToIco } = require("png-to-ico");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(
  ROOT,
  "public/shared/assets/branding/source",
);
const DERIVED_DIR = path.join(
  ROOT,
  "public/shared/assets/branding/derived",
);
const MASTER_PATH = path.join(SOURCE_DIR, "sasv-workspace-icon-master.png");

/** Near-black canvas outside the rounded tile (RGB max channel threshold). */
const OUTSIDE_BLACK_MAX = 18;
/** Alpha below this is treated as empty when trimming. */
const TRIM_ALPHA_MIN = 8;

const PNG_OUTPUTS = [
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "icon-48.png", size: 48 },
  { file: "icon-72.png", size: 72 },
  { file: "icon-96.png", size: 96 },
  { file: "icon-128.png", size: 128 },
  { file: "icon-144.png", size: 144 },
  { file: "icon-152.png", size: 152 },
  { file: "apple-touch-icon-180.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-256.png", size: 256 },
  { file: "icon-384.png", size: 384 },
  { file: "icon-512.png", size: 512 },
  { file: "app-mark-512.png", size: 512 },
];

/** Multi-resolution ICO frames (largest first helps Windows shell pick). */
const ICO_SIZES = [256, 128, 64, 48, 32, 16];

function isOutsideCanvasPixel(data, channels, pixelIndex) {
  const offset = pixelIndex * channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  if (alpha === 0) return true;
  return (
    red <= OUTSIDE_BLACK_MAX &&
    green <= OUTSIDE_BLACK_MAX &&
    blue <= OUTSIDE_BLACK_MAX
  );
}

/**
 * Flood-fill from image edges: make outside-canvas (near-black) pixels
 * transparent. Leaves the dark-green tile and mark untouched.
 */
async function clearOutsideCanvas(srcPath, destPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];
  let cleared = 0;

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;
    if (!isOutsideCanvasPixel(data, channels, pixelIndex)) return;
    queue.push(pixelIndex);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length) {
    const pixelIndex = queue.pop();
    const offset = pixelIndex * channels;
    if (data[offset + 3] !== 0) {
      data[offset + 3] = 0;
      cleared += 1;
    }
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(destPath);

  return { cleared, width, height };
}

/**
 * Deterministic trim to the opaque content bounding box, then letterbox into a
 * square canvas with transparent padding. Preserves the full approved artwork
 * with no cropping or distortion.
 */
async function trimToSquareContent(srcPath, destPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha < TRIM_ALPHA_MIN) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) {
    throw new Error("No opaque content found after clearing outside canvas");
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const side = Math.max(contentW, contentH);
  const extracted = await sharp(srcPath)
    .extract({ left: minX, top: minY, width: contentW, height: contentH })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: extracted,
        left: Math.floor((side - contentW) / 2),
        top: Math.floor((side - contentH) / 2),
      },
    ])
    .png()
    .toFile(destPath);

  return {
    contentW,
    contentH,
    side,
    minX,
    minY,
    maxX,
    maxY,
    cropLeft: minX,
    cropTop: minY,
  };
}

async function writePngSize(preparedPath, size, destPath) {
  await sharp(preparedPath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(destPath);
}

async function main() {
  if (!fs.existsSync(MASTER_PATH)) {
    console.error(`Missing master icon:\n  ${MASTER_PATH}`);
    process.exit(1);
  }

  fs.mkdirSync(DERIVED_DIR, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sasv-branding-"));
  const clearedPath = path.join(tmp, "cleared.png");
  const preparedPath = path.join(tmp, "prepared.png");

  try {
    console.log("SASV Workspace branding asset generator");
    console.log(`  master: ${MASTER_PATH}`);

    const cleared = await clearOutsideCanvas(MASTER_PATH, clearedPath);
    console.log(
      `  cleared outside canvas (${cleared.cleared} pixels → transparent)`,
    );

    const trim = await trimToSquareContent(clearedPath, preparedPath);
    console.log(
      `  trimmed content ${trim.contentW}x${trim.contentH} → letterboxed square ${trim.side}x${trim.side} (full artwork, no crop)`,
    );

    for (const { file, size } of PNG_OUTPUTS) {
      const dest = path.join(DERIVED_DIR, file);
      await writePngSize(preparedPath, size, dest);
      const bytes = fs.statSync(dest).size;
      console.log(`  wrote ${file} (${size}x${size}, ${bytes} bytes)`);
    }

    const icoPngPaths = [];
    for (const size of ICO_SIZES) {
      const framePath = path.join(tmp, `ico-${size}.png`);
      await writePngSize(preparedPath, size, framePath);
      icoPngPaths.push(framePath);
    }
    const icoBuffer = await pngToIco(icoPngPaths);
    const icoPath = path.join(DERIVED_DIR, "favicon.ico");
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(
      `  wrote favicon.ico (${(icoBuffer.length / 1024).toFixed(1)} KB, frames ${ICO_SIZES.join(", ")})`,
    );

    // Reserved for future macOS/Linux packaging without tree restructure.
    const futureDir = path.join(DERIVED_DIR, "platform");
    fs.mkdirSync(futureDir, { recursive: true });
    const keep = path.join(futureDir, ".gitkeep");
    if (!fs.existsSync(keep)) {
      fs.writeFileSync(
        keep,
        "# Reserved for future macOS (.icns) / Linux packaging icons.\n",
      );
    }

    console.log(`\nDerived assets ready in:\n  ${DERIVED_DIR}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = {
  MASTER_PATH,
  DERIVED_DIR,
  PNG_OUTPUTS,
  ICO_SIZES,
  clearOutsideCanvas,
  trimToSquareContent,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
