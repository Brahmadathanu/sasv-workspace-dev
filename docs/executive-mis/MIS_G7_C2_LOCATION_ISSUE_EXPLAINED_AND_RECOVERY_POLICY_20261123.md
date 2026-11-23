# Executive MIS G7 — What the legacy FG bulk stock-location issue actually is

**Read-only investigation: 23 November 2026 IST.** Reporting cohort November 1–21, based on ledger movement timestamp; no production modifications. G7 OPEN 6/11 (~55%), G8 parked, PRs #485/#517 draft. **This is not a finding of 144 physically missing stock movements or incorrect inventory balances.** It is a missing movement-location provenance and future stock-enforcement problem.

## Simple explanation

The existing system records where a **bulk receipt** went (often a **line-side store**), but when a packaging SKU consumes the same bulk, the depletion ledger row may not record the source store/location at all. The packaging activity's **work location** is the *filling/packing workstation*, not necessarily where its bulk stock was held. Similarly, force-close and auto-zero corrections often carry no location. Batch-total arithmetic can appear normal because it combines these movements by product+batch; location stock is not independently reconstructible without linking each movement to its actual source.

**Example** (real area names): FG bulk may enter **Line-side Store – Filling & Packaging – Powder Formulations** (area ID 86), while packaging is logged in **Filling & Packaging – Powder Formulations** (area ID 56). These are separate areas intentionally. Copying area 56 onto a stock depletion would incorrectly imply stock was removed from the workstation rather than the line-side store. For oil formulations the analogous pair is source area 85 → activity area 55; lehyam 87 → 53; pills 92 → 50; lepam 88 → 54.

## Actual counts and significance (Nov1–21 IST)

| Ledger movements | Records | Location missing | Current source-evidence interpretation |
|---|---:|---:|---|
| Positive FG bulk receipts | 80 | 0 | Source location stored |
| Packing consumption | 103 | 103 | All 103 have linked packaging event and work log with location, **but work area differs from stock receipt area**. 102 have a single *recorded* candidate location across same-batch ledger; one has more than one due to internal transfer. |
| Manual force-close | 37 | 37 | All 37 link to a source work log with location that matches an FG bulk receipt, and 37/37 have one recorded candidate location; still need adjustment provenance before attribution |
| Auto-zero | 4 | 4 | Four rows have one candidate recorded batch location; tiny balance adjustments, not excess or new production |
| Internal transfer legs | 2 | 0 | Both have physical location; source+destination must remain separate |

Among 103 packaging ledger movements, **98** correspond to source *line-side store* → related filling/packaging work area patterns, and **five** correspond to bulk receipt in **Fermentation Area** (area 45) while packaging activity took place at **Filling & Packaging – Arishtam, Asavam, Kashayam** (area 52). The latter must be investigated for actual internal stock handover/transfer rather than automatically calling it an error. All 103 packing records are valid links to packaging SKU/work logs; a missing movement location is not the same defect as the separately confirmed **29 SKU packaging lines with no consumption ledger movement at all**.

**Specific multi-location batch:** product ID 5, batch `6831` had FG receipt 1,500 base units in Fermentation Area (area 45) at plant 85 (29 October), followed by documented internal transfer **out -1,500 at plant 85 and in +1,500 at plant 84** (3 November), within the same *area*. Later packing depletion -1,198.800 (6 November) has no stock location fields. There are **two physical stock location identities** despite a single area ID. The prior “one recorded candidate area” assumption would be wrong for plant-level reconciliation. Before attributing this pack depletion, validate actual availability at destination plant 84 and corresponding physical issue to packing, with original movement chronology. Recorded quantity values are batch/base-UOM-specific, not aggregated across products.

**Other location-unknown records** generally have a single candidate *recorded* location. That makes them **high confidence candidates**, not automatically proven location allocations: source timestamps, location moves, source record revisions, UOM compatibility and stock-availability ordering must still pass. Check each movement's original writer, source ID, batch product identity and effective physical stock history. Plant is optional for many line-side receipts and must not be treated as a missing mandatory field.

## Recommended minimal clean-up (without inventing stock)

1. **Separate two problems:** (A) **29 legacy packaging SKU lines without any stock consumption** due to old trigger's silent skip, requiring source-backed historical C3 FG receipt evidence and replay; (B) **144 existing stock ledger movements with NULL location** (103 packing, 37 force-close, 4 auto-zero), requiring source-location attribution or explicit unresolved status. Never mix or count these as the same error.
2. Build a private **read-only candidate attribution report** (movement ledger ID → product/batch → source event/work log → original FG receipt location(s) → transfers by time → proposed source location → confidence/reason). First classify the 143 rows with one recorded candidate location separately from the one two-plant batch. Do not write proposed locations to the ledger merely because only one candidate exists.
3. For packaging, **select the actual stock issue/source store**, not packaging operation's work area; follow any line-side or interplant stock transfer history, with historical document or authorized person validation where needed. The five fermentation → packaging cases and transferred plant 85→84 batch deserve explicit check. A worklog's location can be used as activity provenance but is not a stock source by default.
4. For force-close, link original FG bulk worklog and complete adjustment reason; auto-zero is a rounding adjustment to the actual residual stock at the relevant location and cannot be new/extra FG bulk. Do not blindly assign old reductions if source has moved.
5. For future movements, change the coordinated server writer to **always record physical source location for packaging depletion** and relevant location for adjustments. Require shared product+batch lock across all stock writers, verify location balance inside the lock, and record authorized measured excess and packing atomically. After source-backed historical attribution and guards, enforce strict per-location balances for the newly governed cohort. Do not switch on strict location validation against incomplete old rows without a compatibility rule.
6. Historical correction must be an explicit, auditable provenance event (source ID, prior NULL fields, evidence, actor, timestamp, reasoning, validated balance), not a silent overwrite of signed stock. Freeze original MIS versions and create new version on approved source correction.

## Evidence and limits

- `MIS_G7_C2_LOCATION_SOURCE_RECONCILIATION_READONLY_20261123.sql` commit `88ad0b9e65dd91d0df7ee90559b606a0615f565a` executed successfully under `BEGIN READ ONLY`; its cohort attribution report shows packing 102 single recorded candidate, one multi-location; force close 37 single; auto-zero 4 single, zero cases without any candidate.
- Installed areas lookup and exact source work-log receipt joins verified separately in READ ONLY. 103/103 pack source work logs have nonnull section/subsection/area; 0/103 matches FG receipt section+subsection+area (reflecting different work and source areas).
- These results do not prove no other historic location changes outside ledger, nor source documentary sufficiency; they do not authorize automatic updates or claim completed-product production.
- Real final implementation still requires a complete writer, per-batch C1 signoff, C2 excess controls, C3 historical evidence, signed permissions, actual PostgreSQL concurrent lock tests and separate owner deployment authorization.

**Decision gate:** location issue **understood and candidate locations largely traceable**, not yet **physically reconciled/approved**. No production writes, backfill, privileged grants, paid branch, PR merge or Electron release.
