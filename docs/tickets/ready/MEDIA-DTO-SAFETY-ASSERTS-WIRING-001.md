# MEDIA-DTO-SAFETY-ASSERTS-WIRING-001 — Wpięcie nieużywanych safety-netów DTO mediów do produkcji

Status: READY_FOR_BUILDER
Priority: LOW (defense-in-depth hardening, nie znana luka)

## Why

`lib/modules/media/domain/media.policy.ts` zawiera
`assertPublicMediaDescriptorSafe()` i `assertPublicVideoDtoSafe()` — runtime'owe
asercje mające gwarantować, że `PublicVideoDTO`/publiczny opis medium nigdy nie
niesie surowego `videoUrl`/tokenu dostawcy (dokładnie inwariant z `CLAUDE.md`
§4.3: "Never expose `videoUrl` to the public frontend"). Audyt 2026-09-13
potwierdził: te funkcje są ćwiczone **tylko** przez
`tests/unit/modules/media/media-safety-hardening.test.ts` — zero wywołań z
kodu produkcyjnego. Jedyne żywe zabezpieczenie dziś to typ `videoUrl?: never`
w `app/types/video.ts` (miękka gwarancja czasu kompilacji, do obejścia przez
spread/cast).

To nie jest znana luka — nie znaleziono ścieżki, która faktycznie przecieka
`videoUrl` dziś. To jest niewykorzystana siatka bezpieczeństwa, która nic nie
chroni w praktyce, dopóki nie zostanie realnie wywołana.

## Scope

1. Zidentyfikować dokładne miejsce(a), gdzie `PublicVideoDTO` (i pokrewny
   `PublicMediaDescriptor`, jeśli używany produkcyjnie) jest ostatecznie
   budowany przed zwróceniem z API (prawdopodobnie w
   `lib/modules/video/` mapperach/DTO-builderach — zidentyfikować przez grep
   za typem `PublicVideoDTO`).
2. Wywołać odpowiedni assert tuż przed zwróceniem DTO z tego miejsca (rzuca w
   dev/test, loguje+redaguje w produkcji — do ustalenia dokładne zachowanie
   fail-mode zgodnie z resztą polityk bezpieczeństwa w tym module, np. jak
   `MediaPolicy.isAllowedMediaUrl` się zachowuje).
3. Sprawdzić czy `redactInternalMediaSource`/`createGatedMediaReference` (też
   dziś tylko testowe) powinny być użyte w tym samym miejscu albo są
   nadmiarowe wobec assertów powyżej — nie wpinać wszystkiego automatycznie,
   ocenić która kombinacja faktycznie odpowiada obecnemu przepływowi danych.

## Invariants that must survive

- Wpięcie asercji nie może zmienić kształtu odpowiedzi dla poprawnie
  zbudowanego DTO (czyli w 100% dzisiejszych przypadków) — ma jedynie
  zadziałać jako fail-safe dla przypadku, który dziś i tak nie powinien
  wystąpić.
- Żaden istniejący test na `PublicVideoDTO`/publiczne API wideo nie może się
  zepsuć — jeśli się zepsuje, to znaczy że któryś istniejący przepływ
  faktycznie łamie inwariant i wymaga naprawy w tym przepływie, nie
  osłabienia asercji.

## Non-goals

- Przepisywanie całej warstwy DTO mediów — to tylko wpięcie istniejących,
  już napisanych i przetestowanych funkcji w realny punkt użycia.
