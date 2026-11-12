# Decyzje i założenia realizacji roadmapy

## Przyjęte założenia

- 3 listopada 2026: obowiązuje prompt `/opt/codex/ZADANIE-AUDYT.md`; cała dalsza implementacja i lokalne commity wyłącznie w worktree `platform-audit`, na `docs/polutek-platform-audit`. Historyczne polecenia przełączania na gałąź PR #2065 i publikowania PR są nieaktualne.
- Cztery istniejące commity rdzenia K06 przeniesiono przez cherry-pick: `6cd26d90` → `00ea71cb`, `5af98a07` → `3b7ccfff`, `55f3a6d8` → `f72bbe27`, `f9edc23a` → `37eb1edb`. Przy konflikcie dokumentacji zachowano opisy aktualnej gałęzi i dodano tylko kontrakt rdzenia, bez opisów brakujących implementacji H1. Nie przenoszono zmian wyglądu z nowszej bazy PR.
- Wyniki wcześniejszego H1 odnoszą się do wskazanych historycznych SHA; nie stanowią testów bieżącej gałęzi. Pełne K06 pozostaje otwarte do podłączenia i sprawdzenia wszystkich konsumentów. Nie podwyższamy szacunku H1 wyłącznie na podstawie kontrolowanych adapterów.
- Budowanie obrazów w nowych testach zastępuje jawny port testowy. Testy nie uruchamiają współdzielonego Dockera, usług ani produkcji. Odbiór prawdziwego zestawu obrazów nadal wymagany.

- Przywrócono także kod/testy weryfikatora i strażnika critical z `7b2b341b`, `e79ec89c`, `03115f0f`; testy czerwone i zielone ponowiono na lokalnej gałęzi audytu. Nie zmieniono schematu ani danych.

## Pytania wymagające decyzji właściciela

Rejestr DP01–DP09 wraz ze statusem, bramką i opisem profilu produktu znajduje się w [`K05-PROFIL-PRODUKTU.md`](K05-PROFIL-PRODUKTU.md). Wszystkie pozycje pozostają otwarte. Ten pakiet nie zmienia polityki logowania, płatności, uprawnień, TTL, retencji ani danych użytkowników.
