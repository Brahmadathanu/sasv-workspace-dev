| Area | Controls | Table headers | PASS | FIX | FAIL |
|---|---|---|---|---|---|
| lens:pr | 9 | 7 | 9 | 0 | 0 |
| lens:action | 11 | 7 | 11 | 0 | 0 |
| lens:indents | 10 | 7 | 10 | 0 | 0 |
| lens:vendor-buylist | 17 | 7 | 17 | 0 | 0 |
| lens:excess | 15 | 8 | 15 | 0 | 0 |
| modal:eAuditModalBackdrop | 4 | 0 | 5 | 0 | 0 |
| modal:vwlSplitReviewModalBackdrop | 13 | 0 | 14 | 0 | 0 |
| modal:vwlSplitActionConfirmModalBackdrop | 4 | 0 | 5 | 0 | 0 |
| modal:vwlBreakdownModalBackdrop | 3 | 0 | 4 | 0 | 0 |
| modal:indentViewModalBackdrop | 21 | 0 | 22 | 0 | 0 |
| modal:workflowGuideModalBackdrop | 2 | 0 | 3 | 0 | 0 |
| modal:detailModalBackdrop | 6 | 0 | 7 | 0 | 0 |
| modal:vendorModalBackdrop | 7 | 0 | 8 | 0 | 0 |
| modal:vendorAcceptModeModalBackdrop | 6 | 0 | 7 | 0 | 0 |
| modal:indentActionModalBackdrop | 6 | 0 | 7 | 0 | 0 |
| modal:indentSourcePrModalBackdrop | 5 | 0 | 6 | 0 | 0 |
| modal:indentResyncModalBackdrop | 4 | 0 | 5 | 0 | 0 |
| modal:acceptExcessModalBackdrop | 6 | 0 | 7 | 0 | 0 |
| modal:vendorAliasMapModalBackdrop | 12 | 0 | 0 | 0 | 0 | DEFER: unreachable modal
| modal:prViewModalBackdrop | 16 | 0 | 17 | 0 | 0 |
| modal:prRebuildModalBackdrop | 5 | 0 | 6 | 0 | 0 |
| modal:hardDeleteModalBackdrop | 6 | 0 | 7 | 0 | 0 |
| modal:snapshotRefreshModalBackdrop | 4 | 0 | 5 | 0 | 0 |
| modal:clearSelectedVendorModalBackdrop | 4 | 0 | 5 | 0 | 0 |
| modal:generatePrModalBackdrop | 11 | 0 | 12 | 0 | 0 |
| modal:prEditReqModalBackdrop | 5 | 0 | 0 | 0 | 0 | DEFER: unreachable modal
| modal:prEditDeltaModalBackdrop | 5 | 0 | 0 | 0 | 0 | DEFER: unreachable modal
| modal:prAddLineModalBackdrop | 8 | 0 | 9 | 0 | 0 |
| modal:prSetStatusModalBackdrop | 5 | 0 | 6 | 0 | 0 |
| modal:createIndentModalBackdrop | 8 | 0 | 9 | 0 | 0 |
| modal:indentFromPrModalBackdrop | 6 | 0 | 7 | 0 | 0 |
| modal:stockPickerModalBackdrop | 3 | 0 | 4 | 0 | 0 |
| modal:indentAddLineModalBackdrop | 8 | 0 | 9 | 0 | 0 |
| modal:exportIndentModalBackdrop | 11 | 0 | 12 | 0 | 0 |
| header | 3 | 0 | 3 | 0 | 0 |
| lens-nav | 6 | 0 | 6 | 0 | 0 |

### Element detail (non-PASS and edit-gated controls)

| Area | Element | Role/type | Accessible name | Edit-gated | Status | Note |
|---|---|---|---|---|---|---|
| lens:pr | button#btnGeneratePr | button | Generate Draft PR | yes | PASS | named; 6 JS ref(s) |
| lens:indents | button#iBtnNewDraft | - | New Indent | yes | PASS | named; 3 JS ref(s) |
| lens:indents | button#iBtnFromPR | - | Create from PR | yes | PASS | named; 3 JS ref(s) |
| modal:vwlSplitReviewModalBackdrop | select#vwlSplitVendorPick | - | Vendor to apply to all affected lines | yes | PASS | named; 2 JS ref(s) |
| modal:vwlSplitReviewModalBackdrop | input#vwlSplitVendorRate | text | Rate | yes | PASS | named; 9 JS ref(s) |
| modal:vwlSplitReviewModalBackdrop | textarea#vwlSplitConsolidateReason | - | Reason * | yes | PASS | named; 2 JS ref(s) |
| modal:vwlSplitReviewModalBackdrop | input#vwlSplitConsolidateIncludeCleared | checkbox | Include manually unassigned/cleared lines | yes | PASS | named; 5 JS ref(s) |
| modal:vwlSplitReviewModalBackdrop | textarea#vwlSplitClearReason | - | Reason | yes | PASS | named; 2 JS ref(s) |
| modal:vwlSplitReviewModalBackdrop | input#vwlSplitClearIncludeCleared | checkbox | Include already-cleared lines | yes | PASS | named; 5 JS ref(s) |
| modal:vwlSplitReviewModalBackdrop | button#btnVwlSplitApply | button | Apply vendor | yes | PASS | named; 3 JS ref(s) |
| modal:indentViewModalBackdrop | button#btnIndentCreatePrRevision | - | Create PR Revision | yes | PASS | named; 2 JS ref(s) |
| modal:indentViewModalBackdrop | button#btnIndentSetSourcePr | - | Set Source PR | yes | PASS | named; 2 JS ref(s) |
| modal:indentViewModalBackdrop | button#btnIndentResyncMenu | button | Resync options | yes | PASS | named; 3 JS ref(s) |
| modal:indentViewModalBackdrop | button#btnIndentResyncSafe | menuitem | Safe | yes | PASS | named; 2 JS ref(s) |
| modal:indentViewModalBackdrop | button#btnIndentResyncFull | menuitem | Full | yes | PASS | named; 1 JS ref(s) |
| modal:indentViewModalBackdrop | button#btnIndentDeleteDraft | button | Delete Draft Indent | yes | PASS | named; 2 JS ref(s) |
| modal:indentViewModalBackdrop | button#iBtnAddLine | button | Add Line | yes | PASS | named; 3 JS ref(s) |
| modal:indentViewModalBackdrop | button#iBtnSelectVendor | button | Select Vendor | yes | PASS | named; 3 JS ref(s) |
| modal:detailModalBackdrop | button#btnDetailRecommend | button | Recommend vendor | yes | PASS | named; 2 JS ref(s) |
| modal:detailModalBackdrop | button#btnDetailSelectVendor | button | Select vendor | yes | PASS | named; 3 JS ref(s) |
| modal:detailModalBackdrop | button#btnDetailClearSelectedVendor | button | Clear Vendor Assignment | yes | PASS | named; 3 JS ref(s) |
| modal:vendorModalBackdrop | button#btnVendorSave | button | Save | yes | PASS | named; 2 JS ref(s) |
| modal:vendorAcceptModeModalBackdrop | button#btnVendorAcceptModeConfirm | button | Confirm | yes | PASS | named; 1 JS ref(s) |
| modal:indentActionModalBackdrop | button#btnIndentActionConfirm | - | Confirm | yes | PASS | named; 2 JS ref(s) |
| modal:indentSourcePrModalBackdrop | button#btnIndentSourcePrConfirm | - | Set Source PR | yes | PASS | named; 1 JS ref(s) |
| modal:indentResyncModalBackdrop | button#btnIndentResyncConfirm | - | Resync | yes | PASS | named; 1 JS ref(s) |
| modal:acceptExcessModalBackdrop | button#btnExcessAccept | button | Accept Excess | yes | PASS | named; 2 JS ref(s) |
| modal:vendorAliasMapModalBackdrop | div | dialog | Vendor Alias Mapping | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | button#btnVendorAliasMapClose | button | Close | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | input#vamAlias | - |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | input#vamSourceSystem | - |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | input#vamDisplayName | - |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | input#vamVendorFilter | - |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | select#vamVendorPick | - |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | a#linkVamVendorMaster | - | Open Vendor Master | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | a#linkVamRateBook | - | Open Rate Book | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | button#btnVendorAliasMapCancel | - | Cancel | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | button#btnVamMapExisting | - | Map to Existing Vendor | yes | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | button#btnVamCreateMap | - | Create Vendor + Map | yes | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:vendorAliasMapModalBackdrop | dialog#vendorAliasMapModalBackdrop | dialog | Vendor Alias Mapping | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prViewModalBackdrop | button#btnPrActivate | button | Activate PR | yes | PASS | named; 3 JS ref(s) |
| modal:prViewModalBackdrop | button#btnPrClosePr | button | Close PR | yes | PASS | named; 4 JS ref(s) |
| modal:prViewModalBackdrop | button#btnPrDeleteDraft | button | Delete Draft PR | yes | PASS | named; 2 JS ref(s) |
| modal:prViewModalBackdrop | button#btnPrAddLine | button | Add PR Line | yes | PASS | named; 3 JS ref(s) |
| modal:prViewModalBackdrop | button#btnPrRebuildFromMrp | button | Rebuild from MRP | yes | PASS | named; 3 JS ref(s) |
| modal:prViewModalBackdrop | button#btnPrCreateIndent | button | Create Indent | yes | PASS | named; 3 JS ref(s) |
| modal:prRebuildModalBackdrop | button#btnPrRebuildConfirm | - | Rebuild | yes | PASS | named; 1 JS ref(s) |
| modal:hardDeleteModalBackdrop | button#btnHardDeleteConfirm | - | Delete | yes | PASS | named; 1 JS ref(s) |
| modal:snapshotRefreshModalBackdrop | button#btnSnapshotRefreshConfirm | button | Refresh Now | yes | PASS | named; 2 JS ref(s) |
| modal:clearSelectedVendorModalBackdrop | button#btnClearSelectedVendorConfirm | button | Clear Vendor Assignment | yes | PASS | named; 2 JS ref(s) |
| modal:generatePrModalBackdrop | button#btnGenPrConfirm | - | Generate | yes | PASS | named; 1 JS ref(s) |
| modal:prEditReqModalBackdrop | div | dialog | Edit Requested Qty | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditReqModalBackdrop | input#prEditReqQty | number |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditReqModalBackdrop | textarea#prEditReqReason | - |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditReqModalBackdrop | button#btnPrEditReqCancel | - | Cancel | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditReqModalBackdrop | button#btnPrEditReqSave | - | Save | yes | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditReqModalBackdrop | dialog#prEditReqModalBackdrop | dialog | Edit Requested Qty | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditDeltaModalBackdrop | div | dialog | Edit Manual Delta | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditDeltaModalBackdrop | input#prEditDeltaQty | number |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditDeltaModalBackdrop | textarea#prEditDeltaReason | - |  | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditDeltaModalBackdrop | button#btnPrEditDeltaCancel | - | Cancel | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditDeltaModalBackdrop | button#btnPrEditDeltaSave | - | Save | yes | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prEditDeltaModalBackdrop | dialog#prEditDeltaModalBackdrop | dialog | Edit Manual Delta | no | DEFER | modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR) |
| modal:prAddLineModalBackdrop | button#btnPrAddLineSave | - | Add Line | yes | PASS | named; 1 JS ref(s) |
| modal:prSetStatusModalBackdrop | button#btnPrSetStatusConfirm | - | Confirm | yes | PASS | named; 1 JS ref(s) |
| modal:createIndentModalBackdrop | button#btnCiCreate | - | Create Indent | yes | PASS | named; 1 JS ref(s) |
| modal:indentFromPrModalBackdrop | button#btnIfpCreate | - | Create Indent | yes | PASS | named; 1 JS ref(s) |
| modal:indentAddLineModalBackdrop | button#btnIalSave | - | Save | yes | PASS | named; 1 JS ref(s) |
| header | button#btnRefreshProcurementSnapshots | button | Refresh procurement snapshots | yes | PASS | named; 5 JS ref(s) |
