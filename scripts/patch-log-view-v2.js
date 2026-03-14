/**
 * Patch script v2 — position-based approach to avoid emoji anchor issues.
 * Applies three targeted patches to log-view.js.
 * Run from project root: node scripts/patch-log-view-v2.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const FILE = path.resolve(__dirname, "../public/shared/js/log-view.js");
let src = fs.readFileSync(FILE, "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// Utility: find a required anchor, abort on failure
// ─────────────────────────────────────────────────────────────────────────────
function require_anchor(label, text) {
  const idx = src.indexOf(text);
  if (idx === -1) {
    console.error(
      `FAILED [${label}]: anchor text not found:\n  ${JSON.stringify(text).slice(0, 120)}`,
    );
    process.exit(1);
  }
  return idx;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1 ── loadTable render section
//
//  Replace everything from  "tbody.replaceChildren();"  (the immediate DOM
//  clear) through the closing "}" of loadTable, with the new version that:
//    a) delays DOM clear until after transfer-history is fetched
//    b) adds movement badge rendering
//    c) adds a second version-guard after the async fetch
//
// Anchors (no emoji):
//  START : "  tbody.replaceChildren();\r\n\r\n  const rows"
//  END   : first occurrence of "\r\n// Helper: fetch ALL logs"  (start of
//           fetchAllLogs, which immediately follows loadTable's closing brace)
// ─────────────────────────────────────────────────────────────────────────────

const P1_START_ANCHOR = "  tbody.replaceChildren();\r\n\r\n  const rows";
const P1_END_ANCHOR = "\r\n\r\n// Helper: fetch ALL logs";

const p1Start = require_anchor("P1 start", P1_START_ANCHOR);
const p1End = require_anchor("P1 end", P1_END_ANCHOR);

// The replacement runs from the start anchor up to (not including) the end anchor
const OLD_P1 = src.slice(p1Start, p1End);

// Build the replacement text (CRLF throughout to match the file)
const NL = "\r\n";
const NEW_P1 = [
  "  const rows = data ? data.slice() : [];",
  "",
  "  // Update pagination total if server returned a count",
  '  if (typeof count === "number") {',
  "    totalRows = count;",
  "  } else {",
  "    // If count not available, infer whether this is the last page by rows length",
  "    if (rows.length < perPage) {",
  "      totalRows = currentPage * perPage + rows.length;",
  "    } else if (currentPage === 0 && rows.length === 0) {",
  "      totalRows = 0;",
  "    } else {",
  "      totalRows = null; // unknown",
  "    }",
  "  }",
  "",
  "  // Natural-order sort (unchanged)",
  '  const coll = new Intl.Collator("en", { numeric: true, sensitivity: "base" });',
  "  rows.sort((a, b) => {",
  "    let diff = new Date(a.log_date) - new Date(b.log_date);",
  "    if (diff) return diff;",
  "    diff = new Date(a.created_at) - new Date(b.created_at);",
  "    if (diff) return diff;",
  '    diff = a.item.localeCompare(b.item, undefined, { sensitivity: "base" });',
  "    if (diff) return diff;",
  "    diff = a.batch_number",
  "      .toString()",
  "      .localeCompare(b.batch_number.toString(), undefined, { numeric: true });",
  "    if (diff) return diff;",
  '    const sa = sectionMap[a.section_id] || "";',
  '    const sb = sectionMap[b.section_id] || "";',
  '    diff = sa.localeCompare(sb, undefined, { sensitivity: "base" });',
  "    if (diff) return diff;",
  '    const pa = a.plant_machinery?.plant_name || "";',
  '    const pb = b.plant_machinery?.plant_name || "";',
  "    return coll.compare(pa, pb);",
  "  });",
  "",
  "  /* Batch-fetch transfer history for this page (non-fatal).",
  "     Runs BEFORE clearing the DOM to avoid a flash of an empty table. */",
  "  movementLookup = {};",
  "  if (rows.length) {",
  "    try {",
  "      const xferRows = await fetchTransferHistoryForVisibleRows(rows);",
  "      movementLookup = buildTransferHistoryLookup(xferRows);",
  "    } catch (err) {",
  '      console.error("[view-logs] Movement lookup failed:", err);',
  "      // Non-fatal — movement badges simply won't appear this page load.",
  "    }",
  "  }",
  "",
  "  /* Check version again: a new request may have fired during the async",
  "     transfer-history fetch above. If so, abort — the newer request owns",
  "     the DOM. */",
  "  if (myVersion !== queryVersion) return;",
  "",
  "  /* Safe to clear and render */",
  "  tbody.replaceChildren();",
  "",
  "  rows.forEach((r) => {",
  '    const plantName = r.plant_machinery?.plant_name || "";',
  '    const sectionName = sectionMap[r.section_id] || "";',
  "    const xferRows = getTransferRowsForLogRow(r, movementLookup);",
  "    tbody.insertAdjacentHTML(",
  '      "beforeend",',
  "      `",
  "      <tr>",
  "        <td>${fmtDate(r.log_date)}</td>",
  "        <td>${r.item}</td>",
  "        <td>${r.batch_number}</td>",
  '        <td>${r.batch_size ?? ""}</td>',
  '        <td>${r.batch_uom ?? ""}</td>',
  "        <td>${sectionName}</td>",
  "        <td>${plantName}</td>",
  "        <td>${r.activity}</td>",
  '        <td>${r.status ?? ""}</td>',
  "        ${renderMovementBadge(xferRows)}",
  '        <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>',
  "      </tr>",
  "    `,",
  "    );",
  "  });",
  "",
  "  // Attach View links",
  "  document",
  '    .querySelectorAll(".view-link")',
  '    .forEach((a) => a.addEventListener("click", showDetails));',
  "",
  "  // Render pagination UI (buttons / page info)",
  "  renderPagination();",
  "}",
].join(NL);

if (OLD_P1 === NEW_P1) {
  console.log("Patch 1: already applied, skipping.");
} else {
  src = src.slice(0, p1Start) + NEW_P1 + src.slice(p1End);
  console.log("Patch 1 applied: loadTable render section updated.");
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2 ── CSV filtered-rows export: slice(0,-1) → slice(0,-2)
//   The Movement badge column now sits between Status and Action, so we need
//   to drop two trailing columns instead of one to keep the CSV clean.
// ─────────────────────────────────────────────────────────────────────────────

const OLD_CSV =
  '      // slice(0, -1) drops the last "Action" column\r\n      const cells = [...tr.cells].slice(0, -1);';
const NEW_CSV =
  "      // slice(0, -2) drops the Movement badge and Action columns\r\n      const cells = [...tr.cells].slice(0, -2);";

if (src.includes(NEW_CSV)) {
  console.log("Patch 2: already applied, skipping.");
} else if (!src.includes(OLD_CSV)) {
  console.error("FAILED [P2]: CSV slice anchor not found!");
  process.exit(1);
} else {
  src = src.replace(OLD_CSV, NEW_CSV);
  console.log("Patch 2 applied: CSV filtered-rows slice fixed.");
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 3 ── showDetails: append transfer-history fetch + render
//
// Anchor (no emoji): the closing block of rows.forEach inside showDetails,
// followed by show(overlay) and the function's closing brace.
// This is the LAST occurrence of "show(overlay);\r\n}" in the file.
// ─────────────────────────────────────────────────────────────────────────────

const OLD_SHOW_END =
  "      detailBody.insertAdjacentHTML(\r\n" +
  '        "beforeend",\r\n' +
  "        `<tr><th>${lbl}</th><td>${val}</td></tr>`,\r\n" +
  "      );\r\n" +
  "    }\r\n" +
  "  });\r\n" +
  "\r\n" +
  "  show(overlay);\r\n" +
  "}";

const NEW_SHOW_END =
  "      detailBody.insertAdjacentHTML(\r\n" +
  '        "beforeend",\r\n' +
  "        `<tr><th>${lbl}</th><td>${val}</td></tr>`,\r\n" +
  "      );\r\n" +
  "    }\r\n" +
  "  });\r\n" +
  "\r\n" +
  "  // Render FG Bulk Transfer History section (non-fatal addition)\r\n" +
  "  clearTransferHistorySection();\r\n" +
  "  try {\r\n" +
  "    const key = makeBatchItemKey(log.item, log.batch_number);\r\n" +
  "    // Use the cached page lookup when available; fall back to a focused fetch.\r\n" +
  "    let xferRows = movementLookup[key];\r\n" +
  "    if (xferRows === undefined) {\r\n" +
  "      const { data: xData, error: xErr } = await supabase\r\n" +
  '        .from("v_fg_bulk_transfer_history")\r\n' +
  "        .select(\r\n" +
  '          "id,transfer_date,item,batch_number,qty,uom," +\r\n' +
  '            "from_section_name,from_subsection_name,from_area_name,from_plant_name," +\r\n' +
  '            "to_section_name,to_subsection_name,to_area_name,to_plant_name," +\r\n' +
  '            "remarks,created_by",\r\n' +
  "        )\r\n" +
  '        .eq("item", log.item)\r\n' +
  '        .eq("batch_number", String(log.batch_number))\r\n' +
  '        .order("transfer_date", { ascending: true });\r\n' +
  "      if (xErr) {\r\n" +
  '        console.error("[view-logs] Transfer history modal fetch error:", xErr);\r\n' +
  "        xferRows = [];\r\n" +
  "      } else {\r\n" +
  "        xferRows = xData || [];\r\n" +
  "      }\r\n" +
  "    }\r\n" +
  "    appendTransferHistoryToModal(xferRows);\r\n" +
  "  } catch (err) {\r\n" +
  '    console.error("[view-logs] Transfer history modal error:", err);\r\n' +
  "    // Non-fatal — log entry details are still shown correctly.\r\n" +
  "  }\r\n" +
  "\r\n" +
  "  show(overlay);\r\n" +
  "}";

if (src.includes(NEW_SHOW_END)) {
  console.log("Patch 3: already applied, skipping.");
} else if (!src.includes(OLD_SHOW_END)) {
  console.error("FAILED [P3]: showDetails end anchor not found!");
  // debug
  const idx = src.indexOf("detailBody.insertAdjacentHTML(");
  if (idx !== -1) {
    console.log("Found detailBody block at:", idx);
    console.log("Context:", JSON.stringify(src.slice(idx, idx + 200)));
  }
  process.exit(1);
} else {
  src = src.replace(OLD_SHOW_END, NEW_SHOW_END);
  console.log("Patch 3 applied: showDetails transfer-history section added.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Write back
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, src, "utf8");
console.log("\nAll patches written successfully to", FILE);
