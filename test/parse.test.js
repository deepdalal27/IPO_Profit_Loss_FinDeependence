const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const P = require('../site/js/parse.js');
const M = require('../site/js/merge.js');
const C = require('../site/js/calc.js');
const doc = (f) => parseHTML(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8')).document;

test('IPO page: GMP, subscription, application-wise data, lots', () => {
  const d = P.parseDetail(doc('ipp-bls.html'));
  assert.equal(d.name, 'BLS Polymers'); assert.equal(d.ippId, 1414); assert.equal(d.gmp, 67);
  assert.equal(d.priceHigh, 150); assert.equal(d.lotSize, 100); assert.equal(d.closeDate, '2026-10-29');
  assert.equal(d.sub.retail.times, 128.36); assert.equal(d.sub.snii.times, 491.95); assert.equal(d.sub.bnii.times, 592.83);
  assert.deepEqual(d.apps.snii, { reserved: 607, applied: 281018, times: 462.96 });
  assert.equal(d.apps.bnii.reserved, 1214);
  assert.equal(d.lots.snii.lots, 14); assert.equal(d.lots.bnii.lots, 67);
  // SEBI odds from those numbers
  const p = C.probability(d, 'BHNI');
  assert.equal(p.basis, 'applications'); assert.ok(Math.abs(p.p - 1214 / 146685) < 1e-12);
});

test('listed IPO page: listing price', () => {
  const d = P.parseDetail(doc('ipp-tonbo.html'));
  assert.equal(d.listingPrice, 1160); assert.equal(d.listingBse, 1162); assert.equal(d.lotSize, 21);
});

test('home list: 30 IPOs with GMP and price band', () => {
  const l = P.parseList(doc('ipp-list.html'), '2026-11-06');
  assert.equal(l.length, 30);
  const v = l.find((x) => x.ippId === 1432);
  assert.equal(v.type, 'SME'); assert.equal(v.gmp, 4.25); assert.equal(v.priceLow, 88); assert.equal(v.priceHigh, 94); assert.equal(v.listingDate, '2026-11-09');
});

test('category labels from NSE and ipopremium', () => {
  assert.equal(P.catKey('Non Institutional Investors(NIIs)'), 'nii');
  assert.equal(P.catKey('Bidders with application size of more than Rs. 10 lakhs'), 'bnii');
  assert.equal(P.catKey('HNIs (2-10L)'), 'snii');
  assert.equal(P.catKey('Retail Individual Investors(RIIs)'), 'retail');
});

test('merge: same IPO from two sources, source ranking, GMP history', () => {
  const list = [];
  M.upsert(list, { source: 'NSE', name: 'Maxwell Engineering Solutions Limited', openDate: '2026-10-30', closeDate: '2026-11-03', priceHigh: 158, lotSize: 800 });
  M.upsert(list, { source: 'investorgain', name: 'Maxwell Engineering', openDate: '2026-10-30', closeDate: '2026-11-03', priceHigh: 157, gmp: 60 });
  M.upsert(list, { source: 'ipopremium', name: 'Maxwell Engineering Ltd.', ippId: 1430, openDate: '2026-10-30', closeDate: '2026-11-03', gmp: 70 });
  assert.equal(list.length, 1); assert.equal(list[0].priceHigh, 158); assert.equal(list[0].gmp, 70);
  assert.deepEqual(list[0].gmpHistory.map((h) => h.g), [60, 70]);
});
