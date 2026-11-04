import { supabase } from "../public/shared/js/supabaseClient.js";
import { bootstrapApp } from "../public/shared/js/appBootstrap.js";
import { mountModuleHome } from "../public/shared/js/sasv-module-chrome.js";
import {
  MODULE_ID, PAGE_SIZES, DEFAULT_PAGE_SIZE, BULK_MAX_ROWS,
  createActivitiesService, loadAccess, validateBulk, validateActivity, isBlankDraft, pagerState,
} from "../public/shared/js/manage-activities-core.js";

const $ = (id) => document.getElementById(id);
const svc = createActivitiesService(supabase);
const state = { access: { view: false, edit: false }, page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, rows: [], seq: 0, loading: false };
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

/* ───────── Dialog (focus-trapped, Esc cancels, focus restored) ───────── */
function openDialog({ title, bodyHtml, buttons, onMount, wide = false }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const host = $("maDialogHost");
    const back = document.createElement("div");
    back.className = "sasv-modal-backdrop";
    back.innerHTML = `<div class="sasv-modal${wide ? " sasv-modal--lg" : ""}" role="dialog" aria-modal="true" aria-labelledby="maDlgTitle">
      <div class="modal-header"><h2 id="maDlgTitle" class="modal-title">${esc(title)}</h2></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">${buttons.map((b) => `<button type="button" class="btn ${b.cls || "ghost"}" data-act="${esc(b.id)}">${esc(b.label)}</button>`).join("")}</div></div>`;
    host.appendChild(back);
    const dlg = back.firstElementChild;
    const close = (val) => { document.removeEventListener("keydown", onKey, true); back.remove(); opener?.focus?.(); resolve(val); };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close({ id: "cancel" }); return; }
      if (e.key !== "Tab") return;
      const f = [...dlg.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    const api = { dlg, close, setBusy(b) { dlg.querySelectorAll("button,input,select,textarea").forEach((x) => (x.disabled = b)); dlg.setAttribute("aria-busy", String(b)); } };
    dlg.querySelectorAll("[data-act]").forEach((btn) => (btn.onclick = () => (buttons.find((x) => x.id === btn.dataset.act).run ? buttons.find((x) => x.id === btn.dataset.act).run(api) : close({ id: btn.dataset.act }))));
    onMount?.(api);
    (dlg.querySelector("[data-autofocus]") || dlg.querySelector("button.primary,button.danger") || dlg.querySelector("button"))?.focus();
  });
}

const confirmDialog = (title, message, label = "Confirm", cls = "primary") =>
  openDialog({ title, bodyHtml: `<p>${esc(message)}</p>`, buttons: [{ id: "cancel", label: "Cancel" }, { id: "ok", label, cls }] }).then((r) => r.id === "ok");
const alertDialog = (title, message) => openDialog({ title, bodyHtml: `<p style="white-space:pre-line">${esc(message)}</p>`, buttons: [{ id: "ok", label: "OK", cls: "primary" }] });

/* ───────── Listing ───────── */
function filters() {
  return {
    search: $("nameFilter").value, sectionId: $("sectionFilter").value, subId: $("subFilter").value,
    areaId: $("areaFilter").value, kindId: $("kindFilter").value,
  };
}

async function refresh({ keepStatus = false } = {}) {
  const seq = ++state.seq;
  const tbl = $("existingTable");
  state.loading = true; tbl.setAttribute("aria-busy", "true");
  $("maEmpty").hidden = false; $("maEmpty").textContent = "Loading activities…";
  if (!keepStatus) setStatus("");
  try {
    const res = await svc.list({ ...filters(), page: state.page, pageSize: state.pageSize });
    if (seq !== state.seq) return; // stale response
    // Page now past the end (e.g. after delete): step back once.
    if (res.rows.length === 0 && res.total > 0 && state.page > 1) { state.page = pagerState({ page: state.page, pageSize: state.pageSize, total: res.total }).pages; return refresh({ keepStatus }); }
    state.rows = res.rows; state.total = res.total;
    renderRows();
  } catch (e) {
    if (seq !== state.seq) return;
    console.error("[activities] list failed", e);
    state.rows = []; state.total = 0; renderRows(true);
    setStatus("Could not load activities. Check your connection and try again.", "error", { label: "Retry", run: () => refresh() });
  } finally {
    if (seq === state.seq) { state.loading = false; tbl.setAttribute("aria-busy", "false"); }
  }
}

function renderRows(failed = false) {
  const edit = state.access.edit;
  $("existingTable").querySelector("tbody").innerHTML = state.rows.map((r) => `
    <tr data-id="${esc(r.id)}">
      <td>${esc(r.activity_name)}</td><td>${esc(r.sections?.section_name)}</td><td>${esc(r.subsections?.subsection_name)}</td>
      <td>${esc(r.areas?.area_name)}</td><td>${esc(r.activity_kinds?.name)}</td><td class="ma-num">${esc(r.duration_days)}</td>
      ${edit ? `<td><div class="ma-row-actions">
        <button type="button" class="btn ghost edit-btn" aria-label="Edit ${esc(r.activity_name)}">Edit</button>
        <button type="button" class="btn danger delete-btn" aria-label="Delete ${esc(r.activity_name)}">Delete</button></div></td>` : ""}
    </tr>`).join("");
  const empty = $("maEmpty");
  empty.hidden = state.rows.length > 0;
  if (!state.rows.length) empty.textContent = failed ? "Activities could not be loaded." : (Object.values(filters()).some(Boolean) ? "No activities match the current filters." : "No activities found.");
  const p = pagerState({ page: state.page, pageSize: state.pageSize, total: state.total });
  $("maCount").textContent = `${state.total} ${state.total === 1 ? "activity" : "activities"}`;
  $("maPagerInfo").textContent = state.total ? `Showing ${p.from}–${p.to} of ${state.total}` : "Showing 0";
  $("maPageLabel").textContent = `Page ${p.page} of ${p.pages}`;
  $("maPrev").disabled = !p.hasPrev; $("maNext").disabled = !p.hasNext;
}

/* ───────── Filters ───────── */
let searchTimer = null;
const resetAndRefresh = () => { state.page = 1; refresh(); };

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

function wireFilters() {
  $("nameFilter").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(resetAndRefresh, 250); });
  $("nameFilter").addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(searchTimer); resetAndRefresh(); } });
  $("sectionFilter").onchange = async () => { await fillSub($("subFilter"), $("sectionFilter").value, "All sub-sections"); await fillArea($("areaFilter"), "", "", "All areas"); resetAndRefresh(); };
  $("subFilter").onchange = async () => { await fillArea($("areaFilter"), $("sectionFilter").value, $("subFilter").value, "All areas"); resetAndRefresh(); };
  $("areaFilter").onchange = resetAndRefresh;
  $("kindFilter").onchange = resetAndRefresh;
  $("clearFilters").onclick = async () => {
    $("nameFilter").value = ""; $("sectionFilter").value = ""; $("kindFilter").value = "";
    await fillSub($("subFilter"), "", "All sub-sections"); await fillArea($("areaFilter"), "", "", "All areas");
    resetAndRefresh();
  };
  $("maPageSize").innerHTML = PAGE_SIZES.map((n) => `<option value="${n}">${n} / page</option>`).join("");
  $("maPageSize").onchange = () => { state.pageSize = Number($("maPageSize").value); resetAndRefresh(); };
  $("maPrev").onclick = () => { if (state.page > 1) { state.page--; refresh(); } };
  $("maNext").onclick = () => { state.page++; refresh(); };
}

/* ───────── Edit dialog ───────── */
const field = (id, label, control, err) => `<div class="sasv-field"><label for="${id}">${label}</label>${control}<span class="ma-field-error" data-err="${id}">${esc(err || "")}</span></div>`;

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
  await openDialog({
    title: "Edit activity", wide: true,
    bodyHtml: `<div class="ma-form-grid">
      <div class="ma-wide">${field("ed-name", "Activity name", `<input id="ed-name" data-autofocus value="${esc(row.activity_name)}" maxlength="200">`)}</div>
      ${field("ed-sec", "Section", `<select id="ed-sec">${opts(sections, "id", "section_name", "Select…", row.section_id)}</select>`)}
      ${field("ed-sub", "Sub-section", `<select id="ed-sub">${opts(subs, "id", "subsection_name", "Select…", row.sub_section_id)}</select>`)}
      ${field("ed-area", "Area", `<select id="ed-area">${opts(areas, "id", "area_name", "Select…", row.area_id)}</select>`)}
      ${field("ed-kind", "Kind", `<select id="ed-kind">${opts(kinds, "id", "name", "Select…", row.kind_id)}</select>`)}
      ${field("ed-dur", "Duration (days)", `<input id="ed-dur" type="number" min="0" step="1" value="${esc(row.duration_days)}">`)}
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
        refresh({ keepStatus: true });
      } },
    ],
    onMount: (api) => {
      const q = (i) => api.dlg.querySelector(`#${i}`);
      q("ed-sec").onchange = async () => { await fillSub(q("ed-sub"), q("ed-sec").value, "Select…"); await fillArea(q("ed-area"), "", "", "Select…"); };
      q("ed-sub").onchange = () => fillArea(q("ed-area"), q("ed-sec").value, q("ed-sub").value, "Select…");
      api.dlg.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); api.dlg.querySelector('[data-act="save"]').click(); } });
    },
  });
}

async function onDelete(row) {
  if (!state.access.edit) return;
  if (!(await confirmDialog("Delete activity", `Delete “${row.activity_name}”? This cannot be undone. Activities used by production routes cannot be deleted.`, "Delete", "danger"))) return;
  const res = await svc.remove(row.id);
  if (!res.ok) { await alertDialog("Delete failed", res.message); return; }
  setStatus(`Deleted “${row.activity_name}”.`);
  refresh({ keepStatus: true });
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
      <td>${i + 1}</td>
      <td><input ${cls("m-name edit-input", "name")} value="${esc(r.name)}" aria-label="Row ${i + 1} activity name" maxlength="200">${err("name")}${r.msg ? `<div class="ma-row-msg" role="alert">${esc(r.msg)}</div>` : ""}</td>
      <td><select ${cls("m-section edit-select", "section_id")} aria-label="Row ${i + 1} section">${opts(sections, "id", "section_name", "Select…", r.section_id)}</select>${err("section_id")}</td>
      <td><select ${cls("m-sub edit-select", "sub_section_id")} aria-label="Row ${i + 1} sub-section"${r.section_id ? "" : " disabled"}>${opts(subs, "id", "subsection_name", "Select…", r.sub_section_id)}</select>${err("sub_section_id")}</td>
      <td><select ${cls("m-area edit-select", "area_id")} aria-label="Row ${i + 1} area"${r.sub_section_id ? "" : " disabled"}>${opts(areas, "id", "area_name", "Select…", r.area_id)}</select>${err("area_id")}</td>
      <td><select ${cls("m-kind edit-select", "kind_id")} aria-label="Row ${i + 1} kind">${opts(kinds, "id", "name", "Select…", r.kind_id)}</select>${err("kind_id")}</td>
      <td><input ${cls("m-dur edit-number", "duration_days")} type="number" min="0" step="1" value="${esc(r.duration_days)}" aria-label="Row ${i + 1} duration in days">${err("duration_days")}</td>
      <td><div class="ma-row-actions">
        <button type="button" class="btn ghost row-dup" aria-label="Duplicate row ${i + 1}">Copy</button>
        <button type="button" class="btn ghost row-remove" aria-label="Remove row ${i + 1}">Remove</button></div></td></tr>`;
  }));
  tb.innerHTML = rows.join("");
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
  if (bulkRows.length >= BULK_MAX_ROWS) { setStatus(`At most ${BULK_MAX_ROWS} rows per batch.`, "warn"); return; }
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
    if (btn.classList.contains("row-remove")) {
      if (bulkRows.length > 1) bulkRows.splice(idx, 1); else bulkRows[0] = blankRow();
      await renderBulk(); ($("multiTable").querySelectorAll(".m-name")[Math.max(0, idx - 1)])?.focus();
    }
    if (btn.classList.contains("row-dup")) {
      if (bulkRows.length >= BULK_MAX_ROWS) return setStatus(`At most ${BULK_MAX_ROWS} rows per batch.`, "warn");
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
    const r = await openDialog({ title: "Paste activity names", bodyHtml: `<div class="sasv-field"><label for="pasteTxt">One activity name per line (max ${BULK_MAX_ROWS}). Section, sub-section, area, kind and days are copied from the last row.</label><textarea id="pasteTxt" rows="8" data-autofocus></textarea></div>`,
      buttons: [{ id: "cancel", label: "Cancel" }, { id: "ok", label: "Add rows", cls: "primary", run: (api) => { text = api.dlg.querySelector("#pasteTxt").value; api.close({ id: "ok" }); } }] });
    if (r.id !== "ok") return;
    const names = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const seed = bulkRows[bulkRows.length - 1];
    bulkRows = bulkRows.filter((x) => !isBlankDraft(x));
    const room = BULK_MAX_ROWS - bulkRows.length;
    names.slice(0, room).forEach((n) => bulkRows.push({ ...blankRow(seed), name: n }));
    if (names.length > room) setStatus(`Only ${room} of ${names.length} names fit (limit ${BULK_MAX_ROWS} rows per batch).`, "warn");
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
  setStatus(failed ? `Added ${created} of ${active.length}. ${failed} row(s) were kept with their errors.` : `Added ${created} ${created === 1 ? "activity" : "activities"}.`, failed ? "warn" : "");
  if (created) { state.page = 1; refresh({ keepStatus: true }); }
}

/* ───────── Init ───────── */
function applyAccess() {
  const { view, edit } = state.access;
  $("maMain").hidden = !view;
  $("maBulk").hidden = !edit;
  document.querySelectorAll("[data-requires-edit]").forEach((el) => { if (el.id !== "maBulk") el.hidden = !edit; });
  if (view && !edit) setStatus("View only — you do not have permission to create, edit or delete activities.", "warn");
}

async function init() {
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
  tableClicks();
  if (state.access.edit) { wireBulk(); bulkRows = [blankRow()]; await renderBulk(); $("maNewBtn").onclick = () => { $("maBulk").scrollIntoView({ block: "start" }); $("multiTable").querySelector(".m-name")?.focus(); }; }
  await refresh({ keepStatus: true });
}

function tableClicks() {
  $("existingTable").querySelector("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    const row = state.rows.find((r) => String(r.id) === btn.closest("tr").dataset.id); if (!row) return;
    if (btn.classList.contains("edit-btn")) openEdit(row);
    if (btn.classList.contains("delete-btn")) onDelete(row);
  });
}

init();
