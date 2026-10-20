# G2 approval history reuse check

Read-only live schema inspection: family and product route tables store route_version, evidence_status, approval_reference, approved_by, approved_at, route_note, updated_at. No route-step-specific attestation/history table was identified among costing audit/history/approval tables. Existing correction-audit table concerns family product assignment, not nested-step confirmations.

Result: generic approval reference is NOT proof the reviewer accepted each product of occurrence and cycle counts. No new table is justified merely for six affected family steps, but lack of a count-specific persisted acknowledgement means current warning is advisory, not an enforceable approval fix. Inspect and design narrow existing-approval RPC binding to route ID/version and frozen step counts before claiming server enforcement. Do not change historical approved route144 or runs122/128. G2 OPEN; no live changes.
