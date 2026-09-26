# ADMIN-EMAILS-VISUAL-DRIFT-001 — `/admin/emails` i `/admin/notifications` odjechały od reszty panelu admina

Status: DONE (2026-09-26) — zobacz CLAUDE.md §5.1 dla szczegółów implementacji.
Priority: LOW (kosmetyka/spójność, nie bug)

## Why

Audyt 2026-09-13 (runda 2, `docs/audit/`) znalazł, że `app/admin/emails/*`
(`page.tsx`, `EmailTemplateEditor.tsx`, `BroadcastWizard.tsx`,
`TemplatesList.tsx`) używa zupełnie innego języka wizualnego niż reszta
panelu admina: `font-black uppercase tracking-widest/tracking-tighter`,
paleta `neutral-50/900`, pigułkowe `bg-blue-600 hover:bg-blue-700 shadow-xl`
CTA, wskaźnik kroków kreatora — podczas gdy videos/users/comments/channel
używają domyślnego wyglądu shadcn (`text-2xl font-bold`, płaski `Card`,
`Badge`). Czyta się to jak osobna pod-aplikacja, nie ten sam shell.

**Update (runda 3, 2026-09-13):** dokładnie ten sam dryf znaleziono w
`app/admin/notifications/NotificationBroadcastForm.tsx` — te same klasy
(`bg-white ... border-neutral-200 shadow-sm`, `font-black uppercase
tracking-tight/wide`, `text-neutral-500/600`), ręcznie robiony pigułkowy
toggle (`<button>` zamiast `Toggle`/grupy `Button`) i przycisk submit w
tym samym `bg-black hover:bg-neutral-800 ... rounded-full` stylu. To
najwyraźniej ten sam autor/wzorzec co `/admin/emails`, więc rozwiązanie
tego ticketu powinno objąć oba moduły naraz, nie tylko emaile.

To nie jest błąd — CLAUDE.md §1 mówi tylko, że "admin shell keeps its
approved scoped treatment" bez sprecyzowania, że każda podstrona ma wyglądać
identycznie. Ale to na tyle duży kontrast, że warto świadomej decyzji: czy
ujednolicić `/admin/emails` i `/admin/notifications` do wspólnego wyglądu,
czy zostawić jako celowo odrębny "moduł marketingowy" (i wtedy udokumentować
to w CLAUDE.md zamiast zostawiać jako niewyjaśniony dryf).

## Scope

1. Decyzja właściciela: ujednolicić styl `/admin/emails` i
   `/admin/notifications` do reszty panelu, czy zachować jako celowo odrębne.
2. Jeśli ujednolicić: przepisać `EmailTemplateEditor.tsx`/`BroadcastWizard.tsx`/
   `TemplatesList.tsx`/`NotificationBroadcastForm.tsx` na te same prymitywy co
   reszta admina (`Card`, `Badge`, `Toggle`, standardowe warianty przycisków
   shadcn) bez zmiany funkcjonalności. Przy okazji: napraw
   `NotificationBroadcastForm.tsx:131`, gdzie przycisk wysyłki broadcastu
   (akcja niedestrukcyjna) używa `variant="destructive"` — powinien używać
   zwykłego wariantu podstawowego, `destructive` zarezerwowane dla realnych
   usunięć (jak w `app/admin/videos/page.tsx`).
3. Jeśli zachować: dodać do `CLAUDE.md` §5 jedno zdanie wyjaśniające, że
   `/admin/emails` i `/admin/notifications` są celowo odrębnym modułem
   wizualnym, żeby przyszłe AI nie próbowało tego "naprawiać" jako niespójność.

## Invariants that must survive

- Żadna funkcjonalność tworzenia/wysyłki broadcastu nie może się zmienić —
  to wyłącznie zmiana warstwy prezentacji.

## Non-goals

- Tworzenie nowego systemu designu — użyć już istniejących komponentów
  shadcn/Card/Badge z reszty panelu, nie wymyślać nowych.
