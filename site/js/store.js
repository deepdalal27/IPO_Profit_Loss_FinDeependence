/* FinDeependence IPO Deal Desk · state, IPO assembly, deal results. Data stays in this browser (localStorage). */
(function () {
  var C = window.FDCalc, M = window.FDMerge;
  var KEY = 'fd-ipo-deal-desk-v1';
  var FD = window.FD = { feed: { ipos: [] }, C: C };

  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIST() { return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); }
  FD.uid = uid; FD.today = todayIST;

  var DEFAULT = {
    v: 1, investors: [], brokers: [], deals: [], ipoEdits: {}, customIpos: [], imported: [],
    settings: { marginPct: 25, factors: { RETAIL: 1.3, SHNI: 1.05, BHNI: 5, RETAIL_SME: 1 }, defaults: { buyType: 'KOSTAK', sellType: 'KOSTAK' }, theme: 'auto' },
    savedAt: null, backupAt: null, changesSinceBackup: 0
  };
  FD.load = function () {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    FD.state = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), s || {});
    FD.state.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT.settings)), FD.state.settings || {});
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  };
  FD.save = function (quiet) {
    FD.state.savedAt = new Date().toISOString();
    if (!quiet) FD.state.changesSinceBackup = (FD.state.changesSinceBackup || 0) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(FD.state)); } catch (e) { FD.toast && FD.toast('Could not save: browser storage is full or blocked', true); }
    FD._ipos = null;
  };

  /* ---------- IPOs: feed + imported pages + hand-added, then your edits on top ---------- */
  FD.ipos = function () {
    if (FD._ipos) return FD._ipos;
    var list = JSON.parse(JSON.stringify(FD.feed.ipos || []));
    (FD.state.imported || []).forEach(function (imp) {
      var cur = M.findSame(list, imp);
      if (cur && cur.updatedAt && imp.parsedAt && cur.updatedAt > imp.parsedAt) return; // feed is newer
      M.upsert(list, Object.assign({}, imp, { source: imp.source || 'ipopremium' }), imp.parsedAt);
    });
    (FD.state.customIpos || []).forEach(function (c) {
      var cur = list.find(function (x) { return x.id === c.id; }) || M.findSame(list, c);
      if (cur) { Object.keys(c).forEach(function (k) { if (k !== 'id' && c[k] != null && c[k] !== '') cur[k] = c[k]; }); }
      else list.push(Object.assign({ manual: true }, c));
    });
    var edits = FD.state.ipoEdits || {};
    list.forEach(function (i) {
      var e = edits[i.id]; if (!e) return;
      i.edited = Object.keys(e);
      Object.keys(e).forEach(function (k) {
        var v = e[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          i[k] = i[k] || {};
          Object.keys(v).forEach(function (kk) { if (v[kk] && typeof v[kk] === 'object') i[k][kk] = Object.assign({}, i[k][kk] || {}, v[kk]); else i[k][kk] = v[kk]; });
        } else i[k] = v;
      });
    });
    // deals may point to IPOs that dropped off the feed: keep a stub
    var ids = {}; list.forEach(function (i) { ids[i.id] = 1; });
    (FD.state.deals || []).forEach(function (d) { if (!ids[d.ipoId] && d.ipoSnap) { list.push(Object.assign({}, d.ipoSnap, { id: d.ipoId })); ids[d.ipoId] = 1; } });
    var t = todayIST();
    list.forEach(function (i) { i.stage = C.stage(i, t); i.bookDate = i.listingDate || i.closeDate || i.openDate || ''; });
    list.sort(function (a, b) { return String(b.openDate || '').localeCompare(String(a.openDate || '')); });
    FD._ipos = list;
    FD._ipoMap = {}; list.forEach(function (i) { FD._ipoMap[i.id] = i; });
    return list;
  };
  FD.ipo = function (id) { FD.ipos(); return FD._ipoMap[id]; };
  FD.invalidate = function () { FD._ipos = null; };

  FD.setIpoEdit = function (id, patch) {
    var e = FD.state.ipoEdits[id] = FD.state.ipoEdits[id] || {};
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (v === null || v === '' || (typeof v === 'number' && isNaN(v))) delete e[k];
      else if (typeof v === 'object' && !Array.isArray(v)) { e[k] = Object.assign({}, e[k] || {}, v); }
      else e[k] = v;
    });
    if (!Object.keys(e).length) delete FD.state.ipoEdits[id];
    FD.save();
  };

  /* ---------- people ---------- */
  FD.investor = function (id) { return FD.state.investors.find(function (x) { return x.id === id; }); };
  FD.broker = function (id) { return FD.state.brokers.find(function (x) { return x.id === id; }); };
  FD.invName = function (id) { var x = FD.investor(id); return x ? x.name : '(deleted)'; };
  FD.brkName = function (id) { var x = FD.broker(id); return x ? x.name : (id ? '(deleted)' : '—'); };

  /* ---------- deals with computed results ---------- */
  FD.result = function (d) { var ipo = FD.ipo(d.ipoId) || d.ipoSnap || {}; return C.dealResult(d, ipo, { factors: FD.state.settings.factors }); };
  FD.rows = function (filter) {
    FD.ipos();
    var out = [];
    FD.state.deals.forEach(function (d) {
      var ipo = FD.ipo(d.ipoId) || d.ipoSnap || { id: d.ipoId, name: '?' };
      var r = C.dealResult(d, ipo, { factors: FD.state.settings.factors });
      var row = { d: d, ipo: ipo, r: r, month: (ipo.bookDate || d.createdAt || '').slice(0, 7), date: ipo.bookDate || (d.createdAt || '').slice(0, 10) };
      row.sebiP = C.probability(ipo, d.cat, FD.state.settings.factors).p;
      if (!filter || filter(row)) out.push(row);
    });
    return out;
  };
  // Snapshot IPO basics on the deal so history survives feed changes.
  FD.snap = function (ipo) {
    return { name: ipo.name, type: ipo.type, priceHigh: ipo.priceHigh, priceLow: ipo.priceLow, lotSize: ipo.lotSize, openDate: ipo.openDate, closeDate: ipo.closeDate, allotmentDate: ipo.allotmentDate, listingDate: ipo.listingDate, lots: ipo.lots };
  };

  /* totals over rows */
  FD.sum = function (rows) {
    var t = { n: rows.length, allotted: 0, decided: 0, final: 0, open: 0, Di: 0, Db: 0, L: 0, inv: 0, brk: 0, profit: 0, expProfit: 0, expOpen: 0, worst: 0,
      expKnown: 0, recvInv: 0, payInv: 0, recvBrk: 0, payBrk: 0, hedged: 0, expP: 0, expPn: 0, cats: { RETAIL: 0, SHNI: 0, BHNI: 0 } };
    rows.forEach(function (x) {
      var r = x.r, d = x.d;
      t.cats[d.cat] = (t.cats[d.cat] || 0) + 1;
      if (r.hedged) t.hedged++;
      if (d.allot !== 'PENDING') { t.decided++; if (d.allot === 'YES') t.allotted++; }
      if (d.allot !== 'PENDING' && x.sebiP != null) { t.expP += x.sebiP; t.expPn++; }
      if (r.final) {
        t.final++; t.Di += r.Di; t.Db += r.Db; t.L += (r.A ? r.L : 0); t.inv += r.invNet; t.brk += r.brkNet; t.profit += r.profit;
        if (!d.invSettled) { if (r.invNet > 0) t.recvInv += r.invNet; else t.payInv += -r.invNet; }
        if (r.hedged && !d.brkSettled) { if (r.brkNet > 0) t.recvBrk += r.brkNet; else t.payBrk += -r.brkNet; }
      } else {
        t.open++;
        if (r.exp) { t.expOpen += r.exp.profit; t.expKnown++; }
        if (r.worst != null) t.worst += r.worst;
      }
      if (r.exp) t.expProfit += r.exp.profit;
    });
    t.hit = t.decided ? t.allotted / t.decided : null;
    return t;
  };

  FD.fmt = function (v, dp) { return C.inr(v, dp); };
  FD.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  FD.dt = function (iso) { if (!iso) return '—'; var d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')); return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); };
  FD.mon = function (ym) { if (!ym) return '—'; var d = new Date(ym + '-01T00:00:00'); return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); };
  FD.pct = function (v, dp) { return v == null || isNaN(v) ? '—' : (v * 100).toFixed(dp == null ? 1 : dp) + '%'; };
  FD.oneIn = function (p) { return p == null ? '—' : p >= 1 ? 'Sure' : p <= 0 ? '0' : '1 in ' + (1 / p >= 100 ? Math.round(1 / p) : (1 / p).toFixed(1)); };
  FD.signed = function (v, cls) {
    if (v == null || isNaN(v)) return '<span class="muted">—</span>';
    var c = v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : 'muted';
    return '<span class="' + (cls === false ? '' : c) + '">' + (v > 0.5 ? '+' : '') + C.inr(Math.round(v)) + '</span>';
  };
  // Financial year (Apr–Mar) of a date
  FD.fy = function (iso) { if (!iso) return ''; var y = +iso.slice(0, 4), m = +iso.slice(5, 7); var s = m >= 4 ? y : y - 1; return 'FY' + String(s + 1).slice(2); };
  FD.periodRange = function (key, from, to) {
    var t = todayIST(), y = +t.slice(0, 4), m = +t.slice(5, 7);
    var fyStart = (m >= 4 ? y : y - 1);
    function ym(yy, mm) { while (mm <= 0) { mm += 12; yy--; } return yy + '-' + String(mm).padStart(2, '0'); }
    switch (key) {
      case 'month': return [ym(y, m) + '-01', ym(y, m) + '-31'];
      case 'last3': return [ym(y, m - 2) + '-01', ym(y, m) + '-31'];
      case 'fy': return [fyStart + '-04-01', (fyStart + 1) + '-03-31'];
      case 'lfy': return [(fyStart - 1) + '-04-01', fyStart + '-03-31'];
      case 'custom': return [from || '0000', to || '9999'];
      default: return ['0000', '9999'];
    }
  };
})();
