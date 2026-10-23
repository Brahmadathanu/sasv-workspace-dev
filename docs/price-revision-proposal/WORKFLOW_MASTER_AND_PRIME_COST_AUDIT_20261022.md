# Price Revision Proposal — Authoritative Workflow and Gates

Updated 22 October 2026. This file controls ONLY the price-revision proposal preparation workstream, independently of docs/master-data-costing (Costing Suite), e-Aushadhi and costing-pipeline-independent-audit.

## Non-negotiable rules

Use APPROVED run140 valuation 2026-10-22 as current baseline, then subsequently select latest formally APPROVED run using an explicit designation gate; never indiscriminately read all rows from legacy v_price_revision_feed_approved (historical runs coexist). Distinguish IK and OK MRP, regional marketing, discount, scheme, realisation and profit. No new accounting cost heads. Minimal Sheet formatting. Formula-driven proposal, verified live one stage at a time. Record all changes and decisions here; no unrelated Costing Suite modifications. Retain snapshot historical evidence rather than manual silent overwrites.

## Ordered checklist — single source of current workflow position

- [x] 01. Verify correction of Ksheerabala Thailam 101 Avarthi (SKU191) and 41 Avarthi (SKU193), joint processing/allocation, approved-run values.

- [x] 01a. Resolve remaining October costing readiness, FG specs and approval checks. Run140 APPROVED, 627 READY/0 review/0 blocked, W2 13/13 PASS; previous run136 revoked but preserved.

- [x] 02a. Inventory existing SKU cost-sheet components from run140, no fabricated cost heads. Sections manufacturing, internal loaded, IK, OK, profit, traceability.

- [x] 02b. Investigate meaning and data lineage of Prime Cost, formula, separate snapshot and three actual SKU examples (live verified). Retain existing stage for now.

- [x] 02c. User comprehension/review of component inventory; freeze cost-component naming and desired master columns before view reconstruction.

- [x] 03a. Inspect all existing price-revision-oriented views, fields, lineage, historical contamination and dependencies. Verify there is 1 latest-approved logical feed.

- [x] 03b. Replace incorrectly named/incomplete views with minimal governed source(s), versioned SQL migration, dependency-aware removal of obsolete objects; verify explicit approved run identity, all 627 SKUs and IK/OK derived current pricing fields.

- [x] 04. Select dedicated Google workbook SASV - PRICE REVISION PROPOSAL rather than old SASV - TEMPORARY WORKS. Historical run136 tab removed; workbook retains MASTER DATA REFERENCE and MASTER DATA only. Workbook ID 1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q.

- [x] 05. Create/update compact READ-ONLY STATIC MASTER tab populated from latest approved database costing master and source current discount and scheme. Include product/SKU identifiers/hierarchy, essential costing totals, regional MRP and rate policy context; verify live row counts and sample data.

- [x] 06B. Create static Sheet-managed MARKETING PROMOTIONS MASTER with only 17 explicitly requested fields: Product ID, SKU ID, Item, Pack Size, UOM, Category, Subcategory, Group, Subgroup, Scheme Master IK, Discount Master IK, Scheme Master OK, Discount Master OK, Scheme Proposed IK, Discount Proposed IK, Scheme Proposed OK, Discount Proposed OK. All 627 rows and proposed values were copied once from the workbook MASTER DATA, no formulas or DB connections; 0 mismatches. This is the user-directed SKU-grain working baseline, not a database policy edit.

- [ ] 06C. Design any optional scope-based/global promotional editing controls only if requested or operationally warranted. Maintain static editable proposed values and do not overwrite on source refresh; determine date and policy precedence in the later working model.

- [ ] 07. DATE-VALID PRICE REVISION OBJECTIVES tab: e.g. Profit on MRP >=7%, objective effective date, IK/OK applicability, rule precedence and versioning. Objective is parameter, not hardcoded formula.

- [ ] 08. Formula-driven proposal calculations based on dated objective + approved cost master + current/proposed promotions. Cross-check money/percentage denominators, exclusions, negative margins and ambiguous formulas.

- [ ] 09. Separate LIVE price-revision-ik and price-revision-ok tabs using own MRP, discount, scheme and regional cost/marketing derivations. Minimise manual entry; compact format.

- [ ] 10. Live stage-by-stage QA with user against representative products and totals. Each stage must be validated before progressing.

- [ ] 11. After a proposal decision, user snapshots the proposal tab named for proposal date, while live proposals remain active; freeze archived snapshot values and provenance for historical reproducibility.

## Verified Prime Cost data model and role

Function costing.rpc_refresh_sku_prime_cost_snapshot(period,valuation,run) checks run's context and all prerequisite snapshots (sku_material_cost_snapshot, sku_direct_labour_allocation_snapshot, sku_internal_material_conversion_snapshot) exist and agree in SKU row counts; joins by run+sku and writes an immutable-by-run intermediate subtotal / review status to sku_prime_cost_snapshot.

Exact stored formula: prime_cost_per_sku = material_cost_per_sku + direct_labour_cost_per_sku + internal_material_conversion_cost_per_sku; material=RM+PM. Separate output used by downstream manufacturing COP. Avoid doubling its inputs. Manufacturing COP adds Production overhead, QC overhead and Materials/Stores overhead. Administrative+Finance Admin overhead lead to Internal Loaded Cost. Marketing costs regional IK/OK are part of pricing not manufacturing Prime Cost.

Sample run140 amounts per SKU: SKU191 RM33.4281212121 PM2.2794274 material35.7075486121 DL9.3431736773 conversion0 prime45.0507222895 productionOH6.5924950463 QCOH0.041325875 storesOH0.7491595265 COP52.4337027373. SKU193 material12.9283061879 DL17.5862641953 conversion0 prime30.5145703832 COP46.7495428824. SKU54 material85.2586255300 DL0 conversion0.9676835181 prime86.2263090481 COP89.4332456047.

Why snapshot exists: stage-03 validated handoff, calculation lineage, run-specific controlled status; whether it could eventually be consolidated is not in the current scope and must not be changed during price revision.

## Current next gate — Stage 06A audit, then Stage 06B build

Steps 01–05 completed and verified through Step140 in separate implementation reports. 627 active SKUs, latest approved run140. MASTER DATA references only canonical Supabase view; finance-friendly category/subcategory/group/subgroup, Item terminology, regional eligibility, last Refreshed At (IST); UTC remains in database, not Sheet.

**User-approved workbook architecture (binding):** Database-sourced MASTER DATA and reference are controlled static imports. Subsequent tabs are independent Google Sheets working-model components. For each editable commercial parameter, display baseline/current DB value as a reference (via in-workbook MASTER DATA where available), with a separate static initialized, editable WORKING column. All downstream calculation and IK/OK proposal tabs MUST use WORKING columns exclusively, never a direct Supabase connection or reference-only columns. Importing new baseline must not overwrite working entries. Workbook must never write policies back to DB implicitly. Define explicit blank-vs-zero rules, dates, regional eligibility, scope precedence, QA and approval before calculating proposals.

**06A preliminary read-only audit (2026-10-22):** canonical approved run140 627 rows, 604 have discount 0, 20 have 33%, 2 have 32%, 1 has 40%; no regional discount differences. All 627 selected scheme snapshots presently have paid 1/free 0, no IK/OK difference. This is not necessarily a complete description of live commercial marketing schemes: investigate scheme_policy_rules, scheme_master and sku_scheme_policy source and effective-date/precedence before using as proposed commercial baseline. No commercial database changes made.

Stage06B MARKETING PROMOTIONS MASTER created and fully verified with 627 SKU rows / 17 fields on 23 October 2026. Scheme is displayed by name (e.g., No Scheme), discount numeric percentage points (e.g., 33 represents 33%). Current MASTER fields are reference snapshots, proposed fields are independent static editable values initially copied from reference. Master-to-working formula linkage is prohibited. Any additional controls/rule precedence are separate future work, not yet activated.