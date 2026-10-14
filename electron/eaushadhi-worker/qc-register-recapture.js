/* eslint-env node */

const { createHash } = require("node:crypto");

function firstDataRow(payload) {
  const data = payload && typeof payload === "object" ? payload.data : null;
  const row = data == null ? null : data[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  return row;
}

function listRowKeys(payload) {
  const row = firstDataRow(payload);
  if (!row) return [];
  return Object.keys(row).sort();
}

function listActionMarkup(payload) {
  const row = firstDataRow(payload);
  const action = row && row.action != null ? String(row.action) : "";
  return {
    hid: action.includes("hid"),
    edit_qc: action.includes("edit_qc"),
    delete_qc: action.includes("delete_qc"),
    downloadButtonClass: action.includes("downloadButtonClass"),
  };
}

function listDateSamples(payload) {
  const row = firstDataRow(payload);
  const raw = (key) => (row && row[key] != null ? String(row[key]) : "");
  return {
    startdate: raw("startdate"),
    enddate: raw("enddate"),
    reportdate: raw("reportdate"),
  };
}

function quotedKeys(literal) {
  const keys = [];
  let depth = 0;
  let quote = "";
  let escaped = false;
  let token = "";
  for (let index = 0; index < literal.length; index += 1) {
    const char = literal[index];
    if (quote) {
      if (escaped) {
        token += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = "";
        let next = index + 1;
        while (next < literal.length && /\s/.test(literal[next])) next += 1;
        if (depth === 1 && literal[next] === ":") keys.push(token);
        token = "";
        continue;
      }
      token += char;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      token = "";
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
  }
  return keys;
}

function balancedObject(source, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, index + 1);
    }
  }
  return "";
}

function branchOf(before) {
  const elseAt = before.lastIndexOf("else");
  const addAt = Math.max(before.lastIndexOf("\"add\""), before.lastIndexOf("'add'"));
  if (elseAt > addAt) return "edit";
  if (addAt >= 0) return "add";
  return "edit";
}

function parseSaveDataQcdetailsKeys(source) {
  const text = source == null ? "" : String(source);
  const found = { add: [], edit: [] };
  const pattern = /jsondata\s*=\s*\{/g;
  let match = pattern.exec(text);
  while (match) {
    const openIndex = match.index + match[0].length - 1;
    const literal = balancedObject(text, openIndex);
    const before = text.slice(Math.max(0, match.index - 800), match.index);
    const branch = branchOf(before);
    if (literal && found[branch].length === 0) found[branch] = quotedKeys(literal);
    match = pattern.exec(text);
  }
  return found;
}

function scriptHash(scriptText) {
  if (typeof scriptText !== "string" || scriptText.length === 0) return "";
  return createHash("sha256").update(scriptText).digest("hex");
}

function buildQcRecapture({ payload = null, saveDataSource = "", scriptText = "" } = {}) {
  return {
    listRowKeys: listRowKeys(payload),
    listActionMarkup: listActionMarkup(payload),
    listDateSamples: listDateSamples(payload),
    saveDataQcdetailsKeys: parseSaveDataQcdetailsKeys(saveDataSource),
    scriptHash: scriptHash(scriptText),
  };
}

function createInPageRecaptureScript() {
  return `async function __sasvQcReadRecapture() {
    var saveDataSource = typeof window.SaveData === "function" ? String(window.SaveData) : "";
    var scripts = document.getElementsByTagName("script");
    var src = "";
    for (var i = 0; i < scripts.length; i++) {
      var candidate = scripts[i].getAttribute("src") || "";
      if (candidate.indexOf("addQCRegister") >= 0) {
        src = scripts[i].src || candidate;
        break;
      }
    }
    var scriptText = "";
    if (src) {
      try {
        var response = await fetch(src, { method: "GET", credentials: "same-origin" });
        if (response && response.ok) scriptText = await response.text();
      } catch (error) {
        scriptText = "";
      }
    }
    return { saveDataSource: saveDataSource, scriptText: scriptText };
  }
  return __sasvQcReadRecapture;`;
}

module.exports = {
  buildQcRecapture,
  createInPageRecaptureScript,
  listActionMarkup,
  listDateSamples,
  listRowKeys,
  parseSaveDataQcdetailsKeys,
  scriptHash,
};
