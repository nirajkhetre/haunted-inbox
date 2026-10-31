"""The honest test: your own mailbox, your own answers. It prints totals only, and runs nothing outside this computer.

Open http://127.0.0.1:7666/check.html after a scan, mark the senders, then:
python ml/evaluate_real.py trick gemma4:e2b [any-other-ollama-model]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from haunted.reader import HOME, ask, trick  # noqa: E402
from haunted.verdict import decide, load_lists  # noqa: E402


def mcnemar(a, b, truth):
    """Exact two-sided: of the cards where only one reader was right, how lopsided was the split?"""
    only_a = sum(x == t != y for x, y, t in zip(a, b, truth))
    only_b = sum(y == t != x for x, y, t in zip(a, b, truth))
    n, k = only_a + only_b, min(only_a, only_b)
    if not n:
        return only_a, only_b, 1.0
    from math import comb
    return only_a, only_b, round(min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n), 5)


def main():
    cards = json.loads((HOME / 'last-cards.json').read_text('utf-8'))
    labels = json.loads((HOME / 'labels.json').read_text('utf-8'))
    marked = [c for c in cards if labels.get(c['key']) in ('account', 'not')]
    truth = [labels[c['key']] == 'account' for c in marked]
    lists = load_lists()
    print(f'{len(marked)} senders marked by hand, {sum(truth)} real accounts, {sum(v == "unsure" for v in labels.values())} skipped')
    said = {}
    for reader in sys.argv[1:] or ['trick']:
        said[reader] = [decide(c, trick(c) if reader == 'trick' else ask(c, reader), lists) is not None for c in marked]
        found = sum(s and t for s, t in zip(said[reader], truth))
        false = sum(s and not t for s, t in zip(said[reader], truth))
        print(json.dumps({'reader': reader, 'accounts_found': f'{found}/{sum(truth)}', 'false_alarms': f'{false}/{len(truth) - sum(truth)}', 'recall': round(found / max(1, sum(truth)), 3), 'precision': round(found / max(1, found + false), 3)}))
    names = list(said)
    for k in range(1, len(names)):
        a, b, p = mcnemar(said[names[k]], said[names[k - 1]], truth)
        print(f'{names[k]} vs {names[k - 1]}: right where the other was wrong {a} vs {b}, McNemar p={p}')


if __name__ == '__main__':
    main()
