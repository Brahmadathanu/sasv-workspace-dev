// WP10 G1 shared helpers. READ-ONLY and OFFLINE: nothing here touches Supabase or any network database.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");
export const catalog = JSON.parse(read("docs/master-data-costing/WP10_G1_EVIDENCE/live-guard-catalog-2026-11-15.json"));
export const liveFn = (schema, name) => catalog.functions.find((f) => f.schema_name === schema && f.proname === name)?.definition;

/** Body between the outermost dollar quotes of a CREATE FUNCTION statement. */
export function fnBody(sql) {
  const m = /\$([a-z_]*)\$([\s\S]*)\$\1\$/i.exec(sql);
  return m ? m[2] : null;
}
/** Whitespace/case/comment-insensitive form used ONLY to compare two texts of the same logic. */
export const normalizeSql = (s) => String(s).replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/\s*([(),;=])\s*/g, "$1").trim().toLowerCase();

/** Function statement `create or replace function <qualified>(` .. up to its closing dollar quote, from a migration file. */
export function migrationFunction(rel, qualified) {
  const src = read(rel);
  const start = src.search(new RegExp(`create or replace function ${qualified.replace(".", "\\.")}\\s*\\(`, "i"));
  if (start < 0) return null;
  const open = /\$([a-z_]*)\$/i.exec(src.slice(start));
  const tag = open[1];
  const from = start + open.index + open[0].length;
  const end = src.indexOf(`$${tag}$`, from);
  return { header: src.slice(start, start + open.index), body: src.slice(from, end), statement: src.slice(start, end + tag.length + 2) };
}

export function makeResults() {
  const results = [];
  const check = (id, name, ok, detail = "") => { results.push({ id, status: ok ? "PASS" : "FAIL", name, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${detail ? "  — " + detail : ""}`); };
  const classify = (id, status, name, detail = "") => { results.push({ id, status, name, detail }); console.log(`${status}  ${id} ${name}${detail ? "  — " + detail : ""}`); };
  return { results, check, classify, failed: () => results.filter((r) => r.status === "FAIL").length };
}

export const toCsvRow = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
