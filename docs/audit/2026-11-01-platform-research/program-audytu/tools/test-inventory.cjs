/* Static AST markers over tracked baseline tests. Never executes tests or app code.
 * Counts/markers are neither runtime coverage nor whole-file review or test quality scores. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),ts=require('typescript'),picomatch=require('picomatch');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const baseline='c397b9e548ca2c628e21457ac69d66e54b12ddbd';
const graph=JSON.parse(fs.readFileSync(path.join(base,'evidence/architecture-graph.json'),'utf8')).source_sha256;
let tracked;
try{tracked=cp.execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n');}
catch(e){throw Error('Read-only git ls-tree failed: '+(e.code||e.status)+'; no tests executed');}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceHashes={},diagnostics=[];
function read(p){const s=fs.readFileSync(path.join(root,p),'utf8');if(graph[p]&&hash(s)!==graph[p])throw Error('Baseline changed '+p);sourceHashes[p]=hash(s);return s;}
function name(e){if(e.kind===ts.SyntaxKind.ImportKeyword)return'import';if(ts.isIdentifier(e))return e.text;if(ts.isPropertyAccessExpression(e))return name(e.expression)+'.'+e.name.text;if(ts.isCallExpression(e))return name(e.expression);return'';}
const literal=e=>e&&(ts.isStringLiteral(e)||ts.isNoSubstitutionTemplateLiteral(e))?e.text:null;
function arrayProperty(file,objectKey,propertyKey){const s=read(file),ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true);let values=[];
 function walk(n){if(ts.isPropertyAssignment(n)&&n.name.getText(ast)===objectKey&&ts.isObjectLiteralExpression(n.initializer))for(const p of n.initializer.properties)if(ts.isPropertyAssignment(p)&&p.name.getText(ast)===propertyKey&&ts.isArrayLiteralExpression(p.initializer))values=p.initializer.elements.map(literal).filter(x=>x!==null);ts.forEachChild(n,walk);}walk(ast);return values;}
const vitestInclude=arrayProperty('vitest.config.ts','test','include'),pgInclude=arrayProperty('vitest.postgres.config.ts','test','include'),coverageInclude=arrayProperty('vitest.config.ts','coverage','include');
const defaultMatch=picomatch(vitestInclude),pgMatch=picomatch(pgInclude),coverageMatch=picomatch(coverageInclude);
const tests=[];
for(const file of tracked.filter(p=>p.startsWith('tests/')&&/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(p))){
 const s=read(file),ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 if(ast.parseDiagnostics.length)diagnostics.push({file,count:ast.parseDiagnostics.length});
 const row={file,sha256:sourceHashes[file],family:file.startsWith('tests/postgres/')?'declared_postgres':file.startsWith('tests/integration/')?'integration_directory_not_proof_of_full_stack':'unit_directory_not_proof_of_isolation',default_vitest_selected:defaultMatch(file),postgres_vitest_selected:pgMatch(file),literal_test_declarations:0,literal_suite_declarations:0,assertion_call_markers:0,vi_mock_calls:0,skip_access_markers:0,only_access_markers:0,todo_access_markers:0,fs_read_markers:0,process_exit_spy_marker:/spyOn\(process,\s*['"]exit['"]\)/.test(s),passthrough_transaction_marker:/\$transaction:\s*async\s*\([^)]*\)\s*=>\s*fn\(db\)/.test(s),env_names:[...new Set([...s.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(m=>m[1]))].sort(),relative_or_alias_imports:[]};
 function walk(n){
  if(ts.isPropertyAccessExpression(n)){const p=name(n);if(/^(?:it|test|describe)\..*skip/.test(p))row.skip_access_markers++;if(/^(?:it|test|describe)\..*only/.test(p))row.only_access_markers++;if(/^(?:it|test|describe)\..*todo/.test(p))row.todo_access_markers++;}
  if(ts.isCallExpression(n)){const p=name(n.expression),first=literal(n.arguments[0]);
   if(/^(?:it|test|itWithDb)(?:\.|$)/.test(p)&&first!==null)row.literal_test_declarations++;
   if(/^describe(?:\.|$)/.test(p)&&first!==null)row.literal_suite_declarations++;
   if(p==='expect'||p==='assert')row.assertion_call_markers++;
   if(p==='vi.mock'||p==='vi.doMock')row.vi_mock_calls++;
   if(/(?:^|\.)(?:readFileSync|readFile|readdirSync|existsSync)$/.test(p))row.fs_read_markers++;
   if((p==='vi.mock'||p==='vi.doMock'||p==='import')&&first&&(first.startsWith('.')||first.startsWith('@/')||first.startsWith('@admin/')))row.relative_or_alias_imports.push(first);
  }
  if(ts.isImportDeclaration(n)){const v=literal(n.moduleSpecifier);if(v&&(v.startsWith('.')||v.startsWith('@/')||v.startsWith('@admin/')))row.relative_or_alias_imports.push(v);}
  ts.forEachChild(n,walk);
 }walk(ast);row.relative_or_alias_imports=[...new Set(row.relative_or_alias_imports)].sort();tests.push(row);
}
const appPaths=tracked.filter(p=>/^(?:app|apps|lib|services|workers|components)\//.test(p)&&/\.[cm]?[jt]sx?$/.test(p));
const coverageScope=appPaths.map(file=>({file,selected_by_declared_coverage_include:coverageMatch(file)}));
const pkg=JSON.parse(read('package.json')),commandPaths={};
for(const key of ['test:critical-path','e2e','e2e:list'])commandPaths[key]={command:pkg.scripts[key],literal_path_checks:[...pkg.scripts[key].matchAll(/(?:^|\s)((?:tests|scripts)\/[^\s]+\.[cm]?[jt]sx?)(?=\s|$)/g)].map(m=>({file:m[1],exists:fs.existsSync(path.join(root,m[1]))}))};
read('playwright.config.ts');const coverageConfig=read('vitest.config.ts');const workflow=read('.github/workflows/ci.yml');
const sum=k=>tests.reduce((a,r)=>a+(typeof r[k]==='number'?r[k]:Number(r[k])),0);
const result={date:'2026-11-02',application_baseline_sha:baseline,method:'TypeScript AST static literal/marker inventory and glob selection only; no test/runtime coverage measurement',source_sha256:sourceHashes,tests,summary:{test_files:tests.length,by_family:Object.fromEntries([...new Set(tests.map(r=>r.family))].map(x=>[x,tests.filter(r=>r.family===x).length])),default_vitest_files:sum('default_vitest_selected'),postgres_files:sum('postgres_vitest_selected'),literal_test_declarations:sum('literal_test_declarations'),files_with_vi_mock:tests.filter(r=>r.vi_mock_calls).length,files_with_fs_read_marker:tests.filter(r=>r.fs_read_markers).length,files_with_skip_marker:tests.filter(r=>r.skip_access_markers).length,files_with_only_marker:tests.filter(r=>r.only_access_markers).length,files_with_todo_marker:tests.filter(r=>r.todo_access_markers).length,files_with_process_exit_spy:sum('process_exit_spy_marker'),files_with_passthrough_transaction_marker:sum('passthrough_transaction_marker')},vitest_include:vitestInclude,postgres_include:pgInclude,coverage:{include:coverageInclude,explicit_thresholds_property:/\bthresholds\s*:/.test(coverageConfig),app_source_paths_examined:appPaths.length,selected_app_paths:coverageScope.filter(r=>r.selected_by_declared_coverage_include).length,paths:coverageScope,actual_percentages_measured:false},browser:{declared_testDir:'tests/e2e',directory_exists:fs.existsSync(path.join(root,'tests/e2e')),tracked_files_under_declared_dir:tracked.filter(p=>p.startsWith('tests/e2e/')).length,executed:false},commandPaths,CI_mentions_RUN_INTEGRATION_TESTS:workflow.includes('RUN_INTEGRATION_TESTS'),parse_diagnostics:diagnostics,boundaries:['Literal calls are not expanded parameterized/runtime test counts','Skip/runIf markers are not actual skipped results; env flags list names only','Filesystem reading marker can mean fixtures or static contract checks, not a quality verdict','Mock imports and source import counts do not prove behavior, DB isolation, HTTP or coverage','Coverage glob exclusion does not mean no tests; include and absence of explicit thresholds are configuration facts','Existing archived full-suite failure/blockers are not rerun or replaced by this inventory']};
fs.writeFileSync(path.join(base,'evidence/test-inventory.json'),JSON.stringify(result,null,2)+'\n');
const fields=['file','sha256','family','default_vitest_selected','postgres_vitest_selected','literal_test_declarations','vi_mock_calls','fs_read_markers','skip_access_markers','process_exit_spy_marker','passthrough_transaction_marker'];
const quote=x=>{const s=String(x);return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
fs.writeFileSync(path.join(base,'TESTY-INWENTARZ.csv'),fields.join(',')+'\n'+tests.map(r=>fields.map(k=>quote(r[k])).join(',')).join('\n')+'\n');
console.log(JSON.stringify({summary:result.summary,coverage_selected_app_paths:result.coverage.selected_app_paths,coverage_scope_paths:appPaths.length,parse_diagnostics:diagnostics.length,commandPaths,browser:result.browser}));
