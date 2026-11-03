/* Read-only baseline AST graph. Counts are structural measurements, not reviewed files.
 * TypeScript transpileModule ESNext elision approximates runtime dependencies;
 * it is not Next/SWC production bundling, type checking or a cycle crash proof. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');
const root = process.cwd();
const base = path.join(root, 'docs/audit/2026-11-01-platform-research/program-audytu');
function csvParse(text) {
  const rows = []; let row = [], cell = '', quote = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"') { if (quote && text[i+1]==='"') {cell+='"';i++;} else quote=!quote; }
    else if (c===',' && !quote) {row.push(cell);cell='';}
    else if (c==='\n' && !quote) {row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if (cell || row.length) {row.push(cell);rows.push(row);}
  return rows;
}
const inventory = csvParse(fs.readFileSync(path.join(base,'INWENTARZ-PLIKOW.csv'),'utf8'));
const headers=inventory.shift();
const records=inventory.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
const files=records.filter(r=>/\.(ts|tsx)$/.test(r.path)&&/^(app\/|apps\/|lib\/|components\/|services\/|scripts\/|tests\/|middleware\.ts$)/.test(r.path));
const fileSet=new Set(files.map(r=>r.path));
const compilerOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.Preserve,esModuleInterop:true,allowJs:true,
  baseUrl:root,paths:{'@/*':['./*'],'@admin/*':['./apps/admin/*']}};
const moduleCache=ts.createModuleResolutionCache(root,x=>x,compilerOptions);
const sourceHashes={};const parsed=[];const emitted=[];const stats=[];const parseDiagnostics=[];
function imports(sf) {
  const out=[];
  function visit(node) {
    let spec,kind,typeOnly=false;
    if (ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)) {
      spec=node.moduleSpecifier.text;kind='import';const c=node.importClause;
      typeOnly=!!c?.isTypeOnly || (!!c && !c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length>0 && c.namedBindings.elements.every(n=>n.isTypeOnly));
    } else if (ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)) {
      spec=node.moduleSpecifier.text;kind='reexport';typeOnly=node.isTypeOnly || (node.exportClause&&ts.isNamedExports(node.exportClause)&&node.exportClause.elements.length>0&&node.exportClause.elements.every(n=>n.isTypeOnly));
    } else if(ts.isCallExpression(node)&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])) {
      if(node.expression.kind===ts.SyntaxKind.ImportKeyword) {spec=node.arguments[0].text;kind='dynamic_import';}
      if(ts.isIdentifier(node.expression)&&node.expression.text==='require') {spec=node.arguments[0].text;kind='require_literal';}
    }
    if(spec)out.push({specifier:spec,kind,type_only:!!typeOnly,line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1});
    ts.forEachChild(node,visit);
  }
  visit(sf);return out;
}
function resolve(file, item) {
  const found=ts.resolveModuleName(item.specifier,path.join(root,file),compilerOptions,ts.sys,moduleCache).resolvedModule;
  const p=found?path.relative(root,found.resolvedFileName).split(path.sep).join('/'):null;
  return {...item,from:file,to:p&&fileSet.has(p)?p:null,resolved_path:p,local_reference:item.specifier.startsWith('.')||item.specifier.startsWith('@/')||item.specifier.startsWith('@admin/')};
}
for(const r of files) {
  const source=fs.readFileSync(path.join(root,r.path),'utf8');const hash=crypto.createHash('sha256').update(source).digest('hex');
  if(hash!==r.sha256)throw Error('Baseline hash mismatch: '+r.path);sourceHashes[r.path]=hash;
  const sf=ts.createSourceFile(r.path,source,ts.ScriptTarget.Latest,true,r.path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  for(const d of sf.parseDiagnostics)parseDiagnostics.push({file:r.path,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')});
  parsed.push(...imports(sf).map(x=>resolve(r.path,x)));
  if(!r.path.endsWith('.d.ts')) {
    const output=ts.transpileModule(source,{fileName:r.path,compilerOptions}).outputText;
    emitted.push(...imports(ts.createSourceFile(r.path,output,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)).map(x=>resolve(r.path,x)));
  }
  stats.push({file:r.path,lines:source.split('\n').length,bytes:Buffer.byteLength(source),source_sha256:hash,client_directive:sf.statements.some(n=>ts.isExpressionStatement(n)&&ts.isStringLiteral(n.expression)&&n.expression.text==='use client')});
}
function graph(edges,nodes) {
  const out=new Map(nodes.map(n=>[n,new Set()]));
  for(const e of edges)if(e.to&&out.has(e.from)&&out.has(e.to))out.get(e.from).add(e.to);
  return out;
}
function scc(g) {
  let id=0;const ids=new Map(),low=new Map(),stack=[],on=new Set(),parts=[];
  function visit(n) {
    ids.set(n,id);low.set(n,id++);stack.push(n);on.add(n);
    for(const next of g.get(n)||[]) {if(!ids.has(next)){visit(next);low.set(n,Math.min(low.get(n),low.get(next)));}else if(on.has(next))low.set(n,Math.min(low.get(n),ids.get(next)));}
    if(low.get(n)===ids.get(n)){const c=[];let x;do{x=stack.pop();on.delete(x);c.push(x);}while(x!==n);if(c.length>1||(g.get(n)||new Set()).has(n))parts.push(c.sort());}
  }
  for(const n of g.keys())if(!ids.has(n))visit(n);
  return parts.sort((a,b)=>b.length-a.length||a[0].localeCompare(b[0]));
}
const appFiles=files.map(x=>x.path).filter(f=>!f.startsWith('tests/')&&!f.startsWith('scripts/'));
const staticEmitted=emitted.filter(x=>['import','reexport','require_literal'].includes(x.kind));
const emittedGraph=graph(staticEmitted,appFiles);
const parsedGraph=graph(parsed.filter(x=>x.kind!=='dynamic_import'),appFiles);
const cycles=scc(emittedGraph);
function moduleOf(f){return f?.match(/^lib\/modules\/([^/]+)/)?.[1]||null;}
const modules=[...new Set(appFiles.map(moduleOf).filter(Boolean))].sort();
const moduleEdges=staticEmitted.filter(x=>x.to&&moduleOf(x.from)&&moduleOf(x.to)&&moduleOf(x.from)!==moduleOf(x.to)).map(x=>({...x,from_module:moduleOf(x.from),to_module:moduleOf(x.to)}));
const collapsed=new Map(modules.map(n=>[n,new Set()]));for(const e of moduleEdges)collapsed.get(e.from_module).add(e.to_module);
function reach(start){const seen=new Set(),todo=[start];while(todo.length){const n=todo.pop();if(seen.has(n))continue;seen.add(n);todo.push(...(emittedGraph.get(n)||[]));}return [...seen].sort();}
const entries=['lib/modules/video/index.ts','lib/modules/channel/index.ts','lib/modules/privacy/index.ts','lib/modules/authz/index.ts','lib/modules/video/domain/video-visibility.ts','lib/modules/shared/app-context.ts'];
const reachability=entries.map(file=>({file,reachable_file_count:reach(file).length,prisma_initializer_reachable:reach(file).includes('lib/prisma.ts'),files:reach(file)}));
const shape=modules.map(module=>({module,files:stats.filter(s=>moduleOf(s.file)===module).length,lines:stats.filter(s=>moduleOf(s.file)===module).reduce((n,s)=>n+s.lines,0),
  layers:Object.fromEntries(['domain','application','infrastructure'].map(l=>[l,stats.filter(s=>s.file.startsWith(`lib/modules/${module}/${l}/`)).length])),
  outgoing_modules:[...collapsed.get(module)].sort(),incoming_modules:modules.filter(n=>collapsed.get(n).has(module)),
  index_reexport_statements:parsed.filter(x=>x.from===`lib/modules/${module}/index.ts`&&x.kind==='reexport').length}));
const domainEdges=staticEmitted.filter(x=>/^lib\/modules\/[^/]+\/domain\//.test(x.from)&&((x.to&&/\/(application|infrastructure)\/|^lib\/prisma.ts$/.test(x.to))||x.specifier==='@prisma/client'));
const unresolved=parsed.filter(x=>x.local_reference&&!x.resolved_path);
const result={date:'2026-11-01',application_baseline_sha:'c397b9e548ca2c628e21457ac69d66e54b12ddbd',scope:'All baseline tracked TS/TSX under app/apps/lib/components/services/scripts/tests plus middleware, hashes checked; structural extraction, not source review completion',
  limitations:['transpileModule ESNext dependency graph is not SWC/Next tree shaking or production bundle','literal dynamic imports counted separately, computed imports and dependency node_modules internals not followed','explicit type-only and transpile elision differ; no whole-program type checker','module-level SCC can combine edges from separate files; does not prove file-level cycle','cycles are structural debt candidates, not evidence of runtime failure, leak or performance penalty'],
  counts:{files:files.length,application_files:appFiles.length,modules:modules.length,source_import_export_edges:parsed.length,transpiled_edges:emitted.length,file_cycles_emitted:cycles.length,file_cycles_declared_including_types:scc(parsedGraph).length,module_cycles: scc(collapsed).length,unresolved_local:unresolved.length,parse_diagnostics:parseDiagnostics.length},
  source_sha256:sourceHashes,parse_diagnostics:parseDiagnostics,modules:shape,emitted_file_scc:cycles,module_scc:scc(collapsed),module_edges:moduleEdges,
  declared_edges:parsed,transpiled_edges:emitted,unresolved_local:unresolved,domain_non_domain_or_prisma_edges:domainEdges,
  entry_reachability:reachability,largest_application_files:stats.filter(s=>appFiles.includes(s.file)).sort((a,b)=>b.lines-a.lines).slice(0,30),
  app_types_dependencies:parsed.filter(x=>x.to?.startsWith('app/types/')&&x.from.startsWith('lib/modules/'))};
fs.writeFileSync(path.join(base,'evidence/architecture-graph.json'),JSON.stringify(result,null,2)+'\n');
const esc=s=>JSON.stringify(String(s));
fs.writeFileSync(path.join(base,'ZALEZNOSCI-MODULOW.csv'),'module,files,lines,domain_files,application_files,infrastructure_files,index_reexports,outgoing_modules,incoming_modules\n'+shape.map(s=>[s.module,s.files,s.lines,s.layers.domain,s.layers.application,s.layers.infrastructure,s.index_reexport_statements,s.outgoing_modules.join(';'),s.incoming_modules.join(';')].map(esc).join(',')).join('\n')+'\n');
console.log(JSON.stringify({counts:result.counts,largest_cycle_files:cycles[0]?.length,entry_reachability:reachability.map(({files,...r})=>r),largest_files:result.largest_application_files.slice(0,8)}));
