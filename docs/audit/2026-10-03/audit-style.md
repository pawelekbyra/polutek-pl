# Audyt spójności wizualnej: publiczna część pawelperfect.com

> Stan po naprawach: patrz `RESULT-www-fixes.md` (znaleziska naprawione lub nieaktualne zostały usunięte z tego pliku).

Data: 2026-10-03. Repo: worktree `dns-migration-cloudflare-bcfaf0`, commit `88c787d0` (main). Produkcja: https://www.pawelperfect.com.
Zakres: wszystko publiczne poza `app/admin/**`. Kokpit premiery (`coming-soon/*`), bramka „Follow the white rabbit" (`preload/Matrix*`) i ściana graffiti są celowymi wyjątkami: wyłączyłem je z inwentarza wartości, ale nie z kontroli stanów (focus, ruch).
Tryb: tylko do odczytu. Niczego nie zmieniałem w repo.

**Metoda i ograniczenia**
- Kod: skrypt inwentaryzujący klasy Tailwind w 163 plikach publicznych (`app/components/**`, `app/[locale]/**`, `app/*.tsx`, `components/**`), plus ręczny przegląd modułów CSS i `app/globals.css`.
- Na żywo: własna karta przeglądarki, gość, `/pl` i `/en`, szerokości 375, 768, 1280 i 1920 px, schemat jasny i ciemny. Pomiary przez `getBoundingClientRect`/`getComputedStyle`. Kartę zamknąłem.
- Ograniczenia:
  - Bramki napiwkowej (SupportModal) nie da się otworzyć jako gość, bo „Wspieraj" otwiera logowanie. Oceniam ją z kodu.
  - Na produkcji nie było żadnych odpowiedzi do komentarzy. Odstępy odpowiedzi wyliczyłem z kodu, potwierdzając na żywo, że `space-y-*` w Tailwind 4 daje `margin-bottom` (zmierzone `margin-bottom: 22px` na wrapperze komentarza).
  - W panelu podglądu animacje dialogów stały na pierwszej klatce (skala 0,95), więc wymiary modala logowania podaję z wartości obliczonych CSS, a nie z prostokątów.
  - Strona YouTube nie wyrenderowała się w panelu (throttling). Wartości referencyjne YouTube są orientacyjne (inspekcja DevTools, znana budowa `ytd-comment-thread-renderer`), w tej sesji niezweryfikowane.

---

## 1. Podsumowanie i ocena

**Ocena ogólna: 6/10.** Warstwa kolorów (tokeny `--chan-*`) jest solidna, a kluczowe akcje pod filmem mają spójną wysokość 36 px. Rytm, typografia i ramy komponentów są jednak budowane „z ręki": każdy komponent ma własne wartości w px. Skutki:

- **197 różnych klas odstępów**, 35 rozmiarów czcionki (w tym 12,5 px, 11,5 px i 8 px), 21 wartości trackingu, ok. 14 różnych promieni (12 px zapisane na 3 sposoby: `rounded-lg`, `rounded-xl`, `rounded-[12px]`), 63 różne cienie, z czego 55 to jednorazowe literały.
- **Komentarze mają rozjechany rytm.** Wewnątrz komentarza odstępy wynoszą 2 px, między komentarzami 40 px pustki (48 px wizualnie). Skok na komentarz to **114 px** przy jednolinijkowym tekście, a w YouTube ok. 92–96 px. Zgłoszenie właściciela jest trafne.
- **Ukryta druga warstwa stylów.** `app/components/watch-actions.module.css` nadpisuje klasy z TSX przez selektory strukturalne i atrybutowe z `!important`, np. `div[class~="space-y-[24px]"] > div:has(form)` czy `section > div > div:nth-child(2) > div > div:nth-child(2)`. Część wartości widocznych w TSX jest martwa (np. `mb-10`, `mb-[14px] sm:mb-[20px]`, `sm:space-y-[30px]`, `pt-[9px] pb-[9px]`, `tracking-[0.16em]`). To główny powód, dla którego „poprawki odstępów" bywają nieskuteczne lub psują coś obok.
- **Trzy rodziny modali bez wspólnej ramy.** Promienie 16, 20, 22 i 24 px, przyciski zamykania 32 px (znak „✕") albo 40 px (ikona X), tytuły 20, 24 lub 24 px w trzech różnych grubościach i trackingach.
- **Focus-visible: sześć różnych stylów.** Modale portalowane do `body` (logowanie, konto) są poza zasięgiem globalnej reguły focusu, a pola logowania mają `outline-none` i tylko zmianę koloru obramowania o grubości 1 px.
- **Tokeny ruchu (`--motion-*`, `--ease-*`) są zdefiniowane, ale użyte 0 razy.** W użyciu jest 8 czasów w klasach Tailwind i ok. 15 w CSS.
- **Tryb ciemny nie istnieje.** Zero reguł `prefers-color-scheme` i brak `color-scheme: light`. To spójne (zawsze jasno), ale niezadeklarowane.

---

## 2. Inwentarz wartości na osiach

Źródło: skrypt po klasach Tailwind w 163 plikach publicznych (bez kokpitu i bramki Matrix). Pełny zrzut: `scratchpad/inv.txt`.

### 2.1 Odstępy (padding/margin/gap/space)
- 197 różnych klas. Dominują wartości ze skali 4 px: `gap-2` (46), `px-3`/`px-4` (43), `gap-3` (41), `py-2` (37), `space-y-2` (33).
- Wartości spoza skali 4/8 px:

| Wartość | Użycia | Gdzie |
|---|---|---|
| `gap-[13px]` | 3 | `CommentItem.tsx:159`, `Hero.tsx:244` |
| `py-[18px]` | 1 | `CommentItem.tsx:159` (komentarz) |
| `space-y-[22px]` | 3 | `EmbeddedComments.tsx:438, 489, 509` |
| `space-y-[2px]` | 1 | `CommentItem.tsx:188` |
| `gap-[6px]` | 2 | `CommentItem.tsx:392`, `NotificationsMenu.tsx:157` |
| `py-[26px]`, `gap-[26px]`, `gap-[14px]` | 3 | `Footer.tsx:21, 30` |
| `space-y-[30px]`, `mb-[30px]` | 2 | `EmbeddedComments.tsx:315` (martwe, patrz STY-03) |
| `pt-[9px] pb-[9px]` | 2 | `Hero.tsx:376` (martwe, nadpisane na 12 px) |
| `p-[22px_24px_18px]`, `my-[10px]`, `m-[0_0_14px]`, `p-[9px_14px]` | 4 | `DonationBox.tsx:149, 175`, `DonationAmountField.tsx:41` |
| `px-[5px]`, `py-[1px]`, `mt-[1px]`, `mt-[3px]`, `py-[3px]` | 6 | odznaki PATRON, czas trwania, Hero |
| `pl-13` (52 px), `ml-[19px]` | 1 | `EmbeddedComments.tsx:509` (odpowiedzi) |

### 2.2 Rozmiary czcionek (35 wartości)

| Wartość | Użycia | Uwagi |
|---|---|---|
| `text-sm` (14) / `text-[14px]` | 58 / 34 | ta sama wartość na dwa sposoby |
| `text-[12px]` / `text-xs` (12) | 57 / 35 | jw. |
| `text-[13px]` | 55 | |
| `text-[11px]` | 27 | etykiety uppercase |
| `text-[15px]` | 16 | |
| `text-[10px]` | 11 | |
| **`text-[12.5px]`** | 4 | `Hero.tsx:264`, `Footer.tsx:13` (poza skalą) |
| **`text-[11.5px]`** | 1 | `LanguageSwitcher.tsx:141` |
| **`text-[9px]`** | 3 | |
| **`text-[8px]`** | 2 | `CommentItem.tsx:183` (PATRON), `NotificationsMenu.tsx:103` |
| 16/18/20/21/22/24/26/28/30/34/40/42/44/120 px | po 1–4 | nagłówki, każdy komponent ma własny |

Grubości: `bold` 140, `semibold` 35, **`black` 30**, `extrabold` 19, `medium` 19.
Wysokość linii: 16 wartości (`leading-none`, `tight`, `snug`, `relaxed`, 1.05, 1.15, 1.16, 1.2, 1.4, 1.5, 1.55, 1.6, 1.65, 1.7, `leading-5`, `leading-6`).
Tracking: **21 wartości**. Dla samych etykiet uppercase: 0.08em (`LanguageSwitcher.tsx:111`), 0.1em, 0.12em (`SupportModal.tsx:262`), 0.14em (`ChannelHome.tsx:353`, `LegalDocs.tsx:27`), 0.15em, 0.16em (`SidebarPlaylist.tsx:300`, nadpisane w CSS na 0.09em), 0.18em, 0.2em, 0.22em (`Footer.tsx:24`), 0.25em, 0.35em, `wider`, `widest`.

### 2.3 Promienie (realne px; `lg` = `xl` = 12, `md` = 10, `2xl` = 16, `3xl` = 24 według `tailwind.config.ts:95-99`)

| px | Zapisy | Uwagi |
|---|---|---|
| 12 | `rounded-xl` 44, `rounded-lg` 30, `rounded-[12px]` 25 | trzy zapisy jednej wartości |
| 10 | `rounded-md` 24, `[10px]` 1 | |
| 14 | `[14px]` 15 | kafelki playlisty, przyciski bramki |
| 16 | `2xl` 18, `[16px]` 9 | modale logowania i konta |
| 18 | `[18px]` 6 | opis pod filmem |
| 20 | `[20px]` 4 | dialog prawny w bramce |
| 22 | `[22px]` 4 | media w Hero, modal zgody e-mail |
| 24 | `3xl` 3, `[24px]` 8 | karta komentarzy, sidebar, bramka |
| 26 | `[26px]` 2 | karta Hero |
| 13, 19, 4, 8 | po 1–4 | `LanguageSwitcher` 19/18, odznaki 4 |
| full | 89 | |

### 2.4 Cienie
63 różne wartości, w tym **55 jednorazowych literałów** `shadow-[...]` z różnymi bazami koloru: `rgba(23,23,23,…)`, `rgba(15,23,42,…)`, `rgba(17,24,39,…)`, `rgba(15,15,15,…)` i tokeny `--cm-*`. Nie ma tokenów cienia, poza jednym `--chan-support-shadow`.

### 2.5 Kolor
- Tokeny bazowe `--chan-*`: 20. Pochodne `--cm-*` (color-mix): **ok. 110**, w tym duplikaty: `--cm-blue-22` i `--cm-blue-22-2`, `--cm-line-76` i `--cm-line-76-2`, `--cm-card-90-white` i `--cm-card-90-white-2`.
- Literały palety Tailwind poza tokenami: `text-red-600` 19, `bg-red-50` 9, `neutral-*` 15, `green-500/600` 4, `blue-400/600` 3 (`HomeExperience.tsx:168-195`). Literały hex w klasach: `components/ui/tabs.tsx:63` (`#dbeafe`, `#1748b8`, `#2563eb`).
- Dwie równoległe palety: `--chan-*` (hex) i shadcn HSL (`--primary`, `--muted-foreground` = #71717A, `--border` #E4E4E7). Strony 404, error i unsubscribe używają tej drugiej, więc mają inne szarości niż reszta.
- `tailwind.config.ts:38-47` definiuje `cream`, `charcoal`, `primary.dark`, a nawet fioletowy `secondary.dark: #6d28d9` spoza systemu.

### 2.6 Wysokości kontrolek (zmierzone na żywo)

| Element | Wysokość |
|---|---|
| Nawigacja: szukaj / język / WEJŚCIE (desktop) | 38 / 38 / 38 |
| Nawigacja mobile: szukaj / język / **WEJŚCIE** | 38 / 38 / **32** |
| Akcje pod filmem: Subskrajb / like / Szeruj / Wspieraj | 36 / 34 (36 z ramką) / 36 / 36 |
| Komentarz: like / dislike / Odpowiedz | 32 |
| Sortuj | 44 |
| CTA „Zaloguj się, aby dodać komentarz" | 44 |
| Modal logowania: przyciski / **pola** / zamknij | 44 / **≈39** / 32 |
| Bramka napiwkowa: główny przycisk / wstecz / zamknij | 52 / 52 / 40 |
| Kontrolki odtwarzacza `.mc-btn` | 30 |
| Prymityw `Button` (shadcn): default / sm / lg | 36 / 32 / 40 |
| Menu języka (pozycja) / menu komentarza (pozycja) | 34 / 40 |

### 2.7 Ruch
- Klasy: `duration-160` 19, `200` 18, `300` 10, `150` 7, `100` 6, `500` 4, `700` 3, `1000` 1.
- CSS: .1/.12/.14/.15/.18/.2/.28/.38/.48/1.45 s oraz 250 ms.
- Sprężyny framer-motion: 3 różne konfiguracje.
- Tokeny `--motion-instant/fast/standard/slow` i `--ease-standard/enter/exit` (`globals.css:365-371`) mają **0 użyć**.
- `prefers-reduced-motion` obsługiwane w 27 plikach z 47 plików animujących. Główne miejsca (komentarze, Hero, bramka) są pokryte.

### 2.8 Z-index
17 wartości: 5, 6, 10, 20, 30, 50, 100, 1000, 1100, 1101, 9990–9993, 9998, 9999. Brak skali warstw.

### 2.9 Ikony
- Dwa zestawy:
  - własny `app/components/icons` (+ `NajsIcon`);
  - `lucide-react` w 15 plikach publicznych (Hero, Navbar, ShareButton, SubscribeButton, LanguageSwitcher, dialog/select/checkbox…).
- Ten sam kciuk „lubię" jest rysowany dwiema różnymi ikonami: `Hero.tsx:22,301` (lucide `ThumbsUp`, stroke 1.8) i `CommentItem.tsx:417` (`NajsIcon like`, stroke 2).
- Rozmiary `size={…}`: 12, 13, 14, 15, 16, 22, 24, 48… Grubości kreski: 1.8 (17×), 1.9, 2 (74×), 2.4, 2.8, 3, 3.2, 4.

### 2.10 Focus-visible (6 wariantów)
1. Globalny: `outline 3px rgba(37,99,235,.45) offset 3` (`globals.css:259-264`), działa tylko wewnątrz `.public-visual-shell`/`.channel-page-shell`.
2. `ring-2 ring-[var(--chan-blue)]` (± `ring-offset-2`): komentarze, dropdowny.
3. `ring-2 ring-[var(--chan-ink)]`: bramka napiwkowa.
4. `outline 3px var(--cm-blue-22-2) offset 2` z `!important`: `watch-actions.module.css:124-130`.
5. `ring-1 ring-ring`: `components/ui/button.tsx:8`.
6. `ring-[3px] ring-ring/50`: `badge.tsx`, `tabs.tsx`.

Pliki z elementami interaktywnymi i **zerem** jawnych stylów focus: `ShareButton.tsx` (10 elementów), `LegalDocs.tsx` (8), `AuthModal.tsx` (7), `SecuritySection.tsx` (6), `Navbar.tsx` (6), `Hero.tsx` (5), `AuthFormParts.tsx` (3), `Footer.tsx`, `not-found.tsx`, `error.tsx`, `reset-password/page.tsx`, `unsubscribe/page.tsx`.

---

## 3. Komentarze: pomiary i propozycja

### 3.1 Stan obecny (produkcja, 1280 px i 375 px, wartości identyczne)

| Pomiar | Wartość | Źródło |
|---|---|---|
| Skok między początkami kolejnych komentarzy (1 linia tekstu) | **114 px** | zmierzone |
| Wysokość komentarza | 92 px = 0 (pt) + 74 (treść) + 18 (pb) | `CommentItem.tsx:159` `py-[18px] first:pt-0` |
| Odstęp między komentarzami (margines) | 22 px | `EmbeddedComments.tsx:438/489` `space-y-[22px]` |
| Pusta przestrzeń: dół wiersza akcji → nazwa następnego | **40 px** (18 + 22), wizualnie **48 px** (8 px pustego dołu przycisku 32 px) | |
| Nazwa → tekst | **2 px** (nazwa 13 px przy `line-height: 13px`, `leading-none`) | `CommentItem.tsx:190-193` |
| Tekst | 14 px / 21 px, #111827 | `CommentItem.tsx:380` |
| Tekst → akcje | 2 + 4 (`pt-1`) px | `CommentItem.tsx:392` |
| Przyciski akcji | 32 px, `px-2` | `CommentItem.tsx:410, 431` |
| Ikona „lubię" względem krawędzi tekstu | **przesunięta o 8 px w prawo** (ikona x=161, tekst x=153) | |
| Awatar / odstęp awatar–tekst | 38 px / 12–13 px (`gap-[13px]`, `px-1`) | `CommentItem.tsx:159, 173` |
| Odznaka PATRON pod awatarem | **8 px**, wys. 16 px | `CommentItem.tsx:183` |
| Separator między komentarzami | brak (`first:border-t-0` trafia w każdy komentarz, bo każdy jest pierwszym dzieckiem własnego `CommentMotionItem`) | `CommentItem.tsx:159` + `EmbeddedComments.tsx:489` |
| Nagłówek „11 komentarzy" | 15 px/700, sortowanie 44 px | `EmbeddedComments.tsx:346, 354` |
| Nagłówek → pole/CTA | 16 px (z `watch-actions.module.css:188`, nie z TSX) | |
| Pole/CTA → pierwszy komentarz | 24 px (z `watch-actions.module.css:193`) | |

**Odpowiedzi** (z kodu, `EmbeddedComments.tsx:509` + `CommentItem.tsx:159`):
- komentarz → pierwsza odpowiedź: 18 (pb) + 22 (margines zwinięty z `mt-4`) = **40 px**;
- odpowiedź → kolejna odpowiedź: 18 + 22 + 1 (border) + 18 = **59 px z linią podziału**. Odpowiedzi mają separatory, a komentarze główne nie: odwrotnie niż oczekiwany rytm;
- awatar odpowiedzi 38 px, czyli tyle samo co rodzica (YouTube: 24 px);
- pionowa linia wątku na x=19 px, a środek awatara rodzica na x=23 px: linia przesunięta o 4 px;
- tekst odpowiedzi wcięty o 72 px względem tekstu rodzica (`ml-[19px]` + `pl-13` 52 px + 4 + 38 + 13).

**Pole komentarza (zalogowany)**: awatar 40 px + `gap-5` (20) daje tekst na x=60. W komentarzach tekst stoi na x=55 (4 + 38 + 13), więc **jest rozjazd 5 px między polem a listą** (`CommentComposer.tsx:124, 130`).

**Diagnoza.** Proporcja odstępu wewnętrznego do zewnętrznego wynosi ok. 2 : 40. Komentarz rozpada się na „unoszące się" wiersze, a lista wygląda na rzadką. Do tego dochodzą wbudowane 8 px pustego dołu przycisku 32 px. Przy jednolinijkowych komentarzach (dominujący przypadek) ponad 40% wysokości listy to pustka.

### 3.2 Wzorce (orientacyjnie)
- **YouTube (desktop, `ytd-comment-thread-renderer`)**:
  - awatar 40 px, odstęp awatar–treść 16 px;
  - autor 13 px w linii ok. 18 px, tekst 14 px / 20 px;
  - pasek akcji: przyciski 32 px, ok. 4 px nad nimi;
  - odstęp między wątkami ok. 16 px, bez linii;
  - odpowiedzi: awatar 24 px, wcięcie do kolumny tekstu rodzica;
  - skok przy jednej linii ok. 92–96 px.
- **Twitch (czat)**: 13–14 px, ok. 4–5 px między wiadomościami. To inny gatunek, tylko jako dolna granica gęstości.
- **Vimeo**: awatar ok. 32–40 px, odstęp między komentarzami ok. 16–24 px.
- Zasada ogólna (gestalt bliskości): odstęp wewnątrz elementu powinien być wyraźnie mniejszy od odstępu między elementami, typowo 1 : 2 do 1 : 4, a nie 1 : 20.

### 3.3 Propozycja (konkretne wartości)

| Element | Jest | Ma być | Uzasadnienie |
|---|---|---|---|
| Padding komentarza | `py-[18px] first:pt-0` | `py-0` | rytm niesie lista, nie element |
| Odstęp między wątkami | 22 px + 18 px pb = 40 px | **16 px** (`space-y-4`, bez separatorów) | YouTube 16 px; skala 8 px |
| Skok (1 linia) | 114 px | **≈92 px** (18 + 2 + 20 + 4 + 32 + 16) | −19%, poziom YouTube |
| Nazwa: line-height | 13 px | 18 px (`leading-[18px]`) | nazwa nie „klei się" do tekstu; 13 px pismo potrzebuje ok. 1,4 |
| Nazwa → tekst | 2 px | 2 px (efektywnie +5 px dzięki interlinii) | |
| Tekst | 14 / 21 px | 14 / 20 px | siatka 4 px |
| Tekst → akcje | 6 px | 4 px (`mt-1`) | |
| Akcje | `h-8 px-2`, ikona +8 px od krawędzi | `h-8 px-2` + **`-ml-2`** na grupie | ikona w linii z tekstem, cel dotykowy bez zmian |
| Awatar | 38 px | **40 px** (jak pole komentarza) | siatka 8 px, jeden rozmiar |
| Awatar → tekst | `px-1` + 13 px | 0 + **12 px** | kolumna tekstu na x=52 |
| Pole komentarza | awatar 40 + `gap-5` (20) | awatar 40 + **`gap-3` (12)** | tekst pola = tekst listy (x=52) |
| Odpowiedzi: awatar | 38 px | **24 px** | hierarchia rodzic/dziecko |
| Odpowiedzi: wcięcie | `ml-[19px] pl-13` + linia | bez linii; wiersze od **x=52** (kolumna tekstu rodzica), `pl-[52px]` | jak YouTube, bez 4-px rozjazdu linii |
| Komentarz → pierwsza odpowiedź | 40 px | **8 px** (`mt-2`) | odpowiedzi należą do rodzica |
| Między odpowiedziami | 59 px + linia | **12 px**, bez linii | |
| Odznaka PATRON | 8 px pod awatarem | **10 px** (min. 11 px przy uppercase), **inline po nazwie** (`h-4 px-1.5 rounded`) | 8 px jest nieczytelne; awatar nie zmienia wtedy wysokości |
| Nagłówek → pole | 16 px (ukryte w CSS) | 16 px, ale w TSX (`gap-4` na kolumnie) | jedno źródło prawdy |
| Pole → lista | 24 px (ukryte w CSS) | 24 px w TSX | |
| „Pokaż więcej" | `pt-6` + `h-4` sentinel | `mt-4`, sentinel `h-px` | |

Implementacja:
- `EmbeddedComments.tsx:315`: zamienić na `flex flex-col gap-4`;
- `:438, 489`: `flex flex-col gap-4`;
- `:509`: `mt-2 flex flex-col gap-3 pl-[52px]`, bez `border-l`/`ml-*`;
- `CommentItem.tsx:159`: `flex items-start gap-3` bez `py/border`, avatar `size={isReply ? 24 : 40}`;
- usunąć reguły `watch-actions.module.css:183-201`, żeby TSX był jedynym źródłem.

---

## 4. Znaleziska

Skala: P1 widoczne / psujące system; P2 spójność średnio widoczna; P3 kosmetyka i higiena. Nakład: S ≤ 1 h, M ≤ 1 dzień, L > 1 dzień.

| ID | Waga | Element | Plik:linia | Stan obecny | Propozycja | Nakład |
|---|---|---|---|---|---|---|
| STY-01 | P1 | Rytm listy komentarzy | `CommentItem.tsx:159`, `EmbeddedComments.tsx:438, 489` | skok 114 px; wewnątrz 2 px, między 40 px (+8 px pustki przycisku) | skok ≈92 px: `py-0`, `gap-4` (16), nazwa lh 18, tekst 14/20 (sekcja 3.3) | S |
| STY-02 | P1 | Odpowiedzi | `EmbeddedComments.tsx:509`, `CommentItem.tsx:159, 172` | rodzic→odp. 40 px, odp.→odp. 59 px z linią; awatar 38; linia wątku 4 px obok środka awatara; wcięcie tekstu 72 px | `mt-2`, `gap-3`, bez linii, awatar 24, `pl-[52px]` | S |
| STY-03 | P1 | Ukryta warstwa nadpisań | `watch-actions.module.css:12, 139-201, 159-162, 165-180, 204-252` | selektory `[class~="space-y-[24px]"]`, `nth-child`, `!important`; martwe klasy w TSX: `EmbeddedComments.tsx:124 mb-10`, `:315 sm:space-y-[30px] mb-[30px]`, `:344 mb-[14px] sm:mb-[20px]`, `Hero.tsx:236 mb-2`, `:376 mt-2 pt-[9px] pb-[9px]`, `SidebarPlaylist.tsx:300 tracking-[0.16em] text-muted-2` | przenieść wartości do TSX (komentarze 16/24, opis 12/12, metaRow 12, kafelki gap 10), usunąć selektory strukturalne; moduł zostawić tylko dla stylów ramek akcji | M |
| STY-04 | P1 | Wyrównanie akcji komentarza | `CommentItem.tsx:392-394` | ikona „lubię" 8 px na prawo od krawędzi tekstu | `-ml-2` na grupie przycisków | S |
| STY-05 | P1 | Odznaka PATRON | `CommentItem.tsx:183`, `SidebarPlaylist.tsx:248`, `NotificationsMenu.tsx:103` | 8 px uppercase, poniżej czytelności | 10–11 px, inline obok nazwy; jeden komponent `Badge` | S |
| STY-06 | P1 | Ramy modali | `AuthModal.tsx:254, 258`; `AccountModal.tsx:46`; `OnboardingDialog.tsx:87`; `EmailSubscriptionConsentModal.tsx:40`; `SupportModal.tsx:257, 278`; `TipLegalDialog.tsx:38, 47`; `DonationLegalDialog.tsx:31, 33`; `ReportDialog.tsx:41` | promienie 16/16/16/22/24/20/12(shadcn); zamknięcie 32 px ze znakiem „✕" font 18/900 (Auth) vs 40 px ikona X 20 px (bramka, prawne) vs shadcn 36 px; tytuły 24/700 −0.6 px, 24/800 −0.035em, 20/800 −0.02em, 24/900 uppercase −0.05em (`DonationLegalDialog`), 20/700 (Onboarding, zgoda); tła overlay 10% + blur 4 px, 30%, 40% + blur 8 px | jeden `ModalFrame`: promień 24 (mobile pełny ekran 0), zamknięcie 40 px ikona X 20 px w rogu `top-3 right-3`, tytuł 22/700 −0.02em, padding 24, overlay `rgba(17,24,39,.4)` + blur 4 px, wejście 220 ms `--ease-enter` | M |
| STY-09 | P2 | Typografia pod filmem | `Hero.tsx:390` (opis 12/18), `watch-actions.module.css:159-162` (13/1.65 na rail akcji przez `nth-child`) | opis 12 px mniejszy niż komentarze (14 px) i równy metadanym | opis 14/20 (`--text-body`), metadane 12/16 | S |
| STY-10 | P2 | Kafelki playlisty | `SidebarPlaylist.tsx:254, 257`; `watch-actions.module.css:214, 242` | tytuł 12 px/700 = meta 12 px (słaba hierarchia); aktywny kafelek 98 px vs 100 px (ramka 1 px → 0), skok 2 px przy wyborze | tytuł 13/18 700, meta 12/16; aktywny `border-color` zamiast `border:0` | S |
| STY-11 | P2 | Promienie zagnieżdżone | `Hero.tsx:220, 222`; tile `SidebarPlaylist.tsx` (14 / miniatura 12, padding 8) | karta 26 / padding 12 / media 22 (koncentrycznie 14); kafelek 14/8/12 (koncentrycznie 6) | reguła `r_in = r_out − padding`: karta 24 → media 12; kafelek 16 → miniatura 8 | S |
| STY-12 | P2 | Skala promieni | sekcja 2.3 | ok. 14 wartości, 12 px w 3 zapisach | 4 tokeny: `--radius-sm 8`, `--radius-md 12`, `--radius-lg 16`, `--radius-xl 24`, + `full` | M |
| STY-14 | P2 | Pola vs przyciski (logowanie) | `AuthFormParts.tsx:35` vs `:72, :92` | pole ≈39 px (`py-2` + 15 px), przyciski 44 px | pole `h-11` (44) | S |
| STY-15 | P2 | Przycisk prymitywny vs własne | `components/ui/button.tsx:8-26` vs `AuthFormParts.tsx:72`, `TipStepLayout.tsx:70`, `Hero.tsx:356` | shadcn 36 px / radius 10 / `ring-1`; własne 44 r12, 52 r14, 36 r12 | warianty `Button`: `sm 32`, `md 36`, `lg 44`, `xl 52`; radius 12 dla wszystkich prostokątnych | M |
| STY-18 | P2 | Etykiety uppercase | sekcja 2.2 | 11–12 px, tracking 0.08–0.35em (13 wartości), grubość 700/800/900 | jeden styl `--label`: 11 px / 600–700 / 0.08em | S |
| STY-19 | P2 | Nagłówki stron | `Hero.tsx:236` (30/700, −0.021em), `regulamin/page.tsx:23` (30/900 uppercase −0.05em), `LegalDocs.tsx:15` (18/900 uppercase), `not-found.tsx:11` (24/900 uppercase), `unsubscribe/page.tsx:16` (30/900), `reset-password/page.tsx:40` (20/700), `TipStepLayout.tsx:80` (24/800 −0.035em) | 5 stylów H1, mieszanie 700/800/900 i uppercase | H1 30/36 700 −0.02em (mobile 22/28); H2 20/28 700; H3 15/20 700; uppercase tylko dla etykiet | M |
| STY-20 | P2 | Długość linii dokumentów prawnych | `regulamin/page.tsx:21` `max-w-3xl`, `LegalDocs.tsx:19` 15/1.7 | ok. 716 px ≈ **95 znaków** na linię | `max-w-[68ch]` dla treści (WCAG 1.4.8 ≤ 80, optimum 45–75) | S |
| STY-21 | P2 | Siatka: nav vs treść | `Navbar.tsx:106` (pełna szerokość, `px-8`), `ChannelHome.tsx:327` (`max-w-[1180px] px-8`), `Footer.tsx:21` (`max-w-[1180px] px-6`) | przy 1280: logo x=32, treść x=77 (45 px rozjazdu); przy 1920: 32 vs 397 (**365 px**); stopka 8 px obok treści | wspólny kontener `max-w-[1180px] px-4 md:px-6 lg:px-8` w nav, treści i stopce | S |
| STY-22 | P2 | Odstępy w siatce głównej | `ChannelHome.tsx:328` (`gap-5 xl:gap-6`), `:374` (`lg:mt-5`, nadpisane 20 px) | poziomo 24 px, pionowo 20 px | jeden gutter 24 px (`gap-6`) | S |
| STY-23 | P2 | Dwie ikony „lubię" | `Hero.tsx:22, 301` (lucide, 1.8) vs `CommentItem.tsx:417` (`NajsIcon`, 2) | różny rysunek tej samej akcji | jeden zestaw (własny) i stroke 1.75–2 globalnie | S |
| STY-24 | P2 | Dwa zestawy ikon | 15 plików z `lucide-react` | mieszane kształty i grubości kresek (1.8–4) | zmapować używane ikony lucide do `app/components/icons`; stroke 2 (1.75 przy 20+ px) | M |
| STY-25 | P2 | Tokeny ruchu nieużywane | `globals.css:365-371` | 0 użyć; czasy 100–1000 ms i 15 wartości w CSS | używać `--motion-fast 160` (hover), `--motion-standard 220` (wejścia), `--motion-slow 360` (modale); usunąć `duration-700/1000` (`CommentItem.tsx:159` → 300 ms dla podświetlenia) | M |
| STY-26 | P2 | Akcje Hero na tablecie | `Hero.tsx:356` `flex-1`, `watch-actions.module.css:281-298` | przy 768 px „Wspieraj" zajmuje ok. 510 px szerokości, like/Szeruj po ok. 70–100 px | od `sm:` `flex-none` (szerokość treści) i `justify-start` | S |
| STY-27 | P2 | Kontrolki odtwarzacza | `globals.css:897-899` `.mc-btn` | 30×30 px (≥24 WCAG 2.5.8, < 44 zalecanych) | 40 px na dotyku (`@media (pointer:coarse)`), ikona bez zmian | S |
| STY-28 | P2 | Pole komentarza vs lista | `CommentComposer.tsx:124, 130` | tekst pola x=60, tekst komentarzy x=55 | awatar 40 + `gap-3` w obu (x=52) | S |
| STY-29 | P2 | Strony systemowe na innej palecie | `not-found.tsx`, `error.tsx`, `unsubscribe/page.tsx`, `reset-password/page.tsx:47,55` | shadcn `bg-primary`, `text-xs uppercase tracking-widest rounded-full`, tylko PL (404, error) lub tylko EN (unsubscribe) | te same tokeny `--chan-*`, przycisk `Button lg`, tekst wg języka | M |
| STY-30 | P3 | Literały cieni | sekcja 2.4 | 55 literałów, 4 bazy koloru | 4 tokeny: `--shadow-xs/sm/md/lg` + `--shadow-modal` na bazie `rgba(17,24,39,…)` | M |
| STY-31 | P3 | Pochodne `--cm-*` | `globals.css:383-495` | ok. 110 zmiennych, w tym 3 duplikaty | po migracji usunąć nieużywane i zduplikowane (`-2`) | M |
| STY-32 | P3 | Palety Tailwind poza tokenami | `EmbeddedComments.tsx:442-461` (red-50/100/600/700/900), `CommentComposer.tsx:301, 312`, `HomeExperience.tsx:168-195`, `tabs.tsx:63` | ok. 70 użyć | tokeny `--chan-danger` #b91c1c (5,9 : 1 na red-50), `--chan-danger-soft`, `--chan-success` | S |
| STY-33 | P3 | Z-index | sekcja 2.8 | 17 wartości, 9990–9999 | skala: `--z-nav 100`, `--z-dropdown 200`, `--z-modal 300`, `--z-modal-nested 310`, `--z-toast 400`, `--z-preloader 500` | S |
| STY-34 | P3 | Rozmiary pozaskalowe | `Hero.tsx:264` 12,5 px, `Footer.tsx:13` 12,5 px, `LanguageSwitcher.tsx:141` 11,5 px | | 12 px | S |
| STY-35 | P3 | Menu rozwijane | `LanguageSwitcher.tsx:199` (34 px, 11 px uppercase, r 19/18), `CommentItem.tsx:152, 225` (40 px, 14 px, r 16/12), `EmbeddedComments.tsx:398` (40 px, 12/700), `TipSelect.tsx:157` (52 px) | 4 style | pozycja 40 px, 14 px/500, kontener r 16, p 6, `--shadow-md` | M |
| STY-37 | P3 | Opis jako „przycisk" | `Hero.tsx:375-377` | klikalny `div` (bez klawiatury i focusu), kursor pointer na całej karcie | `button`/`aria-expanded` na „Pokaż więcej" | S |
| STY-38 | P3 | Konfiguracja Tailwind | `globals.css:7` `@config`, `tailwind.config.ts` | v4 z legacy JS config; martwe kolory (`cream`, `charcoal`, `secondary.dark #6d28d9`); `darkMode: "class"` bez wariantów | tokeny w `@theme` (Tailwind 4 zaleca CSS-first), usunąć martwe | M |
| STY-39 | P3 | Dokumentacja vs kod | CLAUDE.md (bramka „kanarkowy żółty #FFEF00") vs `globals.css:719-728` (`.tip-gate-surface` tło `--chan-card`, chipy szare) | opis nieaktualny | zaktualizować CLAUDE.md | S |
| STY-40 | P3 | Linki stopki | `Footer.tsx:13` | 12,5 px, wysokość celu 19 px (przechodzi wyjątkiem odstępu WCAG) | `py-1` (cel ≥ 24 px), 12 px | S |

Dodatkowo, poza stylem: nieistniejąca ścieżka `/pl/...` dla gościa przekierowuje na `/?signin=1&next=…`, a nie na 404, i przełączyła widok na EN. Strona `not-found` jest więc dla gościa praktycznie niewidoczna. Warto sprawdzić osobno.

---

## 5. Docelowe tokeny (mały zestaw, `@theme` w `globals.css`)

```css
@theme {
  /* Odstępy: tylko skala 4 px; nazwy semantyczne dla rytmu */
  --spacing: 4px;                 /* p-1=4, p-2=8, p-3=12, p-4=16, p-6=24, p-8=32 */
  --space-inline: 12px;           /* awatar–tekst, ikona–etykieta w przyciskach */
  --space-stack-tight: 4px;       /* wewnątrz elementu (tekst→akcje) */
  --space-stack: 16px;            /* między elementami listy (komentarze, kafelki: 8) */
  --space-section: 24px;          /* między sekcjami w karcie */
  --gutter: 24px;                 /* siatka strony, odstęp kart */

  /* Typografia (Geist) */
  --text-2xs: 11px;  --text-2xs--line-height: 16px;   /* etykiety uppercase, tracking .08em */
  --text-xs: 12px;   --text-xs--line-height: 16px;    /* meta, czasy, liczniki */
  --text-sm: 13px;   --text-sm--line-height: 18px;    /* nazwy, tytuły kafelków, UI */
  --text-base: 14px; --text-base--line-height: 20px;  /* treść komentarzy, opis */
  --text-md: 15px;   --text-md--line-height: 24px;    /* dokumenty, pola formularzy */
  --text-lg: 20px;   --text-lg--line-height: 28px;    /* H2, tytuły modali */
  --text-xl: 22px;   --text-xl--line-height: 28px;    /* H1 mobile */
  --text-2xl: 30px;  --text-2xl--line-height: 36px;   /* H1 desktop */
  /* grubości: 500, 600, 700; 800/900 tylko kokpit i bramka */

  /* Promienie */
  --radius-sm: 8px;  --radius-md: 12px; --radius-lg: 16px; --radius-xl: 24px;

  /* Cienie (jedna baza) */
  --shadow-xs: 0 1px 2px rgb(17 24 39 / .05);
  --shadow-sm: 0 4px 12px -4px rgb(17 24 39 / .10);
  --shadow-md: 0 14px 34px -16px rgb(17 24 39 / .30);   /* menu, popovery */
  --shadow-lg: 0 24px 50px -26px rgb(17 24 39 / .22);   /* karty strony */
  --shadow-modal: 0 30px 80px -30px rgb(17 24 39 / .45);

  /* Kolor (dodatki do --chan-*) */
  --chan-muted: #5d6679;           /* było #667085: 4,47 → ≈5,6 na surface */
  --chan-amber-text: #b45309;      /* tekst w akcencie wsparcia ≥ 4,5 : 1 */
  --chan-danger: #b91c1c;  --chan-danger-soft: #fef2f2;
  --chan-success: #15803d;
  --focus-ring: 0 0 0 2px var(--chan-card), 0 0 0 4px var(--chan-blue);

  /* Ruch */
  --motion-fast: 160ms;  --motion-standard: 220ms;  --motion-slow: 360ms;
  --ease-standard: cubic-bezier(.2,.8,.2,1);
  --ease-enter: cubic-bezier(.16,1,.3,1);
  --ease-exit: cubic-bezier(.4,0,1,1);

  /* Rozmiary kontrolek */
  --control-sm: 32px; --control-md: 36px; --control-lg: 44px; --control-xl: 52px;

  /* Warstwy */
  --z-nav: 100; --z-dropdown: 200; --z-modal: 300; --z-modal-nested: 310; --z-toast: 400; --z-preloader: 500;
}
```

Wyjątki celowe, poza tokenami:
- kokpit premiery (DSEG7/Oxanium, cyjan);
- bramka Matrix (monospace);
- ściana graffiti;
- bramka napiwkowa: zostaje czarny przycisk 52 px, ale z tokenów `--control-xl` i `--radius-md`.

---

## 6. Kolejność małych PR-ów (od najbardziej widocznych)

1. **Komentarze: rytm i wyrównania** (STY-01, 02, 04, 05, 28). Zmiany w `CommentItem.tsx`, `EmbeddedComments.tsx`, `CommentComposer.tsx` i usunięcie reguł `watch-actions.module.css:183-201`. Efekt: skok 114 → ≈92 px, odpowiedzi 8/12 px, PATRON czytelny. Nakład S–M.
2. **Usunięcie ukrytych nadpisań** z `watch-actions.module.css` (STY-03, 09, 10), z wartościami przeniesionymi do TSX: opis 14/20, kafelki 13/12, aktywny kafelek bez skoku 2 px. Nakład M.
3. **Focus wszędzie jednym stylem** (STY-07, 08, 37) plus `color-scheme: light` (STY-36). Nakład S.
4. **Kontrast** (STY-16, 17): `--chan-muted` #5d6679, `--chan-amber-text`. Nakład S, z przeglądem zrzutów.
5. **Nawigacja i siatka** (STY-13, 21, 22, 26, 40): WEJŚCIE 38 px, wspólny kontener 1180, gutter 24, „Wspieraj" bez rozciągania na tablecie. Nakład S.
6. **Wspólna rama modali** (STY-06, 14, 15): `ModalFrame` i warianty `Button` 32/36/44/52, pola 44 px. Najpierw logowanie, konto i onboarding, potem dialogi prawne, na końcu bramka. Nakład M.
7. **Typografia: skala i nagłówki** (STY-18, 19, 20, 34): tokeny `--text-*`, jeden styl etykiet, dokumenty `68ch`. Nakład M.
8. **Promienie i cienie** (STY-11, 12, 30): 4 promienie, 5 cieni, reguła koncentryczności. Nakład M.
9. **Ikony** (STY-23, 24): jeden zestaw, jedna grubość kreski. Nakład M.
10. **Ruch i warstwy** (STY-25, 33). Nakład S–M.
11. **Higiena** (STY-29, 31, 32, 35, 38, 39): strony systemowe na `--chan-*`, sprzątanie `--cm-*`, `@theme` zamiast `@config`, CLAUDE.md. Nakład M.

---

## Źródła
- WCAG 2.2, SC 2.5.8 Target Size (Minimum), 24×24 CSS px z wyjątkiem odstępu: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 1.4.8 (≤ 80 znaków) i optimum 45–75 znaków: https://accessibility.build/wcag/1-4-8 , https://baymard.com/blog/line-length-readability , https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/
- Tailwind CSS v4, tokeny w `@theme`, zmienna `--spacing`: https://tailwindcss.com/docs/theme
- Wzorzec wątku komentarzy (awatar 40, margines 12–16, odpowiedzi w kolumnie tekstu rodzica): https://codefronts.com/components/css-avatars/css-comment-thread-avatar-layout/ , https://ishadeed.com/article/spacing-in-css/
- Wartości YouTube/Vimeo/Twitch: orientacyjne, z inspekcji DevTools; w tej sesji nie dało się ich zmierzyć (strona nie wyrenderowała się w panelu podglądu).
- Kontrasty policzone wzorem WCAG 2.x (luminancja względna) dla par hex z `globals.css`.
