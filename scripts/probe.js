// Temporary: inspects investorgain report tables from GitHub's runners.
const { parseHTML } = require('linkedom');
const urls = process.argv.slice(2);
(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; findeependence-ipo-desk/1.0)', Accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
      const t = await r.text();
      const { document } = parseHTML(t);
      const rows = [...document.querySelectorAll('tbody tr')];
      console.log(`\n=== ${u}\nstatus ${r.status} bytes ${t.length} rows ${rows.length}`);
      const pag = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') || '').filter((h) => /page|year|20\d\d|\?/.test(h)).slice(0, 30);
      console.log('PAGINATION/FILTER LINKS: ' + [...new Set(pag)].join(' '));
      for (const tr of rows.slice(0, 3).concat(rows.slice(-2))) {
        console.log('ROW: ' + [...tr.querySelectorAll('td')].map((td) => `[${td.getAttribute('data-label') || td.getAttribute('data-title') || ''}] ${td.textContent.replace(/\s+/g, ' ').trim()}`).join(' | '));
        console.log('  links: ' + [...tr.querySelectorAll('a')].map((a) => a.getAttribute('href')).join(' '));
      }
      const scripts = [...document.querySelectorAll('script')].map((s) => s.textContent).filter((s) => /ajax|fetch\(|api|json/i.test(s)).map((s) => s.replace(/\s+/g, ' ').slice(0, 400));
      console.log('SCRIPTS: ' + scripts.slice(0, 3).join('\n---\n'));
    } catch (e) { console.log(`\n=== ${u}\nERROR ${e.message}`); }
    await new Promise((r) => setTimeout(r, 1500));
  }
})();
