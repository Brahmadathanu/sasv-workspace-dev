const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const { SIZES, SRC, preprocessIconSource } = require("./gen-ico");

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : SRC;
const outputDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(__dirname, "../public/shared/assets/favicon-frames");

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ico-frames-"));
  const normalizedSrc = path.join(tmp, "normalized-source.png");

  try {
    const removedPixels = await preprocessIconSource(sourcePath, normalizedSrc);
    console.log(
      `  preprocessed source (${removedPixels} edge-white pixels removed)`,
    );

    for (const size of SIZES) {
      const outputPath = path.join(outputDir, `favicon-${size}.png`);
      await sharp(normalizedSrc).resize(size, size).png().toFile(outputPath);
      console.log(`  wrote ${outputPath}`);
    }

    console.log(`\nExported PNG review frames to ${outputDir}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
