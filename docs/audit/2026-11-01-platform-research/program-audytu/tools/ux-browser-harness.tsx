/* Research composition only. Actual components and catalogue helpers are unchanged.
 * Local state replaces the app shell; submit/delete callbacks are synthetic and never call APIs. */
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ConfirmDialog from '@/app/components/studio/ConfirmDialog';
import { ReportDialog } from '@/app/components/comments/components/ReportDialog';
import { DeleteCommentDialog } from '@/app/components/comments/components/DeleteCommentDialog';
import LanguageSwitcher from '@/app/components/LanguageSwitcher';
import { LanguageContext } from '@/lib/i18n/language-context';
import { loadCatalog } from '@/lib/i18n/catalog';
import { createTx, htmlLang, type Catalog } from '@/lib/i18n/ui';
import { translations } from '@/lib/i18n/dictionary';
import type { Locale } from '@/lib/i18n/routing';

declare global { interface Window { researchEvents: Array<Record<string, unknown>>; researchReady: boolean; } }
window.researchEvents = [];
function Harness() {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') ?? 'confirm';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<Locale>('pl');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    let alive = true;
    loadCatalog(language).then(c => { if (alive) { setCatalog(c); document.documentElement.lang=htmlLang(language); window.researchReady=true; } });
    return () => { alive=false; };
  }, [language]);
  const tx = useMemo(() => createTx(language,catalog),[language,catalog]);
  const value = useMemo(() => ({ language, setLanguage, choice:null, isInitialized:true, t:translations[language], tx }),[language,tx]);
  const close = () => { window.researchEvents.push({event:'close',mode});setOpen(false);setBusy(false); };
  return <LanguageContext.Provider value={value}>
    <main style={{padding:'24px',maxWidth:'900px'}}>
      <h1>Local component research — synthetic data</h1>
      <p id="boundary">No application API, account, payment or database is connected.</p>
      {mode==='language' ? <>
        <LanguageSwitcher language={language} variant="pill" onSelect={locale => {window.researchEvents.push({event:'language',locale});setLanguage(locale);}} />
        <output data-testid="locale">{language}</output>
      </> : <button id="opener" type="button" onClick={()=>setOpen(true)}>Open research dialog</button>}
      <button id="background" type="button" onClick={()=>window.researchEvents.push({event:'background_action'})}>Background action</button>
      <a id="after" href="#boundary">Background link</a>
      <output data-testid="busy">{String(busy)}</output>
      {mode==='confirm' && open && <ConfirmDialog title="Delete synthetic playlist?" confirmLabel="Delete playlist" cancelLabel="Cancel" busy={busy} danger
        onCancel={close} onConfirm={()=>{window.researchEvents.push({event:'confirm'});setBusy(true);}}>
        The playlist will disappear; its videos remain. This callback deliberately stays pending.
      </ConfirmDialog>}
      {mode==='report' && <ReportDialog isOpen={open} onClose={close} language={language} onSubmit={async(reason,note)=>{
        window.researchEvents.push({event:'report',reason,note});
        throw new Error('Synthetic report service unavailable');
      }} />}
      {mode==='delete-comment' && <DeleteCommentDialog isOpen={open} onClose={close} language={language}
        onConfirm={()=>window.researchEvents.push({event:'delete_comment'})} />}
    </main>
  </LanguageContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
