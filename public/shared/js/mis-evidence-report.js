// Executive MIS — production evidence REPORT (read-only).
// Reporting only: one SELECT-style server read (mis_get_governance_exception_summary_v1, permission: executive-mis-dashboard view).
// No signing, packing, correction, enforcement or table access lives here; those operational controls belong to the future Production Work Log.
// Nothing here infers a signature, a stock movement or a production value: every number is either a live server fact or a labelled, dated reference snapshot.

export const EVIDENCE_RPC = "mis_get_governance_exception_summary_v1";
export const WINDOWS = Object.freeze([7, 30, 92]);           // server bound is 92 days
export const DEFAULT_WINDOW_DAYS = 30;
export const PAGE_SIZE = 25;
const DAY_MS = 86400000;

/** Evidence state wording. Only server facts are accepted; the client never marks anything SIGNED from history. */
export const GOVERNANCE_STATES = Object.freeze({
  SIGNED: { label: "Signed", tone: "ok", text: "Stage signed under the governed workflow; source unchanged since signing." },
  UNSIGNED: { label: "Unsigned", tone: "warn", text: "Governed record exists for the route but no signature yet." },
  SOURCE_CHANGED: { label: "Source changed", tone: "warn", text: "The work log changed after signing; the signature no longer matches the source." },
  MISSING_ROUTE: { label: "Missing route", tone: "danger", text: "No effective approved route (or a route-master deficiency)." },
  MISSING_RECEIPT: { label: "Missing FG receipt", tone: "danger", text: "No exact FG bulk receipt evidence in the stock ledger." },
  NOT_VERIFIED: { label: "Not verified", tone: "muted", text: "Historical record with no signed evidence. Not assumed correct and not backfilled." },
  BMR_IDENTITY_REVIEW: { label: "BMR review", tone: "danger", text: "The batch does not resolve to exactly one BMR." },
});

/** Plain-language wording of the `detail` finding codes returned by the server. */
export const DETAIL_TEXT = Object.freeze({
  NO_SOURCE_LEDGER: "No ledger receipt posted by the FG work log (other positive stock does not count)",
  LEDGER_MISMATCH: "Ledger receipt differs from the logged quantity",
  NOT_FG_RECEIPT_LOG: "Not an FG bulk storage log of this product and batch",
  QTY_NOT_POSITIVE: "FG work log has no positive quantity",
  UOM_MISMATCH: "FG work log unit is not the product base unit",
  NO_FG_LOG: "No FG bulk storage log for this batch",
  PACKING_LINE_WITHOUT_DEPLETION: "Packing line without recorded depletion",
  PRODUCT_ROUTE_COVERAGE: "No approved product route covers this product",
  EFFECTIVE_DATE_ROUTE_GAP: "Approved route does not cover the log date",
  APPROVED_ROUTE_OVERLAP: "Overlapping approved routes",
  MANDATORY_FG_STAGE_GAP: "Effective route has no mandatory FG bulk stage",
  STEP_NOT_IN_EFFECTIVE_ROUTE: "Logged step is not in the effective route",
  ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED: "Activity matches a route step but no signature exists",
  BMR_IDENTITY_REVIEW: "Batch does not resolve to exactly one BMR",
});
export const detailText = (c) => (c == null || c === "" ? "" : DETAIL_TEXT[c] || String(c).replace(/_/g, " ").toLowerCase());

/**
 * Dated reference snapshot (documented, NOT live, never a backfill input). Sources: MIS workflow §§83–85 and the S7 receipt validator run of
 * 24 Nov 2026. Shown only with its date/source label and always distinguished from live server counts.
 */
export const HISTORICAL_AUDIT_SNAPSHOT = Object.freeze({
  window: "1–21 Nov 2026",
  source: "Executive MIS G7 handover and S7 receipt-validator run, 24 Nov 2026",
  fgBulkLogs: 80,
  routeMasterDeficiencies: Object.freeze({ PRODUCT_ROUTE_COVERAGE: 52, MANDATORY_FG_STAGE_GAP: 17, APPROVED_ROUTE_OVERLAP: 1, ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED: 10 }),
  missingDepletionLines: 29,
  missingDepletionProductBatches: 20,
  receiptValidator: Object.freeze({ positiveFgLogs: 1680, ok: 1671, missingSourceLedger: 9 }),
});

/* ───────── server read classification ───────── */

/** kind: ok | unavailable | denied | invalid | error. Reads are advisory: a failure never alters or hides the dashboard's other figures. */
export function classifyRead(res) {
  const { data, error } = res || {};
  if (error) {
    const code = String(error.code ?? ""), msg = String(error.message ?? ""), status = Number(error.status ?? error.statusCode ?? NaN);
    if (code === "42883" || code === "PGRST202" || /could not find the function|function .* does not exist/i.test(msg)) return { kind: "unavailable", code: code || "UNAVAILABLE" };
    if (code === "42501" || status === 401 || status === 403) return { kind: "denied", code: code || "PERMISSION_DENIED" };
    return { kind: "error", code: code || "ERROR", message: msg || "Request failed." };
  }
  if (data && typeof data === "object" && data.ok === true) return { kind: "ok", data };
  if (data && typeof data === "object" && data.ok === false) return { kind: data.code === "INVALID_INPUT" ? "invalid" : "error", code: data.code || "REFUSED" };
  return { kind: "error", code: "UNEXPECTED_RESPONSE", message: "Unexpected server response." };
}

export async function fetchEvidenceSummary(client, from, to, limit = PAGE_SIZE, offset = 0) {
  let res;
  try { res = await client.rpc(EVIDENCE_RPC, { p_from: from, p_to: to, p_limit: limit, p_offset: offset }); }
  catch (e) { res = { data: null, error: { message: String(e?.message || e) } }; }
  return classifyRead(res);
}

export function windowBounds(todayIso, days) {
  const d = WINDOWS.includes(days) ? days : DEFAULT_WINDOW_DAYS;
  const to = todayIso;
  const from = new Date(new Date(`${to}T00:00:00Z`).getTime() - (d - 1) * DAY_MS).toISOString().slice(0, 10);
  return { from, to, days: d };
}

/* ───────── rendering ───────── */

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => (n == null || !Number.isFinite(Number(n)) ? "—" : Number(n).toLocaleString("en-IN"));

export function renderEvidenceShell() {
  const h = HISTORICAL_AUDIT_SNAPSHOT;
  const states = Object.values(GOVERNANCE_STATES).map((g) => `<li><span class="mis-gov-tag mis-gov-${esc(g.tone)}">${esc(g.label)}</span> ${esc(g.text)}</li>`).join("");
  const gaps = Object.entries(h.routeMasterDeficiencies).map(([k, v]) => `${esc(detailText(k))} ${v}`).join(" · ");
  const r = h.receiptValidator;
  return `
    <details class="mis-gov" id="productionGovernance">
      <summary>Production evidence status <span class="mis-gov-mode">Read-only report · AUDIT mode: signed evidence is available, not yet mandatory</span></summary>
      <ul class="mis-gov-states">${states}</ul>
      <div class="mis-gov-bar">
        <label>Window <select id="govWindow" aria-label="Evidence window">${WINDOWS.map((d) => `<option value="${d}"${d === DEFAULT_WINDOW_DAYS ? " selected" : ""}>Last ${d} days</option>`).join("")}</select></label>
      </div>
      <div id="govLive" class="mis-gov-live" aria-live="polite"></div>
      <div id="govItems" class="mis-gov-items"></div>
      <p class="mis-gov-hist"><strong>Historical, not verified</strong> (reference snapshot, ${esc(h.window)}; ${esc(h.source)}; not live): ${h.missingDepletionLines} packing lines in ${h.missingDepletionProductBatches} product-batches have no recorded depletion; route-master deficiencies on ${h.fgBulkLogs} FG bulk logs: ${gaps}. Receipt validator: ${num(r.ok)} of ${num(r.positiveFgLogs)} positive FG logs have exact ledger receipt evidence; ${r.missingSourceLedger} have none. These are never backfilled or assumed correct and stay separate from newly governed records.</p>
      <p class="mis-gov-hist">Executive Intelligence only reports. Signing, packing, corrections and stock decisions are operational functions and are not available here.</p>
    </details>`;
}

export function renderLive(d) {
  const tags = Object.keys(GOVERNANCE_STATES).filter((k) => k in d.counts)
    .map((k) => `<span class="mis-gov-tag mis-gov-${esc(GOVERNANCE_STATES[k].tone)}">${esc(GOVERNANCE_STATES[k].label)} ${esc(num(d.counts[k]))}</span>`).join(" ");
  const lc = d.line_counts || {};
  return `<p class="mis-gov-hist"><strong>Live, ${esc(d.from)} to ${esc(d.to)}</strong> (${esc(d.count_unit)}; ${esc(num(d.total_batches))} product/batches; cut-over ${esc(d.governance_cutover)}): ${tags || "no FG batches in the window"}. ${esc(num(lc.PACKING_LINES_WITHOUT_DEPLETION))} of ${esc(num(lc.PACKING_LINES))} packing lines have no recorded depletion (distinct lines).</p>`;
}

export function renderItems(d, offset, pageSize) {
  const items = Array.isArray(d.items) ? d.items : [];
  const total = Number(d.total_items) || 0;
  if (!items.length) return `<p class="mis-gov-hist">No exceptions in this window.</p>`;
  const rows = items.map((it) => {
    const g = GOVERNANCE_STATES[it.state];
    return `<tr><td>${esc(it.product)}</td><td>${esc(it.batch_number)}</td><td><span class="mis-gov-tag mis-gov-${esc(g?.tone || "muted")}">${esc(g?.label || it.state)}</span></td><td>${esc(detailText(it.detail))}</td></tr>`;
  }).join("");
  const first = offset + 1, last = offset + items.length;
  return `
    <div class="mis-gov-table-wrap"><table class="mis-gov-table"><thead><tr><th>Product</th><th>Batch</th><th>Evidence</th><th>Finding</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="mis-gov-pager"><span>${esc(num(first))}–${esc(num(last))} of ${esc(num(total))} findings (a batch can appear under several states)</span>
      <button type="button" id="govPrev" ${offset <= 0 ? "disabled" : ""}>Previous</button><button type="button" id="govNext" ${offset + pageSize >= total ? "disabled" : ""}>Next</button></div>`;
}

/** Wire the panel to a Supabase client. Latest request wins; the live read starts only when the section is opened. */
export function mountEvidencePanel(root, client, todayIso) {
  const el = root.querySelector("#productionGovernance"); if (!el) return;
  const live = el.querySelector("#govLive"), itemsEl = el.querySelector("#govItems"), sel = el.querySelector("#govWindow");
  let token = 0, offset = 0, loaded = false;
  async function load() {
    const tok = ++token, { from, to } = windowBounds(todayIso, Number(sel.value));
    live.innerHTML = `<span class="mis-gov-hist">Loading live counts…</span>`; itemsEl.innerHTML = "";
    const res = await fetchEvidenceSummary(client, from, to, PAGE_SIZE, offset);
    if (tok !== token || !el.isConnected) return;
    if (res.kind === "ok") {
      live.innerHTML = renderLive(res.data); itemsEl.innerHTML = renderItems(res.data, offset, PAGE_SIZE);
      itemsEl.querySelector("#govPrev")?.addEventListener("click", () => { offset = Math.max(0, offset - PAGE_SIZE); load(); });
      itemsEl.querySelector("#govNext")?.addEventListener("click", () => { offset += PAGE_SIZE; load(); });
    } else if (res.kind === "unavailable") { live.innerHTML = ""; }
    else live.innerHTML = `<span class="mis-gov-hist">Live counts unavailable${res.kind === "denied" ? " for your account" : ""}. The reference snapshot below is not live.</span>`;
  }
  el.addEventListener("toggle", () => { if (el.open && !loaded) { loaded = true; load(); } });
  sel.addEventListener("change", () => { offset = 0; load(); });
}
