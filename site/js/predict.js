/* FinDeependence · subscription predictor
   Learns from past IPOs (site/history.json): how many times each category (QIB, sHNI, bHNI, Retail) gets subscribed
   given issue size, GMP during the issue, SME vs Mainboard and competition from other IPOs open at the same time.

   Model per category c (log scale, ordinary least squares with a light ridge):
     ln(times_c) = b0 + b1·ln(size) + b2·SME + b3·SME·ln(size) + b4·g + b5·g² + b6·ln(share) + ε,  ε ~ Normal(0, σ_c²)
   g = GMP % of issue price during the issue (/100). share = the IPO's share of "attention" among IPOs open at the same
   time in its segment, weighted by overlap days and attractiveness exp(λ·g). λ is chosen by leave-one-out error.
   Forecast = median exp(μ); range = exp(μ ± z·σ). Allotment chance is averaged over that lognormal spread. */
(function (root) {
  var CATS = ['qib', 'shni', 'bhni', 'rii'];
  var LABEL = { qib: 'QIB', shni: 'sHNI', bhni: 'bHNI', rii: 'Retail', nii: 'NII', total: 'Total' };
  var Z = { p10: -1.2816, p25: -0.6745, p75: 0.6745, p90: 1.2816 };

  function days(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }
  function addDays(d, n) { var t = new Date(Date.parse(d) + n * 864e5); return t.toISOString().slice(0, 10); }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  // Weighted quantile (weights = recency). q = 0.5 gives the weighted median.
  function wquant(vals, wts, q) {
    var a = vals.map(function (v, i) { return [v, wts ? wts[i] : 1]; }).filter(function (p) { return p[0] != null && !isNaN(p[0]) && p[1] > 0; }).sort(function (x, y) { return x[0] - y[0]; });
    if (!a.length) return null;
    var tot = a.reduce(function (t, p) { return t + p[1]; }, 0), acc = 0;
    for (var i = 0; i < a.length; i++) { acc += a[i][1]; if (acc >= q * tot) return (acc - a[i][1] === q * tot && i > 0) ? (a[i][0] + a[i - 1][0]) / 2 : a[i][0]; }
    return a[a.length - 1][0];
  }
  // Recency weights: newest IPO = 1, halves every `halfLifeDays`
  function addWeights(rows, halfLifeDays) {
    var hl = halfLifeDays > 0 ? halfLifeDays : 0, latest = rows.reduce(function (m, r) { return r.close > m ? r.close : m; }, '0000');
    rows.forEach(function (r) { r.w = hl ? Math.pow(0.5, Math.max(0, days(r.close, latest)) / hl) : 1; });
    return rows;
  }
  function quant(a, q) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }

  // GMP (₹) during the issue: latest GMP on or before the closing date; else the last GMP before listing.
  function gmpDuring(x) {
    var s = (x.gmpSeries || []).filter(function (p) { return p.gmp != null; });
    if (x.closeDate && s.length) {
      var before = s.filter(function (p) { return p.date <= x.closeDate; });
      if (before.length) return before[before.length - 1].gmp;
    }
    if (x.gmpFinal != null) return x.gmpFinal;
    return s.length ? s[s.length - 1].gmp : null;
  }
  function gmpAt(x, date) {
    var s = (x.gmpSeries || []).filter(function (p) { return p.gmp != null && p.date <= date; });
    return s.length ? s[s.length - 1].gmp : null;
  }

  // Clean rows usable for learning.
  function dataset(history) {
    var out = [];
    (history.ipos || []).forEach(function (x) {
      if (!x.price || !x.sizeCr || !x.closeDate) return;
      var g = gmpDuring(x);
      var open = x.openDate && x.openDate <= x.closeDate && days(x.openDate, x.closeDate) <= 10 ? x.openDate : addDays(x.closeDate, x.exchange === 'Mainboard' ? -2 : -2);
      // Sanity: a category can't be > 3,000× or > 40× the issue's total subscription (bad source rows)
      var ok = function (v) { return v != null && isFinite(v) && v >= 0 && v <= 3000 && (!(x.total > 0) || v <= x.total * 40 + 5) ? v : null; };
      var r = { id: x.igId, name: x.name, seg: x.exchange === 'Mainboard' ? 'Mainboard' : 'SME', exchange: x.exchange, sizeCr: x.sizeCr, price: x.price,
        gmp: g, g: g == null ? null : g / x.price, open: open, close: x.closeDate, listingGainPct: x.listingGainPct,
        qib: ok(x.qib), shni: ok(x.shni), bhni: ok(x.bhni), rii: ok(x.rii), nii: ok(x.nii), total: x.total > 0 && x.total <= 3000 ? x.total : null, year: x.closeDate.slice(0, 4), src: x };
      out.push(r);
    });
    return out;
  }

  // Attention share among IPOs whose windows overlap (same segment). overlap weight = shared days / own days.
  function shares(rows, lambda) {
    rows.forEach(function (r) {
      var own = Math.max(1, days(r.open, r.close) + 1), wSelf = Math.exp(lambda * Math.max(-0.2, r.g || 0)), tot = wSelf, rivals = [];
      rows.forEach(function (o) {
        if (o === r || o.seg !== r.seg) return;
        var s = r.open > o.open ? r.open : o.open, e = r.close < o.close ? r.close : o.close;
        var ov = days(s, e) + 1; if (ov <= 0) return;
        var w = Math.exp(lambda * Math.max(-0.2, o.g || 0)) * Math.min(1, ov / own);
        tot += w; rivals.push({ name: o.name, g: o.g, overlap: ov });
      });
      r.share = wSelf / tot; r.rivals = rivals;
    });
    return rows;
  }
  // Same share for a hypothetical new IPO against a list of rivals [{g, overlap, own}]
  function shareFor(g, rivals, lambda, ownDays) {
    var wSelf = Math.exp(lambda * Math.max(-0.2, g || 0)), tot = wSelf;
    (rivals || []).forEach(function (o) { tot += Math.exp(lambda * Math.max(-0.2, o.g || 0)) * Math.min(1, (o.overlap || ownDays) / ownDays); });
    return wSelf / tot;
  }

  function features(r) {
    var ls = Math.log(Math.max(1, r.sizeCr)), g = Math.max(-0.3, Math.min(1.5, r.g || 0));
    return [1, ls, g, g * g, Math.log(Math.max(0.02, r.share == null ? 1 : r.share)), r.heat || 0];
  }
  var FEAT = ['Intercept', 'ln(issue size ₹Cr)', 'GMP %', 'GMP % squared', 'ln(attention share)', 'Market heat'];
  var CLASH = 4, CLASH_PRIOR = 0.5, SEGS = ['Mainboard', 'SME'];

  // Market heat: how strongly IPOs in the same segment were subscribed in the 45 days before this one opened
  // (mean ln total subscription, relative to the segment's overall mean). Controls for hot vs cold markets.
  function heatFor(rows, seg, date, excludeId) {
    var from = addDays(date, -45), v = [], sw = 0, swx = 0;
    rows.forEach(function (o) {
      if (o.seg !== seg || !(o.total > 0)) return;
      var w = o.w == null ? 1 : o.w; sw += w; swx += w * Math.log(o.total); // baseline = recency-weighted mean
      if (o.id !== excludeId && o.close < date && o.close >= from) v.push(Math.log(o.total));
    });
    if (!v.length || !sw) return 0;
    return v.reduce(function (a, b) { return a + b; }, 0) / v.length - swx / sw;
  }
  function addHeat(rows) { rows.forEach(function (r) { r.heat = heatFor(rows, r.seg, r.open, r.id); }); return rows; }

  // Solve (XᵀX + kI)β = Xᵀy by Gauss-Jordan
  // prior: {index: [mean, strength]} — pulls a coefficient towards a prior belief (Bayesian ridge)
  function ols(X, y, ridge, prior, w) {
    var p = X[0].length, A = [], i, j, k;
    for (i = 0; i < p; i++) { A.push(new Array(p + 1).fill(0)); }
    X.forEach(function (row, n) { var wn = w ? w[n] : 1; for (i = 0; i < p; i++) { for (j = 0; j < p; j++) A[i][j] += wn * row[i] * row[j]; A[i][p] += wn * row[i] * y[n]; } });
    for (i = 1; i < p; i++) A[i][i] += ridge;
    Object.keys(prior || {}).forEach(function (ix) { var pr = prior[ix]; A[ix][ix] += pr[1]; A[ix][p] += pr[1] * pr[0]; });
    for (i = 0; i < p; i++) {
      var piv = i; for (k = i + 1; k < p; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
      var t = A[i]; A[i] = A[piv]; A[piv] = t;
      var d = A[i][i] || 1e-12;
      for (j = i; j <= p; j++) A[i][j] /= d;
      for (k = 0; k < p; k++) if (k !== i) { var f = A[k][i]; for (j = i; j <= p; j++) A[k][j] -= f * A[i][j]; }
    }
    return A.map(function (r) { return r[p]; });
  }
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

  function fitCat(rows, cat, ridge) {
    var use = rows.filter(function (r) { return r[cat] != null && r[cat] > 0 && r.g != null; });
    if (use.length < 15) return null;
    var X = use.map(features), y = use.map(function (r) { return Math.log(Math.max(0.05, r[cat])); });
    // Recency weights, scaled so they sum to the effective sample size (keeps ridge / prior strength comparable)
    var w0 = use.map(function (r) { return r.w == null ? 1 : r.w; }), sw = w0.reduce(function (a, v) { return a + v; }, 0), sw2 = w0.reduce(function (a, v) { return a + v * v; }, 0);
    var nEff = sw2 ? sw * sw / sw2 : use.length, w = w0.map(function (v) { return v * nEff / sw; });
    // Prior: an IPO keeps about √(attention share) of its demand when it clashes (elasticity 0.5), updated by the data
    var prior = {}; prior[CLASH] = [CLASH_PRIOR, Math.max(8, nEff * 0.15)];
    var b = ols(X, y, ridge, prior, w);
    if (b[CLASH] < 0) { // a smaller share of attention cannot raise subscription
      var Xc = X.map(function (row) { var c = row.slice(); c[CLASH] = 0; return c; });
      b = ols(Xc, y, ridge, null, w); b[CLASH] = 0; X = Xc;
    }
    var res = y.map(function (v, i) { return v - dot(b, X[i]); });
    var sse = res.reduce(function (s, e, i) { return s + w[i] * e * e; }, 0);
    var mean = y.reduce(function (s, v, i) { return s + w[i] * v; }, 0) / nEff;
    var sst = y.reduce(function (s, v, i) { return s + w[i] * (v - mean) * (v - mean); }, 0);
    var sigma = Math.sqrt(sse / Math.max(1, nEff - b.length));
    return { cat: cat, beta: b, sigma: sigma, n: use.length, nEff: nEff, r2: sst ? 1 - sse / sst : 0, resid: res };
  }
  // Leave-one-out error for choosing λ (closed form via refits is heavy; use 5-fold CV)
  function cvError(rows, cat, ridge) {
    var use = rows.filter(function (r) { return r[cat] != null && r[cat] > 0 && r.g != null; });
    if (use.length < 20) return Infinity;
    var err = 0, cnt = 0;
    for (var f = 0; f < 5; f++) {
      var train = use.filter(function (_, i) { return i % 5 !== f; }), test = use.filter(function (_, i) { return i % 5 === f; });
      var m = fitCat(train, cat, ridge); if (!m) continue;
      test.forEach(function (r) { var e = Math.log(Math.max(0.05, r[cat])) - dot(m.beta, features(r)), wr = r.w == null ? 1 : r.w; err += wr * e * e; cnt += wr; });
    }
    return cnt ? err / cnt : Infinity;
  }

  function train(history, opts) {
    opts = opts || {};
    var halfLife = opts.halfLifeDays == null ? 180 : opts.halfLifeDays;
    var rows = addHeat(addWeights(dataset(history), halfLife)), ridge = opts.ridge == null ? 0.5 : opts.ridge;
    var lambdas = [1, 2, 3, 5, 8], best = { lambda: 3, err: Infinity }, cvs = {};
    var bySeg = {}; SEGS.forEach(function (sg) { bySeg[sg] = rows.filter(function (r) { return r.seg === sg; }); });
    lambdas.forEach(function (l) {
      shares(rows, l);
      var e = 0; SEGS.forEach(function (sg) { CATS.forEach(function (c) { var v = cvError(bySeg[sg], c, ridge); if (isFinite(v)) e += v; }); });
      cvs[l] = e; if (e < best.err) best = { lambda: l, err: e };
    });
    shares(rows, best.lambda);
    var models = {};
    SEGS.forEach(function (sg) { models[sg] = {}; CATS.concat(['total']).forEach(function (c) { models[sg][c] = fitCat(bySeg[sg], c, ridge); }); });
    return { halfLifeDays: halfLife, rows: rows, lambda: best.lambda, cv: cvs, models: models, features: FEAT, trainedAt: new Date().toISOString() };
  }

  // Forecast for a new IPO: {seg, sizeCr, g (fraction), rivals:[{g, overlap}], ownDays}
  function forecast(model, x) {
    var own = x.ownDays || 3;
    var share = shareFor(x.g, x.rivals, model.lambda, own);
    var heat = heatFor(model.rows, x.seg, x.open || new Date().toISOString().slice(0, 10), null);
    var r = { seg: x.seg, sizeCr: x.sizeCr, g: x.g, share: share, heat: heat };
    var out = { share: share, heat: heat, cats: {} };
    CATS.concat(['total']).forEach(function (c) {
      var m = (model.models[x.seg] || {})[c]; if (!m) return;
      var mu = dot(m.beta, features(r)), s = m.sigma;
      out.cats[c] = { median: Math.exp(mu), p10: Math.exp(mu + Z.p10 * s), p25: Math.exp(mu + Z.p25 * s), p75: Math.exp(mu + Z.p75 * s), p90: Math.exp(mu + Z.p90 * s), mu: mu, sigma: s, n: m.n, r2: m.r2 };
    });
    // Same IPO alone in its window, to show what the clash costs
    if (x.rivals && x.rivals.length) {
      var solo = Object.assign({}, r, { share: 1 });
      out.solo = {}; CATS.forEach(function (c) { var m = (model.models[x.seg] || {})[c]; if (m) out.solo[c] = Math.exp(dot(m.beta, features(solo))); });
    }
    return out;
  }

  // Expected allotment chance when times subscribed is lognormal(mu, sigma): E[min(1, f / T)], f = factor for the category
  function expectedChance(mu, sigma, f) {
    var pts = 41, s = 0;
    for (var i = 0; i < pts; i++) {
      var q = (i + 0.5) / pts, z = invNorm(q), T = Math.exp(mu + sigma * z);
      s += T <= 1 ? 1 : Math.min(1, f / T);
    }
    return s / pts;
  }
  function invNorm(p) { // Acklam
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
      b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155922608],
      c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416], q, r;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // Matrix: issue-size bucket × GMP bucket → median times for a category
  var SIZE_B = { Mainboard: [[0, 250, '< ₹250 Cr'], [250, 500, '₹250–500 Cr'], [500, 1000, '₹500–1,000 Cr'], [1000, 3000, '₹1,000–3,000 Cr'], [3000, 1e9, '> ₹3,000 Cr']],
    SME: [[0, 20, '< ₹20 Cr'], [20, 40, '₹20–40 Cr'], [40, 75, '₹40–75 Cr'], [75, 1e9, '> ₹75 Cr']] };
  var GMP_B = [[-1e9, 0.0001, 'GMP ≤ 0%'], [0.0001, 0.1, '0–10%'], [0.1, 0.25, '10–25%'], [0.25, 0.5, '25–50%'], [0.5, 1e9, '> 50%']];
  function matrix(rows, seg, cat) {
    var S = SIZE_B[seg];
    return S.map(function (sb) {
      return { label: sb[2], cells: GMP_B.map(function (gb) {
        var v = rows.filter(function (r) { return r.seg === seg && r.sizeCr >= sb[0] && r.sizeCr < sb[1] && r.g != null && r.g >= gb[0] && r.g < gb[1] && r[cat] != null; });
        var vals = v.map(function (r) { return r[cat]; }), wts = v.map(function (r) { return r.w == null ? 1 : r.w; });
        return { n: v.length, median: wquant(vals, wts, 0.5), p25: wquant(vals, wts, 0.25), p75: wquant(vals, wts, 0.75), plain: median(vals) };
      }) };
    });
  }

  // Clash groups: sets of IPOs whose windows overlap (same segment), with GMP rank
  function clashes(rows) {
    var groups = [], seen = {};
    rows.slice().sort(function (a, b) { return a.open.localeCompare(b.open); }).forEach(function (r) {
      if (seen[r.id] || !r.rivals || !r.rivals.length) return;
      var g = [r].concat(rows.filter(function (o) { return o !== r && !seen[o.id] && o.seg === r.seg && r.rivals.some(function (v) { return v.name === o.name; }); }));
      g.forEach(function (o) { seen[o.id] = 1; });
      g.sort(function (a, b) { return (b.g || 0) - (a.g || 0); });
      groups.push(g);
    });
    return groups;
  }

  // Nearest past IPOs of the same type: distance = |ln(size ratio)| / ln 2 + |GMP difference| / 10 points
  function comparables(rows, seg, sizeCr, g, k, cat) {
    return rows.filter(function (r) { return r.seg === seg && r.g != null && r.sizeCr && (r[cat || 'rii'] != null); })
      .map(function (r) { return { r: r, d: Math.abs(Math.log(r.sizeCr / Math.max(1, sizeCr))) / Math.LN2 + Math.abs(r.g - g) / 0.1 }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, k || 8).map(function (x) { return x.r; });
  }

  var api = { wquant: wquant, addWeights: addWeights, comparables: comparables, FEAT: FEAT, heatFor: heatFor, CATS: CATS, LABEL: LABEL, dataset: dataset, shares: shares, shareFor: shareFor, train: train, forecast: forecast, expectedChance: expectedChance, matrix: matrix, clashes: clashes, SIZE_B: SIZE_B, GMP_B: GMP_B, median: median, quant: quant, gmpDuring: gmpDuring, gmpAt: gmpAt, invNorm: invNorm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FDPredict = api;
})(typeof window !== 'undefined' ? window : globalThis);
