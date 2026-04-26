// tools/gen-ico.js — generate a proper multi-size favicon.ico
const sharp = require("sharp");
const { default: pngToIco } = require("png-to-ico");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SRC = path.resolve(
  __dirname,
  "../public/shared/assets/ChatGPT Image Apr 26, 2026, 10_36_10 AM.png",
);
const OUT = path.resolve(__dirname, "../public/shared/assets/favicon.ico");
// Largest first: helps Windows pick a sharp bitmap for the taskbar/shell.
const SIZES = [256, 128, 64, 48, 32, 16];

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ico-"));
  const pngPaths = [];

  for (const size of SIZES) {
    const dest = path.join(tmp, `${size}.png`);
    await sharp(SRC).resize(size, size).png().toFile(dest);
    pngPaths.push(dest);
    console.log(`  resized ${size}x${size}`);
  }

  const icoBuffer = await pngToIco(pngPaths);
  fs.writeFileSync(OUT, icoBuffer);

  // cleanup
  pngPaths.forEach((f) => fs.unlinkSync(f));
  fs.rmdirSync(tmp);

  console.log(`\nWrote ${OUT} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
