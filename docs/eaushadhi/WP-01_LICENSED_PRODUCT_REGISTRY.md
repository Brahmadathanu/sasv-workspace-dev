# WP-01 — Licensed Product Registry & Source Consolidation

**Architecture state:** YELLOW  
**Progress:** 25%

## Objective
Create the definitive server-side licensed-product universe and source-availability/gap classification across Ayurveda/Siddha and classical/proprietary products.

## Primary sources
- Google Sheet: `SASV - MEDICINES 14 COLUMN` and its tabs.
- Proprietary formulation ingredient tabs.
- `PROD ING - ...` sheets for classical composition data where available.
- `TG - ...` sheets for indications/therapeutic source data where available.

## Required end state
Every licensed product has:
- unique governed identity;
- system/class classification;
- source provenance;
- composition availability status;
- therapeutic/TG availability status;
- document requirement classification;
- explicit gap flags for missing data;
- governed manual-entry path for missing source data.

## Milestones
- [x] Existing regulatory/product adoption foundation available.
- [~] Google-sheet source inventory/reconciliation in progress historically.
- [ ] Freeze definitive licensed-product universe.
- [ ] Quantify Ayurveda vs Siddha and classical vs proprietary.
- [ ] Map proprietary ingredient-source availability.
- [ ] Map classical `PROD ING` availability and missing compositions.
- [ ] Map `TG` availability and missing therapeutic data.
- [ ] Define/manual-entry gap lifecycle and provenance.
- [ ] Server verification report: every product classified by source/gap state.
- [ ] WP closure audit and downstream handover.

## Dependencies
Feeds WP-03, WP-05, WP-07 and WP-08.

## Out of scope
Portal execution; colleague production entry; therapeutic-guide development.

## Current gate
Comprehensive source and gap inventory from actual Google Sheets against live server product registry.
