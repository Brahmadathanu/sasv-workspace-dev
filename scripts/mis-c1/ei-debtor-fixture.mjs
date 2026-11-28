// Synthetic browser RPC responses. No connection, production records or credentials.
export function debtorFixture(mode = "editor") {
  const mis = window.__mis;
  mis.handlers ??= {};
  const ok = (data) => ({ data, error: null });
  const fail = (code) => ({ data: null, error: { code } });
  const access = (role) => mode === "editor" || mode === "viewer" || mode.startsWith(role);
  const edit = (role) => mode === "editor" || mode === role + "-editor";
  const protect = (role, write, run) => (args) => (write ? edit(role) : access(role)) ? run(args) : fail("42501");
  const lookups = {
    regions: [{ id: 1, name: "Fixture region" }, { id: 2, name: "Fixture offset region" }],
    godowns: [{ id: 10, name: "Fixture godown", region_id: 1 }, { id: 11, name: "Offset godown", region_id: 2 }],
    districts: [{ id: 20, district_name: "Fixture district", state_name: "Fixture state", region_id: 1, revision: 1, is_active: true }],
    coverage: [{ godown_id: 10, district_id: 20, revision: 1, is_active: true }],
    areas: [{ id: 30, district_id: 20, area_name: "Fixture area", revision: 1, is_active: true }],
    types: [{ id: 40, code: "DEALER", name: "Fixture dealer", definition: "Synthetic class", revision: 1, is_active: true }],
  };
  const complete = { region_id: 1, godown_id: 10, district_id: 20, area_id: 30, type_id: 40 };
  const profiles = new Map();
  const masterKeys = { district: "districts", coverage: "coverage", area: "areas", type: "types" };
  const get = (id) => {
    if (!profiles.has(id)) profiles.set(id, { identity: { id }, classification: id === 1 ? null : complete, classification_valid: id !== 1, profile: null, revision: 0, status: id === 1 ? "DRAFT" : "ACTIVE", aliases: [{ source_name: "Fixture Debtor " + id, is_primary: true, is_active: true, revision: 1 }] });
    return profiles.get(id);
  };
  const audit = [];
  const event = (entity_name, entity_id, reason, new_record) => audit.unshift({ entity_name, entity_id, reason, new_record, old_record: null, event_at: "2026-11-28T09:00:00Z", operation: "UPSERT", actor_user_id: "fixture" });
  const paginate = (rows, { p_offset = 0, p_limit = 50 }) => ({ rows: rows.slice(p_offset, p_offset + p_limit), total_rows: rows.length });
  const search = (value, pattern) => value.toLowerCase().includes((pattern || "").toLowerCase());
  const debtorRows = () => Array.from({ length: 63 }, (_, index) => {
    const id = index + 1;
    const record = get(id);
    return { debtor_id: id, ledger_name: "Fixture Debtor " + id, signed_amount: id < 55 ? -120 : 0, bill_count: id < 55 ? 1 : 0, kyc_status: record.status === "ACTIVE" && !record.classification_valid ? "INVALID" : record.status };
  }).concat({ debtor_id: null, ledger_name: "Fixture Unmapped", signed_amount: -50, bill_count: 1, kyc_status: "UNMAPPED" });
  const policies = new Map();
  const key = (a) => a.p_debtor ? "debtor:" + a.p_debtor : a.p_type + ":" + a.p_region;
  const historyFor = (key) => policies.get(key) || { rows: [], revision: 0 };
  const matched = (items, date) => items.rows.find((row) => row.effective_from <= date && (!row.effective_to || row.effective_to > date));
  const schemes = [{ id: 1, scheme_name: "No Scheme" }, { id: 2, scheme_name: "Fixture scheme" }];
  Object.assign(mis.handlers, {
    get_user_permissions: () => ok([
      { target: "module:executive-mis-dashboard", can_view: mis.permission === "granted", can_edit: false },
      { target: "role:ei-debtor-kyc", can_view: access("kyc"), can_edit: edit("kyc") },
      { target: "role:ei-debtor-commercial", can_view: access("commercial"), can_edit: edit("commercial") },
    ]),
    ei_debtor_lookups: () => ok(lookups),
    get_mis_finance_party_page: (args) => {
      const payables = [{ party_name: "Fixture Creditor", mis_group_name: "Sundry Creditors", bill_count: 1, signed_outstanding_tally_value: 400, outstanding_amount_mis_value: 400 }];
      const receivables = debtorRows().filter((r) => r.bill_count && (args.p_partition !== "unclassified" || r.kyc_status !== "ACTIVE") &&
        (args.p_partition !== "classified" && !args.p_region_id || r.kyc_status === "ACTIVE") && args.p_region_id !== 2)
        .map((r) => ({ ...r, party_name: r.ledger_name, mis_group_name: "Sundry Debtors", outstanding_amount_mis_value: Math.abs(r.signed_amount), signed_outstanding_tally_value: r.signed_amount }));
      const rows = (args.p_group_filter === "all" ? [...payables, ...receivables] : args.p_group_filter === "receivables" ? receivables : payables)
        .filter((r) => search(r.party_name, args.p_search));
      return ok(paginate(rows, args).rows.map((row) => ({ ...row, total_rows: rows.length })));
    },
    get_mis_finance_ageing_summary: (args) => {
      const bounds = args.p_bounds || [30, 60, 90];
      const group = (group, label, value) => ({ group, label, total_amount: value, bucket_amounts: bounds.map(() => 0).concat(value), bucket_bill_counts: bounds.map(() => 0).concat(1), undated_bill_count: 1, undated_amount: 0, bill_count: 2 });
      const groups = [group("payables", "Payables — Sundry Creditors", 400), group("receivables", "Receivables — Sundry Debtors", 120)];
      return ok({ bounds, as_of: args.p_as_of || "2026-11-28", groups, filtered_receivables: args.p_region_id || args.p_partition ? group("receivables", "Receivables — Sundry Debtors", -30) : undefined });
    },
    get_mis_finance_bill_page: (args) => {
      const rows = Array.from({ length: 502 }, (_, i) => ({
        bill_id: i + 1, report_date: "2026-11-28", party_name: args.p_party || "Fixture Debtor 1", mis_group_name: "Sundry Debtors",
        bill_ref: i ? "Fixture " + i : "On account", bill_date_text: i ? "25-Nov-26" : null,
        outstanding_amount_tally_value: i ? -1 : 30, party_amount: i ? 1 : -30, company_amount: i ? 1 : -30,
        age_days: i ? 3 : null, bucket_no: i ? 0 : null,
      }));
      return ok({ ...paginate(rows, args), groups: [{ group_name: "Sundry Debtors", bill_count: 502, party_amount: 471, company_amount: 471 }] });
    },
    ei_management_alerts: () => ok({ coverage: "PARTIAL_CATALOGUE", rows: [{
      key: "finance.debtor_kyc_incomplete", label: "Outstanding debtors without active KYC", state: "REVIEW",
      findings: 2, evidence_date: "2026-11-28", exposure_amount: 170,
      deep_link: { lens: "finance", panel: "debtor-kyc", partition: "unclassified" },
    }] }),
    ei_debtor_register_page: protect("kyc", false, (a) => ok(paginate(debtorRows().filter((r) => search(r.ledger_name, a.p_search)), a))),
    ei_debtor_profile: protect("kyc", false, (a) => ok(get(a.p_id))),
    ei_debtor_register: protect("kyc", true, (a) => { event("ei_debtor", 64, a.p_reason, a.p_party); return ok(64); }),
    ei_debtor_save: protect("kyc", true, (a) => {
      const current = get(a.p_id);
      if (a.p_revision !== current.revision) return fail("40001");
      const status = { SAVE: current.status, ACTIVATE: "ACTIVE", INACTIVATE: "INACTIVE" }[a.p_action];
      const classification = a.p_class || current.classification;
      const valid = !!classification && Object.keys(complete).every((key) => classification[key]);
      if (status === "ACTIVE" && !valid) return fail("23514");
      const next = { ...current, status, classification, classification_valid: valid, profile: a.p_profile || current.profile, revision: current.revision + 1 };
      profiles.set(a.p_id, next);
      event("ei_debtor_kyc", a.p_id, a.p_reason, a.p_profile);
      return ok(next);
    }),
    ei_debtor_alias_set: protect("kyc", true, (a) => {
      const aliases = get(a.p_id).aliases;
      const index = aliases.findIndex((alias) => alias.source_name === a.p_party);
      if (index !== -1 && !a.p_revision) return fail("23505");
      if (index !== -1 && aliases[index].revision !== a.p_revision) return fail("40001");
      const row = { source_name: a.p_party, revision: a.p_revision + 1, is_active: a.p_active };
      if (index === -1) aliases.push(row);
      else aliases[index] = row;
      event("ei_debtor_alias", a.p_id, a.p_reason, row);
      return ok(row);
    }),
    ei_debtor_master_set: protect("kyc", true, (a) => {
      const rows = lookups[masterKeys[a.p_kind]];
      const index = rows.findIndex((row) => a.p_kind === "coverage" ? row.district_id === a.p_id && row.godown_id === a.p_godown_id : row.id === a.p_id);
      const previous = rows[index];
      if ((previous?.revision ?? 0) !== a.p_revision) return fail("40001");
      const updated = { id: rows.length + 100, ...previous, ...a.p_data, revision: a.p_revision + 1 };
      if (a.p_kind === "coverage") Object.assign(updated, { district_id: a.p_id, godown_id: a.p_godown_id });
      if (index >= 0) rows[index] = updated;
      else rows.push(updated);
      return ok(updated);
    }),
    ei_debtor_audit_page: (a) => (a.p_entity.startsWith("ei_debtor_terms") || a.p_entity === "ei_debtor_type_terms" ? access("commercial") : access("kyc")) ?
      ok(paginate(audit.filter((row) => row.entity_name === a.p_entity && row.entity_id === a.p_id), a)) : fail("42501"),
    ei_debtor_scheme_page: protect("commercial", false, (a) => ok(paginate(schemes.filter((r) => search(r.scheme_name, a.p_search)), a))),
    ei_debtor_terms_history: protect("commercial", false, (a) => {
      const history = historyFor(key(a));
      return ok({ ...paginate(history.rows, a), revision: history.revision });
    }),
    ei_debtor_terms_get: protect("commercial", false, (a) => {
      const override = matched(historyFor("debtor:" + a.p_id), a.p_date);
      const fallback = matched(historyFor("40:1"), a.p_date);
      const scheme = override?.scheme_id ?? fallback?.scheme_id;
      const source = (field) => override?.[field] != null ? "OVERRIDE" : fallback?.[field] != null ? "TYPE" : "UNCONFIGURED";
      return ok({ discount_percent: override?.discount_percent ?? fallback?.discount_percent, discount_source: source("discount_percent"), scheme_source: source("scheme_id"), scheme_name: schemes.find((row) => row.id === scheme)?.scheme_name, region_id: 1, type_id: 40 });
    }),
    ei_debtor_terms_set: protect("commercial", true, (a) => {
      const history = historyFor(key(a));
      if (a.p_revision !== history.revision) return fail("40001");
      const prior = history.rows[0];
      if (prior && a.p_from <= prior.effective_from) return fail("23P01");
      if (prior && !prior.effective_to) prior.effective_to = a.p_from;
      const row = { id: history.revision + 1, discount_percent: a.p_discount, scheme_id: a.p_scheme, effective_from: a.p_from, effective_to: null, reason: a.p_reason };
      history.rows.unshift(row);
      history.revision++;
      policies.set(key(a), history);
      event(a.p_debtor ? "ei_debtor_terms_override" : "ei_debtor_type_terms", a.p_debtor ?? row.id, a.p_reason, row);
      return ok(row);
    }),
    ei_debtor_terms_withdraw: protect("commercial", true, (a) => {
      const history = historyFor(key(a));
      if (a.p_revision !== history.revision) return fail("40001");
      history.rows[0].effective_to = a.p_to;
      history.revision++;
      return ok(history.rows[0]);
    }),
  });
}
