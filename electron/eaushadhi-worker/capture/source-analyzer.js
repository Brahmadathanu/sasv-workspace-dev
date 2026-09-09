/* eslint-env node */

/**
 * Non-executing source analyzer for e-Aushadhi lifecycle contract evidence.
 * Never invokes functions, never issues network requests.
 */

const { createHash } = require("crypto");
const { sanitizeText } = require("../diagnostics");

const MUTATION_CLASS = Object.freeze({
  READ_ONLY_PROVEN: "READ_ONLY_PROVEN",
  MUTATING_CANDIDATE: "MUTATING_CANDIDATE",
  TERMINAL_CANDIDATE: "TERMINAL_CANDIDATE",
  UNKNOWN: "UNKNOWN",
});

const MAX_SOURCE_BYTES = 262144;
const MAX_FUNCTIONS = 24;
const MAX_REQUESTS = 40;
const MAX_CONTEXTS_PER_TERM = 4;
const CONTEXT_BEFORE = 160;
const CONTEXT_AFTER = 160;
const SNIPPET_MAX = 240;
const URL_EXPR_MAX = 240;
const DATA_EXPR_MAX = 320;

const SCAN_TERMS = Object.freeze([
  "SaveData",
  "save",
  "update",
  "Submit",
  "submit",
  "productlid",
  "productId",
  "actiontype",
  "LoadProductDataforLegacy",
  "viewproducttbllegacy",
  "composition",
  "ingredient",
  "edit",
  "delete",
  "final",
  "approve",
  "approval",
  "refer",
  "legacy",
  "getsubtypeName",
]);

const NAMED_FUNCTION_RE =
  /function\s+([A-Za-z_$][\w$]*)\s*\(|([A-Za-z_$][\w$]*)\s*=\s*function\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*\(|\([^)]*\)\s*=>)/g;

function sha256Text(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function boundSanitize(value, max) {
  return sanitizeText(String(value || ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function stripUrlToPath(urlValue) {
  const raw = String(urlValue || "").trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname || null;
    }
  } catch {
    /* fall through */
  }
  const noHash = raw.split("#")[0];
  const noQuery = noHash.split("?")[0];
  return noQuery || null;
}

function isBusinessApiPath(pathValue) {
  const path = String(pathValue || "").toLowerCase();
  return /\/admin\/(?:get|save|update|submit|add|delete|insert|upload|create)/.test(path) &&
    !/\/admin\/getsubtypename\b/.test(path);
}

function isStaticScriptPath(pathValue) {
  const path = String(pathValue || "").toLowerCase();
  if (!/\.js$/i.test(path)) return false;
  if (isBusinessApiPath(path)) return false;
  return /\/db_static\/|\/static\/|\/assets\/|\/js\//.test(path) || /\.js$/i.test(path);
}

/**
 * Classify a request/control candidate from source semantics.
 * GET alone never yields READ_ONLY_PROVEN.
 */
function classifyMutation({
  method = null,
  urlExpression = "",
  staticPath = null,
  payloadExpression = "",
  responseUsage = "",
  surroundingContext = "",
  sourceFunction = "",
} = {}) {
  const methodNorm = method ? String(method).toUpperCase() : null;
  const pathHay = [sourceFunction, urlExpression, staticPath, payloadExpression]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
  const hay = [pathHay, responseUsage, surroundingContext]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");

  const basis = [];

  if (
    /\bfinal\s*submit\b/.test(hay) ||
    /\bforward\s*for\s*approval\b/.test(hay) ||
    /\bapprov(?:e|al)\b/.test(hay) && /\b(submit|final|lock|forward)\b/.test(hay) ||
    /\birreversible\b/.test(hay) ||
    /\bfinaliz(?:e|ation)\b/.test(hay) ||
    /\block(?:ed|ing)?\s+record\b/.test(hay)
  ) {
    basis.push("terminal_language");
    return { mutation_classification: MUTATION_CLASS.TERMINAL_CANDIDATE, evidence_basis: basis };
  }

  const mutatingHints =
    /\bsavedata\b/.test(hay) ||
    /\bactiontype\b/.test(hay) && /\b(save|add|create|insert|update|delete|submit)\b/.test(hay) ||
    /\b(save|update|delete|upload|insert|create)\b/.test(pathHay) &&
      !/\b(load|list|view|search|find|read)\b/.test(pathHay) ||
    methodNorm === "POST" &&
      /\/admin\//.test(pathHay) &&
      !/\b(getsubtype|get[a-z]*name|list|load|view|search|find)\b/.test(pathHay);

  if (mutatingHints) {
    if (/\bsavedata\b/.test(hay)) basis.push("SaveData_reference");
    if (/\bactiontype\b/.test(hay)) basis.push("actiontype_semantics");
    if (methodNorm === "POST") basis.push("http_post");
    if (/\b(save|update|delete|upload|insert|create|submit)\b/.test(hay)) basis.push("mutating_verb");
    return { mutation_classification: MUTATION_CLASS.MUTATING_CANDIDATE, evidence_basis: basis };
  }

  // Path/function semantics only — never treat a bare HTTP method token in ajax options as proof.
  const readHints =
    (/getsubtypename|loadproductdataforlegacy|viewproducttbllegacy/.test(pathHay) ||
      /\b(load|list|view|search|find|read)\b/.test(pathHay) ||
      /\/get[a-z0-9_-]*\b/.test(pathHay)) &&
    !/\b(save|update|delete|upload|insert|create|submit|approve)\b/.test(pathHay);

  if (readHints) {
    basis.push("read_semantic_verbs");
    if (methodNorm === "GET" || /\$\.get\b/.test(hay)) basis.push("get_with_read_semantics");
    if (/loadproductdataforlegacy|viewproducttbllegacy|getsubtypename/.test(pathHay)) {
      basis.push("known_read_endpoint_name");
    }
    return { mutation_classification: MUTATION_CLASS.READ_ONLY_PROVEN, evidence_basis: basis };
  }

  if (methodNorm === "GET") {
    basis.push("http_get_alone_insufficient");
    return { mutation_classification: MUTATION_CLASS.UNKNOWN, evidence_basis: basis };
  }

  basis.push("insufficient_source_semantics");
  return { mutation_classification: MUTATION_CLASS.UNKNOWN, evidence_basis: basis };
}

function collectTermContexts(source, terms = SCAN_TERMS) {
  const text = String(source || "");
  const out = [];
  for (const term of terms) {
    if (out.length >= MAX_FUNCTIONS * MAX_CONTEXTS_PER_TERM) break;
    let from = 0;
    let hits = 0;
    const needle = String(term);
    while (hits < MAX_CONTEXTS_PER_TERM) {
      const idx = text.indexOf(needle, from);
      if (idx < 0) break;
      const start = Math.max(0, idx - CONTEXT_BEFORE);
      const end = Math.min(text.length, idx + needle.length + CONTEXT_AFTER);
      out.push({
        term: needle,
        offset: idx,
        before: boundSanitize(text.slice(start, idx), CONTEXT_BEFORE),
        match: boundSanitize(text.slice(idx, idx + needle.length), 80),
        after: boundSanitize(text.slice(idx + needle.length, end), CONTEXT_AFTER),
        snippet: boundSanitize(text.slice(start, end), SNIPPET_MAX),
      });
      hits += 1;
      from = idx + needle.length;
    }
  }
  return out;
}

function extractNamedFunctions(source) {
  const text = String(source || "");
  const names = [];
  const seen = new Set();
  NAMED_FUNCTION_RE.lastIndex = 0;
  let match;
  while ((match = NAMED_FUNCTION_RE.exec(text)) && names.length < MAX_FUNCTIONS) {
    const name = match[1] || match[2] || match[3];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function pushRequest(list, partial) {
  if (list.length >= MAX_REQUESTS) return;
  const staticPath = partial.static_path || stripUrlToPath(partial.url_expression);
  const classified = classifyMutation({
    method: partial.method,
    urlExpression: partial.url_expression,
    staticPath,
    payloadExpression: partial.payload_expression,
    responseUsage: partial.response_usage,
    surroundingContext: partial.surrounding_context,
    sourceFunction: partial.source_function,
  });
  list.push({
    source_function: partial.source_function || null,
    url_expression: boundSanitize(partial.url_expression, URL_EXPR_MAX) || null,
    static_path: staticPath ? boundSanitize(staticPath, URL_EXPR_MAX) : null,
    method: partial.method ? String(partial.method).toUpperCase() : null,
    payload_expression: boundSanitize(partial.payload_expression, DATA_EXPR_MAX) || null,
    content_type: boundSanitize(partial.content_type, 120) || null,
    response_usage: boundSanitize(partial.response_usage, SNIPPET_MAX) || null,
    mutation_classification: classified.mutation_classification,
    evidence_basis: classified.evidence_basis,
  });
}

function extractAjaxBlockMeta(block) {
  const urlMatch = block.match(/\burl\s*:\s*(['"`])([^'"`]+)\1/) ||
    block.match(/\burl\s*:\s*([^\s,}+]+)/);
  const typeMatch =
    block.match(/\b(?:type|method)\s*:\s*(['"`])(GET|POST|PUT|DELETE|PATCH)\1/i) ||
    block.match(/\b(?:type|method)\s*:\s*(GET|POST|PUT|DELETE|PATCH)\b/i);
  const dataMatch = block.match(/\bdata\s*:\s*([^,}\n]+)/);
  const contentMatch = block.match(/\bcontentType\s*:\s*(['"`])([^'"`]+)\1/);
  const successMatch = block.match(/\bsuccess\s*:\s*function/);
  return {
    url_expression: urlMatch ? urlMatch[2] || urlMatch[1] : null,
    method: typeMatch ? (typeMatch[2] || typeMatch[1] || "").toUpperCase() : null,
    payload_expression: dataMatch ? dataMatch[1] : null,
    content_type: contentMatch ? contentMatch[2] : null,
    response_usage: successMatch ? "success_callback_present" : null,
  };
}

function extractRequestsFromSource(source, sourceFunction = null) {
  const text = String(source || "");
  const requests = [];

  const ajaxRe = /\$\.ajax\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  let match;
  while ((match = ajaxRe.exec(text)) && requests.length < MAX_REQUESTS) {
    const block = match[1] || "";
    const meta = extractAjaxBlockMeta(block);
    pushRequest(requests, {
      source_function: sourceFunction,
      surrounding_context: block.slice(0, 400),
      ...meta,
    });
  }

  const postRe = /\$\.post\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*([^)]*)\)/g;
  while ((match = postRe.exec(text)) && requests.length < MAX_REQUESTS) {
    pushRequest(requests, {
      source_function: sourceFunction,
      url_expression: match[2],
      method: "POST",
      payload_expression: match[3],
      surrounding_context: match[0].slice(0, 400),
    });
  }

  const getRe = /\$\.get\s*\(\s*(['"`])([^'"`]+)\1/g;
  while ((match = getRe.exec(text)) && requests.length < MAX_REQUESTS) {
    pushRequest(requests, {
      source_function: sourceFunction,
      url_expression: match[2],
      method: "GET",
      surrounding_context: match[0].slice(0, 400),
    });
  }

  const fetchRe = /fetch\s*\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*(\{[\s\S]*?\}))?\)/g;
  while ((match = fetchRe.exec(text)) && requests.length < MAX_REQUESTS) {
    const opts = match[3] || "";
    const methodMatch = opts.match(/\bmethod\s*:\s*(['"`])(GET|POST|PUT|DELETE|PATCH)\1/i);
    pushRequest(requests, {
      source_function: sourceFunction,
      url_expression: match[2],
      method: methodMatch ? methodMatch[2].toUpperCase() : "GET",
      payload_expression: opts.match(/\bbody\s*:/) ? "body_present" : null,
      surrounding_context: match[0].slice(0, 400),
    });
  }

  return requests;
}

function analyzeSourceText(source, meta = {}) {
  const original = String(source || "");
  const truncated = original.length > MAX_SOURCE_BYTES;
  const analyzed = truncated ? original.slice(0, MAX_SOURCE_BYTES) : original;
  const sourceFunction = meta.source_function || meta.name || null;
  const contexts = collectTermContexts(analyzed);
  const named = extractNamedFunctions(analyzed);
  const requests = extractRequestsFromSource(analyzed, sourceFunction);

  return {
    name: sourceFunction,
    source_kind: meta.source_kind || "provided_text",
    source_length: original.length,
    source_truncated: truncated,
    source_sha256: truncated ? null : sha256Text(original),
    hash_scope: truncated ? null : "full_source_text",
    named_functions: named,
    contexts: contexts.slice(0, MAX_CONTEXTS_PER_TERM * 8),
    requests,
    limitations: truncated ? ["source_truncated_at_analyzer_cap"] : [],
  };
}

function assessShellCreateEvidence(analysisBundle) {
  const functions = analysisBundle.functions || [];
  const requests = analysisBundle.requests || [];
  const controls = analysisBundle.controls || [];
  const allText = [
    ...functions.map((fn) => JSON.stringify(fn.contexts || [])),
    ...requests.map((req) => JSON.stringify(req)),
  ].join("\n");

  const hasInitiatingControl = controls.some(
    (c) =>
      c.candidate_role === "shell_create_candidate" ||
      c.candidate_role === "save_or_submit_ambiguous" ||
      /save_btn|save_rbtn/i.test(String(c.id || "")),
  );
  const hasHandler = functions.some((fn) => /savedata/i.test(String(fn.name || "")));
  const mutatingReqs = requests.filter((r) => r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE);
  const hasEndpoint = mutatingReqs.some((r) => r.static_path || r.url_expression);
  const hasMethod = mutatingReqs.some((r) => r.method);
  const hasPayload = mutatingReqs.some((r) => r.payload_expression);
  const hasActionType = /actiontype/i.test(allText);
  const hasSuccess = mutatingReqs.some((r) => r.response_usage) || /success\s*:/i.test(allText);
  const hasProductId =
    /productid|productlid|product_id/i.test(allText) &&
    /(return|assign|response|data\.|result)/i.test(allText);
  const hasEditState = /update|edit|loadproductdataforlegacy/i.test(allText);
  const hasComposition = /composition|ingredient/i.test(allText);
  const distinguishedFromTerminal = !requests.some(
    (r) => r.mutation_classification === MUTATION_CLASS.TERMINAL_CANDIDATE,
  ) || requests.some(
    (r) =>
      r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE &&
      !/final|approv/i.test(`${r.url_expression || ""} ${r.payload_expression || ""}`),
  );

  const criteria = {
    initiating_control: hasInitiatingControl,
    handler_function: hasHandler,
    endpoint: hasEndpoint,
    http_method: hasMethod,
    payload_construction: hasPayload,
    actiontype_or_mode_semantics: hasActionType,
    success_failure_handling: hasSuccess,
    product_identifier_handling: hasProductId,
    subsequent_edit_update_state: hasEditState,
    subsequent_composition_availability: hasComposition,
    distinguished_from_terminal_submit: distinguishedFromTerminal && hasHandler,
  };

  const missing = Object.entries(criteria)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);

  return {
    status: missing.length ? "unresolved" : "evidence_present_unproven",
    criteria,
    missing_criteria: missing,
    note:
      missing.length === 0
        ? "All shell-create evidence facets were observed in source; contract remains non-executable until audited."
        : "Shell-create remains unresolved; missing evidence facets recorded.",
  };
}

function bucketRequests(requests) {
  const shell_create_candidates = [];
  const lookup_candidates = [];
  const existing_record_load_candidates = [];
  const composition_candidates = [];
  const update_candidates = [];
  const final_submit_candidates = [];
  const reread_candidates = [];

  for (const req of requests || []) {
    const hay = `${req.source_function || ""} ${req.url_expression || ""} ${req.static_path || ""} ${req.payload_expression || ""}`.toLowerCase();
    if (req.mutation_classification === MUTATION_CLASS.TERMINAL_CANDIDATE) {
      final_submit_candidates.push(req);
      continue;
    }
    if (/loadproductdataforlegacy|viewproducttbllegacy/.test(hay)) {
      existing_record_load_candidates.push(req);
      reread_candidates.push(req);
    }
    if (/getsubtype|search|list|find|viewproduct|lookup/.test(hay) &&
      req.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN) {
      lookup_candidates.push(req);
    }
    if (/composition|ingredient/.test(hay)) {
      composition_candidates.push(req);
    }
    if (/update/.test(hay) && req.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE) {
      update_candidates.push(req);
    }
    if (
      /savedata|actiontype/.test(hay) &&
      req.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE &&
      !/final|approv/.test(hay)
    ) {
      shell_create_candidates.push(req);
    }
  }

  return {
    shell_create_candidates,
    lookup_candidates,
    existing_record_load_candidates,
    composition_candidates,
    update_candidates,
    final_submit_candidates,
    reread_candidates,
  };
}

function classifyStaticScriptAcquisitionUrl(urlValue, pageOrigin) {
  let parsed;
  try {
    parsed = new URL(String(urlValue || ""), pageOrigin || undefined);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (!pageOrigin) return { ok: false, reason: "missing_page_origin" };
  let origin;
  try {
    origin = new URL(pageOrigin).origin;
  } catch {
    return { ok: false, reason: "invalid_page_origin" };
  }
  if (parsed.origin !== origin) return { ok: false, reason: "cross_origin" };
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "non_http_protocol" };
  }
  const path = parsed.pathname || "";
  if (!/\.js$/i.test(path)) return { ok: false, reason: "not_javascript_path" };
  if (isBusinessApiPath(path)) return { ok: false, reason: "business_api_path" };
  if (!isStaticScriptPath(path)) return { ok: false, reason: "not_static_script_path" };
  // Persist path only — drop query/hash for acquisition target identity.
  const clean = `${parsed.origin}${path}`;
  return { ok: true, url: clean, path };
}

module.exports = {
  MUTATION_CLASS,
  MAX_SOURCE_BYTES,
  MAX_FUNCTIONS,
  MAX_REQUESTS,
  SCAN_TERMS,
  sha256Text,
  boundSanitize,
  stripUrlToPath,
  classifyMutation,
  collectTermContexts,
  extractNamedFunctions,
  extractRequestsFromSource,
  analyzeSourceText,
  assessShellCreateEvidence,
  bucketRequests,
  classifyStaticScriptAcquisitionUrl,
  isBusinessApiPath,
  isStaticScriptPath,
};
