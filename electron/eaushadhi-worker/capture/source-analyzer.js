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
const SUCCESS_BODY_MAX = 720;
const SURROUNDING_MAX = 400;

const SCAN_TERMS = Object.freeze([
  "SaveData",
  "SaveProductData",
  "save",
  "update",
  "Submit",
  "submit",
  "submitProduct",
  "productlid",
  "productId",
  "actiontype",
  "LoadProductDataforLegacy",
  "GetproductDataUpdate",
  "getProductNames",
  "viewproducttbllegacy",
  "composition",
  "statusData.composition",
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

const ENCLOSING_FUNCTION_RE =
  /function\s+([A-Za-z_$][\w$]*)\s*\(|([A-Za-z_$][\w$]*)\s*=\s*function\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\(/g;

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

const APPROVED_STATIC_SCRIPT_PREFIXES = Object.freeze([
  "/db_static/",
  "/static/",
  "/assets/",
  "/js/",
]);

function isStaticScriptPath(pathValue) {
  const path = String(pathValue || "").toLowerCase();
  if (!path.endsWith(".js")) return false;
  if (isBusinessApiPath(path)) return false;
  return APPROVED_STATIC_SCRIPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function pathIdentityHay({ sourceFunction, urlExpression, staticPath }) {
  return [sourceFunction, urlExpression, staticPath]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
}

function findEnclosingFunctionName(source, offset) {
  const text = String(source || "");
  const end = Math.max(0, Math.min(Number(offset) || 0, text.length));
  const windowStart = Math.max(0, end - 8000);
  const slice = text.slice(windowStart, end);
  let bestName = null;
  let bestPos = -1;
  ENCLOSING_FUNCTION_RE.lastIndex = 0;
  let match;
  while ((match = ENCLOSING_FUNCTION_RE.exec(slice))) {
    const name = match[1] || match[2] || match[3];
    if (!name) continue;
    if (/^static_script:/i.test(name) || /^inline_script_/i.test(name)) continue;
    bestName = name;
    bestPos = match.index;
  }
  if (bestPos < 0) return null;
  return bestName;
}

function extractBalancedFunctionBody(text, openBraceIndex) {
  const src = String(text || "");
  if (openBraceIndex < 0 || openBraceIndex >= src.length || src[openBraceIndex] !== "{") return "";
  let depth = 0;
  for (let i = openBraceIndex; i < src.length && i - openBraceIndex < SUCCESS_BODY_MAX + 80; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(openBraceIndex, i + 1);
    }
  }
  return src.slice(openBraceIndex, Math.min(src.length, openBraceIndex + SUCCESS_BODY_MAX));
}

function buildResponseUsageMarkers(successBody) {
  const body = String(successBody || "");
  if (!body) return null;
  const markers = [];
  const lower = body.toLowerCase();
  if (/datatable|fnserverdata|mockjax|aadata|jsondata|statusdata|totalcount|aocolumns|columns\s*:/.test(lower)) {
    markers.push("list_or_datatable_consumption");
  }
  if (/statusdata\.composition|composition/.test(lower)) markers.push("composition_field_observed");
  if (/#name|\.val\s*\(|getelementbyid\s*\(\s*['\"]name['\"]/.test(lower)) markers.push("form_field_population");
  if (/actiontype[\s\S]{0,40}edit|#actiontype/.test(lower)) markers.push("local_actiontype_edit");
  if (/save_btn|update\s*product|['\"]update['\"]/.test(lower)) markers.push("local_edit_ui_mode");
  if (/saveproductdata|submitproduct\s*\(/.test(lower)) markers.push("write_or_submit_chained");
  if (/confirm|declaration|undertaking|hereby/.test(lower)) markers.push("confirmation_language");
  const excerpt = boundSanitize(body, SNIPPET_MAX);
  if (!markers.length && !excerpt) return null;
  return markers.length ? `${markers.join(",")};${excerpt}` : excerpt;
}

function extractAjaxSuccessBody(block) {
  const text = String(block || "");
  const match = text.match(/\bsuccess\s*:\s*function\s*\([^)]*\)\s*\{/);
  if (!match || match.index == null) return "";
  const braceAt = text.indexOf("{", match.index + match[0].length - 1);
  return extractBalancedFunctionBody(text, braceAt);
}

function extractAjaxBlockMeta(block) {
  const urlMatch = block.match(/\burl\s*:\s*(['"`])([^'"`]+)\1/) ||
    block.match(/\burl\s*:\s*([^\s,}+]+)/);
  const typeMatch =
    block.match(/\b(?:type|method)\s*:\s*(['"`])(GET|POST|PUT|DELETE|PATCH)\1/i) ||
    block.match(/\b(?:type|method)\s*:\s*(GET|POST|PUT|DELETE|PATCH)\b/i);
  const dataMatch = block.match(/\bdata\s*:\s*([^,}\n]+)/);
  const contentMatch = block.match(/\bcontentType\s*:\s*(['"`])([^'"`]+)\1/);
  const successBody = extractAjaxSuccessBody(block);
  return {
    url_expression: urlMatch ? urlMatch[2] || urlMatch[1] : null,
    method: typeMatch ? (typeMatch[2] || typeMatch[1] || "").toUpperCase() : null,
    payload_expression: dataMatch ? dataMatch[1] : null,
    content_type: contentMatch ? contentMatch[2] : null,
    response_usage: buildResponseUsageMarkers(successBody),
  };
}

/**
 * Source-level linkage evidence kept separate from AJAX request surrounding_context.
 * Deterministic markers only — no distant text copied into request records.
 */
function extractSourceLinkageEvidence(source) {
  const text = String(source || "");
  const lower = text.toLowerCase();
  const markers = [];
  const rowSubmit =
    /\.submit\b/.test(lower) &&
    (/queryselectorall\s*\(\s*['\"]\.submit['\"]/i.test(text) ||
      /class\s*=\s*['\"][^'\"]*\bsubmit\b/i.test(text) ||
      /['\"]\.submit['\"]/.test(lower));
  const invokesSubmitProduct = /submitproduct\s*\(/i.test(text);
  if (rowSubmit && invokesSubmitProduct) markers.push("row_Submit_invokes_submitProduct");
  if (
    invokesSubmitProduct &&
    /confirm|declaration|undertaking|hereby\s+declare|are you sure/i.test(text)
  ) {
    markers.push("submitProduct_confirmation_or_declaration");
  }
  return {
    markers,
    row_submit_links_submitProduct: markers.includes("row_Submit_invokes_submitProduct"),
    submitProduct_confirmation_observed: markers.includes("submitProduct_confirmation_or_declaration"),
  };
}

function extractCompositionObservations(source) {
  const text = String(source || "");
  const out = [];
  const limitations = [];
  if (!/statusdata\.composition|composition/i.test(text)) {
    return { observations: out, limitations };
  }

  const hasStatusData = /statusdata\.composition/i.test(text);
  if (hasStatusData) {
    const idx = text.toLowerCase().indexOf("statusdata.composition");
    const window = text.slice(Math.max(0, idx - 80), Math.min(text.length, idx + 280));
    const handlerMatch =
      window.match(/onclick\s*=\s*['\"]([^'\"]+)['\"]/i) ||
      window.match(/(opencomposition|loadcomposition|composition[A-Za-z_]*)\s*\(/i) ||
      window.match(/href\s*=\s*['\"]([^'\"]+)['\"]/i);
    const classMatch = window.match(/class\s*=\s*['\"]([^'\"]*composition[^'\"]*)['\"]/i);
    const idParam =
      window.match(/\b(?:id|productid|productlid)\s*[=:]\s*([A-Za-z0-9_$.]+)/i) ||
      window.match(/\((\s*[A-Za-z0-9_$.]+\s*)\)/);
    const hasExactLinkage = Boolean(handlerMatch || /href\s*=|onclick\s*=/i.test(window));
    out.push({
      candidate_kind: "source_link_or_handler",
      observation: "statusData.composition",
      class_or_id: classMatch ? boundSanitize(classMatch[1], 80) : null,
      handler_or_href: handlerMatch ? boundSanitize(handlerMatch[1] || handlerMatch[0], 160) : null,
      product_id_expression: idParam ? boundSanitize(idParam[1], 80) : null,
      linkage_complete: hasExactLinkage,
      mutation_classification: MUTATION_CLASS.UNKNOWN,
      evidence_basis: hasExactLinkage
        ? ["statusData.composition", "composition_action_html_observed"]
        : ["statusData.composition", "composition_column_without_exact_handler_linkage"],
    });
    if (!hasExactLinkage) {
      limitations.push("composition_action_linkage_incomplete");
    }
  } else if (/composition/i.test(text)) {
    limitations.push("composition_mentioned_without_statusData_composition_linkage");
  }
  return { observations: out, limitations };
}

function hasWritePayloadActionType(payloadExpression) {
  const payload = String(payloadExpression || "").toLowerCase();
  return /\bactiontype\b/.test(payload) && /\b(add|update|delete|submit|create|insert)\b/.test(payload);
}

function hasWriteOrSubmitChain(responseUsage, surroundingContext) {
  const hay = `${responseUsage || ""} ${surroundingContext || ""}`.toLowerCase();
  return /write_or_submit_chained|saveproductdata|submitproduct\s*\(/.test(hay);
}

function proveLoadProductDataforLegacyReadOnly(ctx) {
  const identityHay = pathIdentityHay(ctx);
  const identity =
    /loadproductdataforlegacy/.test(identityHay) ||
    /\/admin\/loadproductdataforlegacy\b/.test(identityHay);
  if (!identity) return { identity: false, proven: false, basis: [] };

  const semanticHay = [
    ctx.payloadExpression,
    ctx.responseUsage,
    ctx.surroundingContext,
  ]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");

  const queryInputs = /pageno|search|order|licenseid/.test(semanticHay);
  const listConsume =
    /list_or_datatable_consumption|datatable|aadata|jsondata|statusdata|totalcount|mockjax/.test(
      semanticHay,
    );
  const noWritePayload = !hasWritePayloadActionType(ctx.payloadExpression);
  const noWriteChain = !hasWriteOrSubmitChain(ctx.responseUsage, ctx.surroundingContext);

  const basis = ["loadproductdataforlegacy_identity"];
  if (queryInputs) basis.push("list_query_inputs");
  if (listConsume) basis.push("datatable_or_list_response_consumption");
  if (noWritePayload) basis.push("no_write_actiontype_payload");
  if (noWriteChain) basis.push("no_save_or_submit_chain");

  const proven = queryInputs && listConsume && noWritePayload && noWriteChain;
  return { identity: true, proven, basis };
}

function proveGetproductDataUpdateReadOnly(ctx) {
  const identityHay = pathIdentityHay(ctx);
  const identity =
    /getproductdataupdate/.test(identityHay) ||
    /\/admin\/getproductdataupdate\b/.test(identityHay);
  if (!identity) return { identity: false, proven: false, basis: [] };

  const payload = String(ctx.payloadExpression || "").toLowerCase();
  const response = String(ctx.responseUsage || "").toLowerCase();
  const surrounding = String(ctx.surroundingContext || "").toLowerCase();
  const semantic = `${payload} ${response} ${surrounding}`;

  const hasId =
    /\b(id|productid|productlid)\b/.test(payload) ||
    /\b(id|productid|productlid)\b/.test(surrounding);
  const populatesFields =
    /form_field_population|#name|#type|#category|#subtype|#permission|#remarks|#compositiontitle|#disease|\.val\s*\(/.test(
      semantic,
    );
  const localEdit =
    /local_actiontype_edit|actiontype[\s\S]{0,48}edit/.test(semantic);
  const localUpdateUi =
    /local_edit_ui_mode|save_btn|update\s*product|['\"]update['\"]/.test(semantic);
  const noServerWrite =
    !hasWriteOrSubmitChain(ctx.responseUsage, ctx.surroundingContext) &&
    !/saveproductdata/.test(semantic);

  const basis = ["getproductdataupdate_identity"];
  if (hasId) basis.push("product_id_request");
  if (populatesFields) basis.push("retained_field_population");
  if (localEdit) basis.push("local_actiontype_edit_mode");
  if (localUpdateUi) basis.push("local_update_ui_mode");
  if (noServerWrite) basis.push("no_server_write_in_same_function");

  const proven = hasId && populatesFields && localEdit && localUpdateUi && noServerWrite;
  return { identity: true, proven, basis };
}

function proveSubmitProductRequestFacts(ctx) {
  const identityHay = pathIdentityHay(ctx);
  const methodNorm = ctx.method ? String(ctx.method).toUpperCase() : null;
  const fnOk = /^submitproduct$/i.test(String(ctx.sourceFunction || "").trim());
  const endpointOk =
    /\/admin\/submitproduct\b/.test(identityHay) ||
    /submitproduct/.test(String(ctx.urlExpression || "").toLowerCase() + String(ctx.staticPath || "").toLowerCase());
  const postOk = methodNorm === "POST";
  const idPayload = /\b(id|productid|productlid)\b/.test(String(ctx.payloadExpression || "").toLowerCase());
  const basis = [];
  if (fnOk) basis.push("enclosing_function_submitProduct");
  if (endpointOk) basis.push("endpoint_submitProduct");
  if (postOk) basis.push("http_post");
  if (idPayload) basis.push("product_id_payload");
  return {
    complete: fnOk && endpointOk && postOk && idPayload,
    basis,
  };
}

function isAmbiguousReadIdentity(identityHay) {
  return /loadproductdataforlegacy|getproductdataupdate|load[a-z0-9_]*|get[a-z0-9_]*/.test(
    identityHay,
  );
}

/**
 * Classify a request/control candidate from source semantics.
 * GET alone never yields READ_ONLY_PROVEN.
 * POST + Load/Get name alone never yields READ_ONLY_PROVEN.
 */
function classifyMutation({
  method = null,
  urlExpression = "",
  staticPath = null,
  payloadExpression = "",
  responseUsage = "",
  surroundingContext = "",
  sourceFunction = "",
  linkageEvidence = null,
} = {}) {
  const methodNorm = method ? String(method).toUpperCase() : null;
  const pathHay = [sourceFunction, urlExpression, staticPath, payloadExpression]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
  const hay = [pathHay, responseUsage, surroundingContext]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
  const ctx = {
    method: methodNorm,
    urlExpression,
    staticPath,
    payloadExpression,
    responseUsage,
    surroundingContext,
    sourceFunction,
  };

  const basis = [];

  // Hard negatives: SaveData / SaveProductData are never terminal.
  const isSaveFlow =
    /\bsavedata\b/.test(pathHay) ||
    /saveproductdata/.test(pathHay) ||
    /\/admin\/saveproductdata\b/.test(pathHay);

  // Layered terminal: request facts + separate source linkage markers.
  const submitFacts = proveSubmitProductRequestFacts(ctx);
  if (submitFacts.complete && !isSaveFlow) {
    const linkage = linkageEvidence || { markers: [] };
    const hasRowLink = linkage.row_submit_links_submitProduct === true;
    const hasConfirm = linkage.submitProduct_confirmation_observed === true;
    if (hasRowLink) {
      basis.push(...submitFacts.basis);
      basis.push("linkage:row_Submit_invokes_submitProduct");
      if (hasConfirm) basis.push("linkage:submitProduct_confirmation_or_declaration");
      return {
        mutation_classification: MUTATION_CLASS.TERMINAL_CANDIDATE,
        evidence_basis: basis,
        linkage_markers: linkage.markers.slice(),
      };
    }
    // Request looks like product submit but linkage incomplete → not terminal.
    basis.push(...submitFacts.basis);
    basis.push("terminal_linkage_incomplete");
    return {
      mutation_classification: MUTATION_CLASS.MUTATING_CANDIDATE,
      evidence_basis: basis,
      linkage_markers: [],
    };
  }

  if (
    !isSaveFlow &&
    (/\bfinal\s*submit\b/.test(hay) ||
      /\bforward\s*for\s*approval\b/.test(hay) ||
      (/\bapprov(?:e|al)\b/.test(hay) && /\b(submit|final|lock|forward)\b/.test(hay)) ||
      /\birreversible\b/.test(hay) ||
      /\bfinaliz(?:e|ation)\b/.test(hay) ||
      /\block(?:ed|ing)?\s+record\b/.test(hay))
  ) {
    basis.push("terminal_language");
    return { mutation_classification: MUTATION_CLASS.TERMINAL_CANDIDATE, evidence_basis: basis, linkage_markers: [] };
  }

  const loadProof = proveLoadProductDataforLegacyReadOnly(ctx);
  if (loadProof.identity) {
    if (loadProof.proven) {
      return {
        mutation_classification: MUTATION_CLASS.READ_ONLY_PROVEN,
        evidence_basis: loadProof.basis,
        linkage_markers: [],
      };
    }
    return {
      mutation_classification: MUTATION_CLASS.UNKNOWN,
      evidence_basis: ["incomplete_loadproductdataforlegacy_read_proof", ...loadProof.basis],
      linkage_markers: [],
    };
  }

  const getUpdateProof = proveGetproductDataUpdateReadOnly(ctx);
  if (getUpdateProof.identity) {
    if (getUpdateProof.proven) {
      return {
        mutation_classification: MUTATION_CLASS.READ_ONLY_PROVEN,
        evidence_basis: getUpdateProof.basis,
        linkage_markers: [],
      };
    }
    return {
      mutation_classification: MUTATION_CLASS.UNKNOWN,
      evidence_basis: ["incomplete_getproductdataupdate_read_proof", ...getUpdateProof.basis],
      linkage_markers: [],
    };
  }

  // POST Load*/Get* without joint proof → UNKNOWN (not mutating solely for POST).
  if (
    methodNorm === "POST" &&
    /\/admin\//.test(pathHay) &&
    isAmbiguousReadIdentity(pathHay) &&
    !/\bsavedata\b/.test(hay) &&
    !hasWritePayloadActionType(payloadExpression) &&
    !/\b(saveproductdata|updateproduct|delete|upload|insert|create)\b/.test(pathHay)
  ) {
    basis.push("post_read_like_identity_without_joint_proof");
    return { mutation_classification: MUTATION_CLASS.UNKNOWN, evidence_basis: basis, linkage_markers: [] };
  }

  const mutatingHints =
    /\bsavedata\b/.test(hay) ||
    /saveproductdata/.test(pathHay) ||
    (/\bactiontype\b/.test(hay) && /\b(save|add|create|insert|update|delete|submit)\b/.test(hay)) ||
    (/\b(save|update|delete|upload|insert|create)\b/.test(pathHay) &&
      !/\b(load|list|view|search|find|read)\b/.test(pathHay) &&
      !/getproductdataupdate|loadproductdataforlegacy/.test(pathHay)) ||
    (methodNorm === "POST" &&
      /\/admin\//.test(pathHay) &&
      !/getsubtype|get[a-z0-9]*name|list|load|view|search|find|getproductdataupdate|loadproductdataforlegacy/.test(
        pathHay,
      ));

  if (mutatingHints) {
    if (/\bsavedata\b/.test(hay)) basis.push("SaveData_reference");
    if (/saveproductdata/.test(pathHay)) basis.push("SaveProductData_endpoint");
    if (/\bactiontype\b/.test(hay)) basis.push("actiontype_semantics");
    if (methodNorm === "POST") basis.push("http_post");
    if (/\b(save|update|delete|upload|insert|create|submit)\b/.test(hay)) basis.push("mutating_verb");
    return { mutation_classification: MUTATION_CLASS.MUTATING_CANDIDATE, evidence_basis: basis, linkage_markers: [] };
  }

  // Weaker GET/path read proof — never bare method; never POST name-alone.
  const readHints =
    methodNorm !== "POST" &&
    (/getsubtypename|viewproducttbllegacy|getproductnames/.test(pathHay) ||
      /\b(load|list|view|search|find|read)\b/.test(pathHay) ||
      /\/get[a-z0-9_-]*\b/.test(pathHay)) &&
    !/\b(save|update|delete|upload|insert|create|submit|approve)\b/.test(pathHay) &&
    !/getproductdataupdate/.test(pathHay);

  if (readHints) {
    basis.push("read_semantic_verbs");
    if (methodNorm === "GET" || /\$\.get\b/.test(hay)) basis.push("get_with_read_semantics");
    if (/viewproducttbllegacy|getsubtypename|getproductnames/.test(pathHay)) {
      basis.push("known_read_endpoint_name");
    }
    return { mutation_classification: MUTATION_CLASS.READ_ONLY_PROVEN, evidence_basis: basis, linkage_markers: [] };
  }

  if (methodNorm === "GET") {
    basis.push("http_get_alone_insufficient");
    return { mutation_classification: MUTATION_CLASS.UNKNOWN, evidence_basis: basis, linkage_markers: [] };
  }

  basis.push("insufficient_source_semantics");
  return { mutation_classification: MUTATION_CLASS.UNKNOWN, evidence_basis: basis, linkage_markers: [] };
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

function finalizeRequestRecord(partial, linkageEvidence) {
  const staticPath = partial.static_path || stripUrlToPath(partial.url_expression);
  const classified = classifyMutation({
    method: partial.method,
    urlExpression: partial.url_expression,
    staticPath,
    payloadExpression: partial.payload_expression,
    responseUsage: partial.response_usage,
    surroundingContext: partial.surrounding_context,
    sourceFunction: partial.source_function,
    linkageEvidence,
  });
  return {
    source_function: partial.source_function || null,
    url_expression: boundSanitize(partial.url_expression, URL_EXPR_MAX) || null,
    static_path: staticPath ? boundSanitize(staticPath, URL_EXPR_MAX) : null,
    method: partial.method ? String(partial.method).toUpperCase() : null,
    payload_expression: boundSanitize(partial.payload_expression, DATA_EXPR_MAX) || null,
    content_type: boundSanitize(partial.content_type, 120) || null,
    response_usage: boundSanitize(partial.response_usage, SNIPPET_MAX) || null,
    mutation_classification: classified.mutation_classification,
    evidence_basis: classified.evidence_basis,
    linkage_markers: Array.isArray(classified.linkage_markers) ? classified.linkage_markers : [],
  };
}

function pushRawRequest(list, partial) {
  if (list.length >= MAX_REQUESTS) return;
  list.push({
    source_function: partial.source_function || null,
    url_expression: partial.url_expression || null,
    static_path: partial.static_path || null,
    method: partial.method || null,
    payload_expression: partial.payload_expression || null,
    content_type: partial.content_type || null,
    response_usage: partial.response_usage || null,
    surrounding_context: partial.surrounding_context
      ? boundSanitize(partial.surrounding_context, SURROUNDING_MAX)
      : null,
  });
}

function resolveSourceFunction(source, offset, fallback) {
  const enclosing = findEnclosingFunctionName(source, offset);
  if (enclosing) return enclosing;
  const fallbackName = String(fallback || "").trim();
  if (fallbackName && !/^static_script:/i.test(fallbackName) && !/^inline_script_/i.test(fallbackName)) {
    return fallbackName;
  }
  return enclosing || fallbackName || null;
}

function extractBalancedObjectBody(text, openBraceIndex) {
  return extractBalancedFunctionBody(text, openBraceIndex);
}

function extractRequestsFromSource(source, sourceFunction = null) {
  const text = String(source || "");
  const requests = [];

  const ajaxStartRe = /\$\.ajax\s*\(\s*\{/g;
  let match;
  while ((match = ajaxStartRe.exec(text)) && requests.length < MAX_REQUESTS) {
    const openBrace = match.index + match[0].length - 1;
    const objectBody = extractBalancedObjectBody(text, openBrace);
    if (!objectBody) continue;
    // Strip outer braces for meta parsing (same shape as prior capture group).
    const block = objectBody.slice(1, -1);
    const meta = extractAjaxBlockMeta(block);
    pushRawRequest(requests, {
      source_function: resolveSourceFunction(text, match.index, sourceFunction),
      surrounding_context: block.slice(0, SURROUNDING_MAX),
      ...meta,
    });
    ajaxStartRe.lastIndex = openBrace + objectBody.length;
  }

  const postRe = /\$\.post\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*([^)]*)\)/g;
  while ((match = postRe.exec(text)) && requests.length < MAX_REQUESTS) {
    const payloadAndMaybeCb = match[3] || "";
    const cbMatch = payloadAndMaybeCb.match(/function\s*\([^)]*\)\s*\{/);
    let responseUsage = null;
    if (cbMatch && cbMatch.index != null) {
      const braceAt = payloadAndMaybeCb.indexOf("{", cbMatch.index);
      responseUsage = buildResponseUsageMarkers(extractBalancedFunctionBody(payloadAndMaybeCb, braceAt));
    }
    pushRawRequest(requests, {
      source_function: resolveSourceFunction(text, match.index, sourceFunction),
      url_expression: match[2],
      method: "POST",
      payload_expression: payloadAndMaybeCb.split(",").slice(0, 1).join(","),
      response_usage: responseUsage,
      surrounding_context: match[0].slice(0, SURROUNDING_MAX),
    });
  }

  const getRe = /\$\.get\s*\(\s*(['"`])([^'"`]+)\1/g;
  while ((match = getRe.exec(text)) && requests.length < MAX_REQUESTS) {
    pushRawRequest(requests, {
      source_function: resolveSourceFunction(text, match.index, sourceFunction),
      url_expression: match[2],
      method: "GET",
      surrounding_context: match[0].slice(0, SURROUNDING_MAX),
    });
  }

  const fetchRe = /fetch\s*\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*(\{[\s\S]*?\}))?\)/g;
  while ((match = fetchRe.exec(text)) && requests.length < MAX_REQUESTS) {
    const opts = match[3] || "";
    const methodMatch = opts.match(/\bmethod\s*:\s*(['"`])(GET|POST|PUT|DELETE|PATCH)\1/i);
    pushRawRequest(requests, {
      source_function: resolveSourceFunction(text, match.index, sourceFunction),
      url_expression: match[2],
      method: methodMatch ? methodMatch[2].toUpperCase() : "GET",
      payload_expression: opts.match(/\bbody\s*:/) ? "body_present" : null,
      surrounding_context: match[0].slice(0, SURROUNDING_MAX),
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
  const linkage = extractSourceLinkageEvidence(analyzed);
  const composition = extractCompositionObservations(analyzed);
  const rawRequests = extractRequestsFromSource(analyzed, sourceFunction);
  const requests = rawRequests.map((req) => finalizeRequestRecord(req, linkage));

  const limitations = [];
  if (truncated) limitations.push("source_truncated_at_analyzer_cap");
  for (const lim of composition.limitations || []) limitations.push(lim);

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
    source_linkage_evidence: linkage,
    composition_observations: composition.observations,
    limitations,
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

  const hasInitiatingControl = controls.some((c) => {
    const role = String(c.candidate_role || "");
    if (role === "chrome_navigation" || role === "non_lifecycle") return false;
    return (
      role === "shell_create_candidate" ||
      role === "save_or_submit_ambiguous" ||
      /save_btn|save_rbtn/i.test(String(c.id || ""))
    );
  });
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
  const hasEditState = /update|edit|loadproductdataforlegacy|getproductdataupdate/i.test(allText);
  const hasComposition = /composition|ingredient/i.test(allText);
  const distinguishedFromTerminal =
    !requests.some((r) => r.mutation_classification === MUTATION_CLASS.TERMINAL_CANDIDATE) ||
    requests.some(
      (r) =>
        r.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE &&
        !/final|approv|submitproduct/i.test(`${r.url_expression || ""} ${r.payload_expression || ""}`),
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

  // Intentionally only unresolved | evidence_present_unproven — never auto-promote.
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

function bucketRequests(requests, compositionObservations = []) {
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
    if (
      /getproductdataupdate/.test(hay) &&
      req.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN
    ) {
      existing_record_load_candidates.push(req);
      reread_candidates.push(req);
    }
    if (
      /loadproductdataforlegacy|viewproducttbllegacy/.test(hay) &&
      req.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN
    ) {
      // List/table load — not retained Product Details reread.
      lookup_candidates.push(req);
      if (/loadproductdataforlegacy/.test(hay)) {
        existing_record_load_candidates.push(req);
      }
    }
    if (
      /getsubtype|getproductnames|search|list|find|viewproduct|lookup/.test(hay) &&
      req.mutation_classification === MUTATION_CLASS.READ_ONLY_PROVEN &&
      !/loadproductdataforlegacy/.test(hay)
    ) {
      lookup_candidates.push(req);
    }
    if (/composition|ingredient/.test(hay)) {
      composition_candidates.push(req);
    }
    if (/update/.test(hay) && req.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE) {
      update_candidates.push(req);
    }
    if (
      /savedata|saveproductdata|actiontype/.test(hay) &&
      req.mutation_classification === MUTATION_CLASS.MUTATING_CANDIDATE &&
      !/final|approv|submitproduct/.test(hay)
    ) {
      shell_create_candidates.push(req);
    }
  }

  for (const obs of compositionObservations || []) {
    composition_candidates.push(obs);
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
  extractSourceLinkageEvidence,
  extractCompositionObservations,
  findEnclosingFunctionName,
  analyzeSourceText,
  assessShellCreateEvidence,
  bucketRequests,
  classifyStaticScriptAcquisitionUrl,
  isBusinessApiPath,
  isStaticScriptPath,
  APPROVED_STATIC_SCRIPT_PREFIXES,
};
