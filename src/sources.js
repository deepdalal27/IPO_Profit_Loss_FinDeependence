// IPO data sources used by the GitHub Actions sync (scripts/sync.js).
//  1. NSE public IPO API: current + upcoming issues, issue details and category-wise live subscription.
//  2. ipopremium.in: home list (GMP) and IPO pages (GMP, subscription, application-wise data, lots, listing price).
//  3. investorgain.com live GMP report: GMP and subscription for anything still missing.
// A page that shows a bot check is skipped, never bypassed. The app's "Update from IPO Premium" button covers those runs.
const { parseHTML } = require('linkedom');
const P = require('../site/js/parse.js');

const UA = 'findeependence-ipo-desk/1.0 (IPO calendar; github.com/deepdalal27)';
const isWall = (body) => /<title>\s*Just a moment|cf-chl|challenge-platform/i.test(String(body).slice(0, 8000));

async function get(url, accept = 'text/html') {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  const body = await r.text();
  return { status: r.status, body, wall: isWall(body), url: r.url };
}

// ---------- NSE ----------
const NSE = 'https://www.nseindia.com/api';
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function nseDate(s) {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s || '');
  return m && MONTHS[m[2].toLowerCase()] ? `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
function nsePrice(s) {
  const v = (String(s || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((x) => x > 0);
  return v.length ? { low: Math.min(...v), high: Math.max(...v) } : { low: null, high: null };
}
async function nseJson(path) {
  const r = await get(NSE + path, 'application/json');
  if (r.status !== 200) throw new Error(`NSE ${r.status} ${path}`);
  return JSON.parse(r.body);
}
// Category-wise subscription (shares offered / bid / times)
async function nseSubscription(symbol, series) {
  const d = await nseJson(`/ipo-active-category?symbol=${encodeURIComponent(symbol)}${series ? '&series=' + series : ''}`);
  const rows = d.dataList || d.data || [];
  const sub = {};
  for (const row of rows) {
    if (!row || !row.category) continue;
    const k = P.catKey(row.category); if (!k || sub[k]) continue;
    const pick = (re) => { const key = Object.keys(row).find((x) => re.test(x)); return key ? P.num(row[key]) : null; };
    sub[k] = { offered: pick(/offer/i), applied: pick(/bid/i), times: pick(/meant|times/i) };
  }
  return Object.keys(sub).length ? { sub, subUpdated: d.updateTime || null } : null;
}
async function nseList() {
  const errors = [], out = [];
  const [cur, up] = await Promise.all([
    nseJson('/ipo-current-issue').catch((e) => { errors.push(e.message); return null; }),
    nseJson('/all-upcoming-issues?category=ipo').catch((e) => { errors.push(e.message); return null; }),
  ]);
  if (!cur && !up) throw new Error('NSE unreachable: ' + errors.join('; '));
  const seen = new Set();
  for (const r of [...(cur || []), ...(up || [])]) {
    if (!r || !r.symbol || seen.has(r.symbol) || !['EQ', 'SME'].includes(r.series)) continue;
    seen.add(r.symbol);
    const p = nsePrice(r.issuePrice);
    const o = { source: 'NSE', symbol: r.symbol, name: r.companyName, type: r.series === 'SME' ? 'SME' : 'Mainboard', exchange: r.series === 'SME' ? 'NSE SME' : 'Mainboard',
      openDate: nseDate(r.issueStartDate), closeDate: nseDate(r.issueEndDate), priceLow: p.low, priceHigh: p.high };
    try {
      const d = await nseJson(`/ipo-detail?symbol=${encodeURIComponent(r.symbol)}&series=${r.series}`);
      const info = {};
      for (const row of d?.issueInfo?.dataList || []) if (row && row.title) info[row.title.trim()] = row.value;
      const lot = String(info['Bid Lot'] || info['Lot Size'] || info['Minimum Order Quantity'] || '').replace(/,/g, '').match(/\d+/);
      if (lot) o.lotSize = +lot[0];
      if (info['Name of the Registrar']) o.registrar = String(info['Name of the Registrar']).replace(/\s+/g, ' ').trim();
    } catch (e) { errors.push(`${r.symbol} detail: ${e.message}`); }
    try { const s = await nseSubscription(r.symbol, r.series); if (s) Object.assign(o, s); } catch (e) { /* not open yet */ }
    out.push(o);
  }
  return { ipos: out, errors };
}

// ---------- ipopremium ----------
async function ippHome() {
  const r = await get('https://www.ipopremium.in/');
  if (r.wall) return { blocked: true };
  if (r.status !== 200) return { error: r.status };
  const { document } = parseHTML(r.body);
  return { ipos: P.parseList(document) };
}
async function ippDetail(id, slug = 'ipo') {
  const url = `https://www.ipopremium.in/view/ipo/${id}/${slug}`;
  const r = await get(url);
  if (r.wall) return { blocked: true };
  if (r.status !== 200) return { missing: true, status: r.status };
  const { document } = parseHTML(r.body);
  const d = P.parseDetail(document, r.url || url);
  return d ? { ipo: d } : { missing: true };
}

// ---------- investorgain live GMP ----------
async function investorgain() {
  const r = await get('https://www.investorgain.com/report/live-ipo-gmp/331/');
  if (r.wall || r.status !== 200) throw new Error(`investorgain ${r.status}${r.wall ? ' (bot check)' : ''}`);
  const { document } = parseHTML(r.body);
  const out = [];
  for (const tr of document.querySelectorAll('tr')) {
    const cell = (label) => tr.querySelector(`td[data-label="${label}"]`) || [...tr.querySelectorAll('td')].find((td) => (td.getAttribute('data-label') || '').startsWith(label));
    const nameCell = cell('Name'); if (!nameCell) continue;
    const a = nameCell.querySelector('a');
    const badges = [...nameCell.querySelectorAll('.badge')].map((b) => b.textContent.trim());
    const exch = badges.find((b) => /SME|BSE|NSE|Mainboard/i.test(b)) || 'Mainboard';
    const g = cell('GMP'); const gb = g && g.querySelector('b'); const gtxt = gb ? gb.textContent.trim() : '';
    const sub = cell('Sub');
    // text before the first <br> (the cell often adds a small second line)
    const first = (label) => {
      const c = cell(label); if (!c) return '';
      let t = '';
      for (const n of (c.querySelector('.mono-num') || c).childNodes) { if (n.nodeName === 'BR' || n.nodeName === 'SMALL') break; t += n.textContent; }
      return t.trim() || c.textContent.trim();
    };
    out.push({
      source: 'investorgain', name: P.cleanName(a ? (a.getAttribute('title') || a.textContent) : nameCell.textContent),
      exchange: /SME/i.test(exch) ? exch.toUpperCase() : 'Mainboard', type: /SME/i.test(exch) ? 'SME' : 'Mainboard',
      gmp: /^-?\d/.test(gtxt) ? P.num(gtxt) : null,
      subTotal: sub ? P.num(sub.textContent) : null,
      priceHigh: P.num(first('Price')), lotSize: P.num(first('Lot')), issueSizeCr: P.num(first('IPO Size')),
      openDate: P.isoDate(first('Open')), closeDate: P.isoDate(first('Close')),
      allotmentDate: P.isoDate(first('BoA')), listingDate: P.isoDate(first('Listing')),
    });
  }
  return out;
}

module.exports = { nseList, nseSubscription, ippHome, ippDetail, investorgain, isWall };
