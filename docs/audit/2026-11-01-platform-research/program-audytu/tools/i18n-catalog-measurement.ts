/* Read-only counts from actual catalogue loader and existing AST extractor.
 * Completeness/placeholder checks do not establish native-speaker quality. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractTxCalls, groupByEnglish } from '@/tests/unit/i18n/extract-tx';
import { loadCatalog } from '@/lib/i18n/catalog';
import { SUPPORTED_LOCALES, UI_ONLY_LOCALES } from '@/lib/i18n/routing';
import { placeholdersOf, createTx, htmlLang } from '@/lib/i18n/ui';
import { translations } from '@/lib/i18n/dictionary';

async function main() {
 const base=path.join(process.cwd(),'docs/audit/2026-11-01-platform-research/program-audytu');
 const {calls,problems}=extractTxCalls();
 const sources=groupByEnglish(calls);
 const locales=[];
 for(const locale of SUPPORTED_LOCALES) {
  const catalog=await loadCatalog(locale);
  const entries=Object.entries(catalog??{});
  const sourceKeys=[...sources.keys()];
  const missing=catalog?sourceKeys.filter(key=>!Object.hasOwn(catalog,key)):[];
  const orphan=catalog?Object.keys(catalog).filter(key=>!sources.has(key)):[];
  const brokenPlaceholders=entries.filter(([key,v])=>placeholdersOf(key).join()!==placeholdersOf(v).join()).map(([key])=>key);
  const empty=entries.filter(([,v])=>!v.trim()).map(([key])=>key);
  const sameAsEnglish=entries.filter(([key,v])=>key===v).length;
  const tx=createTx(locale,catalog);
  locales.push({locale,htmlLang:htmlLang(locale),catalog_keys:entries.length,source_mode:catalog?'CATALOGUE':'INLINE_PL_EN',missing,orphan,brokenPlaceholders,empty,same_as_English_count:sameAsEnglish,
   dictionary_keys:Object.keys(translations[locale]).length,example_close:tx('Zamknij','Close')});
 }
 if(problems.length||locales.some(x=>x.missing.length||x.orphan.length||x.brokenPlaceholders.length||x.empty.length))throw Error('Catalogue consistency check failed');
 const hash=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const sourceFiles=['tests/unit/i18n/extract-tx.ts','lib/i18n/ui.ts','lib/i18n/routing.ts','lib/i18n/catalog/index.ts','lib/i18n/dictionary.ts',
  ...UI_ONLY_LOCALES.flatMap(locale=>[`lib/i18n/catalog/${locale}.json`,`lib/i18n/catalog/premium-pass/${locale}.json`])];
 const result={date:'2026-11-01',actual_source_sha256:Object.fromEntries(sourceFiles.map(file=>[file,hash(file)])),
  call_sites:calls.length,unique_English_keys:sources.size,source_files_with_calls:new Set(calls.map(x=>x.file)).size,extractor_problems:problems,
  multiple_Polish_variants_for_one_English_key:[...sources].filter(([,x])=>x.pl.size>1).map(([en,x])=>({English:en,Polish_variants:[...x.pl],places:x.places})),
  locales,limits:['Extractor scans declared app/components/lib roots, not all admin/server email content','Matching keys/placeholders does not establish linguistic quality or visual fit','No real locale navigation/cookies/account persistence or full browser language matrix executed here']};
 fs.writeFileSync(path.join(base,'evidence/i18n-catalog-measurement.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({call_sites:calls.length,unique_English_keys:sources.size,locales:locales.length,ambiguous_English_keys:result.multiple_Polish_variants_for_one_English_key.length}));
}
void main();
