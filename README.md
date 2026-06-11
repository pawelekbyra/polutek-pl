# Polutek.pl — Post-R AI Delivery Control Panel

Status:

```txt
Post-R AI Delivery Control Plane jest aktywny.
```

Ten root `README.md` jest krótkim panelem właściciela po R-phase. Nie oznacza launch-ready i nie uruchamia runtime X1-X7.

## Gdzie jesteśmy

- R0-R11 są traktowane jako `HANDOFF_COMPLETE` dla dalszej pracy Post-R.
- Post-R AI Delivery Control Plane jest aktywny jako system pracy: kontrakt agentów, roadmapa, dashboard właściciela, kolejka ticketów, specs, operacje i raporty.
- X0 jest pierwszym aktywnym etapem procesu.
- X1-X7 nie są aktywne runtime’owo, dopóki właściciel/Integrator nie uruchomi konkretnych ticketów po przejściu bramek X0/X0.5.

## Co jest aktywne

- Kontrakt agentów: `AGENTS.md`.
- Dashboard właściciela: `docs/roadmap/OWNER-TIMELINE.md`.
- Aktywna roadmapa egzekucji: `docs/roadmap/Active-Execution-Roadmap.md`.
- Aktywna kolejka ticketów: `docs/tickets/ready/**`.
- Aktywne specs domenowe: `docs/specs/**`.
- Aktywne protokoły agentów: `docs/operations/**`.
- Aktywne miejsce raportów: `docs/reports/**`.

## Następny krok właściciela

Uruchomić pierwszy ticket X0:

```txt
docs/tickets/ready/X0-READY-001-r-phase-handoff-inventory.md
```

Prompt dla agenta powinien wskazywać dokładnie ten plik, kazać przestrzegać `AGENTS.md` i wymagać walidacji z ticketu. Nie używać promptów typu `continue`, `build the app`, `do next phase` albo `improve everything`.

## Czego nie odpalać teraz

- Nie uruchamiać X1/X2/X3/X4/X5/X6/X7 runtime.
- Nie oznaczać produktu jako launch-ready.
- Nie oznaczać X0.5 ani X1-X7 jako DONE/CERTIFIED.
- Nie zmieniać runtime bez osobnego aktywnego ticketu i scope.
- Nie traktować target architecture w `docs/architecture/**` jako dowodu aktualnej implementacji.

## Zasady pracy agentów

1. `AGENTS.md` jest aktywnym kontraktem agentów AI.
2. Jeden ticket = jeden agent task = jeden branch = jeden PR.
3. Builder pracuje tylko w ścieżkach dozwolonych przez ticket.
4. Runtime, Prisma, package files i global docs są serial-only, chyba że ticket jawnie pozwala inaczej.
5. Integrator synchronizuje roadmapę/tickety/raporty po merge’ach; Builder nie certyfikuje faz.
6. Każdy PR musi jasno raportować: co zmieniono, czego nie zmieniono, walidację, ryzyka i następny krok.

## Audyty i dowody handoff

- R10/R11 readiness review: `docs/audit/R10-R11-HANDOFF-READINESS-REVIEW.md`.
- R10 guard cleanup note: `docs/audit/R10-GUARD-CLEANUP-NOTE.md`.
- Activation report: `docs/audit/POST-R-CONTROL-PLANE-ACTIVATION-REPORT.md`.

## Stare PR-y do zamknięcia przez właściciela

- #817 powinien zostać zamknięty jako superseded/conflicted broad staging PR.
- #814 powinien zostać zamknięty jako stale activation review sprzed #815/#816/#818/#819/#820/#821.

Nie merge’ować #817 ani #814 i nie importować ich diffów.
