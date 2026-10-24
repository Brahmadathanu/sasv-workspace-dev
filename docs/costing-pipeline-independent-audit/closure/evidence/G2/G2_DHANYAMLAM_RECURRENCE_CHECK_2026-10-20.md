# G2 Dhanyamlam recurrence check (read-only, 20 Oct 2026)

Source: live frozen product_direct_labour_step_snapshot, run 128, product 51. Seq40 processing vessel: factor 38.4, occurrences 8, cycles 8; seq50 manual: 64, 8, 8; seq60 processing vessel: 64, 8, 8; seq70 storage: 6.4, 8, 8. These frozen factors already include occurrence and cycle scaling. Do not apply either multiplier to the frozen factor again.

Business validation OPEN: are the two 8-count dimensions independent physical repetitions or two descriptions of the same eight operations? This is not evidenced by the current database. No costing, route, run, switch, cron or migration changed. G2/CI-032 OPEN.
