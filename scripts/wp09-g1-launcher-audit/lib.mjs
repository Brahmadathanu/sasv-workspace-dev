// WP09 G1 shared helpers. READ-ONLY: this audit never calls a Supabase writer and never opens a network connection.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}
export function exists(rel) {
  try {
    return fs.statSync(path.join(repoRoot, rel)).isFile();
  } catch {
    return false;
  }
}

/** Evaluate the real shared/js/module-registry.js with its single supabase import stubbed (pure functions only). */
export async function loadRegistryModule() {
  let src = read("public/shared/js/module-registry.js");
  src = src.replace(/^import \{ supabase \} from "\.\/supabaseClient\.js";/m, "const supabase = null;");
  if (src.includes("supabaseClient")) throw new Error("module-registry.js import shape changed; update the WP09 loader");
  return import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
}

/** Stable sort exactly as the SQL consumers do: sort_order asc, then label (locale) asc. */
export function sortRows(rows) {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows, cols) {
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n") + "\n";
}
