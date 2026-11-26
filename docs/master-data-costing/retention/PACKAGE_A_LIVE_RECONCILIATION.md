# Package A live reconciliation, 26 November 2026

Candidate only. Tested code b6571e2c; CI 45795140687 PG17 23/23, new client 26/26, workflows 8/8.

- 64 observed direct-FK relations classified, plus three candidate permanent relations. Two repo-only relations excluded pending actual linkage review.
- 18 live manifest pins captured; invoker RPC still blocked. Preserve existing permissions.
- 52 distinct index candidates from actual FK columns and >8 MiB gate. None built.
- 3 CASCADE edges require writer compatibility review before changing behavior.
- Nonpurgeable-to-purgeable edges: regional_marketing_evidence_a_regional_marketing_snapshot__fkey, regional_marketing_evidence_acc_regional_basis_snapshot_id_fkey, sales_allocation_quantity_driver_accept_source_snapshot_id_fkey. Three acceptance edges require R2C; any remaining edge hard stop.
- External MIS and industries consumers must be reviewed. Deferred readiness exact-run guard must follow auth; onboarding has direct permission anchor. Test corrective code before install.
- No deployment, PR merge, scheduler or purge authorization implied.
