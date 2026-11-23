// Pure offline G7 policy helpers (no DB). Source-grounded on S1 register and C2 root cause.
export const HISTORICAL_NOT_VERIFIED = 'NOT_VERIFIED';

// Mirrors the S1 register CASE precedence (MIS_G7_S1_ROUTE_NORMALIZATION_REGISTER).
export function classifyRouteState(r) {
  if (r.bmr_matches !== 1) return 'BMR_IDENTITY_REVIEW';
  if (r.any_approved_routes === 0) return 'PRODUCT_ROUTE_COVERAGE';
  if (r.effective_approved_routes === 0) return 'EFFECTIVE_DATE_ROUTE_GAP';
  if (r.effective_approved_routes > 1) return 'APPROVED_ROUTE_OVERLAP';
  if (r.mandatory_fg_activity_steps !== 1) return 'MANDATORY_FG_STAGE_GAP';
  return 'ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED';
}
// Historical events are never promoted to signed by correlation alone.
export const historicalVerification = (r, signedEvent) =>
  classifyRouteState(r) === 'ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED' && signedEvent ? 'SIGNED' : HISTORICAL_NOT_VERIFIED;

// C3: SKU packaging line -> expected base depletion (count x pack_size x conversion), same as trg_fg_ledger_from_es.
export function expectedDepletionBase(line) {
  const per = line.sku_uom === line.base_uom ? line.pack_size : line.pack_size * (line.conversion_to_base ?? 1);
  return -(line.count * per);
}
// A line is a C3 exception iff there is no ledger movement referencing event_skus/<id>.
export function classifyPackLines(lines, ledger) {
  const seen = new Set(ledger.filter((m) => m.source_table === 'event_skus').map((m) => m.source_id));
  return lines.map((l) => ({ ...l, class: seen.has(l.id) ? 'DEPLETION_PRESENT' : 'C3_MISSING_DEPLETION' }));
}
// Offline replay PLAN only (never writes). Idempotent: lines already depleted or already
// planned produce nothing. It emits only depletion rows (negative); it can never emit a
// receipt, and never derives receipts from pack-unit counts.
export function planReplay(lines, ledger, replayedKeys = new Set()) {
  const out = [];
  for (const l of classifyPackLines(lines, ledger)) {
    const key = `c3-replay:event_skus:${l.id}`;
    if (l.class !== 'C3_MISSING_DEPLETION' || replayedKeys.has(key)) continue;
    const qty = expectedDepletionBase(l);
    if (!(qty < 0)) continue;
    out.push({ idempotency_key: key, source_table: 'event_skus', source_id: l.id, product_id: l.product_id,
      batch_number: l.batch_number, qty_base: qty, requires_signed_source_evidence: true });
  }
  return out;
}
