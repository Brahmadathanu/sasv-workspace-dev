# WP10 — CL18 active-destination reparent gate (2026-11-16)

CL17 previously passed by rejecting a move to **inactive** product 2; it did not isolate route validity. CL18 now exercises active SKU reparent from product 1 (approved route) to product 3, which remains `status='Active'` but is moved to subgroup 3 with no approved route. The fixture asserts that product 3 is active, that the update is rejected for a reason other than inactive product, timeout or deadlock, and that the SKU remains active on original product 1.

This is disposable PostgreSQL only. **CL18 is NOT TESTED until the new commit's CI job passes and its CL18 log line is reviewed.** A passing CI job alone is not sufficient if the error reason is unrelated to route validity. Next: inspect CL18 error text, cover parent lock order with product route mutations and finalize independent correction-only SQL review. No production writes or deployment authorized.
