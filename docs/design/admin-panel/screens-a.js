/* Ekrany: Dzisiaj, Analityka, Treści (lista + szczegół filmu), Premiera na żywo. */
(function () {
  "use strict";
  const PP = window.PP, C = window.Charts;
  const { S, esc, fmt, icon, badge, state, age, deltaHtml, tile, card, hid, href, withParam, table, paginate, pager, selectParam, searchParam, norm, win, cmpLabel, annotationsFor } = PP.ui;
  const SC = (PP.screens = PP.screens || {});

  const tabsNav = (label, items, cur) => `<nav class="tabs" aria-label="${esc(label)}">${items.map((t) => `<a href="${t[2]}"${t[0] === cur ? ' aria-current="page"' : ""}>${esc(t[1])}${t[3] ? ` <span class="nav-count ${t[4] || ""}"><span aria-hidden="true">${t[3]}</span><span class="sr-only">, ${t[3]} do przejrzenia</span></span>` : ""}</a>`).join("")}</nav>`;
  PP.ui.tabsNav = tabsNav;
  const head = (title, lede, actions, crumbs) => `<div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ""}<h1 tabindex="-1">${esc(title)}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
  PP.ui.head = head;
  const rangeText = () => PP.RANGES[S.range].label + (S.cmp === "none" ? "" : ", " + cmpLabel());

  function kpiTile(o) {
    const w = win(o.key, o.agg);
    const val = o.value ? o.value(w.total) : fmt.int(w.total);
    return tile({ label: o.label, value: val, unit: o.unit, href: o.href, hint: o.hint, spark: w.cur.length > 3 ? w.cur : null, delta: deltaHtml(w.total, w.prevTotal, o.upGood, cmpLabel()) });
  }
  PP.ui.kpiTile = kpiTile;

  function trendChart(key, title, opts) {
    opts = opts || {};
    const w = win(key, opts.agg);
    const ann = annotationsFor(w);
    const series = [{ name: PP.RANGES[S.range].label.replace(/^./, (c) => c.toUpperCase()), values: w.cur, role: "current", slot: 1 }];
    if (w.prev) series.push({ name: S.cmp === "year" ? "Rok wcześniej" : "Poprzedni okres", values: w.prev, role: "compare" });
    const sumTxt = `${title}: ${opts.fmtTotal ? opts.fmtTotal(w.total) : fmt.int(w.total)} w okresie (${PP.RANGES[S.range].label})` + (w.prevTotal ? `, ${w.total >= w.prevTotal ? "więcej" : "mniej"} niż ${cmpLabel().replace("vs ", "")} (${opts.fmtTotal ? opts.fmtTotal(w.prevTotal) : fmt.int(w.prevTotal)}).` : ".");
    return C.figure({ title, summary: sumTxt, labels: w.labels, series, annotations: ann, height: opts.height || 220, fmt: opts.fmt || ((v) => fmt.int(v)), yFmt: opts.yFmt, xName: S.range === "today" || S.range === "24h" ? "Godzina" : "Dzień" });
  }
  PP.ui.trendChart = trendChart;

  // ======================= DZISIAJ =======================
  SC.dzisiaj = function () {
    const triage = [
      { k: "crit", ic: "coins", t: `Spór 50,00 zł: dowody do śr. 8 paź, 23:59`, s: `zostało ${fmt.daysLeft(PP.dispute.dueBy)} dni · powód: nieuznana transakcja`, a: `<a class="btn btn-sm" href="${href("przychody", { tab: "spory" })}">Odpowiedz na spór</a>` },
      { k: "crit", ic: "film", t: `Kodowanie „Test kodowania 4K” nieudane`, s: "ffmpeg zakończony kodem 137 (brak pamięci) · 2 z 3 prób", a: `<button type="button" class="btn btn-sm" data-action="retry-encode" data-slug="test-kodowania-4k">Ponów</button><a class="btn btn-sm btn-ghost" href="${href("tresci/test-kodowania-4k")}">Szczegóły</a>` },
      { k: "warn", ic: "flag", t: "3 zgłoszone komentarze", s: "2 jako spam, 1 jako obraźliwy · najstarsze 2 h temu", a: `<a class="btn btn-sm" href="${href("spolecznosc", { tab: "moderacja" })}">Moderuj</a>` },
      { k: "warn", ic: "inbox", t: "2 wątki PP Support bez odpowiedzi > 24 h", s: age(PP.support.fetchedAt, 15, "API PP Support"), a: `<a class="btn btn-sm" href="${href("komunikacja")}">Szczegóły</a>` },
      { k: "warn", ic: "image", t: "Zadanie sync-public-thumbnails: 1 błąd", s: "„Wywiad z montażystą”: 403 z R2 · miniatura publiczna nieaktualna", a: `<a class="btn btn-sm" href="${href("system", { tab: "zadania" })}">Zobacz</a>` }
    ];
    const triageHtml = `<ul class="list">${triage.map((x) => `<li><span class="li-icon ${x.k}">${icon(x.ic)}</span><div class="li-main"><span class="li-title">${x.t}</span><span class="li-sub">${x.s}</span></div><span class="sr-only">${x.k === "crit" ? "Pilne" : "Uwaga"}</span><div class="row">${x.a}</div></li>`).join("")}</ul>`;

    const kpis = `<div class="tiles tiles-6" role="group" aria-label="Najważniejsze liczby, ${esc(rangeText())}">
      ${kpiTile({ key: "visitors", label: "Odwiedzający", href: href("analityka", { tab: "ruch" }) })}
      ${kpiTile({ key: "views", label: "Obejrzenia", href: href("analityka", { tab: "ogladalnosc" }) })}
      ${kpiTile({ key: "watchH", label: "Czas oglądania", unit: "h", href: href("analityka", { tab: "ogladalnosc" }) })}
      ${kpiTile({ key: "signups", label: "Nowe konta", href: href("spolecznosc", { tab: "uzytkownicy", seg: "nowi" }) })}
      ${kpiTile({ key: "comments", label: "Komentarze", href: href("spolecznosc", { tab: "komentarze" }) })}
      ${kpiTile({ key: "tipsPln", label: "Napiwki", unit: "zł", href: href("przychody"), hint: "Brutto, w PLN po kursie dnia. Netto po opłatach Stripe na ekranie Przychody." })}
    </div>`;

    const w = PP.worker;
    const limits = `
      <div class="limit"><div class="limit-head"><span class="limit-name">Worker HLS (doba UTC)</span><span class="limit-val">${fmt.int(w.used)} / ${fmt.int(w.limit)}</span></div>
        ${C.meter({ value: w.used, max: w.limit, label: "Zużycie limitu Workera HLS", warnAt: 70, critAt: 90, forecast: w.forecast, valueText: fmt.int(w.used) + " z " + fmt.int(w.limit) + " żądań, prognoza " + fmt.int(w.forecast) })}
        <span class="limit-note">${state("ok", "Prognoza na północ UTC: " + fmt.int(w.forecast) + " (" + Math.round((w.forecast / w.limit) * 100) + "%)")}</span>
        <span class="limit-note">ok. ${fmt.int((w.limit - w.used) / 650)} h oglądania do limitu · ${age(w.fetchedAt, 15, "Cloudflare GraphQL")}</span></div>
      <div class="limit"><div class="limit-head"><span class="limit-name">Resend: e-maile dziś</span><span class="limit-val">${PP.resend.today} / ${PP.resend.dayLimit}</span></div>
        ${C.meter({ value: PP.resend.today, max: PP.resend.dayLimit, label: "E-maile wysłane dziś", warnAt: 70, critAt: 90, forecast: 31 })}
        <span class="limit-note">miesiąc: ${PP.resend.month} / ${fmt.int(PP.resend.monthLimit)} · ${age(PP.resend.fetchedAt, 15, "Resend")}</span></div>
      <div class="limit"><div class="limit-head"><span class="limit-name">Swap serwera</span><span class="limit-val">1,42 / 4 GB · 36%</span></div>
        ${C.meter({ value: 36, max: 100, label: "Zajęty swap", warnAt: 25, critAt: 60 })}
        <span class="limit-note">${state("warn", "Powyżej progu 25% od 16 h")} <a href="${href("system", { tab: "serwer" })}">Kontenery wg RAM</a></span></div>
      <div class="limit"><div class="limit-head"><span class="limit-name">Dysk</span><span class="limit-val">46 / 75 GB · 64%</span></div>
        ${C.meter({ value: 64, max: 100, label: "Zajęty dysk", warnAt: 80, critAt: 90 })}
        <span class="limit-note">pełny za ok. 210 dni przy obecnym tempie</span></div>
      <div class="limit"><div class="limit-head"><span class="limit-name">R2 (darmowe 10 GB)</span><span class="limit-val">${fmt.one(PP.r2.gb)} / 10 GB</span></div>
        ${C.meter({ value: PP.r2.gb, max: 10, label: "Zajętość R2", warnAt: 80, critAt: 95 })}</div>`;

    const checks = [
      ["ok", "Strona (z zewnątrz)", "182 ms · strażnik Cloudflare"], ["ok", "Wideo i Worker HLS", "0 błędów 5xx w 1 h"],
      ["ok", "Kopia bazy", "02:31 · 48,2 MB · w R2"], ["ok", "Zadania okresowe", "8 z 9 bez błędów"],
      ["warn", "Swap serwera", "36% (próg 25%)"], ["ok", "Webhook Stripe", "ostatnie 13:52 · 0 nieudanych"]
    ];
    const checksHtml = `<div class="checks">${checks.map((c) => `<div class="check ${c[0]}">${icon(c[0])}<div><div>${esc(c[1])}</div><div class="check-sub">${esc(c[2])}</div></div><span class="sr-only">${PP.ui.STATE_WORD[c[0]]}</span></div>`).join("")}</div>`;

    const feedIcon = { deploy: ["deploy", "info"], publish: ["film", "ok"], broadcast: ["mail", ""], incident: ["warn", "warn"], note: ["note", ""] };
    const changes = PP.changes.slice(0, 6).map((c) => `<li><time datetime="${c.at.toISOString()}">${fmt.time(c.at)}</time><span class="li-icon ${feedIcon[c.kind][1]}">${icon(feedIcon[c.kind][0])}</span><div class="li-main"><span class="li-title">${esc(c.label)}</span><span class="li-sub">${esc(fmt.day(c.at))} · ${esc(c.detail)}</span></div></li>`).join("");
    const activity = [
      ["coins", "ok", "Napiwek 20,00 zł (BLIK) od ola_k", "pod „Kulisy premiery”", PP.payments[0].createdAt],
      ["message", "", "Nowy komentarz pod „Cześć”", "„Świetny montaż, szczególnie końcówka!”", PP.comments[0].createdAt],
      ["user-plus", "", "Nowe konto: Hubert", "źródło: x.com · zweryfikowane", PP.daysAgo(0, 13, 31)],
      ["flag", "warn", "Zgłoszenie komentarza (spam)", "„Kup teraz tanie zegarki…”", PP.daysAgo(0, 12, 40)],
      ["key", "", "Logowanie do panelu", "passkey · Windows · PL", PP.daysAgo(0, 14, 2)]
    ].map((a) => `<li><time datetime="${a[4].toISOString()}">${fmt.time(a[4])}</time><span class="li-icon ${a[1]}">${icon(a[0])}</span><div class="li-main"><span class="li-title">${esc(a[2])}</span><span class="li-sub">${esc(a[3])}</span></div></li>`).join("");

    const jobs = PP.jobs.map((j) => {
      const st = { running: ["info", "W toku"], failed: ["crit", "Błąd"], scheduled: ["", "Zaplanowane"], waiting: ["warn", "Czeka"] }[j.state];
      return `<li><div class="li-main"><a class="li-title" href="${j.href}">${esc(j.label)}</a><span class="li-sub">${esc(j.detail)}</span></div>${badge(st[0], st[1], st[0] ? undefined : "clock")}</li>`;
    }).join("");

    const kul = PP.videoBySlug.kulisy;
    const html = `${head("Dzisiaj", `Niedziela, 4 października · ${esc(rangeText())}`, `<a class="btn" href="${href("premiera")}">${icon("live")}Tryb premiery</a>`)}
      <div class="grid">
        <div class="span-12"><div class="banner warn" role="status">${icon("warn")}<div class="banner-body"><span class="banner-title">Działa, 1 ostrzeżenie: swap serwera 36% (próg 25%) od 16 h</span><span class="text-2">14 z 15 kontroli OK · ostatnia kopia 02:31 poza serwerem · test odtworzenia ${esc(fmt.rel(PP.restoreTest.at))} · ${age(PP.host.fetchedAt, 1, "pp-collector")}</span></div><a class="btn btn-sm" href="${href("system")}">Centrum zdrowia</a></div></div>
        <div class="span-12">${kpis}</div>
        <div class="span-8 stack">
          ${card({ hid: "h-triage", title: "Wymaga uwagi (5)", meta: `<span class="muted">od ostatniej wizyty: 2 nowe</span>`, body: triageHtml })}
          ${card({ hid: "h-traffic", title: "Odwiedzający", meta: `<a href="${href("analityka", { tab: "ruch" })}">Analityka ${icon("right")}</a>`, body: trendChart("visitors", "Odwiedzający") })}
          <div class="grid">
            <div class="span-6">${card({ hid: "h-changes", title: "Ostatnie zmiany", sub: "wdrożenia, publikacje, rozsyłki, incydenty", body: `<ul class="list feed">${changes}</ul>`, foot: `<a href="${href("system", { tab: "zdrowie" })}">Cała oś zmian</a><button type="button" class="btn btn-sm btn-ghost" data-action="note">${icon("note")}Dodaj notatkę</button>` })}</div>
            <div class="span-6">${card({ hid: "h-activity", title: "Aktywność", meta: `<span class="age">${icon("clock")}na żywo</span>`, body: `<ul class="list feed">${activity}</ul>`, foot: `<a href="${href("bezpieczenstwo", { tab: "audyt" })}">Dziennik audytu</a>` })}</div>
          </div>
        </div>
        <div class="span-4 stack">
          ${card({ hid: "h-limits", title: "Limity dziś", body: limits })}
          ${card({ hid: "h-now", title: "Teraz na stronie", meta: `<span class="age">${icon("clock")}ostatnie 5 min</span>`, body: `<div class="row" style="gap:24px;margin-bottom:12px"><div><div class="hero-num">${PP.live.online}</div><div class="muted">osób na stronie</div></div><div><div class="hero-num">${PP.live.watching}</div><div class="muted">ogląda film</div></div></div>${C.barList(PP.live.perVideo, { noPct: true })}<p class="limit-note" style="margin-top:8px">czas startu p95 1,4 s · 0 błędów odtwarzania</p>` })}
          ${card({ hid: "h-system", title: "Stan systemu", meta: `<a href="${href("system")}">Wszystkie ${icon("right")}</a>`, body: checksHtml })}
          ${card({ hid: "h-jobs", title: "Kolejka zadań", body: `<ul class="list">${jobs}</ul>` })}
          ${card({ hid: "h-next", title: "Nadchodzi", body: `<ul class="list"><li><span class="li-icon info">${icon("calendar")}</span><div class="li-main"><a class="li-title" href="${href("tresci/kulisy")}">Premiera „${esc(kul.title)}”</a><span class="li-sub">wt. 6 paź, 20:00 · ${esc(fmt.rel(kul.premiereAt))}</span></div></li><li><span class="li-icon">${icon("mail")}</span><div class="li-main"><span class="li-title">Rozsyłka zapowiedzi</span><span class="li-sub">pon. 5 paź, 18:00 · 31 odbiorców</span></div></li><li><span class="li-icon warn">${icon("globe")}</span><div class="li-main"><span class="li-title">Certyfikat *.pawelperfect.pl</span><span class="li-sub">wygasa za ${fmt.daysLeft(PP.domains[3].expires)} dni · odnowienie automatyczne</span></div></li></ul>` })}
        </div>
      </div>`;
    return { title: "Dzisiaj", html };
  };

  // ======================= ANALITYKA =======================
  SC.analityka = function (r) {
    const tab = r.q.tab || "ruch";
    const tabs = tabsNav("Sekcje analityki", [["ruch", "Ruch i źródła", href("analityka", { tab: "ruch" })], ["lejek", "Lejek i atrybucja", href("analityka", { tab: "lejek" })], ["ogladalnosc", "Oglądalność", href("analityka", { tab: "ogladalnosc" })], ["jakosc", "Jakość odtwarzania", href("analityka", { tab: "jakosc" })]], tab);
    let body = "";
    const k = PP.ui.kpiTile;
    if (tab === "ruch") {
      const pct = (v) => fmt.pct(v * 100, 0);
      body = `<div class="grid">
        <div class="span-12"><div class="tiles" role="group" aria-label="Ruch, ${esc(rangeText())}">
          ${k({ key: "visitors", label: "Odwiedzający", hint: "Unikalni na dobę (dzienny solony skrót, bez ciasteczek), zsumowani w okresie." })}
          ${k({ key: "pageviews", label: "Odsłony" })}
          ${k({ key: "bounce", label: "Odrzucenia", agg: "avg", upGood: false, value: (v) => pct(v) })}
          ${k({ key: "visitMin", label: "Śr. czas wizyty", agg: "avg", value: (v) => fmt.one(v), unit: "min" })}
          ${k({ key: "views", label: "Obejrzenia" })}
        </div></div>
        <div class="span-12">${card({ hid: "h-tr", title: "Odwiedzający w czasie", sub: "Pionowe znaczniki to zmiany z osi zmian: wdrożenia, publikacje, rozsyłki, incydenty i notatki.", body: trendChart("visitors", "Odwiedzający w czasie", { height: 260 }) })}</div>
        <div class="span-4">${card({ hid: "h-src", title: "Źródła ruchu", meta: age(PP.daysAgo(0, 14, 30), 5, "telemetria własna"), body: C.barList(PP.sources) })}</div>
        <div class="span-4">${card({ hid: "h-cty", title: "Kraje", body: C.barList(PP.countries.map((c) => [c[0], c[2]]), {}) })}</div>
        <div class="span-4">${card({ hid: "h-dev", title: "Urządzenia", body: C.barList(PP.devices) + `<h3 class="section-title" style="margin-top:16px">Sposób otwarcia</h3>` + C.barList(PP.displayMode) + `<h3 class="section-title" style="margin-top:16px">Przeglądarki</h3>` + C.barList(PP.browsers) })}</div>
        <div class="span-6">${card({ hid: "h-pages", title: "Strony", flush: true, body: table([{ label: "Strona" }, { label: "Odsłony", num: true }, { label: "Odrzucenia", num: true }], PP.pages.map((p) => [`<span class="mono">${esc(p[0])}</span>`, fmt.int(p[1]), p[2] + "%"]), { caption: "Najczęściej odwiedzane strony" }) })}</div>
        <div class="span-6">${card({ hid: "h-heat", title: "Kiedy przychodzą (dzień × godzina)", sub: "Czas warszawski. Pomaga wybrać godzinę premiery i rozsyłki.", body: C.heatmap(PP.heat, ["pon", "wt", "śr", "czw", "pt", "sob", "nd"], "Odwiedzający według dnia tygodnia i godziny") })}</div>
        <div class="span-12"><p class="foot-note">${icon("info")}Nowi i powracający: liczymy tylko dla zalogowanych (bez ciasteczek nie da się rozpoznać anonimowego powrotu). Ruch krawędzi Cloudflare (z botami) jest w System → Domeny i Cloudflare.</p></div>
      </div>`;
    } else if (tab === "lejek") {
      const f = PP.funnel;
      const funnel = C.barList(f, { ordinal: true, pctText: (it, i) => (i === 0 ? "100%" : fmt.pct((it[1] / f[i - 1][1]) * 100, 0)) });
      body = `<div class="grid">
        <div class="span-7">${card({ hid: "h-fun", title: "Ścieżka: wejście → rejestracja → komentarz → napiwek", sub: `${esc(rangeText())} · procent to przejście z poprzedniego kroku`, body: funnel + `<p class="limit-note" style="margin-top:12px">${state("warn", "Mała próba: n = 9 napiwków")} Wnioski o ostatnich krokach traktuj ostrożnie.</p>`, foot: `<span>Konwersja wizyta → napiwek: <strong>0,17%</strong></span><span class="muted">Liczby z bazy (User, Comment, Payment) + telemetria wizyt</span>` })}</div>
        <div class="span-5">${card({ hid: "h-attr", title: "Atrybucja", sub: "Pierwsze źródło osoby (zapisane przy rejestracji i w metadanych płatności)", flush: true, body: table([{ label: "Źródło" }, { label: "Wizyty", num: true }, { label: "Konta", num: true }, { label: "Napiwki", num: true }], PP.attribution.map((a) => [esc(a[0]), a[1] + "%", String(a[2]), String(a[3])]), { caption: "Atrybucja rejestracji i napiwków" }) })}</div>
        <div class="span-12">${card({ hid: "h-tipf", title: "Lejek bramki napiwkowej", sub: "Gdzie ludzie rezygnują z wpłaty", body: C.barList(PP.tipFunnel, { ordinal: true, pctText: (it, i) => (i === 0 ? "100%" : fmt.pct((it[1] / PP.tipFunnel[i - 1][1]) * 100, 0)) }) + `<p class="limit-note" style="margin-top:12px">Największy spadek: otwarcie → kwota (43% rezygnuje). Odrzucenia Stripe: 4 × <span class="mono">card_declined</span>, 3 × BLIK wygasł.</p>` })}</div>
      </div>`;
    } else if (tab === "ogladalnosc") {
      const vids = PP.videos.filter((v) => v.status === "PUBLISHED").sort((a, b) => b.views - a.views).slice(0, 8);
      const dur = PP.videoBySlug.czesc.durationS;
      const labels = PP.retention.map((_, i) => fmt.dur((dur * i) / 100));
      const ret = C.figure({ title: "Retencja „Cześć”", summary: "Po 30 s zostaje 89% widzów (typowo 84%). Do końca dotrwało 31% (typowo 22%). Wzrost w 41% filmu (powtórki), spadek w 63% (przewijanie).", labels, series: [{ name: "„Cześć”", values: PP.retention, role: "current", slot: 1, area: false }], band: { name: "Typowy film kanału", lo: PP.retLo, hi: PP.retHi }, annotations: [{ index: 41, label: "Powtórki (fragment z górami)", when: labels[41] }, { index: 63, label: "Przewijanie", when: labels[63] }], height: 240, fmt: (v) => fmt.pct(v, 0), yMax: 100, xName: "Moment filmu", tableStep: 5 });
      body = `<div class="grid">
        <div class="span-12"><div class="tiles" role="group" aria-label="Oglądalność">
          ${k({ key: "views", label: "Obejrzenia" })}
          ${k({ key: "watchH", label: "Czas oglądania", unit: "h" })}
          ${tile({ label: "Śr. % obejrzenia", value: "61%", delta: deltaHtml(61, 57, true, cmpLabel()) })}
          ${tile({ label: "Unikalni widzowie", value: fmt.int(win("views").total * 0.62), delta: deltaHtml(1.1, 1, true, cmpLabel()) })}
        </div></div>
        <div class="span-7">${card({ hid: "h-ret", title: "Retencja: „Cześć”", meta: `<label class="sr-only" for="ret-film">Film</label><select class="select" id="ret-film"><option>Cześć</option><option>JJ</option><option>Dla patronów</option></select>`, sub: "Jaki procent widzów ogląda dany moment filmu; szare pasmo to typowy zakres dla filmów kanału.", body: ret })}</div>
        <div class="span-5">${card({ hid: "h-vids", title: "Filmy w okresie", flush: true, body: table([{ label: "Film" }, { label: "Obejrzenia", num: true }, { label: "Śr. %", num: true }, { label: "vs typowy" }], vids.map((v) => [`<a href="${href("tresci/" + v.slug)}">${esc(v.title)}</a>`, fmt.int(v.views), (v.avgPct || 0) + "%", v.avgPct > 55 ? badge("ok", "powyżej") : v.avgPct < 45 ? badge("warn", "poniżej") : badge("", "typowo", false)]), { caption: "Najczęściej oglądane filmy" }) })}</div>
      </div>`;
    } else {
      const q = PP.qoe;
      const days = q.startupDaily.map((_, i) => fmt.date(new Date(PP.now - (29 - i) * PP.DAY)));
      const st = C.figure({ title: "Czas startu p95", summary: `Czas od kliknięcia do pierwszej klatki, 95. percentyl. Spadł z 2,6 s do 2,1 s w 30 dni; cel 2 s.`, labels: days, series: [{ name: "p95", values: q.startupDaily, role: "current", slot: 1 }], refLine: { value: 2, label: "cel 2 s" }, annotations: [{ index: 26, label: "Migracja na serwerek", when: days[26] }], height: 200, fmt: (v) => fmt.one(v) + " s", endLabel: true });
      const hours = PP.worker.hourly.map((_, i) => String(i).padStart(2, "0") + ":00");
      const over = PP.worker.hourly.filter((x) => x > 4167).length;
      const wk = C.figure({ type: "columns", title: "Żądania do Workera HLS na godzinę (UTC)", summary: `Dziś ${fmt.int(PP.worker.used)} żądań; czerwona linia to tempo, przy którym limit 100 tys. kończy się dokładnie o północy UTC (4167/h). Powyżej tempa: ${over} z ${PP.worker.hourly.length} godzin (wieczorny szczyt), średnio poniżej.`, labels: hours, series: [{ name: "Żądania", values: PP.worker.hourly, role: "current", slot: 1 }], refLine: { value: 4167, label: "tempo limitu" }, height: 200, xName: "Godzina UTC" });
      body = `<div class="grid">
        <div class="span-12"><div class="tiles" role="group" aria-label="Jakość odtwarzania">
          ${tile({ label: "Wynik doświadczenia widza", value: q.score, unit: "/100", hint: "Średnia wyników Mux Data: start, płynność, sukces odtwarzania.", delta: deltaHtml(q.score, 88, true, cmpLabel()) })}
          ${tile({ label: "Czas startu p50 / p95", value: fmt.one(q.startupP50) + " / " + fmt.one(q.startupP95), unit: "s", delta: deltaHtml(q.startupP95, q.startupPrevP95, false, cmpLabel()) })}
          ${tile({ label: "Wyjścia przed startem", value: fmt.one(q.exitsBefore), unit: "%", delta: deltaHtml(3.1, 3.4, false, cmpLabel()) })}
          ${tile({ label: "Błędy odtwarzania", value: fmt.one(q.failure), unit: "%", delta: deltaHtml(0.4, 0.3, false, cmpLabel()) })}
          ${tile({ label: "Buforowanie", value: fmt.one(q.rebuffer), unit: "% czasu", delta: deltaHtml(0.6, 0.9, false, cmpLabel()) })}
        </div></div>
        <div class="span-6">${card({ hid: "h-st", title: "Czas startu p95 (30 dni)", body: st })}</div>
        <div class="span-6">${card({ hid: "h-wk", title: "Worker HLS dziś", meta: age(PP.worker.fetchedAt, 15, "Cloudflare GraphQL"), body: wk })}</div>
        <div class="span-4">${card({ hid: "h-ren", title: "Rendycje (udział czasu oglądania)", body: C.barList(q.renditions, { fmt: (v) => v + "%", noPct: true }) })}</div>
        <div class="span-4">${card({ hid: "h-err", title: "Błędy odtwarzania wg typu", body: C.barList(q.errors, { noPct: true }) + `<p class="limit-note" style="margin-top:8px"><a href="${href("system", { tab: "zdrowie" })}">Lista sesji z błędami</a></p>` })}</div>
        <div class="span-4">${card({ hid: "h-edge", title: "Krawędź video.pawelperfect.com", meta: age(PP.edge.fetchedAt, 15, "Cloudflare GraphQL"), body: `<dl class="kv"><dt>Cache hit</dt><dd class="tabular">${fmt.one(PP.edge.cacheHit)}%</dd><dt>403 (token)</dt><dd class="tabular">${PP.edge.s403} w 24 h</dd><dt>404 (segmenty)</dt><dd class="tabular">${PP.edge.s404} w 24 h ${badge("warn", "do sprawdzenia")}</dd><dt>5xx</dt><dd class="tabular">0</dd></dl>` })}</div>
      </div>`;
    }
    return { title: "Analityka", html: head("Analityka", esc(rangeText())) + tabs + body };
  };

  // ======================= TREŚCI =======================
  const STATUS = { PUBLISHED: ["ok", "Opublikowany"], DRAFT: ["", "Szkic"], ARCHIVED: ["", "Archiwum"] };
  function statusBadge(v) {
    if (v.status === "PUBLISHED" && v.premiereAt && v.premiereAt > PP.now) return badge("info", "Premiera " + fmt.date(v.premiereAt) + ", " + fmt.time(v.premiereAt), "calendar");
    const s = STATUS[v.status];
    return badge(s[0], s[1], s[0] ? undefined : false);
  }
  function hlsState(v) {
    return v.hls === "READY" ? state("ok", "Gotowe") : v.hls === "ENCODING" ? state("info", "Kodowanie " + v.encodePct + "%") : v.hls === "FAILED" ? state("crit", "Błąd") : `<span class="muted">brak oryginału</span>`;
  }
  const TIER = { PUBLIC: "Publiczny", LOGGED_IN: "Zalogowani", PATRON: "Patron" };
  const needsAttention = (v) => v.hls === "FAILED" || v.hls === "NONE" || v.thumb !== "OK" || (v.status === "PUBLISHED" && !v.subsPl);

  SC.tresci = function (r) {
    if (r.parts[1]) return filmDetail(r.parts[1]);
    const q = r.q;
    let list = PP.videos.slice();
    if (q.q) list = list.filter((v) => norm(v.title + " " + v.slug).includes(norm(q.q)));
    if (q.status === "PREMIERE") list = list.filter((v) => v.premiereAt && v.premiereAt > PP.now);
    else if (q.status === "ATTN") list = list.filter(needsAttention);
    else if (q.status) list = list.filter((v) => v.status === q.status);
    if (q.tier) list = list.filter((v) => v.tier === q.tier);
    const sort = q.sort || "views7-desc";
    const [sk, sd] = sort.split("-");
    const val = (v) => (sk === "title" ? norm(v.title) : sk === "pub" ? +(v.publishedAt || 0) : v.views7);
    list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sd === "asc" ? 1 : -1));
    const pg = paginate(list, q.page, 10);
    const cols = [{ label: "Film", sortKey: "title" }, { label: "Status" }, { label: "Wideo (HLS)" }, { label: "Miniatura", cls: "hide-sm" }, { label: "Napisy", cls: "hide-sm" }, { label: "Dostęp", cls: "hide-md hide-sm" }, { label: "Publikacja", sortKey: "pub", cls: "hide-md hide-sm" }, { label: "Obejrzenia 7 d", num: true, sortKey: "views7" }, { label: "", cls: "hide-sm" }];
    const rows = pg.items.map((v) => [
      `<div class="cell-title"><span class="thumb" aria-hidden="true"></span><div><a href="${href("tresci/" + v.slug)}">${esc(v.title)}</a><div class="muted mono">${esc(v.slug)}</div></div></div>`,
      statusBadge(v), hlsState(v),
      v.thumb === "OK" ? state("ok", "OK") : v.thumb === "NOT_SYNCED" ? state("warn", "Niezsynchr.") : state("warn", "Domyślna"),
      `${v.subsPl ? badge("outline", "PL", false) : ""} ${v.subsEn ? badge("outline", "EN", false) : ""}${!v.subsPl && !v.subsEn ? '<span class="muted">brak</span>' : ""}`,
      esc(TIER[v.tier]), v.publishedAt ? esc(fmt.dateY(v.publishedAt)) : '<span class="muted">—</span>', fmt.int(v.views7),
      `<a class="btn btn-sm btn-ghost" href="${href("tresci/" + v.slug)}" aria-label="Otwórz ${esc(v.title)}">${icon("right")}</a>`
    ]);
    const filters = `<div class="filters" role="search" aria-label="Filtry filmów">
      ${searchParam("q", "Szukaj po tytule lub slugu", q.q)}
      ${selectParam("status", "Status", [["", "Wszystkie statusy"], ["PUBLISHED", "Opublikowane"], ["PREMIERE", "Premiery"], ["DRAFT", "Szkice"], ["ARCHIVED", "Archiwum"], ["ATTN", "Wymaga uwagi"]], q.status)}
      ${selectParam("tier", "Dostęp", [["", "Każdy dostęp"], ["PUBLIC", "Publiczny"], ["LOGGED_IN", "Zalogowani"], ["PATRON", "Patron"]], q.tier)}
    </div>`;
    const enc = PP.videoBySlug["qa-1"];
    const html = `${head("Treści", `${PP.videos.length} filmów · ${PP.videos.filter(needsAttention).length} wymaga uwagi`, `<a class="btn" href="${href("tresci", { status: "PREMIERE" })}">${icon("calendar")}Premiery</a><a class="btn" href="${href("tresci", { widok: "uklad" })}">${icon("settings")}Układ kanału</a><a class="btn btn-primary" href="${href("tresci/nowy")}">${icon("upload")}Nowy film</a>`)}
      <div class="banner" style="margin-bottom:16px">${icon("film")}<div class="banner-body"><span class="banner-title">Kodowanie w toku: „${esc(enc.title)}” · ${enc.encodePct}%</span><span class="text-2">${esc(enc.encodeStage)} · ok. 4 min · encoder: heartbeat 20 s temu</span>${C.meter({ value: enc.encodePct, max: 100, label: "Postęp kodowania", valueText: enc.encodePct + "%" })}</div><a class="btn btn-sm" href="${href("tresci/qa-1")}">Podgląd</a></div>
      ${filters}
      <section class="card card-flush" aria-label="Lista filmów">${table(cols, rows, { caption: "Filmy", sort })}${pager(pg, "filmów")}</section>`;
    return { title: "Treści", html };
  };

  function filmDetail(slug) {
    const v = PP.videoBySlug[slug] || PP.videoBySlug.czesc;
    const upcoming = v.premiereAt && v.premiereAt > PP.now;
    const stages = [["Oryginał wgrany", "4,2 GB · weryfikacja OK"], ["Analiza (ffprobe)", "1080p · 29,97 kl./s · 31:44"], ["Kodowanie", "5 rendycji"], ["Wysyłka do R2", "master.m3u8 na końcu"], ["Aktywna trasa", "SELF_HLS · v3"]];
    const doneUpTo = v.hls === "READY" ? 5 : v.hls === "ENCODING" ? 2 : v.hls === "FAILED" ? 2 : 0;
    const pipeline = `<ol class="pipeline">${stages.map((s, i) => `<li class="${i < doneUpTo ? "done" : i === doneUpTo && v.hls !== "NONE" ? "now" : ""}"><span>${i < doneUpTo ? state("ok", s[0]) : i === doneUpTo && v.hls === "FAILED" ? state("crit", s[0]) : i === doneUpTo && v.hls === "ENCODING" ? state("info", s[0] + " " + v.encodePct + "%") : `<span class="muted">${esc(s[0])}</span>`}</span><span class="muted">${esc(s[1])}</span></li>`).join("")}</ol>`;
    const renditions = table([{ label: "Rendycja" }, { label: "Bitrate", num: true }, { label: "Rozmiar", num: true }, { label: "Stan" }], [["1080p", "4,5 Mb/s", "1,07 GB"], ["720p", "2,8 Mb/s", "668 MB"], ["480p", "1,4 Mb/s", "334 MB"], ["360p", "0,8 Mb/s", "191 MB"], ["240p", "0,4 Mb/s", "95 MB"]].map((x, i) => [x[0], x[1], x[2], v.hls === "READY" || (v.hls === "ENCODING" && i > 1) ? state("ok", "Gotowa") : v.hls === "ENCODING" && i === 1 ? state("info", "W toku") : v.hls === "FAILED" && i === 0 ? state("crit", "Błąd") : '<span class="muted">czeka</span>']), { caption: "Rendycje HLS", responsive: true });
    const failLog = v.hls === "FAILED" ? `<div class="banner crit" style="margin-top:12px">${icon("crit")}<div class="banner-body"><span class="banner-title">Kodowanie przerwane: brak pamięci (kod 137)</span><span class="text-2">Próba 2 z 3 · limit kontenera encoder 1,5 GB · materiał 2160p</span><pre class="mono" style="margin:8px 0 0;white-space:pre-wrap;font-size:12px">[ffmpeg] frame= 1840 fps= 11 q=28.0 size= 512000kB time=00:01:01.33
[worker] encoder: killed (OOMKilled) after 4 m 12 s</pre></div></div>` : "";
    const checklist = [
      [v.hls === "READY" ? "ok" : "crit", "Wideo HLS gotowe i aktywna trasa"], [v.hls === "READY" ? "ok" : "warn", "Test tokenu: master.m3u8 i pierwszy segment każdej rendycji"],
      [v.thumb === "OK" ? "ok" : "warn", v.thumb === "OK" ? "Miniatura publiczna zsynchronizowana" : "Miniatura: " + (v.thumb === "DEFAULT" ? "domyślna" : "kopia publiczna nieaktualna")],
      ["ok", "Tytuł i opis PL"], [v.subsEn ? "ok" : "warn", "Tytuł, opis i napisy EN"], [v.subsPl ? "ok" : "warn", "Napisy PL"], ["ok", "Podgląd jako gość i jako zalogowany"]
    ];
    const ready = checklist.filter((c) => c[0] === "crit").length === 0;
    const hist = PP.audit.filter((a) => a.target === "Film").slice(0, 5).map((a) => `<li><div class="li-main"><span class="li-title">${esc(a.label)}</span><span class="li-sub">${esc(fmt.dt(a.at))} · ${esc(a.actor)}</span></div></li>`).join("");
    const premiereLocal = upcoming ? "2026-10-06T20:00" : "";
    const actions = `<a class="btn" href="${href("tresci/" + v.slug + "/edycja")}">${icon("note")}Edytuj</a><button type="button" class="btn" data-action="toast" data-msg="Podgląd jako gość: otwiera stronę w trybie tylko do odczytu z banerem (zapis ADMIN_VIEW_AS w audycie)">${icon("eye")}Podgląd jako widz</button>${v.status === "PUBLISHED" ? `<button type="button" class="btn" data-action="unpublish" data-title="${esc(v.title)}">Cofnij publikację</button>` : `<button type="button" class="btn btn-primary" ${ready ? "" : 'aria-disabled="true" title="Najpierw usuń błędy z listy kontrolnej"'} data-action="${ready ? "toast" : "noop"}" data-msg="Opublikowano (prototyp)">Opublikuj</button>`}`;
    const html = `${head(v.title, `${statusBadge(v)} ${badge("outline", TIER[v.tier], false)} ${v.hero ? badge("info", "Hero strony głównej", false) : ""} <span class="muted mono">/${esc(v.slug)}</span>`, actions, `<a href="${href("tresci")}">Treści</a>${icon("right")}<span>${esc(v.title)}</span>`)}
      ${tabsNav("Sekcje filmu", [["p", "Przegląd i edycja", href("tresci/" + v.slug)], ["a", "Analityka filmu", href("analityka", { tab: "ogladalnosc" })]], "p")}
      <div class="grid">
        <div class="span-8 stack">
          ${v.status === "PUBLISHED" ? `<div class="tiles" role="group" aria-label="Statystyki filmu od publikacji">${tile({ label: "Obejrzenia", value: fmt.int(v.views) })}${tile({ label: "Czas oglądania", value: fmt.int(v.watchH), unit: "h" })}${tile({ label: "Śr. % obejrzenia", value: (v.avgPct || 0) + "%" })}${tile({ label: "Napiwki z filmu", value: String(v.tips), hint: "Napiwki z bramki otwartej na tym filmie (atrybucja)." })}</div>` : ""}
          ${card({ hid: "h-enc", title: "Kodowanie i wideo", meta: `${v.hls === "FAILED" ? `<button type="button" class="btn btn-sm btn-primary" data-action="retry-encode" data-slug="${v.slug}">${icon("refresh")}Ponów kodowanie</button>` : v.hls === "ENCODING" ? `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Anulowanie zlecone: worker przerwie przy następnym heartbeacie i posprząta pliki">Anuluj</button>` : `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Zlecono ponowne kodowanie (nowa wersja HLS, stara gra do czasu gotowości)">${icon("refresh")}Przekoduj</button>`}`, body: pipeline + failLog + `<h3 class="section-title">Rendycje</h3>` + renditions })}
          ${card({ hid: "h-prem", title: "Publikacja i premiera", body: `<div class="grid">
              <fieldset class="span-6 field" style="border:0;padding:0;margin:0"><legend class="field-label">Kiedy</legend>
                <label class="choice"><input type="radio" name="when" ${upcoming ? "" : "checked"}> Natychmiast po publikacji</label>
                <label class="choice"><input type="radio" name="when" ${upcoming ? "checked" : ""}> Premiera o wybranej godzinie</label></fieldset>
              <div class="span-6 field"><label for="prem-at">Data i godzina premiery</label><input class="input" id="prem-at" type="datetime-local" value="${premiereLocal}" aria-describedby="prem-hint"><span class="hint" id="prem-hint">Czas warszawski. Przed premierą zalogowani widzą kokpit z odliczaniem, goście ekran logowania.</span></div>
            </div>${upcoming ? `<div class="banner" style="margin-top:12px">${icon("calendar")}<div class="banner-body"><span class="banner-title countdown">Premiera ${esc(fmt.rel(v.premiereAt))} · wt. 6 paź, 20:00</span><span class="text-2">Rozsyłka zapowiedzi zaplanowana na pon. 18:00 · strona główna: ten film jako hero</span></div></div>` : ""}`, foot: `<span class="muted">Zmiana premiery trafia na oś zmian i do audytu.</span><button type="button" class="btn btn-primary" data-action="toast" data-msg="Zapisano termin premiery (prototyp)">Zapisz</button>` })}
          ${card({ hid: "h-thumb", title: "Miniatura", meta: v.thumb === "OK" ? state("ok", "Kopia publiczna aktualna") : state("warn", "Kopia publiczna nieaktualna"), body: `<div class="preview-row"><div class="preview"><div class="frame"><span>${esc(v.title)}</span></div>Kafel w liście filmów</div><div class="preview"><div class="frame"><span>${esc(v.title)}</span></div>Hero na stronie głównej</div><div class="preview phone"><div class="frame"><span>${esc(v.title)}</span></div>Telefon</div></div>`, foot: `<span class="muted">JPG/PNG/WebP do 5 MB · sprawdzane magiczne bajty</span><button type="button" class="btn" data-action="toast" data-msg="Wgrywanie miniatury: kadrowanie i podgląd przed zapisem (prototyp)">${icon("upload")}Wgraj nową</button>` })}
        </div>
        <div class="span-4 stack">
          ${card({ hid: "h-pre", title: "Lista kontrolna publikacji", meta: ready ? badge("ok", "Gotowe") : badge("crit", "Blokuje"), body: `<ul class="checklist">${checklist.map((c) => `<li class="${c[0]}">${icon(c[0])}<span>${esc(c[1])}<span class="sr-only"> (${PP.ui.STATE_WORD[c[0]]})</span></span></li>`).join("")}</ul>`, foot: `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Test po publikacji: token → master.m3u8 → pierwszy segment każdej rendycji → miniatura → podgląd OG: wszystko OK">${icon("refresh")}Uruchom test teraz</button>` })}
          ${card({ hid: "h-subs", title: "Napisy", body: `<ul class="list"><li><span class="li-icon">${icon("subtitles")}</span><div class="li-main"><span class="li-title">Polski</span><span class="li-sub">${v.subsPl ? "312 napisów · WebVTT poprawny · 3 paź" : "brak pliku"}</span></div>${v.subsPl ? state("ok", "OK") : `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Wgrywanie VTT z walidacją i podglądem w odtwarzaczu (prototyp)">Wgraj VTT</button>`}</li><li><span class="li-icon">${icon("subtitles")}</span><div class="li-main"><span class="li-title">Angielski</span><span class="li-sub">${v.subsEn ? "298 napisów · WebVTT poprawny" : "brak pliku · 9% widzów ma język EN"}</span></div>${v.subsEn ? state("ok", "OK") : `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Wgrywanie VTT z walidacją i podglądem w odtwarzaczu (prototyp)">Wgraj VTT</button>`}</li></ul>` })}
          ${card({ hid: "h-exp", title: "Ekspozycja", body: `<div class="stack" style="gap:8px"><label class="switch"><input type="checkbox" ${v.sidebar ? "checked" : ""} data-action="toggle-note"> Na liście filmów (sidebar)</label><label class="switch"><input type="checkbox" ${v.hero ? "checked" : ""} data-action="toggle-note"> Hero strony głównej</label><p class="hint muted" style="font-size:12px">Hero tylko dla opublikowanego, publicznego filmu z gotowym HLS.</p></div>` })}
          <section class="card" id="historia" aria-labelledby="h-hist"><div class="card-head"><h2 id="h-hist">Historia zmian</h2></div><ul class="list">${hist}</ul></section>
        </div>
      </div>`;
    return { title: v.title + " · Treści", html };
  }

  // ======================= PREMIERA NA ŻYWO =======================
  const LIVE = (PP.liveSim = { t: 760, viewers: [], starts: [], errors: [], workerPerMin: 2140, tips: [], comments: [], paused: false });
  (function seed() {
    for (let m = 0; m <= 12; m++) { LIVE.viewers.push(Math.round(40 + 150 * (1 - Math.exp(-m / 3)) + (PP.rand() - 0.5) * 10)); LIVE.starts.push(Math.round(30 * Math.exp(-m / 6) + 6 + PP.rand() * 4)); LIVE.errors.push(m === 4 ? 2 : PP.rand() > 0.8 ? 1 : 0); }
    LIVE.tips = [["Ania_S", "20,00 zł", "BLIK", 41], ["kamil.m", "10,00 zł", "Apple Pay", 118], ["Lena", "50,00 zł", "Karta", 260], ["Bartek87", "5,00 zł", "BLIK", 402]];
    LIVE.comments = [["zuzia", "Jest! Dźwięk dużo lepszy niż ostatnio", 22], ["nocny_widz", "Pozdrawiam z Berlina!", 77], ["Wojtek_K", "Na iPhonie startuje w sekundę", 140], ["majka", "Kiedy następny?", 301]];
  })();
  SC.premiera = function () {
    const last = LIVE.viewers[LIVE.viewers.length - 1];
    const labels = LIVE.viewers.map((_, i) => "T+" + i + " min");
    const chart = C.figure({ id: "live-chart", title: "Widzowie teraz (co minutę)", summary: `Widzowie od startu premiery; teraz ${last}.`, labels, series: [{ name: "Widzowie", values: LIVE.viewers.slice(), role: "current", slot: 1 }], height: 180, xName: "Minuta", endLabel: true });
    const forecastEnd = "21:40";
    const html = `${head("Premiera na żywo", `<span class="live-pill"><span class="pulse" aria-hidden="true"></span>Na żywo</span> <strong>„Kulisy premiery”</strong> · <span class="countdown" data-live="clock">T+${fmt.dur(LIVE.t)}</span> · symulacja w prototypie`, `<button type="button" class="btn" data-action="live-pause" aria-pressed="false">${icon("clock")}<span>Wstrzymaj odświeżanie</span></button><a class="btn" href="${href("dzisiaj")}">Zakończ tryb</a>`)}
      <div class="banner crit" style="margin-bottom:16px" role="alert">${icon("crit")}<div class="banner-body"><span class="banner-title">Limit Workera HLS skończy się dziś o ok. ${forecastEnd} przy obecnym tempie</span><span class="text-2">${fmt.int(PP.worker.used + 41000)} z 100 000 żądań · ${fmt.int(LIVE.workerPerMin)} żądań/min. Po wyczerpaniu wideo przestaje działać (błąd 1027).</span></div><button type="button" class="btn btn-sm btn-danger" data-action="toast" data-msg="Workers Paid: decyzja kosztowa (5 $/mies.) należy do właściciela. Otwiera stronę planu w Cloudflare.">Przejdź na Workers Paid</button></div>
      <div class="live-grid" aria-live="off">
        <div class="card live-num"><span class="tile-label">Widzowie teraz</span><span class="hero-num" data-live="viewers">${last}</span><span class="delta-ctx">szczyt ${Math.max.apply(null, LIVE.viewers)}</span></div>
        <div class="card live-num"><span class="tile-label">Czas startu p95</span><span class="hero-num" data-live="startup">1,8 s</span>${state("ok", "poniżej celu 2 s")}</div>
        <div class="card live-num"><span class="tile-label">Błędy odtwarzania / min</span><span class="hero-num" data-live="errors">${LIVE.errors[LIVE.errors.length - 1]}</span>${state("ok", "0,4% sesji")}</div>
        <div class="card live-num"><span class="tile-label">Serwer: CPU / RAM</span><span class="hero-num" data-live="cpu">38%</span><span class="delta-ctx">RAM 2,6 z 3,8 GB · swap 36%</span></div>
      </div>
      <div class="grid" style="margin-top:16px">
        <div class="span-8 stack">${card({ hid: "h-lc", title: "Widzowie od startu", meta: `<span class="age">${icon("clock")}co 5 s</span>`, body: chart })}
          ${card({ hid: "h-lcm", title: "Komentarze na żywo", body: `<ul class="list" data-live="comments">${LIVE.comments.map((c) => `<li><div class="li-main"><span class="li-title">${esc(c[1])}</span><span class="li-sub">${esc(c[0])} · ${c[2]} s temu</span></div><div class="row"><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Komentarz przypięty">Przypnij</button><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Komentarz ukryty · cofnij w Społeczności">Ukryj</button></div></li>`).join("")}</ul>` })}</div>
        <div class="span-4 stack">
          ${card({ hid: "h-lq", title: "Szybkie akcje", body: `<div class="quick-actions"><button type="button" class="btn" data-action="toast" data-msg="Komentarze wyłączone na 10 min (prototyp)">Wyłącz komentarze na 10 min</button><button type="button" class="btn" data-action="toast" data-msg="Baner na stronie ustawiony (prototyp)">Baner na stronie</button><button type="button" class="btn" data-action="toast" data-msg="Rozsyłki wstrzymane (prototyp)">Wstrzymaj rozsyłki</button><button type="button" class="btn" data-action="toast" data-msg="Zmiana hero: wybór filmu (prototyp)">Zmień hero</button></div>` })}
          ${card({ hid: "h-lt", title: "Napiwki od startu", meta: `<strong class="tabular">85,00 zł</strong>`, body: `<ul class="list">${LIVE.tips.map((t) => `<li><span class="li-icon ok">${icon("coins")}</span><div class="li-main"><span class="li-title">${esc(t[1])} · ${esc(t[0])}</span><span class="li-sub">${esc(t[2])} · ${t[3]} s temu</span></div></li>`).join("")}</ul>` })}
          ${card({ hid: "h-lw", title: "Worker HLS", body: `<div class="limit"><div class="limit-head"><span class="limit-name">Doba UTC</span><span class="limit-val" data-live="worker">${fmt.int(PP.worker.used + 41000)} / 100 000</span></div>${C.meter({ value: PP.worker.used + 41000, max: 100000, label: "Zużycie limitu Workera", warnAt: 70, critAt: 90, forecast: 100000 })}<span class="limit-note">${state("crit", "Prognoza: limit o " + forecastEnd)}</span></div>` })}
        </div>
      </div>`;
    return { title: "Premiera na żywo", html, live: true };
  };
})();
