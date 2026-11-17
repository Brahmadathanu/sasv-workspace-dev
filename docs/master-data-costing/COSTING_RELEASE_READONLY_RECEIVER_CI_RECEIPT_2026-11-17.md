# Costing release — independent read-only receiver CI receipt (17 November 2026)

**Scope:** public hosted asset digest checks + isolated mocked WP11/WP12 browser checks. **No production SQL, no writer/preview RPC, no identity impersonation, no feature flag activation, no release publishing.**

**Evidence:** [GitHub Actions run 44030078064](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44030078064), job **133859616494**, successful, artifact **14305135799** (`costing-release-readonly-receiver`). CI checked out the PR synthetic merge commit **`7cfc0c1e496e0835bc8c5a94079efc2e444e1265`**, from draft [PR #465](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/465). Application package version in the checkout is **6.1.0** (source metadata, not a newly published installer).

## Verified outputs

| Check | Actual CI receipt | Evidence class |
|---|---|---|
| Six Costing hosted asset bundle | **VERIFIED [HOSTED] 74/74** against explicit checkout SHA | Hosted anonymous static bytes |
| Service worker source/cache | **hub-cache-v393** matched hosted and checked-out source | Hosted SW source, **not installed PWA activation** |
| Hosted master Product/BOM assets | **GATE PASS**, token `g2-0-39e7b477a334fb9243dab045a0ea9f25` | Hosted anonymous static bytes |
| WP11 Deactivate contrast | **2 PASS / 0 FAIL / 0 SKIP** | Static source assertions |
| WP11 PM BOM at 390px | **1 PASS / 0 FAIL / 0 SKIP** | Isolated Chromium with mocked backend |
| WP12 six modules × 11 flag controls | **21 PASS / 0 FAIL / 0 SKIP** | Isolated Chromium with inert backend |
| Full CI job | **SUCCESS** | All prior source/mocked gates, not real-session acceptance |

All verification used the actual checked-out source; the verification workflow and this receipt do **not** change application assets. The 74/74 result also confirms the previous 16 November hosted provenance on the tested asset tree. The static hosted result does not certify the Netlify deploy ID or a user browser cache.

## Irreducible open gates

**NOT TESTED** by this CI: existing genuine Editor/View-only/No-access credentials in six modules; confidential personnel and seven sensitive-view negative GETs; a normal user's live CSR Cost Comparison response and latency on the default-OFF path; actual populated PM BOM page width, Deactivate button visibility; installed PWA controller update/restart; genuine ON/OFF flag restoration; Windows NSIS/ZIP installed/restart/update/rollback; and owner approval for exact release SHA/version.

The 2026-11-17 live read-only costing-period census is unchanged: Sep **LOCKED approved 122**; Oct **OPEN approved pricing 143** with newer draft **148**; Nov **OPEN, no approved run**, latest successful **152**. Any final UI that uses 148 or 152 as approved pricing is a **STOP**.

**Release recommendation:** preserve the existing release scope—already installed WP10 Phase1, merged WP11 fixes and WP00–WP09 accepted outcomes; keep optional review [PR #463](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/463) and new production route guards out of the pending combined Electron installer without separately approved migration/rollout authority.

**Final disposition:** automation/source + hosted-static receiver **PASS**. Real acceptance, installed Windows acceptance, WP10–WP12 formal closure and publication remain **OPEN**; programme **10/13 CLOSED**.
