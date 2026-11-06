/* Real Chromium on loopback with actual unchanged UI components + original compiled CSS.
 * All callbacks/state/page shell are research fixtures. No Next/Prisma/auth/production. */
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),crypto=require('crypto'),cp=require('child_process');
const esbuild=require('esbuild'),postcss=require('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require('playwright');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const inventory=JSON.parse(fs.readFileSync(path.join(base,'evidence/architecture-graph.json'),'utf8')).source_sha256;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'polutek-ux-research-'));
 let browser,server;
 try {
  const css=await postcss([tailwind({base:root,optimize:false})]).process(fs.readFileSync(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
  fs.writeFileSync(path.join(temp,'app.css'),css.css);
  const built=await esbuild.build({absWorkingDir:root,entryPoints:[path.join(base,'tools/ux-browser-harness.tsx')],outfile:path.join(temp,'bundle.js'),bundle:true,metafile:true,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},alias:{'@':root},logLevel:'silent'});
  const sourceHashes={};
  for(const input of Object.keys(built.metafile.inputs)) {
   if(input.startsWith('<'))continue; // esbuild virtual module for explicitly empty browser process.env
   const p=path.isAbsolute(input)?input:path.join(root,input),rel=path.relative(root,p).split(path.sep).join('/');
   if(rel.startsWith('node_modules/')||rel.startsWith('docs/audit/'))continue;
   sourceHashes[rel]=sha(p);
   if(inventory[rel]){
    const changedSinceResearch=cp.spawnSync('git',['diff','--quiet','c397b9e548ca2c628e21457ac69d66e54b12ddbd','HEAD','--',rel]).status!==0;
    const changedInWorktree=cp.spawnSync('git',['diff','--quiet','--',rel]).status!==0;
    if(!changedSinceResearch&&!changedInWorktree)assert(sourceHashes[rel]===inventory[rel],'Unexpected baseline change '+rel);
   }
  }
  for(const rel of ['app/globals.css','tailwind.config.ts'])sourceHashes[rel]=sha(path.join(root,rel));
  const html='<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local component research</title><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://127.0.0.1');let file,type;
   if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
   if(['/app.css','/bundle.css','/bundle.js'].includes(url.pathname)){file=path.join(temp,url.pathname.slice(1));type=url.pathname.endsWith('.js')?'text/javascript':'text/css';}
   else if(/^\/flags\/[a-z]{2}\.svg$/.test(url.pathname)){file=path.join(root,'public',url.pathname);type='image/svg+xml';}
   else {res.writeHead(404);res.end();return;}
   if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const blocked=[],errors=[];
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():(blocked.push(route.request().url()),route.abort()));
  const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  const observations=[];
  async function visit(mode){await page.goto(origin+'/?mode='+mode);try{await page.waitForFunction(()=>window.researchReady===true,{},{timeout:6000});}catch(error){
    fs.writeFileSync(path.join(base,'evidence/ux-browser-startup-failure.json'),JSON.stringify({mode,errors,body:await page.locator('body').innerText(),scriptCount:await page.locator('script').count(),message:error.message},null,2)+'\n');
    console.error(JSON.stringify({startupErrors:errors}));throw error;
  }}
  const active=()=>page.evaluate(async()=>{
   // Focus libraries can redirect a sentinel on the next paint. Measure settled focus;
   // earlier immediate-key snapshots are retained separately as diagnostics, not findings.
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   return {id:document.activeElement?.id,tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.trim().slice(0,120),insideDialog:!!document.activeElement?.closest('[role="dialog"],[role="alertdialog"]'),focusGuard:document.activeElement?.hasAttribute('data-base-ui-focus-guard'),ariaHidden:document.activeElement?.getAttribute('aria-hidden')};
  });
  await visit('confirm');await page.locator('#opener').click();
  await page.getByRole('button',{name:'Cancel',exact:true}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.textContent==='Cancel');
  observations.push({case:'confirm_opens_on_safe_cancel',active:await active(),dialogName:await page.getByRole('alertdialog').getAttribute('aria-labelledby')});
  await page.keyboard.press('Shift+Tab');const backward=await active();
  await page.keyboard.press('Tab');const forward=await active();
  assert(backward.text==='Delete playlist'&&forward.text==='Cancel','Normal confirm focus wrap');
  observations.push({case:'confirm_normal_tab_wrap',backward,forward});
  await page.keyboard.press('Escape');await page.getByRole('alertdialog').waitFor({state:'detached'});
  assert((await active()).id==='opener','Confirm restores focus');
  observations.push({case:'confirm_escape_restores_opener',active:await active()});
  await page.locator('#opener').click();await page.getByRole('button',{name:'Delete playlist',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="busy"]')?.textContent==='true');
  await page.waitForFunction(()=>document.activeElement?.closest('[role="alertdialog"]'));
  const busyStart=await active();const tabs=[];
  for(let i=0;i<5;i++){await page.keyboard.press('Tab');tabs.push(await active());}
  const escaped=tabs.some(r=>!r.insideDialog);
  assert(!escaped,'Busy dialog allowed focus to leave the modal');
  assert(await page.locator('[role="alertdialog"]').getAttribute('aria-busy')==='true','Busy state missing from alertdialog');
  assert((await page.getByRole('status').textContent()).includes('Operacja w toku'),'Busy status was not announced');
  const backgroundIsolation=await page.locator('#background').evaluate(el=>{const chain=[];for(let node=el;node;node=node.parentElement)chain.push({tag:node.tagName,id:node.id,inert:node.inert,ariaHidden:node.getAttribute('aria-hidden')});return chain;});
  const backgroundRoleCount=await page.getByRole('button',{name:'Background action'}).count();
  assert(backgroundRoleCount===0,'Background control remained in the accessible role tree');
  observations.push({case:'confirm_busy_tab_stays_in_modal',busyStart,tabSequence:tabs,backgroundIsolation,backgroundRoleCount,ariaBusy:await page.getByRole('alertdialog').getAttribute('aria-busy')});
  await page.keyboard.press('Escape');
  assert(await page.getByRole('alertdialog').count()===1,'Escape closed the confirmation while busy');
  await page.keyboard.press('Enter');
  assert(await page.getByRole('alertdialog').count()===1,'Enter closed or confirmed the alertdialog while focus was on the busy panel');
  assert(!(await page.evaluate(()=>window.researchEvents)).some(e=>e.event==='background_action'),'Background action ran while modal was open');
  await page.evaluate(()=>window.recoverConfirm?.());
  await page.waitForFunction(()=>document.querySelector('[data-testid="busy"]')?.textContent==='false');
  assert(await page.getByRole('button',{name:'Delete playlist',exact:true}).isEnabled(),'Retry action was not re-enabled after failure');
  observations.push({case:'confirm_busy_escape_blocked_and_retry_enabled',events:await page.evaluate(()=>window.researchEvents),active:await active()});
  await page.getByRole('button',{name:'Cancel',exact:true}).focus();await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').waitFor({state:'detached'});
  assert((await active()).id==='opener','Confirm did not restore focus to opener');
  observations.push({case:'confirm_escape_restores_opener_after_retry',active:await active()});
  await page.locator('#opener').click();
  await page.evaluate(()=>window.removeResearchOpener?.());
  await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').waitFor({state:'detached'});
  const removedOpenerFocus=await active();assert(removedOpenerFocus.tag==='MAIN','Confirm did not return focus to the main region after its opener was removed: '+JSON.stringify(removedOpenerFocus));
  observations.push({case:'confirm_removed_opener_focuses_main_region',active:await active()});
  await visit('report');await page.locator('#opener').click();await page.getByRole('dialog').waitFor();
  await page.getByRole('radio',{name:'Spam',exact:true}).focus();await page.keyboard.press('ArrowDown');
  observations.push({case:'report_radio_arrow_does_not_move_or_select',active:await active(),checkedLabels:await page.locator('[role="radio"][aria-checked="true"]').allTextContents(),radioTabStops:await page.locator('[role="radio"]').evaluateAll(els=>els.map(e=>e.tabIndex)),classification:'APG_PATTERN_DIVERGENCE;Tab/Space alternatives remain'});
  await page.getByRole('radio',{name:'Nękanie',exact:true}).focus();await page.keyboard.press('Space');
  await page.getByRole('textbox').fill('Synthetic note retained on failure');
  await page.getByRole('button',{name:'Zgłoś',exact:true}).click();await page.getByRole('alert').waitFor();
  const note=await page.getByRole('textbox').inputValue();
  assert(note==='Synthetic note retained on failure','Failed report preserves note');
  observations.push({case:'report_failure_keeps_note_and_announces_error',noteRetained:true,error:await page.getByRole('alert').textContent(),events:await page.evaluate(()=>window.researchEvents)});
  const reportTabs=[];for(let i=0;i<12;i++){await page.keyboard.press('Tab');reportTabs.push(await active());}
  const backgroundReached=reportTabs.some(r=>['background','opener','after'].includes(r.id));
  fs.writeFileSync(path.join(base,'evidence/ux-browser-focus-diagnostic.json'),JSON.stringify({reportTabs,backgroundReached,observationsBefore:observations},null,2)+'\n');
  assert(!backgroundReached,'BaseUI report focus must avoid background controls');
  observations.push({case:'report_baseui_tab_avoids_background',tabSequence:reportTabs,backgroundReached});
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  observations.push({case:'report_escape_closes',active:await active(),events:await page.evaluate(()=>window.researchEvents)});
  await visit('delete-comment');await page.locator('#opener').click();await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Anuluj',exact:true}).focus();await page.keyboard.press('Space');
  assert(!(await page.evaluate(()=>window.researchEvents)).some(e=>e.event==='delete_comment'),'Delete cancel does not invoke action');
  observations.push({case:'delete_comment_cancel_no_action',events:await page.evaluate(()=>window.researchEvents),active:await active()});
  await visit('language');const trigger=page.getByRole('button',{name:/Zmień język/});await trigger.focus();await page.keyboard.press('Enter');
  const list=page.getByRole('listbox');await list.waitFor();
  const before=await list.getAttribute('aria-activedescendant');await page.keyboard.press('End');const end=await list.getAttribute('aria-activedescendant');
  await page.keyboard.press('Home');const home=await list.getAttribute('aria-activedescendant');
  observations.push({case:'language_listbox_focus_home_end',optionCount:await page.getByRole('option').count(),before,end,home,listFocused:await list.evaluate(el=>el===document.activeElement)});
  await page.keyboard.press('d');const typed=await list.getAttribute('aria-activedescendant');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-testid="locale"]')?.textContent==='de'&&document.documentElement.lang==='de');
  observations.push({case:'language_typeahead_selects_de',typed,htmlLang:await page.locator('html').getAttribute('lang'),events:await page.evaluate(()=>window.researchEvents),active:await active(),listClosed:await list.count()===0});
  await page.getByRole('button',{name:/Sprache|Language/}).first().click();await list.waitFor();await page.keyboard.press('Escape');
  observations.push({case:'language_escape_returns_trigger',active:await active(),listClosed:await list.count()===0});
  await page.setViewportSize({width:320,height:812});
  await page.getByRole('button',{name:/Sprache|Language/}).first().click();await list.waitFor();
  const geometry=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,listRect:(()=>{const r=document.querySelector('[role="listbox"]').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};})()}));
  observations.push({case:'language_at_320_component_only',...geometry,full_page_reflow_proof:false});
  await page.screenshot({path:path.join(base,'evidence/ux-language-320.png')});
  assert(errors.length===0,'Browser page error: '+errors.join(';'));
  const changedSinceResearch=Object.keys(sourceHashes).filter(rel=>inventory[rel]&&cp.spawnSync('git',['diff','--quiet','c397b9e548ca2c628e21457ac69d66e54b12ddbd','HEAD','--',rel]).status!==0);
  const result={date:'2026-11-06',repository_head_sha:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources_changed_since_research_baseline:changedSinceResearch,working_tree_changes:['app/components/studio/ConfirmDialog.tsx'],browser:await browser.version(),browser_executable:chromium.executablePath(),viewport_initial:{width:1280,height:900},reduced_motion:'reduce',actual_bundle_source_sha256:sourceHashes,observations,
   original_CSS_compiled:true,synthetic_callbacks_only:true,real_API_requests:0,blocked_external_requests:blocked,browser_page_errors:errors,
   limitations:['Isolated real React components plus original compiled global/CSS module styles, not Next/full application','Harness provider/local state replaces page shell and navigation; callbacks never perform real delete/report','Fonts/media/production auth/Prisma/payment and mobile hardware not reproduced','Chromium desktop only; no Safari/Firefox/screen reader/actual touch or WCAG certification','Radio behavior compared with APG pattern; keyboard completion by Tab/Space still possible'],cleanup:'Browser/context/server closed and temporary bundle directory removed in finally'};
  fs.writeFileSync(path.join(base,'evidence/ux-browser-experiment.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({observations:observations.length,browser:result.browser,actual_source_files:Object.keys(sourceHashes).length,external_requests_blocked:blocked.length,page_errors:errors.length}));
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
