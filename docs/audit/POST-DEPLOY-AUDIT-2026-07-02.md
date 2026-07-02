# Post-deploy audit — 2026-07-02 (po merge PR #1294)

Audyt stanu aplikacji po wdrożeniu poprawek z PR #1294 (403-storm na playback-event,
publiczne 404 na `/api/payment-settings` i `/manifest.json`). Weryfikacja wykonana
na żywej produkcji (`www.polutek.pl`, deployment `4a453a7`).

## Zweryfikowane na produkcji — PASS

| Obszar | Wynik |
|---|---|
| Deployment produkcyjny | READY, commit `4a453a7` (merge #1294) |
| `/api/media-source/[id]` | `Cache-Control: private, no-store`; dwa niezależne żądania otrzymują **różne** `playbackSessionId` — sesje nie są już współdzielone przez CDN |
| `/manifest.json` | HTTP 200 (`application/json`) dla anonimowych — PWA install działa |
| `/api/payment-settings` | HTTP 200 z realnymi limitami z bazy (PLN min 10), nie fallbackiem |
| `/api/videos/[id]/thumbnail` | HTTP 200, `image/webp`, `public, max-age=3600` |
| Runtime errors (Vercel) | Zero błędów po deployu (wcześniej: seria `Session ownership mismatch` na `/api/videos/[id]/playback-event`) |
| CI | Wszystkie 13 checków zielone (hotspots naprawiony ekstrakcją `usePlaybackTelemetry`) |
| Testy | 1146 passed, typecheck (`tsconfig.typecheck.json`) czysty |

## Znane ryzyka skalowalności (stan na dziś)

Wideo serwuje Cloudflare Stream — samo odtwarzanie skaluje się niezależnie od
infrastruktury Vercel/Neon. Wąskie gardła przy dużym ruchu:

1. **`force-dynamic` na `/` i `/watch/[slug]`** — każde wejście = wywołanie funkcji
   + zapytania do Neona, zero cache dla anonimów. Największa pojedyncza dźwignia:
   ISR/cache dla gości (wymaga przeniesienia treści zależnych od użytkownika do
   komponentów klienckich — osobne, przemyślane zadanie).
2. **Miniaturki przez funkcję serwerową bez cache CDN** — `/api/videos/[id]/thumbnail`
   ma `max-age=3600` (cache przeglądarki), ale brak `s-maxage`, więc każdy nowy
   widz = wywołanie funkcji + transfer. W przeciwieństwie do `/api/media-source`
   ten endpoint **wolno** cache'ować na CDN (odpowiedź nie jest per-widz) — dodanie
   `s-maxage` zdejmie większość transferu przy ruchu.
3. **Plan Vercel Hobby** — 100 GB transferu/mies., limity wywołań funkcji, cron
   `stripe-reconciliation` wyłączony (patrz CLAUDE.md §6). Przy realnym ruchu:
   upgrade na Pro.
4. **Neon** — aplikacja musi używać pooled endpointu (`-pooler` w hoście
   `DATABASE_URL`); darmowy plan usypia compute (zimny start ~0,5 s) i ma mały
   limit compute. Schemat i indeksy są poprawne — skalowanie to kwestia planu,
   nie kodu.

Szacunek nośności na dziś (Hobby + Neon Free): setki jednoczesnych widzów OK;
~1–2 tys. jednoczesnych → wysycenie bazy/funkcji; po punktach 1–3 realny sufit
przesuwa się do dziesiątek tysięcy (wideo i tak dźwiga Cloudflare).

## Poprawki wdrożone w #1294 (kontekst)

- `/api/media-source`: usunięty `s-maxage` dla gości — cache CDN rozdawał jedną
  sesję odtwarzania wielu widzom, przez co ich playback-eventy kończyły się 403
  (fingerprint mismatch), licznik wyświetleń nie działał, a klient ponawiał bez
  końca (509 żądań w jednej sesji z logów przeglądarki).
- `usePlaybackTelemetry` (`lib/hooks/`): po 403 sesyjnym jedna próba odświeżenia
  planu, po 3 kolejnych porażkach telemetria się wyłącza (odtwarzanie działa dalej).
- `middleware.ts`: `/api/payment-settings` i `/manifest.json` dodane do tras
  publicznych (Clerk `protect()` zwracał anonimom 404).
