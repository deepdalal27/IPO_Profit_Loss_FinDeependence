// Temporary: can GitHub's runners read IPO Premium pages? (no bot-check bypass; a challenged page is just reported)
const { parseHTML } = require('linkedom');
const P = require('../site/js/parse.js');
const UA = { 'User-Agent': 'findeependence-ipo-desk/1.0 (IPO research; github.com/deepdalal27)', Accept: 'text/html' };
const urls = ['https://www.ipopremium.com/', 'https://www.ipopremium.in/', 'https://www.ipopremium.in/sitemap.xml',
  'https://www.ipopremium.in/view/ipo/1414/bls-polymers-ltd', 'https://www.ipopremium.in/view/ipo/1429/hgs', 'https://www.ipopremium.in/view/ipo/1343/acme-india-industries-ltd',
  'https://www.ipopremium.in/view/ipo/1200/x', 'https://www.ipopremium.in/view/ipo/1000/x', 'https://www.ipopremium.in/view/ipo/800/x', 'https://www.ipopremium.in/view/subscription'];
(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(25000) });
      const t = await r.text();
      const wall = /Just a moment|cf-chl|challenge-platform/i.test(t.slice(0, 6000));
      let info = '';
      if (!wall && /view\/ipo\/\d+/.test(u)) { const d = P.parseDetail(parseHTML(t).document, r.url); info = d ? JSON.stringify({ name: d.name, ex: d.exchange, close: d.closeDate, gmp: d.gmp, lp: d.listingPrice, sub: d.sub, apps: d.apps, lots: d.lots }) : 'not an IPO page'; }
      if (!wall && /sitemap/.test(u)) info = 'ipo urls: ' + (t.match(/view\/ipo\/\d+/g) || []).length + ' sample ' + (t.match(/<loc>[^<]+/g) || []).slice(0, 5).join(' ');
      console.log(`\n=== ${u}\nstatus ${r.status} final ${r.url} bytes ${t.length} botcheck ${wall} title ${(t.match(/<title>([^<]*)/) || [])[1]}\n${info}`);
    } catch (e) { console.log(`\n=== ${u}\nERROR ${e.message} ${e.cause ? e.cause.code || e.cause.message : ''}`); }
    await new Promise((r) => setTimeout(r, 2000));
  }
})();
