/** UX-6.1: exercise the production UI decision and sync functions without RPCs. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const control = readFileSync(join(root, 'public/shared/js/eaushadhi-review-control.js'), 'utf8');
const { normalizeEntryStatus, portalDiseasesCharsetOk } = await import('../public/shared/js/eaushadhi-review-helpers.js');
const lockCopy = 'Locked: portal entry for this product is already done, so the portal text cannot be changed.';
let passed = 0, failed = 0;
const check = (ok, label) => { if (ok) { passed++; console.log(`OK ${label}`); } else { failed++; console.error(`FAIL ${label}`); } };
const extract = (source, from, to) => source.slice(source.indexOf(`function ${from}(`), source.indexOf(`function ${to}(`));
const ui = extract(control, 'portalTextEntryLocked', 'stageRow');
const reasonRequired = extract(control, 'portalTextReasonRequired', 'newPortalTextDraft');
const permissions = extract(control, 'applyPermissionUi', 'syncPortalFieldsUi');
class Element {
  constructor() { this.dataset = {}; this.attributes = {}; this.disabled = false; this.readOnly = false; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
}
class Button extends Element {}
class Textarea extends Element {}
const buttons = ['btnVerifyPortalDiseases', 'btnSavePortalDiseases'];
const fields = ['fldPortalDiseases', 'fldPortalDiseasesReason'];
let elements;
const render = () => { elements = Object.fromEntries([...buttons.map((id) => [id, new Button()]), ...fields.map((id) => [id, new Textarea()]), ['portalDiseasesHint', new Element()]]); };
const state = { queueRow: {}, busy: false, portalTextDraft: { rowVersion: 1, editableText: 'Approved text', reason: 'Approved correction reason' } };
let writable = true;
const document = { body: { classList: { toggle() {} } }, querySelectorAll: () => [...buttons, ...fields].map((id) => elements[id]) };
const run = new Function('state', '$', 'normalizeEntryStatus', 'safeText', 'portalDiseasesCharsetOk', 'canWrite', 'document', 'access', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', `${reasonRequired}\n${ui}\n${permissions}\nreturn { portalTextBlockingReason, portalTextReasonRequired, syncPortalTextUi, applyPermissionUi };`)(state, (id) => elements[id], normalizeEntryStatus, (value) => String(value ?? '').trim(), portalDiseasesCharsetOk, () => writable, document, { canView: true, canEdit: true }, Button, Element, Element, Textarea);
for (const status of ['ENTERED', 'PORTAL_VERIFIED', 'SUBMITTED', 'IN_PROGRESS', 'NOT_STARTED']) {
  const locked = ['ENTERED', 'PORTAL_VERIFIED', 'SUBMITTED'].includes(status);
  state.queueRow.entry_status = status;
  render(); run.syncPortalTextUi(); run.applyPermissionUi();
  check(run.portalTextBlockingReason() === (locked ? lockCopy : ''), `${status}: exact decision for valid text and reason`);
  check(buttons.every((id) => elements[id].disabled === locked && elements[id].dataset.forceDisabled === String(locked)), `${status}: both actions retain correct disabled state after permission sync`);
  check(fields.every((id) => elements[id].readOnly === locked && elements[id].attributes['aria-readonly'] === String(locked)), `${status}: portal text and reason have correct read-only state`);
  check(elements.portalDiseasesHint.hidden === !locked && elements.portalDiseasesHint.textContent === (locked ? lockCopy : ''), `${status}: inline lock message visible only when locked`);
  state.busy = true; run.syncPortalTextUi(); run.applyPermissionUi();
  check(buttons.every((id) => elements[id].disabled), `${status}: busy state disables both actions`);
  state.busy = false; run.applyPermissionUi(); run.syncPortalTextUi();
  check(buttons.every((id) => elements[id].disabled === locked), `${status}: clearing busy cannot release entry lock`);
  render(); run.syncPortalTextUi(); run.applyPermissionUi();
  check(buttons.every((id) => elements[id].disabled === locked) && fields.every((id) => elements[id].readOnly === locked), `${status}: fresh render restores action and field states`);
  check(run.portalTextReasonRequired() === (status === 'IN_PROGRESS'), `${status}: existing reason requirement preserved`);
}
state.queueRow.entry_status = 'IN_PROGRESS'; state.portalTextDraft.reason = '';
run.syncPortalTextUi();
check(run.portalTextBlockingReason() === 'A reason is required while portal entry is IN_PROGRESS.' && buttons.every((id) => elements[id].disabled), 'IN_PROGRESS: empty reason blocks actions without making text read-only');
check(fields.every((id) => !elements[id].readOnly), 'IN_PROGRESS: operator can still edit text and supply required reason');
state.portalTextDraft.reason = 'Correction reason'; run.syncPortalTextUi();
check(buttons.every((id) => !elements[id].disabled), 'IN_PROGRESS: providing reason enables both actions');
state.queueRow.entry_status = 'NOT_STARTED'; state.portalTextDraft.reason = ''; run.syncPortalTextUi();
check(buttons.every((id) => !elements[id].disabled), 'NOT_STARTED: no reason required');
state.portalTextDraft.editableText = ''; run.syncPortalTextUi();
check(run.portalTextBlockingReason() === 'Portal text is required.', 'existing empty-text validation preserved');
state.portalTextDraft.editableText = 'Invalid <text>'; run.syncPortalTextUi();
check(run.portalTextBlockingReason().startsWith('Portal text contains characters'), 'existing character validation preserved');
state.queueRow.entry_status = ' entered '; state.portalTextDraft = null; run.syncPortalTextUi();
check(run.portalTextBlockingReason() === lockCopy && buttons.every((id) => elements[id].disabled), 'normalized completed status takes priority over missing draft/validation');
state.queueRow.entry_status = 'NOT_STARTED'; state.portalTextDraft = { rowVersion: 1, editableText: 'Approved text', reason: '' }; writable = false;
run.syncPortalTextUi(); run.applyPermissionUi();
check(buttons.every((id) => elements[id].disabled), 'existing viewer permissions still disable actions');
const baseline = execFileSync('git', ['show', 'd432f83:public/shared/js/eaushadhi-review-control.js'], { cwd: root, encoding: 'utf8' });
const removeUi = (source, from) => source.replace(extract(source, from, 'stageRow'), 'PORTAL_TEXT_UI');
check(removeUi(control, 'portalTextEntryLocked').replace(/\r\n/g, '\n') === removeUi(baseline, 'portalTextBlockingReason').replace(/\r\n/g, '\n'), 'all other client code unchanged, including render, Fill on portal, worker and save handlers');
const submit = control.slice(control.indexOf('async function submitPortalText('), control.indexOf('async function persistClassification('));
check(submit.indexOf('const blocked = portalTextBlockingReason()') < submit.indexOf('await runMutation(') && submit.includes('if (blocked)'), 'existing submit guard refuses locked actions before mutation');
check(/\.primary:disabled,[\s\S]*?background: #6b7280;/.test(readFileSync(join(root, 'public/shared/css/sasv-eaushadhi-review.css'), 'utf8')), 'existing grey disabled-primary style is available without colour changes');
console.log(`UX-6.1 portal-text checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
