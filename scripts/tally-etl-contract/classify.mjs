// DRAFT (AU-3b). Mirrors costing.fn_tally_classify_export_window. Not wired into any worker.
// Indian FY starts 1 April.
const iso = (d) => d.toISOString().slice(0, 10);
const D = (s) => (s ? new Date(s + 'T00:00:00Z') : null);
export function fyStart(s) {
  const d = D(s); const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-04-01`;
}
export function monthStart(s) { return s.slice(0, 8) + '01'; }

/** Classify one export. Returns {status, basis, reason}.
 *  status: ACCEPTED | REJECTED_AMBIGUOUS | REJECTED_INCONSISTENT */
export function classifyExportWindow({ declaredBasis, requestedFrom, requestedTo, returnedFrom, returnedTo, asOfDate }) {
  const rej = (status, reason) => ({ status, basis: null, reason });
  if (!requestedFrom || !requestedTo) return rej('REJECTED_AMBIGUOUS', 'requested range missing');
  if (!returnedFrom || !returnedTo) return rej('REJECTED_AMBIGUOUS', 'returned range missing');
  if (returnedFrom > returnedTo) return rej('REJECTED_INCONSISTENT', 'period_from after period_to');
  if (requestedFrom !== returnedFrom || requestedTo !== returnedTo)
    return rej('REJECTED_INCONSISTENT', 'requested range differs from returned range');
  if (returnedTo !== asOfDate) return rej('REJECTED_INCONSISTENT', 'period_to differs from as_of_date');
  if (fyStart(returnedFrom) !== fyStart(returnedTo)) return rej('REJECTED_INCONSISTENT', 'window crosses FY start');
  const isFytd = returnedFrom === fyStart(returnedTo);
  const isMtd = returnedFrom === monthStart(returnedTo);
  if (!isFytd && !isMtd) return rej('REJECTED_AMBIGUOUS', `window starts ${returnedFrom}: neither FY start nor month start`);
  if (declaredBasis === 'FYTD' && !isFytd) return rej('REJECTED_INCONSISTENT', 'declared FYTD but dates prove MTD');
  if (declaredBasis === 'MTD' && !isMtd) return rej('REJECTED_INCONSISTENT', 'declared MTD but dates prove FYTD');
  if (!['FYTD', 'MTD'].includes(declaredBasis)) return rej('REJECTED_AMBIGUOUS', 'declared basis missing');
  return { status: 'ACCEPTED', basis: declaredBasis, reason: 'window proven by explicit dates' };
}

/** Build the explicit request range for a basis (what the worker must send to Tally). */
export function requestWindow(basis, asOfDate) {
  if (basis === 'FYTD') return { from: fyStart(asOfDate), to: asOfDate };
  if (basis === 'MTD') return { from: monthStart(asOfDate), to: asOfDate };
  throw new Error('basis must be FYTD or MTD');
}

/** Extract the range Tally reports back. ASSUMPTION to verify on a real raw response:
 *  SVFROMDATE/SVTODATE (YYYYMMDD) echoed in the response. Returns nulls if absent -> AMBIGUOUS. */
export function extractReturnedRange(xml) {
  const g = (t) => { const m = xml.match(new RegExp(`<${t}[^>]*>\\s*(\\d{8})\\s*</${t}>`, 'i')); return m ? `${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}` : null; };
  return { returnedFrom: g('SVFROMDATE'), returnedTo: g('SVTODATE') };
}
export { iso };
