"""One watch over a mailbox: read the envelopes, group them, ask the model about each sender, let code decide, save."""
import json
import time
from datetime import date

from .reader import HOME, MODEL, Memory, available, trick
from .senders import build_cards
from .verdict import decide, load_lists


def scan(envelopes, on_event=lambda e: None, model=None, today=None):
    t0 = time.time()
    on_event({'stage': 'reading', 'envelopes': 0})
    cards, total = build_cards(envelopes, lambda n: n % 500 == 0 and on_event({'stage': 'reading', 'envelopes': n}))
    model = model or MODEL
    use_model = available(model)
    todo = [c for c in cards if not c['personal']]
    lists, memory, ghosts = load_lists(), Memory(), []
    on_event({'stage': 'asking', 'envelopes': total, 'senders': len(cards), 'done': 0, 'total': len(todo), 'model': model if use_model else None})
    for k, card in enumerate(sorted(todo, key=lambda c: c['first'] or '9'), 1):
        try:
            read = memory.read(card, model) if use_model else trick(card)
        except Exception as err:
            read = trick(card) | {'error': str(err)[:120]}
        ghost = decide(card, read, lists, today)
        if ghost:
            ghosts.append(ghost)
        on_event({'stage': 'asking', 'envelopes': total, 'senders': len(cards), 'done': k, 'total': len(todo), 'model': model if use_model else None, 'found': ghost and {'service': ghost['service'], 'joined': ghost['joined'], 'hacked': bool(ghost['breaches'])}})
        if k % 25 == 0:
            memory.save()
    memory.save()
    ghosts.sort(key=lambda g: g['joined'] or '9')
    report = {'made': (today or date.today()).isoformat(), 'seconds': round(time.time() - t0, 1), 'envelopes': total, 'senders': len(cards), 'model': model if use_model else None, 'ghosts': ghosts}
    HOME.mkdir(parents=True, exist_ok=True)
    (HOME / 'last-scan.json').write_text(json.dumps(report, ensure_ascii=False), 'utf-8')
    (HOME / 'last-cards.json').write_text(json.dumps(cards, ensure_ascii=False), 'utf-8')  # for checking the results by hand. Stays here, like everything else
    on_event({'stage': 'done', 'envelopes': total, 'senders': len(cards), 'ghosts': len(ghosts)})
    return report
