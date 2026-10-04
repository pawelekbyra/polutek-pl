# Tłumaczenia filmów i wiele języków (koncept, na później)

Status: **koncept zatwierdzony kierunkowo przez właściciela (2026-10-04), nie zbudowany.** Wracamy do niego po fazie 2–3
nowego panelu admina (`admin-panel.md`). Dziś: UI, maile i dokumenty prawne mają tylko PL i EN; DE/ES/FR/IT/PT/ZH w przełączniku
języków to makiety (`app/components/language-switcher/languages.ts`). Krótkie adresy filmów z nazwą w danym języku są
**wstrzymane** (decyzja właściciela); maskowanie adresu (`UrlMask`) zostaje do czasu tej decyzji.

## 1. Problem

Przy wielu językach admin nie może ręcznie wymyślać tytułu, adresu i napisów dla każdego z nich. Potrzebne:
jeden główny tytuł, opis i napisy w języku oryginału, a reszta generowana i sprawdzana.

## 2. Przebieg dla admina

1. Admin wpisuje raz tytuł, opis i napisy (WebVTT) w języku oryginału.
2. Po zapisie powstają **szkice dla każdego włączonego języka**: tytuł, opis, napisy (tłumaczony tylko tekst, znaczniki czasu bez
   zmian). **Adres powstaje deterministycznie z przetłumaczonego tytułu** (transliteracja, myślniki, kolizje `-2`), bez AI.
3. Status per język: `AI_DRAFT`, `APPROVED`, `EDITED`. Jedno kliknięcie zatwierdza wszystko albo admin poprawia pojedynczy język.
4. Wersja `AI_DRAFT` na stronie ma etykietę „tłumaczenie automatyczne”, jest `noindex` i poza mapą strony do zatwierdzenia
   (nie zalewamy wyszukiwarek niesprawdzoną masą treści). Gdy zatwierdzona wersja jest zmieniana, do nowego zatwierdzenia
   obowiązuje poprzednia.

## 3. Dane (zaprojektowane w fazie 2)

- `VideoTranslation`: videoId, language, title, slug, description, subtitleUrl, status, reviewedAt/By; unikalne (language, slug)
  i (videoId, language).
- `VideoSlugHistory`: language, slug, videoId: stare adresy przekierowują (301) na obecny (pod przyszłe adresy per język).
- Obecne `Video.subtitleUrlPl/En` i tytuły/opisy EN czytane z kompatybilnością do czasu migracji.
- Adresy per język w postaci `/pl/<nazwa>` i `/en/<name>` z historią nazw, znacznikami hreflang i przełącznikiem języka, który zna
  odpowiednik w drugim języku; brak tłumaczenia tytułu: nazwa z języka oryginału.

## 4. Generowanie szkiców (AI)

- Koszt to grosze za film (tytuł, opis i napisy to kilka tysięcy tokenów na język).
- Model do wyboru: Claude przez API (płatny, najlepsza jakość) albo Cloudflare Workers AI (darmowy dzienny limit, słabszy w mniej
  popularnych językach). Właściciel nie kupuje usług na tym etapie, więc start na Workers AI i poprawki ludzi.
- Język jest „prawdziwy” dopiero, gdy ma przetłumaczone UI, maile i dokumenty prawne (regulamin i polityka: przegląd prawnika).

## 5. Tłumacze i przegląd w grupie (model docelowy)

Wzorzec z Crowdin/Weblate/Transifex/Wikipedii: **propozycja, przegląd, zatwierdzenie**.

1. Szkic (AI lub tłumacz).
2. Propozycje poprawek: stara wersja zostaje, nic nie jest nadpisywane.
3. Przegląd: inni tłumacze tego języka głosują „zgadzam się” / „do poprawy” z komentarzem.
4. Zatwierdzenie po progu zgód (np. 2, w tym nie autor) albo przez lidera języka.
5. Historia: wersje, autorzy, głosy, daty; cofanie do dowolnej wersji.

**Role (w obrębie jednego języka, tylko na zaproszenie, bez wglądu w resztę panelu):** tłumacz (proponuje), recenzent (głosuje,
zatwierdza cudze), lider języka (rozstrzyga, ustawia słownik i styl), właściciel (widzi i wycofuje wszystko, przyznaje role).

**Kontrola „spaczonego gustu” jednej osoby:** nikt nie zatwierdza własnej propozycji; przewodnik stylu i słownik per język
(ton „ty/Pan/Pani”, nazwy własne, terminy typu „premiera”, „napisy”); pamięć tłumaczeń (spójność między filmami); automatyczne
kontrole (długość tytułu, długość i liczba linii napisów, czas wyświetlania, liczby i nazwy, puste pola); losowy przegląd
zatwierdzeń lidera; awans na recenzenta po serii zatwierdzonych propozycji.

Przykłady rozbieżności gustu: „Subskrybuj” kontra „Obserwuj”; „przesyłanie strumieniowe” kontra „streaming”; hiszpański z Meksyku
kontra z Hiszpanii, portugalski brazylijski kontra europejski; dopisywane żarty albo spłaszczanie humoru; upór przy jednej formie
(np. wszędzie formy żeńskie). To różnice gustu, nie kompetencji: rozstrzyga słownik i drugi recenzent.

**Powiadomienia i wygoda:** zbiorczy mail dla tłumaczy („3 propozycje do przeglądu”), widok „do zrobienia w moim języku”,
porównanie wersji obok siebie, komentarze przy zdaniu.

**Prawo:** krótka zgoda tłumacza na przeniesienie praw do tłumaczeń przy zaproszeniu; przetwarzamy tylko e-mail i nazwę konta
(dopisać do polityki prywatności).

## 6. Zbudować czy użyć gotowego

- Gotowe: Weblate (własny hosting) lub Crowdin: pełna funkcjonalność, ale kolejna usługa i osobne logowanie; nasze treści to tytuły,
  opisy i napisy, nie pliki interfejsu.
- Własne w panelu (rekomendacja), stopniami: **A** tylko zatwierdzanie przez właściciela; **B** propozycje i przegląd przez
  drugą osobę; **C** głosowanie grupowe, zaufanie, słownik. Model danych (wersje, głosy, role) od razu pod C.

## 7. Decyzje do podjęcia przy powrocie

Model generowania (Claude API czy Workers AI), lista pierwszych języków, kto jest liderem każdego języka, próg zgód, czy szkice AI
są widoczne publicznie z etykietą, kiedy wracamy do adresów per język.
