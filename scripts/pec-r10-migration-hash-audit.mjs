#!/usr/bin/env node
// Reviewed PEC R10 integration SHA-256 evidence; read-only, no DB or network.
import { createHash } from "node:crypto";
import fs from "node:fs";
const paths = [
  "supabase/migrations/20261113170715_pec_safe_resync_collision_guard_lock_order.sql",
  "supabase/migrations/20261113172424_pec_safe_resync_collision_preview_ro.sql",
  "supabase/migrations/20261114013211_pec_indent_set_source_pr_lock_prelude.sql",
];
for (const path of paths) {
  const normalized = fs.readFileSync(path,"utf8").replace(/\r\n/g,"\n");
  const hash = createHash("sha256").update(normalized).digest("hex");
  console.log(`PEC_R10_SHA256 ${path} ${hash}`);
}
