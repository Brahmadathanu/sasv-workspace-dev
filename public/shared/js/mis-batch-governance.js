import { supabase } from "./supabaseClient.js";
import { mountModuleHome } from "./sasv-module-chrome.js";
import { Platform } from "./platform.js";
import {
  RPC, IntentRegistry, callRpc, describeRefusal, normalizeLines, validateExcess, packReceipt, correctionReceipt,
  fmtQty, packScope, correctPackScope, correctStageScope, signScope, signableSteps, loadCapabilities, modeLabel,
  GOVERNANCE_STATES, HISTORICAL_AUDIT_SNAPSHOT, stateFromRefusal,
} from "./mis-g7-contract.js";

/* ── state ───────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const intents = new IntentRegistry();
const S = {
  caps: { canSign: false, canPack: false, canExcess: false, canViewReadiness: false },
  products: [], product: null, batch: null,
  bmr: [], fgRows: [], logs: [], events: [], eventLines: [], skus: [], route: null, routeErr: null,
  eventId: null, tab: "sign", busy: false,
  sign: { stepId: null, logId: null, occ: "1", qty: "", evidence: "" },
  counts: {}, pending: null /* uncertain outcome awaiting retry */, signed: [], readiness: null, readinessErr: null,
  tok: { product: 0, batch: 0, route: 0, readiness: 0 },
  lastPack: null,
};
const goLogin = () => { window.location.href = Platform.isElectron ? "/login.html" : "/utilities-hub/index.html"; };

/* ── ui helpers ──────────────────────────────────────────────── */
function banner(kind, html, actions = []) {
  const el = $("banner");
  if (!html) { el.hidden = true; el.innerHTML = ""; return; }
  el.className = `mbg-banner mbg-${kind}`;
  el.innerHTML = html + (actions.length ? `<div class="mbg-banner-actions">${actions.map((a, i) => `<button type="button" class="mbg-btn mbg-btn-sm" data-ba="${i}">${esc(a.label)}</button>`).join("")}</div>` : "");
  el.hidden = false;
  actions.forEach((a, i) => el.querySelector(`[data-ba="${i}"]`)?.addEventListener("click", a.run));
}
const kv = (rows, strongKey) => `<dl class="mbg-kv">${rows.map(([k, v, strong]) => `<dt>${esc(k)}</dt><dd${strong || k === strongKey ? ' class="mbg-strong"' : ""}>${v}</dd>`).join("")}</dl>`;
const badge = (tone, text) => `<span class="mbg-badge mbg-badge-${tone}">${esc(text)}</span>`;
const stateBadge = (key) => { const g = GOVERNANCE_STATES[key]; return g ? `<span class="mbg-badge mbg-badge-${g.tone}" title="${esc(g.text)}">${esc(g.label)}</span>` : ""; };

function createSearchSelect(root, { placeholder, onSelect, id }) {
  root.innerHTML = `<input id="${id}" type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="${id}-list" autocomplete="off" placeholder="${esc(placeholder)}"><ul id="${id}-list" role="listbox" hidden></ul>`;
  const input = root.querySelector("input"); const list = root.querySelector("ul");
  let opts = []; let shown = []; let active = -1; let value = null;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = opts.filter((o) => !q || o.label.toLowerCase().includes(q)).slice(0, 80);
    list.innerHTML = shown.length ? shown.map((o, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</li>`).join("") : `<li class="mbg-empty" role="option" aria-disabled="true">No match</li>`;
    list.hidden = false; input.setAttribute("aria-expanded", "true");
  };
  const pick = (o) => { value = o.value; input.value = o.label; close(); onSelect(o); };
  input.addEventListener("input", () => { active = -1; render(); });
  input.addEventListener("focus", () => { input.select(); render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) render(); active = Math.min(shown.length - 1, active + 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); render(); }
    else if (e.key === "Enter") { if (!list.hidden && shown[Math.max(active, shown.length === 1 ? 0 : -1)]) { e.preventDefault(); pick(shown[Math.max(active, 0)]); } }
    else if (e.key === "Escape") { if (!list.hidden) { e.stopPropagation(); close(); } }
  });
  list.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); pick(shown[Number(li.dataset.i)]); } });
  document.addEventListener("click", (e) => { if (!root.contains(e.target)) { close(); if (value != null) input.value = opts.find((o) => o.value === value)?.label ?? input.value; } });
  return {
    set(options) { opts = options; },
    clear() { value = null; input.value = ""; close(); },
    setValue(v) { const o = opts.find((x) => x.value === v); value = o ? o.value : null; input.value = o ? o.label : ""; },
    disable(b) { input.disabled = b; },
    get value() { return value; },
  };
}

/* ── modal ───────────────────────────────────────────────────── */
let modalReturn = null; let modalCtl = null;
function openModal({ title, body, footer, onClose }) {
  if ($("modalRoot").hidden) modalReturn = document.activeElement;
  modalCtl = { onClose };
  $("modalTitle").textContent = title; $("modalBody").innerHTML = body; $("modalMsg").textContent = ""; $("modalMsg").className = "mbg-modal-msg";
  $("modalFtr").innerHTML = ""; for (const b of footer) { const el = document.createElement("button"); el.type = "button"; el.id = b.id; el.className = `mbg-btn ${b.cls || ""}`; el.textContent = b.label; el.addEventListener("click", b.run); $("modalFtr").appendChild(el); }
  $("modalRoot").hidden = false; document.body.classList.add("mbg-modal-open");
  const first = $("modalBody").querySelector("input,textarea,select") || $("modalFtr").querySelector("button"); first?.focus();
}
function closeModal() {
  if (S.busy) return;
  $("modalRoot").hidden = true; document.body.classList.remove("mbg-modal-open"); $("modalBody").innerHTML = "";
  const c = modalCtl; modalCtl = null; c?.onClose?.(); modalReturn?.focus?.();
}
const modalMsg = (t, cls = "") => { const m = $("modalMsg"); m.textContent = t; m.className = `mbg-modal-msg ${cls}`; };
function setModalBusy(b, label) {
  S.busy = b; $("modalFtr").querySelectorAll("button").forEach((x) => { x.disabled = b; });
  const p = $("modalFtr").querySelector(".mbg-btn-primary,.mbg-btn-danger"); if (p) { if (b) { p.dataset.l = p.textContent; p.innerHTML = `<span class="mbg-spin"></span>${esc(label || "Working…")}`; } else if (p.dataset.l) p.textContent = p.dataset.l; }
}
document.addEventListener("keydown", (e) => {
  if ($("modalRoot").hidden) return;
  if (e.key === "Escape") { closeModal(); return; }
  if (e.key === "Tab") { const f = [...$("modalBox").querySelectorAll("button,input,textarea,select")].filter((x) => !x.disabled); if (!f.length) return; const a = f[0]; const z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
});
$("modalClose").addEventListener("click", closeModal);
$("modalRoot").addEventListener("mousedown", (e) => { if (e.target === $("modalRoot")) closeModal(); });

/* ── data (read-only; the server stays authoritative) ────────── */
async function fetchAll(build) {
  const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await build().range(from, from + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
  return out;
}
async function loadProducts() {
  S.products = await fetchAll(() => supabase.from("products").select("id,item").order("item", { ascending: true }));
  productSel.set(S.products.map((p) => ({ value: p.id, label: p.item })));
}
async function loadProduct(p) {
  const tok = ++S.tok.product; resetBatch(); S.product = p;
  setIdentity("Loading product…");
  try {
    const [bmr, fg, skus] = await Promise.all([
      supabase.from("bmr_details").select("id,bn,lifecycle_status").eq("product_id", p.id),
      supabase.from("fg_bulk_stock").select("bn,qty_on_hand,on_hand_qty_uom,product_id").eq("product_id", p.id),
      supabase.from("product_skus").select("id,pack_size,uom,is_active,is_sample").eq("product_id", p.id).order("pack_size", { ascending: true }),
    ]);
    if (tok !== S.tok.product) return;                       // latest request wins
    for (const r of [bmr, fg, skus]) if (r.error) throw r.error;
    S.bmr = bmr.data || []; S.fgRows = fg.data || []; S.skus = (skus.data || []).filter((s) => s.is_active);
    const bns = [...new Set([...S.bmr.map((b) => b.bn), ...S.fgRows.map((r) => r.bn)].filter(Boolean))].sort();
    batchSel.set(bns.map((bn) => ({ value: bn, label: bn, sub: S.fgRows.find((r) => r.bn === bn) ? `${fmtQty(S.fgRows.find((r) => r.bn === bn).qty_on_hand)} ${S.fgRows.find((r) => r.bn === bn).on_hand_qty_uom ?? ""}` : "" })));
    setIdentity(bns.length ? "" : "No batches found for this product.");
    render();
  } catch (e) { if (tok === S.tok.product) { setIdentity(""); banner("danger", `Could not load product data. ${esc(e.message || e)}`, [{ label: "Retry", run: () => loadProduct(p) }]); } }
}
function resetBatch() {
  S.batch = null; S.logs = []; S.events = []; S.eventLines = []; S.route = null; S.routeErr = null; S.eventId = null; S.counts = {}; S.pending = null; S.lastPack = null;
  S.sign = { stepId: null, logId: null, occ: "1", qty: "", evidence: "" }; batchSel.clear(); $("eventField").hidden = true;
}
async function loadBatch(bn) {
  const tok = ++S.tok.batch; S.batch = bn; S.logs = []; S.events = []; S.eventLines = []; S.route = null; S.routeErr = null; S.eventId = null; S.counts = {}; S.pending = null; S.lastPack = null;
  banner(); render(true);
  try {
    const logs = await fetchAll(() => supabase.from("daily_work_log").select("id,log_date,activity,status,storage_qty,storage_qty_uom,qty_after_process,qty_uom").eq("item", S.product.item).eq("batch_number", bn).order("log_date", { ascending: false }).order("id", { ascending: false }));
    if (tok !== S.tok.batch) return;
    S.logs = logs;
    await Promise.all([loadEvents(tok), loadRoute(null)]);
    if (tok !== S.tok.batch) return;
    render();
  } catch (e) { if (tok === S.tok.batch) { banner("danger", `Could not load batch evidence. ${esc(e.message || e)}`, [{ label: "Retry", run: () => loadBatch(bn) }]); render(); } }
}
async function loadEvents(tok) {
  const ids = S.logs.map((l) => l.id); S.events = []; S.eventLines = [];
  if (!ids.length) return;
  const [pe, lkp] = await Promise.all([supabase.from("packaging_events").select("id,event_type,work_log_id").in("work_log_id", ids), supabase.from("event_type_lkp").select("code,label,affects_bulk_stock,is_packaging")]);
  if (pe.error) throw pe.error; if (lkp.error) throw lkp.error;
  if (tok !== S.tok.batch) return;
  const depleting = new Set((lkp.data || []).filter((l) => Number(l.affects_bulk_stock) === -1).map((l) => l.code));
  const lbl = Object.fromEntries((lkp.data || []).map((l) => [l.code, l.label]));
  S.events = (pe.data || []).filter((e) => depleting.has(e.event_type)).map((e) => ({ ...e, label: lbl[e.event_type] || e.event_type, log: S.logs.find((l) => l.id === e.work_log_id) })).sort((a, b) => b.id - a.id);
  const sel = $("eventSel");
  sel.innerHTML = `<option value="">${S.events.length ? "Select packaging event" : "No bulk-depleting packaging event"}</option>` + S.events.map((e) => `<option value="${e.id}">#${e.id} · ${esc(e.label)} · log ${e.work_log_id}${e.log ? ` · ${esc(e.log.log_date)}` : ""}</option>`).join("");
}
async function loadEventLines() {
  S.eventLines = []; if (!S.eventId) return;
  const { data, error } = await supabase.from("event_skus").select("id,sku_id,count,packaging_event_id").eq("packaging_event_id", S.eventId);
  if (error) throw error; S.eventLines = data || [];
}
async function loadRoute(asOf) {
  const tok = ++S.tok.route; S.route = null; S.routeErr = null;
  const args = { p_product_id: S.product.id }; if (asOf) args.p_as_of_date = asOf;
  try {
    const { data, error } = await supabase.rpc(RPC.effectiveRoute, args);
    if (tok !== S.tok.route) return;
    if (error) { S.routeErr = error.code === "42501" ? "denied" : String(error.message || "error"); }
    else S.route = signableSteps(data);
  } catch (e) { if (tok === S.tok.route) S.routeErr = String(e.message || e); }
}
const skuLabel = (id) => { const s = S.skus.find((x) => x.id === id); return s ? `${fmtQty(s.pack_size, 4)} ${s.uom} (#${s.id})` : `SKU #${id}`; };
const fgRow = () => S.fgRows.find((r) => r.bn === S.batch) || null;
const bmrIds = () => S.bmr.filter((b) => b.bn === S.batch);

/* ── identity strip ──────────────────────────────────────────── */
function setIdentity(msg) {
  const el = $("identity");
  if (msg) { el.textContent = msg; return; }
  if (!S.product) { el.textContent = ""; return; }
  const parts = [badge("muted", `Product #${S.product.id}`)];
  if (S.batch) {
    const b = bmrIds();
    parts.push(badge("muted", `Batch ${S.batch}`));
    parts.push(b.length === 1 ? badge("ok", `BMR #${b[0].id}`) : badge("danger", b.length === 0 ? "BMR not found" : `BMR ambiguous (${b.length})`));
    const f = fgRow(); parts.push(f ? badge("info", `Bulk ${fmtQty(f.qty_on_hand)} ${f.on_hand_qty_uom ?? ""}`) : badge("muted", "No FG bulk balance"));
  }
  el.innerHTML = parts.join(" ");
}

/* ── tabs ────────────────────────────────────────────────────── */
function render(loading = false) {
  setIdentity();
  $("eventField").hidden = !(S.batch && (S.tab === "pack" || S.tab === "corr"));
  $("eventSel").value = S.eventId ?? "";
  $("eventSel").disabled = !!S.pending;
  for (const t of ["sign", "pack", "corr", "exc"]) { const on = S.tab === t; $(`tab-${t}`).setAttribute("aria-selected", on); $(`tab-${t}`).tabIndex = on ? 0 : -1; $(`panel-${t}`).hidden = !on; }
  const fn = { sign: renderSign, pack: renderPack, corr: renderCorr, exc: renderExc }[S.tab];
  if (S.tab !== "exc" && !S.batch) { $(`panel-${S.tab}`).innerHTML = `<p class="mbg-note">${S.product ? "Select a batch." : "Select a product and batch."}</p>`; return; }
  if (loading && S.tab !== "exc") { $(`panel-${S.tab}`).innerHTML = `<p class="mbg-note"><span class="mbg-spin"></span>Loading…</p>`; return; }
  fn();
}
function selectTab(t) { S.tab = t; banner(); render(); if (t === "exc") loadReadiness(); }
document.querySelectorAll(".mbg-tabs [role=tab]").forEach((b) => {
  b.addEventListener("click", () => selectTab(b.dataset.tab));
  b.addEventListener("keydown", (e) => {
    const order = ["sign", "pack", "corr", "exc"]; const i = order.indexOf(b.dataset.tab);
    const n = e.key === "ArrowRight" ? order[(i + 1) % 4] : e.key === "ArrowLeft" ? order[(i + 3) % 4] : null;
    if (n) { e.preventDefault(); selectTab(n); $(`tab-${n}`).focus(); }
  });
});

/* ── Stage signing ───────────────────────────────────────────── */
function renderSign() {
  const p = $("panel-sign"); const r = S.route; const gaps = [];
  if (bmrIds().length !== 1) gaps.push(["danger", bmrIds().length === 0 ? "BMR identity: no BMR for this product and batch. Signing will be refused." : `BMR identity: ${bmrIds().length} BMRs share this batch number. Signing will be refused until reviewed.`]);
  if (!S.logs.length) gaps.push(["danger", "No work-log evidence exists for this batch. Historical logs are never treated as signed."]);
  if (S.routeErr === "denied") gaps.push(["warn", "Route view is not available to your account (requires Production Route Manager view). Ask the owner; signing cannot be prepared without the route."]);
  else if (S.routeErr) gaps.push(["danger", `Route could not be read: ${S.routeErr}`]);
  if (r) for (const g of r.gaps) gaps.push([g.code === "OVERRIDE_STEP_NOT_SIGNABLE" ? "warn" : "danger", g.text]);
  const step = S.sign.stepId != null ? r?.steps.find((s) => s.stepId === S.sign.stepId) || null : null;
  const log = S.logs.find((l) => l.id === S.sign.logId) || null;
  const stepRows = r ? r.steps.map((s) => `<tr data-step="${s.stepId ?? ""}" ${s.stepId != null && s.stepId === S.sign.stepId ? 'aria-selected="true"' : ""} class="${s.signable ? "" : "mbg-dim"}"><td><input type="radio" name="step" aria-label="Step ${esc(s.activity)}" ${s.signable ? "" : "disabled"} ${s.stepId != null && s.stepId === S.sign.stepId ? "checked" : ""}></td><td class="num">${esc(s.seq)}</td><td>${esc(s.activity)}${s.isFg ? " " + badge("info", "FG bulk") : ""}</td><td>${s.mandatory ? "Mandatory" : "Optional"}${s.allowsRepeat ? " · repeats" : ""}</td><td>${s.signable ? "" : badge("muted", "Not signable")}</td></tr>`).join("") : "";
  const logRows = S.logs.map((l) => { const match = step ? l.activity === step.activity : true; return `<tr data-log="${l.id}" ${l.id === S.sign.logId ? 'aria-selected="true"' : ""} class="${match ? "" : "mbg-dim"}"><td><input type="radio" name="wl" aria-label="Work log ${l.id}" ${l.id === S.sign.logId ? "checked" : ""}></td><td class="num">${l.id}</td><td>${esc(l.log_date)}</td><td>${esc(l.activity)}${match ? "" : " " + badge("warn", "differs")}</td><td>${esc(l.status ?? "")}</td><td class="num">${l.storage_qty != null ? fmtQty(l.storage_qty) + " " + esc(l.storage_qty_uom ?? "") : "—"}</td></tr>`; }).join("");
  const needQty = step?.isFg;
  p.innerHTML = `
    ${gaps.map(([k, t]) => `<div class="mbg-gap ${k === "danger" ? "mbg-danger" : ""}" role="note">${esc(t)}</div>`).join("")}
    <div class="mbg-two">
      <div class="mbg-card"><h3>Effective route ${r?.routeId ? `<small class="mbg-note">· route #${esc(r.routeId)} as of ${esc(r.asOf ?? "today")}</small>` : ""}</h3>
        ${r ? `<div class="mbg-tablewrap"><table class="mbg-table" id="stepTable"><thead><tr><th></th><th class="num">Seq</th><th>Activity</th><th>Rule</th><th></th></tr></thead><tbody>${stepRows || `<tr><td colspan="5" class="mbg-note">No steps.</td></tr>`}</tbody></table></div>` : `<p class="mbg-note">${S.routeErr ? "Route unavailable." : "No route loaded."}</p>`}
        <p class="mbg-note">FG bulk storage is the mandatory receipt stage and must be signed before governed packing.</p></div>
      <div class="mbg-card"><h3>Work-log evidence</h3>
        <div class="mbg-tablewrap"><table class="mbg-table" id="logTable"><thead><tr><th></th><th class="num">Log</th><th>Date</th><th>Activity</th><th>Status</th><th class="num">Logged qty</th></tr></thead><tbody>${logRows || `<tr><td colspan="6" class="mbg-note">No work logs.</td></tr>`}</tbody></table></div></div>
    </div>
    <div class="mbg-card"><h3>Sign selected stage</h3>
      <div class="mbg-row">
        <div class="mbg-field"><label for="occ">Occurrence</label><input id="occ" class="mbg-input" type="number" min="1" step="1" value="${esc(S.sign.occ)}"></div>
        <div class="mbg-field"><label for="mqty">Measured qty${needQty ? " (base UOM) *" : " (optional)"}</label><input id="mqty" class="mbg-input" type="number" min="0" step="any" value="${esc(S.sign.qty)}"></div>
        <div class="mbg-field" style="flex:1 1 200px"><label for="evref">Evidence reference</label><input id="evref" class="mbg-input" type="text" maxlength="200" value="${esc(S.sign.evidence)}"></div>
        ${S.caps.canSign ? `<button id="signBtn" class="mbg-btn mbg-btn-primary" type="button">Review &amp; sign…</button>` : ""}
      </div>
      ${S.caps.canSign ? "" : `<p class="mbg-note">Signing is not available to your account. Server authorization decides; no signing controls are shown.</p>`}
      <div id="signedList"></div></div>`;
  p.querySelectorAll("#stepTable tbody tr[data-step]").forEach((tr) => tr.addEventListener("click", () => { if (tr.dataset.step === "") return; S.sign.stepId = Number(tr.dataset.step); const st = S.route.steps.find((x) => x.stepId === S.sign.stepId); const cand = S.logs.find((l) => l.activity === st.activity); if (cand && !S.sign.logId) S.sign.logId = cand.id; captureSign(); renderSign(); }));
  p.querySelectorAll("#logTable tbody tr[data-log]").forEach((tr) => tr.addEventListener("click", async () => { S.sign.logId = Number(tr.dataset.log); captureSign(); const l = S.logs.find((x) => x.id === S.sign.logId); await loadRoute(l?.log_date); renderSign(); }));
  ["occ", "mqty", "evref"].forEach((id) => $(id)?.addEventListener("input", captureSign));
  $("signBtn")?.addEventListener("click", openSignConfirm);
  renderSignedList();
}
function captureSign() { if ($("occ")) { S.sign.occ = $("occ").value; S.sign.qty = $("mqty").value; S.sign.evidence = $("evref").value; } }
function renderSignedList() {
  const el = $("signedList"); if (!el) return;
  const mine = S.signed.filter((x) => x.product === S.product.id && x.batch === S.batch);
  el.innerHTML = mine.length ? `<h3 style="margin:10px 0 4px">Signed in this session</h3><div class="mbg-tablewrap"><table class="mbg-table"><thead><tr><th class="num">Event</th><th>Stage</th><th>Log</th><th></th></tr></thead><tbody>${mine.map((x) => `<tr><td class="num">${x.eventId}</td><td>${esc(x.activity)} ${x.voided ? badge("muted", "Voided") : stateBadge("SIGNED")}</td><td class="num">${x.logId}</td><td>${S.caps.canSign && !x.voided ? `<button type="button" class="mbg-btn mbg-btn-sm" data-void="${x.eventId}">Void signature…</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : "";
  el.querySelectorAll("[data-void]").forEach((b) => b.addEventListener("click", () => openStageCorrection(Number(b.dataset.void))));
}
function openSignConfirm() {
  captureSign(); const r = S.route; const step = S.sign.stepId != null ? r?.steps.find((s) => s.stepId === S.sign.stepId) : null; const log = S.logs.find((l) => l.id === S.sign.logId);
  const errs = [];
  if (!step) errs.push("Select a route step."); if (!log) errs.push("Select the work log that evidences it.");
  const occ = Number(S.sign.occ); if (!Number.isInteger(occ) || occ < 1) errs.push("Occurrence must be a whole number from 1.");
  const hasQty = S.sign.qty !== ""; const qty = hasQty ? Number(S.sign.qty) : null;
  if (hasQty && !(Number.isFinite(qty) && qty >= 0)) errs.push("Measured quantity must be zero or more.");
  if (step?.isFg && !(qty > 0)) errs.push("Measured quantity is required for the FG bulk stage.");
  if (errs.length) { banner("warn", errs.map(esc).join("<br>")); return; }
  banner();
  const args = { productId: S.product.id, batch: S.batch, workLogId: log.id, routeStepId: step.stepId, occurrence: occ };
  openModal({
    title: "Sign stage",
    body: kv([["Product", esc(S.product.item)], ["Batch", esc(S.batch)], ["BMR", bmrIds().length === 1 ? `#${bmrIds()[0].id}` : "unresolved"], ["Route", `#${esc(r.routeId ?? "—")}`], ["Step", esc(step.activity)], ["Occurrence", occ], ["Work log", `#${log.id} · ${esc(log.log_date)}`], ["Measured", hasQty ? fmtQty(qty) : "—"], ["Evidence", esc(S.sign.evidence || "—")]]) + `<p class="mbg-note">The signature is append-only. Fix mistakes with a governed correction.</p>`,
    footer: [{ id: "mCancel", label: "Cancel", run: closeModal }, { id: "mSign", label: "Sign stage", cls: "mbg-btn-primary", run: () => doSign(args, qty, step, log) }],
  });
}
async function doSign(a, qty, step, log) {
  if (S.busy) return; setModalBusy(true, "Signing…");
  const key = intents.keyFor(signScope(a));
  const res = await callRpc(supabase, RPC.sign, { p_idempotency_key: key, p_product_id: a.productId, p_batch_number: a.batch, p_work_log_id: a.workLogId, p_route_step_id: a.routeStepId, p_step_occurrence: a.occurrence, p_measured_qty_base: qty, p_evidence_ref: S.sign.evidence.trim() || null });
  setModalBusy(false);
  if (res.kind === "ok") {
    intents.release(signScope(a)); closeModal();
    S.signed.push({ eventId: res.data.event_id, product: a.productId, batch: a.batch, logId: a.workLogId, activity: step.activity, role: res.data.stage_role, voided: false });
    banner("ok", `<strong>Stage signed.</strong>${res.replay ? " (replayed existing signature)" : ""}` + kv([["Event", res.data.event_id], ["Stage role", esc(res.data.stage_role)], ["Route", res.data.route_id], ["BMR", res.data.bmr_id]]));
    renderSign(); return;
  }
  modalMsg(outcomeText(res), res.kind === "uncertain" ? "mbg-warn" : "");
  if (res.kind === "uncertain") { const b = $("mSign"); if (b) b.textContent = "Retry (same request)"; }
}
function openStageCorrection(eventId) {
  const rec = S.signed.find((x) => x.eventId === eventId);
  openModal({
    title: "Void signature (correction)",
    body: kv([["Signed event", eventId], ["Stage", esc(rec?.activity ?? "—")], ["Now", "Signed"], ["After correction", "Unsigned — sign again"]]) + `<div class="mbg-field"><label for="cReason">Reason *</label><textarea id="cReason" class="mbg-textarea" maxlength="500"></textarea></div><p class="mbg-note">A voided FG bulk signature blocks governed packing until the stage is signed again.</p>`,
    footer: [{ id: "mCancel", label: "Cancel", run: closeModal }, { id: "mCorr", label: "Void signature", cls: "mbg-btn-danger", run: async () => {
      const reason = $("cReason").value.trim(); if (!reason) { modalMsg("Reason is required."); $("cReason").setAttribute("aria-invalid", "true"); return; }
      setModalBusy(true, "Correcting…"); const scope = correctStageScope(eventId);
      const res = await callRpc(supabase, RPC.correctStage, { p_idempotency_key: intents.keyFor(scope), p_event_id: eventId, p_reason: reason });
      setModalBusy(false);
      if (res.kind === "ok") { intents.release(scope); if (rec) rec.voided = true; closeModal(); banner("ok", `<strong>Signature voided.</strong> Correction event ${res.data.event_id}.`); renderSign(); }
      else modalMsg(outcomeText(res), res.kind === "uncertain" ? "mbg-warn" : "");
    } }],
  });
}

/* ── outcome wording ─────────────────────────────────────────── */
function outcomeText(res) {
  if (res.kind === "refused") { const d = describeRefusal(res.code); return `${d.title}.${d.fix ? " " + d.fix : ""}${res.historical ? " (Historical record: not verified.)" : ""}`; }
  if (res.kind === "denied") return res.message;
  if (res.kind === "uncertain" || res.kind === "raised") return res.message;
  return "Request failed.";
}

/* ── Governed packing ────────────────────────────────────────── */
function eventLog() { return S.events.find((e) => e.id === S.eventId)?.log; }
function renderPack() {
  const p = $("panel-pack"); const f = fgRow(); const locked = !!S.pending;
  const existing = new Set(S.eventLines.map((l) => l.sku_id));
  const rows = S.skus.filter((s) => !s.is_sample || existing.has(s.id)).map((s) => `<tr><td>${esc(fmtQty(s.pack_size, 4))} ${esc(s.uom)} <small class="mbg-note">#${s.id}</small></td><td>${existing.has(s.id) ? badge("muted", `Line exists: ${S.eventLines.find((l) => l.sku_id === s.id).count} — use Corrections`) : ""}</td><td class="num"><input type="number" min="0" step="1" data-sku="${s.id}" aria-label="Count for ${esc(fmtQty(s.pack_size, 4))} ${esc(s.uom)}" value="${esc(S.counts[s.id] ?? "")}" ${existing.has(s.id) || locked || !S.caps.canPack ? "disabled" : ""}></td></tr>`).join("");
  const stage = S.signed.find((x) => x.product === S.product.id && x.batch === S.batch && x.role === "FG_BULK" && !x.voided);
  p.innerHTML = `
    <div class="mbg-card"><div class="mbg-row">
      <div><div class="mbg-lbl">Available bulk</div><strong>${f ? `${fmtQty(f.qty_on_hand)} ${esc(f.on_hand_qty_uom ?? "")}` : "No FG bulk balance"}</strong></div>
      <div><div class="mbg-lbl">FG bulk stage</div>${stage ? stateBadge("SIGNED") : badge("muted", "Server verifies at posting")}</div>
      <div><div class="mbg-lbl">Mode</div>${modeBadgeHtml()}</div></div>
      ${f ? "" : `<div class="mbg-gap mbg-danger" role="note">No FG bulk balance for this batch. Governed packing needs a signed FG bulk receipt.</div>`}</div>
    ${!S.eventId ? `<p class="mbg-note">Select a bulk-depleting packaging event above.</p>` : `
    <div class="mbg-card"><h3>SKU counts</h3>
      <div class="mbg-tablewrap"><table class="mbg-table" id="skuTable"><thead><tr><th>SKU</th><th></th><th class="num">Count</th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="mbg-note">No active SKUs.</td></tr>`}</tbody></table></div>
      <p class="mbg-note">Counts are package units. The server converts them to the base unit; the required bulk is shown after posting.</p>
      <div class="mbg-row" style="margin-top:8px">${S.caps.canPack ? `<button id="packBtn" class="mbg-btn mbg-btn-primary" type="button" ${locked ? "disabled" : ""}>Post packing</button>` : ""}</div>
      ${S.caps.canPack ? "" : `<p class="mbg-note">Governed packing is not available to your account. Existing operational paths are unchanged.</p>`}</div>`}
    <div id="packResult"></div>`;
  p.querySelectorAll("#skuTable input[data-sku]").forEach((i) => i.addEventListener("input", () => { S.counts[i.dataset.sku] = i.value; }));
  $("packBtn")?.addEventListener("click", () => submitPack(null));
  if (S.pending?.kind === "pack") showPending();
  else if (S.lastPack) renderPackReceipt(S.lastPack);
}
function modeBadgeHtml() { const m = modeLabel(S.readiness); return `<span class="mbg-badge mbg-badge-${m.tone}" title="${esc(m.text)}">${esc(m.mode === "UNKNOWN" ? "Mode not visible" : m.mode)}</span>`; }
function packRows() { return S.skus.map((s) => ({ sku_id: s.id, count: S.counts[s.id], label: skuLabel(s.id) })); }
function renderPackReceipt(r) {
  const el = $("packResult"); if (!el) return;
  el.innerHTML = `<div class="mbg-banner mbg-ok" style="margin:0"><strong>Packing posted${r.replay ? " (replayed existing request)" : ""}.</strong>${kv([["Batch", esc(r.batch)], ["Packaging event", r.eventId], ["Required bulk", `${fmtQty(r.required)} ${esc(r.uom)}`], ["Available before", `${fmtQty(r.availableBefore)} ${esc(r.uom)}`], ...(r.excess ? [["Measured excess posted", `${fmtQty(r.excess)} ${esc(r.uom)} (receipt ${r.excessId})`]] : []), ["Balance after", `${fmtQty(r.balanceAfter)} ${esc(r.uom)}`], ["SKU lines", r.skuLineIds.length]])}</div>`;
}
async function submitPack(excess, fromRetry = false) {
  if (S.busy) return;
  const { lines, errors } = normalizeLines(packRows());
  if (errors.length && !fromRetry) { banner("warn", errors.map(esc).join("<br>")); return; }
  const use = fromRetry ? S.pending.lines : lines; const scope = fromRetry ? S.pending.scope : packScope(S.eventId, use);
  const key = intents.keyFor(scope); const evId = fromRetry ? S.pending.eventId : S.eventId;
  S.busy = true; $("packBtn") && ($("packBtn").disabled = true);
  const inModal = !$("modalRoot").hidden; if (inModal) setModalBusy(true, "Posting…"); else banner("info", `<span class="mbg-spin"></span>Posting packing…`);
  const res = await callRpc(supabase, RPC.pack, { p_request_id: key, p_packaging_event_id: evId, p_lines: use, p_excess: excess || null });
  S.busy = false; if (inModal) setModalBusy(false);
  if (res.kind === "ok") {
    intents.release(scope); S.pending = null; S.counts = {}; S.lastPack = packReceipt(res.data);
    if (inModal) closeModal(); banner();
    try { await Promise.all([loadProduct2(), loadEventLines()]); } catch { /* receipt is authoritative */ }
    render(); return;
  }
  if (res.kind === "insufficient") { S.pending = null; handleInsufficient(res, { scope, lines: use, eventId: evId, submit: (x) => submitPack(x), kindLabel: "Packing" }); return; }
  if (res.kind === "uncertain") { S.pending = { kind: "pack", scope, lines: use, eventId: evId }; if (inModal) { modalMsg(res.message, "mbg-warn"); const b = $("mPost"); if (b) b.textContent = "Retry (same request)"; } render(); showPending(res.message); return; }
  if (inModal) modalMsg(outcomeText(res)); else showRefusal(res);
  render();
}
async function loadProduct2() { const { data } = await supabase.from("fg_bulk_stock").select("bn,qty_on_hand,on_hand_qty_uom,product_id").eq("product_id", S.product.id); if (data) S.fgRows = data; }
function showRefusal(res) {
  const d = describeRefusal(res.code); const st = res.kind === "refused" ? stateFromRefusal(res.code, res.historical) : null;
  banner(res.kind === "denied" ? "warn" : "danger", `<strong>${esc(res.kind === "refused" ? d.title : outcomeText(res))}</strong>${res.kind === "refused" && d.fix ? ` ${esc(d.fix)}` : ""} ${st ? stateBadge(st) : ""}${res.kind === "refused" ? `<div class="mbg-note">Nothing was posted. Code: ${esc(res.code)}</div>` : ""}`);
}
function showPending(msg) {
  banner("warn", `<strong>Outcome not confirmed.</strong> ${esc(msg || "The server may already have recorded this request.")} Inputs are locked. Retrying uses the same request key, so it cannot post twice.`, [
    { label: "Retry", run: () => (S.pending?.kind === "corr" ? submitCorrection(S.pending.args, true) : submitPack(null, true)) },
    { label: "Reload balance", run: async () => { try { await Promise.all([loadProduct2(), loadEventLines()]); render(); } catch (e) { banner("danger", esc(e.message)); } } },
  ]);
}
function handleInsufficient(res, ctx) {
  const d = res.data; const uom = d.base_uom;
  const allowed = d.excess_permitted === true && S.caps.canExcess;
  const summary = kv([["Required", `${fmtQty(d.required_base)} ${esc(uom)}`], ["Available", `${fmtQty(d.available_base)} ${esc(uom)}`], ["Shortfall", `${fmtQty(d.shortfall_base)} ${esc(uom)}`, true]]);
  if (!allowed) {
    banner("danger", `<strong>${esc(describeRefusal("INSUFFICIENT_BULK").title)}.</strong> Nothing was posted.${summary}<p class="mbg-note">${d.excess_permitted === true ? "Recording measured excess needs the excess-adjustment permission." : "Measured excess is not permitted for this request."} Reduce the counts or ask an authorized operator.</p>`);
    if ($("modalRoot").hidden === false) closeModal(); render(); return;
  }
  const keep = !$("modalRoot").hidden && modalCtl?.excessCtx; if (keep) { modalMsg("Stock is still insufficient with that excess. Re-measure and try again.", ""); return; }
  banner();
  openModal({
    title: `${ctx.kindLabel}: measured excess`,
    body: summary + `<p class="mbg-note">Enter the physically measured excess only. A receipt is never created to cover the shortfall automatically. It is posted together with the packing in one transaction.</p>
      <div class="mbg-field"><label for="exQty">Measured excess (${esc(uom)}) *</label><input id="exQty" class="mbg-input" type="number" min="0" step="any" inputmode="decimal"></div>
      <div class="mbg-field"><label for="exReason">Reason *</label><textarea id="exReason" class="mbg-textarea" maxlength="500"></textarea></div>
      <div class="mbg-field"><label for="exEvidence">Evidence reference *</label><input id="exEvidence" class="mbg-input" type="text" maxlength="200"></div>`,
    footer: [{ id: "mCancel", label: "Cancel", run: closeModal }, { id: "mPost", label: "Confirm and post", cls: "mbg-btn-primary", run: () => {
      const v = validateExcess({ qty_base: $("exQty").value, reason: $("exReason").value, evidence_ref: $("exEvidence").value });
      for (const [id, bad] of [["exQty", !(Number($("exQty").value) > 0)], ["exReason", !$("exReason").value.trim()], ["exEvidence", !$("exEvidence").value.trim()]]) $(id).setAttribute("aria-invalid", bad);
      if (!v.ok) { modalMsg(v.errors.join(" · ")); return; }
      modalMsg(""); ctx.submit(v.value);
    } }],
  });
  modalCtl.excessCtx = ctx;
}

/* ── Corrections ─────────────────────────────────────────────── */
function renderCorr() {
  const p = $("panel-corr");
  if (!S.eventId) { p.innerHTML = `<p class="mbg-note">Select a bulk-depleting packaging event above to review its lines.</p>`; return; }
  const rows = S.eventLines.map((l) => `<tr><td>${esc(skuLabel(l.sku_id))}</td><td class="num">${l.count}</td><td>${S.caps.canPack ? `<button type="button" class="mbg-btn mbg-btn-sm" data-line="${l.id}">Correct…</button>` : ""}</td></tr>`).join("");
  p.innerHTML = `<div class="mbg-card"><h3>Lines on packaging event #${S.eventId}</h3>
    <div class="mbg-tablewrap"><table class="mbg-table"><thead><tr><th>SKU</th><th class="num">Count</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="mbg-note">No lines.</td></tr>`}</tbody></table></div>
    <p class="mbg-note">Lines without recorded depletion evidence (historical) are refused by the server and cannot be corrected here. Set the count to 0 to remove a line and return its depletion to stock.</p>
    ${S.caps.canPack ? "" : `<p class="mbg-note">Corrections are not available to your account.</p>`}</div><div id="corrResult"></div>`;
  p.querySelectorAll("[data-line]").forEach((b) => b.addEventListener("click", () => openCorrection(S.eventLines.find((l) => l.id === Number(b.dataset.line)))));
}
function openCorrection(line) {
  openModal({
    title: "Correct packing line",
    body: `<dl class="mbg-kv"><dt>SKU</dt><dd>${esc(skuLabel(line.sku_id))}</dd><dt>Existing count</dt><dd>${line.count}</dd><dt>Proposed count</dt><dd id="pvNew">—</dd><dt>Change</dt><dd id="pvDelta">—</dd></dl>
      <div class="mbg-field"><label for="cNew">New count (0 removes the line) *</label><input id="cNew" class="mbg-input" type="number" min="0" step="1"></div>
      <div class="mbg-field"><label for="cReason">Reason *</label><textarea id="cReason" class="mbg-textarea" maxlength="500"></textarea></div>
      <p class="mbg-note">Stock impact is calculated by the server and shown after confirmation. A correction never fabricates stock.</p>`,
    footer: [{ id: "mCancel", label: "Cancel", run: closeModal }, { id: "mPost", label: "Confirm correction", cls: "mbg-btn-primary", run: () => {
      const n = Number($("cNew").value); const reason = $("cReason").value.trim();
      if ($("cNew").value === "" || !Number.isInteger(n) || n < 0) { modalMsg("New count must be a whole number, 0 or more."); $("cNew").setAttribute("aria-invalid", "true"); return; }
      if (n === line.count) { modalMsg("New count equals the existing count."); return; }
      if (!reason) { modalMsg("Reason is required."); $("cReason").setAttribute("aria-invalid", "true"); return; }
      submitCorrection({ line, n, reason });
    } }],
  });
  const upd = () => { const v = $("cNew").value; $("pvNew").textContent = v === "" ? "—" : (Number(v) === 0 ? "0 (line removed)" : v); $("pvDelta").textContent = v === "" || !Number.isFinite(Number(v)) ? "—" : `${Number(v) - line.count > 0 ? "+" : ""}${Number(v) - line.count}`; };
  $("cNew").addEventListener("input", upd);
}
async function submitCorrection(args, fromRetry = false) {
  if (S.busy) return; const a = fromRetry ? S.pending.args : args;
  const scope = correctPackScope(a.line.id, a.n); const key = intents.keyFor(scope);
  const inModal = !$("modalRoot").hidden; S.busy = true; if (inModal) setModalBusy(true, "Correcting…");
  const res = await callRpc(supabase, RPC.correctPack, { p_request_id: key, p_event_sku_id: a.line.id, p_new_count: a.n, p_reason: a.reason, p_excess: a.excess || null });
  S.busy = false; if (inModal) setModalBusy(false);
  if (res.kind === "ok") {
    intents.release(scope); S.pending = null; const r = correctionReceipt(res.data); closeModal();
    try { await Promise.all([loadProduct2(), loadEventLines()]); } catch { /* server response is authoritative */ }
    render();
    $("corrResult") && ($("corrResult").innerHTML = `<div class="mbg-banner mbg-ok"><strong>${r.removed ? "Line removed" : "Line corrected"}${r.replay ? " (replayed existing request)" : ""}.</strong>${kv([["SKU", esc(skuLabel(a.line.sku_id))], ["Count", `${r.oldCount} → ${r.removed ? "0 (removed)" : r.newCount}`], ["Stock impact", `${r.stockDelta > 0 ? "+" : ""}${fmtQty(r.stockDelta)} ${esc(r.uom)} ${r.stockDelta > 0 ? "returned to stock" : "consumed"}`], ...(r.excess ? [["Measured excess posted", `${fmtQty(r.excess)} ${esc(r.uom)}`]] : []), ["Balance after", `${fmtQty(r.balanceAfter)} ${esc(r.uom)}`]])}</div>`); return;
  }
  if (res.kind === "insufficient") { S.pending = null; handleInsufficient(res, { scope, kindLabel: "Correction", submit: (x) => submitCorrection({ ...a, excess: x }) }); return; }
  if (res.kind === "uncertain") { S.pending = { kind: "corr", args: a, scope }; modalMsg(res.message, "mbg-warn"); const b = $("mPost"); if (b) b.textContent = "Retry (same request)"; return; }
  modalMsg(outcomeText(res)); const st = res.kind === "refused" ? stateFromRefusal(res.code, res.historical) : null; if (st) banner("warn", `${stateBadge(st)} ${esc(GOVERNANCE_STATES[st].text)}`);
}

/* ── Exceptions & mode ───────────────────────────────────────── */
function renderExc() {
  const h = HISTORICAL_AUDIT_SNAPSHOT; const m = modeLabel(S.readiness);
  const deficits = Object.entries(h.routeMasterDeficiencies).map(([k, v]) => `<tr><td>${esc(describeRefusal(k).title !== `Refused: ${k}` ? describeRefusal(k).title : k.replace(/_/g, " ").toLowerCase())}</td><td class="num">${v}</td></tr>`).join("");
  const rd = S.readiness;
  $("panel-exc").innerHTML = `
    <div class="mbg-card"><h3>Mode</h3><div class="mbg-banner mbg-${m.tone === "muted" ? "info" : m.tone}" style="margin:0">${modeBadgeHtml()} ${esc(m.text)}</div>
      ${rd ? `<div class="mbg-tablewrap" style="margin-top:8px"><table class="mbg-table"><tbody><tr><td>Core gate</td><td>${esc(rd.core_gate ?? "—")}</td></tr><tr><td>Window</td><td>${esc(rd.window_days ?? "—")} days</td></tr><tr><td>Direct legacy writes observed</td><td class="num">${esc(countOf(rd.direct_writes))}</td></tr><tr><td>Ticketed corrections / packs</td><td class="num">${esc(countOf(rd.ticketed_corrections))} / ${esc(countOf(rd.ticketed_packs))}</td></tr></tbody></table></div>` : `<p class="mbg-note">${S.caps.canViewReadiness ? (S.readinessErr ? esc(S.readinessErr) : "Loading readiness…") : "Readiness is visible to enforcement administrators only."}</p>`}
      <p class="mbg-note">ENFORCE activation and core migration sign-off are separately governed owner actions and are not available in this screen.</p></div>
    <div class="mbg-card"><h3>States</h3><div class="mbg-legend">${Object.keys(GOVERNANCE_STATES).map((k) => `<div>${stateBadge(k)}<span class="mbg-note">${esc(GOVERNANCE_STATES[k].text)}</span></div>`).join("")}</div></div>
    <div class="mbg-two">
      <div class="mbg-card"><h3>Historical, not verified</h3><p class="mbg-note">Reference snapshot (${esc(h.window)}; ${esc(h.source)}). Not live counts. No synthetic signatures and no backfill; these stay NOT VERIFIED until re-evidenced.</p>
        <div class="mbg-tablewrap"><table class="mbg-table"><tbody><tr><td>Packing lines without recorded depletion</td><td class="num">${h.missingDepletionLines}</td></tr><tr><td>Across product-batches</td><td class="num">${h.missingDepletionProductBatches}</td></tr></tbody></table></div></div>
      <div class="mbg-card"><h3>Route-master deficiencies (FG bulk logs, ${esc(h.fgBulkLogs)})</h3><p class="mbg-note">Master-data issues, separate from newly governed records.</p>
        <div class="mbg-tablewrap"><table class="mbg-table"><tbody>${deficits}</tbody></table></div></div>
    </div>`;
}
const countOf = (v) => (v == null ? "—" : typeof v === "object" ? (v.count ?? v.total ?? Object.values(v).reduce((a, b) => a + (Number(b) || 0), 0)) : v);
async function loadReadiness() {
  if (!S.caps.canViewReadiness) { renderExc(); return; }
  const tok = ++S.tok.readiness;
  const res = await callRpc(supabase, RPC.readiness, { p_days: 7 });
  if (tok !== S.tok.readiness) return;
  if (res.kind === "ok") { S.readiness = res.data; S.readinessErr = null; } else S.readinessErr = outcomeText(res);
  updateModeBadge(); if (S.tab === "exc") renderExc();
}
function updateModeBadge() {
  const b = $("modeBadge"); const m = modeLabel(S.readiness);
  if (m.mode === "UNKNOWN") { b.hidden = true; return; }
  b.hidden = false; b.className = `mbg-badge mbg-badge-${m.tone}`; b.textContent = m.mode; b.title = m.text;
}

/* ── init ────────────────────────────────────────────────────── */
let productSel; let batchSel;
(async function init() {
  mountModuleHome($("homeBtn")); $("homeBtn").addEventListener("click", () => Platform.goHome());
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session) return goLogin();
  S.caps = await loadCapabilities(supabase);
  // Page access: any view right on the five MIS targets or the page module; the server remains authoritative for every write.
  const any = Object.values(S.caps.raw).some((x) => x.view);
  if (!any) { const g = $("gate"); g.className = "mbg-gate mbg-danger"; g.textContent = "You do not have access to Batch Governance."; g.hidden = false; return; }
  productSel = createSearchSelect($("productSel"), { id: "productInput", placeholder: "Search product…", onSelect: (o) => { const p = S.products.find((x) => x.id === o.value); banner(); loadProduct(p); } });
  batchSel = createSearchSelect($("batchSel"), { id: "batchInput", placeholder: "Select batch…", onSelect: (o) => { banner(); loadBatch(o.value); } });
  $("eventSel").addEventListener("change", async (e) => { S.eventId = e.target.value ? Number(e.target.value) : null; S.counts = {}; S.lastPack = null; banner(); try { await loadEventLines(); } catch (err) { banner("danger", esc(err.message)); } render(); });
  $("app").hidden = false;
  try { await loadProducts(); } catch (e) { banner("danger", `Could not load products. ${esc(e.message || e)}`, [{ label: "Retry", run: () => loadProducts().then(() => banner()).catch(() => {}) }]); }
  if (S.caps.canViewReadiness) loadReadiness();
  render();
})();
