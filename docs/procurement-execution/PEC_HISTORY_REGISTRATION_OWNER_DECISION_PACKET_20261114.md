# PEC historical migration registration — owner decision packet
Date: 14 November 2026 | Source: PR #347 staging head `0093bf3781af221494ddcceb4d7fc1ead01d67df`
Project: `qhmoqtxpeasamtlxaoak` | Master issue #388 | Historical hold #383 | Forensic #393

**STATUS: RECOMMENDATION ONLY — ZERO registrations or migrations executed by this review. No owner per-version approval recorded in this packet.**

## Independent evidence
- Claude's `PEC_MIGRATION_FINDINGS_FOR_REVIEW_20261114.md` reviewed at exact staging head; GitHub 10/10 checks success.
- Fresh live read-only queries: 0/11 listed historical versions registered; 13/13 gram-material BOM corrections exact in item, quantity and UOM; 0 non-gram BOM lines for stock ids 64,291,424,517.
- Strict factor ACL-only migration `20261112150000`: live `mrp_uom_factor_strict(bigint,bigint)` SECURITY DEFINER, `search_path=pg_catalog, public`, EXECUTE acl exactly `postgres`, `authenticated`, `service_role`, not anonymous. `inv_uom_conversion` SELECT denied to anon/authenticated. `inv_uom` SELECT is available to authenticated (pre-existing table permission, not changed by this migration).
- All 10 paged-read RPC names from migrations `170000`, `173000`, `174500` exist exactly once; all 10 are STABLE SECURITY DEFINER, pg_temp in pinned search path, authenticated/service_role EXECUTE permitted, anon EXECUTE denied. Claude source-body comparison: 20/21 historical bodies byte-equal; one vendorwise filtered-paged call differs only in whitespace; 21/21 equal ignoring whitespace. Current effective-state comparison is not evidence of original chronological execution.
- The five legacy PR→indent exceptions have been accepted as **data-unchanged historical baseline**, #393 is separate forensic follow-up. Read-only current-state confirmation: unmapped lines 1700,1701 have matched source PR final quantity zero; mismatched mapped lines 1177,1622,1927 have no positive PR match. 45/45 indents approved, so **no production SAFE/RESET trial**.
- `20261112220000` Add Line SQL exists on staging (blob `319e517092e5fb115616eb79366c971f06864d75`), contrary to the report's outdated source-location sentence.
- Remote has substantial **non-PEC migration-history drift**; no unrestricted `db push`/`migration up` is safe.

## Individually proposed history-only registrations, **not approved yet**
| Version | Evidence for current effective state | Owner decision |
|---|---|---|
| `20261112110000` | 4 master gram units, 13/13 BOM target rows, kg→g factor present | PENDING |
| `20261112114000` | Defined function bodies match current live, MRP view independently equal under whitespace normalization; runtime side effects not tested | PENDING |
| `20261112122500` | Two function bodies match, no production mutation executed | PENDING |
| `20261112133000` | Two historical writer bodies match current state, must decide **before** R10 replaces them | PENDING |
| `20261112150000` | Exact strict-factor function SECDEF/search-path/grants + base table access independently rechecked | PENDING |
| `20261112152000` | MRP rollup function body parity; no rebuild runtime test | PENDING |
| `20261112170000` | Five paging bodies semantically equal; one is whitespace-only different; grants/search path checked | PENDING |
| `20261112173000` | Three paging bodies match; grants/search path checked | PENDING |
| `20261112174500` | Two vendor paging bodies match; grants/search path checked | PENDING |
| `20261112220000` | Add Line wrapper live definition parity and staging source exists; negative genuine-role tests NOT TESTED | PENDING |

### Explicit non-approval
**`20261112143000` — HOLD.** Installed function text matches source but historical mapped-line deletion hazard and owner #383 migration-history disposition unresolved. The five legacy exceptions' data-baseline acceptance **does not mean this version was historically executed**. No repair/apply of this version without its own express decision.

**New R10 versions:** `20261113170715`, `20261113172424`, `20261114013211` are **not historical repairs**. They remain uninstalled/unregistered; require separate forward-migration approval and genuine operator acceptance governance.

## Safe execution boundary, once approved
1. Operator freezes exact Git SHA and identifies the *correct* production project, CLI version, remote history and source file bytes. Use the CLI's supported help for flags; no credentials in logs.
2. Owner must approve a **specific numbered subset**, not the whole table by implication. The operator runs one history-only `migration repair <VERSION> --status applied` per explicitly approved version with pre/post remote-history snapshots. Any status drift, unexpected version or mismatch stops execution.
3. **Do not run `db push`, `migration up`, or `--include-all` while held historical versions and non-PEC drift remain.** Fix their provenance before planning original-version forward application. No unversioned MCP migration that invents timestamps.
4. Keep all approved indent/business data untouched; do not treat function-definition parity as genuine JWT-role acceptance.
5. Record before/after exact version list and evidence in #388. Formal G0–G5 remain 0/6 closed.

**Decision requested from owner:** which of the ten exact versions may be marked *applied in history only*? Recommend the ten listed **only after a fresh execution-time comparison for each**, with `20261112143000` excluded, and with the explicit understanding that these commands **do not run their SQL**. Whether a gap left by held `143000` can be safely tolerated or must be resolved before further database migrations is a separate release decision.
