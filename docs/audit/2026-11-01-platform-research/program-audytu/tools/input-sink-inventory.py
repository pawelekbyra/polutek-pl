"""Baseline source/config marker inventory. Absence is scoped, not proof about production/third-party internals."""
import csv,hashlib,json,re,subprocess
from pathlib import Path
R=Path.cwd();B=R/'docs/audit/2026-11-01-platform-research/program-audytu';BASE='c397b9e548ca2c628e21457ac69d66e54b12ddbd'
inventory={r['path']:r['sha256']for r in csv.DictReader((B/'INWENTARZ-PLIKOW.csv').open())}
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],text=True).splitlines()
extensions={'.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.sql','.sh','.yaml','.yml','.rb','.cf','.conf'}
files=[p for p in tracked if ((p.startswith(('app/','apps/','lib/','services/','workers/','scripts/','deploy/','components/'))and Path(p).suffix in extensions)or p in ['package.json','package-lock.json'])and not p.endswith('.env')]
patterns={
 'LDAP':r'\b(?:ldap|ldaps|ldapjs)\b','XPath':r'\bxpath\b','LaTeX':r'\b(?:latex|pdflatex|xelatex|lualatex)\b','JNDI':r'\bjndi\b','Memcached':r'\b(?:memcache|memcached)\b',
 'dangerous_html':r'\bdangerouslySetInnerHTML\b','dynamic_code':r'\beval\s*\(|\bnew\s+Function\s*\(',
 'unsafe_SQL_marker':r'\$(?:query|execute)RawUnsafe\b|Prisma\.raw\b|\bsql\.unsafe\s*\(',
 'parameterized_SQL_marker':r'Prisma\.sql\b|\$(?:query|execute)Raw\b',
 'dynamic_RegExp':r'\bnew\s+RegExp\s*\(','URL_decode':r'\bdecodeURI(?:Component)?\s*\(',
 'HTML_sanitizer':r'\bsanitizeHtml\b|\bDOMPurify\b','CSV_writer':r'\b(?:csvCell|csvText|toCsv)\s*\(',
 'XML_parser_marker':r'\b(?:DOMParser|XMLParser|parseFromString|fast-xml-parser|xml2js|xmldom|SAXParser)\b'
}
hits={k:[]for k in patterns};hashes={}
for p in files:
 raw=(R/p).read_bytes();h=hashlib.sha256(raw).hexdigest();assert h==inventory[p],p;hashes[p]=h
 text=raw.decode('utf-8',errors='replace')
 for k,pattern in patterns.items():
  for i,line in enumerate(text.splitlines(),1):
   if re.search(pattern,line,re.I if k in ['LDAP','XPath','LaTeX','JNDI','Memcached']else 0):hits[k].append({'file':p,'line':i})
result={'date':'2026-11-02','application_baseline_sha':BASE,'method':'Regex source/config/dependency marker inventory of tracked baseline corpus, no execution or universal sink/taint analysis','source_sha256':hashes,'corpus_files':len(files),'patterns':patterns,'hits':hits,'counts':{k:len(v)for k,v in hits.items()},'scoped_absent_features':[k for k in ['LDAP','XPath','LaTeX','JNDI','Memcached']if not hits[k]],'boundaries':['Only repository-owned source/config and its declared lockfile; not installed dependency source, native libraries or actual production configuration','A marker can occur in a comment or be a safe constant; not an exploit or complete sink inventory','Absence can justify conditional non-applicability for absent integrations, not a platform-wide security certification','Requalify if feature/config/dependency inventory changes; external support stack internals not audited here']}
(B/'evidence/input-sink-inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'corpus_files':len(files),'marker_counts':result['counts'],'scoped_absent_features':result['scoped_absent_features']}))
