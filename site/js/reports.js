/* FinDeependence IPO Deal Desk · Reports: monthly, IPO-wise, investor and broker ledgers, category, all deals. Excel + PDF. */
(function () {
  var FD = window.FD, C = FD.C;
  var st = { view: 'month', period: 'fy', from: '', to: '', ipo: '', inv: '', brk: '', cat: '', type: '', status: '' };
  var VIEWS = [['month', 'Monthly'], ['ipo', 'IPO-wise'], ['inv', 'Investor ledger'], ['brk', 'Broker ledger'], ['cat', 'Category'], ['all', 'All deals']];

  function rows() {
    var rg = FD.periodRange(st.period, st.from, st.to);
    return FD.rows(function (x) {
      return x.date >= rg[0] && x.date <= rg[1] && (!st.ipo || x.d.ipoId === st.ipo) && (!st.inv || x.d.investorId === st.inv) &&
        (!st.brk || (st.brk === '-' ? !x.d.brokerId : x.d.brokerId === st.brk)) && (!st.cat || x.d.cat === st.cat) && (!st.type || x.ipo.type === st.type) &&
        (!st.status || (st.status === 'final' ? x.r.final : st.status === 'open' ? !x.r.final : st.status === 'unsettled' ? x.r.final && ((!x.d.invSettled && Math.abs(x.r.invNet) > .5) || (x.r.hedged && !x.d.brkSettled && Math.abs(x.r.brkNet) > .5)) : true));
    });
  }
  function groupBy(rs, keyFn) { var g = {}; rs.forEach(function (x) { var k = keyFn(x); (g[k] = g[k] || []).push(x); }); return g; }

  // Each view returns { cols:[{h, fmt, k}], rows:[[...]], total:[...] , link: fn(rowIndex)->{to,id} }
  function build(view, rs) {
    var money = 'money';
    if (view === 'month') {
      var g = groupBy(rs, function (x) { return x.month; });
      var keys = Object.keys(g).sort().reverse();
      var cols = [{ h: 'Month' }, { h: 'IPOs', fmt: 'int' }, { h: 'Apps', fmt: 'int' }, { h: 'Retail', fmt: 'int' }, { h: 'sHNI', fmt: 'int' }, { h: 'bHNI', fmt: 'int' }, { h: 'Allotted', fmt: 'int' }, { h: 'Paid to investors', fmt: 'amt' }, { h: 'From brokers (deals)', fmt: 'amt' }, { h: 'Listing P/L taken', fmt: money }, { h: 'Realised profit', fmt: money }, { h: 'Expected (open)', fmt: money }, { h: 'Profit / app', fmt: money }, { h: 'Growth vs prev', fmt: 'pct' }];
      var out = keys.map(function (k, idx) {
        var t = FD.sum(g[k]); var ipos = Object.keys(groupBy(g[k], function (x) { return x.d.ipoId; })).length;
        var prev = keys[idx + 1] ? FD.sum(g[keys[idx + 1]]).profit : null;
        return [FD.mon(k), ipos, t.n, t.cats.RETAIL, t.cats.SHNI, t.cats.BHNI, t.allotted, t.Di, t.Db, t.L, t.profit, t.expOpen, t.final ? t.profit / t.final : null, prev && Math.abs(prev) > 1 ? (t.profit - prev) / Math.abs(prev) : null];
      });
      var T = FD.sum(rs);
      return { cols: cols, rows: out, total: ['Total', Object.keys(groupBy(rs, function (x) { return x.d.ipoId; })).length, T.n, T.cats.RETAIL, T.cats.SHNI, T.cats.BHNI, T.allotted, T.Di, T.Db, T.L, T.profit, T.expOpen, T.final ? T.profit / T.final : null, null] };
    }
    if (view === 'ipo') {
      var gi = groupBy(rs, function (x) { return x.d.ipoId; });
      var ks = Object.keys(gi).sort(function (a, b) { return String(gi[b][0].ipo.bookDate).localeCompare(String(gi[a][0].ipo.bookDate)); });
      return { cols: [{ h: 'IPO' }, { h: 'Type' }, { h: 'Listing', fmt: 'date' }, { h: 'Apps', fmt: 'int' }, { h: 'Allotted', fmt: 'int' }, { h: 'Hit %', fmt: 'pct' }, { h: 'Hedged', fmt: 'int' }, { h: 'Paid to investors', fmt: 'amt' }, { h: 'From brokers', fmt: 'amt' }, { h: 'Listing P/L', fmt: money }, { h: 'Investor ±', fmt: money }, { h: 'Broker ±', fmt: money }, { h: 'Profit', fmt: money }, { h: 'Profit / app', fmt: money }, { h: 'Status' }],
        rows: ks.map(function (k) { var t = FD.sum(gi[k]), i = gi[k][0].ipo; var fin = t.final === t.n; return [i.name, i.type, i.listingDate || '', t.n, t.allotted, t.hit, t.hedged, t.Di, t.Db, t.L, t.inv, t.brk, fin ? t.profit : t.expProfit, (fin ? t.profit : t.expProfit) / t.n, fin ? 'Final' : 'Expected']; }),
        total: (function () { var t = FD.sum(rs); return ['Total', '', '', t.n, t.allotted, t.hit, t.hedged, t.Di, t.Db, t.L, t.inv, t.brk, t.profit + t.expOpen, t.n ? (t.profit + t.expOpen) / t.n : null, '']; })(),
        link: ks.map(function (k) { return { to: 'deals', id: k }; }) };
    }
    if (view === 'inv') {
      var gv = groupBy(rs, function (x) { return x.d.investorId; });
      var kv = Object.keys(gv).sort(function (a, b) { return FD.invName(a).localeCompare(FD.invName(b)); });
      var out2 = kv.map(function (k) {
        var t = FD.sum(gv[k]), inv = FD.investor(k) || {};
        var net = 0, open = 0; gv[k].forEach(function (x) { if (x.r.final) { net += x.r.invNet; if (!x.d.invSettled) open += x.r.invNet; } });
        return [inv.name || '(deleted)', inv.pan || '', inv.group || '', t.n, t.allotted, t.hit, t.Di, net, open > 0.5 ? open : 0, open < -0.5 ? -open : 0, t.profit, t.expOpen];
      });
      var sumc = function (i) { return out2.reduce(function (s, r) { return s + (r[i] || 0); }, 0); };
      return { cols: [{ h: 'Investor' }, { h: 'PAN' }, { h: 'Group' }, { h: 'Apps', fmt: 'int' }, { h: 'Allotted', fmt: 'int' }, { h: 'Hit %', fmt: 'pct' }, { h: 'Paid to investor (deals)', fmt: 'amt' }, { h: 'Net with investor (+ recv)', fmt: money }, { h: 'To receive (open)', fmt: 'amt' }, { h: 'To pay (open)', fmt: 'amt' }, { h: 'Profit earned', fmt: money }, { h: 'Expected (open)', fmt: money }],
        rows: out2, total: ['Total', '', '', sumc(3), sumc(4), null, sumc(6), sumc(7), sumc(8), sumc(9), sumc(10), sumc(11)], link: kv.map(function (k) { return { to: 'inv', id: k }; }) };
    }
    if (view === 'brk') {
      var hb = rs.filter(function (x) { return x.d.brokerId; });
      var gb = groupBy(hb, function (x) { return x.d.brokerId; });
      var kb = Object.keys(gb).sort(function (a, b) { return FD.brkName(a).localeCompare(FD.brkName(b)); });
      var out3 = kb.map(function (k) {
        var t = FD.sum(gb[k]), net = 0, open = 0; gb[k].forEach(function (x) { if (x.r.final) { net += x.r.brkNet; if (!x.d.brkSettled) open += x.r.brkNet; } });
        var ipos = Object.keys(groupBy(gb[k], function (x) { return x.d.ipoId; })).length;
        return [FD.brkName(k), ipos, t.n, t.allotted, t.Db, t.L, net, open > .5 ? open : 0, open < -.5 ? -open : 0, t.profit];
      });
      var s3 = function (i) { return out3.reduce(function (s, r) { return s + (r[i] || 0); }, 0); };
      return { cols: [{ h: 'Broker' }, { h: 'IPOs', fmt: 'int' }, { h: 'Apps', fmt: 'int' }, { h: 'Allotted', fmt: 'int' }, { h: 'Deal amount', fmt: 'amt' }, { h: 'Listing P/L passed', fmt: money }, { h: 'Net with broker (+ recv)', fmt: money }, { h: 'To receive (open)', fmt: 'amt' }, { h: 'To pay (open)', fmt: 'amt' }, { h: 'My profit on these', fmt: money }],
        rows: out3, total: ['Total', '', s3(2), s3(3), s3(4), s3(5), s3(6), s3(7), s3(8), s3(9)], link: kb.map(function (k) { return { to: 'brk', id: k }; }) };
    }
    if (view === 'cat') {
      var out4 = C.CATS.map(function (c) {
        var a = rs.filter(function (x) { return x.d.cat === c; }), t = FD.sum(a);
        return [C.CAT_LABEL[c], t.n, t.decided, t.allotted, t.hit, t.expPn ? t.expP / t.expPn : null, t.n ? t.Di / Math.max(1, t.final) : null, t.profit, t.final ? t.profit / t.final : null, t.expOpen, t.hedged];
      });
      var T = FD.sum(rs);
      return { cols: [{ h: 'Category' }, { h: 'Apps', fmt: 'int' }, { h: 'Results in', fmt: 'int' }, { h: 'Allotted', fmt: 'int' }, { h: 'Actual hit %', fmt: 'pct' }, { h: 'SEBI-expected %', fmt: 'pct' }, { h: 'Avg paid / app', fmt: 'amt' }, { h: 'Realised profit', fmt: money }, { h: 'Profit / app', fmt: money }, { h: 'Expected (open)', fmt: money }, { h: 'Hedged', fmt: 'int' }],
        rows: out4, total: ['Total', T.n, T.decided, T.allotted, T.hit, T.expPn ? T.expP / T.expPn : null, T.final ? T.Di / T.final : null, T.profit, T.final ? T.profit / T.final : null, T.expOpen, T.hedged] };
    }
    // all
    var v = function (x, k) { return x.r.final ? x.r[k] : (x.r.exp ? x.r.exp[k] : null); };
    var sorted = rs.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || FD.invName(a.d.investorId).localeCompare(FD.invName(b.d.investorId)); });
    var out5 = sorted.map(function (x) {
      var inv = FD.investor(x.d.investorId) || {};
      return [x.ipo.name, x.date, inv.name || '', inv.pan || '', C.CAT_LABEL[x.d.cat], FD.dealTypeShort[x.d.buyType] + (x.d.buyType !== 'NONE' ? ' ' + (x.d.buyRate || 0) : ''), x.d.brokerId ? FD.brkName(x.d.brokerId) + ' · ' + FD.dealTypeShort[x.d.sellType] + ' ' + (x.d.sellRate || 0) : '—', { YES: 'Allotted', NO: 'Not allotted', PENDING: 'Pending' }[x.d.allot], x.r.A ? x.r.S : 0, v(x, 'L'), v(x, 'invNet'), v(x, 'brkNet'), v(x, 'profit'), x.r.final ? 'Final' : 'Expected', x.d.invSettled ? 'Yes' : '', x.r.hedged ? (x.d.brkSettled ? 'Yes' : '') : '—'];
    });
    var s5 = function (i) { return out5.reduce(function (s, r) { return s + (r[i] || 0); }, 0); };
    return { cols: [{ h: 'IPO' }, { h: 'Date', fmt: 'date' }, { h: 'Investor' }, { h: 'PAN' }, { h: 'Cat' }, { h: 'Investor deal' }, { h: 'Broker deal' }, { h: 'Allotment' }, { h: 'Shares', fmt: 'int' }, { h: 'Listing P/L', fmt: money }, { h: 'Investor ±', fmt: money }, { h: 'Broker ±', fmt: money }, { h: 'Profit', fmt: money }, { h: 'Status' }, { h: 'Inv settled' }, { h: 'Brk settled' }],
      rows: out5, total: ['Total', '', out5.length + ' rows', '', '', '', '', '', s5(8), s5(9), s5(10), s5(11), s5(12), '', '', ''] };
  }

  function cell(v, fmt) {
    if (v == null || v === '') return '<span class="muted">—</span>';
    if (fmt === 'money') return FD.signed(v);
    if (fmt === 'amt') return FD.fmt(Math.round(v));
    if (fmt === 'pct') return FD.pct(v);
    if (fmt === 'int') return Number(v).toLocaleString('en-IN');
    if (fmt === 'date') return FD.dt(v);
    return FD.esc(v);
  }

  FD.renderReports = function () {
    var el = document.getElementById('v-reports');
    var rs = rows(), b = build(st.view, rs), t = FD.sum(rs);
    var ipoOpts = [['', 'All IPOs']].concat(Object.values(groupBy(FD.rows(), function (x) { return x.d.ipoId; })).map(function (g) { return [g[0].ipo.id, g[0].ipo.name]; }));
    var html = '<div class="panel"><div class="panel-head"><div><h2>Reports</h2><p class="muted">Receivable from brokers, payable to investors and your net profit — by month, IPO, investor, broker and category.</p></div>' +
      '<div class="row"><label class="dl">Download <select id="rScope">' + FD.opts([['view', 'This view'], ['all', 'Full workbook (all views)']], 'view') + '</select></label><button class="primary" id="rX">Excel</button><button class="primary" id="rP">PDF</button></div></div>' +
      '<div class="filters"><label>Period <select id="rPer">' + FD.opts([['month', 'This month'], ['last3', 'Last 3 months'], ['fy', 'This FY'], ['lfy', 'Last FY'], ['all', 'All time'], ['custom', 'Custom']], st.period) + '</select></label>' +
      (st.period === 'custom' ? '<label>From <input type="date" id="rFrom" value="' + st.from + '"></label><label>To <input type="date" id="rTo" value="' + st.to + '"></label>' : '') +
      '<label>IPO <select id="rIpo">' + FD.opts(ipoOpts, st.ipo) + '</select></label>' +
      '<label>Investor <select id="rInv">' + FD.opts([['', 'All investors']].concat(FD.state.investors.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (i) { return [i.id, i.name]; })), st.inv) + '</select></label>' +
      '<label>Broker <select id="rBrk">' + FD.opts([['', 'All'], ['-', 'Not sold (own risk)']].concat(FD.state.brokers.map(function (b) { return [b.id, b.name]; })), st.brk) + '</select></label>' +
      '<label>Category <select id="rCat">' + FD.opts([['', 'All'], ['RETAIL', 'Retail'], ['SHNI', 'sHNI'], ['BHNI', 'bHNI']], st.cat) + '</select></label>' +
      '<label>Type <select id="rType">' + FD.opts([['', 'All'], ['Mainboard', 'Mainboard'], ['SME', 'SME']], st.type) + '</select></label>' +
      '<label>Status <select id="rSt">' + FD.opts([['', 'Any'], ['final', 'Final'], ['open', 'Awaiting result'], ['unsettled', 'Final, not settled']], st.status) + '</select></label></div>' +
      '<div class="tiles">' +
      '<div class="fact"><small>Applications</small><b>' + t.n + '</b><span class="hint">' + t.final + ' final · ' + t.open + ' open</span></div>' +
      '<div class="fact pos"><small>Realised profit</small><b>' + FD.signed(t.profit, false) + '</b><span class="hint">expected on open ' + FD.fmt(Math.round(t.expOpen)) + '</span></div>' +
      '<div class="fact"><small>Receivable from brokers</small><b>' + FD.fmt(Math.round(t.recvBrk)) + '</b><span class="hint">payable to brokers ' + FD.fmt(Math.round(t.payBrk)) + '</span></div>' +
      '<div class="fact"><small>Payable to investors</small><b>' + FD.fmt(Math.round(t.payInv)) + '</b><span class="hint">receivable from investors ' + FD.fmt(Math.round(t.recvInv)) + '</span></div>' +
      '<div class="fact"><small>Net cash still to settle</small><b>' + FD.signed(t.recvBrk - t.payBrk + t.recvInv - t.payInv) + '</b><span class="hint">+ means you will receive</span></div></div>' +
      '<nav class="tabs sub" id="rViews">' + VIEWS.map(function (v) { return '<button data-rv="' + v[0] + '"' + (st.view === v[0] ? ' class="on"' : '') + '>' + v[1] + '</button>'; }).join('') + '</nav>';
    if (!rs.length) html += '<div class="empty-state"><h3>No deals in this selection</h3><p>Change the period or filters, or book deals in the Deals tab.</p></div>';
    else html += '<div class="tbl max"><table><thead><tr>' + b.cols.map(function (c) { return '<th' + (c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? ' class="num"' : '') + '>' + c.h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      b.rows.map(function (r, ri) { return '<tr>' + r.map(function (v, ci) { var c = b.cols[ci]; var inner = cell(v, c.fmt); if (ci === 0 && b.link) inner = '<a href="#" class="go" data-ri="' + ri + '">' + inner + '</a>'; return '<td' + (c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? ' class="num"' : '') + '>' + inner + '</td>'; }).join('') + '</tr>'; }).join('') +
      (b.total ? '<tr class="tot">' + b.total.map(function (v, ci) { var c = b.cols[ci]; return '<td' + (c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? ' class="num"' : '') + '>' + (ci === 0 ? v : cell(v, c.fmt)) + '</td>'; }).join('') + '</tr>' : '') + '</tbody></table></div>';
    if (st.view === 'inv' && st.inv) html += investorStatement(st.inv, rs);
    html += '</div>';
    el.innerHTML = html;
    var $ = function (s) { return el.querySelector(s); };
    var bind = function (id, key) { var x = $(id); if (x) x.onchange = function () { st[key] = x.value; FD.renderReports(); }; };
    bind('#rPer', 'period'); bind('#rFrom', 'from'); bind('#rTo', 'to'); bind('#rIpo', 'ipo'); bind('#rInv', 'inv'); bind('#rBrk', 'brk'); bind('#rCat', 'cat'); bind('#rType', 'type'); bind('#rSt', 'status');
    el.querySelectorAll('[data-rv]').forEach(function (x) { x.onclick = function () { st.view = x.dataset.rv; FD.renderReports(); }; });
    el.querySelectorAll('[data-ri]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var l = b.link[+a.dataset.ri]; if (l.to === 'deals') FD.go('deals', l.id); else if (l.to === 'inv') { st.inv = l.id; st.view = 'inv'; FD.renderReports(); } else { st.brk = l.id; st.view = 'all'; FD.renderReports(); } }; });
    $('#rX').onclick = function () { exportX($('#rScope').value, rs); };
    $('#rP').onclick = function () { exportP($('#rScope').value, rs); };
  };

  function investorStatement(id, rs) {
    var inv = FD.investor(id) || {};
    var mine = rs.filter(function (x) { return x.d.investorId === id; });
    return '<h3 class="sec">Statement · ' + FD.esc(inv.name || '') + ' <span class="muted mono">' + FD.esc(inv.pan || '') + '</span></h3><div class="tbl"><table><thead><tr><th>IPO</th><th>Category</th><th>Deal</th><th>Allotment</th><th class="num">Listing P/L</th><th class="num">Investor ±</th><th>Settled</th></tr></thead><tbody>' +
      mine.map(function (x) { return '<tr><td>' + FD.esc(x.ipo.name) + '</td><td>' + FD.catPill(x.d.cat) + '</td><td>' + FD.dealTypeShort[x.d.buyType] + ' ₹' + (x.d.buyRate || 0) + '</td><td>' + { YES: 'Allotted ' + x.r.S, NO: 'Not allotted', PENDING: 'Pending' }[x.d.allot] + '</td><td class="num">' + (x.r.final ? FD.signed(x.r.L) : '—') + '</td><td class="num">' + (x.r.final ? FD.signed(x.r.invNet) : '—') + '</td><td>' + (x.d.invSettled ? FD.dt(x.d.invSettled) : (x.r.final ? '<span class="bad-txt">Open</span>' : '')) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  function exportX(scope, rs) {
    var views = scope === 'all' ? VIEWS : VIEWS.filter(function (v) { return v[0] === st.view; });
    var sheets = views.map(function (v) {
      var b = build(v[0], rs);
      return { name: v[1], title: v[1] + ' report', cols: b.cols.map(function (c) { return { h: c.h, fmt: c.fmt === 'amt' ? 'money' : (c.fmt || 'text'), w: c.h.length > 14 ? 18 : undefined }; }), rows: b.rows, total: b.total };
    });
    if (scope === 'all') {
      sheets.unshift({ name: 'Investors', title: 'Investor master', cols: [{ h: 'Name', w: 26 }, { h: 'PAN', w: 14 }, { h: 'Phone', w: 14 }, { h: 'Group' }, { h: 'Notes', w: 30 }, { h: 'Active' }],
        rows: FD.state.investors.map(function (i) { return [i.name, i.pan || '', i.phone || '', i.group || '', i.notes || '', i.active === false ? 'No' : 'Yes']; }) });
    }
    FD.excel('FinDeependence-IPO-Deal-Desk-' + (scope === 'all' ? 'workbook' : st.view) + '-' + FD.stamp() + '.xlsx', sheets);
  }
  function exportP(scope, rs) {
    var views = scope === 'all' ? VIEWS.filter(function (v) { return v[0] !== 'all'; }) : VIEWS.filter(function (v) { return v[0] === st.view; });
    var fmt = function (v, f) { if (v == null || v === '') return '-'; if (f === 'money' || f === 'amt') return FD.rs(v); if (f === 'pct') return (v * 100).toFixed(1) + '%'; if (f === 'int') return String(v); if (f === 'date') return FD.dt(v); return String(v).replace(/₹/g, 'Rs '); };
    FD.pdf('FinDeependence-IPO-Deal-Desk-' + (scope === 'all' ? 'report' : st.view) + '-' + FD.stamp() + '.pdf', 'IPO Deal Desk · Business report', views.map(function (v) {
      var b = build(v[0], rs);
      return { title: v[1], cols: b.cols.map(function (c) { return c.h; }), rows: b.rows.map(function (r) { return r.map(function (x, i) { return fmt(x, b.cols[i].fmt); }); }), total: b.total ? b.total.map(function (x, i) { return i === 0 ? String(x) : fmt(x, b.cols[i].fmt); }) : null, align: b.cols.map(function (c) { return c.fmt && c.fmt !== 'text' && c.fmt !== 'date' ? 'right' : null; }) };
    }));
  }
})();
