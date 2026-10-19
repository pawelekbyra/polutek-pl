import React from 'react';

/**
 * Polish Terms of the POLUTEK.COM platform (POLUTEK MEDIA sp. z o.o.), transcribed from the owner's
 * draft. Inline markup is limited to **bold**; e-mail addresses and URLs are linked automatically.
 * Everything is rendered as React text nodes (no raw HTML).
 */
export const REGULAMIN_EFFECTIVE_DATE = 'Obowiązuje od 1 stycznia 2027 r.';

type Item = { t: string; sub?: string[]; def?: boolean };
type Section = { nr: string; title: string; kind: 'plain' | 'numbered'; items: Item[] };

const SECTIONS: Section[] = [
  {
    "nr": "§ 1",
    "title": "Informacje ogólne i definicje",
    "kind": "plain",
    "items": [
      {
        "t": "Administratorem serwisu internetowego POLUTEK.COM (dalej: „**Serwis**”) oraz podmiotem świadczącym za jego pośrednictwem usługi jest POLUTEK MEDIA Z.O.O. (dalej: „**Usługodawca**”). Kontakt w sprawach technicznych i formalnych: support@polutek.com."
      },
      {
        "t": "Za pośrednictwem Serwisu **Usługodawca** udostępnia bezpłatne **Materiały Publiczne**, sprzedaje własny produkt cyfrowy w postaci Strefy Patrona oraz umożliwia dokonywanie dobrowolnych Darowizn na zasadach określonych w niniejszym Regulaminie."
      },
      {
        "t": "Użyte w Regulaminie pojęcia oznaczają:"
      },
      {
        "t": "**Materiały Publiczne** – ogólnodostępne i bezpłatne materiały wideo, których przeglądanie nie wymaga opłat ani posiadania Konta.",
        "def": true
      },
      {
        "t": "**Strefa Patrona** – rozwijany przez Usługodawcę produkt cyfrowy w modelu **Early Access**, obejmujący pakiet zamkniętych materiałów wideo, do którego **Usługodawca** może dodawać kolejne materiały w miarę postępu prac.",
        "def": true
      },
      {
        "t": "**Użytkownik** – osoba fizyczna korzystająca z Serwisu, w tym osoba posiadająca **Konto**. Użytkownikiem może być konsument albo przedsiębiorca. Zakup Strefy Patrona jest dostępny wyłącznie dla osób pełnoletnich.",
        "def": true
      },
      {
        "t": "**Klient** – **Użytkownik**, który zawarł z Usługodawcą umowę sprzedaży Strefy Patrona.",
        "def": true
      },
      {
        "t": "**Konto** – bezpłatny profil Użytkownika w Serwisie, służący w szczególności do logowania i korzystania z zakupionej Strefy Patrona.",
        "def": true
      },
      {
        "t": "**Cena Zakupu** – kwota zapłacona przez Klienta za Strefę Patrona.",
        "def": true
      },
      {
        "t": "**Darowizna** – dobrowolna wpłata pieniężna na rzecz Usługodawcy, dokonywana na zasadach określonych w § 5.",
        "def": true
      },
      {
        "t": "Regulamin określa zasady korzystania z Serwisu, zakładania i usuwania Konta, zakupu Strefy Patrona, dokonywania Darowizn, płatności, składania reklamacji oraz korzystania z uprawnień konsumenckich."
      }
    ]
  },
  {
    "nr": "§ 2",
    "title": "Konto i wymagania techniczne",
    "kind": "numbered",
    "items": [
      {
        "t": "Założenie Konta jest bezpłatne i wymaga podania adresu e-mail oraz wykonania czynności niezbędnych do rejestracji. Umowa o prowadzenie Konta zostaje zawarta z chwilą zakończenia rejestracji i jest zawierana na czas nieoznaczony."
      },
      {
        "t": "**Użytkownik** może w każdej chwili zażądać usunięcia Konta poprzez funkcję dostępną w ustawieniach Konta, jeżeli jest udostępniona, albo wysyłając wiadomość na adres support@polutek.com."
      },
      {
        "t": "Usunięcie Konta uniemożliwia dalsze korzystanie z funkcji Serwisu wymagających zalogowania, w tym z dostępu do Strefy Patrona przypisanego do tego Konta. Samo usunięcie Konta nie powoduje automatycznie powstania prawa do zwrotu Ceny Zakupu. Postanowienie to nie wyłącza ani nie ogranicza uprawnień przysługujących Klientowi na mocy bezwzględnie obowiązujących przepisów prawa, w szczególności w przypadku braku zgodności treści cyfrowej z umową."
      },
      {
        "t": "Usunięcie Konta skutkuje rozwiązaniem umowy o jego prowadzenie. Jeżeli **Użytkownik** chce zachować dostęp do zakupionej Strefy Patrona, powinien skorzystać z procedury usunięcia Konta dopiero po uwzględnieniu skutków opisanych w ust. 3."
      },
      {
        "t": "Do korzystania z Serwisu potrzebne są urządzenie z dostępem do internetu, aktualna przeglądarka internetowa obsługująca nowoczesne standardy wideo oraz włączona obsługa JavaScript."
      },
      {
        "t": "**Usługodawca** nie gwarantuje prawidłowego działania wszystkich funkcji Serwisu na przestarzałych przeglądarkach, urządzeniach nieobsługujących wymaganych standardów technicznych ani w przypadku blokowania skryptów lub innych elementów niezbędnych do działania Serwisu."
      }
    ]
  },
  {
    "nr": "§ 3",
    "title": "Zasady zakupu Strefy Patrona",
    "kind": "numbered",
    "items": [
      {
        "t": "**Serwis** udostępnia bezpłatne **Materiały Publiczne** oraz odpłatną Strefę Patrona."
      },
      {
        "t": "Zakup Strefy Patrona wymaga posiadania Konta, zawarcia umowy sprzedaży oraz dokonania płatności. Zakupu mogą dokonać wyłącznie osoby pełnoletnie."
      },
      {
        "t": "**Serwis** oferuje jeden, nierozerwalny wariant dostępu obejmujący całą Strefę Patrona. Zakup ma charakter jednorazowy. **Serwis** nie działa w tym zakresie w modelu subskrypcyjnym ani abonamentowym."
      },
      {
        "t": "**Cena Zakupu** ustalana jest w modelu „**Płać, ile chcesz**”. **Użytkownik** sam decyduje o wysokości płatności, z zastrzeżeniem obowiązującego w chwili zakupu progu minimalnego. Cała kwota zadeklarowana i wpłacona w ramach zakupu, w tym kwota przekraczająca próg minimalny, stanowi Cenę Zakupu produktu cyfrowego."
      },
      {
        "t": "Ceny prezentowane Użytkownikowi przed złożeniem zamówienia zawierają podatek VAT, jeżeli jest on należny, oraz wszelkie inne obowiązkowe składniki ceny. Informacja o podatkach i całkowitej kwocie do zapłaty jest prezentowana przed dokonaniem płatności, zgodnie z obowiązującymi przepisami."
      },
      {
        "t": "**Usługodawca** może zmienić próg minimalny dla przyszłych zakupów. Zmiana dotyczy wyłącznie umów zawieranych po jej wprowadzeniu i nie powoduje zmiany Ceny Zakupu uiszczonej przez dotychczasowych Klientów."
      }
    ]
  },
  {
    "nr": "§ 4",
    "title": "Charakter Strefy Patrona i zasady korzystania",
    "kind": "numbered",
    "items": [
      {
        "t": "**Strefa Patrona** jest produktem cyfrowym rozwijanym w modelu **Early Access**. Zakup dotyczy dostępu do materiałów udostępnionych w Strefie Patrona na zasadach określonych w Regulaminie, a nie subskrypcji ani cyklicznej opłaty za korzystanie z Serwisu."
      },
      {
        "t": "**Strefa Patrona** jest rozwijana przy wykorzystaniu środków pochodzących ze sprzedaży. Środki uzyskane ze sprzedaży, po uwzględnieniu należnych podatków, opłat płatniczych i innych kosztów, mogą być przeznaczane na produkcję i rozwój kolejnych materiałów, w tym na scenariusze, realizację nagrań, montaż, postprodukcję i koszty techniczne."
      },
      {
        "t": "Zakres dostępu obejmuje materiały dostępne w chwili zakupu oraz materiały dodawane później w miarę postępu prac. **Usługodawca** nie gwarantuje określonej liczby, długości ani harmonogramu publikacji nowych materiałów."
      },
      {
        "t": "Dostęp do Strefy Patrona jest zapewniany przez okres jej funkcjonowania. **Usługodawca** może zakończyć rozwijanie lub udostępnianie Strefy Patrona, informując Klientów z odpowiednim wyprzedzeniem, co do zasady nie krótszym niż 90 dni. Informacja o planowanym zakończeniu zostanie przekazana na adresy e-mail przypisane do Kont, o ile jest to możliwe."
      },
      {
        "t": "Zakończenie funkcjonowania Strefy Patrona nie wyłącza ani nie ogranicza uprawnień Klientów wynikających z bezwzględnie obowiązujących przepisów prawa. Jeżeli zakończenie udostępniania produktu cyfrowego oznacza niewykonanie lub nienależyte wykonanie obowiązków Usługodawcy wynikających z umowy, **Klient** może korzystać z przysługujących mu środków prawnych."
      },
      {
        "t": "**Usługodawca** przekazuje aktualizacje niezbędne do zachowania zgodności treści cyfrowej z umową w zakresie wymaganym przez obowiązujące przepisy prawa."
      },
      {
        "t": "**Klient** uiszcza Cenę Zakupu tylko raz. Płatność odblokowuje dostęp do materiałów objętych Strefą Patrona, zgodnie z zakresem określonym w niniejszym paragrafie."
      },
      {
        "t": "Zakup Strefy Patrona stanowi umowę sprzedaży produktu cyfrowego. Nie powoduje przeniesienia autorskich praw majątkowych do materiałów ani udzielenia prawa do ich dalszego rozpowszechniania. **Klient** może korzystać z materiałów w zakresie niezbędnym do osobistego zapoznawania się z nimi, z poszanowaniem praw autorskich i przepisów prawa."
      },
      {
        "t": "Użytkownikowi zabrania się w szczególności:",
        "sub": [
          "udostępniania danych logowania do Konta innym osobom;",
          "pobierania materiałów ze Strefy Patrona, jeżeli **Serwis** nie udostępnia wyraźnie takiej funkcji;",
          "kopiowania, nagrywania, utrwalania lub obchodzenia zabezpieczeń technicznych w celu pozyskania materiałów poza funkcjami udostępnionymi przez **Serwis**;",
          "publicznego odtwarzania, udostępniania, publikowania, odsprzedawania lub dalszego rozpowszechniania materiałów, w całości lub w części, bez odpowiedniej podstawy prawnej lub zgody uprawnionego podmiotu;",
          "wykorzystywania materiałów w sposób naruszający prawa autorskie lub inne prawa osób trzecich."
        ]
      },
      {
        "t": "Postanowienia ust. 9 nie ograniczają uprawnień wynikających z bezwzględnie obowiązujących przepisów prawa."
      }
    ]
  },
  {
    "nr": "§ 5",
    "title": "Darowizny – dobrowolne wpłaty",
    "kind": "numbered",
    "items": [
      {
        "t": "**Klient** posiadający dostęp do Strefy Patrona może po zalogowaniu dobrowolnie przekazać Usługodawcy Darowiznę pieniężną za pośrednictwem funkcji udostępnionej w Serwisie. Minimalna kwota Darowizny zależy od wybranej waluty i jest wyraźnie wskazana w formularzu płatności (płatności mogą być dokonywane w różnych walutach obsługiwanych przez operatora). Darowizny mogą być przekazywane wielokrotnie."
      },
      {
        "t": "**Darowizna** jest wpłatą dobrowolną i nieodpłatną. Zgodnie z założeniami Serwisu nie stanowi ceny za dodatkowe treści, towary ani usługi i nie jest warunkiem korzystania ze Strefy Patrona."
      },
      {
        "t": "**Darowizna** nie daje dostępu do dodatkowych treści ani funkcji, nie zwiększa zakresu dostępu do Strefy Patrona i nie uprawnia do otrzymania certyfikatów, odznak, wyróżnień ani innych korzyści. **Usługodawca** nie jest zobowiązany do spełnienia świadczenia wzajemnego w zamian za Darowiznę, w szczególności do opublikowania określonych materiałów. Dostęp do Strefy Patrona nie zależy od dokonania Darowizny."
      },
      {
        "t": "**Darowizna** stanowi ogólne wsparcie działalności twórczej Usługodawcy i nie jest przeznaczona na ściśle określony cel. Sposób wykorzystania otrzymanych środków pozostaje w gestii Usługodawcy, z uwzględnieniem obowiązujących przepisów prawa."
      },
      {
        "t": "Przed dokonaniem Darowizny **Użytkownik** otrzymuje następujący komunikat: „To dobrowolna darowizna. Nie daje żadnych dodatkowych korzyści ani dostępu do treści”. **Użytkownik** potwierdza zapoznanie się z tą informacją poprzez odrębne pole wyboru, które nie jest zaznaczone domyślnie."
      },
      {
        "t": "Dokumentowanie Darowizn odbywa się zgodnie z obowiązującymi przepisami prawa oraz właściwą dla Usługodawcy kwalifikacją podatkową otrzymanych wpłat. Samo nazwanie wpłaty Darowizną w Regulaminie nie przesądza o jej kwalifikacji prawnej ani podatkowej."
      },
      {
        "t": "Z zastrzeżeniem bezwzględnie obowiązujących przepisów prawa, Darowizny nie podlegają zwrotowi. **Usługodawca** rozpatruje wnioski o zwrot w szczególności w przypadku wpłat dokonanych omyłkowo, takich jak podwójna płatność lub wpłata błędnej kwoty, a także w przypadku transakcji dokonanych bez zgody uprawnionego posiadacza instrumentu płatniczego. Postanowienie to nie wyłącza praw przysługujących na podstawie przepisów prawa."
      }
    ]
  },
  {
    "nr": "§ 6",
    "title": "Płatności i dokumentacja sprzedaży",
    "kind": "numbered",
    "items": [
      {
        "t": "Płatności za Strefę Patrona i Darowizny są obsługiwane przez zewnętrznego operatora płatności, **Stripe**, na zasadach określonych przez tego operatora. **Usługodawca** nie przechowuje pełnych danych kart płatniczych Użytkowników."
      },
      {
        "t": "Przed zatwierdzeniem płatności **Użytkownik** otrzymuje informację o jej wysokości, wybranej walucie i charakterze transakcji."
      },
      {
        "t": "Na żądanie Klienta **Usługodawca** wystawia dokument sprzedaży dotyczący zakupu Strefy Patrona, zgodnie z obowiązującymi przepisami prawa. Cała kwota zapłacona za produkt cyfrowy stanowi Cenę Zakupu i jest dokumentowana zgodnie z właściwymi zasadami rachunkowymi i podatkowymi."
      },
      {
        "t": "Dokumentowanie Darowizn odbywa się odrębnie od dokumentowania sprzedaży, z uwzględnieniem przepisów prawa i podatkowej kwalifikacji danej wpłaty."
      }
    ]
  },
  {
    "nr": "§ 7",
    "title": "Odstąpienie od umowy i zgody Użytkownika",
    "kind": "numbered",
    "items": [
      {
        "t": "Przed zawarciem umowy zakupu Strefy Patrona **Użytkownik** będący konsumentem otrzymuje informacje o zasadach odstąpienia od umowy oraz o skutkach rozpoczęcia dostarczania treści cyfrowych przed upływem ustawowego terminu na odstąpienie od umowy."
      },
      {
        "t": "Jeżeli **Usługodawca** rozpoczyna dostarczanie treści cyfrowych przed upływem 14-dniowego terminu do odstąpienia od umowy, przed dokonaniem zakupu **Użytkownik** będący konsumentem składa odrębne oświadczenie, poprzez zaznaczenie niezaznaczonego domyślnie pola wyboru, w którym:",
        "sub": [
          "wyraźnie żąda rozpoczęcia dostarczania treści cyfrowych przed upływem terminu do odstąpienia od umowy;",
          "przyjmuje do wiadomości, że po spełnieniu świadczenia przez Usługodawcę może utracić prawo odstąpienia od umowy, zgodnie z art. 38 pkt 13 ustawy o prawach konsumenta, o ile spełnione zostały wszystkie ustawowe przesłanki utraty tego prawa."
        ]
      },
      {
        "t": "Przed dokonaniem zakupu **Użytkownik** potwierdza ponadto w odrębnym, niezaznaczonym domyślnie polu wyboru, że zapoznał się z rozwojowym charakterem Strefy Patrona oraz rozumie, iż liczba, długość i terminy publikacji nowych materiałów nie są gwarantowane."
      },
      {
        "t": "Oświadczenia, o których mowa w ust. 2 i 3, są od siebie niezależne i nie mogą być zaznaczone domyślnie. **Użytkownik** otrzymuje możliwość zapoznania się z ich treścią przed dokonaniem płatności."
      },
      {
        "t": "Po zawarciu umowy **Usługodawca** przesyła na adres e-mail przypisany do Konta potwierdzenie zawarcia umowy oraz potwierdzenie złożonych oświadczeń na trwałym nośniku, zgodnie z obowiązującymi przepisami prawa."
      },
      {
        "t": "Poza przypadkami przewidzianymi w bezwzględnie obowiązujących przepisach prawa, w szczególności dotyczącymi braku zgodności treści cyfrowej z umową, zwroty płatności za Strefę Patrona rozpatrywane są w przypadku wpłat dokonanych omyłkowo, takich jak podwójna płatność lub błędna kwota, oraz transakcji dokonanych bez zgody uprawnionego posiadacza instrumentu płatniczego."
      },
      {
        "t": "Postanowienia niniejszego paragrafu nie wyłączają ani nie ograniczają praw konsumenta wynikających z ustawy o prawach konsumenta ani innych bezwzględnie obowiązujących przepisów prawa."
      }
    ]
  },
  {
    "nr": "§ 8",
    "title": "Reklamacje",
    "kind": "numbered",
    "items": [
      {
        "t": "Reklamacje dotyczące działania Serwisu, prowadzenia Konta lub zgodności Strefy Patrona z umową można składać na adres support@polutek.com."
      },
      {
        "t": "Reklamacja powinna w miarę możliwości zawierać adres e-mail przypisany do Konta, opis problemu oraz oczekiwany sposób jego rozwiązania. Brak informacji, które nie są niezbędne do rozpatrzenia reklamacji, nie stanowi samodzielnej podstawy do jej odrzucenia."
      },
      {
        "t": "**Usługodawca** rozpatruje reklamację w terminie 14 dni od jej otrzymania i przekazuje odpowiedź na adres e-mail wskazany przez zgłaszającego, o ile bezwzględnie obowiązujące przepisy prawa nie przewidują innego terminu lub sposobu postępowania."
      },
      {
        "t": "W przypadku stwierdzenia braku zgodności treści cyfrowej z umową konsumentowi przysługują środki ochrony przewidziane w obowiązujących przepisach prawa, w tym dotyczące doprowadzenia treści cyfrowej do zgodności z umową, obniżenia ceny lub odstąpienia od umowy, jeżeli spełnione są ustawowe przesłanki."
      },
      {
        "t": "Regulamin nie wyłącza ani nie ogranicza uprawnień konsumenta wynikających z bezwzględnie obowiązujących przepisów prawa."
      }
    ]
  },
  {
    "nr": "§ 9",
    "title": "Dane osobowe",
    "kind": "numbered",
    "items": [
      {
        "t": "Zasady przetwarzania danych osobowych Użytkowników określa Polityka Prywatności dostępna pod adresem polutek.pl/polityka."
      },
      {
        "t": "Dane płatnicze są przetwarzane przez operatora płatności **Stripe** zgodnie z zasadami i dokumentami tego operatora. Informacje o zakresie przetwarzania danych przez Usługodawcę oraz podmioty współpracujące znajdują się w Polityce Prywatności."
      }
    ]
  },
  {
    "nr": "§ 10",
    "title": "Postanowienia końcowe",
    "kind": "numbered",
    "items": [
      {
        "t": "**Użytkownik** nie może publikować w Serwisie, w szczególności w komentarzach, treści bezprawnych, naruszających prawa osób trzecich, obraźliwych, stanowiących spam lub zagrażających bezpieczeństwu Serwisu. **Usługodawca** może usuwać treści naruszające te zasady."
      },
      {
        "t": "W przypadku podejrzenia poważnego naruszenia Regulaminu **Usługodawca** może wszcząć procedurę wyjaśniającą. Co do zasady **Użytkownik** zostanie poinformowany o zarzucanym naruszeniu na adres e-mail przypisany do Konta i otrzyma 7 dni na złożenie wyjaśnień."
      },
      {
        "t": "**Usługodawca** może czasowo ograniczyć funkcje Konta lub zablokować **Konto** w przypadku poważnego albo powtarzającego się naruszenia Regulaminu, jeżeli jest to uzasadnione charakterem naruszenia. Środek zastosowany przez Usługodawcę powinien być proporcjonalny do naruszenia."
      },
      {
        "t": "W sytuacjach, w których natychmiastowe działanie jest niezbędne dla ochrony bezpieczeństwa Serwisu, praw osób trzecich lub wykonania obowiązków prawnych, **Usługodawca** może zastosować tymczasowe ograniczenie dostępu bez uprzedniego wezwania. **Użytkownik** zostanie poinformowany o przyczynach działania, o ile przepisy prawa lub względy bezpieczeństwa nie stoją temu na przeszkodzie."
      },
      {
        "t": "**Użytkownik** może zwrócić się do Usługodawcy o ponowne rozpatrzenie decyzji o ograniczeniu lub zablokowaniu Konta, przedstawiając swoje stanowisko na adres support@polutek.com. **Usługodawca** rozpatrzy takie zgłoszenie w rozsądnym terminie."
      },
      {
        "t": "Zablokowanie lub usunięcie Konta nie pozbawia Użytkownika praw wynikających z bezwzględnie obowiązujących przepisów prawa, w tym praw związanych z zakupionym produktem cyfrowym. Skutki dla dostępu do Strefy Patrona zależą od okoliczności sprawy oraz właściwych przepisów prawa."
      },
      {
        "t": "**Usługodawca** może zmienić Regulamin w przypadku zmiany przepisów prawa, sposobu technicznego działania Serwisu, zakresu świadczonych usług lub innych istotnych okoliczności uzasadniających zmianę. O zmianach Użytkownicy posiadający **Konto** zostaną poinformowani e-mailem z co najmniej 14-dniowym wyprzedzeniem, jeżeli jest to wymagane lub uzasadnione charakterem zmiany."
      },
      {
        "t": "Zmiany Regulaminu nie naruszają praw nabytych przez Klientów. Do umów zawartych przed wejściem w życie zmiany stosuje się zasady wynikające z zawartej umowy oraz właściwych przepisów prawa. Zmiana Regulaminu nie może sama w sobie pozbawić Klienta uprawnień przysługujących mu z tytułu zakupu Strefy Patrona."
      },
      {
        "t": "Prawem właściwym dla umów zawieranych na podstawie Regulaminu jest prawo polskie, z zastrzeżeniem bezwzględnie obowiązujących przepisów chroniących konsumenta, które mogą mieć zastosowanie niezależnie od tego wyboru."
      },
      {
        "t": "Konsument może korzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń na zasadach określonych w obowiązujących przepisach prawa. Informacje o dostępnych procedurach można uzyskać w szczególności u właściwych miejskich lub powiatowych rzeczników konsumentów oraz na stronach Urzędu Ochrony Konkurencji i Konsumentów."
      },
      {
        "t": "Regulamin wchodzi w życie z dniem 1.01.2027 r."
      },
      {
        "t": "Pod adresem http://ec.europa.eu/consumers/odr dostępna jest unijna platforma internetowego systemu rozstrzygania sporów (platforma ODR)."
      }
    ]
  }
];

const TOKEN = /(\*\*[^*]+\*\*|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|https?:\/\/[^\s,;)]+|polutek\.pl\/polityka)/g;
const linkClass = 'underline hover:text-primary';

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**')) return <strong key={i} className="font-bold text-[var(--chan-ink)]">{part.slice(2, -2)}</strong>;
        if (part.includes('@')) return <a key={i} href={`mailto:${part}`} className={linkClass}>{part}</a>;
        if (part.startsWith('http')) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={linkClass}>{part}</a>;
        if (part === 'polutek.pl/polityka') return <a key={i} href="/polityka-prywatnosci" className={linkClass}>{part}</a>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

function SectionBody({ section }: { section: Section }) {
  if (section.kind === 'plain') {
    return (
      <>
        {section.items.map((item, i) => (
          <p key={i} className={item.def ? 'pl-4' : undefined}><Inline text={item.t} /></p>
        ))}
      </>
    );
  }
  return (
    <ol className="list-decimal space-y-2 pl-5">
      {section.items.map((item, i) => (
        <li key={i}>
          <Inline text={item.t} />
          {item.sub ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {item.sub.map((s, j) => <li key={j}><Inline text={s} /></li>)}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type SectionComponent = React.ComponentType<{ nr: string; title: string; children: React.ReactNode }>;

/** `LegalSection` is passed in by LegalDocs.tsx (avoids a circular import). */
export function RegulaminPlatformyBody({ LegalSection }: { LegalSection: SectionComponent }) {
  return (
    <div className="space-y-10">
      {SECTIONS.map((section) => (
        <LegalSection key={section.nr} nr={section.nr} title={section.title}>
          <SectionBody section={section} />
        </LegalSection>
      ))}
    </div>
  );
}
