# UX-9 client contract — APPLIED live 31 Oct 2026 as 20261031102139 (header updated; body as approved)

> The functions below are live since 2026-10-31 (version 20261031102139). Clearing a reference (`BLANK_REFERENCE_NOT_ALLOWED`) stays refused until the portal blank-reference question is answered.

## 1. Read: `rpc_eaushadhi_source_reference_preview_v1(p_product_id integer) → jsonb`
Needs module view permission. Use it to build the dialog and the preview.
```json
{ "product_id": 31, "max_lines": 200,
  "caller": { "is_verifier": true, "is_approver": false },
  "product_lock_reason": null,            // or "PORTAL_ENTRY_STARTED" | "FORMULATION_APPROVED"
  "known_wordings": [ { "raw_reference_text": "Sahasrayōgam - Sujanapriya", "line_count": 412, "product_line_count": 0 } ],
  "lines": [ { "source_composition_line_id": 931, "source_row_no": 7, "raw_ingredient_name": "Ashwagandha",
               "raw_reference_text": null, "row_version": 7, "review_status": "IN_REVIEW",
               "lock_reason": null } ] }   // lock_reason: null | "LINE_VERIFIED" | product lock
```
- `raw_reference_text` is trimmed; blank and whitespace are returned as `null` ("No source reference recorded").
- Disable the button when `product_lock_reason` is set or `caller.is_verifier` is false. Lines with `lock_reason` are not selectable.
- When `is_approver` is false: hide/disable "Enter a new wording" and do not allow ticking lines whose wording differs from the chosen one (explain "Approver needed").

## 2. Write: `rpc_eaushadhi_set_source_reference_bulk_v1(p_product_id integer, p_request_id uuid, p_reference_text text, p_allow_new_wording boolean, p_reason text, p_lines jsonb) → jsonb`
Call with named arguments via `supabase.rpc(...)`. `p_lines` (1..200 items, no duplicates):
```json
[ { "source_composition_line_id": 931, "expected_row_version": 7,
    "expected_raw_reference_text": null, "confirm_replace_different": false } ]
```
- `expected_*` = exactly what the preview showed (`row_version` is the line-review row_version; the source line has none).
- `confirm_replace_different: true` only for lines the worker explicitly ticked that hold a different wording.
- `p_request_id`: generate once per preview (`crypto.randomUUID()`); keep it across retries of the same Apply; make a new one when the preview is rebuilt.
- `p_reference_text` is trimmed and whitespace-collapsed by the server. If it matches a known wording case-insensitively, the server stores the existing spelling.
- All-or-nothing: either every listed line is processed, or nothing is written.

Success:
```json
{ "request_id": "…", "product_id": 31, "raw_reference_text": "Sahasrayōgam - Sujanapriya",
  "is_new_wording": false, "approver_used": false, "applied_count": 24, "unchanged_count": 1, "replayed": false,
  "lines": [ { "source_composition_line_id": 931, "outcome": "UPDATED", "change_kind": "FILL_BLANK",
               "old_raw_reference_text": null, "raw_reference_text": "Sahasrayōgam - Sujanapriya",
               "review_status": "PENDING", "row_version": 8 } ] }
```
`outcome`: `UPDATED` | `UNCHANGED`. `change_kind`: `FILL_BLANK` | `REPLACE_DIFFERENT` | `RESPELL` (same wording, spelling or spacing tidied) | `UNCHANGED`.
Merge `raw_reference_text`, `review_status`, `row_version` into each line by id, then reload reference decisions/readiness. Updated lines are back to PENDING with no reviewer, so they must be saved for review again.
`replayed: true` means that a retry returned the stored result of the first call. Treat it exactly as success. The stored lines show the state at the first call.

## 3. Errors (PostgREST: `error.code` = SQLSTATE, `error.message` = code below, `error.hint` = sentence to show, `error.details` = comma-separated line ids or the Approver reason)
| SQLSTATE | message | when | client action |
|---|---|---|---|
| 42501 | `Not authenticated` / `e-Aushadhi Automation permission is required` | from existing permission helper | show, disable |
| 42501 | `VERIFIER_ROLE_REQUIRED` | no active Verifier/Approver role | show, disable |
| 42501 | `APPROVER_ROLE_REQUIRED` (details `NEW_WORDING` or `REPLACE_DIFFERENT`) | Verifier only, but a new wording or replacing a different wording | "Ask an Approver" |
| 22023 | `REQUEST_ID_REQUIRED`, `INVALID_PAYLOAD`, `DUPLICATE_LINE` | client bug | log, show generic |
| 22023 | `REASON_REQUIRED` | reason under 10 or over 500 characters after trim | inline on Reason |
| 22023 | `BLANK_REFERENCE_NOT_ALLOWED` | target blank (clearing not allowed until the portal question is answered) | inline |
| 22023 | `WORDING_TOO_LONG` | over 300 characters | inline |
| 22023 | `WORDING_NOT_KNOWN` | not a known wording and `p_allow_new_wording` false | inline |
| 22023 | `LINE_COUNT_INVALID` | 0 or more than 200 lines | inline |
| 22023 | `LINE_NOT_IN_PRODUCT` (details ids) | line missing or belongs to another product | rebuild preview |
| 22023 | `DIFFERENT_REFERENCE_NOT_CONFIRMED` (details ids) | different wording without `confirm_replace_different` | client bug, rebuild |
| 22023 | `REQUEST_ID_REUSE_MISMATCH` | same request id with a different payload or another user | new id, rebuild preview |
| 40001 | `SOURCE_CHANGED_SINCE_PREVIEW` (details ids) | expected wording or row_version differs | "Preview is out of date", rebuild |
| 55000 | `LINE_VERIFIED` (details ids) | a listed line is VERIFIED | rebuild preview |
| 55000 | `PORTAL_ENTRY_STARTED` | workflow entry_status is not NOT_STARTED | disable |
| 55000 | `FORMULATION_APPROVED` | product has an APPROVED formulation | disable |
| P0002 | `PRODUCT_NOT_FOUND` | no workflow row | show generic |

Order of checks: permission → role → request id/payload type → **replay** → reason → wording → line count/shape/duplicates → known/new wording (+Approver) → product freezes → lock → membership → stale → verified → different-wording confirmation → Approver for replace.

## 4. Verifier vs Approver
Reported up front by the preview (`caller.is_verifier`, `caller.is_approver`). It is enforced again by the write, which returns `42501 APPROVER_ROLE_REQUIRED` with `details` naming the reason. `approver_used` in the result says the call relied on the Approver role.

## 5. Not done by the server (and must not be done by the client either)
No Save for review, Approve, Verify, readiness flag, reference mapping, worker or portal call. No new blocker for blank references.
