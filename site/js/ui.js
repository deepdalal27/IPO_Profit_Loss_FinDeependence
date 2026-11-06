/* FinDeependence IPO Deal Desk · shared UI helpers: toast, modal, charts, Excel/PDF export. */
(function () {
  var FD = window.FD, C = FD.C;
  var tt;
  FD.toast = function (msg, err) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
    clearTimeout(tt); tt = setTimeout(function () { t.className = ''; }, err ? 5200 : 2600);
  };
  FD.modal = function (html, onMount) {
    var m = document.getElementById('modal'), b = document.getElementById('modalBody');
    b.innerHTML = html; m.hidden = false;
    var close = function () { m.hidden = true; b.innerHTML = ''; document.removeEventListener('keydown', key); };
    var key = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    m.onclick = function (e) { if (e.target === m) close(); };
    b.querySelectorAll('[data-close]').forEach(function (x) { x.onclick = close; });
    if (onMount) onMount(b, close);
    var f = b.querySelector('input,select,textarea,button'); if (f) f.focus();
    return close;
  };
  FD.confirm = function (msg, yes, label) {
    FD.modal('<h2>Please confirm</h2><p>' + msg + '</p><div class="row" style="justify-content:flex-end"><button data-close>Cancel</button><button class="primary danger-bg" id="cfYes">' + (label || 'Yes') + '</button></div>', function (b, close) {
      b.querySelector('#cfYes').onclick = function () { close(); yes(); };
    });
  };
  FD.opts = function (arr, sel) {
    return arr.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + FD.esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + FD.esc(l) + '</option>'; }).join('');
  };
  FD.catPill = function (c) { return '<span class="pill ' + c + '">' + C.CAT_LABEL[c] + '</span>'; };
  FD.stagePill = function (s) { var cls = s === 'Open' ? 'Open' : s === 'Upcoming' ? 'Upcoming' : s === 'Listed' ? 'Listed' : s === 'Closed' ? 'Closed' : 'Allotted'; return '<span class="pill ' + cls + '">' + s + '</span>'; };
  FD.typePill = function (i) { return i.type === 'SME' ? '<span class="pill SME">SME</span>' : '<span class="pill MB">Mainboard</span>'; };
  FD.dealTypeShort = { KOSTAK: 'Kostak', SUBJECT: 'Subject-to', PREMIUM: 'Premium/sh', NONE: 'Own' };

  /* ---------- charts (Chart.js) ---------- */
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  FD.colors = function () {
    return { retail: cssv('--retail'), shni: cssv('--shni'), bhni: cssv('--bhni'), c4: cssv('--c4'), pos: cssv('--pos'), neg: cssv('--neg'),
      muted: cssv('--muted'), line: cssv('--line'), fg: cssv('--fg'), surface: cssv('--surface'), teal: cssv('--teal'), navy: cssv('--navy'), soon: cssv('--soon') };
  };
  FD.charts = {};
  FD.chart = function (id, cfg) {
    var el = document.getElementById(id); if (!el || !window.Chart) return null;
    if (FD.charts[id]) { FD.charts[id].destroy(); }
    var col = FD.colors();
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.color = col.muted;
    Chart.defaults.borderColor = col.line;
    cfg.options = cfg.options || {};
    var o = cfg.options;
    o.responsive = true; o.maintainAspectRatio = false;
    o.plugins = Object.assign({ legend: { display: false }, tooltip: { backgroundColor: col.fg, titleColor: col.surface, bodyColor: col.surface, padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4 } }, o.plugins || {});
    o.interaction = o.interaction || { mode: 'index', intersect: false };
    if (cfg.type === 'bar') {
      (cfg.data.datasets || []).forEach(function (ds) { ds.borderRadius = ds.borderRadius == null ? 4 : ds.borderRadius; ds.borderSkipped = 'start'; ds.borderWidth = 0; ds.maxBarThickness = ds.maxBarThickness || 34; });
    }
    if (o.scales) Object.keys(o.scales).forEach(function (k) { var s = o.scales[k]; s.grid = Object.assign({ color: col.line, drawTicks: false }, s.grid || {}); s.border = { display: false }; s.ticks = Object.assign({ padding: 6 }, s.ticks || {}); });
    FD.charts[id] = new Chart(el, cfg);
    return FD.charts[id];
  };
  FD.moneyTick = function (v) { var a = Math.abs(v); var s = a >= 1e7 ? (a / 1e7).toFixed(1) + 'Cr' : a >= 1e5 ? (a / 1e5).toFixed(1) + 'L' : a >= 1e3 ? (a / 1e3).toFixed(a < 1e4 && a % 1000 ? 1 : 0) + 'k' : String(Math.round(a)); return (v < 0 ? '−' : '') + '₹' + s; };
  FD.moneyTip = function (ctx) { var v = ctx.parsed && (ctx.parsed.x != null && ctx.chart.options.indexAxis === 'y' ? ctx.parsed.x : ctx.parsed.y); return ' ' + (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + C.inr(Math.round(v || 0)); };

  /* ---------- downloads ---------- */
  FD.download = function (name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  FD.stamp = function () { return FD.today(); };

  // sheets: [{name, title, cols:[{h, w, fmt:'money'|'int'|'pct'|'date'|'text'}], rows:[[...]], total:[...]}]
  FD.excel = async function (fileName, sheets) {
    if (!window.ExcelJS) { FD.toast('Excel library is still loading, try again in a moment', true); return; }
    var wb = new ExcelJS.Workbook(); wb.creator = 'FinDeependence · CA Deep Dalal'; wb.created = new Date();
    sheets.forEach(function (sh) {
      var ws = wb.addWorksheet(sh.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] });
      var nc = sh.cols.length;
      ws.mergeCells(1, 1, 1, Math.max(nc, 2));
      var t = ws.getCell(1, 1); t.value = 'FINDEEPENDENCE · ' + (sh.title || sh.name); t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E2740' } }; ws.getRow(1).height = 24;
      ws.mergeCells(2, 1, 2, Math.max(nc, 2));
      var b = ws.getCell(2, 1); b.value = 'Created by CA Deep Dalal · Chartered Accountant · Fund Manager · ' + new Date().toLocaleString('en-IN'); b.font = { italic: true, size: 9, color: { argb: 'FF5D6B7A' } };
      var hr = ws.getRow(4);
      sh.cols.forEach(function (c, i) {
        var cell = hr.getCell(i + 1); cell.value = c.h; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E2740' } }; cell.alignment = { vertical: 'middle', wrapText: true };
        ws.getColumn(i + 1).width = c.w || (c.fmt === 'text' || !c.fmt ? 18 : 14);
        if (c.fmt === 'money') ws.getColumn(i + 1).numFmt = '[$₹-4009] #,##,##0;[Red]-[$₹-4009] #,##,##0';
        if (c.fmt === 'pct') ws.getColumn(i + 1).numFmt = '0.0%';
        if (c.fmt === 'date') ws.getColumn(i + 1).numFmt = 'dd-mmm-yy';
      });
      hr.height = 30;
      sh.rows.forEach(function (r) {
        var row = ws.addRow(r.map(function (v, i) { var f = sh.cols[i].fmt; if (f === 'date' && v) { var d = new Date(v + 'T00:00:00'); return isNaN(d) ? v : d; } return v; }));
        row.eachCell(function (c) { c.border = { bottom: { style: 'hair', color: { argb: 'FFE2DACA' } } }; });
      });
      if (sh.total) {
        var tr = ws.addRow(sh.total);
        tr.eachCell(function (c) { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAE3D2' } }; });
      }
      if (sh.rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: nc } };
    });
    var buf = await wb.xlsx.writeBuffer();
    FD.download(fileName, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };

  // PDF: sections [{title, cols:[...h], rows:[[text]], total:[...], align:[...]}]
  FD.pdf = function (fileName, title, sections, landscape) {
    var J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { FD.toast('PDF library is still loading, try again in a moment', true); return; }
    var doc = new J({ orientation: landscape === false ? 'portrait' : 'landscape', unit: 'pt', format: 'a4' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    function head() {
      doc.setFillColor(14, 39, 64); doc.rect(0, 0, W, 46, 'F');
      doc.setTextColor(127, 211, 214); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('FINDEEPENDENCE', 28, 18);
      doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text(title, 28, 36);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(220, 230, 240);
      doc.text('Created by CA Deep Dalal · Chartered Accountant · Fund Manager', W - 28, 18, { align: 'right' });
      doc.text(new Date().toLocaleString('en-IN'), W - 28, 32, { align: 'right' });
    }
    head();
    var y = 62;
    sections.forEach(function (s, idx) {
      if (s.title) { doc.setTextColor(44, 143, 147); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(s.title.toUpperCase(), 28, y); y += 6; }
      doc.autoTable({
        startY: y, head: [s.cols], body: s.rows.concat(s.total ? [s.total] : []), margin: { left: 28, right: 28, top: 60 },
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, textColor: [20, 39, 61], lineColor: [226, 218, 202], lineWidth: 0.4 },
        headStyles: { fillColor: [14, 39, 64], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [251, 249, 244] },
        columnStyles: (s.align || []).reduce(function (a, al, i) { if (al) a[i] = { halign: al }; return a; }, {}),
        didParseCell: function (data) { if (s.total && data.section === 'body' && data.row.index === s.rows.length) { data.cell.styles.fillColor = [234, 227, 210]; data.cell.styles.fontStyle = 'bold'; } },
        didDrawPage: function () { head(); doc.setFontSize(8); doc.setTextColor(93, 107, 122); doc.text('FinDeependence · IPO Deal Desk · CA Deep Dalal', 28, H - 16); doc.text('Page ' + doc.internal.getNumberOfPages(), W - 28, H - 16, { align: 'right' }); }
      });
      y = doc.lastAutoTable.finalY + 22;
      if (y > H - 80 && idx < sections.length - 1) { doc.addPage(); y = 62; }
    });
    doc.save(fileName);
  };
  // PDF text: jsPDF's built-in font has no ₹ glyph.
  FD.rs = function (v) { if (v == null || isNaN(v)) return '-'; var s = C.inr(Math.round(v)).replace('₹', 'Rs ').replace('−', '-'); return s; };
})();
