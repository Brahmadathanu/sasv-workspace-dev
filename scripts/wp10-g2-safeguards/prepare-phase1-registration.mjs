// Offline preparation only. Returns proposed source/guard text; never applies SQL, writes files or moves a branch.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PROJECT = "qhmoqtxpeasamtlxaoak";
export const BRANCH = "server/wp10-g2-read-only-phase1";
export const GUARD = "scripts/lib/pec-protected-path-guard.mjs";
const dir = "docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/";
export const FILES = Object.freeze([
  ["01_clock_and_batch_size_contract.sql", "wp10_g2_01_clock_and_batch_size_contract", "0077b90fffbf9bd9c770ab55b85e81e8110d1c6c0a8a17135ba71bee4620dab3"],
  ["02_essential_states_and_boundaries.sql", "wp10_g2_02_essential_states_and_boundaries", "ef4cd91f693c220a614db3f7640afb301126b47626cde93e792b393b27c74b31"],
  ["03_operational_expiry_horizon_rpc.sql", "wp10_g2_03_operational_expiry_horizon_rpc", "dea309c07d0ff6726b04d9ed4d56e190c6d2afda9628a06996df133e7dfb0ce5"],
  ["06_subgroup_impact_preview.sql", "wp10_g2_06_subgroup_impact_preview", "abb291fe26bce9ac2618eca5325b4cb82392a262d895585e87b9746cc8f9217f"],
].map(([file, name, sha256]) => Object.freeze({ file: dir + file, name, sha256 })));
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const lf = text => text.replace(/\r\n/g, "\n");
const hash = text => crypto.createHash("sha256").update(lf(text)).digest("hex");

/** receipts must be the FOUR actual migration-history {name,version} rows, obtained after separately approved application. */
export function preparePhase1Registration({ projectId, headBranch, receipts, readText = read, exists = file => fs.existsSync(path.join(root, file)) }) {
  if (projectId !== PROJECT || headBranch !== BRANCH) throw Error("Wrong Phase 1 project/branch");
  if (!Array.isArray(receipts) || receipts.length !== FILES.length) throw Error("Exactly four receipts required");
  const names = new Set(), versions = new Set();
  for (const r of receipts) {
    if (!r || !FILES.some(f => f.name === r.name) || typeof r.version !== "string" || !/^\d{14}$/.test(r.version) || names.has(r.name) || versions.has(r.version)) throw Error("Unknown, duplicate or malformed receipt");
    names.add(r.name); versions.add(r.version);
  }
  const migrations = FILES.map(f => {
    const content = lf(readText(f.file));
    if (hash(content) !== f.sha256) throw Error("Reviewed source hash changed: " + f.file);
    const version = receipts.find(r => r.name === f.name).version;
    const file = `supabase/migrations/${version}_${f.name}.sql`;
    if (exists(file)) throw Error("Migration source already exists; inspect, never overwrite: " + file);
    return { path: file, content, sha256: f.sha256 };
  });
  const guard = readText(GUARD);
  const marker = "export const REVIEWED_SERVER_MIGRATIONS = Object.freeze({\n";
  if (guard.split(marker).length !== 2) throw Error("Guard registry structure changed; re-review");
  for (const m of migrations) if (guard.includes(JSON.stringify(m.path))) throw Error("Migration already registered; inspect");
  const additions = migrations.map(m => `  ${JSON.stringify(m.path)}: Object.freeze({\n    sha256: ${JSON.stringify(m.sha256)},\n    heads: Object.freeze([${JSON.stringify(BRANCH)}]),\n  }),\n`).join("");
  return { projectId, headBranch, migrations, guardPath: GUARD, guardContent: guard.replace(marker, marker + additions) };
}
