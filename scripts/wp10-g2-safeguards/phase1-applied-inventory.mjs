// Read-only source inventory. Exact applied receipt/payload matching; no database access or authorisation of another migration.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { FILES, PROJECT } from "./prepare-phase1-registration.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const RECEIPT = "docs/master-data-costing/WP10_SQL_PHASE1_EVIDENCE/application-receipt-2026-11-16.json";
export const sha256 = s => crypto.createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");

export function inventoryFromReceipt(receipt) {
  if (!receipt || receipt.project_id !== PROJECT || receipt.stage !== "PHASE1_APPLIED" || !Array.isArray(receipt.migrations) || receipt.migrations.length !== FILES.length) throw Error("Invalid Phase 1 receipt");
  const names = new Set(), versions = new Set();
  return receipt.migrations.map(m => {
    const f = FILES.find(x => x.name === m.name);
    if (!f || typeof m.version !== "string" || !/^\d{14}$/.test(m.version) || names.has(m.name) || versions.has(m.version) || m.sha256 !== f.sha256) throw Error("Receipt name/version/hash mismatch");
    names.add(m.name); versions.add(m.version);
    const expected = `supabase/migrations/${m.version}_${f.name}.sql`;
    if (m.path !== expected) throw Error("Receipt migration path mismatch");
    return { path: expected, sha256: f.sha256, name: m.name, version: m.version };
  });
}

export function loadPhase1Inventory() {
  const file = path.join(root, RECEIPT);
  return fs.existsSync(file) ? inventoryFromReceipt(JSON.parse(fs.readFileSync(file, "utf8"))) : [];
}

export function verifyAppliedCopies(inventory, files, readText) {
  const expected = new Map(inventory.map(m => [m.path, m.sha256]));
  const wp10 = files.filter(f => /wp10/i.test(f));
  if (wp10.length !== expected.size || new Set(wp10).size !== wp10.length) return false;
  return wp10.every(f => expected.has(f) && sha256(readText(f)) === expected.get(f));
}
