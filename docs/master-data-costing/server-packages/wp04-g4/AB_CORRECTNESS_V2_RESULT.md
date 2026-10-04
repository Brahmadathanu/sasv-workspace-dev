# WP04-G4 — V2 bounded correctness result and independent assessment

2026-10-04. **PASS AT THE EXACT LIMITED CORRECTNESS SCOPE; INDEPENDENT RESTORATION READBACK PASS. G4 INCOMPLETE / APPLICATION HOLD.** Raw sanitized counts/catalogue metadata: [AB_CORRECTNESS_V2_RESULT.json](AB_CORRECTNESS_V2_RESULT.json).

## Authority / authorization / guards
User explicitly authorized “correctness operation and readback” in response to the exactV2 request. Targetqhmoqtxpeasamtlxaoak, reconciled maine421fe8df9b98b4956acdcd4cadeb36a3f9b923c, exactscriptab-correctness-proposal-v2.sql SHA256fafa65b083fe46fd93628857a3b6659e49d93c556791c25aa6dd28cd1737e23b, preparation/review auditfefa4409e463fee2c6a8c894539e78f3d2974db5. Fresh fetch matched main/local/origin audit; exactV2 and manifest hashes matched. Fresh live six original definition/attribute/ACL/event checks match; candidates0/idleWP040; sample lifecycle/Productmembership,period2026-09-01/valuation2026-09-10/latestSUCCESS115,EXACT114context,missingSKU-1absence andRESOLVED_POLICYsample1 all matched. Frozen script checks existing actor claim/permission before candidate work; no native login/Auth proof.

One exactV2 execution through ChatGPT-owned Supabase execute_sql, followed immediately by a separate frozen read-only readback call. No timeout/error/retry/altered script. One outer REPEATABLE READ transaction; noCOMMIT; both exact package restore sequences/guards and finalROLLBACK completed. V2 authorization consumed. No deployment, business-data/fixture/actor writer, fullportfolio/performance operation or client work. This included authorized transaction-local production DDL and must not be described as a read-only operation.

## Returned bounded correctness evidence
| Item | Result / grain |
|---|---|
| Canonical RPC invocations |18completed:15successful full-JSON reads +3expected missingSKU exceptions |
| Canonical comparisons |5cases in original/historical/corrected stages:LIVE SKU1,11,1795;EXACTSKU11run114/115; fullJSON equality checks passed |
| Scheme RESOLVED_POLICY |Required existing sample1guard passed; canonical/fullJSON preserved |
| Empty regional sample |Captured sample1795 included/fullJSON parity passed; NOT_REQUIRED semantics preserved |
| Inactive/sample lifecycle |ExistingSKU1795 included; fullJSON preserved; noactivationrulechange |
| Bounded aggregation |6old/corrected extracted-query scenarios over3captured assessments; all envelope fields except natural observed_at equal; timestamp string guard passed |
| Aggregation cases |unfilteredpage1;emptycursor1795/fullcensus;combinedProductmaster/owner/route;contradictorycode/owner;READYfilter;zeropopulation |
| Invalid context / empty-page refusal |2checks passed |
| Scheme/regional literal predicates |5+5passed |
| Exact in-transaction restores |guarded source identity/ACL/name absence checks passed |
| Portfolio invocations |0; no611-SKU/corepopulation assessment |
| Accepted-review runtime case |NOT_RUN_NOT_REQUIRED_IN_THIS_LIMITED_PROPOSAL; remains unresolved for widerproof |
| Native/API |NOT_RUN |
| Performance |NOT_PROVED |
| FullG4 |INCOMPLETE |

All reported completion counts are supported by successful end-of-script result plus fail-fast assertions. Five-case parity is sampled and cannot be generalized to allSKU/CSE/acceptance cases. Boundedquery runs use mechanically extracted aggregation over capturedrows, not actual publicportfolio RPC validation/fullmembership/coreevaluation/performance proof. NewBquery structure statically retains one materialized core expression, but publicportfolio runtime path remains uninvoked in this operation. No speculative nested time attribution or speed claim. Old10.822426s timing remains the historical uncorrected observation; this operation neither repeats nor replaces it.

## Independent restoration readback
Separate metadata call after finalROLLBACK returned sixoriginaldefinitionmatch=true;originalcanonical ACLpostgres/authenticated/service_role and enrichpostgres/service_role exact;ownerpostgres/STABLE/SECDEF/JSONB/originalsearchpaths;eventfingerprint4e2c16f8333e51161dc11c5376fb3296;candidatecount0;idleWP04transactions0. This establishes original persisted state after the authorized operation, separately from in-transaction restore assertions. No guessed cleanup/extraDDL needed or performed.

## Independent G4 disposition / exact next gate
V2 resolves the two proof assertion typing defects and establishes A common-enrichment output parity for the five tested LIVE/EXACT cases, includingRESOLVED_POLICY/emptyregional/inactive and missingSKUerror preservation. It establishes B aggregation transformation parity only on bounded capturedinputs. It does not establish fullcontract acceptance: accepted-review/noSUCCESS,allSKU/CSE,ALL_EXISTING/filtertraversal,nativeAPIactor/payload,widerperformance/innerplan/committedrollback and clientregression proof/disposition remain unresolved. PriorV1 failure/readback and earlier accepted tests remain intact. No decision/parked promotion.

**Exact next gate:WP04-G4 — Prepare and independently review the smallest corrected OPERATIONAL portfolio-performance proposal.** That preparation is the next action, not performed here. Freeze freshfullmembership/context/source/package/digest and count/parity/totalelapsed/size/restore/readback checks; atmostone actualcorrectedportfolio invocation and no new611baseline evaluation. No profilingextraevaluation/timeoutincrease/autorun. Only after exactreview and newexplicitproductionauthorization may itexecute. Successful limitedcorrectness allows that proposal to be considered; absentwiderproof is not waived. If newplanning reveals necessaryscope expansion,review onlyaffectedportion. G4 remainsincomplete/applicationHOLD;G5blocked;no deployment/client transition.

Workflow:V2singleauthorizedcorrectnessPASS→separateoriginalreadbackPASS→boundedindependentevidenceassessmentcomplete→correctedperformanceproposal preparation/review, then explicitauthorizationboundary.
WP progress:G0–G3retained;earlierlimitedPASSretained;V1failure/readbackretained;V2limitedPASS;G4incomplete/G5blocked. Programme4/13. Currentgate:WP04-G4 — V2boundedcorrectness/independentreadbackPASS,assessmentcomplete. Next:exactcorrectedperformanceproposal preparation/review, notexecution.
Parked:UX-P01/02,NAV-P01/02,CSE-P01,SEC-P01/02 unchanged. Locked:canonicalauthority,lifecycleseparation,governedLIVE/EXACT,specialistownership,DEC-014;WP03closed. Main/auditbranchunmerged;no rebase/mainmerge/tag/release;unrelatedlocaldraftpreserved. WP04 staysinthischat;formalclosurestillrequiresprogramme records and mandatoryWP05new-chat handover.
