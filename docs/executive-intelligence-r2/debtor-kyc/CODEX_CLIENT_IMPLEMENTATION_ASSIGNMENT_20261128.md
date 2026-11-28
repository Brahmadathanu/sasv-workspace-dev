# R8 Executive Intelligence client implementation

Continue the owner-guided R8 client work from the latest `main` in an isolated branch. Use the Stock & Purchase Explorer as the visual reference. The accepted narrow-screen corrections from PR #551 and the installed v6.6.1 Finance calls are the compatibility baseline. Keep one Finance and Management Alerts experience across the PWA and Electron.

## Finance and Management Alerts

- Add a compact Finance button that opens the internal Debtor KYC workspace. Support search, paged results, lifecycle status, cascading Region → Godown → District → Area selectors, and an independent debtor-type selector. Reuse the server lookup IDs and active flags. Include the classified and unclassified partitions and distinguish DRAFT, INACTIVE, INVALID and UNMAPPED in the list. Keep creditors and the company net position visible with their company figures.
- Keep the existing no-filter requests unchanged. Add optional named arguments `p_region_id`, `p_godown_id`, `p_district_id`, `p_area_id`, `p_type_id` and `p_partition` to the three existing Finance RPCs. Send `p_group_filter: 'receivables'` on party pages when showing debtor results. `p_partition` accepts `all`, `classified`, or `unclassified`. Dimension selectors imply valid ACTIVE classification. Clear dimension selectors when switching to unclassified.
- In `get_mis_finance_ageing_summary`, render `groups` as the company-wide position for the requested ageing scope. Display `filtered_receivables` as the receivable subtotal when a selector or partition is applied. Its orientation comes from the company receivables in the same age range, and an individual region or the unclassified partition may show a negative offset. Party amounts retain per-party polarity. Undated bills remain in the selected age range. The as-of date changes age against the latest outstanding snapshot.
- Use `get_mis_finance_bill_page` for bill drill-down and export. Named arguments are `p_group_filter='all'`, `p_party=null` (exact ledger name), `p_as_of=null`, `p_basis='bill_date'`, `p_bounds=[30,60,90]`, `p_age_min=null`, `p_age_max=null`, `p_limit=100`, `p_offset=0` and the six selectors above. Page at most 500 rows at a time. Use `total_rows` for paging and `groups` for totals. Consume `age_days`, `bucket_no`, `company_amount` and `party_amount` directly. Use `bill_id` to detect duplicate/reloaded rows. Restart paging if the source `report_date` changes during export. Finance data is suitable for ordinary exports. Keep personal profile and audit fields outside export, alerts, shared client logs and browser storage.
- Extend the existing `ei_management_alerts()` list to handle `finance.debtor_kyc_incomplete`. Read `state`, `findings`, `evidence_date`, `exposure_amount` and `deep_link`. The deep link opens the internal Debtor KYC workspace with the unclassified partition. Users with executive access can examine balances and classification status. Show profile controls only when the appropriate KYC permission is available.

## KYC and master maintenance

All KYC or commercial actions require Executive Intelligence view access. Use the canonical permission helper for `role:ei-debtor-kyc` and `role:ei-debtor-commercial` independently. Edit permission also allows the corresponding reads. Render authorization and retry errors from server responses. Submit the user's reason with every write. Handle stale revision `40001` by reloading and letting the user reconcile edits. Treat `23514` as a hierarchy constraint and `23505` as a conflicting identity or master key.

| RPC | Named arguments and behavior |
| --- | --- |
| `ei_debtor_lookups` | No arguments. Returns `regions`, `godowns`, `districts`, `coverage`, `areas`, `types`. Retain inactive entries for editing and evidence. Offer active entries in selectors. Coverage keys are `godown_id` and `district_id`. |
| `ei_debtor_register_page` | `p_search=''`, `p_limit=50`, `p_offset=0`. Returns `rows` and `total_rows`. Includes registered historical accounts without current bills and current unmatched ledger names. Limit 200. |
| `ei_debtor_profile` | `p_id`. Returns `identity`, `classification`, `profile`, `revision`, `status`, `classification_valid` and `aliases`. |
| `ei_debtor_register` | `p_party`, `p_reason`. Returns the canonical numeric debtor ID for an observed Tally debtor name. |
| `ei_debtor_alias_set` | `p_id`, `p_party`, `p_active`, `p_revision`, `p_reason`. Revision zero creates a supplemental alias for an observed name. Subsequent operations toggle the same debtor's alias using its current revision. Primary names remain active, and each ledger name retains its assigned debtor. |
| `ei_debtor_save` | `p_id`, `p_revision`, `p_class`, `p_profile`, `p_action`, `p_reason`. Returns `debtor_id`, `revision`, `status`, `classification_valid`. A new profile uses revision zero. `SAVE` allows an incomplete draft. `ACTIVATE` checks all five dimensions. `INACTIVATE` requires existing ACTIVE lifecycle, a reason and both payloads set to null. An INACTIVE debtor uses `ACTIVATE` for reactivation. |
| `ei_debtor_master_set` | `p_kind`, `p_id`, `p_godown_id`, `p_revision`, `p_data`, `p_reason`. Returns the updated master row. Kinds are `district`, `coverage`, `area`, `type`. Use revision zero and null `p_id` to create a district, area or type. Coverage uses `p_id` as district ID and requires `p_godown_id`. For the other kinds send null `p_godown_id`. |
| `ei_debtor_audit_page` | `p_entity`, `p_id=null`, `p_limit=50`, `p_offset=0`. Returns `rows` and `total_rows`. Use the relevant entity name below and its ID. Limit 200. |

`p_class` is null to keep the assignment or a replacement object with `region_id`, `godown_id`, `district_id`, `area_id`, `type_id`. Use JSON null for unset selectors. `p_profile` is null to keep the profile, or a patch with `business_name`, `contact_person`, `phone`, `alternate_phone`, `email`, `address_line_1`, `address_line_2`, `locality`, `postal_code`, `state_name`, `country_name`, `gstin`, `notes` and `verification_status` where relevant. Use null to clear optional contact, address or business fields. Verification status accepts `UNVERIFIED`, `VERIFIED`, and `REVIEW`. Keep optional profile completeness informational and substantiate the distinction between effective classification and lifecycle. Keep Aadhaar and PAN out of the form.

For master creation use `region_id,state_name,district_name,is_active` for district, `is_active` for coverage, `district_id,area_name,is_active` for area, and `code,name,definition,is_active` for type. Updates accept only names, definitions and active flags applicable to the master. Parents and type codes are fixed. Show effective invalidation when a master becomes inactive. For bulk assignment require an explicit preview and confirmation. Submit one governed save per debtor with the loaded revision and report each result individually.

## Commercial terms

Keep commercial tab visibility and write controls separate from KYC. Use `ei_debtor_scheme_page(p_search='',p_limit=50,p_offset=0)` to get active choices and exact totals. Allow discount null and explicit zero to represent different states. Show No Scheme as the existing costing master choice. Discount and scheme inherit separately. Keep expired and withdrawn terms in history.

| RPC | Named arguments and behavior |
| --- | --- |
| `ei_debtor_terms_get` | `p_id`, `p_date`. Returns independent `discount_source` and `scheme_source` values `OVERRIDE`, `TYPE`, or `UNCONFIGURED`, the effective fields, scheme status, and current type/region. |
| `ei_debtor_terms_history` | `p_debtor=null`, `p_type=null`, `p_region=null`, `p_limit=50`, `p_offset=0`. Returns `revision`, `total_rows` and `rows`. Address a debtor override or a type-and-region default. Use the returned revision for the next write. |
| `ei_debtor_terms_set` | `p_debtor`, `p_type`, `p_region`, `p_revision`, `p_discount`, `p_scheme`, `p_from`, `p_reason`. Send explicit nulls for unused scope and values. Supply at least one commercial value. Dates delimit half-open intervals. |
| `ei_debtor_terms_withdraw` | `p_debtor`, `p_revision`, `p_to`, `p_reason`. Closes the latest open override on the selected date, so inheritance resumes at that boundary. |

KYC audit entity names are `ei_debtor`, `ei_debtor_alias`, `ei_debtor_classification`, `ei_debtor_kyc`, `ei_debtor_district`, `ei_debtor_godown_district`, `ei_debtor_area`, and `ei_debtor_type`. Commercial audit entities are `ei_debtor_type_terms` and `ei_debtor_terms_override`. Use the debtor ID for its identity, alias, classification, profile and override. Use the district ID for coverage and the actual row ID for type terms. Keep audit payloads visible only within their authorized tab.

## Acceptance and sequencing

Verify the v6.6.1 default Finance paths, paging and filtered exports, opposing regional offsets, undated bills, the KYC lifecycle with all optional fields null, master invalidation, alias and revision conflicts, and terms inheritance and withdrawal. Cover executive-only, KYC viewer/editor, commercial viewer/editor, and unauthorized users. Include keyboard focus and modal behavior at 320–1440 px, Chromium and WebKit, Netlify preview, and owner acceptance on physical iOS. Use fixture data for automated mutation and PII checks.

Continue the remaining R8 visual reviews in the same consolidated effort with Materials Inventory, Finished Goods, Production Performance, Sales Performance, Management Alerts and shared UX. The recorded primary visual acceptance is 3/10. The owner controls the later consolidated v6.6.2 release after visual acceptance. Keep the current stable v6.6.1 and Sales Viewer available throughout this assignment.

## Owner-approved navigation and PWA sequence

Finance provides one compact Debtor KYC button. Its destination is an internal Finance workspace with Debtor Register, Classification Masters and Commercial Policies. Management Alerts uses the same workspace with the unclassified partition selected. Finance classification reporting uses the existing drawer. The internal Back action restores the Finance list state where possible. Desktop and mobile share the Executive Intelligence shell and Stock & Purchase Explorer design conventions.

Deliver one client for PWA and Electron. Complete isolated development, automated Chromium and WebKit coverage, and fixture and authenticated previews. Provide the Netlify deploy preview for owner verification on desktop and physical iOS. Incorporate owner feedback and obtain acceptance before merging and verifying the production PWA asset update. Include the accepted client later in the consolidated Electron v6.6.2 release. The current stable Electron version is v6.6.1. This assignment covers the PWA-first client and acceptance. See the [preview and owner checklist](CLIENT_PWA_ACCEPTANCE_20261128.md).
