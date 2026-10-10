# Dźwięk w odtwarzaczu i przycisk logo (stan 2026-10-05)

## Co robi odtwarzacz

- **Pamięć wyboru** (`app/components/player/sound-preference.ts`, `localStorage`, klucz `polutek:player-sound`): `muted` (`true` = widz sam wyciszył, `false` = widz słyszał dźwięk i go zostawił, brak = jeszcze nie wybierał) oraz `volume` ustawiona suwakiem lub strzałkami. Zapisują to tylko działania widza: przycisk wyciszenia, klawisz "m", przycisk "Włącz dźwięk", suwak, klik w bramkę wejściową ("Follow the white rabbit"), wybór filmu z playlisty. Wyciszony start wymuszony przez przeglądarkę nigdy nic nie zapisuje.
- **Po przeładowaniu** (bramka już przejdziana w sesji, więc nie czeka na klik): jeśli widz miał dźwięk włączony, odtwarzacz próbuje wystartować Z dźwiękiem, z zapamiętaną głośnością. Jeśli przeglądarka odmówi (`play()` odrzucone z `NotAllowedError`, w Vidstack zdarzenie `onAutoPlayFail`), film startuje wyciszony i pokazuje się jeden przycisk "Włącz dźwięk" (`UnmuteHint`); pierwszy gest widza gdziekolwiek na stronie (`useUnmuteOnFirstGesture`) włącza dźwięk bez zapisywania go jako wyboru.
- **Pod bramką wejściową** film zawsze gra wyciszony. Klik w królika/„ENTER” jest gestem: w samym kliknięciu odtwarzacz jest tylko odblokowany (`polutek:gate-unlock`, play+pause z dźwiękiem, potem pauza), a po animacji wejścia (błysk po ok. 4,95 s) film startuje od zera z dźwiękiem (`polutek:gate-enter`); gdy przeglądarka mimo to odmówi dźwięku, startuje wyciszony z przyciskiem „Włącz dźwięk”. Przy ograniczonym ruchu nie ma animacji i `polutek:gate-enter` idzie od razu w kliknięciu.
- **Dźwięk wejścia** `public/sounds/gate-enter.mp3` (6,4 s, 128 kb/s, wyciszenie od 5,25 s): fragment od 12. sekundy nagrania „Matrix code” z YouTube (kanał Jabba MTA, https://www.youtube.com/watch?v=rGT9m9IsjuA), wybrany przez właściciela 2026-10-10. Licencja nagrania nie jest znana: decyzja i ryzyko właściciela; przed oficjalnym startem warto potwierdzić prawo do użycia albo zamienić na dźwięk o znanej licencji (ten sam plik, ta sama długość, oś czasu w `gate-warp-timeline.ts` jest dopasowana do jego uderzeń: narastanie 0–2 s, niski akcent 2,0 s, jasny akcent ok. 4,95 s).
- **Widz, który wyciszył sam**: zostaje wyciszony po przeładowaniu, w nowej karcie i przy kolejnych odwiedzinach, bez przycisku zachęcającego.
- Gdy przeglądarka sama mówi, że dźwięk nie jest dozwolony (`navigator.getAutoplayPolicy("mediaelement") !== "allowed"`, Firefox i nowsze Chromium), próba z dźwiękiem jest pomijana (start wyciszony od razu, bez błysku ikony blokady w Firefoksie).
- Skróty prędkości Vidstack (`<` i `>`) są wyłączone, bo odtwarzacz nie ma sterowania prędkością (przycisk usunięty).

## Czego nie da się zrobić (zasady przeglądarek)

Nie omijamy ich i nie próbujemy żadnych sztuczek.

| Przeglądarka | Dźwięk bez gestu po przeładowaniu |
|---|---|
| Chrome / Edge (desktop) | Tylko gdy widz wcześniej wchodził w interakcję z domeną albo ma wysoki wskaźnik zaangażowania w media (MEI), albo zainstalował stronę jako PWA. Inaczej `play()` jest odrzucone. Przeładowanie zeruje aktywację użytkownika, więc po reloadzie często zadziała tylko MEI. |
| Chrome na Androidzie | Podobnie; dodatkowo dla stron dodanych na ekran główny. |
| Safari (macOS) | Domyślnie blokuje dźwięk bez gestu; widz może zezwolić dla witryny w ustawieniach Safari. |
| Safari (iOS) | Film z dźwiękiem wymaga gestu; wyciszony autoplay z `playsinline` jest dozwolony. Odciszenie bez gestu pauzuje wideo. |
| Firefox | Domyślnie blokuje dźwięk bez gestu (z listą wyjątków per witryna), `getAutoplayPolicy` pozwala to wykryć. |

Skutek: u widza, którego przeglądarka na to nie pozwala, po reloadzie film nadal startuje wyciszony. Najlepsze, co można zrobić uczciwie, to właśnie: spróbować z dźwiękiem, a przy odmowie wyciszony start, widoczny przycisk "Włącz dźwięk" i włączenie dźwięku przy pierwszym geście. Czego nie zweryfikowano w prawdziwych przeglądarkach: zachowania `play()` w Chrome/Safari/Firefox (testy podstawiają odrzucenie `play()` i zdarzenia Vidstack).

Źródła: Chrome Autoplay policy (developer.chrome.com/blog/autoplay), MDN Autoplay guide (developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), WebKit "New <video> Policies for iOS" (webkit.org/blog/6784).

## Logo w górnym pasku

`app/components/BrandHomeLink.tsx`: prawdziwy `<a href>` (next/link) do `getLocalizedHref(język, "home")` (`/` po polsku, `/en` po angielsku), z etykietą "pawelperfect.com, strona główna" / "home page". Na stronie głównej (`Navbar isHome`, ustawiane w `HomeExperience`) zwykły klik przewija na górę (płynnie, a przy `prefers-reduced-motion` bez animacji) zamiast nawigować: strona główna jest `force-dynamic`, więc nawet nawigacja do tego samego adresu renderuje ją od nowa na serwerze i pokazuje ekran ładowania. Klik z Ctrl/Cmd/Shift lub środkowym przyciskiem zostaje przeglądarce. Preloader i bramka nie są ruszane.
