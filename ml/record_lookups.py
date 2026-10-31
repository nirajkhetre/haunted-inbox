"""Ask the web about the sample's ghosts once, and keep the answers in the demo, so visitors can press the button without a key.
Only the public company names are searched. python ml/record_lookups.py [how many, default all]
"""
import json
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from haunted.lookups import lookup  # noqa: E402

ROOT = Path(__file__).parent.parent
REPORT = ROOT / 'demo' / 'sample-report.json'
WRONG = {'notion.so'}  # the search found a sale of a different company called Notion. Checked by hand and left out of the demo, and the README says so


def one(g):
    t0 = time.time()
    try:
        g['lookup'] = u = lookup(g)
    except OSError as err:  # answers already found are kept, so running it again only asks about the rest
        print(g['service'], 'failed:', type(err).__name__, flush=True)
        return
    print(g['service'], f'{time.time() - t0:.0f}s', '| fate:', u['fate'] and (u['fate']['fate'], u['fate']['by'], u['fate']['quote'][:110]), '| delete:', u['delete'] and u['delete']['url'][:60], flush=True)


def main(limit=None):
    report = json.loads(REPORT.read_text('utf-8'))
    with ThreadPoolExecutor(6) as pool:
        list(pool.map(one, report['ghosts'][:limit] if limit else report['ghosts']))
    for g in report['ghosts']:
        if g['domain'] in WRONG and g.get('lookup'):
            g['lookup']['fate'] = None
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1), 'utf-8')
    shutil.copy(REPORT, ROOT / 'haunted' / 'ui' / 'sample.json')


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else None)
