const test = require('node:test');
const assert = require('node:assert');
const C = require('../site/js/calc.js');

// Mainboard IPO: price 150, lot 100 (₹15,000), listing gain ₹10/share -> retail P/L ₹1,000
const ipo = { type: 'Mainboard', priceHigh: 150, lotSize: 100, gmp: 10 };
const listed = (px) => ({ ...ipo, listingPrice: px });

test('lot rules follow SEBI sizes', () => {
  const r = C.lotRules(ipo);
  assert.equal(r.RETAIL, 1); assert.equal(r.SHNI, 14); assert.equal(r.BHNI, 67); assert.equal(r.RETAIL_MAX, 13);
  assert.equal(C.unitShares(ipo, 'BHNI'), 1400); // NII unit = sHNI minimum
  const t = C.lotRules({ type: 'Mainboard', priceHigh: 700, lotSize: 21 });
  assert.equal(t.SHNI, 14); assert.equal(t.BHNI, 69);
});

test('Scenario 1: kostak ₹300, I keep the risk', () => {
  const d = { cat: 'RETAIL', buyType: 'KOSTAK', buyRate: 300, allot: 'YES' };
  const r = C.dealResult(d, listed(160));
  assert.equal(r.L, 1000); assert.equal(r.invNet, 700); assert.equal(r.brkNet, 0); assert.equal(r.profit, 700);
  const n = C.dealResult({ ...d, allot: 'NO' }, listed(160));
  assert.equal(n.invNet, -300); assert.equal(n.profit, -300);
});

test('Scenario 2: kostak ₹300 from investor, kostak ₹400 to broker', () => {
  const d = { cat: 'RETAIL', buyType: 'KOSTAK', buyRate: 300, brokerId: 'b1', sellType: 'KOSTAK', sellRate: 400, allot: 'YES' };
  const r = C.dealResult(d, listed(160));
  assert.equal(r.invNet, 700); assert.equal(r.brkNet, -600); assert.equal(r.profit, 100);
  const n = C.dealResult({ ...d, allot: 'NO' }, listed(160));
  assert.equal(n.invNet, -300); assert.equal(n.brkNet, 400); assert.equal(n.profit, 100);
});

test('Scenario 3: kostak ₹300, then sold allotted shares at ₹10/share premium', () => {
  const d = { cat: 'RETAIL', buyType: 'KOSTAK', buyRate: 300, brokerId: 'b1', sellType: 'PREMIUM', sellRate: 10, allot: 'YES' };
  const a = C.dealResult(d, listed(165)); // normal person gains 1,500
  assert.equal(a.Db, 1000); assert.equal(a.brkNet, -500); assert.equal(a.invNet, 1200); assert.equal(a.profit, 700);
  const b = C.dealResult(d, listed(158)); // gains 800
  assert.equal(b.brkNet, 200); assert.equal(b.invNet, 500); assert.equal(b.profit, 700);
});

test('Subject-to pays only on allotment', () => {
  const d = { cat: 'RETAIL', buyType: 'SUBJECT', buyRate: 800, allot: 'NO' };
  assert.equal(C.dealResult(d, listed(160)).profit, 0);
  assert.equal(C.dealResult({ ...d, allot: 'YES' }, listed(160)).profit, 200);
});

test('probability uses application counts (SEBI lottery)', () => {
  const x = { ...ipo, sub: { retail: { offered: 5950000, times: 128.36 } }, apps: { retail: { reserved: 59500, applied: 5723385 } } };
  const p = C.probability(x, 'RETAIL');
  assert.equal(p.basis, 'applications'); assert.ok(Math.abs(p.p - 59500 / 5723385) < 1e-12);
  const e = C.probability({ ...ipo, sub: { bnii: { offered: 1700000, times: 592.83 } } }, 'BHNI');
  assert.equal(e.basis, 'estimated'); assert.ok(Math.abs(e.p - 5 / 592.83) < 1e-12);
  assert.equal(C.probability({ ...ipo, sub: { snii: { times: 0.8 } } }, 'SHNI').p, 1);
});

test('expected profit before allotment', () => {
  const x = { ...ipo, sub: { retail: { times: 13 } } }; // p = 1.3/13 = 0.1
  const r = C.dealResult({ cat: 'RETAIL', buyType: 'KOSTAK', buyRate: 50, allot: 'PENDING' }, x);
  assert.ok(Math.abs(r.exp.profit - (0.1 * 1000 - 50)) < 1e-9);
  assert.equal(r.worst, -50);
});

test('inr formatting', () => {
  assert.equal(C.inr(1234567), '₹12,34,567'); assert.equal(C.inr(-500), '−₹500'); assert.equal(C.inr(0), '₹0');
});
