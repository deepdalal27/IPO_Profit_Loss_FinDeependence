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

async function page(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      const t = await r.text();
      if (r.status === 200 && !/Just a moment|cf-chl/i.test(t.slice(0, 5000))) return parseHTML(t).document;
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

async function gmpTracker(year) {
  const doc = await page(`${BASE}/report/ipo-gmp-performance-tracker/377/all/?year=${year}`);
  const out = [];
  if (!doc) return out;
  for (const tr of doc.querySelectorAll('tbody tr')) {
    const c = cells(tr); if (!c.IPO) continue;
    const a = c.IPO.querySelector('a'); const id = idOf(a && a.getAttribute('href')); if (!id) continue;
    const ld = txt(c['Listing Dt']).match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
    const lp = txt(c['Listing Price']).match(/₹?\s*([\d,.]+)\s*\((-?[\d.]+)%\)/);
    out.push({ igId: id.id, slug: id.slug, name: txt(a), symbol: txt(c.Symbol), listingDate: ld ? iso(2000 + +ld[3], MON[ld[2].toLowerCase()], ld[1]) : null,
      subTotal: num(txt(c.Sub)), gmpFinal: num(txt(c.GMP)), price: num(txt(c.Price)), listingPrice: lp ? num(lp[1]) : null, listingGainPct: lp ? +lp[2] : null,
      dayCloseGainPct: num((txt(c['Listing Day Close']).match(/\((-?[\d.]+)%\)/) || [])[1]) });
  }
  return out;
}

// GMP page: day-wise GMP history + IPO dates
async function gmpPage(slug, id, year) {
  const doc = await page(`${BASE}/gmp/${slug}/${id}/`);
  if (!doc) return null;
  const series = [];
  for (const tr of doc.querySelectorAll('table.gmp-table tbody tr, table tbody tr')) {
    const c = cells(tr);
    const dCell = c['GMP Date & Time'] || c['GMP Date'] || tr.querySelector('td');
    const g = c.GMP; if (!dCell || !g) continue;
    const dm = txt(dCell).match(/(\d{1,2})-([A-Za-z]{3})/); if (!dm) continue;
    const badge = txt(dCell).replace(/.*\d{1,2}:\d{2}/, '').trim();
    series.push({ d: `${dm[2]}-${dm[1]}`, mon: MON[dm[2].toLowerCase()], day: +dm[1], gmp: num(txt(g)), tag: badge.slice(0, 20) });
  }
  // IPO dates from page text, e.g. "IPO Date ... 29 Oct 2026 to 2 Nov 2026" or "Open Date 29 Oct"
  const body = doc.body ? doc.body.textContent.replace(/\s+/g, ' ') : '';
  const rng = body.match(/(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3})[a-z]*,?[ -](\d{4})\s*(?:to|-|–)\s*(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3})[a-z]*,?[ -](\d{4})/);
  const ctx = (body.match(/.{0,80}(?:Open Date|IPO Date|Opening).{0,120}/) || [''])[0];
  return { series, openDate: rng ? iso(rng[3], MON[rng[2].toLowerCase()], rng[1]) : null, closeDate2: rng ? iso(rng[6], MON[rng[5].toLowerCase()], rng[4]) : null, dateCtx: ctx.slice(0, 200) };
}

(async () => {
  const now = new Date();
  const years = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [now.getUTCFullYear() - 1, now.getUTCFullYear()];
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { ipos: [] };
  const byId = new Map(old.ipos.map((x) => [x.igId, x]));
  for (const y of years) {
    const subs = await subscriptionReport(y); await sleep(1500);
    const trk = await gmpTracker(y); await sleep(1500);
    console.log(`${y}: subscription rows ${subs.length}, tracker rows ${trk.length}`);
    if (subs[0]) console.log('  sample sub: ' + JSON.stringify(subs[0]));
    if (trk[0]) console.log('  sample trk: ' + JSON.stringify(trk[0]));
    for (const s of subs) byId.set(s.igId, Object.assign(byId.get(s.igId) || {}, s));
    for (const t of trk) { const cur = byId.get(t.igId) || { igId: t.igId, slug: t.slug, name: t.name }; Object.assign(cur, { symbol: t.symbol, listingDate: t.listingDate, gmpFinal: t.gmpFinal, listingPrice: t.listingPrice, listingGainPct: t.listingGainPct, dayCloseGainPct: t.dayCloseGainPct, subTotalT: t.subTotal }); if (cur.price == null) cur.price = t.price; byId.set(t.igId, cur); }
  }
  // GMP pages (only for IPOs without a stored series)
  let n = 0;
  for (const x of byId.values()) {
    if (x.gmpSeries && x.openDate) continue;
    const g = await gmpPage(x.slug, x.igId);
    if (g) {
      const yr = +(x.closeDate || x.listingDate || `${years[years.length - 1]}`).slice(0, 4);
      const cm = x.closeDate ? +x.closeDate.slice(5, 7) : null;
      x.gmpSeries = g.series.map((p) => ({ date: iso(cm && p.mon > cm + 1 ? yr - 1 : (cm && p.mon < cm - 6 ? yr + 1 : yr), p.mon, p.day), gmp: p.gmp, tag: p.tag })).reverse();
      if (g.openDate) x.openDate = g.openDate;
      if (!x.closeDate && g.closeDate2) x.closeDate = g.closeDate2;
      if (n < 3) console.log(`  gmp page ${x.slug}: ${g.series.length} points, open ${g.openDate}, ctx: ${g.dateCtx}`);
    }
    n++; if (n % 25 === 0) { console.log(`  gmp pages ${n}`); fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'investorgain.com', ipos: [...byId.values()] })); }
    await sleep(1200);
  }
  const ipos = [...byId.values()].sort((a, b) => String(b.closeDate || b.listingDate || '').localeCompare(String(a.closeDate || a.listingDate || '')));
  fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'investorgain.com (subscription, GMP); NSE for mainboard check', ipos }, null, 0) + '\n');
  console.log(`history.json: ${ipos.length} IPOs`);
})();
