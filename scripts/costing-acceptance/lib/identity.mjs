// Identity proof for the acceptance runner. FAIL CLOSED: an identity is accepted only when (1) the session's own permission read and (2) an
// owner-supplied canonical extract agree exactly, and (3) both show the required shape with ZERO edit grants anywhere.
export const COSTING_TARGETS = Object.freeze(["module:costing-control-center", "module:material-cost-manager", "module:cost-build-manager", "module:pricing-policy-manager", "module:cost-sheet-review", "module:production-route-manager"]);
const key = (r) => `${r.target}|${r.can_view === true}|${r.can_edit === true}`;
const normalise = (rows) => (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.target === "string").map((r) => ({ target: r.target, can_view: r.can_view === true, can_edit: r.can_edit === true }));

/** @returns {{ok:boolean, failures:string[], summary:object}} */
export function evaluateIdentity({ label, sessionRows, canonicalRows }) {
  const failures = [];
  if (!["ID-V", "ID-N"].includes(label)) failures.push(`unknown identity label ${JSON.stringify(label)} (expected ID-V or ID-N)`);
  if (!Array.isArray(sessionRows)) failures.push("the session's permission read returned no rows array");
  if (!Array.isArray(canonicalRows)) failures.push("no canonical permission extract supplied (--canonical-proof)");
  if (failures.length) return { ok: false, failures, summary: {} };
  const s = normalise(sessionRows), c = normalise(canonicalRows);
  const sk = new Set(s.map(key)), ck = new Set(c.map(key));
  const onlyS = [...sk].filter((x) => !ck.has(x)), onlyC = [...ck].filter((x) => !sk.has(x));
  if (onlyS.length || onlyC.length) failures.push(`session permissions and canonical extract disagree (${onlyS.length} only in session, ${onlyC.length} only in canonical)`);
  const edits = s.filter((r) => r.can_edit).concat(c.filter((r) => r.can_edit));
  if (edits.length) failures.push(`edit grants present (${new Set(edits.map((r) => r.target)).size} target(s)): an identity with ANY edit grant cannot prove read-only`);
  const costing = (rows) => rows.filter((r) => COSTING_TARGETS.includes(r.target));
  if (label === "ID-V") {
    for (const t of COSTING_TARGETS) for (const [src, rows] of [["session", s], ["canonical", c]]) if (!rows.some((r) => r.target === t && r.can_view && !r.can_edit)) failures.push(`${src}: ${t} is not can_view=true, can_edit=false`);
    const extra = s.filter((r) => !COSTING_TARGETS.includes(r.target) && r.can_view);
    if (extra.length) failures.push(`ID-V must hold only the six Costing grants; found ${extra.length} other viewable target(s)`);
  } else if (label === "ID-N") {
    for (const [src, rows] of [["session", s], ["canonical", c]]) if (costing(rows).some((r) => r.can_view || r.can_edit)) failures.push(`${src}: ID-N must hold no Costing permission`);
  }
  return { ok: failures.length === 0, failures, summary: { label, session_rows: s.length, canonical_rows: c.length, edit_grants: edits.length, costing_view_grants: costing(s).filter((r) => r.can_view).length } };
}
