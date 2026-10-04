/* Prototyp panelu admina pawelperfect.com: DANE PRZYKŁADOWE.
 * Wszystkie liczby, osoby, adresy e-mail i identyfikatory są zmyślone i deterministyczne
 * (stałe ziarno generatora), żeby prototyp wyglądał tak samo przy każdym otwarciu.
 * Nic tutaj nie pochodzi z produkcji. */
(function () {
  "use strict";
  var PP = (window.PP = window.PP || {});

  // Stały "teraz" prototypu: niedziela 4 października 2026, 14:36 czasu warszawskiego.
  PP.now = new Date("2026-10-04T12:36:00Z");
  PP.TZ = "Europe/Warsaw";

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261004);
  function ri(a, b) { return Math.floor(a + rnd() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  PP.rand = rnd;

  var DAY = 86400000;
  PP.DAY = DAY;
  function daysAgo(n, h, m) {
    var d = new Date(PP.now.getTime() - n * DAY);
    if (h !== undefined) { d.setUTCHours(h - 2, m || 0, 0, 0); }
    return d;
  }
  PP.daysAgo = daysAgo;

  // ---------- Oś zmian (adnotacje na wykresach) ----------
  PP.changes = [
    { at: daysAgo(0, 9, 41), kind: "deploy", label: "Wdrożenie m10040944", detail: "obraz polutek-app:m10040944 · 6 zmian" },
    { at: daysAgo(1, 21, 5), kind: "deploy", label: "Wdrożenie m10032104", detail: "poprawki bramki napiwkowej" },
    { at: daysAgo(2, 18, 0), kind: "publish", label: "Publikacja „Dla patronów”", detail: "zmiana poziomu na Zalogowani" },
    { at: daysAgo(3, 10, 12), kind: "incident", label: "Migracja na serwerek", detail: "przełączenie DNS, 4 min niedostępności" },
    { at: daysAgo(8, 19, 30), kind: "broadcast", label: "Rozsyłka „Nowy odcinek”", detail: "31 odbiorców, 58% otwarć" },
    { at: daysAgo(12, 20, 0), kind: "publish", label: "Premiera „JJ”", detail: "premiera o 20:00" },
    { at: daysAgo(16, 11, 0), kind: "note", label: "Link na Wykopie", detail: "notatka właściciela" },
    { at: daysAgo(22, 20, 0), kind: "publish", label: "Premiera „Cześć”", detail: "pierwszy film kanału" },
    { at: daysAgo(40, 12, 0), kind: "deploy", label: "Wdrożenie m09241200", detail: "nowy odtwarzacz HLS" },
    { at: daysAgo(70, 12, 0), kind: "note", label: "Start testów zamkniętych", detail: "notatka właściciela" }
  ];

  // ---------- Szeregi dzienne (2 lata wstecz, do porównań z rokiem wcześniej) ----------
  var N = 760;
  function daily(base, noise, growth, weekly, spikes) {
    var out = [];
    for (var i = N - 1; i >= 0; i--) {
      var t = (N - 1 - i) / (N - 1);
      var d = new Date(PP.now.getTime() - i * DAY);
      var dow = d.getUTCDay();
      var w = dow === 0 || dow === 6 ? 1 + weekly : 1 - weekly / 2;
      var v = base * (0.25 + 0.75 * Math.pow(t, growth)) * w * (1 + (rnd() - 0.5) * noise);
      (spikes || []).forEach(function (s) {
        if (i === s[0]) v *= s[1];
        if (i === s[0] - 1) v *= 1 + (s[1] - 1) * 0.45;
        if (i === s[0] - 2) v *= 1 + (s[1] - 1) * 0.2;
      });
      out.push(Math.max(0, v));
    }
    return out;
  }
  var spikes = [[22, 3.2], [12, 2.6], [2, 1.7], [8, 1.5], [16, 1.9]];
  PP.dailyStart = new Date(PP.now.getTime() - (N - 1) * DAY);
  PP.daily = {
    visitors: daily(310, 0.28, 2.2, 0.18, spikes),
    pageviews: null,
    views: daily(205, 0.3, 2.3, 0.2, spikes),
    watchH: daily(46, 0.3, 2.3, 0.2, spikes),
    signups: daily(4.2, 0.9, 2.0, 0.1, spikes),
    comments: daily(5.5, 0.9, 2.2, 0.15, spikes),
    tipsCount: daily(0.9, 1.4, 2.0, 0.1, spikes),
    tipsPln: null
  };
  PP.daily.pageviews = PP.daily.visitors.map(function (v) { return v * (2.6 + rnd() * 0.5); });
  PP.daily.tipsPln = PP.daily.tipsCount.map(function (v) { return v * (22 + rnd() * 18); });
  PP.daily.bounce = PP.daily.visitors.map(function () { return 0.38 + rnd() * 0.12; });
  PP.daily.visitMin = PP.daily.visitors.map(function () { return 3.1 + rnd() * 1.6; });
  // Dziś: wartości tylko do 14:36 (ok. 61% doby) – porównanie "do tej samej pory".
  ["visitors", "pageviews", "views", "watchH", "signups", "comments", "tipsCount", "tipsPln"].forEach(function (k) {
    var a = PP.daily[k]; a[a.length - 1] *= 0.61;
  });

  // Godzinowe dla trybów "Dziś" i "24 h" (48 godzin wstecz).
  PP.hourly = {};
  ["visitors", "views", "watchH", "signups", "comments", "tipsCount", "tipsPln", "pageviews"].forEach(function (k) {
    var arr = [];
    for (var h = 47; h >= 0; h--) {
      var local = (14 - h + 48 * 3) % 24;
      var shape = 0.25 + Math.max(0, Math.sin(((local - 7) / 24) * Math.PI * 2 - 0.2)) * 1.2 + (local >= 19 && local <= 22 ? 0.6 : 0);
      var dayIdx = PP.daily[k].length - 1 - (h >= 15 ? 1 : 0);
      arr.push((PP.daily[k][dayIdx] / 14) * shape * (0.8 + rnd() * 0.4));
    }
    PP.hourly[k] = arr;
  });

  // ---------- Filmy ----------
  var titles = [
    ["czesc", "Cześć", "PUBLISHED", 22, "PUBLIC"],
    ["jj", "JJ", "PUBLISHED", 12, "LOGGED_IN"],
    ["dla-patronow", "Dla patronów", "PUBLISHED", 2, "PATRON"],
    ["kulisy", "Kulisy premiery", "PREMIERE", -2, "PUBLIC"],
    ["jak-powstaje-odcinek", "Jak powstaje odcinek", "DRAFT", null, "PUBLIC"],
    ["qa-1", "Pytania od widzów #1", "DRAFT", null, "LOGGED_IN"],
    ["wywiad-z-montazysta", "Wywiad z montażystą", "PUBLISHED", 31, "PUBLIC"],
    ["zwiastun-sezonu", "Zwiastun sezonu", "PUBLISHED", 45, "PUBLIC"],
    ["stary-pilot", "Stary pilot (2025)", "ARCHIVED", 210, "PUBLIC"],
    ["test-kodowania-4k", "Test kodowania 4K", "DRAFT", null, "PATRON"]
  ];
  var extra = ["Nocna jazda", "Studio od kuchni", "Dzień z życia", "Lista sprzętu", "Rozmowa o muzyce", "Szkic scenariusza",
    "Plener w górach", "Odcinek specjalny", "Krótki film o ciszy", "Making of", "Podsumowanie miesiąca", "Lato 2026",
    "Pierwsze ujęcie", "Za kadrem", "Próba dźwięku", "Ujęcia odrzucone", "List do widzów", "Wieczór premier"];
  extra.forEach(function (t, i) {
    var st = i % 7 === 3 ? "ARCHIVED" : i % 5 === 1 ? "DRAFT" : "PUBLISHED";
    titles.push([t.toLowerCase().replace(/ /g, "-").replace(/[ąćęłńóśźż]/g, function (c) { return { "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z" }[c]; }),
      t, st, st === "DRAFT" ? null : 50 + i * 9, pick(["PUBLIC", "PUBLIC", "LOGGED_IN", "PATRON"])]);
  });
  PP.videos = titles.map(function (r, i) {
    var published = r[2] === "PUBLISHED" || r[2] === "PREMIERE" || r[2] === "ARCHIVED";
    var hls = "READY";
    if (r[0] === "qa-1") hls = "ENCODING";
    if (r[0] === "test-kodowania-4k") hls = "FAILED";
    if (r[0] === "jak-powstaje-odcinek") hls = "NONE";
    var views = r[2] === "PUBLISHED" ? Math.round(3600 / (1 + i * 0.35) + rnd() * 200) : r[2] === "ARCHIVED" ? ri(40, 400) : 0;
    return {
      id: "v" + (i + 1), slug: r[0], title: r[1],
      status: r[2] === "PREMIERE" ? "PUBLISHED" : r[2],
      premiereAt: r[2] === "PREMIERE" ? new Date("2026-10-06T18:00:00Z") : r[0] === "jj" ? daysAgo(12, 20, 0) : r[0] === "czesc" ? daysAgo(22, 20, 0) : null,
      publishedAt: r[3] === null ? null : r[3] < 0 ? daysAgo(1, 12, 0) : daysAgo(r[3], 20, 0),
      tier: r[4],
      hls: hls, encodePct: hls === "ENCODING" ? 62 : null,
      encodeStage: hls === "ENCODING" ? "Kodowanie 720p (3 z 5 rendycji)" : null,
      thumb: r[0] === "jak-powstaje-odcinek" ? "DEFAULT" : r[0] === "wywiad-z-montazysta" ? "NOT_SYNCED" : "OK",
      subsPl: i % 3 !== 2, subsEn: i % 4 === 0,
      sidebar: r[2] === "PUBLISHED" || r[2] === "PREMIERE",
      hero: r[0] === "kulisy",
      durationS: ri(240, 2400),
      views: views, views7: Math.round(views * (i < 4 ? 0.3 : 0.06)),
      watchH: Math.round(views * (0.12 + rnd() * 0.2)),
      avgPct: r[2] === "PUBLISHED" ? ri(38, 74) : null,
      comments: r[2] === "PUBLISHED" ? ri(0, 9) : 0,
      tips: r[2] === "PUBLISHED" ? ri(0, 12) : 0
    };
  });
  PP.videoBySlug = {};
  PP.videos.forEach(function (v) { PP.videoBySlug[v.slug] = v; });
  PP.videoBySlug.czesc.views = 3412; PP.videoBySlug.czesc.watchH = 1020; PP.videoBySlug.czesc.avgPct = 64;
  PP.videoBySlug.czesc.durationS = 1904; PP.videoBySlug.czesc.tips = 12; PP.videoBySlug.czesc.comments = 9;

  // ---------- Użytkownicy ----------
  var nicks = ["ola_k", "kamil.m", "zuzia", "Bartek87", "majka", "PiotrW", "nocny_widz", "Ania_S", "tomasz", "kasia.r",
    "michal_b", "Ewelina", "kuba2001", "Lena", "Wojtek_K", "marta.z", "filmowy_janek", "agnieszka", "Szymon", "dorota_p",
    "radek", "Natalia", "igor.t", "monika", "Patryk", "weronika_l", "adam", "Julka", "Karol_D", "beata",
    "Mateusz", "iza_w", "Krzysiek", "ola2", "pawel_test", "Hubert", "Magda", "Dawid", "Emilka", "Rafał"];
  var countries = ["PL", "PL", "PL", "PL", "PL", "PL", "DE", "GB", "NL", "US", "IE", "NO"];
  var sources = ["bezpośrednie", "x.com", "wykop.pl", "e-mail", "google", "discord", "youtube.com", "facebook.com"];
  PP.users = nicks.map(function (n, i) {
    var created = daysAgo(ri(0, 95), ri(7, 23), ri(0, 59));
    return {
      id: "u" + (i + 1), nick: n, email: n.toLowerCase().replace(/[^a-z0-9]/g, "") + "@example.com",
      createdAt: created, verified: i % 9 !== 4, google: i % 3 === 0, twoFA: i % 11 === 2,
      lastSeen: new Date(Math.min(PP.now.getTime(), created.getTime() + ri(0, 30) * DAY + ri(0, 20) * 3600000)),
      country: pick(countries), source: pick(sources), sessions: ri(1, 3),
      comments: ri(0, 14), tipsTotal: 0, tipsCount: 0,
      status: i === 18 ? "muted" : i === 33 ? "deleted" : "active",
      watchH: Math.round(rnd() * 40 * 10) / 10, language: i % 6 === 5 ? "en" : "pl"
    };
  });
  PP.userById = {};
  PP.users.forEach(function (u) { PP.userById[u.id] = u; });
  PP.users[0].createdAt = daysAgo(21, 20, 14); PP.users[0].lastSeen = daysAgo(0, 13, 52);
  PP.users[0].twoFA = false; PP.users[0].google = true; PP.users[0].country = "PL"; PP.users[0].source = "x.com";

  // ---------- Wpłaty (napiwki) ----------
  var methods = ["BLIK", "BLIK", "BLIK", "Przelewy24", "Karta", "Karta", "Apple Pay", "Google Pay"];
  var amounts = [500, 1000, 1000, 2000, 2000, 2000, 5000, 1500, 3000, 10000, 2500];
  function pid() { var s = "pi_3Q"; var a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; for (var i = 0; i < 18; i++) s += a[ri(0, a.length - 1)]; return s; }
  PP.payments = [];
  for (var p = 0; p < 74; p++) {
    var u = PP.users[ri(0, 29)];
    var cur = p % 13 === 5 ? "EUR" : p % 17 === 3 ? "USD" : "PLN";
    var amt = pick(amounts);
    if (cur !== "PLN") amt = Math.round(amt / 400) * 100;
    var st = p % 23 === 7 ? "REFUNDED" : p % 19 === 4 ? "FAILED" : p % 29 === 11 ? "PARTIALLY_REFUNDED" : p === 9 ? "DISPUTED" : p === 2 ? "PENDING" : "SUCCEEDED";
    var at = p === 0 ? daysAgo(0, 13, 52) : daysAgo(Math.floor(p * 0.95 + rnd() * 1.2), ri(8, 23), ri(0, 59));
    PP.payments.push({
      id: pid(), user: u.id, amount: amt, currency: cur, method: pick(methods), status: st, createdAt: at,
      fee: Math.round(amt * 0.017 + (cur === "PLN" ? 100 : 25)),
      video: pick(["czesc", "jj", "dla-patronow", "kulisy", null]), country: u.country,
      refunded: st === "REFUNDED" ? amt : st === "PARTIALLY_REFUNDED" ? Math.round(amt / 2) : 0
    });
    if (st === "SUCCEEDED" || st === "PARTIALLY_REFUNDED") { u.tipsTotal += amt; u.tipsCount++; }
  }
  PP.payments[0].amount = 2000; PP.payments[0].method = "BLIK"; PP.payments[0].user = "u1"; PP.payments[0].currency = "PLN"; PP.payments[0].status = "SUCCEEDED"; PP.payments[0].video = "kulisy";
  PP.payments.sort(function (a, b) { return b.createdAt - a.createdAt; });
  PP.dispute = { payment: PP.payments.filter(function (x) { return x.status === "DISPUTED"; })[0], reason: "Nieuznana transakcja (fraudulent)", dueBy: new Date("2026-10-08T21:59:00Z"), amount: 5000 };
  PP.stripeHealth = {
    lastEventAt: daysAgo(0, 13, 52), lastEventType: "payment_intent.succeeded", lagS: 1.4,
    failed: 0, processing: 0, pendingWebhooks: 0, reconciliationLast: daysAgo(0, 14, 30), stuckPending: 1,
    balance: { available: 41280, pending: 12850, nextPayout: new Date("2026-10-06T00:00:00Z") }, fetchedAt: daysAgo(0, 14, 32)
  };

  // ---------- Komentarze i zgłoszenia ----------
  var texts = ["Świetny montaż, szczególnie końcówka!", "Kiedy następny odcinek?", "Dźwięk w 12:40 trochę za cichy.",
    "Oglądam trzeci raz :)", "Czy będą napisy po angielsku?", "Kup teraz tanie zegarki >>> link w profilu",
    "Super klimat, dzięki za ten film.", "Mam pytanie o sprzęt, czym kręcone?", "Najlepszy kanał w polskim internecie",
    "Nie działa mi odtwarzanie na iPhonie", "To jest totalna strata czasu, autor to [usunięte]", "Pozdrawiam z Berlina!",
    "Można prosić o wersję 1080p do pobrania?", "Ten fragment z górami: sztos", "Dzięki, wsparłem jak mogłem"];
  PP.comments = [];
  for (var c = 0; c < 46; c++) {
    var cu = PP.users[ri(0, 32)];
    var tx = texts[c % texts.length];
    var spam = /zegarki|strata czasu/.test(tx);
    PP.comments.push({
      id: "c" + (c + 1), user: cu.id, video: pick(["czesc", "czesc", "jj", "dla-patronow", "wywiad-z-montazysta"]), text: tx,
      createdAt: daysAgo(Math.floor(c * 0.6), ri(8, 23), ri(0, 59)), likes: ri(0, 14),
      status: c === 14 ? "HIDDEN" : c === 21 ? "HELD" : "VISIBLE",
      reports: spam && c < 15 ? (tx.indexOf("zegarki") > 0 ? 3 : 2) : c === 9 ? 1 : 0,
      reportReason: tx.indexOf("zegarki") > 0 ? "Spam" : tx.indexOf("strata") >= 0 ? "Obraźliwe" : c === 9 ? "Inne: „nie na temat”" : null,
      question: tx.indexOf("?") >= 0, creatorReplied: c % 4 === 0, heart: c % 6 === 0
    });
  }
  PP.comments[0].createdAt = daysAgo(0, 13, 50);
  PP.comments[0].video = "czesc";
  // Liczniki komentarzy osób zgodne z listą komentarzy.
  PP.users.forEach(function (u) { u.comments = PP.comments.filter(function (x) { return x.user === u.id; }).length; });

  // ---------- Dziennik audytu ----------
  var actions = [
    ["ADMIN_SIGN_IN", "Logowanie do panelu", "admin", "Sesja"],
    ["VIDEO_UPDATED", "Edycja filmu", "admin", "Film"],
    ["VIDEO_PUBLISHED", "Publikacja filmu", "admin", "Film"],
    ["COMMENT_HIDDEN", "Ukrycie komentarza", "admin", "Komentarz"],
    ["COMMENT_REPORT_RESOLVED", "Rozpatrzenie zgłoszenia", "admin", "Zgłoszenie"],
    ["PAYMENT_REFUNDED", "Zwrot płatności", "admin", "Płatność"],
    ["SETTINGS_CHANGED", "Zmiana ustawień", "admin", "Ustawienia"],
    ["BROADCAST_SENT", "Wysłanie rozsyłki", "admin", "Rozsyłka"],
    ["ENCODE_RETRIED", "Ponowne kodowanie", "admin", "Film"],
    ["CRON_RUN", "Zadanie okresowe", "system", "Zadanie"],
    ["STRIPE_EVENT", "Zdarzenie Stripe", "webhook", "Płatność"],
    ["AUTH_SIGN_UP", "Rejestracja konta", "użytkownik", "Konto"],
    ["USER_MUTED", "Wyciszenie komentowania", "admin", "Konto"],
    ["ADMIN_STEP_UP", "Ponowne uwierzytelnienie", "admin", "Sesja"]
  ];
  PP.audit = [];
  for (var a = 0; a < 96; a++) {
    var ac = actions[a % 7 === 0 ? 0 : ri(1, actions.length - 1)];
    PP.audit.push({
      id: "al" + (1000 - a), at: daysAgo(Math.floor(a * 0.45), ri(7, 23), ri(0, 59)), code: ac[0], label: ac[1], actorType: ac[2],
      actor: ac[2] === "admin" ? "Paweł (admin)" : ac[2] === "system" ? pick(["send-broadcasts", "stripe-reconciliation", "prune-playback-sessions", "backup.sh"]) : ac[2] === "webhook" ? "Stripe" : pick(nicks),
      target: ac[3], targetId: ac[3] === "Film" ? pick(["czesc", "jj", "kulisy", "dla-patronow"]) : ac[3] === "Płatność" ? "pi_3Q…" + ri(1000, 9999) : ac[3] === "Komentarz" ? "c" + ri(1, 46) : "—",
      ip: ac[2] === "admin" ? "83.24.x.x (PL)" : ac[2] === "webhook" ? "Stripe" : ac[2] === "system" ? "lokalnie" : ri(31, 212) + "." + ri(1, 254) + ".x.x",
      requestId: "req_" + Math.floor(rnd() * 1e8).toString(36)
    });
  }
  PP.audit.sort(function (x, y) { return y.at - x.at; });
  PP.audit[0] = { id: "al1001", at: daysAgo(0, 14, 2), code: "ADMIN_SIGN_IN", label: "Logowanie do panelu", actorType: "admin", actor: "Paweł (admin)", target: "Sesja", targetId: "passkey · Windows Hello", ip: "83.24.x.x (PL)", requestId: "req_7f3k2a" };

  PP.adminSessions = [
    { device: "Windows 11 · Chrome 141", method: "passkey (Windows Hello)", country: "PL · Warszawa", ip: "83.24.x.x", started: daysAgo(0, 14, 2), last: daysAgo(0, 14, 36), current: true },
    { device: "iPhone 16 · Safari (PWA)", method: "passkey (Face ID)", country: "PL · Warszawa", ip: "37.47.x.x", started: daysAgo(0, 7, 58), last: daysAgo(0, 11, 20), current: false }
  ];
  PP.adminAccounts = [
    { name: "Paweł (właściciel)", login: "pawel.perfect@…", passkeys: 2, totp: true, lastSignIn: daysAgo(0, 14, 2), role: "Właściciel" }
  ];
  PP.failedSignIns = [3, 1, 0, 2, 5, 1, 0, 0, 4, 2, 1, 14, 2, 1];

  // ---------- System ----------
  PP.containers = [
    { name: "polutek-app-1", image: "polutek-app:m10040944", mem: 139, limit: 1024, cpu: 2.1, restarts: 0, health: "healthy", up: "5 h" },
    { name: "polutek-encoder-1", image: "polutek-worker:m10040944", mem: 117, limit: 1500, cpu: 0.2, restarts: 0, health: "healthy", up: "5 h" },
    { name: "polutek-db-1", image: "postgres:17.6", mem: 52, limit: 512, cpu: 0.6, restarts: 0, health: "healthy", up: "3 d" },
    { name: "polutek-redis-1", image: "redis:7.4", mem: 2, limit: 128, cpu: 0.1, restarts: 0, health: "healthy", up: "3 d" },
    { name: "polutek-srh-1", image: "hiett/serverless-redis-http", mem: 11, limit: 128, cpu: 0.1, restarts: 0, health: "healthy", up: "3 d" },
    { name: "pp-support-web", image: "pp-support:4.18.0", mem: 163, limit: 768, cpu: 1.3, restarts: 0, health: "healthy", up: "3 d" },
    { name: "pp-support-sidekiq", image: "pp-support:4.18.0", mem: 134, limit: 512, cpu: 0.8, restarts: 1, health: "healthy", up: "19 h" },
    { name: "pp-support-db", image: "postgres:16", mem: 33, limit: 256, cpu: 0.2, restarts: 0, health: "healthy", up: "3 d" },
    { name: "pp-support-redis", image: "redis:7.4", mem: 5, limit: 64, cpu: 0.0, restarts: 0, health: "healthy", up: "3 d" }
  ];
  function hostSeries(base, amp, noise) { var a = []; for (var i = 0; i < 288; i++) { var local = ((i / 12) + 14.6) % 24; a.push(Math.max(0, base + amp * Math.max(0, Math.sin(((local - 8) / 24) * Math.PI * 2)) + (rnd() - 0.5) * noise)); } return a; }
  PP.host = {
    cpu: hostSeries(9, 14, 8), ram: hostSeries(2150, 160, 60), swap: hostSeries(1420, 40, 30), disk: 64, diskGb: [46, 75],
    load: [0.42, 0.51, 0.47], iowait: 0.6, ramTotal: 3809, swapTotal: 4096, fetchedAt: daysAgo(0, 14, 36)
  };
  // Skok CPU przy wdrożeniu o 9:41 (budowa obrazu na serwerze).
  for (var k = 0; k < 6; k++) { PP.host.cpu[288 - 60 + k] = 70 + rnd() * 20; }
  PP.timers = [
    { name: "send-broadcasts", schedule: "co minutę", last: daysAgo(0, 14, 36), dur: "0,4 s", ok: true, next: "14:37", result: "0 w kolejce" },
    { name: "stripe-reconciliation", schedule: "co 15 min", last: daysAgo(0, 14, 30), dur: "1,8 s", ok: true, next: "14:45", result: "1 oczekująca, 0 naprawionych" },
    { name: "prune-unverified-accounts", schedule: "codziennie 04:10", last: daysAgo(0, 4, 10), dur: "0,9 s", ok: true, next: "jutro 04:10", result: "usunięto 2 konta" },
    { name: "abandon-stale-originals", schedule: "codziennie 04:20", last: daysAgo(0, 4, 20), dur: "1,2 s", ok: true, next: "jutro 04:20", result: "0 porzuconych" },
    { name: "prune-playback-sessions", schedule: "codziennie 05:00", last: daysAgo(0, 5, 0), dur: "3,1 s", ok: true, next: "jutro 05:00", result: "usunięto 812 sesji" },
    { name: "purge-deleted-comments", schedule: "codziennie 05:30", last: daysAgo(0, 5, 30), dur: "0,3 s", ok: true, next: "jutro 05:30", result: "0" },
    { name: "sync-public-thumbnails", schedule: "codziennie 06:00", last: daysAgo(0, 6, 0), dur: "4,4 s", ok: false, next: "jutro 06:00", result: "1 błąd: wywiad-z-montazysta (403 z R2)" },
    { name: "backup.sh", schedule: "codziennie 02:30", last: daysAgo(0, 2, 30), dur: "38 s", ok: true, next: "jutro 02:30", result: "48,2 MB · kopia w R2" },
    { name: "health.sh", schedule: "co 5 min", last: daysAgo(0, 14, 35), dur: "2,0 s", ok: true, next: "14:40", result: "9/9 kontenerów zdrowych" }
  ];
  PP.backups = [];
  for (var b = 0; b < 14; b++) PP.backups.push({ at: daysAgo(b, 2, 30), sizeMb: Math.round((48.2 - b * 0.35 + rnd() * 0.4) * 10) / 10, offsite: b < 14, ok: true });
  PP.restoreTest = { at: daysAgo(4, 3, 15), ok: true, rows: "User 35 · Video 28 · Payment 147 · Comment 46", durS: 212 };
  PP.domains = [
    { name: "pawelperfect.com", kind: "domena", expires: new Date("2027-09-28T00:00:00Z"), auto: true, source: "RDAP (Verisign)" },
    { name: "pawelperfect.pl", kind: "domena", expires: new Date("2027-01-14T00:00:00Z"), auto: false, source: "RDAP (NASK)" },
    { name: "*.pawelperfect.com", kind: "certyfikat", expires: new Date("2026-12-21T00:00:00Z"), auto: true, source: "Cloudflare Universal SSL" },
    { name: "*.pawelperfect.pl", kind: "certyfikat", expires: new Date("2026-11-02T00:00:00Z"), auto: true, source: "Cloudflare Universal SSL" }
  ];
  PP.costs = [
    { item: "Serwer Hetzner CPX22", month: 8.2, unit: "€", note: "stała" },
    { item: "Cloudflare Workers Paid", month: 0, unit: "$", note: "planowane przy starcie: 5 $" },
    { item: "Cloudflare R2 (7,4 GB z 10 GB darmowych)", month: 0, unit: "$", note: "prognoza 0 $ do 10 GB" },
    { item: "Resend (Free: 3000/mies.)", month: 0, unit: "$", note: "Pro 20 $ przy starcie" },
    { item: "Opłaty Stripe (30 dni)", month: 61.4, unit: "zł", note: "1,7% + 1 zł za BLIK/kartę" },
    { item: "Domeny (.com + .pl, roczne / 12)", month: 11.5, unit: "zł", note: "odnowienie .pl 14.01.2027" }
  ];
  PP.db = {
    sizeMb: 26, conns: 11, maxConns: 60, cacheHit: 99.6,
    tables: [["VideoPlaybackEvent", 10.1, "rośnie ok. 0,3 MB/dzień"], ["VideoPlaybackSession", 2.7, "przycinana po 30 dniach"], ["AuditLog", 1.4, "bez przycinania"], ["EmailEvent", 1.1, ""], ["Payment", 0.4, ""], ["Comment", 0.2, ""]]
  };

  // ---------- Limity i krawędź ----------
  PP.worker = { used: 41230, limit: 100000, hourly: [], fetchedAt: daysAgo(0, 14, 30) };
  var hTot = 0;
  for (var hh = 0; hh <= 12; hh++) { var v = hh < 5 ? ri(900, 1600) : ri(2600, 4800); PP.worker.hourly.push(v); hTot += v; }
  var scale = PP.worker.used / hTot; PP.worker.hourly = PP.worker.hourly.map(function (x) { return Math.round(x * scale); });
  PP.worker.forecast = Math.round(PP.worker.used + (PP.worker.used / 12.6) * 11.4 * 1.15);
  PP.resend = { today: 23, dayLimit: 100, month: 412, monthLimit: 3000, bounce: 0.8, spam: 0.0, fetchedAt: daysAgo(0, 14, 20) };
  PP.r2 = { gb: 7.4, freeGb: 10, opsA: 0.21, opsB: 1.9 };
  PP.edge = { cacheHit: 93.8, s403: 12, s404: 266, s5xx: 0, fetchedAt: daysAgo(0, 14, 15) };

  // ---------- Komunikacja ----------
  PP.mailTypes = [
    ["Weryfikacja e-mail", "verify-email", 41, 40, 1, 0],
    ["Reset hasła", "reset-password", 6, 6, 0, 0],
    ["Powitanie", "welcome-email", 37, 37, 0, 0],
    ["Potwierdzenie napiwku", "thank-you-donation", 52, 51, 1, 0],
    ["Zmiana hasła", "password-changed", 3, 3, 0, 0]
  ];
  PP.broadcasts = [
    { title: "Premiera „Kulisy” we wtorek", status: "SCHEDULED", at: new Date("2026-10-05T16:00:00Z"), recipients: 31, opens: null, clicks: null, unsub: null },
    { title: "Nowy odcinek: JJ", status: "SENT", at: daysAgo(8, 19, 30), recipients: 31, opens: 58, clicks: 21, unsub: 1 },
    { title: "Dziękuję za pierwszy miesiąc", status: "SENT", at: daysAgo(19, 18, 0), recipients: 24, opens: 63, clicks: 12, unsub: 0 },
    { title: "Test: podgląd szablonu", status: "TEST", at: daysAgo(20, 17, 40), recipients: 1, opens: 100, clicks: 100, unsub: 0 },
    { title: "Zaproszenie na premierę „Cześć”", status: "SENT", at: daysAgo(23, 12, 0), recipients: 19, opens: 71, clicks: 34, unsub: 0 }
  ];
  PP.templates = [
    ["verify-email", "Weryfikacja adresu", "domyślny", daysAgo(3)], ["reset-password", "Reset hasła", "domyślny", daysAgo(3)],
    ["welcome-email", "Powitanie", "zmieniony", daysAgo(14)], ["thank-you-donation", "Podziękowanie za napiwek", "zmieniony", daysAgo(9)],
    ["password-changed", "Zmiana hasła", "domyślny", daysAgo(3)], ["broadcast-default", "Rozsyłka (rama)", "zmieniony", daysAgo(8)]
  ];
  PP.support = { open: 4, unanswered24h: 2, firstReplyH: 6.5, fetchedAt: daysAgo(0, 13, 5) };
  PP.mailDns = [
    ["pawelperfect.com", "MX → Cloudflare Email Routing", true], ["pawelperfect.com", "SPF (include: resend, _spf.mx.cloudflare.net)", true],
    ["pawelperfect.com", "DKIM resend._domainkey", true], ["pawelperfect.com", "DMARC p=quarantine", true],
    ["pawelperfect.pl", "MX → Cloudflare Email Routing", true], ["pawelperfect.pl", "DMARC", false]
  ];

  // ---------- Analityka ----------
  PP.sources = [["Bezpośrednie", 1840], ["x.com", 1215], ["wykop.pl", 702], ["E-mail (rozsyłki)", 488], ["Google", 361], ["Discord", 214], ["youtube.com", 140], ["Inne (14)", 233]];
  PP.countries = [["Polska", "PL", 4380], ["Niemcy", "DE", 312], ["Wielka Brytania", "GB", 241], ["Holandia", "NL", 98], ["Stany Zjednoczone", "US", 86], ["Irlandia", "IE", 61], ["Norwegia", "NO", 44], ["Inne (23)", "", 190]];
  PP.devices = [["Telefon", 3290], ["Komputer", 1806], ["Tablet", 316]];
  PP.displayMode = [["Karta przeglądarki", 4910], ["Aplikacja (PWA)", 502]];
  PP.browsers = [["Chrome", 2410], ["Safari", 1888], ["Firefox", 512], ["Samsung Internet", 301], ["Edge", 254], ["Inne", 47]];
  PP.pages = [["/", 6120, 41], ["/?v=czesc", 2210, 22], ["/?v=jj", 1430, 25], ["/?v=kulisy", 906, 19], ["/regulamin", 132, 70], ["/polityka-prywatnosci", 88, 74], ["/en", 412, 45]];
  PP.funnel = [["Wizyta", 5412], ["Start odtwarzania", 3080], ["Rejestracja", 112], ["Weryfikacja e-mail", 98], ["Pierwszy komentarz", 41], ["Pierwszy napiwek", 9]];
  PP.tipFunnel = [["Otwarcie bramki", 214], ["Kwota i zgoda", 121], ["Wybór metody", 96], ["Potwierdzenie", 71], ["Sukces", 63]];
  PP.attribution = [["x.com", 34, 11, 3], ["Bezpośrednie", 29, 9, 2], ["E-mail (rozsyłki)", 18, 6, 3], ["wykop.pl", 17, 2, 0], ["Google", 8, 1, 1], ["Discord", 6, 2, 0]];
  // Retencja „Cześć”: 100 punktów (% widzów przy danym % filmu) + pasmo typowego filmu kanału.
  PP.retention = []; PP.retLo = []; PP.retHi = [];
  for (var r = 0; r <= 100; r++) {
    var base = 100 * Math.exp(-r / 120) - (r < 3 ? r * 4 : 12) * Math.min(1, r / 3);
    if (r > 38 && r < 44) base += 6 * Math.sin(((r - 38) / 6) * Math.PI);
    if (r > 60 && r < 66) base -= 5 * Math.sin(((r - 60) / 6) * Math.PI);
    if (r > 92) base -= (r - 92) * 1.6;
    PP.retention.push(Math.max(0, Math.round(base * 10) / 10));
    var typ = 100 * Math.exp(-r / 95) - (r < 3 ? r * 5 : 15) * Math.min(1, r / 3) - (r > 90 ? (r - 90) * 1.8 : 0);
    PP.retLo.push(Math.max(0, typ - 7)); PP.retHi.push(Math.max(0, typ + 6));
  }
  PP.heat = [];
  for (var dd = 0; dd < 7; dd++) { var row = []; for (var h2 = 0; h2 < 24; h2++) { var f = 0.15 + Math.max(0, Math.sin(((h2 - 7) / 24) * Math.PI * 2)) + (h2 >= 19 && h2 <= 22 ? 0.9 : 0) + (dd >= 5 ? 0.3 : 0); row.push(Math.round(f * (14 + rnd() * 8))); } PP.heat.push(row); }
  PP.qoe = { startupP50: 0.9, startupP95: 2.1, startupPrevP95: 2.6, exitsBefore: 3.1, failure: 0.4, rebuffer: 0.6, score: 91, smooth: 96,
    renditions: [["1080p", 58], ["720p", 31], ["480p", 9], ["360p", 2]], errors: [["Sieć (fragLoadError)", 9], ["Token wygasł (403)", 4], ["Dekodowanie (media)", 1]],
    startupDaily: [] };
  for (var sd = 0; sd < 30; sd++) PP.qoe.startupDaily.push(Math.round((2.9 - sd * 0.022 + (rnd() - 0.5) * 0.5 + (sd === 26 ? 0.9 : 0)) * 100) / 100);
  PP.qoe.startupDaily[29] = 2.1; PP.qoe.startupDaily[0] = 2.6;

  // ---------- Kolejka zadań / teraz ----------
  PP.jobs = [
    { kind: "encode", label: "Kodowanie „Pytania od widzów #1”", state: "running", detail: "720p · 62% · ok. 4 min", href: "#/tresci/qa-1" },
    { kind: "encode", label: "Kodowanie „Test kodowania 4K”", state: "failed", detail: "ffmpeg: kod 137 (brak pamięci) · 2 próby", href: "#/tresci/test-kodowania-4k" },
    { kind: "broadcast", label: "Rozsyłka „Premiera „Kulisy” we wtorek”", state: "scheduled", detail: "pon. 18:00 · 31 odbiorców", href: "#/komunikacja" },
    { kind: "payment", label: "1 płatność PENDING > 15 min", state: "waiting", detail: "rekonsylacja o 14:45", href: "#/przychody?status=PENDING" }
  ];
  PP.live = { online: 23, watching: 14, perVideo: [["Cześć", 9], ["Dla patronów", 3], ["JJ", 2]] };
})();
