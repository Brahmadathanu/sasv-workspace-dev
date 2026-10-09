# PEC WP01 — G1–G3 implementation execution brief
Status: Approved bounded contract, implementation evidence pending.
Base: merge `0d004779f7e928b855b18d1d90b3eddd262050b4`. Always check fresh main before beginning.
Branch: `feat/pec-wp01-traceability-access`.
Read `docs/procurement-execution/{README,MASTER_PROGRAMME,IMPLEMENTATION_RULES,WP01_TRACEABILITY_ACCESS_CORRECTION,CHANGELOG_DECISIONS}.md` first.

## Server authority — ChatGPT (do NOT implement via Cursor)
The live filtered SQL function `public.proc_vendorwise_buylist_filtered_pec_internal` builds JSON without `indent_line_sort_no`. **Critical fresh finding:** `public.v_proc_indent_line_buylist_base` does NOT carry serial; `public.v_proc_indent_lines_console_ordered` does. Plan must source canonical serial by the exact `indent_line_id` relationship (no positional numbering or guessed default). The function is postgres-owned SECURITY DEFINER, search_path=public; authenticated may execute the public `proc_vendorwise_buylist_filtered` wrapper but NOT the internal routine. Do not change grants or security posture. Independently confirm one-to-one relationship and totals before server apply; no server change has yet been applied.

## Client executor — Cursor/Codex only
High-risk PLAN gate: inspect exact current files and produce a minimal plan before modifications:
- `public/shared/js/procurement-execution-console.js`: `renderIndentLines` currently uses `idx + 1`; appended path uses `startAt + idx + 1`. Replace both **display** sources with validated `row.indent_line_sort_no`, retaining actual record ID/actions.
- `normalizeVwlBreakdown` presently omits the serial. Retain canonical JSON field; add a single safe display formatter for indent + serial, e.g. `193 (15)`; use it in the Indents modal and any directly related compact reference that has canonical serial.
- No absent serial may be synthesized. No quantity/rate/assignment/indent historical changes.
- Study `public/utilities-hub/js/hub-auth.js`, `public/shared/js/module-registry.js`, `public/sw.js` and PWA registration history. Hub ALREADY rerenders on visibilitychange and pageshow, and `loadUtilities()` reloads registry and `get_user_permissions`; current registry has read-mode PWA route. Service worker at cache v343 uses cache-first for `module-registry.js` while Hub auth JS is network-fetched. **Cache is hypothesis, not proven root cause**. Before any PWA code edit, present deployment/cache/permission evidence and the smallest correction; do NOT add redundant listeners or broaden grants.
- Scope only these features. Do not touch unrelated modules, WIP, server SQL, migration source or protected checkouts.
- Following independently approved plan, run tests, self-review, fix, commit and push this branch; never merge or deploy.
- Report exact head SHA, files changed, all tests, pre/post behaviour and remaining real-account verification gaps.

## Required acceptance
- Indent 193 / 28 MM ROPP Cap displays `193 (15)` from canonical data.
- Indent search returning only serial 15 displays `# = 15`, never `1`; append paths preserve serial.
- Existing buying-list totals and security unchanged.
- Both affected read-only accounts see/access only their authorized module; unauthorised users remain denied. Do not claim success without real authenticated proof.
- Pause before application merge/deploy and any expanded permission/security changes.

## Gate discipline
G1 high-risk plan review; G2 server correction and live parity verification; G3 client execution; G4 independent acceptance; G5 merge authorization. No gate becomes DONE solely because a branch or file exists.
