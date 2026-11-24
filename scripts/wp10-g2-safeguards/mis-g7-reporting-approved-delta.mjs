// WP10 narrow reviewed approved-delta for the Executive MIS G7 REPORTING-ONLY release candidate (owner-directed, 24 Nov 2026).
// Nothing else is relaxed: the allowance is (a) exact path list, (b) head-branch scoped, (c) for migrations content-pinned by SHA-256 against the
// reconciled MIGRATION_IDENTITIES.json (all eleven are already installed; any edit or extra file is still rejected).
// Operational pages, hand-offs, service worker, permission registry and launcher changes are NOT covered and remain rejected by S4/S5.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const MIS_G7_REPORTING_BRANCH = "claude/executive-mis-g7-client-dmijyz";
export const MIS_G7_REPORTING_CLIENT_FILES = Object.freeze([
  "public/shared/executive-mis-dashboard.html",
  "public/shared/js/executive-mis-dashboard.js",
  "public/shared/js/mis-evidence-report.js",
]);
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

export function misG7ApprovedMigrations(root) {
  const man = JSON.parse(fs.readFileSync(path.join(root, "docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json"), "utf8"));
  return new Map(man.migrations.map((m) => [`supabase/migrations/${m.repo_file}`, m.sha256]));
}
export const misG7ClientFileApproved = (file, branch) => branch === MIS_G7_REPORTING_BRANCH && MIS_G7_REPORTING_CLIENT_FILES.includes(file);
export const misG7MigrationApproved = (file, committedBytes, branch, approved) => branch === MIS_G7_REPORTING_BRANCH && approved.has(file) && sha256(committedBytes) === approved.get(file);
