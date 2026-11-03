# Artefakty pominięte w repo

Przy scalaniu dokumentów audytu do `main` (2026-11-03) pominięto pliki większe niż 300 KB, kopie stron HTML (advisory GHSA, wzorce APG: cudze treści) i archiwum `.tar.gz`. Są to surowe wyniki narzędzi (JSON z vitest, lint, graf architektury), które można odtworzyć. Oryginały leżą na serwerze w `/opt/claude/audit-progress/excluded-artifacts/docs/audit/2026-11-01-platform-research/`; pełna historia jest na gałęzi `docs/polutek-platform-audit`.

| Plik (względem tego katalogu) | Bajty | SHA-256 |
|---|---:|---|
| `GHSA-2464-fhr4-w9xw.html` | 149362 | `fb1fa051ab1d077bbead51da2eee9be77e10866c6e2bd3daf4d44e2fdde782d3` |
| `GHSA-mrhx-c7xc-m3w5.html` | 151050 | `8a3438097c7fa67e8ebbfd37d4a4a4c37ee75fe65ebe6da77571e705ad9aabf8` |
| `GHSA-wq5f-xc86-pv6w.html` | 149832 | `e4c0a5830bdd72a1644763317e08be1f8fe3f4cd66a5bf10de8844464724014b` |
| `program-audytu/INWENTARZ-PLIKOW.csv` | 320179 | `c70968dd53c96241815488b11cc0530163c51e0cbbb9b2d17dff2dc1bc70dc4a` |
| `program-audytu/evidence/architecture-graph.json` | 5232128 | `0b7a2e435acdd31779abe3b1c7ed23591008f43c138833c306aaba45e81edac0` |
| `program-audytu/evidence/h1-cloud-2026-11-02/unit-final.json` | 1625009 | `a001a5619de167de701ad4f6f87f0b66796a0752bf1a28e7bee4c7b18f0b890a` |
| `program-audytu/evidence/h1-cloud-2026-11-02/unit-full.json` | 1626087 | `b647e42afe9ada5dc67ae74b9f8acf859272fa79a9d1938a332a069048ccd9c8` |
| `program-audytu/evidence/h1-cloud-2026-11-02/unit-local-final.json` | 1624712 | `f975fcdb99b38ebd6cbdd3147ccd0669964ebf6e5fc77a13e70f04db1dc3aa1f` |
| `program-audytu/evidence/h1-gates-2026-11-02/final/unit-final.json` | 1630838 | `0c1d834478c7319abf16af29cd7d093a43a3f540eb48c9c447fc23b1229eabb5` |
| `program-audytu/evidence/h1-images-2026-11-02/final/acceptance/unit-final.json` | 1630858 | `256290ad9ef34c2bda19a414301389949a2e009568a286b0e4bdef78aa1455c5` |
| `program-audytu/evidence/h1-quality-2026-11-02/final/unit-final.json` | 1625077 | `74be3a8290819490ac790767593cfcdccaeefd50874937fc7b68e42b19bfee09` |
| `program-audytu/evidence/h1-quality-2026-11-02/lint.json` | 1351845 | `6dcaa04ea4064c62655ccec0dd88e5df6d63fc2843a2672fb70fe80d0963a9a8` |
| `program-audytu/evidence/h1-release-core-2026-11-02/final/local-ci-logs/unit.log` | 341758 | `f71385b102b528f16f0b0d163fb4a09b0367c224b65b22333db3d70e8ef9e284` |
| `program-audytu/evidence/h1-release-core-2026-11-02/final/local-ci-logs/unit.vitest.json` | 1659301 | `e6a9c79fb300f8b0a2ea4c0d07b0b6383c14d48c9b004a7908e19f6e851eb8ea` |
| `program-audytu/evidence/h1-release-core-2026-11-02/final/local-ci-partial.json` | 853272 | `3433acdc1d86cd3b2477a8cf3fe2f69aa662429482a17c37cbf054e0dfd9e987` |
| `program-audytu/evidence/h1-release-core-2026-11-02/final/unit-final.json` | 1659301 | `e6a9c79fb300f8b0a2ea4c0d07b0b6383c14d48c9b004a7908e19f6e851eb8ea` |
| `program-audytu/evidence/test-inventory.json` | 703178 | `84980948eaaf7dfbbc540f1d80df65341ff0e340e1cd9368661029399fc9c385` |
| `program-audytu/sources/apg-listbox.html` | 20289 | `291221ce08796169162804ca35d3f20d51bb34eec5a3e7b705e3a2eeb6e024f0` |
| `program-audytu/sources/apg-modal-dialog.html` | 11000 | `14ce04000352a8d8ee6cf2ec4419e1cf28a8d6648736a1cf6653d38bc24099e3` |
| `program-audytu/sources/apg-radio-group.html` | 9097 | `b441e2988c88ecffbdb9e3ad4a072be6a996e154c5e57656dc8016da59878b43` |
| `provenance/paused-batch17-before-roadmap-v1.tar.gz` | 202093 | `ccdeca70e63a26d517d71b105799b5fa4afd5f0fb978167817aac370640fe256` |
| `vitest-results.json` | 997178 | `65618fac220df5d89a6d6eaf7e50ceaebaa62a32f230b794492ee91f2c82bacc` |
