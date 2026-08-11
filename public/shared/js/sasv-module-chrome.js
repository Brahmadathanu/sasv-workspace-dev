/**
 * Shared chrome helpers for CRUD / master modules (UI-MOD-1 / UI-MOD-2C).
 * Presentation only — does not change navigation targets or business logic.
 */
import { iconHtml } from './ui-icons.js';

/**
 * Mount canonical HOME control: 16px icon + HOME label.
 * Label hides at <=520px via CSS; title/aria remain.
 * @param {HTMLElement|null} el
 */
export function mountModuleHome(el) {
  if (!el) return;
  el.innerHTML = `${iconHtml('home', 16)}<span class="home-label">HOME</span>`;
  el.classList.add('sasv-home-btn');
  // Canonical accessible name (needed when label is visually hidden ≤520px)
  el.setAttribute('title', 'HOME');
  el.setAttribute('aria-label', 'HOME');
  if (el.tagName === 'BUTTON' && !el.getAttribute('type')) {
    el.setAttribute('type', 'button');
  }
}

/**
 * Replace an element's contents with a canonical ui-icons glyph.
 * @param {HTMLElement|null} el
 * @param {string} iconName
 */
export function mountModuleIcon(el, iconName) {
  if (!el || !iconName) return;
  el.innerHTML = iconHtml(iconName, 16);
  if (el.tagName === 'BUTTON' && !el.getAttribute('type')) {
    el.setAttribute('type', 'button');
  }
}

/**
 * @param {{ home?: HTMLElement|null, refresh?: HTMLElement|null, filter?: HTMLElement|null, add?: HTMLElement|null, close?: HTMLElement|HTMLElement[]|null, search?: HTMLElement|null, download?: HTMLElement|null }} map
 */
export function mountModuleActionIcons(map = {}) {
  if (map.home) mountModuleHome(map.home);
  if (map.refresh) mountModuleIcon(map.refresh, 'refresh');
  if (map.filter) mountModuleIcon(map.filter, 'filter');
  if (map.add) mountModuleIcon(map.add, 'plus');
  if (map.search) mountModuleIcon(map.search, 'search');
  if (map.download) mountModuleIcon(map.download, 'download');
  const closes = map.close
    ? Array.isArray(map.close)
      ? map.close
      : [map.close]
    : [];
  closes.forEach((el) => mountModuleIcon(el, 'close'));
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function optionLabel(opt) {
  return (opt?.textContent || '').trim();
}

function readOptions(selectEl) {
  return Array.from(selectEl.options || []).map((opt) => ({
    value: String(opt.value),
    label: optionLabel(opt),
    disabled: !!opt.disabled,
    empty: opt.value === '',
  }));
}

function destroySearchUi(selectEl) {
  const api = selectEl?._sasvSearch;
  if (!api) return;
  try {
    api.destroy?.();
  } catch {
    /* ignore */
  }
  delete selectEl._sasvSearch;
}

function debounce(fn, wait = 220) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, wait);
  };
}

/**
 * Enhance a native <select> with Stock Checker–style type-to-search UI.
 * Native select remains authoritative for value/change/contracts.
 * Pattern (parity with Stock Checker):
 * - field starts empty unless a value is already set
 * - typing opens a restrained list underneath that narrows with debounce
 * - ArrowUp/Down + Enter to select; Escape closes
 * - clearing the input clears the native select value
 * Dropdown is portaled to document.body so panel overflow:hidden cannot clip it.
 * @param {HTMLSelectElement|null} selectEl
 * @param {{
 *   placeholder?: string,
 *   allowEmptyOption?: boolean,
 *   debounceMs?: number,
 *   clearSelectedOnBackspace?: boolean
 * }} [opts]
 * @returns {object|null}
 */
export function enhanceSearchableSelect(selectEl, opts = {}) {
  if (!selectEl) return null;

  // Migrate away from Tom Select if previously attached
  if (selectEl.tomselect) {
    try {
      selectEl.tomselect.destroy();
    } catch {
      /* ignore */
    }
  }
  destroySearchUi(selectEl);

  const placeholder = opts.placeholder || 'Search or select…';
  const allowEmpty = opts.allowEmptyOption !== false;
  const debounceMs =
    typeof opts.debounceMs === 'number' ? opts.debounceMs : 220;
  const clearSelectedOnBackspace = opts.clearSelectedOnBackspace === true;

  selectEl.classList.add('sasv-native-select-sr');
  selectEl.setAttribute('aria-hidden', 'true');
  selectEl.tabIndex = -1;

  // Prefer an HTML shell already in the page (avoids native-select flash)
  let wrap =
    selectEl.parentElement?.querySelector(
      `.sasv-search-select[data-sasv-search-for="${selectEl.id}"], .sasv-search-select[data-sasv-search-shell]`
    ) || null;
  let input = wrap?.querySelector('.sasv-search-select__input') || null;
  let list = null;

  if (!wrap || !input) {
    wrap = document.createElement('div');
    wrap.className = 'sasv-search-select autocomplete input-with-icon';
    wrap.dataset.sasvDynamic = '1';
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'sasv-search-select__input';
    wrap.appendChild(input);
    selectEl.insertAdjacentElement('afterend', wrap);
  } else {
    // Strip any prior listeners by replacing the input node
    const fresh = input.cloneNode(true);
    input.replaceWith(fresh);
    input = fresh;
  }

  wrap.classList.add('sasv-search-select', 'autocomplete', 'input-with-icon');
  wrap.setAttribute('data-sasv-search-for', selectEl.id || '');
  wrap.removeAttribute('data-sasv-search-shell');

  input.type = 'text';
  input.className = 'sasv-search-select__input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.disabled = false;
  input.removeAttribute('readonly');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute(
    'aria-label',
    selectEl.getAttribute('aria-label') || placeholder
  );

  // Portal list to body so overflow:hidden ancestors cannot clip it
  list = document.createElement('div');
  list.className = 'sasv-search-select__list ac-list sasv-search-select__list--portal';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  document.body.appendChild(list);

  let options = readOptions(selectEl);
  let filtered = [];
  let activeIndex = -1;
  let lastQuery = '';

  function selectableOptions() {
    return options.filter((o) => !(o.empty && !allowEmpty));
  }

  function selectedLabel() {
    const v = String(selectEl.value ?? '');
    if (!v) return '';
    const hit = options.find((o) => o.value === v);
    return hit && !hit.empty ? hit.label : '';
  }

  function syncInputFromSelect() {
    input.value = selectedLabel();
  }

  function positionList() {
    const r = input.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    let top = r.bottom + 6;
    const maxH = 260;
    // Flip above if near bottom of viewport
    if (top + Math.min(maxH, 160) > window.innerHeight - 8) {
      top = Math.max(8, r.top - 6 - Math.min(maxH, filtered.length * 36 + 8));
    }
    list.style.position = 'fixed';
    list.style.left = `${Math.max(8, r.left)}px`;
    list.style.top = `${top}px`;
    list.style.width = `${Math.min(width, window.innerWidth - 16)}px`;
    list.style.right = 'auto';
    list.style.zIndex = String(
      Number.parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--sasv-z-dropdown'
        ),
        10
      ) || 1200
    );
  }

  function clearList() {
    list.innerHTML = '';
    list.hidden = true;
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
  }

  function scrollActiveIntoView() {
    const el = list.querySelector(`[data-idx="${activeIndex}"]`);
    if (!el) return;
    const pr = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < pr.top) list.scrollTop -= pr.top - r.top + 6;
    else if (r.bottom > pr.bottom) list.scrollTop += r.bottom - pr.bottom + 6;
  }

  function renderList() {
    const q = lastQuery;
    if (!filtered.length) {
      list.innerHTML = q
        ? `<div class="ac-item ac-empty" role="option" aria-selected="false">No results for "${escapeHtml(
            q
          )}"</div>`
        : '';
      if (!q) {
        clearList();
        return;
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      positionList();
      return;
    }
    list.innerHTML = filtered
      .map((o, idx) => {
        const sel = idx === activeIndex;
        return `<div class="ac-item${sel ? ' is-active' : ''}" role="option" data-value="${escapeHtml(
          o.value
        )}" data-idx="${idx}" aria-selected="${sel}">${escapeHtml(
          o.label || '(blank)'
        )}</div>`;
      })
      .join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    positionList();
    scrollActiveIntoView();
  }

  function applyFilter(term) {
    const q = String(term || '').trim();
    lastQuery = q;
    if (!q) {
      filtered = [];
      clearList();
      return;
    }
    const ql = q.toLowerCase();
    filtered = selectableOptions().filter(
      (o) =>
        !o.empty &&
        (o.label.toLowerCase().includes(ql) ||
          o.value.toLowerCase().includes(ql))
    );
    activeIndex = filtered.length ? 0 : -1;
    renderList();
  }

  const doSearch = debounce((term) => applyFilter(term), debounceMs);

  function commitValue(value, { silent = false } = {}) {
    const next = value == null ? '' : String(value);
    const prev = String(selectEl.value ?? '');
    if (
      next === '' &&
      !Array.from(selectEl.options).some((o) => o.value === '')
    ) {
      selectEl.insertAdjacentHTML('afterbegin', '<option value=""></option>');
      options = readOptions(selectEl);
    }
    selectEl.value = next;
    syncInputFromSelect();
    clearList();
    lastQuery = '';
    if (!silent && prev !== next) {
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function onPick(value) {
    commitValue(value, { silent: false });
  }

  input.addEventListener('focus', () => {
    const typed = String(input.value || '').trim();
    const sel = selectedLabel();
    if (typed && typed !== sel) applyFilter(typed);
  });

  input.addEventListener('input', () => {
    const v = String(input.value || '');
    doSearch(v);
    if (!v.trim() && String(selectEl.value ?? '') !== '') {
      commitValue('', { silent: false });
    }
  });

  input.addEventListener('keydown', (ev) => {
    // Opt-in: when the field shows a committed selected label, one
    // Backspace/Delete clears the whole selection (not char-by-char).
    // Uncommitted search typing keeps normal text editing.
    if (
      clearSelectedOnBackspace &&
      (ev.key === 'Backspace' || ev.key === 'Delete')
    ) {
      const sel = selectedLabel();
      const hasValue = String(selectEl.value ?? '') !== '';
      if (hasValue && sel && String(input.value || '') === sel) {
        ev.preventDefault();
        commitValue('', { silent: false });
        return;
      }
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (list.hidden) {
        const term =
          input.value.trim() === selectedLabel()
            ? ''
            : String(input.value || '');
        if (term.trim()) applyFilter(term);
        else return;
      }
      if (!filtered.length) return;
      activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
      renderList();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!filtered.length) return;
      activeIndex = Math.max(0, activeIndex - 1);
      renderList();
    } else if (ev.key === 'Enter') {
      if (!list.hidden && activeIndex >= 0 && filtered[activeIndex]) {
        ev.preventDefault();
        onPick(filtered[activeIndex].value);
      }
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      syncInputFromSelect();
      clearList();
    }
  });

  list.addEventListener('mousedown', (ev) => {
    const item = ev.target.closest('.ac-item[data-value]');
    if (item) {
      ev.preventDefault();
      onPick(item.getAttribute('data-value'));
    } else {
      ev.preventDefault();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (
        wrap.contains(document.activeElement) ||
        list.contains(document.activeElement)
      ) {
        return;
      }
      const typed = String(input.value || '').trim().toLowerCase();
      if (typed) {
        const exact = selectableOptions().find(
          (o) => !o.empty && o.label.toLowerCase() === typed
        );
        if (exact) {
          commitValue(exact.value, { silent: false });
          return;
        }
      }
      syncInputFromSelect();
      clearList();
    }, 120);
  });

  const onDocPointer = (ev) => {
    if (!wrap.contains(ev.target) && !list.contains(ev.target)) clearList();
  };
  const onReposition = () => {
    if (!list.hidden) positionList();
  };
  document.addEventListener('mousedown', onDocPointer, true);
  window.addEventListener('resize', onReposition);
  window.addEventListener('scroll', onReposition, true);

  syncInputFromSelect();

  const api = {
    refreshOptions() {
      options = readOptions(selectEl);
      syncInputFromSelect();
      clearList();
    },
    setValue(value, silent = true) {
      commitValue(value, { silent });
    },
    destroy() {
      document.removeEventListener('mousedown', onDocPointer, true);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      try {
        list.remove();
      } catch {
        /* ignore */
      }
      if (wrap?.dataset?.sasvDynamic === '1') {
        wrap.remove();
      } else if (input?.parentElement) {
        const fresh = input.cloneNode(true);
        input.replaceWith(fresh);
      }
      selectEl.classList.add('sasv-native-select-sr');
      selectEl.setAttribute('aria-hidden', 'true');
      selectEl.tabIndex = -1;
    },
  };

  selectEl._sasvSearch = api;
  return api;
}

/**
 * After mutating <option> nodes, refresh the searchable UI.
 * @param {HTMLSelectElement|null} selectEl
 */
export function syncSearchableSelect(selectEl) {
  if (!selectEl) return;
  if (selectEl._sasvSearch) {
    selectEl._sasvSearch.refreshOptions();
    return;
  }
  // No UI yet — nothing to sync
}

/**
 * Set select value and keep searchable UI in sync.
 * @param {HTMLSelectElement|null} selectEl
 * @param {string|number|null|undefined} value
 * @param {boolean} [silent=true]
 */
export function setSearchableSelectValue(selectEl, value, silent = true) {
  if (!selectEl) return;
  const v = value == null || value === '' ? '' : String(value);
  if (selectEl._sasvSearch) {
    selectEl._sasvSearch.setValue(v, silent);
    return;
  }
  selectEl.value = v;
}
