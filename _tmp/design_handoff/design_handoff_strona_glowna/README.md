# Handoff: Polutek.pl — Strona główna (styl + akcent)

## Overview
Dopracowany kierunek wizualny strony głównej Polutek.pl (kanał VOD jednego twórcy, układ typu YouTube: odtwarzacz + lista boczna + komentarze). Cel: spójny, spokojny system **ciepłej kremowo-grafitowej bazy z niebieskim jako jedynym, celowym akcentem** ("optymistyczny akcent wśród szarości"). To NIE jest redesign układu — układ zostaje taki jak w repo. To jest dyscyplina kolorystyczna + dopieszczenie detali.

## About the Design Files
Plik `Polutek Strona Glowna.dc.html` w tym pakiecie to **referencja projektowa stworzona w HTML** — prototyp pokazujący docelowy wygląd i zachowanie, a nie kod produkcyjny do skopiowania 1:1. Style są wpisane inline na potrzeby prototypu. Zadanie: **odtworzyć ten wygląd w istniejącym środowisku repo** (Next.js + React + Tailwind + TypeScript), używając jego komponentów, klas Tailwind i zmiennych CSS — nie wklejać HTML do aplikacji.

Otwórz plik w przeglądarce, żeby zobaczyć interakcje na żywo (PL/EN, like, subskrypcja, odliczanie do premiery).

## Fidelity
**High-fidelity.** Kolory, typografia, odstępy i stany są finalne. Odtwórz pixel-perfect, ale poprzez istniejące komponenty i tokeny repo (poniżej dokładne mapowanie).

---

## Najważniejsza obserwacja (przeczytaj najpierw)
Obecne `--primary` w `app/globals.css` to już niebieski: `221.2 83.2% 53.3%` (≈ `#2563EB`). **Niebieski jest już w systemie — problem jest w dwóch rzeczach:**
1. **Baza jest zimna/neutralna (neutral-50/300), a ma być ciepła kremowo-grafitowa.** Ociepl tokeny tła i obramowań.
2. **Niebieski musi być stosowany z dyscypliną** — tylko jako akcent "pozytywnego ruchu do przodu", nie rozsmarowany po całym UI.

Dzięki temu większość efektu uzyskasz zmieniając tokeny w `globals.css` + `tailwind.config.ts`, bez przepisywania komponentów.

---

## Design Tokens

### Kolory bazowe (ciepła kremowo-grafitowa paleta)
| Rola | Hex | Uwagi |
|---|---|---|
| Canvas / tło strony | `#F4F2EC` | ciepły kremowo-szary; zastępuje `bg-neutral-50` na stronie głównej |
| Powierzchnia (karty, inputy) | `#FFFFFF` | białe karty |
| Tło "wtórne" (opis, hover wiersza) | `#EBE8E0` | ciepły jasny szary (dziś `#ebebeb`) |
| Tło stopki / pasków | `#F0EDE6` | |
| Hairline / obramowanie | `#E2DED4` | ciepły border (dziś `neutral-300` zimny) |
| Obramowanie inputów/przycisków | `#D8D3C8` | mocniejszy hairline |
| Tekst główny | `#0F0F0F` / `#171717` | grafit |
| Tekst wtórny / meta | `#6B6B6B` | |
| Tekst wyciszony / placeholder | `#9A958B` | ciepły |

### Akcent (niebieski — jedyny kolor akcentowy)
| Rola | Hex / wartość |
|---|---|
| Accent (primary) | `#2563EB` (= obecne `hsl(221.2 83.2% 53.3%)`, zostaw) |
| Accent soft (tło badge/box) | `#EFF3FE` (mix accent + biały ~92%) |
| Accent ring (focus, obwódki) | `rgba(37,99,235,.18)` |

### Typografia (wszystko już w repo)
| Użycie | Font | Tailwind |
|---|---|---|
| Wordmark `polutek.pl` | Space Grotesk 700, `letter-spacing:-.03em` | `font-brand` (`--font-space-grotesk`) |
| Tytuły wideo, nagłówki | Outfit 600–700 | `font-heading` (`--font-outfit`) |
| UI / body / meta | Plus Jakarta Sans 400–700 | `font-sans` (`--font-jakarta`) |

Skala (px): tytuł wideo 23/700, nazwa twórcy 15.5/700, nagłówki sekcji listy 11/700 uppercase `letter-spacing:.2em`, tytuł karty wideo 14/600, meta 12.

### Promienie i cienie
- Promienie: odtwarzacz `14px`, karty/inputy duże `999px` (pill) dla przycisków nawigacji/akcji, miniatury `9px`, box patrona `16px`.
- Cień playera/kart: subtelny `0 1px 2px rgba(0,0,0,.06)`.
- Box patrona: `0 6px 22px rgba(37,99,235,.07)` (delikatna niebieska poświata).
- **Nie** używaj brutalistycznych twardych cieni (`shadow-brutalist`) w tym kierunku — zostają spokojne, miękkie hairline'y.

### Odstępy i marginesy (skala)
Skala bazowa 4px (Tailwind: `1`=4 `2`=8 `3`=12 `4`=16 `5`=20 `6`=24 `8`=32). Konkretne wartości użyte w projekcie:

**Layout strony**
| Element | Wartość |
|---|---|
| Kontener główny | `max-width:1180px`, wyśrodkowany |
| Padding main | `26px 22px 80px` (góra / boki / dół) |
| Grid lewa/prawa | `grid-template-columns: minmax(0,1fr) 372px`, `gap:34px` |
| Navbar | wys. `58px`, padding boczny `22px`, gap między blokami `16px` |
| Footer | padding `22px`, gap `14px` |

**Kolumna lewa (odtwarzacz + info)**
| Element | Wartość |
|---|---|
| Tytuł — margines | `18px` nad, `14px` pod (`margin:18px 0 14px`) |
| Wiersz autor↔akcje | `gap:14px`, między akcjami `gap:9px` |
| Avatar autora ↔ tekst | `gap:13px`; przycisk Subskrybuj `margin-left:6px` |
| Box opisu | `margin-top:16px`, padding `14px 16px`, wewn. odstęp meta↔tekst `7px` |
| Sekcja komentarzy | `margin-top:30px`; nagłówek pod `20px`; composer pod `26px`; odstęp między komentarzami `22px`; avatar↔treść `gap:13px` |

**Lista boczna (prawa)**
| Element | Wartość |
|---|---|
| Nagłówek sekcji | `padding-bottom:6px` + hairline, `margin-bottom:14px` |
| Karta wideo | padding `6px`, `gap:11px` (miniatura↔tekst), odstęp między kartami `4px` |
| Miniatura | `158×90px` |
| Tytuł karty ↔ meta | `margin:0 0 5px` |
| Box patrona | `margin:18px 0 26px`, padding `18px`; wewn. karta odliczania padding `12px 14px`, `margin-bottom:14px`; tekst opisu `margin-bottom:14px`; CTA wys. `44px`; podpis pod CTA `margin-top:9px` |

**Reguła ogólna:** odstępy pionowe między blokami treści `14–18px`, między sekcjami `26–34px`; wewnątrz kart/boxów padding `12–18px`. Trzymaj się skali 4px.

---

## Zasada akcentu (system — to jest sedno briefu)
Niebieski (`--primary`/`#2563EB`) pojawia się **wyłącznie** w tych miejscach:
- Przycisk Play na odtwarzaczu (+ animowana poświata `glow`) i pasek postępu wideo.
- **Aktywny** stan Lubię to / Nie lubię (`fill` + kolor) — domyślnie ikony są grafitowe.
- Badge **„Odblokowane"** na miniaturach na liście (badge „Publiczne" = czarny półprzezroczysty, „Patron/zablokowane" = grafit).
- Focus na inpucie wyszukiwania (`border` + `ring`).
- Znacznik „.pl" w wordmarku.
- Badge „Patron" przy autorze komentarza.
- **Box „Zostań patronem"**: ramka, miękkie tło `accent-soft`, liczby odliczania do premiery, przycisk CTA „Wesprzyj".

Pozostaje **grafitowe / neutralne** (NIE niebieskie): przycisk Subskrybuj (solidny grafit `#171717`), kłódki materiałów patronów, struktura, ikony nieaktywne. To utrzymuje niebieski jako "optymistyczny akcent", a nie kolor interfejsu.

---

## Screens / Views

### Strona główna — `app/page.tsx` → `ChannelHome` (grid 12: 8/4)

**1. Navbar** — plik `app/components/Navbar.tsx`
- Sticky, wys. `58px`, `padding 0 22px`, tło `rgba(247,245,240,.86)` + `backdrop-blur(12px)`, dolny hairline `#E2DED4`.
- Lewo: wordmark `polutek` (grafit) + `.pl` (akcent), font Space Grotesk 700; obok mały badge „Beta" (tło `#171717`, tekst biały, 8px/800 uppercase, `border-radius:3px`).
- Środek: wyszukiwarka — input pill (lewa część `border-radius:999px 0 0 999px`, białe tło, border `#D8D3C8`) + przycisk lupy (tło `#EFEDE6`, prawa część zaokrąglona). Focus inputu: `border:#2563EB; box-shadow:0 0 0 3px rgba(37,99,235,.18)`.
- Prawo: segment PL/EN (aktywny = białe tło + cień + tekst grafit; nieaktywny `#9A958B`), separator pionowy `1px #DAD6CC`, przycisk „Zaloguj się" (białe tło, border `#D8D3C8`, ikona login, hover: border grafit).

**2. Hero / odtwarzacz** — plik `app/components/Hero.tsx`
- Odtwarzacz: `aspect-ratio:16/9`, `border-radius:14px`, border `#322f2b`, tło ciemny gradient `linear-gradient(135deg,#23211e,#15140f 55%,#262320)`, subtelny wzór w paski (overlay).
- Lewy-górny pill „Materiał publiczny": tło `rgba(0,0,0,.45)`+blur, kropka akcentu z `ring`.
- Play: koło `78px`, tło `#2563EB`, biała ikona trójkąta, animacja poświaty `glow` (z `tailwind.config.ts` keyframes — można zmapować na `animate-glow`).
- Dół: badge czasu `1:02:14` (czarny `rgba(0,0,0,.78)`), pasek postępu wys. `4px` tło `rgba(255,255,255,.18)` z wypełnieniem akcentowym.
- Tytuł: Outfit 23/700, `line-height:1.25`, `#0F0F0F`.
- Wiersz autora: avatar `46px` koło (gradient grafit, border), nazwa „Polutek" 15.5/700, „42,8 tys. subskrybentów" 12.5 `#6B6B6B`; przycisk **Subskrybuj** (`SubscribeButton.tsx`): wys. `38px` pill, tło `#171717`, tekst biały, ikona dzwonka; stan aktywny = „Subskrybujesz", tło `#EBE8E0`, tekst grafit, border `#D8D3C8`.
- Akcje (prawo): segment Lubię/Nie lubię w jednym pill (białe tło, border `#D8D3C8`, przegroda `#E4E0D6`), liczba przy Lubię; **aktywny like/dislike → kolor i fill `#2563EB`**. Obok „Udostępnij" (pill biały) + przycisk „⋯" (koło 38px).
- Opis: box tło `#EBE8E0`, border `#E2DED4`, `border-radius:14px`, padding `14px 16px`; wiersz „128 540 wyświetleń · 13 cze 2026" 13.5/700; treść 13.5, `line-height:1.6`; link „...więcej" 700 grafit.

**3. Lista boczna** — plik `app/components/channel/SidebarPlaylist.tsx`
- Nagłówek sekcji: 11/700 uppercase `letter-spacing:.2em` `#1A1A1A`, dolny hairline.
- Karta wideo: flex gap 11, padding 6, `border-radius:11px`, hover tło `#EBE8E0`; bieżący odtwarzany wiersz tło `#EBE8E0`. Miniatura `158×90`, `border-radius:9px`, border `#D8D3C8`, ciemny gradient + paski. Badge czasu dół-prawo (czarny). Badge dostępu dół-lewo: „Publiczne" `rgba(0,0,0,.62)` biały / **„Odblokowane" tło akcent `#2563EB` biały** / „Patron" grafit. Tytuł Outfit 14/600 (2 linie, line-clamp), „Polutek" 12 `#6B6B6B`, meta „128 tys. wyświetleń · 2 dni temu" 12.
- **Box patrona** (między sekcją publiczną a patronów): ramka `rgba(37,99,235,.18)`, tło `linear-gradient(180deg,#EFF3FE,#fff)`, `border-radius:16px`, padding 18, cień niebieski. Nagłówek „Zostań patronem" Outfit 16/700 + ikona serca akcentowa. Tekst 12.5 `#4A4A4A`. Wewnętrzna karta białej z odliczaniem: etykieta „Do premiery patronów" 10/800 uppercase, **liczba dni Space Grotesk 30/700 akcent** + „dni", obok zegar `HH:MM:SS` Space Grotesk 19/600 grafit, `font-variant-numeric:tabular-nums`. CTA „Wesprzyj · od 20 zł": pełna szerokość, wys. 44, tło akcent, tekst biały, `border-radius:11px`, hover `brightness(1.07)`. Pod spodem „Jednorazowo · dostęp dożywotni" 11 `#7A7A7A`.
- Sekcja „Materiały dla patronów": nagłówek z ikoną kłódki; karty zablokowane = ciemna miniatura + overlay blur `rgba(15,14,11,.45)` z kłódką i „Dla patronów", badge „Patron" (tło `#E0DCD2`, border `#CFC9BC`, grafit).

**4. Komentarze** — plik `app/components/comments/` (EmbeddedComments)
- Nagłówek „1 284 komentarzy" Outfit 17/700 + „Sortuj według" (ikona suwaków, 13/600 `#5B5B5B`).
- Pole „Dodaj komentarz..." z avatarem 38px i dolną linią `#DCD8CE`.
- Komentarz: avatar 38px (gradient + inicjały), nazwa 13/700, czas 12 `#8A857B`, opcjonalny badge „Patron" (akcent na `accent-soft`), treść 14 `line-height:1.5`, akcje: Lubię (ikona + liczba) + „Odpowiedz" 12/700.

**5. Footer** — `app/components/Footer.tsx`
- Border-top `#E2DED4`, tło `#F0EDE6`. Wordmark + linki (Regulamin / Prywatność / Kontakt) 12.5 `#6B6B6B` + tagline „Polutek.pl nie jest platformą. Polutek.pl jest miejscem." 12 `#9A958B`.

---

## Interactions & Behavior
- **PL/EN**: przełącza wszystkie etykiety (już macie `LanguageContext`).
- **Like/Dislike**: wzajemnie wykluczające się; aktywny → akcent + fill; liczba aktualizuje się (u was przez `toggleVideoLike`).
- **Subskrybuj**: toggle label/styl (grafit ↔ jasny outline).
- **Odliczanie do premiery**: tyka co 1s do `2026-10-13T00:00:00+02:00`, format „{dni} dni HH:MM:SS" (u was `PATRON_PREMIERE_DATE` w `ChannelHome.tsx`).
- **Focus** inputów: border akcent + ring.
- **Hover** wierszy listy / przycisków: tło `#EBE8E0` / `#F3F1EA`.
- Animacja Play: `glow 2.4s ease-out infinite` (rozszerzający się niebieski ring).

## State Management
Bez nowego stanu globalnego — wszystko mieści się w istniejących komponentach: `lang` (LanguageContext), `liked/disliked/likesCount` (Hero), `isSubscribed/subscribersCount` (SubscribeButton), `premiereCountdown` (ChannelHome interval). Dane wideo: `PublicVideoDTO`, layout listy: `/api/channel/sidebar`.

---

## Mapowanie na pliki repo (do edycji)
- `app/globals.css` — ociepl tokeny: `--background`, `--card`, `--secondary/muted/accent`, `--border`, `--input`. `--primary` zostaw (`221.2 83.2% 53.3%`). Dodaj ew. `--accent-soft`, `--accent-ring`.
- `tailwind.config.ts` — `cream` → `#F4F2EC` (lub dodaj `canvas`), upewnij się że `glow` keyframes są dostępne jako `animate-glow`.
- `app/components/Navbar.tsx`, `Hero.tsx`, `SubscribeButton.tsx`, `ShareButton.tsx`, `channel/SidebarPlaylist.tsx`, `ChannelHome.tsx`, `Footer.tsx` — zamień zimne `neutral-*` na ciepłe tokeny powyżej; egzekwuj zasadę akcentu (sekcja „Zasada akcentu").

## Files
- `Polutek Strona Glowna.dc.html` — interaktywna referencja (otwórz w przeglądarce).
- `tokens.css` — gotowy do wklejenia blok zmiennych (ciepła baza + akcent) jako punkt startowy dla `globals.css`.

## Guardrails (z AGENTS.md / PROJECT_CONTEXT)
- Nie dotykać logiki paywalla ani `PublicVideoDTO` / `/api/media`. To zmiana wyłącznie prezentacyjna (klasy/tokeny).
- Zachować defensywne renderowanie (brak głównego wideo, pusta baza).
- Strict single-channel — bez nowych ścieżek twórców.
