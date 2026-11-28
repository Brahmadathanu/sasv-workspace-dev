export const CLASS_DIMENSIONS = [
  ["region_id", "Region", "regions", "name"],
  ["godown_id", "Godown", "godowns", "name"],
  ["district_id", "District", "districts", "district_name"],
  ["area_id", "Area", "areas", "area_name"],
  ["type_id", "Debtor type", "types", "name"],
];

export const KYC_ROUTE = "#finance/debtor-kyc";
export const INCOMPLETE_KYC_ROUTE = KYC_ROUTE + "?partition=unclassified";
export const isKycRoute = (hash) => hash === KYC_ROUTE || hash === INCOMPLETE_KYC_ROUTE;
export const roleAccess = (permissions, target) => {
  const role = permissions.find((row) => row?.target === target);
  return { view: !!(role?.can_view || role?.can_edit), edit: !!role?.can_edit };
};

export function classificationOptions(lookups, key, values) {
  const dimension = CLASS_DIMENSIONS.find(([id]) => id === key);
  return (lookups?.[dimension[2]] || []).filter((row) => {
    if (row.is_active === false) return false;
    if (key === "godown_id") return String(row.region_id) === String(values.region_id) && !!values.region_id;
    if (key === "district_id") {
      return String(row.region_id) === String(values.region_id) && !!values.godown_id &&
        (lookups.coverage || []).some((link) => link.is_active && String(link.godown_id) === String(values.godown_id) && String(link.district_id) === String(row.id));
    }
    if (key === "area_id") return String(row.district_id) === String(values.district_id) && !!values.district_id;
    return true;
  });
}

export function changeClassification(values, key, value) {
  const path = CLASS_DIMENSIONS.slice(0, 4).map(([id]) => id);
  const next = { ...values, [key]: value || null };
  if (path.includes(key)) for (const child of path.slice(path.indexOf(key) + 1)) next[child] = null;
  return next;
}

export function classificationArgs(values) {
  if (values.partition === "unclassified") return { p_partition: "unclassified" };
  const args = Object.fromEntries(CLASS_DIMENSIONS.filter(([key]) => values[key]).map(([key]) => [`p_${key}`, Number(values[key])]));
  if (values.partition === "classified") args.p_partition = "classified";
  return args;
}

export function debtorError(error) {
  if (error?.code === "40001") return "This record changed. Reload the current version and reconcile your edits.";
  if (error?.code === "23505") return "This identity or master key is already assigned.";
  if (error?.code === "23514") return "The values violate a classification or policy constraint.";
  if (error?.code === "23P01") return "The effective dates overlap an existing policy.";
  if (error?.code === "42501" || error?.status === 403) return "Your account does not have permission for this action.";
  return "The request failed. Check the values and retry.";
}

export async function collectBillPages(read, scope) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = new Map();
    let date, total, groups, offset = 0;
    do {
      const page = await read("get_mis_finance_bill_page", { ...scope, p_limit: 500, p_offset: offset });
      const pageDate = page.rows[0]?.report_date;
      if (offset === 0) {
        date = pageDate;
        total = Number(page.total_rows);
        groups = page.groups;
      }
      if (Number(page.total_rows) !== total || (page.rows.length && pageDate !== date) || (!page.rows.length && offset < total)) break;
      for (const bill of page.rows) rows.set(bill.bill_id, bill);
      offset += page.rows.length;
      if (offset >= total && rows.size === total) return { rows: [...rows.values()], groups, date };
    } while (offset < total);
  }
  throw new Error("The outstanding snapshot changed during export. Retry once the snapshot is stable.");
}
