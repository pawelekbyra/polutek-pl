# Badanie Polutka i porównanie z PeerTube

Jedno długoterminowe badanie rozwijane na gałęzi **`docs/polutek-platform-audit`** w repozytorium `pawelekbyra/polutek-pl`. Właściciel 1 listopada 2026 polecił zachowywać tutaj także poprzednie badanie i dopisywać kolejne wnioski na tej samej gałęzi.

## Zacznij tutaj

| Materiał | Znaczenie |
|---|---|
| [Raport bazowy](RAPORT.md) | Pogłębione porównanie, 22 obszary oceny, wyniki kontroli i eksperymentów |
| [Program pełnego badania](program-audytu/PROGRAM.md) | Zakres 18 obszarów, etapy, wymagania dowodu i warunki ukończenia |
| [Stan i następny krok](program-audytu/STAN.md) | Punkt wznowienia każdej kolejnej sesji |
| [Mapa systemu](program-audytu/MAPA-SYSTEMU.md) | Komponenty, role, 14 przepływów krytycznych i granice zaufania |
| [D01: produkt i zakres](program-audytu/obszary/D01-PRODUKT-I-ZAKRES.md) | 22 obietnice produktu i rozdzielenie implementacji od aktywnej konfiguracji |
| [D03: tożsamość i sesje](program-audytu/obszary/D03-TOZSAMOSC-I-SESJE.md) | Częściowa ocena kont WWW i panelu, potwierdzenie zakresu R13/R14 i granice dowodów |
| [D04: role i izolacja](program-audytu/obszary/D04-ROLE-I-IZOLACJA.md) | Role kanałowe, wybrane operacje i nowa usterka R23 automatycznej publikacji |
| [Scenariusze D03/D04](program-audytu/SCENARIUSZE-D03-D04.csv) | 42 zaplanowane próby HTTP; oddzielone od wykonanych testów jednostkowych |
| [Powierzchnia wejść](program-audytu/POWIERZCHNIA-WEJSC.csv) | Trasy, Server Actions, strony, zdarzenia workerów i wejścia operacyjne do kontroli |
| [Rejestr ustaleń](program-audytu/USTALENIA.json) | Stabilne R01–R23, statusy i przypisanie do obszarów; raport bazowy zachowuje wcześniejsze 22 |
| [Pokrycie obszarów](program-audytu/POKRYCIE.csv) | Ocena postępu bez ukrywania niezbadanych elementów |
| [ASVS — 345 wymagań](program-audytu/ASVS-POKRYCIE.csv) | Lista do kwalifikacji i sprawdzania; nie lista zaliczonych testów |
| [Plan eksperymentów i pomiarów](PLAN-WERYFIKACJI.md) | Dalsze testy runtime, awarie, benchmark i model kosztów |
| [Źródła zewnętrzne](program-audytu/SOURCES.md) | Oficjalne OWASP, W3C, Web Vitals, SLSA i PeerTube |
| [Historia badania](program-audytu/ZMIANY.md) | Zmiany programu i ustaleń |
| [Pierwszy przegląd](POROWNANIE-WSTEPNE.md) | Materiał historyczny poprzedzający raport bazowy; nie aktualne podsumowanie całego audytu |

## Jak rozwijamy tę gałąź

- Kolejne partie badania trafiają jako osobne commity na **tej samej gałęzi**. Nie tworzymy gałęzi i konkurującego raportu po każdej sesji.
- Przed pracą odczytujemy STAN.md, sprawdzamy SHA aplikacji i zmiany od ostatniego badania. Nie zakładamy, że wynik dla starego SHA opisuje nowszy kod.
- Aktualizujemy raport obszaru, rejestr ustaleń, pokrycie i punkt wznowienia. Odrzucone podejrzenia oraz naprawione problemy pozostają w historii z przyczyną i wynikiem retestu.
- Nie dopisujemy ustaleń jako zmian implementacji. Naprawy, scalanie do `main` i wdrożenia nie wynikają automatycznie z utworzenia tej gałęzi.
- Materiały nie zawierają sekretów; do dowodów nie kopiujemy plików env, dumpów danych ani danych prawdziwych użytkowników.

Jest to jawny wyjątek od ogólnej zasady usuwania rozwiązanych znalezisk z roboczych audytów i niewprowadzania raportów sesji do repo. W tym katalogu przechowujemy trwały materiał badawczy na wyraźne polecenie właściciela.

## Dowody i wersje

Bazowy kod Polutka: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. PeerTube: `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. Linki do analizowanego kodu wskazują te konkretne commity na GitHubie; nie przesuwają się razem z `main`.

Logi i JSON z wcześniejszych przebiegów zachowano bez przepisywania. Ich ścieżki `/workspace/...`, lokalna nazwa bazy oraz wersje narzędzi są historycznym kontekstem wykonania, a nie instrukcją wymagającą takich samych katalogów na komputerze właściciela. Inwentarz plików opisuje wersję bazową i nie dowodzi przeczytania wszystkich plików.

Historyczne manifesty w `provenance/` odnoszą się do materiałów sprzed przeniesienia i adaptacji linków. `GITHUB-MANIFEST.json` zawiera hashe bieżących plików importu. Po zmianie materiału należy odświeżyć bieżący manifest, zachowując historię w Git.

## Odtwarzanie lokalnych eksperymentów

Z korzenia repo, po przygotowaniu zależności i aktywacji Node 22:

```bash
node --import tsx docs/audit/2026-11-01-platform-research/pipeline-experiments.ts
node --import tsx docs/audit/2026-11-01-platform-research/storage-experiment.ts
node docs/audit/2026-11-01-platform-research/program-audytu/tools/identity-context-experiment.cjs
```

Eksperymenty wywołują rzeczywisty procesor/klasę magazynu z atrapami portów. Nie łączą się z R2 ani produkcyjną bazą. Nie zastępują pełnych testów lokalnego stosu.

Trzeci skrypt wykonuje niezmienione moduły TypeScript przez transpiler z jawnymi atrapami I/O. Odtwarza decyzje tożsamości/uprawnień oraz utratę kanału w finalizerze. Nie używa wygenerowanego klienta Prisma, nie wykonuje faktycznej publikacji i nie zmienia wyniku zablokowanych testów aplikacji na zaliczony.

Pełna walidacja runtime była zablokowana pobieraniem silnika/checksum Prisma. Ten stan pozostaje jawną niewiadomą, nie domyślnym zaliczeniem testów.
