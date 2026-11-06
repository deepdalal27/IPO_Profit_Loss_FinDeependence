/* FinDeependence IPO Deal Desk · Data & Settings: IPO Premium update button, page import, backup / restore, settings, demo. */
(function () {
  var FD = window.FD, C = FD.C, P = window.FDParse, M = window.FDMerge;

  // Merge IPOs parsed from ipopremium.in (bookmarklet, saved pages or pasted data) into this browser's data.
  FD.importParsed = function (ipos) {
    var n = 0, now = new Date().toISOString();
    ipos.forEach(function (o) {
      if (!o || !o.name) return;
      o = Object.assign({}, o, { source: 'ipopremium', parsedAt: o.parsedAt || now });
      var cur = M.findSame(FD.state.imported, o);
      if (cur) { var h = cur.gmpHistory; Object.keys(o).forEach(function (k) { if (o[k] != null && o[k] !== '') cur[k] = (k === 'sub' || k === 'apps' || k === 'lots') ? Object.assign({}, cur[k] || {}, o[k]) : o[k]; }); cur.gmpHistory = h; }
      else { cur = Object.assign({}, o); FD.state.imported.push(cur); }
      if (o.gmp != null) {
        var feedIpo = M.findSame(FD.feed.ipos || [], o);
        var base = (cur.gmpHistory && cur.gmpHistory.length) ? cur.gmpHistory : ((feedIpo && feedIpo.gmpHistory) || []);
        if (!base.length || base[base.length - 1].g !== o.gmp) cur.gmpHistory = base.concat([{ t: now.slice(0, 16).replace('T', ' '), g: o.gmp }]).slice(-80);
        else cur.gmpHistory = base;
      }
      n++;
    });
    // keep imports for 120 days
    var cutoff = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
    FD.state.imported = FD.state.imported.filter(function (x) { return (x.listingDate || x.closeDate || '9999') >= cutoff; });
    FD.state.lastImportAt = now;
    FD.save(true); FD.invalidate();
    return n;
  };

  function bookmarkletHref(src) {
    var app = location.origin + location.pathname;
    var runner = "(function(){var APP=" + JSON.stringify(app) + ";if(!/ipopremium\\.in$/.test(location.hostname)){alert('Open www.ipopremium.in first (home page or any IPO page), then click this bookmark.');return;}" +
      "var w=window.open('about:blank','fdipodesk');var box=document.createElement('div');box.style.cssText='position:fixed;z-index:2147483647;right:16px;bottom:16px;background:#0E2740;color:#fff;padding:14px 16px;border-radius:12px;font:600 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:340px';document.body.appendChild(box);" +
      "function say(t){box.textContent='FinDeependence · '+t;}" +
      "var res=FDParse.parseAny(document,location.href),out=res.ipos;" +
      "function done(){var j=JSON.stringify({v:1,at:new Date().toISOString(),ipos:out});var b=btoa(unescape(encodeURIComponent(j)));var u=APP+'#ipp='+b;try{navigator.clipboard.writeText(j).catch(function(){});}catch(e){}if(w&&!w.closed){w.location.href=u;say('Sent '+out.length+' IPOs to your desk ✓');setTimeout(function(){box.remove();},4000);}else{box.innerHTML='';var a=document.createElement('a');a.href=u;a.target='_blank';a.textContent='Open FinDeependence with '+out.length+' IPOs →';a.style.color='#7FD3D6';box.appendChild(a);}}" +
      "if(res.kind==='detail'){done();return;}" +
      "var lim=new Date(Date.now()-6*864e5).toISOString().slice(0,10);var todo=out.filter(function(i){return !i.listingDate||i.listingDate>=lim;});var k=0;" +
      "(function next(){if(k>=todo.length){done();return;}var it=todo[k++];say('Reading '+k+' of '+todo.length+': '+it.name);fetch(it.ippUrl,{credentials:'include'}).then(function(r){return r.text();}).then(function(h){var d=new DOMParser().parseFromString(h,'text/html');var x=FDParse.parseDetail(d,it.ippUrl);if(x){for(var key in x){if(x[key]!=null)it[key]=x[key];}}}).catch(function(){}).then(function(){setTimeout(next,700);});})();})();";
    return 'javascript:' + encodeURIComponent(src + '\n' + runner);
  }

  FD.renderData = function () {
    var el = document.getElementById('v-data');
    var s = FD.state.settings, fi = FD.feed;
    var html = '<div class="grid2"><div class="card"><h3>Update IPOs &amp; GMP from IPO Premium</h3>' +
      '<p class="sub">Automatic: a GitHub job refreshes the IPO list, GMP and subscription every 30 minutes (last check: ' + (fi.checkedAt ? new Date(fi.checkedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—') + '). IPO Premium sometimes shows a bot check to servers — then use the one-click button below from your own browser.</p>' +
      '<div class="bm-row"><a class="bm" id="bm" href="#">⟳ FinDeependence · Update IPOs</a><span class="muted small">Drag this button to your bookmarks bar (one time).</span></div>' +
      '<ol class="steps small"><li>Open <a href="https://www.ipopremium.in/" target="_blank" rel="noopener">ipopremium.in</a> (home page = all IPOs, or any single IPO page).</li><li>Click the bookmark. It reads GMP, subscription by category, application counts, lots and listing prices for every recent IPO.</li><li>This desk opens and updates by itself. ' + (FD.state.lastImportAt ? 'Last update: ' + new Date(FD.state.lastImportAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + '.' : '') + '</li></ol>' +
      '<div class="row" style="margin-top:10px"><label class="fakebtn">Import saved IPO Premium pages (.html)<input type="file" id="htmlFiles" accept=".html,.htm" multiple hidden></label><button id="pasteData">Paste copied data</button></div>' +
      (fi.notes && fi.notes.length ? '<p class="muted small">Last automatic run: ' + FD.esc(fi.notes.join(' · ')) + '</p>' : '') + '</div>';
    html += '<div class="card"><h3>Backup &amp; restore</h3><p class="sub">Your investors, PANs and deals are saved only in this browser. Download a backup regularly and restore it on any other computer or phone.</p>' +
      '<div class="row"><button class="primary" id="bkJson">Download backup</button><label class="fakebtn">Restore backup<input type="file" id="bkFile" accept=".json,application/json" hidden></label><button id="bkXls">Excel of everything</button></div>' +
      '<p class="muted small">' + (FD.state.backupAt ? 'Last backup ' + new Date(FD.state.backupAt).toLocaleString('en-IN') + '. ' : 'No backup yet. ') + FD.state.investors.length + ' investors · ' + FD.state.brokers.length + ' brokers · ' + FD.state.deals.length + ' deals.</p>' +
      '<h3 style="margin-top:14px">Demo</h3><p class="sub">See the desk with sample investors and deals; remove it with one click.</p><div class="row"><button id="demoOn">Load demo data</button><button class="danger" id="demoOff">Remove demo data</button><button class="danger" id="wipe">Erase everything</button></div></div></div>';
    html += '<div class="card"><h3>Settings</h3><p class="sub">Pricing and probability model</p><div class="form">' +
      '<label>Margin below fair rate for “your bid” (%) <input id="sMargin" type="number" step="1" min="0" max="90" value="' + s.marginPct + '"></label>' +
      '<label>Default investor deal <select id="sBuy">' + FD.opts([['KOSTAK', 'Kostak'], ['SUBJECT', 'Subject-to'], ['PREMIUM', 'Premium per share'], ['NONE', 'Own account']], s.defaults.buyType) + '</select></label>' +
      '<label>Default broker deal <select id="sSell">' + FD.opts([['KOSTAK', 'Kostak'], ['SUBJECT', 'Subject-to'], ['PREMIUM', 'Premium per share']], s.defaults.sellType) + '</select></label>' +
      '<label>Theme <select id="sTheme">' + FD.opts([['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']], s.theme) + '</select></label>' +
      '<div class="full"><h3 class="sec" style="margin-top:4px">Application-size factors (used only when application counts are not yet published)</h3><p class="muted small" style="margin:0">Average application ÷ allotment unit. Chance ≈ factor ÷ times subscribed. Calibrated from recent exchange data: Retail ≈ 1.3, sHNI ≈ 1.05, bHNI ≈ 5, SME individual ≈ 1.</p></div>' +
      ['RETAIL', 'SHNI', 'BHNI', 'RETAIL_SME'].map(function (k) { return '<label>' + { RETAIL: 'Retail', SHNI: 'sHNI', BHNI: 'bHNI', RETAIL_SME: 'SME individual' }[k] + ' <input data-fac="' + k + '" type="number" step="0.05" min="0.5" value="' + s.factors[k] + '"></label>'; }).join('') +
      '</div><h3 class="sec">How the SEBI allotment odds are worked out</h3><ul class="small muted" style="margin:0;padding-left:18px">' +
      '<li><b>Retail</b> (up to ₹2 lakh): if oversubscribed, the maximum number of applicants get the minimum lot by lottery. Chance = retail shares ÷ minimum lot ÷ valid applications.</li>' +
      '<li><b>sHNI</b> (₹2–10 lakh, 1/3 of NII) and <b>bHNI</b> (above ₹10 lakh, 2/3 of NII): each winner gets the <b>minimum NII application</b> (the smallest lots above ₹2 lakh) by lottery; any balance is allotted proportionately. A bigger bHNI bid does not raise your chance — it only adds proportionate shares if the category is barely subscribed.</li>' +
      '<li><b>SME</b>: individual minimum application is 2 lots; NII minimum is more than 2 lots.</li>' +
      '<li>Expected value per application = chance × GMP × allotment unit = <b>fair Kostak</b>. Fair Subject-to = GMP × allotment unit.</li></ul></div>';
    el.innerHTML = html;
    var $ = function (q) { return el.querySelector(q); };
    fetch('js/parse.js').then(function (r) { return r.text(); }).then(function (src) { $('#bm').href = bookmarkletHref(src); });
    $('#bm').onclick = function (e) { e.preventDefault(); FD.toast('Drag this button to your bookmarks bar, then click it on ipopremium.in'); };
    $('#htmlFiles').onchange = async function (e) {
      var got = [];
      for (var f of e.target.files) { var d = new DOMParser().parseFromString(await f.text(), 'text/html'); var r = P.parseAny(d, ''); got = got.concat(r.ipos); }
      var n = FD.importParsed(got); FD.refresh(); FD.toast(n ? 'Updated ' + n + ' IPOs from ' + e.target.files.length + ' page(s)' : 'No IPO data found in those files', !n);
    };
    $('#pasteData').onclick = function () {
      FD.modal('<h2>Paste IPO data</h2><p class="muted">The bookmark also copies its data to your clipboard. Paste it here if the desk did not open by itself.</p><textarea id="pd"></textarea><div class="row" style="justify-content:flex-end"><button data-close>Cancel</button><button class="primary" id="pdOk">Import</button></div>', function (b, close) {
        b.querySelector('#pdOk').onclick = function () { try { var j = JSON.parse(b.querySelector('#pd').value); var n = FD.importParsed(j.ipos || j); close(); FD.refresh(); FD.toast('Updated ' + n + ' IPOs'); } catch (err) { FD.toast('That is not IPO data from the bookmark', true); } };
      });
    };
    $('#bkJson').onclick = FD.backup;
    $('#bkFile').onchange = async function (e) {
      var f = e.target.files[0]; if (!f) return;
      try {
        var j = JSON.parse(await f.text());
        if (!j || !Array.isArray(j.investors) || !Array.isArray(j.deals)) throw new Error('bad');
        FD.confirm('Replace the data in this browser with the backup from ' + (j.savedAt ? new Date(j.savedAt).toLocaleString('en-IN') : 'the file') + ' (' + j.investors.length + ' investors, ' + j.deals.length + ' deals)?', function () {
          localStorage.setItem('fd-ipo-deal-desk-v1', JSON.stringify(j)); FD.load(); FD.invalidate(); FD.refresh(); FD.toast('Backup restored');
        }, 'Restore');
      } catch (err) { FD.toast('This file is not a FinDeependence backup', true); }
    };
    $('#bkXls').onclick = function () { FD.go('reports'); setTimeout(function () { var s = document.getElementById('rScope'); s.value = 'all'; var p = document.getElementById('rPer'); p.value = 'all'; p.dispatchEvent(new Event('change')); setTimeout(function () { document.getElementById('rScope').value = 'all'; document.getElementById('rX').click(); }, 50); }, 50); };
    $('#demoOn').onclick = FD.loadDemo;
    $('#demoOff').onclick = function () { removeDemo(); FD.refresh(); FD.toast('Demo data removed'); };
    $('#wipe').onclick = function () { FD.confirm('Erase all investors, brokers, deals and settings in this browser? Download a backup first if unsure.', function () { localStorage.removeItem('fd-ipo-deal-desk-v1'); FD.load(); FD.invalidate(); FD.refresh(); FD.toast('Everything erased'); }, 'Erase'); };
    $('#sMargin').onchange = function (e) { s.marginPct = Math.max(0, Math.min(90, +e.target.value || 0)); FD.save(true); FD.toast('Saved'); };
    $('#sBuy').onchange = function (e) { s.defaults.buyType = e.target.value; FD.save(true); };
    $('#sSell').onchange = function (e) { s.defaults.sellType = e.target.value; FD.save(true); };
    $('#sTheme').onchange = function (e) { s.theme = e.target.value; FD.save(true); FD.applyTheme(); };
    el.querySelectorAll('[data-fac]').forEach(function (i) { i.onchange = function () { s.factors[i.dataset.fac] = +i.value || C.DEFAULT_FACTORS[i.dataset.fac]; FD.save(true); FD.toast('Saved'); }; });
  };

  FD.backup = function () {
    FD.state.backupAt = new Date().toISOString(); FD.state.changesSinceBackup = 0; FD.save(true);
    FD.download('FinDeependence-IPO-Deal-Desk-backup-' + FD.stamp() + '.json', JSON.stringify(FD.state, null, 1), 'application/json');
    FD.renderNotices();
  };

  FD.applyTheme = function () {
    var t = FD.state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  };

  /* ---------- demo ---------- */
  function removeDemo() {
    FD.state.investors = FD.state.investors.filter(function (x) { return x.id.indexOf('demo-') !== 0; });
    FD.state.brokers = FD.state.brokers.filter(function (x) { return x.id.indexOf('demo-') !== 0; });
    FD.state.deals = FD.state.deals.filter(function (x) { return x.id.indexOf('demo-') !== 0; });
    Object.keys(FD.state.ipoEdits).forEach(function (k) { var e = FD.state.ipoEdits[k]; if (e && e.demo) delete FD.state.ipoEdits[k]; });
    FD.save(true); FD.invalidate();
  }
  FD.loadDemo = function () {
    removeDemo();
    var names = ['Yash Shah', 'Riya Mehta', 'Kunal Patel', 'Neha Desai', 'Amit Joshi', 'Pooja Shah', 'Hardik Modi', 'Krupa Dave', 'Vivek Rana', 'Sneha Parikh', 'Rahul Bhatt', 'Ishita Vora', 'Manan Doshi', 'Tanvi Kapadia', 'Parth Trivedi', 'Dhruv Soni'];
    var letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var rnd = (function () { var s = 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
    names.forEach(function (n, k) {
      var pan = ''; for (var a = 0; a < 3; a++) pan += letters[Math.floor(rnd() * letters.length)]; pan += 'P' + n[0].toUpperCase() + String(1000 + Math.floor(rnd() * 8999)) + letters[Math.floor(rnd() * letters.length)];
      FD.state.investors.push({ id: 'demo-i' + k, name: n, pan: pan, phone: '98' + String(10000000 + Math.floor(rnd() * 89999999)), group: k % 3 === 0 ? 'Surat' : k % 3 === 1 ? 'Ahmedabad' : 'Family', active: true, notes: 'demo' });
    });
    FD.state.brokers.push({ id: 'demo-b1', name: 'Mehta Broking (demo)', phone: '', notes: 'demo' }, { id: 'demo-b2', name: 'Shree Capital (demo)', phone: '', notes: 'demo' });
    // illustrative listing prices for past IPOs that have none (demo only)
    var listed = { 'BLS Polymers': 206, 'HD Fire Protect': 318, 'Bonfiglioli Transmissions': 641, 'Fusion CX': 296, 'Sahajanand Medical Technologies': 352, 'Jio Platforms': 1342, 'Paras Healthcare': 702, 'EAAA India Alternatives': 1702, 'SFC Environmental Technologies': 348 };
    var ipos = FD.ipos();
    Object.keys(listed).forEach(function (nm) {
      var i = ipos.find(function (x) { return x.name.indexOf(nm) === 0; }); if (!i || i.listingPrice) return;
      FD.state.ipoEdits[i.id] = Object.assign({ demo: true, listingPrice: listed[nm], gmpBeforeListing: i.gmp }, FD.state.ipoEdits[i.id] || {});
    });
    FD.save(true); FD.invalidate(); ipos = FD.ipos();
    var pick = ipos.filter(function (i) { return i.type === 'Mainboard' && i.priceHigh && i.lotSize && (i.listingPrice || i.stage === 'Open' || i.stage === 'Upcoming' || i.stage === 'Closed' || i.stage === 'Allotted' || i.stage === 'Listing'); }).slice(0, 12);
    var c = 0;
    pick.forEach(function (i, ii) {
      var o = {}; C.CATS.forEach(function (cat) { o[cat] = C.opportunity(i, cat, FD.state.settings.factors, 25); });
      FD.state.investors.slice(-names.length).forEach(function (inv, k) {
        if (rnd() < 0.35) return;
        var cat = k % 7 === 0 ? 'BHNI' : k % 4 === 0 ? 'SHNI' : 'RETAIL';
        var ev = o[cat].expected || 100, gain = o[cat].gainIfAllotted || 500;
        var mode = rnd(), d = { id: 'demo-d' + (c++), ipoId: i.id, investorId: inv.id, cat: cat, lots: null, buyType: 'KOSTAK', buyRate: Math.max(50, Math.round(ev * 0.7 / 10) * 10), brokerId: null, sellType: null, sellRate: null, allot: 'PENDING', shares: null, invSettled: '', brkSettled: '', note: '', createdAt: new Date().toISOString(), ipoSnap: FD.snap(i) };
        if (mode < 0.35) { d.brokerId = rnd() < .6 ? 'demo-b1' : 'demo-b2'; d.sellType = 'KOSTAK'; d.sellRate = Math.round(ev * 0.95 / 10) * 10 + 50; }
        else if (mode < 0.5) { d.buyType = 'SUBJECT'; d.buyRate = Math.round(gain * 0.6 / 10) * 10; }
        if (i.listingPrice) {
          var p = C.probability(i, cat, FD.state.settings.factors).p; if (p == null) p = 0.1;
          d.allot = rnd() < Math.min(0.9, p * 1.1) ? 'YES' : 'NO';
          if (d.allot === 'YES' && !d.brokerId && rnd() < 0.5) { d.brokerId = 'demo-b2'; d.sellType = 'PREMIUM'; d.sellRate = i.gmp || 10; }
          if (ii % 3 !== 0) { d.invSettled = FD.today(); if (d.brokerId) d.brkSettled = FD.today(); }
        }
        FD.state.deals.push(d);
      });
    });
    FD.save(); FD.invalidate(); FD.refresh(); FD.toast('Demo loaded: ' + c + ' sample deals. Remove it in Data & Settings.');
  };
})();
