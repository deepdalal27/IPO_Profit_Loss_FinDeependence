// Temporary: checks which IPO data pages answer from GitHub's runners.
const urls = process.argv.slice(2);
(async () => {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; findeependence-ipo-desk/1.0)', Accept: 'text/html,application/json' }, signal: AbortSignal.timeout(25000) });
      const t = await r.text();
      const title = (t.match(/<title>([^<]*)/i) || [])[1] || '';
      const links = [...new Set((t.match(/href="[^"]*(?:gmp|subscription|ipo)[^"]*"/gi) || []))].slice(0, 25);
      console.log(`\n=== ${u}\nstatus ${r.status} bytes ${t.length} title: ${title.trim().slice(0, 120)} wall: ${/Just a moment|cf-chl/i.test(t.slice(0, 5000))}`);
      console.log(links.join('\n'));
      const tbl = t.indexOf('<table'); if (tbl > 0) console.log('TABLE>> ' + t.slice(tbl, tbl + 3000).replace(/\s+/g, ' '));
    } catch (e) { console.log(`\n=== ${u}\nERROR ${e.message}`); }
    await new Promise((r) => setTimeout(r, 1500));
  }
})();
