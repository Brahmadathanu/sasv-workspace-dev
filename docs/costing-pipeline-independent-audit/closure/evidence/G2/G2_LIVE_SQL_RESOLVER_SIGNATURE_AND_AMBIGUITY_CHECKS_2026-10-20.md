# G2 live SQL read-only contract checks — 20 October 2026

Live PostgreSQL catalog verified BOTH resolver signatures `(integer,date) RETURNS bigint`, volatility STABLE. Family32 as-of 2026-08-24 yields route34 SUPERSEDED and route38 APPROVED, both unarchived date-eligible. Product957 as-of 2026-08-25 yields route72 SUPERSEDED and route73 APPROVED, both unarchived date-eligible. Thus broadening APPROVED to SUPERSEDED without ambiguity detection gives multiple candidates in actual data.

Checks were SELECT-only; they establish candidate evidence, NOT executable function replacement, permission tests or pgTAP integration. Strict prospective approval unchanged. G2/CI-032 OPEN. No live SQL writes or merges.
