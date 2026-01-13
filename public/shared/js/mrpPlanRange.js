export function monthInputToDateString(yyyyMm) {
  if (!yyyyMm) return null;
  return `${yyyyMm}-01`;
}

export function addMonthsToYYYYMM(yyyyMm, delta) {
  if (!yyyyMm) return null;
  const [y, m] = String(yyyyMm).split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export function monthLabel(dateOrString) {
  if (!dateOrString && dateOrString !== 0) return "-";
  try {
    const d =
      dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
    if (Number.isNaN(d.getTime())) return String(dateOrString);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch {
    return String(dateOrString);
  }
}

export function planRangeLabel(startDateStr, endDateStr) {
  if (!startDateStr && !endDateStr) return "";
  const s = monthLabel(startDateStr) || startDateStr || "-";
  const e = monthLabel(endDateStr) || endDateStr || "-";
  if (!endDateStr) return s;
  return `${s} → ${e}`;
}

export function computePresetRange(
  presetKey,
  selectedStartYYYYMM,
  selectedYear
) {
  switch (presetKey) {
    case "next12": {
      const start = selectedStartYYYYMM;
      const end = addMonthsToYYYYMM(start, 11);
      return { start, end };
    }
    case "calendarYear": {
      const year = Number(selectedYear) || new Date().getFullYear();
      return { start: `${year}-01`, end: `${year}-12` };
    }
    default:
      return { start: selectedStartYYYYMM || null, end: null };
  }
}
