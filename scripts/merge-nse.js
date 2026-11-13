// One-off / occasional: merge NSE's official consolidated category subscription (Mainboard) into site/history.json.
// Usage: node scripts/merge-nse.js nse_hist.json   (rows with name, closeDate, qib, nii, shni, bhni, rii, total, sizeCr)
const fs = require('fs');
const path = require('path');
const M = require('../site/js/merge.js');
const FILE = path.join(__dirname, '..', 'site', 'history.json');
const hist = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const nse = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).ipos;
const CATS = ['qib', 'shni', 'bhni', 'rii', 'total'];
let matched = 0, added = 0; const diffs = [];
for (const n of nse) {
  const x = hist.ipos.find((h) => (h.seg || h.exchange) !== 'SME' && Math.abs(Date.parse(h.closeDate) - Date.parse(n.closeDate)) <= 3 * 864e5 && M.nameKey(h.name).split(' ')[0] === M.nameKey(n.name).split(' ')[0]);
  if (!x) {
    if (!n.sizeCr || !n.price) continue;
    hist.ipos.push({ igId: 'nse-' + n.igId, name: n.name.replace(/\s+Limited$/i, ''), exchange: 'Mainboard', seg: 'Mainboard', price: n.price, sizeCr: n.sizeCr, openDate: n.openDate, closeDate: n.closeDate, qib: n.qib, nii: n.nii, shni: n.shni, bhni: n.bhni, rii: n.rii, total: n.total, subSource: 'NSE', v: 4 });
    added++; continue;
  }
  matched++;
  for (const c of CATS) if (x[c] != null && n[c] != null) diffs.push(Math.abs(Math.log(x[c] / n[c])));
  for (const c of ['qib', 'nii', 'shni', 'bhni', 'rii', 'total']) if (n[c] != null) x[c] = n[c];
  if (n.openDate) x.openDate = n.openDate;
  x.subSource = 'NSE';
}
diffs.sort((a, b) => a - b);
const within = diffs.filter((d) => d < Math.log(1.02)).length;
hist.nseCheck = { matched, added, compared: diffs.length, within2pct: within, checkedAt: new Date().toISOString() };
fs.writeFileSync(FILE, JSON.stringify(hist) + '\n');
console.log(`NSE: matched ${matched}, added ${added}; investorgain vs NSE: ${within}/${diffs.length} values within 2%`);
