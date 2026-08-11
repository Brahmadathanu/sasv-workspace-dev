#!/usr/bin/env node
/**
 * Deprecated entry point — use `npm run branding:generate` instead.
 * Kept as a thin wrapper so older docs/scripts keep working.
 */
console.warn(
  "[deprecated] tools/gen-ico.js → use `npm run branding:generate` (tools/generate-branding-assets.js)",
);
require("child_process").spawnSync(
  process.execPath,
  [require("path").join(__dirname, "generate-branding-assets.js")],
  { stdio: "inherit" },
);
