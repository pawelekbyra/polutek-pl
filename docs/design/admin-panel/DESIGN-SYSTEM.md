# Panel PP: system projektowy (wersja 0.1, 2026-10-04)

Krótki kontrakt wyglądu i zachowania nowego panelu `admin.pawelperfect.com`. Źródłem prawdy jest prototyp w tym katalogu: `styles.css` (tokeny i komponenty), `charts.js` (wykresy), `core.js` (klocki UI). Kierunek zatwierdzony przez właściciela 2026-10-04 („podoba mi się bardzo”): jasna, spokojna paleta, zaokrąglone elementy, wyszukiwarka i filtr czasu u góry. Nie zmieniać charakteru bez jego decyzji.

**Ekrany parytetu (2026-10-04, `screens-c.js`):** nowy film z wgraniem oryginału (`#/tresci/nowy`), edycja wszystkich pól filmu ze strefą zagrożenia (`#/tresci/<slug>/edycja`), układ kanału (`#/tresci?widok=uklad`), rola i usunięcie konta z wpisaniem e-maila (profil 360°), Ustawienia → Kanał / Płatności / Panel i alerty, Komunikacja → Rozsyłki (kreator) / Szablony (edytor PL/EN) / Powiadomienia. Działania nieodwracalne (usunięcie filmu, konta) wymagają wpisania sluga lub e-maila; odwracalne (archiwizacja, anulowanie rozsyłki) mają zwykłe okno ze skutkiem. Mapa funkcji starego panelu: [`../../architecture/admin-parity.md`](../../architecture/admin-parity.md).

**Jak otworzyć prototyp:** `prototype-standalone.html` (jeden plik, działa z dysku i w podglądzie) albo `index.html` przez dowolny serwer HTTP, np. `python -m http.server 8765 --directory docs/design/admin-panel`. Po zmianie plików źródłowych: `node docs/design/admin-panel/build-standalone.mjs`. Wszystkie dane są przykładowe (`data.js`, stałe ziarno, „teraz” = 2026-10-04 14:36 czasu warszawskiego).

## 1. Zasady

1. **Najpierw decyzja, potem wykres.** Każdy ekran zaczyna się od stanu i rzeczy do zrobienia („Wymaga uwagi”), liczby mają porównanie, każda anomalia ma przycisk działania.
2. **Nigdy ślepo.** Każda liczba z usługi zewnętrznej ma wiek („dane z 14:32”); gdy jest starsza niż 2 × oczekiwany interwał, staje się „nieaktualne” (ikona + tekst w kolorze ostrzeżenia). Brak danych to jawny stan, nie zero.
3. **Bez szkieletów i spinnerów na starcie.** Ekran od razu pokazuje treść z lokalnych agregatów. Odświeżanie trzyma poprzedni obraz; spinner tylko w przycisku akcji, którą właściciel właśnie kliknął.
4. **Jedna powłoka, jeden komponent na zadanie:** jedna tabela, jedna rama modala, jeden kafel liczby, jeden formularz na obiekt.
5. **Spokój:** płaskie karty z cienką ramką, jeden akcent (niebieski), kolor stanów tylko tam, gdzie coś znaczy.

## 2. Tokeny

Zdefiniowane jako zmienne CSS na `:root`; tryb ciemny pod `@media (prefers-color-scheme: dark)` (gdy brak wyboru) i pod `:root[data-theme="dark"]` (przełącznik). Domyślnie panel podąża za systemem; wybór „jasny/ciemny” zapisuje się lokalnie.

### 2.1 Kolory (kontrast WCAG 2.x policzony skryptem, wszystkie pary przechodzą)

| Token | Jasny | Ciemny | Użycie i kontrast (jasny / ciemny) |
|---|---|---|---|
| `--bg` | `#f6f6f4` | `#0e0e10` | tło strony |
| `--surface` | `#ffffff` | `#161619` | karty, tabele, modale |
| `--surface-2` | `#f1f1ee` | `#1f1f23` | najechanie, stopka modala, tor |
| `--border` | `#e2e1dc` | `#2b2b30` | ramki kart i linie tabel (dekoracyjne) |
| `--border-input` | `#8a8882` | `#6e6d72` | obrys pól formularza: 3,54 / 3,52 (≥ 3:1, WCAG 1.4.11) |
| `--text` | `#17171a` | `#ececee` | tekst główny: 17,9 / 15,3 na powierzchni |
| `--text-2` | `#4f4d48` | `#b9b8b2` | tekst drugorzędny: 8,4 / 9,1 |
| `--text-3` | `#67655f` | `#94938d` | etykiety, wiek danych, osie: 5,8 / 5,9 (min. 5,15 na `--surface-2`) |
| `--accent` | `#1f62d0` | `#2f6be0` | przycisk główny (biały tekst 5,65 / 4,88), pierścień fokusu |
| `--accent-text` | `#1d5bc2` | `#7eacf6` | linki: 6,3 / 7,8 |
| `--selected` | `#e8f0fc` | `#15233d` | aktywny element nawigacji i wiersz |
| `--ok` / `--ok-bg` | `#15703a` / `#e7f4eb` | `#5bc985` / `#132a1c` | plakietka OK: 5,4 / 7,4 |
| `--warn` / `--warn-bg` | `#8a5000` / `#fcf1dc` | `#efb14a` / `#2e2410` | plakietka „uwaga”: 5,8 / 8,0 |
| `--crit` / `--crit-bg` | `#b42318` / `#fdecea` | `#f4837a` / `#331816` | plakietka błędu: 5,8 / 6,5 |
| `--crit-solid` | `#c0271c` | `#c7362b` | przycisk nieodwracalny (biały tekst 5,9 / 5,3) |
| `--*-icon` | `#1d8a47` `#b46d00` `#c0271c` | `#4cc274` `#e9a93a` `#f06a5f` | ikony stanów: ≥ 4,1 / ≥ 5,9 (≥ 3:1) |
| `--focus` | `#1f62d0` | `#7eacf6` | fokus: ≥ 5,0 / ≥ 7,1 na każdym tle |

Paleta wykresów jest **osobna od kolorów stanów** (walidator dataviz: pasmo jasności, nasycenie, odstęp dla daltonistów ΔE ≥ 9,4 dla wszystkich par, kontrast ≥ 3:1):

| Token | Jasny | Ciemny | Użycie |
|---|---|---|---|
| `--series-1` | `#2a78d6` (4,4:1) | `#3987e5` (5,0:1) | bieżący okres, główna seria, słupki |
| `--series-2` | `#d4572a` | `#d95926` | druga kategoria (rzadko) |
| `--series-3` | `#14966a` | `#199e70` | trzecia kategoria (rzadko) |
| `--compare` | `#8a8882` (3,5:1) | `#7d7c78` (4,3:1) | okres porównawczy, pasmo „typowy zakres”, sparkline |
| `--grid` / `--axis` | `#ecebe7` / `#c9c7c0` | `#242428` / `#3a3a40` | siatka i oś (linie włoskowate) |

Skala sekwencyjna (mapa ciepła) to jedna barwa `--series-1` w 7 krokach od tła do pełnego koloru.

### 2.2 Pozostałe tokeny

- **Odstępy (siatka 4/8):** `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48, `--s-8` 64 px.
- **Promienie:** `--r-sm` 6 (pola w tabeli, podpowiedzi), `--r-md` 8 (przyciski, pola), `--r-lg` 12 (karty, modale), `--r-full` (plakietki).
- **Cienie:** karty płaskie (sama ramka). `--shadow-1`: podpowiedź wykresu; `--shadow-2`: modal, paleta, popover, toast.
- **Typografia:** stos systemowy (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`), mono `ui-monospace, "Cascadia Mono", Consolas, …`; zero czcionek z sieci. Rozmiary: 12 (minimum, podpisy), 13 (tabele), 14 (tekst), 16, 20 (tytuł strony), 24/28 (wartość kafla), 40 (liczby w trybie premiery). Wagi 400/500/600. **Cyfry tabelaryczne** (`tabular-nums`) w tabelach, osiach i licznikach na żywo; duże pojedyncze liczby (kafle) proporcjonalne.
- **Ruch:** `--dur-1` 120 ms (najechanie), `--dur-2` 200 ms (szuflada, toast), krzywa `cubic-bezier(.2,0,0,1)`. Przy `prefers-reduced-motion` wszystkie czasy = 0, potwierdzenie passkey bez opóźnienia, pulsująca kropka „na żywo” stoi.
- **Wymiary:** `--control-h` 36 px przy myszy, **44 px** przy dotyku albo szerokości ≤ 760 px; pasek boczny 232 px (64 px ikon przy ≤ 1100 px).

## 3. Komponenty

| Komponent | Klasa / funkcja | Reguły |
|---|---|---|
| Powłoka | `.app` `.sidebar` `.topbar` `.content` | 8 modułów + „Premiera na żywo” + Ustawienia na dole. Licznik przy module = elementy w kolejce (tekst dla czytnika: „4 do moderacji”). Górny pasek: paleta (Ctrl+K), globalny okres + porównanie (w URL), plakietka „Dane przykładowe”, kropka zdrowia (kształt: koło OK, romb uwaga, kwadrat błąd + słowo), motyw, konto. |
| Kafel liczby z deltą | `tile()` / `kpiTile()` | etykieta, wartość + jednostka, delta: strzałka + procent + „vs poprzednie 28 dni”; kolor = kierunek × czy wzrost jest dobry (odrzucenia, czas startu: spadek = dobrze); tekst dla czytnika „spadek o 19% (korzystnie)”; sparkline szary z kropką akcentu na końcu. Kafel jest linkiem do przefiltrowanej listy. |
| Wykres liniowy | `Charts.figure({series, annotations, band, refLine})` | linia 2 px w `--series-1`, porównanie 1,5 px szare, wypełnienie 10%, jedna oś Y, ticki zaokrąglone, etykieta końcowa tylko przy wartości „teraz”. Adnotacje z osi zmian: pionowa linia + numer, lista pod wykresem, w podpowiedzi. |
| Wykres słupkowy | `type: "columns"` | słupki ≤ 24 px, koniec zaokrąglony 4 px, przerwa 2 px, wyróżnienie jednego słupka (reszta szara), linia odniesienia (np. tempo limitu) w kolorze błędu z podpisem. |
| Sparkline | `Charts.spark()` | dekoracja obok liczby (`aria-hidden`), nigdy jedyne źródło informacji. |
| Lista słupków | `Charts.barList()` | źródła, kraje, urządzenia, lejek: etykieta, liczba, udział; lejek w trybie `ordinal` z procentem przejścia z poprzedniego kroku. |
| Licznik limitu | `Charts.meter()` | `role="meter"` z `aria-valuetext`; wypełnienie niesie stan (OK/uwaga/błąd od progu), tor to jaśniejszy krok tego samego koloru, kreska prognozy na koniec okresu, cienka kreska progu. |
| Tabela | `table()` + `paginate()` + `pager()` | wiersze 40 px, nagłówek przyklejony, liczby do prawej, sortowanie przyciskiem w nagłówku z `aria-sort`, filtry w jednym rzędzie nad tabelą, **stan filtrów, sortowania i strony w URL** (odświeżenie i link zachowują widok), „1–12 z 74 wpłat” + numery stron. Pusty wynik: komunikat + „Wyczyść filtry”. Na telefonie wiersze stają się kartami z etykietami kolumn; kolumny drugorzędne (`hide-md`, `hide-sm`) chowają się. |
| Formularz | `.field` `.input` `.select` `.choice` `.switch` | etykieta nad polem, podpowiedź pod spodem, błąd przy polu (ikona + tekst, `aria-invalid`, `aria-describedby`), fokus wraca do pierwszego błędnego pola. |
| Modal | `openModal()` / `confirmModal()` | jedna rama (`<dialog>`, pułapka fokusu, Esc), nagłówek + kroki, treść, stopka z akcjami po prawej. Działanie nieodwracalne: opis skutku w ramce „Skutek”, przycisk w `--crit-solid` z czasownikiem i kwotą („Zwróć 20,00 zł”). |
| Ponowne uwierzytelnienie | przepływ zwrotu w `app.js` | krok 1 skutek + powód (wymagany) + klucz idempotencji; krok 2 passkey albo TOTP (6 pól, wklejanie całego kodu); przycisk wykonania nieaktywny do potwierdzenia; potwierdzenie ważne 5 min; wpis w audycie. |
| Toast | `toast()` | prawy dół (nad dolnym paskiem na telefonie), `role="status"`, 7 s (12 s z akcją „Cofnij”), pauza przy najechaniu i fokusie. Działania odwracalne (moderacja) dostają „Cofnij” zamiast okna potwierdzenia. |
| Plakietka stanu | `badge()` / `state()` | zawsze ikona + słowo (OK/Uwaga/Błąd), nigdy sam kolor. |
| Wiek danych | `age(date, everyMin, source)` | „dane z 14:32” (zegar) albo „nieaktualne · dane z 13:05” (trójkąt, `--warn`); w `title` źródło i interwał. |
| Pusty stan | `.empty` | ikona, jedno zdanie, co dalej („Kolejka pusta. Nowe zgłoszenia pojawią się tutaj”). |
| Paleta poleceń | `#palette` | Ctrl/⌘+K; wyszukiwanie bez polskich znaków po akcjach, modułach, filmach, osobach, płatnościach; akcje kontekstowe dla otwartego obiektu na górze; skróty wypisane przy pozycjach; strzałki + Enter. |

## 4. Wizualizacja danych

- **Forma:** pojedyncza liczba → kafel; trend w czasie → linia z porównaniem; kategorie → poziome słupki z liczbami; rozkład w czasie dnia → mapa ciepła; godziny/dni z limitem → słupki z linią odniesienia; retencja → linia + pasmo „typowy film kanału”.
- **Porównanie zawsze to samo, globalne** (poprzedni okres / rok wcześniej / brak), szare i cieńsze od bieżącego okresu.
- **Adnotacje wdrożeń i zdarzeń** z osi zmian (deploy, publikacja, rozsyłka, incydent, notatka) na każdym wykresie czasu; numerowane od lewej, zbliżone schodzą do drugiego rzędu.
- **Mała próba:** ostrzeżenie „Mała próba: n = 9” zamiast pewnej liczby.
- **Dostępność wykresu:** SVG `role="img"` z opisem wniosku, obszar wykresu fokusowalny (←/→/Home/End pokazują wartości), podpowiedź uzupełnia, nigdy nie zastępuje: każdy wykres ma „Tabela danych” (`<details>` z prawdziwą tabelą). Legenda dla ≥ 2 serii, tekst nigdy w kolorze serii.
- **Rysowanie bez szkieletu:** wykres liczy się synchronicznie w szerokości kontenera przed pierwszym malowaniem i przelicza przy zmianie rozmiaru (`ResizeObserver`).

## 5. Siatka i ekrany

- 12 kolumn, odstęp 16 px (12 px na telefonie), treść do 1680 px szerokości. Typowy układ: 8 + 4 (główna praca + kolumna stanu). Kafle: 6 w rzędzie od 1400 px, 3 poniżej, 2 na telefonie.
- Progi: ≥ 1400 szeroki, 1101–1399 pełny pasek boczny, 761–1100 pasek ikon, ≤ 1023 układ 8 + 4 składa się w jedną kolumnę, ≤ 760 telefon.
- **Telefon (390 px):** pasek boczny chowa się w szufladę („Więcej”), na dole 5 pozycji (Dzisiaj, Skrzynka z licznikiem, Treści, Przychody, Więcej), filtr okresu w drugim rzędzie paska, tabele jako karty, cele dotykowe ≥ 44 px, modal na całą szerokość, `safe-area-inset` dla iPhone'a.

## 6. Dostępność (WCAG 2.2 AA)

Link „Przejdź do treści”; fokus po zmianie ekranu na nagłówku `h1`; widoczny pierścień 2 px z odstępem 2 px (kontrast ≥ 3:1 na każdym tle); nawigacja klawiaturą wszędzie; skróty jednoliterowe działają tylko poza polami tekstowymi i oknami (2.1.4); odświeżanie na żywo z przyciskiem „Wstrzymaj” (2.2.2); kolor nigdy jedynym nośnikiem (1.4.1); `forced-colors` i druk obsłużone; język strony `pl`.

**Skróty:** `Ctrl/⌘ K` paleta · `?` lista skrótów · `g` + litera moduł (d, a, t, s, p, k, y, b, l, `,`) · `/` szukaj na liście · `[` `]` krótszy/dłuższy okres · w moderacji `j`/`k`, `h` ukryj, `z` zostaw, `w` wycisz · `Esc` zamknij.

## 7. Zakazane

- szkielety ładowania, migające liczniki, spinnery przy wejściu na ekran;
- ozdobne gradienty, szkło, neon, cienie pod kartami, wykresy 3D, kołowe i pierścieniowe, podwójne osie Y;
- więcej niż 3 kolory kategorii na jednym wykresie (dalej: „Inne” albo małe wielokrotności); kolory stanów jako kolory serii;
- tekst mniejszy niż 12 px, surowe enumy w interfejsie (`PUBLISHED` → „Opublikowany”), mieszanie polskiego z angielskim;
- emoji jako ikony (tylko własny zestaw SVG z obrysem 1,75 px);
- atrapy funkcji i filtrów, które nic nie robią (lepiej nie pokazać);
- wywołania Cloudflare/Stripe/Resend w czasie renderu ekranu, zewnętrzne skrypty, czcionki i CDN;
- czerwony przycisk dla działania, które nie jest nieodwracalne; okno potwierdzenia dla działania, które da się cofnąć (wtedy toast z „Cofnij”).

## 8. Przeniesienie do kodu (Tailwind 4 + shadcn/ui)

Tailwind 4 konfiguruje się w CSS: zmienne w `@theme` generują klasy (`--color-surface` → `bg-surface`), a ciemny motyw przełącza się wariantem `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` plus `prefers-color-scheme`. Proponowane mapowanie (semantyczne tokeny shadcn/ui wskazują na tokeny prototypu, więc komponenty shadcn/Base UI dziedziczą wygląd bez zmian):

```css
@import "tailwindcss";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

:root { --bg:#f6f6f4; --surface:#fff; --surface-2:#f1f1ee; --text:#17171a; --text-2:#4f4d48; --text-3:#67655f;
        --accent:#1f62d0; --accent-text:#1d5bc2; --border:#e2e1dc; --border-input:#8a8882; /* … reszta z sekcji 2 */ }
[data-theme=dark] { --bg:#0e0e10; --surface:#161619; /* … */ }

@theme inline {
  --color-background: var(--bg);          --color-foreground: var(--text);
  --color-card: var(--surface);           --color-card-foreground: var(--text);
  --color-popover: var(--surface);        --color-popover-foreground: var(--text);
  --color-primary: var(--accent);         --color-primary-foreground: var(--on-accent);
  --color-secondary: var(--surface-2);    --color-secondary-foreground: var(--text);
  --color-muted: var(--surface-2);        --color-muted-foreground: var(--text-3);
  --color-accent: var(--selected);        --color-accent-foreground: var(--text);
  --color-destructive: var(--crit-solid);
  --color-border: var(--border);          --color-input: var(--border-input);   --color-ring: var(--focus);
  --color-ok: var(--ok);  --color-warn: var(--warn);  --color-crit: var(--crit);
  --color-chart-1: var(--series-1); --color-chart-2: var(--series-2); --color-chart-3: var(--series-3); --color-chart-compare: var(--compare);
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  --ease-standard: cubic-bezier(.2,0,0,1);
}
```

- shadcn/ui `Table`, `Dialog`, `Command` (paleta), `Tabs` jako linki z `aria-current`, `Badge`, `Sonner` (toasty) pokrywają komponenty z sekcji 3; `Command` dostaje grupy i skróty jak w prototypie.
- Wykresy: własne komponenty SVG według `charts.js` (lekkie, bez zależności) albo Recharts/visx z tymi samymi tokenami i regułami z sekcji 4; tabela danych pod każdym wykresem zostaje obowiązkowa.
- Ekrany jako Server Components czytające agregaty i migawki; brak `loading.tsx` ze szkieletem; wiek danych przychodzi razem z danymi (`fetchedAt`).

## 9. Źródła

- Tailwind CSS v4: tokeny w `@theme`, CSS-first — https://tailwindcss.com/blog/tailwindcss-v4 ; ciemny motyw przez `@custom-variant` — https://tomodahinata.com/en/blog/tailwind-css-v4-css-first-design-tokens-production-guide
- Linear: motywy generowane w LCH z 3 parametrów (baza, akcent, kontrast), „spokojniejszy interfejs” — https://linear.app/now/how-we-redesigned-the-linear-ui , https://linear.app/now/behind-the-latest-design-refresh
- Vercel Geist: monochromatyczna baza, cyfry tabelaryczne w liczbach — https://www.designsystems.one/design-systems/vercel-geist
- Dostępne wykresy (tabela jako alternatywa, 1.1.1, 1.4.1, 1.4.11, fokus) — https://accessibility.build/guides/accessible-charts , https://analysisfunction.civilservice.gov.uk/policy-store/charts-a-checklist/
- KPI: porównanie z poprzednim okresem, trend, „ostatnia aktualizacja” na każdej karcie — https://www.clearpointstrategy.com/blog/kpi-dashboard-best-practices , https://5of10.com/articles/dashboard-design-best-practices/
- Wzorce produktów (Plausible, Stripe, Mux, Grafana, Linear Cmd+K) i katalog funkcji: dokumenty badawcze ścieżek 1–3 (audyt, katalog funkcji, architektura) z 2026-10-04.
