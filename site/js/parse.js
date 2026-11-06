/* FinDeependence · IPO page parsers (ipopremium.in list + IPO detail pages).
   Works on any DOM Document: the browser (app import + bookmarklet) and Node (linkedom, in the GitHub sync).
   Keep this file self-contained: the bookmarklet embeds its source. */
(function (root) {
  var MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

  function clean(s) { return String(s == null ? '' : s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function txt(el) { return el ? clean(el.textContent) : ''; }
  function num(s) {
    var m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  // "Oct 27" | "Nov 3, 2026" | "29-Oct-2026" | "29-Oct" -> ISO date; year picked closest to `ref`.
  function isoDate(s, ref) {
    var str = String(s || ''), d, mon, y, m;
    if ((m = str.match(/(\d{1,2})[\s-]+([A-Za-z]{3})[a-z]*(?:[\s,-]+(\d{4}))?/))) { d = +m[1]; mon = MON[m[2].toUpperCase()]; y = m[3] && +m[3]; }
    else if ((m = str.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/))) { mon = MON[m[1].toUpperCase()]; d = +m[2]; y = m[3] && +m[3]; }
    if (!mon || !d) return null;
    if (!y) {
      var r = ref ? new Date(ref) : new Date(), best = null;
      [r.getFullYear() - 1, r.getFullYear(), r.getFullYear() + 1].forEach(function (yy) {
        var diff = Math.abs(Date.UTC(yy, mon - 1, d) - r.getTime());
        if (!best || diff < best.diff) best = { yy: yy, diff: diff };
      });
      y = best.yy;
    }
    return y + '-' + String(mon).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function exchangeOf(s) {
    var m = String(s || '').match(/\((BSE SME|NSE SME|MAINBOARD|BSE|NSE)\)/i);
    return m ? (m[1].toUpperCase() === 'MAINBOARD' ? 'Mainboard' : m[1].toUpperCase()) : '';
  }
  function cleanName(s) { return clean(String(s || '').replace(/\((?:BSE SME|NSE SME|MAINBOARD|BSE|NSE)\)/gi, '').replace(/\s+IPO\b.*$/i, '')); }
  function ippIdFromUrl(u) { var m = String(u || '').match(/\/view\/ipo\/(\d+)\/([^/?#"]+)/); return m ? { id: +m[1], slug: m[2] } : null; }

  // Category label -> key
  function catKey(label) {
    var l = clean(label).toLowerCase();
    if (/^total/.test(l)) return 'total';
    if (/qib|qualified/.test(l)) return 'qib';
    if (/employee/.test(l)) return 'emp';
    if (/share ?holder/.test(l)) return 'sh';
    if (/anchor/.test(l)) return 'anchor';
    if (/retail|rii|individual/.test(l)) return 'retail';
    if (/(hni|nii|non.?inst|application size|lakh)/.test(l)) {
      if (/2\s*(?:l|lakhs?)?\s*(?:[-–]|to)\s*(?:rs\.?\s*)?10|\b2\s*l?\s*\+|small|shni|snii/.test(l)) return 'snii';
      if (/10\s*l?\s*\+|10l|(?:more than|above|>)\s*(?:rs\.?\s*)?10|big|bhni|bnii/.test(l)) return 'bnii';
      return 'nii';
    }
    if (/^shni/.test(l)) return 'snii';
    if (/^bhni/.test(l)) return 'bnii';
    return null;
  }

  // Every table on the page with its nearest title.
  function titledTables(doc) {
    var out = [];
    var tables = doc.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i], title = '';
      var sec = t.closest ? t.closest('.sp-sub-section') : null;
      if (sec) title = txt(sec.querySelector('.sp-sub-title'));
      if (!title) { var card = t.closest ? t.closest('section, .card') : null; if (card) title = txt(card.querySelector('.ip-card__title, h2, h3')); }
      var rows = [];
      var trs = t.querySelectorAll('tbody tr');
      for (var j = 0; j < trs.length; j++) {
        var cells = trs[j].querySelectorAll('td'), r = [];
        for (var k = 0; k < cells.length; k++) r.push(txt(cells[k]));
        if (r.length) rows.push(r);
      }
      out.push({ title: title, rows: rows });
    }
    return out;
  }

  function parseDetail(doc, url) {
    var crumb = txt(doc.querySelector('.breadcrumb-item.active, [aria-current="page"]'));
    var canonical = (doc.querySelector('link[rel="canonical"]') || {}).href || (doc.querySelector('meta[property="og:url"]') || {}).content || url || '';
    var idm = ippIdFromUrl(canonical) || ippIdFromUrl(url);
    var name = txt(doc.querySelector('.ip-hero__name')) || cleanName(crumb);
    if (!name || !doc.querySelector('.ip-stat')) return null;
    var exchange = exchangeOf(crumb);
    var ref = null;
    var chips = doc.querySelectorAll('.ip-hero__meta .ip-chip');
    for (var c = 0; c < chips.length; c++) { var mm = txt(chips[c]).match(/([A-Za-z]{3} \d{1,2}, \d{4})/); if (mm) ref = isoDate(mm[1]); }
    var o = {
      source: 'ipopremium', name: cleanName(name), exchange: exchange || 'Mainboard', type: /SME/i.test(exchange) ? 'SME' : 'Mainboard',
      ippId: idm ? idm.id : null, ippSlug: idm ? idm.slug : null, ippUrl: idm ? 'https://www.ipopremium.in/view/ipo/' + idm.id + '/' + idm.slug : null,
      parsedAt: new Date().toISOString()
    };
    // Hero stats
    var stats = doc.querySelectorAll('.ip-stat');
    for (var s = 0; s < stats.length; s++) {
      var lab = txt(stats[s].querySelector('.ip-stat__label')), val = txt(stats[s].querySelector('.ip-stat__value')), sub = txt(stats[s].querySelector('.ip-stat__sub'));
      if (/GMP/i.test(lab)) { o.gmp = /--|n\/?a/i.test(val) ? null : num(val); if (o.gmp == null && /₹\s*0\b/.test(val)) o.gmp = 0; }
      else if (/Price Band/i.test(lab)) {
        var pb = val.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*[–\-]\s*(\d+(?:\.\d+)?)/);
        if (pb) { o.priceLow = +pb[1]; o.priceHigh = +pb[2]; } else { o.priceHigh = num(val); o.priceLow = o.priceHigh; }
        var cr = sub.match(/([\d,.]+)\s*cr/i); if (cr) o.issueSizeCr = num(cr[1]);
      }
      else if (/Lot Size/i.test(lab)) o.lotSize = num(val);
      else if (/Subscribed/i.test(lab)) { o.subTotal = num(val); }
      else if (/Listing Gain/i.test(lab)) { var lp = sub.match(/listed at\s*₹?\s*([\d,.]+)/i); if (lp) o.listingPrice = num(lp[1]); }
    }
    // Timeline
    var steps = doc.querySelectorAll('.ip-timeline__step');
    for (var t = 0; t < steps.length; t++) {
      var l = txt(steps[t].querySelector('.ip-timeline__label')).toLowerCase(), d = isoDate(txt(steps[t].querySelector('.ip-timeline__date')), ref);
      if (/open/.test(l)) o.openDate = d; else if (/close/.test(l)) o.closeDate = d; else if (/allot/.test(l)) o.allotmentDate = d; else if (/list/.test(l)) o.listingDate = d;
    }
    // Tables
    var tabs = titledTables(doc);
    tabs.forEach(function (tb) {
      var title = tb.title.toLowerCase();
      if (/subscription details/.test(title)) {
        o.sub = {};
        tb.rows.forEach(function (r) { var k = catKey(r[0]); if (k && r.length >= 4) o.sub[k] = { offered: num(r[1]), applied: num(r[2]), times: num(r[3]) }; });
      } else if (/application-?wise/.test(title)) {
        o.apps = {};
        tb.rows.forEach(function (r) { var k = catKey(r[0]); if (k && r.length >= 3) o.apps[k] = { reserved: num(r[1]), applied: num(r[2]), times: num(r[3]) }; });
      } else if (/lot size/.test(title)) {
        o.lots = {};
        tb.rows.forEach(function (r) {
          var l0 = r[0].toLowerCase(), k = /retail|individual/.test(l0) ? 'retail' : /^s-?hni|small/.test(l0) ? 'snii' : /^b-?hni|big/.test(l0) ? 'bnii' : null;
          if (k) o.lots[k] = { lots: num(r[1]), shares: num(r[2]), amount: num(r[3]), reserved: num(r[4]) };
        });
      } else if (/listing price/.test(title)) {
        tb.rows.forEach(function (r) { var p = num(r[1]); if (/nse/i.test(r[0])) o.listingNse = p; else if (/bse/i.test(r[0])) o.listingBse = p; });
        o.listingPrice = o.listingNse || o.listingBse || o.listingPrice || null;
      }
    });
    var upd = txt(doc.querySelector('.sp-sub-text'));
    var um = upd.match(/(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{2}:\d{2})/); if (um) o.subUpdated = isoDate(um[1]) + ' ' + um[2];
    var reg = doc.querySelector('#sec-registrar, [aria-labelledby="registrar-title"]');
    if (reg) { var rn = reg.querySelector('.ip-card__body strong, .ip-card__body b, .ip-card__body a, .ip-card__body p'); o.registrar = txt(rn) || null; }
    return o;
  }

  // List page: the plain table inside <noscript> (always present) or the rendered DataTable.
  function parseList(doc, ref) {
    var out = [], seen = {};
    function add(o) { if (o && o.ippId && !seen[o.ippId]) { seen[o.ippId] = 1; out.push(o); } }
    var ns = doc.querySelectorAll('noscript');
    for (var i = 0; i < ns.length; i++) {
      var html = ns[i].innerHTML || ns[i].textContent || '';
      if (!/view\/ipo\//.test(html)) continue;
      var rows = html.split(/<tr[\s>]/i).slice(1);
      rows.forEach(function (row) {
        var cells = row.split(/<td[^>]*>/i).slice(1).map(function (c) { return clean(c.replace(/<\/td>[\s\S]*$/i, '').replace(/<[^>]+>/g, ' ').replace(/&ndash;|&#8211;/g, '-').replace(/&amp;/g, '&').replace(/&#8377;/g, '')); });
        var href = (row.match(/href="([^"]+)"/) || [])[1];
        var id = ippIdFromUrl(href);
        if (!id || cells.length < 7) return;
        var band = cells[5].replace(/,/g, '').match(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?/);
        add({
          source: 'ipopremium', ippId: id.id, ippSlug: id.slug, ippUrl: 'https://www.ipopremium.in/view/ipo/' + id.id + '/' + id.slug,
          name: cleanName(cells[0]), exchange: exchangeOf(cells[0]) || (cells[1] === 'SME' ? 'SME' : 'Mainboard'), type: /SME/i.test(cells[1] + cells[0]) ? 'SME' : 'Mainboard',
          gmp: /^-?\d/.test(cells[2]) ? num(cells[2]) : null,
          openDate: isoDate(cells[3], ref), closeDate: isoDate(cells[4], ref),
          priceLow: band ? +band[1] : null, priceHigh: band ? +(band[2] || band[1]) : null,
          listingDate: isoDate(cells[6], ref)
        });
      });
    }
    // Rendered DataTable rows (when the noscript copy is missing)
    var trs = doc.querySelectorAll('#table_ajax tbody tr');
    for (var j = 0; j < trs.length; j++) {
      var a = trs[j].querySelector('a[href*="/view/ipo/"]'); if (!a) continue;
      var id2 = ippIdFromUrl(a.getAttribute('href')); var tds = trs[j].querySelectorAll('td');
      if (!id2 || seen[id2.id]) continue;
      var g = txt(trs[j].querySelector('.hm-c-gmp')), price = txt(trs[j].querySelector('.hm-c-price')).replace(/,/g, '').match(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?/);
      var dates = txt(trs[j].querySelector('.hm-c-dates'));
      var dm = dates.split(/\s[–-]\s|\sto\s/);
      add({
        source: 'ipopremium', ippId: id2.id, ippSlug: id2.slug, ippUrl: 'https://www.ipopremium.in/view/ipo/' + id2.id + '/' + id2.slug,
        name: cleanName(txt(a)), exchange: exchangeOf(txt(tds[0])), type: /SME/i.test(txt(tds[0])) ? 'SME' : 'Mainboard',
        gmp: /-?\d/.test(g) && !/--/.test(g) ? num(g) : null,
        openDate: isoDate(dm[0], ref), closeDate: isoDate(dm[1] || '', ref),
        priceLow: price ? +price[1] : null, priceHigh: price ? +(price[2] || price[1]) : null,
        lotSize: num(txt(trs[j].querySelector('.hm-c-lot'))),
        allotmentDate: isoDate(txt(trs[j].querySelector('.hm-c-allot')), ref), listingDate: isoDate(txt(trs[j].querySelector('.hm-c-listing')), ref)
      });
    }
    return out;
  }

  function parseAny(doc, url) {
    var d = parseDetail(doc, url);
    if (d) return { kind: 'detail', ipos: [d] };
    return { kind: 'list', ipos: parseList(doc) };
  }

  var api = { parseDetail: parseDetail, parseList: parseList, parseAny: parseAny, isoDate: isoDate, cleanName: cleanName, catKey: catKey, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FDParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
