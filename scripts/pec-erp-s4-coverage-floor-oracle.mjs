#!/usr/bin/env node
// PEC S4 consumption-coverage-floor synthetic oracle.
// NO database / API / network. This is NOT business-policy approval.
import assert from 'node:assert/strict';

const roundUp = (amount, moq, integerUnit = false) => {
  if (amount <= 0) return 0;
  if (moq != null && moq > 0) return Math.ceil(amount / moq) * moq;
  return integerUnit ? Math.ceil(amount) : amount;
};
export const suggestCoverageFloor = ({
  avgMonthly, months, usableStock, otherFirmInbound, safetyQty,
  baselinePR, moq = null, integerUnit = false, approved = false,
  manualOverride = false
}) => {
  const a = [avgMonthly, months, usableStock, otherFirmInbound, safetyQty, baselinePR];
  if (a.some(x => !Number.isFinite(x)) || months <= 0 || a.some(x => x < 0))
    return { status: 'INCOMPLETE_EVIDENCE', proposed: null };
  if (moq != null && (!Number.isFinite(moq) || moq <= 0))
    return { status: 'INCOMPLETE_EVIDENCE', proposed: null };
  const periodDemand = avgMonthly * months;
  const net = Math.max(0, periodDemand + safetyQty - usableStock - otherFirmInbound);
  const floor = roundUp(net, moq, integerUnit);
  const proposed = Math.max(baselinePR, floor);
  const increment = proposed - baselinePR;
  const status = manualOverride && increment > 0 ? 'MANUAL_OVERRIDE_REVIEW' :
    increment === 0 ? 'COVERED' :
      baselinePR === 0 ? 'MISSING_LINE_SUGGESTED' : 'TOP_UP_SUGGESTED';
  return { status: approved ? status : 'POLICY_UNAPPROVED', detailStatus: status,
    periodDemand, net, floor, proposed, increment, monthlyEquivalent: floor / months };
};

const tests = [
  ['top-up existing line', {avgMonthly:200, months:3, usableStock:100, otherFirmInbound:0, safetyQty:0, baselinePR:200, moq:100}, 500, 300],
  ['preserve larger MRP', {avgMonthly:200, months:3, usableStock:100, otherFirmInbound:0, safetyQty:0, baselinePR:700, moq:100}, 700, 0],
  ['add absent item', {avgMonthly:200, months:3, usableStock:150, otherFirmInbound:0, safetyQty:0, baselinePR:0, moq:100}, 500, 500],
  ['stock sufficient', {avgMonthly:200, months:3, usableStock:650, otherFirmInbound:0, safetyQty:0, baselinePR:0, moq:100}, 0, 0],
  ['firm incoming sufficient', {avgMonthly:200, months:3, usableStock:100, otherFirmInbound:500, safetyQty:0, baselinePR:0, moq:100}, 0, 0],
  ['MOQ once for period', {avgMonthly:1100, months:3, usableStock:0, otherFirmInbound:0, safetyQty:0, baselinePR:0, moq:1000}, 4000, 4000],
];
let pass = 0;
for(const [name, opts, proposed, increment] of tests){
  const r = suggestCoverageFloor({...opts, approved:true});
  assert.equal(r.proposed,proposed,name);
  assert.equal(r.increment,increment,name);
  console.log('PASS',name);pass++;
}
const base = tests[0][1];
assert.equal(suggestCoverageFloor({...base, approved:false}).status, 'POLICY_UNAPPROVED');pass++;
assert.equal(suggestCoverageFloor({...base, approved:true, manualOverride:true}).status,'MANUAL_OVERRIDE_REVIEW');pass++;
assert.equal(suggestCoverageFloor({...base, approved:true, usableStock:NaN}).status,'INCOMPLETE_EVIDENCE');pass++;
assert.equal(suggestCoverageFloor({...base, approved:true, moq:-1}).status,'INCOMPLETE_EVIDENCE');pass++;
assert.equal(suggestCoverageFloor({...base, approved:true, baselinePR:0}).status,'MISSING_LINE_SUGGESTED');pass++;
assert.equal(suggestCoverageFloor({...base, approved:true, baselinePR:9999}).status,'COVERED');pass++;
assert.equal(suggestCoverageFloor({...base, approved:true, avgMonthly:0, usableStock:0, baselinePR:0}).proposed,0);pass++;
assert.equal(suggestCoverageFloor({...base, approved:true, avgMonthly:2.1, months:1, moq:null, integerUnit:true}).floor,3);pass++;
console.log('PEC S4 synthetic coverage floor: '+pass+'/'+pass+' PASS; no source provenance, supply reconciliation or database verification.');
