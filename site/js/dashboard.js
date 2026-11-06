/* FinDeependence IPO Deal Desk · Dashboard: KPIs, growth charts, risk and insights. */
(function () {
  var FD = window.FD, C = FD.C;
  var st = { period: 'fy', type: '', from: '', to: '' };

  function filtered() {
    var rg = FD.periodRange(st.period, st.from, st.to);
    return FD.rows(function (x) { return x.date >= rg[0] && x.date <= rg[1] && (!st.type || x.ipo.type === st.type); });
  }
  function prevRows() {
    // same-length period before the current one (for growth)
    var rg = FD.periodRange(st.period, st.from, st.to);
    if (rg[0] === '0000') return null;
    var a = new Date(rg[0] + 'T00:00:00'), b = new Date(rg[1].slice(0, 8) + '01T00:00:00');
    var months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
    var pa = new Date(a); pa.setMonth(pa.getMonth() - months);
    var pb = new Date(a); pb.setDate(0);
    var f = pa.toISOString().slice(0, 10), t = pb.toISOString().slice(0, 10);
    return FD.rows(function (x) { return x.date >= f && x.date <= t && (!st.type || x.ipo.type === st.type); });
  }
  function delta(cur, prev) {
    if (prev == null || !isFinite(prev) || Math.abs(prev) < 1) return '';
    var g = (cur - prev) / Math.abs(prev);
    return '<span class="delta ' + (g >= 0 ? 'pos' : 'neg') + '">' + (g >= 0 ? '▲ ' : '▼ ') + Math.abs(g * 100).toFixed(0) + '% vs previous</span>';
  }

  FD.renderDash = function () {
    var el = document.getElementById('v-dash');
    var rows = filtered(), t = FD.sum(rows);
    var pr = prevRows(), pt = pr ? FD.sum(pr) : null;
    var all = FD.sum(FD.rows());
    var ipoIds = {}; rows.forEach(function (x) { ipoIds[x.d.ipoId] = 1; });
    var invIds = {}; rows.forEach(function (x) { invIds[x.d.investorId] = 1; });
    var nIpo = Object.keys(ipoIds).length, nInv = Object.keys(invIds).length;
    var realisedPerApp = t.final ? t.profit / t.final : null;
    var periodName = { month: 'This month', last3: 'Last 3 months', fy: 'This financial year', lfy: 'Last financial year', all: 'All time', custom: 'Custom period' }[st.period];

    var html = '<div class="dash-head"><div><div class="lbl" style="font:700 10px var(--mono);letter-spacing:.14em;color:var(--teal);text-transform:uppercase">Business dashboard</div><h2>' + periodName + '</h2>' +
      '</div>' +
      '<div class="filters" style="margin:0"><label>Period <select id="dPeriod">' + FD.opts([['month', 'This month'], ['last3', 'Last 3 months'], ['fy', 'This FY'], ['lfy', 'Last FY'], ['all', 'All time'], ['custom', 'Custom']], st.period) + '</select></label>' +
      (st.period === 'custom' ? '<label>From <input type="date" id="dFrom" value="' + st.from + '"></label><label>To <input type="date" id="dTo" value="' + st.to + '"></label>' : '') +
      '<label>Type <select id="dType">' + FD.opts([['', 'Mainboard + SME'], ['Mainboard', 'Mainboard'], ['SME', 'SME']], st.type) + '</select></label></div></div>';

    if (!FD.state.deals.length) {
      html += '<div class="panel empty-state"><h3>Welcome to your IPO Deal Desk</h3>' +
        '<div class="row" style="justify-content:center"><button class="primary" data-go="people">Add investors</button><button data-go="ipos">See live IPOs &amp; GMP</button><button data-go="data">Load demo data</button></div></div>';
      html += opportunityBoard();
      el.innerHTML = html; wire(el); return;
    }

    html += '<div class="kpis">' +
      kpi('Net profit (realised)', FD.signed(t.profit, false), (t.final + ' settled applications') + '<br>' + delta(t.profit, pt && pt.profit), 'hero') +
      kpi('Expected on open deals', t.open && !t.expKnown ? '—' : FD.signed(t.expOpen), t.open + ' awaiting result' + (t.open - t.expKnown ? ' (' + (t.open - t.expKnown) + ' need subscription data)' : '') + ' · flat listing ' + FD.fmt(Math.round(t.worst))) +
      kpi('Receivable from brokers', FD.fmt(Math.round(all.recvBrk)), 'Payable to brokers ' + FD.fmt(Math.round(all.payBrk)) + ' · all periods, unsettled') +
      kpi('Payable to investors', FD.fmt(Math.round(all.payInv)), 'Receivable from investors ' + FD.fmt(Math.round(all.recvInv)) + ' · all periods, unsettled') +
      '</div><div class="kpis">' +
      kpi('Applications', t.n.toLocaleString('en-IN'), nIpo + ' IPOs · ' + nInv + ' investors<br>' + delta(t.n, pt && pt.n)) +
      kpi('Profit per application', realisedPerApp == null ? '—' : FD.signed(realisedPerApp, false), 'Realised average') +
      kpi('Allotment rate', FD.pct(t.hit), 'SEBI-expected ' + FD.pct(t.expPn ? t.expP / t.expPn : null) + ' · ' + t.allotted + ' of ' + t.decided) +
      kpi('Hedged with brokers', FD.pct(t.n ? t.hedged / t.n : null, 0), t.hedged + ' sold on · ' + (t.n - t.hedged) + ' held at your risk') +
      '</div>';

    html += '<div class="grid2">' +
      card('Monthly profit', 'Realised profit and expected profit on deals still open, by listing month', '<div class="legend-row"><span><i style="background:var(--shni)"></i>Realised</span><span><i style="background:var(--retail)"></i>Expected (open)</span></div><div class="chart"><canvas id="chMonthly"></canvas></div>') +
      card('Monthly volume by category', 'Applications booked per listing month', '<div class="legend-row"><span><i style="background:var(--retail)"></i>Retail</span><span><i style="background:var(--shni)"></i>sHNI</span><span><i style="background:var(--bhni)"></i>bHNI</span></div><div class="chart"><canvas id="chVolume"></canvas></div>') +
      '</div><div class="grid2">' +
      card('Profit by IPO', 'Realised + expected, largest first', '<div class="chart tall"><canvas id="chIpo"></canvas></div>') +
      card('Where the money is made', 'Profit per application by category and strategy', '<div class="legend-row"><span><i style="background:var(--c4)"></i>Hedged (sold to broker)</span><span><i style="background:var(--retail)"></i>Held at risk to listing</span></div><div class="chart tall"><canvas id="chCat"></canvas></div>') +
      '</div><div class="grid3">' +
      card('Top investors', 'Profit earned through each investor', '<div class="chart tall"><canvas id="chInv"></canvas></div>') +
      card('Brokers', 'Applications sold to each broker', '<div class="chart tall"><canvas id="chBrk"></canvas></div>') +
      card('GMP vs actual listing', 'Last GMP before listing vs actual listing gain, per share (%). Above the line = listed better than GMP.', '<div class="chart tall"><canvas id="chGmp"></canvas></div>') +
      '</div>';

    html += '<div class="grid2">' + card('Insights for growing the desk', 'Generated from your own numbers', '<ul class="insights">' + insights(rows, t, all).map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>') +
      card('Open positions', 'IPOs not yet settled · expected profit and the flat-listing case', openTable()) + '</div>';
    html += opportunityBoard();
    el.innerHTML = html;
    wire(el);
    drawCharts(rows);
  };

  function kpi(lbl, val, hint, cls) { return '<div class="kpi ' + (cls || '') + '"><small>' + lbl + '</small><b>' + val + '</b><span class="hint">' + (hint || '') + '</span></div>'; }
  function card(t, s, body) { return '<div class="card"><h3>' + t + '</h3><p class="sub">' + s + '</p>' + body + '</div>'; }

  function wire(el) {
    var g = function (id) { return el.querySelector('#' + id); };
    g('dPeriod').onchange = function (e) { st.period = e.target.value; FD.renderDash(); };
    g('dType').onchange = function (e) { st.type = e.target.value; FD.renderDash(); };
    if (g('dFrom')) { g('dFrom').onchange = function (e) { st.from = e.target.value; FD.renderDash(); }; g('dTo').onchange = function (e) { st.to = e.target.value; FD.renderDash(); }; }
    el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { if (b.dataset.go === 'data') { FD.loadDemo(); return; } FD.go(b.dataset.go); }; });
    el.querySelectorAll('[data-ipo]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); FD.go(a.dataset.to || 'ipos', a.dataset.ipo); }; });
  }

  function openTable() {
    var rows = FD.rows(function (x) { return !x.r.final; });
    if (!rows.length) return '<p class="muted">No open positions. Every deal has its result.</p>';
    var by = {};
    rows.forEach(function (x) { var k = x.d.ipoId; (by[k] = by[k] || { ipo: x.ipo, rows: [] }).rows.push(x); });
    var list = Object.values(by).sort(function (a, b) { return String(a.ipo.listingDate || '9').localeCompare(String(b.ipo.listingDate || '9')); });
    return '<div class="tbl"><table><thead><tr><th>IPO</th><th>Stage</th><th class="num">Apps</th><th class="num">Hedged</th><th class="num">Expected</th><th class="num">If flat</th></tr></thead><tbody>' +
      list.map(function (g) {
        var s = FD.sum(g.rows);
        return '<tr><td><a href="#" class="go" data-ipo="' + g.ipo.id + '" data-to="deals">' + FD.esc(g.ipo.name) + '</a></td><td>' + FD.stagePill(g.ipo.stage) + '</td><td class="num">' + s.n + '</td><td class="num">' + s.hedged + '</td><td class="num">' + (s.expKnown ? FD.signed(s.expOpen) : '<span class="muted small">needs subscription</span>') + '</td><td class="num">' + FD.signed(s.worst) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // Live opportunity board: open & upcoming IPOs with fair rates per category.
  function opportunityBoard() {
    var live = FD.ipos().filter(function (i) { return i.stage === 'Open' || i.stage === 'Upcoming' || i.stage === 'Closed'; }).slice(0, 12);
    if (!live.length) return '';
    var m = FD.state.settings.marginPct;
    var rows = live.map(function (i) {
      var cells = C.CATS.map(function (c) {
        var o = C.opportunity(i, c, FD.state.settings.factors, m);
        return '<td class="num">' + (o.gainIfAllotted == null ? '—' : FD.fmt(o.gainIfAllotted)) + '<br><span class="muted small">' + FD.oneIn(o.p) + (o.expected != null ? ' · EV ' + FD.fmt(Math.round(o.expected)) : '') + '</span></td>';
      }).join('');
      var gp = i.gmp != null && i.priceHigh ? i.gmp / i.priceHigh : null;
      return '<tr><td><a href="#" class="go" data-ipo="' + i.id + '">' + FD.esc(i.name) + '</a><br>' + FD.typePill(i) + ' ' + FD.stagePill(i.stage) + '</td><td class="num">' + (i.gmp == null ? '—' : '₹' + i.gmp) + '<br><span class="muted small">' + FD.pct(gp) + '</span></td><td class="nowrap">' + FD.dt(i.openDate) + ' – ' + FD.dt(i.closeDate) + '<br><span class="muted small">Lists ' + FD.dt(i.listingDate) + '</span></td>' + cells + '</tr>';
    }).join('');
    return '<div class="card" style="margin-top:12px"><h3>Live opportunity board</h3><p class="sub">Gain if allotted · chance · expected value per application</p>' +
      '<div class="tbl"><table><thead><tr><th>IPO</th><th class="num">GMP</th><th>Dates</th><th class="num">Retail</th><th class="num">sHNI</th><th class="num">bHNI</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function drawCharts(rows) {
    var col = FD.colors();
    // monthly
    var months = {};
    rows.forEach(function (x) {
      var m = months[x.month] = months[x.month] || { real: 0, exp: 0, RETAIL: 0, SHNI: 0, BHNI: 0 };
      if (x.r.final) m.real += x.r.profit; else if (x.r.exp) m.exp += x.r.exp.profit;
      m[x.d.cat]++;
    });
    var keys = Object.keys(months).sort();
    FD.chart('chMonthly', { type: 'bar', data: { labels: keys.map(FD.mon), datasets: [
      { label: 'Realised', data: keys.map(function (k) { return Math.round(months[k].real); }), backgroundColor: col.shni, stack: 's' },
      { label: 'Expected (open)', data: keys.map(function (k) { return Math.round(months[k].exp); }), backgroundColor: col.retail, stack: 's' }] },
      options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: FD.moneyTick } } }, plugins: { tooltip: { callbacks: { label: FD.moneyTip } } } } });
    FD.chart('chVolume', { type: 'bar', data: { labels: keys.map(FD.mon), datasets: [
      { label: 'Retail', data: keys.map(function (k) { return months[k].RETAIL; }), backgroundColor: col.retail, stack: 'v' },
      { label: 'sHNI', data: keys.map(function (k) { return months[k].SHNI; }), backgroundColor: col.shni, stack: 'v' },
      { label: 'bHNI', data: keys.map(function (k) { return months[k].BHNI; }), backgroundColor: col.bhni, stack: 'v' }] },
      options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } } } });
    // by IPO
    var ipo = {};
    rows.forEach(function (x) { var k = x.ipo.name; ipo[k] = (ipo[k] || 0) + (x.r.final ? x.r.profit : (x.r.exp ? x.r.exp.profit : 0)); });
    var ik = Object.keys(ipo).sort(function (a, b) { return Math.abs(ipo[b]) - Math.abs(ipo[a]); }).slice(0, 12);
    FD.chart('chIpo', { type: 'bar', data: { labels: ik.map(function (n) { return n.length > 26 ? n.slice(0, 25) + '…' : n; }), datasets: [{ label: 'Profit', data: ik.map(function (k) { return Math.round(ipo[k]); }), backgroundColor: ik.map(function (k) { return ipo[k] >= 0 ? col.pos : col.neg; }) }] },
      options: { indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false }, scales: { x: { ticks: { callback: FD.moneyTick } }, y: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: FD.moneyTip } } } } });
    // category × strategy, profit per app (realised + expected)
    var cs = {};
    rows.forEach(function (x) { var k = x.d.cat + (x.r.hedged ? 'H' : 'R'); var v = x.r.final ? x.r.profit : (x.r.exp ? x.r.exp.profit : 0); cs[k] = cs[k] || { s: 0, n: 0 }; cs[k].s += v; cs[k].n++; });
    var per = function (k) { return cs[k] ? Math.round(cs[k].s / cs[k].n) : 0; };
    FD.chart('chCat', { type: 'bar', data: { labels: ['Retail', 'sHNI', 'bHNI'], datasets: [
      { label: 'Hedged', data: C.CATS.map(function (c) { return per(c + 'H'); }), backgroundColor: col.c4 },
      { label: 'Held at risk', data: C.CATS.map(function (c) { return per(c + 'R'); }), backgroundColor: col.retail }] },
      options: { scales: { x: { grid: { display: false } }, y: { ticks: { callback: FD.moneyTick } } }, plugins: { tooltip: { callbacks: { label: function (ctx) { var k = C.CATS[ctx.dataIndex] + (ctx.datasetIndex ? 'R' : 'H'); return ' ' + ctx.dataset.label + ': ' + C.inr(ctx.parsed.y) + ' per app · ' + (cs[k] ? cs[k].n : 0) + ' apps'; } } } } } });
    // investors
    var inv = {};
    rows.forEach(function (x) { var k = FD.invName(x.d.investorId); inv[k] = (inv[k] || 0) + (x.r.final ? x.r.profit : (x.r.exp ? x.r.exp.profit : 0)); });
    var vk = Object.keys(inv).sort(function (a, b) { return inv[b] - inv[a]; }).slice(0, 10);
    FD.chart('chInv', { type: 'bar', data: { labels: vk, datasets: [{ label: 'Profit', data: vk.map(function (k) { return Math.round(inv[k]); }), backgroundColor: vk.map(function (k) { return inv[k] >= 0 ? col.shni : col.neg; }) }] },
      options: { indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false }, scales: { x: { ticks: { callback: FD.moneyTick } }, y: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: FD.moneyTip } } } } });
    // brokers
    var bk = {};
    rows.forEach(function (x) { if (!x.d.brokerId) return; var k = FD.brkName(x.d.brokerId); bk[k] = (bk[k] || 0) + 1; });
    var bks = Object.keys(bk).sort(function (a, b) { return bk[b] - bk[a]; }).slice(0, 10);
    FD.chart('chBrk', { type: 'bar', data: { labels: bks.length ? bks : ['No broker deals yet'], datasets: [{ label: 'Applications', data: bks.map(function (k) { return bk[k]; }), backgroundColor: col.bhni }] },
      options: { indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false }, scales: { x: { ticks: { precision: 0 } }, y: { grid: { display: false } } } } });
    // GMP accuracy
    var pts = FD.ipos().filter(function (i) { return i.listingPrice && i.priceHigh && (i.gmpBeforeListing != null || (i.gmpHistory && i.gmpHistory.length)); }).map(function (i) {
      var g = i.gmpBeforeListing != null ? i.gmpBeforeListing : lastGmpBefore(i);
      return g == null ? null : { x: +(g / i.priceHigh * 100).toFixed(1), y: +((i.listingPrice - i.priceHigh) / i.priceHigh * 100).toFixed(1), n: i.name };
    }).filter(Boolean);
    var mx = Math.max(10, ...pts.map(function (p) { return Math.max(p.x, p.y); }));
    var mn = Math.min(0, ...pts.map(function (p) { return Math.min(p.x, p.y); }));
    FD.chart('chGmp', { type: 'scatter', data: { datasets: [
      { label: 'IPOs', data: pts, backgroundColor: col.bhni, pointRadius: 5, pointHoverRadius: 7, pointBorderColor: col.surface, pointBorderWidth: 2 },
      { type: 'line', label: 'Listed exactly at GMP', data: [{ x: mn, y: mn }, { x: mx, y: mx }], borderColor: col.muted, borderDash: [4, 4], borderWidth: 1, pointRadius: 0 }] },
      options: { interaction: { mode: 'nearest', intersect: true }, scales: { x: { title: { display: true, text: 'GMP before listing %' }, ticks: { callback: function (v) { return v + '%'; } } }, y: { title: { display: true, text: 'Actual listing gain %' }, ticks: { callback: function (v) { return v + '%'; } } } },
        plugins: { tooltip: { callbacks: { label: function (ctx) { var p = ctx.raw; return p.n ? ' ' + p.n + ': GMP ' + p.x + '% → listed ' + p.y + '%' : ''; } } } } } });
  }
  function lastGmpBefore(i) {
    var h = (i.gmpHistory || []).filter(function (x) { return !i.listingDate || x.t.slice(0, 10) < i.listingDate; });
    return h.length ? h[h.length - 1].g : null;
  }
  FD.lastGmpBefore = lastGmpBefore;

  function insights(rows, t, all) {
    var out = [];
    var fin = rows.filter(function (x) { return x.r.final; });
    if (fin.length) {
      var h = fin.filter(function (x) { return x.r.hedged; }), r = fin.filter(function (x) { return !x.r.hedged; });
      var avg = function (a) { return a.length ? a.reduce(function (s, x) { return s + x.r.profit; }, 0) / a.length : null; };
      if (h.length && r.length) out.push('Hedged deals earned <b>' + FD.fmt(Math.round(avg(h))) + '</b> per application vs <b>' + FD.fmt(Math.round(avg(r))) + '</b> on deals you held to listing. ' + (avg(r) > avg(h) ? 'Your risk book is paying — but keep the flat-listing exposure in check.' : 'Selling on to brokers is your more reliable earner; hedge more when GMP is shaky.'));
      var cat = C.CATS.map(function (c) { var a = fin.filter(function (x) { return x.d.cat === c; }); return { c: c, n: a.length, v: avg(a) }; }).filter(function (x) { return x.n; }).sort(function (a, b) { return b.v - a.v; });
      if (cat.length > 1) out.push('<b>' + C.CAT_LABEL[cat[0].c] + '</b> is your best category at <b>' + FD.fmt(Math.round(cat[0].v)) + '</b> per application; ' + C.CAT_LABEL[cat[cat.length - 1].c] + ' earns ' + FD.fmt(Math.round(cat[cat.length - 1].v)) + '. Shift investor capacity towards the better one.');
    }
    if (t.expPn && t.decided >= 5) {
      var e = t.expP / t.expPn, a = t.hit;
      out.push('Allotment luck: <b>' + FD.pct(a) + '</b> actual vs <b>' + FD.pct(e) + '</b> expected by the SEBI lottery maths. ' + (a > e * 1.15 ? 'You have been luckier than average — don\'t price Kostak on this luck.' : a < e * 0.85 ? 'Below the odds so far; more applications per IPO smooth this out.' : 'Right on the odds — your pricing model is calibrated.'));
    }
    var act = {}; FD.rows(function (x) { return x.date >= addDays(FD.today(), -60); }).forEach(function (x) { act[x.d.investorId] = 1; });
    var idle = FD.state.investors.filter(function (i) { return i.active !== false && !act[i.id]; });
    if (FD.state.investors.length && idle.length) out.push('<b>' + idle.length + '</b> of your ' + FD.state.investors.length + ' investors have had no deal in 60 days (e.g. ' + idle.slice(0, 3).map(function (i) { return FD.esc(i.name); }).join(', ') + '). Re-activating them is your cheapest growth.');
    if (all.recvBrk > 0 || all.payInv > 0) out.push('Cash to collect from brokers: <b>' + FD.fmt(Math.round(all.recvBrk)) + '</b>; cash to pay investors: <b>' + FD.fmt(Math.round(all.payInv)) + '</b>. Settle promptly — trust is what brings repeat PANs.');
    if (t.open && t.worst < 0) out.push('If every open IPO listed flat, you would lose <b>' + FD.fmt(Math.round(-t.worst)) + '</b> on deals not yet sold on. Selling part of the book to brokers caps this.');
    var live = FD.ipos().filter(function (i) { return (i.stage === 'Open' || i.stage === 'Upcoming') && i.gmp != null; }).map(function (i) { return { i: i, o: C.opportunity(i, 'RETAIL', FD.state.settings.factors, FD.state.settings.marginPct) }; }).filter(function (x) { return x.o.expected != null; }).sort(function (a, b) { return b.o.expected - a.o.expected; });
    if (live.length) out.push('Best live retail opportunity: <b>' + FD.esc(live[0].i.name) + '</b> — expected ' + FD.fmt(Math.round(live[0].o.expected)) + ' per application (GMP ₹' + live[0].i.gmp + ', ' + FD.oneIn(live[0].o.p) + '). Fair Kostak ≈ ' + FD.fmt(Math.round(live[0].o.expected)) + '.');
    if (!out.length) out.push('Book a few deals and record allotment results — insights appear here automatically.');
    return out;
  }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
})();
