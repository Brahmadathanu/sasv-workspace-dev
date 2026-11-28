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
    return `<label class="ei-field">${label}<select name="${key}" aria-label="${esc(label)}" ${disabled || (!choices.length && !missing) ? "disabled" : ""}>
      <option value="">Any / unset</option>
      ${missing ? `<option value="${esc(current)}" selected>${esc(old?.[name] || current)} (unavailable)</option>` : ""}
      ${choices.map((row) => `<option value="${esc(row.id)}" ${String(row.id) === String(current) ? "selected" : ""}>${esc(row[name])}</option>`).join("")}
      </select></label>`;
  }).join("");
}

export function mountDebtorWorkspace(host, { read, permissions, partition, esc, money, onChange, openDialog, glyph, sortIcons, trapTab }) {
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
  let registerSort = "server";
  let formSequence = 0;
  const childDialogs = new Set();
  const nameOrder = new Intl.Collator("en-IN", { sensitivity: "base", numeric: true });

  const button = (label, extra = "") => `<button type="button" class="ei-ctl" ${extra}>${esc(label)}</button>`;
  const input = (key, label, value = "", attrs = "") => `<label class="ei-field">${label}<input name="${key}" value="${esc(value ?? "")}" ${attrs}></label>`;
  const select = (key, label, options, current = "", placeholder = "Select…", disabled = false) => `<label class="ei-field">${label}<select name="${key}" aria-label="${esc(label)}" ${disabled ? "disabled" : ""}>${placeholder ? `<option value="">${placeholder}</option>` : ""}${options.map(([value, text]) => `<option value="${esc(value)}" ${String(value) === String(current) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const choices = (key, name, all = false) => (lookups?.[key] || []).filter((row) => all || row.is_active !== false).map((row) => [row.id, row[name] + (row.is_active === false ? " (inactive)" : "")]);
  const nameFor = (key, id, name) => lookups?.[key]?.find((row) => String(row.id) === String(id))?.[name] ?? id ?? "—";
  const classNames = (record) => CLASS_DIMENSIONS.map(([key, , list, name]) => record[key] && nameFor(list, record[key], name)).filter(Boolean).join(" · ");
  const section = () => host.querySelector(".ei-kyc-content");
  const contentScroll = (element) => element.closest(".ei-kyc-dialog-body, .ei-kyc-content");
  const badge = (label, review = false) => `<span class="ei-badge ei-badge-${review ? "review" : "clear"}">${esc(label)}</span>`;
  const loading = '<span class="table-loading-spinner" aria-hidden="true"></span> Loading…';
  const state = (message, kind = "empty") => `<div role="${kind === "error" ? "alert" : "status"}" class="ei-state ${kind === "empty" ? "ei-state-unavailable" : kind}">${message}</div>`;
  const searchBox = (label, value = "") => `<div class="finance-search-wrap ei-searchbox">
    <span class="ei-search-icon" aria-hidden="true">${glyph("search", 14)}</span>
    <input name="search" type="text" aria-label="${esc(label)}" placeholder="${esc(label)}" value="${esc(value)}" autocomplete="off">
    <button type="button" class="input-clear-btn" aria-label="Clear search" title="Clear search" ${value ? "" : "hidden"}>${glyph("close", 14)}</button>
  </div>`;

  function bindSearch(box, update) {
    const input = box.querySelector("input");
    const clear = box.querySelector("button");
    let timer;
    const dispose = () => clearTimeout(timer);
    input.oninput = () => {
      dispose();
      clear.hidden = !input.value;
      timer = setTimeout(() => { if (input.isConnected) update(input.value.trim()); }, 250);
    };
    clear.onclick = () => {
      dispose();
      input.value = "";
      clear.hidden = true;
      input.focus();
      update("");
    };
    return dispose;
  }
  const setStatus = (message) => { const el = host.querySelector(".ei-kyc-notice"); if (el) el.textContent = message; };
  const reason = () => input("reason", "Reason", "", "required maxlength=2000");
  const classKeys = CLASS_DIMENSIONS.map(([key]) => key);
  const classChanged = (event, next, update) => {
    if (!classKeys.includes(event.target.name)) return;
    const key = event.target.name;
    update(changeClassification(next, key, event.target.value));
    event.currentTarget.querySelector(`[name="${key}"]`)?.focus();
  };

  function dialog(title) {
    const modal = openDialog(title, { onClose: () => childDialogs.delete(modal.el) });
    childDialogs.add(modal.el);
    return modal;
  }

  function loadInto(body, load, render) {
    const run = async () => {
      if (body.closest("dialog")?.classList.contains("ei-kyc-workspace") === false) body.nextElementSibling?.remove();
      body.innerHTML = state(loading, "loading");
      try {
        const data = await load();
        if (body.isConnected) render(data);
      } catch (error) {
        if (!body.isConnected) return;
        body.innerHTML = state(esc(debtorError(error)) + ' <button type="button" class="mis-retry-btn">Retry</button>', "error");
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
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) next(); }, { root: contentScroll(body), rootMargin: "0px 0px 64px" });
    let stopped = false;
    observer.observe(more);
    const next = async () => {
      if (stopped || busy || offset >= total || !more.isConnected) return;
      busy = true;
      more.innerHTML = state(loading, "loading");
      let failed = false;
      try {
        const data = await load(offset);
        if (stopped || !more.isConnected) return;
        const { rows } = data;
        total = Number(data.total_rows);
        offset = rows.length ? offset + rows.length : total;
        const visible = rows.filter(filter);
        shown += visible.length;
        onPage(data);
        render(results, visible);
        more.innerHTML = offset >= total && !shown ? state("No matching records") : "";
      } catch (error) {
        if (stopped || !more.isConnected) return;
        failed = true;
        more.innerHTML = state(esc(debtorError(error)) + ' <button type="button" class="mis-retry-btn">Retry</button>', "error");
        more.querySelector("button").onclick = next;
      } finally {
        busy = false;
        if (stopped || !more.isConnected || offset >= total) observer.disconnect();
        else if (!failed) { observer.unobserve(more); observer.observe(more); }
      }
    };
    next();
    return () => { stopped = true; observer.disconnect(); };
  }

  function form(body, fields, actions, submit, reload) {
    body.nextElementSibling?.remove();
    const formId = `debtor-form-${++formSequence}`;
    body.innerHTML = `<form id="${formId}" class="ei-kyc-form">${fields}<div class="ei-state error" role="alert" data-form-error></div></form>`;
    const actionsHtml = actions.map(([key, label]) => `<button class="ei-ctl" type="submit" form="${formId}" value="${key}">${label}</button>`).join("");
    body.insertAdjacentHTML("afterend", `<footer class="fin-age-footer"><div class="fin-age-footer-main">${actionsHtml}</div></footer>`);
    const el = body.firstElementChild;
    el.onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(el));
      const errorHost = el.querySelector("[data-form-error]");
      if ("reason" in values && !values.reason.trim()) {
        errorHost.textContent = "Enter a reason.";
        errorHost.scrollIntoView({ block: "nearest" });
        return;
      }
      const controls = [...body.nextElementSibling.querySelectorAll('button[type="submit"]')];
      controls.forEach((control) => { control.disabled = true; });
      errorHost.textContent = "";
      try { await submit(values, event.submitter?.value); }
      catch (error) {
        errorHost.textContent = debtorError(error);
        if (error?.code === "40001" && reload) {
          errorHost.insertAdjacentHTML("beforeend", " " + button("Reload current version"));
          errorHost.lastElementChild.onclick = reload;
        }
      } finally {
        if (errorHost.textContent) errorHost.scrollIntoView({ block: "nearest" });
        controls.forEach((control) => { control.disabled = false; });
      }
    };
    return el;
  }

  function audit(entity, id, title = "Audit history") {
    const { el, body } = dialog(title);
    const stop = paged(body, (offset) => read("ei_debtor_audit_page", { p_entity: entity, p_id: id, p_limit: 50, p_offset: offset }), (results, rows) => {
      results.insertAdjacentHTML("beforeend", rows.map((row) => `<details class="finance-modal-note fin-about ei-kyc-card"><summary>${esc(row.event_at)} · ${esc(row.operation)} · ${esc(row.reason)}</summary><dl><dt>Actor</dt><dd>${esc(row.actor_user_id)}</dd><dt>Previous</dt><dd><pre>${esc(JSON.stringify(row.old_record, null, 2))}</pre></dd><dt>Current</dt><dd><pre>${esc(JSON.stringify(row.new_record, null, 2))}</pre></dd></dl></details>`).join(""));
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
        body.nextElementSibling?.remove();
        body.innerHTML = `<ul>${results.map(([name, message]) => `<li>${esc(name)} · ${esc(message)}</li>`).join("")}</ul>`;
        changed("Bulk classification finished.");
      });
    });
    const classHost = setup.querySelector("[data-class]");
    classHost.onchange = (event) => classChanged(event, assignment, (next) => {
      assignment = next; classHost.innerHTML = classificationFields(esc, lookups, assignment);
    });
  }

  function recordTable(container, columns) {
    if (!container.querySelector("table")) {
      container.insertAdjacentHTML("beforeend", `<table class="finance-table ei-kyc-table"><thead><tr>${columns.map((label) => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody></tbody></table>`);
    }
    return container.querySelector("tbody");
  }

  function registerFilters() {
    return `<div class="ei-kyc-grid">
      ${kyc.view ? select("registerMode", "Scope", [["history", "Current and historical"], ["outstanding", "Current outstanding"]], registerMode, "") : ""}
      ${registerMode === "outstanding" ? select("partition", "Classification", [["all", "All"], ["classified", "Classified"], ["unclassified", "Unclassified"]], filters.partition, "") : ""}
      ${select("lifecycle", "Status", STATUSES.map((value) => [value, statusLabel(value)]), lifecycle, "All statuses")}
      ${registerMode === "outstanding" ? classificationFields(esc, lookups, filters, { disabled: filters.partition === "unclassified" }) : ""}
    </div>`;
  }

  function renderRegister() {
    const panel = section();
    const toolbar = host.querySelector("[data-register-tools]");
    toolbar.hidden = false;
    toolbar.innerHTML = `<div class="ei-filters">
      <button type="button" class="finance-filter-btn" aria-label="Filters" title="Filters" aria-expanded="false" aria-controls="debtorFilterDrawer">${glyph("filter")}</button>
      <div id="debtorFilterDrawer" class="finance-filter-drawer" role="dialog" aria-label="Debtor register filters">
        <div class="ei-drawer-head"><span class="ei-drawer-title">Filters</span>
          <button class="ei-drawer-close" type="button" aria-label="Close filters">${glyph("close")}</button></div>
        <div data-fields>${registerFilters()}</div>
      </div>
    </div>
    <div class="ei-sorthost"><button type="button" class="ei-ctl" aria-label="Sort register" title="Sort register" aria-expanded="false" aria-controls="debtorSortDrawer">${sortIcons[registerSort === "server" ? "key" : registerSort]}</button>
      <div id="debtorSortDrawer" class="ei-pop ei-sort-panel" role="dialog" aria-label="Sort register">
        <div class="ei-filter-sheet-head"><strong>Sort</strong><button type="button" class="ei-drawer-close" aria-label="Close sort">${glyph("close")}</button></div>
        <ul class="ei-sort-list">${[["server", "Server order"], ["key", "Debtor name"], ["value_desc", "Outstanding balance"]].map(([value, label]) =>
          `<li><label><input type="radio" name="debtorSort" value="${value}" ${value === registerSort ? "checked" : ""}>${esc(label)}</label></li>`).join("")}</ul>
        <p class="ei-drawer-note">Name and balance sorts apply to loaded records.</p>
      </div>
    </div>
    ${searchBox("Search debtors", search)}
    ${kyc.edit ? button("Bulk classification", "data-bulk disabled") : ""}`;
    const filterDrawer = toolbar.querySelector("#debtorFilterDrawer");
    const sortDrawer = toolbar.querySelector("#debtorSortDrawer");
    const searchInput = toolbar.querySelector("[name=search]");
    const bulkButton = toolbar.querySelector("[data-bulk]");
    const syncSelection = () => {
      if (bulkButton) bulkButton.disabled = !selected.size;
    };
    const sortRows = (table) => {
      if (!table) return;
      const rows = [...table.rows];
      const compare = registerSort === "key" ? (a, b) => nameOrder.compare(a.dataset.name, b.dataset.name)
        : registerSort === "value_desc" ? (a, b) => Number(b.dataset.balance) - Number(a.dataset.balance)
          : (a, b) => Number(a.dataset.order) - Number(b.dataset.order);
      rows.sort(compare);
      table.append(...rows);
    };
    const draw = () => {
      cleanup();
      panel.scrollTop = 0;
      const outstanding = registerMode === "outstanding";
      const load = async (offset) => {
        if (!outstanding) return read("ei_debtor_register_page", { p_search: search, p_limit: 50, p_offset: offset });
        const rows = await read("get_mis_finance_party_page", { p_search: search, p_group_filter: "receivables", p_limit: 50, p_offset: offset, ...classificationArgs(filters) });
        return { total_rows: rows[0]?.total_rows ?? offset, rows: rows.map((row) => ({ ...row, ledger_name: row.party_name, signed_amount: row.signed_outstanding_tally_value })) };
      };
      cleanup = paged(panel, load, (container, rows) => {
        if (!rows.length) return;
        if (!container.firstElementChild) container.innerHTML = '<table class="finance-table ei-kyc-table ei-kyc-register"><thead><tr><th scope="col">Debtor</th><th scope="col">Status</th><th scope="col" class="num">Bills</th><th scope="col" class="num">Signed outstanding</th></tr></thead><tbody></tbody></table>';
        const table = container.querySelector("tbody");
        for (const row of rows) {
          const tr = document.createElement("tr");
          const name = esc(row.ledger_name);
          const classification = outstanding ? classNames(row) : "";
          const open = kyc.view && row.debtor_id ? `<button type="button" class="ei-text-link" data-profile aria-haspopup="dialog">${name}</button>` : kyc.edit ? `${name} ${button("Register", "data-register")}` : name;
          tr.dataset.name = row.ledger_name;
          tr.dataset.balance = String(Math.abs(Number(row.signed_amount)));
          tr.dataset.order = String(table.rows.length);
          tr.innerHTML = `<td><div class="ei-kyc-party">${kyc.edit && row.debtor_id ? `<input type="checkbox" aria-label="Select ${name}" ${selected.has(row.debtor_id) ? "checked" : ""}>` : ""}${open}</div>${classification ? `<small class="ei-cell-sub">${esc(classification)}</small>` : ""}</td>
            <td>${badge(statusLabel(row.kyc_status), ["DRAFT", "INVALID", "UNMAPPED"].includes(row.kyc_status))}</td>
            <td class="num" data-label="Bills">${esc(row.bill_count)}</td><td class="num" data-label="Signed outstanding">${esc(money(row.signed_amount))}</td>`;
          const check = tr.querySelector("input");
          if (check) check.onchange = () => { if (check.checked) selected.set(row.debtor_id, row); else selected.delete(row.debtor_id); syncSelection(); };
          const profile = tr.querySelector("[data-profile]");
          if (profile) profile.onclick = () => openProfile(row.debtor_id, row.ledger_name);
          const add = tr.querySelector("[data-register]");
          if (add) add.onclick = () => register(row);
          table.append(tr);
        }
        if (registerSort !== "server") sortRows(table);
      }, { filter: (row) => !lifecycle || row.kyc_status === lifecycle });
    };
    bindSearch(searchInput.parentElement, (value) => {
      search = value;
      draw();
    });
    const dialogs = [[filterDrawer, "open"], [sortDrawer, "is-open"]];
    const closeDrawers = (focus = false) => {
      for (const [drawer, style] of dialogs) {
        const shell = drawer.parentElement;
        const target = drawer === filterDrawer ? drawer : shell;
        if (!target.classList.contains(style)) continue;
        target.classList.remove(style);
        shell.firstElementChild.setAttribute("aria-expanded", "false");
        if (focus) shell.firstElementChild.focus({ preventScroll: true });
      }
      toolbar.classList.remove("ei-kyc-tools-open");
    };
    for (const [drawer, style] of dialogs) {
      const shell = drawer.parentElement;
      const trigger = shell.firstElementChild;
      trigger.onclick = () => {
        const target = drawer === filterDrawer ? drawer : shell;
        const wasOpen = target.classList.contains(style);
        closeDrawers();
        if (wasOpen) return;
        target.classList.add(style);
        toolbar.classList.add("ei-kyc-tools-open");
        trigger.setAttribute("aria-expanded", "true");
        const phone = matchMedia("(max-width: 640px)").matches;
        drawer.setAttribute("aria-modal", String(phone));
        drawer.style.setProperty("--debtor-drawer-room", `${Math.max(80, innerHeight - trigger.getBoundingClientRect().bottom - 18)}px`);
        drawer.querySelector(phone ? "button" : 'select:not([disabled]), input:checked')?.focus({ preventScroll: true });
      };
      drawer.querySelector("button").onclick = () => closeDrawers(true);
      drawer.onkeydown = (event) => {
        if (event.key !== "Tab" || !matchMedia("(max-width: 640px)").matches) return;
        event.stopPropagation();
        trapTab(drawer, event);
      };
    }
    const root = host.closest("dialog");
    root.onclick = (event) => {
      if (toolbar.contains(event.target) && event.target.closest(".ei-filters, .ei-sorthost")) return;
      closeDrawers();
    };
    root.onkeydown = (event) => {
      if (event.key !== "Escape" || !toolbar.classList.contains("ei-kyc-tools-open")) return;
      event.preventDefault();
      closeDrawers(true);
    };
    filterDrawer.onchange = (event) => {
      const { name, value } = event.target;
      if (name === "registerMode") registerMode = value;
      else if (name === "lifecycle") lifecycle = value;
      else if (name === "partition") filters = value === "unclassified" ? { partition: value } : { ...filters, partition: value };
      else filters = changeClassification(filters, name, value);
      search = searchInput.value.trim();
      filterDrawer.querySelector("[data-fields]").innerHTML = registerFilters();
      filterDrawer.querySelector(`[name="${name}"]`)?.focus();
      markFilters();
      draw();
    };
    sortDrawer.onchange = (event) => {
      registerSort = event.target.value;
      sortRows(panel.querySelector("tbody"));
      const sortButton = sortDrawer.parentElement.firstElementChild;
      sortButton.classList.toggle("is-active", registerSort !== "server");
      sortButton.innerHTML = sortIcons[registerSort === "server" ? "key" : registerSort];
      closeDrawers(true);
    };
    const markFilters = () => filterDrawer.parentElement.firstElementChild.classList.toggle("finance-filter-btn--active",
      Boolean(lifecycle || Object.keys(classificationArgs(filters)).length || (kyc.view && registerMode === "outstanding")));
    markFilters();
    sortDrawer.parentElement.firstElementChild.classList.toggle("is-active", registerSort !== "server");
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
    panel.innerHTML = `<div class="ei-toolbar ei-kyc-toolbar">${select("master", "Master", Object.entries(MASTER).map(([kind, item]) => [kind, item.label]), masterKind, "")}
      ${kyc.edit ? button("Add record", "data-add") : ""}</div><div data-masters></div>`;
    panel.querySelector("select").onchange = (event) => { masterKind = event.target.value; renderView(); section().querySelector("select").focus(); };
    const add = panel.querySelector("[data-add]");
    if (add) add.onclick = () => masterEditor(masterKind);
    const list = panel.querySelector("[data-masters]");
    if (masterKind === "district") list.insertAdjacentHTML("beforeend", `<p class="ei-note">Regions: ${esc(choices("regions", "name", true).map(([, label]) => label).join(", "))}</p>`);
    if (masterKind === "coverage") list.insertAdjacentHTML("beforeend", `<p class="ei-note">Godowns: ${esc(choices("godowns", "name", true).map(([, label]) => label).join(", "))}</p>`);
    const table = rows.length ? recordTable(list, ["Record", "Status", "Actions"]) : null;
    for (const row of rows) {
      const title = masterKind === "coverage" ? `${nameFor("godowns", row.godown_id, "name")} · ${nameFor("districts", row.district_id, "district_name")}` : row.district_name || row.area_name || row.name;
      const detail = masterKind === "district" ? `${row.state_name} · ${nameFor("regions", row.region_id, "name")}` : masterKind === "area" ? nameFor("districts", row.district_id, "district_name") : masterKind === "type" ? `${row.code} · ${row.definition}` : "";
      const record = table.insertRow();
      record.innerHTML = `<td><strong>${esc(title)}</strong>${detail ? `<span class="ei-note">${esc(detail)}</span>` : ""}</td>
        <td>${badge(row.is_active ? "Active" : "Inactive")}</td>
        <td class="ei-kyc-wide-cell"><div class="ei-kyc-actions">${kyc.edit ? button("Edit", "data-edit") : ""}${button("Audit history", "data-audit")}</div></td>`;
      const edit = record.querySelector("[data-edit]");
      if (edit) edit.onclick = () => masterEditor(masterKind, row);
      record.querySelector("[data-audit]").onclick = () => audit(MASTER_AUDIT[masterKind], row.id ?? row.district_id);
    }
    if (!rows.length) list.insertAdjacentHTML("beforeend", state("No master records."));
  }

  function picker(title, request, label, choose) {
    const { el, body } = dialog(title);
    body.innerHTML = `${searchBox("Search")}<div data-picker></div>`;
    const results = body.lastElementChild;
    const search = body.querySelector("input");
    let stop = () => {};
    const draw = () => {
      stop();
      stop = paged(results, (offset) => request(search.value.trim(), offset), (container, rows) => {
        for (const row of rows) {
          if (!label(row)) continue;
          const item = document.createElement("div");
          item.className = "ei-kyc-picker-item";
          item.innerHTML = `<button type="button" class="ei-text-link">${esc(label(row))}</button>`;
          item.firstElementChild.onclick = () => { el.close(); choose(row); };
          container.append(item);
        }
      });
    };
    const disposeSearch = bindSearch(search.parentElement, draw);
    el.addEventListener("close", () => { stop(); disposeSearch(); }, { once: true });
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
    panel.innerHTML = `<div class="ei-toolbar ei-kyc-toolbar">${select("type", "Debtor type", choices("types", "name", true), termsScope.p_type)}
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
          child.innerHTML = `<dl class="ei-dl ei-kyc-effective"><div class="ei-dl-row"><dt>Effective discount</dt><dd>${data.discount_percent == null ? "—" : esc(data.discount_percent) + "%"} · ${esc(source[data.discount_source])}</dd></div><div class="ei-dl-row"><dt>Effective scheme</dt><dd>${esc(data.scheme_name ?? "—")} · ${esc(source[data.scheme_source])}${data.scheme_active === false ? " · Inactive" : ""}</dd></div><div class="ei-dl-row"><dt>Classification</dt><dd>${esc(nameFor("types", data.type_id, "name"))} · ${esc(nameFor("regions", data.region_id, "name"))}</dd></div></dl>`;
        });
      };
      panel.querySelector("[name=date]").onchange = (event) => { if (event.target.value) { termsDate = event.target.value; refreshEffective(); } };
      refreshEffective();
    }
    const actions = panel.querySelector("[data-policy-actions]");
    const history = panel.querySelector("[data-history]");
    cleanup = paged(history, (offset) => read("ei_debtor_terms_history", { ...scope, p_limit: 50, p_offset: offset }), (results, rows) => {
      if (!rows.length) return;
      const table = recordTable(results, ["Effective dates", "Discount", "Scheme", "Actions"]);
      for (const row of rows) {
        const record = table.insertRow();
        record.innerHTML = `<td class="ei-kyc-wide-cell"><strong>${esc(row.effective_from)} → ${esc(row.effective_to ?? "Open")}</strong><span class="ei-note">${esc(row.reason)}</span></td>
          <td data-label="Discount">${row.discount_percent == null ? "Inherits" : esc(row.discount_percent) + "%"}</td>
          <td data-label="Scheme">${row.scheme_id == null ? "Inherits" : esc(row.scheme_id)}</td>
          <td class="ei-kyc-wide-cell">${button("Audit history")}</td>`;
        record.querySelector("button").onclick = () => audit(scope.p_debtor ? "ei_debtor_terms_override" : "ei_debtor_type_terms", scope.p_debtor ?? row.id);
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
    const tools = host.querySelector("[data-register-tools]");
    tools.hidden = true;
    tools.replaceChildren();
    tools.classList.remove("ei-kyc-tools-open");
    const root = host.closest("dialog");
    root.onclick = null;
    root.onkeydown = null;
    section().scrollTop = 0;
    host.querySelectorAll("[data-view]").forEach((item) => {
      const active = item.dataset.view === view;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      if (active) section().setAttribute("aria-labelledby", item.id);
    });
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

  const tab = (key, label) => `<button type="button" class="ei-subtab" id="debtor-tab-${key}" data-view="${key}" role="tab" aria-selected="${key === view}" aria-controls="debtorPanel" tabindex="${key === view ? 0 : -1}">${label}</button>`;
  host.innerHTML = `<div class="ei-subnav" role="tablist" aria-label="Debtor KYC sections">
    ${tab("register", "Debtor Register")}
    ${kyc.view ? tab("masters", "Classification Masters") : ""}
    ${commercial.view ? tab("commercial", "Commercial Policies") : ""}
    </div>
    <div class="finance-toolbar ei-toolbar" data-register-tools hidden></div>
    <div class="ei-state ei-kyc-notice" role="status"></div>
    <div id="debtorPanel" role="tabpanel" aria-labelledby="debtor-tab-register" class="ei-kyc-content"></div>`;
  const tabs = [...host.querySelectorAll("[data-view]")];
  for (const item of tabs) item.onclick = () => {
    view = item.dataset.view;
    setStatus("");
    if (lookups) renderView();
  };
  host.querySelector("[role=tablist]").onkeydown = (event) => {
    const index = tabs.indexOf(event.target);
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const next = step ? tabs[(index + step + tabs.length) % tabs.length] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : null;
    if (index < 0 || !next) return;
    event.preventDefault();
    next.click();
    next.focus();
  };
  refreshLookups();
  return () => {
    cleanup();
    for (const child of childDialogs) {
      child.close();
      child.remove();
    }
  };
}
