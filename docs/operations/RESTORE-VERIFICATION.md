# Opcjonalna weryfikacja odtworzonej bazy

`scripts/verify-restored-database.ts` wykonuje wyłącznie odczyty na oddzielnej odtworzonej lub sklonowanej bazie. Jest niezależny od cotygodniowego `restore-test.sh`.

Wymaga Node 22, zainstalowanych zależności, prawdziwego klienta Prisma wygenerowanego z bieżącego schematu oraz osiągalnej bazy. Operator przekazuje `RESTORE_DATABASE_URL`; `ALLOW_RESTORE_VERIFICATION=true` jest wymagane. Adres identyczny z `DATABASE_URL` jest odrzucany. Sama nierówność tekstowych URL nie dowodzi, że dwa różne adresy nie wskazują tej samej bazy — operator musi potwierdzić odrębność celu. Nie wypisywać ani nie umieszczać danych połączenia w historii poleceń.

Po ustawieniu zmiennych w bezpiecznym środowisku:

```bash
ALLOW_RESTORE_VERIFICATION=true npx tsx scripts/verify-restored-database.ts
```

Opcjonalny `RESTORE_EXPECTED_MANIFEST_PATH` wskazuje plik JSON z co najmniej jednym oczekiwanym licznikiem, np.:

```json
{"counts":{"User":10,"Video":3,"Payment":20}}
```

Wymagane kontrole obejmują łączność, odczyt `_prisma_migrations`, liczniki 12 modeli i wybrane powiązania `PatronGrant`/`VideoAsset`. Każdy licznik jest obowiązkowy również bez manifestu. Nieukończona i niewycofana próba migracji blokuje wynik. Jawnie wycofana próba nie blokuje sama w sobie poprawnej historii; ukończona migracja jest rozstrzygana według `finished_at`.

Kod wyjścia **0** z `VERIFICATION SUCCESSFUL` oznacza zakończenie tych kontroli. Błąd odczytu lub połączenia, nieukończona migracja, niespójność powiązań, błąd manifestu (w tym pusty zestaw liczników), różna wartość albo nieznany oczekiwany agregat daje kod **1**, bez komunikatu sukcesu. Przy obsłużonym błędzie po utworzeniu klienta wykonywane jest zamknięcie połączenia.

To nie jest dowód kompletności wszystkich danych/schematu, poprawnej kopii mediów, dostępności klucza, odzysku aplikacji ani osiągnięcia RPO/RTO. Wymagane pozostają status migracji bieżącego wydania, pełny test odzyskiwania i próby funkcjonalne. Nie traktować zielonego testu z atrapą DB jako rzeczywistego odtworzenia.

Regresje kodów wyjścia i kontroli: `tests/unit/operations/verify-restored-database-process.test.ts`. Uruchamiają rzeczywisty skrypt w osobnych procesach z jawną syntetyczną granicą DB; nie podmieniają zainstalowanego klienta Prisma i nie wykonują połączeń produkcyjnych.
