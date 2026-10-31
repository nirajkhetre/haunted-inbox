"""python -m haunted scan mail.mbox | sample | serve"""
import argparse
import json
from pathlib import Path

from . import lists as public_lists
from .mail import read_mbox
from .sample import build
from .scan import scan


def main():
    ap = argparse.ArgumentParser(prog='haunted', description='Find the accounts you forgot. Everything stays on this computer.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('scan', help='read a Google Takeout .mbox file')
    s.add_argument('mbox')
    s.add_argument('--out', help='also write the report to this file')
    d = sub.add_parser('sample', help='write the made-up demo mailbox')
    d.add_argument('path', nargs='?', default='demo/sample.mbox')
    w = sub.add_parser('serve', help='open the graveyard on this computer')
    w.add_argument('--port', type=int, default=7666)
    sub.add_parser('lists', help='refresh the public breach and delete-link lists')
    a = ap.parse_args()
    if a.cmd == 'scan':
        report = scan(read_mbox(a.mbox), lambda e: e['stage'] == 'asking' and e['done'] % 10 == 0 and print(f"\r{e['done']}/{e['total']} senders", end=''))
        if a.out:
            Path(a.out).write_text(json.dumps(report, ensure_ascii=False, indent=1), 'utf-8')
        g = report['ghosts']
        print(f"\n{report['envelopes']} emails, {report['senders']} senders, {len(g)} ghosts, {sum(1 for x in g if x['breaches'])} hacked after you joined, {sum(1 for x in g if x['money'])} may have your card. {report['seconds']}s")
    elif a.cmd == 'sample':
        Path(a.path).parent.mkdir(parents=True, exist_ok=True)
        print(build(a.path), 'emails written to', a.path)
    elif a.cmd == 'lists':
        print(public_lists.refresh())
    elif a.cmd == 'serve':
        from .web import serve
        serve(a.port)


if __name__ == '__main__':
    main()
