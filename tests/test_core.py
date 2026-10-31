"""The small things that must never break. python -m unittest discover tests"""
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from haunted.mail import envelope, read_mbox
from haunted.reader import card_text, trick
from haunted.sample import ACCOUNTS, build
from haunted.senders import build_cards, root
from haunted.verdict import decide

TODAY = date(2026, 10, 31)
RAW = b"""From: "Acme" <no-reply@mail.acme.com>\r\nSubject: =?utf-8?B?V2VsY29tZSB0byBBY21l?=\r\nDate: Tue, 3 Mar 2015 10:00:00 +0000\r\nList-Unsubscribe: <mailto:x@acme.com>\r\n\r\nthe secret body\r\n"""


def card(subjects, domain='acme.com', first='2015-03-03', last='2020-01-01', personal=False, money=None):
    return {'key': domain, 'domain': domain, 'name': 'Acme', 'count': len(subjects), 'first': first, 'last': last, 'list_share': 0,
            'personal': personal, 'subjects': [{'date': first, 'text': s} for s in subjects], 'money': money}


def breach(day, data=('Passwords',)):
    return {'name': 'Acme', 'date': day, 'count': 10, 'data': list(data), 'url': 'https://x'}


class Mail(unittest.TestCase):
    def test_reads_the_envelope_and_never_the_body(self):
        e = envelope(RAW, None)
        self.assertEqual((e['name'], e['domain'], e['subject'], e['date'], e['list']), ('Acme', 'mail.acme.com', 'Welcome to Acme', '2015-03-03', True))
        self.assertNotIn('secret', json.dumps(e))

    def test_skips_spam_and_sent_folders(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'm.mbox'
            keep = b'From x Tue Mar 3 10:00:00 2015\nFrom: a@acme.com\nSubject: keep\nDate: Tue, 3 Mar 2015 10:00:00 +0000\n\nbody\n\n'
            drop = b'From x Tue Mar 3 10:00:00 2015\nFrom: b@acme.com\nSubject: drop\nX-Gmail-Labels: Spam\nDate: Tue, 3 Mar 2015 10:00:00 +0000\n\nbody\n\n'
            path.write_bytes(keep + drop)
            self.assertEqual([e['subject'] for e in read_mbox(path)], ['keep'])


class Senders(unittest.TestCase):
    def test_root(self):
        self.assertEqual(root('mail.duolingo.com'), 'duolingo.com')
        self.assertEqual(root('news.bbc.co.uk'), 'bbc.co.uk')

    def test_a_delivery_service_is_not_the_sender(self):
        rows = [{'name': n, 'addr': 'x@sendgrid.net', 'domain': 'sendgrid.net', 'subject': 's', 'date': '2020-01-01', 'list': False} for n in ('Acme', 'Bolt')]
        cards, total = build_cards(rows)
        self.assertEqual((len(cards), total), (2, 2))


class Verdict(unittest.TestCase):
    lists = ({}, {})

    def test_no_subject_to_show_means_no_ghost(self):
        self.assertIsNone(decide(card([]), {'kind': 'account'}, self.lists, TODAY))

    def test_a_stranger_on_a_throwaway_domain_is_not_your_account(self):
        self.assertIsNone(decide(card(['Verify your account now'], domain='secure-update.xyz'), {'kind': 'account'}, self.lists, TODAY))

    def test_code_picks_the_strongest_proof(self):
        g = decide(card(['We miss you', 'Your receipt', 'Welcome to Acme']), {'kind': 'account'}, self.lists, TODAY)
        self.assertEqual((g['proof']['text'], g['confident']), ('Welcome to Acme', True))

    def test_an_odd_subject_is_kept_but_marked_unsure(self):
        g = decide(card(['Bienvenue chez Acme', 'Votre mois']), {'kind': 'account'}, self.lists, TODAY)
        self.assertEqual((g['proof']['text'], g['confident']), ('Bienvenue chez Acme', False))

    def test_people_and_lists_are_never_ghosts(self):
        self.assertIsNone(decide(card(['Welcome']), {'kind': 'list'}, self.lists, TODAY))
        self.assertIsNone(decide(card(['Welcome'], personal=True), {'kind': 'account'}, self.lists, TODAY))

    def test_a_breach_only_counts_after_you_joined(self):
        before, after = breach('2014-01-01'), breach('2016-01-01')
        g = decide(card(['Welcome']), {'kind': 'account'}, ({'acme.com': [before, after]}, {}), TODAY)
        self.assertEqual([b['date'] for b in g['breaches']], ['2016-01-01'])
        self.assertEqual(g['leaked'], ['Passwords'])

    def test_passwords_outrank_a_quiet_breach(self):
        loud = decide(card(['Welcome']), {'kind': 'account'}, ({'acme.com': [breach('2016-01-01')]}, {}), TODAY)
        quiet = decide(card(['Welcome']), {'kind': 'account'}, ({'acme.com': [breach('2016-01-01', ('Names',))]}, {}), TODAY)
        self.assertGreater(loud['score'], quiet['score'])


class Reader(unittest.TestCase):
    def test_the_card_holds_only_what_the_model_may_see(self):
        text = card_text(card(['Welcome to Acme']))
        self.assertIn('1. Welcome to Acme', text)

    def test_trick_is_the_keyword_search(self):
        self.assertEqual(trick(card(['We miss you', 'Verify your email']))['kind'], 'account')
        self.assertEqual(trick(card(['Issue 40']))['kind'], 'other')


class Lookups(unittest.TestCase):
    def test_a_quote_is_always_a_real_sentence_that_names_the_service(self):
        from haunted.lookups import sentences, was_sold
        rows = [{'link': 'https://news.example/a', 'snippet': 'Nothing here about it. Automattic acquired Tumblr from Verizon in 2019. Other news.'},
                {'link': 'https://www.google.com/goto?x=1', 'snippet': 'Yahoo acquired Tumblr for a billion dollars.'},
                {'link': '/goto?url=abc', 'snippet': 'Verizon sold Tumblr to a smaller company.'},
                {'link': 'https://news.example/b', 'snippet': 'Someone acquired something else entirely.'}]
        self.assertEqual([f['quote'] for f in sentences(rows, 'Tumblr', was_sold)], ['Automattic acquired Tumblr from Verizon in 2019.'])

    def test_who_bought_whom_runs_the_right_way_round(self):
        from haunted.lookups import was_closed, was_sold
        for yes, name in [('Microsoft bought LinkedIn for $26.2 billion in 2016.', 'LinkedIn'), ('Wattpad has been sold to Naver Corp.', 'Wattpad'), ('In April 2018, Edmodo was acquired by NetDragon.', 'Edmodo'),
                          ('Reddit has acquired short-form video app Dubsmash in a deal.', 'Dubsmash'), ('Back in January, Atlassian announced its acquisition of Trello for $425 million.', 'Trello')]:
            self.assertTrue(was_sold(yes, name), yes)
        for no, name in [('Dropbox acquired Reclaim.ai for $40.2M.', 'Dropbox'), ('Grammarly has announced its acquisition of startup Superhuman.', 'Grammarly'), ('Robinhood has acquired trading platform Cove Markets.', 'Robinhood'),
                         ('Zoom Communications (Zoom Rooms) was acquired by Appspace.', 'Zoom')]:
            self.assertFalse(was_sold(no, name), no)
        self.assertTrue(was_closed('Dubsmash has officially shut down.', 'Dubsmash'))
        self.assertFalse(was_closed('Zynga has shut down, pulled from the app store its worst game.', 'Zynga'))


class Sample(unittest.TestCase):
    def test_every_made_up_account_lands_in_the_mailbox(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 's.mbox'
            build(path)
            cards, _ = build_cards(read_mbox(path))
            have = {c['domain'] for c in cards}
            self.assertFalse({root(a[1]) for a in ACCOUNTS} - have)


class Server(unittest.TestCase):
    def test_other_sites_are_refused(self):
        import threading
        import urllib.error
        import urllib.request
        from http.server import ThreadingHTTPServer

        from haunted.web import Handler
        s = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=s.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{s.server_address[1]}'
        try:
            for path, headers, data in [('/api/report', {'Host': 'evil.example'}, None), ('/api/state', {'Origin': 'https://evil.example', 'Content-Type': 'application/json'}, b'{}')]:
                with self.assertRaises(urllib.error.HTTPError) as err:
                    urllib.request.urlopen(urllib.request.Request(base + path, data, headers))
                self.assertEqual(err.exception.code, 403)
            with self.assertRaises(urllib.error.HTTPError) as err:  # a plain form post from another page cannot send JSON
                urllib.request.urlopen(urllib.request.Request(base + '/api/state', b'a=1', {'Content-Type': 'application/x-www-form-urlencoded'}))
            self.assertEqual(err.exception.code, 415)
            with self.assertRaises(urllib.error.HTTPError) as err:  # and no path may climb out of the page's folder
                urllib.request.urlopen(base + '/..%2f..%2fverdict.py')
            self.assertEqual(err.exception.code, 404)
        finally:
            s.shutdown()


if __name__ == '__main__':
    unittest.main()
