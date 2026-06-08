# Polutek.pl - Platforma VOD

## Start dla agentów AI

Witaj w procesie refaktoryzacji Polutek.pl. Twoim zadaniem jest pomoc w transformacji architektury aplikacji w kierunku **Modular Monolith**.

Zanim zaczniesz:
1. Przeczytaj `ARCHITECTURE_MASTERPLAN.md`, aby zrozumieć docelowy wzorzec.
2. Zapoznaj się z `REFACTORING_EXAMPLES.md` (przykłady przed/po).
3. Sprawdź aktualny status refaktoryzacji poniżej.

Zasada pracy:
- Pracujemy etapami (R0, R1, R2...).
- Każdy etap musi kończyć się pełną walidacją (`npx prisma validate`, `npm run typecheck`, `npm test`, `npm run lint`).
- Po zakończeniu zadania masz **obowiązek aktualizacji statusu** w tym dokumencie oraz przygotowania raportu według template'u.

---

## Status refaktoryzacji

Aktualny etap: **R1 (Zakończono) -> R4 (W toku)**

| Etap | Opis | Status |
| :--- | :--- | :--- |
| **R0** | Zasady i infrastruktura | ✅ |
| **R1** | Shared, API boundary, errors, ctx | ✅ |
| **R2** | Moduł: Audit | ✅ |
| **R3** | Moduł: Media | ⏳ |
| **R4** | Moduł: Channel | 🔄 |
| **R5** | Moduł: Users | ⏳ |
| **R6** | Moduł: Video | ⏳ |
| **R7** | Moduł: Patron + Payments | ⏳ |
| **R8** | Moduł: Comments | ⏳ |
| **R9** | Moduł: Email | ⏳ |
| **R10** | Cleanup deprecated facade’ów | ⏳ |
| **R11** | Admin frontend | ⏳ |

---

## Architecture masterplan

Pełny plan refaktoryzacji modular monolith oraz późniejszego poziomu Architecture Excellence znajduje się w:

`ARCHITECTURE_MASTERPLAN.md`

Ten dokument jest strategicznym masterplanem. Nie oznacza zgody na implementację zadań X1–X11 przed zakończeniem roadmapy R0–R11 albo bez jawnej decyzji właściciela projektu.

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

---

## Obowiązki po zakończeniu pracy

1. Uruchom pełną walidację:
   ```bash
   npx prisma validate
   npm run quality
   npm run lint
   ```
2. Zaktualizuj tabelę statusu w `README.md`.
3. Przygotuj raport w opisie Pull Requesta lub commitu według template'u z ARCHITECTURE_MASTERPLAN.md.
