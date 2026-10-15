#!/usr/bin/env node
// Read-only migration drift check: compares live supabase_migrations.schema_migrations
// against supabase/migrations/*.sql. Never connects to or writes to any database itself.
//
// Usage:
//   node scripts/migration-drift-check.mjs --live-json <file> [--since <version>] [--json]
//
// <file> is the JSON output of this read-only query (array of rows, or {j:[...]}):
//   select json_agg(json_build_object('version',version,'name',name,'statements',statements) order by version)
//   from supabase_migrations.schema_migrations;
// Keys v/n/s are also accepted. If statements are present, content is compared too:
// a repo file matches when its bytes equal statements.join('\n') (whitespace-insensitive match reported separately).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const liveFile = opt("--live-json");
const since = opt("--since") || "";
const asJson = args.includes("--json");
if (!liveFile) { console.error("Missing --live-json <file>"); process.exit(2); }

let raw = JSON.parse(fs.readFileSync(liveFile, "utf8"));
if (!Array.isArray(raw)) raw = raw.j || raw.json_agg || raw.rows;
if (Array.isArray(raw) && raw.length === 1 && raw[0] && (raw[0].j || raw[0].json_agg)) raw = raw[0].j || raw[0].json_agg;
const live = raw.map((r) => ({
  version: String(r.version ?? r.v),
  name: String(r.name ?? r.n ?? ""),
  sql: Array.isArray(r.statements ?? r.s) ? (r.statements ?? r.s).join("\n") : null,
})).filter((r) => r.version >= since);

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "supabase", "migrations");
const repo = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).map((f) => {
  const m = f.match(/^(\d+)_(.+)\.sql$/);
  return { version: m[1], name: m[2], file: f, sql: fs.readFileSync(path.join(dir, f), "utf8") };
}).filter((r) => r.version >= since);

const norm = (s) => s.replace(/\s+/g, "");
const h = (s) => crypto.createHash("md5").update(s).digest("hex");
const repoByVersion = new Map(repo.map((r) => [r.version, r]));
const liveByVersion = new Map(live.map((r) => [r.version, r]));

const result = { scope_since: since || "(all)", live: live.length, repo: repo.length,
  matched: [], content_mismatch: [], name_mismatch: [], missing_in_repo: [], extra_in_repo: [], renamed: [] };

for (const l of live) {
  const r = repoByVersion.get(l.version);
  if (r) {
    if (r.name !== l.name) result.name_mismatch.push({ version: l.version, live: l.name, repo: r.name });
    if (l.sql !== null && r.sql !== l.sql) {
      result.content_mismatch.push({ version: l.version, name: l.name, whitespace_only: norm(r.sql) === norm(l.sql) });
    } else result.matched.push(l.version);
    continue;
  }
  // renamed: same name or same normalised content under a different version
  const cand = repo.find((x) => !liveByVersion.has(x.version) &&
    (x.name === l.name || (l.sql !== null && h(norm(x.sql)) === h(norm(l.sql)))));
  if (cand) result.renamed.push({ live_version: l.version, repo_version: cand.version, name: l.name,
    same_content: l.sql !== null ? norm(cand.sql) === norm(l.sql) : null });
  else result.missing_in_repo.push({ version: l.version, name: l.name });
}
const renamedRepo = new Set(result.renamed.map((x) => x.repo_version));
for (const r of repo) if (!liveByVersion.has(r.version) && !renamedRepo.has(r.version))
  result.extra_in_repo.push({ version: r.version, name: r.name });

const drift = result.content_mismatch.length + result.name_mismatch.length + result.missing_in_repo.length +
  result.extra_in_repo.length + result.renamed.length;
if (asJson) console.log(JSON.stringify({ ...result, matched: result.matched.length, drift }, null, 2));
else {
  console.log(`Scope since: ${result.scope_since} | live ${result.live} | repo ${result.repo} | matched ${result.matched.length} | drift ${drift}`);
  for (const k of ["missing_in_repo", "extra_in_repo", "renamed", "name_mismatch", "content_mismatch"]) {
    console.log(`${k}: ${result[k].length}`);
    for (const x of result[k]) console.log("  " + JSON.stringify(x));
  }
}
process.exit(drift ? 1 : 0);
