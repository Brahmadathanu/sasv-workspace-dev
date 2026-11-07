// SUPERVISED session capture. The OPERATOR logs in by hand in a visible browser; this script never sees, asks for or stores a password.
// It saves Playwright's storage state (cookies + localStorage, which contains the session token) to a file OUTSIDE the repository with mode 600.
//   node scripts/costing-acceptance/capture-storage-state.mjs --base https://<host> --out <path outside repo>/id-v.storage.json
// Treat the file like a password: delete it after the run and rotate the test identity's password.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export function validateCapturePaths({ base, out }) {
  const problems = [];
  let u; try { u = new URL(base); } catch { problems.push("invalid --base"); }
  if (u && u.protocol !== "https:" && !/^(localhost|127\.)/.test(u.hostname)) problems.push("--base must be https");
  if (!out) problems.push("--out is required");
  else { const r = path.resolve(out); if (r === repoRoot || r.startsWith(repoRoot + path.sep)) problems.push("--out must be OUTSIDE the repository (a session file must never sit in a worktree)"); }
  return problems;
}
async function main() {
  const a = process.argv.slice(2); const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  const problems = validateCapturePaths({ base: opt("--base"), out: opt("--out") });
  if (problems.length) { console.error(problems.join("\n")); process.exit(2); }
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch({ headless: false }); const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(new URL("/login.html", opt("--base")).href);
  console.log("Log in as the TEST identity in the browser window (view-only ID-V, or ID-N). Then return here and press Enter. Nothing is recorded while you type.");
  await new Promise((r) => readline.createInterface({ input: process.stdin }).once("line", r));
  const out = path.resolve(opt("--out")); fs.mkdirSync(path.dirname(out), { recursive: true });
  await context.storageState({ path: out }); fs.chmodSync(out, 0o600); await browser.close();
  console.log("Saved (mode 600): " + out + "\nDelete it after the run.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
