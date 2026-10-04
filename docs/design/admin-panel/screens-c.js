/* Ekrany parytetu ze starym panelem (2026-10-04, zmiana zakresu przez właściciela): nowy film z wgraniem,
 * edycja wszystkich pól filmu, układ kanału, rola i usunięcie konta, ustawienia kanału i płatności,
 * szablony, kreator rozsyłki, powiadomienia. Mapa funkcji: docs/architecture/admin-parity.md. */
(function () {
  "use strict";
  const PP = window.PP, C = window.Charts;
  const { esc, fmt, icon, badge, state, card, href, table, head, tabsNav, toast, openModal, closeModal, confirmModal, tile } = PP.ui;
  const SC = PP.screens;
  const rerender = () => window.dispatchEvent(new HashChangeEvent("hashchange"));

  // ---------- Dane przykładowe tylko dla tych ekranów ----------
  PP.channel = { name: "Paweł Perfect", slug: "polutek", descPl: "Filmy o tym, jak powstają filmy. Kulisy, montaż, rozmowy.", descEn: "Films about how films are made. Behind the scenes, editing, conversations.", banner: true, defaultThumb: true, owner: "u35", subscribers: 31, subscribersAt: PP.daysAgo(0, 4, 0) };
  PP.paymentMins = [["PLN", 500], ["EUR", 100], ["USD", 100], ["CHF", 100], ["GBP", 100]];
  PP.users.forEach((u, i) => { u.role = i === 34 ? "ADMIN" : "USER"; });
  PP.videoBySlug.kulisy.fundraising = { mode: "manual", percent: 65, goal: null };
  PP.videoBySlug.czesc.fundraising = { mode: "goal", percent: null, goal: { amount: 200000, currency: "PLN", since: "2026-09-01" } };
  PP.notifTemplates = [["NEW_VIDEO", "Nowy film", "Nowy film: {{title}}"], ["PREMIERE_SOON", "Premiera za godzinę", "Za godzinę premiera: {{title}}"], ["COMMENT_REPLY", "Odpowiedź na komentarz", "{{author}} odpowiedział(a) na Twój komentarz"]];
  PP.notifSent = [{ title: "Nowy odcinek: JJ", at: PP.daysAgo(8, 19, 31), recipients: 36, read: 0 }, { title: "Premiera „Cześć” za godzinę", at: PP.daysAgo(22, 19, 0), recipients: 21, read: 0 }];

  const TIERS = [["PUBLIC", "Publiczny (bez logowania)"], ["LOGGED_IN", "Po zalogowaniu"]];
  const field = (id, label, input, hint) => `<div class="field"><label for="${id}">${esc(label)}</label>${input}${hint ? `<span class="hint" id="${id}-hint">${hint}</span>` : ""}</div>`;
  const text = (id, value, extra) => `<input class="input" id="${id}" type="text" value="${esc(value || "")}" ${extra || ""}>`;
  const area = (id, value, extra) => `<textarea class="input" id="${id}" ${extra || ""}>${esc(value || "")}</textarea>`;
  const radios = (name, opts, cur) => opts.map((o) => `<label class="choice"><input type="radio" name="${name}" value="${o[0]}"${o[0] === cur ? " checked" : ""}> ${esc(o[1])}</label>`).join("");
  const crumbs = (label) => `<a href="${href("tresci")}">Treści</a>${icon("right")}<span>${esc(label)}</span>`;

  function uploadCard(slug) {
    return card({ hid: "h-up", title: "Oryginał wideo", sub: "Plik idzie prosto do prywatnego R2 w częściach po 64 MB (wznawianie po zerwaniu). Serwer sprawdza rozmiar i nagłówek pliku, potem kodowanie startuje samo.", body: `<div class="dropzone" id="drop">${icon("upload", "icon-lg")}<div><strong>Przeciągnij plik albo wybierz z dysku</strong><div class="muted">MP4, MOV, MKV · do 10 GB · najlepiej 1080p lub 4K</div></div><button type="button" class="btn" data-action="fake-upload" data-slug="${esc(slug || "")}">Wybierz plik…</button></div><div id="up-progress" hidden><div class="limit-head" style="margin-top:12px"><span class="limit-name" id="up-name">nagranie-final.mov · 4,2 GB</span><span class="limit-val" id="up-pct">0%</span></div><div class="meter"><div class="meter-fill" id="up-fill" style="width:0%"></div></div><span class="limit-note" id="up-note">część 0 z 66 · zostało ok. 6 min · można zamknąć kartę i wrócić</span></div>` });
  }
  function thumbCard(v) {
    return card({ hid: "h-th", title: "Miniatura", body: `<div class="preview-row"><div class="preview"><div class="frame"><span>${esc(v ? v.title : "Nowy film")}</span></div>Kafel na liście</div><div class="preview"><div class="frame"><span>${esc(v ? v.title : "Nowy film")}</span></div>Hero na stronie głównej</div><div class="preview phone"><div class="frame"><span>${esc(v ? v.title : "Nowy film")}</span></div>Telefon</div></div>`, foot: `<span class="muted">JPG, PNG, WebP do 5 MB · kadr 16:9 · sprawdzane magiczne bajty</span><div class="row"><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Klatka z filmu: wybór sekundy na osi czasu (prototyp)">Klatka z filmu</button><button type="button" class="btn btn-sm" data-action="toast" data-msg="Wgrywanie i kadrowanie miniatury (prototyp)">${icon("upload")}Wgraj</button></div>` });
  }
  function publishCard(v) {
    const upcoming = v && v.premiereAt && v.premiereAt > PP.now;
    return card({ hid: "h-pub", title: "Publikacja i premiera", body: `<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label">Kiedy</legend>${radios("when", [["draft", "Zostaw jako szkic"], ["now", "Opublikuj od razu, gdy kodowanie się skończy"], ["premiere", "Premiera o wybranej godzinie"]], upcoming ? "premiere" : v && v.status === "PUBLISHED" ? "now" : "draft")}</fieldset>${field("prem-at", "Data i godzina premiery (czas warszawski)", `<input class="input" id="prem-at" type="datetime-local" value="${upcoming ? "2026-10-06T20:00" : ""}">`, "Przed premierą zalogowani widzą kokpit z odliczaniem, goście ekran logowania. Musi być w przyszłości.")}` });
  }
  function fundraisingCard(v) {
    const f = (v && v.fundraising) || { mode: "off" };
    return card({ hid: "h-fund", title: "Pasek zbiórki", sub: "Pasek pod tytułem filmu, bez kwot. Ręczny procent ma pierwszeństwo przed celem.", body: `<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label">Tryb</legend>${radios("fund", [["off", "Bez paska"], ["manual", "Procent ustawiony ręcznie"], ["goal", "Liczony z napiwków względem celu"]], f.mode)}</fieldset><div class="grid" style="margin-top:8px"><div class="span-4">${field("f-pct", "Wypełnienie (%)", `<input class="input" id="f-pct" type="number" min="0" max="100" inputmode="numeric" value="${f.percent ?? ""}">`)}</div><div class="span-4">${field("f-goal", "Cel", `<input class="input" id="f-goal" type="text" inputmode="decimal" value="${f.goal ? fmt.int(f.goal.amount / 100) : ""}" placeholder="np. 2000">`)}</div><div class="span-4">${field("f-cur", "Waluta", `<select class="select" id="f-cur">${["PLN", "EUR", "USD", "CHF", "GBP"].map((c) => `<option${f.goal && f.goal.currency === c ? " selected" : ""}>${c}</option>`).join("")}</select>`)}</div><div class="span-6">${field("f-since", "Licz napiwki od", `<input class="input" id="f-since" type="date" value="${f.goal ? f.goal.since : ""}">`, "Puste = wszystkie napiwki kanału.")}</div></div>` });
  }
  function subsCard(v) {
    const row = (lang, name, has) => `<li><span class="li-icon">${icon("subtitles")}</span><div class="li-main"><span class="li-title">${name}</span><span class="li-sub">${has ? "WebVTT poprawny · 312 napisów" : "brak pliku"}</span></div><div class="row">${has ? `<button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Napisy ${lang} usunięte (cofnij w historii)">Usuń</button>` : ""}<button type="button" class="btn btn-sm" data-action="toast" data-msg="Wgrywanie VTT ${lang}: walidacja i podgląd w odtwarzaczu (prototyp)">${has ? "Podmień" : "Wgraj VTT"}</button></div></li>`;
    return card({ hid: "h-sub", title: "Napisy", body: `<ul class="list">${row("PL", "Polski", v && v.subsPl)}${row("EN", "Angielski", v && v.subsEn)}</ul>` });
  }
  function metaCard(v) {
    return card({ hid: "h-meta", title: "Podstawowe", body: `<div class="grid"><div class="span-8">${field("v-title", "Tytuł", text("v-title", v && v.title, 'required maxlength="120"'))}</div><div class="span-4">${field("v-slug", "Adres (slug)", text("v-slug", v && v.slug, 'pattern="[a-z0-9-]+"'), "małe litery, cyfry i myślniki")}</div><div class="span-6">${field("v-desc-pl", "Opis (PL)", area("v-desc-pl", v ? "Opis filmu „" + v.title + "”." : ""))}</div><div class="span-6">${field("v-desc-en", "Opis (EN)", area("v-desc-en", ""), "Bez opisu EN angielscy widzowie zobaczą polski.")}</div><div class="span-12"><fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label">Dostęp</legend>${radios("tier", TIERS, v && v.tier === "PUBLIC" ? "PUBLIC" : "LOGGED_IN")}</fieldset></div></div>` });
  }

  // ---------- Treści: nowy film, edycja, układ ----------
  function newFilm() {
    const html = `${head("Nowy film", "Szkic powstaje od razu; kodowanie rusza po wgraniu oryginału, publikacja dopiero po liście kontrolnej.", `<a class="btn" href="${href("tresci")}">Anuluj</a><button type="button" class="btn btn-primary" data-action="create-film">Utwórz szkic</button>`, crumbs("Nowy film"))}
      <ol class="modal-steps" aria-label="Kroki" style="margin-bottom:16px;list-style:none;padding:0"><li aria-current="step">1. Metadane</li><li>· 2. Oryginał</li><li>· 3. Kodowanie</li><li>· 4. Publikacja</li></ol>
      <div class="grid"><div class="span-8 stack">${metaCard(null)}${uploadCard("")}${thumbCard(null)}</div><div class="span-4 stack">${publishCard(null)}${card({ hid: "h-ck", title: "Lista kontrolna", body: `<ul class="checklist">${[["warn", "Tytuł i adres"], ["warn", "Oryginał wgrany i zakodowany"], ["warn", "Miniatura"], ["warn", "Napisy PL (zalecane)"]].map((c) => `<li class="${c[0]}">${icon(c[0])}<span>${esc(c[1])}</span></li>`).join("")}</ul>` })}</div></div>`;
    return { title: "Nowy film · Treści", html };
  }
  function editFilm(slug) {
    const v = PP.videoBySlug[slug] || PP.videoBySlug.czesc;
    const danger = card({ hid: "h-danger", title: "Strefa zagrożenia", body: `<ul class="list"><li><div class="li-main"><span class="li-title">${v.status === "ARCHIVED" ? "Przywróć do szkiców" : "Archiwizuj"}</span><span class="li-sub">${v.status === "ARCHIVED" ? "film wraca jako szkic" : "znika ze strony i z list; można przywrócić"}</span></div><button type="button" class="btn" data-action="archive-film" data-slug="${v.slug}">${v.status === "ARCHIVED" ? "Przywróć" : "Archiwizuj…"}</button></li><li><div class="li-main"><span class="li-title">Usuń film na zawsze</span><span class="li-sub">kasuje film, komentarze, wersje HLS i oryginał w R2; nie da się cofnąć</span></div><button type="button" class="btn btn-danger" data-action="delete-film" data-slug="${v.slug}">${icon("trash")}Usuń…</button></li></ul>` });
    const html = `${head("Edycja: " + v.title, `Jeden formularz na wszystkie pola · zmiany trafiają do historii filmu`, `<a class="btn" href="${href("tresci/" + v.slug)}">Anuluj</a><button type="button" class="btn btn-primary" data-action="save-film">Zapisz zmiany</button>`, crumbs(v.title))}
      <div class="grid"><div class="span-8 stack">${metaCard(v)}${publishCard(v)}${fundraisingCard(v)}${thumbCard(v)}${subsCard(v)}${uploadCard(v.slug)}${danger}</div>
      <div class="span-4 stack">${card({ hid: "h-exp2", title: "Ekspozycja", body: `<div class="stack" style="gap:8px"><label class="switch"><input type="checkbox" ${v.sidebar ? "checked" : ""}> Na liście filmów (sidebar)</label><label class="switch"><input type="checkbox" ${v.hero ? "checked" : ""}> Hero strony głównej</label><p class="hint muted" style="font-size:12px">Hero tylko dla opublikowanego, publicznego filmu z gotowym HLS. Kolejność: Układ kanału.</p></div>` })}
      ${card({ hid: "h-hist2", title: "Ostatnie zmiany", body: `<ul class="list">${PP.audit.filter((a) => a.target === "Film").slice(0, 4).map((a) => `<li><div class="li-main"><span class="li-title">${esc(a.label)}</span><span class="li-sub">${esc(fmt.dt(a.at))}</span></div></li>`).join("")}</ul>` })}</div></div>`;
    return { title: "Edycja · " + v.title, html };
  }
  function layoutScreen() {
    const list = PP.videos.filter((v) => v.sidebar);
    const rows = list.map((v, i) => [`<div class="cell-title"><span class="muted tabular" style="width:20px">${i + 1}</span><span class="thumb" aria-hidden="true"></span><strong>${esc(v.title)}</strong></div>`, esc(v.tier === "PUBLIC" ? "Publiczny" : "Zalogowani"), `<label class="choice"><input type="radio" name="hero"${v.hero ? " checked" : ""}> <span class="sr-only">Hero: </span>Hero</label>`, `<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-sm btn-ghost" aria-label="W górę: ${esc(v.title)}"${i === 0 ? " disabled" : ""}>${icon("up")}</button><button type="button" class="btn btn-sm btn-ghost" aria-label="W dół: ${esc(v.title)}"${i === list.length - 1 ? " disabled" : ""}>${icon("down")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Film schowany z listy (zapis po kliknięciu „Zapisz układ”)">Schowaj</button></div>`]);
    const html = `${head("Układ kanału", "Kolejność na liście filmów i film na stronie głównej. Kolejność jak w serwisie, od góry.", `<a class="btn" href="${href("tresci")}">Anuluj</a><button type="button" class="btn btn-primary" data-action="toast" data-msg="Układ zapisany jednym żądaniem: kolejność i Hero (audyt VIDEO_LAYOUT_SAVED)">Zapisz układ</button>`, crumbs("Układ kanału"))}
      <p class="text-2 kbd-tip" style="margin-bottom:12px">Klawisze: fokus na wierszu, potem <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> przesuwa.</p>
      <section class="card card-flush" aria-label="Kolejność filmów">${table([{ label: "Film" }, { label: "Dostęp" }, { label: "Strona główna" }, { label: "" }], rows, { caption: "Kolejność filmów na liście" })}</section>`;
    return { title: "Układ kanału · Treści", html };
  }
  const baseTresci = SC.tresci;
  SC.tresci = function (r) {
    if (r.parts[1] === "nowy") return newFilm();
    if (r.parts[1] && r.parts[2] === "edycja") return editFilm(r.parts[1]);
    if (!r.parts[1] && r.q.widok === "uklad") return layoutScreen();
    return baseTresci(r);
  };

  // ---------- Ustawienia: kanał, płatności, wygląd i alerty, integracje ----------
  const baseUstawienia = SC.ustawienia;
  SC.ustawienia = function (r) {
    const tab = r.q.tab || "kanal";
    const tabs = tabsNav("Sekcje ustawień", [["kanal", "Kanał", href("ustawienia", { tab: "kanal" })], ["platnosci", "Płatności", href("ustawienia", { tab: "platnosci" })], ["panel", "Panel i alerty", href("ustawienia", { tab: "panel" })]], tab);
    if (tab === "panel") { const b = baseUstawienia(r); return { title: b.title, html: b.html.replace('<div class="grid">', tabs + '<div class="grid">') }; }
    const ch = PP.channel;
    let body;
    if (tab === "kanal") {
      const owner = PP.userById[ch.owner];
      body = `<div class="grid"><div class="span-8 stack">${card({ hid: "h-ch", title: "Kanał", body: `<div class="grid"><div class="span-6">${field("c-name", "Nazwa kanału", text("c-name", ch.name, 'maxlength="80"'))}</div><div class="span-6">${field("c-slug", "Adres kanału", text("c-slug", ch.slug, "disabled"), "Klucz w bazie; zmienia się tylko migracją.")}</div><div class="span-12">${field("c-desc-pl", "Opis (PL)", area("c-desc-pl", ch.descPl))}</div><div class="span-12">${field("c-desc-en", "Opis (EN)", area("c-desc-en", ch.descEn))}</div></div>`, foot: `<span class="muted">Zmiana trafia do audytu (CHANNEL_UPDATED).</span><button type="button" class="btn btn-primary" data-action="toast" data-msg="Zapisano ustawienia kanału">Zapisz</button>` })}
        ${card({ hid: "h-ban", title: "Baner kanału", body: `<div class="preview"><div class="frame" style="aspect-ratio:6/1"><span>Baner ${esc(ch.name)}</span></div>2560 × 423 px, bezpieczny środek 1546 × 423</div>`, foot: `<span class="muted">JPG/PNG/WebP do 6 MB, wgrywany do R2</span><div class="row"><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Baner usunięty">Usuń</button><button type="button" class="btn btn-sm" data-action="toast" data-msg="Wgrywanie banera z kadrowaniem (prototyp)">${icon("upload")}Wgraj nowy</button></div>` })}
        ${card({ hid: "h-dth", title: "Domyślna miniatura", sub: "Dla filmów bez własnej miniatury.", body: `<div class="preview" style="max-width:280px"><div class="frame"><span>PP</span></div></div>`, foot: `<span class="muted">Nowa wersja zapisuje się przed usunięciem starej (bez dziury).</span><div class="row"><button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Domyślna miniatura usunięta">Usuń</button><button type="button" class="btn btn-sm" data-action="toast" data-msg="Wgrywanie domyślnej miniatury (prototyp)">${icon("upload")}Wgraj</button></div>` })}</div>
        <div class="span-4 stack">${card({ hid: "h-own", title: "Konto kanału", sub: "Konto na stronie, które jest „Twórcą” (odznaka przy komentarzach, odpowiedzi twórcy).", body: `<div class="row"><span class="avatar" aria-hidden="true">P</span><div><strong>${esc(owner.nick)}</strong><div class="muted">${esc(owner.email)}</div></div></div>`, foot: `<button type="button" class="btn btn-sm" data-action="toast" data-msg="Zmiana konta kanału wymaga ponownego potwierdzenia tożsamości (prototyp)">Zmień konto…</button>` })}
        ${card({ hid: "h-subs2", title: "Subskrybenci", body: `<div class="hero-num">${ch.subscribers}</div><p class="muted">osób ze zgodą na powiadomienia o filmach</p>`, foot: `${PP.ui.age(ch.subscribersAt, 1440, "przeliczenie")}<button type="button" class="btn btn-sm" data-action="toast" data-msg="Przeliczono subskrybentów: 31">${icon("refresh")}Przelicz</button>` })}</div></div>`;
    } else {
      body = `<div class="grid"><div class="span-7">${card({ hid: "h-pay", title: "Minimalny napiwek", sub: "Ta sama kwota jest pokazywana w bramce i sprawdzana na serwerze.", flush: true, body: table([{ label: "Waluta" }, { label: "Minimum", num: true }, { label: "" }], PP.paymentMins.map((m) => [`<strong>${m[0]}</strong>`, `<label class="sr-only" for="min-${m[0]}">Minimum ${m[0]}</label><input class="input" id="min-${m[0]}" style="width:110px;text-align:right" inputmode="decimal" value="${(m[1] / 100).toFixed(2).replace(".", ",")}">`, `<span class="muted">${m[0] === "PLN" ? "BLIK, karta, Przelewy24" : "karta, portfele"}</span>`]), { caption: "Minimalne kwoty napiwku", responsive: true }), foot: `<span class="muted">Zmiana trafia do audytu (PAYMENT_SETTINGS_UPDATED).</span><button type="button" class="btn btn-primary" data-action="toast" data-msg="Zapisano minimalne kwoty">Zapisz</button>` })}</div>
        <div class="span-5">${card({ hid: "h-stp", title: "Stripe", body: `<div class="checks"><div class="check ok">${icon("ok")}<div><div>Tryb na żywo</div><div class="check-sub">klucz tylko do odczytu + zwroty, wartość nie jest pokazywana</div></div><span class="sr-only">OK</span></div><div class="check ok">${icon("ok")}<div><div>Webhook aktywny</div><div class="check-sub">www.pawelperfect.com/api/webhooks/stripe</div></div><span class="sr-only">OK</span></div></div>`, foot: `<a href="${href("przychody", { tab: "stripe" })}">Zdarzenia i saldo</a>` })}</div></div>`;
    }
    return { title: "Ustawienia", html: head("Ustawienia", "Kanał, płatności, panel") + tabs + body };
  };

  // ---------- Komunikacja: przegląd, rozsyłki, szablony, powiadomienia ----------
  const baseKomunikacja = SC.komunikacja;
  SC.komunikacja = function (r) {
    const tab = r.q.tab || "przeglad";
    const tabs = tabsNav("Sekcje komunikacji", [["przeglad", "Przegląd", href("komunikacja")], ["rozsylki", "Rozsyłki", href("komunikacja", { tab: "rozsylki" })], ["szablony", "Szablony", href("komunikacja", { tab: "szablony" })], ["powiadomienia", "Powiadomienia", href("komunikacja", { tab: "powiadomienia" })]], tab);
    if (tab === "przeglad") { const b = baseKomunikacja(r); return { title: b.title, html: b.html.replace('<div class="grid">', tabs + '<div class="grid">') }; }
    let body;
    if (tab === "rozsylki") {
      const BST = { SENT: ["ok", "Wysłana"], SCHEDULED: ["info", "Zaplanowana"], TEST: ["", "Test"] };
      body = (r.q.nowa ? wizard() : "") + `<section class="card card-flush" aria-label="Rozsyłki">${table([{ label: "Rozsyłka", cls: "wrap" }, { label: "Status" }, { label: "Kiedy" }, { label: "Odbiorcy", num: true }, { label: "Postęp" }, { label: "" }], PP.broadcasts.map((b) => [esc(b.title), badge(BST[b.status][0], BST[b.status][1], b.status === "SCHEDULED" ? "clock" : BST[b.status][0] ? undefined : false), esc(fmt.dt(b.at)), String(b.recipients), b.status === "SENT" ? `${b.recipients}/${b.recipients}` : "—", b.status === "SCHEDULED" ? `<button type="button" class="btn btn-sm" data-action="cancel-broadcast" data-title="${esc(b.title)}">Anuluj…</button>` : ""]), { caption: "Rozsyłki" })}</section>`;
    } else if (tab === "szablony") {
      const key = r.q.t || "welcome-email";
      const t = PP.templates.find((x) => x[0] === key) || PP.templates[0];
      body = `<div class="grid"><div class="span-4">${card({ hid: "h-tl", title: "Szablony", flush: true, body: `<ul class="list list-pad">${PP.templates.map((x) => `<li${x[0] === key ? ' class="is-active"' : ""}><div class="li-main"><a class="li-title" href="${href("komunikacja", { tab: "szablony", t: x[0] })}"${x[0] === key ? ' aria-current="true"' : ""}>${esc(x[1])}</a><span class="li-sub mono">${esc(x[0])}</span></div>${x[2] === "zmieniony" ? badge("info", "zmieniony", false) : badge("", "domyślny", false)}</li>`).join("")}</ul>` })}</div>
        <div class="span-8">${card({ hid: "h-te", title: t[1], meta: `<span class="mono muted">${esc(t[0])}</span>`, body: `<div class="grid"><div class="span-6">${field("t-sub-pl", "Temat (PL)", text("t-sub-pl", "Witaj w PAWELPERFECT.COM, {{firstName}}"))}</div><div class="span-6">${field("t-sub-en", "Temat (EN)", text("t-sub-en", "Welcome to PAWELPERFECT.COM, {{firstName}}"))}</div><div class="span-6">${field("t-body-pl", "Treść (PL)", area("t-body-pl", "Cześć {{firstName}}!\n\nDzięki za założenie konta. Nowe filmy znajdziesz na {{appUrl}}.\n\n{{preferencesLink}}", 'rows="8"'), "Zmienne: {{firstName}} {{appUrl}} {{preferencesLink}}. Nieznana zmienna blokuje zapis.")}</div><div class="span-6">${field("t-body-en", "Treść (EN)", area("t-body-en", "Hi {{firstName}}!\n\nThanks for signing up. New films are at {{appUrl}}.\n\n{{preferencesLink}}", 'rows="8"'))}</div></div><details class="more" style="margin-top:12px"><summary>Różnica względem domyślnego</summary><pre class="mono effect" style="white-space:pre-wrap">- Dzięki za rejestrację.\n+ Dzięki za założenie konta.</pre></details>`, foot: `<button type="button" class="btn btn-ghost" data-action="reset-template" data-key="${esc(t[0])}">Przywróć domyślny…</button><div class="row"><button type="button" class="btn" data-action="toast" data-msg="Test wysłany na Twój adres (PL i EN)">Wyślij test do siebie</button><button type="button" class="btn btn-primary" data-action="toast" data-msg="Szablon zapisany (TEMPLATE_SAVED)">Zapisz</button></div>` })}</div></div>`;
    } else {
      body = `<div class="banner warn" style="margin-bottom:16px">${icon("warn")}<div class="banner-body"><span class="banner-title">Wysyłka wyłączona: dzwonek powiadomień usunięty ze strony (decyzja 2026-10-04)</span><span class="text-2">Ekran zostaje, żeby nic nie zginęło: szablony i historia. Włączenie wymaga decyzji właściciela o powrocie dzwonka.</span></div></div>
        <div class="grid"><div class="span-6">${card({ hid: "h-nt", title: "Szablony powiadomień", flush: true, body: table([{ label: "Rodzaj" }, { label: "Tekst", cls: "wrap" }, { label: "" }], PP.notifTemplates.map((n) => [`<strong>${esc(n[1])}</strong><div class="muted mono">${esc(n[0])}</div>`, esc(n[2]), `<button type="button" class="btn btn-sm btn-ghost" data-action="toast" data-msg="Edycja szablonu powiadomienia (prototyp)">Edytuj</button>`]), { caption: "Szablony powiadomień" }) })}</div>
        <div class="span-6">${card({ hid: "h-ns", title: "Wysłane", flush: true, body: table([{ label: "Powiadomienie", cls: "wrap" }, { label: "Kiedy" }, { label: "Odbiorcy", num: true }], PP.notifSent.map((n) => [esc(n.title), esc(fmt.dt(n.at)), String(n.recipients)]), { caption: "Wysłane powiadomienia" }), foot: `<button type="button" class="btn btn-sm" aria-disabled="true" title="Wyłączone: dzwonek usunięty">Nowe powiadomienie</button>` })}</div></div>`;
    }
    return { title: "Komunikacja", html: head("Komunikacja", "E-maile, rozsyłki, szablony i powiadomienia", `<a class="btn btn-primary" href="${href("komunikacja", { tab: "rozsylki", nowa: "1" })}">${icon("mail")}Nowa rozsyłka</a>`) + tabs + body };
  };
  function wizard() {
    return card({ hid: "h-wiz", title: "Nowa rozsyłka", meta: `<ol class="modal-steps" aria-label="Kroki" style="list-style:none;padding:0;margin:0"><li aria-current="step">1. Odbiorcy</li><li>· 2. Treść</li><li>· 3. Test</li><li>· 4. Wysyłka</li></ol>`, body: `<div class="grid"><div class="span-4">${tile({ label: "Odbiorcy", value: "31", hint: "Subskrybenci ze zgodą na powiadomienia, bez listy blokad (EmailSuppression)." })}</div><div class="span-8 stack">${field("b-sub-pl", "Temat (PL)", text("b-sub-pl", "Premiera „Kulisy” we wtorek o 20:00"))}${field("b-body-pl", "Treść (PL)", area("b-body-pl", "Cześć! We wtorek o 20:00 premiera…", 'rows="4"'))}${field("b-sub-en", "Temat (EN)", text("b-sub-en", "Premiere of “Kulisy” on Tuesday, 8 pm"))}${field("b-when", "Kiedy wysłać", `<input class="input" id="b-when" type="datetime-local" value="2026-10-05T18:00">`, "Puste = od razu. Kolejka wysyła do 4 e-maili na sekundę; limit Resend Free: 100 dziennie.")}</div></div>`, foot: `<span class="muted">Stopka z wypisem dodawana automatycznie.</span><div class="row"><button type="button" class="btn" data-action="toast" data-msg="Test wysłany na Twój adres (PL i EN)">Wyślij test do siebie</button><button type="button" class="btn btn-primary" data-action="send-broadcast">Dalej: potwierdź i wyślij</button></div>` });
  }

  // ---------- Akcje (wołane z delegacji w app.js) ----------
  function typedConfirm(o) {
    openModal({
      title: o.title,
      body: `<p>${o.body}</p><div class="effect"><strong>Skutek</strong><ul>${o.effect.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>${field("typed", o.label, `<input class="input" id="typed" type="text" autocomplete="off" spellcheck="false" aria-describedby="typed-hint" autofocus>`, `Wpisz dokładnie: <span class="mono">${esc(o.expect)}</span>`)}`,
      foot: `<button type="button" class="btn" data-close>Anuluj</button><button type="submit" class="btn btn-danger" id="typed-go" aria-disabled="true">${esc(o.confirm)}</button>`,
      onOpen(m) {
        const inp = m.querySelector("#typed"), go = m.querySelector("#typed-go");
        inp.addEventListener("input", () => { if (inp.value.trim() === o.expect) go.removeAttribute("aria-disabled"); else go.setAttribute("aria-disabled", "true"); });
        m.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); if (inp.value.trim() !== o.expect) { inp.setAttribute("aria-invalid", "true"); inp.focus(); return; } closeModal(); o.onConfirm(); });
      }
    });
  }
  PP.deleteUserFlow = function (id) {
    const u = PP.userById[id];
    typedConfirm({ title: "Usunąć i zanonimizować konto?", body: `Konto <strong>${esc(u.nick)}</strong> zostanie zanonimizowane: pseudonim, e-mail i awatar znikną, komentarze dostaną podpis „Usunięte konto”. Wymaga ponownego potwierdzenia tożsamości.`, effect: ["wylogowanie ze wszystkich urządzeń", "wpłaty zostają w księgowości bez danych osobowych", "nieodwracalne; zapis USER_DELETED w audycie", "ostatniego administratora nie da się usunąć"], label: "Wpisz adres e-mail konta", expect: u.email, confirm: "Usuń konto", onConfirm: () => { u.status = "deleted"; toast("ok", "Konto zanonimizowane", "Zapis USER_DELETED w audycie."); rerender(); } });
  };
  PP.extraActions = {
    role(a, id) {
      const u = PP.userById[id];
      openModal({ title: "Rola konta " + u.nick, body: `<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label">Rola na stronie</legend>${radios("role", [["USER", "Użytkownik"], ["ADMIN", "Administrator (dostęp do starego /admin do fazy 5, potem tylko odznaka)"]], u.role)}</fieldset><div class="effect"><strong>Skutek</strong><ul><li>zmiana od razu, wpis USER_ROLE_CHANGED w audycie</li><li>wymaga ponownego potwierdzenia tożsamości (5 min)</li><li>nie dotyczy logowania do tego panelu (osobne konta)</li></ul></div>`, foot: `<button type="button" class="btn" data-close>Anuluj</button><button type="submit" class="btn btn-primary">Zapisz rolę</button>`, onOpen(m) { m.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); u.role = m.querySelector('input[name="role"]:checked').value; closeModal(); toast("ok", "Rola zmieniona: " + (u.role === "ADMIN" ? "administrator" : "użytkownik"), "Zapis w audycie."); rerender(); }); } });
    },
    "create-film"() { const t = document.getElementById("v-title"); if (!t.value.trim()) { t.setAttribute("aria-invalid", "true"); t.focus(); toast("warn", "Brakuje tytułu", "Uzupełnij pole „Tytuł”."); return; } toast("ok", "Szkic utworzony", "Teraz wgraj oryginał; kodowanie ruszy samo."); },
    "save-film"() { toast("ok", "Zapisano zmiany filmu", "Wersja w historii; konflikt edycji (ktoś zapisał wcześniej) kończy się pytaniem, nie nadpisaniem."); },
    "fake-upload"() {
      const box = document.getElementById("up-progress"); if (!box) return; box.hidden = false;
      let p = 0; const fill = document.getElementById("up-fill"), pct = document.getElementById("up-pct"), note = document.getElementById("up-note");
      const step = () => { p = Math.min(100, p + 9); fill.style.width = p + "%"; pct.textContent = p + "%"; note.textContent = p < 100 ? `część ${Math.round(p * 0.66)} z 66 · można zamknąć kartę i wrócić` : "wgrane i sprawdzone · kodowanie w kolejce"; if (p < 100) setTimeout(step, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180); else toast("ok", "Oryginał wgrany", "Kodowanie w kolejce (1 przed nim)."); };
      step();
    },
    "archive-film"(a) { const v = PP.videoBySlug[a.dataset.slug]; if (v.status === "ARCHIVED") { v.status = "DRAFT"; toast("ok", "Przywrócono do szkiców", ""); rerender(); return; } confirmModal({ title: `Archiwizować „${v.title}”?`, body: "Film zniknie ze strony i list. Możesz go przywrócić.", effect: ["znika z listy filmów i z Hero", "publiczna miniatura usunięta", "komentarze zostają"], confirm: "Archiwizuj", danger: false, onConfirm: () => { v.status = "ARCHIVED"; toast("ok", "Zarchiwizowano", "Przywrócisz w strefie zagrożenia."); rerender(); } }); },
    "delete-film"(a) { const v = PP.videoBySlug[a.dataset.slug]; typedConfirm({ title: `Usunąć „${v.title}” na zawsze?`, body: "Tego nie da się cofnąć. Jeśli chcesz tylko schować film, użyj „Archiwizuj”.", effect: ["film, komentarze i statystyki znikają z bazy", "wersje HLS i oryginał są kasowane z R2", "trwające kodowanie przerywa się i sprząta pliki", "wpis VIDEO_DELETED w audycie"], label: "Wpisz adres filmu", expect: v.slug, confirm: "Usuń film", onConfirm: () => { toast("ok", "Film usunięty", "Pliki w R2 sprzątnięte."); location.hash = href("tresci").slice(1); } }); },
    "cancel-broadcast"(a) { confirmModal({ title: "Anulować rozsyłkę?", body: `„${esc(a.dataset.title)}” nie zostanie wysłana. Odbiorcy, do których już poszła, ją mają.`, confirm: "Anuluj rozsyłkę", danger: false, onConfirm: () => toast("ok", "Rozsyłka anulowana", "Zapis BROADCAST_CANCELLED.") }); },
    "send-broadcast"() { confirmModal({ title: "Wysłać rozsyłkę do 31 osób?", body: "Po potwierdzeniu panel poprosi o klucz dostępu (step-up). Wysyłki nie da się cofnąć; zaplanowaną można anulować.", effect: ["31 e-maili przez Resend (limit dzienny 100)", "każdy z linkiem wypisu", "wpis BROADCAST_CREATED w audycie"], confirm: "Dalej: potwierdź tożsamość", danger: false, onConfirm: () => toast("ok", "Rozsyłka zaplanowana", "pon. 18:00 · 31 odbiorców") }); },
    "reset-template"(a) { confirmModal({ title: "Przywrócić tekst domyślny?", body: `Twoja wersja szablonu <span class="mono">${esc(a.dataset.key)}</span> zostanie usunięta; e-maile pójdą z tekstem z kodu.`, confirm: "Przywróć domyślny", danger: false, onConfirm: () => toast("ok", "Przywrócono tekst domyślny", "") }); }
  };
})();
