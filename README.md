# Polutek.pl - Platforma VOD

## Start dla agentów AI

Witaj w procesie refaktoryzacji Polutek.pl. Twoim zadaniem jest pomoc w transformacji architektury aplikacji w kierunku **Modular Monolith**.

Zanim zaczniesz:
1. Przeczytaj `ARCHITECTURE.md`, aby zrozumieć docelowy wzorzec.
2. Zapoznaj się z `REFACTORING_EXAMPLES.md` (przykłady przed/po).
3. Sprawdź aktualny status refaktoryzacji poniżej.

Zasada pracy:
- Pracujemy etapami (R0, R1, R2...).
- Każdy etap musi kończyć się pełną walidacją (`npx prisma validate`, `npm run typecheck`, `npm test`, `npm run lint`).
- Po zakończeniu zadania masz **obowiązek aktualizacji statusu** w tym dokumencie oraz przygotowania raportu według template'u.

---

## Status refaktoryzacji

Aktualny etap: **R0 (Zakończono) -> R1 (W toku)**

| Etap | Opis | Status |
| :--- | :--- | :--- |
| **R0** | Zasady i infrastruktura refaktoryzacji | ✅ |
| **R1** | Guardy architektoniczne i baseline testów | 🔄 |
| **R2** | Moduł: Channel | ⏳ |
| **R3** | Moduł: Media | ⏳ |
| **R4** | Moduł: Video | ⏳ |
| **R5** | Moduł: Campaign | ⏳ |
| **R6** | Moduł: Patron | ⏳ |
| **R7** | Moduł: Payments | ⏳ |
| **R8** | Moduł: Auth/User | ⏳ |
| **R9** | Moduł: Notifications | ⏳ |
| **R10** | Usuwanie deprecated services | ⏳ |
| **R11** | Finalne utwardzenie architektury | ⏳ |

---

## Architektura i zasady

### Mapa migracji
Logika biznesowa przenosi się z rozproszonych serwisów do skonsolidowanych modułów:
- **Z:** `lib/services/**` (Deprecated)
- **DO:** `lib/modules/<domena>/**`

### Definicja Cienkiego Route'a (Thin Route)
Route handlery (`app/api/**`) oraz Server Actions służą wyłącznie jako warstwa wejściowa.
Ich zadania:
1. Ekstrakcja danych (params, body, session).
2. Wywołanie odpowiedniego **Use Case** z modułu.
3. Transformacja wyniku na odpowiedź HTTP.
**Zakaz:** Bezpośrednia logika biznesowa i złożone zapytania Prisma w route'ach.

### Zasada STOP
Jeśli podczas refaktoryzacji napotkasz na:
1. Brak testów dla krytycznej logiki, którą masz przenieść.
2. Niejasne powiązania między domenami, których nie potrafisz rozdzielić.
3. Ryzyko zmiany zachowania biznesowego (regresja).
**STOP!** Nie kontynuuj migracji na oślep. Dopisz testy baseline lub poproś o doprecyzowanie wymagań.

### Zależności R*
Refaktoryzacja jest sekwencyjna. Nie zaczynaj etapu R(n), jeśli R(n-1) nie jest ukończony i zweryfikowany. Wyjątkiem są drobne przygotowania techniczne.

---

## Roadmapa refaktoryzacji

### R0 — Zasady i infrastruktura
- Uporządkowanie dokumentacji (`README.md`, `ARCHITECTURE.md`).
- Utworzenie `REFACTORING_EXAMPLES.md`.
- Definicja kontraktu refaktoryzacji.

### R1 — Guardy i baseline
- Dodanie testów baseline dla krytycznych domen (Video, Channel, Payments).
- Wprowadzenie reguł technicznych (lint/scripts) pilnujących granic modułów.

### R2–R9 — Migracja modułów
Przenoszenie logiki według priorytetów domenowych do `lib/modules/`.

### R10–R11 — Sprzątanie i utwardzanie
- Usunięcie `lib/services/**`.
- Blokada importów z wnętrza modułów (wymuszanie `index.ts`).

---

## Obowiązki po zakończeniu pracy

1. Uruchom pełną walidację:
   ```bash
   npx prisma validate
   npm run typecheck
   npm test -- --run
   npm run lint
   ```
2. Zaktualizuj tabelę statusu w `README.md`.
3. Przygotuj raport w opisie Pull Requesta lub commitu według poniższego wzoru.

### Template raportu
```markdown
### Raport Refaktoryzacji - Etap R[X]

- **Wykonane zadania:**
  - [ ] Zadanie 1
  - [ ] Zadanie 2
- **Zmienione/Dodane pliki:**
  - `ścieżka/do/pliku`
- **Status walidacji:**
  - Prisma: [OK/FAIL]
  - Typecheck: [OK/FAIL]
  - Tests: [OK/FAIL]
  - Lint: [OK/FAIL]
- **Ryzyka/Uwagi:**
  - Opis ryzyk lub decyzji projektowych.
```
