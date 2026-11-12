# PEC G0 — Five-lens static DOM inventory from current main (12 Nov 2026)

This is a **source-only inventory**, not a rendered/signed-in acceptance. Canonical shared `public/shared/procurement-execution-console.html`; no duplicate Electron/PWA assets were made. Controls counted from ID-bearing buttons, inputs and selectors within source tab segments. Modals after the tabs are an independent, still-uninventoried domain. Be wary of markup nesting: excess segment may include subsequent overlays before the modal comment.

| Lens | ID-bearing controls | Table columns | Controls |
|---|---:|---:|---|
| pr | 8 | 7 | `prFilterBtn`, `prFilterStatus`, `prFilterClass`, `prSearch`, `prSearchClear`, `btnGeneratePr`, `prBtnPrev`, `prBtnNext` |
| action | 10 | 7 | `aqFilterBtn`, `fIndent`, `fBand`, `fClass`, `fNeeds`, `fSelectedOnly`, `fUnselectedOnly`, `fGroupMode`, `fSearch`, `fSearchClear` |
| indents | 9 | 6 | `iFilterBtn`, `iStatus`, `iClass`, `iSearch`, `iSearchClear`, `iBtnNewDraft`, `iBtnFromPR`, `iBtnPrev`, `iBtnNext` |
| vendor-buylist | 16 | 7 | `vwlFilterBtn`, `vwlVendorFilter`, `vwlMaterialClassFilter`, `vwlRmScopeFilter`, `vwlRateStatusFilter`, `vwlAssignmentStatusFilter`, `vwlShowSplitOnly`, `vwlFilterClear`, `vwlSearch`, `vwlSearchClear`, `vwlExportBtn`, `vwlExportPdf`, `vwlExportCsv`, `vwlExportTsv`, `vwlPrev`, `vwlNext` |
| excess | 16 | 8 | `eFilterBtn`, `eFMaterialClass`, `eFDatePreset`, `eFDateFrom`, `eFDateTo`, `eFMinQty`, `eFVendorQ`, `eFItemQ`, `eFUnmappedOnly`, `eSearch`, `eSearchClear`, `eAuditBtn`, `eBtnPrev`, `eBtnNext`, `btnEAuditClose`, `eAuditBtnPrev` |

## Initial actionable findings

1. The Indents table currently declares only **Approved Date** (not a distinct **Indent Date**) among its table headers. Server field availability and export parity must be confirmed before adding the missing column.
2. PR and Indents have explicit Prev/Next paging controls; Action Queue and other lenses need verification of their actual server paging/infinite-scroll behavior, not a claimed blanket infinite scroll.
3. Vendor-wise buying list includes 3 explicit export formats (PDF/CSV/TSV) plus export menu; test exports independently of filtered viewport and preserve canonical line serials.
4. Full-indent-resync client sent unsupported `full` mode to server, while SQL accepted `reset`; fixed separately in **draft PR #319** on shared JS. Avoid overlapping this fix in Claude C1 client branch; rebase after #319 resolution.
5. Source ID enumeration does not establish access, lifecycle guards, completeness of dynamic rows, modal validation, CSS overflow or screen-reader behaviour. Each still needs runtime evidence before gate signoff.

**Programme:** #284, **S4:** #305; broad documentation draft #287; focused server integration #317; client bugfix #319. **G0 0/6 formal gates verified.**
