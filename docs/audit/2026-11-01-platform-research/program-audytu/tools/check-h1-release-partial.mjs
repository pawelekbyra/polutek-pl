// Verify the actual code archive and prove that a successful partial CI run cannot authorize release.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hashJson, sha256, verifySourceArchive } from '/workspace/polutek-pl/scripts/ops/release/source.mjs';
const root='/workspace/polutek-pl',out='/workspace/.cloud-setup/h1-release-core';
const quality=JSON.parse(readFileSync(out+'/final/local-ci-partial.json','utf8'));
const acceptance=JSON.parse(readFileSync(out+'/final/acceptance-run.json','utf8'));
const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
if(git('status','--porcelain') || quality.head!==git('rev-parse','HEAD') || quality.head!==acceptance.code_sha || !quality.ok || !quality.sourceStable || quality.dirty || quality.dirtyAfter)throw new Error('Expected exact clean stable partial report');
const archive=out+'/source-archive';const createArchive=!existsSync(archive);if(createArchive)mkdirSync(archive);
let r;if(createArchive){r=spawnSync('git',['archive','--format=tar','--output='+out+'/source.tar',quality.head],{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);
r=spawnSync('tar',['-xf',out+'/source.tar','-C',archive],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);
}
verifySourceArchive(archive,quality.sourceBefore);
r=spawnSync(process.execPath,[root+'/scripts/ops/release-proof.mjs','check-ci','--report='+out+'/final/local-ci-partial.json','--revision='+quality.head,'--source='+archive],{cwd:root,encoding:'utf8'});
writeFileSync(out+'/actual-partial-report-rejection.log',r.stdout+r.stderr);
const result={code_sha:quality.head,actual_source_archive_verified:true,source_file_count:quality.sourceBefore.files.length,source_fingerprint:quality.sourceBefore.fingerprint,archive_sha256:sha256(readFileSync(out+'/source.tar')),quality_sha256:hashJson(quality),ci_selected_checks_passed:true,ci_filters:quality.options,release_check_exit:r.status,signal:r.signal,error:r.error?.message??null,stdout_bytes:r.stdout?.length??0,stderr_bytes:r.stderr?.length??0,rejected_for_partial_selection:r.status===1&&r.stderr.includes('full strict checks without filters or skips'),release_ready:false};
writeFileSync(out+'/actual-partial-report-run.json',JSON.stringify(result,null,2)+'\n');
if(!result.rejected_for_partial_selection)throw new Error('A partial quality report was not rejected for its filters');
console.log('Actual app archive verified; successful partial CI report rejected for release eligibility.');
