"""Read only the envelope of each email: who sent it, when, and the subject. Bodies are skipped and never kept."""
import imaplib
import os
import re
from email.header import decode_header, make_header
from email.parser import BytesHeaderParser
from email.utils import parseaddr, parsedate_to_datetime

FROM_LINE = re.compile(rb'^From \S+.*\d{4}\r?\n$')
SKIP_LABELS = ('spam', 'draft', 'sent', 'chat')
FIELDS = 'FROM SUBJECT DATE LIST-UNSUBSCRIBE LIST-ID'
_parser = BytesHeaderParser()


def _text(value):
    try:
        return re.sub(r'\s+', ' ', str(make_header(decode_header(value or '')))).strip()
    except Exception:
        return re.sub(r'\s+', ' ', str(value or '')).strip()


def envelope(raw, me=None):
    """One message's header bytes as a small dict, or None if it isn't mail someone sent to you."""
    h = _parser.parsebytes(raw)
    labels = (h.get('X-Gmail-Labels') or '').lower()
    if any(k in labels for k in SKIP_LABELS):
        return None
    name, addr = parseaddr(_text(h.get('From')))
    addr = addr.lower()
    if '@' not in addr or addr == (me or '').lower():
        return None
    try:
        date = parsedate_to_datetime(h.get('Date')).date().isoformat()
    except Exception:
        date = None
    return {'name': name, 'addr': addr, 'domain': addr.split('@')[-1], 'subject': _text(h.get('Subject'))[:140], 'date': date,
            'list': bool(h.get('List-Unsubscribe') or h.get('List-Id'))}


def read_mbox(path, on_progress=None, me=None):
    """A Google Takeout .mbox, read as a stream so a many-gigabyte file costs almost no memory."""
    size = os.path.getsize(path) or 1
    seen, head, in_head = 0, [], False
    with open(path, 'rb') as f:
        for line in f:
            seen += len(line)
            if FROM_LINE.match(line):
                head, in_head = [], True
            elif in_head:
                if line in (b'\n', b'\r\n'):
                    in_head = False
                    e = envelope(b''.join(head), me)
                    if e:
                        yield e
                    if on_progress:
                        on_progress(seen / size)
                else:
                    head.append(line)


def read_imap(host, user, password, on_progress=None):
    """Your mail server, read-only, asking for envelopes alone. The password is only ever held in memory."""
    imaplib._MAXLINE = 50_000_000  # the list of every message in a big mailbox comes back as one very long line
    box = imaplib.IMAP4_SSL(host, timeout=120)
    box.login(user, password)
    try:
        folder = 'INBOX'
        for row in box.list()[1] or []:
            line = row.decode('utf-8', 'replace')
            if r'\All' in line:
                folder = line.rsplit(' "/" ', 1)[-1]
        box.select(folder, readonly=True)
        uids = (box.uid('search', None, 'ALL')[1][0] or b'').split()
        for k in range(0, len(uids), 500):
            rows = box.uid('fetch', b','.join(uids[k:k + 500]), f'(BODY.PEEK[HEADER.FIELDS ({FIELDS})])')[1]
            for row in rows or []:
                if isinstance(row, tuple):
                    e = envelope(row[1], user)
                    if e:
                        yield e
            if on_progress:
                on_progress(min(1, (k + 500) / len(uids)))
    finally:
        box.logout()
