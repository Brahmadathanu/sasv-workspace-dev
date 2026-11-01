// Pass-through of server status/display fields. No client derivation of eligibility or dates.

export function pickPeriodDisplayLabel(row) {
  if (!row) return "";
  const v2 = String(row.display_label_v2 || "").trim();
  if (v2) return v2;
  return String(row.display_label || "").trim();
}

export function pickPricingUseLabel(row) {
  if (!row) return "";
  return String(row.pricing_use_label || "").trim();
}

export function pickRunDisplayLabel(row) {
  if (!row) return "";
  return String(row.display_label || "").trim();
}

export function pickRunDisplayStatus(row) {
  if (!row) return "";
  return String(row.display_status || "").trim();
}

export function isDraftRunRow(row) {
  return pickRunDisplayStatus(row) === "Draft";
}

export function formatOfficialValuationDate(row) {
  if (!row) return "Not approved";
  const value = row.official_valuation_date;
  if (value == null || value === "") return "Not approved";
  return String(value);
}

export function formatLatestDraftValuationDate(row) {
  if (!row) return "—";
  const value = row.latest_draft_valuation_date;
  if (value == null || value === "") return "—";
  return String(value);
}

export function describeRunStatusForApprovalFlag(row) {
  if (!row) {
    return {
      text: "Run status unavailable",
      tone: "empty",
      title: "No run status for this month.",
    };
  }
  const text =
    pickPeriodDisplayLabel(row) ||
    String(row.display_label || "").trim() ||
    "Run status unavailable";
  const pricing = pickPricingUseLabel(row);
  const official = formatOfficialValuationDate(row);
  const draft = formatLatestDraftValuationDate(row);
  const parts = [text];
  if (pricing) parts.push(pricing);
  parts.push(`Official (approved) date: ${official}.`);
  parts.push(`Latest draft date: ${draft}.`);
  const state = String(row.display_state || "");
  let tone = "draft";
  if (state === "APPROVED") tone = "approved";
  else if (state === "APPROVED_NEWER_DRAFT") tone = "approved-pending";
  else if (state === "NO_SUCCESSFUL_RUN") tone = "empty";
  return { text, tone, title: parts.join(" ") };
}
