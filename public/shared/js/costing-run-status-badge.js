// W1: governed run label for the pricing screens ("Approved run N" / "DRAFT run N - not approved").
// Reads public.v_costing_pricing_period_run_status (one row per month). Pure helpers are exported for tests.

export const RUN_STATUS_VIEW = "v_costing_pricing_period_run_status";

// Lenses whose data come from a costing refresh run (pricing screens).
export const RUN_SCOPED_LENSES = new Set([
  "dashboard",
  "sku-cost-sheet",
  "printable-cost-sheet",
  "cost-comparison",
  "scheme-comparison",
  "sku-control-status",
]);

const TONE_BY_STATE = {
  APPROVED: "approved",
  APPROVED_NEWER_DRAFT: "approved-pending",
  DRAFT: "draft",
  REFERENCE_NOT_APPROVED: "draft",
  NO_SUCCESSFUL_RUN: "empty",
};

export function describeRunStatus(row) {
  if (!row) {
    return { text: "Run status unavailable", tone: "empty", title: "No run status for this month." };
  }
  const state = String(row.display_state || "");
  const tone = TONE_BY_STATE[state] || "draft";
  const text = String(row.display_label || "").trim() || "Run status unavailable";
  const parts = [text];
  if (row.approved_run_id && row.approved_at) {
    const by = row.approved_by ? ` by ${row.approved_by}` : "";
    parts.push(`Approved ${formatIst(row.approved_at)}${by}.`);
  }
  if (tone === "draft") parts.push("Figures are a draft and are not approved for pricing.");
  if (state === "APPROVED_NEWER_DRAFT") parts.push("Screens show the approved run; the newer draft is not used.");
  if (row.active_run_id) parts.push(`Run ${row.active_run_id} is ${String(row.active_run_status || "").toLowerCase()}.`);
  return { text, tone, title: parts.join(" ") };
}

export function formatIst(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " IST"
  );
}

export function applyRunStatusBadge(el, info, visible) {
  if (!el) return;
  el.hidden = !visible;
  if (!visible || !info) return;
  el.textContent = info.text;
  el.title = info.title;
  el.setAttribute("aria-label", info.title);
  el.dataset.tone = info.tone;
}

export function createRunStatusBadge({ supabase, anchor, doc = globalThis.document }) {
  let el = null;
  let generation = 0;
  const cache = new Map();

  function ensureEl() {
    if (el || !anchor || !doc) return el;
    el = doc.createElement("span");
    el.id = "costingRunStatusBadge";
    el.className = "sc-run-status";
    el.setAttribute("role", "status");
    el.hidden = true;
    anchor.insertAdjacentElement("beforebegin", el);
    return el;
  }

  async function fetchRow(periodStart) {
    if (cache.has(periodStart)) return cache.get(periodStart);
    const { data, error } = await supabase
      .from(RUN_STATUS_VIEW)
      .select(
        "period_start,display_state,display_label,displayed_run_id,approved_run_id,approved_at,approved_by,newer_draft_run_id,active_run_id,active_run_status",
      )
      .eq("period_start", periodStart)
      .maybeSingle();
    if (error) throw error;
    // Cache only settled months; an active run or draft can change soon.
    if (data && !data.active_run_id && data.display_state === "APPROVED") cache.set(periodStart, data);
    return data || null;
  }

  async function refresh({ periodStart, lensId }) {
    const node = ensureEl();
    if (!node) return;
    const my = ++generation;
    if (!periodStart || !RUN_SCOPED_LENSES.has(lensId)) {
      applyRunStatusBadge(node, null, false);
      return;
    }
    try {
      const row = await fetchRow(periodStart);
      if (my !== generation) return;
      applyRunStatusBadge(node, describeRunStatus(row), true);
    } catch (err) {
      if (my !== generation) return;
      console.warn("Run status unavailable", err);
      applyRunStatusBadge(node, { text: "Run status unavailable", tone: "empty", title: "Could not read the run status." }, true);
    }
  }

  return { refresh, invalidate: () => cache.clear() };
}
