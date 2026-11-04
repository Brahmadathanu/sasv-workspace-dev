import { supabase } from "../public/shared/js/supabaseClient.js";
import { bootstrapApp } from "../public/shared/js/appBootstrap.js";
import { iconHtml } from "../public/shared/js/ui-icons.js";
import { mountModuleHome } from "../public/shared/js/sasv-module-chrome.js";
import {
  MODULE_ID, BATCH_SIZE, BULK_MAX_ROWS, formatDuration, activeFilterCount, mergeById,
  createActivitiesService, loadAccess, validateBulk, validateActivity, isBlankDraft,
} from "../public/shared/js/manage-activities-core.js";

const $ = (id) => document.getElementById(id);
const svc = createActivitiesService(supabase);
const state = { access: { view: false, edit: false } };
// Infinite-scroll feed. `gen` invalidates in-flight requests on reset; `busy` blocks concurrent batch loads.
const feed = { items: [], total: 0, gen: 0, busy: false, err: null, rendered: 0 };
let draftSeq = 0;
let bulkRows = []; // [{key, name, section_id, sub_section_id, area_id, kind_id, duration_days, errors, msg}]
let kinds = [];
let sections = [];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const opts = (rows, v, t, ph, sel) =>
  `<option value="">${esc(ph)}</option>` + rows.map((r) => `<option value="${esc(r[v])}"${String(r[v]) === String(sel ?? "") ? " selected" : ""}>${esc(r[t])}</option>`).join("");

function setStatus(msg, kind = "", action = null) {
  const b = $("maStatus");
  if (!msg) { b.hidden = true; b.textContent = ""; return; }
  b.hidden = false;
  b.className = `ma-banner${kind ? ` is-${kind}` : ""}`;
  b.setAttribute("role", kind === "error" ? "alert" : "status");
  b.textContent = msg;
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn ghost"; btn.textContent = action.label;
    btn.onclick = action.run;
    b.appendChild(btn);
  }
}

/* ───────── Horizontal-scroll cues (edge shadows + hint when a table container can scroll sideways) ───────── */
function refreshCues() {
  document.querySelectorAll(".ma-scroll").forEach((box) => {
    const w = box.querySelector(".ma-table-wrap");
    const max = w.scrollWidth - w.clientWidth;
    const left = max > 1 && w.scrollLeft > 1, right = max > 1 && w.scrollLeft < max - 1;
    box.classList.toggle("has-left", left); box.classList.toggle("has-right", right);
    const hint = box.nextElementSibling;
    if (hint?.classList.contains("ma-scroll-hint")) hint.hidden = !(max > 1) || box.offsetParent === null;
  });
}
function wireCues() {
  document.querySelectorAll(".ma-table-wrap").forEach((w) => { w.addEventListener("scroll", refreshCues, { passive: true }); if ("ResizeObserver" in window) { const ro = new ResizeObserver(refreshCues); ro.observe(w); ro.observe(w.firstElementChild); } });
  window.addEventListener("resize", refreshCues);
}

/* ───────── Background scroll lock (reference-counted so nested dialogs never unlock early or leak) ───────── */
let lockCount = 0, lockY = 0;
function lockScroll() {
  if (lockCount++ === 0) { lockY = window.scrollY; document.documentElement.classList.add("ma-scroll-locked"); }
  let released = false;
  return () => {
    if (released) return; released = true;
    if (--lockCount === 0) { document.documentElement.classList.remove("ma-scroll-locked"); window.scrollTo(0, lockY); }
  };
}

/* ───────── Layers (popover / Add modal): Esc, Tab trap, focus return; yield to dialogs stacked on top ───────── */
const dialogOpen = () => $("maDialogHost").childElementCount > 0;
const FOCUSABLE = "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
function openLayer({ el, panel = el, opener, outsideCloses = false, onClose, focus }) {
  el.hidden = false;
  const unlock = lockScroll();
  const close = (restore = true) => {
    document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown, true);
    el.hidden = true; unlock(); onClose?.(); if (restore) opener?.focus?.({ preventScroll: true });
  };
  const onKey = (e) => {
    if (dialogOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const onDown = (e) => { if (outsideCloses && !dialogOpen() && !panel.contains(e.target) && !opener?.contains(e.target)) close(false); };
  document.addEventListener("keydown", onKey, true); document.addEventListener("mousedown", onDown, true);
  (focus?.() ?? panel.querySelector(FOCUSABLE))?.focus?.();
  return { close };
}

/* ───────── Dialog (focus-trapped, Esc cancels, focus restored) ───────── */
const xBtn = (label = "Close") => `<button type="button" class="ma-icon-btn ma-x" data-close title="${label}" aria-label="${label}">${iconHtml("close", 16)}</button>`;
function openDialog({ title, bodyHtml, buttons, onMount, wide = false, closeX = false, full = false }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const host = $("maDialogHost");
    const back = document.createElement("div");
    back.className = "ma-dialog-backdrop";
    back.innerHTML = `<div class="ma-modal${wide ? " ma-modal--lg" : ""}${full ? " ma-modal--full" : ""}" role="dialog" aria-modal="true" aria-labelledby="maDlgTitle">
      <div class="ma-modal-header"><h2 id="maDlgTitle" class="ma-modal-title">${esc(title)}</h2>${closeX ? xBtn() : ""}</div>
      <div class="ma-modal-body">${bodyHtml}</div>
      <div class="ma-modal-footer ma-dialog-footer"><span></span><div class="ma-footer-actions">${buttons.map((b) => `<button type="button" class="btn ${b.cls || "ghost"}" data-act="${esc(b.id)}">${esc(b.label)}</button>`).join("")}</div></div></div>`;
    host.appendChild(back);
    const unlock = lockScroll();
    const dlg = back.firstElementChild;
    const close = (val) => { document.removeEventListener("keydown", onKey, true); back.remove(); unlock(); opener?.focus?.({ preventScroll: true }); resolve(val); };
    const onKey = (e) => {
      if (host.lastElementChild !== back) return; // only the top-most dialog reacts
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close({ id: "cancel" }); return; }
      if (e.key !== "Tab") return;
      const f = [...dlg.querySelectorAll(FOCUSABLE)];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    const api = { dlg, close, setBusy(b) { dlg.querySelectorAll("button,input,select,textarea").forEach((x) => (x.disabled = b)); dlg.setAttribute("aria-busy", String(b)); } };
    dlg.querySelectorAll("[data-act]").forEach((btn) => (btn.onclick = () => { const def = buttons.find((x) => x.id === btn.dataset.act); return def.run ? def.run(api) : close({ id: btn.dataset.act }); }));
    dlg.querySelector("[data-close]")?.addEventListener("click", () => close({ id: "cancel" }));
    onMount?.(api);
    (dlg.querySelector("[data-autofocus]") || dlg.querySelector("button.primary,button.danger") || dlg.querySelector("button"))?.focus();
  });
}

const confirmDialog = (title, message, label = "Confirm", cls = "primary") =>
  openDialog({ title, closeX: true, bodyHtml: `<p>${esc(message)}</p>`, buttons: [{ id: "cancel", label: "Cancel" }, { id: "ok", label, cls }] }).then((r) => r.id === "ok");
const alertDialog = (title, message) => openDialog({ title, closeX: true, bodyHtml: `<p style="white-space:pre-line">${esc(message)}</p>`, buttons: [{ id: "ok", label: "OK", cls: "primary" }] });

/* ───────── Listing (server-side infinite scroll, batches of BATCH_SIZE) ───────── */
function filters() {
  return {
    search: $("nameFilter").value, sectionId: $("sectionFilter").value, subId: $("subFilter").value,
    areaId: $("areaFilter").value, kindId: $("kindFilter").value,
  };
}
const hasMore = () => feed.items.length < feed.total && !feed.exhausted;
const catalogueVisible = () => !$("maCatalogue").hidden && !$("maMain").hidden;

/** reset=true discards loaded rows and any in-flight request; otherwise loads the next batch. */
async function loadBatch({ reset = false } = {}) {
  if (reset) { feed.gen++; Object.assign(feed, { items: [], total: 0, busy: false, err: null, rendered: 0, exhausted: false }); renderFeed(true); }
  else if (feed.busy || !hasMore() || feed.err) return;
  const gen = feed.gen;
  feed.busy = true; feed.err = null; renderFeed();
  try {
    const res = await svc.list({ ...filters(), offset: feed.items.length, pageSize: BATCH_SIZE });
    if (gen !== feed.gen) return; // stale: a newer reset superseded this request
    feed.items = mergeById(feed.items, res.rows);
    feed.total = res.total;
    if (res.rows.length === 0) feed.exhausted = true;
  } catch (e) {
    if (gen !== feed.gen) return;
    console.error("[activities] list failed", e);
    feed.err = { phase: feed.items.length ? "more" : "initial" };
  } finally {
    if (gen === feed.gen) { feed.busy = false; renderFeed(); queueMicrotask(checkSentinel); }
  }
}

function rowHtml(r) {
  return `<tr data-id="${esc(r.id)}">
      <td><button type="button" class="ma-name-link" aria-haspopup="dialog">${esc(r.activity_name)}</button></td>
      <td>${esc(r.sections?.section_name)}</td><td>${esc(r.subsections?.subsection_name)}</td>
      <td>${esc(r.areas?.area_name)}</td><td>${esc(r.activity_kinds?.name)}</td><td class="ma-num">${esc(formatDuration(r.duration_days))}</td></tr>`;
}
// Narrow-screen presentation of the SAME loaded rows (no separate fetch).
function cardHtml(r) {
  const path = [r.sections?.section_name, r.subsections?.subsection_name, r.areas?.area_name].filter(Boolean).map(esc).join(" › ");
  return `<li data-id="${esc(r.id)}"><div class="ma-card" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Open details for ${esc(r.activity_name)}">
      <div class="ma-card-line1"><span class="ma-card-name">${esc(r.activity_name)}</span><span class="ma-card-kind">${esc(r.activity_kinds?.name)}</span></div>
      <div class="ma-card-path">${path}</div>
      <div class="ma-card-dur">Duration: <strong>${esc(formatDuration(r.duration_days))}</strong></div>
      <span class="ma-card-chev" aria-hidden="true">${iconHtml("chevron-right", 16)}</span></div></li>`;
}

function renderFeed(full = false) {
  const tb = $("existingTable").querySelector("tbody");
  const cards = $("maCards");
  if (full || feed.rendered > feed.items.length) { tb.innerHTML = feed.items.map(rowHtml).join(""); cards.innerHTML = feed.items.map(cardHtml).join(""); }
  else { const add = feed.items.slice(feed.rendered); tb.insertAdjacentHTML("beforeend", add.map(rowHtml).join("")); cards.insertAdjacentHTML("beforeend", add.map(cardHtml).join("")); }
  feed.rendered = feed.items.length;
  $("existingTable").setAttribute("aria-busy", String(feed.busy));
  const f = filters(); const filtered = activeFilterCount(f) > 0 || f.search.trim();
  const empty = $("maEmpty");
  empty.hidden = feed.items.length > 0 || !!feed.err;
  empty.textContent = feed.busy ? "Loading activities…" : (filtered ? "No activities match the current search or filters." : "No activities found.");
  $("maCount").textContent = feed.err?.phase === "initial" || (feed.busy && !feed.items.length) ? "" : `${feed.total} ${feed.total === 1 ? "activity" : "activities"}`;
  // Compact in-list end-of-list indicator (no persistent bar): loading text, or a contextual Retry / "Load more" fallback.
  const msg = feed.busy ? (feed.items.length ? "Loading more…" : "")
    : feed.err?.phase === "more" ? "Couldn’t load more."
    : feed.err ? "Could not load activities. Check your connection and try again." : "";
  const showBtn = !feed.busy && (!!feed.err || hasMore());
  for (const [sId, bId] of [["maListStatus", "maLoadMore"], ["maListStatusCards", "maLoadMoreCards"]]) {
    $(sId).textContent = msg;
    const more = $(bId); more.hidden = !showBtn; more.textContent = feed.err ? "Retry" : "Load more";
  }
  refreshCues();
}

let observer = null;
// Desktop: the table container is the vertical scroller, so "near the end" is measured on it.
// Narrow: the activity cards scroll with the page, so the sentinel below them is measured against the window.
const tableMode = () => $("existingTable").offsetParent !== null;
const tableScroller = () => $("existingTable").closest(".ma-table-wrap");
function nearEnd() {
  if (tableMode()) { const w = tableScroller(); return w.scrollHeight - w.scrollTop - w.clientHeight < 200; }
  return $("maCardsEnd").getBoundingClientRect().top < window.innerHeight + 200;
}
function checkSentinel() {
  if (!catalogueVisible() || feed.busy || feed.err || !hasMore()) return;
  if (nearEnd()) loadBatch();
}
function wireFeed() {
  const more = () => { if (feed.err?.phase === "initial") loadBatch({ reset: true }); else { feed.err = null; loadBatch(); } };
  $("maLoadMore").onclick = more; $("maLoadMoreCards").onclick = more;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) checkSentinel(); }, { rootMargin: "200px" });
    observer.observe($("maCardsEnd"));
  }
  tableScroller().addEventListener("scroll", checkSentinel, { passive: true });
  window.addEventListener("scroll", checkSentinel, { passive: true });
  window.addEventListener("resize", checkSentinel);
}

/* ───────── Filters (drawer) ───────── */
let searchTimer = null;
const reload = () => { updateFilterIndicator(); return loadBatch({ reset: true }); };

function updateFilterIndicator() {
  const n = activeFilterCount(filters());
  const b = $("maFilterBadge"), btn = $("maFilterBtn");
  b.hidden = n === 0; b.textContent = String(n);
  btn.classList.toggle("is-active", n > 0);
  btn.setAttribute("aria-label", n ? `Filters, ${n} active` : "Filters");
}

async function fillSub(sel, secId, ph) {
  sel.innerHTML = `<option value="">${ph}</option>`; sel.disabled = !secId;
  if (!secId) return;
  try { sel.innerHTML = opts(await svc.subsections(secId), "id", "subsection_name", ph); }
  catch { setStatus("Could not load sub-sections.", "error"); }
}
async function fillArea(sel, secId, subId, ph) {
  sel.innerHTML = `<option value="">${ph}</option>`; sel.disabled = !(secId && subId);
  if (!(secId && subId)) return;
  try { sel.innerHTML = opts(await svc.areas(secId, subId), "id", "area_name", ph); }
  catch { setStatus("Could not load areas.", "error"); }
}

function openDrawer() {
  const opener = $("maFilterBtn");
  opener.setAttribute("aria-expanded", "true");
  const layer = openLayer({ el: $("maDrawer"), opener, outsideCloses: true, onClose: () => opener.setAttribute("aria-expanded", "false"), focus: () => $("sectionFilter") });
  $("maDrawerClose").onclick = $("maDrawerDone").onclick = () => layer.close();
}

function wireFilters() {
  $("maFilterIcon").innerHTML = iconHtml("filter", 16);
  $("maDrawerClose").innerHTML = iconHtml("close", 16);
  $("maFilterBtn").onclick = () => ($("maDrawer").hidden ? openDrawer() : $("maDrawerClose").click());
  $("nameFilter").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(reload, 250); });
  $("nameFilter").addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(searchTimer); reload(); } });
  $("sectionFilter").onchange = async () => { await fillSub($("subFilter"), $("sectionFilter").value, "All sub-sections"); await fillArea($("areaFilter"), "", "", "All areas"); reload(); };
  $("subFilter").onchange = async () => { await fillArea($("areaFilter"), $("sectionFilter").value, $("subFilter").value, "All areas"); reload(); };
  $("areaFilter").onchange = reload;
  $("kindFilter").onchange = reload;
  $("clearFilters").onclick = async () => {
    $("sectionFilter").value = ""; $("kindFilter").value = "";
    await fillSub($("subFilter"), "", "All sub-sections"); await fillArea($("areaFilter"), "", "", "All areas");
    reload();
  };
  updateFilterIndicator();
}

/* ───────── Edit dialog ───────── */
const field = (id, label, control, err) => `<div class="ma-field"><label for="${id}">${label}</label>${control}<span class="ma-field-error" data-err="${id}">${esc(err || "")}</span></div>`;

function showErrors(root, errors, map) {
  root.querySelectorAll("[data-err]").forEach((s) => (s.textContent = ""));
  root.querySelectorAll(".ma-invalid").forEach((x) => { x.classList.remove("ma-invalid"); x.removeAttribute("aria-invalid"); });
  let first = null;
  for (const [k, m] of Object.entries(errors)) {
    const el = root.querySelector(`#${map[k]}`); if (!el) continue;
    el.classList.add("ma-invalid"); el.setAttribute("aria-invalid", "true");
    const s = root.querySelector(`[data-err="${map[k]}"]`); if (s) s.textContent = m;
    first ||= el;
  }
  first?.focus();
}

async function openEdit(row) {
  if (!state.access.edit) return;
  const F = { name: "ed-name", section_id: "ed-sec", sub_section_id: "ed-sub", area_id: "ed-area", kind_id: "ed-kind", duration_days: "ed-dur" };
  const subs = await svc.subsections(row.section_id).catch(() => []);
  const areas = await svc.areas(row.section_id, row.sub_section_id).catch(() => []);
  const r = await openDialog({
    title: "Edit activity", wide: true, closeX: true,
    bodyHtml: `<div class="ma-form-grid">
      <div class="ma-wide">${field("ed-name", "Activity name", `<input id="ed-name" class="sasv-control" data-autofocus value="${esc(row.activity_name)}" maxlength="200">`)}</div>
      ${field("ed-sec", "Section", `<select id="ed-sec" class="sasv-control">${opts(sections, "id", "section_name", "Select…", row.section_id)}</select>`)}
      ${field("ed-sub", "Sub-section", `<select id="ed-sub" class="sasv-control">${opts(subs, "id", "subsection_name", "Select…", row.sub_section_id)}</select>`)}
      ${field("ed-area", "Area", `<select id="ed-area" class="sasv-control">${opts(areas, "id", "area_name", "Select…", row.area_id)}</select>`)}
      ${field("ed-kind", "Kind", `<select id="ed-kind" class="sasv-control">${opts(kinds, "id", "name", "Select…", row.kind_id)}</select>`)}
      ${field("ed-dur", "Duration (days)", `<input id="ed-dur" class="sasv-control" type="number" min="0" step="1" value="${esc(row.duration_days)}">`)}
      </div><div class="ma-banner is-error" id="ed-msg" role="alert" hidden></div>`,
    buttons: [
      { id: "cancel", label: "Cancel" },
      { id: "save", label: "Save changes", cls: "primary", run: async (api) => {
        const q = (i) => api.dlg.querySelector(`#${i}`);
        const draft = { name: q("ed-name").value, section_id: q("ed-sec").value, sub_section_id: q("ed-sub").value, area_id: q("ed-area").value, kind_id: q("ed-kind").value, duration_days: q("ed-dur").value };
        const v = validateActivity(draft);
        q("ed-msg").hidden = true;
        if (!v.ok) { showErrors(api.dlg, v.errors, F); return; }
        api.setBusy(true);
        const res = await svc.update(row.id, draft);
        api.setBusy(false);
        if (!res.ok) { q("ed-msg").hidden = false; q("ed-msg").textContent = res.message; return; } // dialog stays open, input preserved
        api.close({ id: "save" });
        setStatus("Activity updated.");
        reload().then(() => focusRow(row.id));
      } },
    ],
    onMount: (api) => {
      const q = (i) => api.dlg.querySelector(`#${i}`);
      q("ed-sec").onchange = async () => { await fillSub(q("ed-sub"), q("ed-sec").value, "Select…"); await fillArea(q("ed-area"), "", "", "Select…"); };
      q("ed-sub").onchange = () => fillArea(q("ed-area"), q("ed-sec").value, q("ed-sub").value, "Select…");
      api.dlg.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); api.dlg.querySelector('[data-act="save"]').click(); } });
    },
  });
  if (r.id === "cancel") openDetails(row); // back to the details view; Esc/Cancel never loses context
}

function focusRow(id) {
  const k = CSS.escape(String(id));
  const el = $("existingTable").offsetParent !== null ? document.querySelector(`#existingTable tr[data-id="${k}"] .ma-name-link`) : document.querySelector(`#maCards li[data-id="${k}"] .ma-card`);
  el?.focus({ preventScroll: true });
}
const firstActivityControl = () => ($("existingTable").offsetParent !== null ? document.querySelector("#existingTable .ma-name-link") : document.querySelector("#maCards .ma-card"));

/* ───────── Details dialog (row click / Enter / Space on the activity button) ───────── */
async function openDetails(row) {
  const edit = state.access.edit;
  const dl = [["Section", row.sections?.section_name], ["Sub-section", row.subsections?.subsection_name],
    ["Area", row.areas?.area_name], ["Kind", row.activity_kinds?.name], ["Duration", formatDuration(row.duration_days)], ["ID", row.id]]
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v ?? "—")}</dd>`).join("");
  const r = await openDialog({
    title: "Activity details", closeX: true, bodyHtml: `<div class="ma-details"><p class="ma-detail-name">${esc(row.activity_name)}</p><dl class="ma-detail-list">${dl}</dl></div>`,
    buttons: [...(edit ? [{ id: "delete", label: "Delete", cls: "danger" }, { id: "edit", label: "Edit", cls: "primary" }] : [])],
  });
  if (r.id === "edit") return openEdit(row);
  if (r.id === "delete") return onDelete(row);
  focusRow(row.id);
}

async function onDelete(row) {
  if (!state.access.edit) return;
  if (!(await confirmDialog("Delete activity", `Delete “${row.activity_name}”? This cannot be undone. Activities used by production routes cannot be deleted.`, "Delete", "danger"))) return openDetails(row);
  const res = await svc.remove(row.id);
  if (!res.ok) { await alertDialog("Delete failed", res.message); return openDetails(row); }
  setStatus(`Deleted “${row.activity_name}”.`);
  // Remove locally (offset = loaded count stays consistent) rather than resetting scroll position.
  feed.items = feed.items.filter((x) => x.id !== row.id); feed.total = Math.max(0, feed.total - 1);
  renderFeed(true);
  (firstActivityControl() ?? $("nameFilter")).focus();
  checkSentinel();
}

/* ───────── Bulk creation ───────── */
const blankRow = (seed = {}) => ({ key: ++draftSeq, name: "", section_id: seed.section_id || "", sub_section_id: seed.sub_section_id || "", area_id: seed.area_id || "", kind_id: seed.kind_id || "", duration_days: seed.duration_days ?? "", errors: {}, msg: "" });

async function renderBulk() {
  const tb = $("multiTable").querySelector("tbody");
  const rows = await Promise.all(bulkRows.map(async (r, i) => {
    const subs = await svc.subsections(r.section_id).catch(() => []);
    const areas = await svc.areas(r.section_id, r.sub_section_id).catch(() => []);
    const err = (k) => (r.errors[k] ? `<span class="ma-field-error">${esc(r.errors[k])}</span>` : "");
    const cls = (c, k) => `class="${c}${r.errors[k] ? " ma-invalid" : ""}"${r.errors[k] ? ' aria-invalid="true"' : ""}`;
    return `<tr data-key="${r.key}" class="${r.msg ? "ma-row-failed" : ""}">
      <td class="ma-rownum" data-label="Row">${i + 1}</td>
      <td data-label="Activity"><input ${cls("m-name sasv-control", "name")} value="${esc(r.name)}" aria-label="Row ${i + 1} activity name" maxlength="200">${err("name")}${r.msg ? `<div class="ma-row-msg" role="alert">${esc(r.msg)}</div>` : ""}</td>
      <td data-label="Section"><select ${cls("m-section sasv-control", "section_id")} aria-label="Row ${i + 1} section">${opts(sections, "id", "section_name", "Select…", r.section_id)}</select>${err("section_id")}</td>
      <td data-label="Sub-section"><select ${cls("m-sub sasv-control", "sub_section_id")} aria-label="Row ${i + 1} sub-section"${r.section_id ? "" : " disabled"}>${opts(subs, "id", "subsection_name", "Select…", r.sub_section_id)}</select>${err("sub_section_id")}</td>
      <td data-label="Area"><select ${cls("m-area sasv-control", "area_id")} aria-label="Row ${i + 1} area"${r.sub_section_id ? "" : " disabled"}>${opts(areas, "id", "area_name", "Select…", r.area_id)}</select>${err("area_id")}</td>
      <td data-label="Kind"><select ${cls("m-kind sasv-control", "kind_id")} aria-label="Row ${i + 1} kind">${opts(kinds, "id", "name", "Select…", r.kind_id)}</select>${err("kind_id")}</td>
      <td data-label="Duration (days)"><input ${cls("m-dur sasv-control", "duration_days")} type="number" min="0" step="1" value="${esc(r.duration_days)}" aria-label="Row ${i + 1} duration in days">${err("duration_days")}</td>
      <td><div class="ma-row-actions">
        <button type="button" class="btn ghost ma-row-btn ma-row-dup" aria-label="Duplicate row ${i + 1}">Copy</button>
        <button type="button" class="btn ghost ma-row-btn ma-row-remove" aria-label="Remove row ${i + 1}">Remove</button></div></td></tr>`;
  }));
  tb.innerHTML = rows.join("");
  updateAddBadge();
  refreshCues();
}

function syncDraftsFromDom() {
  $("multiTable").querySelectorAll("tbody tr").forEach((tr) => {
    const r = bulkRows.find((x) => String(x.key) === tr.dataset.key); if (!r) return;
    r.name = tr.querySelector(".m-name").value; r.section_id = tr.querySelector(".m-section").value;
    r.sub_section_id = tr.querySelector(".m-sub").value; r.area_id = tr.querySelector(".m-area").value;
    r.kind_id = tr.querySelector(".m-kind").value; r.duration_days = tr.querySelector(".m-dur").value;
  });
}

async function addRow(seed) {
  syncDraftsFromDom();
  if (bulkRows.length >= BULK_MAX_ROWS) { $("maBulkSummary").textContent = `At most ${BULK_MAX_ROWS} rows per batch.`; return; }
  bulkRows.push(blankRow(seed));
  await renderBulk();
  const names = $("multiTable").querySelectorAll(".m-name"); names[names.length - 1].focus();
}

function wireBulk() {
  const tb = $("multiTable").querySelector("tbody");
  tb.addEventListener("change", async (e) => {
    const tr = e.target.closest("tr"); if (!tr) return;
    syncDraftsFromDom();
    const r = bulkRows.find((x) => String(x.key) === tr.dataset.key);
    if (e.target.classList.contains("m-section")) { r.sub_section_id = ""; r.area_id = ""; }
    if (e.target.classList.contains("m-sub")) r.area_id = "";
    if (e.target.matches(".m-section,.m-sub")) { const k = e.target.className; await renderBulk(); $("multiTable").querySelector(`tr[data-key="${r.key}"] .${k.includes("m-section") ? "m-sub" : "m-area"}`)?.focus(); }
  });
  tb.addEventListener("click", async (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    syncDraftsFromDom();
    const tr = btn.closest("tr"); const idx = bulkRows.findIndex((x) => String(x.key) === tr.dataset.key);
    if (btn.classList.contains("ma-row-remove")) {
      if (bulkRows.length > 1) bulkRows.splice(idx, 1); else bulkRows[0] = blankRow();
      await renderBulk(); ($("multiTable").querySelectorAll(".m-name")[Math.max(0, idx - 1)])?.focus();
    }
    if (btn.classList.contains("ma-row-dup")) {
      if (bulkRows.length >= BULK_MAX_ROWS) { $("maBulkSummary").textContent = `At most ${BULK_MAX_ROWS} rows per batch.`; return; }
      const s = bulkRows[idx]; bulkRows.splice(idx + 1, 0, { ...blankRow(s), name: s.name });
      await renderBulk(); $("multiTable").querySelectorAll(".m-name")[idx + 1]?.focus();
    }
  });
  $("maAddRow").onclick = () => { const last = bulkRows[bulkRows.length - 1]; syncDraftsFromDom(); addRow(last); };
  $("multiClearBtn").onclick = async () => {
    syncDraftsFromDom();
    if (bulkRows.some((r) => !isBlankDraft(r)) && !(await confirmDialog("Clear all rows", "Discard everything entered in the new-activities table?", "Clear all", "danger"))) return;
    bulkRows = [blankRow()]; $("maBulkSummary").textContent = ""; await renderBulk();
  };
  $("maPasteBtn").onclick = async () => {
    syncDraftsFromDom();
    let text = "";
    const r = await openDialog({ title: "Paste activity list", closeX: true, bodyHtml: `<div class="ma-field"><label for="pasteTxt">Enter one activity name per line (up to ${BULK_MAX_ROWS} in total).</label><textarea id="pasteTxt" class="sasv-control" rows="8" data-autofocus></textarea></div><p class="ma-help">Pasted names inherit the section, sub-section, area, kind and duration of the last row. You can edit each row afterwards.</p>`,
      buttons: [{ id: "cancel", label: "Cancel" }, { id: "ok", label: "Add rows", cls: "primary", run: (api) => { text = api.dlg.querySelector("#pasteTxt").value; api.close({ id: "ok" }); } }] });
    if (r.id !== "ok") return;
    const names = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const seed = bulkRows[bulkRows.length - 1];
    bulkRows = bulkRows.filter((x) => !isBlankDraft(x));
    const room = BULK_MAX_ROWS - bulkRows.length;
    names.slice(0, room).forEach((n) => bulkRows.push({ ...blankRow(seed), name: n }));
    if (names.length > room) $("maBulkSummary").textContent = `Only ${room} of ${names.length} names fit (limit ${BULK_MAX_ROWS} rows per batch).`;
    await renderBulk();
  };
  $("multiAddBtn").onclick = submitBulk;
}

async function submitBulk() {
  if (!state.access.edit) return;
  syncDraftsFromDom();
  const active = bulkRows.filter((r) => !isBlankDraft(r));
  if (!active.length) { $("maBulkSummary").textContent = "Nothing to add."; return; }
  const checks = validateBulk(active);
  active.forEach((r, i) => { r.errors = checks[i].errors; r.msg = ""; });
  if (checks.some((c) => !c.ok)) { await renderBulk(); $("maBulkSummary").textContent = "Fix the highlighted rows."; $("multiTable").querySelector(".ma-invalid")?.focus(); return; }
  if (!(await confirmDialog("Add activities", `Add ${active.length} ${active.length === 1 ? "activity" : "activities"}?`, "Add"))) return;
  const btn = $("multiAddBtn"); btn.disabled = true; btn.setAttribute("aria-busy", "true");
  const out = await svc.bulkCreate(active);
  btn.disabled = false; btn.removeAttribute("aria-busy");
  const kept = [];
  out.results.forEach((res, i) => { if (res.status !== "created") { active[i].msg = res.status === "failed" ? res.message : ""; kept.push(active[i]); } });
  const created = out.results.filter((r) => r.status === "created").length;
  bulkRows = kept.length ? kept : [blankRow()];
  await renderBulk();
  const failed = kept.length;
  $("maBulkSummary").textContent = `Added ${created}; ${failed} need attention.`;
  if (!failed) setStatus(`Added ${created} ${created === 1 ? "activity" : "activities"}.`);
  if (created) reload();
}

/* ───────── Init ───────── */
function applyAccess() {
  const { view, edit } = state.access;
  $("maMain").hidden = !view;
  $("maNewBtn").hidden = !edit;
  if (view && !edit) setStatus("View only — you do not have permission to create, edit or delete activities.", "warn");
}

/* ───────── Add activities modal (drafts live in bulkRows and survive close / reopen) ───────── */
let addLayer = null;
function updateAddBadge() {
  syncDraftsFromDom();
  const n = bulkRows.filter((r) => !isBlankDraft(r)).length;
  const b = $("maAddBadge"); b.hidden = n === 0; b.textContent = String(n);
  $("maNewBtn").title = $("maNewBtn").ariaLabel = n ? `Add activities (${n} draft${n === 1 ? "" : "s"} kept)` : "Add activities";
}
async function openAdd() {
  if (!state.access.edit || addLayer) return;
  const opener = $("maNewBtn");
  await renderBulk();
  addLayer = openLayer({ el: $("maAddBackdrop"), panel: $("maBulk"), opener, onClose: () => { addLayer = null; updateAddBadge(); }, focus: () => $("multiTable").querySelector(".m-name") });
  refreshCues();
}
function closeAdd() { addLayer?.close(); }

// Keep full-screen layers inside the *visible* viewport when the on-screen keyboard is open.
function syncVisualViewport() {
  const vv = window.visualViewport; if (!vv) return;
  const st = document.documentElement.style;
  st.setProperty("--ma-vvh", `${vv.height}px`); st.setProperty("--ma-vvt", `${vv.offsetTop}px`);
}
window.visualViewport?.addEventListener("resize", syncVisualViewport);
window.visualViewport?.addEventListener("scroll", syncVisualViewport);

async function init() {
  syncVisualViewport();
  mountModuleHome($("homeBtn"));
  $("homeBtn").addEventListener("click", () => window.location.assign("index.html"));
  setStatus("Loading…");
  const boot = await bootstrapApp({ loginPage: "login.html" });
  if (!boot.ok) { if (boot.reason !== "no-session") setStatus("Could not verify your session. Reload and try again.", "error", { label: "Retry", run: () => location.reload() }); return; }
  state.access = await loadAccess(supabase, boot.session?.user?.id, MODULE_ID);
  if (!state.access.view) {
    setStatus(state.access.reason === "denied" ? "You do not have access to Manage Activities." : "Could not verify your permissions. Access is withheld until they can be confirmed.", "error",
      state.access.reason === "denied" ? null : { label: "Retry", run: () => location.reload() });
    applyAccess(); return;
  }
  setStatus("");
  applyAccess();
  try {
    [sections, kinds] = await Promise.all([svc.sections(), svc.kinds()]);
  } catch (e) {
    console.error("[activities] lookup load failed", e);
    setStatus("Could not load sections or kinds.", "error", { label: "Retry", run: () => location.reload() });
    return;
  }
  $("sectionFilter").innerHTML = opts(sections, "id", "section_name", "All sections");
  $("kindFilter").innerHTML = opts(kinds, "id", "name", "All kinds");
  wireFilters();
  wireFeed();
  wireCues();
  tableClicks();
  if (state.access.edit) {
    $("maAddIcon").innerHTML = iconHtml("plus", 16);
    $("maBackBtn").innerHTML = iconHtml("close", 16);
    wireBulk(); bulkRows = [blankRow()];
    $("maNewBtn").onclick = openAdd;
    $("maBackBtn").onclick = closeAdd;
  }
  await loadBatch({ reset: true });
}

function tableClicks() {
  const open = (id) => { const row = feed.items.find((r) => String(r.id) === String(id)); if (row) openDetails(row); };
  // Row click for pointers; the activity-name button is the keyboard / assistive-tech path (Enter and Space activate it natively).
  $("existingTable").querySelector("tbody").addEventListener("click", (e) => open(e.target.closest("tr")?.dataset.id));
  // Narrow-screen cards open the same details dialog (click, Enter, Space).
  const cards = $("maCards");
  cards.addEventListener("click", (e) => open(e.target.closest("li")?.dataset.id));
  cards.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("ma-card")) { e.preventDefault(); open(e.target.closest("li")?.dataset.id); } });
}

init();
