// #282 timing-sample analysis. Pure functions: no network, no DB, no credentials. Never emits "PASS" for a timing gate.
export const TARGET_MS = 4000;
export const MIN_SAMPLES_FOR_P95 = 20;      // nearest-rank p95 of n<20 is just the maximum; refuse to call that a percentile
export const MAX_SAMPLES_TOTAL = 1000;
export const MAX_EXECUTE_SAMPLES = 30;      // hard bound for any harness-driven run
export const REQUIRED_PERIODS = ["2026-11-01", "2026-10-01", "2026-09-01"];
export const DEFAULT_OCT_TOLERANCE = null;  // No owner-approved October non-regression tolerance exists: require explicit policy
const SENSITIVE_KEY = /jwt|token|authori[sz]ation|api[-_]?key|apikey|password|passwd|secret|cookie|email|bearer|session/i;
const JWT_LIKE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\./;
const ALLOWED_TOP = new Set(["schema", "unit", "environment", "samples"]);
const ALLOWED_SAMPLE = new Set(["variant", "period", "temperature", "duration", "source"]);

export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const rank = Math.ceil((p / 100) * sortedAsc.length);   // nearest-rank
  return sortedAsc[Math.min(sortedAsc.length, Math.max(1, rank)) - 1];
}

function scanSensitive(v, path = "$") {
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (SENSITIVE_KEY.test(k)) throw new Error(`rejected: sensitive-looking key at ${path}.${k}`);
      scanSensitive(x, `${path}.${k}`);
    }
  } else if (typeof v === "string" && JWT_LIKE.test(v)) throw new Error(`rejected: JWT-like value at ${path}`);
}

/** Validate + normalise to milliseconds. Throws on anything ambiguous (notably a missing unit, the 5.75 'seconds?' problem). */
export function normaliseSamples(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new Error("input must be an object");
  scanSensitive(doc);
  for (const k of Object.keys(doc)) if (!ALLOWED_TOP.has(k)) throw new Error(`unexpected top-level key: ${k}`);
  if (doc.schema !== "csr-timing-samples/v1") throw new Error("schema must be csr-timing-samples/v1");
  if (doc.unit !== "ms" && doc.unit !== "s") throw new Error("unit is required and must be 'ms' or 's' (never guessed)");
  if (!Array.isArray(doc.samples) || doc.samples.length === 0) throw new Error("samples must be a non-empty array");
  if (doc.samples.length > MAX_SAMPLES_TOTAL) throw new Error(`too many samples (max ${MAX_SAMPLES_TOTAL})`);
  const factor = doc.unit === "s" ? 1000 : 1;
  return doc.samples.map((s, i) => {
    for (const k of Object.keys(s)) if (!ALLOWED_SAMPLE.has(k)) throw new Error(`sample ${i}: unexpected key ${k}`);
    if (s.variant !== "baseline" && s.variant !== "candidate") throw new Error(`sample ${i}: variant must be baseline|candidate`);
    if (!/^\d{4}-\d{2}-01$/.test(String(s.period))) throw new Error(`sample ${i}: period must be YYYY-MM-01`);
    if (s.temperature !== "cold" && s.temperature !== "warm") throw new Error(`sample ${i}: temperature must be cold|warm (reported separately)`);
    if (!(typeof s.duration === "number" && Number.isFinite(s.duration) && s.duration > 0)) throw new Error(`sample ${i}: duration must be a positive finite number`);
    return { variant: s.variant, period: s.period, temperature: s.temperature, ms: s.duration * factor, source: s.source ?? null };
  });
}

export function summarise(msList) {
  const a = [...msList].sort((x, y) => x - y);
  const n = a.length;
  return { n, min: a[0] ?? null, p50: percentile(a, 50), p95: n >= MIN_SAMPLES_FOR_P95 ? percentile(a, 95) : null, max: a[n - 1] ?? null, p95Valid: n >= MIN_SAMPLES_FOR_P95 };
}

/**
 * @returns report with per-group stats, per-group status (INSUFFICIENT_SAMPLES | TARGET_NOT_MET | TARGET_MET_ON_SAMPLE),
 * October non-regression (baseline vs candidate, same temperature) and an overall timingGate that is only ever
 * "HOLD" or "CANDIDATE_FOR_OWNER_REVIEW" -- this harness never declares PASS.
 */
export function analyse(doc, { variant = "candidate", octoberTolerance = DEFAULT_OCT_TOLERANCE, targetMs = TARGET_MS } = {}) {
  if (octoberTolerance !== null && !(typeof octoberTolerance === "number" && Number.isFinite(octoberTolerance) && octoberTolerance >= 0 && octoberTolerance <= 1)) throw new Error("October tolerance must be a finite fraction between 0 and 1 or null");
  const samples = normaliseSamples(doc);
  const groups = new Map();
  for (const s of samples) {
    const k = `${s.variant}|${s.period}|${s.temperature}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(s.ms);
  }
  const rows = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
    const [vr, period, temperature] = k.split("|");
    const st = summarise(v);
    const status = !st.p95Valid ? "INSUFFICIENT_SAMPLES" : st.p95 <= targetMs ? "TARGET_MET_ON_SAMPLE" : "TARGET_NOT_MET";
    return { variant: vr, period, temperature, ...st, status };
  });
  const find = (vr, period, t) => rows.find((r) => r.variant === vr && r.period === period && r.temperature === t);
  const blockers = [];
  for (const period of REQUIRED_PERIODS) for (const t of ["cold", "warm"]) {
    const r = find(variant, period, t);
    if (!r) blockers.push(`missing ${variant} ${period} ${t} samples`);
    else if (r.status !== "TARGET_MET_ON_SAMPLE") blockers.push(`${variant} ${period} ${t}: ${r.status}${r.p95 != null ? ` (p95 ${r.p95}ms)` : ` (n=${r.n}<${MIN_SAMPLES_FOR_P95})`}`);
  }
  const oct = REQUIRED_PERIODS[1];
  const octoberNonRegression = ["cold", "warm"].map((t) => {
    const b = find("baseline", oct, t), c = find("candidate", oct, t);
    if (!b || !c || !b.p95Valid || !c.p95Valid) return { temperature: t, status: "UNPROVEN", reason: "baseline and candidate October p95 samples both required" };
    if (octoberTolerance === null) return { temperature: t, status: "POLICY_UNSET", reason: "owner-approved October non-regression tolerance is not configured" };
    const limit = b.p95 * (1 + octoberTolerance);
    return { temperature: t, status: c.p95 <= limit ? "NO_REGRESSION_ON_SAMPLE" : "REGRESSION", baselineP95: b.p95, candidateP95: c.p95, limit, tolerance: octoberTolerance };
  });
  for (const o of octoberNonRegression) if (o.status !== "NO_REGRESSION_ON_SAMPLE") blockers.push(`October non-regression ${o.temperature}: ${o.status}`);
  return { targetMs, minSamplesForP95: MIN_SAMPLES_FOR_P95, unitNormalisedTo: "ms", groups: rows, octoberNonRegression, blockers,
    timingGate: blockers.length ? "HOLD" : "CANDIDATE_FOR_OWNER_REVIEW",
    note: "Informational only. At least 20 samples per cell is this harness\u0027 provisional reporting convention, not an approved WP05 requirement. October tolerance must be owner-specified. This harness never declares a timing PASS." };
}
