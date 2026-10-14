# Platforma wielu twórców

Stan: **w budowie** (od 2026-10-13). Ten dokument jest źródłem prawdy o kierunku, decyzjach, bramkach i stanie etapów.
Badania, na których się opiera: [`../audit/2026-10-13/`](../audit/2026-10-13/README.md) (inwentaryzacja kodu, UX, inżynieria, prawo, Stripe) oraz
[`../audit/2026-10-12/`](../audit/2026-10-12/README.md) (płatny dostęp, VAT, forma prawna).

## Decyzje właściciela (2026-10-13)

1. Serwis przestaje być jednokanałowy i niekomercyjny. Każdy zalogowany użytkownik może założyć kanał, wgrywać filmy i nimi zarządzać w Studiu twórcy (`/studio` na `www`).
2. **ADMIN nie ma kanału.** Administrator platformy działa wyłącznie w panelu `admin.pawelperfect.com` i widzi oraz zarządza wszystkimi kanałami.
   Dotychczasowy kanał właściciela jest zwykłym kanałem należącym do jego zwykłego konta.
3. Model biznesowy: **sprzedaż dostępu do filmów** (cena stała albo „zapłać, ile chcesz”), **platforma jest sprzedawcą** (merchant of record): przyjmuje
   płatność, rozlicza VAT i wypłaca twórcom ich część. Darmowe filmy zostają. Dawne napiwki są szczególnym przypadkiem „zapłać, ile chcesz”.
4. **Podmiot i rezydencja właściciela są nierozstrzygnięte** (sp. z o.o. w Polsce, spółka cypryjska, hongkońska, US z zarządem w USA). Kod ma być od tego
   niezależny: „kto jest sprzedawcą i płatnikiem” to konfiguracja, nie kod.

## Bramki: czego nie wolno uruchomić, zanim zostaną spełnione

| Bramka | Warunek | Co blokuje |
|---|---|---|
| **Podmiot prawny** | wybrana forma i rezydencja, NIP/REGON lub odpowiednik, rejestracja VAT/OSS | płatną sprzedaż, wypłaty dla twórców |
| **KRRiT** | wpis do wykazu platform udostępniania wideo najpóźniej 14 dni przed uploadem dla obcych (jeśli platforma podlega polskiej jurysdykcji) | tworzenie kanałów dla obcych |
| **DSA** | punkty kontaktowe, formularz zgłoszeń (decyzja w 48 h), uzasadnienia decyzji, regulaminy | tworzenie kanałów dla obcych |
| **Regulaminy** | Regulamin, Regulamin sprzedaży, Umowa z twórcą (licencja, podział, podatki), Zasady społeczności | oba powyższe |
| **Stripe** | akceptacja modelu platformy z treściami użytkowników | sprzedaż |
| **CSAM** | narzędzia lub ręczny przegląd nowych kanałów | upload dla obcych |

W kodzie bramki są **wyłącznikami** (`lib/platform-gates.ts`): domyślnie wszystko wyłączone. Włączenie to świadoma decyzja właściciela, nie wdrożenie.

## Model

- **Konto (`User`)**: logowanie, nick. Nie musi mieć kanału.
- **Kanał (`Creator`, w domenie „Channel”)**: uchwyt `@nazwa`, nazwa, awatar, status (maszyna stanów), filmy.
- **Członkostwo (`ChannelMember`)**: rola w kanale. W MVP jedyną rolą jest `OWNER`; schemat zna też `MANAGER`, `EDITOR`, `MODERATOR`, `TRANSLATOR`.
- **Personel platformy** (`apps/admin`): konto panelu (`AdminUser`), logowanie przez Cloudflare Access. Akcje na cudzym kanale wymagają powodu i trafiają do audytu.
- Limit: jeden kanał na użytkownika (ustawienie `platform.maxChannelsPerUser`, wyjątki ręcznie).

## Uprawnienia

Jedno miejsce decyzji: `lib/modules/authz` (`can()` czyste, `authorize()` w use case'ach). Szczegóły i reguły: `CLAUDE.md` §4.23.

## Pieniądze (platforma jako sprzedawca)

- Kupujący płaci platformie (jedno konto Stripe), VAT liczy Stripe Tax, udział twórcy jest księgowany w **księdze twórcy** (tylko do dopisywania) i wypłacany
  po okresie zwrotów (14 dni) przelewem z konta spółki. Bez kont Stripe dla twórców: twórca nie styka się ze Stripe.
- Zwroty: 14 dni bez pytań (TSUE C-234/25), zwrot odbiera prawo dostępu.
- Podatek twórcy zależy od podmiotu platformy i od ścieżki twórcy (firma, osoba prywatna z Polski, zagraniczny); moduł podatkowy jest konfiguracją podmiotu.
- Sprzedaż jest za wyłącznikiem `sales` (bramka „Podmiot prawny” powyżej).

## Stan etapów

| Etap | Zakres | Stan |
|---|---|---|
| 0 | Decyzje, dokumentacja, bramki | zrobiony |
| 1 | Warstwa uprawnień (`authz`), bez zmiany zachowania | **zrobiony**: moduł `lib/modules/authz`, `authorize` w use case'ach wideo, potoku, treści i kanału, bramka `AUTHZ_EXEMPT`, testy macierzy |
| 2 | Schemat i uzupełnienie danych (addytywnie) | **zrobiony**: migracja `20261013120000_multi_channel_schema` (kanał: status, uchwyt, członkowie, limity, zgłoszenia, decyzje, ostrzeżenia), wyłączniki `lib/platform-gates.ts`, limity `lib/platform-limits.ts`; **do zastosowania na produkcji dopiero na zgodę właściciela** |
| 3 | Kanał z kontekstu żądania, koniec „kanału głównego” | **zrobiony w rdzeniu**: `AppContext.channelId`, dostęp publiczny z kanału filmu, cykl życia kanału, moderacja komentarzy per kanał, odpowiedź twórcy jako właściciel; **zostaje** przepisanie nazwy `MainChannelService` i stron publicznych na kanał z adresu (etap 7) |
| 4 | Studio twórcy na `www` | **zrobiony**: `/studio` (Przegląd, Treści, Komentarze, Kanał i ustawienia), API `/api/studio/*` działa zawsze jako zwykły użytkownik, limity wgrywania; **nieprzetestowany w przeglądarce ani na bazie** (brak Dockera); luka: profil nie wczytuje istniejącego opisu; po audycie praktyk (docs/audit/2026-10-13/studio-best-practices.md) wgrywanie jest kreatorem 3 kroków (opis, miniatura, widoczność, harmonogram), edycja ma podgląd i ostrzeżenie o niezapisanych zmianach, lista wyszukiwarkę, filtr i sortowanie, a pulpit ostatni film i komentarze do przejrzenia; dane dla tych pól dodała addytywna migracja `20261013160000_video_metadata` (`Video.tags` do 15 po 30 znaków, `category` z listy zamkniętej, `commentsMode` ON/HELD/OFF), a Studio ma sekcję „Więcej opcji” w kreatorze i edytorze oraz przycisk „Anuluj automatyczną publikację” (akcja `cancel_auto_publish`, uprawnienie `video.publish`, audyt); migracja sprawdzona na PGlite, nie na bazie produkcyjnej |
| 5 | Panel: wszystkie kanały, zgłoszenia, sprzedaż | **kanały i zgłoszenia zrobione**: `/kanaly` (lista, szczegóły, status z powodem, ostrzeżenia, poziom zaufania, decyzje); `ChannelModerationUseCases` z `ModerationDecision` i audytem; **zostaje**: filtr kanału w pozostałych ekranach, „zobacz jako twórca”, sprzedaż i rozliczenia (etap 6) |
| 6 | Sprzedaż i wypłaty (za wyłącznikiem) | **rdzeń zrobiony**: `PAID`, `VideoPrice`, `Order`, `Entitlement`, księga `LedgerEntry` (migracja `20261013140000_sales_schema`), moduł `sales`, dostęp przez uprawnienie; **zostaje** adapter Stripe (sesja, webhook, zwrot), ekran zakupu, wypłaty przelewem, profile podatkowe twórców: czekają na decyzję o podmiocie |
| 7 | Odkrywanie, `/@uchwyt`, wyszukiwarka, SEO | **w części**: strona kanału dla każdego publicznego kanału (`/channel/<slug>`), adres `/@uchwyt` (przepisanie w middleware), przekierowanie ze zwolnionych uchwytów (180 dni), kanały w sitemap, `POST /api/user/reports` (zgłoszenie filmu/kanału); **zostaje**: katalog kanałów i wyszukiwarka ponad kanałami (decyzja produktowa: co jest stroną główną), przycisk „Zgłoś” w interfejsie, powiadomienia per kanał, JSON-LD per kanał |
| 8 | Migracja czyszcząca (usunięcie `isPrimary`, `isApproved`, `MAIN_CREATOR_SLUG`); plan i lista użyć: `docs/architecture/stage-8-cleanup-plan.md` | **wdrożenie A zrobione w kodzie** (kod nie czyta/nie zapisuje starych pól; ustawienie `main_channel_id`), **wdrożenie B przygotowane, nieuruchomione** (`stage-8-deploy-B.md`); wymaga zgody właściciela i zasady dwóch wdrożeń (`CLAUDE.md` §4.0) |

Stan etapów aktualizuj w tym samym PR, który je zamyka.
