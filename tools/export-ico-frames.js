#!/usr/bin/env node
/**
 * Deprecated — ICO/PNG review frames are now produced by
 * `npm run branding:generate` under public/shared/assets/branding/derived/.
 */
console.warn(
  "[deprecated] tools/export-ico-frames.js → use `npm run branding:generate`",
);
require("child_process").spawnSync(
  process.execPath,
  [require("path").join(__dirname, "generate-branding-assets.js")],
  { stdio: "inherit" },
);
