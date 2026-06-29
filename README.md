# Polutek.pl

Polutek.pl to aktywny produkt VOD jednego twórcy po zakończonej stabilizacji dużego refaktoru: jedno oficjalne miejsce, jeden katalog wideo, jeden system wsparcia i dostępu, jedna społeczność, jedna lista mailingowa oraz jeden kokpit admina.

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

## Stan produktu po stabilizacji

- Główne fundamenty refaktoru i stabilizacji są zakończone.
- Aplikacja jest utrzymywana jako aktywny produkt, a dalsze prace są prowadzone małymi, jawnie opisanymi zmianami.
- Dawna roadmapa refaktoryzacji pozostaje technicznym audytem/bazą długu, ale nie jest już jedynym opisem aktualnych decyzji produktowych.
- Public launch i operacje produkcyjne pozostają decyzjami właściciela oraz wymagają właściwych dowodów operatora, prawnych i produkcyjnych.

## Aktualny stan projektu

Aktualny stan stabilizacji jest opisany w [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md), techniczny masterplan w [`docs/MASTERPLAN.md`](docs/MASTERPLAN.md), a bieżąca kolejka product/tech work w [`docs/tickets/ready/README.md`](docs/tickets/ready/README.md).

## Tymczasowe katalogi i eksperymenty stylistyczne

W repo mogą istnieć publiczne, tymczasowe adresy typu katalog/eksperyment, obecnie m.in.:

- `/katalog`, `/katalog2`, `/katalog3` — katalogi/prototypy elementów stylu, narzędzi i wariantów UI,
- `/eksperyment1`–`/eksperyment15` — kompletne warianty strony głównej służące do porównywania kierunków wizualnych.

Te adresy nie są docelową architekturą produktu ani osobnymi funkcjami dla użytkownika końcowego. Służą wyłącznie do tymczasowego szukania właściwego kierunku wizualnego: papier, cienkopis, ręczna kreska, obramowania, SVG, roughjs/perfect-freehand/rough-notation/wired-elements oraz spokojniejsze warianty bloków i ramek.

Zasady utrzymania porządku:

- traktować katalogi i eksperymenty jako izolowane laboratorium stylistyczne,
- nie podpinać ich jako stałej nawigacji produkcyjnej,
- nie rozbudowywać ich bez końca po wybraniu finalnego kierunku,
- po decyzji projektowej przenieść zwycięskie elementy do normalnych komponentów/design systemu,
- usunąć albo zarchiwizować zbędne warianty, żeby nie robiły bałaganu w aplikacji.

## Kolejka zadań

Kanoniczna kolejka gotowych zadań znajduje się w [`docs/tickets/ready/README.md`](docs/tickets/ready/README.md).

Aktualnie obowiązuje tryb **active product roadmap**:

- najpierw utrzymać build/deploy i poprawki bezpieczeństwa,
- potem realizować strategiczne product work opisane w issue,
- większe refaktory robić etapami i tylko wtedy, gdy wspierają aktywne wymagania produktu,
- nowe prace powinny być małe, jednoznaczne i zgodne z `AGENTS.md`.

## Najważniejsze aktualne decyzje produktowe

- Multi-source video ma być pełnym systemem admin create/edit + provider switch + playback end-to-end. Kanoniczny ticket: #1204.
- Providerzy wideo mają być projektowani rozszerzalnie: Cloudflare Stream, YouTube, strategicznie Mux, dalej R2 i Vimeo.
- Player nie może znać szczegółów providerów; docelowo renderuje zunifikowany playback plan.
- Strefa Fenju / Thank You Zone jest bonusem w podziękowaniu za wsparcie, a nie komunikowana jako zakup płatnej treści.
- Miniatury i media mają działać z private Vercel Blob; raw private URL nie powinny trafiać do użytkownika.
- Brak miniatury filmu ma być rozwiązywany fallbackiem, nie przez trwałe zapisywanie `/logo.png` jako danych filmu.
- Napisy PL/EN per film są opcjonalnym feature accessibility/quality, docelowo przez WebVTT `.vtt`.

## Operacje VOD / Cloudflare Stream signed playback

Po #1173 playback prywatnych/patronowskich materiałów Cloudflare Stream używa lokalnie generowanych signed playback tokenów. Viewer hot path nie powinien wołać Cloudflare Admin API ani endpointu `/token` per widz.

Przed uruchomieniem produkcyjnym trzeba mieć skonfigurowane w środowisku wdrożeniowym właściwe zmienne dla Cloudflare Stream signing key oraz TTL tokenów. Wartości sekretów nie wolno logować, wklejać do issue, PR, screenshotów ani komentarzy.

Notatki operacyjne:

- Signing key może zawierać escaped newlines.
- Brak signing key powoduje fail-closed dla signed playback: backend nie powinien zwrócić źródła odtwarzania.
- Po rotacji signing key trzeba zaktualizować env w środowiskach produkcyjnych i preview, które mają odtwarzać signed Cloudflare Stream.
- #1106 nadal nie jest w pełni zamknięte: kolejne slice’y to cache/rate limit playback planu, event batching/collector, queue/worker/analytics aggregation oraz readiness/load-test/runbook.

## Dokumenty kanoniczne

- Zasady agentów i inwarianty produktu: [`AGENTS.md`](AGENTS.md)
- Decyzje właściciela: [`docs/strategy/OWNER-DECISIONS.md`](docs/strategy/OWNER-DECISIONS.md)
- Stan projektu: [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md)
- Masterplan: [`docs/MASTERPLAN.md`](docs/MASTERPLAN.md)
- Kanoniczna kolejka product/tech: [`docs/tickets/ready/README.md`](docs/tickets/ready/README.md)
- Backlog launch/operacji: [`docs/roadmap/Launch-Execution-Backlog.md`](docs/roadmap/Launch-Execution-Backlog.md)
- Indeks raportów historycznych: [`docs/reports/reconciliation/README.md`](docs/reports/reconciliation/README.md)

## Zachowane raporty historyczne

Historyczne raporty i tickety pozostają zachowane jako dowód wcześniejszych etapów. Nie należy przepisywać ich wyników jako obecnego runtime; należy czytać je jako historyczne evidence z daty powstania.
