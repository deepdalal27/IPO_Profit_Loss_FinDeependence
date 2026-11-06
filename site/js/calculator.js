/* FinDeependence IPO Deal Desk · Calculator: one deal, live receivable / payable / profit. */
(function () {
  var FD = window.FD, C = FD.C;
  var s = { ipo: '', cat: 'RETAIL', issue: 150, shares: 100, list: 160, apps: 1, buyType: 'KOSTAK', buyRate: 300, sellType: '', sellRate: '', chance: '' };
  var TYPES = [['KOSTAK', 'Kostak'], ['SUBJECT', 'Subject-to'], ['PREMIUM', 'Premium / share'], ['NONE', 'Own account']];

  function fromIpo() {
    var i = FD.ipo(s.ipo); if (!i) return;
    s.issue = C.price(i) || s.issue;
    s.shares = C.unitShares(i, s.cat) || s.shares;
    s.list = i.settlePrice != null ? i.settlePrice : (i.listingPrice != null ? i.listingPrice : (i.gmp != null ? +(C.price(i) + i.gmp).toFixed(2) : ''));
    var p = C.probability(i, s.cat, FD.state.settings.factors).p;
    s.chance = p == null ? '' : +(p * 100).toFixed(2);
  }

  function calc(allotted, listPx) {
    var ipo = { priceHigh: +s.issue || 0, lotSize: +s.shares || 0, lots: { retail: { lots: 1 }, snii: { lots: 1 }, bnii: { lots: 1 } }, listingPrice: listPx };
    var d = { cat: 'RETAIL', buyType: s.buyType, buyRate: +s.buyRate || 0, brokerId: s.sellType ? 'b' : null, sellType: s.sellType || null, sellRate: +s.sellRate || 0, allot: allotted ? 'YES' : 'NO', shares: +s.shares || 0 };
    return C.dealResult(d, ipo);
  }
  function money(v) {
    if (v == null || !isFinite(v)) return '<span class="muted">—</span>';
    var n = Math.round((v || 0) * (+s.apps || 1));
    if (Math.abs(n) < 1) return '<span class="muted">Nil</span>';
    return '<b class="' + (n > 0 ? 'pos' : 'neg') + '">' + (n > 0 ? 'Receive ' : 'Pay ') + FD.fmt(Math.abs(n)) + '</b>';
  }
  function prof(v) { if (v == null || !isFinite(v)) return '<span class="muted">—</span>'; var n = Math.round((v || 0) * (+s.apps || 1)); return '<b class="' + (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted') + '">' + (n > 0 ? '+' : '') + FD.fmt(n) + '</b>'; }

  FD.renderCalc = function () {
    var el = document.getElementById('v-calc');
    var ipos = FD.ipos().filter(function (i) { return C.price(i) && i.lotSize; }).slice(0, 60);
    var lp = s.list === '' ? null : +s.list;
    var hedged = !!s.sellType;
    var A = calc(true, lp), N = calc(false, lp);
    var p = s.chance === '' ? null : Math.max(0, Math.min(100, +s.chance)) / 100;
    var exp = p == null ? null : { inv: p * A.invNet + (1 - p) * N.invNet, brk: p * A.brkNet + (1 - p) * N.brkNet, pr: p * A.profit + (1 - p) * N.profit };
    var gainSh = lp == null ? null : lp - (+s.issue || 0);

    var html = '<div class="panel"><div class="panel-head"><div><h2>Deal calculator</h2></div>' +
      '<div class="row"><label class="dl">IPO <select id="cIpo"><option value="">— enter by hand —</option>' + FD.opts(ipos.map(function (i) { return [i.id, i.name]; }), s.ipo) + '</select></label></div></div>' +
      '<div class="calc"><div class="calc-in">' +
      '<div class="seg big" id="cCat">' + C.CATS.map(function (c) { return '<button data-cat="' + c + '"' + (s.cat === c ? ' class="on"' : '') + '>' + C.CAT_LABEL[c] + '</button>'; }).join('') + '</div>' +
      '<div class="form tight">' +
      inp('issue', 'Issue price ₹') + inp('shares', 'Shares if allotted') + inp('list', 'Listing price ₹', lp == null ? 'enter' : '') + inp('apps', 'Applications') +
      '<label>Investor deal <select data-k="buyType">' + FD.opts(TYPES, s.buyType) + '</select></label>' + (s.buyType === 'NONE' ? '<label></label>' : inp('buyRate', s.buyType === 'PREMIUM' ? 'Investor ₹ / share' : 'Investor ₹ / application')) +
      '<label>Broker deal <select data-k="sellType">' + FD.opts([['', 'Not sold — my risk']].concat(TYPES.slice(0, 3)), s.sellType) + '</select></label>' + (hedged ? inp('sellRate', s.sellType === 'PREMIUM' ? 'Broker ₹ / share' : 'Broker ₹ / application') : '<label></label>') +
      inp('chance', 'Chance of allotment %') +
      '</div></div>' +
      '<div class="calc-out">' +
      '<div class="tiles">' +
      '<div class="fact"><small>Listing gain / share</small><b>' + (gainSh == null ? '—' : (gainSh >= 0 ? '+' : '') + '₹' + (+gainSh.toFixed(2)).toLocaleString('en-IN')) + '</b><span class="hint">' + (gainSh == null ? 'enter listing price' : 'Total ' + FD.fmt(Math.round(gainSh * (+s.shares || 0))) + ' per allotment') + '</span></div>' +
      '<div class="fact"><small>Break-even listing</small><b>' + breakEven() + '</b><span class="hint">my profit is nil here if allotted</span></div>' +
      '</div>' +
      '<div class="tbl"><table class="res"><thead><tr><th></th><th class="num">If allotted</th><th class="num">If not allotted</th>' + (exp ? '<th class="num">Expected (' + FD.pct(p, p < .01 ? 2 : 1) + ')</th>' : '') + '</tr></thead><tbody>' +
      '<tr><td>Investor</td><td class="num">' + money(A.invNet) + '</td><td class="num">' + money(N.invNet) + '</td>' + (exp ? '<td class="num">' + money(exp.inv) + '</td>' : '') + '</tr>' +
      (hedged ? '<tr><td>Broker</td><td class="num">' + money(A.brkNet) + '</td><td class="num">' + money(N.brkNet) + '</td>' + (exp ? '<td class="num">' + money(exp.brk) + '</td>' : '') + '</tr>' : '') +
      '<tr class="tot"><td>My profit</td><td class="num">' + (lp == null ? '—' : prof(A.profit)) + '</td><td class="num">' + prof(N.profit) + '</td>' + (exp ? '<td class="num">' + (lp == null ? '—' : prof(exp.pr)) + '</td>' : '') + '</tr>' +
      '</tbody></table></div>' +
      whatIf() +
      '</div></div></div>';
    el.innerHTML = html;
    el.querySelector('#cIpo').onchange = function (e) { s.ipo = e.target.value; fromIpo(); FD.renderCalc(); };
    el.querySelectorAll('#cCat button').forEach(function (b) { b.onclick = function () { s.cat = b.dataset.cat; if (s.ipo) fromIpo(); FD.renderCalc(); }; });
    el.querySelectorAll('[data-k]').forEach(function (x) {
      var ev = x.tagName === 'SELECT' ? 'change' : 'input';
      x.addEventListener(ev, function () {
        s[x.dataset.k] = x.value;
        var pos = x.selectionStart, k = x.dataset.k;
        FD.renderCalc();
        var n = el.querySelector('[data-k="' + k + '"]'); if (n && n.tagName === 'INPUT') { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
      });
    });
  };
  function inp(k, label, ph) { return '<label>' + label + ' <input data-k="' + k + '" type="number" step="any" value="' + FD.esc(s[k]) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></label>'; }
  function breakEven() {
    var S = +s.shares || 0; if (!S) return '—';
    var A0 = calc(true, +s.issue || 0); // profit at a flat listing
    if (s.sellType) return Math.abs(A0.profit) < 0.5 ? '—' : '<span class="muted small">hedged</span>';
    return '₹' + (+((+s.issue || 0) - A0.profit / S).toFixed(2)).toLocaleString('en-IN');
  }
  function whatIf() {
    var iss = +s.issue || 0, lp = s.list === '' ? null : +s.list; if (!iss) return '';
    var g = lp != null ? lp - iss : iss * 0.2;
    var pts = [iss * 0.9, iss, iss + g * 0.5, iss + g, iss + g * 1.5].map(function (v) { return +v.toFixed(2); });
    pts = pts.filter(function (v, k) { return pts.indexOf(v) === k; });
    return '<h3 class="sec">If allotted and it lists at…</h3><div class="tbl"><table class="res"><thead><tr><th class="num">Listing ₹</th><th class="num">Gain / share</th><th class="num">Investor</th>' + (s.sellType ? '<th class="num">Broker</th>' : '') + '<th class="num">My profit</th></tr></thead><tbody>' +
      pts.map(function (v) { var r = calc(true, v); return '<tr' + (lp != null && Math.abs(v - lp) < 0.001 ? ' class="hl"' : '') + '><td class="num">₹' + v.toLocaleString('en-IN') + '</td><td class="num">' + FD.signed(v - iss, false).replace('₹', '₹') + '</td><td class="num">' + money(r.invNet) + '</td>' + (s.sellType ? '<td class="num">' + money(r.brkNet) + '</td>' : '') + '<td class="num">' + prof(r.profit) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }
})();
