/* FinDeependence IPO Deal Desk · Deals: one row per investor (like the HNI IPO Ledger), click a category to apply,
   deal terms per IPO, allotment, broker, settlement. */
(function () {
  var FD = window.FD, C = FD.C;
  var view = { show: 'all', q: '', group: '' };
  var TYPES = [['KOSTAK', 'Kostak'], ['SUBJECT', 'Subject-to'], ['PREMIUM', 'Premium/sh'], ['NONE', 'Own']];

  FD.renderDeals = function () {
    var f = document.getElementById('dealFilter').value, q = document.getElementById('dealSearch').value.trim().toLowerCase();
    var cnt = {}; FD.state.deals.forEach(function (d) { cnt[d.ipoId] = (cnt[d.ipoId] || 0) + 1; });
    var unsettled = {}; FD.rows().forEach(function (x) { if (!x.r.final || (!x.d.invSettled && Math.abs(x.r.invNet) > 0.5) || (x.r.hedged && !x.d.brkSettled && Math.abs(x.r.brkNet) > 0.5)) unsettled[x.d.ipoId] = 1; });
    var list = FD.ipos().filter(function (i) {
      if (q && i.name.toLowerCase().indexOf(q) < 0) return false;
      if (f === 'mine') return cnt[i.id] || i.stage !== 'Listed';
      if (f === 'pending') return unsettled[i.id];
      return true;
    });
    if (!FD.sel.deal || !FD.ipo(FD.sel.deal)) FD.sel.deal = (list[0] || {}).id;
    var rail = document.getElementById('dealRail');
    rail.innerHTML = list.length ? list.map(function (i) {
      var n = cnt[i.id] || 0;
      return '<button class="ipo-btn' + (i.id === FD.sel.deal ? ' sel' : '') + '" data-id="' + i.id + '"><span class="nm">' + FD.esc(i.name) + ' ' + FD.stagePill(i.stage) + '</span>' +
        '<span class="nm">' + (i.type === 'SME' ? '<span class="pill SME">' + FD.esc(i.exchange || 'SME') + '</span>' : '') + '</span>' +
        '<span class="sub">' + FD.dt(i.openDate) + ' – ' + FD.dt(i.closeDate) + '</span>' +
        '<span class="sub">₹' + (C.price(i) || '—') + ' · Lot ' + (i.lotSize || '—') + (i.gmp != null ? ' · GMP ₹' + i.gmp : '') + ' · ' + (n ? n + ' applied' : 'none applied') + '</span></button>';
    }).join('') : '<p class="muted">Nothing here.</p>';
    rail.querySelectorAll('.ipo-btn').forEach(function (b) { b.onclick = function () { FD.sel.deal = b.dataset.id; FD.renderDeals(); }; });
    var fi = FD.feed; document.getElementById('dealInfo').textContent = 'IPO list checked ' + (fi.checkedAt ? ago(fi.checkedAt) : '—') + ' · NSE, ipopremium.in, investorgain.com';
    panel(FD.ipo(FD.sel.deal));
  };
  function ago(t) { var h = (Date.now() - new Date(t)) / 36e5; return h < 1 ? Math.max(1, Math.round(h * 60)) + ' min ago' : h < 48 ? Math.round(h) + ' h ago' : Math.round(h / 24) + ' days ago'; }

  // Deal terms for an IPO (what new applications get)
  function terms(i) {
    var t = (FD.state.terms = FD.state.terms || {})[i.id];
    if (!t) t = { buyType: FD.state.settings.defaults.buyType, buyRate: {}, brokerId: '', sellType: FD.state.settings.defaults.sellType, sellRate: {} };
    return t;
  }
  function saveTerms(i, t) { FD.state.terms = FD.state.terms || {}; FD.state.terms[i.id] = t; FD.save(true); }

  function panel(i) {
    var el = document.getElementById('dealPanel');
    if (!i) { el.innerHTML = '<div class="empty-state"><h3>Pick an IPO</h3></div>'; return; }
    var rows = FD.rows(function (x) { return x.d.ipoId === i.id; });
    var byInv = {}; rows.forEach(function (x) { byInv[x.d.investorId] = x; });
    var t = FD.sum(rows), r = C.lotRules(i), T = terms(i);
    var o = {}; C.CATS.forEach(function (c) { o[c] = C.opportunity(i, c, FD.state.settings.factors, FD.state.settings.marginPct); });
    var lp = i.settlePrice != null ? i.settlePrice : i.listingPrice;

    var html = '<div class="panel-head"><div><h2>' + FD.esc(i.name) + ' ' + FD.stagePill(i.stage) + '</h2>' +
      '<p class="muted" style="margin:6px 0 0">' + [i.symbol, i.exchange || i.type, FD.dt(i.openDate) + ' to ' + FD.dt(i.closeDate), 'Listing ' + FD.dt(i.listingDate)].filter(Boolean).map(FD.esc).join(' · ') + '</p></div>' +
      '<div class="row"><button id="dlXls">Excel</button><button id="dlPdf">PDF</button><button id="dlIpo">IPO details</button></div></div>';
    if (!C.price(i) || !i.lotSize) html += '<div class="notice row"><span class="grow">Price or lot size is missing for this IPO.</span><button id="fixIpo">Fill it in</button></div>';
    html += '<div class="facts">' +
      fact('Price band', i.priceLow && i.priceLow !== i.priceHigh ? '₹' + i.priceLow + ' – ₹' + i.priceHigh : (i.priceHigh ? '₹' + i.priceHigh : '—')) +
      fact('Lot size', i.lotSize ? i.lotSize.toLocaleString('en-IN') + ' sh' : '—') +
      fact('GMP', i.gmp == null ? '—' : '₹' + i.gmp, i.gmp != null && i.priceHigh ? FD.pct(i.gmp / i.priceHigh) : '', 'pos') +
      catFact('RETAIL', 'retail', o.RETAIL, r) + catFact('SHNI', 'shni', o.SHNI, r) + catFact('BHNI', 'bhni', o.BHNI, r) +
      '<label class="fact"><small>Listing / settle ₹</small><input id="dlSettle" class="rate" type="number" step="any" value="' + (lp == null ? '' : lp) + '" placeholder="' + (i.gmp != null && i.priceHigh ? 'GMP ' + (i.priceHigh + i.gmp) : 'price') + '"></label>' +
      '</div>';

    // Deal terms
    var brokers = [['', 'Keep the risk']].concat(FD.state.brokers.map(function (b) { return [b.id, b.name]; })).concat([['__new', '+ New broker']]);
    var rateIn = function (side, c) {
      var v = (side === 'buy' ? T.buyRate : T.sellRate)[c];
      var ph = side === 'buy' ? (T.buyType === 'KOSTAK' ? o[c].bidKostak : T.buyType === 'SUBJECT' ? o[c].bidSubject : T.buyType === 'PREMIUM' ? i.gmp : null) : null;
      return '<label class="tl ' + c.toLowerCase() + '">' + C.CAT_LABEL[c] + ' ₹<input class="rate" data-t="' + side + 'Rate" data-c="' + c + '" type="number" step="any" value="' + (v == null ? '' : v) + '"' + (ph != null ? ' placeholder="' + ph + '"' : '') + '></label>';
    };
    html += '<div class="terms"><div class="trow"><span class="lbl">Investor gets</span><select data-t="buyType">' + FD.opts(TYPES, T.buyType) + '</select>' + (T.buyType === 'NONE' ? '' : C.CATS.map(function (c) { return rateIn('buy', c); }).join('')) + '</div>' +
      '<div class="trow"><span class="lbl">Sold to</span><select data-t="brokerId">' + FD.opts(brokers, T.brokerId || '') + '</select>' +
      (T.brokerId ? '<select data-t="sellType">' + FD.opts(TYPES.slice(0, 3), T.sellType) + '</select>' + C.CATS.map(function (c) { return rateIn('sell', c); }).join('') : '') + '</div>' +
      '<div class="trow"><span class="muted small grow">New applications get these terms.</span>' + (rows.length ? '<button id="tApply">Apply to all ' + rows.length + ' applied</button>' : '') + '</div></div>';

    // Investor rows
    var invs = FD.state.investors.filter(function (x) { return x.active !== false || byInv[x.id]; });
    var groups = Array.from(new Set(FD.state.investors.map(function (x) { return x.group || ''; }).filter(Boolean))).sort();
    var shown = invs.filter(function (x) {
      if (view.show === 'applied' && !byInv[x.id]) return false;
      if (view.group && x.group !== view.group) return false;
      if (view.q && (x.name + ' ' + (x.pan || '')).toLowerCase().indexOf(view.q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (byInv[b.id] ? 1 : 0) - (byInv[a.id] ? 1 : 0) || a.name.localeCompare(b.name); });
    html += '<div class="row tools"><input type="search" id="dQ" placeholder="Search name or PAN" value="' + FD.esc(view.q) + '">' +
      (groups.length ? '<select id="dG"><option value="">All groups</option>' + FD.opts(groups, view.group) + '</select>' : '') +
      '<select id="dShow">' + FD.opts([['all', 'All investors'], ['applied', 'Applied only']], view.show) + '</select><span class="grow"></span>' +
      (rows.length ? '<button id="pasteAllot">Paste allotted PANs</button><button id="allNo">Pending → Not allotted</button><button id="allSet">Mark all settled</button>' : '') + '</div>';
    if (!FD.state.investors.length) {
      html += '<div class="empty-state"><h3>No investors yet</h3><p>Add names and PANs once; they appear here for every IPO.</p><button class="primary" id="goPeople">Add investors</button></div>';
    } else {
      html += '<div class="tbl"><table id="dealTbl"><thead><tr><th class="num">#</th><th>Investor</th><th>Category</th><th>Investor deal</th><th>Broker deal</th><th>Allotment</th><th class="num">Profit</th><th></th></tr></thead><tbody>' +
        shown.map(function (inv, k) { return rowHtml(inv, byInv[inv.id], k + 1, i); }).join('') +
        '<tr class="tot"><td></td><td>Total · ' + t.n + ' applied</td><td>' + t.cats.RETAIL + ' Retail · ' + t.cats.SHNI + ' sHNI · ' + t.cats.BHNI + ' bHNI</td><td>' + FD.fmt(Math.round(sumF(rows, 'Di'))) + '<br><span class="small muted">investor ' + FD.signed(sumF(rows, 'invNet'), false) + '</span></td><td>' + FD.fmt(Math.round(sumF(rows, 'Db'))) + '<br><span class="small muted">broker ' + FD.signed(sumF(rows, 'brkNet'), false) + '</span></td><td>' + (t.decided ? t.allotted + ' of ' + t.decided + ' allotted' : '') + '</td><td class="num">' + FD.signed(sumF(rows, 'profit')) + '</td><td></td></tr>' +
        '</tbody></table></div>';
    }
    html += settlement(i, rows);
    el.innerHTML = html;
    wire(el, i, rows, byInv);
  }
  function fact(l, v, hint, cls) { return '<div class="fact ' + (cls || '') + '"><small>' + l + '</small><b>' + v + '</b>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; }
  function catFact(c, cls, op, r) {
    return '<div class="fact ' + cls + '"><small>' + C.CAT_LABEL[c] + ' · ' + (r[c] || '—') + (r[c] === 1 ? ' lot' : ' lots') + '</small><b>' + FD.oneIn(op.p) + '</b><span class="hint">' + FD.fmt(op.blockAmount) + (op.expected != null ? ' · EV ' + FD.fmt(Math.round(op.expected)) : '') + '</span></div>';
  }
  function sumF(rows, k) { return rows.reduce(function (s, x) { var v = x.r.final ? x.r[k] : (x.r.exp ? x.r.exp[k] : 0); return s + (v || 0); }, 0); }

  function rowHtml(inv, x, n, i) {
    var cat = x ? x.d.cat : '';
    var seg = '<span class="seg">' + [['', 'None'], ['RETAIL', 'Retail'], ['SHNI', 'sHNI'], ['BHNI', 'bHNI']].map(function (c) { return '<button data-cat="' + c[0] + '"' + (cat === c[0] ? ' class="on"' : '') + '>' + c[1] + '</button>'; }).join('') + '</span>';
    var head = '<td class="num muted">' + n + '</td><td><b>' + FD.esc(inv.name) + '</b>' + (inv.pan ? '<br><span class="muted small mono">' + FD.esc(inv.pan) + '</span>' : '') + '</td><td>' + seg + (x ? '<div class="sub2"><input class="lots" data-f="lots" type="number" min="1" value="' + (x.d.lots || C.lotRules(i)[x.d.cat] || '') + '"> lots</div>' : '') + '</td>';
    if (!x) return '<tr class="none-row" data-inv="' + inv.id + '">' + head + '<td>–</td><td>–</td><td>–</td><td class="num">–</td><td></td></tr>';
    var d = x.d, r = x.r, f = r.final, e = r.exp || {};
    var val = function (k) { return f ? FD.signed(r[k]) : (r.exp ? '<span class="exp">' + FD.signed(e[k], false) + '</span>' : '–'); };
    var brokers = [['', '—']].concat(FD.state.brokers.map(function (b) { return [b.id, b.name]; }));
    return '<tr class="c-' + d.cat + '" data-inv="' + inv.id + '" data-id="' + d.id + '">' + head +
      '<td><span class="pair"><select data-f="buyType">' + FD.opts(TYPES, d.buyType) + '</select>' + (d.buyType === 'NONE' ? '' : '<input class="rate" data-f="buyRate" type="number" step="any" value="' + (d.buyRate == null ? '' : d.buyRate) + '">') + '</span></td>' +
      '<td><select class="bsel" data-f="brokerId">' + FD.opts(brokers, d.brokerId || '') + '</select>' + (d.brokerId ? '<div class="sub2 pair"><select data-f="sellType">' + FD.opts(TYPES.slice(0, 3), d.sellType || 'KOSTAK') + '</select><input class="rate" data-f="sellRate" type="number" step="any" value="' + (d.sellRate == null ? '' : d.sellRate) + '"></div>' : '') + '</td>' +
      '<td><span class="seg al">' + [['PENDING', '?'], ['YES', 'Yes'], ['NO', 'No']].map(function (a) { return '<button data-al="' + a[0] + '"' + ((d.allot || 'PENDING') === a[0] ? ' class="on"' : '') + '>' + a[1] + '</button>'; }).join('') + '</span>' +
      (d.allot === 'YES' ? ' <input class="lots" data-f="shares" type="number" value="' + (d.shares == null ? r.unit : d.shares) + '" title="Shares allotted">' : '') + '</td>' +
      '<td class="num"><b>' + val('profit') + '</b><div class="sub2 small">Investor ' + val('invNet') + (r.hedged ? '<br>Broker ' + val('brkNet') : '') + '</div></td>' +
      '<td class="nowrap small">' + (f ? '<label title="Investor settled"><input type="checkbox" data-f="invSettled"' + (d.invSettled ? ' checked' : '') + '> Inv</label>' + (r.hedged ? '<br><label title="Broker settled"><input type="checkbox" data-f="brkSettled"' + (d.brkSettled ? ' checked' : '') + '> Brk</label>' : '') + '<br>' : '') +
      '<button class="mini" data-msg="' + d.id + '" title="Copy WhatsApp message">Msg</button></td></tr>';
  }

  function settlement(i, rows) {
    var fin = rows.filter(function (x) { return x.r.final; });
    if (!fin.length) return '';
    var byB = {}, byI = {};
    fin.forEach(function (x) {
      var ii = byI[x.d.investorId] = byI[x.d.investorId] || { n: 0, net: 0, open: 0 };
      ii.n++; ii.net += x.r.invNet; if (!x.d.invSettled) ii.open += x.r.invNet;
      if (x.r.hedged) { var b = byB[x.d.brokerId] = byB[x.d.brokerId] || { n: 0, Db: 0, L: 0, net: 0, open: 0 }; b.n++; b.Db += x.r.Db; b.L += x.r.A ? x.r.L : 0; b.net += x.r.brkNet; if (!x.d.brkSettled) b.open += x.r.brkNet; }
    });
    var h = '<h3 class="sec">Settlement sheet</h3><div class="grid2"><div class="tbl"><table><thead><tr><th>Broker</th><th class="num">Apps</th><th class="num">Deal amount</th><th class="num">Listing P/L</th><th class="num">Net</th><th class="num">Open</th><th></th></tr></thead><tbody>' +
      (Object.keys(byB).length ? Object.keys(byB).map(function (k) { var b = byB[k]; return '<tr><td>' + FD.esc(FD.brkName(k)) + '</td><td class="num">' + b.n + '</td><td class="num">' + FD.fmt(Math.round(b.Db)) + '</td><td class="num">' + FD.signed(b.L, false) + '</td><td class="num">' + FD.signed(b.net) + '</td><td class="num">' + (Math.abs(b.open) > 0.5 ? (b.open > 0 ? 'Get ' : 'Pay ') + FD.fmt(Math.round(Math.abs(b.open))) : '<span class="ok-txt">Settled</span>') + '</td><td class="nowrap"><button class="sel-sm" data-bmsg="' + k + '">Msg</button> ' + (Math.abs(b.open) > 0.5 ? '<button class="sel-sm" data-bset="' + k + '">Mark settled</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="muted">No broker deals in this IPO.</td></tr>') +
      '</tbody></table></div><div class="tbl" style="max-height:340px;overflow:auto"><table><thead><tr><th>Investor</th><th class="num">Net</th><th class="num">Open</th><th></th></tr></thead><tbody>' +
      Object.keys(byI).sort(function (a, b) { return FD.invName(a).localeCompare(FD.invName(b)); }).map(function (k) { var v = byI[k]; return '<tr><td>' + FD.esc(FD.invName(k)) + '</td><td class="num">' + FD.signed(v.net) + '</td><td class="num">' + (Math.abs(v.open) > 0.5 ? (v.open > 0 ? 'Get ' : 'Pay ') + FD.fmt(Math.round(Math.abs(v.open))) : '<span class="ok-txt">Settled</span>') + '</td><td>' + (Math.abs(v.open) > 0.5 ? '<button class="sel-sm" data-iset="' + k + '">Mark settled</button>' : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    return h;
  }

  function msgFor(x) {
    var inv = FD.investor(x.d.investorId) || { name: '' }, r = x.r, ipo = x.ipo;
    var lines = ['*' + ipo.name + ' IPO* · FinDeependence', 'Dear ' + inv.name + ','];
    if (x.d.allot === 'NO') lines.push('Not allotted this time.');
    else if (x.d.allot === 'YES') lines.push('Allotted: ' + r.S + ' shares at ₹' + r.issue + '. Settlement price ₹' + (r.sellPx == null ? '—' : r.sellPx) + ' → listing P/L ' + C.inr(Math.round(r.L || 0)) + '.');
    else lines.push('Allotment result awaited.');
    if (x.d.buyType !== 'NONE') lines.push('Your deal: ' + FD.dealTypeShort[x.d.buyType] + ' ₹' + (x.d.buyRate || 0) + (x.d.buyType === 'PREMIUM' ? '/share' : '') + ' → your amount ' + C.inr(Math.round(r.Di)) + '.');
    if (r.final) lines.push(r.invNet > 0.5 ? 'Please transfer *' + C.inr(Math.round(r.invNet)) + '* (listing P/L less your amount).' : r.invNet < -0.5 ? 'I will pay you *' + C.inr(Math.round(-r.invNet)) + '*.' : 'Nothing to settle.');
    lines.push('— CA Deep Dalal');
    return lines.join('\n');
  }
  function brokerMsg(i, bid, rows) {
    var b = FD.broker(bid) || { name: '' };
    var rs = rows.filter(function (x) { return x.d.brokerId === bid && x.r.final; });
    var net = rs.reduce(function (s, x) { return s + x.r.brkNet; }, 0);
    var lines = ['*' + i.name + ' IPO* · FinDeependence', 'Dear ' + b.name + ',', rs.length + ' applications: ' + rs.filter(function (x) { return x.r.A; }).length + ' allotted.'];
    rs.forEach(function (x) { lines.push('• ' + FD.invName(x.d.investorId) + ' (' + C.CAT_LABEL[x.d.cat] + '): ' + (x.r.A ? x.r.S + ' sh, P/L ' + C.inr(Math.round(x.r.L)) : 'not allotted') + ', deal ' + C.inr(Math.round(x.r.Db)) + ' → ' + (x.r.brkNet >= 0 ? 'you pay ' : 'I pay ') + C.inr(Math.round(Math.abs(x.r.brkNet)))); });
    lines.push(net >= 0 ? 'Net: please pay *' + C.inr(Math.round(net)) + '*.' : 'Net: I will pay *' + C.inr(Math.round(-net)) + '*.');
    lines.push('— CA Deep Dalal');
    return lines.join('\n');
  }
  function copy(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { FD.toast('Message copied — paste it in WhatsApp'); }, function () {
      FD.modal('<h2>Message</h2><textarea readonly>' + FD.esc(text) + '</textarea><div class="row" style="justify-content:flex-end"><button data-close>Close</button></div>');
    });
  }


  function newDeal(i, invId, cat, T) {
    var br = T.brokerId || null;
    return { id: FD.uid('d-'), ipoId: i.id, investorId: invId, cat: cat, lots: null, buyType: T.buyType, buyRate: T.buyRate[cat] == null ? null : T.buyRate[cat],
      brokerId: br, sellType: br ? T.sellType : null, sellRate: br && T.sellRate[cat] != null ? T.sellRate[cat] : null,
      allot: 'PENDING', shares: null, invSettled: '', brkSettled: '', note: '', createdAt: new Date().toISOString(), ipoSnap: FD.snap(i) };
  }
  function applyTerms(d, T) {
    d.buyType = T.buyType; d.buyRate = T.buyRate[d.cat] == null ? null : T.buyRate[d.cat];
    d.brokerId = T.brokerId || null; d.sellType = d.brokerId ? T.sellType : null; d.sellRate = d.brokerId && T.sellRate[d.cat] != null ? T.sellRate[d.cat] : null;
  }

  function wire(el, i, rows, byInv) {
    var $ = function (s) { return el.querySelector(s); };
    var byId = {}; rows.forEach(function (x) { byId[x.d.id] = x; });
    var done = function () { FD.save(); FD.renderDeals(); };
    $('#dlIpo').onclick = function () { FD.go('ipos', i.id); };
    $('#dlXls').onclick = function () { FD.exportIpo(i, 'xlsx'); };
    $('#dlPdf').onclick = function () { FD.exportIpo(i, 'pdf'); };
    if ($('#fixIpo')) $('#fixIpo').onclick = function () { FD.editIpo(i); };
    if ($('#goPeople')) $('#goPeople').onclick = function () { FD.go('people'); };
    $('#dlSettle').onchange = function (e) {
      var v = e.target.value === '' ? null : +e.target.value;
      if (v != null && i.listingPrice == null) FD.setIpoEdit(i.id, { listingPrice: v, gmpBeforeListing: FD.lastGmpBefore(i) != null ? FD.lastGmpBefore(i) : i.gmp });
      else if (v == null) FD.setIpoEdit(i.id, { settlePrice: null, listingPrice: null });
      else FD.setIpoEdit(i.id, { settlePrice: v === i.listingPrice ? null : v });
      FD.invalidate(); FD.renderDeals(); FD.toast('Listing price saved');
    };
    // terms
    var T = JSON.parse(JSON.stringify(terms(i)));
    el.querySelectorAll('[data-t]').forEach(function (inp) {
      inp.onchange = function () {
        var k = inp.dataset.t, v = inp.value;
        if (k === 'brokerId' && v === '__new') {
          var name = prompt('Broker name'); if (!name || !name.trim()) { inp.value = T.brokerId || ''; return; }
          var b = { id: FD.uid('b-'), name: name.trim(), createdAt: new Date().toISOString() }; FD.state.brokers.push(b); v = b.id;
        }
        if (k === 'buyRate' || k === 'sellRate') T[k][inp.dataset.c] = v === '' ? null : +v; else T[k] = v;
        saveTerms(i, T); FD.renderDeals();
      };
    });
    if ($('#tApply')) $('#tApply').onclick = function () { rows.forEach(function (x) { applyTerms(x.d, T); }); done(); FD.toast('Terms applied to ' + rows.length + ' applications'); };
    // filters
    $('#dQ').oninput = function (e) { view.q = e.target.value.toLowerCase(); var p = e.target.selectionStart; FD.renderDeals(); var n = document.getElementById('dQ'); n.focus(); n.setSelectionRange(p, p); };
    if ($('#dG')) $('#dG').onchange = function (e) { view.group = e.target.value; FD.renderDeals(); };
    $('#dShow').onchange = function (e) { view.show = e.target.value; FD.renderDeals(); };
    var tbl = $('#dealTbl');
    if (tbl) {
      tbl.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var tr = b.closest('tr[data-inv]'); if (!tr) return;
        var x = byInv[tr.dataset.inv];
        if (b.dataset.cat != null && b.closest('.seg') && !b.dataset.al) {
          var c = b.dataset.cat;
          if (!c) {
            if (!x) return;
            var del = function () { FD.state.deals = FD.state.deals.filter(function (d) { return d.id !== x.d.id; }); done(); };
            if (x.d.allot !== 'PENDING' || x.d.invSettled) FD.confirm('Remove ' + FD.esc(FD.invName(x.d.investorId)) + ' from this IPO? Its result is already recorded.', del, 'Remove'); else del();
          } else if (!x) { FD.state.deals.push(newDeal(i, tr.dataset.inv, c, T)); done(); }
          else if (x.d.cat !== c) { x.d.cat = c; x.d.lots = null; x.d.shares = null; if (T.buyRate[c] != null) x.d.buyRate = T.buyRate[c]; if (x.d.brokerId && T.sellRate[c] != null) x.d.sellRate = T.sellRate[c]; done(); }
          return;
        }
        if (b.dataset.al && x) { x.d.allot = b.dataset.al; if (x.d.allot !== 'YES') x.d.shares = null; done(); }
        if (b.dataset.msg) copy(msgFor(byId[b.dataset.msg]));
      });
      tbl.addEventListener('change', function (e) {
        var tr = e.target.closest('tr[data-id]'), k = e.target.dataset.f; if (!tr || !k) return;
        var d = byId[tr.dataset.id].d, v = e.target.type === 'checkbox' ? (e.target.checked ? FD.today() : '') : e.target.value;
        if (/Rate$|^shares$|^lots$/.test(k)) v = v === '' ? null : +v;
        if (k === 'lots' && v != null) { var mn = C.lotRules(i)[d.cat]; if (mn && v < mn) { FD.toast('Minimum for ' + C.CAT_LABEL[d.cat] + ' is ' + mn + ' lots', true); v = mn; } }
        if (k === 'brokerId') { v = v || null; if (v) { d.sellType = d.sellType || T.sellType; if (d.sellRate == null && T.sellRate[d.cat] != null) d.sellRate = T.sellRate[d.cat]; } else { d.sellType = null; d.sellRate = null; } }
        d[k] = v; done();
      });
    }
    if ($('#allNo')) $('#allNo').onclick = function () { var n = 0; rows.forEach(function (x) { if (x.d.allot === 'PENDING') { x.d.allot = 'NO'; n++; } }); done(); FD.toast(n + ' marked not allotted'); };
    if ($('#allSet')) $('#allSet').onclick = function () { var n = 0; rows.forEach(function (x) { if (x.r.final) { if (!x.d.invSettled) { x.d.invSettled = FD.today(); n++; } if (x.r.hedged && !x.d.brkSettled) x.d.brkSettled = FD.today(); } }); done(); FD.toast(n ? n + ' marked settled' : 'Nothing final to settle yet'); };
    if ($('#pasteAllot')) $('#pasteAllot').onclick = function () { pasteAllot(rows, done); };
    el.querySelectorAll('[data-bmsg]').forEach(function (b) { b.onclick = function () { copy(brokerMsg(i, b.dataset.bmsg, rows)); }; });
    el.querySelectorAll('[data-bset]').forEach(function (b) { b.onclick = function () { rows.forEach(function (x) { if (x.d.brokerId === b.dataset.bset && x.r.final) x.d.brkSettled = x.d.brkSettled || FD.today(); }); done(); }; });
    el.querySelectorAll('[data-iset]').forEach(function (b) { b.onclick = function () { rows.forEach(function (x) { if (x.d.investorId === b.dataset.iset && x.r.final) x.d.invSettled = x.d.invSettled || FD.today(); }); done(); }; });
  }

  function pasteAllot(rows, done) {
    FD.modal('<h2>Paste allotment results</h2><p class="muted">Paste the PANs or names that <b>got allotment</b> (one per line, or copied from the registrar / an Excel column). Optional: add the shares after a comma, e.g. <span class="mono">ABCDE1234F, 100</span>.</p>' +
      '<textarea id="paTxt" placeholder="ABCDE1234F&#10;Yash Shah, 100"></textarea><label class="row" style="margin:8px 0"><input type="checkbox" id="paRest" checked> Mark everyone else in this IPO as <b>Not allotted</b></label><p class="small" id="paOut"></p>' +
      '<div class="row" style="justify-content:flex-end"><button data-close>Cancel</button><button class="primary" id="paOk">Apply</button></div>',
    function (b, close) {
      var match = function () {
        var lines = b.querySelector('#paTxt').value.split(/\n|;/).map(function (s) { return s.trim(); }).filter(Boolean);
        var hits = {}, miss = [];
        lines.forEach(function (ln) {
          var m = ln.match(/^(.*?)(?:[,\t]\s*(\d+))?\s*$/), key = (m[1] || '').trim().toUpperCase(), sh = m[2] ? +m[2] : null;
          var panM = key.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
          var x = rows.find(function (r) { var inv = FD.investor(r.d.investorId) || {}; return (panM && (inv.pan || '').toUpperCase() === panM[0]) || (!panM && inv.name && inv.name.toUpperCase() === key); });
          if (x) hits[x.d.id] = sh; else miss.push(ln);
        });
        return { hits: hits, miss: miss };
      };
      b.querySelector('#paTxt').oninput = function () { var r = match(); b.querySelector('#paOut').innerHTML = '<span class="ok-txt">' + Object.keys(r.hits).length + ' matched</span>' + (r.miss.length ? ' · <span class="bad-txt">not found: ' + FD.esc(r.miss.slice(0, 6).join(', ')) + (r.miss.length > 6 ? '…' : '') + '</span>' : ''); };
      b.querySelector('#paOk').onclick = function () {
        var r = match(), rest = b.querySelector('#paRest').checked;
        rows.forEach(function (x) {
          if (x.d.id in r.hits) { x.d.allot = 'YES'; if (r.hits[x.d.id]) x.d.shares = r.hits[x.d.id]; }
          else if (rest && x.d.allot === 'PENDING') x.d.allot = 'NO';
        });
        close(); done(); FD.toast(Object.keys(r.hits).length + ' marked allotted');
      };
    });
  }

  // Export one IPO's settlement sheet
  FD.exportIpo = function (i, kind) {
    var rows = FD.rows(function (x) { return x.d.ipoId === i.id; }).sort(function (a, b) { return FD.invName(a.d.investorId).localeCompare(FD.invName(b.d.investorId)); });
    var v = function (x, k) { return x.r.final ? x.r[k] : (x.r.exp ? x.r.exp[k] : null); };
    var data = rows.map(function (x) {
      var inv = FD.investor(x.d.investorId) || {};
      return [inv.name || '', inv.pan || '', C.CAT_LABEL[x.d.cat], FD.dealTypeShort[x.d.buyType] + (x.d.buyType !== 'NONE' ? ' ' + (x.d.buyRate || 0) : ''), x.d.brokerId ? FD.brkName(x.d.brokerId) + ' · ' + FD.dealTypeShort[x.d.sellType] + ' ' + (x.d.sellRate || 0) : '', { YES: 'Allotted', NO: 'Not allotted', PENDING: 'Pending' }[x.d.allot], x.r.A ? x.r.S : 0, v(x, 'L'), v(x, 'Di'), v(x, 'Db'), v(x, 'invNet'), v(x, 'brkNet'), v(x, 'profit'), x.r.final ? 'Final' : 'Expected', x.d.invSettled || '', x.d.brkSettled || ''];
    });
    var tot = function (k) { return rows.reduce(function (s, x) { return s + (v(x, k) || 0); }, 0); };
    var cols = ['Investor', 'PAN', 'Category', 'Investor deal', 'Broker deal', 'Allotment', 'Shares', 'Listing P/L', 'To investor (deal)', 'From broker (deal)', 'Investor ± (+ receive)', 'Broker ± (+ receive)', 'My profit', 'Status', 'Investor settled', 'Broker settled'];
    var title = i.name + ' IPO · Settlement sheet';
    var file = 'FinDeependence-' + i.name.replace(/[^A-Za-z0-9]+/g, '-') + '-settlement-' + FD.stamp();
    if (kind === 'xlsx') {
      FD.excel(file + '.xlsx', [{ name: 'Settlement', title: title + ' · Issue ₹' + C.price(i) + ' · Settlement ₹' + (i.settlePrice != null ? i.settlePrice : (i.listingPrice || '—')),
        cols: cols.map(function (h, k) { return { h: h, fmt: k >= 7 && k <= 12 ? 'money' : k === 6 ? 'int' : 'text', w: k === 0 ? 22 : k === 4 ? 26 : undefined }; }),
        rows: data, total: ['Total', '', '', '', '', '', '', tot('L'), tot('Di'), tot('Db'), tot('invNet'), tot('brkNet'), tot('profit')] }]);
    } else {
      FD.pdf(file + '.pdf', title, [{ title: 'Issue Rs ' + C.price(i) + ' · Lot ' + (i.lotSize || '-') + ' · Settlement price Rs ' + (i.settlePrice != null ? i.settlePrice : (i.listingPrice || '-')),
        cols: ['Investor', 'PAN', 'Cat', 'Investor deal', 'Broker deal', 'Allotment', 'Sh', 'Listing P/L', 'Investor +/-', 'Broker +/-', 'My profit'],
        rows: data.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], FD.rs(r[7]), FD.rs(r[10]), FD.rs(r[11]), FD.rs(r[12]) + (r[13] === 'Expected' ? '*' : '')]; }),
        total: ['Total', '', '', '', '', '', '', FD.rs(tot('L')), FD.rs(tot('invNet')), FD.rs(tot('brkNet')), FD.rs(tot('profit'))], align: [null, null, null, null, null, null, 'right', 'right', 'right', 'right', 'right'] }]);
    }
  };
})();
