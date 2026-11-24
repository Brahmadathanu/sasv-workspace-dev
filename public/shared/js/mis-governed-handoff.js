// Governed hand-off from the existing production logging pages (Add Log Entry and Edit Log Entry) to the MIS G7 workflow.
// ONE workflow, not two: the logging pages stay the place where the ordinary work log is written; the governed evidence
// (stage signature of the committed FG work log, source-changed / not-verified state, governed packing and corrections) is
// shown and acted on from the same context, and everything that needs more than a single action deep-links into Batch Governance.
//
// DEFAULT-DISABLED transition path: with GOVERNED_LOGGING_HANDOFF = false nothing is added to either page, no request is made and
// the legacy AUDIT flow is exactly what it was. Flipping the flag is a reviewed code change made only after authenticated acceptance
// and owner authorization. When enabled, every governed element additionally requires (a) the canonical MIS rights (server stays
// authoritative), and (b) the S7 read contracts to be installed; otherwise the pages behave as before.
//
// What it does when enabled
//   Add Log Entry   : after an FG bulk storage log is saved, offer to sign that FG bulk stage with the quantity just logged (no re-entry).
//   Edit Log Entry  : show the batch state for the opened log (SIGNED / SOURCE_CHANGED / UNSIGNED / NOT_VERIFIED); FG log: sign, or void
//                     a source-changed signature so it can be re-signed; packaging log: link to governed packing/corrections.
//                     GUARD: for a batch whose FG stage is governed (SIGNED / SOURCE_CHANGED) the legacy editor's DESTRUCTIVE chain
//                     replacement (delete + recreate of packaging_events / event_skus from the sku_breakdown text) is disabled for a log that
//                     already has a packaging chain: Save, Done and Delete are blocked client-side with the reason, because they would
//                     bypass governed packing, previews, measured excess and corrections. Server-side enforcement (S5/S5b, ENFORCE) is unchanged.
// Missing server contract (documented, not invented): a governed way to create the packaging-event HEADER of a packaging work log, and a
// non-destructive field-only save in the legacy editor. Until those exist the header is still created by the legacy Done save (AUDIT).
import { supabase as defaultClient } from "./supabaseClient.js";
import { RPC, IntentRegistry, callRpc, describeRefusal, getRouteContext, getStageStatus, idArg, loadCapabilities, signScope, correctStageScope, fmtQty } from "./mis-g7-contract.js";

export const GOVERNED_LOGGING_HANDOFF = false;     // release switch; flipping it is a reviewed code change, never a user setting
export const HANDOFF_PARAM = "mis_sign";
export const FG_ACTIVITY = "FG bulk storage";
export const GOV_PAGE = "public/shared/mis-batch-governance.html";
const intents = new IntentRegistry();

const STATE_TEXT = Object.freeze({
  SIGNED: "FG bulk stage signed.",
  SOURCE_CHANGED: "Source changed after the FG bulk stage was signed: void the signature and sign again.",
  UNSIGNED: "FG bulk stage not signed.",
  NOT_VERIFIED: "Historical record: not verified and never assumed correct.",
});
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Query-string value that carries the saved work-log id to the next page load; "" unless enabled and a valid id. */
export function handoffParam(workLogId, _activity, flag = GOVERNED_LOGGING_HANDOFF) {
  return flag === true && Number.isInteger(Number(workLogId)) && Number(workLogId) > 0 ? String(Number(workLogId)) : "";
}
/** Work-log id from the legacy create RPC result (object or single-row array). */
export const savedWorkLogId = (data) => Number((Array.isArray(data) ? data[0] : data)?.daily_work_log_id) || 0;
/** Deep link into Batch Governance (product, batch, tab, packaging event, work log). */
export function governedLink(base, { productId, batch, tab, eventId, logId } = {}) {
  const q = new URLSearchParams(); if (productId) q.set("product", String(productId)); if (batch) q.set("batch", batch); if (tab) q.set("tab", tab); if (eventId) q.set("event", String(eventId)); if (logId) q.set("log", String(logId));
  return `${base}?${q.toString()}`;
}

/** Everything the hand-off needs about one committed work log (read-only; all server truth). */
export async function loadGovernedContext({ client = defaultClient, workLogId } = {}) {
  const { data: rows, error } = await client.from("daily_work_log").select("id,item,batch_number,log_date,activity,status,storage_qty,storage_qty_uom").eq("id", workLogId);
  const w = rows?.[0]; if (error || !w) return { ok: false, reason: "no-log" };
  const { data: prods, error: perr } = await client.from("products").select("id,item").eq("item", w.item); if (perr || prods?.length !== 1) return { ok: false, reason: "product" };
  const [ev, lkp] = await Promise.all([client.from("packaging_events").select("id,event_type,work_log_id").eq("work_log_id", workLogId), client.from("event_type_lkp").select("code,label,affects_bulk_stock,is_packaging")]);
  const e = ev.data?.[0] ?? null; const depleting = !!e && (lkp.data || []).some((l) => Number(l.affects_bulk_stock) === -1 && (l.code === e.event_type || l.label === e.event_type));
  const st = await getStageStatus(client, prods[0].id, w.batch_number);
  return { ok: true, w, productId: prods[0].id, event: e, depleting, status: st };
}

/** Evaluate the destructive-write guard for one work log. Inactive unless the flag, a MIS right and S7 are all present. */
export async function evaluateGovernedGuard({ client = defaultClient, workLogId, flag = GOVERNED_LOGGING_HANDOFF } = {}) {
  if (flag !== true) return { active: false, reason: "disabled" };
  try {
    const caps = await loadCapabilities(client); if (!(caps.raw.signer.view || caps.raw.packing.view)) return { active: false, reason: "no-right", caps };
    const c = await loadGovernedContext({ client, workLogId }); if (!c.ok) return { active: false, reason: c.reason, caps };
    if (c.status.kind === "unavailable") return { active: false, reason: "s7-absent", caps };
    const state = c.status.kind === "ok" ? c.status.data.fg_bulk_state : null; const hasChain = !!c.event;
    const blocked = hasChain && (state === "SIGNED" || state === "SOURCE_CHANGED");
    return { active: true, caps, ctx: c, state, hasChain, blocked, message: blocked ? "This batch's FG stage is governed. Changing or removing its packaging chain here would replace the chain destructively and bypass governed packing, previews, measured excess and corrections. Use Batch Governance to post or correct packing." : "" };
  } catch { return { active: false, reason: "error" }; }       // the guard must never break the legacy page
}
/** For destructive actions outside the edit modal (row delete, Done modal). */
export async function governedBlocksChainWrite(opts) { const g = await evaluateGovernedGuard(opts); return { blocked: g.active && g.blocked, message: g.message || "", state: g.state ?? null }; }

/* ───────── Add Log Entry: after-save offer ───────── */
export async function maybeShowHandoff({ client = defaultClient, search = (typeof location !== "undefined" ? location.search : ""), doc = (typeof document !== "undefined" ? document : null), flag = GOVERNED_LOGGING_HANDOFF, govUrl = GOV_PAGE } = {}) {
  if (flag !== true || !doc) return { shown: false, reason: "disabled" };
  const wl = Number(new URLSearchParams(search).get(HANDOFF_PARAM));
  if (!Number.isInteger(wl) || wl <= 0) return { shown: false, reason: "no-log" };
  return mountGovernedPanel({ client, doc, workLogId: wl, flag, govUrl, floating: true });
}

/* ───────── Edit Log Entry: panel + destructive-write guard ───────── */
export async function mountEditGovernance({ client = defaultClient, doc = (typeof document !== "undefined" ? document : null), container, workLogId, controls = [], forms = [], flag = GOVERNED_LOGGING_HANDOFF, govUrl = GOV_PAGE } = {}) {
  if (flag !== true || !doc) return { shown: false, reason: "disabled" };
  const r = await mountGovernedPanel({ client, doc, workLogId, flag, govUrl, floating: false, container, controls, forms });
  return r;
}

/* ───────── shared panel ───────── */
export async function mountGovernedPanel({ client, doc, workLogId, flag, govUrl, floating, container, controls = [], forms = [] }) {
  doc.getElementById("mis-handoff")?.remove(); unlockControls(doc, controls, forms);     // a previously opened row must not leave its panel or lock behind
  try {
    const g = await evaluateGovernedGuard({ client, workLogId, flag });
    if (!g.active) return { shown: false, reason: g.reason };
    const { w, productId, event, depleting, status } = g.ctx; const caps = g.caps; const state = g.state;
    const isFg = w.activity === FG_ACTIVITY && Number(w.storage_qty) > 0;
    // Only FG receipt logs and packaging logs carry governed meaning; any other log of the batch is left alone.
    if (!isFg && !depleting) return { shown: false, reason: "not-applicable" };
    const panel = mount(doc, floating, container);
    const link = (tab) => governedLink(govUrl, { productId, batch: w.batch_number, tab, eventId: event?.id, logId: isFg ? w.id : undefined });
    const stateLine = state ? `<strong>${esc(STATE_TEXT[state] ?? state)}</strong>` : "";
    const guardLine = g.blocked ? `<div class="mis-ho-guard" role="alert">${esc(g.message)}</div>` : "";
    const pkgLine = depleting && !g.blocked ? `<div>This packaging log has a packing chain. For a governed batch, post and correct packing in Batch Governance.</div>` : "";
    let actions = `<a class="mis-ho-link" data-act="open" href="${esc(link(depleting ? (event ? "corr" : "pack") : "sign"))}">Open in Batch Governance</a>`;
    if (isFg && caps.canSign) {
      if (state === "SOURCE_CHANGED") actions = `<label class="mis-ho-lbl" for="misHoReason">Reason for voiding the signature</label><input id="misHoReason" class="mis-ho-in" type="text" maxlength="300" autocomplete="off"><button type="button" id="misHoVoid" class="mis-ho-btn">Void signature</button>` + actions;
      else if (state === "UNSIGNED" || state === "NOT_VERIFIED") actions = `<label class="mis-ho-lbl" for="misHoEv">Weighing evidence reference</label><input id="misHoEv" class="mis-ho-in" type="text" maxlength="200" autocomplete="off"><button type="button" id="misHoSign" class="mis-ho-btn">Sign FG bulk stage (${esc(fmtQty(w.storage_qty))} ${esc(w.storage_qty_uom)})</button>` + actions;
    }
    panel.innerHTML = body(`${stateLine}${guardLine}${pkgLine}`, actions, floating);
    wire(panel);
    if (g.blocked) lockControls(doc, controls, forms, g.message);
    const msg = panel.querySelector("#misHoMsg");
    const rerender = () => mountGovernedPanel({ client, doc, workLogId, flag, govUrl, floating, container, controls, forms });
    const signBtn = panel.querySelector("#misHoSign");
    if (signBtn) signBtn.addEventListener("click", async () => {
      if (signBtn.disabled) return; const ev = panel.querySelector("#misHoEv");
      if (!ev.value.trim()) { msg.textContent = "Evidence reference is required."; ev.setAttribute("aria-invalid", "true"); ev.focus(); return; }
      const ctx = await getRouteContext(client, productId, w.batch_number, w.id);
      if (ctx.kind !== "ok") { const d = ctx.kind === "refused" ? describeRefusal(ctx.code) : { title: "Governed signing is not available", fix: "" }; msg.textContent = `${d.title}. ${d.fix}`; return; }
      const step = (ctx.data.steps || []).find((s) => s.stage_role === "FG_BULK" && s.activity_matches); if (!step) { msg.textContent = "No matching FG bulk step in the effective route."; return; }
      const args = { productId, batch: w.batch_number, workLogId: w.id, routeStepId: step.route_step_id, occurrence: 1 };
      signBtn.disabled = true; msg.textContent = "Signing…";
      const res = await callRpc(client, RPC.sign, { p_idempotency_key: intents.keyFor(signScope(args)), p_product_id: productId, p_batch_number: w.batch_number, p_work_log_id: w.id, p_route_step_id: idArg(step.route_step_id), p_step_occurrence: 1, p_measured_qty_base: Number(w.storage_qty), p_evidence_ref: ev.value.trim() });
      if (res.kind === "ok") { intents.release(signScope(args)); await rerender(); const m = doc.querySelector("#misHoMsg"); if (m) m.textContent = `Signed (event ${res.data.event_id}).`; return; }
      signBtn.disabled = false;
      msg.textContent = res.kind === "refused" ? `${describeRefusal(res.code).title}. ${describeRefusal(res.code).fix}` : res.message || "Signing failed.";
      if (res.kind === "uncertain") signBtn.textContent = "Retry (same request)";
    });
    const voidBtn = panel.querySelector("#misHoVoid");
    if (voidBtn) voidBtn.addEventListener("click", async () => {
      if (voidBtn.disabled) return; const reason = panel.querySelector("#misHoReason");
      if (!reason.value.trim()) { msg.textContent = "Reason is required."; reason.setAttribute("aria-invalid", "true"); reason.focus(); return; }
      const ev = status.kind === "ok" ? (status.data.events || []).find((e) => e.event_kind === "SIGN" && e.state === "SOURCE_CHANGED" && Number(e.work_log_id) === Number(w.id)) : null;
      if (!ev) { msg.textContent = "The changed signature belongs to another work log of this batch; open Batch Governance."; return; }
      voidBtn.disabled = true; msg.textContent = "Voiding…";
      const res = await callRpc(client, RPC.correctStage, { p_idempotency_key: intents.keyFor(correctStageScope(ev.event_id)), p_event_id: idArg(ev.event_id), p_reason: reason.value.trim() });
      if (res.kind === "ok") { intents.release(correctStageScope(ev.event_id)); await rerender(); const m = doc.querySelector("#misHoMsg"); if (m) m.textContent = "Signature voided. Sign the stage again."; return; }
      voidBtn.disabled = false; msg.textContent = res.kind === "refused" ? `${describeRefusal(res.code).title}. ${describeRefusal(res.code).fix}` : res.message || "Failed.";
    });
    return { shown: true, reason: g.blocked ? "guarded" : "offered", state, blocked: g.blocked, productId, eventId: event?.id ?? null };
  } catch { return { shown: false, reason: "error" }; }          // never disturb the legacy page
}

/* ───────── DOM helpers (semantic tokens only) ───────── */
function mount(doc, floating, container) {
  doc.getElementById("mis-handoff")?.remove();
  const el = doc.createElement("aside"); el.id = "mis-handoff"; el.setAttribute("role", "region"); el.setAttribute("aria-label", "Governed evidence");
  const base = "padding:10px 12px;border:1px solid var(--sasv-border);border-radius:var(--sasv-radius-lg);background:var(--sasv-surface);color:var(--sasv-text);font:inherit;font-size:var(--sasv-text-sm,0.8125rem)";
  el.style.cssText = floating ? `position:fixed;left:12px;right:12px;bottom:12px;max-width:640px;margin:0 auto;z-index:var(--sasv-z-toast,1200);box-shadow:var(--sasv-shadow-md);${base}` : `margin:0 0 10px;${base}`;
  if (floating || !container) doc.body.appendChild(el); else container.insertBefore(el, container.firstChild);
  return el;
}
const body = (text, controls, floating) => `<div>${text}</div><div class="mis-ho-row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px">${controls}${floating ? `<button type="button" id="misHoClose" class="mis-ho-btn" style="margin-left:auto;background:var(--sasv-surface-soft);color:var(--sasv-text);border:1px solid var(--sasv-control-border)">Dismiss</button>` : ""}</div><div id="misHoMsg" role="status" aria-live="polite" style="margin-top:4px"></div>`;
function wire(panel) {
  for (const b of panel.querySelectorAll(".mis-ho-btn")) b.style.cssText += ";min-height:32px;padding:0 12px;border-radius:var(--sasv-radius-md);cursor:pointer;font:inherit;" + (b.id === "misHoSign" || b.id === "misHoVoid" ? "background:var(--sasv-action-primary);color:var(--sasv-text-on-primary);border:1px solid var(--sasv-action-primary)" : "");
  for (const i of panel.querySelectorAll(".mis-ho-in")) i.style.cssText = "min-height:32px;padding:0 8px;border:1px solid var(--sasv-control-border);border-radius:var(--sasv-radius-md);background:var(--sasv-control-bg);color:var(--sasv-text);font:inherit;flex:1 1 180px";
  for (const a of panel.querySelectorAll(".mis-ho-link")) a.style.cssText = "color:var(--sasv-link);font-size:inherit";
  for (const g of panel.querySelectorAll(".mis-ho-guard")) g.style.cssText = "margin-top:4px;padding:6px 8px;border-radius:var(--sasv-radius-md);border:1px solid var(--sasv-warning-border);background:var(--sasv-warning-bg);color:var(--sasv-warning)";
  panel.querySelector("#misHoClose")?.addEventListener("click", () => panel.remove());
}
/** Disable the destructive controls and block their form submits (capture phase) while the guard is active. */
function lockControls(doc, controls, forms, message) {
  for (const sel of controls) for (const el of doc.querySelectorAll(sel)) { el.disabled = true; el.dataset.misLocked = "1"; el.setAttribute("aria-disabled", "true"); el.title = message; }
  for (const sel of forms) for (const f of doc.querySelectorAll(sel)) {
    if (!f.dataset.misBound) { f.dataset.misBound = "1"; f.addEventListener("submit", (e) => { if (f.dataset.misGuard === "1") { e.preventDefault(); e.stopImmediatePropagation(); } }, true); }
    f.dataset.misGuard = "1";
  }
}
function unlockControls(doc, controls, forms) {
  for (const sel of controls) for (const el of doc.querySelectorAll(sel)) if (el.dataset.misLocked) { el.disabled = false; delete el.dataset.misLocked; el.removeAttribute("aria-disabled"); el.removeAttribute("title"); }
  for (const sel of forms) for (const f of doc.querySelectorAll(sel)) if (f.dataset.misGuard) f.dataset.misGuard = "0";
}
