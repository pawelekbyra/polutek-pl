/* Ekrany: Społeczność (moderacja, komentarze, użytkownicy, profil 360°), Przychody, Komunikacja,
 * System, Bezpieczeństwo, Ustawienia. */
(function () {
  "use strict";
  const PP = window.PP, C = window.Charts;
  const { S, esc, fmt, icon, badge, state, age, deltaHtml, tile, card, href, withParam, table, paginate, pager, selectParam, searchParam, norm, win, cmpLabel, head, tabsNav, kpiTile } = PP.ui;
  const SC = PP.screens;
  const U = (id) => PP.userById[id];
  const userLink = (u) => `<a href="${href("spolecznosc/u/" + u.id)}">${esc(u.nick)}</a>`;
  const initials = (n) => n.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, "").slice(0, 2).toUpperCase() || "?";
  const vTitle = (slug) => (PP.videoBySlug[slug] ? PP.videoBySlug[slug].title : "—");
  PP.modDone = PP.modDone || {};

  // ======================= SPOŁECZNOŚĆ =======================
  const modQueue = () => PP.comments.filter((c) => !PP.modDone[c.id] && ((c.reports > 0 && c.status === "VISIBLE") || c.status === "HELD"));
  PP.modQueue = modQueue;
  const CSTATUS = { VISIBLE: ["", "Widoczny"], HIDDEN: ["warn", "Ukryty"], HELD: ["info", "Wstrzymany"] };

  SC.spolecznosc = function (r) {
    if (r.parts[1] === "u") return user360(r.parts[2]);
    const tab = r.q.tab || "moderacja";
    const q = modQueue();
    const tabs = tabsNav("Sekcje społeczności", [["moderacja", "Moderacja", href("spolecznosc", { tab: "moderacja" }), q.length || "", "warn"], ["komentarze", "Komentarze", href("spolecznosc", { tab: "komentarze" })], ["uzytkownicy", "Użytkownicy", href("spolecznosc", { tab: "uzytkownicy" })]], tab);
    let body = "";
    if (tab === "moderacja") {
      const sel = Math.min(S.modIdx || 0, Math.max(0, q.length - 1));
      body = q.length ? `<p class="text-2 kbd-tip" style="margin-bottom:12px">Klawisze: <kbd>j</kbd>/<kbd>k</kbd> następny/poprzedni, <kbd>h</kbd> ukryj, <kbd>z</kbd> zostaw (zamknij zgłoszenie), <kbd>w</kbd> wycisz autora.</p>
        <section class="card card-flush" aria-label="Kolejka moderacji">${q.map((c, i) => {
          const u = U(c.user);
          return `<article class="mod-item${i === sel ? " is-active" : ""}" data-mod="${c.id}" tabindex="-1" aria-label="Komentarz ${i + 1} z ${q.length}">
            <div><blockquote>${esc(c.text)}</blockquote>
              <div class="mod-meta">${c.status === "HELD" ? badge("info", "Wstrzymany do akceptacji", "clock") : badge("warn", c.reports + " " + (c.reports === 1 ? "zgłoszenie" : "zgłoszenia") + " · " + c.reportReason, "flag")}<span>${userLink(u)}</span><span>pod <a href="${href("tresci/" + c.video)}">„${esc(vTitle(c.video))}”</a></span><span>${esc(fmt.dt(c.createdAt))}</span>${u.comments > 10 ? "" : `<span>${u.comments} komentarzy autora</span>`}</div></div>
            <div class="mod-actions"><button type="button" class="btn btn-sm" data-action="mod-hide" data-id="${c.id}">${icon("eye-off")}Ukryj <kbd>h</kbd></button><button type="button" class="btn btn-sm" data-action="mod-keep" data-id="${c.id}">Zostaw <kbd>z</kbd></button><button type="button" class="btn btn-sm btn-ghost" data-action="mod-mute" data-id="${c.id}">Wycisz autora <kbd>w</kbd></button></div>
          </article>`;
        }).join("")}</section>`
        : `<section class="card"><div class="empty">${icon("ok")}<strong>Kolejka pusta</strong><span>Wszystkie zgłoszenia przejrzane. Nowe pojawią się tutaj i w licznikach.</span></div></section>`;
    } else if (tab === "komentarze") {
      let list = PP.comments.slice();
      if (r.q.q) list = list.filter((c) => norm(c.text + " " + U(c.user).nick).includes(norm(r.q.q)));
      if (r.q.status === "Q") list = list.filter((c) => c.question && !c.creatorReplied);
      else if (r.q.status) list = list.filter((c) => c.status === r.q.status);
      if (r.q.vid) list = list.filter((c) => c.video === r.q.vid);
      const pg = paginate(list, r.q.page, 12);
      body = `<div class="filters" role="search" aria-label="Filtry komentarzy">${searchParam("q", "Szukaj w treści lub autorze", r.q.q)}${selectParam("status", "Status", [["", "Każdy status"], ["VISIBLE", "Widoczne"], ["HIDDEN", "Ukryte"], ["HELD", "Wstrzymane"], ["Q", "Pytania bez odpowiedzi"]], r.q.status)}${selectParam("vid", "Film", [["", "Wszystkie filmy"], ["czesc", "Cześć"], ["jj", "JJ"], ["dla-patronow", "Dla patronów"], ["wywiad-z-montazysta", "Wywiad z montażystą"]], r.q.vid)}</div>
        <section class="card card-flush" aria-label="Komentarze">${table([{ label: "Komentarz", cls: "wrap" }, { label: "Autor" }, { label: "Film" }, { label: "Status" }, { label: "Polubienia", num: true, cls: "hide-sm" }, { label: "Data" }, { label: "" }], pg.items.map((c) => [
          `${esc(c.text)}${c.heart ? ` <span class="muted" title="Serduszko twórcy">${icon("heart")}<span class="sr-only">serduszko twórcy</span></span>` : ""}`, userLink(U(c.user)), esc(vTitle(c.video)), badge(CSTATUS[c.status][0], CSTATUS[c.status][1], false), String(c.likes), esc(fmt.dt(c.createdAt)),
          `<div class="row" style="justify-content:flex-end">${c.status === "HIDDEN" ? `<button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Komentarz przywrócony">Przywróć</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Komentarz ukryty (można cofnąć)">Ukryj</button>`}<button type="button" class="btn btn-sm btn-ghost" data-action="reply" data-id="${c.id}" aria-label="Odpowiedz jako twórca">${icon("reply")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="delete-comment" data-id="${c.id}" aria-label="Usuń komentarz">${icon("trash")}</button></div>`]), { caption: "Komentarze" })}${pager(pg, "komentarzy")}</section>`;
    } else {
      const seg = r.q.seg || "";
      let list = PP.users.slice();
      const d7 = PP.now - 7 * PP.DAY, d30 = PP.now - 30 * PP.DAY;
      if (seg === "nowi") list = list.filter((u) => u.createdAt > d7);
      if (seg === "aktywni") list = list.filter((u) => u.lastSeen > d30 && u.status !== "deleted");
      if (seg === "wspierajacy") list = list.filter((u) => u.tipsCount > 0);
      if (seg === "niezweryfikowani") list = list.filter((u) => !u.verified);
      if (seg === "2fa") list = list.filter((u) => u.twoFA);
      if (r.q.q) list = list.filter((u) => norm(u.nick + " " + u.email).includes(norm(r.q.q)));
      const sort = r.q.sort || "created-desc";
      const [sk, sd] = sort.split("-");
      const val = (u) => (sk === "nick" ? norm(u.nick) : sk === "tips" ? u.tipsTotal : +u.createdAt);
      list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sd === "asc" ? 1 : -1));
      const pg = paginate(list, r.q.page, 12);
      body = `<div class="filters" role="search" aria-label="Filtry użytkowników">${searchParam("q", "Pseudonim lub e-mail", r.q.q)}${selectParam("seg", "Segment", [["", "Wszyscy (" + PP.users.length + ")"], ["nowi", "Nowi (7 dni)"], ["aktywni", "Aktywni (30 dni)"], ["wspierajacy", "Wspierający"], ["niezweryfikowani", "Niezweryfikowani"], ["2fa", "Z 2FA"]], seg)}</div>
        <section class="card card-flush" aria-label="Użytkownicy">${table([{ label: "Osoba", sortKey: "nick" }, { label: "Dołączył(a)", sortKey: "created" }, { label: "Ostatnio" }, { label: "Źródło", cls: "hide-sm" }, { label: "Komentarze", num: true, cls: "hide-sm" }, { label: "Napiwki", num: true, sortKey: "tips" }, { label: "Konto" }], pg.items.map((u) => [
          `<div class="cell-title"><span class="avatar" aria-hidden="true">${esc(initials(u.nick))}</span><div><a href="${href("spolecznosc/u/" + u.id)}">${esc(u.nick)}</a><div class="muted">${esc(u.email)}</div></div></div>`,
          esc(fmt.dateY(u.createdAt)), esc(fmt.rel(u.lastSeen)), esc(u.source), String(u.comments), u.tipsTotal ? fmt.money(u.tipsTotal) : '<span class="muted">—</span>',
          `${u.status === "deleted" ? badge("", "Usunięte", false) : u.status === "muted" ? badge("warn", "Wyciszony", "eye-off") : u.verified ? badge("ok", "Zweryfikowany") : badge("warn", "Niezweryfikowany")}${u.twoFA ? " " + badge("outline", "2FA", "lock") : ""}${u.role === "ADMIN" ? " " + badge("info", "Admin", "shield") : ""}`
        ]), { caption: "Użytkownicy", sort })}${pager(pg, "osób")}</section>`;
    }
    return { title: "Społeczność", html: head("Społeczność", `${PP.users.length} kont · ${PP.comments.length} komentarzy`, `<a class="btn" href="${href("spolecznosc", { tab: "komentarze", status: "Q" })}">${icon("message")}Pytania bez odpowiedzi</a>`) + tabs + body };
  };

  function user360(id) {
    const u = U(id) || PP.users[0];
    const pays = PP.payments.filter((p) => p.user === u.id);
    const coms = PP.comments.filter((c) => c.user === u.id).slice(0, 5);
    const audit = PP.audit.slice(3, 7);
    const html = `${head(u.nick, "", `<button type="button" class="btn" data-action="toast" data-msg="Podgląd jako ${esc(u.nick)}: tylko odczyt, z banerem i wpisem ADMIN_VIEW_AS w audycie">${icon("eye")}Podgląd jako ta osoba</button><button type="button" class="btn" data-action="role" data-id="${u.id}">${icon("shield")}Rola…</button><button type="button" class="btn" data-action="toast" data-msg="Komentowanie wyciszone (można cofnąć)">Wycisz komentowanie</button><button type="button" class="btn" data-action="toast" data-msg="Wylogowano ze wszystkich urządzeń (${u.sessions})">${icon("logout")}Wyloguj wszędzie</button>`, `<a href="${href("spolecznosc", { tab: "uzytkownicy" })}">Użytkownicy</a>${icon("right")}<span>${esc(u.nick)}</span>`)}
      <div class="grid">
        <div class="span-12"><section class="card"><div class="profile-head"><span class="avatar avatar-lg" aria-hidden="true">${esc(initials(u.nick))}</span><div style="flex:1;min-width:200px"><div style="font-weight:600;font-size:16px">${esc(u.nick)}</div><div class="text-2">${esc(u.email)}</div></div>
          <div class="row">${u.verified ? badge("ok", "E-mail zweryfikowany") : badge("warn", "E-mail niezweryfikowany")}${u.google ? badge("outline", "Google połączone", false) : ""}${u.twoFA ? badge("ok", "2FA włączone", "lock") : badge("", "2FA wyłączone", false)}${u.tipsCount ? badge("info", "Wspierający", "heart") : ""}${u.status === "muted" ? badge("warn", "Wyciszony", "eye-off") : ""}${u.role === "ADMIN" ? badge("info", "Rola: administrator", "shield") : ""}</div></div></section></div>
        <div class="span-4 stack">
          ${card({ hid: "h-acc", title: "Konto", body: `<dl class="kv"><dt>ID</dt><dd class="mono">${esc(u.id)}_9f3k2</dd><dt>Dołączył(a)</dt><dd>${esc(fmt.dateY(u.createdAt))}</dd><dt>Źródło rejestracji</dt><dd>${esc(u.source)} · film „Cześć”</dd><dt>Język</dt><dd>${u.language === "en" ? "angielski" : "polski"}</dd><dt>Kraj (ostatnio)</dt><dd>${esc(u.country)}</dd><dt>Ostatnia aktywność</dt><dd>${esc(fmt.rel(u.lastSeen))}</dd><dt>Czas oglądania</dt><dd class="tabular">${fmt.one(u.watchH)} h</dd></dl>` })}
          ${card({ hid: "h-ses", title: "Sesje (" + u.sessions + ")", body: `<ul class="list"><li><div class="li-main"><span class="li-title">iPhone · Safari</span><span class="li-sub">PL · aktywna ${esc(fmt.rel(u.lastSeen))}</span></div><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Sesja zakończona">Wyloguj</button></li>${u.sessions > 1 ? `<li><div class="li-main"><span class="li-title">Windows · Chrome</span><span class="li-sub">PL · 3 d temu</span></div><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Sesja zakończona">Wyloguj</button></li>` : ""}</ul>` })}
          ${card({ hid: "h-rodo", title: "Dane i RODO", body: `<div class="stack" style="gap:8px"><button type="button" class="btn" data-action="toast" data-msg="Eksport danych (art. 15/20 RODO) przygotowany: JSON + CSV, zapis w audycie">${icon("download")}Eksport danych osoby</button><button type="button" class="btn" data-action="toast" data-msg="Link resetu hasła wysłany na adres osoby">Wyślij link resetu hasła</button><button type="button" class="btn btn-danger" data-action="delete-user" data-id="${u.id}">${icon("trash")}Usuń i zanonimizuj konto…</button></div>` })}
        </div>
        <div class="span-8 stack">
          ${card({ hid: "h-up", title: "Napiwki (" + pays.length + ")", flush: true, body: table([{ label: "Data" }, { label: "Kwota", num: true }, { label: "Metoda" }, { label: "Status" }, { label: "Film" }], pays.map((p) => [esc(fmt.dt(p.createdAt)), fmt.money(p.amount, p.currency), esc(p.method), payBadge(p), esc(vTitle(p.video))]), { caption: "Napiwki osoby", empty: "Ta osoba nie wysłała jeszcze napiwku." }) })}
          ${card({ hid: "h-uc", title: "Komentarze (" + u.comments + ")", body: coms.length ? `<ul class="list">${coms.map((c) => `<li><div class="li-main"><span class="li-title">${esc(c.text)}</span><span class="li-sub">„${esc(vTitle(c.video))}” · ${esc(fmt.dt(c.createdAt))} · ${c.likes} polubień</span></div>${badge(CSTATUS[c.status][0], CSTATUS[c.status][1], false)}</li>`).join("")}</ul>` : `<div class="empty">${icon("message")}<span>Brak komentarzy.</span></div>` })}
          <div class="grid"><div class="span-6">${card({ hid: "h-uw", title: "Oglądanie", body: C.barList([["Cześć", 92], ["JJ", 64], ["Dla patronów", 18]], { fmt: (v) => v + "%", noPct: true }) + '<p class="limit-note" style="margin-top:8px">procent obejrzenia filmu</p>' })}</div>
          <div class="span-6">${card({ hid: "h-ue", title: "E-maile", body: `<ul class="list"><li><div class="li-main"><span class="li-title">Potwierdzenie napiwku</span><span class="li-sub">dziś 13:52</span></div>${state("ok", "Doręczony")}</li><li><div class="li-main"><span class="li-title">Rozsyłka „Nowy odcinek: JJ”</span><span class="li-sub">26 wrz · otwarty</span></div>${state("ok", "Doręczony")}</li><li><div class="li-main"><span class="li-title">Weryfikacja e-mail</span><span class="li-sub">13 wrz</span></div>${state("ok", "Doręczony")}</li></ul>` })}</div></div>
          ${card({ hid: "h-ua", title: "Audyt dotyczący osoby", body: `<ul class="list">${audit.map((a) => `<li><div class="li-main"><span class="li-title">${esc(a.label)}</span><span class="li-sub">${esc(fmt.dt(a.at))} · ${esc(a.actor)}</span></div></li>`).join("")}</ul>` })}
        </div>
      </div>`;
    return { title: u.nick + " · Społeczność", html };
  }

  // ======================= PRZYCHODY =======================
  const PSTAT = { SUCCEEDED: ["ok", "Opłacona"], REFUNDED: ["", "Zwrócona"], PARTIALLY_REFUNDED: ["warn", "Częściowo zwrócona"], FAILED: ["crit", "Nieudana"], PENDING: ["warn", "Oczekuje"], DISPUTED: ["crit", "Spór"] };
  function payBadge(p) { const s = PSTAT[p.status]; return badge(s[0], s[1], s[0] ? undefined : false); }
  PP.ui.payBadge = payBadge;

  SC.przychody = function (r) {
    const tab = r.q.tab || "przeglad";
    const tabs = tabsNav("Sekcje przychodów", [["przeglad", "Przegląd", href("przychody")], ["wplaty", "Wpłaty", href("przychody", { tab: "wplaty" })], ["wspierajacy", "Wspierający", href("przychody", { tab: "wspierajacy" })], ["spory", "Zwroty i spory", href("przychody", { tab: "spory" }), 1, "crit"], ["stripe", "Stripe i webhooki", href("przychody", { tab: "stripe" })]], tab);
    let body = "";
    if (r.q.status && tab === "przeglad") return SC.przychody({ parts: r.parts, q: Object.assign({}, r.q, { tab: "wplaty" }) });
    if (tab === "przeglad") {
      const w = win("tipsPln");
      const chart = C.figure({ type: "columns", title: "Napiwki (zł) w okresie", summary: `Razem ${fmt.zl(w.total)} brutto w okresie (${PP.RANGES[S.range].label}).`, labels: w.labels, series: [{ name: "Napiwki brutto", values: w.cur, role: "current", slot: 1 }], height: 220, fmt: (v) => fmt.zl(v), xName: "Okres" });
      body = `<div class="grid">
        <div class="span-12"><div class="tiles" role="group" aria-label="Przychody">
          ${kpiTile({ key: "tipsPln", label: "Napiwki brutto", unit: "zł" })}
          ${tile({ label: "Netto po opłatach Stripe", value: fmt.int(w.total * 0.955), unit: "zł", hint: "Brutto minus opłaty Stripe (balance_transaction.fee) i zwroty.", delta: deltaHtml(w.total, w.prevTotal, true, cmpLabel()) })}
          ${kpiTile({ key: "tipsCount", label: "Liczba napiwków" })}
          ${tile({ label: "Mediana napiwku", value: "20", unit: "zł", delta: deltaHtml(20, 20, true, cmpLabel()) })}
          ${tile({ label: "Zwroty", value: "2", unit: "· 70 zł", delta: `<span class="delta-ctx">0,9% wpłat</span>` })}
        </div></div>
        <div class="span-8">${card({ hid: "h-rev", title: "Napiwki w czasie", meta: `<a href="${href("przychody", { tab: "wplaty" })}">Lista wpłat ${icon("right")}</a>`, body: chart })}</div>
        <div class="span-4 stack">${card({ hid: "h-meth", title: "Metody płatności", body: C.barList([["BLIK", 38], ["Karta", 19], ["Przelewy24", 8], ["Apple Pay", 6], ["Google Pay", 3]]) })}
          ${card({ hid: "h-cur", title: "Waluty", body: C.barList([["PLN", 61], ["EUR", 6], ["USD", 4]]) })}</div>
        <div class="span-6">${stripeCard()}</div>
        <div class="span-6">${card({ hid: "h-tg", title: "Bramka napiwkowa: gdzie rezygnują", body: C.barList(PP.tipFunnel, { ordinal: true, pctText: (it, i) => (i === 0 ? "100%" : fmt.pct((it[1] / PP.tipFunnel[i - 1][1]) * 100, 0)) }), foot: `<a href="${href("analityka", { tab: "lejek" })}">Pełny lejek</a>` })}</div>
      </div>`;
    } else if (tab === "wplaty") {
      let list = PP.payments.slice();
      if (r.q.q) list = list.filter((p) => norm(p.id + " " + U(p.user).nick + " " + p.amount / 100).includes(norm(r.q.q)));
      if (r.q.status) list = list.filter((p) => p.status === r.q.status);
      else list = list.filter((p) => p.status !== "PENDING" || (PP.now - p.createdAt) > 15 * 60000);
      if (r.q.method) list = list.filter((p) => p.method === r.q.method);
      const sort = r.q.sort || "date-desc";
      const [sk, sd] = sort.split("-");
      list.sort((a, b) => ((sk === "amount" ? a.amount - b.amount : a.createdAt - b.createdAt) * (sd === "asc" ? 1 : -1)));
      const pg = paginate(list, r.q.page, 12);
      body = `<div class="filters" role="search" aria-label="Filtry wpłat">${searchParam("q", "Osoba, kwota lub pi_…", r.q.q)}${selectParam("status", "Status", [["", "Wszystkie statusy"], ["SUCCEEDED", "Opłacone"], ["PENDING", "Oczekujące"], ["FAILED", "Nieudane"], ["REFUNDED", "Zwrócone"], ["PARTIALLY_REFUNDED", "Częściowo zwrócone"], ["DISPUTED", "Spór"]], r.q.status)}${selectParam("method", "Metoda", [["", "Każda metoda"], ["BLIK", "BLIK"], ["Karta", "Karta"], ["Przelewy24", "Przelewy24"], ["Apple Pay", "Apple Pay"], ["Google Pay", "Google Pay"]], r.q.method)}<span class="topbar-spacer"></span><button type="button" class="btn" data-action="export-csv">${icon("download")}Eksport CSV</button></div>
        <section class="card card-flush" aria-label="Wpłaty">${table([{ label: "Data", sortKey: "date" }, { label: "Osoba" }, { label: "Kwota", num: true, sortKey: "amount" }, { label: "Metoda" }, { label: "Status" }, { label: "Film (atrybucja)", cls: "hide-md hide-sm" }, { label: "ID Stripe", cls: "hide-sm" }, { label: "" }], pg.items.map((p) => [
          esc(fmt.dt(p.createdAt)), userLink(U(p.user)), `<strong>${fmt.money(p.amount, p.currency)}</strong>${p.refunded ? `<div class="muted">zwrot ${fmt.money(p.refunded, p.currency)}</div>` : ""}`, esc(p.method), payBadge(p), esc(vTitle(p.video)), `<span class="mono" title="${esc(p.id)}">${esc(p.id.slice(0, 12))}…</span>`,
          p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED" ? `<button type="button" class="btn btn-sm" data-action="refund" data-id="${p.id}">Zwrot…</button>` : ""
        ]), { caption: "Wpłaty", sort })}${pager(pg, "wpłat")}</section>
        <p class="foot-note">${icon("info")}Domyślnie bez porzuconych intencji PENDING młodszych niż 15 min. Zwrot wymaga ponownego uwierzytelnienia (passkey lub TOTP) i ma klucz idempotencji.</p>`;
    } else if (tab === "wspierajacy") {
      const list = PP.users.filter((u) => u.tipsCount > 0).sort((a, b) => b.tipsTotal - a.tipsTotal);
      const pg = paginate(list, r.q.page, 12);
      body = `<section class="card card-flush" aria-label="Wspierający">${table([{ label: "Osoba" }, { label: "Łącznie", num: true }, { label: "Napiwków", num: true }, { label: "Pierwszy" }, { label: "Ostatni" }, { label: "Komentarze", num: true }], pg.items.map((u) => {
        const ps = PP.payments.filter((p) => p.user === u.id && (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED"));
        return [userLink(u), `<strong>${fmt.money(u.tipsTotal)}</strong>`, String(u.tipsCount), esc(fmt.dateY(ps[ps.length - 1].createdAt)), esc(fmt.rel(ps[0].createdAt)), String(u.comments)];
      }), { caption: "Wspierający" })}${pager(pg, "osób")}</section>`;
    } else if (tab === "spory") {
      const d = PP.dispute, p = d.payment;
      body = `<div class="grid"><div class="span-7">${card({ hid: "h-disp", title: "Spór: " + fmt.money(d.amount), meta: badge("crit", "Wymaga odpowiedzi"), body: `<dl class="kv"><dt>Termin na dowody</dt><dd><strong>śr. 8 paź, 23:59</strong> · za ${fmt.daysLeft(d.dueBy)} dni</dd><dt>Powód (bank)</dt><dd>${esc(d.reason)}</dd><dt>Płatność</dt><dd><span class="mono">${esc(p.id)}</span> · ${esc(p.method)} · ${esc(fmt.dateY(p.createdAt))}</dd><dt>Osoba</dt><dd>${userLink(U(p.user))} · konto od ${esc(fmt.dateY(U(p.user).createdAt))}, ${U(p.user).comments} komentarzy</dd><dt>Dowody gotowe</dt><dd>logi sesji, IP kraj PL, akceptacja regulaminu, potwierdzenie e-mail</dd></dl>`, foot: `<span class="muted">Dowody składa się w Stripe; panel zbiera je w jedną paczkę.</span><div class="row"><button type="button" class="btn" data-action="toast" data-msg="Paczka dowodów przygotowana (PDF + JSON)">${icon("download")}Paczka dowodów</button><button type="button" class="btn btn-primary" data-action="toast" data-msg="Otwiera spór w panelu Stripe (nowa karta)">Otwórz w Stripe ${icon("external")}</button></div>` })}</div>
        <div class="span-5">${card({ hid: "h-ref", title: "Ostatnie zwroty", body: `<ul class="list">${PP.payments.filter((x) => x.refunded).slice(0, 4).map((x) => `<li><div class="li-main"><span class="li-title">${fmt.money(x.refunded, x.currency)} · ${esc(U(x.user).nick)}</span><span class="li-sub">${esc(fmt.dateY(x.createdAt))} · powód: prośba wspierającego · Paweł (admin)</span></div>${payBadge(x)}</li>`).join("")}</ul>` })}</div></div>`;
    } else {
      body = `<div class="grid"><div class="span-6">${stripeCard()}</div><div class="span-6">${card({ hid: "h-ev", title: "Ostatnie zdarzenia Stripe", flush: true, body: table([{ label: "Czas" }, { label: "Typ" }, { label: "Opóźnienie", num: true }, { label: "Stan" }], [["13:52", "payment_intent.succeeded", "1,4 s"], ["13:51", "charge.succeeded", "1,1 s"], ["11:07", "payment_intent.payment_failed", "0,9 s"], ["wczoraj 21:40", "payout.paid", "2,0 s"], ["wczoraj 18:12", "charge.dispute.created", "1,7 s"]].map((e) => [e[0], `<span class="mono">${e[1]}</span>`, e[2], state("ok", "Przetworzone")]), { caption: "Zdarzenia Stripe" }) })}</div></div>`;
    }
    return { title: "Przychody", html: head("Przychody", "Dobrowolne napiwki · kwoty w PLN po kursie dnia") + tabs + body };
  };
  function stripeCard() {
    const s = PP.stripeHealth;
    return card({ hid: "h-stripe", title: "Stripe: webhooki i saldo", meta: age(s.fetchedAt, 60, "Stripe API (migawka kolektora)"), body: `<div class="checks">
      <div class="check ok">${icon("ok")}<div><div>Webhook dochodzi</div><div class="check-sub">ostatnie: ${esc(s.lastEventType)} · ${fmt.time(s.lastEventAt)} · opóźnienie ${fmt.one(s.lagS)} s</div></div><span class="sr-only">OK</span></div>
      <div class="check ok">${icon("ok")}<div><div>0 nieudanych, 0 w przetwarzaniu</div><div class="check-sub">pending_webhooks = 0</div></div><span class="sr-only">OK</span></div>
      <div class="check warn">${icon("warn")}<div><div>1 płatność PENDING &gt; 15 min</div><div class="check-sub">rekonsylacja ${fmt.time(s.reconciliationLast)}, następna 14:45</div></div><span class="sr-only">Uwaga</span></div>
      <div class="check ok">${icon("ok")}<div><div>Saldo: ${fmt.money(s.balance.available)} dostępne, ${fmt.money(s.balance.pending)} w drodze</div><div class="check-sub">następna wypłata: pon. 6 paź</div></div><span class="sr-only">OK</span></div></div>` });
  }

  // ======================= KOMUNIKACJA =======================
  SC.komunikacja = function () {
    const R = PP.resend;
    const types = table([{ label: "Typ" }, { label: "Wysłane", num: true }, { label: "Doręczone", num: true }, { label: "Odbite", num: true }, { label: "Skargi", num: true }], PP.mailTypes.map((m) => [esc(m[0]), String(m[2]), String(m[3]), m[4] ? `<span class="state warn">${icon("warn")}${m[4]}</span>` : "0", String(m[5])]), { caption: "E-maile transakcyjne (30 dni)" });
    const BST = { SENT: ["ok", "Wysłana"], SCHEDULED: ["info", "Zaplanowana"], TEST: ["", "Test"] };
    const bc = table([{ label: "Rozsyłka", cls: "wrap" }, { label: "Status" }, { label: "Kiedy" }, { label: "Odbiorcy", num: true }, { label: "Otwarcia", num: true }, { label: "Kliknięcia", num: true }, { label: "Wypisy", num: true }], PP.broadcasts.map((b) => [esc(b.title), badge(BST[b.status][0], BST[b.status][1], b.status === "SCHEDULED" ? "clock" : BST[b.status][0] ? undefined : false), esc(fmt.dt(b.at)), String(b.recipients), b.opens === null ? "—" : b.opens + "%", b.clicks === null ? "—" : b.clicks + "%", b.unsub === null ? "—" : String(b.unsub)]), { caption: "Rozsyłki" });
    const html = `${head("Komunikacja", "E-maile, rozsyłki, szablony i skrzynka PP Support", `<button type="button" class="btn btn-primary" data-action="toast" data-msg="Kreator rozsyłki: segment → treść PL/EN → test do siebie → harmonogram (prototyp)">${icon("mail")}Nowa rozsyłka</button>`)}
      <div class="grid">
        <div class="span-12"><div class="tiles" role="group" aria-label="Dostarczalność (30 dni)">
          ${tile({ label: "Doręczone", value: "98,7", unit: "%", delta: `<span class="delta-ctx">137 z 139 · 30 dni</span>` })}
          ${tile({ label: "Odbicia", value: fmt.one(R.bounce), unit: "%", delta: `${state("ok", "próg Resend 4%")}` })}
          ${tile({ label: "Skargi na spam", value: "0,00", unit: "%", delta: `${state("ok", "próg 0,08%")}` })}
          ${tile({ label: "Otwarcia rozsyłek", value: "58", unit: "%", delta: deltaHtml(58, 63, true, "vs poprzednia rozsyłka") })}
        </div></div>
        <div class="span-4 stack">${card({ hid: "h-rl", title: "Limit wysyłki Resend (Free)", meta: age(R.fetchedAt, 15, "Resend + EmailEvent"), body: `<div class="limit"><div class="limit-head"><span class="limit-name">Dziś</span><span class="limit-val">${R.today} / ${R.dayLimit}</span></div>${C.meter({ value: R.today, max: R.dayLimit, label: "E-maile dziś", warnAt: 70, critAt: 90, forecast: 31 })}<span class="limit-note">zaplanowana rozsyłka jutro zużyje 31</span></div><div class="limit"><div class="limit-head"><span class="limit-name">Miesiąc</span><span class="limit-val">${R.month} / ${fmt.int(R.monthLimit)}</span></div>${C.meter({ value: R.month, max: R.monthLimit, label: "E-maile w miesiącu", warnAt: 70, critAt: 90 })}</div>` })}
          ${card({ hid: "h-pps", title: "PP Support", meta: age(PP.support.fetchedAt, 15, "API PP Support"), body: `<dl class="kv"><dt>Otwarte wątki</dt><dd class="tabular">${PP.support.open}</dd><dt>Bez odpowiedzi &gt; 24 h</dt><dd>${state("warn", "2")}</dd><dt>Czas 1. odpowiedzi</dt><dd class="tabular">${fmt.one(PP.support.firstReplyH)} h (mediana)</dd></dl><p class="limit-note" style="margin-top:8px">Migawka starsza niż 2 × interwał: kolektor nie dostał odpowiedzi z API od 13:05.</p>`, foot: `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Zlecono odświeżenie migawki PP Support (wynik pojawi się bez przeładowania)">${icon("refresh")}Odśwież teraz</button><a class="btn btn-sm btn-ghost" href="#/komunikacja" data-action="toast" data-msg="Otwiera support.pawelperfect.com (za Cloudflare Access)">Otwórz skrzynkę ${icon("external")}</a>` })}
          ${card({ hid: "h-dns", title: "DNS poczty", body: `<ul class="checklist">${PP.mailDns.map((d) => `<li class="${d[2] ? "ok" : "warn"}">${icon(d[2] ? "ok" : "warn")}<span>${esc(d[0])}: ${esc(d[1])}${d[2] ? "" : " (brak rekordu)"}</span></li>`).join("")}</ul>` })}</div>
        <div class="span-8 stack">
          ${card({ hid: "h-bc", title: "Rozsyłki", flush: true, body: bc })}
          ${card({ hid: "h-tx", title: "E-maile transakcyjne (30 dni)", flush: true, body: types })}
          ${card({ hid: "h-tpl", title: "Szablony", flush: true, body: table([{ label: "Szablon" }, { label: "Klucz" }, { label: "Względem domyślnego" }, { label: "Zmieniony" }, { label: "" }], PP.templates.map((t) => [esc(t[1]), `<span class="mono">${esc(t[0])}</span>`, t[2] === "zmieniony" ? badge("info", "zmieniony", false) : badge("", "domyślny", false), esc(fmt.dateY(t[3])), `<button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Podgląd PL/EN obok siebie z różnicą względem EMAIL_DEFAULTS (prototyp)">Podgląd</button>`]), { caption: "Szablony e-maili" }) })}
        </div>
      </div>`;
    return { title: "Komunikacja", html };
  };

  // ======================= SYSTEM =======================
  SC.system = function (r) {
    const tab = r.q.tab || "zdrowie";
    const tabs = tabsNav("Sekcje systemu", [["zdrowie", "Zdrowie i zmiany", href("system")], ["serwer", "Serwer i kontenery", href("system", { tab: "serwer" })], ["zadania", "Zadania i kopie", href("system", { tab: "zadania" }), 1, "warn"], ["domeny", "Domeny i koszty", href("system", { tab: "domeny" })], ["baza", "Baza danych", href("system", { tab: "baza" })]], tab);
    let body = "";
    if (tab === "zdrowie") {
      const rows = [
        ["ok", "Strona z zewnątrz (strażnik Worker)", "182 ms · 3 regiony", "6 d", PP.daysAgo(0, 14, 35), "Historia"],
        ["ok", "Aplikacja /api/health", "200 · 41 ms", "5 h (wdrożenie)", PP.daysAgo(0, 14, 35), "Logi"],
        ["ok", "Postgres", "11/60 połączeń · cache 99,6%", "3 d", PP.daysAgo(0, 14, 35), "Baza"],
        ["ok", "Redis + srh", "2 MB", "3 d", PP.daysAgo(0, 14, 35), ""],
        ["ok", "Encoder", "pracuje · heartbeat 20 s", "5 h", PP.daysAgo(0, 14, 36), "Kolejka"],
        ["ok", "Tunel Cloudflare", "2 połączenia · healthy", "3 d", PP.daysAgo(0, 14, 30), ""],
        ["ok", "Worker HLS", "41% limitu · 0 błędów", "—", PP.worker.fetchedAt, "Prognoza"],
        ["ok", "Webhook Stripe", "ostatnie 13:52 · 0 nieudanych", "—", PP.stripeHealth.fetchedAt, "Zdarzenia"],
        ["ok", "Resend", "23/100 dziś · odbicia 0,8%", "—", PP.resend.fetchedAt, ""],
        ["warn", "PP Support (migawka)", "brak odpowiedzi API od 13:05", "91 min", PP.support.fetchedAt, "Odśwież"],
        ["crit", "Email Worker polutek-support-mail", "15 błędów na 32 wywołania (7 dni)", "7 d", PP.daysAgo(0, 14, 15), "Błędy"],
        ["ok", "Kopia bazy", "02:31 · 48,2 MB · w R2", "—", PP.backups[0].at, "Kopie"],
        ["warn", "Zadania okresowe", "8/9 OK · sync-public-thumbnails: 1 błąd", "8 h", PP.daysAgo(0, 6, 0), "Zadania"],
        ["warn", "Swap serwera", "36% (próg 25%)", "16 h", PP.host.fetchedAt, "Kontenery"],
        ["ok", "Domeny i certyfikaty", "najbliższe: *.pawelperfect.pl za 29 d (auto)", "—", PP.daysAgo(0, 6, 0), "Domeny"]
      ];
      const W = PP.ui.STATE_WORD;
      body = `<div class="grid"><div class="span-12">${card({ hid: "h-hc", title: "Centrum zdrowia", meta: `<span class="muted">${rows.filter((x) => x[0] === "ok").length} OK · ${rows.filter((x) => x[0] === "warn").length} uwaga · ${rows.filter((x) => x[0] === "crit").length} błąd</span>`, sub: "Stan liczony co minutę przez kolektor; dostępność z zewnątrz sprawdza Worker Cloudflare, więc awaria całego serwera też jest widoczna.", flush: true, body: table([{ label: "Kontrola" }, { label: "Stan" }, { label: "Szczegóły", cls: "wrap" }, { label: "Od" }, { label: "Pomiar" }, { label: "" }], rows.map((x) => [`<strong>${esc(x[1])}</strong>`, state(x[0], W[x[0]]), esc(x[2]), esc(x[3]), age(x[4], x[1].indexOf("Kopia") === 0 || x[1].indexOf("Domeny") === 0 ? 1440 : x[1].indexOf("Zadania") === 0 ? 1440 : 15), x[5] ? `<button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="${esc(x[5])}: szczegóły kontroli (prototyp)">${esc(x[5])}</button>` : ""]), { caption: "Kontrole zdrowia" }) })}</div>
        <div class="span-12">${card({ hid: "h-deps", title: "Wdrożenia i oś zmian", body: `<ul class="list">${PP.changes.slice(0, 7).map((c) => `<li><span class="li-icon ${c.kind === "incident" ? "warn" : c.kind === "deploy" ? "info" : ""}">${icon(c.kind === "deploy" ? "deploy" : c.kind === "incident" ? "warn" : c.kind === "publish" ? "film" : c.kind === "broadcast" ? "mail" : "note")}</span><div class="li-main"><span class="li-title">${esc(c.label)}</span><span class="li-sub">${esc(fmt.dt(c.at))} · ${esc(c.detail)}</span></div>${c.kind === "deploy" && c === PP.changes[1] ? `<button type="button" class="btn btn-sm" data-action="rollback">Wycofaj do tej wersji</button>` : ""}</li>`).join("")}</ul>` })}</div></div>`;
    } else if (tab === "serwer") {
      const h = PP.host;
      const labels = h.cpu.map((_, i) => { const d = new Date(PP.now - (287 - i) * 300000); return fmt.time(d); });
      const deployIdx = 288 - 60;
      const mini = (vals, title, f, max, summary) => C.figure({ title, summary, labels, series: [{ name: title, values: vals, role: "current", slot: 1 }], annotations: [{ index: deployIdx, label: "Wdrożenie m10040944 (budowa obrazu na serwerze)", when: "dziś 09:41" }], height: 150, fmt: f, yMax: max, xName: "Godzina", tableStep: 12 });
      const cont = table([{ label: "Kontener" }, { label: "Stan" }, { label: "RAM / limit" }, { label: "CPU", num: true }, { label: "Restarty", num: true }, { label: "Obraz" }, { label: "Działa" }], PP.containers.map((c) => [`<span class="mono">${esc(c.name)}</span>`, state("ok", "zdrowy"), `<div style="min-width:140px;display:grid;gap:4px"><span class="tabular">${c.mem} / ${c.limit} MB</span>${C.meter({ value: c.mem, max: c.limit, label: "RAM " + c.name, warnAt: 80, critAt: 95 })}</div>`, fmt.one(c.cpu) + "%", c.restarts ? `<span class="state warn">${icon("warn")}${c.restarts}</span>` : "0", `<span class="mono">${esc(c.image)}</span>`, esc(c.up)]), { caption: "Kontenery Docker" });
      body = `<div class="grid">
        <div class="span-12"><div class="tiles" role="group" aria-label="Serwer teraz">
          ${tile({ label: "CPU (2 vCPU)", value: "11", unit: "%", delta: `<span class="delta-ctx">load ${h.load.map((x) => fmt.one(x)).join(" / ")}</span>` })}
          ${tile({ label: "RAM", value: "2,17", unit: "/ 3,8 GB", delta: `<span class="delta-ctx">dostępne 1,64 GB</span>` })}
          ${tile({ label: "Swap", value: "1,42", unit: "/ 4 GB", delta: state("warn", "36%, próg 25%") })}
          ${tile({ label: "Dysk", value: "64", unit: "%", delta: `<span class="delta-ctx">46 / 75 GB · pełny za ok. 210 d</span>` })}
          ${tile({ label: "iowait", value: fmt.one(h.iowait), unit: "%", delta: `<span class="delta-ctx">sieć 1,2 MB/s</span>` })}
        </div></div>
        <div class="span-4">${card({ hid: "h-cpu", title: "CPU % (24 h)", meta: age(h.fetchedAt, 1, "pp-collector"), body: mini(h.cpu, "CPU", (v) => fmt.int(v) + "%", 100, "Skok do ok. 85% podczas wdrożenia o 9:41 (budowa obrazu na serwerze), poza tym 5–25%.") })}</div>
        <div class="span-4">${card({ hid: "h-ram", title: "RAM zajęty, MB (24 h)", body: mini(h.ram, "RAM", (v) => fmt.int(v), 4000, "RAM stabilnie 2,0–2,4 GB z 3,8 GB.") })}</div>
        <div class="span-4">${card({ hid: "h-swp", title: "Swap zajęty, MB (24 h)", body: mini(h.swap, "Swap", (v) => fmt.int(v), 4000, "Swap stale ok. 1,4 GB: pamięć po budowach obrazów; sugestia: budować obrazy poza serwerem.") })}</div>
        <div class="span-12">${card({ hid: "h-cont", title: "Kontenery (9)", meta: age(h.fetchedAt, 1, "cgroup v2 + docker-socket-proxy"), flush: true, body: cont })}</div>
        <div class="span-12"><div class="banner">${icon("info")}<div class="banner-body"><span class="banner-title">Rekomendacja pojemności</span><span class="text-2">Przy obecnym ruchu serwer wystarcza. Dodatkowy panel (+250 MB) i kolektor (+80 MB) mieszczą się po przeniesieniu budowy obrazów poza serwer. Przy starcie: CX43 (8 vCPU, 16 GB).</span></div></div></div>
      </div>`;
    } else if (tab === "zadania") {
      const t = table([{ label: "Zadanie" }, { label: "Harmonogram" }, { label: "Ostatnio" }, { label: "Czas", num: true }, { label: "Wynik", cls: "wrap" }, { label: "Następne" }], PP.timers.map((x) => [`<span class="mono">${esc(x.name)}</span>`, esc(x.schedule), `${state(x.ok ? "ok" : "crit", fmt.dt(x.last))}`, esc(x.dur), esc(x.result), esc(x.next)]), { caption: "Zadania okresowe" });
      const bk = C.figure({ type: "columns", title: "Rozmiar kopii (MB), 14 dni", summary: "Kopie codziennie o 02:30, 46–48 MB, wszystkie w R2 poza serwerem.", labels: PP.backups.slice().reverse().map((b) => fmt.date(b.at)), series: [{ name: "Rozmiar MB", values: PP.backups.slice().reverse().map((b) => b.sizeMb), role: "current" }], height: 150, fmt: (v) => fmt.one(v) + " MB", xName: "Dzień" });
      body = `<div class="grid"><div class="span-12">${card({ hid: "h-tim", title: "Zadania i crony (9)", sub: "Każde uruchomienie zapisuje heartbeat; brak wpisu w oczekiwanym oknie z czasem łaski uruchamia alert (z zewnątrz, przez Worker).", flush: true, body: t })}</div>
        <div class="span-7">${card({ hid: "h-bk", title: "Kopie zapasowe", meta: state("ok", "Ostatnia: dziś 02:31"), body: `<dl class="dl-grid"><div><dt>Ostatnia udana</dt><dd>dziś 02:31 · 48,2 MB</dd></div><div><dt>Poza serwerem</dt><dd>${state("ok", "R2 serwerek-backups")}</dd></div><div><dt>Najstarsza</dt><dd>14 dni (retencja)</dd></div><div><dt>Lokalnie</dt><dd>7 dni · ten sam dysk co baza</dd></div></dl><h3 class="section-title">Rozmiar kopii</h3>` + bk })}</div>
        <div class="span-5">${card({ hid: "h-rt", title: "Test odtworzenia", meta: state("ok", "Udany"), body: `<dl class="kv"><dt>Ostatni test</dt><dd>${esc(fmt.dt(PP.restoreTest.at))} (${esc(fmt.rel(PP.restoreTest.at))})</dd><dt>Czas</dt><dd>${fmt.dur(PP.restoreTest.durS)} min</dd><dt>Wiersze</dt><dd>${esc(PP.restoreTest.rows)}</dd><dt>Następny</dt><dd>czw. 8 paź, 03:15 (co tydzień)</dd></dl>`, foot: `<span class="muted">Kopia bez testu odtworzenia nie jest kopią.</span><button type="button" class="btn btn-sm" data-action="toast" data-msg="Test odtworzenia zlecony na noc (limit pamięci 300 MB)">Zleć test</button>` })}</div></div>`;
    } else if (tab === "domeny") {
      const dt = table([{ label: "Nazwa" }, { label: "Rodzaj" }, { label: "Wygasa" }, { label: "Zostało", num: true }, { label: "Odnowienie" }, { label: "Źródło" }], PP.domains.map((d) => { const left = fmt.daysLeft(d.expires); return [`<strong>${esc(d.name)}</strong>`, esc(d.kind), esc(fmt.dateY(d.expires)), `${left} d`, d.auto ? state("ok", "automatyczne") : state("warn", "ręczne"), esc(d.source)]; }), { caption: "Domeny i certyfikaty" });
      const ct = table([{ label: "Pozycja", cls: "wrap" }, { label: "Miesięcznie", num: true }, { label: "Uwagi", cls: "wrap" }], PP.costs.map((c) => [esc(c.item), c.unit === "€" ? fmt.one(c.month) + " €" : c.unit === "$" ? fmt.int(c.month) + " $" : fmt.one(c.month) + " zł", esc(c.note)]), { caption: "Koszty" });
      body = `<div class="grid"><div class="span-12">${card({ hid: "h-dom", title: "Domeny i certyfikaty", sub: "Alerty 60/30/14/7/1 dni przed wygaśnięciem. .pl odnawiana ręcznie: przypomnienie e-mailem.", flush: true, body: dt })}</div>
        <div class="span-7">${card({ hid: "h-cost", title: "Koszty (bieżący miesiąc)", flush: true, body: ct, foot: `<span>Razem ok. <strong>110 zł</strong> / mies. · prognoza po starcie: ok. 230 zł</span><span class="muted">kursy orientacyjne</span>` })}</div>
        <div class="span-5">${card({ hid: "h-cf", title: "Cloudflare: strefa i R2", meta: age(PP.edge.fetchedAt, 15, "Cloudflare GraphQL"), body: `<dl class="kv"><dt>Żądania strefy (24 h)</dt><dd class="tabular">6 046 · 438 odsłon</dd><dt>Cache hit</dt><dd class="tabular">93,8%</dd><dt>Zdarzenia WAF</dt><dd class="tabular">12 zablokowanych</dd><dt>R2</dt><dd class="tabular">7,4 GB · operacje A 0,21 mln · B 1,9 mln</dd><dt>Konto współdzielone</dt><dd>${state("warn", "Workery innych projektów zużywają wspólny limit")}</dd></dl>` })}</div></div>`;
    } else {
      body = `<div class="grid"><div class="span-5">${card({ hid: "h-db", title: "Postgres 17", meta: age(PP.daysAgo(0, 14, 30), 5, "pg_stat_*"), body: `<dl class="kv"><dt>Rozmiar bazy</dt><dd>${PP.db.sizeMb} MB · +0,4 MB/dzień</dd><dt>Połączenia</dt><dd>${PP.db.conns} / ${PP.db.maxConns}</dd><dt>Cache hit</dt><dd>${PP.db.cacheHit}%</dd><dt>Wolne zapytania</dt><dd>${state("warn", "brak pg_stat_statements (wymaga restartu bazy)")}</dd></dl>` })}</div>
        <div class="span-7">${card({ hid: "h-tbl", title: "Największe tabele", body: C.barList(PP.db.tables.map((t) => [t[0] + (t[2] ? " · " + t[2] : ""), t[1]]), { fmt: (v) => fmt.one(v) + " MB", noPct: true }) })}</div></div>`;
    }
    return { title: "System", html: head("System", "Serwer serwerek (Hetzner CPX22) · Docker Compose za Cloudflare Tunnel") + tabs + body };
  };

  // ======================= BEZPIECZEŃSTWO =======================
  SC.bezpieczenstwo = function (r) {
    const tab = r.q.tab || "przeglad";
    const tabs = tabsNav("Sekcje bezpieczeństwa", [["przeglad", "Logowania i sesje", href("bezpieczenstwo")], ["audyt", "Dziennik audytu", href("bezpieczenstwo", { tab: "audyt" })]], tab);
    let body = "";
    if (tab === "przeglad") {
      const fails = C.figure({ type: "columns", title: "Nieudane logowania do serwisu (14 dni)", summary: "Zwykle 0–5 dziennie; 3 dni temu 14 z jednego adresu IP (zablokowany automatycznie).", labels: PP.failedSignIns.map((_, i) => fmt.date(new Date(PP.now - (13 - i) * PP.DAY))), series: [{ name: "Nieudane logowania", values: PP.failedSignIns, role: "current" }], highlight: (i) => i === 11, height: 160, xName: "Dzień" });
      body = `<div class="grid">
        <div class="span-12"><div class="banner ok">${icon("shield")}<div class="banner-body"><span class="banner-title">Panel chroniony trzema warstwami</span><span class="text-2">Cloudflare Access (tylko właściciel, klucz sprzętowy) → passkey + TOTP w panelu → rola bazy pp_admin bez prawa usuwania audytu.</span></div></div></div>
        <div class="span-7 stack">
          ${card({ hid: "h-ses2", title: "Aktywne sesje panelu", body: `<ul class="list">${PP.adminSessions.map((s, i) => `<li><span class="li-icon">${icon(i ? "monitor" : "monitor")}</span><div class="li-main"><span class="li-title">${esc(s.device)} ${s.current ? badge("info", "ta sesja", false) : ""}</span><span class="li-sub">${esc(s.method)} · ${esc(s.country)} · ${esc(s.ip)} · aktywna ${esc(fmt.rel(s.last))}</span></div>${s.current ? "" : `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Sesja na iPhonie zakończona">${icon("logout")}Wyloguj</button>`}</li>`).join("")}</ul>`, foot: `<span class="muted">Bezczynność 60 min, maks. 12 h · ponowne uwierzytelnienie przed zwrotem, rozsyłką, usunięciem</span><button type="button" class="btn btn-sm" data-action="toast" data-msg="Wylogowano wszystkie inne sesje">Wyloguj inne</button>` })}
          ${card({ hid: "h-fail", title: "Nieudane logowania (serwis)", body: fails })}
        </div>
        <div class="span-5 stack">
          ${card({ hid: "h-adm", title: "Konta administratorów", body: `<ul class="list">${PP.adminAccounts.map((a) => `<li><span class="avatar" aria-hidden="true">P</span><div class="li-main"><span class="li-title">${esc(a.name)}</span><span class="li-sub">${a.passkeys} passkeys · TOTP ${a.totp ? "włączone" : "wyłączone"} · ostatnio ${esc(fmt.rel(a.lastSignIn))}</span></div>${badge("ok", "MFA")}</li>`).join("")}</ul><div class="banner warn" style="margin-top:12px">${icon("warn")}<div class="banner-body"><span class="banner-title">4 stare konta ADMIN na www bez 2FA</span><span class="text-2">Po przeniesieniu panelu rola ADMIN na koncie publicznym przestaje dawać uprawnienia. Do zdjęcia przed startem.</span></div></div>` })}
          ${card({ hid: "h-susp", title: "Zdarzenia podejrzane", body: `<ul class="list"><li><span class="li-icon warn">${icon("warn")}</span><div class="li-main"><span class="li-title">14 nieudanych logowań z 185.220.x.x</span><span class="li-sub">1 paź · 6 kont · blokada IP 15 min zadziałała</span></div></li><li><span class="li-icon">${icon("info")}</span><div class="li-main"><span class="li-title">Nowe urządzenie admina: iPhone 16</span><span class="li-sub">dziś 07:58 · PL · potwierdzone e-mailem</span></div></li><li><span class="li-icon">${icon("info")}</span><div class="li-main"><span class="li-title">3 odrzucone CSRF (403) na /api/user</span><span class="li-sub">24 h · brak nagłówka Origin</span></div></li></ul>` })}
        </div></div>`;
    } else {
      let list = PP.audit.slice();
      if (r.q.actor) list = list.filter((a) => a.actorType === r.q.actor);
      if (r.q.kind) list = list.filter((a) => a.target === r.q.kind);
      if (r.q.q) list = list.filter((a) => norm(a.label + " " + a.code + " " + a.targetId + " " + a.requestId + " " + a.actor).includes(norm(r.q.q)));
      const pg = paginate(list, r.q.page, 15);
      body = `<div class="filters" role="search" aria-label="Filtry dziennika">${searchParam("q", "Akcja, obiekt lub requestId", r.q.q)}${selectParam("actor", "Aktor", [["", "Każdy aktor"], ["admin", "Admin"], ["system", "System (crony)"], ["webhook", "Webhook"], ["użytkownik", "Użytkownik"]], r.q.actor)}${selectParam("kind", "Obiekt", [["", "Każdy obiekt"], ["Film", "Film"], ["Komentarz", "Komentarz"], ["Płatność", "Płatność"], ["Konto", "Konto"], ["Sesja", "Sesja"], ["Ustawienia", "Ustawienia"], ["Rozsyłka", "Rozsyłka"]], r.q.kind)}<span class="topbar-spacer"></span><button type="button" class="btn" data-action="toast" data-msg="Eksport dziennika (CSV) dla filtrów: zapis w audycie">${icon("download")}Eksport</button></div>
        <section class="card card-flush" aria-label="Dziennik audytu">${table([{ label: "Czas" }, { label: "Akcja" }, { label: "Aktor" }, { label: "Obiekt" }, { label: "IP", cls: "hide-sm" }, { label: "Żądanie", cls: "hide-md hide-sm" }], pg.items.map((a) => [esc(fmt.dt(a.at)), `<strong>${esc(a.label)}</strong><div class="muted mono">${esc(a.code)}</div>`, esc(a.actor), `${esc(a.target)} <span class="mono muted">${esc(a.targetId)}</span>`, esc(a.ip), `<span class="mono">${esc(a.requestId)}</span>`]), { caption: "Dziennik audytu" })}${pager(pg, "wpisów")}</section>
        <p class="foot-note">${icon("lock")}Dziennik jest niezmienny: brak UPDATE/DELETE dla ról aplikacji, łańcuch skrótów sprawdzony ${esc(fmt.dt(PP.daysAgo(0, 3, 0)))} (zgodny), kopia dzienna w R2 z blokadą retencji.</p>`;
    }
    return { title: "Bezpieczeństwo", html: head("Bezpieczeństwo", "Kto, co i kiedy") + tabs + body };
  };

  // ======================= USTAWIENIA =======================
  SC.ustawienia = function () {
    const th = document.documentElement.getAttribute("data-theme") || "system";
    const html = `${head("Ustawienia", "Wygląd panelu, alerty i integracje")}
      <div class="grid">
        <div class="span-6 stack">${card({ hid: "h-look", title: "Wygląd", body: `<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label">Motyw</legend>${[["system", "Jak w systemie (domyślnie)"], ["light", "Jasny"], ["dark", "Ciemny"]].map((o) => `<label class="choice"><input type="radio" name="theme" value="${o[0]}" data-action="set-theme"${th === o[0] ? " checked" : ""}> ${o[1]}</label>`).join("")}</fieldset>` })}
          ${card({ hid: "h-alerts", title: "Alerty", body: `<div class="stack" style="gap:12px"><div class="field"><label for="a-swap">Swap serwera: ostrzeżenie od (%)</label><input class="input" id="a-swap" type="number" value="25" min="0" max="100" inputmode="numeric"></div><div class="field"><label for="a-worker">Worker HLS: ostrzeżenie od (% limitu dobowego)</label><input class="input" id="a-worker" type="number" value="70" min="0" max="100" inputmode="numeric"></div><fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label">Kanały</legend><label class="switch"><input type="checkbox" checked> E-mail (Resend)</label><label class="switch"><input type="checkbox" checked> Powiadomienia push (PWA na telefonie)</label></fieldset><div class="field"><label for="a-quiet">Godziny ciszy (tylko alerty krytyczne)</label><input class="input" id="a-quiet" type="text" value="23:00–07:00"></div></div>`, foot: `<span class="muted">Histereza: alert zamyka się dopiero po 10 min poniżej progu.</span><button type="button" class="btn btn-primary" data-action="toast" data-msg="Zapisano ustawienia alertów (prototyp)">Zapisz</button>` })}</div>
        <div class="span-6">${card({ hid: "h-int", title: "Integracje", sub: "Tylko stan i ostatnie udane wywołanie. Wartości sekretów nigdy nie są pokazywane.", body: `<div class="checks">${[["ok", "Stripe (klucz tylko do odczytu + zwroty)", "ostatnio 14:32"], ["ok", "Resend", "ostatnio 14:20"], ["ok", "Cloudflare (analityka, tylko odczyt)", "ostatnio 14:30"], ["warn", "PP Support", "brak odpowiedzi od 13:05"], ["ok", "RDAP (domeny)", "ostatnio 06:00"]].map((c) => `<div class="check ${c[0]}">${icon(c[0])}<div><div>${esc(c[1])}</div><div class="check-sub">${esc(c[2])}</div></div><span class="sr-only">${PP.ui.STATE_WORD[c[0]]}</span></div>`).join("")}</div>` })}</div>
      </div>`;
    return { title: "Ustawienia", html };
  };
})();
