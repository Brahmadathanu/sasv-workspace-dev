/* eslint-env node */

const { randomUUID } = require("crypto");
const { extractPortalPage } = require("./extract-in-page");
const { collectPageSignals, classifyAuth, AUTH_OUTCOMES } = require("./auth-signals");
const {
  safePathFromUrl,
  childFrameOrigins,
  redactCapture,
} = require("./sensitive");
const { fingerprintsFor } = require("./fingerprint");
const { writeCaptureJson } = require("./persist");
const { ERROR_KINDS } = require("../errors");
const { shouldEnforceMainFrameUrl, assertAllowedUrl } = require("../origin-guard");

const CAPTURE_SCHEMA_VERSION = 1;
const ALLOWED_ORIGIN = "https://www.e-aushadhi.gov.in";

const BINDINGS = [
  { key: "permission_purpose", re: /permission\s*purpose/i },
  { key: "medicine_class", re: /medicine\s*class/i },
  { key: "dosage_form", re: /dosage\s*form/i },
  { key: "product_subtype", re: /product\s*subtype|sub\s*type/i },
  { key: "composition_title", re: /composition\s*title/i },
  { key: "diseases_conditions", re: /diseases?\s*(and|&)?\s*conditions?/i },
  { key: "restricted_declaration", re: /restricted|narcotic|schedule\s*e|bhang|opium/i },
  { key: "product_search", re: /product\s*name|search\s*product|find\s*product/i },
  { key: "ingredient_name", re: /ingredient\s*name|drug\s*name/i },
  { key: "scientific_name", re: /scientific\s*name|botanical/i },
  { key: "ingredient_type", re: /ingredient\s*type/i },
  { key: "ingredient_form", re: /ingredient\s*form/i },
  { key: "part_used", re: /part\s*used/i },
  { key: "quantity", re: /\bqty\b|quantity/i },
  { key: "measurement_unit", re: /measurement|unit/i },
  { key: "reference", re: /\breference\b/i },
  {
    key: "pharmacological_actions",
    test(control) {
      const id = String(control?.id || "");
      const name = String(control?.name || "");
      const label = String(control?.label || "");
      if (/^indications$/i.test(id) || /^indications$/i.test(name)) return true;
      const hay = `${label} ${id} ${name}`;
      return /pharmacological/i.test(hay) || /therapeutic\s+actions?/i.test(hay);
    },
  },
];

function isSkippableUrl(urlValue) {
  const raw = String(urlValue || "").trim();
  if (!raw || raw === "about:blank") return true;
  try {
    return new URL(raw).protocol === "about:";
  } catch {
    return false;
  }
}

function candidateBinding(control) {
  for (const spec of BINDINGS) {
    if (typeof spec.test === "function") {
      if (spec.test(control)) {
        return { key: spec.key, verification_status: "unverified" };
      }
      continue;
    }
    const hay = `${control.label || ""} ${control.id || ""} ${control.name || ""} ${control.text || ""}`;
    if (spec.re && spec.re.test(hay)) {
      return { key: spec.key, verification_status: "unverified" };
    }
  }
  return null;
}

function vocabKey(select) {
  const binding = candidateBinding(select);
  if (binding) return binding.key;
  return select.id || select.name || "unnamed-select";
}

function isPlaceholderOption(opt) {
  const value = String(opt?.value || "").trim();
  const label = String(opt?.label || "").trim().toLowerCase();
  if (!value) return true;
  if (value === "0" && /select|choose|--/.test(label)) return true;
  return false;
}

function buildVocabularies(selects) {
  return (selects || []).map((select) => {
    const options = Array.isArray(select.options) ? select.options : [];
    const meaningful = options.filter((opt) => !isPlaceholderOption(opt));
    const unresolved = select.select2_linked && meaningful.length === 0;
    return {
      control_key: vocabKey(select),
      select_id: select.id,
      select_name: select.name,
      multiple: select.multiple === true,
      select2_linked: select.select2_linked === true,
      option_source: unresolved ? "unresolved-async" : select.option_source || "native-dom",
      unresolved_async: unresolved,
      options: options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        selected: opt.selected === true,
        disabled: opt.disabled === true,
      })),
      selector_candidate: select.selector_candidate,
      verification_status: "unverified",
    };
  });
}

function mutationKind(control) {
  const hay = `${control.text || ""} ${control.id || ""} ${control.name || ""} ${control.type || ""} ${control.label || ""}`;
  if (/\bsave\b/i.test(hay)) return "save";
  if (/\bupdate\b/i.test(hay)) return "update";
  if (/\bsubmit\b/i.test(hay) || String(control.type || "").toLowerCase() === "submit") return "submit";
  if (/\b(add\s*row|add\s*ingredient|new\s*row)\b/i.test(hay)) return "composition_add";
  if (/\b(delete|remove)\b/i.test(hay)) return "composition_remove";
  return null;
}

function saveUpdateStructure(pageExtract, forms) {
  const identified = [];
  for (const control of [...(pageExtract.buttons || []), ...(pageExtract.anchors || [])]) {
    const kind = mutationKind(control);
    if (!kind || (kind !== "save" && kind !== "update" && kind !== "submit")) continue;
    const form = (forms || []).find((item) => item.id && item.id === control.form_id) || null;
    identified.push({
      kind,
      tag: control.tag,
      id: control.id,
      name: control.name,
      type: control.type,
      text: control.text || control.label,
      form_id: control.form_id || null,
      form_method: form?.method || null,
      form_action_path: form?.action_path || null,
      verification_status: "unverified",
      activated: false,
    });
  }
  return identified;
}

function compositionStructure(pageExtract) {
  const tables = (pageExtract.tables || []).filter((table) => {
    const headers = (table.headers || []).join(" ").toLowerCase();
    return /ingredient|composition|scientific|part\s*used/.test(headers);
  });
  const fields = (pageExtract.inputs || [])
    .concat(pageExtract.selects || [])
    .concat(pageExtract.textareas || [])
    .map((control) => {
      const binding = candidateBinding(control);
      if (
        binding &&
        [
          "ingredient_name",
          "scientific_name",
          "ingredient_type",
          "ingredient_form",
          "part_used",
          "quantity",
          "measurement_unit",
          "reference",
        ].includes(binding.key)
      ) {
        return {
          binding: binding.key,
          id: control.id,
          name: control.name,
          tag: control.tag,
          selector_candidate: control.selector_candidate,
          verification_status: "unverified",
        };
      }
      return null;
    })
    .filter(Boolean);
  const mutationControls = (pageExtract.buttons || [])
    .map((control) => {
      const kind = mutationKind(control);
      if (kind !== "composition_add" && kind !== "composition_remove" && kind !== "save") return null;
      return {
        kind,
        id: control.id,
        name: control.name,
        text: control.text,
        activated: false,
      };
    })
    .filter(Boolean);
  return {
    tables,
    fields,
    mutation_controls: mutationControls,
    verification_status: "unverified",
  };
}

function lookupStructure(pageExtract) {
  const search = (pageExtract.inputs || []).filter((item) => {
    const binding = candidateBinding(item);
    return binding?.key === "product_search" || /search/i.test(`${item.id || ""} ${item.name || ""} ${item.label || ""}`);
  });
  const searchButtons = (pageExtract.buttons || []).filter((item) =>
    /\bsearch\b/i.test(`${item.text || ""} ${item.id || ""} ${item.name || ""}`),
  );
  const editControls = [...(pageExtract.buttons || []), ...(pageExtract.anchors || [])].filter((item) =>
    /\b(edit|update|modify)\b/i.test(`${item.text || ""} ${item.label || ""} ${item.id || ""}`),
  );
  return {
    search_inputs: search.map((item) => ({
      id: item.id,
      name: item.name,
      label: item.label,
      selector_candidate: item.selector_candidate,
      verification_status: "unverified",
    })),
    search_buttons: searchButtons.map((item) => ({
      id: item.id,
      text: item.text,
      activated: false,
    })),
    result_tables: pageExtract.tables || [],
    edit_or_update_entry: editControls.map((item) => ({
      tag: item.tag,
      id: item.id,
      text: item.text || item.label,
      href_path: item.href_path || null,
      activated: false,
      verification_status: "unverified",
    })),
  };
}

function attachBindings(controls) {
  return (controls || []).map((control) => ({
    ...control,
    candidate_binding: candidateBinding(control),
  }));
}

function pageUrl(page) {
  if (typeof page.url === "function") return page.url();
  return "";
}

async function inspectPage(page, contract) {
  const url = pageUrl(page);
  if (isSkippableUrl(url) || !shouldEnforceMainFrameUrl(url)) return null;
  let origin;
  try {
    origin = assertAllowedUrl(url, contract);
  } catch (error) {
    if (error?.kind === ERROR_KINDS.DISALLOWED_ORIGIN) {
      error.details = { ...(error.details || {}), url };
    }
    throw error;
  }
  if (typeof page.evaluate !== "function") {
    throw new Error("Capture page is missing evaluate.");
  }
  const extracted = await page.evaluate(extractPortalPage);
  const selects = attachBindings(extracted.selects);
  const inputs = attachBindings(extracted.inputs);
  const textareas = attachBindings(extracted.textareas);
  const buttons = attachBindings(extracted.buttons);
  const pageBody = {
    origin,
    path: safePathFromUrl(url),
    title: extracted.title || null,
    forms: extracted.forms || [],
    inputs,
    textareas,
    selects,
    buttons,
    anchors: extracted.anchors || [],
    tables: extracted.tables || [],
    child_frame_origins: childFrameOrigins(page),
    lookup: lookupStructure({ ...extracted, inputs, buttons, selects }),
    composition_structure: compositionStructure({
      ...extracted,
      inputs,
      selects,
      textareas,
      buttons,
    }),
    save_update_structure: saveUpdateStructure({ ...extracted, buttons }, extracted.forms),
    vocabularies: buildVocabularies(selects),
    auth: collectPageSignals({ ...extracted, inputs, buttons, selects, textareas, anchors: extracted.anchors }),
  };
  return pageBody;
}

function flattenSelects(pages) {
  const vocabularies = [];
  const pharmacological = [];
  const reference = [];
  for (const page of pages) {
    for (const vocab of page.vocabularies || []) {
      vocabularies.push({ ...vocab, page_path: page.path });
      if (vocab.control_key === "pharmacological_actions") {
        pharmacological.push({ ...vocab, page_path: page.path });
      }
      if (vocab.control_key === "reference") {
        reference.push({ ...vocab, page_path: page.path });
      }
    }
  }
  return { vocabularies, pharmacological, reference };
}

async function captureOpenPages({ context, contract, userDataPath, workerStateBefore }) {
  const pages = typeof context.pages === "function" ? context.pages() : [];
  const inspected = [];
  const skipped = [];
  const warnings = [];
  for (const page of pages) {
    const result = await inspectPage(page, contract);
    if (!result) continue;
    inspected.push(result);
  }

  const auth = classifyAuth(inspected);
  warnings.push(...(auth.warnings || []));
  const flat = flattenSelects(inspected);
  for (const vocab of flat.vocabularies) {
    if (vocab.unresolved_async) {
      warnings.push(`UNRESOLVED_ASYNC options for ${vocab.control_key || vocab.select_id || "select"}`);
    }
  }

  const captureId = randomUUID();
  const draft = {
    capture_schema_version: CAPTURE_SCHEMA_VERSION,
    capture_id: captureId,
    captured_at: new Date().toISOString(),
    portal_origin: ALLOWED_ORIGIN,
    worker_state_before: workerStateBefore || null,
    auth_outcome: auth.outcome,
    auth_evidence: {
      negative: auth.negative,
      positive: auth.positive,
      proposed_auth_probe: auth.proposed_auth_probe,
    },
    pages: inspected.map((page) => ({
      origin: page.origin,
      path: page.path,
      title: page.title,
      forms: page.forms,
      inputs: page.inputs,
      textareas: page.textareas,
      selects: page.selects,
      buttons: page.buttons,
      anchors: page.anchors,
      tables: page.tables,
      child_frame_origins: page.child_frame_origins,
      lookup: page.lookup,
      composition_structure: page.composition_structure,
      save_update_structure: page.save_update_structure,
      auth: page.auth,
    })),
    skipped_pages: skipped,
    navigation: inspected.flatMap((page) =>
      (page.anchors || []).map((anchor) => ({
        page_path: page.path,
        label: anchor.label,
        tag: anchor.tag,
        id: anchor.id,
        name: anchor.name,
        href_path: anchor.href_path,
        target: anchor.target,
        role: anchor.role,
        has_js_handler: anchor.has_js_handler === true,
        activation_risk: anchor.activation_risk,
      })),
    ),
    vocabularies: flat.vocabularies,
    pharmacological_actions: flat.pharmacological,
    reference: flat.reference,
    composition_structure: inspected.map((page) => page.composition_structure),
    save_update_structure: inspected.flatMap((page) => page.save_update_structure),
    proposed_selectors: inspected.flatMap((page) =>
      [...(page.inputs || []), ...(page.selects || []), ...(page.buttons || [])]
        .filter((item) => item.selector_candidate?.selector)
        .map((item) => ({
          binding: item.candidate_binding?.key || null,
          selector_candidate: item.selector_candidate,
          verification_status: "unverified",
        })),
    ),
    warnings,
    mutated: false,
    clicks_performed: [],
    worker_actions: {
      goto: 0,
      click: 0,
      fill: 0,
      type: 0,
      press: 0,
      selectOption: 0,
      setInputFiles: 0,
      submit: 0,
    },
  };

  const persisted = redactCapture(draft);
  persisted.fingerprints = fingerprintsFor(persisted);
  const captureDir = writeCaptureJson(userDataPath, captureId, persisted);

  return {
    capture: persisted,
    captureDir,
    summary: {
      ok: true,
      operation: "contract-capture",
      capture_id: captureId,
      auth_outcome: persisted.auth_outcome,
      pages_inspected: inspected.length,
      native_selects: flat.vocabularies.length,
      option_count: flat.vocabularies.reduce((sum, vocab) => sum + (vocab.options || []).length, 0),
      warnings: persisted.warnings || [],
      fingerprints: persisted.fingerprints,
      mutated: false,
      folder_name: captureId,
    },
  };
}

module.exports = {
  CAPTURE_SCHEMA_VERSION,
  AUTH_OUTCOMES,
  captureOpenPages,
  buildVocabularies,
  classifyAuth,
};
