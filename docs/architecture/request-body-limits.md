# Limity treści żądań API

Stan po częściowej implementacji K07 z 2026-11-06. Wspólny reader znajduje się w `lib/utils/request-body.ts`; trasom JSON i FormData ogranicza bajty **przed** parserem. Brak albo fałszywy `Content-Length` nie znosi limitu — liczy się strumień. Przekroczenie limitu daje 413, a niepoprawny JSON/FormData 400.

## Limity aplikacji

- JSON: domyślnie 128 KiB (`DEFAULT_JSON_BODY_MAX_BYTES`). Większe payloady wymagają jawnego argumentu. Avatar zachowuje legalny data URL do 120 000 znaków.
- Multipart: ogranicza się całość żądania i liczbę części przed natywnym `Request.formData()`. Trasa okładki filmu i adminowy upload dopuszczają do 8 części; parser przyjmuje wyłącznie `multipart/form-data` lub `application/x-www-form-urlencoded`.
- Upload pliku: osobny limit bajtów pliku pozostaje sprawdzany po ograniczonym parsowaniu; suma body ma dodatkowy budżet 64 KiB na multipart.
- Complete upload: budżet body 6 MiB zachowuje legalny payload z 10 000 części (maksymalna długość eTag jest ograniczona w schemacie). Next proxy buforuje najwyżej 7 MiB (`experimental.proxyClientMaxBodySize`), więc aplikacja odrzuca nadmiar przed granicą proxy.
- Subskrypcje/unsubscribe: tekst/formularz do 16 KiB; e-mail preview: multipart do 1 MiB i 8 części.

## Użycie i weryfikacja

Nowe trasy API muszą używać `readRequestJsonWithLimit`, `readRequestTextWithLimit` albo `readRequestFormDataWithLimit` (lub helpera wyższego poziomu, np. `readStudioJson`, `readJson`, `readUploadedFile`). Nie dodawaj bezpośredniego `request.json()`, `request.text()` ani `request.formData()` przed kontrolą limitu. Plik pochodny (`File.arrayBuffer()`) może być odczytany po ograniczeniu i walidacji multipart.

Testy jednostkowe `tests/unit/utils/request-body.test.ts` sprawdzają limit z brakującym i zaniżonym nagłówkiem, chunkowany strumień, dokładny limit i `+1`, multipart count przed parserem oraz legalny complete z 10 000 części. Test lokalnego Next sprawdził bezpośredni serwer aplikacji, **bez reverse proxy**.

Next 16.4.5 ma domyślny bufor 10 MiB; przy przekroczeniu może przekazać trasie obcięte body. Lokalny test odtworzył 303 na częściowej formie przy tymczasowym limicie aplikacji 13 MiB, a po obniżeniu limitu do 6 MiB zweryfikował 413. Konfiguracja Cloudflare Tunnel jest zarządzana poza tym repozytorium (zob. `operations/SERWEREK.md`), więc nie sprawdzono limitu/buforowania na tunelu. Nie zmierzono też pamięci i czasu przy równoległych odrzuconych żądaniach przez pełny stos. Nie przedstawiaj lokalnego 413 jako dowodu pełnej ochrony DoS ani gotowości do publicznego otwarcia.
