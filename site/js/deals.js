/* FinDeependence IPO Deal Desk · Deals: book applications per IPO, allotment, broker hedges, settlement. */
(function () {
  var FD = window.FD, C = FD.C;
  var picked = {}; // selected deal ids
  var addOpen = null;

  FD.renderDeals = function () {
    var f = document.getElementById('dealFilter').value, q = document.getElementById('dealSearch').value.trim().toLowerCase();
    var cnt = {}; FD.state.deals.forEach(function (d) { cnt[d.ipoId] = (cnt[d.ipoId] || 0) + 1; });
    var unsettled = {}; FD.rows().forEach(function (x) { if (!x.r.final || (!x.d.invSettled && Math.abs(x.r.invNet) > 0.5) || (x.r.hedged && !x.d.brkSettled && Math.abs(x.r.brkNet) > 0.5)) unsettled[x.d.ipoId] = 1; });
    var list = FD.ipos().filter(function (i) {
      if (q && i.name.toLowerCase().indexOf(q) < 0) return false;
      if (f === 'mine') return cnt[i.id] || i.stage === 'Open' || i.stage === 'Upcoming';
      if (f === 'pending') return unsettled[i.id];
      return true;
    });
    if (!FD.sel.deal || !FD.ipo(FD.sel.deal)) FD.sel.deal = (list.find(function (i) { return cnt[i.id]; }) || list[0] || {}).id;
    var rail = document.getElementById('dealRail');
    rail.innerHTML = list.length ? list.map(function (i) {
      var n = cnt[i.id] || 0;
      return '<button class="ipo-btn' + (i.id === FD.sel.deal ? ' sel' : '') + '" data-id="' + i.id + '"><span class="nm">' + FD.esc(i.name) + ' ' + FD.stagePill(i.stage) + '</span><span class="sub">' + (n ? n + ' application' + (n > 1 ? 's' : '') : 'No deals yet') + (unsettled[i.id] && n ? ' · open items' : '') + ' · lists ' + FD.dt(i.listingDate) + '</span></button>';
    }).join('') : '<p class="muted">Nothing here.</p>';
    rail.querySelectorAll('.ipo-btn').forEach(function (b) { b.onclick = function () { FD.sel.deal = b.dataset.id; picked = {}; addOpen = null; FD.renderDeals(); }; });
    panel(FD.ipo(FD.sel.deal));
  };

  function panel(i) {
    var el = document.getElementById('dealPanel');
    if (!i) { el.innerHTML = '<div class="empty-state"><h3>Pick an IPO</h3></div>'; return; }
    var rows = FD.rows(function (x) { return x.d.ipoId === i.id; });
    rows.sort(function (a, b) { return FD.invName(a.d.investorId).localeCompare(FD.invName(b.d.investorId)); });
    var t = FD.sum(rows), allFinal = rows.length && t.final === rows.length;
    var lp = i.settlePrice != null ? i.settlePrice : i.listingPrice;
    var html = '<div class="panel-head"><div><h2>' + FD.esc(i.name) + ' ' + FD.stagePill(i.stage) + ' ' + FD.typePill(i) + '</h2>' +
      '<p class="muted" style="margin:4px 0 0">Issue ₹' + (C.price(i) || '—') + ' · Lot ' + (i.lotSize || '—') + ' · GMP ' + (i.gmp == null ? '—' : '₹' + i.gmp) + ' · Allotment ' + FD.dt(i.allotmentDate) + ' · Listing ' + FD.dt(i.listingDate) + '</p></div>' +
      '<div class="row"><label class="dl">Settlement price ₹ <input class="rate" id="dlSettle" type="number" step="any" value="' + (lp == null ? '' : lp) + '" placeholder="listing"></label>' +
      '<button id="dlIpo">IPO details</button><button id="dlXls">Excel</button><button id="dlPdf">PDF</button></div></div>';
    if (!C.price(i) || !i.lotSize) html += '<div class="notice">Issue price or lot size is missing for this IPO. <button id="fixIpo">Fill it in</button></div>';
    html += '<div class="tiles">' +
      tile('Applications', t.n, 'Retail ' + t.cats.RETAIL + ' · sHNI ' + t.cats.SHNI + ' · bHNI ' + t.cats.BHNI + ' · hedged ' + t.hedged) +
      tile('Allotted', t.decided ? t.allotted + ' / ' + t.decided : '—', t.decided < t.n ? (t.n - t.decided) + ' pending' : 'all results in', 'AL-ALLOTTED') +
      tile(allFinal ? 'Net profit' : 'Expected profit', !allFinal && t.open && !t.expKnown ? '—' : FD.signed(allFinal ? t.profit : t.expProfit), allFinal ? 'realised' : (t.open && !t.expKnown ? 'add subscription in IPO details · ' : '') + t.final + ' of ' + t.n + ' final · flat listing ' + FD.fmt(Math.round(t.worst + t.profit)), (allFinal ? t.profit : t.expProfit) >= 0 ? 'pos' : 'neg') +
      tile('Investors', t.payInv || t.recvInv ? (t.payInv ? 'Pay ' + FD.fmt(Math.round(t.payInv)) : '') + (t.recvInv ? (t.payInv ? ' · ' : '') + 'Get ' + FD.fmt(Math.round(t.recvInv)) : '') : '—', 'unsettled balances') +
      tile('Brokers', t.payBrk || t.recvBrk ? (t.recvBrk ? 'Get ' + FD.fmt(Math.round(t.recvBrk)) : '') + (t.payBrk ? (t.recvBrk ? ' · ' : '') + 'Pay ' + FD.fmt(Math.round(t.payBrk)) : '') : '—', 'unsettled balances') +
      '</div>';
    html += addForm(i, rows);
    if (rows.length) {
      var np = Object.keys(picked).filter(function (k) { return picked[k]; }).length;
      html += '<div class="toolbar" id="bulkBar"><span class="lbl">' + (np ? np + ' selected' : 'Select rows for bulk actions') + '</span>' +
        (np ? '<span class="seg sm"><button data-bulk="YES">Allotted</button><button data-bulk="NO">Not allotted</button><button data-bulk="PENDING">Pending</button></span>' +
          '<button data-bulk="sell">Sell to broker…</button><button data-bulk="buy">Change investor deal…</button><button data-bulk="invS">Investor settled</button><button data-bulk="brkS">Broker settled</button><button class="danger" data-bulk="del">Delete</button>' :
          '<button id="pasteAllot">Paste allotted PANs / names</button><button id="allNo">Mark all pending as not allotted</button>') + '</div>';
      html += '<div class="tbl max"><table id="dealTbl"><thead><tr><th><input type="checkbox" id="pickAll" aria-label="Select all"' + (np === rows.length ? ' checked' : '') + '></th><th>Investor</th><th>Category</th><th>Investor deal</th><th>Sold to broker</th><th>Allotment</th><th class="num">Listing P/L</th><th class="num">Investor ±</th><th class="num">Broker ±</th><th class="num">My profit</th><th>Settled</th></tr></thead><tbody>' +
        rows.map(rowHtml).join('') +
        '<tr class="tot"><td></td><td>Total (' + t.n + ')</td><td></td><td class="money">' + FD.fmt(Math.round(sumF(rows, 'Di'))) + '</td><td class="money">' + FD.fmt(Math.round(sumF(rows, 'Db'))) + '</td><td></td><td class="money">' + FD.signed(sumF(rows, 'L')) + '</td><td class="money">' + FD.signed(sumF(rows, 'invNet')) + '</td><td class="money">' + FD.signed(sumF(rows, 'brkNet')) + '</td><td class="money">' + FD.signed(sumF(rows, 'profit')) + '</td><td></td></tr>' +
        '</tbody></table></div><p class="muted small">Investor ± : + you receive from the investor, − you pay the investor. Broker ± : + broker pays you, − you pay the broker. Italic grey = expected (allotment odds × GMP) until the result is in.</p>';
      html += settlement(i, rows);
    }
    el.innerHTML = html;
    wire(el, i, rows);
  }
  function sumF(rows, k) { return rows.reduce(function (s, x) { var v = x.r.final ? x.r[k] : (x.r.exp ? x.r.exp[k] : 0); return s + (v || 0); }, 0); }
  function tile(l, v, h, cls) { return '<div class="fact ' + (cls || '') + '"><small>' + l + '</small><b>' + v + '</b><span class="hint">' + (h || '') + '</span></div>'; }

  function lotTxt(l) { return (l || '—') + (l === 1 ? ' lot' : ' lots'); }
  function rowHtml(x) {
    var d = x.d, r = x.r, inv = FD.investor(d.investorId) || {};
    var f = r.final, e = r.exp || {};
    var val = function (k) { return f ? FD.signed(r[k]) : (r.exp ? '<span class="exp">' + FD.signed(e[k], false) + '</span>' : '—'); };
    var brokers = [['', '— not sold —']].concat(FD.state.brokers.map(function (b) { return [b.id, b.name]; }));
    var types = [['KOSTAK', 'Kostak'], ['SUBJECT', 'Subject-to'], ['PREMIUM', 'Premium/sh'], ['NONE', 'Own']];
    return '<tr class="c-' + d.cat + '" data-id="' + d.id + '"><td><input type="checkbox" data-pick="' + d.id + '"' + (picked[d.id] ? ' checked' : '') + ' aria-label="Select"></td>' +
      '<td><b>' + FD.esc(inv.name || '(deleted)') + '</b><br><span class="muted small mono">' + FD.esc(inv.pan || '') + '</span></td>' +
      '<td><select class="sel-sm" data-f="cat">' + FD.opts([['RETAIL', 'Retail'], ['SHNI', 'sHNI'], ['BHNI', 'bHNI']], d.cat) + '</select><br><span class="muted small">' + lotTxt(d.lots || C.lotRules(x.ipo)[d.cat]) + '</span></td>' +
      '<td><div class="stack"><select class="sel-sm" data-f="buyType">' + FD.opts(types, d.buyType) + '</select><input class="rate" data-f="buyRate" type="number" step="any" value="' + (d.buyRate == null ? '' : d.buyRate) + '"' + (d.buyType === 'NONE' ? ' disabled' : '') + ' aria-label="Investor rate"></div></td>' +
      '<td><div class="stack"><select class="sel-sm" data-f="brokerId">' + FD.opts(brokers, d.brokerId || '') + '</select>' + (d.brokerId ? '<select class="sel-sm" data-f="sellType">' + FD.opts(types.slice(0, 3), d.sellType || 'KOSTAK') + '</select><input class="rate" data-f="sellRate" type="number" step="any" value="' + (d.sellRate == null ? '' : d.sellRate) + '" aria-label="Broker rate">' : '') + '</div></td>' +
      '<td><div class="stack"><span class="seg sm">' + ['PENDING', 'YES', 'NO'].map(function (a) { return '<button data-al="' + a + '"' + ((d.allot || 'PENDING') === a ? ' class="on"' : '') + '>' + { PENDING: '?', YES: 'Yes', NO: 'No' }[a] + '</button>'; }).join('') + '</span>' +
      (d.allot === 'YES' ? '<input class="rate" style="width:70px" data-f="shares" type="number" value="' + (d.shares == null ? r.unit : d.shares) + '" aria-label="Shares allotted" title="Shares allotted">' : '') + '</div>' + (d.allot === 'PENDING' && x.sebiP != null ? '<span class="muted small">' + FD.oneIn(x.sebiP) + '</span>' : '') + '</td>' +
      '<td class="money">' + (f ? FD.signed(r.L) : (r.exp ? '<span class="exp">' + FD.signed(e.L, false) + '</span>' : '—')) + '</td>' +
      '<td class="money">' + val('invNet') + '</td><td class="money">' + (r.hedged ? val('brkNet') : '<span class="muted">—</span>') + '</td><td class="money"><b>' + val('profit') + '</b></td>' +
      '<td class="nowrap small"><label title="Investor settled"><input type="checkbox" data-f="invSettled"' + (d.invSettled ? ' checked' : '') + (f ? '' : ' disabled') + '> Inv</label> ' + (r.hedged ? '<label title="Broker settled"><input type="checkbox" data-f="brkSettled"' + (d.brkSettled ? ' checked' : '') + (f ? '' : ' disabled') + '> Brk</label>' : '') + '<br>' +
      '<button class="sel-sm" data-msg="' + d.id + '" title="Copy settlement message">Msg</button> <button class="sel-sm danger" data-del="' + d.id + '" title="Delete">✕</button></td></tr>';
  }

  function addForm(i, rows) {
    var inIpo = {}; rows.forEach(function (x) { inIpo[x.d.investorId] = 1; });
    var open = addOpen != null ? addOpen : !rows.length;
    var m = FD.state.settings.marginPct;
    var o = {}; C.CATS.forEach(function (c) { o[c] = C.opportunity(i, c, FD.state.settings.factors, m); });
    var invs = FD.state.investors.filter(function (x) { return x.active !== false; });
    var groups = Array.from(new Set(FD.state.investors.map(function (x) { return x.group || ''; }).filter(Boolean))).sort();
    var def = FD.state.settings.defaults;
    return '<details class="blk" id="addBlk"' + (open ? ' open' : '') + '><summary>+ Add applications to this IPO <span class="muted small">one per PAN · ' + (invs.length - Object.keys(inIpo).length) + ' investors available</span></summary><div style="padding:12px">' +
      (FD.state.investors.length ? '' : '<div class="notice">Add your investors first in <a href="#" id="goPeople">Investors &amp; Brokers</a>.</div>') +
      '<div class="row" style="margin-bottom:8px"><input type="search" id="pkQ" placeholder="Search name / PAN" style="max-width:240px">' + (groups.length ? '<select id="pkG"><option value="">All groups</option>' + FD.opts(groups) + '</select>' : '') + '<button id="pkAll">Select all shown</button><button id="pkNone">Clear</button><span class="muted small" id="pkCount">0 selected</span></div>' +
      '<div class="picklist" id="pick">' + invs.map(function (x) {
        var dis = inIpo[x.id];
        return '<label class="' + (dis ? 'dis' : '') + '" data-q="' + FD.esc((x.name + ' ' + (x.pan || '') + ' ' + (x.group || '')).toLowerCase()) + '" data-g="' + FD.esc(x.group || '') + '"><input type="checkbox" value="' + x.id + '"' + (dis ? ' disabled' : '') + '> ' + FD.esc(x.name) + ' <span class="pan">' + FD.esc(x.pan || '') + '</span></label>';
      }).join('') + '</div>' +
      '<div class="form" style="margin-top:10px;margin-bottom:0">' +
      '<label>Category <select id="aCat">' + FD.opts([['RETAIL', 'Retail'], ['SHNI', 'sHNI'], ['BHNI', 'bHNI']], 'RETAIL') + '</select></label>' +
      '<label>Lots per application <input id="aLots" type="number" min="1" placeholder="minimum"></label>' +
      '<label>Investor deal <select id="aBuyT">' + FD.opts([['KOSTAK', 'Kostak (fixed, allotted or not)'], ['SUBJECT', 'Subject-to (only if allotted)'], ['PREMIUM', 'Premium ₹ per share'], ['NONE', 'Own account (no payout)']], def.buyType) + '</select></label>' +
      '<label>Rate to investor ₹ <input id="aBuyR" type="number" step="any" placeholder="e.g. 300"></label>' +
      '<label>Sell to broker <select id="aBrk"><option value="">— keep the risk —</option>' + FD.opts(FD.state.brokers.map(function (b) { return [b.id, b.name]; })) + '<option value="__new">+ New broker…</option></select></label>' +
      '<label>Broker deal <select id="aSellT">' + FD.opts([['KOSTAK', 'Kostak (fixed, allotted or not)'], ['SUBJECT', 'Subject-to (only if allotted)'], ['PREMIUM', 'Premium ₹ per share']], def.sellType) + '</select></label>' +
      '<label>Rate from broker ₹ <input id="aSellR" type="number" step="any" placeholder="e.g. 400"></label>' +
      '<label>Note <input id="aNote" placeholder="optional"></label>' +
      '<p class="full muted small" id="aHint" style="margin:0"></p>' +
      '<div class="full row" style="justify-content:flex-end"><button class="primary" id="aAdd">Add applications</button></div></div></div></details>';
    function hint() { return o; }
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

  function wire(el, i, rows) {
    var $ = function (s) { return el.querySelector(s); };
    var byId = {}; rows.forEach(function (x) { byId[x.d.id] = x; });
    $('#dlIpo').onclick = function () { FD.go('ipos', i.id); };
    if ($('#fixIpo')) $('#fixIpo').onclick = function () { FD.editIpo(i); };
    $('#dlSettle').onchange = function (e) {
      var v = e.target.value === '' ? null : +e.target.value;
      if (v != null && i.listingPrice == null) FD.setIpoEdit(i.id, { listingPrice: v, gmpBeforeListing: FD.lastGmpBefore(i) != null ? FD.lastGmpBefore(i) : i.gmp });
      else FD.setIpoEdit(i.id, { settlePrice: v != null && v === i.listingPrice ? null : v });
      FD.invalidate(); FD.renderDeals(); FD.toast('Settlement price saved');
    };
    $('#dlXls').onclick = function () { FD.exportIpo(i, 'xlsx'); };
    $('#dlPdf').onclick = function () { FD.exportIpo(i, 'pdf'); };
    var blk = $('#addBlk'); blk.ontoggle = function () { addOpen = blk.open; };
    if ($('#goPeople')) $('#goPeople').onclick = function (e) { e.preventDefault(); FD.go('people'); };
    // picklist
    var pk = $('#pick');
    var count = function () { $('#pkCount').textContent = pk.querySelectorAll('input:checked').length + ' selected'; };
    var filt = function () {
      var q = ($('#pkQ').value || '').toLowerCase(), g = $('#pkG') ? $('#pkG').value : '';
      pk.querySelectorAll('label').forEach(function (l) { l.hidden = (q && l.dataset.q.indexOf(q) < 0) || (g && l.dataset.g !== g); });
    };
    $('#pkQ').oninput = filt; if ($('#pkG')) $('#pkG').onchange = filt;
    pk.onchange = count;
    $('#pkAll').onclick = function () { pk.querySelectorAll('label:not([hidden]) input:not(:disabled)').forEach(function (c) { c.checked = true; }); count(); };
    $('#pkNone').onclick = function () { pk.querySelectorAll('input').forEach(function (c) { c.checked = false; }); count(); };
    var hint = function () {
      var c = $('#aCat').value, o = C.opportunity(i, c, FD.state.settings.factors, FD.state.settings.marginPct);
      var r = C.lotRules(i);
      $('#aLots').placeholder = 'min ' + (r[c] || '—');
      $('#aHint').innerHTML = C.CAT_LABEL[c] + ': ' + FD.oneIn(o.p) + ' chance · gain if allotted ' + FD.fmt(o.gainIfAllotted) + ' · fair Kostak <b>' + FD.fmt(o.fairKostak == null ? null : Math.round(o.fairKostak)) + '</b> (bid ' + FD.fmt(o.bidKostak) + ') · fair Subject-to <b>' + FD.fmt(o.fairSubject) + '</b> (bid ' + FD.fmt(o.bidSubject) + ')' + (i.gmp != null ? ' · fair premium ₹' + i.gmp + '/share' : '');
      $('#aBuyR').disabled = $('#aBuyT').value === 'NONE';
    };
    $('#aCat').onchange = hint; $('#aBuyT').onchange = hint; hint();
    $('#aBrk').onchange = function (e) {
      if (e.target.value !== '__new') return;
      var name = prompt('New broker name'); if (!name) { e.target.value = ''; return; }
      var b = { id: FD.uid('b-'), name: name.trim(), createdAt: new Date().toISOString() }; FD.state.brokers.push(b); FD.save();
      var op = document.createElement('option'); op.value = b.id; op.textContent = b.name; e.target.insertBefore(op, e.target.lastElementChild); e.target.value = b.id;
    };
    $('#aAdd').onclick = function () {
      var ids = Array.from(pk.querySelectorAll('input:checked')).map(function (c) { return c.value; });
      if (!ids.length) { FD.toast('Tick at least one investor', true); return; }
      var cat = $('#aCat').value, lots = +$('#aLots').value || null, r = C.lotRules(i);
      if (lots && r[cat] && lots < r[cat]) { FD.toast('Minimum for ' + C.CAT_LABEL[cat] + ' is ' + r[cat] + ' lots', true); return; }
      var brk = $('#aBrk').value === '__new' ? '' : $('#aBrk').value;
      var now = new Date().toISOString(), snap = FD.snap(i);
      ids.forEach(function (id) {
        FD.state.deals.push({ id: FD.uid('d-'), ipoId: i.id, investorId: id, cat: cat, lots: lots, buyType: $('#aBuyT').value, buyRate: $('#aBuyR').value === '' ? null : +$('#aBuyR').value,
          brokerId: brk || null, sellType: brk ? $('#aSellT').value : null, sellRate: brk && $('#aSellR').value !== '' ? +$('#aSellR').value : null,
          allot: 'PENDING', shares: null, invSettled: '', brkSettled: '', note: $('#aNote').value.trim(), createdAt: now, ipoSnap: snap });
      });
      FD.save(); addOpen = false; FD.renderDeals(); FD.toast(ids.length + ' application' + (ids.length > 1 ? 's' : '') + ' added');
    };
    if (!rows.length) return;
    // table edits
    var tbl = $('#dealTbl');
    tbl.addEventListener('change', function (e) {
      var tr = e.target.closest('tr[data-id]'), pick = e.target.dataset.pick;
      if (pick) { picked[pick] = e.target.checked; FD.renderDeals(); return; }
      if (e.target.id === 'pickAll') { rows.forEach(function (x) { picked[x.d.id] = e.target.checked; }); FD.renderDeals(); return; }
      if (!tr || !e.target.dataset.f) return;
      var d = byId[tr.dataset.id].d, k = e.target.dataset.f, v = e.target.type === 'checkbox' ? (e.target.checked ? FD.today() : '') : e.target.value;
      if (/Rate$|^shares$/.test(k)) v = v === '' ? null : +v;
      if (k === 'brokerId') { v = v || null; if (v && !d.sellType) d.sellType = FD.state.settings.defaults.sellType; }
      if (k === 'cat') d.lots = null;
      d[k] = v; FD.save(); FD.renderDeals();
    });
    tbl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var tr = b.closest('tr[data-id]');
      if (b.dataset.al && tr) { var d = byId[tr.dataset.id].d; d.allot = b.dataset.al; if (d.allot !== 'YES') d.shares = null; FD.save(); FD.renderDeals(); }
      if (b.dataset.del) FD.confirm('Delete this application of ' + FD.esc(FD.invName(byId[b.dataset.del].d.investorId)) + '?', function () { FD.state.deals = FD.state.deals.filter(function (d) { return d.id !== b.dataset.del; }); FD.save(); FD.renderDeals(); }, 'Delete');
      if (b.dataset.msg) copy(msgFor(byId[b.dataset.msg]));
    });
    // bulk
    var sel = function () { return rows.filter(function (x) { return picked[x.d.id]; }); };
    el.querySelectorAll('[data-bulk]').forEach(function (b) {
      b.onclick = function () {
        var s = sel(), k = b.dataset.bulk;
        if (/^(YES|NO|PENDING)$/.test(k)) { s.forEach(function (x) { x.d.allot = k; if (k !== 'YES') x.d.shares = null; }); done(); }
        else if (k === 'invS') { s.forEach(function (x) { if (x.r.final) x.d.invSettled = FD.today(); }); done(); }
        else if (k === 'brkS') { s.forEach(function (x) { if (x.r.final && x.r.hedged) x.d.brkSettled = FD.today(); }); done(); }
        else if (k === 'del') FD.confirm('Delete ' + s.length + ' applications?', function () { var ids = {}; s.forEach(function (x) { ids[x.d.id] = 1; }); FD.state.deals = FD.state.deals.filter(function (d) { return !ids[d.id]; }); picked = {}; done(); }, 'Delete');
        else if (k === 'sell' || k === 'buy') dealDialog(k, s, done);
      };
    });
    function done() { FD.save(); FD.renderDeals(); }
    if ($('#allNo')) $('#allNo').onclick = function () { var n = 0; rows.forEach(function (x) { if (x.d.allot === 'PENDING') { x.d.allot = 'NO'; n++; } }); done(); FD.toast(n + ' marked not allotted'); };
    if ($('#pasteAllot')) $('#pasteAllot').onclick = function () { pasteAllot(rows, done); };
    el.querySelectorAll('[data-bmsg]').forEach(function (b) { b.onclick = function () { copy(brokerMsg(i, b.dataset.bmsg, rows)); }; });
    el.querySelectorAll('[data-bset]').forEach(function (b) { b.onclick = function () { rows.forEach(function (x) { if (x.d.brokerId === b.dataset.bset && x.r.final) x.d.brkSettled = x.d.brkSettled || FD.today(); }); done(); }; });
    el.querySelectorAll('[data-iset]').forEach(function (b) { b.onclick = function () { rows.forEach(function (x) { if (x.d.investorId === b.dataset.iset && x.r.final) x.d.invSettled = x.d.invSettled || FD.today(); }); done(); }; });
  }

  function dealDialog(kind, sel, done) {
    var sell = kind === 'sell';
    FD.modal('<h2>' + (sell ? 'Sell ' + sel.length + ' applications to a broker' : 'Change investor deal for ' + sel.length + ' applications') + '</h2><div class="form">' +
      (sell ? '<label>Broker <select id="xB"><option value="">— keep the risk (remove broker) —</option>' + FD.opts(FD.state.brokers.map(function (b) { return [b.id, b.name]; })) + '</select></label>' : '') +
      '<label>Deal type <select id="xT">' + FD.opts([['KOSTAK', 'Kostak (fixed, allotted or not)'], ['SUBJECT', 'Subject-to (only if allotted)'], ['PREMIUM', 'Premium ₹ per share']].concat(sell ? [] : [['NONE', 'Own account']])) + '</select></label>' +
      '<label>Rate ₹ <input id="xR" type="number" step="any"></label></div><div class="row" style="justify-content:flex-end"><button data-close>Cancel</button><button class="primary" id="xOk">Apply</button></div>',
    function (b, close) {
      b.querySelector('#xOk').onclick = function () {
        var t = b.querySelector('#xT').value, r = b.querySelector('#xR').value === '' ? null : +b.querySelector('#xR').value;
        sel.forEach(function (x) {
          if (sell) { var br = b.querySelector('#xB').value || null; x.d.brokerId = br; x.d.sellType = br ? t : null; x.d.sellRate = br ? r : null; x.d.brkSettled = ''; }
          else { x.d.buyType = t; x.d.buyRate = r; }
        });
        close(); done();
      };
    });
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
