# Step 133 — Canonical derived-column definitions, lean finance reference (2026-10-22)

User explicitly narrowed `MASTER DATA REFERENCE`: remove self-evident raw fields (RM, PM, identity, group, etc.), retain only the derived fields whose calculation or specific costing meaning warrants explanation, plus exactly the provenance attributes database source view, run ID and valuation date. Prefer Supabase itself as canonical source of column descriptions; Google Sheets must retrieve, not maintain independent glossary text.

## Implementation verified
- Applied Supabase migration `20261022162006_price_revision_master_derived_column_documentation_20261022`. Implemented PostgreSQL `COMMENT ON COLUMN costing.v_price_revision_current_approved_master.<field>` for 19 selected derived columns, including material cost, internal conversion, prime, COP, loaded, IK/OK pricing, basic prices, discounts, selling prices, contingency and both-region pre-scheme margins.
- `pg_description` query joins pg_attribute / pg_class / pg_namespace / pg_description and returns those 19 comments in actual column order; validated after migration.
- Migration SQL copied to repository `supabase/migrations/20261022162006_price_revision_master_derived_column_documentation_20261022.sql` for version parity.
- Rebuilt the EXISTING `MASTER DATA REFERENCE` tab of dedicated workbook `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q` in place, clearing old 57-row duplicative glossary. It now contains A1:B3 provenance, blank row 4, A5:B5 header, A6:B24 precisely the 19 derived fields with explanations fetched from PostgreSQL catalog comments. No formulas in Sheet. Finance reference exact row reads verified.
- Source View = `costing.v_price_revision_current_approved_master`, run ID = `140`, valuation date = `2026-10-22`; original `MASTER DATA` 627 rows/57 fields unchanged. Live view remains one latest formally approved run, 627 distinct SKUs, run140 only.
- Reference is a **snapshot of database metadata at time of controlled refresh**, not an automatically recalculating link. Future expansion/edit of view: add/update column comments in migration, retrieve comments and regenerate reference tab alongside approved-run master export. No parallel manual glossary.

## Non-goals and guardrails
- No changes to other marketing tables/views.
- Do not re-add legacy Sheet tabs.
- Do not add comments for obvious identity/raw cost headings just to fill a dictionary.
- Avoid another separate definitions table or stored procedure: PostgreSQL native column comments are sufficient and keep architecture simple.
- The latest approved view does not intrinsically update static Sheet values; only controlled workbook refresh changes that.
