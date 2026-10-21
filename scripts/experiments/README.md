# Eksperymenty: skrypty wycofania

Każdy eksperyment ma jedną flagę w `app.env`, plan w `docs/experiments/<id>.md`, wpis w rejestrze flag (`CLAUDE.md` §0) i linię `Experiment-Id: <id>` w opisie każdego swojego commita (po niej skrypt znajduje, co cofnąć).

## `premium-pass-revert.sh` (Strefa patrona / Wejściówka Premium)

```bash
bash scripts/experiments/premium-pass-revert.sh --dry-run    # podgląd: pokazuje, co zrobi; nic nie zmienia
bash scripts/experiments/premium-pass-revert.sh --flag-only  # tylko PREMIUM_PASS_EXPERIMENT=off i PREMIUM_PASS_PAYMENTS=demo + restart aplikacji (sekundy)
bash scripts/experiments/premium-pass-revert.sh              # pełne wycofanie (odmawia, gdy są prawdziwe wpłaty: kod 6)
bash scripts/experiments/premium-pass-revert.sh --confirm-real-payments   # pełne wycofanie mimo prawdziwych wpłat (wiersze Payment zostają)
```

Pełne wycofanie, po kolei (każdy krok zatrzymuje skrypt przy błędzie, a krok 1 już wyłączył eksperyment):

1. Na serwerku: kopia `app.env`, `PREMIUM_PASS_EXPERIMENT=off` i `PREMIUM_PASS_PAYMENTS=demo`, restart kontenera aplikacji, wpis `ai-log`.
2. `git log origin/main --grep='^Experiment-Id: premium-pass$'`: commity do cofnięcia.
3. Tymczasowy worktree, gałąź `revert/premium-pass-<MMDDHHMM>`, `git revert`; konflikt = kod wyjścia 3 (flaga zostaje off).
4. Sprawdzenie: brak odwołań do eksperymentu w `app`, `lib`, `middleware.ts`; szybkie testy (parytet katalogów, dostęp).
5. PR (`gh`), scalenie (`mergedeploy.sh --no-deploy`), `git archive origin/main | tar -x` do `src/` na serwerku, **usunięcie plików dodanych przez eksperyment** (tar niczego nie kasuje), `./deploy.sh <sha10>` w `tmux`.
6. `backup.sh`, eksport mapowania dostępu do `premium-pass-grants-<czas>.tsv`, `DELETE FROM "AppSetting" WHERE key LIKE 'xp.premium\_pass%'` w `polutek-db-1` (**wiersze `Payment` zostają zawsze**), usunięcie linii `PREMIUM_PASS_*` z `app.env` (z kopią), restart, `ai-log`.
7. Weryfikacja a-f (PASS/FAIL) z planu, rozdz. 17.3.

Uruchomienie przez właściciela jest jego zgodą na te zmiany na produkcji. Skrypt nie wypisuje sekretów.
