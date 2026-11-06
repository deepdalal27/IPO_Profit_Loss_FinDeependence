// Run by GitHub Actions every 30 minutes: refreshes site/ipos.json (dates, price, lot, GMP, subscription, listing price).
// Usage: node scripts/sync.js            -> all online sources
//        node scripts/sync.js a.html ...  -> also merge saved ipopremium pages (list or IPO pages)
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const P = require('../site/js/parse.js');
const M = require('../site/js/merge.js');
const S = require('../src/sources.js');

const FILE = path.join(__dirname, '..', 'site', 'ipos.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // IST
const daysAgo = (n) => new Date(Date.now() + 5.5 * 3600e3 - n * 864e5).toISOString().slice(0, 10);

(async () => {
  const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { ipos: [] };
  const list = old.ipos || [];
  const now = new Date().toISOString();
  const notes = [];
  let changed = 0;
  const take = (o) => { if (!o || !o.name) return; const r = M.upsert(list, o, now); if (r.changed) changed++; };
  const files = process.argv.slice(2);
  const offline = process.env.OFFLINE === '1' || files.length > 0;

  for (const f of files) {
    const { document } = parseHTML(fs.readFileSync(f, 'utf8'));
    const res = P.parseAny(document, '');
    res.ipos.forEach(take);
    console.log(`${path.basename(f)}: ${res.kind}, ${res.ipos.length} IPO(s)`);
  }

  if (!offline) {
    // 1. NSE
    try { const r = await S.nseList(); r.ipos.forEach(take); notes.push(...r.errors.slice(0, 5)); console.log(`NSE: ${r.ipos.length}`); }
    catch (e) { notes.push('NSE: ' + e.message); console.log('NSE failed:', e.message); }
    // 2. ipopremium list + recent IPO pages
    let blocked = false;
    try {
      const h = await S.ippHome();
      if (h.blocked) { blocked = true; notes.push('ipopremium list: bot check shown, skipped'); }
      else if (h.ipos) { h.ipos.forEach(take); console.log(`ipopremium list: ${h.ipos.length}`); }
    } catch (e) { notes.push('ipopremium list: ' + e.message); }
    const recent = list.filter((i) => i.ippId && (i.listingDate || i.closeDate || '9999') >= daysAgo(4) && !i.listingPrice);
    for (const i of recent) {
      if (blocked) break;
      try {
        const r = await S.ippDetail(i.ippId, i.ippSlug);
        if (r.blocked) { blocked = true; notes.push('ipopremium IPO pages: bot check shown, skipped'); break; }
        if (r.ipo) take(r.ipo);
      } catch (e) { notes.push(`ipopremium ${i.ippId}: ${e.message}`); }
      await sleep(1500);
    }
    // 3. investorgain GMP
    try { const rows = await S.investorgain(); rows.filter((r) => (r.closeDate || '9999') >= daysAgo(30)).forEach(take); console.log(`investorgain: ${rows.length}`); }
    catch (e) { notes.push('investorgain: ' + e.message); console.log('investorgain failed:', e.message); }
  }

  list.sort((a, b) => String(b.openDate || '').localeCompare(String(a.openDate || '')));
  const out = { updatedAt: changed || !old.updatedAt ? now : old.updatedAt, checkedAt: now, today: today(), notes, ipos: list };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
  console.log(`ipos.json: ${list.length} IPOs, ${changed} changed${notes.length ? ' | ' + notes.join(' | ') : ''}`);
})();
