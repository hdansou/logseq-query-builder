import json, sys
last = {}
for l in open('docs/probes.jsonl'):
    r = json.loads(l); last[r['probe']] = r
for name, r in last.items():
    if name == 'seed': continue
    print('==', name, 'ok' if r['ok'] else 'FAIL', r['ms'], 'ms', r['at'])
    d = r['detail']
    if isinstance(d, list) and d and 'pass' in d[0]:
        for row in d:
            print('  ', 'PASS' if row['pass'] else 'FAIL', row['name'], row['ms'], 'ms', '' if row['pass'] else f"got={row['got']} expect={row['expect']} err={row.get('error')}")
        print('  ', sum(1 for x in d if x['pass']), '/', len(d), 'pass')
    elif isinstance(d, dict):
        for k, v in d.items(): print('  ', k, '->', v)
    else:
        print('  ', d)
