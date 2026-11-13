const test = require('node:test');
const assert = require('node:assert');
const P = require('../site/js/predict.js');

// Synthetic history with a known law: ln(retail) = 1 + 4·g − 0.3·ln(size) + noise-free
function synth() {
  const ipos = []; let id = 1;
  for (let k = 0; k < 120; k++) {
    const size = [100, 300, 800, 2000][k % 4], g = (k % 10) / 20, d = new Date(Date.UTC(2026, 0, 5) + k * 6 * 864e5).toISOString().slice(0, 10);
    const t = Math.exp(1 + 4 * g - 0.3 * Math.log(size));
    ipos.push({ igId: id++, name: 'IPO ' + k, exchange: 'Mainboard', price: 100, sizeCr: size, closeDate: d, openDate: d, gmpFinal: g * 100, qib: t * 2, shni: t, bhni: t * 1.5, rii: t, total: t * 1.4 });
  }
  return { ipos };
}

test('learns the GMP and size effects', () => {
  const m = P.train(synth());
  assert.ok(m.models.Mainboard.rii.r2 > 0.95);
  for (const [size, g] of [[300, 0.3], [800, 0.1], [2000, 0.4]]) {
    const truth = Math.exp(1 + 4 * g - 0.3 * Math.log(size));
    const f = P.forecast(m, { seg: 'Mainboard', sizeCr: size, g, rivals: [], open: '2026-03-01' }).cats.rii.median;
    assert.ok(Math.abs(Math.log(f / truth)) < 0.25, `size ${size} g ${g}: ${f} vs ${truth}`);
  }
});

test('forecast: higher GMP → more subscription; clash with a hotter IPO → less', () => {
  const m = P.train(synth());
  const lo = P.forecast(m, { seg: 'Mainboard', sizeCr: 300, g: 0.1, rivals: [] }).cats.rii.median;
  const hi = P.forecast(m, { seg: 'Mainboard', sizeCr: 300, g: 0.4, rivals: [] }).cats.rii.median;
  assert.ok(hi > lo * 2);
  const share = P.shareFor(0.1, [{ g: 0.5, overlap: 3 }], 3, 3);
  assert.ok(share < 0.5, 'lower-GMP IPO gets the smaller share');
  assert.ok(P.shareFor(0.5, [{ g: 0.1, overlap: 3 }], 3, 3) > 0.5);
});

test('expected chance over a lognormal spread', () => {
  // T always ≈ 10 (tiny sigma) → chance ≈ 1.3/10
  assert.ok(Math.abs(P.expectedChance(Math.log(10), 0.001, 1.3) - 0.13) < 0.005);
  // undersubscribed → certain
  assert.ok(P.expectedChance(Math.log(0.5), 0.001, 1.3) > 0.999);
  assert.ok(Math.abs(P.invNorm(0.975) - 1.96) < 0.001);
});

test('matrix buckets by size and GMP', () => {
  const m = P.train(synth());
  const mx = P.matrix(m.rows, 'Mainboard', 'rii');
  assert.equal(mx.length, 5);
  const n = mx.reduce((s, r) => s + r.cells.reduce((a, c) => a + c.n, 0), 0);
  assert.equal(n, 120);
});

test('recent IPOs weigh more: a regime shift pulls the forecast towards the newer level', () => {
  const ipos = []; let id = 1;
  for (let k = 0; k < 160; k++) {
    const d = new Date(Date.UTC(2025, 0, 6) + k * 4 * 864e5).toISOString().slice(0, 10);
    const t = k < 100 ? 5 : 20; // older IPOs ~5×, the latest 60 ~20×
    ipos.push({ igId: id++, name: 'IPO ' + k, exchange: 'Mainboard', price: 100, sizeCr: 500, closeDate: d, openDate: d, gmpFinal: 10, qib: t, shni: t, bhni: t, rii: t, total: t });
  }
  const eq = P.forecast(P.train({ ipos }, { halfLifeDays: 0 }), { seg: 'Mainboard', sizeCr: 500, g: 0.1, rivals: [], open: '2026-12-01' }).cats.rii.median;
  const rec = P.forecast(P.train({ ipos }, { halfLifeDays: 90 }), { seg: 'Mainboard', sizeCr: 500, g: 0.1, rivals: [], open: '2026-12-01' }).cats.rii.median;
  assert.ok(rec > eq * 1.3, `recency ${rec} vs equal ${eq}`);
  assert.equal(P.wquant([1, 2, 100], [1, 1, 10], 0.5), 100);
  assert.equal(P.wquant([1, 2, 3], null, 0.5), 2);
});
