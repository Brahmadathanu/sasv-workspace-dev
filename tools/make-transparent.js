// tools/make-transparent.js
// Make near-white pixels fully transparent (useful for removing white canvas around rounded icons)
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC =
  process.argv[2] ||
  path.resolve(
    __dirname,
    "../public/shared/assets/ChatGPT Image Apr 26, 2026, 10_36_10 AM.png",
  );
const OUT =
  process.argv[3] ||
  path.resolve(
    __dirname,
    "../public/shared/assets/ChatGPT Image Apr 26, 2026, 10_36_10 AM.transparent.png",
  );

const THRESH = 240; // RGB threshold above which a pixel is considered 'white-ish'

async function run() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels < 4) throw new Error("expected 4 channels (RGBA)");

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // If the pixel is near-white, make it fully transparent
    if (r >= THRESH && g >= THRESH && b >= THRESH) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(OUT);
  console.log("Wrote transparent PNG:", OUT);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
