// In-memory model of the MIS G7 server contract (client_rpc_contract.json, mis-g7-s2-s5b/1) + a minimal Supabase client.
// Test fixture only: no network, no Supabase, no writes. Mirrors documented semantics: domain refusals are HTTP-200
// {ok:false,code} with nothing written; idempotent replay returns the stored result with idempotent_replay:true;
// an actor needs view AND edit on the target. Fault injection simulates uncertain network outcomes.

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const hash = (x) => JSON.stringify(x);

export function defaultConfig(over = {}) {
  const cfg = {
    caps: { "module:mis-batch-stage-signer": [1, 1], "module:mis-fg-bulk-packing": [1, 1], "module:mis-fg-excess-adjustment": [1, 1], "module:mis-g7-enforcement-admin": [0, 0], "module:mis-g7-core-migration-signoff": [0, 0] },
    mode: "AUDIT",
    products: [{ id: 7, item: "Ashwagandha Churna" }, { id: 8, item: "Triphala Churna" }, { id: 9, item: "Orphan Product" }],
    bmr: [{ id: 101, product_id: 7, bn: "B-001", lifecycle_status: "ACTIVE" }, { id: 102, product_id: 7, bn: "B-002", lifecycle_status: "ACTIVE" }, { id: 103, product_id: 7, bn: "B-DUP", lifecycle_status: "ACTIVE" }, { id: 104, product_id: 7, bn: "B-DUP", lifecycle_status: "ACTIVE" }, { id: 201, product_id: 8, bn: "T-001", lifecycle_status: "ACTIVE" }],
    skus: [{ id: 71, product_id: 7, pack_size: 0.5, uom: "kg", is_active: true, is_sample: false }, { id: 72, product_id: 7, pack_size: 0.1, uom: "kg", is_active: true, is_sample: false }, { id: 73, product_id: 7, pack_size: 0.25, uom: "kg", is_active: true, is_sample: false }, { id: 81, product_id: 8, pack_size: 1, uom: "kg", is_active: true, is_sample: false }],
    fg: [{ product_id: 7, bn: "B-001", qty_on_hand: 10, on_hand_qty_uom: "kg" }, { product_id: 7, bn: "B-002", qty_on_hand: 100, on_hand_qty_uom: "kg" }, { product_id: 8, bn: "T-001", qty_on_hand: 5, on_hand_qty_uom: "kg" }],
    logs: [
      { id: 1001, item: "Ashwagandha Churna", batch_number: "B-001", log_date: "2026-11-20", activity: "Filling", status: "Done", storage_qty: null, storage_qty_uom: null, qty_after_process: 10, qty_uom: "kg" },
      { id: 1002, item: "Ashwagandha Churna", batch_number: "B-001", log_date: "2026-11-21", activity: "FG bulk storage", status: "Done", storage_qty: 10, storage_qty_uom: "kg", qty_after_process: 10, qty_uom: "kg" },
      { id: 1003, item: "Ashwagandha Churna", batch_number: "B-001", log_date: "2026-11-22", activity: "FG transfer", status: "Done", storage_qty: null, storage_qty_uom: null, qty_after_process: null, qty_uom: null },
      { id: 1101, item: "Ashwagandha Churna", batch_number: "B-002", log_date: "2026-11-21", activity: "FG bulk storage", status: "Done", storage_qty: 100, storage_qty_uom: "kg", qty_after_process: 100, qty_uom: "kg" },
      { id: 1102, item: "Ashwagandha Churna", batch_number: "B-002", log_date: "2026-11-22", activity: "FG transfer", status: "Done", storage_qty: null, storage_qty_uom: null, qty_after_process: null, qty_uom: null },
      { id: 1201, item: "Ashwagandha Churna", batch_number: "B-DUP", log_date: "2026-11-21", activity: "FG bulk storage", status: "Done", storage_qty: 5, storage_qty_uom: "kg", qty_after_process: 5, qty_uom: "kg" },
      { id: 2001, item: "Triphala Churna", batch_number: "T-001", log_date: "2026-11-21", activity: "FG bulk storage", status: "Done", storage_qty: 5, storage_qty_uom: "kg", qty_after_process: 5, qty_uom: "kg" },
    ],
    event_type_lkp: [{ code: "FG_TRANSFER", label: "FG transfer", affects_bulk_stock: -1, is_packaging: true }, { code: "SAMPLE", label: "Sample", affects_bulk_stock: 0, is_packaging: true }],
    packaging_events: [{ id: 5001, event_type: "FG_TRANSFER", work_log_id: 1003 }, { id: 5101, event_type: "FG_TRANSFER", work_log_id: 1102 }, { id: 5102, event_type: "SAMPLE", work_log_id: 1101 }],
    event_skus: [{ id: 9001, packaging_event_id: 5101, sku_id: 71, count: 10 }, { id: 9002, packaging_event_id: 5101, sku_id: 72, count: 20 }],
    depletionBasis: { 9001: true, 9002: false },        // 9002 = historical line without recorded depletion
    route: { 7: { readiness_status: "READY", product_route_id: 31, base_route_family_route_id: 4, as_of_date: "2026-11-24", steps: [
      { base_step_id: 41, effective_step_key: "S10", sequence_no: 10, activity_name: "Filling", is_mandatory: true, allows_repeat: false, source_type: "BASE" },
      { base_step_id: 42, effective_step_key: "S20", sequence_no: 20, activity_name: "FG bulk storage", is_mandatory: true, allows_repeat: false, source_type: "BASE" },
      { base_step_id: null, effective_step_key: "O30", sequence_no: 30, activity_name: "Labelling", is_mandatory: false, allows_repeat: true, source_type: "OVERRIDE" }] },
      8: { readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING", product_route_id: null, steps: [] } },
    routeViewDenied: false,
    signed: [], pack_requests: {}, stage_requests: {}, nextEvent: 700, nextExcess: 1,
    faults: [], log: [], latency: 0,
    ...over,
  };
  return cfg;
}

const ok = (o) => ({ data: { ok: true, ...o }, error: null });
const refuse = (code, extra = {}) => ({ data: { ok: false, code, ...extra }, error: null });
const raised = (code, message) => ({ data: null, error: { code, message } });

function can(cfg, t, edit) { const c = cfg.caps[t]; return !!c && c[0] === 1 && (!edit || c[1] === 1); }
const batchKey = (p, b) => `${p}|${b}`;
const fgRow = (cfg, p, b) => cfg.fg.find((r) => r.product_id === p && r.bn === b);
const signedFg = (cfg, p, b) => cfg.signed.find((s) => s.product_id === p && s.batch === b && s.role === "FG_BULK" && !s.corrected);

const handlers = {
  mis_sign_batch_stage_v1(cfg, a) {
    if (!can(cfg, "module:mis-batch-stage-signer", true)) return raised("42501", "permission required: module:mis-batch-stage-signer");
    const prior = cfg.stage_requests[a.p_idempotency_key];
    if (prior) return prior.h === hash(a) ? { data: { ...clone(prior.res), idempotent_replay: true }, error: null } : refuse("IDEMPOTENCY_KEY_REUSED");
    const wl = cfg.logs.find((l) => l.id === a.p_work_log_id); const prod = cfg.products.find((p) => p.id === a.p_product_id);
    if (!wl || !prod || wl.item !== prod.item || wl.batch_number !== a.p_batch_number) return refuse("WORK_LOG_IDENTITY_MISMATCH");
    if (cfg.bmr.filter((b) => b.product_id === a.p_product_id && b.bn === a.p_batch_number).length !== 1) return refuse("BMR_IDENTITY_REVIEW");
    const route = cfg.route[a.p_product_id];
    if (!route || route.readiness_status !== "READY") return refuse("PRODUCT_ROUTE_COVERAGE");
    const step = route.steps.find((s) => s.base_step_id === a.p_route_step_id);
    if (!step) return refuse("STEP_NOT_IN_EFFECTIVE_ROUTE");
    if (step.activity_name !== wl.activity) return refuse("ACTIVITY_STEP_MISMATCH");
    const fg = step.activity_name === "FG bulk storage";
    if (fg && a.p_measured_qty_base == null) return refuse("MEASURED_QTY_REQUIRED");
    if (fg && Number(a.p_measured_qty_base) !== Number(wl.storage_qty)) return refuse("MEASURED_QTY_MISMATCH");
    if (cfg.signed.find((s) => !s.corrected && s.work_log_id === wl.id && s.step === step.base_step_id && s.occ === a.p_step_occurrence)) return refuse("STAGE_ALREADY_SIGNED");
    const ev = { event_id: ++cfg.nextEvent, product_id: a.p_product_id, batch: a.p_batch_number, work_log_id: wl.id, step: step.base_step_id, occ: a.p_step_occurrence, role: fg ? "FG_BULK" : "OTHER", wlSnapshot: hash([wl.storage_qty, wl.log_date]), corrected: false };
    cfg.signed.push(ev);
    const res = { ok: true, idempotent_replay: false, event_id: ev.event_id, stage_role: ev.role, route_id: route.product_route_id, bmr_id: cfg.bmr.find((b) => b.product_id === ev.product_id && b.bn === ev.batch).id, source_fingerprint: "fp" };
    cfg.stage_requests[a.p_idempotency_key] = { h: hash(a), res }; return { data: res, error: null };
  },
  mis_correct_batch_stage_v1(cfg, a) {
    if (!can(cfg, "module:mis-batch-stage-signer", true)) return raised("42501", "permission required: module:mis-batch-stage-signer");
    const prior = cfg.stage_requests[a.p_idempotency_key];
    if (prior) return prior.h === hash(a) ? { data: { ...clone(prior.res), idempotent_replay: true }, error: null } : refuse("IDEMPOTENCY_KEY_REUSED");
    if (!a.p_reason || !String(a.p_reason).trim()) return refuse("INVALID_INPUT");
    const ev = cfg.signed.find((s) => s.event_id === a.p_event_id); if (!ev) return refuse("EVENT_NOT_FOUND");
    if (ev.corrected) return refuse("ALREADY_CORRECTED");
    ev.corrected = true; const res = { ok: true, idempotent_replay: false, event_id: ++cfg.nextEvent, corrects_event_id: ev.event_id };
    cfg.stage_requests[a.p_idempotency_key] = { h: hash(a), res }; return { data: res, error: null };
  },
  mis_pack_fg_bulk_v1(cfg, a) {
    if (!can(cfg, "module:mis-fg-bulk-packing", true)) return raised("42501", "permission required: module:mis-fg-bulk-packing");
    const prior = cfg.pack_requests[a.p_request_id];
    if (prior) return prior.h === hash([a.p_packaging_event_id, a.p_lines, a.p_excess ?? null]) ? { data: { ...clone(prior.res), idempotent_replay: true }, error: null } : refuse("IDEMPOTENCY_KEY_REUSED");
    const pe = cfg.packaging_events.find((e) => e.id === a.p_packaging_event_id); if (!pe) return refuse("PACKAGING_EVENT_NOT_FOUND");
    const wl = cfg.logs.find((l) => l.id === pe.work_log_id); const prod = cfg.products.find((p) => p.item === wl.item);
    const lkp = cfg.event_type_lkp.find((l) => l.code === pe.event_type);
    if (lkp.affects_bulk_stock !== -1) return refuse("EVENT_NOT_DEPLETING");
    const fg = fgRow(cfg, prod.id, wl.batch_number); const stage = signedFg(cfg, prod.id, wl.batch_number);
    if (!fg) return refuse("FG_RECEIPT_MISSING", { historical_state: "NOT_VERIFIED" });
    if (!stage) return refuse("FG_STAGE_NOT_SIGNED", { historical_state: "NOT_VERIFIED" });
    const cur = cfg.logs.find((l) => l.id === stage.work_log_id);
    if (hash([cur.storage_qty, cur.log_date]) !== stage.wlSnapshot) return refuse("STAGE_SOURCE_CHANGED");
    let required = 0; const seen = new Set();
    for (const l of a.p_lines || []) {
      const sku = cfg.skus.find((s) => s.id === l.sku_id); if (!sku) return refuse("SKU_NOT_FOUND");
      if (sku.product_id !== prod.id) return refuse("SKU_PRODUCT_MISMATCH");
      if (seen.has(l.sku_id) || cfg.event_skus.some((e) => e.packaging_event_id === pe.id && e.sku_id === l.sku_id)) return refuse("SKU_LINE_EXISTS");
      seen.add(l.sku_id); if (!(Number.isInteger(l.count) && l.count > 0)) return refuse("INVALID_INPUT");
      required += l.count * sku.pack_size;
    }
    required = Math.round(required * 1e6) / 1e6; const avail = fg.qty_on_hand;
    const ex = a.p_excess;
    if (required > avail + 1e-9) {
      const shortfall = Math.round((required - avail) * 1e6) / 1e6;
      if (!ex) return refuse("INSUFFICIENT_BULK", { required_base: required, available_base: avail, shortfall_base: shortfall, base_uom: fg.on_hand_qty_uom, excess_permitted: can(cfg, "module:mis-fg-excess-adjustment", true), product_id: prod.id, batch_number: wl.batch_number });
      if (!can(cfg, "module:mis-fg-excess-adjustment", true)) return refuse("EXCESS_NOT_AUTHORIZED");
      if (!(Number(ex.qty_base) > 0) || !String(ex.reason || "").trim() || !String(ex.evidence_ref || "").trim()) return refuse("EXCESS_INVALID");
      if (avail + Number(ex.qty_base) + 1e-9 < required) return refuse("INSUFFICIENT_AFTER_EXCESS", { required_base: required, available_base: avail + Number(ex.qty_base), shortfall_base: required - avail - Number(ex.qty_base), base_uom: fg.on_hand_qty_uom, excess_permitted: true });
    } else if (ex) return refuse("EXCESS_NOT_NEEDED");
    // atomic commit
    const snap = clone([cfg.fg, cfg.event_skus]);
    try {
      let excessId = null; if (ex && required > avail) { fg.qty_on_hand += Number(ex.qty_base); excessId = cfg.nextExcess++; }
      const ids = []; for (const l of a.p_lines) { const id = 9500 + cfg.event_skus.length + 1; cfg.event_skus.push({ id, packaging_event_id: pe.id, sku_id: l.sku_id, count: l.count }); cfg.depletionBasis[id] = true; ids.push(id); }
      const before = avail; fg.qty_on_hand = Math.round((fg.qty_on_hand - required) * 1e6) / 1e6;
      if (fg.qty_on_hand < 0) throw new Error("MIS_G7_NEGATIVE_BALANCE");
      const res = { ok: true, idempotent_replay: false, request_id: a.p_request_id, product_id: prod.id, batch_number: wl.batch_number, packaging_event_id: pe.id, required_base: required, available_before_base: before, excess_base: ex && excessId ? Number(ex.qty_base) : 0, excess_id: excessId, balance_after_base: fg.qty_on_hand, base_uom: fg.on_hand_qty_uom, event_sku_ids: ids };
      cfg.pack_requests[a.p_request_id] = { h: hash([a.p_packaging_event_id, a.p_lines, a.p_excess ?? null]), res }; cfg.packCommits = (cfg.packCommits || 0) + 1; return { data: res, error: null };
    } catch (e) { cfg.fg = snap[0]; cfg.event_skus = snap[1]; return raised("P0001", String(e.message)); }
  },
  mis_correct_pack_line_v1(cfg, a) {
    if (!can(cfg, "module:mis-fg-bulk-packing", true)) return raised("42501", "permission required: module:mis-fg-bulk-packing");
    const prior = cfg.pack_requests[a.p_request_id];
    const h = hash([a.p_event_sku_id, a.p_new_count, a.p_reason, a.p_excess ?? null]);
    if (prior) return prior.h === h ? { data: { ...clone(prior.res), idempotent_replay: true }, error: null } : refuse("IDEMPOTENCY_KEY_REUSED");
    const line = cfg.event_skus.find((e) => e.id === a.p_event_sku_id); if (!line) return refuse("CORRECTION_LINE_NOT_FOUND");
    if (!(Number.isInteger(a.p_new_count) && a.p_new_count >= 0) || !String(a.p_reason || "").trim()) return refuse("INVALID_INPUT");
    if (a.p_new_count === line.count) return refuse("CORRECTION_NO_CHANGE");
    if (!cfg.depletionBasis[line.id]) return refuse("CORRECTION_NO_DEPLETION_BASIS", { historical_state: "NOT_VERIFIED" });
    const pe = cfg.packaging_events.find((e) => e.id === line.packaging_event_id); const wl = cfg.logs.find((l) => l.id === pe.work_log_id); const prod = cfg.products.find((p) => p.item === wl.item);
    const sku = cfg.skus.find((s) => s.id === line.sku_id); const fg = fgRow(cfg, prod.id, wl.batch_number);
    const delta = (line.count - a.p_new_count) * sku.pack_size;     // + returned to stock
    if (delta < 0 && fg.qty_on_hand + delta < -1e-9) {
      const shortfall = -(fg.qty_on_hand + delta);
      if (!a.p_excess) return refuse("INSUFFICIENT_BULK", { required_base: -delta, available_base: fg.qty_on_hand, shortfall_base: shortfall, base_uom: fg.on_hand_qty_uom, excess_permitted: can(cfg, "module:mis-fg-excess-adjustment", true), product_id: prod.id, batch_number: wl.batch_number });
      if (!can(cfg, "module:mis-fg-excess-adjustment", true)) return refuse("EXCESS_NOT_AUTHORIZED");
      fg.qty_on_hand += Number(a.p_excess.qty_base);
    }
    const old = line.count; fg.qty_on_hand = Math.round((fg.qty_on_hand + delta) * 1e6) / 1e6;
    if (a.p_new_count === 0) cfg.event_skus = cfg.event_skus.filter((e) => e.id !== line.id); else line.count = a.p_new_count;
    const res = { ok: true, idempotent_replay: false, request_id: a.p_request_id, event_sku_id: line.id, packaging_event_id: pe.id, product_id: prod.id, batch_number: wl.batch_number, old_count: old, new_count: a.p_new_count, line_removed: a.p_new_count === 0, stock_delta_base: delta, excess_base: a.p_excess ? Number(a.p_excess.qty_base) : 0, excess_id: null, balance_after_base: fg.qty_on_hand, base_uom: fg.on_hand_qty_uom };
    cfg.pack_requests[a.p_request_id] = { h, res }; return { data: res, error: null };
  },
  mis_g7_enforcement_readiness_v1(cfg) {
    if (!can(cfg, "module:mis-g7-enforcement-admin", false)) return raised("42501", "permission required");
    return ok({ mode: cfg.mode, window_days: 7, core_gate: "CORE_MIGRATION_NOT_ACCEPTED", direct_writes: { count: 12 }, ticketed_corrections: { count: 0 }, ticketed_packs: { count: 0 }, chain_replacements: { count: 0 } });
  },
  app_has_permission(cfg, a) { const t = a.p_target; const c = cfg.caps[t]; return { data: !!c && (a.p_mode === "view" ? c[0] === 1 : c[1] === 1 && c[0] === 1), error: null }; },
  rpc_get_effective_product_process_route(cfg, a) {
    if (cfg.routeViewDenied) return raised("42501", "permission required: module:production-route-manager");
    const r = cfg.route[a.p_product_id] || { readiness_status: "BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE", steps: [] };
    return { data: { product_id: a.p_product_id, as_of_date: a.p_as_of_date || "2026-11-24", ...clone(r) }, error: null };
  },
};

/** Minimal PostgREST-like query builder over cfg tables. */
function table(cfg, name) {
  const src = { products: cfg.products, bmr_details: cfg.bmr, fg_bulk_stock: cfg.fg, product_skus: cfg.skus, daily_work_log: cfg.logs, packaging_events: cfg.packaging_events, event_type_lkp: cfg.event_type_lkp, event_skus: cfg.event_skus }[name];
  const f = []; let ord = []; let rng = null;
  const q = {
    select() { return q; }, eq(c, v) { f.push((r) => r[c] === v); return q; }, in(c, vs) { f.push((r) => vs.includes(r[c])); return q; },
    order(c, o = {}) { ord.push([c, o.ascending !== false]); return q; }, range(a, b) { rng = [a, b]; return q; },
    then(res, rej) {
      const pid = f.__pid; void pid;
      let rows = (src || []).filter((r) => f.every((x) => x(r))).map(clone);
      for (const [c, asc] of [...ord].reverse()) rows.sort((x, y) => (x[c] > y[c] ? 1 : x[c] < y[c] ? -1 : 0) * (asc ? 1 : -1));
      if (rng) rows = rows.slice(rng[0], rng[1] + 1);
      const slow = name === "bmr_details" && cfg.slowProduct ? cfg.slowProduct[rows[0]?.product_id] || 0 : 0;
      return new Promise((r) => setTimeout(r, slow)).then(() => ({ data: rows, error: null })).then(res, rej);
    },
  };
  return q;
}

export function createFake(cfg) {
  const fake = {
    schema: () => fake,
    auth: { getSession: async () => ({ data: { session: cfg.noSession ? null : { user: { id: "u1" } } } }) },
    from: (t) => table(cfg, t),
    async rpc(name, args) {
      cfg.log.push({ kind: "rpc", name, args: clone(args) });
      if (cfg.latency) await new Promise((r) => setTimeout(r, cfg.latency));
      const idx = cfg.faults.findIndex((x) => x.rpc === name && (x.times ?? 1) > 0);
      const fault = idx >= 0 ? cfg.faults[idx] : null; if (fault) fault.times = (fault.times ?? 1) - 1;
      if (fault?.mode === "network-before") throw new TypeError("Failed to fetch");
      if (fault?.mode === "deadlock") return { data: null, error: { code: "40P01", message: "deadlock detected" } };
      const h = handlers[name]; if (!h) return { data: null, error: { code: "42883", message: `function ${name} does not exist` } };
      const out = h(cfg, args || {});
      if (fault?.mode === "network-after") throw new TypeError("Failed to fetch");   // committed, response lost
      return out;
    },
  };
  return fake;
}
export { handlers };
