"""Execute unchanged summarizer with synthetic k6 metrics; no load generator or network."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path.cwd()
BASE = ROOT/'docs/audit/2026-11-01-platform-research/program-audytu'
script = ROOT/'scripts/loadtest/summarize.py'
results = []
with tempfile.TemporaryDirectory(prefix='polutek-summary-research-') as tmp:
    for case, unexpected, errors, p95 in [('expected_200',0,0,50),('all_requests_unexpected_429',500,0,50),('server_errors_control',0,0.1,50),('slow_p95_control',0,0,2500)]:
        values = {'iterations':{'count':100,'rate':10},'dropped_iterations':{'count':0},'http_reqs':{'count':500,'rate':50},
                  'server_errors':{'rate':errors},'unexpected_status':{'count':unexpected},
                  'http_req_duration':{'med':20,'p(95)':p95,'p(99)':p95+10,'max':p95+20}}
        fixture = {'metrics':{k:{'values':v} for k,v in values.items()}}
        path = Path(tmp)/'summary.json'; path.write_text(json.dumps(fixture))
        run = subprocess.run([sys.executable,str(script),str(path),'synthetic-local-only','10'],capture_output=True,text=True,timeout=10)
        results.append({'case':case,'synthetic_metrics':fixture,'exit_code':run.returncode,'stdout':run.stdout,'stderr':run.stderr})
assert [r['exit_code']for r in results]==[0,0,11,10]
output = {'date':'2026-11-01','source':'scripts/loadtest/summarize.py','source_sha256':hashlib.sha256(script.read_bytes()).hexdigest(),
          'finding':'R11','limits':'Synthetic metrics execute actual summarizer only. No k6, real HTTP statuses, CDN, workload, production or capacity test.',
          'observations':results}
(BASE/'evidence/loadtest-summary-probe.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps({'observations':len(results),'exits':[r['exit_code']for r in results]}))
