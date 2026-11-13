/* FinDeependence IPO Deal Desk · navigation and start-up. */
(function () {
  var FD = window.FD;
  var view = 'dash';
  var R = { dash: function () { FD.renderDash(); }, ipos: function () { FD.renderIpos(); }, deals: function () { FD.renderDeals(); }, calc: function () { FD.renderCalc(); }, predict: function () { FD.renderPredict(); }, reports: function () { FD.renderReports(); }, people: function () { FD.renderPeople(); }, data: function () { FD.renderData(); } };

  FD.go = function (v, id) {
    view = v;
    if (id && v === 'ipos') FD.sel.ipo = id;
    if (id && v === 'deals') FD.sel.deal = id;
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    document.querySelectorAll('section.view').forEach(function (s) { s.hidden = s.id !== 'v-' + v; });
    try { localStorage.setItem('fd-ipo-desk-view', v); } catch (e) {}
    FD.refresh();
    window.scrollTo({ top: 0 });
  };
  FD.refresh = function () { FD.invalidate(); try { R[view](); } catch (e) { console.error(e); FD.toast('Something went wrong drawing this page: ' + e.message, true); } FD.renderNotices(); };

  FD.renderNotices = function () {
    var el = document.getElementById('notices'), h = '';
    var n = FD.state.changesSinceBackup || 0;
    if (FD.state.deals.length && n >= 10 && (!FD.state.backupAt || Date.now() - new Date(FD.state.backupAt) > 3 * 864e5)) {
      h += '<div class="notice row"><span class="grow">' + n + ' changes since your last backup. Your data lives only in this browser — keep a copy.</span><button class="primary" id="nBk">Download backup</button></div>';
    }
    var live = FD.ipos().filter(function (i) { return i.stage === 'Open'; });
    if (view === 'dash' && live.length) h += '<div class="notice ok">Open now: ' + live.map(function (i) { return '<a href="#" class="go" data-nipo="' + i.id + '">' + FD.esc(i.name) + '</a>' + (i.gmp != null ? ' (GMP ₹' + i.gmp + ')' : ''); }).join(' · ') + '</div>';
    el.innerHTML = h;
    var b = el.querySelector('#nBk'); if (b) b.onclick = FD.backup;
    el.querySelectorAll('[data-nipo]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); FD.go('ipos', a.dataset.nipo); }; });
  };

  function hashImport() {
    var h = location.hash;
    if (h.indexOf('#ipp=') !== 0) return;
    try {
      var json = decodeURIComponent(escape(atob(h.slice(5))));
      var j = JSON.parse(json);
      var n = FD.importParsed(j.ipos || []);
      FD.toast('Updated ' + n + ' IPOs from IPO Premium ✓');
    } catch (e) { FD.toast('Could not read the IPO data in the link', true); }
    history.replaceState(null, '', location.pathname + location.search);
  }

  function start() {
    FD.load(); FD.applyTheme();
    document.querySelectorAll('#tabs button').forEach(function (b) { b.onclick = function () { FD.go(b.dataset.v); }; });
    ['ipoFilter', 'ipoSearch'].forEach(function (id) { document.getElementById(id).addEventListener(id === 'ipoSearch' ? 'input' : 'change', function () { FD.renderIpos(); }); });
    ['dealFilter', 'dealSearch'].forEach(function (id) { document.getElementById(id).addEventListener(id === 'dealSearch' ? 'input' : 'change', function () { FD.renderDeals(); }); });
    document.getElementById('addIpoBtn').onclick = function () { FD.editIpo(null); };
    window.addEventListener('hashchange', function () { if (location.hash.indexOf('#ipp=') === 0) { hashImport(); FD.refresh(); } });
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { FD.refresh(); });
    try { var v = localStorage.getItem('fd-ipo-desk-view'); if (v && R[v]) view = v; } catch (e) {}
    fetch('https://raw.githubusercontent.com/deepdalal27/IPO_Profit_Loss_FinDeependence/main/site/ipos.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return fetch('ipos.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }); })
      .catch(function () { return { ipos: [] }; }).then(function (feed) {
      FD.feed = feed || { ipos: [] };
      FD.loadHistory().then(function () { FD.refresh(); });
      hashImport();
      FD.go(view);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
