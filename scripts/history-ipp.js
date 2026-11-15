// Adds IPO Premium (ipopremium.in) data to site/history.json: final category-wise subscription (QIB, sHNI, bHNI, Retail),
// applications and winners per category, lots, issue size, dates and listing price — Mainboard, NSE SME and BSE SME.
// IPO pages are listed in the site's sitemap and allowed by its robots.txt. A page that shows a bot check is skipped
// (never bypassed) and retried on the next run. Usage: node scripts/history-ipp.js [sinceISO=2025-01-01]
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const P = require('../site/js/parse.js');
const M = require('../site/js/merge.js');

const OUT = path.join(__dirname, '..', 'site', 'history.json');
const UA = { 'User-Agent': 'findeependence-ipo-desk/1.0 (IPO research; github.com/deepdalal27)', Accept: 'text/html,application/xml' };
const SINCE = process.argv[2] || '2025-01-01';
const BUDGET_MS = (+process.env.BUDGET_MIN || 50) * 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

async function get(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const body = await r.text();
  return { status: r.status, body, url: r.url, wall: /Just a moment|cf-chl|challenge-platform/i.test(body.slice(0, 6000)) };
}

// Application-wise rows matched to categories by their "reserved" count (labels differ between Mainboard and SME)
function appsByCategory(doc, d) {
  const out = {};
  for (const sec of doc.querySelectorAll('.sp-sub-section')) {
    if (!/Application-?Wise/i.test(txt(sec.querySelector('.sp-sub-title')))) continue;
    for (const tr of sec.querySelectorAll('tbody tr')) {
      const c = [...tr.querySelectorAll('td')].map(txt); if (c.length < 3) continue;
      const reserved = P.num(c[1]), applied = P.num(c[2]); if (applied == null) continue;
      let k = null;
      if (/retail|individual/i.test(c[0])) k = 'rii';
      else if (/employee|share ?holder/i.test(c[0])) k = null;
      else if (d.lots && reserved != null) { if (d.lots.bnii && d.lots.bnii.reserved === reserved) k = 'bhni'; else if (d.lots.snii && d.lots.snii.reserved === reserved) k = 'shni'; }
      if (!k && /hni|nii/i.test(c[0])) k = /2\s*[-–]\s*10|2\s*to\s*10|small|shni/i.test(c[0]) ? 'shni' : /10|big|bhni/i.test(c[0]) ? 'bhni' : null;
      if (k && !out[k]) out[k] = { reserved, applied };
    }
  }
  return out;
}

(async () => {
  const t0 = Date.now();
  const hist = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { ipos: [] };
  const done = hist.ippDone || (hist.ippDone = {}); // id -> 1 (final) | 'old' (before SINCE) | 'na' (not an IPO page)
  // Page list: the sitemap when it loads, otherwise page numbers (an unknown slug redirects to the right page).
  let urls = [];
  try {
    const sm = await get('https://www.ipopremium.in/sitemap.xml');
    if (sm.status === 200 && !sm.wall) urls = [...new Set((sm.body.match(/https:\/\/www\.ipopremium\.in\/view\/ipo\/\d+\/[^<\s"]+/g) || []))].map((u) => ({ u, id: +u.match(/\/ipo\/(\d+)\//)[1] }));
    else console.log('sitemap not readable (' + sm.status + '), using page numbers');
  } catch (e) { console.log('sitemap: ' + e.message + ', using page numbers'); }
  const known = new Set(urls.map((x) => x.id));
  const maxId = Math.max(1445, hist.ippMaxId || 0, ...urls.map((x) => x.id), ...hist.ipos.map((x) => x.ippId || 0));
  const MIN_ID = +process.env.IPP_MIN_ID || 550;
  if (!urls.length) for (let id = maxId + 12; id >= MIN_ID; id--) urls.push({ u: `https://www.ipopremium.in/view/ipo/${id}/ipo`, id });
  else for (let id = maxId + 1; id <= maxId + 12; id++) if (!known.has(id)) urls.push({ u: `https://www.ipopremium.in/view/ipo/${id}/ipo`, id });
  urls.sort((a, b) => b.id - a.id);
  const todo = urls.filter((x) => !done[x.id]);
  console.log(`${urls.length} IPO pages listed, ${todo.length} to read`);
  let read = 0, added = 0, updated = 0, blocked = 0, streak = 0, old = 0;
  const save = () => { hist.ippUpdatedAt = new Date().toISOString(); fs.writeFileSync(OUT, JSON.stringify(hist) + '\n'); };
  for (const { u, id } of todo) {
    if (Date.now() - t0 > BUDGET_MS) { console.log('time budget reached, rest next run'); break; }
    let r;
    try { r = await get(u); } catch (e) { console.log(`  ${id}: ${e.message}`); await sleep(2500); continue; }
    if (r.wall || r.status === 403 || r.status === 429) { blocked++; streak++; if (streak >= 8) { console.log('bot check on 8 pages in a row, stopping for now'); break; } await sleep(4000); continue; }
    streak = 0;
    if (r.status !== 200) { if ((r.status === 404 || r.status === 410) && id <= maxId) done[id] = 'na'; await sleep(1200); continue; }
    const doc = parseHTML(r.body).document;
    const d = P.parseDetail(doc, r.url);
    read++;
    if (!d || !d.name) { if (id <= maxId) done[id] = 'na'; await sleep(1500); continue; }
    if (id > (hist.ippMaxId || 0)) hist.ippMaxId = id;
    const close = d.closeDate || d.listingDate;
    if (close && close < SINCE) { done[id] = 'old'; old++; await sleep(1200); continue; }
    const s = d.sub || {};
    const hasCats = s.retail && s.retail.times != null;
    if (!close || !hasCats || !d.listingPrice) { await sleep(1500); continue; } // not finished yet: read again next run
    const price = d.priceHigh || d.priceLow;
    const seg = d.type === 'SME' ? 'SME' : 'Mainboard';
    let x = hist.ipos.find((h) => h.ippId === id) || hist.ipos.find((h) => (h.seg || (h.exchange === 'Mainboard' ? 'Mainboard' : 'SME')) === seg && h.closeDate && Math.abs(Date.parse(h.closeDate) - Date.parse(close)) <= 5 * 864e5 &&
      (M.nameKey(h.name) === M.nameKey(d.name) || M.nameKey(h.name).split(' ')[0] === M.nameKey(d.name).split(' ')[0]));
    if (!x) { x = { igId: 'ipp-' + id, name: d.name }; hist.ipos.push(x); added++; } else updated++;
    x.ippId = id; x.ippUrl = d.ippUrl; x.seg = seg; x.exchange = d.exchange || x.exchange || seg;
    if (price) x.price = price;
    if (d.issueSizeCr) x.sizeCr = d.issueSizeCr;
    if (d.lotSize) x.lotSize = d.lotSize;
    if (d.openDate) x.openDate = d.openDate;
    if (d.closeDate) x.closeDate = d.closeDate;
    if (d.listingDate) x.listingDate = d.listingDate;
    x.listingPrice = d.listingPrice; if (price) x.listingGainPct = +((d.listingPrice - price) / price * 100).toFixed(2);
    const keepNse = x.subSource === 'NSE';
    const map = { qib: 'qib', nii: 'nii', snii: 'shni', bnii: 'bhni', retail: 'rii', total: 'total' };
    for (const k of Object.keys(map)) if (s[k] && s[k].times != null && !(keepNse && x[map[k]] != null)) x[map[k]] = s[k].times;
    if (!keepNse) x.subSource = 'IPO Premium';
    x.offered = {}; for (const k of Object.keys(map)) if (s[k] && s[k].offered) x.offered[map[k]] = s[k].offered;
    const apps = appsByCategory(doc, d); if (Object.keys(apps).length) x.apps = apps;
    if (d.lots) x.lots = { rii: d.lots.retail && d.lots.retail.lots, shni: d.lots.snii && d.lots.snii.lots, bhni: d.lots.bnii && d.lots.bnii.lots };
    done[id] = 1;
    if (read % 25 === 0) { console.log(`  read ${read} · added ${added} · updated ${updated} · before ${SINCE}: ${old} · bot check ${blocked}`); save(); }
    await sleep(1600);
  }
  hist.ipos.sort((a, b) => String(b.closeDate || b.listingDate || '').localeCompare(String(a.closeDate || a.listingDate || '')));
  save();
  const full = hist.ipos.filter((x) => x.rii != null && x.qib != null);
  console.log(`done: read ${read}, added ${added}, updated ${updated}, older ${old}, bot check ${blocked}. history: ${hist.ipos.length} IPOs, ${full.length} with category subscription (${full.filter((x) => x.seg === 'SME').length} SME), ${hist.ipos.filter((x) => x.apps && x.apps.rii).length} with application counts`);
})();
