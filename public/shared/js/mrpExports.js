function createAndClickBlob(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(s) {
  if (!s) return "download";
  return String(s).replace(/[^a-z0-9_.-]/gi, "_");
}

export function downloadJSON(filename, data) {
  const name = safeFilename(filename || "data") + ".json";
  try {
    createAndClickBlob(JSON.stringify(data, null, 2), "application/json", name);
  } catch (e) {
    console.debug("downloadJSON failed", e);
  }
}

export function downloadCSV(filename, rows) {
  const name = safeFilename(filename || "data") + ".csv";
  if (!Array.isArray(rows)) rows = [];
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [];
  if (keys.length) lines.push(keys.join(","));
  rows.forEach((r) => {
    const row = keys.map((k) => esc(r[k]));
    lines.push(row.join(","));
  });
  createAndClickBlob(lines.join("\n"), "text/csv", name);
}

export function exportRunFilenames({ kind, runId }) {
  const id = runId || "run";
  const base = `${kind}_${id}`;
  return {
    runJson: `${base}_run.json`,
    monthlyJson: `${base}_monthly.json`,
    runCsv: `${base}_run.csv`,
  };
}
