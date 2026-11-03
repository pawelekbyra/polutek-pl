/* Actual Studio JSON client, synthetic Response/fetch only. No endpoint execution.
 * Demonstrates generic type casts are not runtime response-schema validation. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),ts=require('typescript');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const file='app/components/studio/studio-client.ts';
const source=fs.readFileSync(path.join(root,file),'utf8');
const hash=crypto.createHash('sha256').update(source).digest('hex');
const graph=JSON.parse(fs.readFileSync(path.join(base,'evidence/architecture-graph.json'),'utf8'));
if(hash!==graph.source_sha256[file])throw Error('Baseline changed');
const moduleRecord={exports:{}};
const output=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext('(function(require,module,exports){'+output+'\n})',{Headers,FormData,Date,Error})(name=>{throw Error('Unexpected dependency '+name);},moduleRecord,moduleRecord.exports);
const api=moduleRecord.exports;
(async()=>{
 const observations=[];
 for(const [name,body,status]of[
   ['correct_success_shape','{"originalId":"synthetic-original","partSize":16777216,"partCount":1}',200],
   ['renamed_success_field_not_rejected','{"renamedOriginalId":"synthetic-original","partSize":16777216,"partCount":1}',200],
   ['invalid_json_success_returns_null','<html>synthetic response</html>',200],
   ['forbidden_error_control','{"error":"Synthetic refusal","code":"FORBIDDEN"}',403]
 ]){
   let request,returned,error;
   try{returned=await api.studioApi('/synthetic-research-only',{},async(_url,init)=>{request={credentials:init.credentials};return new Response(body,{status});});}
   catch(e){error={name:e.name,status:e.status,code:e.code};}
   observations.push({case:name,synthetic_status:status,injected_fetch:true,request,returned:returned===undefined?null:returned,threw:!!error,error:error||null});
 }
 if(observations[0].returned.originalId!=='synthetic-original'||observations[0].threw)throw Error('Valid control');
 if(observations[1].threw||Object.hasOwn(observations[1].returned,'originalId'))throw Error('Renamed field observation');
 if(observations[2].threw||observations[2].returned!==null)throw Error('Invalid JSON observation');
 if(!observations[3].threw||observations[3].error.status!==403||observations[3].error.code!=='FORBIDDEN')throw Error('Refusal control');
 fs.writeFileSync(path.join(base,'evidence/api-contract-probe.json'),JSON.stringify({date:'2026-11-01',finding:'R21',actual_source:file,sha256:hash,observations,
   limitations:['No real server/HTTP/WAF response observed; synthetic fetch/Response only','No proof actual backend returns wrong schema','TypeScript generic T is erased; shared schemas and end-to-end contract enforcement remain to assess']},null,2)+'\n');
 console.log(JSON.stringify({observations:observations.length,real_network_requests:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
