/* eslint-env node */

const {
  MUTATION_CLASS,
  MAX_SOURCE_BYTES,
  analyzeSourceText,
  assessShellCreateEvidence,
  bucketRequests,
  dedupeLifecycleRequests,
  classifyStaticScriptAcquisitionUrl,
  boundSanitize,
  sha256Text,
} = require("./source-analyzer");

const MAX_STATIC_SCRIPTS = 8;
const MAX_STATIC_BYTES = MAX_SOURCE_BYTES;

function emptyLifecycleEvidence(extraLimitations = []) {
  return {
    schema_version: 1,
    page_path: null,
    controls: [],
    functions: [],
    requests: [],
    shell_create_candidates: [],
    lookup_candidates: [],
    existing_record_load_candidates: [],
    composition_candidates: [],
    update_candidates: [],
    final_submit_candidates: [],
    reread_candidates: [],
    shell_create_proof: {
      status: "unresolved",
      criteria: {},
      missing_criteria: [
        "initiating_control",
        "handler_function",
        "endpoint",
        "http_method",
        "payload_construction",
        "actiontype_or_mode_semantics",
        "success_failure_handling",
        "product_identifier_handling",
        "subsequent_edit_update_state",
        "subsequent_composition_availability",
        "distinguished_from_terminal_submit",
      ],
      note: "Lifecycle extract missing.",
    },
    script_inventory: [],
    limitations: [
      "lifecycle_evidence_extract_missing",
      ...extraLimitations,
    ],
    verification_status: "unverified",
    activated: false,
    requests_executed: [],
  };
}

function finalizeFunctionEntry(rawFn, analysis) {
  return {
    name: rawFn?.name || analysis?.name || null,
    source_kind: rawFn?.source_kind || analysis?.source_kind || null,
    control_id: rawFn?.control_id || null,
    found: rawFn?.found !== false,
    source_capture_status: rawFn?.source_capture_status || null,
    source_length: typeof rawFn?.source_length === "number" ? rawFn.source_length : analysis?.source_length ?? null,
    source_truncated: rawFn?.source_truncated === true || analysis?.source_truncated === true,
    source_sha256: analysis?.source_sha256 || null,
    hash_scope: analysis?.hash_scope || null,
    contexts: (analysis?.contexts || []).slice(0, 12),
    named_functions_observed: analysis?.named_functions || [],
  };
}

/**
 * Node finalize: analyze transferred sources, drop raw bodies, classify requests.
 * Does not invoke portal functions or business endpoints.
 */
function finalizeLifecycleContractEvidence(raw) {
  if (!raw || typeof raw !== "object") {
    return emptyLifecycleEvidence();
  }

  const controls = (Array.isArray(raw.controls) ? raw.controls : []).map((item) => ({
    selector: item?.selector || null,
    id: item?.id || null,
    name: item?.name || null,
    tag: item?.tag || null,
    type: item?.type || null,
    text: item?.text ? boundSanitize(item.text, 120) : null,
    value_or_href_metadata: item?.value_or_href_metadata
      ? boundSanitize(item.value_or_href_metadata, 180)
      : null,
    onclick_present: item?.onclick_present === true,
    onclick_preview: item?.onclick_preview ? boundSanitize(item.onclick_preview, 240) : null,
    form_id: item?.form_id || null,
    form_action: item?.form_action || null,
    form_method: item?.form_method || null,
    disabled: item?.disabled === true,
    visible: item?.visible !== false,
    candidate_role: item?.candidate_role || "unknown",
    activated: false,
  }));

  const functions = [];
  const requests = [];
  const compositionObservations = [];
  const limitations = new Set(Array.isArray(raw.limitations) ? raw.limitations : []);

  for (const rawFn of Array.isArray(raw.functions_raw) ? raw.functions_raw : []) {
    const body = typeof rawFn.function_source_raw === "string" ? rawFn.function_source_raw : "";
    const analysis = body
      ? analyzeSourceText(body, {
          name: rawFn.name,
          source_function: rawFn.name,
          source_kind: rawFn.source_kind || "window_tostring",
        })
      : {
          name: rawFn.name,
          source_kind: rawFn.source_kind || "window_tostring",
          source_length: rawFn.source_length,
          source_truncated: rawFn.source_truncated === true,
          source_sha256: null,
          hash_scope: null,
          contexts: [],
          named_functions: [],
          requests: [],
          composition_observations: [],
          limitations: ["function_source_unavailable"],
        };
    for (const lim of analysis.limitations || []) limitations.add(lim);
    functions.push(finalizeFunctionEntry(rawFn, analysis));
    for (const req of analysis.requests || []) requests.push(req);
    for (const obs of analysis.composition_observations || []) compositionObservations.push(obs);
  }

  for (const inline of Array.isArray(raw.inline_sources) ? raw.inline_sources : []) {
    const body = typeof inline.function_source_raw === "string" ? inline.function_source_raw : "";
    if (!body) continue;
    const analysis = analyzeSourceText(body, {
      name: `inline_script_${inline.script_index}`,
      source_function: `inline_script_${inline.script_index}`,
      source_kind: "inline_script",
    });
    for (const lim of analysis.limitations || []) limitations.add(lim);
    functions.push(
      finalizeFunctionEntry(
        {
          name: `inline_script_${inline.script_index}`,
          source_kind: "inline_script",
          source_capture_status: inline.source_truncated ? "captured_truncated" : "captured",
          source_length: inline.source_length,
          source_truncated: inline.source_truncated === true,
        },
        analysis,
      ),
    );
    for (const req of analysis.requests || []) requests.push(req);
    for (const obs of analysis.composition_observations || []) compositionObservations.push(obs);
  }

  const script_inventory = (Array.isArray(raw.scripts) ? raw.scripts : []).map((item) => ({
    script_index: item?.script_index ?? null,
    source_kind: item?.source_kind || null,
    src_path: item?.src_path || null,
    src_url_for_acquisition: item?.src_url_for_acquisition || null,
    acquisition_status: item?.acquisition_status || "unresolved",
    source_length: typeof item?.source_length === "number" ? item.source_length : null,
    source_truncated: item?.source_truncated === true,
    source_sha256: item?.source_sha256 || null,
  }));

  const dedupedRequests = dedupeLifecycleRequests(requests);
  const buckets = bucketRequests(dedupedRequests, compositionObservations);
  const shell_create_proof = assessShellCreateEvidence({
    controls,
    functions,
    requests: dedupedRequests,
  });

  limitations.add("contract_completeness_not_flipped");
  limitations.add("candidates_classified_not_executed");

  return {
    schema_version: 1,
    page_path: raw.page_path || null,
    controls,
    functions,
    requests: dedupedRequests.slice(0, 40),
    ...buckets,
    shell_create_proof,
    script_inventory,
    limitations: Array.from(limitations),
    verification_status: "unverified",
    activated: false,
    requests_executed: Array.isArray(raw.requests_executed) ? raw.requests_executed : [],
  };
}

/**
 * Optional same-origin static JS acquisition for already-inventoried script URLs.
 * GET only, static .js paths only, never business admin endpoints.
 * Uses Playwright APIRequestContext when available; otherwise marks unresolved.
 */
async function enrichLifecycleWithStaticScripts(page, evidence, pageOrigin) {
  if (!evidence || typeof evidence !== "object") return evidence;
  const inventory = Array.isArray(evidence.script_inventory) ? evidence.script_inventory : [];
  if (!inventory.length) return evidence;

  const requestGet = page && page.request && typeof page.request.get === "function" ? page.request.get.bind(page.request) : null;
  const limitations = new Set(evidence.limitations || []);
  const functions = [...(evidence.functions || [])];
  const requests = [...(evidence.requests || [])];
  const compositionObservations = [
    ...((evidence.composition_candidates || []).filter((item) => item && item.candidate_kind === "source_link_or_handler")),
  ];
  let acquired = 0;

  for (const item of inventory) {
    if (item.source_kind !== "external") continue;
    if (acquired >= MAX_STATIC_SCRIPTS) {
      item.acquisition_status = "skipped_cap";
      continue;
    }
    const verdict = classifyStaticScriptAcquisitionUrl(item.src_url_for_acquisition || item.src_path, pageOrigin);
    if (!verdict.ok) {
      item.acquisition_status = "unresolved";
      item.acquisition_reason = verdict.reason;
      limitations.add(`static_script_unresolved:${verdict.reason}`);
      continue;
    }
    if (!requestGet) {
      item.acquisition_status = "unresolved";
      item.acquisition_reason = "request_api_unavailable";
      limitations.add("static_script_request_api_unavailable");
      continue;
    }
    try {
      const response = await requestGet(verdict.url, { maxRedirects: 0, timeout: 8000 });
      const status = typeof response.status === "function" ? response.status() : response.status;
      if (status !== 200) {
        item.acquisition_status = "unresolved";
        item.acquisition_reason = `http_${status}`;
        continue;
      }
      const text = typeof response.text === "function" ? await response.text() : "";
      const body = String(text || "");
      item.source_length = body.length;
      item.source_truncated = body.length > MAX_STATIC_BYTES;
      const analyzedBody = item.source_truncated ? body.slice(0, MAX_STATIC_BYTES) : body;
      item.source_sha256 = item.source_truncated ? null : sha256Text(body);
      item.acquisition_status = item.source_truncated ? "acquired_truncated" : "acquired";
      item.src_path = verdict.path;
      // Drop full acquisition URL with any residual query by keeping path only.
      item.src_url_for_acquisition = null;

      const analysis = analyzeSourceText(analyzedBody, {
        name: `static_script:${verdict.path}`,
        source_function: `static_script:${verdict.path}`,
        source_kind: "same_origin_static_js",
      });
      for (const lim of analysis.limitations || []) limitations.add(lim);
      functions.push({
        name: `static_script:${verdict.path}`,
        source_kind: "same_origin_static_js",
        control_id: null,
        found: true,
        source_capture_status: item.acquisition_status,
        source_length: analysis.source_length,
        source_truncated: analysis.source_truncated,
        source_sha256: analysis.source_sha256,
        hash_scope: analysis.hash_scope,
        contexts: analysis.contexts,
        named_functions_observed: analysis.named_functions,
      });
      for (const req of analysis.requests || []) requests.push(req);
      for (const obs of analysis.composition_observations || []) compositionObservations.push(obs);
      acquired += 1;
    } catch {
      item.acquisition_status = "unresolved";
      item.acquisition_reason = "acquisition_error";
      limitations.add("static_script_acquisition_error");
    }
  }

  const dedupedRequests = dedupeLifecycleRequests(requests);
  const buckets = bucketRequests(dedupedRequests, compositionObservations);
  const shell_create_proof = assessShellCreateEvidence({
    controls: evidence.controls,
    functions,
    requests: dedupedRequests,
  });

  return {
    ...evidence,
    functions,
    requests: dedupedRequests.slice(0, 40),
    ...buckets,
    shell_create_proof,
    script_inventory: inventory,
    limitations: Array.from(limitations),
  };
}

module.exports = {
  MUTATION_CLASS,
  emptyLifecycleEvidence,
  finalizeLifecycleContractEvidence,
  enrichLifecycleWithStaticScripts,
};
