// sop-editor.js
// Fresh module for New/Edit SOP — aligned to revised schema

import { supabase } from "../public/shared/js/supabaseClient.js";

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
function say(el, cls, txt) {
  if (!el) return;
  el.textContent = txt;
  el.className = `status ${cls}`;
}
function busy(btn, labelBusy, labelIdle, state) {
  if (!btn) return;
  btn.disabled = state;
  btn.textContent = state ? labelBusy : labelIdle;
}
const debounce = (fn, ms = 600) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

// Inline toast -> route through the in-page modal so everything is consistent
function toast(msg, kind = "ok", titleOverride) {
  const title =
    titleOverride ||
    (kind === "err" ? "Error" : kind === "warn" ? "Notice" : "Success");
  // Return the Promise so callers can await before reloading etc.
  return showModal({
    title,
    body: msg,
    okText: "OK",
    danger: kind === "err",
  });
}

// In-page modal (Promise<boolean>)
async function showModal({
  title = "",
  body = "",
  okText = "OK",
  cancelText = "Cancel",
  danger = false,
} = {}) {
  const overlay = document.getElementById("modalOverlay");
  const t = document.getElementById("modalTitle");
  const b = document.getElementById("modalBody");
  const ok = document.getElementById("modalOk");
  const cancel = document.getElementById("modalCancel");
  if (!overlay || !t || !b || !ok || !cancel) {
    alert(body || title);
    return true;
  }

  t.textContent = title;
  b.textContent = "";
  b.innerHTML = ""; // clean
  // allow simple text or HTML string
  if (typeof body === "string") b.textContent = body;
  else b.appendChild(body);
  ok.textContent = okText;
  cancel.textContent = cancelText;
  ok.classList.toggle("btn-danger", !!danger);

  overlay.hidden = false;

  return new Promise((resolve) => {
    const done = (val) => {
      overlay.hidden = true;
      ok.onclick = cancel.onclick = null;
      resolve(val);
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    overlay.onclick = (e) => {
      if (e.target === overlay) done(false);
    };
  });
}

async function confirmModal({
  title = "Confirm",
  body = "Are you sure?",
  okText = "OK",
  danger = false,
} = {}) {
  return showModal({ title, body, okText, cancelText: "Cancel", danger });
}

async function promptModal({
  title = "Input",
  label = "Comment",
  okText = "OK",
} = {}) {
  const overlay = document.getElementById("modalOverlay");
  const t = document.getElementById("modalTitle");
  const b = document.getElementById("modalBody");
  const ok = document.getElementById("modalOk");
  const cancel = document.getElementById("modalCancel");
  if (!overlay || !t || !b || !ok || !cancel) return { ok: false, value: "" };

  t.textContent = title;
  b.innerHTML = `<label style="display:block;margin-bottom:6px;">${label}</label><textarea id="__modalInput" rows="4" style="width:100%;"></textarea>`;
  ok.textContent = okText;
  cancel.textContent = "Cancel";
  ok.classList.remove("btn-danger");
  overlay.hidden = false;

  return new Promise((resolve) => {
    const done = (confirm) => {
      const val = document.getElementById("__modalInput")?.value || "";
      overlay.hidden = true;
      ok.onclick = cancel.onclick = overlay.onclick = null;
      resolve({ ok: confirm, value: val });
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    overlay.onclick = (e) => {
      if (e.target === overlay) done(false);
    };
  });
}

// Adds months to yyyy-mm-dd safely
function addMonthsISO(isoDate, months) {
  if (!isoDate || !months) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const target = new Date(base.getFullYear(), base.getMonth() + months + 1, 0);
  const dd = Math.min(d, target.getDate());
  const res = new Date(base.getFullYear(), base.getMonth() + months, dd);
  return `${res.getFullYear()}-${String(res.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(res.getDate()).padStart(2, "0")}`;
}

// Guidance (placeholder) shown in empty section bodies
function getGuidanceFor(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("purpose")) {
    return "Describe why this SOP exists and the intended outcome. Keep it 2–4 sentences.";
  }
  if (t.includes("scope")) {
    return "Who/what is covered? Include inclusions and exclusions. Keep it concise.";
  }
  if (t.includes("responsibilities")) {
    return "List roles and their duties (e.g., Quality Manager, Production Head, Operators).";
  }
  if (t.includes("procedure")) {
    return "Numbered, step-by-step instructions. Note tools, parameters, and acceptance criteria.";
  }
  if (t.includes("records")) {
    return "What records are created? Who owns them? Retention period and storage location.";
  }
  if (t.includes("references")) {
    return "Cite related SOPs, regulations, manuals (code — title).";
  }
  return "Write the content for this section here. Markdown or HTML is supported.";
}

// More realistic “Insert sample” content (Markdown)
function getSampleFor(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("purpose")) {
    return `This SOP defines the standardized process for **mixing MF-grade solvent** to ensure
consistent quality, safety, and regulatory compliance.
It enables repeatable outcomes and reduces process variance.`;
  }
  if (t.includes("scope")) {
    return `**Included:** MF product line, mixing room, 200–500 L batches.
**Excluded:** Pilot-scale trials, non-MF product families.

**Applies to:** Production Operators, Line Supervisors, Quality Control.`;
  }
  if (t.includes("responsibilities")) {
    return `- **Quality Manager:** Approves SOP and changes; ensures compliance.
- **Production Head:** Ensures resources & training; monitors adherence.
- **Line Supervisor:** Verifies pre-checks; signs off batch records.
- **Operators:** Execute procedure as written; record measurements.`;
  }
  if (t.includes("procedure")) {
    return `1. **Verify materials** against the batch ticket (lot, expiry).
2. **Clean & inspect** mixing tank (SF-03-INS checklist).
3. **Charge solvent**: 120 L at 22–26 °C. Agitator at 180–220 rpm.
4. **Add additive A** slowly over 5 min; maintain rpm and temperature.
5. **Mix** for 20 min. Take in-process sample; send to QC.
6. **QC acceptance**: Viscosity 310–330 cP @ 25 °C; pH 6.8–7.2.
7. If within limits, **proceed to filtration** (10 µm) and label container.
8. **Complete records** and attach QC report to batch packet.`;
  }
  if (t.includes("records")) {
    return `- **Batch Record** — Owner: Line Supervisor — Retention: 5 years — *DMS/BR/MF/*
- **Equipment Checklist** — Owner: Maintenance — Retention: 2 years — *DMS/CHK/MEQ/*
- **QC Report** — Owner: QC — Retention: 5 years — *DMS/QC/MF/*`;
  }
  if (t.includes("references")) {
    return `- **MF.0010-002** — Solvent Handling & Storage
- **QA.0004-015** — In-Process Sampling
- **ISO 9001:2015** — 8.5 Production and Service Provision`;
  }
  return `Provide clear, concise content for this section.
Use lists for steps; bold key limits (e.g., **180–220 rpm**).`;
}

function getQuery(k) {
  const p = new URLSearchParams(window.location.search);
  return p.get(k);
}

function wirePlaceholderOnFocus(el) {
  if (!el) return;
  el.dataset._ph = el.placeholder || "";
  el.addEventListener("focus", () => {
    el.placeholder = "";
  });
  el.addEventListener("blur", () => {
    if (!el.value) el.placeholder = el.dataset._ph || "";
  });
}

function enforceDraftLocks() {
  const locked = currentStatus !== "draft";
  if (policyEdit) policyEdit.disabled = locked;
  if (plannedEffEdit) plannedEffEdit.disabled = locked;
  if (btnPlannerSave) btnPlannerSave.disabled = locked;
  if (elPgkEdit) elPgkEdit.disabled = locked;
  if (hdrTitle) hdrTitle.disabled = locked;
  // NEW: lock the add-section and add-attachment inputs
  if (document.getElementById("addSectionCard")) {
    secTitle && (secTitle.disabled = locked);
    secBody && (secBody.disabled = locked);
    btnAddSection && (btnAddSection.disabled = locked);
  }
  if (document.getElementById("attachmentsAddCard")) {
    attFile && (attFile.disabled = locked);
    attUrl && (attUrl.disabled = locked);
    btnAddAttachment && (btnAddAttachment.disabled = locked);
  }
}

function dateOnly(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function syncSectionsToolbar() {
  if (btnRestoreDefault) btnRestoreDefault.disabled = currentStatus !== "draft";
}

// ────────────────────────────────────────────────────────────────────────────
/** Elements */
// ────────────────────────────────────────────────────────────────────────────
const pageTitle = $("pageTitle");
const homeBtn = $("homeBtn");
const btnClear = $("btnClear");

// Create
const createBlock = $("createBlock");
const elSeries = $("series");
const elActivity = $("activity");
const elGroupKind = $("groupKind");
const elPolicy = $("policy");
const elPlannedEff = $("plannedEff");
const elTitle = $("title");
const elSummary = $("summary");
const elBtnCreate = $("btnCreate");
const elMsgCreate = $("msgCreate");
const elResultCreate = $("resultCreate");
const metaNextRevisionCreate = $("metaNextRevisionCreate");

// Edit
const editBlock = $("editBlock");
const hdrSopCode = $("hdrSopCode");
const hdrTitle = $("hdrTitle");
const hdrStatus = $("hdrStatus");
const hdrActivity = $("hdrActivity");
const elMetaVersion = $("metaVersion");
const elMetaCreatedAt = $("metaCreatedAt");
const elMetaUpdatedAt = $("metaUpdatedAt");
const elMetaEffectiveFrom = $("metaEffectiveFrom");
const elMetaNextRevision = $("metaNextRevision");
const elMetaCreatedBy = $("metaCreatedBy");
const elMetaUpdatedBy = $("metaUpdatedBy");
const elMetaPolicyName = $("metaPolicyName");
const btnPublish = $("btnPublish");
const btnObsolete = $("btnObsolete");
const btnRestoreDefault = $("btnRestoreDefault");

// Planner
const policyEdit = $("policyEdit");
const plannedEffEdit = $("plannedEffEdit");
const nextReviewEdit = $("nextReviewEdit");
const elPgkEdit = $("pgkEdit");
const btnPlannerSave = $("btnPlannerSave");
const plannerCard = $("plannerCard");
const sectionsHelp = $("sectionsHelp");

// Approvals

const btnSubmitReview = $("btnSubmitReview");
const approvalsCard = $("approvalsCard");
const approvalsList = $("approvalsList");

// simple role check: only admins can approve (you can expand later)
let currentUser = null;
let isAdmin = false;

// Sections
const sectionsList = $("sectionsList");
const secTitle = $("secTitle");
const secBody = $("secBody");
if (secBody) {
  secBody.placeholder =
    "Write the content for the new section here (Markdown or HTML). Include steps, limits, and acceptance criteria where relevant.";
  wirePlaceholderOnFocus(secBody);
}
const btnAddSection = $("btnAddSection");
const msgSections = $("msgSections");

// Attachments
const attList = $("attList");
const attFile = $("attFile");
const attUrl = $("attUrl");
const btnAddAttachment = $("btnAddAttachment");
const msgAttach = $("msgAttach");

// Start new draft
const startDraftRow = $("startDraftRow");
const cloneFromActive = $("cloneFromActive");
const btnStartMinor = $("btnStartMinor");
const btnStartMajor = $("btnStartMajor");
const msgStart = $("msgStart");

// State
let revisionId = getQuery("rev") || null;
let sopId = null;
let sopCode = null;
let currentStatus = null;
let currentVersion = null;
let persistedPolicyCode = null;
let persistedPlannedEff = null;
let persistedPgkId = null;

// ────────────────────────────────────────────────────────────────────────────
// Lookup loaders
// ────────────────────────────────────────────────────────────────────────────
async function loadSeries() {
  const { data, error } = await supabase
    .from("sop_series")
    .select("code, name")
    .eq("is_active", true)
    .order("code");
  if (error) throw error;

  elSeries.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— Select series —";
  ph.selected = true;
  elSeries.appendChild(ph);

  data.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.code;
    opt.textContent = `${s.code} — ${s.name}`;
    elSeries.appendChild(opt);
  });
}

async function loadActivities() {
  const { data, error } = await supabase
    .from("activity_kinds")
    .select("id, name, short_code")
    .order("name");

  if (error) throw error;

  elActivity.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— Select activity —";
  ph.selected = true;
  elActivity.appendChild(ph);

  data.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = a.short_code ? `${a.name} (${a.short_code})` : a.name;
    elActivity.appendChild(opt);
  });
}

async function loadGroupKinds(targetSelect) {
  const sel = targetSelect || elGroupKind;
  if (!sel) return;
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— Optional: Product Group —";
  ph.selected = true;
  sel.appendChild(ph);

  const { data, error } = await supabase
    .from("product_group_kinds")
    .select("id, group_name, code")
    .order("group_name");
  if (error) throw error;

  data.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.code ? `${g.code} — ${g.group_name}` : g.group_name;
    sel.appendChild(opt);
  });
}

async function loadPolicies(selectEl = elPolicy, selected = "") {
  const { data, error } = await supabase
    .from("sop_review_policies")
    .select("code, name, months_interval");
  if (error) throw error;

  if (!selectEl) return;
  selectEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— Select review policy —";
  ph.selected = true;
  selectEl.appendChild(ph);

  data.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.code;
    opt.textContent = p.months_interval
      ? `${p.name} — every ${p.months_interval} months`
      : `${p.name} — event-driven`;
    opt.dataset.months = p.months_interval ?? "";
    if (selected && selected === p.code) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

async function namesForProfileIds(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniq);
  if (error || !data) return {};
  const map = {};
  data.forEach((r) => {
    map[r.id] = r.full_name || r.id;
  });
  return map;
}

// ────────────────────────────────────────────────────────────────────────────
// Create flow
// ────────────────────────────────────────────────────────────────────────────
function updateCreateMetaPreview() {
  const policyOpt = elPolicy.options[elPolicy.selectedIndex];
  const months = policyOpt?.dataset?.months
    ? Number(policyOpt.dataset.months)
    : null;
  const planned = elPlannedEff.value || todayISO();
  if (!months) {
    metaNextRevisionCreate.textContent = elPolicy.value ? "Event-driven" : "—";
    return;
  }
  const nextISO = addMonthsISO(planned, months);
  metaNextRevisionCreate.textContent = nextISO ? fmtDate(nextISO) : "—";
}

async function createSop() {
  const series_code = elSeries.value?.trim();
  const title = elTitle.value?.trim();
  const change_summary = elSummary.value?.trim() || "Initial creation";
  const activity_kind_id = elActivity.value || null; // works for activities or activity_kinds since IDs are UUIDs typically
  const review_policy_code = elPolicy.value || null;
  const planned_effective_from = elPlannedEff.value || todayISO();
  const product_group_kind_id = elGroupKind.value || null;

  if (!series_code) return say(elMsgCreate, "err", "Please select a Series.");
  if (!activity_kind_id)
    return say(elMsgCreate, "err", "Please select an Activity.");
  if (!review_policy_code)
    return say(elMsgCreate, "err", "Please select a Review Policy.");
  if (!title) return say(elMsgCreate, "err", "Please enter a Title.");

  busy(elBtnCreate, "Creating…", "Create SOP", true);
  say(elMsgCreate, "ok", "Creating…");

  try {
    // 1) Create master
    const { data: m, error: mErr } = await supabase
      .from("sop_master")
      .insert([
        {
          series_code,
          title,
          description: null,
          activity_kind_id,
          review_policy_code,
          product_group_kind_id: product_group_kind_id || null,
        },
      ])
      .select("id, sop_code")
      .single();
    if (mErr) throw mErr;

    // 2) Create first draft revision (change_type='new')
    const { data: r, error: rErr } = await supabase
      .from("sop_revisions")
      .insert([
        {
          sop_id: m.id,
          change_type: "new",
          change_summary,
          status: "draft",
          effective_date: planned_effective_from || null, // planned date held here until published
        },
      ])
      .select("id, version_text, status")
      .single();
    if (rErr) throw rErr;

    // 3) Seed default sections
    await seedDefaultSections(r.id);

    // 4) Show result
    elResultCreate.style.display = "block";
    elResultCreate.innerHTML = `
      <div><strong>SOP Code:</strong> ${m.sop_code}</div>
      <div><strong>Title:</strong> ${title}</div>
      <div><strong>Revision:</strong> v${r.version_text} (${r.status})</div>
      <div class="row"><a href="?rev=${r.id}">Continue editing this draft</a></div>
    `;
    say(
      elMsgCreate,
      "ok",
      "Created. Click the link below to continue editing."
    );
  } catch (e) {
    console.error(e);
    say(elMsgCreate, "err", e?.message || "Creation failed.");
  } finally {
    busy(elBtnCreate, "Creating…", "Create SOP", false);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Edit flow
// ────────────────────────────────────────────────────────────────────────────
async function loadRevision() {
  // Join master for metadata
  const { data: rev, error } = await supabase
    .from("sop_revisions")
    .select(
      `
      id, sop_id, status, change_summary, effective_date, next_review_date,
      version_text, created_at, updated_at,
      sop_master!inner(
        id, sop_code, title, created_at, updated_at,
        activity_kind_id, review_policy_code, product_group_kind_id,
        created_by, updated_by
      )
    `
    )
    .eq("id", revisionId)
    .maybeSingle();
  if (error) throw error;
  if (!rev) throw new Error("Revision not found.");

  sopId = rev.sop_id;
  sopCode = rev.sop_master.sop_code;
  currentStatus = rev.status;
  currentVersion = rev.version_text;

  // Header + meta
  hdrSopCode.textContent = sopCode || "";
  hdrTitle.value = rev.sop_master.title || "";
  applyStatusClass(hdrStatus, currentStatus);
  await fillActivityBadge(rev.sop_master.activity_kind_id);

  elMetaVersion.textContent = `v${rev.version_text}`;
  elMetaCreatedAt.textContent = fmtDate(rev.sop_master.created_at);
  elMetaUpdatedAt.textContent = fmtDate(rev.sop_master.updated_at);
  elMetaEffectiveFrom.textContent = fmtDate(rev.effective_date);
  elMetaNextRevision.textContent = fmtDate(rev.next_review_date);
  const names = await namesForProfileIds([
    rev.sop_master.created_by,
    rev.sop_master.updated_by,
  ]);

  if (elMetaCreatedBy)
    elMetaCreatedBy.textContent = names[rev.sop_master.created_by] || "—";
  if (elMetaUpdatedBy)
    elMetaUpdatedBy.textContent = names[rev.sop_master.updated_by] || "—";

  if (elMetaPolicyName) {
    const { data: pol } = await supabase
      .from("sop_review_policies")
      .select("name")
      .eq("code", rev.sop_master.review_policy_code)
      .maybeSingle();
    elMetaPolicyName.textContent = pol?.name || "—";
  }

  persistedPolicyCode = rev.sop_master.review_policy_code || "";
  persistedPlannedEff = dateOnly(rev.effective_date) || todayISO();
  persistedPgkId = rev.sop_master.product_group_kind_id || "";

  // Planner
  await loadPolicies(policyEdit, rev.sop_master.review_policy_code || "");
  plannedEffEdit.value = dateOnly(rev.effective_date) || todayISO();
  await loadGroupKinds(elPgkEdit);
  if (rev.sop_master.product_group_kind_id) {
    elPgkEdit.value = rev.sop_master.product_group_kind_id;
  } else elPgkEdit.value = "";

  updatePlannerPreviewEdit();

  // Actions visibility
  startDraftRow.style.display = currentStatus === "draft" ? "none" : "block";
  plannerCard?.classList.toggle("hidden", currentStatus !== "draft");
  btnPublish.disabled = currentStatus !== "approved";
  btnObsolete.disabled = currentStatus === "obsolete";

  const readOnly = currentStatus !== "draft";
  document
    .getElementById("addSectionCard")
    ?.classList.toggle("hidden", readOnly);
  document
    .getElementById("attachmentsAddCard")
    ?.classList.toggle("hidden", readOnly);
  plannerCard?.classList.toggle("hidden", readOnly);
  sectionsHelp?.classList.toggle("hidden", readOnly);

  enforceDraftLocks();
  syncSectionsToolbar();
  updateActionButtons();
  await loadApprovals();

  await Promise.all([loadSections(), loadAttachments()]);
}

function applyStatusClass(el, status) {
  const s = (status || "").toLowerCase();
  el.className = "sop-status";
  if (
    [
      "draft",
      "approved",
      "under_review",
      "active",
      "superseded",
      "obsolete",
    ].includes(s)
  ) {
    el.classList.add(s);
  }
  el.textContent = s || "—";
}

async function fillActivityBadge(activity_id) {
  // Clear badge first
  if (hdrActivity) hdrActivity.textContent = "";
  if (!activity_id) return;

  const { data, error } = await supabase
    .from("activity_kinds")
    .select("name, short_code")
    .eq("id", activity_id)
    .maybeSingle();

  if (error || !data) return;

  const name = data.name || "";
  if (!hdrActivity) return;
  hdrActivity.textContent = data.short_code
    ? `${data.short_code} • ${name}`
    : name;
}

// Planner
function updatePlannerPreviewEdit() {
  const opt = policyEdit.options[policyEdit.selectedIndex];
  const months = opt?.dataset?.months ? Number(opt.dataset.months) : null;
  const planned = plannedEffEdit.value || todayISO();
  if (!policyEdit.value) {
    nextReviewEdit.textContent = "—";
    return;
  }
  if (!months) {
    nextReviewEdit.textContent = "Event-driven";
    return;
  }
  const nextISO = addMonthsISO(planned, months);
  nextReviewEdit.textContent = nextISO ? fmtDate(nextISO) : "—";
}

async function savePlanner() {
  if (currentStatus !== "draft") {
    await showModal({
      title: "Locked",
      body: "Planner can be edited only on a Draft revision.",
    });
    // restore UI selections
    policyEdit.value = persistedPolicyCode;
    plannedEffEdit.value = persistedPlannedEff;
    elPgkEdit.value = persistedPgkId;
    updatePlannerPreviewEdit();
    return;
  }

  const review_policy_code = policyEdit.value || null;
  const planned_effective_from = plannedEffEdit.value || null;

  // Product group (cast to integer or null)
  const rawPgk = elPgkEdit.value || "";
  const product_group_kind_id =
    rawPgk === "" ? null : Number.parseInt(rawPgk, 10);
  if (rawPgk !== "" && Number.isNaN(product_group_kind_id)) {
    await showModal({ title: "Bad value", body: "Invalid Product Group id." });
    elPgkEdit.value = persistedPgkId;
    return;
  }

  // Save master + revision together and return the new sop_code
  const up1 = supabase
    .from("sop_master")
    .update({ review_policy_code, product_group_kind_id })
    .eq("id", sopId)
    .select("sop_code, product_group_kind_id")
    .single();

  const up2 = supabase
    .from("sop_revisions")
    .update({ effective_date: planned_effective_from })
    .eq("id", revisionId);

  const [{ data: mData, error: mErr }, { error: rErr }] = await Promise.all([
    up1,
    up2,
  ]);

  if (mErr || rErr) {
    console.error(mErr || rErr);
    await showModal({
      title: "Failed",
      body: (mErr || rErr)?.message || "Failed to save planner.",
    });
    return;
  }

  // Persisted values for lock-restore guards
  persistedPolicyCode = review_policy_code || "";
  persistedPlannedEff = planned_effective_from || "";
  persistedPgkId = mData?.product_group_kind_id ?? "";

  // If trigger rebuilt code, show it instantly
  if (mData?.sop_code) hdrSopCode.textContent = mData.sop_code;

  // Refresh meta panel without a full reload
  await loadPolicies(policyEdit, persistedPolicyCode);
  updatePlannerPreviewEdit();
  elMetaEffectiveFrom.textContent = fmtDate(planned_effective_from);
  elMetaNextRevision.textContent = nextReviewEdit.textContent; // from preview line

  toast("Planner saved", "ok");
}

function updateActionButtons() {
  // Hide both by default
  if (btnSubmitReview) btnSubmitReview.style.display = "none";
  if (btnPublish) btnPublish.style.display = "none";

  if (currentStatus === "draft") {
    if (btnSubmitReview) btnSubmitReview.style.display = "inline-flex";
    if (btnObsolete) btnObsolete.disabled = true; // no obsolete on draft
  } else if (currentStatus === "under_review") {
    if (btnObsolete) btnObsolete.disabled = true;
  } else if (currentStatus === "approved") {
    if (btnPublish) btnPublish.style.display = "inline-flex";
    if (btnObsolete) btnObsolete.disabled = true;
  } else if (currentStatus === "active") {
    if (btnObsolete) btnObsolete.disabled = false;
  } else {
    if (btnObsolete) btnObsolete.disabled = true;
  }
}

async function submitForReview() {
  if (!revisionId) return;
  const go = await showModal({
    title: "Submit for Review?",
    body: "This will lock editing until approvals are complete.",
    okText: "Submit",
    danger: false,
  });
  if (!go) return;
  busy(btnSubmitReview, "Submitting…", "Submit for Review", true);

  try {
    const { error } = await supabase.rpc("sop_submit_for_review", {
      p_revision_id: revisionId,
    });
    if (error) throw error;
    await toast("Submitted for review", "ok", "Submitted");
    window.location.reload();
  } catch (e) {
    console.error(e);
    await showModal({
      title: "Failed",
      body: e?.message || "Failed to submit.",
    });
  } finally {
    busy(btnSubmitReview, "Submitting…", "Submit for Review", false);
  }
}

async function publishApproved() {
  if (currentStatus !== "approved") {
    return showModal({
      title: "Not allowed",
      body: "Only approved revisions can be published.",
    });
  }

  const go = await showModal({
    title: "Publish as Active?",
    body: "The previous active (if any) will be marked Superseded.",
    okText: "Publish",
    danger: false,
  });
  if (!go) return;

  busy(btnPublish, "Publishing…", "Publish as Active", true);
  try {
    const { error } = await supabase.rpc("sop_publish_approved", {
      p_revision_id: revisionId,
      p_effective_date: new Date().toISOString(),
    });
    if (error) throw error;
    await toast("Published as Active", "ok", "Published");
    window.location.reload();
  } catch (e) {
    console.error(e);
    await showModal({
      title: "Failed",
      body: e?.message || "Failed to publish.",
    });
  } finally {
    busy(btnPublish, "Publishing…", "Publish as Active", false);
  }
}

function statusPill(st) {
  const s = document.createElement("span");
  s.className = "sop-status";
  s.textContent = (st || "").toUpperCase();
  if (st === "approved") {
    s.style.background = "#ecfdf5";
    s.style.color = "#065f46";
  } else if (st === "pending") {
    s.style.background = "#f3f4f6";
    s.style.color = "#374151";
  } else if (st === "rejected") {
    s.style.background = "#fef2f2";
    s.style.color = "#7f1d1d";
  }
  return s;
}

async function loadApprovals() {
  if (!approvalsCard || !approvalsList) return;
  approvalsList.innerHTML = "";

  // Only show the card for under_review or approved (to show who approved)
  if (!["under_review", "approved"].includes(currentStatus)) {
    approvalsCard.style.display = "none";
    return;
  }

  approvalsCard.style.display = "block";

  // Pull approvals with role metadata
  const { data, error } = await supabase
    .from("sop_approvals")
    .select(
      `
      role_id,
      status,
      comments,
      approved_at,
      approver_id,
      role:sop_approval_roles ( id, name, required )
    `
    )
    .eq("revision_id", revisionId)
    .order("status", { ascending: true });
  if (error) {
    console.error(error);
    approvalsList.textContent = "Failed to load approvals.";
    return;
  }

  // Render each row
  data.forEach((row) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "8px";

    const title = document.createElement("div");
    title.style.flex = "1";
    title.innerHTML =
      `<strong>${row.role?.name || "Role"}</strong> ` +
      (row.role?.required
        ? `<span class="tag">required</span>`
        : `<span class="tag">optional</span>`);
    div.appendChild(title);

    div.appendChild(statusPill(row.status));

    if (row.approved_at) {
      const when = document.createElement("div");
      when.className = "muted mono";
      when.textContent = `@ ${new Date(row.approved_at).toLocaleString()}`;
      div.appendChild(when);
    }

    // Show Approve/Reject only if:
    // - revision is under_review
    // - role is required (optional: allow optional too)
    // - status is pending
    // - current user is allowed (admin for now)
    if (
      currentStatus === "under_review" &&
      row.status === "pending" &&
      isAdmin
    ) {
      const btnOk = document.createElement("button");
      btnOk.className = "btn btn-small btn-save";
      btnOk.textContent = "Approve";
      btnOk.onclick = async () => {
        try {
          const { error } = await supabase.rpc("sop_approval_decide", {
            p_revision_id: revisionId,
            p_role_id: row.role_id,
            p_decision: "approved",
            p_comments: null,
          });
          if (error) throw error;
          await toast("Approved", "ok", "Approval recorded");
          await loadApprovals();

          // after each approval, status might move to 'approved'
          const { data: revRow } = await supabase
            .from("sop_revisions")
            .select("status")
            .eq("id", revisionId)
            .maybeSingle();
          if (revRow?.status && revRow.status !== currentStatus) {
            currentStatus = revRow.status;
            applyStatusClass(hdrStatus, currentStatus);
            updateActionButtons();
          }
        } catch (e) {
          console.error(e);
          alert(e?.message || "Failed to approve.");
        }
      };

      const btnNo = document.createElement("button");
      btnNo.className = "btn btn-small btn-danger";
      btnNo.textContent = "Reject";
      btnNo.onclick = async () => {
        const { ok, value } = await promptModal({
          title: "Reject Revision",
          label: "Rejection comment (optional):",
          okText: "Reject",
        });
        if (!ok) return;

        try {
          const { error } = await supabase.rpc("sop_approval_decide", {
            p_revision_id: revisionId,
            p_role_id: row.role_id,
            p_decision: "rejected",
            p_comments: value || null,
          });
          if (error) throw error;
          await toast("Rejected", "ok", "Rejection recorded");
          window.location.reload();
        } catch (e) {
          console.error(e);
          await showModal({
            title: "Failed",
            body: e?.message || "Failed to reject.",
          });
        }
      };

      div.appendChild(btnOk);
      div.appendChild(btnNo);
    }

    approvalsList.appendChild(div);
  });
}

async function markObsolete() {
  const go = await showModal({
    title: "Mark Obsolete?",
    body: "This cannot be reversed.",
    okText: "Mark Obsolete",
    danger: true,
  });
  if (!go) return;
  busy(btnObsolete, "Updating…", "Mark Obsolete", true);
  try {
    const { error } = await supabase
      .from("sop_revisions")
      .update({ status: "obsolete" })
      .eq("id", revisionId);
    if (error) throw error;
    currentStatus = "obsolete";
    applyStatusClass(hdrStatus, currentStatus);
    btnPublish.disabled = true;
    btnObsolete.disabled = true;
    await toast("Marked Obsolete", "ok", "Obsolete");
  } catch (e) {
    console.error(e);
    await showModal({
      title: "Failed",
      body: e?.message || "Failed to mark obsolete.",
    });
  } finally {
    busy(btnObsolete, "Updating…", "Mark Obsolete", false);
  }
}

async function getActiveRevisionId(sop_id) {
  const { data, error } = await supabase
    .from("sop_revisions")
    .select("id")
    .eq("sop_id", sop_id)
    .eq("status", "active")
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function startNewDraft(changeType /* 'minor' | 'major' */) {
  // Guard one draft at a time
  const { data: existingDraft } = await supabase
    .from("sop_revisions")
    .select("id")
    .eq("sop_id", sopId)
    .eq("status", "draft")
    .maybeSingle();
  if (existingDraft?.id) {
    msgStart.className = "status err";
    msgStart.textContent =
      "A draft already exists. Open it to continue editing.";
    return;
  }

  try {
    const { data: newRev, error } = await supabase
      .from("sop_revisions")
      .insert([
        {
          sop_id: sopId,
          change_type: changeType, // trigger will compute version numbers
          change_summary: `${changeType} draft`,
          status: "draft",
        },
      ])
      .select("id")
      .single();
    if (error) throw error;

    let cloned = false;
    if (cloneFromActive?.checked) {
      const activeId = await getActiveRevisionId(sopId);
      if (activeId) {
        await cloneSections(activeId, newRev.id);
        cloned = true;
      }
    }
    if (!cloned) await seedDefaultSections(newRev.id);

    // navigate to new draft
    window.location.search = `?rev=${newRev.id}`;
  } catch (e) {
    console.error(e);
    msgStart.className = "status err";
    msgStart.textContent = e?.message || "Failed to start a new draft.";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Sections
// ────────────────────────────────────────────────────────────────────────────
async function hasSections(revId) {
  const { count, error } = await supabase
    .from("sop_sections")
    .select("id", { count: "exact", head: true })
    .eq("revision_id", revId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function seedDefaultSections(revId) {
  if (!revId) return;
  if (await hasSections(revId)) return;

  const template = [
    { position: 1, section_number: "1.0", title: "Purpose", content: "" },
    { position: 2, section_number: "2.0", title: "Scope", content: "" },
    {
      position: 3,
      section_number: "3.0",
      title: "Responsibilities",
      content: "",
    },
    { position: 4, section_number: "4.0", title: "Procedure", content: "" },
    { position: 5, section_number: "5.0", title: "Records", content: "" },
    { position: 6, section_number: "6.0", title: "References", content: "" },
  ].map((s) => ({ ...s, revision_id: revId }));

  const { error } = await supabase.from("sop_sections").insert(template);
  if (error) throw error;
}

async function loadSections() {
  sectionsList.innerHTML = "";
  const { data, error } = await supabase
    .from("sop_sections")
    .select("id, position, section_number, title, content")
    .eq("revision_id", revisionId)
    .order("position");
  if (error) {
    console.error(error);
    return;
  }

  if (!data?.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No sections yet.";
    sectionsList.appendChild(empty);
    return;
  }

  const readOnly = currentStatus !== "draft";
  data.forEach((row) => {
    if (readOnly) renderSectionPreviewRow(row);
    else renderSectionRow(row);
  });
}

function renderSectionPreviewRow(row) {
  const wrap = document.createElement("div");
  wrap.className = "card";
  const h = document.createElement("h3");
  h.textContent = row.title || "Untitled";
  h.style.marginTop = "0";
  const body = document.createElement("div");
  // NOTE: content is authored internally; if unsure, sanitize first.
  body.innerHTML = row.content || "";
  wrap.appendChild(h);
  wrap.appendChild(body);
  sectionsList.appendChild(wrap);
}

function renderSectionRow(row) {
  // Non-draft revisions keep the read-only preview
  if (currentStatus !== "draft") {
    return renderSectionPreviewRow(row);
  }

  // ── Header / controls row (full width) ───────────────────────────────
  const wrap = document.createElement("div");
  wrap.className = "section-row card";
  wrap.dataset.id = row.id;

  const pos = document.createElement("div");
  pos.className = "section-pos";
  pos.textContent = row.position;

  const title = document.createElement("input");
  title.className = "section-input";
  title.value = row.title || "";

  const btnUp = mkBtn("↑", "btn btn-small btn-move");
  const btnDown = mkBtn("↓", "btn btn-small btn-move");
  const btnEdit = mkBtn("Edit body", "btn btn-small btn-edit");
  const btnSave = mkBtn("Save", "btn btn-small btn-save");
  const btnDel = mkBtn("Delete", "btn btn-small btn-danger");

  btnUp.onclick = () => nudge(row.id, -1);
  btnDown.onclick = () => nudge(row.id, +1);

  wrap.append(pos, title, btnUp, btnDown, btnEdit, btnSave, btnDel);
  sectionsList.appendChild(wrap);

  // ── Full-width editor row that sits UNDER the header; hidden by default ──
  const editorRow = document.createElement("div");
  editorRow.className = "card section-editor-row";
  editorRow.style.display = "none"; // IMPORTANT: start hidden
  editorRow.style.padding = "12px";
  editorRow.style.marginTop = "8px";
  editorRow.style.gridColumn = "1 / -1"; // in case a grid parent appears
  editorRow.style.width = "100%";
  editorRow.style.flexBasis = "100%";
  editorRow.style.alignSelf = "stretch";

  const ta = document.createElement("textarea");
  ta.className = "section-textarea";
  ta.value = row.content || "";
  ta.placeholder = getGuidanceFor(row.title);
  ta.style.width = "100%";
  ta.style.minHeight = "360px";
  ta.style.boxSizing = "border-box";
  wirePlaceholderOnFocus(ta);
  editorRow.appendChild(ta);

  if (!(row.content || "").trim()) {
    const sampleBtn = document.createElement("button");
    sampleBtn.className = "btn btn-small";
    sampleBtn.textContent = "Insert sample";
    sampleBtn.style.marginTop = "8px";
    sampleBtn.onclick = () => {
      ta.value = getSampleFor(row.title);
      ta.focus();
    };
    editorRow.appendChild(sampleBtn);
  }

  // Place editor row directly after the header row
  sectionsList.insertBefore(editorRow, wrap.nextSibling);

  // ── Wire buttons to toggle/save/delete ────────────────────────────────
  btnEdit.onclick = () => {
    const show = editorRow.style.display === "none";
    editorRow.style.display = show ? "block" : "none";
    if (show) {
      ta.focus();
      editorRow.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  btnSave.onclick = async () => {
    const { error } = await supabase
      .from("sop_sections")
      .update({ title: title.value.trim(), content: ta.value })
      .eq("id", row.id);
    if (error) return say(msgSections, "err", error.message);

    await toast("Section saved", "ok");
    editorRow.style.display = "none"; // close after save
    await loadSections(); // refresh list
  };

  btnDel.onclick = async () => {
    const go = await confirmModal({
      title: "Delete Section?",
      body: "This action cannot be undone.",
      okText: "Delete",
      danger: true,
    });
    if (!go) return;
    const { error } = await supabase
      .from("sop_sections")
      .delete()
      .eq("id", row.id);
    if (error) return say(msgSections, "err", error.message);
    await toast("Section deleted", "ok", "Deleted");
    await loadSections();
  };
}
const mkBtn = (txt, cls) => {
  const b = document.createElement("button");
  b.textContent = txt;
  b.className = cls;
  return b;
};

async function nudge(id, delta) {
  // fetch this row
  const { data: meArr, error: meErr } = await supabase
    .from("sop_sections")
    .select("id, revision_id, position")
    .eq("id", id)
    .limit(1);
  if (meErr || !meArr?.length) return;
  const me = meArr[0];
  const newPos = me.position + delta;
  if (newPos < 1) return;

  // neighbor at target position
  const { data: neighborArr } = await supabase
    .from("sop_sections")
    .select("id, position")
    .eq("revision_id", me.revision_id)
    .eq("position", newPos)
    .limit(1);

  // If no neighbor, don't move past ends
  if (!neighborArr || !neighborArr.length) return;
  const neighbor = neighborArr[0];

  // Use a guaranteed-free temp slot 0 (positions start at 1)
  const tmp = 0;

  // 1) move neighbor to temp
  const step1 = await supabase
    .from("sop_sections")
    .update({ position: tmp })
    .eq("id", neighbor.id)
    .eq("revision_id", me.revision_id);
  if (step1.error) {
    return say(msgSections, "err", step1.error.message);
  }

  // 2) move me into neighbor's slot
  const step2 = await supabase
    .from("sop_sections")
    .update({ position: newPos })
    .eq("id", me.id);
  if (step2.error) {
    // try to revert neighbor back if we failed
    await supabase
      .from("sop_sections")
      .update({ position: neighbor.position })
      .eq("id", neighbor.id);
    return say(msgSections, "err", step2.error.message);
  }

  // 3) move neighbor into my old slot
  const step3 = await supabase
    .from("sop_sections")
    .update({ position: me.position })
    .eq("id", neighbor.id);
  if (step3.error) {
    return say(msgSections, "err", step3.error.message);
  }

  // (optional) normalize positions server-side if you have a helper
  try {
    await supabase.rpc("sop_sections_resequence", {
      p_revision_id: revisionId,
    });
  } catch (e) {
    void e;
  }

  await toast("Reordered", "ok", "Reordered");
  await loadSections();
}

async function cloneSections(fromRevisionId, toRevisionId) {
  if (!fromRevisionId) return;
  const { data: rows, error } = await supabase
    .from("sop_sections")
    .select("position, section_number, title, content")
    .eq("revision_id", fromRevisionId)
    .order("position");
  if (error) throw error;
  if (!rows?.length) return;

  const payload = rows.map((r) => ({
    revision_id: toRevisionId,
    position: r.position,
    section_number: r.section_number,
    title: r.title,
    content: r.content,
  }));
  const { error: insErr } = await supabase.from("sop_sections").insert(payload);
  if (insErr) throw insErr;
}

// Add new section
async function addSection() {
  if (currentStatus !== "draft") {
    await showModal({
      title: "Locked",
      body: "Sections can be edited only on a Draft revision.",
    });
    return;
  }
  const title = (secTitle.value || "").trim();
  const body = secBody.value || "";
  if (!title) return say(msgSections, "err", "Section title is required.");

  // Position = 1 + max(position)
  const { data: maxRow } = await supabase
    .from("sop_sections")
    .select("position")
    .eq("revision_id", revisionId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (maxRow?.[0]?.position || 0) + 1;
  const section_number = `${nextPos}.0`;

  const { error } = await supabase.from("sop_sections").insert([
    {
      revision_id: revisionId,
      position: nextPos,
      section_number,
      title,
      content: body,
    },
  ]);
  if (error) return say(msgSections, "err", error.message);

  secTitle.value = "";
  secBody.value = "";
  say(msgSections, "ok", "Added.");
  await loadSections();
}

// ────────────────────────────────────────────────────────────────────────────
/** FORM CLEAR */
// ────────────────────────────────────────────────────────────────────────────

function clearCreateForm() {
  // reset selects to first option (placeholder)
  if (elSeries) elSeries.selectedIndex = 0;
  if (elActivity) elActivity.selectedIndex = 0;
  if (elGroupKind) elGroupKind.selectedIndex = 0;
  if (elPolicy) elPolicy.selectedIndex = 0;

  // clear text inputs
  if (elTitle) elTitle.value = "";
  if (elSummary) elSummary.value = "";

  // clear planned date (or set to today if you prefer)
  if (elPlannedEff) elPlannedEff.value = "";

  // clear messages & preview
  if (elMsgCreate) {
    elMsgCreate.textContent = "";
    elMsgCreate.className = "status";
  }
  if (metaNextRevisionCreate) metaNextRevisionCreate.textContent = "—";

  // hide result block if shown
  if (elResultCreate) {
    elResultCreate.style.display = "none";
    elResultCreate.innerHTML = "";
  }
}

btnClear?.addEventListener("click", (e) => {
  e.preventDefault();
  clearCreateForm();
});

// ────────────────────────────────────────────────────────────────────────────
/** Attachments — DB stores storage_path/file_name; we show link via public URL. */
// ────────────────────────────────────────────────────────────────────────────
async function loadAttachments() {
  attList.innerHTML = "";
  const { data, error } = await supabase
    .from("sop_attachments")
    .select("id, file_name, storage_path, file_type, file_size, uploaded_at")
    .eq("revision_id", revisionId)
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error(error);
    return;
  }

  if (!data?.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No attachments yet.";
    attList.appendChild(empty);
    return;
  }

  const readOnly = currentStatus !== "draft";

  data.forEach((a) => {
    const row = document.createElement("div");
    row.className = "card attachment-row";

    const link = a.storage_path
      ? /^https?:\/\//i.test(a.storage_path)
        ? a.storage_path
        : supabase.storage.from("sop-attachments").getPublicUrl(a.storage_path)
            .data.publicUrl
      : "#";

    // left cell (file details)
    const left = document.createElement("div");
    left.innerHTML = `
      <strong>${a.file_name}</strong>
      <div class="muted">${a.file_type || ""} ${
      a.file_size ? `• ${(a.file_size / 1024).toFixed(1)} KB` : ""
    }</div>
    `;

    // open link
    const aOpen = document.createElement("a");
    aOpen.href = link;
    aOpen.target = "_blank";
    aOpen.textContent = "Open";

    row.appendChild(left);
    row.appendChild(aOpen);

    // delete button only in draft
    if (!readOnly) {
      const btnDel = document.createElement("button");
      btnDel.className = "btn-danger";
      btnDel.textContent = "Delete";
      btnDel.onclick = async () => {
        const go = await confirmModal({
          title: "Delete Attachment?",
          body: "This action cannot be undone.",
          okText: "Delete",
          danger: true,
        });
        if (!go) return;
        const { error } = await supabase
          .from("sop_attachments")
          .delete()
          .eq("id", a.id);
        if (error) {
          say(msgAttach, "err", error.message);
          return;
        }
        await toast("Attachment deleted", "ok", "Deleted");
        await loadAttachments();
      };
      row.appendChild(btnDel);
    }

    attList.appendChild(row);
  });
}

async function addAttachment() {
  if (currentStatus !== "draft") {
    await showModal({
      title: "Locked",
      body: "Attachments can be changed only on a Draft revision.",
    });
    return;
  }
  try {
    let file_name,
      storage_path = null,
      file_type = null,
      file_size = null;

    if (attFile.files && attFile.files[0]) {
      const f = attFile.files[0];
      file_name = f.name;
      file_type = f.type || null;
      file_size = f.size || null;

      // Upload to Storage bucket "sop-attachments"
      const path = `${sopCode}/v${currentVersion || "draft"}/${file_name}`;
      const { error: upErr } = await supabase.storage
        .from("sop-attachments")
        .upload(path, f, { upsert: true });
      if (upErr) throw upErr;
      storage_path = path;
    } else {
      const url = (attUrl.value || "").trim();
      if (!url) return say(msgAttach, "err", "Choose a file or enter a URL.");

      // For raw URLs we can store the URL in storage_path to keep single column
      storage_path = url; // You can alternatively add a separate url column if preferred
      file_name = url.split("/").pop() || "attachment";
    }

    const { error } = await supabase.from("sop_attachments").insert([
      {
        revision_id: revisionId,
        file_name,
        storage_path,
        file_type,
        file_size,
      },
    ]);
    if (error) throw error;

    attFile.value = "";
    attUrl.value = "";
    await toast("Attachment added", "ok", "Saved");
    await loadAttachments();
  } catch (e) {
    console.error(e);
    say(msgAttach, "err", e?.message || "Failed to add attachment.");
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Wiring & init
// ────────────────────────────────────────────────────────────────────────────
hdrTitle?.addEventListener(
  "input",
  debounce(async () => {
    if (currentStatus !== "draft") return;
    const newTitle = hdrTitle.value?.trim();
    if (!newTitle || !sopId) return;
    const { error } = await supabase
      .from("sop_master")
      .update({ title: newTitle })
      .eq("id", sopId);
    if (error) console.error(error);
  }, 700)
);
btnAddSection?.addEventListener("click", addSection);
btnAddAttachment?.addEventListener("click", addAttachment);
btnObsolete?.addEventListener("click", markObsolete);
btnSubmitReview?.addEventListener("click", submitForReview);
btnPublish?.addEventListener("click", publishApproved);
elBtnCreate?.addEventListener("click", createSop);

btnStartMinor?.addEventListener("click", () => startNewDraft("minor"));
btnStartMajor?.addEventListener("click", () => startNewDraft("major"));

elPolicy?.addEventListener("change", updateCreateMetaPreview);
elPlannedEff?.addEventListener("change", updateCreateMetaPreview);

policyEdit?.addEventListener("change", updatePlannerPreviewEdit);
plannedEffEdit?.addEventListener("change", updatePlannerPreviewEdit);
btnPlannerSave?.addEventListener("click", savePlanner);

homeBtn?.addEventListener("click", () => (window.location.href = "index.html"));

policyEdit?.addEventListener("change", async () => {
  if (currentStatus !== "draft") {
    policyEdit.value = persistedPolicyCode;
    await showModal({
      title: "Locked",
      body: "Planner can be edited only on a Draft revision.",
    });
    return;
  }
  updatePlannerPreviewEdit();
});

plannedEffEdit?.addEventListener("change", async () => {
  if (currentStatus !== "draft") {
    plannedEffEdit.value = persistedPlannedEff;
    await showModal({
      title: "Locked",
      body: "Planner can be edited only on a Draft revision.",
    });
    return;
  }
  updatePlannerPreviewEdit();
});

elPgkEdit?.addEventListener("change", async () => {
  if (currentStatus !== "draft") {
    elPgkEdit.value = persistedPgkId;
    await showModal({
      title: "Locked",
      body: "Product Group can be changed only on a Draft revision.",
    });
    return;
  }
});

btnRestoreDefault?.addEventListener("click", async () => {
  // Only allow on Draft
  if (currentStatus !== "draft") {
    await showModal({
      title: "Locked",
      body: "You can restore the default order only on a Draft revision.",
    });
    return;
  }

  const go = await confirmModal({
    title: "Restore default section order?",
    body:
      "This will reorder titles to the standard template:\n" +
      "Purpose → Scope → Responsibilities → Procedure → Records → References.\n\n" +
      "• Your content is preserved.\n" +
      "• Any non-template sections will be placed after these.\n" +
      "• Section numbers will be renumbered (1.0, 2.0, …).",
    okText: "Restore",
  });
  if (!go) return;

  try {
    await supabase.rpc("sop_sections_reset_to_template", {
      p_revision_id: revisionId,
    });
    await loadSections();
    toast("Sections restored to default order and renumbered.", "ok");
    // Optional: scroll to the list
    document
      .getElementById("sectionsList")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    await showModal({
      title: "Failed",
      body: e?.message || "Could not restore order.",
    });
  }
});

// Boot
(async function init() {
  if (revisionId) {
    document.title = "SOP Workspace | Edit SOP";
    pageTitle.textContent = "Edit SOP";
    createBlock.style.display = "none";
    editBlock.style.display = "block";

    // who am I?
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      currentUser = user || null;

      if (currentUser) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", currentUser.id)
          .maybeSingle();
        isAdmin = (prof?.role || "").toLowerCase() === "admin";
      }
    } catch (e) {
      console.warn("Auth/profile check failed:", e);
    }

    try {
      await loadRevision();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to load revision.");
    }
  } else {
    document.title = "SOP Workspace | New SOP";
    pageTitle.textContent = "New SOP";
    createBlock.style.display = "block";
    editBlock.style.display = "none";

    try {
      elPlannedEff.value = todayISO();
      await Promise.all([
        loadSeries(),
        loadActivities(),
        loadPolicies(),
        loadGroupKinds(),
      ]);
      updateCreateMetaPreview();
    } catch (e) {
      console.error(e);
      say(elMsgCreate, "err", "Failed to load lists. See console.");
    }
  }
})();
