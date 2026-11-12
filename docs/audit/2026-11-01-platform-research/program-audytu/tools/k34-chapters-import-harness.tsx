/* Isolated, real VideoChaptersEditor with synthetic state; no Next, API, account, or database. */
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VideoChaptersEditor from '@/app/components/studio/VideoChaptersEditor';
import { LanguageContext } from '@/lib/i18n/language-context';
import { loadCatalog } from '@/lib/i18n/catalog';
import { createTx, htmlLang, type Catalog } from '@/lib/i18n/ui';
import { translations } from '@/lib/i18n/dictionary';
import type { ChapterRow } from '@/app/components/studio/chapters-form';

function Harness() {
  const [rows, setRows] = useState<ChapterRow[]>([
    { key: 'old-1', time: '0:00', title: 'Stary rozdział', titleEn: '' },
    { key: 'old-2', time: '1:00', title: 'Stary rozdział 2', titleEn: '' },
  ]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    loadCatalog('pl').then((nextCatalog) => {
      setCatalog(nextCatalog);
      document.documentElement.lang = htmlLang('pl');
      window.researchReady = true;
    });
  }, []);

  const tx = useMemo(() => createTx('pl', catalog), [catalog]);
  const context = useMemo(() => ({
    language: 'pl' as const,
    setLanguage: () => undefined,
    choice: null,
    isInitialized: true,
    t: translations.pl,
    tx,
  }), [tx]);

  return (
    <LanguageContext.Provider value={context}>
      <main>
        <h1>Video chapter import dialog harness</h1>
        <VideoChaptersEditor
          rows={rows}
          onChange={setRows}
          durationSeconds={null}
          tier="PUBLIC"
          descriptions={{ pl: '0:00 Pierwszy nowy rozdział\n1:00 Drugi nowy rozdział', en: '' }}
        />
        <output data-testid="rows">
          {JSON.stringify(rows.map(({ time, title }) => ({ time, title })))}
        </output>
      </main>
    </LanguageContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
