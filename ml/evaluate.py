"""The same frozen cards for every reader, scored by the only question that matters: is this an account you have?

python ml/evaluate.py trick gemma4:e2b [any-other-ollama-model]
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from haunted.reader import ask, trick  # noqa: E402
from haunted.verdict import decide, load_lists  # noqa: E402
from ml.frozen import FROZEN  # noqa: E402

GROUPS = {'keywordless': range(16, 30), 'other languages': range(30, 52)}


def card(row):
    _, name, domain, subjects = row
    return {'key': domain, 'domain': domain, 'name': name, 'count': 12 + len(subjects) * 7, 'first': '2017-03-04', 'last': '2022-06-01', 'list_share': 0, 'personal': False,
            'subjects': [{'date': f'201{k + 7}-03-04', 'text': s} for k, s in enumerate(subjects)], 'money': None}


def score(said):
    """said: one True/False per frozen card, in order."""
    truth = [r[0] == 'account' for r in FROZEN]
    found = sum(s and t for s, t in zip(said, truth))
    false = sum(s and not t for s, t in zip(said, truth))
    out = {'accounts_found': f'{found}/{sum(truth)}', 'false_alarms': f'{false}/{len(truth) - sum(truth)}', 'precision': round(found / max(1, found + false), 3), 'recall': round(found / sum(truth), 3)}
    for name, span in GROUPS.items():
        out[name] = f'{sum(said[k] for k in span)}/{len(span)}'
    return out


def run(reader):
    runs = Path(__file__).parent / 'runs'
    runs.mkdir(exist_ok=True)
    t0, said, rows, lists = time.time(), [], [], load_lists()
    for row in FROZEN:
        c = card(row)
        read = trick(c) if reader == 'trick' else ask(c, reader)
        said.append(decide(c, read, lists) is not None)  # the whole path, as you would meet it, not just the model
        rows.append({'name': row[1], 'truth': row[0], 'said': read.get('kind'), 'ghost': said[-1], 'service': read.get('service')})
    result = {'reader': reader, 'cards': len(FROZEN), 'seconds_per_card': round((time.time() - t0) / len(FROZEN), 2), **score(said)}
    (runs / f"frozen-{reader.replace(':', '_').replace('/', '_')}.json").write_text(json.dumps({'result': result, 'rows': rows}, ensure_ascii=False, indent=1), 'utf-8')
    return result, [r for r in rows if (r['truth'] == 'account') != r['ghost']]


if __name__ == '__main__':
    assert [r[0] for r in FROZEN[16:30]] == ['account'] * 14 and [r[0] for r in FROZEN[30:52]] == ['account'] * 22
    for reader in sys.argv[1:] or ['trick']:
        result, wrong = run(reader)
        print(json.dumps(result, ensure_ascii=False))
        print('  wrong:', ', '.join(f"{r['name']} ({r['truth']}, said {r['said']})" for r in wrong))
