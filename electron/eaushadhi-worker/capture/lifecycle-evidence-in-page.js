/* eslint-env node, browser */

/**
 * Observational lifecycle contract extractor.
 * Playwright page.evaluate serializes this function; it must not close over
 * Node requires, mutate the portal DOM, invoke handlers, click, fill, submit,
 * or call network helpers / business endpoint clients.
 */
function extractLifecycleContractEvidence() {
  const MAX_CONTROLS = 80;
  const MAX_SCRIPTS = 40;
  const MAX_INLINE_SCRIPT = 65536;
  const MAX_PREVIEW = 240;
  const MAX_TEXT = 120;
  const MAX_REFERENCED_FUNCTION_SOURCE = 262144;
  const MAX_FUNCTIONS = 16;
  const HANDLER_ALLOWLIST = [
    "SaveData",
    "LoadProductDataforLegacy",
    "GetproductDataUpdate",
    "submitProduct",
  ];

  function attr(el, name) {
    if (!el || typeof el.getAttribute !== "function") return null;
    const value = el.getAttribute(name);
    return value == null || value === "" ? null : String(value);
  }

  function sliceText(value, max) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function pathOnly(urlValue) {
    try {
      const parsed = new URL(String(urlValue || ""), location.href);
      return parsed.pathname || null;
    } catch {
      const raw = String(urlValue || "");
      return raw.split("#")[0].split("?")[0] || null;
    }
  }

  function visible(el) {
    if (!el) return false;
    if (el.hidden === true) return false;
    const style = typeof window.getComputedStyle === "function" ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return true;
  }

  function formMeta(el) {
    const form = el && el.form ? el.form : el && el.closest ? el.closest("form") : null;
    if (!form) return { form_id: null, form_action: null, form_method: null };
    return {
      form_id: form.id || null,
      form_action: pathOnly(attr(form, "action") || form.getAttribute && form.getAttribute("action")),
      form_method: String(attr(form, "method") || form.method || "get").toLowerCase(),
    };
  }

  function classNameOf(el) {
    if (!el) return "";
    if (typeof el.className === "string") return el.className;
    const fromAttr = attr(el, "class");
    return fromAttr || "";
  }

  function isChromeNavigation(el, text, href) {
    const id = String(el.id || "").toLowerCase();
    const name = String(el.name || "").toLowerCase();
    const label = String(text || "").toLowerCase();
    const path = String(href || "").toLowerCase();
    const className = classNameOf(el).toLowerCase();
    if (/save_btn|save_rbtn/.test(id)) return false;
    if (/\bsubmit\b/.test(className) && /submitproduct/i.test(String(attr(el, "onclick") || ""))) return false;
    if (/logoutform|logout|lnkupdateprofile|changepassword|menu|refresh|dashboard/.test(`${id} ${name} ${className}`)) {
      return true;
    }
    if (/^(menu|refresh|logout|dashboard|home|profile)$/i.test(label.trim())) return true;
    if (/change\s*password|log\s*out|sign\s*out/.test(label)) return true;
    if (/\/logout\b|\/custom_dashboard|\/changepassword|\/updateprofile/.test(path)) return true;
    return false;
  }

  function candidateRole(el, text, onclick) {
    const className = classNameOf(el);
    const href = String(el.tagName || "").toLowerCase() === "a" ? pathOnly(attr(el, "href")) : null;
    if (isChromeNavigation(el, text, href)) return "chrome_navigation";

    const hay = `${el.id || ""} ${el.name || ""} ${className} ${text || ""} ${onclick || ""}`.toLowerCase();

    // Row-level Submit linked to submitProduct is terminal — not #save_btn.
    if (
      (/submitproduct\s*\(/.test(hay) || /\bsubmitproduct\b/.test(hay)) &&
      (/\bsubmit\b/.test(className.toLowerCase()) || /\.submit\b/.test(hay) || /\bsubmit\b/.test(String(text || "").toLowerCase()))
    ) {
      return "final_submit_candidate";
    }
    if (/final\s*submit|forward\s*for\s*approval/.test(hay)) return "final_submit_candidate";

    if (/loadproductdataforlegacy|viewproducttbllegacy|getproductdataupdate/.test(hay)) {
      return "existing_record_load_candidate";
    }
    if (/composition|ingredient/.test(hay) && /(add|edit|delete|save|update)/.test(hay)) {
      return "composition_mutation_candidate";
    }
    if (/\bupdate\b/.test(hay) && !/\bsave\b/.test(hay) && !/save_btn|save_rbtn/.test(hay)) {
      return "update_candidate";
    }
    if (/create\s+product|add\s+product|new\s+product/.test(hay)) return "shell_create_candidate";

    // #save_btn / SaveData → save/create-update candidate, never terminal from label Submit.
    if (/save_btn|save_rbtn/.test(hay) || /savedata\s*\(/.test(hay) || /\bsavedata\b/.test(hay)) {
      return "save_or_submit_ambiguous";
    }

    // Do not treat bare type=submit or generic "submit" chrome as lifecycle.
    if (/\bsave\b/.test(hay)) return "save_or_submit_ambiguous";
    if (/search|find|lookup|list/.test(hay)) return "lookup_candidate";
    return "unknown";
  }

  function simpleAllowlistedCallName(preview) {
    const raw = String(preview || "").trim();
    const match = raw.match(/^([A-Za-z_$][\w$]*)\s*\(\s*\)\s*;?$/);
    if (!match) return null;
    const name = match[1];
    if (!HANDLER_ALLOWLIST.includes(name)) return null;
    if (raw.includes(".") || raw.includes("[")) return null;
    return name;
  }

  function controlRecord(el) {
    const tag = String(el.tagName || "").toLowerCase();
    const text = sliceText(el.textContent, MAX_TEXT);
    const onclickAttr = attr(el, "onclick");
    let onclickPreview = onclickAttr;
    if (!onclickPreview && el.onclick && typeof Function !== "undefined") {
      try {
        onclickPreview = Function.prototype.toString.call(el.onclick).slice(0, MAX_PREVIEW);
      } catch {
        onclickPreview = null;
      }
    }
    const form = formMeta(el);
    const href = tag === "a" ? pathOnly(attr(el, "href")) : null;
    return {
      selector: el.id ? `#${el.id}` : null,
      id: el.id || null,
      name: el.name || null,
      tag,
      type: el.type || attr(el, "type") || null,
      text,
      value_or_href_metadata: href || (tag === "input" ? "[redacted_or_omitted]" : null),
      onclick_present: Boolean(onclickAttr || el.onclick),
      onclick_preview: onclickPreview ? sliceText(onclickPreview, MAX_PREVIEW) : null,
      form_id: form.form_id,
      form_action: form.form_action,
      form_method: form.form_method,
      disabled: el.disabled === true,
      visible: visible(el),
      candidate_role: candidateRole(el, text, onclickPreview || ""),
      activated: false,
    };
  }

  const controls = [];
  const controlNodes = Array.from(
    document.querySelectorAll(
      "button, input[type='submit'], input[type='button'], a[href], a[onclick], a.Submit, .Submit",
    ),
  ).slice(0, MAX_CONTROLS);
  for (const el of controlNodes) {
    controls.push(controlRecord(el));
  }

  // Prefer known save controls even if outside the first N generic matches.
  for (const id of ["save_btn", "save_rbtn"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (controls.some((item) => item.id === id)) continue;
    controls.push(controlRecord(el));
  }

  const scripts = [];
  const inlineSources = [];
  const scriptNodes = Array.from(document.scripts || []).slice(0, MAX_SCRIPTS);
  scriptNodes.forEach((script, index) => {
    const src = attr(script, "src");
    if (src) {
      scripts.push({
        script_index: index,
        source_kind: "external",
        src_path: pathOnly(src),
        src_url_for_acquisition: (() => {
          try {
            const parsed = new URL(src, location.href);
            return `${parsed.origin}${parsed.pathname}`;
          } catch {
            return null;
          }
        })(),
        acquisition_status: "pending_static_check",
      });
      return;
    }
    const raw = String(script.textContent || "");
    const truncated = raw.length > MAX_INLINE_SCRIPT;
    const body = truncated ? raw.slice(0, MAX_INLINE_SCRIPT) : raw;
    scripts.push({
      script_index: index,
      source_kind: "inline",
      src_path: null,
      source_length: raw.length,
      source_truncated: truncated,
      acquisition_status: "inline_captured",
    });
    if (body) {
      inlineSources.push({
        script_index: index,
        source_kind: "inline_script",
        function_source_raw: body,
        source_truncated: truncated,
        source_length: raw.length,
      });
    }
  });

  const functions = [];
  const seenFns = new Set();

  function captureAllowlisted(name, controlId) {
    if (seenFns.has(name)) return;
    const value = window[name];
    const entry = {
      name,
      control_id: controlId || null,
      source_kind: "window_tostring",
      found: typeof value === "function",
      typeof: typeof value,
      referenced_by_onclick: Boolean(controlId),
      function_source_raw: null,
      source_length: null,
      source_truncated: false,
      source_capture_status: "not_found",
    };
    if (typeof value !== "function") {
      functions.push(entry);
      seenFns.add(name);
      return;
    }
    let raw = "";
    try {
      raw = Function.prototype.toString.call(value);
    } catch {
      entry.source_capture_status = "tostring_failed";
      functions.push(entry);
      seenFns.add(name);
      return;
    }
    entry.source_length = raw.length;
    if (raw.length > MAX_REFERENCED_FUNCTION_SOURCE) {
      entry.source_truncated = true;
      entry.function_source_raw = raw.slice(0, MAX_REFERENCED_FUNCTION_SOURCE);
      entry.source_capture_status = "captured_truncated";
    } else {
      entry.function_source_raw = raw;
      entry.source_capture_status = "captured";
    }
    functions.push(entry);
    seenFns.add(name);
  }

  for (const control of controls) {
    const name = simpleAllowlistedCallName(control.onclick_preview);
    if (name) captureAllowlisted(name, control.id);
  }
  // Always attempt primary lifecycle handlers when present on window.
  if (!seenFns.has("SaveData")) captureAllowlisted("SaveData", null);
  if (!seenFns.has("LoadProductDataforLegacy")) {
    captureAllowlisted("LoadProductDataforLegacy", null);
  }
  if (!seenFns.has("GetproductDataUpdate")) {
    captureAllowlisted("GetproductDataUpdate", null);
  }
  if (!seenFns.has("submitProduct")) {
    captureAllowlisted("submitProduct", null);
  }

  // Cap transferred function bodies.
  while (functions.length > MAX_FUNCTIONS) functions.pop();

  let pagePath = null;
  try {
    pagePath = location.pathname || null;
  } catch {
    pagePath = null;
  }

  return {
    schema_version: 1,
    page_path: pagePath,
    controls,
    scripts,
    inline_sources: inlineSources,
    functions_raw: functions,
    limitations: [
      "observational_extract_only",
      "no_handler_invocation",
      "no_business_endpoint_calls",
      "external_script_bodies_require_static_acquisition",
      "delegated_listeners_not_enumerated",
    ],
    activated: false,
    requests_executed: [],
  };
}

module.exports = {
  extractLifecycleContractEvidence,
};
