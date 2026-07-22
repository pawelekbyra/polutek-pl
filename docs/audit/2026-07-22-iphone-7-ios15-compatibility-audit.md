# Audyt: iPhone 7 / iOS 15 — "wieczne skeletony" — 2026-07-22

Zgłoszenie: na iPhonie 7 strona źle działa, użytkownik widzi skeletony (placeholdery
ładowania), które nigdy nie znikają. Audyt kodu + zewnętrzna weryfikacja (dokumentacja
Next.js, znane zgłoszenia w repo Next.js) pod kątem przyczyny źródłowej.

## Streszczenie kierownicze

**Przyczyna źródłowa: niezgodność wersji.** iPhone 7 fizycznie nie może zainstalować
niczego nowszego niż **iOS 15.8.6** (ostatnia wydana wersja dla tego modelu — Apple
odcięło go od iOS 16). iOS 15.8.6 zawiera **Safari 15.6**.

Next.js 16 (repo jest na `16.2.6`, `package.json:78`) **domyślnie kompiluje JS pod
minimum `safari 16.4+`** (`chrome 111, edge 111, firefox 111, safari 16.4` —
oficjalna dokumentacja: https://nextjs.org/docs/architecture/supported-browsers).
W repo **nie ma** żadnego pliku `.browserslistrc` ani klucza `"browserslist"` w
`package.json`, więc obowiązuje ten domyślny, wysoki próg — potwierdzone
`grep`-em, zero wyników.

Skutek: przeglądarka Safari 15.6 na iPhonie 7 dostaje bundle JS zawierający
składnię, której **jej parser w ogóle nie rozumie** (nie chodzi o brakujące API do
polyfillowania w runtime — to błąd na etapie *parsowania* pliku, więc cały
plik/moduł pada, zanim jakikolwiek kod w nim zacznie się wykonywać). To dokładnie
ten sam mechanizm, co udokumentowany, głośny problem w repo Next.js:
"Next.js 16 production build fails on Safari iOS 16 with `Unexpected token '{'`"
(https://github.com/vercel/next.js/discussions/93152) — tam pada nawet **iOS 16**
(Safari 16.0–16.3, czyli już nowszy niż to, co ma iPhone 7). iPhone 7 na Safari 15.6
jest o dwie pełne wersje major poniżej progu (16.4) i o jedną-dwie poniżej urządzeń,
które już zgłaszały ten błąd — awaria jest praktycznie pewna, nie prawdopodobna.

**To wyjaśnia "wieczne skeletony" 1:1:** strona jest renderowana na serwerze (SSR/RSC),
więc pierwszy HTML, jaki dostaje przeglądarka, to właśnie stan `loading.tsx` /
skeleton (`HomePageSkeleton`, `LegalDocSkeleton` itd. — patrz `app/**/loading.tsx`,
9 plików). Ten HTML jest **statyczny i poprawny** — telefon go wyświetla. Ale
przejście ze skeletonu na realną treść wymaga hydracji Reacta, czyli wykonania JS.
Jeśli główny bundle JS pada na etapie parsowania (`SyntaxError`), hydracja **nigdy
się nie zaczyna** — nie ma żadnego widocznego błędu dla użytkownika (Safari po
prostu nie wykonuje skryptu), strona po prostu zamraża się dokładnie na etapie
skeletonu w nieskończoność. To nie jest wolne ładowanie ani race condition —
to całkowity, cichy brak wykonania JS na tym urządzeniu.

## Dowody z kodu

| Fakt | Źródło |
|---|---|
| Next.js `16.2.6`, React `19.2.6` | `package.json:78-80` |
| Brak `browserslist` w `package.json` | `package.json` — brak klucza |
| Brak `.browserslistrc` w repo | sprawdzone — plik nie istnieje |
| `next.config.js` nie ustawia własnego celu kompilacji / babel | `next.config.js` — brak takiej konfiguracji |
| `tsconfig.json` ma `"target": "es2015"` | **nieistotne dla runtime** — to tylko typechecking; realną transpilację JS robi SWC Next.js wg Browserslist, a nie `tsconfig.target` |
| Domyślny próg Next.js 16 to `safari 16.4+` | https://nextjs.org/docs/architecture/supported-browsers (pobrane 2026-07-22) |
| iPhone 7 max iOS = 15.8.6 → Safari 15.6 | potwierdzone źródłami zewnętrznymi (Apple community, everymac.com) |
| Identyczny błąd zgłoszony dla iOS 16 (Safari 16.0–16.3) na czystym Next.js 16 | https://github.com/vercel/next.js/discussions/93152 |

Dodatkowo w kodzie nie znaleziono w `app/` bezpośredniego użycia API typu
`structuredClone`, `Object.hasOwn`, `Array.prototype.at`, logicznych operatorów
przypisania (`??=`, `||=`, `&&=`) — więc to nie jest sytuacja "brakującego Web API",
którą dałoby się załatać pojedynczym polyfillem. Winowajcą jest **składnia**
(prawdopodobnie: prywatne pola/metody klas `#pole`, static blocks, lub inna
składnia ES2022+ wychodząca wprost z zależności — `framer-motion@12`,
`@vidstack/react@1.15`, `@radix-ui/*`, `@base-ui/react`, `tailwindcss@4` — z których
część kompiluje/dystrybuuje kod zakładający nowoczesny target), której Next 16 przy
domyślnym Browserslist **nie transpiluje w dół**, bo zakłada, że najstarsza
wspierana przeglądarka (Safari 16.4) i tak ją rozumie.

## Czynnik pogłębiający: Service Worker / cache nie da się posprzątać

`app/components/ServiceWorkerCleanup.tsx` odrejestrowuje stare Service Workery i
czyści `caches` — ale robi to w `useEffect`, czyli **też wymaga działającej
hydracji**. Jeśli użytkownik na iPhonie 7 odwiedzał stronę wcześniej (np. przed
usunięciem starego SW z tego projektu) i ma zarejestrowany, przechwytujący ruch
Service Worker w Safari, to nawet po naprawieniu przyczyny źródłowej (patrz niżej)
jego przeglądarka może nadal serwować stary, zcache'owany (i również zepsuty)
bundle — bo skrypt czyszczący nigdy nie dostanie szansy się wykonać. Dla takich
przypadków jedyne wyjście to ręczne czyszczenie danych strony w Ustawieniach Safari
(Ustawienia → Safari → Zaawansowane → Dane witryn → usuń dla polutek.pl) albo
twardy `Cmd+Option+E`/"Wyczyść historię" na urządzeniu.

## Czynnik drugorzędny (nie powoduje skeletonów, ale realny na A10): animacje

`AccessLockOverlay` (`app/components/AccessLockOverlay.tsx`) renderuje warstwę
`.aurora` z trzema niezależnie dryfującymi, rozmytymi blobami + `.sheen` +
`.noise`, sterowane CSS `@keyframes` (zgodnie z CLAUDE.md — celowo nie
`framer-motion repeat: Infinity`, dla wydajności) plus jednorazową choreografią
wejścia w `framer-motion`. To dobra decyzja pod kątem wydajności, ale iPhone 7
(chip A10, 2016) z wieloma jednocześnie zamontowanymi lockami w `SidebarPlaylist`
i tak może odczuwalnie throttlingować — to jednak **osobny, kosmetyczny problem
wydajnościowy**, nie przyczyna "wiecznych skeletonów". Nie wymaga natychmiastowej
akcji w kontekście tego zgłoszenia.

## Skala biznesowa — zanim się to naprawia

iPhone 7 to urządzenie z 2016 r., ostatni raz aktualizowane (iOS 15.8.6) we
wrześniu 2022. Zanim inwestuje się czas w obniżanie progu kompatybilności (co ma
realny koszt — patrz niżej), warto sprawdzić realny udział ruchu z Safari
15.x/iOS 15 w Vercel Analytics — jeśli to promil ruchu, może się okazać, że
świadome nieco inne rozwiązanie (patrz opcja B) jest tańsze niż utrzymywanie
wsparcia dla 4-letniego już wtedy urządzenia bez aktualizacji bezpieczeństwa.
Ten audyt nie miał dostępu do panelu Analytics — to pierwszy krok do wykonania
ręcznie lub w kolejnej sesji.

## Rekomendacje

### Opcja A — obniżyć próg Browserslist (naprawia realnie, kosztem bundle size)

Dodać do `package.json`:

```json
"browserslist": [
  "chrome >= 90",
  "edge >= 90",
  "firefox >= 88",
  "safari >= 14",
  "ios_saf >= 14"
]
```

(albo jeszcze niżej, jeśli chcemy realnie pokryć Safari 15.6 z marginesem — `safari >= 14`
jest bezpiecznym, powszechnie używanym punktem odniesienia).

Konsekwencje do przetestowania, nie do zignorowania:
- SWC zacznie transpilować/polyfillować więcej — **wzrost rozmiaru JS bundle** dla
  wszystkich użytkowników, także tych na nowoczesnych przeglądarkach.
- To **nie gwarantuje** pełnej naprawy — same zależności (`framer-motion`,
  `@vidstack/react`, `@base-ui/react`, Tailwind v4 tooling) mogą też wewnętrznie
  zakładać nowocześniejszy runtime (nie tylko składnię, ale też Web API, których
  Safari 15.6 nie ma). Wymaga realnego testu na iOS 15.6 (Safari na starym Macu /
  BrowserStack/Sauce Labs z prawdziwym iOS 15, nie tylko emulacją Chrome DevTools —
  to musi być silnik WebKit).
- React 19 sam w sobie **nie ma udokumentowanego twardego progu** blokującego
  Safari 15 (wymaga tylko `Promise`, `Symbol`, `Object.assign` — to jest w Safari
  15) — więc problem realnie leży w warstwie kompilacji Next.js/SWC + zależności,
  nie w samym Reakcie.

### Opcja B — świadomie nie wspierać iOS 15 i pokazać czytelny komunikat zamiast ciszy

Jeśli po sprawdzeniu Analytics ruch z iOS 15 jest znikomy: zamiast obniżać próg dla
całej bazy użytkowników, dodać **lekki, statyczny, niezależny od głównego bundle**
skrypt wykrywający wsparcie (np. sprawdzenie w `<script nomodule>` lub prostym
inline-skrypcie ładowanym przed głównym bundle) i wyświetlający komunikat
"Twoja przeglądarka jest zbyt stara — zaktualizuj Safari/iOS lub użyj innej
przeglądarki" zamiast nieskończonego skeletonu. To nie naprawia funkcjonalności
dla tych userów, ale zamienia cichą, mylącą awarię na jasny komunikat — dużo
tańsze niż Opcja A i nie ryzykuje regresji dla 99%+ ruchu.

### Rekomendacja audytu

Zacząć od **sprawdzenia realnego ruchu iOS 15/Safari 15 w Vercel Analytics** (nie
było w zakresie tego audytu — wymaga dostępu do panelu). Jeśli ruch jest
nietrywialny → Opcja A z pełnym testem na prawdziwym iOS 15.6 przed wdrożeniem.
Jeśli ruch jest marginalny → Opcja B, dużo tańsza i bez ryzyka dla reszty bazy.
W obu przypadkach osobno: rozważyć, czy `ServiceWorkerCleanup` nie powinien też
działać z poziomu bardzo prostego, nomodule/legacy-safe skryptu, żeby urządzenia
z uwięzionym starym SW mogły się same wyleczyć zamiast wymagać ręcznego czyszczenia
danych strony — to osobne zadanie, nie blokuje Opcji A/B.

## Co NIE jest przyczyną (wykluczone w toku audytu)

- Nie jest to problem z konkretnymi API typu `structuredClone`/`Object.hasOwn` w
  kodzie własnym — nie znaleziono ich użycia w `app/`.
- Nie jest to problem z `AppPreloadProvider` / logiką AbortController zawieszającą
  się na fetchach — to jest kod, który i tak nigdy się nie uruchamia, bo cały
  bundle pada wcześniej, na etapie parsowania.
- Nie jest to celowe zachowanie `middleware.ts` ani polityki cache (`/api/media-source`
  itd.) — to warstwa serwerowa, nieistotna dla błędu parsowania JS po stronie klienta.
- Nie jest to (bezpośrednio) ciężar animacji `framer-motion`/aurora — to prawdziwy,
  ale drugorzędny problem wydajnościowy, nie przyczyna zawieszenia na skeletonie.

## Status: Opcja A wdrożona (2026-07-22)

Dodano `"browserslist"` do `package.json` (`safari >= 14`, `ios_saf >= 14`, plus
odpowiedniki dla Chrome/Edge/Firefox), obniżając próg kompilacji SWC poniżej
domyślnego `safari 16.4+` Next.js 16, tak by obejmował Safari 15.6 (iPhone 7)
z zapasem. `npm run build` przechodzi czysto po tej zmianie — brak nowych błędów
kompilacji.

**Ograniczenie weryfikacji:** w tym środowisku nie ma dostępu do realnego iPhone'a/
Safari 15.6 ani BrowserStack, więc **nie potwierdzono na żywym urządzeniu**, że to
w 100% usuwa `SyntaxError` — build-time success dowodzi tylko, że SWC nie zgłasza
konfliktu przy tym targecie, nie że każda zależność (`framer-motion`, `@vidstack/react`,
`@base-ui/react`) faktycznie zredukowała swoją składnię do czegoś, co Safari 15.6
sparsuje. Zalecana weryfikacja przed uznaniem tematu za zamknięty: Safari Web
Inspector na prawdziwym iPhonie 7 (lub BrowserStack z iOS 15.6) — patrz sekcja
"Jak to zweryfikować" niżej. Jeśli po tej zmianie nadal wystąpi błąd parsowania,
kolejny krok to zawężenie go do konkretnej zależności i albo jej aktualizacja/wymiana,
albo dalsze obniżenie targetu.

Dla użytkowników, którzy już wcześniej trafili na zablokowaną stronę na tym
urządzeniu: może być potrzebne ręczne wyczyszczenie danych witryny w Safari (patrz
sekcja "Czynnik pogłębiający" wyżej) — ten fix nie cofa się w czasie do już
zarejestrowanego, zepsutego Service Workera.

## Jak to zweryfikować bez zgadywania

Najpewniejszy sposób: prawdziwy iPhone 7 (lub iOS 15.6 w BrowserStack/Sauce Labs)
podłączony do Maca przez Safari Web Inspector (Safari → Develop → [urządzenie] →
polutek.pl), zakładka Console. Oczekiwany wynik: `SyntaxError: Unexpected token`
(lub podobny) na jednym z głównych chunków JS, zero logów aplikacji po nim. To
potwierdzi diagnozę jednoznacznie i pokaże dokładnie, który chunk/plik pada, co
pomoże zawęzić, która zależność wymusza nowoczesną składnię.
