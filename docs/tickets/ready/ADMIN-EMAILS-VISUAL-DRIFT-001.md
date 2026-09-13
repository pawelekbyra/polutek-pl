# ADMIN-EMAILS-VISUAL-DRIFT-001 — `/admin/emails` odjechało od reszty panelu admina

Status: READY_FOR_BUILDER
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

To nie jest błąd — CLAUDE.md §1 mówi tylko, że "admin shell keeps its
approved scoped treatment" bez sprecyzowania, że każda podstrona ma wyglądać
identycznie. Ale to na tyle duży kontrast, że warto świadomej decyzji: czy
ujednolicić `/admin/emails` do wspólnego wyglądu, czy zostawić jako celowo
odrębny "moduł marketingowy" (i wtedy udokumentować to w CLAUDE.md zamiast
zostawiać jako niewyjaśniony dryf).

## Scope

1. Decyzja właściciela: ujednolicić styl `/admin/emails` do reszty panelu,
   czy zachować jako świadomie odrębny.
2. Jeśli ujednolicić: przepisać `EmailTemplateEditor.tsx`/`BroadcastWizard.tsx`/
   `TemplatesList.tsx` na te same prymitywy co reszta admina (`Card`, `Badge`,
   standardowe warianty przycisków shadcn) bez zmiany funkcjonalności.
3. Jeśli zachować: dodać do `CLAUDE.md` §5 jedno zdanie wyjaśniające, że
   `/admin/emails` jest celowo odrębnym modułem wizualnym, żeby przyszłe AI
   nie próbowało tego "naprawiać" jako niespójność.

## Invariants that must survive

- Żadna funkcjonalność tworzenia/wysyłki broadcastu nie może się zmienić —
  to wyłącznie zmiana warstwy prezentacji.

## Non-goals

- Tworzenie nowego systemu designu — użyć już istniejących komponentów
  shadcn/Card/Badge z reszty panelu, nie wymyślać nowych.
