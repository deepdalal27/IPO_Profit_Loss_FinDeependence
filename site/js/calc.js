/* FinDeependence · IPO desk maths
   1. Minimum application sizes per SEBI ICDR (Retail / sHNI / bHNI)
   2. Probability of allotment per SEBI's basis of allotment
   3. Deal settlement: investor (buy side) and broker (sell side), realised and expected */
(function (root) {
  var CATS = ['RETAIL', 'SHNI', 'BHNI'];
  var CAT_LABEL = { RETAIL: 'Retail', SHNI: 'sHNI', BHNI: 'bHNI' };
  var SUBKEY = { RETAIL: 'retail', SHNI: 'snii', BHNI: 'bnii' };
  var DEAL_TYPES = {
    KOSTAK: 'Kostak (fixed ₹ per application, allotted or not)',
    SUBJECT: 'Subject-to (fixed ₹ per application, only if allotted)',
    PREMIUM: 'Premium per share (₹ × allotted shares)',
    NONE: 'Own account (no payout)'
  };
  // Average application size ÷ allotment unit, calibrated from exchange application-wise data
  // (e.g. BLS Polymers / Tonbo Imaging Oct-2026: retail 1.24–1.33, sHNI 1.05–1.06, bHNI 4.9–5.1).
  var DEFAULT_FACTORS = { RETAIL: 1.3, SHNI: 1.05, BHNI: 5.0, RETAIL_SME: 1.0 };

  function n(v) { return v == null || v === '' || isNaN(+v) ? null : +v; }
  function price(ipo) { return n(ipo.issuePrice) || n(ipo.priceHigh) || n(ipo.priceLow) || 0; }

  /* --- Minimum lots ---
     Mainboard: Retail 1 lot (max ₹2L) · sHNI = fewest lots above ₹2L (max ₹10L) · bHNI = fewest lots above ₹10L.
     SME (SEBI, 2025): individual minimum application 2 lots; NII minimum above 2 lots.
     NII allotment unit (both sHNI and bHNI) = minimum NII application size = sHNI minimum (SEBI ICDR, 2022 amendment). */
  function lotRules(ipo) {
    var lot = n(ipo.lotSize) || 0, px = price(ipo), val = lot * px;
    var L = ipo.lots || {};
    var sme = ipo.type === 'SME';
    var r = {
      RETAIL: n(L.retail && L.retail.lots) || (sme ? 2 : 1),
      SHNI: n(L.snii && L.snii.lots) || (val ? Math.max(sme ? 3 : 1, Math.floor(200000 / val) + 1) : null),
      BHNI: n(L.bnii && L.bnii.lots) || (val ? Math.floor(1000000 / val) + 1 : null)
    };
    r.RETAIL_MAX = sme ? r.RETAIL : (val ? Math.max(1, Math.floor(200000 / val)) : null);
    r.SHNI_MAX = val ? Math.floor(1000000 / val) : null;
    r.lot = lot; r.price = px; r.lotValue = val;
    return r;
  }
  // Shares one successful applicant gets (the "allotment unit").
  function unitShares(ipo, cat) {
    var r = lotRules(ipo);
    if (!r.lot) return 0;
    return (cat === 'RETAIL' ? r.RETAIL : r.SHNI) * r.lot;
  }
  function minShares(ipo, cat) { var r = lotRules(ipo); return (r[cat] || 0) * r.lot; }

  /* --- Probability of allotment (SEBI basis of allotment) ---
     Retail: when oversubscribed, each successful applicant gets the minimum bid lot; winners by lottery.
             p = (retail shares ÷ unit) ÷ valid applications.
     sHNI / bHNI: each successful applicant gets the minimum NII application size; winners by lottery;
             any balance is allotted proportionately.  p = (category shares ÷ NII unit) ÷ applications.
     Uses the application count when available; otherwise estimates applications from share subscription. */
  function probability(ipo, cat, factors) {
    var f = Object.assign({}, DEFAULT_FACTORS, factors || {});
    var ov = ipo.override && ipo.override.prob && n(ipo.override.prob[cat]);
    if (ov != null) return { p: Math.max(0, Math.min(1, ov / 100)), basis: 'manual', times: null };
    var key = SUBKEY[cat], sub = (ipo.sub || {})[key] || {}, apps = (ipo.apps || {})[key] || {};
    var times = n(sub.times);
    var basisT = null;
    if (times == null && ipo.override && ipo.override.times && n(ipo.override.times[cat]) != null) { times = n(ipo.override.times[cat]); basisT = 'assumed'; }
    if (times == null && ipo.predicted && n(ipo.predicted[cat]) != null) { times = n(ipo.predicted[cat]); basisT = 'predicted'; }
    var lot = n(ipo.lotSize), unit = unitShares(ipo, cat);
    // 1. application-wise data
    if (n(apps.applied) && n(apps.reserved)) {
      return { p: Math.min(1, apps.reserved / apps.applied), basis: 'applications', times: times, unitsAvail: apps.reserved, appsApplied: apps.applied };
    }
    if (n(apps.applied) && n(sub.offered) && unit) {
      var avail = Math.floor(sub.offered / unit);
      return { p: Math.min(1, avail / apps.applied), basis: 'applications', times: times, unitsAvail: avail, appsApplied: apps.applied };
    }
    // 2. estimate from times subscribed (shares)
    if (times != null) {
      if (times <= 1) return { p: 1, basis: basisT || 'undersubscribed', times: times };
      var fac = cat === 'RETAIL' ? (ipo.type === 'SME' ? f.RETAIL_SME : f.RETAIL) : f[cat];
      var res = { p: Math.min(1, fac / times), basis: basisT || 'estimated', times: times };
      if (n(sub.offered) && unit) { res.unitsAvail = Math.floor(sub.offered / unit); res.appsApplied = Math.round(res.unitsAvail / res.p); }
      return res;
    }
    return { p: null, basis: 'none', times: null, lot: lot };
  }

  /* --- Opportunity per category: what a normal applicant can expect --- */
  function opportunity(ipo, cat, factors, marginPct) {
    var pr = probability(ipo, cat, factors);
    var gmp = n(ipo.gmp);
    var unit = unitShares(ipo, cat);
    var gain = gmp != null ? gmp * unit : null; // listing gain if allotted
    var ev = gain != null && pr.p != null ? gain * pr.p : null;
    var m = (n(marginPct) == null ? 25 : n(marginPct)) / 100;
    return {
      cat: cat, p: pr.p, basis: pr.basis, times: pr.times, unitShares: unit, minLots: lotRules(ipo)[cat],
      gainIfAllotted: gain, expected: ev,
      fairKostak: ev, fairSubject: gain,
      bidKostak: ev != null ? Math.max(0, Math.floor(ev * (1 - m) / 10) * 10) : null,
      bidSubject: gain != null ? Math.max(0, Math.floor(gain * (1 - m) / 10) * 10) : null,
      appsApplied: pr.appsApplied, unitsAvail: pr.unitsAvail,
      blockAmount: lotRules(ipo)[cat] * lotRules(ipo).lotValue
    };
  }

  /* --- Stage of an IPO on a given day --- */
  function stage(ipo, today) {
    var t = today || new Date().toISOString().slice(0, 10);
    if (n(ipo.listingPrice) != null || n(ipo.settlePrice) != null) return 'Listed';
    if (ipo.listingDate && t > ipo.listingDate) return 'Listed';
    if (ipo.listingDate && t === ipo.listingDate) return 'Listing';
    if (ipo.allotmentDate && t >= ipo.allotmentDate) return 'Allotted';
    if (ipo.closeDate && t > ipo.closeDate) return 'Closed';
    if (ipo.openDate && t >= ipo.openDate) return 'Open';
    if (ipo.openDate) return 'Upcoming';
    return 'Upcoming';
  }

  function payout(type, rate, allotted, shares) {
    rate = n(rate) || 0;
    if (type === 'KOSTAK') return rate;
    if (type === 'SUBJECT') return allotted ? rate : 0;
    if (type === 'PREMIUM') return allotted ? rate * shares : 0;
    return 0;
  }
  function expectedPayout(type, rate, p, shares) {
    rate = n(rate) || 0;
    if (type === 'KOSTAK') return rate;
    if (type === 'SUBJECT') return p * rate;
    if (type === 'PREMIUM') return p * rate * shares;
    return 0;
  }

  /* --- One application (deal) ---
     Investor side: investor keeps the deal amount; I take the listing profit/loss.
        invNet = (listing P/L if allotted) − payout to investor     (+ = receive from investor, − = pay investor)
     Broker side (optional): broker pays me the deal amount and takes the listing profit/loss.
        brkNet = broker deal amount − (listing P/L if allotted)       (+ = receive from broker, − = pay broker)
     My profit = invNet + brkNet. */
  function dealResult(deal, ipo, opts) {
    opts = opts || {};
    var issue = price(ipo);
    var unit = unitShares(ipo, deal.cat);
    var allot = deal.allot || 'PENDING';
    var A = allot === 'YES';
    var S = A ? (n(deal.shares) != null ? n(deal.shares) : unit) : 0;
    var sellPx = n(deal.sellPrice) != null ? n(deal.sellPrice) : (n(ipo.settlePrice) != null ? n(ipo.settlePrice) : n(ipo.listingPrice));
    var buy = deal.buyType || 'KOSTAK', sell = deal.brokerId ? (deal.sellType || 'KOSTAK') : null;
    var L = A && sellPx != null ? (sellPx - issue) * S : (A ? null : 0);
    var final = allot !== 'PENDING' && (L != null);
    var r = { unit: unit, A: A, S: S, issue: issue, sellPx: sellPx, final: final, allot: allot, hedged: !!sell, buy: buy, sell: sell };
    r.Di = payout(buy, deal.buyRate, A, S);
    r.Db = sell ? payout(sell, deal.sellRate, A, S) : 0;
    if (final) {
      r.L = L;
      r.invNet = (A ? L : 0) - r.Di;
      r.brkNet = sell ? r.Db - (A ? L : 0) : 0;
      r.profit = r.invNet + r.brkNet;
    }
    // Expected values (always computed; equals the realised value once final)
    var pr = allot === 'YES' ? 1 : allot === 'NO' ? 0 : probability(ipo, deal.cat, opts.factors).p;
    var gmp = n(ipo.gmp);
    var expS = A ? S : unit;
    var expL = sellPx != null ? (sellPx - issue) * expS : (gmp != null ? gmp * expS : null);
    r.p = pr;
    if (final) {
      r.exp = { invNet: r.invNet, brkNet: r.brkNet, profit: r.profit, Di: r.Di, Db: r.Db, L: r.L };
    } else if (pr != null) {
      var eL = expL == null ? 0 : expL;
      var eDi = expectedPayout(buy, deal.buyRate, pr, expS), eDb = sell ? expectedPayout(sell, deal.sellRate, pr, expS) : 0;
      var inv = pr * eL - eDi, brk = sell ? eDb - pr * eL : 0;
      r.exp = { invNet: inv, brkNet: brk, profit: inv + brk, Di: eDi, Db: eDb, L: pr * eL, gmpMissing: expL == null };
      // Downside: the IPO lists flat (at issue price) — only the deal amounts remain.
      var outs = allot === 'YES' ? [true] : allot === 'NO' ? [false] : [false, true];
      r.worst = Math.min.apply(null, outs.map(function (a) { return (sell ? payout(sell, deal.sellRate, a, expS) : 0) - payout(buy, deal.buyRate, a, expS); }));
    } else {
      r.exp = null;
    }
    return r;
  }

  // Indian number format
  function inr(v, dp) {
    if (v == null || isNaN(v)) return '—';
    var neg = v < 0; v = Math.abs(v);
    var s = v.toFixed(dp == null ? 0 : dp), parts = s.split('.'), x = parts[0];
    var last3 = x.slice(-3), rest = x.slice(0, -3);
    if (rest) last3 = ',' + last3;
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return (neg ? '−' : '') + '₹' + rest + last3 + (parts[1] ? '.' + parts[1] : '');
  }
  function validPan(p) { return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(p || '').toUpperCase().trim()); }

  var api = { CATS: CATS, CAT_LABEL: CAT_LABEL, SUBKEY: SUBKEY, DEAL_TYPES: DEAL_TYPES, DEFAULT_FACTORS: DEFAULT_FACTORS,
    lotRules: lotRules, unitShares: unitShares, minShares: minShares, probability: probability, opportunity: opportunity,
    stage: stage, payout: payout, dealResult: dealResult, inr: inr, validPan: validPan, price: price };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FDCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
