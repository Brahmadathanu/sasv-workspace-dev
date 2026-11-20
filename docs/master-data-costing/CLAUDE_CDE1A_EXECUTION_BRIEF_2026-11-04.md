# Claude Cloud Execution Brief — CDE-1a Mock-Only Evidence Drawer
Date: 4 November 2026 · **Client development only**

## Source and scope
- Base: `main` `195b13c4df32a5fdcf22ee304066e96c1b138481` (after merged A7 #146). Verify that `main` still matches before branching; if moved, compare diffs, do not overwrite.
- Read PR #147 draft design `CDE1_DRAFT_RUN_EVIDENCE_PANEL_MOCK_DESIGN_2026-11-04.md` and its latest independent safety addendum; read PR #142 proposed `CLIENT_DRAFT_RUN_EVIDENCE_IMPLEMENTATION_GATE_2026-11-03.md`. `CDE2_PROTECTED_COMPONENT_READ_CONTRACT_2026-11-04.md` is server design only and is **NOT implemented**.
- One isolated branch `claude/costing-cde1a-mock-evidence-drawer`, one **draft code PR**, stop before merge. Preserve parallel docs PRs #141/#142/#143/#145/#147, paused e-Aushadhi, retention #137, and all shared worktrees.

## Implement now
1. In the EXISTING Costing Review Worklist SKU Control Status drawer, add a collapsed **"Draft-run component evidence"** section using a pure renderer and injected provider seam; no new module/tab/lens.
2. Place behind `COSTING_REVIEW_WORKLIST_V1` (exact `"1"`, default OFF). Flag OFF must be byte-for-byte identical in HTML and should neither instantiate nor call an evidence provider. Do not switch any flags.
3. In production until an authorised CDE-2 adapter is supplied, show an explicit safe state: **"Draft-run component evidence unavailable — provider not connected"**, and UNKNOWN for component values. **No fixtures or mocked data in production.**
4. For test-only injected providers, strict request identity `(periodStart,runId,skuId)`, run must belong to server-advertised allowed runs for period; strict echo response identity; reject cross-period/run/SKU mismatch, stale generation and late answers after drawer/run switch. Statuses: not requested, loading, ok, empty→UNKNOWN, forbidden, error/retry, stale/foreign-run.
5. The evidence section may show confirmed selected-run Material, Direct Labour, Conversion, Regional Marketing IK/OK source statuses, reason codes, notes and existing remedial links. Keep a **prominent warning** that other Cost Sheet evidence is governed-run pinned and is **not evidence from draft run 148**. Never replace it wholesale; scope any reassurance to the verified components.
6. No `costing.*` source reads, named RPC, `costingRpc`, `costingFrom` or Supabase import in this package. Never fetch monetary evidence and hide it client-side. Do not introduce acceptance or approval buttons, new governance semantics or a guessed server contract.
7. Existing route-resolver and U11 label helpers only; escape server-provided strings; accessible table/heading, keyboard toggle, screen-reader state, 360px safe responsive layout.

## Tests and audit
- Pure test fixtures: 52 labour review with valid sales basis; 32 NO_SKU_SALES; 25 NO_PRODUCT_SALES; one conversion-only; Dhanyamlam SKU41 IK ready/OK review; SKU105 PM blocker source `UNKNOWN` absent verified note; empty/forbidden/stale/foreign-run.
- Tests: exact flag-OFF parity with merged main, no-provider safe production behaviour, ID matching and allowed-run validation, late response discard, error/retry, escaping/sanitisation, no mutation/RPC, route context, mocked Chromium 360/1280 layouts and keyboard.
- Run full-history LF and CRLF Node/Chromium suite (baseline after #146: reported 636/636); zero skips, failures, cancellations and TODO. Report exact new totals and the 11 Chromium-driving files.
- Independent reviewer should see filenames, test diff and output evidence; no claim of signed-in live proof from mocked data.

## Stop boundaries
No merge, live Supabase writes/read RPC creation, flags ON, cache bump, PWA deploy, Electron version/tag/release, regional review acceptance or costing-run approval. If the drawer architecture makes no-provider injection impossible without modifying high-risk shared state, stop that specific edit with an exact option analysis and proceed with the pure renderer/test package. Return one draft PR head and final test reports.
