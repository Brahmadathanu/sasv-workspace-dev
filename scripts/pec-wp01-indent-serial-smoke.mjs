/**
 * PEC WP01 — canonical indent serial display smoke.
 * No network, no Supabase calls, no database changes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  join(root, "public/shared/js/procurement-execution-console.js"),
  "utf8",
);
const hubSrc = readFileSync(
  join(root, "public/utilities-hub/js/hub-auth.js"),
  "utf8",
);
const registrySrc = readFileSync(
  join(root, "public/shared/js/module-registry.js"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const fails = [];
const assert = (cond, msg) => {
  if (!cond) fails.push(msg);
};

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const paren = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let i = paren; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") parenDepth += 1;
    else if (ch === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf("{", i);
        break;
      }
    }
  }
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

function extractNamed(source, name) {
  const fn = extractFunction(source, name);
  assert(Boolean(fn), `${name} is defined`);
  return fn;
}

const helperSrc = [
  extractNamed(src, "canonicalIndentLineSortNo"),
  extractNamed(src, "formatIndentLineSortLabel"),
  extractNamed(src, "formatIndentWithSerial"),
  extractNamed(src, "normalizeVwlBreakdown"),
  extractNamed(src, "breakdownToCompactText"),
  extractNamed(src, "createIndentLineRow"),
  extractNamed(src, "renderIndentLines"),
  extractNamed(src, "updateIndentLinesCountUi"),
  extractNamed(src, "renderIndentLinesInfinite"),
  extractNamed(src, "formatVwlIndentSplitEntry"),
  extractNamed(src, "esc"),
  extractNamed(src, "pdfSafeText"),
].join("\n");

const prelude = `
class FakeEl {
  constructor(tag) {
    this.tagName = tag;
    this.style = {};
    this.children = [];
    this._html = "";
    this.parentElement = null;
    this.listeners = {};
  }
  get innerHTML() {
    return this._html;
  }
  set innerHTML(value) {
    this._html = String(value ?? "");
    if (this._html === "") this.children = [];
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  querySelectorAll() {
    return this.children;
  }
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }
}
const document = { createElement(tag) { return new FakeEl(tag); } };
function fmt(value) { return String(value ?? ""); }
function displayMaterialClassCode(value) { return String(value ?? ""); }
const nodes = {
  iLinesEmpty: { style: {} },
  iLinesTable: { style: {} },
  iLinesTbody: new FakeEl("tbody"),
  iLinesCount: { textContent: "", title: "" },
  iBtnEditLineQty: { disabled: false },
};
function qs(id) { return nodes[id]; }
const state = {
  selectedIndentLine: null,
  selectedIndent: { status: "approved" },
  indentLinesRows: [],
};
const iLinePageSize = 1;
let iLineVisibleCount = 0;
let iLineFilteredRows = [];
function resetTbody() {
  nodes.iLinesTbody = new FakeEl("tbody");
}
`;

let api = null;
try {
  api = new Function(
    `${prelude}\n${helperSrc}\nreturn {\n  canonicalIndentLineSortNo,\n  formatIndentLineSortLabel,\n  formatIndentWithSerial,\n  normalizeVwlBreakdown,\n  breakdownToCompactText,\n  createIndentLineRow,\n  renderIndentLines,\n  renderIndentLinesInfinite,\n  formatVwlIndentSplitEntry,\n  esc,\n  nodes,\n  state,\n  resetTbody,\n  get visible() { return iLineVisibleCount; },\n  set visible(value) { iLineVisibleCount = value; },\n  get filtered() { return iLineFilteredRows; },\n  set filtered(value) { iLineFilteredRows = value; },\n};`,
  )();
} catch (err) {
  assert(false, `helper eval failed: ${err.message}`);
}

function firstCell(rowEl) {
  const match = String(rowEl?.innerHTML || "").match(
    /<td class="muted" style="text-align:center">([^<]*)<\/td>/,
  );
  return match ? match[1] : "";
}

if (api) {
  const {
    canonicalIndentLineSortNo,
    formatIndentWithSerial,
    normalizeVwlBreakdown,
    breakdownToCompactText,
    renderIndentLines,
    renderIndentLinesInfinite,
    formatVwlIndentSplitEntry,
    esc,
    nodes,
    state,
    resetTbody,
  } = api;

  assert(canonicalIndentLineSortNo(15) === 15, "integer 15 stays 15");
  assert(
    canonicalIndentLineSortNo("15") === 15,
    "canonical integer text 15 stays 15",
  );
  assert(canonicalIndentLineSortNo(" 15 ") === 15, "trimmed integer text 15");
  assert(canonicalIndentLineSortNo(0) === 0, "integer 0 is preserved");
  for (const invalid of [null, undefined, "", "15abc", "15.0", "015", 15.5, true, NaN, Infinity]) {
    assert(
      canonicalIndentLineSortNo(invalid) === null,
      `invalid serial ${String(invalid)} is not synthesized`,
    );
  }

  assert(
    formatIndentWithSerial("193", 15) === "193 (15)",
    "indent 193 serial 15 displays 193 (15)",
  );
  assert(
    formatIndentWithSerial(193, "15") === "193 (15)",
    "numeric indent and text serial display 193 (15)",
  );
  assert(
    formatIndentWithSerial("193", null) === "193 (unavailable)",
    "missing serial is unavailable",
  );
  assert(
    esc(formatIndentWithSerial("193 <cap>", 15)) === "193 &lt;cap&gt; (15)",
    "indent display text is escaped by the modal caller",
  );

  const payload = [
    {
      indent_number: "193",
      indent_id: 193,
      indent_line_id: 1001,
      indent_line_sort_no: 15,
      qty_to_buy: 4,
      uom_code: "NOS",
      rate_value: 1.25,
      line_amount: 5,
      actual_vendor_name: "Acme",
      assignment_status: "assigned",
    },
    {
      indent_number: "194",
      indent_line_id: 1002,
      indent_line_sort_no: 2,
      qty_to_buy: 8,
      uom_code: "NOS",
    },
    {
      indent_number: "195",
      indent_line_id: 1003,
      qty_to_buy: 1,
    },
  ];

  for (const source of [payload, JSON.stringify(payload)]) {
    const rows = normalizeVwlBreakdown(source);
    assert(rows.length === 3, "breakdown keeps every indent line");
    assert(rows[0].indent_line_sort_no === 15, "first serial stays 15");
    assert(rows[1].indent_line_sort_no === 2, "second serial stays 2");
    assert(rows[2].indent_line_sort_no === null, "absent serial stays null");
    assert(rows[0].qty_to_buy === 4, "quantity is unchanged");
    assert(rows[0].rate_value === 1.25, "rate is unchanged");
    assert(rows[0].line_amount === 5, "amount is unchanged");
    assert(rows[0].actual_vendor_name === "Acme", "vendor is unchanged");
    assert(rows[0].indent_line_id === 1001, "line identity is unchanged");
    assert(
      formatIndentWithSerial(rows[0].indent_number, rows[0].indent_line_sort_no) ===
        "193 (15)",
      "normalized 193 / 15 formats 193 (15)",
    );
    assert(
      formatIndentWithSerial(rows[1].indent_number, rows[1].indent_line_sort_no) ===
        "194 (2)",
      "each breakdown line keeps its own serial",
    );
    assert(
      formatIndentWithSerial(rows[2].indent_number, rows[2].indent_line_sort_no) ===
        "195 (unavailable)",
      "line without a serial is not numbered 3",
    );
  }

  assert(
    breakdownToCompactText(payload) ===
      "4 NOS [193 (15)]; 8 NOS [194 (2)]; 1 [195 (unavailable)]",
    "compact export uses canonical serials",
  );
  assert(
    formatVwlIndentSplitEntry(payload[0], {}) === "4 NOS [193 (15)]",
    "pdf split uses canonical serial",
  );
  assert(
    formatVwlIndentSplitEntry({ qty_to_buy: 1 }, {}) === "",
    "pdf split does not invent an indent",
  );

  const cap = {
    indent_line_id: 1001,
    indent_line_sort_no: 15,
    stock_item_name: "28 MM ROPP Cap <cap>",
    material_class_code: "PM",
    uom_code: "NOS",
    requested_qty: 4,
    allocated_qty: 0,
    remaining_qty: 4,
  };
  const other = {
    indent_line_id: 1002,
    indent_line_sort_no: 28,
    stock_item_name: "Other",
    material_class_code: "PM",
    uom_code: "NOS",
    requested_qty: 1,
    allocated_qty: 0,
    remaining_qty: 1,
  };
  const missing = {
    indent_line_id: 1003,
    stock_item_name: "No serial",
    material_class_code: "PM",
    uom_code: "NOS",
    requested_qty: 1,
    allocated_qty: 0,
    remaining_qty: 1,
  };

  resetTbody();
  renderIndentLines([cap]);
  assert(nodes.iLinesTbody.children.length === 1, "initial render shows one row");
  assert(firstCell(nodes.iLinesTbody.children[0]) === "15", "single search hit shows # 15");
  assert(
    nodes.iLinesTbody.children[0].innerHTML.includes("28 MM ROPP Cap &lt;cap&gt;"),
    "item name stays escaped",
  );
  nodes.iLinesTbody.children[0].listeners.click();
  assert(state.selectedIndentLine === cap, "row click keeps the same line record");

  resetTbody();
  state.indentLinesRows = [cap, other];
  api.filtered = [cap, other];
  api.visible = 1;
  renderIndentLinesInfinite();
  assert(nodes.iLinesTbody.children.length === 1, "first page shows one row");
  assert(firstCell(nodes.iLinesTbody.children[0]) === "15", "first page serial is 15");
  api.visible = 2;
  renderIndentLinesInfinite({ appendOnly: true });
  assert(nodes.iLinesTbody.children.length === 2, "append adds one row");
  assert(firstCell(nodes.iLinesTbody.children[0]) === "15", "append keeps the first serial");
  assert(firstCell(nodes.iLinesTbody.children[1]) === "28", "appended serial is 28, not 2");

  api.filtered = [other];
  api.visible = 1;
  renderIndentLinesInfinite();
  assert(nodes.iLinesTbody.children.length === 1, "filter replace does not duplicate rows");
  assert(firstCell(nodes.iLinesTbody.children[0]) === "28", "filtered line keeps serial 28");

  api.filtered = [missing];
  api.visible = 1;
  renderIndentLinesInfinite();
  assert(
    firstCell(nodes.iLinesTbody.children[0]) === "unavailable",
    "missing opened-indent serial is unavailable, not 1",
  );

  api.filtered = [cap, other];
  api.visible = 2;
  renderIndentLinesInfinite();
  assert(nodes.iLinesTbody.children.length === 2, "filter clear does not duplicate rows");
  assert(firstCell(nodes.iLinesTbody.children[0]) === "15", "cleared list still shows 15");
  assert(firstCell(nodes.iLinesTbody.children[1]) === "28", "cleared list still shows 28");
}

const renderFn = extractFunction(src, "renderIndentLines");
const infiniteFn = extractFunction(src, "renderIndentLinesInfinite");
const openFn = extractFunction(src, "openVwlBreakdown");
assert(!renderFn.includes("idx + 1"), "initial indent lines do not number by index");
assert(renderFn.includes("createIndentLineRow"), "initial render uses the shared row");
assert(
  !infiniteFn.includes("startAt + idx"),
  "append path does not number by offset",
);
assert(infiniteFn.includes("createIndentLineRow"), "append path uses the shared row");
assert(
  openFn.includes(
    "esc(formatIndentWithSerial(item.indent_number, item.indent_line_sort_no))",
  ),
  "buying-list modal escapes the canonical indent serial",
);
assert(
  /CACHE_NAME = "hub-cache-v343"/.test(swSrc),
  "service worker cache generation is unchanged",
);
assert(
  (hubSrc.match(/addEventListener\("visibilitychange"/g) || []).length === 1,
  "hub keeps a single visibilitychange listener",
);
assert(
  (hubSrc.match(/addEventListener\("pageshow"/g) || []).length === 1,
  "hub keeps a single pageshow listener",
);
assert(
  registrySrc.includes('if (minNavMode === "read") return "read";'),
  "registry read mode mapping is unchanged",
);

if (fails.length) {
  console.error(fails.map((msg) => `- ${msg}`).join("\n"));
  process.exit(1);
}

console.log("pec-wp01-indent-serial-smoke: PASS");
