// WP10 narrow reviewed approved-delta for the Executive MIS G7 REPORTING-ONLY release candidate (owner-directed, 24 Nov 2026).
// Nothing else is relaxed: the allowance is (a) exact path list, (b) head-branch scoped, (c) for the eleven installed migrations and the isolated PG harness, content-pinned by SHA-256 in the PEC protected-path guard (any edit or extra file is still rejected).
// Operational pages, hand-offs, service worker, permission registry and launcher changes are NOT covered and remain rejected by S4/S5.
import { createHash } from "node:crypto";

export const MIS_G7_REPORTING_BRANCH = "claude/executive-mis-g7-client-dmijyz";
export const MIS_G7_REPORTING_CLIENT_FILES = Object.freeze([
  "public/shared/executive-mis-dashboard.html",
  "public/shared/js/executive-mis-dashboard.js",
  "public/shared/js/mis-evidence-report.js",
]);
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

export const misG7ClientFileApproved = (file, branch) => branch === MIS_G7_REPORTING_BRANCH && MIS_G7_REPORTING_CLIENT_FILES.includes(file);
// Installed migrations and the isolated PG harness: exact path, this branch only, content pinned by SHA-256 (LF-normalised) in the PEC protected-path guard.
export const misG7PinnedFileApproved = (file, committedText, branch, pins) =>
  branch === MIS_G7_REPORTING_BRANCH && Object.hasOwn(pins, file) && pins[file].heads.includes(branch) && sha256(String(committedText).replace(/\r\n/g, "\n")) === pins[file].sha256;
