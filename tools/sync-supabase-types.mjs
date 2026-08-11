/**
 * tools/sync-supabase-types.mjs
 *
 * Safe wrapper for `npm run sync-db`.
 * Generates Supabase TypeScript types to a temporary file, validates output,
 * then replaces the canonical types file only on success.
 *
 * A failed generation leaves public/shared/js/types/supabase.ts untouched.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const canonicalRel = path.join("public", "shared", "js", "types", "supabase.ts");
const canonicalAbs = path.join(root, canonicalRel);

const MIN_BYTES = 1024;
const PLAUSIBLE_MARKER = "export type Json";

function fail(message, code = 1) {
  console.error(`[sync-db] ${message}`);
  process.exit(code);
}

function runGenerator(tmpPath) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "npx.cmd" : "npx";
  const args = [
    "supabase",
    "gen",
    "types",
    "typescript",
    "--linked",
    "--schema",
    "public",
  ];

  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: isWin,
  });

  if (result.error) {
    fail(`Failed to launch Supabase CLI: ${result.error.message}`);
  }

  const stdout = result.stdout ?? "";
  const stderr = (result.stderr ?? "").trim();
  if (stderr) {
    console.error(stderr);
  }

  if (result.status !== 0) {
    const hint =
      /project ref|supabase link|not linked|Cannot find project/i.test(stderr)
        ? "\n[sync-db] Tip: run `npx supabase link` for this project, then retry `npm run sync-db`."
        : "";
    fail(
      `Type generation failed (exit ${result.status}). Existing ${canonicalRel} was not modified.${hint}`,
      result.status || 1,
    );
  }

  if (!stdout || !String(stdout).trim()) {
    fail(
      `Generator returned empty stdout. Existing ${canonicalRel} was not modified.`,
    );
  }

  fs.writeFileSync(tmpPath, stdout, "utf8");
}

function validateTemp(tmpPath) {
  let stat;
  try {
    stat = fs.statSync(tmpPath);
  } catch {
    fail(`Temporary output missing. Existing ${canonicalRel} was not modified.`);
  }

  if (!stat.isFile() || stat.size < MIN_BYTES) {
    fail(
      `Temporary output too small (${stat.size} bytes). Existing ${canonicalRel} was not modified.`,
    );
  }

  const head = fs.readFileSync(tmpPath, "utf8").slice(0, 4000);
  if (!head.includes(PLAUSIBLE_MARKER)) {
    fail(
      `Temporary output does not look like Supabase types (missing "${PLAUSIBLE_MARKER}"). Existing ${canonicalRel} was not modified.`,
    );
  }
}

function replaceCanonical(tmpPath) {
  const dir = path.dirname(canonicalAbs);
  fs.mkdirSync(dir, { recursive: true });
  // Write via sibling temp in same directory for a safer replace on Windows.
  const staging = path.join(
    dir,
    `.supabase.ts.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.copyFileSync(tmpPath, staging);
    fs.renameSync(staging, canonicalAbs);
  } catch (err) {
    try {
      if (fs.existsSync(staging)) fs.unlinkSync(staging);
    } catch {
      /* ignore */
    }
    fail(
      `Failed to replace ${canonicalRel}: ${err.message}. Existing file may still be intact.`,
    );
  }
}

function main() {
  const tmpPath = path.join(
    os.tmpdir(),
    `sasv-supabase-types-${process.pid}-${Date.now()}.ts`,
  );

  try {
    console.log("[sync-db] Generating types via linked Supabase project…");
    runGenerator(tmpPath);
    validateTemp(tmpPath);
    replaceCanonical(tmpPath);
    const size = fs.statSync(canonicalAbs).size;
    console.log(
      `[sync-db] Updated ${canonicalRel} (${size} bytes).`,
    );
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

main();
