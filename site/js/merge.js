/* FinDeependence · merge IPO records from different sources into one list (used by the sync job and the app). */
(function (root) {
  var STOP = { LIMITED: 1, LTD: 1, PVT: 1, PRIVATE: 1, IPO: 1, SME: 1, THE: 1, AND: 1, OF: 1, CO: 1, COMPANY: 1, INDIA: 1 };
  function nameKey(s) {
    return String(s || '').replace(/\((?:BSE SME|NSE SME|MAINBOARD|BSE|NSE)\)/gi, '').replace(/\s+IPO\b.*$/i, '').toUpperCase()
      .replace(/&/g, ' AND ').replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(function (w) { return w && !STOP[w]; }).join(' ');
  }
  function idFor(o) {
    if (o.ippId) return 'ipp-' + o.ippId;
    if (o.symbol) return 'nse-' + o.symbol;
    return 'ipo-' + nameKey(o.name).toLowerCase().replace(/\s+/g, '-');
  }
  function findSame(list, o) {
    var k = nameKey(o.name), head = k.split(' ').slice(0, 2).join(' ');
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (o.ippId && x.ippId === o.ippId) return x;
      if (o.symbol && x.symbol === o.symbol) return x;
    }
    for (var j = 0; j < list.length; j++) if (k && nameKey(list[j].name) === k) return list[j];
    if (o.openDate && o.closeDate && head) {
      for (var m = 0; m < list.length; m++) {
        var y = list[m];
        var yk = nameKey(y.name);
        if (y.openDate === o.openDate && y.closeDate === o.closeDate && (yk.split(' ').slice(0, 2).join(' ') === head || yk.split(' ')[0] === k.split(' ')[0])) return y;
      }
    }
    return null;
  }
  var RICH = { sub: 1, apps: 1, lots: 1 };
  // Which source wins a field: higher rank overwrites, lower rank only fills gaps.
  var RANK = { app: 9, NSE: 3, ipopremium: 2, investorgain: 1 };
  var FIELD_RANK = { gmp: { app: 9, ipopremium: 3, investorgain: 2 }, subTotal: { ipopremium: 3, NSE: 2, investorgain: 1 } };
  function rankOf(field, src) { var t = FIELD_RANK[field] || RANK; return t[src] || 0; }
  // Merge `o` into `list` (mutates). Non-empty incoming values win; GMP changes are logged in gmpHistory.
  function upsert(list, o, when) {
    var cur = findSame(list, o), isNew = false;
    if (!cur) { cur = { id: idFor(o) }; list.push(cur); isNew = true; }
    var before = JSON.stringify(cur);
    var oldGmp = cur.gmp;
    if (!cur.source || rankOf('name', o.source) > rankOf('name', cur.source)) cur.source = o.source;
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (v == null || v === '' || k === 'id' || k === 'parsedAt') return;
      if (k === 'source') return;
      var src = o.source || 'app', srcs = cur.src || (cur.src = {});
      var have = cur[k] != null && cur[k] !== '';
      if (have && srcs[k] && rankOf(k, src) < rankOf(k, srcs[k])) return;
      if (RICH[k] && typeof v === 'object') cur[k] = Object.assign({}, cur[k] || {}, v); else cur[k] = v;
      srcs[k] = src;
    });
    if (o.gmp != null && cur.gmp !== oldGmp) {
      var day = (when || new Date().toISOString()).slice(0, 16).replace('T', ' ');
      cur.gmpHistory = (cur.gmpHistory || []).concat([{ t: day, g: cur.gmp }]).slice(-80);
    }
    var changed = JSON.stringify(cur) !== before;
    if (changed) cur.updatedAt = when || new Date().toISOString();
    return { ipo: cur, isNew: isNew, changed: changed };
  }
  var api = { nameKey: nameKey, idFor: idFor, findSame: findSame, upsert: upsert };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FDMerge = api;
})(typeof window !== 'undefined' ? window : globalThis);
