// Builds site/history.json: past IPOs (2025 + 2026) with final category-wise subscription, issue size, GMP during the
// issue, listing gain and issue dates. Source: investorgain.com reports + IPO GMP pages (run from GitHub Actions).
// Usage: node scripts/history.js [years...]   (default: current and previous year)
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const BASE = 'https://www.investorgain.com';
const OUT = path.join(__dirname, '..', 'site', 'history.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; findeependence-ipo-desk/1.0)', Accept: 'text/html' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const num = (s) => { const m = String(s || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Next.js pages ship part of their HTML inside self.__next_f.push([1,"..."]) strings: decode and append them.
function rsc(html) {
  let out = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) { try { out += JSON.parse('"' + m[1] + '"'); } catch (e) { /* skip */ } }
  return out.replace(/^[0-9a-z]+:T[0-9a-f]+,/gim, '');
}
async function page(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      const t = await r.text();
      if (r.status === 200 && !/Just a moment|cf-chl/i.test(t.slice(0, 5000))) return parseHTML(t + '<div id="__rsc">' + rsc(t) + '</div>').document;
      console.log(`  ${url} -> ${r.status}`);
    } catch (e) { console.log(`  ${url} -> ${e.message}`); }
    await sleep(3000);
  }
  return null;
}
function cells(tr) { const o = {}; for (const td of tr.querySelectorAll('td')) o[(td.getAttribute('data-label') || td.getAttribute('data-title') || '').trim()] = td; return o; }
function idOf(href) { const m = String(href || '').match(/\/(?:gmp|subscription|ipo)\/([^/]+)\/(\d+)\//); return m ? { slug: m[1], id: +m[2] } : null; }

async function subscriptionReport(year) {
  const doc = await page(`${BASE}/report/ipo-subscription-live/333/all/?year=${year}`);
  const out = [];
  if (!doc) return out;
  for (const tr of doc.querySelectorAll('tbody tr')) {
    const c = cells(tr); if (!c.Name) continue;
    const a = c.Name.querySelector('a'); const id = idOf(a && a.getAttribute('href')); if (!id) continue;
    const nameTxt = txt(a);
    const badge = [...c.Name.querySelectorAll('.badge, span')].map(txt).find((b) => /SME|BSE|NSE/.test(b)) || '';
    const cd = txt(c['Closing Date']).match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    const totalEl = c.Total; const tot = totalEl ? num((totalEl.querySelector('b, strong, .mono-num') || totalEl).childNodes[0] ? (totalEl.childNodes[0].textContent || txt(totalEl)) : txt(totalEl)) : null;
    out.push({ igId: id.id, slug: id.slug, name: nameTxt.replace(/\s+IPO$/i, ''), exchange: /SME/.test(badge) ? (/BSE/.test(badge) ? 'BSE SME' : 'NSE SME') : 'Mainboard',
      total: tot, qib: num(txt(c.QIB)), shni: num(txt(c.SHNI)), bhni: num(txt(c.BHNI)), nii: num(txt(c.NII)), rii: num(txt(c.RII)),
      anchor: /✅/.test(txt(c.Anchor)), sizeCr: num(txt(c['IPO Size'])), price: num(txt(c['IPO Price'])), pe: num(txt(c['P/E'])),
      closeDate: cd ? iso(cd[3], cd[2], cd[1]) : null, _totalRaw: txt(c.Total) });
  }
  return out;
}

async function gmpTracker(year, kind) {
  const doc = await page(`${BASE}/report/ipo-gmp-performance-tracker/377/${kind}/?year=${year}`);
  const out = [];
  if (!doc) return out;
  for (const tr of doc.querySelectorAll('tbody tr')) {
    const c = cells(tr); if (!c.IPO) continue;
    const a = c.IPO.querySelector('a'); const id = idOf(a && a.getAttribute('href')); if (!id) continue;
    const ld = txt(c['Listing Dt']).match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
    const lp = txt(c['Listing Price']).match(/₹?\s*([\d,.]+)\s*\((-?[\d.]+)%\)/);
    out.push({ igId: id.id, slug: id.slug, name: txt(a), symbol: txt(c.Symbol), seg: kind === 'sme' ? 'SME' : 'Mainboard', sizeCr: num(txt(c.Size)), listingDate: ld ? iso(2000 + +ld[3], MON[ld[2].toLowerCase()], ld[1]) : null,
      subTotal: num(txt(c.Sub)), gmpFinal: num(txt(c.GMP)), price: num(txt(c.Price)), listingPrice: lp ? num(lp[1]) : null, listingGainPct: lp ? +lp[2] : null,
      dayCloseGainPct: num((txt(c['Listing Day Close']).match(/\((-?[\d.]+)%\)/) || [])[1]) });
  }
  return out;
}

// IPO subscription page: final times subscribed per category
const P = require('../site/js/parse.js');
async function subPage(slug, id, debug) {
  const doc = await page(`${BASE}/subscription/${slug}/${id}/`);
  if (!doc) return null;
  const res = {}, resv = {};
  for (const tb of doc.querySelectorAll('table')) {
    const heads = [...tb.querySelectorAll('thead th')].map(txt);
    const rows = [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td, th')].map(txt)).filter((r) => r.length >= 2);
    const cls = tb.getAttribute('class') || '';
    if (/daywise/.test(cls)) {
      if (debug) console.log('  DAYWISE heads=' + JSON.stringify(heads) + ' rows=' + JSON.stringify(rows.slice(0, 8)));
      const hk = heads.map((h) => P.catKey(h));
      if (hk.filter(Boolean).length >= 2) { // columns are categories, rows are days → last row with numbers = final
        const last = rows.filter((r) => r.some((c) => /\d/.test(c))).pop() || [];
        hk.forEach((k, i) => { if (k && res[k] == null && num(last[i]) != null) res[k] = num(last[i]); });
      } else { // rows are categories, columns are days → last numeric cell
        for (const r of rows) { const k = P.catKey(r[0]); if (!k || res[k] != null) continue; const v = r.slice(1).map(num).filter((x) => x != null); if (v.length) res[k] = v[v.length - 1]; }
      }
    } else if (heads.some((h) => /Max Allottees/i.test(h))) { // reservation table
      const si = heads.findIndex((h) => /^Shares$/i.test(h)), ai = heads.findIndex((h) => /Allottees/i.test(h));
      for (const r of rows) { const k = P.catKey(r[0].replace(/^[−-]\s*/, '').replace(/bNII\s*>.*/i, 'bNII').replace(/sNII\s*<.*/i, 'sNII')); if (!k || resv[k]) continue; resv[k] = { shares: num(r[si]), allottees: num(r[ai]) }; }
    }
  }
  if (Object.keys(resv).length) res.reserved = resv;
  return res;
}

// GMP page: day-wise GMP history + IPO dates
async function gmpPage(slug, id, year) {
  const doc = await page(`${BASE}/gmp/${slug}/${id}/`);
  if (!doc) return null;
  const series = [];
  const seen = new Set();
  for (const tr of doc.querySelectorAll('table.gmp-table tbody tr, table tbody tr')) {
    const c = cells(tr);
    const dCell = c['GMP Date & Time'] || c['GMP Date'] || tr.querySelector('td');
    const g = c.GMP; if (!dCell || !g) continue;
    const dm = txt(dCell).match(/(\d{1,2})-([A-Za-z]{3})/); if (!dm) continue;
    if (seen.has(txt(dCell))) continue; seen.add(txt(dCell));
    const badge = txt(dCell).replace(/.*\d{1,2}:\d{2}/, '').trim();
    series.push({ d: `${dm[2]}-${dm[1]}`, mon: MON[dm[2].toLowerCase()], day: +dm[1], gmp: num(txt(g)), tag: badge.slice(0, 20) });
  }
  // IPO dates from page text, e.g. "IPO Date ... 29 Oct 2026 to 2 Nov 2026" or "Open Date 29 Oct"
  const body = doc.body ? doc.body.textContent.replace(/\s+/g, ' ') : '';
  const rng = body.match(/(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3})[a-z]*,?[ -](\d{4})\s*(?:to|-|–)\s*(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3})[a-z]*,?[ -](\d{4})/);
  const ctx = (body.match(/.{0,80}(?:Open Date|IPO Date|Opening).{0,120}/) || [''])[0];
  return { series, openDate: rng ? iso(rng[3], MON[rng[2].toLowerCase()], rng[1]) : null, closeDate2: rng ? iso(rng[6], MON[rng[5].toLowerCase()], rng[4]) : null, dateCtx: ctx.slice(0, 200) };
}

function backBusinessDays(d, n) { const t = new Date(d + 'T00:00:00Z'); while (n > 0) { t.setUTCDate(t.getUTCDate() - 1); const w = t.getUTCDay(); if (w !== 0 && w !== 6) n--; } return t.toISOString().slice(0, 10); }
function fwdBusinessDays(d, n) { const t = new Date(d + 'T00:00:00Z'); while (n > 0) { t.setUTCDate(t.getUTCDate() + 1); const w = t.getUTCDay(); if (w !== 0 && w !== 6) n--; } return t.toISOString().slice(0, 10); }

(async () => {
  const now = new Date();
  const years = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [now.getUTCFullYear() - 1, now.getUTCFullYear()];
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { ipos: [] };
  const byId = new Map(old.ipos.map((x) => [x.igId, x]));
  const save = () => fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'investorgain.com', ipos: [...byId.values()] }));
  // live subscription report (latest IPOs)
  const subs = await subscriptionReport(now.getUTCFullYear());
  console.log(`subscription report: ${subs.length}`);
  for (const s of subs) { const cur = byId.get(s.igId) || {}; Object.assign(cur, s); cur.total = num((s._totalRaw.match(/^\d+(?:\.\d{1,2})?/) || [])[0]); delete cur._totalRaw; byId.set(s.igId, cur); }
  for (const y of years) for (const kind of ['ipo', 'sme']) {
    const trk = await gmpTracker(y, kind); await sleep(1500);
    console.log(`tracker ${y} ${kind}: ${trk.length}`);
    for (const t of trk) {
      const cur = byId.get(t.igId) || { igId: t.igId, slug: t.slug, name: t.name };
      Object.assign(cur, { symbol: t.symbol, seg: t.seg, listingDate: t.listingDate, gmpFinal: t.gmpFinal, listingPrice: t.listingPrice, listingGainPct: t.listingGainPct, dayCloseGainPct: t.dayCloseGainPct, subTotalT: t.subTotal });
      if (cur.price == null) cur.price = t.price; if (cur.sizeCr == null) cur.sizeCr = t.sizeCr; if (!cur.exchange) cur.exchange = t.seg === 'SME' ? 'SME' : 'Mainboard';
      byId.set(t.igId, cur);
    }
  }
  let n = 0, dbg = 0;
  for (const x of byId.values()) {
    if (x.v === 3) continue; // already complete
    if (x.rii == null || !x.reserved) {
      const s = await subPage(x.slug, x.igId, dbg < 2);
      if (s) { dbg++; for (const k of ['qib', 'nii', 'bnii', 'snii', 'retail', 'total', 'emp']) if (s[k] != null) x[{ bnii: 'bhni', snii: 'shni', retail: 'rii' }[k] || k] = s[k]; if (s.reserved) x.reserved = s.reserved; }
      await sleep(1000);
    }
    const g = x.gmpSeries && x.gmpSeries.length > 1 ? null : await gmpPage(x.slug, x.igId);
    if (g && g.series.length) {
      const yr = +(x.listingDate || x.closeDate || String(years[years.length - 1])).slice(0, 4), lm = x.listingDate ? +x.listingDate.slice(5, 7) : null;
      x.gmpSeries = g.series.map((p) => ({ date: iso(lm && p.mon > lm + 2 ? yr - 1 : yr, p.mon, p.day), gmp: p.gmp, tag: p.tag })).sort((a, b) => a.date.localeCompare(b.date));
      const o = x.gmpSeries.find((p) => /\bO$|x O\b/.test(p.tag)), c = x.gmpSeries.find((p) => /x C\b|\bC$/.test(p.tag)), a = x.gmpSeries.find((p) => p.tag === 'A' || /^A\b/.test(p.tag));
      if (o) x.openDate = o.date;
      if (c && !x.closeDate) x.closeDate = c.date;
      if (!x.closeDate && a) x.closeDate = backBusinessDays(a.date, 1);
      if (g.openDate) x.openDate = x.openDate || g.openDate;
    }
    if (!x.closeDate && x.listingDate) x.closeDate = backBusinessDays(x.listingDate, 3);
    if (!x.openDate && x.closeDate) x.openDate = backBusinessDays(x.closeDate, 2);
    if (x.subTotalT != null) x.total = x.subTotalT;
    if (x.rii != null && x.reserved && x.gmpSeries) x.v = 3;
    n++; if (n % 20 === 0) { console.log(`  pages ${n}`); save(); }
    await sleep(1000);
  }
  const ipos = [...byId.values()].sort((a, b) => String(b.closeDate || b.listingDate || '').localeCompare(String(a.closeDate || a.listingDate || '')));
  fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'investorgain.com (final subscription, GMP history, listing)', ipos }) + '\n');
  const full = ipos.filter((x) => x.rii != null && x.qib != null).length;
  console.log(`history.json: ${ipos.length} IPOs, ${full} with category subscription, ${ipos.filter((x) => x.gmpSeries && x.gmpSeries.length).length} with GMP history`);
})();
