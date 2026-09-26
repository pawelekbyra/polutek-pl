# ADMIN-DESIGN-SYSTEM-CONSISTENCY-001 — Ujednolicenie drobnych niespójności wizualnych panelu admina

Status: DONE (2026-09-26) — zobacz CLAUDE.md §5.1 dla szczegółów implementacji.
Priority: LOW (kosmetyka/spójność, nie bug)

## Why

Runda 3 audytu 2026-09-13 zrobiła pełny przegląd wizualny panelu admina
(poza już opisanym `/admin/emails`+`/admin/notifications` w
`ADMIN-EMAILS-VISUAL-DRIFT-001` i scaffoldem list w
`ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001`) i znalazła sporo mniejszych,
niezależnych niespójności — żadna nie jest bugiem, ale razem tworzą wrażenie
"sklejanego" panelu zamiast jednego systemu. Zebrane tu, żeby rozwiązać
je naraz zamiast punktowo:

- **4 niezależne implementacje "stat tile"**: `AdminLayoutShell.tsx`'s
  `StatMiniCard`, `users/page.tsx`'s `StatCard`, `users/dashboard/page.tsx`'s
  osobny `StatCard` (inny font-weight), `notifications/page.tsx`'s surowe
  `div`y bez komponentu `Card`.
- **4 różne traktowania `<h1>`** dla tego samego "tytułu sekcji" (dashboard,
  videos, users, comments — różne rozmiary/responsywność).
- **Dwie konwencje "nagłówka strony"**: hero-card z eyebrow (payments/
  channel/settings/users-dashboard) vs. goły `<h1>` (videos/users/comments/
  reports/notifications) — nieopisana druga konwencja obok pierwszej.
- **Zakładki szczegółów**: `users/[userId]` używa domyślnego (obecnie już
  bez zbędnych hex-literali, patrz commit z rundy 3) stylu `TabsTrigger`,
  `videos/[id]` używa customowego `bg-background border rounded-lg` — dwa
  różne języki wizualne dla tej samej "zakładki na stronie szczegółów".
- **Emoji zamiast ikon**: `VideoTable.tsx` używa 👁/👍/👎/💬 w kolumnie
  statystyk, mimo że dwie kolumny dalej używa lucide-icons.
- **Dwie konwencje rozmiaru ikon**: `size={N}` prop (comments/reports) vs.
  `className="h-N w-N"` (videos/users/settings/payments).
- **Dwa traktowania `Card`**: domyślny `ring-1 ring-foreground/10` bez cienia
  (videos/comments) vs. `shadow-sm border-0` (users/payments) dla tego
  samego prymitywu.
- **Custom spinner/przycisk** w `AdminVideoEditView.tsx` zamiast
  współdzielonego `Button`+`Loader2` używanego wszędzie indziej.
- **4 różne stylizacje "brak wyników"** dla identycznego komunikatu
  (italic+muted / plain+opacity-50 / italic+py-20 / plain+py-8) w czterech
  siostrzanych listach.
- **Dwie konwencje stanu ładowania listy**: per-wierszowy `Skeleton`
  (comments/reports) vs. jeden wyśrodkowany tekst `animate-pulse`
  (users/payments) dla tego samego momentu UX.
- `notifications/page.tsx`'s tabela "Ostatnie powiadomienia" to surowy
  `<table>` zamiast współdzielonych prymitywów `Table`/`TableRow`/`TableCell`
  używanych wszędzie indziej w panelu, plus status-pill jako goły `<span>`
  zamiast komponentu `Badge`.
- `users/[userId]`'s zakładka "Historia wpłat" renderuje drugi, osobny
  ręcznie stylowany `<table>` zamiast tego samego `Table` co strona listy
  płatności dla tych samych danych.
- Jednorazowy motyw "numerowany krok" (`PaymentSettingsForm.tsx`'s okrągłe
  odznaki `1`/`2`) nieużywany i nie wydzielony jako komponent nigdzie indziej.
- `variant="destructive"` użyty dla niedestrukcyjnej akcji wysyłki
  broadcastu (`NotificationBroadcastForm.tsx`) — patrz też
  `ADMIN-EMAILS-VISUAL-DRIFT-001`, ten sam finding.

## Scope

1. Ustalić i udokumentować (w `CLAUDE.md` §5 albo osobnej sekcji) jeden
   kanoniczny wzorzec dla: stat-tile, nagłówka strony, zakładek na stronie
   szczegółów, rozmiaru/źródła ikon, ramki `Card`, przycisku z loaderem,
   pustego stanu listy, stanu ładowania listy.
2. Przepisać wymienione powyżej odstępstwa na ten kanoniczny wzorzec,
   bez zmiany funkcjonalności żadnej strony.
3. `notifications/page.tsx`: zamienić surową tabelę na `Table`/`TableRow`/
   `TableCell`, status-pill na `Badge`.
4. `users/[userId]`'s "Historia wpłat": zamienić na współdzielony `Table`.

## Invariants that must survive

- Zero zmian funkcjonalnych — to wyłącznie warstwa prezentacji.
- `/admin/payments` zachowuje swoje istniejące, zatwierdzone traktowanie
  per `CLAUDE.md` §1 ("`/admin/payments` must retain its existing
  treatment") — jeśli ujednolicenie wymagałoby zmiany tej strony, zapytać
  właściciela przed dotknięciem.

## Non-goals

- `ADMIN-EMAILS-VISUAL-DRIFT-001` i `ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001`
  to osobne tickety — nie duplikować ich zakresu tutaj, choć wspólny
  scaffold z tamtego ticketu naturalnie rozwiąże część list/tabel z tej listy.
