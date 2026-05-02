/**
 * lab-spec-profile-manager.js
 * Tabbed Spec Profile Manager: Base Spec | Overrides | Effective Preview
 * FG: group-level base specs, product-level overrides and effective preview
 * RM: inventory-group base specs, stock-item overrides, effective preview
 * PM: inventory-group base specs, stock-item overrides, effective preview
 */

import { labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const homeBtn = document.getElementById("homeBtn");
const subjectPills = document.getElementById("subjectPills");
const tabStrip = document.getElementById("tabStrip");

// Tab buttons
const baseSpecTab = document.getElementById("baseSpecTab");
const overridesTab = document.getElementById("overridesTab");
const effectivePreviewTab = document.getElementById("effectivePreviewTab");

// Tab panels
const baseSpecPanel = document.getElementById("baseSpecPanel");
const overridesPanel = document.getElementById("overridesPanel");
const effectivePreviewPanel = document.getElementById("effectivePreviewPanel");

// BASE SPEC tab
const bsFgCard = document.getElementById("bsFgCard");
const bsRmCard = document.getElementById("bsRmCard");
const rmControlCard = document.getElementById("rmControlCard");
const rmTableCard = document.getElementById("rmTableCard");
const productGroupSelect = document.getElementById("productGroupSelect");
const bsContextStrip = document.getElementById("bsContextStrip");
const bsProtocolName = document.getElementById("bsProtocolName");
const bsBaseSpecName = document.getElementById("bsBaseSpecName");
const bsBaseSpecVersion = document.getElementById("bsBaseSpecVersion");
const bsControlCard = document.getElementById("bsControlCard");
const bsMetaProfileId = document.getElementById("bsMetaProfileId");
const bsMetaVersion = document.getElementById("bsMetaVersion");
const bsMetaEffDate = document.getElementById("bsMetaEffDate");
const bsGenerateSpecBtn = document.getElementById("bsGenerateSpecBtn");
const bsBanner = document.getElementById("bsBanner");
const bsTableCard = document.getElementById("bsTableCard");
const bsTableBody = document.getElementById("bsTableBody");
const bsLineCount = document.getElementById("bsLineCount");
const bsSaveSpecBtn = document.getElementById("bsSaveSpecBtn");

// OVERRIDES tab
const ovFgCard = document.getElementById("ovFgCard");
const ovRmCard = document.getElementById("ovRmCard");
const ovProductSelect = document.getElementById("ovProductSelect");
const ovFgContextStrip = document.getElementById("ovFgContextStrip");
const ovFgGroupName = document.getElementById("ovFgGroupName");
const ovFgBaseSpecId = document.getElementById("ovFgBaseSpecId");
const ovBanner = document.getElementById("ovBanner");
const ovTableCard = document.getElementById("ovTableCard");
const ovTableBody = document.getElementById("ovTableBody");
const ovLineCount = document.getElementById("ovLineCount");
// RM Overrides
const ovRmItemSelect = document.getElementById("ovRmItemSelect");
const ovRmContextStrip = document.getElementById("ovRmContextStrip");
const ovRmGroupName = document.getElementById("ovRmGroupName");
const ovRmBaseSpecId = document.getElementById("ovRmBaseSpecId");
const ovRmBanner = document.getElementById("ovRmBanner");
const ovRmTableCard = document.getElementById("ovRmTableCard");
const ovRmTableBody = document.getElementById("ovRmTableBody");
const ovRmLineCount = document.getElementById("ovRmLineCount");

// EFFECTIVE PREVIEW tab
const epFgCard = document.getElementById("epFgCard");
const epRmCard = document.getElementById("epRmCard");
const epProductSelect = document.getElementById("epProductSelect");
const epBanner = document.getElementById("epBanner");
const epTableCard = document.getElementById("epTableCard");
const epTableBody = document.getElementById("epTableBody");
const epLineCount = document.getElementById("epLineCount");
// RM Effective Preview
const epRmItemSelect = document.getElementById("epRmItemSelect");
const epRmBanner = document.getElementById("epRmBanner");
const epRmTableCard = document.getElementById("epRmTableCard");
const epRmTableBody = document.getElementById("epRmTableBody");
const epRmLineCount = document.getElementById("epRmLineCount");

// PM Base Spec
const bsPmCard = document.getElementById("bsPmCard");
const pmControlCard = document.getElementById("pmControlCard");
const pmTableCard = document.getElementById("pmTableCard");
// PM Overrides
const ovPmCard = document.getElementById("ovPmCard");
const ovPmItemSelect = document.getElementById("ovPmItemSelect");
const ovPmContextStrip = document.getElementById("ovPmContextStrip");
const ovPmGroupName = document.getElementById("ovPmGroupName");
const ovPmBaseSpecId = document.getElementById("ovPmBaseSpecId");
const ovPmBanner = document.getElementById("ovPmBanner");
const ovPmTableCard = document.getElementById("ovPmTableCard");
const ovPmTableBody = document.getElementById("ovPmTableBody");
const ovPmLineCount = document.getElementById("ovPmLineCount");
// PM Effective Preview
const epPmCard = document.getElementById("epPmCard");
const epPmItemSelect = document.getElementById("epPmItemSelect");
const epPmBanner = document.getElementById("epPmBanner");
const epPmTableCard = document.getElementById("epPmTableCard");
const epPmTableBody = document.getElementById("epPmTableBody");
const epPmLineCount = document.getElementById("epPmLineCount");

// ── Module state ──────────────────────────────────────────────────────────────
let currentSubjectType = null; // "FG" | "RM" | "PM"
let currentTab = "baseSpec"; // "baseSpec" | "overrides" | "effectivePreview"

// FG Base spec state
let bsCurrentProfileId = null;
let bsCurrentGroupId = null;
let bsCurrentGroupName = null;
let bsEditedSpecLines = new Map(); // seqNo -> {display_text, is_active}

// RM Base spec state
let rmCurrentProfileId = null;
let rmCurrentGroupId = null;
let rmCurrentGroupLabel = null;
let rmEditedSpecLines = new Map(); // seqNo -> {display_text, is_active}

// PM Base spec state
let pmCurrentProfileId = null;
let pmCurrentGroupId = null;
let pmCurrentGroupLabel = null;
let pmEditedSpecLines = new Map(); // seqNo -> {display_text, is_active}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init();

async function init() {
  applyInitialHiddenState();
  homeBtn.addEventListener("click", () => Platform.goHome());
  wireSubjectPills();
  wireTabStrip();
  wireBaseSpecEvents();
  wireBaseSpecRmEvents();
  wireOverridesEvents();
  wireOverridesRmEvents();
  wireEffectivePreviewEvents();
  wireEffectivePreviewRmEvents();
  wireBaseSpecPmEvents();
  wireOverridesPmEvents();
  wireEffectivePreviewPmEvents();
  bsSaveSpecBtn.addEventListener("click", bsSaveSpec);
}

// ── Initial hidden state ──────────────────────────────────────────────────────
// Ensures a clean neutral state on load — nothing shown until subject is chosen.
// Add new subject cards here as additional subject types (e.g. PM) are introduced.
function applyInitialHiddenState() {
  // Tab strip + all panels
  tabStrip.classList.add("hidden");
  baseSpecPanel.classList.add("hidden");
  overridesPanel.classList.add("hidden");
  effectivePreviewPanel.classList.add("hidden");

  // Base Spec sub-cards (FG + RM)
  bsFgCard.classList.add("hidden");
  bsRmCard.classList.add("hidden");
  bsControlCard.classList.add("hidden");
  bsTableCard.classList.add("hidden");
  document.getElementById("rmControlCard")?.classList.add("hidden");
  document.getElementById("rmTableCard")?.classList.add("hidden");

  // Overrides sub-cards (FG + RM)
  ovFgCard.classList.add("hidden");
  ovRmCard.classList.add("hidden");
  ovTableCard.classList.add("hidden");
  ovRmTableCard.classList.add("hidden");

  // Effective Preview sub-cards (FG + RM)
  epFgCard.classList.add("hidden");
  epRmCard.classList.add("hidden");
  epTableCard.classList.add("hidden");
  epRmTableCard.classList.add("hidden");

  // Base Spec sub-cards (PM)
  bsPmCard.classList.add("hidden");
  pmControlCard.classList.add("hidden");
  pmTableCard.classList.add("hidden");
  // Overrides sub-cards (PM)
  ovPmCard.classList.add("hidden");
  ovPmTableCard.classList.add("hidden");
  // Effective Preview sub-cards (PM)
  epPmCard.classList.add("hidden");
  epPmTableCard.classList.add("hidden");
}

// ── Subject pills ─────────────────────────────────────────────────────────────
function wireSubjectPills() {
  subjectPills.querySelectorAll(".type-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const type = pill.dataset.type;
      if (type === currentSubjectType) return;
      currentSubjectType = type;
      subjectPills.querySelectorAll(".type-pill").forEach((p) => {
        p.classList.toggle("active", p.dataset.type === type);
        p.setAttribute(
          "aria-pressed",
          p.dataset.type === type ? "true" : "false",
        );
      });
      handleSubjectTypeChange();
    });
  });
}

// ── Subject state reset ──────────────────────────────────────────────────────
// Clears the outgoing subject's state/controls before activating a new subject.
// Add a new branch here when PM (or other) subject types are introduced.
function resetSubjectState(toSubjectType) {
  if (toSubjectType === "FG") {
    rmResetState();
    pmResetState();

    const rmGroupSelect = document.getElementById("rmGroupSelect");
    if (rmGroupSelect) rmGroupSelect.value = "";
    ovRmItemSelect.value = "";
    epRmItemSelect.value = "";
    ovRmContextStrip.classList.add("hidden");
    hideBanner(ovRmBanner);
    ovRmTableCard.classList.add("hidden");
    hideBanner(epRmBanner);
    epRmTableCard.classList.add("hidden");

    const pmGroupSelect = document.getElementById("pmGroupSelect");
    if (pmGroupSelect) pmGroupSelect.value = "";
    ovPmItemSelect.value = "";
    epPmItemSelect.value = "";
    ovPmContextStrip.classList.add("hidden");
    hideBanner(ovPmBanner);
    ovPmTableCard.classList.add("hidden");
    hideBanner(epPmBanner);
    epPmTableCard.classList.add("hidden");
  } else if (toSubjectType === "RM") {
    bsResetState();
    pmResetState();

    productGroupSelect.value = "";
    ovProductSelect.value = "";
    epProductSelect.value = "";
    ovFgContextStrip.classList.add("hidden");
    hideBanner(ovBanner);
    ovTableCard.classList.add("hidden");
    hideBanner(epBanner);
    epTableCard.classList.add("hidden");

    const pmGroupSelect = document.getElementById("pmGroupSelect");
    if (pmGroupSelect) pmGroupSelect.value = "";
    ovPmItemSelect.value = "";
    epPmItemSelect.value = "";
    ovPmContextStrip.classList.add("hidden");
    hideBanner(ovPmBanner);
    ovPmTableCard.classList.add("hidden");
    hideBanner(epPmBanner);
    epPmTableCard.classList.add("hidden");
  } else if (toSubjectType === "PM") {
    bsResetState();
    rmResetState();

    productGroupSelect.value = "";
    ovProductSelect.value = "";
    epProductSelect.value = "";
    ovFgContextStrip.classList.add("hidden");
    hideBanner(ovBanner);
    ovTableCard.classList.add("hidden");
    hideBanner(epBanner);
    epTableCard.classList.add("hidden");

    const rmGroupSelect = document.getElementById("rmGroupSelect");
    if (rmGroupSelect) rmGroupSelect.value = "";
    ovRmItemSelect.value = "";
    epRmItemSelect.value = "";
    ovRmContextStrip.classList.add("hidden");
    hideBanner(ovRmBanner);
    ovRmTableCard.classList.add("hidden");
    hideBanner(epRmBanner);
    epRmTableCard.classList.add("hidden");
  }
}

function handleSubjectTypeChange() {
  resetSubjectState(currentSubjectType);
  tabStrip.classList.remove("hidden");
  switchTab(currentTab, true);
}

// ── Tab strip ─────────────────────────────────────────────────────────────────
function wireTabStrip() {
  [baseSpecTab, overridesTab, effectivePreviewTab].forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId, forceRefresh = false) {
  if (tabId === currentTab && !forceRefresh) return;
  currentTab = tabId;

  // Update tab buttons
  [baseSpecTab, overridesTab, effectivePreviewTab].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Show/hide panels
  baseSpecPanel.classList.toggle("hidden", tabId !== "baseSpec");
  overridesPanel.classList.toggle("hidden", tabId !== "overrides");
  effectivePreviewPanel.classList.toggle(
    "hidden",
    tabId !== "effectivePreview",
  );

  // Enforce subject-specific visibility for ALL sub-cards in ALL tabs.
  //
  // Selector cards (top pickers) are fully deterministic — show/hide based on
  // tab + subject combination.
  //
  // Data cards (control meta, tables) are only HIDDEN when the context is wrong
  // (wrong tab or wrong subject). When the context is correct they are left
  // untouched so the state set by data-loading functions is preserved. This
  // prevents the "card disappears on tab-switch and never comes back" problem.
  const isFG = currentSubjectType === "FG";
  const isRM = currentSubjectType === "RM";
  const isPM = currentSubjectType === "PM";
  const isBS = tabId === "baseSpec";
  const isOV = tabId === "overrides";
  const isEP = tabId === "effectivePreview";

  // ── Selector cards (fully deterministic) ─────────────────────────────────
  bsFgCard.classList.toggle("hidden", !(isBS && isFG));
  bsRmCard.classList.toggle("hidden", !(isBS && isRM));
  bsPmCard.classList.toggle("hidden", !(isBS && isPM));
  ovFgCard.classList.toggle("hidden", !(isOV && isFG));
  ovRmCard.classList.toggle("hidden", !(isOV && isRM));
  ovPmCard.classList.toggle("hidden", !(isOV && isPM));
  epFgCard.classList.toggle("hidden", !(isEP && isFG));
  epRmCard.classList.toggle("hidden", !(isEP && isRM));
  epPmCard.classList.toggle("hidden", !(isEP && isPM));

  // ── Data cards (hide-only when wrong context) ─────────────────────────────
  if (!(isBS && isFG)) {
    bsControlCard.classList.add("hidden");
    bsTableCard.classList.add("hidden");
  }
  if (!(isBS && isRM)) {
    rmControlCard.classList.add("hidden");
    rmTableCard.classList.add("hidden");
  }
  if (!(isBS && isPM)) {
    pmControlCard.classList.add("hidden");
    pmTableCard.classList.add("hidden");
  }
  if (!(isOV && isFG)) {
    ovTableCard.classList.add("hidden");
  }
  if (!(isOV && isRM)) {
    ovRmTableCard.classList.add("hidden");
  }
  if (!(isOV && isPM)) {
    ovPmTableCard.classList.add("hidden");
  }
  if (!(isEP && isFG)) {
    epTableCard.classList.add("hidden");
  }
  if (!(isEP && isRM)) {
    epRmTableCard.classList.add("hidden");
  }
  if (!(isEP && isPM)) {
    epPmTableCard.classList.add("hidden");
  }

  // Lazy-load pickers for active tab (FG only)
  if (isFG) {
    if (tabId === "baseSpec" && productGroupSelect.options.length <= 1) {
      loadProductGroups();
    }
    if (tabId === "overrides" && ovProductSelect.options.length <= 1) {
      loadFgProducts(ovProductSelect);
    }
    if (tabId === "effectivePreview" && epProductSelect.options.length <= 1) {
      loadFgProducts(epProductSelect);
    }
  }

  // Lazy-load pickers for active tab (RM only)
  if (isRM) {
    if (tabId === "baseSpec") {
      const rmGroupSelect = document.getElementById("rmGroupSelect");
      if (rmGroupSelect && rmGroupSelect.options.length <= 1) loadRmGroups();
    }
    if (tabId === "overrides" && ovRmItemSelect.options.length <= 1) {
      loadRmItems(ovRmItemSelect);
    }
    if (tabId === "effectivePreview" && epRmItemSelect.options.length <= 1) {
      loadRmItems(epRmItemSelect);
    }
  }

  // Lazy-load pickers for active tab (PM only)
  if (isPM) {
    if (tabId === "baseSpec") {
      const pmGroupSelect = document.getElementById("pmGroupSelect");
      if (pmGroupSelect && pmGroupSelect.options.length <= 1) loadPmGroups();
    }
    if (tabId === "overrides" && ovPmItemSelect.options.length <= 1) {
      loadPmItems(ovPmItemSelect);
    }
    if (tabId === "effectivePreview" && epPmItemSelect.options.length <= 1) {
      loadPmItems(epPmItemSelect);
    }
  }
}

// ── BASE SPEC — FG ────────────────────────────────────────────────────────────

// FIX 1: use group_name, not name
async function loadProductGroups() {
  productGroupSelect.disabled = true;
  productGroupSelect.innerHTML = '<option value="">Loading...</option>';
  const { data, error } = await labSupabase
    .schema("public")
    .from("product_groups")
    .select("id, group_name")
    .order("group_name");
  if (error) {
    toast("Failed to load product groups: " + error.message, "error");
    productGroupSelect.innerHTML = '<option value="">-- Error --</option>';
    productGroupSelect.disabled = false;
    return;
  }
  // Dedupe by normalised group_name; keep lowest numeric id per name, track all source ids
  const seen = new Map();
  for (const row of data ?? []) {
    const key = String(row.group_name ?? "")
      .trim()
      .toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        id: row.id,
        group_name: row.group_name,
        source_ids: [row.id],
      });
    } else {
      const existing = seen.get(key);
      existing.source_ids.push(row.id);
      if (row.id < existing.id) {
        existing.id = row.id;
      }
    }
  }
  const deduped = [...seen.values()].sort((a, b) =>
    (a.group_name ?? "").localeCompare(b.group_name ?? ""),
  );
  populateSelect(
    productGroupSelect,
    deduped,
    "id",
    "group_name",
    "-- Select Product Group --",
  );
  productGroupSelect.disabled = false;
}

function wireBaseSpecEvents() {
  productGroupSelect.addEventListener("change", onProductGroupChange);
  bsGenerateSpecBtn.addEventListener("click", bsGenerateSpec);
}

async function onProductGroupChange() {
  const groupId = productGroupSelect.value;
  if (!groupId) {
    bsResetState();
    return;
  }
  bsCurrentGroupId = groupId;
  bsCurrentGroupName =
    productGroupSelect.options[productGroupSelect.selectedIndex].text;

  // Show control card, reset state
  bsControlCard.classList.remove("hidden");
  bsTableCard.classList.add("hidden");
  bsBanner.classList.add("hidden");
  bsGenerateSpecBtn.classList.add("hidden");
  bsContextStrip.classList.add("hidden");
  bsEditedSpecLines.clear();
  bsSyncSaveBtn();

  setMetaValue(bsMetaProfileId, "--", true);
  setMetaValue(bsMetaVersion, "--", true);
  setMetaValue(bsMetaEffDate, "--", true);

  await bsLoadGroupContext(groupId);
}

async function bsLoadGroupContext(groupId) {
  showBanner(bsBanner, "info", "Loading group protocol and spec info...");

  // FIX 3 — Step A: fetch protocol_category_id from map
  const { data: mapRows, error: mapErr } = await labSupabase
    .from("protocol_category_product_group_map")
    .select("protocol_category_id")
    .eq("product_group_id", groupId)
    .eq("is_active", true)
    .limit(1);

  if (mapErr) {
    showBanner(
      bsBanner,
      "error",
      "Could not load protocol mapping: " + mapErr.message,
    );
    return;
  }

  const protocolCategoryId = mapRows?.[0]?.protocol_category_id ?? null;

  // FIX 3 — Step B: fetch category_name from protocol_category
  let protocolName = null;
  if (protocolCategoryId) {
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name, source_document")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (!catErr && catRows?.length) {
      protocolName = catRows[0].category_name ?? null;
    }
  }

  // FIX 4 — Step A: fetch spec_profile_id from map
  const { data: specMapRows, error: specMapErr } = await labSupabase
    .from("spec_profile_product_group_map")
    .select("spec_profile_id")
    .eq("product_group_id", groupId)
    .eq("is_active", true)
    .limit(1);

  if (specMapErr) {
    showBanner(
      bsBanner,
      "error",
      "Could not load base spec mapping: " + specMapErr.message,
    );
    return;
  }

  const specProfileId = specMapRows?.[0]?.spec_profile_id ?? null;

  // FIX 4 — Step B: fetch spec_profile details
  let specProfile = null;
  if (specProfileId) {
    const { data: spRows, error: spErr } = await labSupabase
      .from("spec_profile")
      .select("id, spec_name, version_no, effective_from, is_active")
      .eq("id", specProfileId)
      .limit(1);
    if (!spErr && spRows?.length) {
      specProfile = spRows[0];
    }
  }

  // Populate context strip
  bsProtocolName.textContent = protocolName ?? "None";
  bsProtocolName.classList.toggle("not-set", !protocolName);
  bsBaseSpecName.textContent = specProfile
    ? (specProfile.spec_name ?? `Profile #${specProfile.id}`)
    : "Not set";
  bsBaseSpecName.classList.toggle("not-set", !specProfile);
  bsBaseSpecVersion.textContent = specProfile
    ? String(specProfile.version_no)
    : "--";
  bsBaseSpecVersion.classList.toggle("not-set", !specProfile);
  bsContextStrip.classList.remove("hidden");

  if (specProfile) {
    bsCurrentProfileId = specProfile.id;
    setMetaValue(bsMetaProfileId, String(specProfile.id), false);
    setMetaValue(bsMetaVersion, `v${specProfile.version_no}`, false);
    setMetaValue(bsMetaEffDate, formatDate(specProfile.effective_from), false);
    hideBanner(bsBanner);
    await bsLoadSpecLines(specProfile.id);
  } else {
    bsCurrentProfileId = null;
    setMetaValue(bsMetaProfileId, "--", true);
    setMetaValue(bsMetaVersion, "--", true);
    setMetaValue(bsMetaEffDate, "--", true);
    if (protocolName) {
      bsGenerateSpecBtn.classList.remove("hidden");
      showBanner(
        bsBanner,
        "warn",
        "No base spec profile found for this product group. Use Generate Spec to create one from the protocol.",
      );
    } else {
      showBanner(
        bsBanner,
        "info",
        "No protocol or base spec profile is configured for this product group.",
      );
    }
  }
}

async function bsLoadSpecLines(profileId) {
  const { data, error } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_name, method_name, display_text, spec_type, spec_line_is_active",
    )
    .eq("spec_profile_id", profileId)
    .order("seq_no");

  if (error) {
    showBanner(
      bsBanner,
      "error",
      "Could not load spec lines: " + error.message,
    );
    return;
  }

  bsRenderSpecLines(data ?? []);
}

function bsRenderSpecLines(rows) {
  bsEditedSpecLines.clear();
  bsTableCard.classList.remove("hidden");

  const activeCount = rows.filter((r) => r.spec_line_is_active).length;
  const totalCount = rows.length;
  bsLineCount.textContent =
    activeCount === totalCount
      ? `${totalCount} line${totalCount !== 1 ? "s" : ""}`
      : `${activeCount} active / ${totalCount} total`;

  if (!rows.length) {
    bsTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    bsSyncSaveBtn();
    return;
  }

  bsTableBody.innerHTML = rows
    .map((r) => {
      const origText = r.display_text ?? "";
      const origActive = !!r.spec_line_is_active;
      const seqNo = r.seq_no;
      return `<tr data-seq="${esc(String(seqNo))}">
        <td class="td-seq">${esc(String(seqNo))}</td>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td class="td-method">${esc(r.method_name ?? "")}</td>
        <td class="td-spec">
          <input class="spec-input bs-spec-input"
                 type="text"
                 value="${esc(origText)}"
                 data-orig="${esc(origText)}"
                 data-orig-active="${origActive ? "1" : "0"}"
                 aria-label="Spec for ${esc(r.test_name ?? "")}" />
        </td>
        <td>${typeBadge(r.spec_type)}</td>
        <td class="td-active">
          <input class="spec-active bs-active-chk"
                 type="checkbox"
                 ${origActive ? "checked" : ""}
                 aria-label="Active" />
        </td>
      </tr>`;
    })
    .join("");

  // Wire row events after DOM insertion
  bsTableBody.querySelectorAll("tr[data-seq]").forEach((tr) => {
    const inp = tr.querySelector(".bs-spec-input");
    const chk = tr.querySelector(".bs-active-chk");
    const seqNo = Number(tr.dataset.seq);
    const origText = inp.dataset.orig;
    const origActive = inp.dataset.origActive === "1";

    function syncRow() {
      const newText = inp.value;
      const newActive = chk.checked;
      const changed = newText !== origText || newActive !== origActive;
      inp.classList.toggle("edited", newText !== origText);
      if (changed) {
        bsEditedSpecLines.set(seqNo, {
          seq_no: seqNo,
          display_text: newText,
          is_active: newActive,
        });
      } else {
        bsEditedSpecLines.delete(seqNo);
      }
      bsSyncSaveBtn();
      bsSyncActiveAllCheckbox();
    }

    inp.addEventListener("input", syncRow);
    chk.addEventListener("change", syncRow);
  });

  bsWireActiveAllCheckbox();
  bsSyncSaveBtn();
}

function bsSyncSaveBtn() {
  bsSaveSpecBtn.classList.toggle("hidden", bsEditedSpecLines.size === 0);
}

// Wire the master Active checkbox in the Base Spec table header.
// Clicking it checks/unchecks all rows and fires each row's syncRow via
// a native change event so bsEditedSpecLines stays consistent.
function bsWireActiveAllCheckbox() {
  const masterChk = document.getElementById("bsActiveAllChk");
  if (!masterChk) return;

  bsSyncActiveAllCheckbox(); // set initial indeterminate / checked state

  masterChk.addEventListener("change", () => {
    const target = masterChk.checked;
    bsTableBody.querySelectorAll(".bs-active-chk").forEach((chk) => {
      if (chk.checked !== target) {
        chk.checked = target;
        // dispatch 'change' so the row's own syncRow handler fires
        chk.dispatchEvent(new Event("change", { bubbles: false }));
      }
    });
    // After all rows synced, ensure master is clean (not indeterminate)
    masterChk.indeterminate = false;
    masterChk.checked = target;
  });
}

// Reflect the aggregate state of all row Active checkboxes onto the master.
function bsSyncActiveAllCheckbox() {
  const masterChk = document.getElementById("bsActiveAllChk");
  if (!masterChk) return;
  const all = [...bsTableBody.querySelectorAll(".bs-active-chk")];
  if (!all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
    return;
  }
  const checkedCount = all.filter((c) => c.checked).length;
  if (checkedCount === 0) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
  } else if (checkedCount === all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = true;
  } else {
    masterChk.indeterminate = true;
  }
}

async function bsGenerateSpec() {
  if (!bsCurrentGroupId) return;
  const btn = bsGenerateSpecBtn;
  btn.disabled = true;
  btn.textContent = "Generating...";
  showBanner(bsBanner, "info", "Generating base spec profile from protocol...");

  const specName = `FG | ${bsCurrentGroupName} | v1`;
  const { error } = await labSupabase.rpc("fn_generate_fg_group_spec_profile", {
    p_product_group_id: Number(bsCurrentGroupId),
    p_spec_name: specName,
    p_version_no: 1,
    p_remarks: "Generated from protocol via Spec Profile Manager",
  });

  if (error) {
    showBanner(bsBanner, "error", "Generation failed: " + error.message);
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg><span>Generate Spec</span>`;
    return;
  }

  toast("Base spec profile generated successfully.", "success");
  btn.classList.add("hidden");
  await bsLoadGroupContext(bsCurrentGroupId);
}

async function bsSaveSpec() {
  if (!bsCurrentProfileId || bsEditedSpecLines.size === 0) return;
  const btn = bsSaveSpecBtn;
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const edits = Array.from(bsEditedSpecLines.values());
  const { data, error } = await labSupabase.rpc(
    "fn_create_new_spec_version_from_edits",
    {
      p_source_spec_profile_id: bsCurrentProfileId,
      p_edits: edits,
      p_remarks: "Edited via Spec Profile Manager",
    },
  );

  if (error) {
    toast("Save failed: " + error.message, "error");
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Save Spec";
    return;
  }

  const newProfileId = Number(data);
  bsCurrentProfileId = newProfileId;

  // Point the product-group mapping to the newly created spec version
  const { error: mapErr } = await labSupabase.rpc(
    "fn_set_active_fg_group_spec_profile",
    {
      p_product_group_id: Number(bsCurrentGroupId),
      p_spec_profile_id: newProfileId,
      p_remarks: "Activated via Spec Profile Manager save",
    },
  );
  if (mapErr) {
    toast(
      "Spec version saved but group mapping update failed: " + mapErr.message,
      "warn",
    );
  } else {
    toast("Spec version saved and activated for product group.", "success");
  }
  bsEditedSpecLines.clear();
  bsSyncSaveBtn();
  btn.disabled = false;
  btn.classList.remove("loading");

  // Reload meta and lines
  const { data: meta, error: metaErr } = await labSupabase
    .from("spec_profile")
    .select("id, spec_name, version_no, effective_from")
    .eq("id", newProfileId)
    .single();

  if (!metaErr && meta) {
    setMetaValue(bsMetaProfileId, String(meta.id), false);
    setMetaValue(bsMetaVersion, `v${meta.version_no}`, false);
    setMetaValue(bsMetaEffDate, formatDate(meta.effective_from), false);
  }
  await bsLoadSpecLines(newProfileId);
}

function bsResetState() {
  bsCurrentProfileId = null;
  bsCurrentGroupId = null;
  bsCurrentGroupName = null;
  bsEditedSpecLines.clear();
  bsControlCard.classList.add("hidden");
  bsTableCard.classList.add("hidden");
  bsContextStrip.classList.add("hidden");
  hideBanner(bsBanner);
  bsGenerateSpecBtn.classList.add("hidden");
}

// ── BASE SPEC — RM ────────────────────────────────────────────────────────────

async function loadRmGroups() {
  const rmGroupSelect = document.getElementById("rmGroupSelect");
  if (!rmGroupSelect) return;
  rmGroupSelect.disabled = true;
  rmGroupSelect.innerHTML = '<option value="">Loading...</option>';

  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("inv_group_id, inv_group_label")
    .eq("category_code", "RM")
    .order("inv_group_label");

  if (error) {
    toast("Failed to load RM inventory groups: " + error.message, "error");
    rmGroupSelect.innerHTML = '<option value="">-- Error --</option>';
    rmGroupSelect.disabled = false;
    return;
  }

  // Dedupe by inv_group_id
  const seen = new Map();
  for (const row of data ?? []) {
    if (!seen.has(row.inv_group_id)) {
      seen.set(row.inv_group_id, {
        inv_group_id: row.inv_group_id,
        inv_group_label: row.inv_group_label,
      });
    }
  }
  const deduped = [...seen.values()].sort((a, b) =>
    (a.inv_group_label ?? "").localeCompare(b.inv_group_label ?? ""),
  );

  populateSelect(
    rmGroupSelect,
    deduped,
    "inv_group_id",
    "inv_group_label",
    "-- Select Inventory Group --",
  );
  rmGroupSelect.disabled = false;
}

function wireBaseSpecRmEvents() {
  const rmGroupSelect = document.getElementById("rmGroupSelect");
  const rmGenerateSpecBtn = document.getElementById("rmGenerateSpecBtn");
  const rmSaveSpecBtn = document.getElementById("rmSaveSpecBtn");
  if (rmGroupSelect) rmGroupSelect.addEventListener("change", onRmGroupChange);
  if (rmGenerateSpecBtn)
    rmGenerateSpecBtn.addEventListener("click", rmGenerateSpec);
  if (rmSaveSpecBtn) rmSaveSpecBtn.addEventListener("click", rmSaveSpec);
}

async function onRmGroupChange() {
  const rmGroupSelect = document.getElementById("rmGroupSelect");
  const groupId = rmGroupSelect?.value;
  if (!groupId) {
    rmResetState();
    return;
  }
  rmCurrentGroupId = groupId;
  rmCurrentGroupLabel = rmGroupSelect.options[rmGroupSelect.selectedIndex].text;

  const rmBanner = document.getElementById("rmBanner");
  const rmContextStrip = document.getElementById("rmContextStrip");
  const rmGenerateSpecBtn = document.getElementById("rmGenerateSpecBtn");
  const rmMetaProfileId = document.getElementById("rmMetaProfileId");
  const rmMetaVersion = document.getElementById("rmMetaVersion");
  const rmMetaEffDate = document.getElementById("rmMetaEffDate");

  rmControlCard.classList.remove("hidden");
  rmTableCard.classList.add("hidden");
  hideBanner(rmBanner);
  rmGenerateSpecBtn.classList.add("hidden");
  rmContextStrip.classList.add("hidden");
  rmEditedSpecLines.clear();
  rmSyncSaveBtn();

  setMetaValue(rmMetaProfileId, "--", true);
  setMetaValue(rmMetaVersion, "--", true);
  setMetaValue(rmMetaEffDate, "--", true);

  await rmLoadGroupContext(groupId);
}

async function rmLoadGroupContext(groupId) {
  const rmBanner = document.getElementById("rmBanner");
  const rmContextStrip = document.getElementById("rmContextStrip");
  const rmProtocolName = document.getElementById("rmProtocolName");
  const rmBaseSpecName = document.getElementById("rmBaseSpecName");
  const rmBaseSpecVersion = document.getElementById("rmBaseSpecVersion");
  const rmGenerateSpecBtn = document.getElementById("rmGenerateSpecBtn");
  const rmMetaProfileId = document.getElementById("rmMetaProfileId");
  const rmMetaVersion = document.getElementById("rmMetaVersion");
  const rmMetaEffDate = document.getElementById("rmMetaEffDate");

  showBanner(rmBanner, "info", "Loading group protocol and spec info...");

  // Step A: protocol via protocol_category_inv_group_map
  const { data: mapRows, error: mapErr } = await labSupabase
    .from("protocol_category_inv_group_map")
    .select("protocol_category_id")
    .eq("inv_group_id", groupId)
    .eq("subject_type", "RM")
    .eq("is_active", true)
    .limit(1);

  if (mapErr) {
    showBanner(
      rmBanner,
      "error",
      "Could not load protocol mapping: " + mapErr.message,
    );
    return;
  }

  const protocolCategoryId = mapRows?.[0]?.protocol_category_id ?? null;

  // Step B: protocol name
  let protocolName = null;
  if (protocolCategoryId) {
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (!catErr && catRows?.length) {
      protocolName = catRows[0].category_name ?? null;
    }
  }

  // Step C: spec profile via spec_profile_inv_group_map
  const { data: specMapRows, error: specMapErr } = await labSupabase
    .from("spec_profile_inv_group_map")
    .select("spec_profile_id")
    .eq("inv_group_id", groupId)
    .eq("subject_type", "RM")
    .eq("is_active", true)
    .limit(1);

  if (specMapErr) {
    showBanner(
      rmBanner,
      "error",
      "Could not load base spec mapping: " + specMapErr.message,
    );
    return;
  }

  const specProfileId = specMapRows?.[0]?.spec_profile_id ?? null;

  // Step D: spec profile details
  let specProfile = null;
  if (specProfileId) {
    const { data: spRows, error: spErr } = await labSupabase
      .from("spec_profile")
      .select("id, spec_name, version_no, effective_from, is_active")
      .eq("id", specProfileId)
      .limit(1);
    if (!spErr && spRows?.length) {
      specProfile = spRows[0];
    }
  }

  // Populate context strip
  rmProtocolName.textContent = protocolName ?? "None";
  rmProtocolName.classList.toggle("not-set", !protocolName);
  rmBaseSpecName.textContent = specProfile
    ? (specProfile.spec_name ?? `Profile #${specProfile.id}`)
    : "Not set";
  rmBaseSpecName.classList.toggle("not-set", !specProfile);
  rmBaseSpecVersion.textContent = specProfile
    ? String(specProfile.version_no)
    : "--";
  rmBaseSpecVersion.classList.toggle("not-set", !specProfile);
  rmContextStrip.classList.remove("hidden");

  if (specProfile) {
    rmCurrentProfileId = specProfile.id;
    setMetaValue(rmMetaProfileId, String(specProfile.id), false);
    setMetaValue(rmMetaVersion, `v${specProfile.version_no}`, false);
    setMetaValue(rmMetaEffDate, formatDate(specProfile.effective_from), false);
    hideBanner(rmBanner);
    await rmLoadSpecLines(specProfile.id);
  } else {
    rmCurrentProfileId = null;
    setMetaValue(rmMetaProfileId, "--", true);
    setMetaValue(rmMetaVersion, "--", true);
    setMetaValue(rmMetaEffDate, "--", true);
    if (protocolName) {
      rmGenerateSpecBtn.classList.remove("hidden");
      showBanner(
        rmBanner,
        "warn",
        "No base spec profile found for this inventory group. Use Generate Spec to create one from the protocol.",
      );
    } else {
      showBanner(
        rmBanner,
        "info",
        "No protocol or base spec profile is configured for this inventory group.",
      );
    }
  }
}

async function rmLoadSpecLines(profileId) {
  const rmBanner = document.getElementById("rmBanner");
  const { data, error } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_name, method_name, display_text, spec_type, spec_line_is_active",
    )
    .eq("spec_profile_id", profileId)
    .order("seq_no");

  if (error) {
    showBanner(
      rmBanner,
      "error",
      "Could not load spec lines: " + error.message,
    );
    return;
  }

  rmRenderSpecLines(data ?? []);
}

function rmRenderSpecLines(rows) {
  const rmTableCard = document.getElementById("rmTableCard");
  const rmLineCount = document.getElementById("rmLineCount");
  const rmTableBody = document.getElementById("rmTableBody");

  rmEditedSpecLines.clear();
  rmTableCard.classList.remove("hidden");

  const activeCount = rows.filter((r) => r.spec_line_is_active).length;
  const totalCount = rows.length;
  rmLineCount.textContent =
    activeCount === totalCount
      ? `${totalCount} line${totalCount !== 1 ? "s" : ""}`
      : `${activeCount} active / ${totalCount} total`;

  if (!rows.length) {
    rmTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    rmSyncSaveBtn();
    return;
  }

  rmTableBody.innerHTML = rows
    .map((r) => {
      const origText = r.display_text ?? "";
      const origActive = !!r.spec_line_is_active;
      const seqNo = r.seq_no;
      return `<tr data-seq="${esc(String(seqNo))}">
        <td class="td-seq">${esc(String(seqNo))}</td>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td class="td-method">${esc(r.method_name ?? "")}</td>
        <td class="td-spec">
          <input class="spec-input rm-spec-input"
                 type="text"
                 value="${esc(origText)}"
                 data-orig="${esc(origText)}"
                 data-orig-active="${origActive ? "1" : "0"}"
                 aria-label="Spec for ${esc(r.test_name ?? "")}" />
        </td>
        <td>${typeBadge(r.spec_type)}</td>
        <td class="td-active">
          <input class="spec-active rm-active-chk"
                 type="checkbox"
                 ${origActive ? "checked" : ""}
                 aria-label="Active" />
        </td>
      </tr>`;
    })
    .join("");

  rmTableBody.querySelectorAll("tr[data-seq]").forEach((tr) => {
    const inp = tr.querySelector(".rm-spec-input");
    const chk = tr.querySelector(".rm-active-chk");
    const seqNo = Number(tr.dataset.seq);
    const origText = inp.dataset.orig;
    const origActive = inp.dataset.origActive === "1";

    function syncRow() {
      const newText = inp.value;
      const newActive = chk.checked;
      const changed = newText !== origText || newActive !== origActive;
      inp.classList.toggle("edited", newText !== origText);
      if (changed) {
        rmEditedSpecLines.set(seqNo, {
          seq_no: seqNo,
          display_text: newText,
          is_active: newActive,
        });
      } else {
        rmEditedSpecLines.delete(seqNo);
      }
      rmSyncSaveBtn();
      rmSyncActiveAllCheckbox();
    }

    inp.addEventListener("input", syncRow);
    chk.addEventListener("change", syncRow);
  });

  rmWireActiveAllCheckbox();
  rmSyncSaveBtn();
}

function rmSyncSaveBtn() {
  const rmSaveSpecBtn = document.getElementById("rmSaveSpecBtn");
  if (rmSaveSpecBtn)
    rmSaveSpecBtn.classList.toggle("hidden", rmEditedSpecLines.size === 0);
}

function rmWireActiveAllCheckbox() {
  const masterChk = document.getElementById("rmActiveAllChk");
  const rmTableBody = document.getElementById("rmTableBody");
  if (!masterChk || !rmTableBody) return;

  rmSyncActiveAllCheckbox();

  masterChk.addEventListener("change", () => {
    const target = masterChk.checked;
    rmTableBody.querySelectorAll(".rm-active-chk").forEach((chk) => {
      if (chk.checked !== target) {
        chk.checked = target;
        chk.dispatchEvent(new Event("change", { bubbles: false }));
      }
    });
    masterChk.indeterminate = false;
    masterChk.checked = target;
  });
}

function rmSyncActiveAllCheckbox() {
  const masterChk = document.getElementById("rmActiveAllChk");
  const rmTableBody = document.getElementById("rmTableBody");
  if (!masterChk || !rmTableBody) return;
  const all = [...rmTableBody.querySelectorAll(".rm-active-chk")];
  if (!all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
    return;
  }
  const checkedCount = all.filter((c) => c.checked).length;
  if (checkedCount === 0) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
  } else if (checkedCount === all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = true;
  } else {
    masterChk.indeterminate = true;
  }
}

async function rmGenerateSpec() {
  if (!rmCurrentGroupId) return;
  const btn = document.getElementById("rmGenerateSpecBtn");
  const rmBanner = document.getElementById("rmBanner");
  btn.disabled = true;
  btn.textContent = "Generating...";
  showBanner(rmBanner, "info", "Generating base spec profile from protocol...");

  const specName = `RM | ${rmCurrentGroupLabel} | v1`;
  const { error } = await labSupabase.rpc(
    "fn_generate_inv_group_spec_profile",
    {
      p_subject_type: "RM",
      p_inv_group_id: Number(rmCurrentGroupId),
      p_spec_name: specName,
      p_version_no: 1,
      p_remarks: "Generated from protocol via Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(rmBanner, "error", "Generation failed: " + error.message);
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg><span>Generate Spec</span>`;
    return;
  }

  toast("RM base spec profile generated successfully.", "success");
  btn.classList.add("hidden");
  await rmLoadGroupContext(rmCurrentGroupId);
}

async function rmSaveSpec() {
  if (!rmCurrentProfileId || rmEditedSpecLines.size === 0) return;
  const btn = document.getElementById("rmSaveSpecBtn");
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const edits = Array.from(rmEditedSpecLines.values());
  const { data, error } = await labSupabase.rpc(
    "fn_create_new_spec_version_from_edits",
    {
      p_source_spec_profile_id: rmCurrentProfileId,
      p_edits: edits,
      p_remarks: "Edited via Spec Profile Manager",
    },
  );

  if (error) {
    toast("Save failed: " + error.message, "error");
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Save Spec";
    return;
  }

  const newProfileId = Number(data);
  rmCurrentProfileId = newProfileId;

  const { error: mapErr } = await labSupabase.rpc(
    "fn_set_active_rm_group_spec_profile",
    {
      p_inv_group_id: Number(rmCurrentGroupId),
      p_spec_profile_id: newProfileId,
      p_remarks: "Activated via Spec Profile Manager save",
    },
  );
  if (mapErr) {
    toast(
      "Spec version saved but group mapping update failed: " + mapErr.message,
      "warn",
    );
  } else {
    toast(
      "RM spec version saved and activated for inventory group.",
      "success",
    );
  }

  rmEditedSpecLines.clear();
  rmSyncSaveBtn();
  btn.disabled = false;
  btn.classList.remove("loading");
  btn.textContent = "Save Spec";

  const { data: meta, error: metaErr } = await labSupabase
    .from("spec_profile")
    .select("id, spec_name, version_no, effective_from")
    .eq("id", newProfileId)
    .single();

  if (!metaErr && meta) {
    const rmMetaProfileId = document.getElementById("rmMetaProfileId");
    const rmMetaVersion = document.getElementById("rmMetaVersion");
    const rmMetaEffDate = document.getElementById("rmMetaEffDate");
    setMetaValue(rmMetaProfileId, String(meta.id), false);
    setMetaValue(rmMetaVersion, `v${meta.version_no}`, false);
    setMetaValue(rmMetaEffDate, formatDate(meta.effective_from), false);
  }
  await rmLoadSpecLines(newProfileId);
}

function rmResetState() {
  rmCurrentProfileId = null;
  rmCurrentGroupId = null;
  rmCurrentGroupLabel = null;
  rmEditedSpecLines.clear();
  const rmContextStrip = document.getElementById("rmContextStrip");
  const rmBanner = document.getElementById("rmBanner");
  const rmGenerateSpecBtn = document.getElementById("rmGenerateSpecBtn");
  rmControlCard.classList.add("hidden");
  rmTableCard.classList.add("hidden");
  if (rmContextStrip) rmContextStrip.classList.add("hidden");
  if (rmBanner) hideBanner(rmBanner);
  if (rmGenerateSpecBtn) rmGenerateSpecBtn.classList.add("hidden");
}

// ── BASE SPEC — PM ────────────────────────────────────────────────────────────

async function loadPmGroups() {
  const pmGroupSelect = document.getElementById("pmGroupSelect");
  if (!pmGroupSelect) return;
  pmGroupSelect.disabled = true;
  pmGroupSelect.innerHTML = '<option value="">Loading...</option>';

  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("subcategory_id, subcategory_label")
    .eq("category_code", "PLM")
    .order("subcategory_label");

  if (error) {
    toast("Failed to load PM inventory groups: " + error.message, "error");
    pmGroupSelect.innerHTML = '<option value="">-- Error --</option>';
    pmGroupSelect.disabled = false;
    return;
  }

  const seen = new Map();
  for (const row of data ?? []) {
    const key = row.subcategory_id;
    if (!seen.has(key)) {
      seen.set(key, {
        subcategory_id: row.subcategory_id,
        subcategory_label: row.subcategory_label,
      });
    }
  }
  const deduped = [...seen.values()].sort((a, b) =>
    (a.subcategory_label ?? "").localeCompare(b.subcategory_label ?? ""),
  );

  populateSelect(
    pmGroupSelect,
    deduped,
    "subcategory_id",
    "subcategory_label",
    "-- Select Packing Material Subcategory --",
  );
  pmGroupSelect.disabled = false;
}

function wireBaseSpecPmEvents() {
  const pmGroupSelect = document.getElementById("pmGroupSelect");
  const pmGenerateSpecBtn = document.getElementById("pmGenerateSpecBtn");
  const pmSaveSpecBtn = document.getElementById("pmSaveSpecBtn");
  if (pmGroupSelect) pmGroupSelect.addEventListener("change", onPmGroupChange);
  if (pmGenerateSpecBtn)
    pmGenerateSpecBtn.addEventListener("click", pmGenerateSpec);
  if (pmSaveSpecBtn) pmSaveSpecBtn.addEventListener("click", pmSaveSpec);
}

async function onPmGroupChange() {
  const pmGroupSelect = document.getElementById("pmGroupSelect");
  const groupId = pmGroupSelect?.value;
  if (!groupId) {
    pmResetState();
    return;
  }
  pmCurrentGroupId = groupId;
  pmCurrentGroupLabel = pmGroupSelect.options[pmGroupSelect.selectedIndex].text;

  const pmBanner = document.getElementById("pmBanner");
  const pmContextStrip = document.getElementById("pmContextStrip");
  const pmGenerateSpecBtn = document.getElementById("pmGenerateSpecBtn");
  const pmMetaProfileId = document.getElementById("pmMetaProfileId");
  const pmMetaVersion = document.getElementById("pmMetaVersion");
  const pmMetaEffDate = document.getElementById("pmMetaEffDate");

  pmControlCard.classList.remove("hidden");
  pmTableCard.classList.add("hidden");
  hideBanner(pmBanner);
  pmGenerateSpecBtn.classList.add("hidden");
  pmContextStrip.classList.add("hidden");
  pmEditedSpecLines.clear();
  pmSyncSaveBtn();

  setMetaValue(pmMetaProfileId, "--", true);
  setMetaValue(pmMetaVersion, "--", true);
  setMetaValue(pmMetaEffDate, "--", true);

  await pmLoadGroupContext(groupId);
}

async function pmLoadGroupContext(groupId) {
  const pmBanner = document.getElementById("pmBanner");
  const pmContextStrip = document.getElementById("pmContextStrip");
  const pmProtocolName = document.getElementById("pmProtocolName");
  const pmBaseSpecName = document.getElementById("pmBaseSpecName");
  const pmBaseSpecVersion = document.getElementById("pmBaseSpecVersion");
  const pmGenerateSpecBtn = document.getElementById("pmGenerateSpecBtn");
  const pmMetaProfileId = document.getElementById("pmMetaProfileId");
  const pmMetaVersion = document.getElementById("pmMetaVersion");
  const pmMetaEffDate = document.getElementById("pmMetaEffDate");

  showBanner(pmBanner, "info", "Loading group protocol and spec info...");

  // Step A: protocol via RPC
  const { data: protocolCategoryId, error: mapErr } = await labSupabase.rpc(
    "fn_get_active_protocol_category_id_for_pm_subcategory",
    {
      p_subcategory_id: Number(groupId),
    },
  );
  if (mapErr) {
    showBanner(
      pmBanner,
      "error",
      "Could not load protocol mapping: " + mapErr.message,
    );
    return;
  }

  // Step B: protocol name
  let protocolName = null;
  if (protocolCategoryId) {
    const { data: catRows, error: catErr } = await labSupabase
      .from("protocol_category")
      .select("id, category_name")
      .eq("id", protocolCategoryId)
      .limit(1);
    if (!catErr && catRows?.length) {
      protocolName = catRows[0].category_name ?? null;
    }
  }

  // Step C: spec profile via RPC
  const { data: specProfileId, error: specMapErr } = await labSupabase.rpc(
    "fn_get_active_spec_profile_id_for_pm_subcategory",
    {
      p_subcategory_id: Number(groupId),
      p_as_of_date: new Date().toISOString().slice(0, 10),
    },
  );
  if (specMapErr) {
    showBanner(
      pmBanner,
      "error",
      "Could not load base spec mapping: " + specMapErr.message,
    );
    return;
  }

  // Step D: spec profile details
  let specProfile = null;
  if (specProfileId) {
    const { data: spRows, error: spErr } = await labSupabase
      .from("spec_profile")
      .select("id, spec_name, version_no, effective_from, is_active")
      .eq("id", specProfileId)
      .limit(1);
    if (!spErr && spRows?.length) {
      specProfile = spRows[0];
    }
  }

  pmProtocolName.textContent = protocolName ?? "None";
  pmProtocolName.classList.toggle("not-set", !protocolName);
  pmBaseSpecName.textContent = specProfile
    ? (specProfile.spec_name ?? `Profile #${specProfile.id}`)
    : "Not set";
  pmBaseSpecName.classList.toggle("not-set", !specProfile);
  pmBaseSpecVersion.textContent = specProfile
    ? String(specProfile.version_no)
    : "--";
  pmBaseSpecVersion.classList.toggle("not-set", !specProfile);
  pmContextStrip.classList.remove("hidden");

  if (specProfile) {
    pmCurrentProfileId = specProfile.id;
    setMetaValue(pmMetaProfileId, String(specProfile.id), false);
    setMetaValue(pmMetaVersion, `v${specProfile.version_no}`, false);
    setMetaValue(pmMetaEffDate, formatDate(specProfile.effective_from), false);
    hideBanner(pmBanner);
    await pmLoadSpecLines(specProfile.id);
  } else {
    pmCurrentProfileId = null;
    setMetaValue(pmMetaProfileId, "--", true);
    setMetaValue(pmMetaVersion, "--", true);
    setMetaValue(pmMetaEffDate, "--", true);
    if (protocolName) {
      pmGenerateSpecBtn.classList.remove("hidden");
      showBanner(
        pmBanner,
        "warn",
        "No base spec profile found for this packing material subcategory. Use Generate Spec to create one from the protocol.",
      );
    } else {
      showBanner(
        pmBanner,
        "info",
        "No protocol or base spec profile is configured for this packing material subcategory.",
      );
    }
  }
}

async function pmLoadSpecLines(profileId) {
  const pmBanner = document.getElementById("pmBanner");
  const { data, error } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_name, method_name, display_text, spec_type, spec_line_is_active",
    )
    .eq("spec_profile_id", profileId)
    .order("seq_no");

  if (error) {
    showBanner(
      pmBanner,
      "error",
      "Could not load spec lines: " + error.message,
    );
    return;
  }
  pmRenderSpecLines(data ?? []);
}

function pmRenderSpecLines(rows) {
  const pmLineCount = document.getElementById("pmLineCount");
  const pmTableBodyEl = document.getElementById("pmTableBody");

  pmEditedSpecLines.clear();
  pmTableCard.classList.remove("hidden");

  const activeCount = rows.filter((r) => r.spec_line_is_active).length;
  const totalCount = rows.length;
  pmLineCount.textContent =
    activeCount === totalCount
      ? `${totalCount} line${totalCount !== 1 ? "s" : ""}`
      : `${activeCount} active / ${totalCount} total`;

  if (!rows.length) {
    pmTableBodyEl.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No specification lines</strong>
        This profile has no lines yet.
      </div></td></tr>`;
    pmSyncSaveBtn();
    return;
  }

  pmTableBodyEl.innerHTML = rows
    .map((r) => {
      const origText = r.display_text ?? "";
      const origActive = !!r.spec_line_is_active;
      const seqNo = r.seq_no;
      return `<tr data-seq="${esc(String(seqNo))}">
        <td class="td-seq">${esc(String(seqNo))}</td>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td class="td-method">${esc(r.method_name ?? "")}</td>
        <td class="td-spec">
          <input class="spec-input pm-spec-input"
                 type="text"
                 value="${esc(origText)}"
                 data-orig="${esc(origText)}"
                 data-orig-active="${origActive ? "1" : "0"}"
                 aria-label="Spec for ${esc(r.test_name ?? "")}" />
        </td>
        <td>${typeBadge(r.spec_type)}</td>
        <td class="td-active">
          <input class="spec-active pm-active-chk"
                 type="checkbox"
                 ${origActive ? "checked" : ""}
                 aria-label="Active" />
        </td>
      </tr>`;
    })
    .join("");

  pmTableBodyEl.querySelectorAll("tr[data-seq]").forEach((tr) => {
    const inp = tr.querySelector(".pm-spec-input");
    const chk = tr.querySelector(".pm-active-chk");
    const seqNo = Number(tr.dataset.seq);
    const origText = inp.dataset.orig;
    const origActive = inp.dataset.origActive === "1";

    function syncRow() {
      const newText = inp.value;
      const newActive = chk.checked;
      const changed = newText !== origText || newActive !== origActive;
      inp.classList.toggle("edited", newText !== origText);
      if (changed) {
        pmEditedSpecLines.set(seqNo, {
          seq_no: seqNo,
          display_text: newText,
          is_active: newActive,
        });
      } else {
        pmEditedSpecLines.delete(seqNo);
      }
      pmSyncSaveBtn();
      pmSyncActiveAllCheckbox();
    }

    inp.addEventListener("input", syncRow);
    chk.addEventListener("change", syncRow);
  });

  pmWireActiveAllCheckbox();
  pmSyncSaveBtn();
}

function pmSyncSaveBtn() {
  const pmSaveSpecBtn = document.getElementById("pmSaveSpecBtn");
  if (pmSaveSpecBtn)
    pmSaveSpecBtn.classList.toggle("hidden", pmEditedSpecLines.size === 0);
}

function pmWireActiveAllCheckbox() {
  const masterChk = document.getElementById("pmActiveAllChk");
  const pmTableBodyEl = document.getElementById("pmTableBody");
  if (!masterChk || !pmTableBodyEl) return;

  pmSyncActiveAllCheckbox();

  masterChk.addEventListener("change", () => {
    const target = masterChk.checked;
    pmTableBodyEl.querySelectorAll(".pm-active-chk").forEach((chk) => {
      if (chk.checked !== target) {
        chk.checked = target;
        chk.dispatchEvent(new Event("change", { bubbles: false }));
      }
    });
    masterChk.indeterminate = false;
    masterChk.checked = target;
  });
}

function pmSyncActiveAllCheckbox() {
  const masterChk = document.getElementById("pmActiveAllChk");
  const pmTableBodyEl = document.getElementById("pmTableBody");
  if (!masterChk || !pmTableBodyEl) return;
  const all = [...pmTableBodyEl.querySelectorAll(".pm-active-chk")];
  if (!all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
    return;
  }
  const checkedCount = all.filter((c) => c.checked).length;
  if (checkedCount === 0) {
    masterChk.indeterminate = false;
    masterChk.checked = false;
  } else if (checkedCount === all.length) {
    masterChk.indeterminate = false;
    masterChk.checked = true;
  } else {
    masterChk.indeterminate = true;
  }
}

async function pmGenerateSpec() {
  if (!pmCurrentGroupId) return;
  const btn = document.getElementById("pmGenerateSpecBtn");
  const pmBanner = document.getElementById("pmBanner");
  btn.disabled = true;
  btn.textContent = "Generating...";
  showBanner(pmBanner, "info", "Generating base spec profile from protocol...");

  const specName = `PM | Subcategory | ${pmCurrentGroupLabel} | v1`;
  const { error } = await labSupabase.rpc(
    "fn_generate_pm_subcategory_spec_profile",
    {
      p_subcategory_id: Number(pmCurrentGroupId),
      p_spec_name: specName,
      p_version_no: 1,
      p_remarks: "Generated from protocol via Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(pmBanner, "error", "Generation failed: " + error.message);
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg><span>Generate Spec</span>`;
    return;
  }

  toast("PM base spec profile generated successfully.", "success");
  btn.classList.add("hidden");
  await pmLoadGroupContext(pmCurrentGroupId);
}

async function pmSaveSpec() {
  if (!pmCurrentProfileId || pmEditedSpecLines.size === 0) return;
  const btn = document.getElementById("pmSaveSpecBtn");
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const edits = Array.from(pmEditedSpecLines.values());
  const { data, error } = await labSupabase.rpc(
    "fn_create_new_spec_version_from_edits",
    {
      p_source_spec_profile_id: pmCurrentProfileId,
      p_edits: edits,
      p_remarks: "Edited via Spec Profile Manager",
    },
  );

  if (error) {
    toast("Save failed: " + error.message, "error");
    btn.disabled = false;
    btn.classList.remove("loading");
    btn.textContent = "Save Spec";
    return;
  }

  const newProfileId = Number(data);
  pmCurrentProfileId = newProfileId;

  const { error: mapErr } = await labSupabase.rpc(
    "fn_set_active_pm_subcategory_spec_profile",
    {
      p_subcategory_id: Number(pmCurrentGroupId),
      p_spec_profile_id: newProfileId,
      p_remarks: "Activated via Spec Profile Manager save",
    },
  );
  if (mapErr) {
    toast(
      "Spec version saved but group mapping update failed: " + mapErr.message,
      "warn",
    );
  } else {
    toast(
      "PM spec version saved and activated for packing material subcategory.",
      "success",
    );
  }

  pmEditedSpecLines.clear();
  pmSyncSaveBtn();
  btn.disabled = false;
  btn.classList.remove("loading");
  btn.textContent = "Save Spec";

  const { data: meta, error: metaErr } = await labSupabase
    .from("spec_profile")
    .select("id, spec_name, version_no, effective_from")
    .eq("id", newProfileId)
    .single();

  if (!metaErr && meta) {
    const pmMetaProfileId = document.getElementById("pmMetaProfileId");
    const pmMetaVersion = document.getElementById("pmMetaVersion");
    const pmMetaEffDate = document.getElementById("pmMetaEffDate");
    setMetaValue(pmMetaProfileId, String(meta.id), false);
    setMetaValue(pmMetaVersion, `v${meta.version_no}`, false);
    setMetaValue(pmMetaEffDate, formatDate(meta.effective_from), false);
  }
  await pmLoadSpecLines(newProfileId);
}

function pmResetState() {
  pmCurrentProfileId = null;
  pmCurrentGroupId = null;
  pmCurrentGroupLabel = null;
  pmEditedSpecLines.clear();
  const pmContextStrip = document.getElementById("pmContextStrip");
  const pmBanner = document.getElementById("pmBanner");
  const pmGenerateSpecBtn = document.getElementById("pmGenerateSpecBtn");
  pmControlCard.classList.add("hidden");
  pmTableCard.classList.add("hidden");
  if (pmContextStrip) pmContextStrip.classList.add("hidden");
  if (pmBanner) hideBanner(pmBanner);
  if (pmGenerateSpecBtn) pmGenerateSpecBtn.classList.add("hidden");
}

// ── OVERRIDES — PM ────────────────────────────────────────────────────────────

async function loadPmItems(selectEl) {
  selectEl.disabled = true;
  selectEl.innerHTML = '<option value="">Loading...</option>';
  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("stock_item_id, stock_item_name")
    .eq("category_code", "PLM")
    .order("stock_item_name");

  if (error) {
    toast("Failed to load PM stock items: " + error.message, "error");
    selectEl.innerHTML = '<option value="">-- Error --</option>';
    selectEl.disabled = false;
    return;
  }
  const seen = new Set();
  const unique = [];
  for (const row of data ?? []) {
    if (!seen.has(row.stock_item_id)) {
      seen.add(row.stock_item_id);
      unique.push(row);
    }
  }
  populateSelect(
    selectEl,
    unique,
    "stock_item_id",
    "stock_item_name",
    "-- Select Packing Material --",
  );
  selectEl.disabled = false;
}

function wireOverridesPmEvents() {
  ovPmItemSelect.addEventListener("change", onPmOverrideItemChange);
}

async function onPmOverrideItemChange() {
  const stockItemId = ovPmItemSelect.value;
  if (!stockItemId) {
    ovPmContextStrip.classList.add("hidden");
    ovPmTableCard.classList.add("hidden");
    hideBanner(ovPmBanner);
    return;
  }

  ovPmContextStrip.classList.add("hidden");
  ovPmTableCard.classList.add("hidden");
  hideBanner(ovPmBanner);
  showBanner(ovPmBanner, "info", "Loading stock item context...");

  const { data: grpData, error: grpErr } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("subcategory_id, subcategory_label")
    .eq("stock_item_id", stockItemId)
    .eq("category_code", "PLM")
    .limit(1);

  if (grpErr) {
    showBanner(
      ovPmBanner,
      "error",
      "Could not resolve packing material subcategory: " + grpErr.message,
    );
    return;
  }

  const subcat = grpData?.[0];
  if (!subcat) {
    showBanner(
      ovPmBanner,
      "warn",
      "Packing material subcategory mapping not found for this stock item.",
    );
    return;
  }

  ovPmGroupName.textContent = subcat.subcategory_label ?? "--";
  ovPmGroupName.classList.toggle("not-set", !subcat.subcategory_label);

  let baseSpecProfileId = null;
  if (subcat.subcategory_id) {
    const { data: smRows } = await labSupabase
      .from("spec_profile_pm_subcategory_map")
      .select("spec_profile_id")
      .eq("subcategory_id", subcat.subcategory_id)
      .eq("is_active", true)
      .limit(1);
    baseSpecProfileId = smRows?.[0]?.spec_profile_id ?? null;
  }

  ovPmBaseSpecId.textContent = baseSpecProfileId
    ? String(baseSpecProfileId)
    : "Not set";
  ovPmBaseSpecId.classList.toggle("not-set", !baseSpecProfileId);
  ovPmContextStrip.classList.remove("hidden");

  const { data: overrides, error: ovErr } = await labSupabase
    .from("spec_override")
    .select(
      "id, test_id, action_type, override_method_id, override_spec_type, override_display_text, override_is_required, is_active, reason",
    )
    .eq("subject_type", "PM")
    .eq("stock_item_id", stockItemId);

  if (ovErr) {
    showBanner(
      ovPmBanner,
      "error",
      "Could not load overrides: " + ovErr.message,
    );
    return;
  }

  if (!overrides?.length) {
    hideBanner(ovPmBanner);
    renderPmOverrides([]);
    return;
  }

  const testIds = [...new Set(overrides.map((r) => r.test_id).filter(Boolean))];
  const methodIds = [
    ...new Set(overrides.map((r) => r.override_method_id).filter(Boolean)),
  ];

  const [testRes, methodRes] = await Promise.all([
    testIds.length
      ? labSupabase
          .from("test_master")
          .select("id, test_name")
          .in("id", testIds)
      : Promise.resolve({ data: [] }),
    methodIds.length
      ? labSupabase
          .from("test_method")
          .select("id, method_name")
          .in("id", methodIds)
      : Promise.resolve({ data: [] }),
  ]);

  const testMap = Object.fromEntries(
    (testRes.data ?? []).map((r) => [r.id, r.test_name]),
  );
  const methodMap = Object.fromEntries(
    (methodRes.data ?? []).map((r) => [r.id, r.method_name]),
  );

  const enriched = overrides.map((r) => ({
    ...r,
    test_name: testMap[r.test_id] ?? `(test #${r.test_id})`,
    override_method_name:
      methodMap[r.override_method_id] ??
      (r.override_method_id ? `(method #${r.override_method_id})` : ""),
  }));
  enriched.sort((a, b) => (a.test_name ?? "").localeCompare(b.test_name ?? ""));

  hideBanner(ovPmBanner);
  renderPmOverrides(enriched);
}

function renderPmOverrides(rows) {
  ovPmTableCard.classList.remove("hidden");
  ovPmLineCount.textContent = `${rows.length} override${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    ovPmTableBody.innerHTML = `<tr><td colspan="8">
      <div class="spec-empty-state">
        <strong>No overrides found</strong>
        This packing material has no spec overrides configured.
      </div></td></tr>`;
    return;
  }

  ovPmTableBody.innerHTML = rows
    .map((r) => {
      const actionClass =
        {
          modify: "action-badge-replace",
          add: "action-badge-append",
          disable: "action-badge-exclude",
        }[String(r.action_type ?? "").toLowerCase()] ?? "action-badge-other";

      return `<tr>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td><span class="action-badge ${actionClass}">${esc(r.action_type ?? "")}</span></td>
        <td>${esc(r.override_method_name ?? "")}</td>
        <td>${esc(r.override_spec_type ?? "")}</td>
        <td>${esc(r.override_display_text ?? "")}</td>
        <td style="text-align:center;">${r.override_is_required ? "Yes" : "No"}</td>
        <td style="text-align:center;">${r.is_active ? "Yes" : "No"}</td>
        <td style="color:var(--muted,#6b7280);font-style:italic;">${esc(r.reason ?? "")}</td>
      </tr>`;
    })
    .join("");
}

// ── EFFECTIVE PREVIEW — PM ────────────────────────────────────────────────────

function wireEffectivePreviewPmEvents() {
  epPmItemSelect.addEventListener("change", onPmEffectivePreviewItemChange);
}

async function onPmEffectivePreviewItemChange() {
  const stockItemId = epPmItemSelect.value;
  if (!stockItemId) {
    epPmTableCard.classList.add("hidden");
    hideBanner(epPmBanner);
    return;
  }

  epPmTableCard.classList.add("hidden");
  hideBanner(epPmBanner);
  showBanner(epPmBanner, "info", "Building effective PM spec preview...");

  const { data, error } = await labSupabase.rpc(
    "fn_build_effective_pm_spec_for_item",
    {
      p_stock_item_id: Number(stockItemId),
      p_as_of_date: todayISO(),
      p_remarks: "Preview build from Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(
      epPmBanner,
      "error",
      "Could not build effective spec: " + error.message,
    );
    return;
  }

  const newProfileId = Number(data);
  if (!newProfileId) {
    showBanner(
      epPmBanner,
      "warn",
      "No effective spec could be resolved for this packing material.",
    );
    return;
  }

  hideBanner(epPmBanner);

  const { data: lines, error: linesErr } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_name, method_name, display_text, spec_type, spec_line_is_active",
    )
    .eq("spec_profile_id", newProfileId)
    .eq("spec_line_is_active", true)
    .order("seq_no");

  if (linesErr) {
    showBanner(
      epPmBanner,
      "error",
      "Could not load effective spec lines: " + linesErr.message,
    );
    return;
  }

  renderPmEffectivePreview(lines ?? []);
}

function renderPmEffectivePreview(rows) {
  epPmTableCard.classList.remove("hidden");
  epPmLineCount.textContent = `${rows.length} line${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    epPmTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No lines found</strong>
        The effective spec profile has no lines.
      </div></td></tr>`;
    return;
  }

  epPmTableBody.innerHTML = rows
    .map(
      (r) => `<tr>
      <td class="td-seq">${esc(String(r.seq_no ?? ""))}</td>
      <td class="td-test">${esc(r.test_name ?? "")}</td>
      <td class="td-method">${esc(r.method_name ?? "")}</td>
      <td class="td-spec">${esc(r.display_text ?? "")}</td>
      <td>${typeBadge(r.spec_type)}</td>
      <td class="td-active" style="text-align:center;color:var(--muted,#6b7280);">
        ${r.spec_line_is_active ? "Yes" : "No"}
      </td>
    </tr>`,
    )
    .join("");
}

// FIX 2: use product_id / product_name
async function loadFgProducts(selectEl) {
  selectEl.disabled = true;
  selectEl.innerHTML = '<option value="">Loading...</option>';
  const { data, error } = await labSupabase
    .from("v_sample_receipt_fg_picker")
    .select("product_id, product_name")
    .order("product_name");

  if (error) {
    toast("Failed to load products: " + error.message, "error");
    selectEl.innerHTML = '<option value="">-- Error --</option>';
    selectEl.disabled = false;
    return;
  }
  populateSelect(
    selectEl,
    data,
    "product_id",
    "product_name",
    "-- Select Product --",
  );
  selectEl.disabled = false;
}

function wireOverridesEvents() {
  ovProductSelect.addEventListener("change", onOvProductChange);
}

async function onOvProductChange() {
  const productId = ovProductSelect.value;
  if (!productId) {
    ovFgContextStrip.classList.add("hidden");
    ovTableCard.classList.add("hidden");
    hideBanner(ovBanner);
    return;
  }

  ovFgContextStrip.classList.add("hidden");
  ovTableCard.classList.add("hidden");
  hideBanner(ovBanner);
  showBanner(ovBanner, "info", "Loading product context...");

  // FIX 6: v_fg_product_with_group — only use product_group_id and product_group_name
  const { data: grpData, error: grpErr } = await labSupabase
    .from("v_fg_product_with_group")
    .select("product_group_id, product_group_name")
    .eq("product_id", productId)
    .limit(1);

  if (grpErr) {
    showBanner(
      ovBanner,
      "error",
      "Could not resolve product group: " + grpErr.message,
    );
    return;
  }

  const grp = grpData?.[0];
  if (!grp) {
    showBanner(
      ovBanner,
      "warn",
      "Product group mapping not found for this product.",
    );
    return;
  }

  ovFgGroupName.textContent = grp.product_group_name ?? "--";
  ovFgGroupName.classList.toggle("not-set", !grp.product_group_name);

  // FIX 6: resolve base spec profile id separately via spec_profile_product_group_map + spec_profile
  let baseSpecProfileId = null;
  if (grp.product_group_id) {
    const { data: smRows } = await labSupabase
      .from("spec_profile_product_group_map")
      .select("spec_profile_id")
      .eq("product_group_id", grp.product_group_id)
      .eq("is_active", true)
      .limit(1);
    baseSpecProfileId = smRows?.[0]?.spec_profile_id ?? null;
  }

  ovFgBaseSpecId.textContent = baseSpecProfileId
    ? String(baseSpecProfileId)
    : "Not set";
  ovFgBaseSpecId.classList.toggle("not-set", !baseSpecProfileId);
  ovFgContextStrip.classList.remove("hidden");

  // FIX 5: load overrides, then join test_master + test_method in memory
  const { data: overrides, error: ovErr } = await labSupabase
    .from("spec_override")
    .select(
      "id, test_id, action_type, override_method_id, override_spec_type, override_display_text, override_is_required, is_active, reason",
    )
    .eq("subject_type", "FG")
    .eq("product_id", productId);

  if (ovErr) {
    showBanner(ovBanner, "error", "Could not load overrides: " + ovErr.message);
    return;
  }

  if (!overrides?.length) {
    hideBanner(ovBanner);
    renderOverrides([]);
    return;
  }

  // Collect unique IDs for batch lookup
  const testIds = [...new Set(overrides.map((r) => r.test_id).filter(Boolean))];
  const methodIds = [
    ...new Set(overrides.map((r) => r.override_method_id).filter(Boolean)),
  ];

  const [testRes, methodRes] = await Promise.all([
    testIds.length
      ? labSupabase
          .from("test_master")
          .select("id, test_name")
          .in("id", testIds)
      : Promise.resolve({ data: [] }),
    methodIds.length
      ? labSupabase
          .from("test_method")
          .select("id, method_name")
          .in("id", methodIds)
      : Promise.resolve({ data: [] }),
  ]);

  const testMap = Object.fromEntries(
    (testRes.data ?? []).map((r) => [r.id, r.test_name]),
  );
  const methodMap = Object.fromEntries(
    (methodRes.data ?? []).map((r) => [r.id, r.method_name]),
  );

  const enriched = overrides.map((r) => ({
    ...r,
    test_name: testMap[r.test_id] ?? `(test #${r.test_id})`,
    override_method_name:
      methodMap[r.override_method_id] ??
      (r.override_method_id ? `(method #${r.override_method_id})` : ""),
  }));

  // Sort by test name client-side
  enriched.sort((a, b) => (a.test_name ?? "").localeCompare(b.test_name ?? ""));

  hideBanner(ovBanner);
  renderOverrides(enriched);
}

function renderOverrides(rows) {
  ovTableCard.classList.remove("hidden");
  ovLineCount.textContent = `${rows.length} override${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    ovTableBody.innerHTML = `<tr><td colspan="8">
      <div class="spec-empty-state">
        <strong>No overrides found</strong>
        This product has no spec overrides configured.
      </div></td></tr>`;
    return;
  }

  ovTableBody.innerHTML = rows
    .map((r) => {
      const actionClass =
        {
          modify: "action-badge-replace",
          add: "action-badge-append",
          disable: "action-badge-exclude",
        }[String(r.action_type ?? "").toLowerCase()] ?? "action-badge-other";

      return `<tr>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td><span class="action-badge ${actionClass}">${esc(r.action_type ?? "")}</span></td>
        <td>${esc(r.override_method_name ?? "")}</td>
        <td>${esc(r.override_spec_type ?? "")}</td>
        <td>${esc(r.override_display_text ?? "")}</td>
        <td style="text-align:center;">${r.override_is_required ? "Yes" : "No"}</td>
        <td style="text-align:center;">${r.is_active ? "Yes" : "No"}</td>
        <td style="color:var(--muted,#6b7280);font-style:italic;">${esc(r.reason ?? "")}</td>
      </tr>`;
    })
    .join("");
}

// ── OVERRIDES — RM ────────────────────────────────────────────────────────────

async function loadRmItems(selectEl) {
  selectEl.disabled = true;
  selectEl.innerHTML = '<option value="">Loading...</option>';
  // Filter strictly to RM category — excludes PM and other item types
  const { data, error } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("stock_item_id, stock_item_name")
    .eq("category_code", "RM")
    .order("stock_item_name");

  if (error) {
    toast("Failed to load RM stock items: " + error.message, "error");
    selectEl.innerHTML = '<option value="">-- Error --</option>';
    selectEl.disabled = false;
    return;
  }
  // Dedupe by stock_item_id (view may return multiple rows per item for different groups)
  const seen = new Set();
  const unique = [];
  for (const row of data ?? []) {
    if (!seen.has(row.stock_item_id)) {
      seen.add(row.stock_item_id);
      unique.push(row);
    }
  }
  populateSelect(
    selectEl,
    unique,
    "stock_item_id",
    "stock_item_name",
    "-- Select Stock Item --",
  );
  selectEl.disabled = false;
}

function wireOverridesRmEvents() {
  ovRmItemSelect.addEventListener("change", onRmOverrideItemChange);
}

async function onRmOverrideItemChange() {
  const stockItemId = ovRmItemSelect.value;
  if (!stockItemId) {
    ovRmContextStrip.classList.add("hidden");
    ovRmTableCard.classList.add("hidden");
    hideBanner(ovRmBanner);
    return;
  }

  ovRmContextStrip.classList.add("hidden");
  ovRmTableCard.classList.add("hidden");
  hideBanner(ovRmBanner);
  showBanner(ovRmBanner, "info", "Loading stock item context...");

  // Resolve inventory group
  const { data: grpData, error: grpErr } = await labSupabase
    .from("v_rm_pm_item_with_group")
    .select("inv_group_id, inv_group_label")
    .eq("stock_item_id", stockItemId)
    .eq("category_code", "RM")
    .limit(1);

  if (grpErr) {
    showBanner(
      ovRmBanner,
      "error",
      "Could not resolve inventory group: " + grpErr.message,
    );
    return;
  }

  const grp = grpData?.[0];
  if (!grp) {
    showBanner(
      ovRmBanner,
      "warn",
      "Inventory group mapping not found for this stock item.",
    );
    return;
  }

  ovRmGroupName.textContent = grp.inv_group_label ?? "--";
  ovRmGroupName.classList.toggle("not-set", !grp.inv_group_label);

  // Resolve base spec profile
  let baseSpecProfileId = null;
  if (grp.inv_group_id) {
    const { data: smRows } = await labSupabase
      .from("spec_profile_inv_group_map")
      .select("spec_profile_id")
      .eq("inv_group_id", grp.inv_group_id)
      .eq("subject_type", "RM")
      .eq("is_active", true)
      .limit(1);
    baseSpecProfileId = smRows?.[0]?.spec_profile_id ?? null;
  }

  ovRmBaseSpecId.textContent = baseSpecProfileId
    ? String(baseSpecProfileId)
    : "Not set";
  ovRmBaseSpecId.classList.toggle("not-set", !baseSpecProfileId);
  ovRmContextStrip.classList.remove("hidden");

  // Load overrides
  const { data: overrides, error: ovErr } = await labSupabase
    .from("spec_override")
    .select(
      "id, test_id, action_type, override_method_id, override_spec_type, override_display_text, override_is_required, is_active, reason",
    )
    .eq("subject_type", "RM")
    .eq("stock_item_id", stockItemId);

  if (ovErr) {
    showBanner(
      ovRmBanner,
      "error",
      "Could not load overrides: " + ovErr.message,
    );
    return;
  }

  if (!overrides?.length) {
    hideBanner(ovRmBanner);
    renderRmOverrides([]);
    return;
  }

  const testIds = [...new Set(overrides.map((r) => r.test_id).filter(Boolean))];
  const methodIds = [
    ...new Set(overrides.map((r) => r.override_method_id).filter(Boolean)),
  ];

  const [testRes, methodRes] = await Promise.all([
    testIds.length
      ? labSupabase
          .from("test_master")
          .select("id, test_name")
          .in("id", testIds)
      : Promise.resolve({ data: [] }),
    methodIds.length
      ? labSupabase
          .from("test_method")
          .select("id, method_name")
          .in("id", methodIds)
      : Promise.resolve({ data: [] }),
  ]);

  const testMap = Object.fromEntries(
    (testRes.data ?? []).map((r) => [r.id, r.test_name]),
  );
  const methodMap = Object.fromEntries(
    (methodRes.data ?? []).map((r) => [r.id, r.method_name]),
  );

  const enriched = overrides.map((r) => ({
    ...r,
    test_name: testMap[r.test_id] ?? `(test #${r.test_id})`,
    override_method_name:
      methodMap[r.override_method_id] ??
      (r.override_method_id ? `(method #${r.override_method_id})` : ""),
  }));
  enriched.sort((a, b) => (a.test_name ?? "").localeCompare(b.test_name ?? ""));

  hideBanner(ovRmBanner);
  renderRmOverrides(enriched);
}

function renderRmOverrides(rows) {
  ovRmTableCard.classList.remove("hidden");
  ovRmLineCount.textContent = `${rows.length} override${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    ovRmTableBody.innerHTML = `<tr><td colspan="8">
      <div class="spec-empty-state">
        <strong>No overrides found</strong>
        This stock item has no spec overrides configured.
      </div></td></tr>`;
    return;
  }

  ovRmTableBody.innerHTML = rows
    .map((r) => {
      const actionClass =
        {
          modify: "action-badge-replace",
          add: "action-badge-append",
          disable: "action-badge-exclude",
        }[String(r.action_type ?? "").toLowerCase()] ?? "action-badge-other";

      return `<tr>
        <td class="td-test">${esc(r.test_name ?? "")}</td>
        <td><span class="action-badge ${actionClass}">${esc(r.action_type ?? "")}</span></td>
        <td>${esc(r.override_method_name ?? "")}</td>
        <td>${esc(r.override_spec_type ?? "")}</td>
        <td>${esc(r.override_display_text ?? "")}</td>
        <td style="text-align:center;">${r.override_is_required ? "Yes" : "No"}</td>
        <td style="text-align:center;">${r.is_active ? "Yes" : "No"}</td>
        <td style="color:var(--muted,#6b7280);font-style:italic;">${esc(r.reason ?? "")}</td>
      </tr>`;
    })
    .join("");
}

// ── EFFECTIVE PREVIEW — FG ────────────────────────────────────────────────────
function wireEffectivePreviewEvents() {
  epProductSelect.addEventListener("change", onEpProductChange);
}

async function onEpProductChange() {
  const productId = epProductSelect.value;
  if (!productId) {
    epTableCard.classList.add("hidden");
    hideBanner(epBanner);
    return;
  }

  epTableCard.classList.add("hidden");
  hideBanner(epBanner);
  showBanner(epBanner, "info", "Building effective spec preview...");

  // FIX 7: pass exactly p_product_id, p_as_of_date, p_remarks
  const { data, error } = await labSupabase.rpc(
    "fn_build_effective_fg_spec_for_product",
    {
      p_product_id: Number(productId),
      p_as_of_date: todayISO(),
      p_remarks: "Preview build from Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(
      epBanner,
      "error",
      "Could not build effective spec: " + error.message,
    );
    return;
  }

  const newProfileId = Number(data);
  if (!newProfileId) {
    showBanner(
      epBanner,
      "warn",
      "No effective spec could be resolved for this product.",
    );
    return;
  }

  hideBanner(epBanner);

  const { data: lines, error: linesErr } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_name, method_name, display_text, spec_type, spec_line_is_active",
    )
    .eq("spec_profile_id", newProfileId)
    .eq("spec_line_is_active", true)
    .order("seq_no");

  if (linesErr) {
    showBanner(
      epBanner,
      "error",
      "Could not load effective spec lines: " + linesErr.message,
    );
    return;
  }

  renderEffectivePreview(lines ?? []);
}

function renderEffectivePreview(rows) {
  epTableCard.classList.remove("hidden");
  epLineCount.textContent = `${rows.length} line${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    epTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No lines found</strong>
        The effective spec profile has no lines.
      </div></td></tr>`;
    return;
  }

  epTableBody.innerHTML = rows
    .map(
      (r) => `<tr>
      <td class="td-seq">${esc(String(r.seq_no ?? ""))}</td>
      <td class="td-test">${esc(r.test_name ?? "")}</td>
      <td class="td-method">${esc(r.method_name ?? "")}</td>
      <td class="td-spec">${esc(r.display_text ?? "")}</td>
      <td>${typeBadge(r.spec_type)}</td>
      <td class="td-active" style="text-align:center;color:var(--muted,#6b7280);">
        ${r.spec_line_is_active ? "Yes" : "No"}
      </td>
    </tr>`,
    )
    .join("");
}

// ── EFFECTIVE PREVIEW — RM ────────────────────────────────────────────────────
function wireEffectivePreviewRmEvents() {
  epRmItemSelect.addEventListener("change", onRmEffectivePreviewItemChange);
}

async function onRmEffectivePreviewItemChange() {
  const stockItemId = epRmItemSelect.value;
  if (!stockItemId) {
    epRmTableCard.classList.add("hidden");
    hideBanner(epRmBanner);
    return;
  }

  epRmTableCard.classList.add("hidden");
  hideBanner(epRmBanner);
  showBanner(epRmBanner, "info", "Building effective RM spec preview...");

  const { data, error } = await labSupabase.rpc(
    "fn_build_effective_rm_spec_for_item",
    {
      p_stock_item_id: Number(stockItemId),
      p_as_of_date: todayISO(),
      p_remarks: "Preview build from Spec Profile Manager",
    },
  );

  if (error) {
    showBanner(
      epRmBanner,
      "error",
      "Could not build effective spec: " + error.message,
    );
    return;
  }

  const newProfileId = Number(data);
  if (!newProfileId) {
    showBanner(
      epRmBanner,
      "warn",
      "No effective spec could be resolved for this stock item.",
    );
    return;
  }

  hideBanner(epRmBanner);

  const { data: lines, error: linesErr } = await labSupabase
    .from("v_spec_profile_detail")
    .select(
      "spec_profile_id, seq_no, test_name, method_name, display_text, spec_type, spec_line_is_active",
    )
    .eq("spec_profile_id", newProfileId)
    .eq("spec_line_is_active", true)
    .order("seq_no");

  if (linesErr) {
    showBanner(
      epRmBanner,
      "error",
      "Could not load effective spec lines: " + linesErr.message,
    );
    return;
  }

  renderRmEffectivePreview(lines ?? []);
}

function renderRmEffectivePreview(rows) {
  epRmTableCard.classList.remove("hidden");
  epRmLineCount.textContent = `${rows.length} line${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) {
    epRmTableBody.innerHTML = `<tr><td colspan="6">
      <div class="spec-empty-state">
        <strong>No lines found</strong>
        The effective spec profile has no lines.
      </div></td></tr>`;
    return;
  }

  epRmTableBody.innerHTML = rows
    .map(
      (r) => `<tr>
      <td class="td-seq">${esc(String(r.seq_no ?? ""))}</td>
      <td class="td-test">${esc(r.test_name ?? "")}</td>
      <td class="td-method">${esc(r.method_name ?? "")}</td>
      <td class="td-spec">${esc(r.display_text ?? "")}</td>
      <td>${typeBadge(r.spec_type)}</td>
      <td class="td-active" style="text-align:center;color:var(--muted,#6b7280);">
        ${r.spec_line_is_active ? "Yes" : "No"}
      </td>
    </tr>`,
    )
    .join("");
}

// ── Shared utilities ──────────────────────────────────────────────────────────
function typeBadge(type) {
  const t = String(type ?? "").toLowerCase();
  if (t.includes("numeric"))
    return `<span class="type-badge type-badge-numeric">${esc(type)}</span>`;
  if (t.includes("text"))
    return `<span class="type-badge type-badge-text">${esc(type)}</span>`;
  if (t.includes("pass"))
    return `<span class="type-badge type-badge-passfail">${esc(type)}</span>`;
  return `<span class="type-badge type-badge-other">${esc(type ?? "")}</span>`;
}

function populateSelect(sel, rows, valKey, labelKey, placeholder) {
  sel.innerHTML =
    `<option value="">${esc(placeholder)}</option>` +
    rows
      .map(
        (r) =>
          `<option value="${esc(String(r[valKey]))}">${esc(r[labelKey] ?? "")}</option>`,
      )
      .join("");
}

function setMetaValue(el, val, isEmpty) {
  el.textContent = val;
  el.classList.toggle("not-set", isEmpty);
}

function formatDate(val) {
  if (!val) return "--";
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showBanner(el, type, msg) {
  el.className = `spec-info-banner ${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideBanner(el) {
  el.classList.add("hidden");
  el.textContent = "";
}

function toast(msg, type = "info", duration = 3500) {
  const container = document.getElementById("labToastContainer");
  const t = document.createElement("div");
  t.className = `lab-toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add("toast-fade-out");
    t.addEventListener("animationend", () => t.remove(), { once: true });
  }, duration);
}
