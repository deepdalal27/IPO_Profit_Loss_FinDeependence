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
      .then(function (h) { FD.history = h || { ipos: [] }; FD.model = (FD.history.ipos || []).length >= 20 ? P.train(FD.history) : null; FD.invalidate(); return FD.model; });
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

  FD.renderPredict = function () {
    var el = document.getElementById('v-predict');
    var h = FD.history, m = FD.model;
    if (!m) { el.innerHTML = '<div class="panel empty-state"><h3>Past IPO data is loading…</h3><p class="muted">' + ((h.ipos || []).length ? 'Not enough past IPOs to learn from yet.' : '') + '</p></div>'; if (!(h.ipos || []).length) FD.loadHistory().then(function () { if (FD.model) FD.renderPredict(); }); return; }
    var rows = m.rows;
    var ownDays = st.open && st.close ? Math.max(1, Math.round((Date.parse(st.close) - Date.parse(st.open)) / 864e5) + 1) : 3;
    var g = (+st.gmp || 0) / (+st.price || 1);
    var f = P.forecast(m, { seg: st.seg, sizeCr: +st.size || 1, g: g, rivals: st.rivals.map(function (r) { return { g: (+r.gp || 0) / 100, overlap: +r.overlap || ownDays }; }), ownDays: ownDays });
    var live = FD.ipos().filter(function (i) { return i.stage === 'Open' || i.stage === 'Upcoming' || i.stage === 'Closed'; });
    var years = Array.from(new Set(rows.map(function (r) { return r.year; }))).sort().reverse();

    var html = '<div class="panel"><div class="panel-head"><div><h2>Subscription predictor</h2><p class="muted" style="margin:4px 0 0">Learned from ' + rows.length + ' past IPOs (' + years.slice().reverse().join(', ') + ') · data updated ' + (h.updatedAt ? new Date(h.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—') + '</p></div>' +
      '<div class="row"><label class="dl">IPO <select id="pIpo"><option value="">— enter by hand —</option>' + FD.opts(live.map(function (i) { return [i.id, i.name + (i.type === 'SME' ? ' (SME)' : '')]; }), st.ipo) + '</select></label></div></div>';

    // Inputs + results
    html += '<div class="calc"><div class="calc-in"><div class="seg big" id="pSeg">' + ['Mainboard', 'SME'].map(function (s) { return '<button data-seg="' + s + '"' + (st.seg === s ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') + '</div>' +
      '<div class="form tight">' + inp('size', 'Issue size ₹ Cr') + inp('price', 'Issue price ₹') + inp('gmp', 'GMP ₹') + inp('lot', 'Lot size (shares)') +
      '<label>Open <input data-k="open" type="date" value="' + st.open + '"></label><label>Close <input data-k="close" type="date" value="' + st.close + '"></label></div>' +
      '<div class="terms" style="margin:0"><div class="trow"><span class="lbl">Open same days</span><span class="muted small grow">' + (st.rivals.length ? '' : 'No other IPO in this window') + '</span><button class="mini" id="rAdd">+ Add IPO</button></div>' +
      st.rivals.map(function (r, k) { return '<div class="trow"><input class="cell" data-r="' + k + '" data-rk="name" value="' + FD.esc(r.name || '') + '" placeholder="IPO name" style="min-width:120px;flex:1"><label class="tl shni">GMP %<input class="rate" data-r="' + k + '" data-rk="gp" type="number" step="any" value="' + (r.gp == null ? '' : r.gp) + '"></label><label class="tl">Days<input class="rate" style="width:50px" data-r="' + k + '" data-rk="overlap" type="number" value="' + (r.overlap || '') + '"></label><button class="mini danger" data-rdel="' + k + '">✕</button></div>'; }).join('') +
      '</div></div>';

    var gp = g * 100;
    html += '<div class="calc-out"><div class="tiles">' +
      '<div class="fact"><small>GMP</small><b>' + gp.toFixed(1) + '%</b><span class="hint">₹' + (+st.gmp || 0) + ' on ₹' + (+st.price || 0) + '</span></div>' +
      '<div class="fact ' + (f.share < 0.999 ? 'retail' : '') + '"><small>Attention share</small><b>' + Math.round(f.share * 100) + '%</b><span class="hint">' + (st.rivals.length ? st.rivals.length + ' other IPO' + (st.rivals.length > 1 ? 's' : '') + ' open' : 'alone in its window') + '</span></div>' +
      '<div class="fact pos"><small>Total (expected)</small><b>' + tx(f.cats.total && f.cats.total.median) + '</b><span class="hint">range ' + tx(f.cats.total && f.cats.total.p25) + ' – ' + tx(f.cats.total && f.cats.total.p75) + '</span></div></div>';
    html += '<div class="tbl"><table class="res"><thead><tr><th>Category</th><th class="num">Expected</th><th class="num">Likely (50%)</th><th class="num">Wide (80%)</th>' + (f.solo ? '<th class="num">If alone</th>' : '') + '<th class="num">Chance of allotment</th><th class="num">Expected / app</th></tr></thead><tbody>' +
      CATS.map(function (c) {
        var q = f.cats[c]; if (!q) return '';
        var ch = '', ev = '';
        if (CAT_MAP[c]) {
          var fac = FD.state.settings.factors, ft = c === 'rii' ? (st.seg === 'SME' ? fac.RETAIL_SME : fac.RETAIL) : (c === 'shni' ? fac.SHNI : fac.BHNI);
          var pch = P.expectedChance(q.mu, q.sigma, ft);
          ch = FD.oneIn(pch) + ' <span class="muted small">' + FD.pct(pch, pch < .01 ? 2 : 1) + '</span>';
          var unit = unitShares(c);
          if (unit && st.gmp != null) ev = FD.fmt(Math.round(pch * (+st.gmp) * unit)) + '<br><span class="muted small">' + unit + ' sh × ₹' + st.gmp + '</span>';
        }
        return '<tr><td>' + (CAT_MAP[c] ? FD.catPill(CAT_MAP[c]) : '<span class="pill MB">QIB</span>') + '</td><td class="num"><b>' + tx(q.median) + '</b></td><td class="num">' + tx(q.p25) + ' – ' + tx(q.p75) + '</td><td class="num">' + tx(q.p10) + ' – ' + tx(q.p90) + '</td>' + (f.solo ? '<td class="num muted">' + tx(f.solo[c]) + '</td>' : '') + '<td class="num">' + (ch || '—') + '</td><td class="num">' + (ev || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="muted small">Model fit: ' + CATS.map(function (c) { var q = m.models[c]; return q ? LBL[c] + ' R² ' + q.r2.toFixed(2) + ' (typical error ×' + Math.exp(q.sigma * 0.6745).toFixed(1) + ')' : ''; }).filter(Boolean).join(' · ') + '</p>' +
      '</div></div></div>';

    // Matrix
    var mx = P.matrix(rows, st.mSeg, st.mCat);
    var curRow = P.SIZE_B[st.mSeg].findIndex(function (b) { return +st.size >= b[0] && +st.size < b[1]; }), curCol = P.GMP_B.findIndex(function (b) { return g >= b[0] && g < b[1]; });
    html += '<div class="stack2" style="margin-top:12px"><div class="card"><h3>Average subscription matrix</h3><p class="sub">Median times subscribed (number of IPOs) by issue size and GMP during the issue</p>' +
      '<div class="row" style="margin-bottom:8px"><span class="seg" id="mSeg">' + ['Mainboard', 'SME'].map(function (s) { return '<button data-ms="' + s + '"' + (st.mSeg === s ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') + '</span>' +
      '<span class="seg" id="mCat">' + CATS.concat(['total']).map(function (c) { return '<button data-mc="' + c + '"' + (st.mCat === c ? ' class="on"' : '') + '>' + LBL[c] + '</button>'; }).join('') + '</span></div>' +
      '<div class="tbl"><table class="mxt"><thead><tr><th>Issue size</th>' + P.GMP_B.map(function (b) { return '<th class="num">' + b[2] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      mx.map(function (r, ri) { return '<tr><td>' + r.label + '</td>' + r.cells.map(function (c, ci) { var hl = st.mSeg === st.seg && ri === curRow && ci === curCol; return '<td class="num' + (hl ? ' hlc' : '') + '" style="' + heat(c.median) + '">' + (c.n ? '<b>' + tx(c.median) + '</b><br><span class="muted small">' + c.n + ' IPO' + (c.n > 1 ? 's' : '') + '</span>' : '<span class="muted">—</span>') + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><p class="muted small">Highlighted cell = the IPO above.</p></div>';

    // Clash analysis
    var b6 = m.models.rii ? m.models.rii.beta[6] : null, groups = P.clashes(rows).slice(-12).reverse();
    var solo = rows.filter(function (r) { return !r.rivals || !r.rivals.length; }), clash = rows.filter(function (r) { return r.rivals && r.rivals.length; });
    html += '<div class="card"><h3>When IPO dates clash</h3><p class="sub">Money splits between IPOs open on the same days — the higher-GMP issue takes the larger share</p><div class="tiles">' +
      '<div class="fact"><small>Clashing IPOs</small><b>' + clash.length + ' / ' + rows.length + '</b><span class="hint">overlapping windows, same segment</span></div>' +
      (b6 != null ? '<div class="fact retail"><small>Half the attention →</small><b>' + Math.round((1 - Math.pow(0.5, b6)) * 100) + '% less</b><span class="hint">Retail subscription (fitted)</span></div>' : '') +
      '<div class="fact"><small>GMP weight λ</small><b>' + m.lambda + '</b><span class="hint">chosen by cross-validation</span></div></div>' +
      '<div class="tbl" style="max-height:330px;overflow:auto"><table><thead><tr><th>Window</th><th>IPOs (highest GMP first)</th><th class="num">GMP</th><th class="num">Retail</th><th class="num">sHNI</th><th class="num">bHNI</th><th class="num">QIB</th></tr></thead><tbody>' +
      groups.map(function (gr) { return gr.map(function (r, k) { return '<tr' + (k === 0 ? ' class="gtop"' : '') + '>' + (k === 0 ? '<td rowspan="' + gr.length + '" class="nowrap">' + FD.dt(gr[0].open) + '<br>' + FD.dt(gr.reduce(function (a, x) { return x.close > a ? x.close : a; }, gr[0].close)) + '</td>' : '') + '<td>' + FD.esc(r.name) + ' <span class="muted small">₹' + Math.round(r.sizeCr) + ' Cr</span></td><td class="num">' + (r.g == null ? '—' : (r.g * 100).toFixed(0) + '%') + '</td><td class="num">' + tx(r.rii) + '</td><td class="num">' + tx(r.shni) + '</td><td class="num">' + tx(r.bhni) + '</td><td class="num">' + tx(r.qib) + '</td></tr>'; }).join(''); }).join('') +
      '</tbody></table></div></div></div>';

    // Chart
    html += '<div class="card" style="margin-bottom:12px"><h3>GMP vs subscription</h3><p class="sub">Each dot is a past IPO (log scale)</p><div class="row" style="margin-bottom:6px"><span class="seg">' + CATS.concat(['total']).map(function (c) { return '<button data-cc="' + c + '"' + (st.chCat === c ? ' class="on"' : '') + '>' + LBL[c] + '</button>'; }).join('') + '</span><span class="legend-row" style="margin:0 0 0 10px"><span><i style="background:var(--bhni)"></i>Mainboard</span><span><i style="background:var(--retail)"></i>SME</span></span></div><div class="chart tall"><canvas id="chPred"></canvas></div></div>';

    // Data table
    var list = rows.filter(function (r) { return (!st.tYear || r.year === st.tYear) && (!st.tSeg || r.seg === st.tSeg) && (!st.q || r.name.toLowerCase().indexOf(st.q) >= 0); });
    var key = { close: function (r) { return r.close; }, name: function (r) { return r.name; }, size: function (r) { return r.sizeCr; }, g: function (r) { return r.g == null ? -9 : r.g; }, rii: function (r) { return r.rii || 0; }, shni: function (r) { return r.shni || 0; }, bhni: function (r) { return r.bhni || 0; }, qib: function (r) { return r.qib || 0; }, total: function (r) { return r.total || 0; }, lg: function (r) { return r.listingGainPct == null ? -999 : r.listingGainPct; } }[st.sort];
    list.sort(function (a, b) { var x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
    var th = function (k, l, num) { return '<th class="sortable' + (num ? ' num' : '') + (st.sort === k ? ' on' : '') + '" data-sort="' + k + '">' + l + '<span class="arr">' + (st.sort === k ? (st.dir > 0 ? '▲' : '▼') : '↕') + '</span></th>'; };
    html += '<div class="panel"><div class="panel-head"><div><h2>Past IPOs</h2></div><div class="row"><input type="search" id="tQ" placeholder="Search IPO" value="' + FD.esc(st.q) + '" style="width:200px"><select id="tYear"><option value="">All years</option>' + FD.opts(years, st.tYear) + '</select><select id="tSeg">' + FD.opts([['', 'Mainboard + SME'], ['Mainboard', 'Mainboard'], ['SME', 'SME']], st.tSeg) + '</select><button class="primary" id="tX">Excel</button></div></div>' +
      '<div class="tbl max"><table id="histTbl"><thead><tr>' + th('name', 'IPO') + th('close', 'Closed') + th('size', 'Size ₹Cr', 1) + '<th class="num">Price</th>' + th('g', 'GMP', 1) + th('qib', 'QIB', 1) + th('shni', 'sHNI', 1) + th('bhni', 'bHNI', 1) + th('rii', 'Retail', 1) + th('total', 'Total', 1) + th('lg', 'Listing', 1) + '<th>Clash</th></tr></thead><tbody>' +
      list.map(function (r) { return '<tr><td>' + FD.esc(r.name) + ' ' + (r.seg === 'SME' ? '<span class="pill SME">' + FD.esc(r.exchange) + '</span>' : '') + '</td><td>' + FD.dt(r.close) + '</td><td class="num">' + Math.round(r.sizeCr).toLocaleString('en-IN') + '</td><td class="num">₹' + r.price + '</td><td class="num">' + (r.gmp == null ? '—' : '₹' + r.gmp + ' <span class="muted small">' + (r.g * 100).toFixed(0) + '%</span>') + '</td>' +
        ['qib', 'shni', 'bhni', 'rii', 'total'].map(function (c) { return '<td class="num">' + tx(r[c]) + '</td>'; }).join('') + '<td class="num">' + (r.listingGainPct == null ? '—' : '<span class="' + (r.listingGainPct >= 0 ? 'pos' : 'neg') + '">' + (r.listingGainPct > 0 ? '+' : '') + r.listingGainPct.toFixed(1) + '%</span>') + '</td><td class="small muted">' + (r.rivals && r.rivals.length ? r.rivals.slice(0, 2).map(function (v) { return FD.esc(v.name.replace(/\s+(Limited|Ltd\.?)$/i, '')); }).join(', ') + (r.rivals.length > 2 ? ' +' + (r.rivals.length - 2) : '') : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="muted small">' + list.length + ' IPOs · Source: investorgain.com (final subscription, GMP history, listing) · times = number of times the category was subscribed.</p></div>';

    el.innerHTML = html;
    wire(el, list);
    drawChart(rows);
  };
  function unitShares(c) {
    var lot = +st.lot; if (!lot) return null;
    var r = C.lotRules({ type: st.seg, priceHigh: +st.price, lotSize: lot });
    return C.unitShares({ type: st.seg, priceHigh: +st.price, lotSize: lot }, CAT_MAP[c]) || null;
  }
  function tx(v) { if (v == null || isNaN(v)) return '—'; return (v >= 100 ? Math.round(v).toLocaleString('en-IN') : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + '×'; }
  function heat(v) { if (v == null) return ''; var t = Math.max(0, Math.min(1, Math.log10(Math.max(1, v)) / 3)); return 'background:color-mix(in srgb, var(--shni) ' + Math.round(t * 38) + '%, transparent)'; }
  function inp(k, label) { return '<label>' + label + ' <input data-k="' + k + '" type="number" step="any" value="' + FD.esc(st[k]) + '"></label>'; }

  function wire(el, list) {
    var $ = function (s) { return el.querySelector(s); };
    $('#pIpo').onchange = function (e) { st.ipo = e.target.value; if (st.ipo) sync(st.ipo); FD.renderPredict(); };
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
    el.querySelectorAll('[data-cc]').forEach(function (b) { b.onclick = function () { st.chCat = b.dataset.cc; FD.renderPredict(); }; });
    el.querySelectorAll('[data-sort]').forEach(function (t) { t.onclick = function () { var k = t.dataset.sort; if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = k === 'name' ? 1 : -1; } FD.renderPredict(); }; });
    $('#tQ').oninput = function (e) { st.q = e.target.value.toLowerCase(); var p = e.target.selectionStart; FD.renderPredict(); var n = document.getElementById('tQ'); n.focus(); n.setSelectionRange(p, p); };
    $('#tYear').onchange = function (e) { st.tYear = e.target.value; FD.renderPredict(); };
    $('#tSeg').onchange = function (e) { st.tSeg = e.target.value; FD.renderPredict(); };
    $('#tX').onclick = function () {
      FD.excel('FinDeependence-past-IPO-subscription-' + FD.stamp() + '.xlsx', [{ name: 'Past IPOs', title: 'Past IPO subscription, GMP and listing',
        cols: [{ h: 'IPO', w: 30 }, { h: 'Segment' }, { h: 'Open', fmt: 'date' }, { h: 'Close', fmt: 'date' }, { h: 'Issue size ₹Cr', fmt: 'int' }, { h: 'Price ₹', fmt: 'int' }, { h: 'GMP ₹', fmt: 'int' }, { h: 'GMP %', fmt: 'pct' }, { h: 'QIB ×' }, { h: 'sHNI ×' }, { h: 'bHNI ×' }, { h: 'Retail ×' }, { h: 'Total ×' }, { h: 'Listing gain %' }, { h: 'Attention share', fmt: 'pct' }, { h: 'Open same days', w: 36 }],
        rows: list.map(function (r) { return [r.name, r.exchange, r.open, r.close, r.sizeCr, r.price, r.gmp, r.g, r.qib, r.shni, r.bhni, r.rii, r.total, r.listingGainPct, r.share, (r.rivals || []).map(function (v) { return v.name; }).join(', ')]; }) },
      { name: 'Matrix', title: 'Median times subscribed by issue size and GMP', cols: [{ h: 'Segment' }, { h: 'Category' }, { h: 'Issue size', w: 18 }].concat(P.GMP_B.map(function (b) { return { h: b[2] + ' (median ×)' }; })).concat(P.GMP_B.map(function (b) { return { h: b[2] + ' (IPOs)', fmt: 'int' }; })),
        rows: [].concat.apply([], ['Mainboard', 'SME'].map(function (s) { return [].concat.apply([], CATS.concat(['total']).map(function (c) { return P.matrix(FD.model.rows, s, c).map(function (r) { return [s, LBL[c], r.label].concat(r.cells.map(function (x) { return x.median == null ? null : +x.median.toFixed(2); })).concat(r.cells.map(function (x) { return x.n; })); }); })); })) }]);
    };
  }

  function drawChart(rows) {
    var col = FD.colors(), c = st.chCat;
    var pts = function (seg) { return rows.filter(function (r) { return r.seg === seg && r.g != null && r[c] > 0; }).map(function (r) { return { x: +(r.g * 100).toFixed(1), y: r[c], n: r.name, s: r.sizeCr }; }); };
    FD.chart('chPred', { type: 'scatter', data: { datasets: [
      { label: 'Mainboard', data: pts('Mainboard'), backgroundColor: col.bhni, pointRadius: 5, pointHoverRadius: 7, pointBorderColor: col.surface, pointBorderWidth: 1.5 },
      { label: 'SME', data: pts('SME'), backgroundColor: col.retail, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: col.surface, pointBorderWidth: 1.5 }] },
      options: { interaction: { mode: 'nearest', intersect: true }, scales: { x: { title: { display: true, text: 'GMP during issue %' }, ticks: { callback: function (v) { return v + '%'; } } }, y: { type: 'logarithmic', title: { display: true, text: LBL[c] + ' times subscribed' }, ticks: { callback: function (v) { var s = String(v); return /^(1|2|5)0*(\.0+)?$|^0\.(1|2|5)$/.test(s) ? v + '×' : ''; } } } },
        plugins: { tooltip: { callbacks: { label: function (ctx) { var p = ctx.raw; return ' ' + p.n + ': GMP ' + p.x + '% → ' + tx(p.y) + ' (₹' + Math.round(p.s) + ' Cr)'; } } } } } });
  }
})();
