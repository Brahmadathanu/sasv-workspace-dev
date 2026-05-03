// tools/gen-ico.js — generate a proper multi-size favicon.ico
const sharp = require("sharp");
const { default: pngToIco } = require("png-to-ico");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SRC = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(
      __dirname,
      "../public/shared/assets/sasv_workspace_sw_transparent_512.png",
    );
const OUT = path.resolve(__dirname, "../public/shared/assets/favicon.ico");
// Largest first: helps Windows pick a sharp bitmap for the taskbar/shell.
const SIZES = [256, 128, 64, 48, 32, 16];
const EDGE_WHITE_THRESHOLD = 245;
const EDGE_WHITE_TOLERANCE = 18;

function isEdgeConnectedWhitePixel(data, channels, pixelIndex) {
  const offset = pixelIndex * channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];

  if (alpha === 0) return false;

  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  return (
    maxChannel >= EDGE_WHITE_THRESHOLD &&
    minChannel >= EDGE_WHITE_THRESHOLD - EDGE_WHITE_TOLERANCE &&
    maxChannel - minChannel <= EDGE_WHITE_TOLERANCE
  );
}

async function preprocessIconSource(srcPath, destPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];
  let removedPixels = 0;

  function enqueueIfMatch(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;

    if (!isEdgeConnectedWhitePixel(data, channels, pixelIndex)) return;
    queue.push(pixelIndex);
  }

  for (let x = 0; x < width; x += 1) {
    enqueueIfMatch(x, 0);
    enqueueIfMatch(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueueIfMatch(0, y);
    enqueueIfMatch(width - 1, y);
  }

  while (queue.length) {
    const pixelIndex = queue.pop();
    const offset = pixelIndex * channels;
    if (data[offset + 3] !== 0) {
      data[offset + 3] = 0;
      removedPixels += 1;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    enqueueIfMatch(x + 1, y);
    enqueueIfMatch(x - 1, y);
    enqueueIfMatch(x, y + 1);
    enqueueIfMatch(x, y - 1);
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(destPath);

  return removedPixels;
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ico-"));
  const pngPaths = [];
  const normalizedSrc = path.join(tmp, "normalized-source.png");

  const removedPixels = await preprocessIconSource(SRC, normalizedSrc);
  console.log(
    `  preprocessed source (${removedPixels} edge-white pixels removed)`,
  );

  for (const size of SIZES) {
    const dest = path.join(tmp, `${size}.png`);
    await sharp(normalizedSrc).resize(size, size).png().toFile(dest);
    pngPaths.push(dest);
    console.log(`  resized ${size}x${size}`);
  }

  const icoBuffer = await pngToIco(pngPaths);
  fs.writeFileSync(OUT, icoBuffer);

  // cleanup
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\nWrote ${OUT} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);
}

module.exports = {
  EDGE_WHITE_THRESHOLD,
  EDGE_WHITE_TOLERANCE,
  SIZES,
  SRC,
  OUT,
  isEdgeConnectedWhitePixel,
  preprocessIconSource,
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
