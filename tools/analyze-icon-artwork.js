// Measure how much of the canvas your icon artwork fills (padding / small logo vs full bleed).
// Usage: node tools/analyze-icon-artwork.js [path/to/image.png]
const path = require("path");
const sharp = require("sharp");

const DEFAULT_SRC = path.resolve(
  __dirname,
  "../public/shared/assets/ChatGPT Image Apr 13, 2026, 07_05_58 PM.png",
);

const ALPHA_THRESHOLD = 8; // ignore nearly-transparent fringe

async function analyze(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels < 4) {
    console.log("Image has no alpha channel; assuming full canvas is opaque artwork.");
    return;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    console.log("No visible pixels found (fully transparent?).");
    return;
  }

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const areaCanvas = width * height;
  const areaBBox = bboxW * bboxH;
  const coverage = (100 * areaBBox) / areaCanvas;

  const cx = (minX + maxX + 1) / 2;
  const cy = (minY + maxY) / 2;
  const offX = Math.abs(cx - width / 2) / width;
  const offY = Math.abs(cy - height / 2) / height;

  console.log(`File: ${filePath}`);
  console.log(`Canvas: ${width}×${height}`);
  console.log(
    `Opaque-ish bounds (alpha>${ALPHA_THRESHOLD}): (${minX},${minY}) → (${maxX},${maxY})`,
  );
  console.log(`Bounding box size: ${bboxW}×${bboxH} px`);
  console.log(`Area ratio (bbox / full canvas): ${coverage.toFixed(1)}%`);
  console.log(
    `Center offset from canvas center: ${(offX * 100).toFixed(1)}% width, ${(offY * 100).toFixed(1)}% height`,
  );
  console.log("");
  if (coverage < 55) {
    console.log(
      "→ Likely artwork issue: the visible graphic fills well under ~55–60% of the square.",
      "Lots of empty margin makes the logo look smaller in the taskbar slot.",
    );
  } else if (coverage < 75) {
    console.log(
      "→ Moderate margins. Compare with a full-bleed test square if taskbar still looks small.",
    );
  } else {
    console.log(
      "→ The graphic uses most of the canvas; if the taskbar still looks small,",
      "check Windows taskbar settings (small buttons) or compare after a production build.",
    );
  }
}

const src = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SRC;
analyze(src).catch((e) => {
  console.error(e);
  process.exit(1);
});
