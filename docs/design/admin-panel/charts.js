/* Wykresy prototypu: czyste SVG rysowane w JS, bez bibliotek.
 * Zasady (DESIGN-SYSTEM.md, sekcja "Wizualizacja danych"):
 * - jedna oś Y, linie 2 px, słupki <= 24 px z zaokrąglonym końcem 4 px i przerwą 2 px,
 * - siatka to włoskowate linie ciągłe, porównanie szare, bieżący okres w kolorze serii 1,
 * - adnotacje z osi zmian jako pionowe linie z numerem + lista pod wykresem,
 * - podpowiedź (tooltip) tylko uzupełnia: każdy wykres ma tabelę danych w <details>,
 * - wykres rysuje się synchronicznie w szerokości kontenera (bez szkieletu) i od nowa przy zmianie rozmiaru. */
(function () {
  "use strict";
  var C = (window.Charts = { specs: {} });
  var uid = 0;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  C.esc = esc;

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    var m = n <= 1 ? 1 : n <= 1.2 ? 1.2 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return m * p;
  }
  function defFmt(v) { return Math.round(v).toLocaleString("pl-PL"); }

  // ---------- Szkielet figury (HTML) ----------
  // spec: {type, title, summary, height, labels[], series:[{name, values, role:'current'|'compare'}], ...}
  C.figure = function (spec) {
    var id = spec.id || "ch" + ++uid;
    spec.id = id;
    C.specs[id] = spec;
    var legend = "";
    if (spec.series && spec.series.length > 1) {
      legend = '<ul class="legend" aria-label="Legenda">' + spec.series.map(function (s) {
        return '<li><span class="key key-' + (s.role === "compare" ? "compare" : s.role === "band" ? "band" : "s" + (s.slot || 1)) + (spec.type === "columns" ? " key-rect" : "") + '" aria-hidden="true"></span>' + esc(s.name) + "</li>";
      }).join("") + (spec.band ? '<li><span class="key key-band key-rect" aria-hidden="true"></span>' + esc(spec.band.name) + "</li>" : "") + "</ul>";
    }
    var notes = "";
    if (spec.annotations && spec.annotations.length) {
      notes = '<ol class="chart-notes" aria-label="Adnotacje: co się zmieniło">' + spec.annotations.map(function (a, i) {
        return '<li><span class="note-num" aria-hidden="true">' + (i + 1) + "</span><span class=\"sr-only\">Adnotacja " + (i + 1) + ": </span>" + esc(a.when) + " · " + esc(a.label) + "</li>";
      }).join("") + "</ol>";
    }
    return '<figure class="chart" data-chart="' + id + '">' + legend +
      '<div class="chart-plot" tabindex="0" role="group" aria-label="' + esc(spec.title) + ': wykres. Strzałki w lewo i prawo pokazują wartości; pełne dane w tabeli pod wykresem." style="height:' + (spec.height || 200) + 'px"></div>' +
      notes + (spec.summary ? '<figcaption class="chart-cap">' + esc(spec.summary) + "</figcaption>" : "") + C.tableFor(spec) + "</figure>";
  };

  C.tableFor = function (spec) {
    var fmt = spec.fmt || defFmt;
    var cols = (spec.series || []).slice();
    if (spec.band) cols.push({ name: spec.band.name + " (od–do)", values: spec.band.lo.map(function (lo, i) { return fmt(lo) + "–" + fmt(spec.band.hi[i]); }), raw: true });
    var step = spec.tableStep || 1;
    var rows = "";
    for (var i = 0; i < spec.labels.length; i += step) {
      rows += "<tr><th scope=\"row\">" + esc(spec.labels[i]) + "</th>" + cols.map(function (s) {
        var v = s.values[i];
        return '<td class="num">' + (v === null || v === undefined ? "—" : s.raw ? esc(v) : esc(fmt(v))) + "</td>";
      }).join("") + "</tr>";
    }
    return '<details class="chart-table"><summary>Tabela danych</summary><div class="table-scroll"><table class="table table-compact"><caption class="sr-only">' + esc(spec.title) + '</caption><thead><tr><th scope="col">' + esc(spec.xName || "Okres") + "</th>" +
      cols.map(function (s) { return '<th scope="col" class="num">' + esc(s.name) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div></details>";
  };

  // ---------- Rysowanie ----------
  C.mountAll = function (root) {
    (root || document).querySelectorAll("figure.chart[data-chart]").forEach(function (fig) { C.draw(fig); });
  };

  C.draw = function (fig) {
    var spec = C.specs[fig.getAttribute("data-chart")];
    if (!spec) return;
    var plot = fig.querySelector(".chart-plot");
    var W = Math.max(240, Math.floor(plot.clientWidth));
    if (plot._w === W) return;
    plot._w = W;
    var H = spec.height || 200;
    var svg = spec.type === "columns" ? columns(spec, W, H) : line(spec, W, H);
    plot.innerHTML = svg.markup + '<div class="chart-tip" hidden></div>';
    bind(plot, spec, svg.geo);
  };

  function axisY(max, fmt, top, h, left, W) {
    var out = "";
    for (var t = 0; t <= 4; t++) {
      var v = (max / 4) * t;
      var y = top + h - (h * t) / 4;
      out += '<line class="grid" x1="' + left + '" x2="' + (W - 8) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
      out += '<text class="tick" x="' + (left - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + esc(fmt(v)) + "</text>";
    }
    return out;
  }
  function leftPad(max, fmt) { return Math.max(fmt(max).length, fmt(max / 2).length) * 7.4 + 14; }

  function line(spec, W, H) {
    var fmt = spec.yFmt || spec.fmt || defFmt;
    var n = spec.labels.length;
    var all = [];
    spec.series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) all.push(v); }); });
    if (spec.band) all = all.concat(spec.band.hi);
    var max = spec.yMax || niceMax(Math.max.apply(null, all) * 1.05);
    var left = leftPad(max, fmt), right = spec.endLabel ? 52 : 12;
    var w = W - left - right;
    function X(i) { return left + (n === 1 ? w / 2 : (w * i) / (n - 1)); }
    // Znaczniki adnotacji leżące bliżej niż 20 px schodzą do drugiego rzędu, żeby się nie nakładały.
    var rows = [], lastX = -99, stagger = false;
    (spec.annotations || []).forEach(function (a, k) {
      var ax = X(a.index), row = 0;
      if (ax - lastX < 20) row = rows[k - 1] === 0 ? 1 : 0;
      if (row) stagger = true;
      rows.push(row); lastX = ax;
    });
    var top = spec.annotations && spec.annotations.length ? (stagger ? 46 : 26) : 10, bottom = 26;
    var h = H - top - bottom;
    function Y(v) { return top + h - (h * v) / max; }
    var out = '<svg class="chart-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(spec.title + (spec.summary ? ". " + spec.summary : "")) + '">';
    out += axisY(max, fmt, top, h, left, W - right + 8);
    out += '<line class="axis" x1="' + left + '" x2="' + (W - right) + '" y1="' + (top + h) + '" y2="' + (top + h) + '"/>';
    var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 84))));
    for (var i = 0; i < n; i += every) {
      out += '<text class="tick" x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? "start" : "middle") + '">' + esc(spec.xTick ? spec.xTick(i) : spec.labels[i]) + "</text>";
    }
    if (spec.band) {
      var pb = spec.band.hi.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
      var pl = spec.band.lo.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); }).reverse();
      out += '<polygon class="band" points="' + pb.concat(pl).join(" ") + '"/>';
    }
    if (spec.refLine) {
      var ry = Y(spec.refLine.value);
      out += '<line class="ref" x1="' + left + '" x2="' + (W - right) + '" y1="' + ry + '" y2="' + ry + '"/><text class="tick ref-label" x="' + (W - right) + '" y="' + (ry - 6) + '" text-anchor="end">' + esc(spec.refLine.label) + "</text>";
    }
    (spec.annotations || []).forEach(function (a, k) {
      var ax = X(a.index), cy = rows[k] ? 31 : 11;
      out += '<line class="annot" x1="' + ax.toFixed(1) + '" x2="' + ax.toFixed(1) + '" y1="' + (cy + 9) + '" y2="' + (top + h) + '"/>' +
        '<circle class="annot-dot" cx="' + ax.toFixed(1) + '" cy="' + cy + '" r="9"/><text class="annot-num" x="' + ax.toFixed(1) + '" y="' + (cy + 4) + '" text-anchor="middle">' + (k + 1) + "</text>";
    });
    var cur = null;
    spec.series.forEach(function (s) {
      var d = "", started = false;
      s.values.forEach(function (v, i) {
        if (v === null || v === undefined) { started = false; return; }
        d += (started ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1);
        started = true;
      });
      if (s.role !== "compare" && !cur) cur = s;
      if (s.role !== "compare" && spec.series.length <= 2 && s.area !== false) {
        var last = s.values.length - 1;
        while (last > 0 && (s.values[last] === null || s.values[last] === undefined)) last--;
        out += '<path class="area s' + (s.slot || 1) + '" d="' + d + "L" + X(last).toFixed(1) + "," + (top + h) + "L" + X(0).toFixed(1) + "," + (top + h) + 'Z"/>';
      }
      out += '<path class="line ' + (s.role === "compare" ? "compare" : "s" + (s.slot || 1)) + '" d="' + d + '"/>';
    });
    if (cur && spec.endLabel) {
      var li = cur.values.length - 1;
      while (li > 0 && (cur.values[li] === null || cur.values[li] === undefined)) li--;
      out += '<circle class="dot s' + (cur.slot || 1) + '" cx="' + X(li) + '" cy="' + Y(cur.values[li]) + '" r="4"/><text class="end-label" x="' + (X(li) + 8) + '" y="' + (Y(cur.values[li]) + 4) + '">' + esc(fmt(cur.values[li])) + "</text>";
    }
    out += '<line class="crosshair" x1="0" x2="0" y1="' + top + '" y2="' + (top + h) + '" visibility="hidden"/>';
    out += '<g class="hover-dots"></g><rect class="hit" x="' + left + '" y="0" width="' + w + '" height="' + H + '" fill="transparent"/></svg>';
    return { markup: out, geo: { X: X, Y: Y, n: n, left: left, w: w, top: top, h: h, kind: "line" } };
  }

  function columns(spec, W, H) {
    var fmt = spec.yFmt || spec.fmt || defFmt;
    var vals = spec.series[0].values;
    var n = vals.length;
    var max = spec.yMax || niceMax(Math.max.apply(null, vals.concat(spec.refLine ? [spec.refLine.value] : [])) * 1.05);
    var top = 10, bottom = 26, left = leftPad(max, fmt), right = 12;
    var w = W - left - right, h = H - top - bottom;
    var band = w / n;
    var bw = Math.min(24, Math.max(3, band - 2));
    function X(i) { return left + band * i + band / 2; }
    function Y(v) { return top + h - (h * v) / max; }
    var out = '<svg class="chart-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(spec.title + (spec.summary ? ". " + spec.summary : "")) + '">';
    out += axisY(max, fmt, top, h, left, W);
    vals.forEach(function (v, i) {
      if (v === null) return;
      var x = X(i) - bw / 2, y = Y(v), bh = top + h - y;
      var r = Math.min(4, bh, bw / 2);
      var cls = spec.highlight && spec.highlight(i) ? "bar s1" : spec.highlight ? "bar muted" : "bar s1";
      out += '<path class="' + cls + '" data-i="' + i + '" d="M' + x.toFixed(1) + "," + (top + h) + "V" + (y + r).toFixed(1) + "Q" + x.toFixed(1) + "," + y.toFixed(1) + " " + (x + r).toFixed(1) + "," + y.toFixed(1) + "H" + (x + bw - r).toFixed(1) + "Q" + (x + bw).toFixed(1) + "," + y.toFixed(1) + " " + (x + bw).toFixed(1) + "," + (y + r).toFixed(1) + "V" + (top + h) + 'Z"/>';
    });
    out += '<line class="axis" x1="' + left + '" x2="' + (W - right) + '" y1="' + (top + h) + '" y2="' + (top + h) + '"/>';
    if (spec.refLine) {
      var ry = Y(spec.refLine.value);
      out += '<line class="ref" x1="' + left + '" x2="' + (W - right) + '" y1="' + ry + '" y2="' + ry + '"/><text class="tick ref-label" x="' + (W - right) + '" y="' + (ry - 6) + '" text-anchor="end">' + esc(spec.refLine.label) + "</text>";
    }
    var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 60))));
    for (var i = 0; i < n; i += every) out += '<text class="tick" x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(spec.xTick ? spec.xTick(i) : spec.labels[i]) + "</text>";
    out += '<line class="crosshair" x1="0" x2="0" y1="' + top + '" y2="' + (top + h) + '" visibility="hidden"/><g class="hover-dots"></g><rect class="hit" x="' + left + '" y="0" width="' + w + '" height="' + H + '" fill="transparent"/></svg>';
    return { markup: out, geo: { X: X, Y: Y, n: n, left: left, w: w, top: top, h: h, band: band, kind: "columns" } };
  }

  function bind(plot, spec, g) {
    var tip = plot.querySelector(".chart-tip");
    var cross = plot.querySelector(".crosshair");
    var dots = plot.querySelector(".hover-dots");
    var fmt = spec.fmt || defFmt;
    var cur = -1;
    function show(i) {
      if (i < 0 || i >= g.n) return;
      cur = i;
      var x = g.X(i);
      if (g.kind === "line") {
        cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
        dots.innerHTML = spec.series.map(function (s) {
          var v = s.values[i];
          return v === null || v === undefined ? "" : '<circle class="dot ' + (s.role === "compare" ? "compare" : "s" + (s.slot || 1)) + '" cx="' + x + '" cy="' + g.Y(v) + '" r="4"/>';
        }).join("");
      } else {
        plot.querySelectorAll(".bar").forEach(function (b) { b.classList.toggle("hover", +b.getAttribute("data-i") === i); });
      }
      var rows = spec.series.map(function (s) {
        var v = s.values[i];
        return '<div class="tip-row"><span class="tip-key ' + (s.role === "compare" ? "compare" : "s" + (s.slot || 1)) + '"></span><strong>' + esc(v === null || v === undefined ? "—" : fmt(v)) + "</strong><span>" + esc(s.name) + "</span></div>";
      }).join("");
      if (spec.band) rows += '<div class="tip-row"><span class="tip-key band"></span><strong>' + esc(fmt(spec.band.lo[i]) + "–" + fmt(spec.band.hi[i])) + "</strong><span>" + esc(spec.band.name) + "</span></div>";
      (spec.annotations || []).forEach(function (a, k) { if (a.index === i) rows += '<div class="tip-note">' + (k + 1) + ". " + esc(a.label) + "</div>"; });
      tip.innerHTML = '<div class="tip-title">' + esc(spec.labels[i]) + "</div>" + rows;
      tip.hidden = false;
      var tw = tip.offsetWidth, pw = plot.clientWidth;
      var lx = x + 14;
      if (lx + tw > pw - 4) lx = x - tw - 14;
      tip.style.left = Math.max(4, lx) + "px";
      tip.style.top = "6px";
    }
    function hide() {
      cur = -1; tip.hidden = true;
      if (cross) cross.setAttribute("visibility", "hidden");
      if (dots) dots.innerHTML = "";
      plot.querySelectorAll(".bar.hover").forEach(function (b) { b.classList.remove("hover"); });
    }
    function idxFrom(clientX) {
      var r = plot.getBoundingClientRect();
      var x = clientX - r.left - g.left;
      if (g.kind === "columns") return Math.min(g.n - 1, Math.max(0, Math.floor(x / g.band)));
      return Math.min(g.n - 1, Math.max(0, Math.round((x / g.w) * (g.n - 1))));
    }
    plot.addEventListener("pointermove", function (e) { show(idxFrom(e.clientX)); });
    plot.addEventListener("pointerleave", hide);
    plot.addEventListener("blur", hide);
    plot.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(cur < 0 ? 0 : Math.min(g.n - 1, cur + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(cur < 0 ? g.n - 1 : Math.max(0, cur - 1)); }
      else if (e.key === "Home") { e.preventDefault(); show(0); }
      else if (e.key === "End") { e.preventDefault(); show(g.n - 1); }
      else if (e.key === "Escape") hide();
    });
  }

  // ---------- Małe elementy (HTML/SVG zwracane jako tekst) ----------
  C.spark = function (values, opts) {
    opts = opts || {};
    var w = opts.w || 120, h = opts.h || 28;
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var span = max - min || 1;
    var pts = values.map(function (v, i) { return [(i / (values.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / span) * (h - 8)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("");
    var last = pts[pts.length - 1];
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true" focusable="false"><path class="spark-line" d="' + d + '"/><circle class="spark-dot" cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3"/></svg>';
  };

  // Licznik zużycia limitu: wypełnienie niesie stan, tor to jaśniejszy krok tego samego koloru.
  C.meter = function (o) {
    var pct = Math.min(100, (o.value / o.max) * 100);
    var state = o.critAt && pct >= o.critAt ? "crit" : o.warnAt && pct >= o.warnAt ? "warn" : "ok";
    var fc = o.forecast ? Math.min(100, (o.forecast / o.max) * 100) : null;
    return '<div class="meter meter-' + state + '" role="meter" aria-valuemin="0" aria-valuemax="' + o.max + '" aria-valuenow="' + Math.round(o.value) + '" aria-label="' + esc(o.label) + '" aria-valuetext="' + esc(o.valueText || Math.round(pct) + "%") + '">' +
      '<div class="meter-fill" style="width:' + pct.toFixed(1) + '%"></div>' +
      (fc !== null ? '<div class="meter-forecast" style="left:' + fc.toFixed(1) + '%" title="Prognoza na koniec okresu"></div>' : "") +
      (o.warnAt ? '<div class="meter-threshold" style="left:' + o.warnAt + '%" aria-hidden="true"></div>' : "") + "</div>";
  };

  // Lista słupków poziomych w stylu Plausible: wartości zawsze widoczne tekstem.
  C.barList = function (items, opts) {
    opts = opts || {};
    var total = opts.total || items.reduce(function (a, b) { return a + b[1]; }, 0);
    var max = Math.max.apply(null, items.map(function (x) { return x[1]; }));
    var fmt = opts.fmt || defFmt;
    return '<ol class="barlist' + (opts.ordinal ? " ordinal" : "") + '">' + items.map(function (it, i) {
      var pct = (it[1] / max) * 100;
      var share = opts.shareOf ? (it[1] / opts.shareOf[i]) : it[1] / total;
      return '<li><span class="barlist-bar" style="width:' + pct.toFixed(1) + '%" aria-hidden="true"></span><span class="barlist-label">' + (opts.labelHtml ? opts.labelHtml(it, i) : esc(it[0])) + '</span><span class="barlist-val num">' + esc(fmt(it[1])) + '</span><span class="barlist-pct num">' + (opts.noPct ? "" : esc(opts.pctText ? opts.pctText(it, i) : (share * 100).toFixed(share < 0.1 ? 1 : 0).replace(".", ",") + "%")) + "</span></li>";
    }).join("") + "</ol>";
  };

  // Mapa ciepła dzień × godzina: jedna barwa, od jasnej do ciemnej (sekwencyjnie).
  C.heatmap = function (matrix, rowsLabels, title) {
    var max = 0;
    matrix.forEach(function (r) { r.forEach(function (v) { if (v > max) max = v; }); });
    var html = '<div class="heat" role="img" aria-label="' + esc(title) + '. Najwięcej ruchu w godzinach 19–22, szczególnie w weekend. Pełne dane w tabeli."><div class="heat-grid">';
    html += '<span></span>' + Array.from({ length: 24 }, function (_, h) { return '<span class="heat-h">' + (h % 3 === 0 ? h : "") + "</span>"; }).join("");
    matrix.forEach(function (r, d) {
      html += '<span class="heat-d">' + esc(rowsLabels[d]) + "</span>" + r.map(function (v, h) {
        var step = Math.min(6, Math.floor((v / max) * 7));
        return '<span class="heat-c q' + step + '" title="' + esc(rowsLabels[d] + " " + h + ":00 – " + v + " odwiedzających") + '"></span>';
      }).join("");
    });
    html += '</div><div class="heat-scale" aria-hidden="true"><span>mniej</span>' + [0, 1, 2, 3, 4, 5, 6].map(function (q) { return '<span class="heat-c q' + q + '"></span>'; }).join("") + "<span>więcej</span></div></div>";
    var rows = matrix.map(function (r, d) { return "<tr><th scope=\"row\">" + esc(rowsLabels[d]) + "</th>" + r.map(function (v) { return '<td class="num">' + v + "</td>"; }).join("") + "</tr>"; }).join("");
    html += '<details class="chart-table"><summary>Tabela danych</summary><div class="table-scroll"><table class="table table-compact"><caption class="sr-only">' + esc(title) + '</caption><thead><tr><th scope="col">Dzień</th>' + Array.from({ length: 24 }, function (_, h) { return '<th scope="col" class="num">' + h + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div></details>";
    return html;
  };

  var ro = null;
  C.observe = function (root) {
    if (!("ResizeObserver" in window)) { window.addEventListener("resize", function () { C.mountAll(root); }); return; }
    if (ro) ro.disconnect();
    ro = new ResizeObserver(function (entries) {
      entries.forEach(function (en) { var fig = en.target.closest("figure.chart"); if (fig) C.draw(fig); });
    });
    root.querySelectorAll("figure.chart .chart-plot").forEach(function (p) { ro.observe(p); });
  };
})();
