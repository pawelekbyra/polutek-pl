# Refaktoryzacja architektury do modular monolith

## Cel

Celem tej refaktoryzacji jest uporządkowanie aplikacji w kierunku architektury **modular monolith**.

Aplikacja nadal pozostaje jednym deployowalnym monolitem, ale jej logika biznesowa ma być organizowana w wyraźnie wydzielone moduły domenowe. Każdy moduł powinien posiadać własne API aplikacyjne, logikę domenową, typy, walidacje i testy.

Nowa logika domenowa nie powinna być dodawana do starych, globalnych serwisów w `lib/services/**`. Te pliki traktujemy jako źródło migracji, a nie jako docelowy wzorzec architektury.

Docelowym miejscem dla logiki domenowej jest:

```txt
lib/modules/**
```

Refaktoryzacja ma być wykonywana etapami. Każdy etap musi być mały, weryfikowalny i bezpieczny. Nie wolno przenosić krytycznej logiki biznesowej bez testów zabezpieczających aktualne zachowanie.

---

## Najważniejsze zasady

### 1. Nie zmieniaj zachowania biznesowego bez testów

Refaktoryzacja nie powinna zmieniać zachowania aplikacji.

Przed przeniesieniem logiki biznesowej należy dodać testy baseline, które opisują obecne zachowanie. Dopiero potem można przenosić kod.

Po migracji testy muszą nadal przechodzić.

Jeżeli nie da się dodać sensownego testu baseline, nie przenoś tej logiki w danym kroku. Najpierw dopisz brakujące testy lub oznacz temat jako wymagający osobnego przygotowania.

---

### 2. Nowa logika domenowa trafia do `lib/modules/**`

Nowe przypadki użycia, operacje domenowe, walidacje i reguły biznesowe powinny być umieszczane w modułach:

```txt
lib/modules/<domain>/
```

Przykładowa struktura modułu:

```txt
lib/modules/channel/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Nie każdy moduł musi od razu posiadać wszystkie katalogi. Struktura powinna wynikać z faktycznych potrzeb domeny.

---

### 3. Stare serwisy są źródłem migracji, nie miejscem rozwoju

Pliki w:

```txt
lib/services/**
```

mogą być używane jako istniejące źródło logiki, ale nie są docelową architekturą.

Nie należy dodawać tam nowych reguł biznesowych, jeżeli dotyczą domen, które są już przenoszone do `lib/modules/**`.

Dopuszczalne są jedynie małe poprawki techniczne, bugfixy lub adaptery przejściowe, jeśli są potrzebne do bezpiecznej migracji.

---

### 4. Route handlery i server actions mają być cienkie

Warstwa wejścia, np.:

```txt
app/api/**
app/**/actions.ts
```

nie powinna zawierać ciężkiej logiki biznesowej.

Route handler powinien głównie:

1. odczytać dane wejściowe,
2. wykonać autoryzację / sprawdzenie sesji, jeśli jest wymagane,
3. wywołać odpowiedni use case z modułu,
4. zwrócić odpowiedź.

Logika typu naliczanie opłat, zmiana statusu, uprawnienia domenowe, przeliczanie limitów, publikowanie materiałów, obsługa kanałów czy kampanii nie powinna mieszkać bezpośrednio w route handlerach.

---

### 5. Krytyczne domeny wymagają szczególnej ostrożności

Szczególnie ostrożnie należy migrować obszary:

```txt
video
media
patron
payments
channel
campaign
auth
```

Dla tych obszarów wymagane są testy przed przenoszeniem logiki.

Nie wolno wykonywać dużych, jednoczesnych migracji obejmujących wiele krytycznych domen naraz.

---

### 6. Migracja powinna być etapowa

Każdy etap powinien kończyć się działającą aplikacją.

Nie należy zostawiać repozytorium w stanie pośrednim, w którym:

* część importów wskazuje na stare miejsce, a część na nowe bez uzasadnienia,
* testy nie przechodzą,
* typy są niespójne,
* nowy moduł istnieje, ale nie jest faktycznie używany,
* stary kod został usunięty bez pokrycia migracji testami.

---

## Docelowy podział domenowy

Poniższa mapa opisuje docelowy kierunek migracji.

Nie oznacza to, że wszystko musi zostać przeniesione natychmiast. Mapa służy do podejmowania decyzji, gdzie powinna trafić dana logika.

```txt
lib/modules/auth
  Logika uwierzytelniania, sesji, ról i uprawnień aplikacyjnych.

lib/modules/channel
  Kanały twórców, konfiguracja kanału, status kanału, powiązanie użytkownika z kanałem.

lib/modules/video
  Materiały wideo, ich publikacja, statusy, widoczność, metadane i relacje z kanałem.

lib/modules/media
  Uploady, assety, pliki, miniatury, integracja z przechowywaniem mediów.

lib/modules/campaign
  Kampanie crowdfundingowe, ich statusy, reguły publikacji i walidacje.

lib/modules/patron
  Patroni, wsparcia, relacje patron–twórca, historia wsparcia.

lib/modules/payments
  Płatności, rozliczenia, statusy transakcji, integracje płatnicze.

lib/modules/notifications
  Powiadomienia systemowe i domenowe.

lib/modules/user
  Profil użytkownika, preferencje, dane konta.
```

---

## Sugerowany szkielet modułu

Przykład:

```txt
lib/modules/channel/
  application/
    create-channel.use-case.ts
    update-channel.use-case.ts
    get-channel.use-case.ts

  domain/
    channel.types.ts
    channel.rules.ts
    channel.errors.ts

  infrastructure/
    channel.repository.ts

  tests/
    create-channel.test.ts
    update-channel.test.ts

  index.ts
```

Znaczenie katalogów:

```txt
application/
  Przypadki użycia wywoływane przez route handlery, server actions lub inne moduły.

domain/
  Reguły domenowe, typy, walidacje, błędy domenowe, czyste funkcje.

infrastructure/
  Adaptery do bazy danych, Prisma, storage, zewnętrznych API.

tests/
  Testy danego modułu.

index.ts
  Publiczne API modułu.
```

---

## Zasady zależności między modułami

Moduły nie powinny importować losowych plików wewnętrznych z innych modułów.

Preferowany import:

```ts
import { getChannelById } from "@/lib/modules/channel";
```

Niepreferowany import:

```ts
import { getChannelById } from "@/lib/modules/channel/infrastructure/channel.repository";
```

Jeżeli moduł musi udostępniać coś innym częściom aplikacji, powinno to zostać wyeksportowane przez jego `index.ts`.

Wewnętrzne szczegóły modułu powinny pozostać prywatne.

---

## Zasady dla nowych zmian

Od momentu rozpoczęcia tej refaktoryzacji obowiązują następujące reguły:

1. Nie dodawaj nowej logiki domenowej do `lib/services/**`, jeśli istnieje lub powstaje odpowiedni moduł w `lib/modules/**`.

2. Nie dodawaj ciężkiej logiki biznesowej do route handlerów w `app/api/**`.

3. Nie twórz importów z wewnętrznych katalogów innego modułu, jeżeli dana funkcja może być wystawiona przez publiczne API modułu.

4. Nie usuwaj starego serwisu, dopóki wszystkie jego użycia nie zostały bezpiecznie zmigrowane.

5. Nie oznaczaj etapu jako zakończonego, jeżeli nie zostały uruchomione wymagane walidacje.

---

## Minimalna walidacja po każdym etapie

Po każdym zakończonym etapie należy uruchomić:

```bash
npx prisma validate
npm run typecheck
npm test -- --run
npm run lint
```

Jeżeli któryś z tych kroków nie działa, należy to jasno opisać w podsumowaniu zmian.

Nie wolno oznaczać etapu jako ukończonego, jeśli walidacja nie została wykonana albo zakończyła się błędem.

---

# Plan refaktoryzacji

## R0 — zasady i infrastruktura refaktoryzacji

Status: `[ ]`

Cel: przygotować repozytorium do bezpiecznej, etapowej refaktoryzacji.

Zakres:

* uporządkować dokumentację refaktoryzacji,
* opisać docelową architekturę modular monolith,
* dodać jasne reguły dla nowych zmian,
* dodać przykłady poprawnej i niepoprawnej migracji,
* przygotować checklisty dla kolejnych etapów,
* nie przenosić jeszcze logiki biznesowej.

Zadania:

* [ ] Uporządkować ten dokument jako finalny kontrakt refaktoryzacji.
* [ ] Usunąć z dokumentacji instrukcje edycyjne typu `DODAJ`, `ZASTĄP`, `SEKCJA DO WKLEJENIA`.
* [ ] Zsynchronizować `ARCHITECTURE.md` z zasadami modular monolith.
* [ ] Utworzyć `REFACTORING_EXAMPLES.md`.
* [ ] Dodać przykłady cienkich route handlerów.
* [ ] Dodać przykłady publicznego API modułu przez `index.ts`.
* [ ] Dodać przykłady migracji starego serwisu do modułu.
* [ ] Dodać listę zabronionych wzorców.
* [ ] Dodać status etapów R0–R11.
* [ ] Uruchomić minimalną walidację.

Nie robić w R0:

* nie przenosić logiki biznesowej,
* nie usuwać starych serwisów,
* nie zmieniać zachowania aplikacji,
* nie wykonywać migracji domen krytycznych.

Kryteria ukończenia:

* dokumentacja jasno opisuje kierunek refaktoryzacji,
* agent AI może na jej podstawie wykonać kolejne etapy bez zgadywania,
* istnieją przykłady dobrych i złych zmian,
* walidacja przeszła lub błędy są jawnie opisane.

---

## R1 — guardy architektoniczne i baseline testów

Status: `[ ]`

Cel: dodać zabezpieczenia przed chaotycznym rozwojem starej architektury.

Zakres:

* wprowadzić techniczne reguły ostrzegające przed nową logiką w starych serwisach,
* dodać testy baseline dla krytycznych domen,
* przygotować repozytorium do bezpiecznego przenoszenia logiki.

Zadania:

* [ ] Dodać testy baseline dla logiki channel.
* [ ] Dodać testy baseline dla logiki video.
* [ ] Dodać testy baseline dla logiki media.
* [ ] Dodać testy baseline dla logiki patron/payments.
* [ ] Dodać testy baseline dla krytycznych route handlerów.
* [ ] Dodać skrypt lub regułę wykrywającą nowe importy z deprecated services.
* [ ] Dodać skrypt lub regułę wykrywającą zbyt ciężkie route handlery.
* [ ] Dodać skrypt lub regułę sprawdzającą granice modułów.
* [ ] Podpiąć guardy do komendy jakościowej, jeśli to możliwe.

Proponowane skrypty:

```json
{
  "quality:architecture-boundaries": "...",
  "quality:no-deprecated-imports": "...",
  "quality:thin-routes": "..."
}
```

Jeżeli skrypty nie zostaną jeszcze technicznie zaimplementowane, należy zostawić je jako jawne zadania w checklistach i nie oznaczać R1 jako ukończonego.

Kryteria ukończenia:

* istnieją testy baseline dla pierwszych krytycznych obszarów,
* istnieje przynajmniej podstawowy mechanizm pilnujący nowych importów / granic architektury,
* można bezpiecznie rozpocząć migrację pierwszego modułu.

---

## R2 — moduł channel

Status: `[ ]`

Cel: wydzielić logikę kanałów do `lib/modules/channel`.

Zakres:

* identyfikacja istniejącej logiki kanałów,
* dodanie testów baseline,
* utworzenie modułu `channel`,
* przeniesienie logiki przypadków użycia,
* pozostawienie route handlerów jako cienkiej warstwy wejścia.

Docelowa struktura:

```txt
lib/modules/channel/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Znaleźć istniejące pliki odpowiedzialne za logikę kanałów.
* [ ] Dodać lub uzupełnić testy baseline.
* [ ] Utworzyć `lib/modules/channel`.
* [ ] Wydzielić typy i błędy domenowe.
* [ ] Wydzielić reguły domenowe.
* [ ] Wydzielić przypadki użycia.
* [ ] Wydzielić repository/adaptory Prisma.
* [ ] Zaktualizować route handlery i server actions.
* [ ] Upewnić się, że publiczne API modułu przechodzi przez `index.ts`.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie mieszać migracji channel z video lub payments,
* nie zmieniać reguł biznesowych kanałów bez osobnej decyzji,
* nie usuwać starego kodu przed potwierdzeniem braku użyć.

---

## R3 — moduł media

Status: `[ ]`

Cel: wydzielić logikę mediów, uploadów i assetów do `lib/modules/media`.

Zakres:

* uploady,
* assety,
* pliki,
* miniatury,
* integracje storage,
* walidacje plików.

Docelowa struktura:

```txt
lib/modules/media/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Zidentyfikować istniejącą logikę mediów.
* [ ] Dodać testy baseline dla uploadów i assetów.
* [ ] Utworzyć moduł `media`.
* [ ] Wydzielić reguły walidacji mediów.
* [ ] Wydzielić adaptery storage.
* [ ] Wydzielić przypadki użycia.
* [ ] Zaktualizować route handlery.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie zmieniać dostawcy storage przy okazji refaktoryzacji,
* nie zmieniać limitów, typów plików ani reguł publikacji bez osobnego zadania,
* nie mieszać migracji media z logiką video poza jasno określonym publicznym API.

---

## R4 — moduł video

Status: `[ ]`

Cel: wydzielić logikę materiałów wideo do `lib/modules/video`.

Zakres:

* tworzenie materiału wideo,
* aktualizacja metadanych,
* statusy wideo,
* publikacja,
* widoczność,
* relacje z kanałem i mediami.

Docelowa struktura:

```txt
lib/modules/video/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Zidentyfikować istniejącą logikę video.
* [ ] Dodać testy baseline dla statusów i publikacji.
* [ ] Utworzyć moduł `video`.
* [ ] Wydzielić typy i błędy domenowe.
* [ ] Wydzielić reguły statusów.
* [ ] Wydzielić przypadki użycia.
* [ ] Zaktualizować route handlery.
* [ ] Upewnić się, że integracja z `channel` i `media` odbywa się przez publiczne API.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie zmieniać zasad widoczności,
* nie zmieniać modelu publikacji,
* nie modyfikować logiki mediów poza adapterem integracyjnym.

---

## R5 — moduł campaign

Status: `[ ]`

Cel: wydzielić logikę kampanii crowdfundingowych do `lib/modules/campaign`.

Zakres:

* tworzenie kampanii,
* aktualizacja kampanii,
* statusy kampanii,
* publikacja,
* walidacje domenowe,
* powiązanie kampanii z kanałem / twórcą.

Docelowa struktura:

```txt
lib/modules/campaign/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Zidentyfikować istniejącą logikę kampanii.
* [ ] Dodać testy baseline dla statusów kampanii.
* [ ] Utworzyć moduł `campaign`.
* [ ] Wydzielić reguły publikacji kampanii.
* [ ] Wydzielić przypadki użycia.
* [ ] Zaktualizować route handlery.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie zmieniać zasad aktywacji kampanii,
* nie zmieniać relacji kampanii z płatnościami bez osobnego etapu,
* nie mieszać migracji campaign z patron/payments.

---

## R6 — moduł patron

Status: `[ ]`

Cel: wydzielić logikę patronów i wsparć do `lib/modules/patron`.

Zakres:

* relacje patron–twórca,
* wsparcia,
* historia wsparcia,
* uprawnienia wynikające ze wsparcia,
* integracja z płatnościami.

Docelowa struktura:

```txt
lib/modules/patron/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Zidentyfikować istniejącą logikę patronów.
* [ ] Dodać testy baseline.
* [ ] Utworzyć moduł `patron`.
* [ ] Wydzielić reguły domenowe.
* [ ] Wydzielić przypadki użycia.
* [ ] Zdefiniować publiczne API integracji z payments.
* [ ] Zaktualizować route handlery.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie zmieniać zasad naliczania wsparć,
* nie zmieniać statusów płatności,
* nie mieszać domen patron i payments poza publicznym kontraktem.

---

## R7 — moduł payments

Status: `[ ]`

Cel: wydzielić logikę płatności do `lib/modules/payments`.

Zakres:

* statusy płatności,
* transakcje,
* integracje płatnicze,
* webhooki,
* rozliczenia,
* błędy płatnicze.

Docelowa struktura:

```txt
lib/modules/payments/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Zidentyfikować istniejącą logikę płatności.
* [ ] Dodać testy baseline dla statusów i webhooków.
* [ ] Utworzyć moduł `payments`.
* [ ] Wydzielić typy i błędy domenowe.
* [ ] Wydzielić adaptery integracji zewnętrznych.
* [ ] Wydzielić przypadki użycia.
* [ ] Zaktualizować route handlery/webhooki.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie zmieniać zasad obsługi webhooków bez osobnego testu,
* nie zmieniać mapowania statusów płatności bez osobnej decyzji,
* nie zmieniać dostawcy płatności w ramach refaktoryzacji.

---

## R8 — moduł auth/user

Status: `[ ]`

Cel: uporządkować logikę użytkownika, sesji i uprawnień.

Zakres:

* profil użytkownika,
* role,
* uprawnienia,
* sesje,
* integracja z auth providerem,
* dane konta.

Docelowa struktura:

```txt
lib/modules/auth/
  application/
  domain/
  infrastructure/
  tests/
  index.ts

lib/modules/user/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Zidentyfikować istniejącą logikę auth i user.
* [ ] Rozdzielić odpowiedzialności między `auth` i `user`.
* [ ] Dodać testy baseline dla uprawnień.
* [ ] Utworzyć moduły `auth` i `user`.
* [ ] Wydzielić przypadki użycia.
* [ ] Zaktualizować route handlery.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie zmieniać providerów auth,
* nie zmieniać modelu sesji bez osobnego zadania,
* nie mieszać uprawnień technicznych z regułami domenowymi, jeśli można je rozdzielić.

---

## R9 — notifications i zdarzenia domenowe

Status: `[ ]`

Cel: uporządkować powiadomienia i zdarzenia domenowe.

Zakres:

* powiadomienia systemowe,
* powiadomienia domenowe,
* zdarzenia między modułami,
* adaptery wysyłki.

Docelowa struktura:

```txt
lib/modules/notifications/
  application/
  domain/
  infrastructure/
  tests/
  index.ts
```

Zadania:

* [ ] Zidentyfikować istniejącą logikę powiadomień.
* [ ] Dodać testy baseline.
* [ ] Utworzyć moduł `notifications`.
* [ ] Wydzielić adaptery wysyłki.
* [ ] Wydzielić typy zdarzeń.
* [ ] Uporządkować integracje między modułami.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie wprowadzać pełnego event busa, jeśli nie jest potrzebny,
* nie przenosić logiki biznesowej innych modułów do notifications,
* nie zmieniać treści krytycznych powiadomień bez testów lub akceptacji.

---

## R10 — usuwanie deprecated services

Status: `[ ]`

Cel: usunąć lub ograniczyć stare globalne serwisy po zakończeniu migracji domen.

Zakres:

* audyt `lib/services/**`,
* usunięcie martwego kodu,
* zastąpienie importów publicznym API modułów,
* oznaczenie pozostałych serwisów jako legacy, jeśli nie da się ich jeszcze usunąć.

Zadania:

* [ ] Wypisać wszystkie pliki w `lib/services/**`.
* [ ] Sprawdzić użycia każdego serwisu.
* [ ] Usunąć serwisy bez użyć.
* [ ] Zastąpić importy do starych serwisów importami z `lib/modules/**`.
* [ ] Oznaczyć nieprzeniesione serwisy jako legacy.
* [ ] Dodać komentarze migracyjne tam, gdzie usunięcie nie jest jeszcze możliwe.
* [ ] Uruchomić minimalną walidację.

Nie robić:

* nie usuwać serwisów, które nadal są używane,
* nie usuwać kodu bez potwierdzenia testami,
* nie robić dużych zmian zachowania przy okazji sprzątania.

---

## R11 — finalne utwardzenie architektury

Status: `[ ]`

Cel: dopiąć reguły architektury i utrudnić powrót do starego stylu kodu.

Zakres:

* finalne guardy,
* finalne reguły importów,
* dokumentacja,
* testy,
* czyszczenie TODO,
* ujednolicenie publicznych API modułów.

Zadania:

* [ ] Sprawdzić, czy wszystkie moduły mają publiczne `index.ts`.
* [ ] Sprawdzić, czy route handlery są cienkie.
* [ ] Sprawdzić, czy nie powstają nowe zależności do deprecated services.
* [ ] Sprawdzić, czy moduły nie importują prywatnych części innych modułów.
* [ ] Uzupełnić dokumentację architektury.
* [ ] Uzupełnić dokumentację przykładów.
* [ ] Uporządkować TODO po migracji.
* [ ] Uruchomić pełną walidację.

Kryteria ukończenia:

* aplikacja korzysta z modułów jako głównego miejsca logiki domenowej,
* stare serwisy zostały usunięte albo jasno oznaczone jako legacy,
* nowe zmiany mają jasny wzorzec,
* testy i typy przechodzą,
* architektura jest opisana i egzekwowalna.

---

# Przykłady

## Dobry przykład cienkiego route handlera

```ts
import { createChannel } from "@/lib/modules/channel";

export async function POST(request: Request) {
  const input = await request.json();

  const result = await createChannel({
    userId: input.userId,
    name: input.name,
  });

  return Response.json(result);
}
```

Route handler tylko przyjmuje dane, woła przypadek użycia i zwraca odpowiedź.

---

## Zły przykład route handlera

```ts
export async function POST(request: Request) {
  const input = await request.json();

  if (!input.name || input.name.length < 3) {
    throw new Error("Invalid channel name");
  }

  const existing = await prisma.channel.findFirst({
    where: { name: input.name },
  });

  if (existing) {
    throw new Error("Channel already exists");
  }

  const channel = await prisma.channel.create({
    data: {
      name: input.name,
      userId: input.userId,
      status: "DRAFT",
    },
  });

  return Response.json(channel);
}
```

Ten kod miesza warstwę HTTP, walidacje, dostęp do bazy i reguły domenowe w jednym miejscu.

---

## Dobry przykład publicznego API modułu

```ts
// lib/modules/channel/index.ts

export { createChannel } from "./application/create-channel.use-case";
export { updateChannel } from "./application/update-channel.use-case";
export { getChannelById } from "./application/get-channel.use-case";
export type { Channel } from "./domain/channel.types";
```

Inne części aplikacji powinny importować z modułu:

```ts
import { createChannel } from "@/lib/modules/channel";
```

---

## Zły przykład importu z wnętrza modułu

```ts
import { createChannel } from "@/lib/modules/channel/application/create-channel.use-case";
import { channelRepository } from "@/lib/modules/channel/infrastructure/channel.repository";
```

To łamie granice modułu i utrudnia późniejsze zmiany wewnętrznej struktury.

---

## Przykład migracji starego serwisu

Stan początkowy:

```txt
lib/services/channel-service.ts
```

Docelowo:

```txt
lib/modules/channel/
  application/
    create-channel.use-case.ts
  domain/
    channel.rules.ts
    channel.errors.ts
    channel.types.ts
  infrastructure/
    channel.repository.ts
  index.ts
```

Zasada migracji:

1. Najpierw dodaj testy opisujące obecne zachowanie `channel-service`.
2. Utwórz nowy moduł.
3. Przenieś czyste reguły do `domain`.
4. Przenieś przypadki użycia do `application`.
5. Przenieś dostęp do bazy do `infrastructure`.
6. Wystaw publiczne API przez `index.ts`.
7. Zaktualizuj importy.
8. Uruchom walidację.
9. Dopiero na końcu usuń lub oznacz stary serwis jako legacy.

---

# Wzorce zabronione

## 1. Nowa logika domenowa w `lib/services/**`

Nie dodawaj:

```ts
// lib/services/video-service.ts

export async function publishVideoWithNewBusinessRules(...) {
  ...
}
```

Zamiast tego dodaj use case w:

```txt
lib/modules/video/application/
```

---

## 2. Bezpośredni import z infrastruktury innego modułu

Nie dodawaj:

```ts
import { paymentRepository } from "@/lib/modules/payments/infrastructure/payment.repository";
```

Zamiast tego użyj publicznego API:

```ts
import { getPaymentStatus } from "@/lib/modules/payments";
```

---

## 3. Gruby route handler

Nie dodawaj route handlerów, które zawierają:

* złożone walidacje domenowe,
* wiele zapytań Prisma,
* zmianę statusów domenowych,
* reguły uprawnień domenowych,
* logikę rozliczeń,
* logikę publikacji.

---

## 4. Migracja bez testów baseline

Nie przenoś logiki, jeśli nie da się sprawdzić, czy zachowanie po migracji jest takie samo jak przed migracją.

---

# Następne zadanie dla agenta AI

Wykonaj tylko etap R0.

Nie przenoś jeszcze żadnej logiki biznesowej.

Cele:

1. Oczyść dokumentację z instrukcji edycyjnych typu `DODAJ`, `ZASTĄP`, `SEKCJA DO WKLEJENIA`.
2. Zostaw dokumentację jako finalny kontrakt refaktoryzacji.
3. Zsynchronizuj `ARCHITECTURE.md` z zasadami modular monolith.
4. Utwórz `REFACTORING_EXAMPLES.md` na podstawie przykładów z tego dokumentu.
5. Dodaj statusy R0–R11.
6. Jeżeli nie dodajesz jeszcze technicznych guardów, dopisz je jako jawne checklist itemy w R1.
7. Nie przenoś jeszcze logiki biznesowej.
8. Nie usuwaj starych serwisów.
9. Nie zmieniaj zachowania aplikacji.

Po zmianie uruchom:

```bash
npx prisma validate
npm run typecheck
npm test -- --run
npm run lint
```

Nie oznaczaj R0 jako ukończonego, jeżeli któraś walidacja nie została uruchomiona albo nie przeszła.

W podsumowaniu napisz:

* jakie pliki zostały zmienione,
* czy została zmieniona logika aplikacji,
* jakie komendy walidacyjne zostały uruchomione,
* które testy przeszły,
* czy są znane ryzyka lub TODO.
