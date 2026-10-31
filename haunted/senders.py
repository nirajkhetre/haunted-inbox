"""Group envelopes by who sent them, so a model reads one short card per sender instead of a whole mailbox."""
import re
from collections import Counter

# ponytail: a short list of country suffixes, not the full public suffix list; add it if real mailboxes need it
TWO_LEVEL = {'co.uk', 'ac.uk', 'org.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.in', 'ac.in', 'org.in', 'net.in', 'gov.in', 'co.jp', 'ne.jp', 'or.jp',
             'com.br', 'net.br', 'org.br', 'co.nz', 'co.za', 'com.mx', 'com.cn', 'com.sg', 'com.tr', 'com.hk', 'co.kr', 'com.ar', 'com.tw', 'co.id', 'com.my', 'com.ph'}
PERSONAL = {'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
            'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.de', 'mail.com', 'zoho.com', 'rediffmail.com', 'yandex.com', 'yandex.ru', 'qq.com', '163.com', 'fastmail.com'}
# mail sent for a company through a delivery service: the sender's name says who it really is
DELIVERY = {'sendgrid.net', 'amazonses.com', 'mailgun.org', 'mcsv.net', 'rsgsv.net', 'mailchimpapp.net', 'sparkpostmail.com', 'mandrillapp.com', 'postmarkapp.com', 'hubspotemail.net', 'constantcontact.com', 'mailjet.com', 'sendinblue.com', 'brevo.com'}
SIGNS = re.compile(r'\b(welcome|verify|verification|confirm|activate|password|sign[- ]?in|log[- ]?in|new device|security alert|your account|receipt|invoice|order|payment|subscription|renew|billing|charged|trial)\b', re.I)
MONEY = re.compile(r'\b(receipt|invoice|payment|paid|charged|billing|renewal|renews?|subscription|your order|order confirmation|refund)\b', re.I)
SAMPLE = 8


def root(domain):
    """mail.duolingo.com is duolingo.com; news.bbc.co.uk is bbc.co.uk."""
    parts = domain.lower().strip('.').split('.')
    return '.'.join(parts[-3:] if '.'.join(parts[-2:]) in TWO_LEVEL and len(parts) > 2 else parts[-2:])


def build_cards(envelopes, on_each=None):
    """All envelopes, as one card per sender: code counts the dates; the model will only read the words."""
    groups = {}
    total = 0
    for e in envelopes:
        total += 1
        domain = root(e['domain'])
        key = f"{re.sub(r'[^a-z0-9]+', '-', e['name'].lower()).strip('-') or 'unknown'}.{domain}" if domain in DELIVERY else domain
        g = groups.setdefault(key, {'key': key, 'domain': domain, 'names': Counter(), 'rows': [], 'lists': 0})
        g['names'][e['name'] or e['addr'].split('@')[0]] += 1
        g['rows'].append((e['date'] or '', e['subject']))
        g['lists'] += e['list']
        if on_each:
            on_each(total)
    return [_card(g) for g in groups.values()], total


def _card(g):
    rows = sorted(g['rows'], key=lambda r: r[0])
    dated = [r for r in rows if r[0]]
    subjects, seen = [], set()

    def take(row):
        norm = re.sub(r'\W+', ' ', row[1].lower()).strip()
        if row[1] and norm not in seen and len(subjects) < SAMPLE:
            seen.add(norm)
            subjects.append(row)
    for row in rows[:4]:
        take(row)
    for row in [r for r in rows if SIGNS.search(r[1])][:4]:
        take(row)
    for row in rows[-2:]:
        take(row)
    subjects.sort(key=lambda r: r[0])
    money = next((r for r in rows if MONEY.search(r[1])), None)
    return {'key': g['key'], 'domain': g['domain'], 'name': g['names'].most_common(1)[0][0], 'count': len(rows),
            'first': dated[0][0] if dated else None, 'last': dated[-1][0] if dated else None, 'list_share': round(g['lists'] / len(rows), 2),
            'personal': g['domain'] in PERSONAL, 'subjects': [{'date': d, 'text': s} for d, s in subjects],
            'money': {'date': money[0], 'text': money[1]} if money else None}
