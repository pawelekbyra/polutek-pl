# Wersja testowa (beta) strony publicznej

Dopóki strona nie jest oficjalnie otwarta, jest oznaczona jako **wersja testowa**. Jeden przełącznik w jednym
miejscu: `lib/site-stage.ts` (`SITE_IS_BETA`), sterowany zmienną **`NEXT_PUBLIC_SITE_BETA`**.
Domyślnie (zmienna pusta lub brak) **beta jest WŁĄCZONA**.

## Co robi beta

| Element | Zachowanie |
|---|---|
| Pasek | „Strona w budowie (wersja testowa)”, `role="note"`, na górze nagłówka (`app/components/BetaNotice.tsx`, w `Navbar`), stała wysokość 24 px (CLS 0), nic nie zasłania. Jest częścią strony, więc pojawia się po bramce wejściowej (bramka zasłania i blokuje stronę pod spodem). Nie da się go zamknąć (zamknięcie zmieniłoby wysokość nagłówka po załadowaniu). Kolory stałe (strona jest tylko jasna): #5c3d00 na #fff4d6, kontrast ok. 9:1. |
| Teksty | `tx()`, wpisy w sześciu katalogach (`lib/i18n/catalog`), test parytetu pilnuje kompletności. |
| noindex | `robots: { index: false, follow: false }` w metadanych (`app/layout.tsx`) oraz nagłówek `X-Robots-Tag: noindex, nofollow` dla stron HTML (`next.config.mjs`; bez plików z kropką, `/api`, `/_next`). |
| robots.txt | bez zmian: crawling dozwolony (inaczej robot nie zobaczy noindex), reguły Disallow bez zmian, ale **bez linii `Sitemap:`**. |
| sitemap.xml | w becie **pusta** (nie wystawiamy adresów, o których prosimy „nie indeksuj”). |
| Tytuł i opis strony głównej | neutralne, lokalizowane (`lib/site-stage-metadata.ts`): „{APP_NAME}: platforma wideo (wersja testowa)”. Tytuł filmu nie jest już opisem strony; Open Graph i Twitter mają ten sam tytuł i opis. |

Strony prawne, przekierowania panelu admina (`middleware.ts`) i reszta tras są bez zmian.

## Jak wyłączyć przy starcie (launch)

1. W `build.env` na serwerku dopisz `NEXT_PUBLIC_SITE_BETA=false` (`deploy.sh` przekazuje do budowy wszystkie
   `NEXT_PUBLIC_*`; `Dockerfile` ma `ARG NEXT_PUBLIC_SITE_BETA`).
2. Przebuduj i wdróż obraz. To zmienna **czasu budowy** (wartość trafia do kodu przeglądarki i do manifestu
   nagłówków), więc zmiana na działającym kontenerze nic nie da.
3. Po wdrożeniu: brak paska, brak `X-Robots-Tag` i `noindex`, `robots.txt` znów podaje sitemapę, `sitemap.xml`
   znów wylicza strony, tytuł i opis wracają do dawnych.
4. Wyszukiwarki, które zdążyły zobaczyć `noindex`, wrócą do indeksu po ponownym odwiedzeniu strony (można
   przyspieszyć w Search Console).

Wartości wyłączające: `false`, `0`, `no`, `off` (wielkość liter bez znaczenia). Cokolwiek innego = beta.
