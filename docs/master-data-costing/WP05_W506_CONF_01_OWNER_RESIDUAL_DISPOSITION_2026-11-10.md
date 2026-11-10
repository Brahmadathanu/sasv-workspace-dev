# WP05 W5-06 — owner residual decision and security sign-off record

**Prepared:** 10 November 2026  
**Status: OWNER APPROVED D1–D4 on 10 November 2026; SESSION HYGIENE D5 STILL AWAITING CONFIRMATION.** This record acknowledges the owner's explicit residual acceptance and external-consumer declaration. It does **not** certify untested identities, authorise changing production permissions, or reduce the wider WP05 acceptance contract. Formal programme closure remains 6/13.

## Verified baseline and evidence classes

- Confidentiality client #258 and server #257 released; production server migration installed. Version reconciliation #260 completed without changing database history.
- Two separate CBM view-only accounts and the CBM View+Edit editor were reported by the supervised operator as passing all six genuine authenticated acceptance checks; view-only restricted-action inspection additionally passed 11/11. Five **redacted reports** remain on owner-controlled local storage and have **not been uploaded to GitHub**. These outcomes are **operator-reported** rather than independently re-executed by this record.
- Server-side catalogue/definition checks and role-simulation count-only tests confirmed restricted staff views return zero rows, nested `staff_details` is masked, authorised editor access is retained, and aggregates remain available.
- Existing CI tests exercise negative permission identities and Save/Close writer guard contracts in isolated test environments. Production Save/Close writer RPCs have **not** been invoked for an unauthorised user.
- Read-only scan of the **three currently deployed Supabase Edge Function sources** found no direct references to the three protected staff views or nested staff_details. Repository/source and database catalogue searches found expected CBM consumer and writer references; **no comprehensive inventory of outside-hosted BI / external applications has been evidenced**.
- The restricted Export button remained visible and enabled, but read-only inspection observed zero restricted staff rows and no actual export. No disclosure was observed; UX hardening is tracked separately as [#262](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/262). No write or export was attempted.
- Live canonical inventory: 2 accounts with CBM View=true/Edit=false; 0 eligible CSR-only identity. **CSR-only remains NOT TESTED.**
- Live session catalogue check (read only) found 4 session records associated with the CBM editor category and 4 total for both view-only accounts, all without a past `not_after` value at query time. These figures include all sessions, not just test sessions; the query does not prove that each listed session remains valid, or that the sessions used for acceptance are revoked. **No session was revoked through this work.**

## Specific decisions requested from owner

### D1 — CSR-only identity gap

**Recommended disposition:** Accept the **bounded, documented test gap for this W5-06 confidentiality release**, not a blanket waiver of the original WP05 negative-identity matrix. Reasons: no eligible operational CSR-only account; implemented server checks deny personnel access unless CBM View AND Edit; genuine view-only identities and editor succeeded; isolated negative identity tests passed. Scope of residual uncertainty: a genuine live CSR-only session has not been demonstrated. If a CSR-only identity becomes available, run the exact same `--role csr-view` read-only acceptance at the next suitable controlled test window. Do not grant/revoke operational permissions merely to simulate this category.

**Owner decision — APPROVED 10 November 2026:** Accept CSR-only as **NOT TESTED / deferred verification**, not PASS, for this particular confidentiality release. If a legitimate CSR-only identity becomes available, perform the read-only role acceptance then. This does not waive any wider WP05 negative-identity obligations.

### D2 — Outside-hosted consumer declaration

**Recommended disposition:** Owner confirms either (A) there is **no known** outside-repository BI, independently hosted integration, API script or reporting tool that directly reads these three protected Staff Governance views / staff_details, after checking with relevant IT/BI owners; **or** (B) identifies integrations that require a separate compatibility assessment. Repository + live database/Edge Function scans do not establish option A on their own.

**Owner declaration — CONFIRMED 10 November 2026:** No **known** external BI or independently hosted applications depend on the protected views. This is an owner-knowledge declaration, not technical proof that none could exist, and it does not supersede future integration review.

### D3 — Export-button UX hardening

**Recommended disposition:** Keep issue #262 OPEN as non-blocking client hardening, **provided** the W5-06 confidentiality policy remains enforced on the server and no leakage was observed. UI button remains enabled on restricted staff tabs; no production export was tested. Hide/disable it later, with role-revocation and pool-summary regression coverage.

**Owner decision — APPROVED 10 November 2026:** The restricted-tab Export button hardening is a non-blocking, separately tracked client improvement under #262. No actual staff-data export was attempted and no leak was observed.

### D4 — Save/Close proof boundary

**Recommended disposition:** Credit applied writer guards, source checks and isolated negative-denial tests; do **not** issue a production write merely to demonstrate denial. The UI inspection confirmed zero edit controls and hidden modals for view-only. Production invocation denial is untested and remains identified as such; a disposable authenticated test environment is the right place for further direct writer tests.

**Owner decision — APPROVED 10 November 2026:** Accept isolated server denial tests, deployed writer guards and non-mutating UI evidence for this release; production unauthorised Save/Close invocation remains NOT TESTED. No production write is authorised.

### D5 — Session and evidence hygiene

**Required:** Operator confirms authenticated test identities have been signed out/revoked according to existing SASV policy; deleting `*.storage.json` and `*.proof.json` only removes local copies and does **not** itself revoke issued session tokens. Avoid forced all-device logouts for a working editor account without a separate decision. Five redacted reports remain in restricted owner custody; no tokens, UUIDs, personnel names, or salary rows should be committed.

**Evidence needed:** Non-sensitive confirmation from operator of the applicable sign-out/revocation actions; do not record session identifiers or JWT.

## Gate and work-pack accounting

- **D1–D4 accepted by the owner on 10 November 2026:** the CSR-only live test is explicitly NOT TESTED/deferred; the owner confirms no known external BI/independent-app dependency; issue #262 is non-blocking hardening; production writer invocation remains untested, with isolated/server guard evidence accepted. **D5 (test-session sign-out or revocation confirmation) remains PENDING**. The owner's response did not confirm that any login was signed out or revoked.
- Even after W5-06 security release risk acceptance, the broader WP05 W5-03..W5-10 work-pack matrix and any owner-approved change to the 40-lens / 11-feature-flag acceptance contract must still be satisfied. **Do not convert 6/13 to 7/13 based only on W5-06**, and do not mark the parent WP05 closed on the strength of this record alone.
- References: [#234](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/234), [acceptance record](WP05_W506_CONF_01_PRODUCTION_ACCEPTANCE_2026-11-10.md), [authenticated runner](WP05_W506_SIGNED_IN_ACCEPTANCE_RUNBOOK_2026-11-10.md), [export hardening #262](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/262), and [WP05 closure gate audit](WP05_FORMAL_CLOSURE_GATE_AUDIT_2026-11-08.md).
