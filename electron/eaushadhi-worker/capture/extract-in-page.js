/* eslint-env node, browser */

/**
 * Frozen observational extractor. Playwright page.evaluate serializes this
 * function; it must not close over Node requires or mutate the portal DOM.
 */
function extractPortalPage() {
  function attr(el, name) {
    if (!el || typeof el.getAttribute !== "function") return null;
    const value = el.getAttribute(name);
    return value == null || value === "" ? null : String(value);
  }

  function textOf(el) {
    if (!el) return "";
    return String(el.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function hasJsHandler(el) {
    if (!el) return false;
    if (typeof el.onclick === "function") return true;
    if (attr(el, "onclick")) return true;
    if (attr(el, "onchange")) return true;
    if (attr(el, "onsubmit")) return true;
    return false;
  }

  function hrefMeta(raw) {
    const href = String(raw || "");
    if (!href) return { href_path: null, activation_risk: null };
    const lower = href.trim().toLowerCase();
    if (lower === "#" || lower.startsWith("javascript:")) {
      return { href_path: null, activation_risk: "script_or_hash" };
    }
    try {
      const base =
        typeof location !== "undefined" && location.href
          ? location.href
          : "https://www.e-aushadhi.gov.in/";
      const parsed = new URL(href, base);
      return {
        href_path: parsed.pathname || null,
        activation_risk: parsed.search || parsed.hash ? "query_or_hash_omitted" : null,
      };
    } catch {
      return { href_path: null, activation_risk: "unparseable_href" };
    }
  }

  function selectorCandidate(el) {
    const id = el && el.id ? String(el.id).trim() : "";
    if (id && !/^select2-/i.test(id) && document.querySelectorAll(`#${cssEscape(id)}`).length === 1) {
      return { strategy: "id", selector: `#${cssEscape(id)}` };
    }
    const name = attr(el, "name");
    if (name && document.querySelectorAll(`[name="${cssAttr(name)}"]`).length === 1) {
      return { strategy: "name", selector: `[name="${cssAttr(name)}"]` };
    }
    const htmlFor = el && el.id ? labelFor(el.id) : null;
    if (htmlFor) {
      return { strategy: "label-for", selector: `label[for="${cssAttr(el.id)}"]` };
    }
    return { strategy: "unresolved", selector: null };
  }

  function cssEscape(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function cssAttr(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function labelFor(id) {
    if (!id) return null;
    const label = document.querySelector(`label[for="${cssAttr(id)}"]`);
    return label ? textOf(label) : null;
  }

  function associatedLabel(el) {
    if (!el) return null;
    if (el.id) {
      const byFor = labelFor(el.id);
      if (byFor) return byFor;
    }
    const parentLabel = el.closest && el.closest("label");
    if (parentLabel) return textOf(parentLabel);
    const labelled = attr(el, "aria-label");
    if (labelled) return labelled.slice(0, 120);
    return null;
  }

  function isSelect2Linked(el) {
    if (!el) return false;
    const cls = String(el.className || "");
    if (/\bselect2-hidden-accessible\b/i.test(cls) || /\bselect2\b/i.test(cls)) return true;
    if (attr(el, "data-select2-id")) return true;
    const next = el.nextElementSibling;
    if (next && /\bselect2\b/i.test(String(next.className || ""))) return true;
    return false;
  }

  function nativeOptions(select) {
    const list = [];
    const opts = select && select.options ? Array.from(select.options) : [];
    for (const opt of opts) {
      list.push({
        value: opt.value == null ? "" : String(opt.value),
        label: textOf(opt),
        selected: opt.selected === true,
        disabled: opt.disabled === true,
      });
    }
    return list;
  }

  function controlRecord(el) {
    const tag = String(el.tagName || "").toLowerCase();
    return {
      tag,
      id: el.id || null,
      name: attr(el, "name"),
      type: attr(el, "type") || (tag === "select" ? "select" : tag === "textarea" ? "textarea" : tag === "button" ? "button" : null),
      role: attr(el, "role"),
      label: associatedLabel(el),
      placeholder: tag === "input" || tag === "textarea" ? attr(el, "placeholder") : null,
      disabled: el.disabled === true,
      multiple: el.multiple === true,
      checked: tag === "input" && (el.type === "checkbox" || el.type === "radio") ? el.checked === true : null,
      select2_linked: tag === "select" ? isSelect2Linked(el) : false,
      selector_candidate: selectorCandidate(el),
      verification_status: "unverified",
    };
  }

  const forms = Array.from(document.querySelectorAll("form")).map((form) => {
    let actionPath = null;
    try {
      const action = attr(form, "action") || "";
      if (action) {
        const parsed = new URL(action, location.href);
        actionPath = parsed.pathname || null;
      }
    } catch {
      actionPath = null;
    }
    return {
      id: form.id || null,
      name: attr(form, "name"),
      method: (attr(form, "method") || "get").toLowerCase(),
      action_path: actionPath,
      has_js_handler: hasJsHandler(form),
    };
  });

  const inputs = Array.from(document.querySelectorAll("input")).map((el) => {
    const rec = controlRecord(el);
    rec.hidden = rec.type === "hidden" || el.hidden === true;
    return rec;
  });

  const textareas = Array.from(document.querySelectorAll("textarea")).map((el) => controlRecord(el));

  const selects = Array.from(document.querySelectorAll("select")).map((el) => {
    const rec = controlRecord(el);
    rec.options = nativeOptions(el);
    const meaningful = rec.options.filter((opt) => String(opt.value || "").trim() !== "");
    rec.option_source = meaningful.length ? "native-dom" : "unresolved-async";
    return rec;
  });

  const buttons = Array.from(
    document.querySelectorAll("button, input[type='submit'], input[type='button'], [role='button']"),
  ).map((el) => {
    const rec = controlRecord(el);
    rec.text = textOf(el) || attr(el, "value");
    rec.has_js_handler = hasJsHandler(el);
    rec.form_id = el.form && el.form.id ? el.form.id : null;
    return rec;
  });

  const anchors = Array.from(document.querySelectorAll("a")).map((el) => {
    const href = hrefMeta(attr(el, "href"));
    return {
      tag: "a",
      id: el.id || null,
      name: attr(el, "name"),
      label: textOf(el) || associatedLabel(el),
      href_path: href.href_path,
      target: attr(el, "target"),
      role: attr(el, "role"),
      has_js_handler: hasJsHandler(el),
      activation_risk: href.activation_risk,
      selector_candidate: selectorCandidate(el),
    };
  });

  const tables = Array.from(document.querySelectorAll("table")).map((table, index) => ({
    id: table.id || null,
    index,
    headers: Array.from(table.querySelectorAll("th")).map((th) => textOf(th)).filter(Boolean),
    row_count: table.tBodies && table.tBodies[0] ? table.tBodies[0].rows.length : table.rows.length,
  }));

  let title = "";
  try {
    title = String(document.title || "").replace(/\s+/g, " ").trim().slice(0, 120);
  } catch {
    title = "";
  }

  return {
    title,
    forms,
    inputs,
    textareas,
    selects,
    buttons,
    anchors,
    tables,
  };
}

module.exports = {
  extractPortalPage,
};
