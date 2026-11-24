// Governed-evidence hand-off from existing production logging (Add Log Entry) to the MIS G7 stage signer.
// DEFAULT-DISABLED transition path: with GOVERNED_LOGGING_HANDOFF = false nothing is added to the page, no request is made and the legacy
// AUDIT flow is byte-for-byte what it was. When an owner enables it, it offers ONE action right after an FG bulk storage log is saved:
// sign that FG bulk stage using the quantity the operator just logged (no re-entry, no second form). It appears only when
//   * the user holds the stage-signer edit right (canonical permission check; the server stays authoritative), and
//   * the S7 server read contracts are installed (status/context RPCs), and
//   * the batch FG bulk stage is not already signed.
// Anything else (no right, S7 absent, route gap, already signed) shows nothing or a one-line pointer to Batch Governance.
import { supabase as defaultClient } from "./supabaseClient.js";
import { RPC, IntentRegistry, callRpc, describeRefusal, getRouteContext, getStageStatus, idArg, loadCapabilities, signScope, fmtQty } from "./mis-g7-contract.js";

export const GOVERNED_LOGGING_HANDOFF = false;     // release switch; flipping it is a reviewed code change, never a user setting
export const HANDOFF_PARAM = "mis_sign";
export const FG_ACTIVITY = "FG bulk storage";
const intents = new IntentRegistry();

/** Query-string fragment to carry the saved work-log id to the next page load; "" unless enabled and applicable. */
export function handoffParam(workLogId, activity, flag = GOVERNED_LOGGING_HANDOFF) {
  return flag === true && activity === FG_ACTIVITY && Number.isInteger(Number(workLogId)) && Number(workLogId) > 0 ? String(Number(workLogId)) : "";
}
/** Work-log id from the legacy create RPC result (object or single-row array). */
export const savedWorkLogId = (data) => Number((Array.isArray(data) ? data[0] : data)?.daily_work_log_id) || 0;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function maybeShowHandoff({ client = defaultClient, search = (typeof location !== "undefined" ? location.search : ""), doc = (typeof document !== "undefined" ? document : null), flag = GOVERNED_LOGGING_HANDOFF, govUrl = "public/shared/mis-batch-governance.html" } = {}) {
  if (flag !== true || !doc) return { shown: false, reason: "disabled" };
  const raw = new URLSearchParams(search).get(HANDOFF_PARAM); const wl = Number(raw);
  if (!Number.isInteger(wl) || wl <= 0) return { shown: false, reason: "no-log" };
  try {
    const caps = await loadCapabilities(client);
    if (!caps.canSign) return { shown: false, reason: "no-right" };
    const { data: rows, error } = await client.from("daily_work_log").select("id,item,batch_number,log_date,activity,storage_qty,storage_qty_uom").eq("id", wl);
    const w = rows?.[0]; if (error || !w || w.activity !== FG_ACTIVITY || !(Number(w.storage_qty) > 0)) return { shown: false, reason: "not-applicable" };
    const { data: prods, error: perr } = await client.from("products").select("id,item").eq("item", w.item); if (perr || prods?.length !== 1) return { shown: false, reason: "product" };
    const pid = prods[0].id;
    const st = await getStageStatus(client, pid, w.batch_number);
    if (st.kind === "unavailable") return { shown: false, reason: "s7-absent" };
    if (st.kind === "ok" && st.data.fg_bulk_state === "SIGNED") return { shown: false, reason: "already-signed" };
    const ctx = await getRouteContext(client, pid, w.batch_number, wl);
    if (ctx.kind === "unavailable") return { shown: false, reason: "s7-absent" };
    const panel = mount(doc);
    if (ctx.kind !== "ok") {
      const d = ctx.kind === "refused" ? describeRefusal(ctx.code) : { title: "Governed signing is not available", fix: "" };
      panel.innerHTML = body(`<strong>FG bulk stage cannot be signed yet.</strong> ${esc(d.title)}. ${esc(d.fix)}`, `<a class="mis-ho-link" href="${esc(govUrl)}">Review in Batch Governance</a>`);
      wire(panel); return { shown: true, reason: "blocked", code: ctx.code };
    }
    const step = (ctx.data.steps || []).find((s) => s.stage_role === "FG_BULK" && s.activity_matches);
    if (!step) { panel.remove(); return { shown: false, reason: "no-step" }; }
    panel.innerHTML = body(`<strong>FG bulk stage for batch ${esc(w.batch_number)} is not signed.</strong> Sign it now with the quantity just logged: ${esc(fmtQty(w.storage_qty))} ${esc(w.storage_qty_uom)}.`,
      `<label class="mis-ho-lbl" for="misHoEv">Weighing evidence reference</label><input id="misHoEv" class="mis-ho-in" type="text" maxlength="200" autocomplete="off">
       <button type="button" id="misHoSign" class="mis-ho-btn">Sign FG bulk stage</button><a class="mis-ho-link" href="${esc(govUrl)}">Review in Batch Governance</a>`);
    wire(panel);
    const msg = panel.querySelector("#misHoMsg"); const btn = panel.querySelector("#misHoSign"); const ev = panel.querySelector("#misHoEv");
    const args = { productId: pid, batch: w.batch_number, workLogId: wl, routeStepId: step.route_step_id, occurrence: 1 };
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      if (!ev.value.trim()) { msg.textContent = "Evidence reference is required."; ev.setAttribute("aria-invalid", "true"); ev.focus(); return; }
      btn.disabled = true; msg.textContent = "Signing…";
      const key = intents.keyFor(signScope(args));          // one key per intent: a retry after a lost response replays, never duplicates
      const res = await callRpc(client, RPC.sign, { p_idempotency_key: key, p_product_id: pid, p_batch_number: w.batch_number, p_work_log_id: wl, p_route_step_id: idArg(step.route_step_id), p_step_occurrence: 1, p_measured_qty_base: Number(w.storage_qty), p_evidence_ref: ev.value.trim() });
      if (res.kind === "ok") { intents.release(signScope(args)); msg.textContent = `Signed (event ${res.data.event_id}).`; panel.dataset.state = "signed"; return; }
      btn.disabled = false;
      msg.textContent = res.kind === "refused" ? `${describeRefusal(res.code).title}. ${describeRefusal(res.code).fix}` : res.message || "Signing failed.";
      if (res.kind === "uncertain") btn.textContent = "Retry (same request)";
    });
    return { shown: true, reason: "offered" };
  } catch { return { shown: false, reason: "error" }; }                 // the hand-off must never disturb the legacy save flow
}

function mount(doc) {
  doc.getElementById("mis-handoff")?.remove();
  const el = doc.createElement("aside"); el.id = "mis-handoff"; el.setAttribute("role", "region"); el.setAttribute("aria-label", "Governed evidence");
  el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;max-width:640px;margin:0 auto;z-index:var(--sasv-z-toast,1200);padding:10px 12px;border:1px solid var(--sasv-border);border-radius:var(--sasv-radius-lg);background:var(--sasv-surface);color:var(--sasv-text);box-shadow:var(--sasv-shadow-md);font:inherit;font-size:var(--sasv-text-sm,0.8125rem)";
  doc.body.appendChild(el); return el;
}
const body = (text, controls) => `<div>${text}</div><div class="mis-ho-row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px">${controls}<button type="button" id="misHoClose" class="mis-ho-btn" style="margin-left:auto;background:var(--sasv-surface-soft);color:var(--sasv-text);border:1px solid var(--sasv-control-border)">Dismiss</button></div><div id="misHoMsg" role="status" aria-live="polite" style="margin-top:4px"></div>`;
function wire(panel) {
  for (const b of panel.querySelectorAll(".mis-ho-btn")) b.style.cssText += ";min-height:32px;padding:0 12px;border-radius:var(--sasv-radius-md);cursor:pointer;font:inherit;" + (b.id === "misHoSign" ? "background:var(--sasv-action-primary);color:var(--sasv-text-on-primary);border:1px solid var(--sasv-action-primary)" : "");
  for (const i of panel.querySelectorAll(".mis-ho-in")) i.style.cssText = "min-height:32px;padding:0 8px;border:1px solid var(--sasv-control-border);border-radius:var(--sasv-radius-md);background:var(--sasv-control-bg);color:var(--sasv-text);font:inherit;flex:1 1 180px";
  for (const a of panel.querySelectorAll(".mis-ho-link")) a.style.cssText = "color:var(--sasv-link);font-size:inherit";
  panel.querySelector("#misHoClose")?.addEventListener("click", () => panel.remove());
}
