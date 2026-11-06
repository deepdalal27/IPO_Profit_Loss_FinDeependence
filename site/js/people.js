/* FinDeependence IPO Deal Desk · Investors (name + PAN) and brokers: single and bulk add / delete. */
(function () {
  var FD = window.FD, C = FD.C;
  var st = { tab: 'inv', q: '', group: '' };
  var picked = {};

  function stats() {
    var s = {};
    FD.rows().forEach(function (x) {
      var k = x.d.investorId, b = x.d.brokerId;
      var a = s[k] = s[k] || { n: 0, open: 0, profit: 0 };
      a.n++; if (x.r.final) { a.profit += x.r.profit; if (!x.d.invSettled) a.open += x.r.invNet; }
      if (b) { var c = s['b:' + b] = s['b:' + b] || { n: 0, open: 0, profit: 0 }; c.n++; if (x.r.final) { c.profit += x.r.profit; if (!x.d.brkSettled) c.open += x.r.brkNet; } }
    });
    return s;
  }

  FD.renderPeople = function () {
    var el = document.getElementById('v-people');
    var inv = st.tab === 'inv';
    var S = stats();
    var list = (inv ? FD.state.investors : FD.state.brokers).filter(function (x) {
      var q = st.q.toLowerCase();
      return (!q || (x.name + ' ' + (x.pan || '') + ' ' + (x.phone || '') + ' ' + (x.group || '')).toLowerCase().indexOf(q) >= 0) && (!st.group || x.group === st.group);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var groups = Array.from(new Set(FD.state.investors.map(function (x) { return x.group || ''; }).filter(Boolean))).sort();
    var np = list.filter(function (x) { return picked[x.id]; }).length;
    var html = '<div class="panel"><div class="panel-head"><div><h2>' + (inv ? 'Investors' : 'Brokers') + ' <span class="pill MB">' + (inv ? FD.state.investors.length : FD.state.brokers.length) + '</span></h2>' +
      '<p class="muted">' + (inv ? 'People who apply in IPOs for you. Name and PAN; one application per PAN per IPO.' : 'Brokers you sell applications or allotted shares to.') + '</p></div>' +
      '<nav class="tabs sub"><button data-pt="inv"' + (inv ? ' class="on"' : '') + '>Investors</button><button data-pt="brk"' + (!inv ? ' class="on"' : '') + '>Brokers</button></nav></div>';
    // single add
    html += '<div class="form" id="addOne">' +
      '<label>Name <input id="pName" placeholder="' + (inv ? 'e.g. Yash Shah' : 'e.g. Mehta Broking') + '"></label>' +
      (inv ? '<label>PAN <input id="pPan" maxlength="10" placeholder="ABCDE1234F" style="text-transform:uppercase;font-family:var(--mono)"></label>' : '') +
      '<label>Phone <input id="pPhone" inputmode="tel" placeholder="optional"></label>' +
      (inv ? '<label>Group / referred by <input id="pGroup" list="grpList" placeholder="optional"><datalist id="grpList">' + groups.map(function (g) { return '<option value="' + FD.esc(g) + '">'; }).join('') + '</datalist></label>' : '') +
      '<label>Notes <input id="pNotes" placeholder="optional"></label>' +
      '<div class="row" style="align-self:end"><button class="primary" id="pAdd">Add ' + (inv ? 'investor' : 'broker') + '</button><button id="pBulk">Bulk add (paste / Excel)</button></div></div>';
    html += '<div class="toolbar"><input type="search" id="pQ" placeholder="Search name, PAN, phone" value="' + FD.esc(st.q) + '" style="max-width:260px">' +
      (inv && groups.length ? '<select id="pG"><option value="">All groups</option>' + FD.opts(groups, st.group) + '</select>' : '') +
      '<span class="lbl">' + (np ? np + ' selected' : list.length + ' shown') + '</span>' +
      (np ? '<button class="danger" id="pDel">Delete selected</button>' + (inv ? '<button id="pOff">Mark inactive</button><button id="pOn">Mark active</button><button id="pGrp">Set group…</button>' : '') : '') +
      '<span class="grow"></span><button id="pExp">Export list</button></div>';
    html += list.length ? '<div class="tbl max"><table><thead><tr><th><input type="checkbox" id="pAll" aria-label="Select all"' + (np && np === list.length ? ' checked' : '') + '></th><th>Name</th>' + (inv ? '<th>PAN</th>' : '') + '<th>Phone</th>' + (inv ? '<th>Group</th>' : '') + '<th>Notes</th><th class="num">Applications</th><th class="num">Open balance</th><th class="num">Profit earned</th>' + (inv ? '<th>Active</th>' : '') + '<th></th></tr></thead><tbody>' +
      list.map(function (x) {
        var s = S[(inv ? '' : 'b:') + x.id] || { n: 0, open: 0, profit: 0 };
        return '<tr data-id="' + x.id + '"' + (x.active === false ? ' class="inactive"' : '') + '><td><input type="checkbox" data-pick="' + x.id + '"' + (picked[x.id] ? ' checked' : '') + '></td>' +
          '<td><input class="cell" data-f="name" value="' + FD.esc(x.name) + '"></td>' +
          (inv ? '<td><input class="cell mono' + (x.pan && !C.validPan(x.pan) ? ' dup' : '') + '" style="min-width:120px;text-transform:uppercase" data-f="pan" maxlength="10" value="' + FD.esc(x.pan || '') + '"></td>' : '') +
          '<td><input class="cell" style="min-width:110px" data-f="phone" value="' + FD.esc(x.phone || '') + '"></td>' +
          (inv ? '<td><input class="cell" style="min-width:110px" data-f="group" list="grpList" value="' + FD.esc(x.group || '') + '"></td>' : '') +
          '<td><input class="cell" data-f="notes" value="' + FD.esc(x.notes || '') + '"></td>' +
          '<td class="num">' + s.n + '</td><td class="num">' + (Math.abs(s.open) > .5 ? (s.open > 0 ? 'Get ' : 'Pay ') + FD.fmt(Math.round(Math.abs(s.open))) : '—') + '</td><td class="num">' + FD.signed(s.profit) + '</td>' +
          (inv ? '<td><input type="checkbox" data-f="active"' + (x.active === false ? '' : ' checked') + ' aria-label="Active"></td>' : '') +
          '<td><button class="sel-sm danger" data-del="' + x.id + '">✕</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty-state"><h3>No ' + (inv ? 'investors' : 'brokers') + ' yet</h3><p>Add one above, or use Bulk add to paste a whole list from Excel or WhatsApp.</p></div>';
    html += '</div>';
    el.innerHTML = html;
    wire(el, inv, list);
  };

  function wire(el, inv, list) {
    var $ = function (s) { return el.querySelector(s); };
    el.querySelectorAll('[data-pt]').forEach(function (b) { b.onclick = function () { st.tab = b.dataset.pt; picked = {}; st.q = ''; FD.renderPeople(); }; });
    var arr = inv ? FD.state.investors : FD.state.brokers;
    $('#pAdd').onclick = function () {
      var name = $('#pName').value.trim(); if (!name) { FD.toast('Enter a name', true); return; }
      var o = { id: FD.uid(inv ? 'i-' : 'b-'), name: name, phone: $('#pPhone').value.trim(), notes: $('#pNotes').value.trim(), createdAt: new Date().toISOString() };
      if (inv) {
        o.pan = $('#pPan').value.trim().toUpperCase(); o.group = $('#pGroup').value.trim(); o.active = true;
        if (o.pan && !C.validPan(o.pan)) { FD.toast('PAN should look like ABCDE1234F', true); return; }
        if (o.pan && FD.state.investors.some(function (x) { return (x.pan || '').toUpperCase() === o.pan; })) { FD.toast('This PAN is already added', true); return; }
      }
      arr.push(o); FD.save(); FD.renderPeople(); FD.toast(name + ' added'); el.querySelector('#pName').focus();
    };
    el.querySelector('#addOne').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#pAdd').click(); });
    $('#pBulk').onclick = function () { bulk(inv); };
    $('#pQ').oninput = function (e) { st.q = e.target.value; var p = e.target.selectionStart; FD.renderPeople(); var n = document.getElementById('pQ'); n.focus(); n.setSelectionRange(p, p); };
    if ($('#pG')) $('#pG').onchange = function (e) { st.group = e.target.value; FD.renderPeople(); };
    if ($('#pAll')) $('#pAll').onchange = function (e) { list.forEach(function (x) { picked[x.id] = e.target.checked; }); FD.renderPeople(); };
    var tb = el.querySelector('tbody');
    if (tb) {
      tb.addEventListener('change', function (e) {
        if (e.target.dataset.pick) { picked[e.target.dataset.pick] = e.target.checked; FD.renderPeople(); return; }
        var tr = e.target.closest('tr[data-id]'), f = e.target.dataset.f; if (!tr || !f) return;
        var x = arr.find(function (p) { return p.id === tr.dataset.id; });
        var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
        if (f === 'pan') { v = v.toUpperCase(); if (v && !C.validPan(v)) FD.toast('PAN should look like ABCDE1234F', true); if (v && FD.state.investors.some(function (p) { return p.id !== x.id && (p.pan || '').toUpperCase() === v; })) { FD.toast('Another investor already has this PAN', true); e.target.value = x.pan || ''; return; } }
        if (f === 'name' && !v) { e.target.value = x.name; return; }
        x[f] = v; FD.save(true); FD.toast('Saved');
      });
      tb.addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) del([b.dataset.del], inv); });
    }
    if ($('#pDel')) $('#pDel').onclick = function () { del(list.filter(function (x) { return picked[x.id]; }).map(function (x) { return x.id; }), inv); };
    if ($('#pOff')) $('#pOff').onclick = function () { list.forEach(function (x) { if (picked[x.id]) x.active = false; }); FD.save(); FD.renderPeople(); };
    if ($('#pOn')) $('#pOn').onclick = function () { list.forEach(function (x) { if (picked[x.id]) x.active = true; }); FD.save(); FD.renderPeople(); };
    if ($('#pGrp')) $('#pGrp').onclick = function () { var g = prompt('Group / referred by for the selected investors'); if (g == null) return; list.forEach(function (x) { if (picked[x.id]) x.group = g.trim(); }); FD.save(); FD.renderPeople(); };
    $('#pExp').onclick = function () {
      FD.excel('FinDeependence-' + (inv ? 'investors' : 'brokers') + '-' + FD.stamp() + '.xlsx', [{ name: inv ? 'Investors' : 'Brokers', title: inv ? 'Investor master' : 'Broker master',
        cols: [{ h: 'Name', w: 26 }].concat(inv ? [{ h: 'PAN', w: 14 }] : []).concat([{ h: 'Phone', w: 14 }]).concat(inv ? [{ h: 'Group' }] : []).concat([{ h: 'Notes', w: 30 }]),
        rows: arr.map(function (x) { return [x.name].concat(inv ? [x.pan || ''] : []).concat([x.phone || '']).concat(inv ? [x.group || ''] : []).concat([x.notes || '']); }) }]);
    };
  }

  function del(ids, inv) {
    if (!ids.length) return;
    var key = inv ? 'investorId' : 'brokerId';
    var deals = FD.state.deals.filter(function (d) { return ids.indexOf(d[key]) >= 0; });
    var msg = 'Delete ' + ids.length + ' ' + (inv ? 'investor' : 'broker') + (ids.length > 1 ? 's' : '') + '?' + (deals.length ? '<br><b>' + deals.length + ' deals</b> use ' + (ids.length > 1 ? 'them' : 'this one') + '. ' + (inv ? 'Those deals will be deleted too.' : 'Those deals will become “not sold to broker”.') + (inv ? ' Tip: mark them inactive instead to keep history.' : '') : '');
    FD.confirm(msg, function () {
      if (inv) { FD.state.investors = FD.state.investors.filter(function (x) { return ids.indexOf(x.id) < 0; }); FD.state.deals = FD.state.deals.filter(function (d) { return ids.indexOf(d.investorId) < 0; }); }
      else { FD.state.brokers = FD.state.brokers.filter(function (x) { return ids.indexOf(x.id) < 0; }); FD.state.deals.forEach(function (d) { if (ids.indexOf(d.brokerId) >= 0) { d.brokerId = null; d.sellType = null; d.sellRate = null; } }); }
      ids.forEach(function (id) { delete picked[id]; });
      FD.save(); FD.renderPeople(); FD.toast('Deleted');
    }, 'Delete');
  }

  // Bulk add: paste lines "Name, PAN, Phone, Group" (comma, tab or 2+ spaces) or upload CSV / Excel.
  function parseLines(text, inv) {
    var out = [];
    text.split(/\r?\n/).forEach(function (ln) {
      ln = ln.trim(); if (!ln) return;
      var parts = ln.split(/\t|,|;|\s{2,}|\|/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!parts.length) return;
      if (/^(name|investor|sr|s\.?no)/i.test(parts[0]) && parts.some(function (p) { return /pan/i.test(p); })) return; // header
      var o = { name: '', pan: '', phone: '', group: '' };
      // find PAN & phone anywhere
      parts.forEach(function (p) {
        var up = p.toUpperCase().replace(/\s/g, '');
        if (inv && !o.pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(up)) o.pan = up;
        else if (inv && !o.pan && /^[A-Z0-9]{4,12}$/.test(up) && /[A-Z]/.test(up) && /[0-9]/.test(up) && !/^\+?\d/.test(p)) o.pan = up;
        else if (!o.phone && /^\+?\d[\d\s-]{8,}$/.test(p)) o.phone = p;
        else if (/^\d+\.?$/.test(p) && !o.name) { /* serial no */ }
        else if (!o.name) o.name = p;
        else if (!o.group) o.group = p;
      });
      if (inv && !o.pan) { var m = ln.toUpperCase().match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/); if (m) { o.pan = m[0]; o.name = o.name.replace(new RegExp(m[0], 'i'), '').trim(); } }
      if (o.name) out.push(o);
    });
    return out;
  }
  function bulk(inv) {
    FD.modal('<h2>Bulk add ' + (inv ? 'investors' : 'brokers') + '</h2><p class="muted">Paste one per line — copy straight from Excel or WhatsApp. Columns in any order: <b>Name</b>' + (inv ? ', <b>PAN</b>' : '') + ', phone, group. Or upload a CSV / Excel file.</p>' +
      '<textarea id="bTxt" placeholder="' + (inv ? 'Yash Shah, ABCDE1234F, 9876543210, Surat group&#10;Riya Mehta	FGHIJ5678K' : 'Mehta Broking, 9876543210') + '"></textarea>' +
      '<div class="row" style="margin:8px 0"><label class="fakebtn">Upload CSV / Excel<input type="file" id="bFile" accept=".csv,.txt,.xlsx" hidden></label><span class="muted small" id="bInfo"></span></div>' +
      '<div class="tbl" style="max-height:260px;overflow:auto"><table><thead><tr><th>Name</th>' + (inv ? '<th>PAN</th>' : '') + '<th>Phone</th>' + (inv ? '<th>Group</th>' : '') + '<th>Check</th></tr></thead><tbody id="bPrev"><tr><td colspan="5" class="muted">Preview appears here.</td></tr></tbody></table></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:10px"><button data-close>Cancel</button><button class="primary" id="bOk" disabled>Add</button></div>',
    function (b, close) {
      var good = [];
      var prev = function () {
        var rows = parseLines(b.querySelector('#bTxt').value, inv);
        var seenPan = {}, seenName = {};
        (inv ? FD.state.investors : FD.state.brokers).forEach(function (x) { if (x.pan) seenPan[x.pan.toUpperCase()] = 1; seenName[x.name.toUpperCase()] = 1; });
        good = [];
        b.querySelector('#bPrev').innerHTML = rows.map(function (o) {
          var chk = 'ok';
          if (inv && o.pan && !C.validPan(o.pan)) chk = 'Invalid PAN';
          else if (inv && o.pan && seenPan[o.pan]) chk = 'PAN already added';
          else if (!inv && seenName[o.name.toUpperCase()]) chk = 'Already added';
          else if (inv && !o.pan) chk = 'ok (no PAN)';
          if (/^ok/.test(chk)) { good.push(o); if (o.pan) seenPan[o.pan] = 1; seenName[o.name.toUpperCase()] = 1; }
          return '<tr><td>' + FD.esc(o.name) + '</td>' + (inv ? '<td class="mono">' + FD.esc(o.pan) + '</td>' : '') + '<td>' + FD.esc(o.phone) + '</td>' + (inv ? '<td>' + FD.esc(o.group) + '</td>' : '') + '<td class="' + (/^ok/.test(chk) ? 'ok-txt' : 'bad-txt') + '">' + chk + '</td></tr>';
        }).join('') || '<tr><td colspan="5" class="muted">Nothing recognised yet.</td></tr>';
        var ok = b.querySelector('#bOk'); ok.disabled = !good.length; ok.textContent = 'Add ' + good.length;
      };
      b.querySelector('#bTxt').oninput = prev;
      b.querySelector('#bFile').onchange = async function (e) {
        var f = e.target.files[0]; if (!f) return;
        if (/\.xlsx$/i.test(f.name)) {
          if (!window.ExcelJS) { FD.toast('Excel reader still loading, try again', true); return; }
          var wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer());
          var lines = []; wb.worksheets[0].eachRow(function (row) { lines.push(row.values.slice(1).map(function (v) { return v == null ? '' : (v.text || v.result || v).toString(); }).join('\t')); });
          b.querySelector('#bTxt').value = lines.join('\n');
        } else b.querySelector('#bTxt').value = await f.text();
        b.querySelector('#bInfo').textContent = f.name; prev();
      };
      b.querySelector('#bOk').onclick = function () {
        var now = new Date().toISOString();
        good.forEach(function (o) {
          var x = { id: FD.uid(inv ? 'i-' : 'b-'), name: o.name, phone: o.phone, notes: '', createdAt: now };
          if (inv) { x.pan = o.pan; x.group = o.group; x.active = true; } else if (o.group) x.notes = o.group;
          (inv ? FD.state.investors : FD.state.brokers).push(x);
        });
        FD.save(); close(); FD.renderPeople(); FD.toast(good.length + ' added');
      };
    });
  }
})();
