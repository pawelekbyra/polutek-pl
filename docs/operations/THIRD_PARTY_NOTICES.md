nevermind

## Flagi w przełączniku języka (`public/flags/`, kopia w `apps/admin/public/flags/` dla ekranu Tłumaczenia panelu)

Pliki `pl.svg`, `gb.svg`, `de.svg`, `es.svg`, `fr.svg`, `it.svg`, `pt.svg`, `cn.svg` pochodzą z projektu
**circle-flags** (HatScripts), wydanie `v2.8.0`, katalog `flags/`
(https://github.com/HatScripts/circle-flags), zoptymalizowane przez svgo. Serwujemy je sami (bez CDN).
Aktualizacja: pobrać te same nazwy z nowego wydania, przepuścić przez svgo, podmienić pliki.

```
MIT License

Copyright (c) 2026 HatScripts

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Test videos on the pre-launch site (2026-10-06)

The four placeholder videos ("Film testowy 1-4") use CC0 / public-domain clips from Wikimedia Commons. CC0 needs no attribution; sources are kept for the record. Replaced with `scripts/ops/replace-video-source.ts` (run in the encoder container). Replace them with real content before launch.

| Video | Clip (Wikimedia Commons) | Licence |
|---|---|---|
| Film testowy 1 | "Nature montage around Aberfeldy" (Rose Abrams), 720p transcode | CC0 |
| Film testowy 2 | "Overlooking a forest creek in the Tsimpsean Peninsula" (Extemporalist) | CC0 |
| Film testowy 3 | "Running Stream Of Water" (jLasWilson, via Pixabay) | CC0 |
| Film testowy 4 | "Winter Timelapse of Clouds Roiling over Rimrock on Okanagan Mountain" | CC0 |
