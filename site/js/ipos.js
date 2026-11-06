/* FinDeependence IPO Deal Desk · IPOs & GMP: live list, SEBI allotment odds, fair Kostak / Subject-to rates, edits. */
(function () {
  var FD = window.FD, C = FD.C;
  FD.sel = FD.sel || {};

  function railFilter(i, f) {
    if (f === 'recent') return i.stage !== 'Listed';
    if (f === 'live') return i.stage === 'Open' || i.stage === 'Upcoming';
    if (f === 'await') return i.stage === 'Closed' || i.stage === 'Allotted' || i.stage === 'Listing';
    if (f === 'listed') return i.stage === 'Listed' || i.stage === 'Listing';
    return true;
  }
  FD.renderIpos = function () {
    var f = document.getElementById('ipoFilter').value, q = document.getElementById('ipoSearch').value.trim().toLowerCase();
    var list = FD.ipos().filter(function (i) { return railFilter(i, f) && (!q || i.name.toLowerCase().indexOf(q) >= 0); });
    if (f === 'live' || f === 'recent') list.sort(function (a, b) { return String(a.closeDate || '9').localeCompare(String(b.closeDate || '9')); });
    var rail = document.getElementById('ipoRail');
    if (!FD.sel.ipo || !FD.ipo(FD.sel.ipo)) FD.sel.ipo = (list[0] || FD.ipos()[0] || {}).id;
    rail.innerHTML = list.length ? list.map(function (i) {
      var gp = i.gmp != null && i.priceHigh ? ' · GMP ₹' + i.gmp + ' (' + FD.pct(i.gmp / i.priceHigh) + ')' : '';
      return '<button class="ipo-btn' + (i.id === FD.sel.ipo ? ' sel' : '') + '" data-id="' + i.id + '"><span class="nm">' + FD.esc(i.name) + ' ' + FD.stagePill(i.stage) + (i.type === 'SME' ? ' <span class="pill SME">SME</span>' : '') + '</span><span class="sub">' + FD.dt(i.openDate) + ' – ' + FD.dt(i.closeDate) + gp + '</span></button>';
    }).join('') : '<p class="muted">No IPOs here. Try “All”.</p>';
    rail.querySelectorAll('.ipo-btn').forEach(function (b) { b.onclick = function () { FD.sel.ipo = b.dataset.id; FD.renderIpos(); }; });
    var fi = FD.feed; document.getElementById('feedInfo').textContent = 'IPO data: ' + (fi.checkedAt ? 'checked ' + new Date(fi.checkedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'built-in list') + '. Use Data & Settings → Update from IPO Premium for the latest GMP.';
    renderPanel(FD.ipo(FD.sel.ipo));
  };

  function renderPanel(i) {
    var el = document.getElementById('ipoPanel');
    if (!i) { el.innerHTML = '<div class="empty-state"><h3>No IPO selected</h3></div>'; return; }
    var r = C.lotRules(i), m = FD.state.settings.marginPct;
    var gp = i.gmp != null && i.priceHigh ? i.gmp / i.priceHigh : null;
    var mine = FD.rows(function (x) { return x.d.ipoId === i.id; }), ms = FD.sum(mine);
    var html = '<div class="panel-head"><div><h2>' + FD.esc(i.name) + ' ' + FD.stagePill(i.stage) + ' ' + FD.typePill(i) + '</h2>' +
      '<p class="muted" style="margin:4px 0 0">' + FD.esc(i.exchange || '') + (i.registrar ? ' · Registrar ' + FD.esc(i.registrar) : '') + (i.ippUrl ? ' · <a href="' + i.ippUrl + '" target="_blank" rel="noopener">IPO Premium page ↗</a>' : '') + (i.demo ? ' · <span class="edited">demo listing price</span>' : i.edited ? ' · <span class="edited">edited by you</span>' : '') + '</p></div>' +
      '<div class="row"><button class="primary" id="bookBtn">Book deals for this IPO</button><button id="editBtn">Edit IPO data</button></div></div>';
    html += '<div class="facts">' +
      fact('GMP', i.gmp == null ? '—' : '₹' + i.gmp + ' <span class="muted small">' + FD.pct(gp) + '</span>', i.priceHigh && i.gmp != null ? 'Est. listing ₹' + (i.priceHigh + i.gmp) : '', 'pos') +
      fact('Price band', i.priceLow && i.priceHigh && i.priceLow !== i.priceHigh ? '₹' + i.priceLow + '–' + i.priceHigh : (i.priceHigh ? '₹' + i.priceHigh : '—'), i.issueSizeCr ? '₹' + i.issueSizeCr + ' Cr issue' : '') +
      fact('Lot size', i.lotSize ? i.lotSize + ' sh' : '—', r.lotValue ? FD.fmt(r.lotValue) + ' per lot' : '') +
      fact('Subscribed', i.subTotal || (i.sub && i.sub.total && i.sub.total.times) ? ((i.subTotal || i.sub.total.times) + '×') : '—', i.subUpdated ? 'Updated ' + i.subUpdated : '') +
      fact('Open – Close', FD.dt(i.openDate) + ' – ' + FD.dt(i.closeDate), 'Allotment ' + FD.dt(i.allotmentDate)) +
      fact('Listing', FD.dt(i.listingDate), i.listingPrice ? 'Listed at ₹' + i.listingPrice + ' (' + FD.pct((i.listingPrice - i.priceHigh) / i.priceHigh) + ')' : '', i.listingPrice ? (i.listingPrice >= i.priceHigh ? 'pos' : 'neg') : '') +
      '</div>';

    // Category opportunity
    html += '<h3 class="sec">Allotment odds &amp; fair deal rates (SEBI method)</h3>';
    html += '<div class="tbl"><table class="opp"><thead><tr><th>Category</th><th>Min application</th><th>Subscribed</th><th>Chance of allotment</th><th>Gain if allotted</th><th>Fair Kostak<br><span class="muted">= expected / app</span></th><th>Your bid<br>Kostak</th><th>Fair<br>Subject-to</th><th>Your bid<br>Subject-to</th></tr></thead><tbody>' +
      C.CATS.map(function (c) {
        var o = C.opportunity(i, c, FD.state.settings.factors, m);
        var p = o.p, k = C.SUBKEY[c], realT = ((i.sub || {})[k] || {}).times;
        var assumed = i.override && i.override.times && i.override.times[c];
        var subCell = realT != null ? realT + '×' : '<input class="rate" type="number" step="any" min="0" data-assume="' + c + '" value="' + (assumed == null ? '' : assumed) + '" placeholder="assume ×" title="Assume how many times this category will be subscribed">';
        return '<tr class="c-' + c + '"><td>' + FD.catPill(c) + '</td><td>' + (o.minLots || '—') + ' lot' + (o.minLots > 1 ? 's' : '') + '<br><span class="muted small">' + FD.fmt(o.blockAmount) + '</span></td>' +
          '<td>' + subCell + (realT == null && assumed != null ? '<br><span class="muted small">assumed</span>' : '') + '</td>' +
          '<td><span class="prob">' + FD.oneIn(p) + ' <small>' + FD.pct(p, p != null && p < 0.01 ? 2 : 1) + '</small></span><div class="bar-mini"><span style="width:' + Math.min(100, (p || 0) * 100) + '%"></span></div><span class="muted small">' + (o.appsApplied ? Math.round(o.appsApplied).toLocaleString('en-IN') + ' apps · ' + Math.round(o.unitsAvail || 0).toLocaleString('en-IN') + ' winners · ' : '') + basisText(o.basis) + '</span></td>' +
          '<td>' + FD.fmt(o.gainIfAllotted) + '<br><span class="muted small">' + o.unitShares + ' sh × ₹' + (i.gmp == null ? '—' : i.gmp) + '</span></td>' +
          '<td><b>' + FD.fmt(o.fairKostak == null ? null : Math.round(o.fairKostak)) + '</b></td><td class="pos">' + FD.fmt(o.bidKostak) + '</td>' +
          '<td>' + FD.fmt(o.fairSubject) + '</td><td class="pos">' + FD.fmt(o.bidSubject) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (i.sub && Object.keys(i.sub).length) {
      var order = ['qib', 'nii', 'bnii', 'snii', 'retail', 'emp', 'sh', 'total'], lab = { qib: 'QIB', nii: 'NII (HNI)', bnii: 'bHNI (₹10L+)', snii: 'sHNI (₹2–10L)', retail: 'Retail', emp: 'Employees', sh: 'Shareholders', total: 'Total' };
      html += '<div class="grid2" style="margin-top:12px"><div><h3 class="sec">Subscription (shares)</h3><div class="tbl"><table><thead><tr><th>Category</th><th class="num">Offered</th><th class="num">Applied</th><th class="num">Times</th></tr></thead><tbody>' +
        order.filter(function (k) { return i.sub[k]; }).map(function (k) { var s = i.sub[k]; return '<tr' + (k === 'total' ? ' class="tot"' : '') + '><td>' + lab[k] + '</td><td class="num">' + (s.offered ? Math.round(s.offered).toLocaleString('en-IN') : '—') + '</td><td class="num">' + (s.applied ? Math.round(s.applied).toLocaleString('en-IN') : '—') + '</td><td class="num">' + (s.times != null ? s.times + '×' : '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div></div><div><h3 class="sec">GMP trend</h3>' + ((i.gmpHistory || []).length > 1 ? '<div class="chart" style="height:220px"><canvas id="chGmpTrend"></canvas></div>' : '<p class="muted">GMP history builds up as the data refreshes.</p>') + '</div></div>';
    } else if ((i.gmpHistory || []).length > 1) {
      html += '<h3 class="sec">GMP trend</h3><div class="chart" style="height:220px"><canvas id="chGmpTrend"></canvas></div>';
    }
    if (ms.n) {
      html += '<h3 class="sec">Your book in this IPO</h3><div class="tiles">' +
        fact('Applications', ms.n, 'Retail ' + ms.cats.RETAIL + ' · sHNI ' + ms.cats.SHNI + ' · bHNI ' + ms.cats.BHNI) +
        fact('Hedged', ms.hedged + ' / ' + ms.n, 'sold to brokers') +
        fact(ms.final === ms.n ? 'Realised profit' : 'Expected profit', FD.signed(ms.final === ms.n ? ms.profit : ms.expProfit), ms.final + ' final', ms.expProfit >= 0 ? 'pos' : 'neg') + '</div>';
    }
    el.innerHTML = html;
    el.querySelector('#bookBtn').onclick = function () { FD.go('deals', i.id); };
    el.querySelector('#editBtn').onclick = function () { editIpo(i); };
    el.querySelectorAll('[data-assume]').forEach(function (inp) {
      inp.onchange = function () {
        var e = FD.state.ipoEdits[i.id] = FD.state.ipoEdits[i.id] || {};
        var ov = e.override = e.override || {}; var t = ov.times = ov.times || {};
        if (inp.value === '') delete t[inp.dataset.assume]; else t[inp.dataset.assume] = +inp.value;
        FD.save(); FD.invalidate(); FD.renderIpos();
      };
    });
    if (document.getElementById('chGmpTrend')) {
      var h = i.gmpHistory, col = FD.colors();
      FD.chart('chGmpTrend', { type: 'line', data: { labels: h.map(function (x) { return x.t.slice(5, 16); }), datasets: [{ label: 'GMP ₹', data: h.map(function (x) { return x.g; }), borderColor: col.teal, backgroundColor: col.teal, borderWidth: 2, pointRadius: 3, tension: .25 }] },
        options: { scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } }, y: { ticks: { callback: function (v) { return '₹' + v; } } } } } });
    }
  }
  function same(a, b) { return (a == null && b == null) || a === b; }
  function fact(l, v, hint, cls) { return '<div class="fact ' + (cls || '') + '"><small>' + l + '</small><b>' + v + '</b>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; }
  function basisText(b) { return { applications: 'from application count', estimated: 'estimated from subscription', undersubscribed: 'undersubscribed: all get', manual: 'your override', none: 'awaiting subscription' }[b] || ''; }

  // Edit / add IPO
  function editIpo(i) {
    var isNew = !i;
    i = i || { type: 'Mainboard' };
    var s = i.sub || {}, a = i.apps || {}, ov = (i.override && i.override.prob) || {};
    var v = function (x) { return x == null ? '' : x; };
    var f = function (id, label, val, type, extra) { return '<label>' + label + ' <input id="' + id + '" type="' + (type || 'number') + '" step="any" value="' + FD.esc(v(val)) + '" ' + (extra || '') + '></label>'; };
    FD.modal('<h2>' + (isNew ? 'Add an IPO' : 'Edit ' + FD.esc(i.name)) + '</h2><p class="muted small">Your changes override the automatic data for this IPO (leave blank to use the automatic value).</p>' +
      '<div class="form">' + (isNew ? '<label class="full">Company name <input id="eName" required></label><label>Type <select id="eType">' + FD.opts(['Mainboard', 'SME'], 'Mainboard') + '</select></label>' : '') +
      f('eGmp', 'GMP ₹/share', i.gmp) + f('eHigh', 'Issue price (upper band) ₹', i.priceHigh) + f('eLot', 'Lot size (shares)', i.lotSize) +
      f('eOpen', 'Open', i.openDate, 'date') + f('eClose', 'Close', i.closeDate, 'date') + f('eAllot', 'Allotment', i.allotmentDate, 'date') + f('eList', 'Listing', i.listingDate, 'date') +
      f('eLp', 'Listing price ₹ (actual)', i.listingPrice) + f('eSp', 'Settlement price ₹ (if deals settle at a different price)', i.settlePrice) +
      '<div class="full"><h3 class="sec" style="margin-top:4px">Subscription &amp; applications (for allotment odds)</h3></div>' +
      C.CATS.map(function (c) { var k = C.SUBKEY[c]; return f('eT' + c, C.CAT_LABEL[c] + ' times subscribed', (s[k] || {}).times) + f('eA' + c, C.CAT_LABEL[c] + ' applications', (a[k] || {}).applied) + f('eP' + c, C.CAT_LABEL[c] + ' chance % (override)', ov[c]); }).join('') +
      '</div><div class="row" style="justify-content:space-between"><span>' + (!isNew && i.edited ? '<button class="danger" id="eReset">Remove my edits</button>' : '') + (!isNew && i.manual ? ' <button class="danger" id="eDel">Delete this IPO</button>' : '') + '</span><span class="row"><button data-close>Cancel</button><button class="primary" id="eSave">Save</button></span></div>',
    function (b, close) {
      var g = function (id) { var el = b.querySelector('#' + id); return el ? el.value.trim() : ''; };
      var nv = function (id) { var x = g(id); return x === '' ? null : +x; };
      b.querySelector('#eSave').onclick = function () {
        var patch = { gmp: nv('eGmp'), priceHigh: nv('eHigh'), lotSize: nv('eLot'), openDate: g('eOpen') || null, closeDate: g('eClose') || null, allotmentDate: g('eAllot') || null, listingDate: g('eList') || null, listingPrice: nv('eLp'), settlePrice: nv('eSp') };
        var sub = {}, apps = {}, prob = {};
        C.CATS.forEach(function (c) { var k = C.SUBKEY[c]; if (nv('eT' + c) != null) sub[k] = { times: nv('eT' + c) }; if (nv('eA' + c) != null) apps[k] = { applied: nv('eA' + c) }; if (nv('eP' + c) != null) prob[c] = nv('eP' + c); });
        if (isNew) {
          if (!g('eName')) { FD.toast('Enter the company name', true); return; }
          var o = { id: FD.uid('m-'), name: g('eName'), type: g('eType'), exchange: g('eType'), manual: true };
          Object.keys(patch).forEach(function (k) { if (patch[k] != null) o[k] = patch[k]; });
          if (patch.priceHigh) o.priceLow = patch.priceHigh;
          if (Object.keys(sub).length) o.sub = sub; if (Object.keys(apps).length) o.apps = apps; if (Object.keys(prob).length) o.override = { prob: prob };
          FD.state.customIpos.push(o); FD.save(); FD.sel.ipo = o.id;
        } else {
          // only store fields that differ from the automatic value
          var base = Object.assign({}, i); var e = FD.state.ipoEdits[i.id] || {};
          var out = {};
          Object.keys(patch).forEach(function (k) { if (patch[k] != null && (e[k] != null || patch[k] !== base[k])) out[k] = patch[k]; else if (patch[k] == null && e[k] != null) out[k] = null; });
          if (out.listingPrice != null && i.gmp != null && i.gmpBeforeListing == null) out.gmpBeforeListing = FD.lastGmpBefore(i) != null ? FD.lastGmpBefore(i) : i.gmp;
          FD.state.ipoEdits[i.id] = Object.assign({}, e);
          Object.keys(out).forEach(function (k) { if (out[k] == null) delete FD.state.ipoEdits[i.id][k]; else FD.state.ipoEdits[i.id][k] = out[k]; });
          var ed = FD.state.ipoEdits[i.id];
          var subChanged = C.CATS.some(function (c) { var k = C.SUBKEY[c]; return !same(nv('eT' + c), ((i.sub || {})[k] || {}).times) || !same(nv('eA' + c), ((i.apps || {})[k] || {}).applied); });
          if (subChanged) { ed.sub = sub; ed.apps = apps; }
          if (Object.keys(prob).length || ed.override) ed.override = Object.assign({}, ed.override || {}, { prob: prob });
          if (!Object.keys(ed).length) delete FD.state.ipoEdits[i.id];
          FD.save();
        }
        close(); FD.invalidate(); FD.refresh(); FD.toast('IPO saved');
      };
      var rs = b.querySelector('#eReset'); if (rs) rs.onclick = function () { delete FD.state.ipoEdits[i.id]; FD.save(); close(); FD.refresh(); FD.toast('Back to automatic data'); };
      var dl = b.querySelector('#eDel'); if (dl) dl.onclick = function () {
        if (FD.state.deals.some(function (d) { return d.ipoId === i.id; })) { FD.toast('This IPO has deals; delete them first', true); return; }
        FD.state.customIpos = FD.state.customIpos.filter(function (x) { return x.id !== i.id; }); FD.save(); close(); FD.sel.ipo = null; FD.refresh();
      };
    });
  }
  FD.editIpo = editIpo;
})();
