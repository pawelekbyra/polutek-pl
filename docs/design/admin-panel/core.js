/* Wspólne klocki prototypu: formatowanie, ikony, plakietki, wiek danych, kafle, tabele, paginacja,
 * okna czasowe (globalny filtr), toasty i jedna rama modala. Ekrany (screens.js) składają z nich widoki. */
(function () {
  "use strict";
  const PP = window.PP;
  const C = window.Charts;
  const esc = C.esc;
  const TZ = PP.TZ;

  // ---------- Stan globalny ----------
  const S = (PP.state = { range: "28d", cmp: "prev", route: null, keepFocus: null });

  // ---------- Formatowanie (pl-PL, strefa Europe/Warsaw) ----------
  const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dfTime = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const dfDate = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: TZ });
  const dfDateY = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
  const dfWd = new Intl.DateTimeFormat("pl-PL", { weekday: "short", timeZone: TZ });
  const dfKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });
  const fmt = (PP.fmt = {
    int: (v) => nf0.format(Math.round(v)),
    one: (v) => nf1.format(v),
    pct: (v, d) => new Intl.NumberFormat("pl-PL", { maximumFractionDigits: d === undefined ? 1 : d }).format(v) + "%",
    money: (minor, cur) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: cur || "PLN" }).format(minor / 100),
    zl: (v) => nf0.format(Math.round(v)) + " zł",
    time: (d) => dfTime.format(d),
    date: (d) => dfDate.format(d),
    dateY: (d) => dfDateY.format(d),
    day(d) {
      const k = dfKey.format(d), now = dfKey.format(PP.now), y = dfKey.format(new Date(PP.now - PP.DAY));
      return k === now ? "dziś" : k === y ? "wczoraj" : dfWd.format(d) + " " + dfDate.format(d);
    },
    dt(d) { return fmt.day(d) + ", " + dfTime.format(d); },
    rel(d) {
      const s = Math.round((PP.now - d) / 1000), a = Math.abs(s), fut = s < 0;
      let t;
      if (a < 60) return "przed chwilą";
      if (a < 3600) t = Math.round(a / 60) + " min";
      else if (a < 86400) t = Math.floor(a / 3600) + " h" + (a % 3600 >= 600 && a < 36000 ? " " + Math.round((a % 3600) / 60) + " min" : "");
      else t = Math.floor(a / 86400) + " d" + (a < 864000 && a % 86400 >= 3600 ? " " + Math.floor((a % 86400) / 3600) + " h" : "");
      return fut ? "za " + t : t + " temu";
    },
    dur(s) {
      s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
      return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
    },
    daysLeft: (d) => Math.ceil((d - PP.now) / PP.DAY)
  });

  // ---------- Atomy HTML ----------
  const icon = (n, cls) => `<svg class="icon${cls ? " " + cls : ""}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
  const STATE_ICON = { ok: "ok", warn: "warn", crit: "crit", info: "info" };
  const STATE_WORD = { ok: "OK", warn: "Uwaga", crit: "Błąd", info: "Info" };
  const badge = (kind, text, ic) => `<span class="badge ${kind || ""}">${ic !== false && STATE_ICON[kind] ? icon(ic || STATE_ICON[kind]) : ic && ic !== true ? icon(ic) : ""}${esc(text)}</span>`;
  const state = (kind, text) => `<span class="state ${kind}">${icon(STATE_ICON[kind])}<span>${esc(text)}</span></span>`;
  // Wiek danych: "dane z 14:32"; za stare (> 2× oczekiwany interwał) -> "nieaktualne".
  function age(d, everyMin, src) {
    const mins = Math.round((PP.now - d) / 60000);
    const stale = everyMin && mins > everyMin * 2;
    const when = mins >= 1440 ? fmt.dt(d) : fmt.time(d);
    const title = `${src ? "Źródło: " + src + ". " : ""}Pomiar ${fmt.dt(d)} (${fmt.rel(d)})${everyMin ? ", odświeżane co " + everyMin + " min" : ""}.`;
    return stale
      ? `<span class="age stale" title="${esc(title)}">${icon("warn")}nieaktualne · dane z ${esc(when)}</span>`
      : `<span class="age" title="${esc(title)}">${icon("clock")}dane z ${esc(when)}</span>`;
  }
  function deltaHtml(cur, prev, upIsGood, ctx) {
    if (prev === null || prev === undefined || !isFinite(prev) || prev === 0) return `<span class="delta-ctx">${esc(ctx || "brak porównania")}</span>`;
    const p = (cur / prev - 1) * 100;
    const flat = Math.abs(p) < 1;
    const good = flat ? "flat" : (p > 0) === (upIsGood !== false) ? "good" : "bad";
    const word = flat ? "bez zmian" : (p > 0 ? "wzrost" : "spadek") + " o " + fmt.pct(Math.abs(p), 0);
    return `<span class="delta ${good}">${icon(flat ? "flat" : p > 0 ? "up" : "down")}<span aria-hidden="true">${flat ? "0%" : fmt.pct(Math.abs(p), 0)}</span><span class="sr-only">${word}${good === "bad" ? " (niekorzystnie)" : good === "good" ? " (korzystnie)" : ""}</span></span> <span class="delta-ctx">${esc(ctx)}</span>`;
  }
  function tile(o) {
    const tag = o.href ? "a" : "div";
    return `<${tag} class="tile"${o.href ? ` href="${o.href}"` : ""}>
      <span class="tile-label">${esc(o.label)}${o.hint ? ` <span class="muted" title="${esc(o.hint)}">${icon("info")}<span class="sr-only">${esc(o.hint)}</span></span>` : ""}</span>
      <span class="tile-value">${o.value}${o.unit ? `<small>${esc(o.unit)}</small>` : ""}</span>
      <span class="tile-meta">${o.delta || ""}</span>
      ${o.spark ? C.spark(o.spark, { w: 160, h: 28 }) : ""}
    </${tag}>`;
  }
  function card(o) {
    return `<section class="card${o.flush ? " card-flush" : ""}${o.cls ? " " + o.cls : ""}"${o.id ? ` id="${o.id}"` : ""} aria-labelledby="${o.hid}">
      <div class="card-head"><h2 id="${o.hid}">${esc(o.title)}</h2>${o.meta || ""}${o.sub ? `<p class="sub">${o.sub}</p>` : ""}</div>
      ${o.body}${o.foot ? `<div class="card-foot">${o.foot}</div>` : ""}</section>`;
  }
  let hidN = 0;
  const hid = (p) => (p || "h") + "-" + ++hidN;

  // ---------- Adresy (hash) z globalnym filtrem czasu ----------
  function href(path, q) {
    const p = new URLSearchParams();
    Object.keys(q || {}).forEach((k) => { if (q[k] !== undefined && q[k] !== null && q[k] !== "") p.set(k, q[k]); });
    if (S.range !== "28d") p.set("range", S.range);
    if (S.cmp !== "prev") p.set("cmp", S.cmp);
    const qs = p.toString();
    return "#/" + path + (qs ? "?" + qs : "");
  }
  function withParam(changes) {
    const r = S.route;
    const q = Object.assign({}, r.q);
    delete q.range; delete q.cmp;
    Object.keys(changes).forEach((k) => { if (changes[k] === "" || changes[k] === null) delete q[k]; else q[k] = changes[k]; });
    return href(r.parts.join("/"), q);
  }

  // ---------- Tabela + paginacja ----------
  // cols: [{label, num, cls, sortKey}], rows: [[cellHtml,...]], opts: {responsive, caption, sort, rowAttr(i)}
  function table(cols, rows, o) {
    o = o || {};
    const head = cols.map((c) => {
      const cls = (c.num ? "num " : "") + (c.cls || "");
      if (c.sortKey) {
        const curKey = (o.sort || "").replace(/-(asc|desc)$/, "");
        const dir = curKey === c.sortKey ? (o.sort.endsWith("asc") ? "ascending" : "descending") : "none";
        const next = dir === "descending" ? c.sortKey + "-asc" : c.sortKey + "-desc";
        return `<th scope="col" class="${cls}" aria-sort="${dir}"><button type="button" data-action="sort" data-sort="${next}">${esc(c.label)}${dir !== "none" ? icon(dir === "ascending" ? "up" : "down") : ""}</button></th>`;
      }
      return `<th scope="col" class="${cls}">${c.label ? esc(c.label) : '<span class="sr-only">Akcje</span>'}</th>`;
    }).join("");
    const body = rows.length
      ? rows.map((r, i) => `<tr${o.rowAttr ? " " + o.rowAttr(i) : ""}>` + r.map((cell, j) => {
          const c = cols[j];
          const cls = (c.num ? "num " : "") + (j === 0 ? "cell-first " : "") + (c.cls || "");
          return `<td class="${cls}" data-label="${esc(c.label || "")}"><span class="cell-in">${cell}</span></td>`;
        }).join("") + "</tr>").join("")
      : o.empty ? `<tr><td colspan="${cols.length}"><div class="empty">${icon("info")}<span>${esc(o.empty)}</span></div></td></tr>`
      : `<tr><td colspan="${cols.length}"><div class="empty">${icon("filter")}<strong>Brak wyników</strong><span>Żaden wiersz nie pasuje do filtrów. <a href="${withParam({ q: "", status: "", page: "" , kind: "", method: "", seg: "", actor: "", vid: ""})}">Wyczyść filtry</a></span></div></td></tr>`;
    return `<div class="table-scroll"><table class="table${o.responsive !== false ? " responsive" : ""}">${o.caption ? `<caption class="sr-only">${esc(o.caption)}</caption>` : ""}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function paginate(list, page, size) {
    const pages = Math.max(1, Math.ceil(list.length / size));
    const p = Math.min(Math.max(1, +page || 1), pages);
    return { items: list.slice((p - 1) * size, p * size), page: p, pages, total: list.length, from: list.length ? (p - 1) * size + 1 : 0, to: Math.min(p * size, list.length) };
  }
  function pager(pg, noun) {
    if (pg.total === 0) return "";
    const btn = (n, label, aria, dis) => dis
      ? `<span class="btn btn-sm page-btn" aria-disabled="true">${label}</span>`
      : `<a class="btn btn-sm page-btn" href="${withParam({ page: n === 1 ? "" : n })}"${n === pg.page && !aria ? ' aria-current="page"' : ""} aria-label="${esc(aria || "Strona " + n)}">${label}</a>`;
    let nums = "";
    for (let i = 1; i <= pg.pages; i++) {
      if (pg.pages > 7 && i > 2 && i < pg.pages - 1 && Math.abs(i - pg.page) > 1) { if (!nums.endsWith("…</span>")) nums += '<span class="muted" aria-hidden="true">…</span>'; continue; }
      nums += btn(i, String(i));
    }
    return `<div class="pager"><span>${pg.from}–${pg.to} z ${fmt.int(pg.total)} ${esc(noun || "")}</span>
      <nav aria-label="Strony wyników">${btn(pg.page - 1, icon("left"), "Poprzednia strona", pg.page === 1)}${nums}${btn(pg.page + 1, icon("right"), "Następna strona", pg.page === pg.pages)}</nav></div>`;
  }
  function selectParam(param, label, options, value) {
    const id = "f-" + param;
    return `<label class="sr-only" for="${id}">${esc(label)}</label><select class="select" id="${id}" data-param="${param}">${options.map((o) => `<option value="${esc(o[0])}"${o[0] === (value || "") ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
  }
  function searchParam(param, label, value) {
    const id = "f-" + param;
    return `<span class="search-wrap">${icon("search")}<label class="sr-only" for="${id}">${esc(label)}</label><input class="input" type="search" id="${id}" data-param="${param}" value="${esc(value || "")}" placeholder="${esc(label)}" autocomplete="off"></span>`;
  }
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

  // ---------- Okna czasowe ----------
  const RANGES = {
    today: { label: "dziś do teraz", hourly: true, n: 15, prevLabel: "vs wczoraj o tej porze" },
    "24h": { label: "ostatnie 24 h", hourly: true, n: 24, prevLabel: "vs poprzednie 24 h" },
    "7d": { label: "ostatnie 7 dni", days: 7, prevLabel: "vs poprzednie 7 dni" },
    "28d": { label: "ostatnie 28 dni", days: 28, prevLabel: "vs poprzednie 28 dni" },
    "90d": { label: "ostatnie 90 dni", days: 90, prevLabel: "vs poprzednie 90 dni" },
    "12m": { label: "ostatnie 12 miesięcy", days: 364, weekly: true, prevLabel: "vs poprzednie 12 miesięcy" }
  };
  PP.RANGES = RANGES;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  function cmpLabel() { return S.cmp === "none" ? "" : S.cmp === "year" ? "vs rok wcześniej" : RANGES[S.range].prevLabel; }
  // Zwraca bieżące i porównawcze wartości metryki w wybranym okresie (+ etykiety osi i adnotacje).
  function win(key, agg) {
    const r = RANGES[S.range];
    const avg = agg === "avg";
    let cur, prev, labels, dates;
    if (r.hourly) {
      const a = PP.hourly[key] || PP.hourly.visitors;
      cur = a.slice(48 - r.n);
      prev = a.slice(48 - r.n - 24, 48 - 24);
      const L = PP.daily[key].length - 1;
      if (S.cmp === "year") prev = cur.map((v) => v * (PP.daily[key][L - 364] / PP.daily[key][L]));
      labels = cur.map((_, i) => String((14 - (r.n - 1) + i + 24) % 24).padStart(2, "0") + ":00");
      dates = cur.map((_, i) => new Date(PP.now - (r.n - 1 - i) * 3600000));
    } else {
      const a = PP.daily[key];
      const L = a.length, n = r.days;
      cur = a.slice(L - n);
      prev = S.cmp === "year" ? a.slice(L - n - 364, L - 364) : a.slice(L - 2 * n, L - n);
      dates = cur.map((_, i) => new Date(PP.now - (n - 1 - i) * PP.DAY));
      labels = dates.map((d) => fmt.date(d));
      if (r.weekly) {
        const wk = (arr) => { const o = []; for (let i = 0; i < arr.length; i += 7) { const s = arr.slice(i, i + 7); o.push(avg ? sum(s) / s.length : sum(s)); } return o; };
        cur = wk(cur); prev = wk(prev);
        dates = dates.filter((_, i) => i % 7 === 0);
        labels = dates.map((d) => "tydz. " + fmt.date(d));
      }
    }
    const total = avg ? sum(cur) / cur.length : sum(cur);
    const prevTotal = S.cmp === "none" ? null : avg ? sum(prev) / prev.length : sum(prev);
    return { cur, prev: S.cmp === "none" ? null : prev, labels, dates, total, prevTotal };
  }
  function annotationsFor(w) {
    const out = [];
    const first = w.dates[0], last = w.dates[w.dates.length - 1];
    const step = w.dates.length > 1 ? w.dates[1] - w.dates[0] : PP.DAY;
    PP.changes.forEach((c) => {
      if (c.at < first - step / 2 || c.at > +last + step / 2) return;
      let idx = Math.round((c.at - first) / step);
      idx = Math.max(0, Math.min(w.dates.length - 1, idx));
      out.push({ index: idx, label: c.label, when: fmt.dt(c.at), kind: c.kind });
    });
    // Numeracja od lewej do prawej (chronologicznie), najwyżej 6 najnowszych.
    return out.sort((a, b) => a.index - b.index).slice(-6);
  }

  // ---------- Toasty ----------
  function toast(kind, title, body, action) {
    const box = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.innerHTML = `${icon(STATE_ICON[kind] || "info")}<div class="toast-body"><strong></strong><span class="text-2"></span>${action ? `<div class="row" style="margin-top:4px"><button type="button" class="btn btn-sm">${esc(action.label)}</button></div>` : ""}</div><button type="button" class="icon-btn" aria-label="Zamknij powiadomienie">${icon("close")}</button>`;
    el.querySelector("strong").textContent = title;
    el.querySelector(".toast-body > span").textContent = body || "";
    let timer;
    const close = () => { clearTimeout(timer); el.remove(); };
    const arm = () => { clearTimeout(timer); timer = setTimeout(close, action ? 12000 : 7000); };
    el.querySelector(".icon-btn").addEventListener("click", close);
    if (action) el.querySelector(".toast-body .btn").addEventListener("click", () => { action.run(); close(); });
    el.addEventListener("mouseenter", () => clearTimeout(timer));
    el.addEventListener("mouseleave", arm);
    el.addEventListener("focusin", () => clearTimeout(timer));
    box.appendChild(el);
    arm();
  }

  // ---------- Jedna rama modala ----------
  const modal = document.getElementById("modal");
  let returnFocus = null;
  function openModal(o) {
    if (!modal.open) returnFocus = document.activeElement;
    modal.innerHTML = `<div class="modal-head"><h2 id="modal-title">${esc(o.title)}</h2>${o.steps || ""}<button type="button" class="icon-btn" data-close aria-label="Zamknij">${icon("close")}</button></div>
      <form class="modal-form" novalidate style="display:contents"><div class="modal-body">${o.body}</div><div class="modal-foot">${o.foot}</div></form>`;
    modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
    if (!modal.open) modal.showModal();
    if (o.onOpen) o.onOpen(modal);
    const f = modal.querySelector("[autofocus]") || modal.querySelector(".modal-body input, .modal-body select, .modal-body button, .modal-foot .btn");
    if (f) f.focus();
  }
  function closeModal() { if (modal.open) modal.close(); }
  modal.addEventListener("close", () => {
    modal.innerHTML = "";
    // Po akcji ekran mógł się przerysować; wtedy fokus wraca na nagłówek strony, nie ginie.
    setTimeout(() => { if (returnFocus && document.contains(returnFocus)) returnFocus.focus(); else { const h = document.querySelector("#main h1"); if (h) h.focus(); } }, 0);
  });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  function confirmModal(o) {
    openModal({
      title: o.title,
      body: `<p>${o.body}</p>${o.effect ? `<div class="effect"><strong>Skutek</strong><ul>${o.effect.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}`,
      foot: `<button type="button" class="btn" data-close>Anuluj</button><button type="submit" class="btn ${o.danger ? "btn-danger" : "btn-primary"}">${esc(o.confirm)}</button>`,
      onOpen(m) { m.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); closeModal(); o.onConfirm(); }); }
    });
  }

  PP.ui = { S, esc, fmt, icon, badge, state, age, deltaHtml, tile, card, hid, href, withParam, table, paginate, pager, selectParam, searchParam, norm, win, sum, cmpLabel, annotationsFor, toast, openModal, closeModal, confirmModal, STATE_WORD };
})();
