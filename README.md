# PawelPerfect.pl

PawelPerfect.pl to aktywny produkt VOD jednego twórcy: jedno oficjalne miejsce,
jeden katalog wideo, jeden system wsparcia i dostępu, jedna społeczność,
jedna lista mailingowa oraz jeden kokpit admina.

```txt
PawelPerfect.pl is not a platform.
PawelPerfect.pl is a home.
```

Widzowie oglądają filmy w trzech poziomach dostępu (PUBLIC / LOGGED_IN /
PATRON), a jednorazowy napiwek Stripe powyżej progu nadaje dożywotni status
patrona (`PatronGrant`). Brak subskrypcji cyklicznych, brak multi-tenant.

## Aktualny stan

Fundamenty runtime są po stabilizacji: `PatronGrant` jest jedynym źródłem
prawdy dla statusu patrona, payment fulfillment idzie przez kanoniczny
`fulfillPayment()`, a playback prywatny/patroński jest bramkowany przez
backendowy `PlaybackPlan`. Produkcyjny launch nadal wymaga dowodów
operacyjnych, decyzji owner/legal i manualnego smoke testu zgodnie z
`DEPLOY_CHECKLIST.md` oraz issue #1269.

Wykonywalna kolejka kodowa żyje w `docs/tickets/ready/`. Zamknięte lub
zdezaktualizowane tickety/issue należy zamykać albo aktualizować przy każdej
większej zmianie stanu — dokumentacja ma opisywać stan obecny, nie historię.

## Stack

Next.js 15 (App Router, Vercel) · Neon PostgreSQL + Prisma · Clerk
(tożsamość) · Stripe (płatności) · własny HLS na R2 + Cloudflare Worker (wideo) · Resend
(email) · Upstash Redis (rate limiting).

## Szybki start

```bash
npm install
cp .env.example .env   # uzupełnij wartości
npx prisma generate
npm run dev
```

Testy i jakość (to samo co bramki CI):

```bash
npx vitest run                                # testy jednostkowe
npx tsc -p tsconfig.typecheck.json --noEmit   # typecheck
npm run quality:hotspots                      # budżety rozmiaru plików
```

## Dokumentacja

- **[`CLAUDE.md`](CLAUDE.md)** — przewodnik po kodzie: moduły, krytyczne
  inwarianty, czego nie robić. Czytaj przed każdą zmianą.
- **[`docs/README.md`](docs/README.md)** — indeks dokumentacji produktu
  (architektura, specyfikacje, runbooki, audyty, decyzje właściciela).
- **[`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md)** — znane ograniczenia
  i sufit skalowalności.
- Otwarte zadania: [`docs/tickets/ready/`](docs/tickets/ready/).

## Kierunki produktowe

- Wideo wyłącznie z własnego systemu: upload do R2, kolejka kodowania w
  Postgresie, worker HLS, dostarczanie przez Worker z tokenem (decyzja
  2026-10-02; bez Mux, Cloudflare Stream, YouTube i Vimeo).
- Player renderuje playback plan z backendu i nie zna szczegółów
  przechowywania.
- Strefa podziękowań dla patronów jest bonusem za wsparcie, nie „zakupem
  płatnej treści".
- Napisy PL/EN per film przez WebVTT (opcjonalny feature accessibility).

## Operacje: własny HLS

Playback używa lokalnie generowanych tokenów HMAC (`HLS_TOKEN_SECRET`, min. 32
znaki): token wydaje wyłącznie backend po decyzji dostępu i bramce premiery,
widz nie woła żadnego zewnętrznego API. Brak sekretu = fail-closed (plan bez
źródła). Rotacja: nowy sekret w Workerze i w aplikacji naraz. Pełny opis:
`docs/operations/HLS-SELF-HOSTED.md`, `docs/operations/VIDEO-PIPELINE.md`.

## Zasady zmian

- Małe, izolowane zmiany; każda przechodzi pełne CI.
- Krytyczne inwarianty z CLAUDE.md §4 są nienegocjowalne.
- Status patrona, płatności i dostęp do wideo zmienia się wyłącznie przez
  kanoniczne use-case'y — nigdy bezpośrednimi zapisami do bazy.
- Dokumentacja opisuje stan obecny; historia żyje w git, nie w plikach.
