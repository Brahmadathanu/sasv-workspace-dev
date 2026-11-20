# C1B client audit — 1 November 2026

PR #117 is a draft stacked on PR #115, head 7a8f9294ad0287ff7ce5d8b393725a14206cfb06. Neither PR merged.

Independent direct source inspection confirms both requested fixes: approved run selector says `Approved — displayed for this period` instead of suggesting historical approved runs are current pricing basis; draft run warning states row-drawer per-line evidence belongs to displayed/governed run, not draft selected run, and current diagnosis represents today's sources. Audit comment posted to #117.

Code audit status: conditional acceptance. Claude reports 260/260 unit tests and 14 passing / 3 existing failing smoke tests, not independently rerun by orchestrator. Live database view was previously deployed and inspected; real browser positive and negative permission tests remain pending.

Release gates unchanged: (1) Jarvis-confirmed cache version and all pins; (2) explicit owner squash-merge authorisation for #115 followed by reviewed rebasing and separate #117 authorisation; (3) controlled feature flag; (4) permitted/denied JWT test and real browser 143/148 selection and fallback; (5) verify draft evidence limitation and route mapping. Do not claim Gate 1 complete before owner acceptance. Overall 3/10 programme gates passed.

Parked technical limitation: governed-only per-line drawer evidence, missing COST_REVIEW_WORKBENCH route for 111 of 114 review/blocked rows, prime cost cause split. Keep corrections and evidence contracts separately governed; do not fabricate draft line evidence.
