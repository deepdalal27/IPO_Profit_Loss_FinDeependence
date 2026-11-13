// Temporary probe (pagination + subscription page layout)
const { parseHTML } = require('linkedom');
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; findeependence-ipo-desk/1.0)', Accept: 'text/html' };
const go = async (u, deep) => {
  const r = await fetch(u, { headers: UA }); const t = await r.text(); const { document } = parseHTML(t);
  const rows = [...document.querySelectorAll('tbody tr')];
  const names = rows.slice(0, 2).concat(rows.slice(-1)).map((tr) => (tr.querySelector('td') || {}).textContent?.replace(/\s+/g, ' ').trim().slice(0, 40));
  const links = [...new Set([...document.querySelectorAll('a')].map((a) => a.getAttribute('href') || '').filter((h) => /page|year|\?/.test(h)))].slice(0, 40);
  console.log(`\n=== ${u}\nstatus ${r.status} rows ${rows.length} first/last: ${names.join(' || ')}\nlinks: ${links.join(' ')}`);
  if (deep) {
    for (const k of ['Retail', 'QIB', 'NII', 'bNII', 'Total']) { const i = t.indexOf(k + '\\'); const j = t.indexOf('>' + k); console.log(`-- ${k}: ${i >= 0 ? t.slice(i - 200, i + 300).replace(/\s+/g, ' ') : ''} ## ${j >= 0 ? t.slice(j - 300, j + 400).replace(/\s+/g, ' ') : ''}`); }
    console.log('TABLES: ' + document.querySelectorAll('table').length + ' ' + [...document.querySelectorAll('table')].map((x) => x.className + ':' + x.querySelectorAll('tr').length).join(','));
  }
  await new Promise((res) => setTimeout(res, 1500));
};
(async () => {
  const B = 'https://www.investorgain.com';
  await go(B + '/report/ipo-subscription-live/333/all/?page=2');
  await go(B + '/report/ipo-subscription-live/333/all/2/');
  await go(B + '/report/ipo-subscription-live/333/ipo/?year=2025');
  await go(B + '/report/ipo-gmp-performance-tracker/377/all/?year=2026&page=2');
  await go(B + '/report/ipo-gmp-performance-tracker/377/sme/?year=2026');
  await go(B + '/report/ipo-gmp-performance-tracker/377/ipo/?year=2026');
  await go(B + '/subscription/rentomojo-ipo/2231/', true);
})();
