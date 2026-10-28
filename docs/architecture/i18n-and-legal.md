# Wybór języka i dokumenty prawne

Stan 2026-10-05. Osiem języków interfejsu, ich katalogi i procedury dodawania tekstów: `../operations/I18N.md`. Tu zasady wyboru języka i treść prawna.

## Wybór języka

- Język startowy rozstrzyga serwer w `lib/i18n/server-language.ts` (`resolveInitialLanguage()`): `User.language` zalogowanego → cookie `app-language` → kraj z Cloudflare `CF-IPCountry` (`COUNTRY_LANGUAGE`: tylko `PL` → `pl`;
  kraj jest na liście tylko wtedy, gdy jego język jest prawdziwym językiem interfejsu, kraje anglojęzyczne celowo nie) → `Accept-Language` z wagami q → `en`. Bez wymuszonego języka.
- `<html lang>` (`app/layout.tsx`) używa `resolveDocumentLanguage()`: język z adresu (`/pl/...`, `/en/...`, przekazany przez `middleware.ts` w nagłówku żądania `x-pp-route-locale`; wartość z klienta jest odrzucana), inaczej `resolveInitialLanguage()`.
  **Strony `[locale]` bez nazwy języka w trasie** (strona główna, kanał, wyszukiwanie, playlisty, subskrypcje, oferta patrona, studio) biorą język z `resolvePageLocale()` (`lib/i18n/page-locale.ts`): przy adresie z językiem to segment, przy adresie bez prefiksu (przepisanym przez proxy na `/pl`, bez nagłówka trasy) ten sam wynik negocjacji co layout.
  Znane ograniczenie: strony prawne `force-static` renderują się bez żądania, więc ich HTML niesie domyślny język, a klient poprawia go przy hydracji.
- `LanguageContext.tsx` zapisuje każdą zmianę w `localStorage` i rocznym cookie `app-language` (SameSite=Lax). Zmiany zalogowanego zapisuje wyłącznie `AuthLifecycleProvider` przez `PATCH /api/user/language`
  (walidacja języków interfejsu, ochrona CSRF w proxy), po czym `refreshSession()` (żeby 60-sekundowy cache cookie sesji nie oddał starej wartości). Rejestracja e-mailem bierze język z formularza lub cookie.
  Maile transakcyjne i rozsyłki idą w zapisanym `User.language`, ale tylko po polsku lub angielsku (konto z innym językiem dostaje angielski: `resolveEmailLanguage`).
- SEO: kanoniczne adresy, hreflang i mapa strony używają adresów z jawnym językiem (`getExplicitLocaleHref()` / `getLocaleAlternates()` w `lib/i18n/routing.ts`); gołe ścieżki negocjują język per widz. Strony zapasowe
  (`app/page.tsx`, `app/{watch,channel,search,regulamin,polityka-prywatnosci}`) przekierowują na jawne ścieżki, więc nie mogą tworzyć pętli. Szczegóły SEO języków tylko-interfejsowych: `I18N.md`.

## Dokumenty prawne

- Cztery dokumenty (Regulamin PL, Terms EN, Polityka prywatności PL, Privacy Policy EN) są w `app/components/legal/LegalDocs.tsx` z tym samym administratorem: **Paweł Perfect, osoba prywatna, ul. Złota 75, 00-819 Warszawa**,
  kontakt `LEGAL_CONTACT_EMAIL` (`support@pawelperfect.com`; domyślny Reply-To). `tests/unit/legal-docs-consistency.test.ts` pilnuje, że wszystkie cztery wskazują tę samą osobę, adres i e-mail.
  Nie rozdzielaj danych właściciela per dokument.
- Model: bezpłatny serwis, dobrowolne bezzwrotne wsparcie, które niczego nie daje (Regulamin: 5 punktów: kto prowadzi, co znajdziesz i wymagania, konto i zasady, wsparcie Twórcy, zmiany i prawo właściwe). Regulamin i Terms muszą pozostać
  dosłownymi tłumaczeniami siebie nawzajem; po zmianie jednego sprawdź drugi. Dostęp do treści nigdy nie wymaga płatności, ale część filmów i funkcji (komentowanie, wsparcie) wymaga bezpłatnego konta.
- Polityka prywatności (7 sekcji: administrator, dane i podstawy prawne, odbiorcy, retencja, prawa, cookies, zmiany) wymienia tylko dostawców, którzy naprawdę otrzymują dane osobowe (Hetzner, Cloudflare wraz z Turnstile, Resend,
  Stripe i operatorzy metod płatności, logowanie Google i kopia archiwalna poczty obsługi w Gmailu właściciela) i prawdziwe nazwy cookies. **Gdy dodajesz lub usuwasz dostawcę, cookie albo zadanie retencji, zmień politykę w tej samej zmianie:**
  `legal-docs-consistency.test.ts` renderuje obie wersje i sprawdza, że wycofani dostawcy nie występują, żywi występują, nazwy cookies i okresy retencji (sesja 30 dni, niezweryfikowane konta, purge usuniętych komentarzy) zgadzają się ze stałymi w kodzie,
  oraz strukturalną zgodność PL/EN.
- Data wejścia w życie: `LEGAL_DOCUMENTS_VERSION` w `lib/legal/version.ts` (z niej wynika `LEGAL_EFFECTIVE_DATE`, wspólna dla czterech dokumentów). Zmieniaj ją przy każdej zmianie dokumentu prawnego: trafia do `User.termsVersion`.
- Adres serwisu w dokumentach i stopce to literał `WWW.PAWELPERFECT.COM` (nie przez `APP_NAME`; przy zmianie domeny szukaj tego literału w `LegalDocs.tsx`, czterech `app/[locale]/{regulamin,terms,polityka-prywatnosci,privacy-policy}/page.tsx` i `Footer.tsx`).
  Tłumaczenia dokumentów na inne języki nie istnieją: `/de/terms` pokazuje angielski dokument z informacją w języku widza (`I18N.md`). Kwestie prawne do oceny przez prawnika: `STATUS.md`.
