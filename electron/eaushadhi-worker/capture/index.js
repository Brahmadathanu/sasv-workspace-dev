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
const { summarizeContractEvidence } = require("./contract-evidence");
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
  { key: "product_name", test(control) {
      return /^name$/i.test(String(control?.id || "")) || /^name$/i.test(String(control?.name || ""));
    } },
  { key: "product_type", test(control) {
      return /^type$/i.test(String(control?.id || "")) || /product\s*type/i.test(`${control?.label || ""} ${control?.name || ""}`);
    } },
  { key: "product_category", test(control) {
      return /^categoryId$/i.test(String(control?.id || "")) || /category/i.test(`${control?.label || ""} ${control?.id || ""}`);
    } },
  { key: "shelf_life", re: /\bmonth\b|shelf\s*life/i },
  { key: "country_applicable", re: /country\s*applicable|countryApplicable/i },
  { key: "country", re: /countryId|#country\b/i },
  { key: "approved_product_copy", re: /uploadAttachment|applicantFile|approved\s*product\s*copy|upload/i },
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

const PLACEHOLDER_SENTINELS = new Set(["", "0", "-1"]);
const PLACEHOLDER_LABEL =
  /^(?:--\s*)?(?:select(?:\s+option)?|choose(?:\s+option)?)(?:\s*--)?$/i;

function isPlaceholderOption(opt) {
  const value = String(opt?.value ?? "").trim();
  const label = String(opt?.label || "").replace(/\s+/g, " ").trim();
  if (!PLACEHOLDER_SENTINELS.has(value)) return false;
  return PLACEHOLDER_LABEL.test(label);
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

function classifyActionCandidate(control) {
  const hay = `${control.text || ""} ${control.id || ""} ${control.name || ""} ${control.label || ""}`.toLowerCase();
  const typeSubmit = String(control.type || "").toLowerCase() === "submit";
  const hasSave = /\bsave\b/.test(hay);
  const hasUpdate = /\bupdate\b/.test(hay);
  const hasSubmitWord = /\bsubmit\b/.test(hay);
  const hasShell =
    /\b(create\s+product|add\s+product|new\s+product)\b/.test(hay) &&
    !/\badd\s*row\b/.test(hay);
  if (hasSave) {
    return {
      action_candidate: "save",
      note: hasSubmitWord || typeSubmit
        ? "Save control may also be type=submit or labelled Submit; not proven as shell-create or final Submit."
        : null,
    };
  }
  if (hasUpdate && !hasSave) {
    return { action_candidate: "update", note: null };
  }
  if (hasShell) {
    return { action_candidate: "shellCreate", note: "Create/add-product wording observed; not clicked." };
  }
  if (hasSubmitWord || typeSubmit) {
    return {
      action_candidate: "unknown",
      note: "Submit-labelled or type=submit control is not distinguished as shell-create, save, update, or final Submit.",
    };
  }
  return { action_candidate: "unknown", note: "Mutation control role is unknown." };
}

function saveUpdateStructure(pageExtract, forms) {
  const identified = [];
  for (const control of [...(pageExtract.buttons || []), ...(pageExtract.anchors || [])]) {
    const kind = mutationKind(control);
    if (!kind || (kind !== "save" && kind !== "update" && kind !== "submit")) continue;
    const form = (forms || []).find((item) => item.id && item.id === control.form_id) || null;
    identified.push({
      kind,
      action_candidate: classifyActionCandidate(control).action_candidate,
      action_note: classifyActionCandidate(control).note,
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
  const pagination = [...(pageExtract.buttons || []), ...(pageExtract.anchors || [])].filter((item) =>
    /\b(next|prev|previous|page)\b/i.test(`${item.text || ""} ${item.label || ""} ${item.id || ""}`),
  );
  const editControls = [...(pageExtract.buttons || []), ...(pageExtract.anchors || [])].filter((item) =>
    /\b(edit|update|modify|open)\b/i.test(`${item.text || ""} ${item.label || ""} ${item.id || ""}`),
  );
  const tables = pageExtract.tables || [];
  const nameHeaders = tables.some((table) =>
    (table.headers || []).some((header) => /name|product/i.test(String(header))),
  );
  const identityHeaders = tables.some((table) =>
    (table.headers || []).some((header) => /\b(id|code|ref|sno|sl\.?\s*no)\b/i.test(String(header))),
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
    result_tables: tables.map((table) => ({
      ...table,
      name_cell_samples: table.name_cell_samples || [],
    })),
    pagination: pagination.map((item) => ({
      tag: item.tag,
      id: item.id,
      text: item.text || item.label,
      activated: false,
    })),
    edit_or_update_entry: editControls.map((item) => ({
      tag: item.tag,
      id: item.id,
      text: item.text || item.label,
      href_path: item.href_path || null,
      activated: false,
      verification_status: "unverified",
    })),
    duplicate_name_distinguishability: {
      status: "unresolved",
      name_column_observed: nameHeaders,
      distinct_row_identity_observed: identityHeaders,
      note: identityHeaders
        ? "A row identity header was observed; duplicate exact names are not proven distinguishable without live duplicates."
        : "No stable row identity header was proven; duplicate exact names cannot be distinguished yet.",
    },
  };
}

function productDetailsObservation(pageExtract) {
  const wanted = new Set([
    "name",
    "type",
    "categoryId",
    "subTypeId",
    "permissionPurpose",
    "disease",
    "indications",
    "drug_yes",
    "drug_no",
    "drugsValue",
    "month",
    "countryApplicable",
    "countryId",
    "compositionTitle",
  ]);
  const controls = [...(pageExtract.inputs || []), ...(pageExtract.selects || []), ...(pageExtract.textareas || [])]
    .filter((item) => wanted.has(String(item.id || "")))
    .map((item) => ({
      id: item.id,
      tag: item.tag,
      type: item.type,
      multiple: item.multiple === true,
      select2_linked: item.select2_linked === true,
      option_count: Array.isArray(item.options) ? item.options.length : null,
      selected_options: Array.isArray(item.options)
        ? item.options.filter((opt) => opt.selected === true).map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))
        : null,
      checked: item.checked,
      selector_candidate: item.selector_candidate,
      observed: true,
      mutated: false,
    }));
  const typeControl = controls.find((item) => item.id === "type");
  const ayurvedicProprietary = (typeControl?.selected_options || []).some((opt) =>
    /ayurvedic\s+proprietary/i.test(String(opt.label || "")),
  );
  const typeHasAyurvedicOption = (pageExtract.selects || [])
    .filter((item) => item.id === "type")
    .some((select) =>
      (select.options || []).some((opt) => /ayurvedic\s+proprietary/i.test(String(opt.label || ""))),
    );
  return {
    controls,
    ayurvedic_proprietary_type_option_present: typeHasAyurvedicOption,
    ayurvedic_proprietary_currently_selected: ayurvedicProprietary,
    category_subtype_dependency: "unresolved",
    note: "Selections were observed only. Capture does not change Product Type, Category, or Subtype.",
  };
}

function evidenceStructure(pageExtract) {
  const uploads = (pageExtract.inputs || []).filter(
    (item) =>
      String(item.type || "").toLowerCase() === "file" ||
      /uploadAttachment|applicantFile/i.test(`${item.id || ""} ${item.name || ""}`),
  );
  return {
    upload_controls: uploads.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      accept: item.accept || null,
      label: item.label,
      selector_candidate: item.selector_candidate,
      rereadable_filename: "unresolved",
      activated: false,
    })),
    verification_status: "unverified",
  };
}

function rereadStructure(pageExtract) {
  const locations = [];
  const map = [
    ["product_details", ["name", "type", "categoryId", "subTypeId", "permissionPurpose", "compositionTitle"]],
    ["diseases", ["disease"]],
    ["actions", ["indications"]],
    ["composition", []],
    ["evidence", ["uploadAttachment", "applicantFile"]],
  ];
  const byId = new Map(
    [...(pageExtract.inputs || []), ...(pageExtract.selects || []), ...(pageExtract.textareas || [])].map((item) => [
      String(item.id || ""),
      item,
    ]),
  );
  for (const [group, ids] of map) {
    const found = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((item) => ({ id: item.id, tag: item.tag, selector_candidate: item.selector_candidate }));
    locations.push({
      group,
      status: found.length || group === "composition" ? "unresolved" : "unresolved",
      controls: found,
    });
  }
  return { locations, verification_status: "unverified" };
}

function shellCreationStructure(pageExtract, forms) {
  const buttons = [...(pageExtract.buttons || []), ...(pageExtract.anchors || [])].map((control) => {
    const classified = classifyActionCandidate(control);
    return {
      id: control.id,
      text: control.text || control.label,
      type: control.type,
      form_id: control.form_id || null,
      action_candidate: classified.action_candidate,
      action_note: classified.note,
      activated: false,
    };
  });
  return {
    forms: forms || [],
    buttons,
    verification_status: "unverified",
    note: "No shell-create control was clicked.",
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
    product_details_observation: productDetailsObservation({
      ...extracted,
      inputs,
      selects,
      textareas,
    }),
    evidence_structure: evidenceStructure({ ...extracted, inputs }),
    reread_structure: rereadStructure({ ...extracted, inputs, selects, textareas }),
    shell_creation_structure: shellCreationStructure({ ...extracted, buttons }, extracted.forms),
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
      product_details_observation: page.product_details_observation,
      evidence_structure: page.evidence_structure,
      reread_structure: page.reread_structure,
      shell_creation_structure: page.shell_creation_structure,
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
    product_details_observation: inspected.map((page) => page.product_details_observation),
    evidence_structure: inspected.map((page) => page.evidence_structure),
    reread_structure: inspected.map((page) => page.reread_structure),
    shell_creation_structure: inspected.map((page) => page.shell_creation_structure),
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
  persisted.contract_evidence = summarizeContractEvidence(persisted);
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
  isPlaceholderOption,
  classifyAuth,
  classifyActionCandidate,
};
