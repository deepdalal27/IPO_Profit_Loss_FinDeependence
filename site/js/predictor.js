/* FinDeependence IPO Deal Desk · Predictor tab: past subscription data, matrix, clashes and forecasts. */
(function () {
  var FD = window.FD, C = FD.C, P = window.FDPredict;
  var st = { ipo: '', seg: 'Mainboard', size: 500, price: 200, gmp: 30, lot: '', open: '', close: '', rivals: [], mSeg: 'Mainboard', mCat: 'rii', tYear: '', tSeg: '', q: '', sort: 'close', dir: -1, chCat: 'rii' };
  var CATS = P.CATS, LBL = P.LABEL;
  var CAT_MAP = { rii: 'RETAIL', shni: 'SHNI', bhni: 'BHNI' };

  FD.history = { ipos: [] };
  FD.loadHistory = function () {
    return fetch('https://raw.githubusercontent.com/deepdalal27/IPO_Profit_Loss_FinDeependence/main/site/history.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return fetch('history.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }); })
      .catch(function () { return { ipos: [] }; })
      .then(function (h) { FD.history = h || { ipos: [] }; FD.model = (FD.history.ipos || []).length >= 20 ? P.train(FD.history, { halfLifeDays: (FD.state && FD.state.settings.recencyMonths != null ? +FD.state.settings.recencyMonths : 6) * 30.4 }) : null; FD.invalidate(); return FD.model; });
  };

  // Forecast for an IPO from the live list, with rivals = other IPOs whose windows overlap (same segment)
  FD.forecastIpo = function (ipo) {
    if (!FD.model || !ipo || !C.price(ipo)) return null;
    var size = ipo.issueSizeCr || ipo.sizeCr; if (!size) return null;
    var seg = ipo.type === 'SME' ? 'SME' : 'Mainboard';
    var open = ipo.openDate, close = ipo.closeDate || ipo.openDate; if (!open) return null;
    var own = Math.max(1, Math.round((Date.parse(close) - Date.parse(open)) / 864e5) + 1);
    var rivals = FD.ipos().filter(function (o) { return o.id !== ipo.id && (o.type === 'SME' ? 'SME' : 'Mainboard') === seg && o.openDate && o.openDate <= close && (o.closeDate || o.openDate) >= open; })
      .map(function (o) { var s = o.openDate > open ? o.openDate : open, e = (o.closeDate || o.openDate) < close ? (o.closeDate || o.openDate) : close; return { name: o.name, g: o.gmp != null && C.price(o) ? o.gmp / C.price(o) : 0, overlap: Math.round((Date.parse(e) - Date.parse(s)) / 864e5) + 1 }; });
    var f = P.forecast(FD.model, { seg: seg, sizeCr: size, g: ipo.gmp != null ? ipo.gmp / C.price(ipo) : 0, rivals: rivals, ownDays: own });
    f.rivals = rivals; return f;
  };

  function sync(ipoId) {
    var i = FD.ipo(ipoId); if (!i) return;
    st.seg = i.type === 'SME' ? 'SME' : 'Mainboard'; st.price = C.price(i) || st.price; st.gmp = i.gmp != null ? i.gmp : st.gmp; st.lot = i.lotSize || '';
    st.size = i.issueSizeCr || i.sizeCr || st.size; st.open = i.openDate || ''; st.close = i.closeDate || '';
    var f = FD.forecastIpo(i); st.rivals = f && f.rivals ? f.rivals.map(function (r) { return { name: r.name, gp: +(r.g * 100).toFixed(1), overlap: r.overlap }; }) : [];
  }


  // Average application size ÷ allotment unit (from exchange application-wise data)
  // Measured on past IPOs with application counts: (times by shares) ÷ (applications ÷ winners). Falls back to Settings.
  function measured() {
    if (FD._facFor === FD.history) return FD._fac;
    var out = {};
    ['Mainboard', 'SME'].forEach(function (sg) {
      out[sg] = {};
      ['rii', 'shni', 'bhni'].forEach(function (c) {
        var v = (FD.history.ipos || []).filter(function (x) { return (x.seg || (x.exchange === 'Mainboard' ? 'Mainboard' : 'SME')) === sg && x.apps && x.apps[c] && x.apps[c].reserved > 0 && x.apps[c].applied > x.apps[c].reserved && x[c] > 1.5; })
          .map(function (x) { return x[c] / (x.apps[c].applied / x.apps[c].reserved); }).filter(function (r) { return r > 0.5 && r < 30; });
        if (v.length >= 10) out[sg][c] = { f: P.median(v), n: v.length };
      });
    });
    FD._fac = out; FD._facFor = FD.history; return out;
  }
  function factor(c) {
    var m = (measured()[st.seg] || {})[c]; if (m) return m.f;
    var f = FD.state.settings.factors;
    return c === 'rii' ? (st.seg === 'SME' ? f.RETAIL_SME : f.RETAIL) : c === 'shni' ? f.SHNI : f.BHNI;
  }
  function actualOdds(r, c) { var a = r.src && r.src.apps && r.src.apps[c]; return a && a.reserved > 0 && a.applied > 0 ? Math.min(1, a.reserved / a.applied) : null; }
  function chance(times, c) { if (times == null) return null; return times <= 1 ? 1 : Math.min(1, factor(c) / times); }

  FD.renderPredict = function () {
    var el = document.getElementById('v-predict');
    var h = FD.history, m = FD.model;
    if (!m) { el.innerHTML = '<div class="panel empty-state"><h3>Loading past IPO data…</h3></div>'; if (!(h.ipos || []).length) FD.loadHistory().then(function () { if (FD.model) FD.renderPredict(); }); return; }
    var rows = m.rows, withCats = rows.filter(function (r) { return r.rii != null; });
    var nMain = withCats.filter(function (r) { return r.seg === 'Mainboard'; }).length, nSme = withCats.length - nMain;
    var ownDays = st.open && st.close ? Math.max(1, Math.round((Date.parse(st.close) - Date.parse(st.open)) / 864e5) + 1) : 3;
    var g = (+st.gmp || 0) / (+st.price || 1);
    var rivals = st.rivals.map(function (r) { return { g: (+r.gp || 0) / 100, overlap: +r.overlap || ownDays }; });
    var f = P.forecast(m, { seg: st.seg, sizeCr: +st.size || 1, g: g, rivals: rivals, ownDays: ownDays, open: st.open || undefined });
    var live = FD.ipos().filter(function (i) { return i.stage === 'Open' || i.stage === 'Upcoming' || i.stage === 'Closed'; });
    var years = Array.from(new Set(rows.map(function (r) { return r.year; }))).sort();
    var nse = h.nseCheck;

    var html = '<div class="panel"><div class="panel-head"><div><h2>Subscription forecast</h2>' +
      '<p class="muted" style="margin:4px 0 0">Based on ' + withCats.length + ' past IPOs with full category data (' + nMain + ' Mainboard · ' + nSme + ' SME, ' + years.join('–') + ')' + (nse ? ' · Mainboard figures from NSE' : '') + '</p></div>' +
      '<label class="dl">Live IPO <select id="pIpo"><option value="">— enter details —</option>' + FD.opts(live.map(function (i) { return [i.id, i.name + (i.type === 'SME' ? ' (SME)' : '')]; }), st.ipo) + '</select></label></div>';

    // ---- forecast sheet ----
    var tot = f.cats.total;
    var clashCut = f.solo && f.solo.rii ? 1 - f.cats.rii.median / f.solo.rii : 0;
    html += '<div class="calc"><div class="calc-in"><div class="seg big" id="pSeg">' + ['Mainboard', 'SME'].map(function (s) { return '<button data-seg="' + s + '"' + (st.seg === s ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') + '</div>' +
      '<div class="form tight">' + inp('size', 'Issue size (₹ Cr)') + inp('price', 'Issue price (₹)') + inp('gmp', 'GMP (₹)') + inp('lot', 'Lot size (shares)') +
      '<label>Opens <input data-k="open" type="date" value="' + st.open + '"></label><label>Closes <input data-k="close" type="date" value="' + st.close + '"></label></div>' +
      '<details class="blk"' + (st.rivals.length ? ' open' : '') + '><summary>Other IPOs open on the same days <span class="muted">' + (st.rivals.length || 'none') + '</span></summary><div style="padding:8px 10px;display:flex;flex-direction:column;gap:6px">' +
      st.rivals.map(function (r, k) { return '<div class="trow"><input class="cell" data-r="' + k + '" data-rk="name" value="' + FD.esc(r.name || '') + '" placeholder="IPO name" style="flex:1;min-width:110px"><label class="tl shni">GMP %<input class="rate" data-r="' + k + '" data-rk="gp" type="number" step="any" value="' + (r.gp == null ? '' : r.gp) + '"></label><button class="mini danger" data-rdel="' + k + '" aria-label="Remove">✕</button></div>'; }).join('') +
      '<button class="mini" id="rAdd" style="align-self:flex-start">+ Add competing IPO</button></div></details></div>';

    html += '<div class="calc-out"><div class="tiles">' +
      '<div class="fact pos"><small>Expected total subscription</small><b>' + tx(tot && tot.median) + '</b><span class="hint">likely ' + tx(tot && tot.p25) + ' – ' + tx(tot && tot.p75) + '</span></div>' +
      '<div class="fact"><small>GMP</small><b>' + (g * 100).toFixed(1) + '%</b><span class="hint">₹' + (+st.gmp || 0) + ' on ₹' + (+st.price || 0) + ' · est. listing ₹' + ((+st.price || 0) + (+st.gmp || 0)) + '</span></div>' +
      '<div class="fact ' + (clashCut > 0.01 ? 'retail' : '') + '"><small>Date clash</small><b>' + (st.rivals.length ? '−' + Math.round(clashCut * 100) + '%' : 'None') + '</b><span class="hint">' + (st.rivals.length ? st.rivals.length + ' other IPO' + (st.rivals.length > 1 ? 's' : '') + ' open · effect on demand' : 'alone in its window') + '</span></div></div>';
    html += '<div class="tbl"><table class="res fc"><thead><tr><th>Category</th><th class="num">Expected</th><th class="num">Likely range</th><th class="num">Chance</th><th class="num">Gain if allotted</th><th class="num">Fair Kostak</th></tr></thead><tbody>' +
      CATS.map(function (c) {
        var q = f.cats[c]; if (!q) return '<tr><td>' + (CAT_MAP[c] ? FD.catPill(CAT_MAP[c]) : '<span class="pill MB">QIB</span>') + '</td><td colspan="5" class="muted">Not enough past ' + st.seg + ' IPOs with category data yet — use the total above</td></tr>';
        var row = '<tr><td>' + (CAT_MAP[c] ? FD.catPill(CAT_MAP[c]) : '<span class="pill MB">QIB</span>') + '</td><td class="num"><b>' + tx(q.median) + '</b></td><td class="num muted">' + tx(q.p25) + ' – ' + tx(q.p75) + '</td>';
        if (!CAT_MAP[c]) return row + '<td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td></tr>';
        var p = chance(q.median, c), unit = unitShares(c), gain = unit && st.gmp !== '' ? unit * (+st.gmp) : null;
        var sub = c === 'rii' ? (factor(c) !== 1 ? '1 in ' + oneInNum(chance(q.median * factor(c), c)) + ' if all apply 1 lot' : '') : 'range ' + FD.oneIn(chance(q.p75, c)) + ' – ' + FD.oneIn(chance(q.p25, c));
        return row + '<td class="num"><b>' + FD.oneIn(p) + '</b><br><span class="muted small">' + sub + '</span></td>' +
          '<td class="num">' + (gain == null ? '<span class="muted small">enter lot size</span>' : FD.fmt(gain) + '<br><span class="muted small">' + unit + ' sh × ₹' + st.gmp + '</span>') + '</td>' +
          '<td class="num"><b>' + (gain == null ? '—' : FD.fmt(Math.round(gain * p))) + '</b><br><span class="muted small">chance × gain</span></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="muted small" style="margin:8px 0 0">Subscription is counted in shares. Chance of allotment = winners ÷ applications (SEBI lottery). Applications ≈ subscription ÷ average application size — Retail ' + factor('rii').toFixed(2) + ', sHNI ' + factor('shni').toFixed(2) + ', bHNI ' + factor('bhni').toFixed(2) + ' units ' + ((measured()[st.seg] || {}).rii ? '(measured on ' + measured()[st.seg].rii.n + ' past ' + st.seg + ' IPOs)' : '(measured on exchange data)') + '. bHNI winners get the minimum HNI lot, so a big bid does not raise your chance.</p>' +
      '</div></div></div>';

    // ---- comparable IPOs ----
    var comp = P.comparables(withCats, st.seg, +st.size || 1, g, 8, 'rii');
    var cw = comp.map(function (r) { return r.w; });
    var med = function (c) { return P.wquant(comp.map(function (r) { return r[c]; }), cw, 0.5); };
    html += '<div class="panel"><div class="panel-head"><div><h2>Most similar past IPOs</h2><p class="muted" style="margin:4px 0 0">' + st.seg + ' IPOs closest in issue size and GMP to the one above — what they actually got</p></div></div>' +
      '<div class="tbl"><table class="pt"><thead><tr><th>IPO</th><th>Closed</th><th class="num">Size ₹Cr</th><th class="num">GMP</th><th class="num">QIB</th><th class="num">sHNI</th><th class="num">bHNI</th><th class="num">Retail</th><th class="num">Total</th><th class="num">Listing</th><th class="num">Retail chance (actual)</th></tr></thead><tbody>' +
      comp.map(function (r) { return rowHtml(r, true); }).join('') +
      '<tr class="tot"><td>Recency-weighted median of these ' + comp.length + '</td><td></td><td class="num">' + Math.round(P.median(comp.map(function (r) { return r.sizeCr; })) || 0).toLocaleString('en-IN') + '</td><td class="num">' + pc(P.median(comp.map(function (r) { return r.g; }))) + '</td>' +
      ['qib', 'shni', 'bhni', 'rii', 'total'].map(function (c) { return '<td class="num">' + tx(med(c)) + '</td>'; }).join('') + '<td class="num">' + sg(P.median(comp.map(function (r) { return r.listingGainPct; }).filter(function (v) { return v != null; }))) + '</td><td class="num">' + FD.oneIn(P.median(comp.map(function (r) { return actualOdds(r, 'rii'); }).filter(function (v) { return v != null; }))) + '</td></tr></tbody></table></div></div>';

    // ---- matrix ----
    var mx = P.matrix(withCats, st.mSeg, st.mCat);
    var curRow = P.SIZE_B[st.mSeg].findIndex(function (b) { return +st.size >= b[0] && +st.size < b[1]; }), curCol = P.GMP_B.findIndex(function (b) { return g >= b[0] && g < b[1]; });
    html += '<div class="panel"><div class="panel-head"><div><h2>Average subscription by issue size and GMP</h2><p class="muted" style="margin:4px 0 0">Recency-weighted median times subscribed · number of IPOs below each figure</p></div>' +
      '<div class="row"><span class="seg">' + ['Mainboard', 'SME'].map(function (s) { return '<button data-ms="' + s + '"' + (st.mSeg === s ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') + '</span>' +
      '<span class="seg">' + ['rii', 'shni', 'bhni', 'qib', 'total'].map(function (c) { return '<button data-mc="' + c + '"' + (st.mCat === c ? ' class="on"' : '') + '>' + LBL[c] + '</button>'; }).join('') + '</span></div></div>' +
      '<div class="tbl"><table class="mxt"><thead><tr><th>Issue size \\ GMP</th>' + P.GMP_B.map(function (b) { return '<th>' + b[2] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      mx.map(function (r, ri) { return '<tr><td>' + r.label + '</td>' + r.cells.map(function (c, ci) { var hl = st.mSeg === st.seg && ri === curRow && ci === curCol; return '<td class="' + (hl ? 'hlc' : '') + '" style="' + heat(c.median) + '">' + (c.n ? '<b>' + tx(c.median) + '</b><span class="cnt">' + c.n + '</span>' : '<span class="muted">—</span>') + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><p class="muted small" style="margin:8px 0 0">Outlined cell = the IPO in the forecast above.</p></div>';

    // ---- past IPOs ----
    var list = withCats.filter(function (r) { return (!st.tYear || r.year === st.tYear) && (!st.tSeg || r.seg === st.tSeg) && (!st.q || r.name.toLowerCase().indexOf(st.q) >= 0); });
    var key = { close: function (r) { return r.close; }, name: function (r) { return r.name; }, size: function (r) { return r.sizeCr; }, g: function (r) { return r.g == null ? -9 : r.g; }, rii: function (r) { return r.rii || 0; }, shni: function (r) { return r.shni || 0; }, bhni: function (r) { return r.bhni || 0; }, qib: function (r) { return r.qib || 0; }, total: function (r) { return r.total || 0; }, lg: function (r) { return r.listingGainPct == null ? -999 : r.listingGainPct; } }[st.sort];
    list.sort(function (a, b) { var x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
    var th = function (k, l, num) { return '<th class="sortable' + (num ? ' num' : '') + (st.sort === k ? ' on' : '') + '" data-sort="' + k + '">' + l + '<span class="arr">' + (st.sort === k ? (st.dir > 0 ? '▲' : '▼') : '↕') + '</span></th>'; };
    html += '<div class="panel"><div class="panel-head"><div><h2>Past IPO subscription</h2><p class="muted" style="margin:4px 0 0">Final times subscribed per category · GMP during the issue · listing gain</p></div><div class="row"><input type="search" id="tQ" placeholder="Search IPO" value="' + FD.esc(st.q) + '" style="width:190px"><select id="tYear"><option value="">All years</option>' + FD.opts(years.slice().reverse(), st.tYear) + '</select><select id="tSeg">' + FD.opts([['', 'Mainboard + SME'], ['Mainboard', 'Mainboard'], ['SME', 'SME']], st.tSeg) + '</select><button class="primary" id="tX">Excel</button></div></div>' +
      '<div class="tbl max"><table class="pt" id="histTbl"><thead><tr>' + th('name', 'IPO') + th('close', 'Closed') + th('size', 'Size ₹Cr', 1) + th('g', 'GMP', 1) + th('qib', 'QIB', 1) + th('shni', 'sHNI', 1) + th('bhni', 'bHNI', 1) + th('rii', 'Retail', 1) + th('total', 'Total', 1) + th('lg', 'Listing', 1) + '</tr></thead><tbody>' +
      list.map(function (r) { return rowHtml(r); }).join('') + '</tbody></table></div><p class="muted small" style="margin:8px 0 0">' + list.length + ' IPOs</p></div>';

    // ---- methodology ----
    html += '<details class="panel method"><summary><b>Methodology &amp; data quality</b></summary><div class="method-body">' +
      '<div><h4>Data</h4><ul><li>Category subscription, applications and winners, lots, listing price: IPO Premium (ipopremium.in), refreshed daily.</li><li>GMP history: investorgain.com (IPO Premium pages drop the GMP after listing).</li>' +
      (nse ? '<li>Mainboard category figures replaced with NSE\'s official consolidated bid data for ' + nse.matched + ' IPOs' + (nse.added ? ' (+' + nse.added + ' added)' : '') + '.</li>' : '') +
      '<li>GMP used = GMP on the closing day (else the last GMP before listing).</li></ul></div>' +
      '<div><h4>Forecast model</h4><ul><li>Per category, on a log scale: issue size, GMP %, Mainboard / SME, market mood (how heavily IPOs were subscribed in the previous 45 days) and date clashes.</li>' +
      '<li>Date clash: IPOs open on the same days share investor money, the higher-GMP issue taking the larger share. An IPO is assumed to keep about √(its share) of its demand; past data refines this.</li>' +
      '<li>Recent IPOs count more: an IPO\'s weight halves every ' + Math.round(m.halfLifeDays / 30.4) + ' months of age (change in Data &amp; Settings), in the model, the matrix and the comparables median.</li><li>Expected = median forecast; likely range = middle 50% of outcomes for similar IPOs.</li>' +
      '<li>Fit on past data: ' + ['Mainboard', 'SME'].map(function (sg) { var t = CATS.map(function (c) { var q = m.models[sg][c]; return q ? LBL[c] + ' ' + q.r2.toFixed(2) : ''; }).filter(Boolean).join(', '); return t ? sg + ' R² — ' + t + ' (' + (m.models[sg].rii || m.models[sg].total).n + ' IPOs)' : sg + ' — category data still being collected'; }).join(' · ') + '.</li></ul></div>' +
      '<div><h4>Chance of allotment (SEBI)</h4><ul><li>Retail: each winner gets one minimum lot by lottery.</li><li>sHNI (₹2–10 L) and bHNI (above ₹10 L): each winner gets the minimum HNI lot by lottery; any balance goes proportionately.</li>' +
      '<li>Checked on exchange data: BLS Polymers Retail 128.36× by shares → 1 in 96 actual (1.3 lots per application); bHNI 592.83× → 1 in 121 actual (4.9).</li></ul></div></div></details>';

    el.innerHTML = html;
    wire(el, list);
  };
  function rowHtml(r, odds) {
    return '<tr><td>' + FD.esc(r.name) + (r.seg === 'SME' ? ' <span class="pill SME">SME</span>' : '') + '</td><td class="nowrap">' + FD.dt(r.close) + '</td><td class="num">' + Math.round(r.sizeCr).toLocaleString('en-IN') + '</td><td class="num">' + pc(r.g) + '</td>' +
      ['qib', 'shni', 'bhni', 'rii', 'total'].map(function (c) { return '<td class="num">' + tx(r[c]) + '</td>'; }).join('') + '<td class="num">' + sg(r.listingGainPct) + '</td>' + (odds === true ? '<td class="num">' + (actualOdds(r, 'rii') == null ? '<span class="muted">—</span>' : FD.oneIn(actualOdds(r, 'rii'))) + '</td>' : '') + '</tr>';
  }
  function pc(g) { return g == null ? '—' : (g * 100).toFixed(0) + '%'; }
  function sg(v) { return v == null ? '—' : '<span class="' + (v >= 0 ? 'pos' : 'neg') + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>'; }
  function oneInNum(p) { return p == null ? '—' : p >= 1 ? '1' : (1 / p >= 100 ? Math.round(1 / p) : (1 / p).toFixed(1)); }
  function unitShares(c) {
    var lot = +st.lot; if (!lot) return null;
    return C.unitShares({ type: st.seg, priceHigh: +st.price, lotSize: lot }, CAT_MAP[c]) || null;
  }
  function tx(v) { if (v == null || isNaN(v)) return '—'; return (v >= 100 ? Math.round(v).toLocaleString('en-IN') : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + '×'; }
  function heat(v) { if (v == null) return ''; var t = Math.max(0, Math.min(1, Math.log10(Math.max(1, v)) / 2.7)); return 'background:color-mix(in srgb, var(--shni) ' + Math.round(6 + t * 34) + '%, transparent)'; }
  function inp(k, label) { return '<label>' + label + ' <input data-k="' + k + '" type="number" step="any" value="' + FD.esc(st[k]) + '"></label>'; }

  function wire(el, list) {
    var $ = function (s) { return el.querySelector(s); };
    $('#pIpo').onchange = function (e) { st.ipo = e.target.value; if (st.ipo) sync(st.ipo); st.mSeg = st.seg; FD.renderPredict(); };
    el.querySelectorAll('[data-seg]').forEach(function (b) { b.onclick = function () { st.seg = b.dataset.seg; st.mSeg = st.seg; FD.renderPredict(); }; });
    el.querySelectorAll('[data-k]').forEach(function (x) {
      x.addEventListener(x.type === 'date' ? 'change' : 'input', function () {
        st[x.dataset.k] = x.value; var k = x.dataset.k, pos = x.selectionStart; FD.renderPredict();
        var n = el.querySelector('[data-k="' + k + '"]'); if (n && x.type !== 'date') { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
      });
    });
    $('#rAdd').onclick = function () { st.rivals.push({ name: '', gp: 20, overlap: 3 }); FD.renderPredict(); };
    el.querySelectorAll('[data-r]').forEach(function (x) { x.onchange = function () { st.rivals[+x.dataset.r][x.dataset.rk] = x.value; FD.renderPredict(); }; });
    el.querySelectorAll('[data-rdel]').forEach(function (x) { x.onclick = function () { st.rivals.splice(+x.dataset.rdel, 1); FD.renderPredict(); }; });
    el.querySelectorAll('[data-ms]').forEach(function (b) { b.onclick = function () { st.mSeg = b.dataset.ms; FD.renderPredict(); }; });
    el.querySelectorAll('[data-mc]').forEach(function (b) { b.onclick = function () { st.mCat = b.dataset.mc; FD.renderPredict(); }; });
    el.querySelectorAll('[data-sort]').forEach(function (t) { t.onclick = function () { var k = t.dataset.sort; if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = k === 'name' ? 1 : -1; } FD.renderPredict(); }; });
    $('#tQ').oninput = function (e) { st.q = e.target.value.toLowerCase(); var p = e.target.selectionStart; FD.renderPredict(); var n = document.getElementById('tQ'); n.focus(); n.setSelectionRange(p, p); };
    $('#tYear').onchange = function (e) { st.tYear = e.target.value; FD.renderPredict(); };
    $('#tSeg').onchange = function (e) { st.tSeg = e.target.value; FD.renderPredict(); };
    $('#tX').onclick = function () {
      FD.excel('FinDeependence-past-IPO-subscription-' + FD.stamp() + '.xlsx', [{ name: 'Past IPOs', title: 'Past IPO subscription, GMP and listing',
        cols: [{ h: 'IPO', w: 30 }, { h: 'Type' }, { h: 'Opened', fmt: 'date' }, { h: 'Closed', fmt: 'date' }, { h: 'Issue size ₹Cr', fmt: 'int' }, { h: 'Price ₹', fmt: 'int' }, { h: 'GMP ₹', fmt: 'int' }, { h: 'GMP %', fmt: 'pct' }, { h: 'QIB ×' }, { h: 'sHNI ×' }, { h: 'bHNI ×' }, { h: 'Retail ×' }, { h: 'Total ×' }, { h: 'Listing gain %' }, { h: 'Other IPOs open same days', w: 36 }],
        rows: list.map(function (r) { return [r.name, r.exchange, r.open, r.close, r.sizeCr, r.price, r.gmp, r.g, r.qib, r.shni, r.bhni, r.rii, r.total, r.listingGainPct, (r.rivals || []).map(function (v) { return v.name; }).join(', ')]; }) },
      { name: 'Size x GMP matrix', title: 'Median times subscribed by issue size and GMP', cols: [{ h: 'Type' }, { h: 'Category' }, { h: 'Issue size', w: 18 }].concat(P.GMP_B.map(function (b) { return { h: b[2] + ' (median ×)' }; })).concat(P.GMP_B.map(function (b) { return { h: b[2] + ' (IPOs)', fmt: 'int' }; })),
        rows: [].concat.apply([], ['Mainboard', 'SME'].map(function (s) { return [].concat.apply([], ['rii', 'shni', 'bhni', 'qib', 'total'].map(function (c) { return P.matrix(FD.model.rows.filter(function (r) { return r.rii != null; }), s, c).map(function (r) { return [s, LBL[c], r.label].concat(r.cells.map(function (x) { return x.median == null ? null : +x.median.toFixed(2); })).concat(r.cells.map(function (x) { return x.n; })); }); })); })) }]);
    };
  }
})();
