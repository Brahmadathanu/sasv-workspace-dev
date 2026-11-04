import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (r) => fs.readFileSync(path.join(root, r), "utf8").replace(/\r\n/g, "\n");

test("page uses canonical stylesheet chain, theme attr, and Electron-relative paths", () => {
  const h = read("manage-activities.html");
  assert.match(h, /data-sasv-theme="sasv-core"/);
  assert.match(h, /href="public\/shared\/css\/style\.css"/);
  assert.match(h, /src="js\/activities\.js"/);
  assert.doesNotMatch(h, /href="\/|src="\//, "no root-absolute URLs (file:// safe)");
});
test("module CSS uses tokens, no hard-coded brand hex outside fallbacks", () => {
  const c = read("public/shared/css/sasv-manage-activities.css");
  const hexes = c.replace(/var\([^)]*#[0-9a-fA-F]{3,8}\)/g, "").match(/#[0-9a-fA-F]{3,8}\b/g);
  assert.equal(hexes, null);
});
test("no direct Supabase table CRUD in the UI shell; no RPC invented; no unsafe HTML interpolation of raw names", () => {
  const u = read("js/activities.js");
  assert.doesNotMatch(u, /supabase\s*\.\s*from\(/);
  assert.doesNotMatch(u, /\.rpc\(/);
  assert.doesNotMatch(u, /\$\{r\.activity_name\}|\$\{row\.activity_name\}(?!\)|”)/);
});
