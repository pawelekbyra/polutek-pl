# Polutek.pl )

Polutek.pl to aktywny produkt VOD twórcy po zakończonej stabilizacji dużego refaktoru: jedno oficjalne miejsce, jeden katalog wideo, jeden system patronów i dostępu, jedna społeczność, jedna lista mailingowa oraz jeden kokpit admina.

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

## Stan produktu po stabilizacji

- Główne fundamenty refaktoru i stabilizacji są zakończone.
- Aplikacja jest utrzymywana jako aktywny produkt, a dalsze prace są prowadzone małymi, jawnie opisanymi zmianami.
- Public launch i operacje produkcyjne pozostają decyzjami właściciela oraz wymagają właściwych dowodów operatora, prawnych i produkcyjnych — nie są aktywnymi blockerami dużej kolejki refaktoru.

## Aktualny stan projektu

Aktualny stan stabilizacji jest opisany w [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md), a techniczny masterplan w [`docs/MASTERPLAN.md`](docs/MASTERPLAN.md).

## Kolejka zadań

Kanoniczna kolejka gotowych zadań znajduje się w [`docs/tickets/ready/README.md`](docs/tickets/ready/README.md). Po stabilizacji nie ma aktywnego dużego ticketu kodowego; nowe prace powinny być małe, jednoznaczne i zgodne z `AGENTS.md`.

## Operacje VOD / Cloudflare Stream signed playback

Po #1173 playback prywatnych/patronowskich materiałów Cloudflare Stream używa lokalnie generowanych signed playback tokenów. Viewer hot path nie powinien wołać Cloudflare Admin API ani endpointu `/token` per widz.

Przed uruchomieniem produkcyjnym ustaw w env:

```txt
CLOUDFLARE_STREAM_SIGNING_KEY_ID=...
CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY=...
# albo alternatywnie:
CLOUDFLARE_STREAM_SIGNING_KEY_PEM=...

# opcjonalnie, domyślnie 3600 sekund:
CLOUDFLARE_STREAM_SIGNED_TOKEN_TTL_SECONDS=3600
```

Notatki operacyjne:

- `CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY` / `CLOUDFLARE_STREAM_SIGNING_KEY_PEM` może zawierać escaped newlines (`\n`).
- Brak signing key powoduje fail-closed dla signed playback: backend nie powinien zwrócić źródła odtwarzania.
- Nie logować ani nie wklejać prywatnego klucza w issue, PR, screenshoty ani komentarze.
- Po rotacji signing key trzeba zaktualizować env w środowiskach produkcyjnych i preview, które mają odtwarzać signed Cloudflare Stream.
- #1106 nadal nie jest w pełni zamknięte: kolejne slice’y to cache/rate limit playback planu, event batching/collector, queue/worker/analytics aggregation oraz readiness/load-test/runbook.

## Dokumenty kanoniczne

- Zasady agentów i inwarianty produktu: [`AGENTS.md`](AGENTS.md)
- Decyzje właściciela: [`docs/strategy/OWNER-DECISIONS.md`](docs/strategy/OWNER-DECISIONS.md)
- Stan projektu: [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md)
- Masterplan: [`docs/MASTERPLAN.md`](docs/MASTERPLAN.md)
- Backlog launch/operacji: [`docs/roadmap/Launch-Execution-Backlog.md`](docs/roadmap/Launch-Execution-Backlog.md)
- Indeks raportów historycznych: [`docs/reports/reconciliation/README.md`](docs/reports/reconciliation/README.md)

## Zachowane raporty historyczne

Historyczne raporty i tickety pozostają zachowane jako dowód wcześniejszych etapów. Nie należy przepisywać ich wyników jako obecnego runtime; należy czytać je jako historyczne evidence z daty powstania.
