/**
 * Patch script: add FG Bulk Transfer History awareness to log-view.js
 * Run once from the project root: node scripts/patch-log-view.js
 *
 * Uses position-based slicing to avoid emoji-encoding issues
 * that frustrate anchored string replacements.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "../public/shared/js/log-view.js");

let src = fs.readFileSync(filePath, "utf8");

// ──────────────────────────────────────────────────────────────────────────────
// PATCH 1 – Replace the loadTable steps 5–end section
//   Old: clears tbody immediately then renders (no transfer-history fetch)
//   New: sorts, fetches transfer history, checks version again, clears + renders
// ──────────────────────────────────────────────────────────────────────────────

// We anchor on the unique block that starts with tbody.replaceChildren() and
// ends with the closing brace of loadTable (just before fetchAllLogs).
// The anchor avoids emoji characters entirely.

const OLD_RENDER = [
  "  tbody.replaceChildren();",
  "",
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
  "  /* 7\u20E3 \u2013 Natural-order sort (unchanged) */",
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
  "  /* 8\u20E3 \u2013 Render rows (unchanged) */",
  "  rows.forEach((r) => {",
  '    const plantName = r.plant_machinery?.plant_name || "";',
  '    const sectionName = sectionMap[r.section_id] || "";',
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
  '        <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>',
  "      </tr>",
  "    `,",
  "    );",
  "  });",
  "",
  "  /* 9\u20E3 \u2013 Attach \u201CView\u201D links (unchanged) */",
  "  document",
  '    .querySelectorAll(".view-link")',
  '    .forEach((a) => a.addEventListener("click", showDetails));',
  "",
  "  // Render pagination UI (buttons / page info)",
  "  renderPagination();",
  "}",
].join("\r\n");

const NEW_RENDER = [
  "  /* 6\u20E3 \u2013 Process rows (sort + pagination count) without touching the DOM yet */",
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
  "  /* 7\u20E3 \u2013 Natural-order sort (unchanged) */",
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
  "  /* 8\u20E3 \u2013 Batch-fetch transfer history for this page (non-fatal).",
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
  "  /* 9\u20E3 \u2013 Safe to clear and render */",
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
  '  /* \uD83D\uDD1F \u2013 Attach "View" links */',
  "  document",
  '    .querySelectorAll(".view-link")',
  '    .forEach((a) => a.addEventListener("click", showDetails));',
  "",
  "  // Render pagination UI (buttons / page info)",
  "  renderPagination();",
  "}",
].join("\r\n");

// ──────────────────────────────────────────────────────────────────────────────
// PATCH 2 – Fix CSV filtered-rows export: slice(0,-1) → slice(0,-2)
//   (Movement column sits between Status and Action; need to drop both)
// ──────────────────────────────────────────────────────────────────────────────

const OLD_CSV_SLICE = [
  "    rowsData = [...tbody.rows].map((tr) => {",
  '      // slice(0, -1) drops the last "Action" column',
  "      const cells = [...tr.cells].slice(0, -1);",
  "      return cells.map((td) => td.textContent.trim());",
  "    });",
].join("\r\n");

const NEW_CSV_SLICE = [
  "    rowsData = [...tbody.rows].map((tr) => {",
  "      // slice(0, -2) drops the Movement badge and Action columns",
  "      const cells = [...tr.cells].slice(0, -2);",
  "      return cells.map((td) => td.textContent.trim());",
  "    });",
].join("\r\n");

// ──────────────────────────────────────────────────────────────────────────────
// PATCH 3 – showDetails: add transfer-history fetch + render after details table
// ──────────────────────────────────────────────────────────────────────────────

const OLD_SHOW_DETAILS_END = [
  "  rows.forEach(([lbl, val]) => {",
  '    if (val !== null && val !== undefined && val !== "") {',
  "      detailBody.insertAdjacentHTML(",
  '        "beforeend",',
  "        `<tr><th>${lbl}</th><td>${val}</td></tr>`,",
  "      );",
  "    }",
  "  });",
  "",
  "  show(overlay);",
  "}",
].join("\r\n");

const NEW_SHOW_DETAILS_END = [
  "  rows.forEach(([lbl, val]) => {",
  '    if (val !== null && val !== undefined && val !== "") {',
  "      detailBody.insertAdjacentHTML(",
  '        "beforeend",',
  "        `<tr><th>${lbl}</th><td>${val}</td></tr>`,",
  "      );",
  "    }",
  "  });",
  "",
  "  // Render FG Bulk Transfer History section (non-fatal addition)",
  "  clearTransferHistorySection();",
  "  try {",
  "    const key = makeBatchItemKey(log.item, log.batch_number);",
  "    // Prefer the cached lookup from the current page; fall back to a focused",
  "    // fetch when the log row was not in the most-recent page load.",
  "    let xferRows = movementLookup[key];",
  "    if (xferRows === undefined) {",
  "      const { data: xData, error: xErr } = await supabase",
  '        .from("v_fg_bulk_transfer_history")',
  "        .select(",
  '          "id,transfer_date,item,batch_number,qty,uom," +',
  '            "from_section_name,from_subsection_name,from_area_name,from_plant_name," +',
  '            "to_section_name,to_subsection_name,to_area_name,to_plant_name," +',
  '            "remarks,created_by",',
  "        )",
  '        .eq("item", log.item)',
  '        .eq("batch_number", String(log.batch_number))',
  '        .order("transfer_date", { ascending: true });',
  "      if (xErr) {",
  '        console.error("[view-logs] Transfer history modal fetch error:", xErr);',
  "        xferRows = [];",
  "      } else {",
  "        xferRows = xData || [];",
  "      }",
  "    }",
  "    appendTransferHistoryToModal(xferRows);",
  "  } catch (err) {",
  '    console.error("[view-logs] Transfer history modal error:", err);',
  "    // Non-fatal — log entry details are still shown correctly.",
  "  }",
  "",
  "  show(overlay);",
  "}",
].join("\r\n");

// ──────────────────────────────────────────────────────────────────────────────
// Apply patches
// ──────────────────────────────────────────────────────────────────────────────

let patched = src;

// Patch 1
if (!patched.includes(OLD_RENDER)) {
  // Try normalizing line endings in the search string to match file
  console.error("PATCH 1: anchor text not found in file!");
  // Print first 200 chars of what we're looking for vs what's in the file
  const idx = patched.indexOf("tbody.replaceChildren()");
  console.log("Found tbody.replaceChildren() at index:", idx);
  console.log(
    "File chars at that position:",
    JSON.stringify(patched.slice(idx, idx + 60)),
  );
  console.log("Looking for:", JSON.stringify(OLD_RENDER.slice(0, 60)));
  process.exit(1);
}
patched = patched.replace(OLD_RENDER, NEW_RENDER);
console.log("Patch 1 applied: loadTable render section updated.");

// Patch 2
if (!patched.includes(OLD_CSV_SLICE)) {
  console.error("PATCH 2: CSV slice anchor not found!");
  process.exit(1);
}
patched = patched.replace(OLD_CSV_SLICE, NEW_CSV_SLICE);
console.log("Patch 2 applied: CSV filtered-rows slice fixed.");

// Patch 3
if (!patched.includes(OLD_SHOW_DETAILS_END)) {
  console.error("PATCH 3: showDetails end anchor not found!");
  process.exit(1);
}
patched = patched.replace(OLD_SHOW_DETAILS_END, NEW_SHOW_DETAILS_END);
console.log("Patch 3 applied: showDetails transfer-history section added.");

fs.writeFileSync(filePath, patched, "utf8");
console.log("All patches written successfully to", filePath);
