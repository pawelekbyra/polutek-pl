# Wersja testowa (beta) strony publicznej

Dopóki strona nie jest oficjalnie otwarta, jest oznaczona jako **wersja testowa**. Jeden przełącznik w jednym
miejscu: `lib/site-stage.ts` (`SITE_IS_BETA`), sterowany zmienną **`NEXT_PUBLIC_SITE_BETA`**.
Domyślnie (zmienna pusta lub brak) **beta jest WŁĄCZONA**.

## Co robi beta

| Element | Zachowanie |
|---|---|
| Pasek | **Usunięty 2026-10-07** na prośbę właściciela (komponent `BetaNotice` i wpisy w katalogach skasowane). Beta nie pokazuje już żadnego paska; zostają noindex, pusta mapa strony i neutralny opis. |
| noindex | `robots: { index: false, follow: false }` w metadanych (`app/layout.tsx`) oraz nagłówek `X-Robots-Tag: noindex, nofollow` na **każdej** odpowiedzi (strony, `/api`, `/_next`, obrazy, SVG, dźwięk, manifest; `next.config.mjs`), z wyjątkiem `robots.txt` i `sitemap.xml`. Decyzja właściciela 2026-10-11: nic ze strony nie ma się indeksować. |
| robots.txt | bez zmian: crawling dozwolony (inaczej robot nie zobaczy noindex), reguły Disallow bez zmian, ale **bez linii `Sitemap:`**. |
| sitemap.xml | w becie **pusta** (nie wystawiamy adresów, o których prosimy „nie indeksuj”). |
| Tytuł i opis strony głównej | neutralne (`lib/site-stage-metadata.ts`): tytuł to sam adres małymi literami, „www.pawelperfect.com” (`SITE_TITLE` w `lib/constants.ts`, decyzja 2026-10-11), opis lokalizowany. Tytuł filmu nie jest już opisem strony; Open Graph i Twitter mają ten sam tytuł i opis. |

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
