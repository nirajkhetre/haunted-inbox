"""Plain code decides. The model can say "account"; only code can say when you joined, whether the site was hacked after that, and how to leave."""
import json
import re
from datetime import date
from pathlib import Path

from .senders import root

DATA = Path(__file__).parent / 'data'
# what shows an account best, strongest first. The model only has to find the account; code picks the proof you see
PROOF = [re.compile(p, re.I) for p in (r'\b(welcome|thanks for (joining|signing)|registered|registration)\b', r'\b(verify|verification|confirm your|activate)\b',
                                       r'\b(password|sign[- ]?in|log[- ]?in|new device|your .{0,20}account|security alert)\b', r'\b(receipt|invoice|your order|order confirmation|payment|subscription)\b')]


def load_lists():
    breaches, sites = {}, {}
    for b in json.loads((DATA / 'breaches.json').read_text('utf-8')):
        breaches.setdefault(root(b['domain']), []).append(b)
    for s in json.loads((DATA / 'sites.json').read_text('utf-8')):
        sites.setdefault(root(s['domain']), s)
    return breaches, sites


def years_since(day, today):
    return round((today - date.fromisoformat(day)).days / 365.25, 1) if day else None


def decide(card, read, lists, today=None):
    """One ghost, or None. The model's "account" only counts if the subject it points at really is on the card."""
    if card['personal'] or read.get('kind') != 'account':
        return None
    today = today or date.today()
    n = read.get('proof') or 0
    if not 1 <= n <= len(card['subjects']):
        return None  # it pointed at nothing: no proof, no ghost
    strongest = next((s for p in PROOF for s in card['subjects'] if p.search(s['text'])), None)
    # nothing plain to point at, like a foreign-language subject: keep the model's pick, but say we're less sure
    proof, confident = (strongest, True) if strongest else (card['subjects'][n - 1], False)
    breaches, sites = lists
    joined = card['first']
    # a breach only touched you if you were already there
    hits = [b for b in breaches.get(card['domain'], []) if joined and b['date'] >= joined]
    leaked = sorted({d for b in hits for d in b['data']})
    site = sites.get(card['domain'])
    silent = years_since(card['last'], today)
    score = (5 if 'Passwords' in leaked else 3 if hits else 0) + (2 if card['money'] else 0) + min(2, (silent or 0) / 3)
    service = (read.get('service') or '').strip() or card['name']
    return {'key': card['key'], 'service': service[:40], 'domain': card['domain'], 'joined': joined, 'last_heard': card['last'], 'emails': card['count'],
            'silent_years': silent, 'proof': proof, 'confident': confident, 'money': card['money'],
            'breaches': [{'name': b['name'], 'date': b['date'], 'count': b['count'], 'data': b['data'], 'url': b.get('url')} for b in hits], 'leaked': leaked,
            'leave': site and {'url': site['url'], 'difficulty': site.get('difficulty'), 'notes': site.get('notes'), 'email': site.get('email')},
            'score': round(score, 2)}
