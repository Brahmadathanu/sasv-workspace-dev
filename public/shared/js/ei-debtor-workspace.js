import { CLASS_DIMENSIONS, classificationArgs, classificationOptions, changeClassification, debtorError } from "./ei-debtor-contract.js?kyc=1";

const PROFILE = {
  business_name: "Business name", contact_person: "Contact person", phone: "Phone", alternate_phone: "Alternate phone",
  email: "Email", address_line_1: "Address line 1", address_line_2: "Address line 2", locality: "Locality",
  postal_code: "Postal code", state_name: "State", country_name: "Country", gstin: "GSTIN", notes: "Notes",
};
const MASTER = {
  district: { label: "Districts", list: "districts", fields: { state_name: "State", district_name: "District name" } },
  coverage: { label: "Godown–district coverage", list: "coverage", fields: {} },
  area: { label: "Areas", list: "areas", fields: { area_name: "Area name" } },
  type: { label: "Debtor types", list: "types", fields: { code: "Code", name: "Name", definition: "Definition" } },
};
const DEBTOR_AUDIT = { ei_debtor: "Identity", ei_debtor_alias: "Aliases", ei_debtor_classification: "Classification", ei_debtor_kyc: "KYC profile" };
const MASTER_AUDIT = { district: "ei_debtor_district", coverage: "ei_debtor_godown_district", area: "ei_debtor_area", type: "ei_debtor_type" };
const STATUSES = ["ACTIVE", "DRAFT", "INACTIVE", "INVALID", "UNMAPPED"];
const statusLabel = (status) => STATUSES.includes(status) || ["UNVERIFIED", "VERIFIED", "REVIEW"].includes(status) ? status[0] + status.slice(1).toLowerCase() : "—";
const numberOrNull = (value) => value === "" || value == null ? null : Number(value);
const today = () => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key).value).join("-");
};

export function classificationFields(esc, lookups, values, { disabled = false, keepInactive = false } = {}) {
  return CLASS_DIMENSIONS.map(([key, label, list, name]) => {
    const choices = classificationOptions(lookups, key, values);
    const current = values[key];
    const missing = keepInactive && current && !choices.some((row) => String(row.id) === String(current));
    const old = missing && lookups?.[list]?.find((row) => String(row.id) === String(current));
    return `<label>${label}<select name="${key}" aria-label="${esc(label)}" ${disabled || (!choices.length && !missing) ? "disabled" : ""}>
      <option value="">Any / unset</option>
      ${missing ? `<option value="${esc(current)}" selected>${esc(old?.[name] || current)} (unavailable)</option>` : ""}
      ${choices.map((row) => `<option value="${esc(row.id)}" ${String(row.id) === String(current) ? "selected" : ""}>${esc(row[name])}</option>`).join("")}
      </select></label>`;
  }).join("");
}

export function mountDebtorWorkspace(host, { read, permissions, partition, esc, money, onChange, back }) {
  const { kyc, commercial } = permissions;
  let lookups, cleanup = () => {};
  let view = "register";
  let registerMode = kyc.view && partition !== "unclassified" ? "history" : "outstanding";
  let filters = { partition };
  let search = "";
  let lifecycle = "";
  let masterKind = "district";
  let selected = new Map();
  let termsScope = { p_debtor: null, p_type: null, p_region: null };
  let termsDate = today();
  let debtorName = "";

  const button = (label, extra = "") => `<button type="button" class="ei-ctl" ${extra}>${esc(label)}</button>`;
  const input = (key, label, value = "", attrs = "") => `<label>${label}<input name="${key}" value="${esc(value ?? "")}" ${attrs}></label>`;
  const select = (key, label, options, current = "", placeholder = "Select…", disabled = false) => `<label>${label}<select name="${key}" aria-label="${esc(label)}" ${disabled ? "disabled" : ""}>${placeholder ? `<option value="">${placeholder}</option>` : ""}${options.map(([value, text]) => `<option value="${esc(value)}" ${String(value) === String(current) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const choices = (key, name, all = false) => (lookups?.[key] || []).filter((row) => all || row.is_active !== false).map((row) => [row.id, row[name] + (row.is_active === false ? " (inactive)" : "")]);
  const nameFor = (key, id, name) => lookups?.[key]?.find((row) => String(row.id) === String(id))?.[name] ?? id ?? "—";
  const classNames = (record) => CLASS_DIMENSIONS.map(([key, , list, name]) => record[key] && nameFor(list, record[key], name)).filter(Boolean).join(" · ");
  const section = () => host.querySelector(".ei-kyc-content");
  const setStatus = (message) => { const el = host.querySelector(".ei-kyc-notice"); if (el) el.textContent = message; };
  const reason = () => input("reason", "Reason", "", "required maxlength=2000");
  const classKeys = CLASS_DIMENSIONS.map(([key]) => key);
  const classChanged = (event, next, update) => {
    if (!classKeys.includes(event.target.name)) return;
    const key = event.target.name;
    update(changeClassification(next, key, event.target.value));
    event.currentTarget.querySelector(`[name="${key}"]`)?.focus();
  };

  function dialog(title, trigger = document.activeElement) {
    const el = document.createElement("dialog");
    el.className = "ei-kyc-dialog modal-window";
    el.setAttribute("aria-label", title);
    el.innerHTML = `<header class="modal-header"><h3 class="finance-modal-title">${esc(title)}</h3>${button("Close", 'data-close autofocus')}</header><div class="ei-kyc-dialog-body"></div>`;
    host.append(el);
    el.querySelector("[data-close]").onclick = () => el.close();
    el.addEventListener("close", () => { el.remove(); if (trigger?.isConnected) trigger.focus(); }, { once: true });
    el.addEventListener("keydown", (event) => {
      if (event.key === "Escape") event.stopPropagation();
    });
    el.showModal();
    return { el, body: el.lastElementChild };
  }

  function loadInto(body, load, render) {
    const run = async () => {
      body.innerHTML = '<p role="status">Loading…</p>';
      try {
        const data = await load();
        if (body.isConnected) render(data);
      } catch (error) {
        if (!body.isConnected) return;
        body.innerHTML = `<p role="alert">${esc(debtorError(error))}</p>${button("Retry")}`;
        body.querySelector("button").onclick = run;
      }
    };
    run();
    return run;
  }

  function paged(body, load, render, { filter = () => true, onPage = () => {} } = {}) {
    let offset = 0, total = Infinity, busy = false, shown = 0;
    body.innerHTML = '<div data-results></div><div data-more role="status"></div>';
    const results = body.firstElementChild;
    const more = body.lastElementChild;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) next(); });
    observer.observe(more);
    const next = async () => {
      if (busy || offset >= total || !more.isConnected) return;
      busy = true;
      more.textContent = "Loading…";
      let failed = false;
      try {
        const data = await load(offset);
        if (!more.isConnected) return;
        const { rows } = data;
        total = Number(data.total_rows);
        offset = rows.length ? offset + rows.length : total;
        const visible = rows.filter(filter);
        shown += visible.length;
        onPage(data);
        render(results, visible);
        more.textContent = offset < total ? "Loading more when in view" : shown ? `${shown} shown` : "No matching records";
      } catch (error) {
        if (!more.isConnected) return;
        failed = true;
        more.innerHTML = `${esc(debtorError(error))} ${button("Retry")}`;
        more.querySelector("button").onclick = next;
      } finally {
        busy = false;
        if (!more.isConnected || offset >= total) observer.disconnect();
        else if (!failed) { observer.unobserve(more); observer.observe(more); }
      }
    };
    next();
    return () => observer.disconnect();
  }

  function form(body, fields, actions, submit, reload) {
    body.innerHTML = `<form class="ei-kyc-form">${fields}<div class="ei-kyc-actions">${actions.map(([key, label]) => `<button class="ei-ctl" type="submit" value="${key}">${label}</button>`).join("")}</div><div role="alert" data-form-error></div></form>`;
    const el = body.firstElementChild;
    el.onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(el));
      if ("reason" in values && !values.reason.trim()) { el.querySelector("[data-form-error]").textContent = "Enter a reason."; return; }
      const controls = [...el.querySelectorAll('button[type="submit"]')];
      controls.forEach((control) => { control.disabled = true; });
      const errorHost = el.querySelector("[data-form-error]");
      errorHost.textContent = "";
      try { await submit(values, event.submitter?.value); }
      catch (error) {
        errorHost.textContent = debtorError(error);
        if (error?.code === "40001" && reload) {
          errorHost.insertAdjacentHTML("beforeend", " " + button("Reload current version"));
          errorHost.lastElementChild.onclick = reload;
        }
      } finally { controls.forEach((control) => { control.disabled = false; }); }
    };
    return el;
  }

  function audit(entity, id, title = "Audit history") {
    const { el, body } = dialog(title);
    const stop = paged(body, (offset) => read("ei_debtor_audit_page", { p_entity: entity, p_id: id, p_limit: 50, p_offset: offset }), (results, rows) => {
      results.insertAdjacentHTML("beforeend", rows.map((row) => `<details class="ei-kyc-card"><summary>${esc(row.event_at)} · ${esc(row.operation)} · ${esc(row.reason)}</summary><dl><dt>Actor</dt><dd>${esc(row.actor_user_id)}</dd><dt>Previous</dt><dd><pre>${esc(JSON.stringify(row.old_record, null, 2))}</pre></dd><dt>Current</dt><dd><pre>${esc(JSON.stringify(row.new_record, null, 2))}</pre></dd></dl></details>`).join(""));
    });
    el.addEventListener("close", stop, { once: true });
  }

  function changed(message) {
    if (!host.isConnected) return;
    onChange();
    selected.clear();
    renderView();
    setStatus(message);
  }

  function openProfile(id, label) {
    const { el, body } = dialog(label);
    const reload = loadInto(body, () => read("ei_debtor_profile", { p_id: id }), (data) => {
      if (!data) { body.textContent = "Debtor profile unavailable."; return; }
      const profile = data.profile || {};
      let values = { ...data.classification };
      const initial = { ...values };
      const aliasHtml = (data.aliases || []).map((alias, index) => `<li>${esc(alias.source_name)} · ${alias.is_primary ? "Primary" : alias.is_active ? "Active" : "Inactive"} ${kyc.edit && !alias.is_primary ? button(alias.is_active ? "Inactivate alias" : "Reactivate alias", `data-alias="${index}"`) : ""}</li>`).join("");
      const state = `<p>Lifecycle: <strong>${statusLabel(data.status)}</strong> · Classification: <strong>${data.classification_valid ? "Valid" : "Incomplete or invalid"}</strong></p>`;
      const audits = Object.entries(DEBTOR_AUDIT).map(([key, label]) => button(label + " history", `data-audit="${key}"`)).join("");
      const verification = ["UNVERIFIED", "VERIFIED", "REVIEW"].map((key) => [key, statusLabel(key)]);
      const fields = `${state}<fieldset><legend>Classification</legend><div class="ei-kyc-grid" data-class>${classificationFields(esc, lookups, values, { keepInactive: true, disabled: !kyc.edit })}</div></fieldset>
        <fieldset><legend>Profile</legend><p>Contact, address and business details are optional.</p><div class="ei-kyc-grid">${Object.entries(PROFILE).map(([key, title]) => input(key, title, profile[key], kyc.edit ? key === "email" ? "type=email" : "" : "readonly")).join("")}
        ${select("verification_status", "Verification", verification, profile.verification_status || "UNVERIFIED", "", !kyc.edit)}</div></fieldset>`;
      const save = async (payload, action) => {
        const p_class = Object.fromEntries(classKeys.map((key) => [key, numberOrNull(values[key])]));
        const classPatch = classKeys.some((key) => numberOrNull(initial[key]) !== p_class[key]) ? p_class : null;
        const p_profile = Object.fromEntries(Object.keys(PROFILE).map((key) => [key, payload[key]?.trim() || null]));
        p_profile.verification_status = payload.verification_status;
        await read("ei_debtor_save", { p_id: id, p_revision: data.revision, p_class: classPatch, p_profile, p_action: action, p_reason: payload.reason.trim() });
        el.close();
        changed(action === "ACTIVATE" ? "Debtor activated." : "Profile saved.");
      };
      if (kyc.edit) {
        const actions = [["SAVE", data.status === "DRAFT" ? "Save draft" : "Save changes"]];
        if (data.status !== "ACTIVE") actions.push(["ACTIVATE", data.status === "INACTIVE" ? "Reactivate" : "Activate"]);
        form(body, fields + reason(), actions, save, reload);
      } else body.innerHTML = `<div class="ei-kyc-form">${fields}</div>`;
      body.insertAdjacentHTML("beforeend", `<section><h4>Ledger aliases</h4><ul>${aliasHtml}</ul>${kyc.edit ? button("Add alias", "data-add-alias") : ""} ${kyc.edit && data.status === "ACTIVE" ? button("Inactivate debtor", "data-inactivate") : ""}</section><div class="ei-kyc-actions">${audits}</div>`);
      const classHost = body.querySelector("[data-class]");
      classHost.onchange = (event) => classChanged(event, values, (next) => {
        values = next;
        classHost.innerHTML = classificationFields(esc, lookups, values, { keepInactive: true });
      });
      body.querySelectorAll("[data-audit]").forEach((item) => { item.onclick = () => audit(item.dataset.audit, id); });
      const alias = (existing) => {
        const modal = dialog(existing ? "Change alias status" : "Add ledger alias");
        form(modal.body, input("party", "Observed ledger name", existing?.source_name, existing ? "readonly" : "required") + reason(), [["save", "Confirm"]], async (payload) => {
          await read("ei_debtor_alias_set", { p_id: id, p_party: payload.party.trim(), p_active: existing ? !existing.is_active : true, p_revision: existing?.revision ?? 0, p_reason: payload.reason.trim() });
          modal.el.close();
          changed("Ledger alias updated.");
          reload();
        }, () => { modal.el.close(); reload(); });
      };
      body.querySelectorAll("[data-alias]").forEach((item) => { item.onclick = () => alias(data.aliases[Number(item.dataset.alias)]); });
      const add = body.querySelector("[data-add-alias]");
      if (add) add.onclick = () => alias();
      const inactivate = body.querySelector("[data-inactivate]");
      if (inactivate) inactivate.onclick = () => {
        const modal = dialog("Inactivate debtor");
        form(modal.body, reason(), [["save", "Confirm inactivation"]], async (payload) => {
          await read("ei_debtor_save", { p_id: id, p_revision: data.revision, p_class: null, p_profile: null, p_action: "INACTIVATE", p_reason: payload.reason.trim() });
          modal.el.close(); el.close(); changed("Debtor inactivated.");
        }, () => { modal.el.close(); reload(); });
      };
    });
  }

  function register(row) {
    const { el, body } = dialog("Register debtor");
    form(body, input("party", "Observed ledger name", row.ledger_name, "readonly") + reason(), [["register", "Register"]], async (payload) => {
      const id = await read("ei_debtor_register", { p_party: row.ledger_name, p_reason: payload.reason.trim() });
      el.close(); changed("Debtor registered."); openProfile(id, row.ledger_name);
    });
  }

  function bulk() {
    const entries = [...selected.values()];
    const { body } = dialog("Bulk classification");
    let assignment = {};
    let action = "ACTIVATE";
    const setup = form(body, `<p>${entries.length} debtors selected.</p><div class="ei-kyc-grid" data-class>${classificationFields(esc, lookups, assignment)}</div>${select("action", "Lifecycle action", [["ACTIVATE", "Activate"], ["SAVE", "Save classification"]], action, "")}${reason()}`, [["preview", "Preview"]], async (payload) => {
      action = payload.action;
      const p_class = Object.fromEntries(classKeys.map((key) => [key, numberOrNull(assignment[key])]));
      if (action === "ACTIVATE" && classKeys.some((key) => p_class[key] === null)) {
        setup.querySelector("[data-form-error]").textContent = "Select all five dimensions to activate."; return;
      }
      const profiles = await Promise.allSettled(entries.map((row) => read("ei_debtor_profile", { p_id: row.debtor_id })));
      const scope = CLASS_DIMENSIONS.map(([key, title, list, name]) => `<li>${title}: ${esc(nameFor(list, p_class[key], name))}</li>`).join("");
      const targets = entries.map((row, index) => {
        const result = profiles[index];
        return `<li>${esc(row.ledger_name)} · ${result.status === "fulfilled" && result.value ? statusLabel(result.value.status) : "Unavailable"}</li>`;
      }).join("");
      form(body, `<p>${action === "ACTIVATE" ? "Activate" : "Save classification for"} the selected debtors.</p><ul>${scope}</ul><ul>${targets}</ul><p>Reason: ${esc(payload.reason)}</p>`, [["confirm", "Confirm bulk classification"]], async () => {
        const results = [];
        for (const [index, row] of entries.entries()) {
          const profile = profiles[index];
          try {
            if (profile.status !== "fulfilled" || !profile.value) throw profile.reason;
            await read("ei_debtor_save", { p_id: row.debtor_id, p_revision: profile.value.revision, p_class, p_profile: null, p_action: action === "ACTIVATE" && profile.value.status === "ACTIVE" ? "SAVE" : action, p_reason: payload.reason.trim() });
            results.push([row.ledger_name, "Saved"]);
          } catch (error) { results.push([row.ledger_name, debtorError(error)]); }
        }
        body.innerHTML = `<ul>${results.map(([name, message]) => `<li>${esc(name)} · ${esc(message)}</li>`).join("")}</ul>`;
        changed("Bulk classification finished.");
      });
    });
    const classHost = setup.querySelector("[data-class]");
    classHost.onchange = (event) => classChanged(event, assignment, (next) => {
      assignment = next; classHost.innerHTML = classificationFields(esc, lookups, assignment);
    });
  }

  function renderRegister() {
    const panel = section();
    panel.innerHTML = `<div class="ei-kyc-toolbar">
      <details class="ei-kyc-filters"><summary class="ei-ctl">Filters</summary>
      <div class="ei-kyc-grid">
        ${kyc.view ? select("registerMode", "Scope", [["history", "Current and historical"], ["outstanding", "Current outstanding"]], registerMode, "") : ""}
        ${registerMode === "outstanding" ? select("partition", "Classification", [["all", "All"], ["classified", "Classified"], ["unclassified", "Unclassified"]], filters.partition, "") : ""}
        ${select("lifecycle", "Status", STATUSES.map((status) => [status, statusLabel(status)]), lifecycle, "All statuses")}
        ${registerMode === "outstanding" ? classificationFields(esc, lookups, filters, { disabled: filters.partition === "unclassified" }) : ""}
      </div></details>
      ${input("search", "Search debtors", search, 'type="search" placeholder="Search debtors" autocomplete="off"')}
      ${kyc.edit ? button("Bulk classification", "data-bulk disabled") : ""}
      </div><div data-list></div>`;
    const results = panel.querySelector("[data-list]");
    const searchInput = panel.querySelector("[name=search]");
    const bulkButton = panel.querySelector("[data-bulk]");
    const syncSelection = () => {
      if (!bulkButton) return;
      bulkButton.disabled = !selected.size;
      bulkButton.textContent = selected.size ? `Bulk classification (${selected.size})` : "Bulk classification";
    };
    const draw = () => {
      cleanup();
      const outstanding = registerMode === "outstanding";
      const load = async (offset) => {
        if (!outstanding) return read("ei_debtor_register_page", { p_search: search, p_limit: 50, p_offset: offset });
        const rows = await read("get_mis_finance_party_page", { p_search: search, p_group_filter: "receivables", p_limit: 50, p_offset: offset, ...classificationArgs(filters) });
        return { total_rows: rows[0]?.total_rows ?? offset, rows: rows.map((row) => ({ ...row, ledger_name: row.party_name, signed_amount: row.signed_outstanding_tally_value })) };
      };
      cleanup = paged(results, load, (container, rows) => {
        if (!container.firstElementChild) container.innerHTML = '<table class="ei-kyc-table"><thead><tr><th>Debtor</th><th>Status</th><th>Bills</th><th>Signed outstanding</th></tr></thead><tbody></tbody></table>';
        const table = container.querySelector("tbody");
        for (const row of rows) {
          const tr = document.createElement("tr");
          const name = esc(row.ledger_name);
          const classification = outstanding ? classNames(row) : "";
          const open = kyc.view && row.debtor_id ? button(row.ledger_name, "data-profile") : kyc.edit ? `${name} ${button("Register", "data-register")}` : name;
          tr.innerHTML = `<td><div class="ei-kyc-party">${kyc.edit && row.debtor_id ? `<input type="checkbox" aria-label="Select ${name}" ${selected.has(row.debtor_id) ? "checked" : ""}>` : ""}${open}</div>${classification ? `<small>${esc(classification)}</small>` : ""}</td><td data-label="Status">${statusLabel(row.kyc_status)}</td><td data-label="Bills">${esc(row.bill_count)}</td><td data-label="Signed outstanding">${esc(money(row.signed_amount))}</td>`;
          const check = tr.querySelector("input");
          if (check) check.onchange = () => { if (check.checked) selected.set(row.debtor_id, row); else selected.delete(row.debtor_id); syncSelection(); };
          const profile = tr.querySelector("[data-profile]");
          if (profile) profile.onclick = () => openProfile(row.debtor_id, row.ledger_name);
          const add = tr.querySelector("[data-register]");
          if (add) add.onclick = () => register(row);
          table.append(tr);
        }
      }, { filter: (row) => !lifecycle || row.kyc_status === lifecycle });
    };
    let timer;
    searchInput.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!panel.contains(searchInput)) return;
        search = searchInput.value.trim();
        draw();
      }, 250);
    };
    panel.querySelector("details").onchange = (event) => {
      const { name, value } = event.target;
      if (name === "registerMode") registerMode = value;
      else if (name === "lifecycle") lifecycle = value;
      else if (name === "partition") filters = value === "unclassified" ? { partition: value } : { ...filters, partition: value };
      else filters = changeClassification(filters, name, value);
      search = searchInput.value.trim();
      renderView();
      const drawer = section().querySelector("details");
      drawer.open = true;
      drawer.querySelector(`[name="${name}"]`)?.focus();
    };
    if (bulkButton) bulkButton.onclick = bulk;
    syncSelection();
    draw();
  }

  function masterEditor(kind, row) {
    const { el, body } = dialog(row ? "Edit master record" : "Add master record");
    const definition = MASTER[kind];
    const active = !row || row.is_active;
    const parents = kind === "district" ? [["region_id", "Region", "regions", "name"]] : kind === "area" ? [["district_id", "District", "districts", "district_name"]] : kind === "coverage" ? [["godown_id", "Godown", "godowns", "name"], ["district_id", "District", "districts", "district_name"]] : [];
    const fields = parents.map(([key, label, list, name]) => select(key, label, choices(list, name, !!row), row?.[key], "Select…", !!row)).join("") +
      Object.entries(definition.fields).map(([key, label]) => input(key, label, row?.[key], row && key === "code" ? "readonly" : key === "code" ? 'required pattern="[A-Z][A-Z0-9_]*"' : "required")).join("");
    const edit = form(body, `<div class="ei-kyc-grid">${fields}${select("is_active", "Status", [["true", "Active"], ["false", "Inactive"]], active, "")}</div><p>Inactivating a master can make existing debtor classifications invalid.</p>${reason()}`, [["save", "Save"]], async (payload) => {
      if (parents.some(([key]) => !row && !payload[key])) { edit.querySelector("[data-form-error]").textContent = "Select the required parent values."; return; }
      const p_data = { is_active: payload.is_active === "true" };
      for (const key of Object.keys(definition.fields)) if (!row || key !== "code") p_data[key] = payload[key].trim();
      if (!row && kind === "district") p_data.region_id = Number(payload.region_id);
      if (!row && kind === "area") p_data.district_id = Number(payload.district_id);
      await read("ei_debtor_master_set", { p_kind: kind, p_id: kind === "coverage" ? row?.district_id ?? Number(payload.district_id) : row?.id ?? null, p_godown_id: kind === "coverage" ? row?.godown_id ?? Number(payload.godown_id) : null, p_revision: row?.revision ?? 0, p_data, p_reason: payload.reason.trim() });
      el.close();
      onChange();
      refreshLookups("Master record saved.");
    }, () => { el.close(); refreshLookups("Master records reloaded. Reopen the record to reconcile your edits."); });
    if (!row && kind === "coverage") {
      const godown = edit.elements.godown_id;
      const district = edit.elements.district_id;
      const cascade = () => {
        const region = lookups.godowns.find((item) => String(item.id) === godown.value)?.region_id;
        district.replaceChildren(new Option("Select…", ""), ...(lookups.districts || [])
          .filter((item) => item.is_active && item.region_id === region)
          .map((item) => new Option(item.district_name, item.id)));
        district.disabled = !region;
      };
      godown.onchange = cascade;
      cascade();
    }
  }

  function renderMasters() {
    const panel = section();
    const definition = MASTER[masterKind];
    const rows = lookups[definition.list] || [];
    panel.innerHTML = `<div class="ei-kyc-toolbar">${select("master", "Master", Object.entries(MASTER).map(([kind, item]) => [kind, item.label]), masterKind, "")}
      ${kyc.edit ? button("Add record", "data-add") : ""}</div><div data-masters></div>`;
    panel.querySelector("select").onchange = (event) => { masterKind = event.target.value; renderView(); section().querySelector("select").focus(); };
    const add = panel.querySelector("[data-add]");
    if (add) add.onclick = () => masterEditor(masterKind);
    const list = panel.querySelector("[data-masters]");
    if (masterKind === "district") list.insertAdjacentHTML("beforeend", `<p>Regions: ${esc(choices("regions", "name", true).map(([, label]) => label).join(", "))}</p>`);
    if (masterKind === "coverage") list.insertAdjacentHTML("beforeend", `<p>Godowns: ${esc(choices("godowns", "name", true).map(([, label]) => label).join(", "))}</p>`);
    for (const row of rows) {
      const title = masterKind === "coverage" ? `${nameFor("godowns", row.godown_id, "name")} · ${nameFor("districts", row.district_id, "district_name")}` : row.district_name || row.area_name || row.name;
      const detail = masterKind === "district" ? `${row.state_name} · ${nameFor("regions", row.region_id, "name")}` : masterKind === "area" ? nameFor("districts", row.district_id, "district_name") : masterKind === "type" ? `${row.code} · ${row.definition}` : "";
      const card = document.createElement("article");
      card.className = "ei-kyc-card";
      card.innerHTML = `<div><strong>${esc(title)}</strong> · ${row.is_active ? "Active" : "Inactive"}</div>${detail ? `<p>${esc(detail)}</p>` : ""}<div class="ei-kyc-actions">${kyc.edit ? button("Edit", "data-edit") : ""}${button("Audit history", "data-audit")}</div>`;
      const edit = card.querySelector("[data-edit]");
      if (edit) edit.onclick = () => masterEditor(masterKind, row);
      card.querySelector("[data-audit]").onclick = () => audit(MASTER_AUDIT[masterKind], row.id ?? row.district_id);
      list.append(card);
    }
    if (!rows.length) list.insertAdjacentHTML("beforeend", "<p>No master records.</p>");
  }

  function picker(title, request, label, choose) {
    const { el, body } = dialog(title);
    body.innerHTML = `${input("search", "Search", "", 'type="search" autocomplete="off"')}<div data-picker></div>`;
    const results = body.lastElementChild;
    const search = body.querySelector("input");
    let stop = () => {};
    let timer;
    const draw = () => {
      stop();
      stop = paged(results, (offset) => request(search.value.trim(), offset), (container, rows) => {
        for (const row of rows) {
          if (!label(row)) continue;
          const item = document.createElement("div");
          item.className = "ei-kyc-picker-item";
          item.innerHTML = button(label(row));
          item.firstElementChild.onclick = () => { el.close(); choose(row); };
          container.append(item);
        }
      });
    };
    search.oninput = () => { clearTimeout(timer); timer = setTimeout(draw, 250); };
    el.addEventListener("close", () => { stop(); clearTimeout(timer); }, { once: true });
    draw();
  }

  function termsEditor(scope, revision, withdraw, reload) {
    const { el, body } = dialog(withdraw ? "Withdraw debtor override" : "Add commercial policy");
    let scheme = null;
    const fields = withdraw ? input("date", "Withdrawal date", today(), "type=date required") :
      `${input("date", "Effective from", today(), "type=date required")}${input("discount", "Discount (%)", "", 'type=number min=0 max=100 step=any placeholder="Inherit"')}${button("Select scheme", "data-scheme")}${button("Clear scheme", "data-clear-scheme")}<span data-scheme-name>Scheme inherits</span>`;
    const edit = form(body, fields + reason(), [["save", withdraw ? "Confirm withdrawal" : "Save policy"]], async (payload) => {
      const discount = numberOrNull(payload.discount);
      if (!withdraw && discount === null && !scheme) { edit.querySelector("[data-form-error]").textContent = "Enter a discount, select a scheme, or supply both."; return; }
      if (withdraw) await read("ei_debtor_terms_withdraw", { p_debtor: scope.p_debtor, p_revision: revision, p_to: payload.date, p_reason: payload.reason.trim() });
      else await read("ei_debtor_terms_set", { ...scope, p_revision: revision, p_discount: discount, p_scheme: scheme, p_from: payload.date, p_reason: payload.reason.trim() });
      el.close();
      changed(withdraw ? "Override withdrawn." : "Policy saved.");
    }, () => { el.close(); reload(); });
    if (withdraw) return;
    const schemeName = edit.querySelector("[data-scheme-name]");
    edit.querySelector("[data-scheme]").onclick = () => picker("Choose scheme", (search, offset) => read("ei_debtor_scheme_page", { p_search: search, p_limit: 50, p_offset: offset }), (row) => row.scheme_name, (row) => { scheme = row.id; schemeName.textContent = row.scheme_name; });
    edit.querySelector("[data-clear-scheme]").onclick = () => { scheme = null; schemeName.textContent = "Scheme inherits"; };
  }

  function renderTerms() {
    const panel = section();
    panel.innerHTML = `<div class="ei-kyc-toolbar">${select("type", "Debtor type", choices("types", "name", true), termsScope.p_type)}
      ${select("region", "Region", choices("regions", "name", true), termsScope.p_region)}
      ${button(debtorName || "Choose debtor", "data-debtor")}
      ${!kyc.view && !debtorName ? button("Open by debtor ID", "data-debtor-id") : ""}
      ${debtorName ? button("Clear debtor", "data-clear") + input("date", "Effective on", termsDate, "type=date required") : ""}</div><div data-effective></div><div data-policy-actions class="ei-kyc-actions"></div><div data-history></div>`;
    const selectScope = () => {
      debtorName = "";
      termsScope = { p_debtor: null, p_type: numberOrNull(panel.querySelector("[name=type]").value), p_region: numberOrNull(panel.querySelector("[name=region]").value) };
      renderView();
    };
    panel.querySelectorAll("select").forEach((control) => { control.onchange = selectScope; });
    const selectDebtor = (id, label) => {
      debtorName = label;
      termsScope = { p_debtor: id, p_type: null, p_region: null };
      renderView();
    };
    const idButton = panel.querySelector("[data-debtor-id]");
    if (idButton) idButton.onclick = () => {
      const { el, body } = dialog("Open commercial history by debtor ID");
      const lookup = form(body, input("id", "Debtor ID", "", 'inputmode=numeric required pattern="[1-9][0-9]*"'), [["open", "Open"]], async ({ id }) => {
        const data = await read("ei_debtor_terms_get", { p_id: id, p_date: termsDate });
        if (!data) { lookup.querySelector("[data-form-error]").textContent = "No debtor was found with that ID."; return; }
        el.close();
        selectDebtor(id, "Debtor #" + id);
      });
    };
    panel.querySelector("[data-debtor]").onclick = () => picker("Choose debtor for override", async (search, offset) => {
      if (kyc.view) return read("ei_debtor_register_page", { p_search: search, p_limit: 50, p_offset: offset });
      const rows = await read("get_mis_finance_party_page", { p_group_filter: "receivables", p_search: search, p_limit: 50, p_offset: offset });
      return { rows: rows.map((row) => ({ ...row, ledger_name: row.party_name })), total_rows: rows[0]?.total_rows ?? offset };
    }, (row) => row.debtor_id && row.ledger_name, (row) => selectDebtor(row.debtor_id, row.ledger_name));
    const clear = panel.querySelector("[data-clear]");
    if (clear) clear.onclick = selectScope;
    const scope = { ...termsScope };
    if (!scope.p_debtor && (!scope.p_type || !scope.p_region)) {
      panel.querySelector("[data-history]").textContent = "Choose a debtor for overrides or a type and region for defaults.";
      return;
    }
    if (scope.p_debtor) {
      const effective = panel.querySelector("[data-effective]");
      const refreshEffective = () => {
        const child = document.createElement("div");
        effective.replaceChildren(child);
        loadInto(child, () => read("ei_debtor_terms_get", { p_id: scope.p_debtor, p_date: termsDate }), (data) => {
          if (!data) { child.textContent = "No debtor policy found."; return; }
          const source = { OVERRIDE: "Debtor override", TYPE: "Type–region default", UNCONFIGURED: "Unconfigured" };
          child.innerHTML = `<dl class="ei-kyc-card"><dt>Effective discount</dt><dd>${data.discount_percent == null ? "—" : esc(data.discount_percent) + "%"} · ${esc(source[data.discount_source])}</dd><dt>Effective scheme</dt><dd>${esc(data.scheme_name ?? "—")} · ${esc(source[data.scheme_source])}${data.scheme_active === false ? " · Inactive" : ""}</dd><dt>Classification</dt><dd>${esc(nameFor("types", data.type_id, "name"))} · ${esc(nameFor("regions", data.region_id, "name"))}</dd></dl>`;
        });
      };
      panel.querySelector("[name=date]").onchange = (event) => { if (event.target.value) { termsDate = event.target.value; refreshEffective(); } };
      refreshEffective();
    }
    const actions = panel.querySelector("[data-policy-actions]");
    const history = panel.querySelector("[data-history]");
    cleanup = paged(history, (offset) => read("ei_debtor_terms_history", { ...scope, p_limit: 50, p_offset: offset }), (results, rows) => {
      for (const row of rows) {
        const card = document.createElement("article");
        card.className = "ei-kyc-card";
        card.innerHTML = `<strong>${esc(row.effective_from)} → ${esc(row.effective_to ?? "Open")}</strong><p>Discount: ${row.discount_percent == null ? "Inherits" : esc(row.discount_percent) + "%"} · Scheme: ${row.scheme_id == null ? "Inherits" : esc(row.scheme_id)}</p><p>${esc(row.reason)}</p>${button("Audit history")}`;
        card.querySelector("button").onclick = () => audit(scope.p_debtor ? "ei_debtor_terms_override" : "ei_debtor_type_terms", scope.p_debtor ?? row.id);
        results.append(card);
      }
    }, { onPage: (data) => {
      if (!commercial.edit || actions.hasChildNodes()) return;
      if (!scope.p_debtor && lookups.types.find((item) => item.id === scope.p_type)?.is_active === false) return;
      actions.innerHTML = button(scope.p_debtor ? "Add override" : "Add default", "data-new") +
        (scope.p_debtor && data.rows.some((row) => !row.effective_to) ? button("Withdraw override", "data-withdraw") : "");
      actions.querySelector("[data-new]").onclick = () => termsEditor(scope, data.revision, false, renderView);
      const withdraw = actions.querySelector("[data-withdraw]");
      if (withdraw) withdraw.onclick = () => termsEditor(scope, data.revision, true, renderView);
    } });
  }

  function renderView() {
    cleanup();
    cleanup = () => {};
    host.querySelectorAll("[data-view]").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.view === view)));
    if (view === "masters") renderMasters();
    else if (view === "commercial") renderTerms();
    else renderRegister();
  }

  function refreshLookups(message = "") {
    cleanup();
    loadInto(section(), () => read("ei_debtor_lookups"), (data) => {
      lookups = data;
      renderView();
      setStatus(message);
    });
  }

  host.innerHTML = `<section class="ei-kyc">
    <header class="ei-kyc-head">${button("‹ Finance", "data-finance-back")}<h2 tabindex="-1">Debtor KYC</h2></header>
    <nav class="ei-kyc-actions" aria-label="Debtor KYC sections">
      ${button("Debtor Register", 'data-view="register"')}
      ${kyc.view ? button("Classification Masters", 'data-view="masters"') : ""}
      ${commercial.view ? button("Commercial Policies", 'data-view="commercial"') : ""}
    </nav>
    <div class="ei-kyc-notice" role="status"></div><div class="ei-kyc-content"></div>
  </section>`;
  host.querySelector("[data-finance-back]").onclick = back;
  host.querySelectorAll("[data-view]").forEach((item) => { item.onclick = () => { view = item.dataset.view; setStatus(""); if (lookups) renderView(); }; });
  host.querySelector("h2").focus();
  refreshLookups();
  return () => { cleanup(); host.remove(); };
}
