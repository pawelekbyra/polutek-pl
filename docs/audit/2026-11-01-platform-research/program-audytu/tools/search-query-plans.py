"""Actual captured Polutek SQL on temporary LIKE INCLUDING ALL tables in LOCAL research PG.
No permanent fixtures, production access, application client, endpoint or capacity claim.
One EXPLAIN per case at each catalogue size; warm/noisy local observations, no p95.
"""
import importlib.util
import json
import re
from pathlib import Path

BASE = Path.cwd() / 'docs/audit/2026-11-01-platform-research/program-audytu'
spec = importlib.util.spec_from_file_location('local_research_pg', BASE / 'tools/database-integrity-experiment.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)  # helper.main deliberately NOT executed
capture = json.loads((BASE / 'evidence/search-sql-capture.json').read_text())


def literal(value):
    if isinstance(value, list):
        return 'ARRAY[' + ','.join(literal(v) for v in value) + ']'
    if isinstance(value, str):
        return helper.q(value)
    if isinstance(value, int):
        return str(value)
    raise ValueError('Unsupported SQL fixture parameter type')


def plan_nodes(node):
    out = [{key: node[key] for key in ['Node Type', 'Relation Name', 'Index Name', 'Actual Rows', 'Rows Removed by Filter', 'Shared Hit Blocks', 'Local Hit Blocks'] if key in node}]
    for child in node.get('Plans', []):
        out.extend(plan_nodes(child))
    return out


session = helper.Session()
try:
    metadata = json.loads(session.one("SELECT json_build_object('database',current_database(),'version',current_setting('server_version'),'isolation',current_setting('transaction_isolation'))"))
    assert metadata['database'].startswith('polutek_research_')
    session.query('''BEGIN;
      SET LOCAL search_path=pg_temp,public;
      SET LOCAL statement_timeout='15000ms';
      CREATE TEMP TABLE "Creator" (LIKE public."Creator" INCLUDING ALL) ON COMMIT DROP;
      CREATE TEMP TABLE "Video" (LIKE public."Video" INCLUDING ALL) ON COMMIT DROP;
      CREATE TRIGGER "research_search_refresh" BEFORE INSERT ON "Video"
        FOR EACH ROW EXECUTE FUNCTION public.video_search_refresh();
      INSERT INTO "Creator" ("id","userId","slug","name","updatedAt")
        SELECT 'research-c-'||g, 'research-u-'||g, 'research-channel-'||g,'Synthetic channel '||g,now()
        FROM generate_series(1,100)g;''')
    results = []
    for size in [1000, 10000]:
        session.query(f'''TRUNCATE "Video";
          INSERT INTO "Video" ("id","creatorId","title","slug","status","updatedAt","publishedAt","views","category","tags","duration","description","thumbnailUrl")
          SELECT 'research-v-'||g, 'research-c-'||(1+(g%100)),
            CASE WHEN g=1 THEN 'uniquerare' ELSE 'popular middleword '||g END,
            'synthetic-video-'||g,'PUBLISHED',now(),timestamp '2026-10-01'+g*interval '1 minute',
            g%10000, CASE WHEN g%2=0 THEN 'science' ELSE 'education' END,
            ARRAY['synthetic','example'], '8:00', 'Synthetic public description', 'research-synthetic-thumb'
          FROM generate_series(1,{size})g;
          ANALYZE "Video"; ANALYZE "Creator";''')
        for case in capture['cases']:
            statement = re.sub(r'\$(\d+)', lambda m: literal(case['values'][int(m.group(1))-1]), case['text'])
            assert not re.search(r'\$\d+', statement)
            raw = json.loads(session.one('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + statement))[0]
            results.append({'catalogue_rows': size, 'case': case['id'], 'planning_ms': raw['Planning Time'], 'execution_ms': raw['Execution Time'],
                            'returned_rows': raw['Plan']['Actual Rows'], 'nodes': plan_nodes(raw['Plan']), 'raw_explain': raw})
    session.query('ROLLBACK')
    output = {'date':'2026-11-01','metadata':metadata,'fixture': '100 temporary Creator rows; 1000 then 10000 Video rows; real copied indexes/defaults/checks and real public refresh trigger; foreign keys not copied',
              'limits': ['one observation per case/size; no percentile or concurrent capacity', 'channel-name lookup, hydrate, facets, Prisma, network and HTTP excluded', 'local temp buffers, synthetic text/data distribution and host differ from production', 'PeerTube not executed; no comparative benchmark'],
              'cleanup':'ROLLBACK; temp tables only; no persistent fixture or schema mutation','observations':results}
    (BASE / 'evidence/search-query-plans.json').write_text(json.dumps(output, indent=2)+'\n')
    print(json.dumps({'observations':len(results),'max_execution_ms':max(r['execution_ms'] for r in results),'cleanup':output['cleanup']}))
finally:
    session.close()
