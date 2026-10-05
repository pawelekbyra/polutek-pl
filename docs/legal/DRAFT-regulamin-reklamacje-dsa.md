# SZKIC: uzupełnienia Regulaminu (reklamacje, zgłaszanie treści, moderacja)

> **DO PRZEGLĄDU PRAWNIKA. Nie publikować w serwisie bez jego zgody.** To szkic przygotowany przez agenta
> inżynieryjnego (nie jest poradą prawną). Nie jest wczytywany przez żadną stronę (`LegalDocs.tsx` bez zmian).
> Stan faktów: 2026-10-05. Dotyczy znalezisk LEG-06, LEG-15, LEG-16, LEG-19 z `docs/audit/2026-10-03/audit-legal-privacy.md`.

## 1. Co mówi prawo (sprawdzone w sieci, wymaga potwierdzenia prawnika)

- **Art. 8 ust. 3 pkt 4 UŚUDE:** regulamin usługi elektronicznej określa tryb postępowania reklamacyjnego. Dotyczy
  też usług bezpłatnych (konto, komentarze, odtwarzanie). Regulamin z 2026-09-22 tej sekcji nie ma.
- **DSA (rozporządzenie 2022/2065)**, dostawca usługi hostingu (komentarze użytkowników = przechowywanie informacji
  na żądanie odbiorcy): art. 11 (punkt kontaktowy dla organów), art. 12 (punkt kontaktowy dla odbiorców, szybka
  komunikacja elektroniczna), art. 14 (warunki: zasady i procedury moderacji w regulaminie, prostym językiem),
  **art. 16 (mechanizm zgłaszania nielegalnych treści)**, art. 17 (uzasadnienie decyzji o ukryciu/usunięciu treści
  i informacja o środkach odwoławczych). Art. 15 (raporty przejrzystości) i art. 19-28 (platformy: wewnętrzny
  system skarg, pozasądowe rozstrzyganie sporów, zaufani zgłaszający) **nie obowiązują mikro i małych
  przedsiębiorstw**; art. 16-17 obowiązują wszystkich dostawców hostingu ([przegląd obowiązków małych dostawców](https://creativa.legal/dsa-obowiazki-aplikacji-saas/),
  [YPOG o DSA](https://www.ypog.law/en/insight/digital-services-act)).
- **Polska ustawa wdrażająca DSA** (nowelizacja UŚUDE, Prezes UKE koordynatorem usług cyfrowych; źródła podają datę
  podpisania 25.09 lub 28.09.2026 i datę ustawy 31.07 lub 04.09.2026: **zweryfikować w Dz.U.**):
  [UKE](https://uke.gov.pl/uslugi-cyfrowe/aktualnosci/sejm-uchwalil-ustawe-wdrazajaca-przepisy-aktu-o-uslugach-cyfrowych-prezes-uke-koordynatorem-ds-uslug-cyfrowych,26.html),
  [prawo.pl](https://www.prawo.pl/biznes/pierwsza-ustawa-wdrazajaca-dsa-kompetencje-prezesa-uke,1552189.html).
  Usługodawca podaje m.in. nazwę, adres, adres elektroniczny; dostawca hostingu wyznacza punkt kontaktowy.
- **Do rozstrzygnięcia przez prawnika:** czy niekomercyjny serwis osoby fizycznej w ogóle jest „usługą
  społeczeństwa informacyjnego” (zwykle świadczona za wynagrodzeniem; napiwki mogą być uznane za wynagrodzenie),
  czy jest przedsiębiorcą w rozumieniu ustawy, i czy jest „mikroprzedsiębiorcą”. Szkic zakłada wariant ostrożny:
  stosujemy obowiązki hostingu (art. 11, 12, 14, 16, 17).

## 2. Stan techniczny (co już jest w kodzie)

| Wymóg | Stan |
|---|---|
| Zgłoszenie komentarza | tylko zalogowany (`report-comment.use-case.ts`); **brak formularza dla gościa** i brak pól wymaganych przez art. 16 ust. 2 (uzasadnienie, dokładny adres URL, imię i e-mail zgłaszającego, oświadczenie dobrej wiary) |
| Uzasadnienie dla autora (art. 17) | brak powiadomienia autora o ukryciu/usunięciu |
| Informacja dla zgłaszającego (art. 16 ust. 5) | brak |
| Funkcja blokady konta | brak (Regulamin ją zapowiada: do usunięcia z tekstu albo do zbudowania) |
| Punkt kontaktowy | `support@pawelperfect.com` (opisany w Regulaminie jako „sprawy techniczne”: poprawić) |
| Eksport danych / usunięcie konta | są (`/api/user/export`, usunięcie w ustawieniach konta) |

Zbudowanie formularza zgłoszeń dla gości i powiadomień o decyzjach to osobne zadanie inżynieryjne (po decyzji
prawnika o zakresie), poza tym PR-em.

## 3. Proponowany tekst (do wstawienia jako nowe paragrafy; numeracja do dopasowania)

**§ 6. Kontakt i zgłaszanie treści**
1. Punkt kontaktowy dla użytkowników i organów (art. 11 i 12 DSA): `support@pawelperfect.com`. Piszemy po polsku i po
   angielsku. Wiadomości o nielegalnych treściach potwierdzamy niezwłocznie.
2. Każdy, także bez konta, może zgłosić treść, którą uważa za nielegalną, wysyłając na ten adres: (a) uzasadnienie,
   dlaczego treść jest nielegalna; (b) dokładny adres treści (URL lub link do komentarza); (c) swoje imię i nazwisko
   oraz adres e-mail (nie dotyczy zgłoszeń dotyczących wykorzystywania seksualnego dzieci); (d) oświadczenie, że
   zgłoszenie jest składane w dobrej wierze i zawiera prawdziwe informacje. Zalogowani mogą użyć przycisku „Zgłoś”
   przy komentarzu.
3. Zgłoszenie rozpatrujemy bez zbędnej zwłoki, starannie i obiektywnie. O decyzji informujemy zgłaszającego i
   wskazujemy możliwości odwołania.

**§ 7. Moderacja**
1. Możemy ukryć lub usunąć komentarz, który jest nielegalny albo narusza Regulamin (obraźliwy, spam, naruszający
   prawa osób trzecich, ujawniający dane innych osób, wprowadzający w błąd) oraz czasowo zablokować możliwość
   komentowania. Decyzje podejmuje człowiek; nie stosujemy zautomatyzowanego podejmowania decyzji.
2. Autora komentarza, którego treść ukryliśmy lub usunęliśmy, informujemy o decyzji, jej podstawie (przepis albo
   punkt Regulaminu), tym, czy decyzja wynikała ze zgłoszenia, oraz o możliwości odwołania się do nas i do sądu (art. 17 DSA).

**§ 8. Reklamacje (art. 8 ust. 3 pkt 4 UŚUDE)**
1. Reklamacje dotyczące działania serwisu (konto, logowanie, komentarze, odtwarzanie, powiadomienia) można składać
   e-mailem na `support@pawelperfect.com`, podając adres e-mail konta i opis problemu.
2. Reklamację rozpatrujemy w terminie 14 dni od otrzymania i odpowiadamy e-mailem. Gdy potrzebujemy informacji,
   prosimy o uzupełnienie; termin biegnie od uzupełnienia.
3. Reklamacja nie ogranicza prawa do dochodzenia roszczeń przed sądem ani do skargi do organu (w Polsce:
   Prezes UKE jako koordynator usług cyfrowych, a w sprawach danych osobowych Prezes UODO).

**§ 9. Zmiany Regulaminu (zamiast „dalsze korzystanie = akceptacja”)**
1. O istotnej zmianie Regulaminu informujemy w serwisie i, dla zalogowanych, e-mailem z co najmniej 14-dniowym
   wyprzedzeniem; poprzednią wersję archiwizujemy (numer wersji i data).
2. Do czasu wejścia zmiany w życie można usunąć konto; dalsze korzystanie po tym terminie oznacza przyjęcie zmian
   (do oceny prawnika pod kątem art. 385³ k.c.).

**Wiek:** *[do decyzji prawnika: minimalny wiek (propozycja 16 lat, art. 8 RODO i zgoda marketingowa), czy
wpłaty wymagają pełnoletności, czy wystarczy oświadczenie przy rejestracji/napiwku.]*

## 4. Wnioski dla właściciela (bez pytań w trakcie pracy, do decyzji przy odbiorze)

1. Zlecić prawnikowi ocenę statusu serwisu (DSA/UŚUDE) przed startem publicznym.
2. Zdecydować, czy budujemy formularz zgłoszeń dla gości i powiadomienia o decyzjach (M, po opinii prawnika).
3. Usunąć z Regulaminu zapowiedź „blokady konta”, jeśli funkcja nie powstanie.
