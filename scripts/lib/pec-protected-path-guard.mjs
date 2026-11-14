import { createHash } from "node:crypto";
// PEC protected path policy. Check only the delta introduced by the current PR.
// The integration candidate deliberately carries these reviewed server migrations
// and the PWA cache file. Its descendant client-only PRs may not add any more.
export const INTEGRATION_PROTECTED_PATHS = new Set([
  "public/sw.js",
  "supabase/migrations/20261112110000_pec_four_gram_material_bom_normalization.sql",
  "supabase/migrations/20261112114000_pec_uom_and_internal_pr_guard.sql",
  "supabase/migrations/20261112122500_pec_revision_and_manual_indent_internal_guard.sql",
  "supabase/migrations/20261112133000_pec_manual_pr_internal_item_guards.sql",
  "supabase/migrations/20261112143000_pec_safe_resync_preserve_manual_lines.sql",
  "supabase/migrations/20261112150000_pec_mrp_uom_factor_auth_rbac.sql",
  "supabase/migrations/20261112152000_pec_mrp_rollup_use_strict_factor.sql",
  "supabase/migrations/20261112170000_pec_g1_five_paged_read_contracts.sql",
  "supabase/migrations/20261112173000_pec_g1_filtered_paged_read_contracts.sql",
  "supabase/migrations/20261112174500_pec_g1_vendor_operational_paging.sql",
  // PR #374 Add Line guard: carried by the integration candidate once #374 lands (staging -> main).
  "supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql",
]);

// Reviewed SERVER-lane migrations that may be *committed* on one named server
// branch without becoming a general SQL exemption. Each entry is pinned to
// (a) the exact path, (b) the exact head branch(es) and (c) the SHA-256 of the
// LF-normalised file content, so any edit, rename, other branch or other
// migration is still rejected. Working-tree (uncommitted) changes are NEVER
// exempt: callers pass a context only for committed paths.
export const REVIEWED_SERVER_MIGRATIONS = Object.freeze({
  // PR #374 Add Line new-row status guard (owner-reviewed; wrapper already installed live).
  "supabase/migrations/20261112220000_pec_r2_add_line_new_row_status_guard.sql": Object.freeze({
    sha256: "f9441b67451f0d012e77c576beec347a99c491b57f0b11eeda755a5a50eeee03",
    heads: Object.freeze([
      "server/pec-r2-indent-addline-status-guard-20261112",
      "claude/pec-r13-addline-374-integration-20261114",
    ]),
  }),
  // R10 forward-only migrations: source-integrated but NOT applied to production.
  // Pins cover the exact reviewed SQL blobs only; any mutation must fail.
  "supabase/migrations/20261113170715_pec_safe_resync_collision_guard_lock_order.sql": Object.freeze({
    sha256: "43b51cd98dc37635bc7c2ccfb9b76df1fcc89062e38e1886b754e3f8d19a624b",
    heads: Object.freeze(["integration/pec-erp-staging-20261112"]),
  }),
  "supabase/migrations/20261113172424_pec_safe_resync_collision_preview_ro.sql": Object.freeze({
    sha256: "7c379d30f32ebb7f1f8db6c82c8cbbe897e0cfcb05ed8273cf688ae4ad24925d",
    heads: Object.freeze(["integration/pec-erp-staging-20261112"]),
  }),
  "supabase/migrations/20261114013211_pec_indent_set_source_pr_lock_prelude.sql": Object.freeze({
    sha256: "420f64a00ee544f29cbc64a33b1c47c6c0c74184a8574cb06b3d4aa450243961",
    heads: Object.freeze(["integration/pec-erp-staging-20261112"]),
  }),
});

const lfSha256 = (text) => createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");

function reviewedServerException(path, ctx) {
  const entry = REVIEWED_SERVER_MIGRATIONS[path];
  if (!entry || !ctx || typeof ctx.readText !== "function") return false;
  if (!entry.heads.includes(ctx.headBranch)) return false;
  try { return lfSha256(ctx.readText(path)) === entry.sha256; } catch { return false; }
}

/**
 * ctx (optional, committed paths only): { headBranch, readText(path) }.
 * Without ctx there is no server-branch exemption (previous behaviour).
 */
export function rejectedProtectedPaths(changed, integrationCandidate = false, ctx = null) {
  return [...new Set(changed)].filter(path =>
    (path === "public/sw.js" || path.startsWith("supabase/")) &&
    !(integrationCandidate && INTEGRATION_PROTECTED_PATHS.has(path)) &&
    !reviewedServerException(path, ctx)
  );
}
