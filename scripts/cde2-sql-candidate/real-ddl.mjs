// Extracts the REAL definitions of the governed run views from the repository migrations so the isolated database uses live logic, not a stub.
import fs from "node:fs";
import path from "node:path";
const grab = (text, name) => {
  const m = text.match(new RegExp("create or replace view " + name.replace(".", "\\.") + "\\b[\\s\\S]*?;\\s*\\n", "i"));
  if (!m) throw new Error("view definition not found: " + name);
  return m[0];
};
export function realGovernedViewsSql(root) {
  const mig = (f) => fs.readFileSync(path.join(root, "supabase/migrations", f), "utf8").replace(/\r\n/g, "\n");
  const au2 = mig("20261015165757_au2_run_governance.sql"), w1 = mig("20261019014458_w1_approved_run_feed_and_labels.sql");
  return [grab(au2, "costing.v_costing_run_effective_designation"), grab(au2, "costing.v_current_successful_costing_refresh_run"), grab(w1, "costing.v_costing_period_run_status")].join("\n");
}
// md5(pg_get_viewdef(...)) of the live W1 view as pinned by migration 20261019053600 (W2 precheck).
export const LIVE_W1_VIEW_MD5 = "d38be6e4c0c8bb9811f4872b78e72936";
