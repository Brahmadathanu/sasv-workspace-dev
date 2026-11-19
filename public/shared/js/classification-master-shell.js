// WP10 PWA enablement - shared cross-platform startup for the four classification master pages
// (Manage Categories / Sub-categories / Product Groups / Sub-groups).
//
// One canonical implementation serves Electron (pages at /public/shared/...) and the PWA (pages at /shared/...).
// This module only decides WHETHER and WHEN a page may load; it grants nothing. Authorisation stays with the
// canonical app_has_permission() checks and the governed RPCs on the server.
//
// Sequence: session gate -> canonical View/Edit check -> (denied state | load rows). These pages issue no classification
// SELECT for a user without View, so restricted rows are not fetched or rendered BY THESE PAGES.
// SECURITY NOTE: this is a UI control, not server-side denial. Under Stage A the authenticated role can still SELECT the
// four base tables over REST (only DML is View AND Edit guarded), so a direct REST read is not blocked by this gate.
// Server-side read denial would need a separate, owner-approved policy change and is NOT part of this client.
import { bootstrapApp } from './appBootstrap.js';
import { goMasterDataHome, resolveMasterDataLoginPage } from './master-data-platform.js';
import { mountModuleHome } from './sasv-module-chrome.js';
import { initializeClassificationAccess } from './classification-master-access.js';

const STATE_ATTR = 'data-classification-state';
const STATUS_ID = 'classificationStatus';

function statusNode() {
  return typeof document === 'undefined' ? null : document.getElementById(STATUS_ID);
}

/**
 * Show a loading / empty / error / denied message in the page's live region.
 * kind: 'loading' | 'empty' | 'error' | 'denied' | 'ready' ('ready' clears the message).
 * Messages are written with textContent only.
 */
export function setClassificationStatus(kind, message = '') {
  const root = document.documentElement;
  root.setAttribute(STATE_ATTR, kind);
  const node = statusNode();
  if (!node) return;
  node.textContent = kind === 'ready' ? '' : message;
  node.hidden = kind === 'ready' || !message;
  node.setAttribute('role', kind === 'error' || kind === 'denied' ? 'alert' : 'status');
  node.dataset.kind = kind;
}

function wireHome() {
  const home = document.getElementById('homeIcon');
  if (!home) return;
  mountModuleHome(home);
  home.addEventListener('click', () => goMasterDataHome());
}

/**
 * @param {string} permission  one of the four canonical module targets
 * @param {() => Promise<void>} load  loads rows; only called when the canonical View check passed
 * @param {{ bootstrap?: Function, access?: Function }} [deps] test seams
 */
export async function startClassificationModule(permission, load, deps = {}) {
  const bootstrap = deps.bootstrap || bootstrapApp;
  const access = deps.access || initializeClassificationAccess;
  wireHome();
  setClassificationStatus('loading', 'Checking access…');

  const boot = await bootstrap({ loginPage: resolveMasterDataLoginPage(), debug: false });
  if (!boot || boot.ok !== true) {
    // bootstrapApp already redirected when there is no session; any other failure stays closed.
    if (!boot || boot.reason !== 'no-session') {
      setClassificationStatus('error', 'Unable to verify your session. Reload the page or sign in again.');
    }
    return { canView: false, canEdit: false };
  }

  const result = await access(permission);
  if (!result || result.canView !== true) {
    document.documentElement.setAttribute('data-wp10-classification-access', 'locked');
    setClassificationStatus('denied', 'You do not have permission to view this module.');
    return { canView: false, canEdit: false };
  }

  setClassificationStatus('loading', 'Loading…');
  try {
    await load();
    if (document.documentElement.getAttribute(STATE_ATTR) === 'loading') setClassificationStatus('ready');
  } catch (error) {
    console.error('[classification] load failed', error);
    setClassificationStatus('error', 'Unable to load records. Reload the page to try again.');
  }
  return result;
}
