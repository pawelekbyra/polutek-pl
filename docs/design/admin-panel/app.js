/* Powłoka prototypu: nawigacja, router (hash), globalny filtr czasu, motyw, kropka zdrowia,
 * paleta poleceń (Ctrl+K), skróty klawiszowe, akcje (w tym zwrot z ponownym uwierzytelnieniem), tryb premiery. */
(function () {
  "use strict";
  const PP = window.PP, C = window.Charts;
  const { S, esc, fmt, icon, badge, state, href, withParam, toast, openModal, closeModal, confirmModal, norm } = PP.ui;
  const $ = (s, r) => (r || document).querySelector(s);
  const main = $("#main");

  // ---------- Nawigacja ----------
  const NAV = [
    { id: "dzisiaj", label: "Dzisiaj", icon: "today", key: "d" },
    { id: "analityka", label: "Analityka", icon: "chart", key: "a" },
    { id: "tresci", label: "Treści", icon: "film", key: "t", count: () => 1, kind: "crit", what: "film z błędem" },
    { id: "spolecznosc", label: "Społeczność", icon: "users", key: "s", count: () => PP.modQueue().length, kind: "warn", what: "do moderacji" },
    { id: "przychody", label: "Przychody", icon: "coins", key: "p", count: () => 1, kind: "crit", what: "spór" },
    { id: "komunikacja", label: "Komunikacja", icon: "mail", key: "k", count: () => 2, kind: "", what: "wątki bez odpowiedzi" },
    { id: "system", label: "System", icon: "server", key: "y", count: () => 3, kind: "warn", what: "ostrzeżenia" },
    { id: "bezpieczenstwo", label: "Bezpieczeństwo", icon: "shield", key: "b" }
  ];
  const FOOT = [
    { id: "premiera", label: "Premiera na żywo", icon: "live", key: "l" },
    { id: "ustawienia", label: "Ustawienia", icon: "settings", key: "," }
  ];
  const ALL = NAV.concat(FOOT);
  function navItem(n, cur) {
    const c = n.count ? n.count() : 0;
    return `<li><a href="${href(n.id)}" data-nav="${n.id}"${cur === n.id ? ' aria-current="page"' : ""} title="${esc(n.label)} (g, ${n.key})">${icon(n.icon, "icon-lg")}<span class="nav-label">${esc(n.label)}</span>${c ? `<span class="nav-count ${n.kind}"><span aria-hidden="true">${c}</span><span class="sr-only">, ${c} ${esc(n.what)}</span></span><span class="badge-dot" aria-hidden="true"></span>` : ""}<span class="nav-kbd" aria-hidden="true"><kbd>g</kbd><kbd>${n.key}</kbd></span></a></li>`;
  }
  function renderNav(cur) {
    $("#nav").innerHTML = NAV.map((n) => navItem(n, cur)).join("") + '<li class="nav-sep" role="separator"></li>' + navItem(FOOT[0], cur);
    $("#nav-foot").innerHTML = navItem(FOOT[1], cur);
    const mq = PP.modQueue().length;
    const bn = [["dzisiaj", "Dzisiaj", "today"], ["spolecznosc", "Skrzynka", "inbox", mq], ["tresci", "Treści", "film"], ["przychody", "Przychody", "coins"]];
    $("#bottom-nav").innerHTML = bn.map((b) => `<a href="${b[0] === "spolecznosc" ? href("spolecznosc", { tab: "moderacja" }) : href(b[0])}"${cur === b[0] ? ' aria-current="page"' : ""}>${icon(b[2])}${b[3] ? `<span class="bn-count" aria-hidden="true">${b[3]}</span>` : ""}<span>${b[1]}${b[3] ? `<span class="sr-only">, ${b[3]} do moderacji</span>` : ""}</span></a>`).join("") +
      `<button type="button" id="more-btn" aria-expanded="false" aria-controls="sidebar">${icon("menu")}<span>Więcej</span></button>`;
    $("#more-btn").addEventListener("click", () => toggleDrawer(true));
  }
  function toggleDrawer(open) {
    const app = $("#app");
    const wasOpen = app.classList.contains("nav-open");
    if (!open && !wasOpen) return;
    app.classList.toggle("nav-open", open);
    const mb = $("#more-btn");
    if (mb) mb.setAttribute("aria-expanded", String(open));
    if (open) { const f = $("#sidebar a[aria-current]") || $("#sidebar a"); if (f) f.focus(); }
    else if (mb && window.matchMedia("(max-width: 760px)").matches) mb.focus();
  }
  $("#scrim").addEventListener("click", () => toggleDrawer(false));

  // ---------- Kropka zdrowia ----------
  const HEALTH = { kind: "warn", text: "Uwaga", items: [["warn", "Swap serwera 36% (próg 25%)", "system?tab=serwer"], ["crit", "Email Worker: 47% błędów (7 dni)", "system"], ["warn", "Zadanie sync-public-thumbnails: 1 błąd", "system?tab=zadania"], ["ok", "12 pozostałych kontroli OK", "system"]] };
  function renderHealth() {
    const b = $("#health-btn");
    b.innerHTML = `<span class="health-dot ${HEALTH.kind}" aria-hidden="true"></span><span class="health-text">${HEALTH.text}</span>`;
    b.setAttribute("aria-label", `Zdrowie systemu: ${HEALTH.text}, 1 błąd i 2 ostrzeżenia. Pokaż szczegóły`);
    $("#health-pop").innerHTML = `<div class="row-between" style="margin-bottom:8px"><strong>Stan systemu</strong>${PP.ui.age(PP.host.fetchedAt, 1)}</div><div class="checks">${HEALTH.items.map((i) => `<div class="check ${i[0]}">${icon(i[0])}<div><a href="#/${i[2]}">${esc(i[1])}</a></div><span class="sr-only">${PP.ui.STATE_WORD[i[0]]}</span></div>`).join("")}</div><div style="margin-top:8px"><a class="btn btn-sm" href="${href("system")}">Centrum zdrowia</a></div>`;
  }
  function toggleHealth(open) {
    const pop = $("#health-pop"), b = $("#health-btn");
    if (open === undefined) open = pop.hidden;
    pop.hidden = !open;
    b.setAttribute("aria-expanded", String(open));
    if (open) {
      const r = b.getBoundingClientRect();
      pop.style.top = r.bottom + window.scrollY + 6 + "px";
      pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px";
      const a = pop.querySelector("a"); if (a) a.focus();
    }
  }
  $("#health-btn").addEventListener("click", () => toggleHealth());
  document.addEventListener("click", (e) => { const p = $("#health-pop"); if (!p.hidden && !p.contains(e.target) && !$("#health-btn").contains(e.target)) toggleHealth(false); });

  // ---------- Motyw (domyślnie za systemem) ----------
  function getTheme() { return document.documentElement.getAttribute("data-theme") || "system"; }
  function setTheme(t) {
    if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
    try { if (t === "system") localStorage.removeItem("pp-admin-theme"); else localStorage.setItem("pp-admin-theme", t); } catch (e) { /* bez pamięci przeglądarki działa i tak */ }
    renderThemeBtn();
    main.querySelectorAll("figure.chart .chart-plot").forEach((p) => { p._w = 0; });
    C.mountAll(main);
  }
  const THEME_NEXT = { system: "light", light: "dark", dark: "system" };
  const THEME_NAME = { system: "systemowy", light: "jasny", dark: "ciemny" };
  function renderThemeBtn() {
    const t = getTheme();
    const b = $("#theme-btn");
    b.innerHTML = icon(t === "system" ? "monitor" : t === "light" ? "sun" : "moon", "icon-lg");
    b.setAttribute("aria-label", `Motyw: ${THEME_NAME[t]}. Przełącz na ${THEME_NAME[THEME_NEXT[t]]}`);
    b.title = `Motyw: ${THEME_NAME[t]}`;
  }
  $("#theme-btn").addEventListener("click", () => { setTheme(THEME_NEXT[getTheme()]); toast("ok", "Motyw: " + THEME_NAME[getTheme()], getTheme() === "system" ? "Panel podąża za ustawieniem systemu." : ""); });

  // ---------- Router ----------
  function parse() {
    const h = location.hash.slice(1) || "/dzisiaj";
    const [path, qs] = h.split("?");
    const q = {};
    new URLSearchParams(qs || "").forEach((v, k) => { q[k] = v; });
    return { parts: path.split("/").filter(Boolean), q };
  }
  let first = true, liveTimer = null, lastScreen = null;
  function render() {
    const r = parse();
    if (!PP.screens[r.parts[0]]) { location.replace("#/dzisiaj"); return; }
    S.range = PP.RANGES[r.q.range] ? r.q.range : "28d";
    S.cmp = ["prev", "year", "none"].includes(r.q.cmp) ? r.q.cmp : "prev";
    S.route = r;
    $("#range").value = S.range;
    $("#cmp").value = S.cmp;
    const out = PP.screens[r.parts[0]](r);
    main.innerHTML = out.html + `<p class="foot-note">${icon("info")}Prototyp: wszystkie liczby, osoby i identyfikatory są przykładowe. Stan na niedzielę 4 paź 2026, 14:36 (czas warszawski).</p>`;
    C.mountAll(main);
    C.observe(main);
    renderNav(r.parts[0]);
    document.title = out.title + " · Panel PP (prototyp)";
    clearInterval(liveTimer);
    if (out.live) startLive();
    const screenKey = r.parts.join("/") + "|" + (r.q.tab || "");
    if (S.keepFocus) {
      const el = document.getElementById(S.keepFocus);
      if (el) { el.focus(); if (el.setSelectionRange && el.type !== "number") { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* select */ } } }
      S.keepFocus = null;
    } else if (!first && screenKey !== lastScreen) {
      window.scrollTo(0, 0);
      const h1 = main.querySelector("h1");
      if (h1) h1.focus({ preventScroll: true });
    }
    lastScreen = screenKey;
    first = false;
    toggleDrawer(false);
    if (!$("#health-pop").hidden) toggleHealth(false);
  }
  window.addEventListener("hashchange", render);

  // Globalny filtr czasu (zmienia URL, więc widok da się zapisać i wysłać).
  function setRange(range, cmp) {
    const r = parse();
    const q = Object.assign({}, r.q, { range, cmp });
    if (q.range === "28d") delete q.range;
    if (q.cmp === "prev") delete q.cmp;
    delete q.page;
    const qs = new URLSearchParams(q).toString();
    location.hash = "/" + r.parts.join("/") + (qs ? "?" + qs : "");
  }
  $("#range").addEventListener("change", (e) => { S.keepFocus = "range"; setRange(e.target.value, S.cmp); });
  $("#cmp").addEventListener("change", (e) => { S.keepFocus = "cmp"; setRange(S.range, e.target.value); });
  const RANGE_ORDER = ["today", "24h", "7d", "28d", "90d", "12m"];

  // Filtry list: zmiana pola -> parametr w URL (strona wraca na 1).
  let deb = null;
  main.addEventListener("change", (e) => {
    const el = e.target.closest("[data-param]");
    if (el && el.tagName === "SELECT") { S.keepFocus = el.id; location.hash = withParam({ [el.dataset.param]: el.value, page: "" }).slice(1); }
  });
  main.addEventListener("input", (e) => {
    const el = e.target.closest("input[data-param]");
    if (!el) return;
    clearTimeout(deb);
    deb = setTimeout(() => { S.keepFocus = el.id; location.hash = withParam({ [el.dataset.param]: el.value.trim(), page: "" }).slice(1); }, 250);
  });

  // ---------- Akcje (delegacja) ----------
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const act = a.dataset.action, id = a.dataset.id;
    if (act === "toggle-note") { toast("ok", "Zmiana zapisana", "Prototyp: przełącznik nic nie zapisuje na stałe."); return; }
    if (act === "set-theme") { setTheme(a.value); return; }
    e.preventDefault();
    if (act === "toast") toast("ok", a.dataset.msg.split(":")[0], a.dataset.msg.indexOf(":") > 0 ? a.dataset.msg.slice(a.dataset.msg.indexOf(":") + 1).trim() : "");
    else if (act === "noop") toast("warn", "Nie można opublikować", "Najpierw usuń błędy z listy kontrolnej.");
    else if (act === "sort") { S.keepFocus = null; location.hash = withParam({ sort: a.dataset.sort, page: "" }).slice(1); }
    else if (act === "retry-encode") retryEncode(a.dataset.slug);
    else if (act === "refund") refundFlow(id);
    else if (act === "mod-hide" || act === "mod-keep" || act === "mod-mute") moderate(act, id);
    else if (act === "delete-comment") confirmModal({ title: "Usunąć komentarz?", body: "Usunięcie jest ostateczne. Jeśli chcesz tylko schować komentarz przed widzami, użyj „Ukryj” (można cofnąć).", effect: ["komentarz i odpowiedzi znikną ze strony", "polubienia zostaną usunięte", "wpis COMMENT_DELETED w audycie"], confirm: "Usuń komentarz", danger: true, onConfirm: () => toast("ok", "Komentarz usunięty", "Zapisano w dzienniku audytu.") });
    else if (act === "delete-user") PP.deleteUserFlow(id);
    else if (PP.extraActions && PP.extraActions[act]) PP.extraActions[act](a, id);
    else if (act === "unpublish") confirmModal({ title: `Cofnąć publikację „${a.dataset.title}”?`, body: "Film zniknie ze strony dla widzów i wróci do szkiców.", effect: ["film znika z listy filmów (sidebar)", "jeśli był hero, strona główna zostaje bez hero", "publiczna kopia miniatury zostaje usunięta", "komentarze zostają, ale nie są widoczne"], confirm: "Cofnij publikację", danger: true, onConfirm: () => toast("ok", "Publikacja cofnięta", "Prototyp: dane nie zostały zmienione.") });
    else if (act === "rollback") confirmModal({ title: "Wycofać wdrożenie do m10032104?", body: "Aplikacja wróci do poprzedniego obrazu (ok. 30 s przerwy). Migracje bazy nie są cofane.", confirm: "Wycofaj", danger: true, onConfirm: () => toast("ok", "Wycofywanie zlecone", "deploy.sh --rollback · wynik pojawi się na osi zmian.") });
    else if (act === "reply") replyModal(id);
    else if (act === "note") noteModal();
    else if (act === "export-csv") exportCsv();
    else if (act === "live-pause") { const LIVE = PP.liveSim; LIVE.paused = !LIVE.paused; a.setAttribute("aria-pressed", String(LIVE.paused)); a.querySelector("span").textContent = LIVE.paused ? "Wznów odświeżanie" : "Wstrzymaj odświeżanie"; }
  });

  function retryEncode(slug) {
    const v = PP.videoBySlug[slug];
    if (v) { v.hls = "ENCODING"; v.encodePct = 0; v.encodeStage = "W kolejce (próba 3 z 3, limit pamięci zwiększony)"; }
    const j = PP.jobs.find((x) => x.href.indexOf(slug) > 0);
    if (j) { j.state = "running"; j.detail = "w kolejce · próba 3 z 3"; }
    toast("ok", "Kodowanie zlecone ponownie", `„${v ? v.title : slug}”: próba 3 z 3. Postęp widać w Treściach.`);
    render();
  }

  // Moderacja z cofnięciem.
  function moderate(act, id) {
    const c = PP.comments.find((x) => x.id === id);
    if (!c) return;
    const prev = c.status;
    PP.modDone[id] = true;
    if (act === "mod-hide") c.status = "HIDDEN";
    const msg = act === "mod-hide" ? "Komentarz ukryty" : act === "mod-keep" ? "Zgłoszenie zamknięte, komentarz zostaje" : "Autor wyciszony na 7 dni";
    toast("ok", msg, "Zapisano w audycie.", { label: "Cofnij", run: () => { delete PP.modDone[id]; c.status = prev; render(); toast("ok", "Cofnięto", ""); } });
    render();
    const nextItem = main.querySelector(".mod-item.is-active");
    if (nextItem) nextItem.focus(); else { const h = main.querySelector("h1"); if (h) h.focus(); }
  }

  function replyModal(id) {
    const c = PP.comments.find((x) => x.id === id);
    openModal({
      title: "Odpowiedz jako twórca",
      body: `<blockquote class="effect" style="margin:0">${esc(c.text)}<br><span class="muted">${esc(PP.userById[c.user].nick)} · ${esc(fmt.dt(c.createdAt))}</span></blockquote><div class="field"><label for="reply-text">Twoja odpowiedź</label><textarea class="input" id="reply-text" required autofocus></textarea><span class="hint">Pojawi się pod komentarzem z oznaczeniem „Twórca”.</span></div><label class="switch"><input type="checkbox" checked> Dodaj serduszko do komentarza</label>`,
      foot: `<button type="button" class="btn" data-close>Anuluj</button><button type="submit" class="btn btn-primary">Opublikuj odpowiedź</button>`,
      onOpen(m) {
        m.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const t = m.querySelector("#reply-text");
          if (!t.value.trim()) { showError(t, "Wpisz treść odpowiedzi."); return; }
          closeModal(); toast("ok", "Odpowiedź opublikowana", "");
        });
      }
    });
  }
  function noteModal() {
    openModal({
      title: "Notatka na osi zmian",
      body: `<div class="field"><label for="note-text">Co się wydarzyło?</label><input class="input" id="note-text" type="text" placeholder="np. link na Wykopie, post na X" autofocus></div><div class="field"><label for="note-at">Kiedy</label><input class="input" id="note-at" type="datetime-local" value="2026-10-04T14:36"></div><p class="hint muted" style="font-size:12px">Notatka pojawi się jako adnotacja na wszystkich wykresach z tego okresu.</p>`,
      foot: `<button type="button" class="btn" data-close>Anuluj</button><button type="submit" class="btn btn-primary">Dodaj</button>`,
      onOpen(m) {
        m.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const t = m.querySelector("#note-text");
          if (!t.value.trim()) { showError(t, "Wpisz krótki opis."); return; }
          PP.changes.unshift({ at: PP.now, kind: "note", label: t.value.trim().slice(0, 60), detail: "notatka właściciela" });
          closeModal(); toast("ok", "Notatka dodana", "Widoczna na osi zmian i wykresach."); render();
        });
      }
    });
  }
  function showError(input, text) {
    input.setAttribute("aria-invalid", "true");
    let err = input.parentElement.querySelector(".error");
    if (!err) { err = document.createElement("span"); err.className = "error"; err.id = input.id + "-err"; input.parentElement.appendChild(err); }
    err.innerHTML = icon("warn") + "<span></span>";
    err.querySelector("span").textContent = text;
    input.setAttribute("aria-describedby", err.id);
    input.focus();
  }

  // ---------- Zwrot płatności: skutek → ponowne uwierzytelnienie → wykonanie ----------
  function refundFlow(id) {
    const p = PP.payments.find((x) => x.id === id);
    if (!p) return;
    const u = PP.userById[p.user];
    const max = p.amount - p.refunded;
    const steps = (n) => `<ol class="modal-steps" aria-label="Kroki">${["Szczegóły", "Potwierdzenie tożsamości"].map((s, i) => `<li style="list-style:none"${i === n ? ' aria-current="step"' : ""}>${i + 1}. ${s}</li>`).join("")}</ol>`;
    const key = "rf_" + p.id.slice(-8) + "_" + Date.now().toString(36);
    openModal({
      title: "Zwrot płatności",
      steps: steps(0),
      body: `<dl class="kv"><dt>Płatność</dt><dd><strong>${fmt.money(p.amount, p.currency)}</strong> · ${esc(p.method)} · ${esc(fmt.dt(p.createdAt))}</dd><dt>Osoba</dt><dd>${esc(u.nick)} (${esc(u.email)})</dd><dt>ID Stripe</dt><dd class="mono">${esc(p.id)}</dd>${p.refunded ? `<dt>Już zwrócono</dt><dd>${fmt.money(p.refunded, p.currency)}</dd>` : ""}</dl>
        <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field-label">Kwota zwrotu</legend>
          <label class="choice"><input type="radio" name="kind" value="full" checked> Całość: ${fmt.money(max, p.currency)}</label>
          <label class="choice"><input type="radio" name="kind" value="part"> Część</label>
          <div class="field" id="part-wrap" hidden><label for="rf-amount">Kwota (${esc(p.currency)})</label><input class="input" id="rf-amount" type="text" inputmode="decimal" placeholder="np. 10,00" aria-describedby="rf-amount-hint"><span class="hint" id="rf-amount-hint">Maksymalnie ${fmt.money(max, p.currency)}.</span></div>
        </fieldset>
        <div class="field"><label for="rf-reason">Powód (wymagany, trafia do audytu)</label><select class="select" id="rf-reason" required><option value="">Wybierz powód…</option><option>Prośba wspierającego</option><option>Pomyłka w kwocie</option><option>Podwójna płatność</option><option>Podejrzenie oszustwa</option></select></div>
        <div class="effect"><strong>Skutek</strong><ul><li>Stripe odda pieniądze na ${esc(p.method === "BLIK" ? "konto bankowe" : "kartę lub konto")} w 5–10 dni.</li><li>Opłata Stripe (${fmt.money(p.fee, p.currency)}) nie wraca.</li><li>Operacja jest nieodwracalna; znacznik wspierającego zostaje.</li><li>Klucz idempotencji <span class="mono">${esc(key)}</span>: drugie kliknięcie nie zrobi drugiego zwrotu.</li></ul></div>`,
      foot: `<button type="button" class="btn" data-close>Anuluj</button><button type="submit" class="btn btn-primary">Dalej: potwierdź tożsamość</button>`,
      onOpen(m) {
        m.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener("change", () => { m.querySelector("#part-wrap").hidden = r.value !== "part" || !r.checked; }));
        m.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const reason = m.querySelector("#rf-reason");
          const part = m.querySelector('input[name="kind"]:checked').value === "part";
          let amount = max;
          if (part) {
            const inp = m.querySelector("#rf-amount");
            const v = Math.round(parseFloat(inp.value.replace(",", ".")) * 100);
            if (!v || v <= 0 || v > max) { showError(inp, `Podaj kwotę od 0,01 do ${fmt.money(max, p.currency)}.`); return; }
            amount = v;
          }
          if (!reason.value) { showError(reason, "Wybierz powód zwrotu."); return; }
          stepUp(p, amount, reason.value, key);
        });
      }
    });
    function stepUp(pay, amount, reason, k) {
      openModal({
        title: "Potwierdź tożsamość",
        steps: steps(1),
        body: `<p>Zwrot <strong>${fmt.money(amount, pay.currency)}</strong> dla ${esc(u.nick)} wymaga ponownego uwierzytelnienia. Potwierdzenie jest ważne 5 minut.</p>
          <div class="passkey-box">${icon("passkey")}<div style="flex:1"><strong>Klucz dostępu (passkey)</strong><div class="muted">Windows Hello, Face ID lub klucz sprzętowy</div></div><button type="button" class="btn btn-primary" id="pk-btn">Użyj klucza</button></div>
          <div class="field"><span class="field-label" id="otp-label">albo kod z aplikacji (TOTP)</span><div class="otp" role="group" aria-labelledby="otp-label">${[1, 2, 3, 4, 5, 6].map((i) => `<input class="input" inputmode="numeric" aria-label="Cyfra ${i} z 6" autocomplete="${i === 1 ? "one-time-code" : "off"}">`).join("")}</div><span class="hint">Prototyp: dowolne 6 cyfr poza 000000.</span></div>
          <p class="muted" id="su-status" role="status"></p>`,
        foot: `<button type="button" class="btn" data-close>Anuluj</button><button type="submit" class="btn btn-danger" id="do-refund" aria-disabled="true">Zwróć ${fmt.money(amount, pay.currency)}</button>`,
        onOpen(m) {
          let ok = false;
          const btn = m.querySelector("#do-refund"), st = m.querySelector("#su-status");
          const verified = (how) => { ok = true; btn.removeAttribute("aria-disabled"); st.innerHTML = state("ok", "Tożsamość potwierdzona (" + how + ")"); btn.focus(); };
          m.querySelector("#pk-btn").addEventListener("click", (e) => { e.currentTarget.textContent = "Dotknij klucza…"; setTimeout(() => verified("passkey"), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700); });
          const boxes = Array.from(m.querySelectorAll(".otp input"));
          boxes.forEach((b, i) => {
            b.addEventListener("input", () => {
              const digits = b.value.replace(/\D/g, "");
              // Kilka cyfr naraz (szybkie pisanie, autouzupełnienie kodu SMS/TOTP): rozkładamy na kolejne pola.
              if (digits.length > 1) { digits.split("").slice(0, 6 - i).forEach((d, j) => { boxes[i + j].value = d; }); const nx = boxes[Math.min(5, i + digits.length)]; if (nx) nx.focus(); }
              else { b.value = digits; if (b.value && boxes[i + 1]) boxes[i + 1].focus(); }
              const code = boxes.map((x) => x.value).join("");
              if (code.length === 6) { if (code === "000000") { st.innerHTML = `<span class="state crit">${icon("crit")}Nieprawidłowy kod. Spróbuj ponownie.</span>`; boxes.forEach((x) => { x.value = ""; x.setAttribute("aria-invalid", "true"); }); boxes[0].focus(); } else verified("TOTP"); }
            });
            b.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
            b.addEventListener("paste", (e) => { const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (t.length === 6) { e.preventDefault(); boxes.forEach((x, j) => { x.value = t[j]; }); boxes[5].dispatchEvent(new Event("input")); } });
          });
          m.querySelector("form").addEventListener("submit", (e) => {
            e.preventDefault();
            if (!ok) { st.innerHTML = `<span class="state warn">${icon("warn")}Najpierw potwierdź tożsamość kluczem albo kodem.</span>`; return; }
            pay.refunded += amount;
            pay.status = pay.refunded >= pay.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
            PP.audit.unshift({ id: "al" + Date.now(), at: PP.now, code: "PAYMENT_REFUNDED", label: "Zwrot płatności", actorType: "admin", actor: "Paweł (admin)", target: "Płatność", targetId: pay.id.slice(0, 12) + "…", ip: "83.24.x.x (PL)", requestId: k });
            closeModal();
            toast("ok", "Zwrot zlecony: " + fmt.money(amount, pay.currency), `${reason} · Stripe potwierdzi webhookiem. Wpis w dzienniku audytu.`);
            render();
          });
        }
      });
    }
  }

  function exportCsv() {
    const rows = [["data", "osoba", "kwota", "waluta", "metoda", "status", "id"]].concat(PP.payments.map((p) => [p.createdAt.toISOString(), PP.userById[p.user].nick, (p.amount / 100).toFixed(2), p.currency, p.method, p.status, p.id]));
    // Ochrona przed wstrzyknięciem formuł (OWASP CSV Injection): pola zaczynające się od = + - @ \t \r dostają apostrof.
    const cell = (v) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wplaty-przykladowe.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("ok", "Eksport gotowy", "wplaty-przykladowe.csv · " + PP.payments.length + " wierszy (dane przykładowe).");
  }

  // ---------- Tryb premiery: symulacja co 5 s, z pauzą (WCAG 2.2.2) ----------
  function startLive() {
    const L = PP.liveSim;
    liveTimer = setInterval(() => {
      if (L.paused || document.hidden) return;
      L.t += 5;
      const last = L.viewers[L.viewers.length - 1];
      const nv = Math.max(20, Math.round(last + (PP.rand() - 0.45) * 8));
      L.viewers[L.viewers.length - 1] = nv;
      if (L.t % 60 < 5) { L.viewers.push(nv); L.errors.push(PP.rand() > 0.85 ? 1 : 0); }
      L.workerPerMin = Math.round(2100 + (PP.rand() - 0.5) * 160);
      const set = (k, v) => { const el = main.querySelector(`[data-live="${k}"]`); if (el) el.textContent = v; };
      set("clock", "T+" + fmt.dur(L.t));
      set("viewers", String(nv));
      set("errors", String(L.errors[L.errors.length - 1]));
      set("cpu", Math.round(34 + PP.rand() * 9) + "%");
      set("startup", fmt.one(1.6 + PP.rand() * 0.4) + " s");
      const spec = C.specs["live-chart"];
      if (spec) {
        spec.labels = L.viewers.map((_, i) => "T+" + i + " min");
        spec.series[0].values = L.viewers.slice();
        const fig = main.querySelector('figure[data-chart="live-chart"]');
        if (fig) { const plot = fig.querySelector(".chart-plot"); if (plot.contains(document.activeElement)) return; plot._w = 0; C.draw(fig); }
      }
    }, 5000);
  }

  // ---------- Paleta poleceń ----------
  const pal = $("#palette"), palQ = $("#palette-q"), palList = $("#palette-list");
  let palItems = [], palSel = 0;
  function commands() {
    const r = S.route || { parts: [] };
    const list = [];
    if (r.parts[0] === "tresci" && r.parts[1]) {
      const v = PP.videoBySlug[r.parts[1]];
      if (v) {
        list.push({ g: "Na tym filmie", label: "Przekoduj „" + v.title + "”", icon: "refresh", run: () => retryEncode(v.slug) });
        list.push({ g: "Na tym filmie", label: "Podgląd jako widz", icon: "eye", run: () => toast("ok", "Podgląd jako widz", "Tryb tylko do odczytu z banerem.") });
      }
    }
    ALL.forEach((n) => list.push({ g: "Przejdź", label: n.label, icon: n.icon, kbd: ["g", n.key], run: () => { location.hash = href(n.id).slice(1); } }));
    [
      ["Moderuj zgłoszenia", "flag", () => { location.hash = href("spolecznosc", { tab: "moderacja" }).slice(1); }, "kolejka komentarze spam"],
      ["Nowy film (wgraj oryginał)", "upload", () => { location.hash = href("tresci/nowy").slice(1); }, "dodaj upload film"],
      ["Układ kanału (kolejność, hero)", "film", () => { location.hash = href("tresci", { widok: "uklad" }).slice(1); }, "sidebar kolejnosc hero"],
      ["Nowa rozsyłka e-mail", "mail", () => { location.hash = href("komunikacja", { tab: "rozsylki", nowa: "1" }).slice(1); }, "newsletter broadcast"],
      ["Ustawienia kanału", "settings", () => { location.hash = href("ustawienia", { tab: "kanal" }).slice(1); }, "nazwa opis baner miniatura"],
      ["Ustawienia płatności (minimalne kwoty)", "coins", () => { location.hash = href("ustawienia", { tab: "platnosci" }).slice(1); }, "napiwek minimum waluty"],
      ["Zwróć płatność…", "coins", () => { location.hash = href("przychody", { tab: "wplaty" }).slice(1); toast("ok", "Wybierz wpłatę", "Przycisk „Zwrot…” przy wierszu."); }, "refund zwrot pieniadze"],
      ["Ponów nieudane kodowanie „Test kodowania 4K”", "refresh", () => retryEncode("test-kodowania-4k"), "encode ffmpeg"],
      ["Dodaj notatkę na osi zmian", "note", noteModal, "adnotacja wykres"],
      ["Eksport wpłat do CSV", "download", exportCsv, "ksiegowosc"],
      ["Włącz tryb premiery", "live", () => { location.hash = href("premiera").slice(1); }, "live monitor"],
      ["Odpowiedz na spór (termin 8 paź)", "coins", () => { location.hash = href("przychody", { tab: "spory" }).slice(1); }, "dispute"],
      ["Przełącz motyw", "sun", () => $("#theme-btn").click(), "ciemny jasny dark"],
      ["Pokaż wszystkie skróty", "command", shortcutsModal, "klawisze pomoc"],
      ["Okres: ostatnie 7 dni", "calendar", () => setRange("7d", S.cmp), "zakres czas"],
      ["Okres: dziś", "calendar", () => setRange("today", S.cmp), "zakres czas"]
    ].forEach((x) => list.push({ g: "Akcje", label: x[0], icon: x[1], run: x[2], kw: x[3] }));
    PP.videos.forEach((v) => list.push({ g: "Filmy", label: v.title, hint: v.slug, icon: "film", run: () => { location.hash = href("tresci/" + v.slug).slice(1); } }));
    PP.users.forEach((u) => list.push({ g: "Osoby", label: u.nick, hint: u.email, icon: "users", run: () => { location.hash = href("spolecznosc/u/" + u.id).slice(1); } }));
    PP.payments.slice(0, 40).forEach((p) => list.push({ g: "Płatności", label: fmt.money(p.amount, p.currency) + " · " + PP.userById[p.user].nick, hint: p.id.slice(0, 14) + "…", kw: p.id, icon: "coins", run: () => { location.hash = href("przychody", { tab: "wplaty", q: p.id }).slice(1); } }));
    return list;
  }
  function hl(text, q) {
    if (!q) return esc(text);
    const i = norm(text).indexOf(norm(q.split(/\s+/)[0]));
    if (i < 0) return esc(text);
    const n = q.split(/\s+/)[0].length;
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + n)) + "</mark>" + esc(text.slice(i + n));
  }
  function renderPalette() {
    const q = palQ.value.trim();
    const toks = norm(q).split(/\s+/).filter(Boolean);
    let all = commands();
    if (toks.length) all = all.filter((c) => { const h = norm(c.label + " " + (c.hint || "") + " " + (c.kw || "") + " " + c.g); return toks.every((t) => h.includes(t)); });
    else all = all.filter((c) => c.g !== "Osoby" && c.g !== "Płatności" && c.g !== "Filmy").concat(all.filter((c) => c.g === "Filmy").slice(0, 4));
    palItems = all.slice(0, 40);
    palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    let g = "", html = "";
    palItems.forEach((c, i) => {
      if (c.g !== g) { g = c.g; html += `<li class="palette-group" role="presentation">${esc(g)}</li>`; }
      html += `<li class="palette-item" role="option" id="pi-${i}" aria-selected="${i === palSel}" data-i="${i}">${icon(c.icon)}<span class="pi-label">${hl(c.label, q)}</span>${c.hint ? `<span class="pi-hint">${esc(c.hint)}</span>` : ""}${c.kbd ? `<span class="pi-hint">${c.kbd.map((k) => `<kbd>${esc(k)}</kbd>`).join(" ")}</span>` : ""}</li>`;
    });
    palList.innerHTML = html || `<li class="empty" role="presentation">${icon("search")}<span>Nic nie pasuje do „${esc(q)}”.</span></li>`;
    palQ.setAttribute("aria-activedescendant", palItems.length ? "pi-" + palSel : "");
    const sel = palList.querySelector('[aria-selected="true"]');
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }
  function openPalette() {
    if (pal.open) return;
    if ($("#modal").open) closeModal();
    palQ.value = ""; palSel = 0; renderPalette();
    pal.showModal(); palQ.focus();
  }
  function runPal(i) { const c = palItems[i]; if (!c) return; pal.close(); setTimeout(() => c.run(), 0); }
  palQ.addEventListener("input", () => { palSel = 0; renderPalette(); });
  palQ.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); renderPalette(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(0, palSel - 1); renderPalette(); }
    else if (e.key === "Enter") { e.preventDefault(); runPal(palSel); }
  });
  palList.addEventListener("click", (e) => { const it = e.target.closest(".palette-item"); if (it) runPal(+it.dataset.i); });
  pal.addEventListener("click", (e) => { if (e.target === pal) pal.close(); });
  $("#open-palette").addEventListener("click", openPalette);

  function shortcutsModal() {
    const rows = [["Ctrl K / ⌘ K", "Paleta poleceń: szukaj i wykonuj"], ["?", "Ta lista"], ["g, potem litera", "Przejdź: d Dzisiaj, a Analityka, t Treści, s Społeczność, p Przychody, k Komunikacja, y System, b Bezpieczeństwo, l Premiera, , Ustawienia"], ["/", "Szukaj na liście"], ["[ / ]", "Krótszy / dłuższy okres"], ["j / k", "Moderacja: następny / poprzedni"], ["h / z / w", "Moderacja: ukryj / zostaw / wycisz autora"], ["← / →", "Na wykresie (po fokusie): wartości punkt po punkcie"], ["Esc", "Zamknij okno lub paletę"]];
    openModal({ title: "Skróty klawiszowe", body: `<table class="table table-compact"><caption class="sr-only">Skróty klawiszowe</caption><tbody>${rows.map((r) => `<tr><th scope="row" style="white-space:nowrap">${r[0].split(" ").map((k) => (k === "/" || k === "potem" || k === "litera" || k === "," ? esc(k) : `<kbd>${esc(k)}</kbd>`)).join(" ")}</th><td style="white-space:normal">${esc(r[1])}</td></tr>`).join("")}</tbody></table>`, foot: `<button type="button" class="btn btn-primary" data-close>Zamknij</button>` });
  }

  // ---------- Skróty klawiszowe ----------
  let gPending = 0;
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); openPalette(); return; }
    if (e.key === "Escape") { if ($("#app").classList.contains("nav-open")) toggleDrawer(false); if (!$("#health-pop").hidden) { toggleHealth(false); $("#health-btn").focus(); } return; }
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t.closest && (t.closest("input, textarea, select, [contenteditable]") || t.closest("dialog[open]"))) return;
    if (document.querySelector("dialog[open]")) return;
    const k = e.key;
    if (gPending && Date.now() - gPending < 1200) {
      gPending = 0;
      const n = ALL.find((x) => x.key === k.toLowerCase());
      if (n) { e.preventDefault(); location.hash = href(n.id).slice(1); }
      return;
    }
    if (k === "g") { gPending = Date.now(); return; }
    if (k === "?") { e.preventDefault(); shortcutsModal(); return; }
    if (k === "/") { const f = main.querySelector(".filters input"); if (f) { e.preventDefault(); f.focus(); } return; }
    if (k === "[" || k === "]") { const i = RANGE_ORDER.indexOf(S.range) + (k === "]" ? 1 : -1); if (i >= 0 && i < RANGE_ORDER.length) { setRange(RANGE_ORDER[i], S.cmp); toast("ok", "Okres: " + PP.RANGES[RANGE_ORDER[i]].label, ""); } return; }
    // Moderacja klawiszami.
    if (S.route && S.route.parts[0] === "spolecznosc" && (S.route.q.tab || "moderacja") === "moderacja" && !S.route.parts[1]) {
      const items = Array.from(main.querySelectorAll(".mod-item"));
      if (!items.length) return;
      let i = items.findIndex((x) => x.classList.contains("is-active"));
      if (k === "j" || k === "k") {
        e.preventDefault();
        i = Math.max(0, Math.min(items.length - 1, i + (k === "j" ? 1 : -1)));
        S.modIdx = i;
        items.forEach((x, j) => x.classList.toggle("is-active", j === i));
        items[i].focus();
      } else if (k === "h" || k === "z" || k === "w") {
        e.preventDefault();
        moderate(k === "h" ? "mod-hide" : k === "z" ? "mod-keep" : "mod-mute", items[Math.max(0, i)].dataset.mod);
      }
    }
  });

  // ---------- Start ----------
  renderHealth();
  renderThemeBtn();
  render();
})();
