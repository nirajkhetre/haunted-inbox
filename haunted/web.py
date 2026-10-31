"""The graveyard on this computer: 127.0.0.1 only, JSON only, and it refuses other sites. Your mail and your password never leave this process."""
import json
import mimetypes
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import lookups
from .mail import read_imap, read_mbox
from .reader import HOME, MODEL, available
from .scan import scan

UI = Path(__file__).parent / 'ui'
BOXES = {'gmail.com': 'imap.gmail.com', 'googlemail.com': 'imap.gmail.com', 'yahoo.com': 'imap.mail.yahoo.com', 'icloud.com': 'imap.mail.me.com', 'me.com': 'imap.mail.me.com', 'fastmail.com': 'imap.fastmail.com', 'aol.com': 'imap.aol.com', 'zoho.com': 'imap.zoho.com'}
progress = {'stage': 'idle'}
lock = threading.Lock()


def _load(name, default):
    try:
        return json.loads((HOME / name).read_text('utf-8'))
    except Exception:
        return default


def report():
    r = _load('last-scan.json', None)
    if r:
        states = _load('states.json', {})
        for g in r['ghosts']:
            g['state'] = states.get(g['key'], 'ghost')
    return r


def _run(source):
    global progress
    feed = []

    def event(e):
        global progress
        found = e.pop('found', None)
        if found:
            feed.append(found)
        progress = {**e, 'recent': feed[-40:], 'found_total': len(feed)}
    try:
        scan(source, event)
    except Exception as err:
        traceback.print_exc()
        progress = {'stage': 'error', 'message': str(err)[:200]}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, body, status=200):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _allowed(self):
        port = self.server.server_address[1]
        hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        origin = self.headers.get('Origin')
        return self.headers.get('Host') in hosts and (not origin or origin.split('//')[-1] in hosts)

    def do_GET(self):
        if not self._allowed():
            return self._json({'error': 'not from here'}, 403)
        path = self.path.split('?')[0]
        if path == '/api/report':
            return self._json({'report': report(), 'model': MODEL if available() else None, 'web': lookups.available()})
        if path == '/api/progress':
            return self._json(progress)
        file = (UI / ('index.html' if path == '/' else path.lstrip('/'))).resolve()
        if not file.is_file() or UI.resolve() not in file.parents:
            return self._json({'error': 'not found'}, 404)
        data = file.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > 100_000 or 'json' not in (self.headers.get('Content-Type') or ''):
            raise ValueError
        return json.loads(self.rfile.read(n) or b'{}')

    def do_POST(self):
        global progress
        if not self._allowed():
            return self._json({'error': 'not from here'}, 403)
        if progress.get('stage') in ('reading', 'asking', 'uploading') and self.path.startswith('/api/scan'):
            return self._json({'error': 'already reading'}, 409)
        if self.path == '/api/scan/file':
            return self._file()
        try:
            body = self._body()
        except ValueError:
            return self._json({'error': 'send JSON'}, 415)
        if self.path == '/api/scan/imap':
            user, password = body.get('user', '').strip(), body.get('password', '')
            host = body.get('host') or BOXES.get(user.split('@')[-1].lower())
            if not (user and password and host):
                return self._json({'error': 'need your address and an app password'}, 400)
            progress = {'stage': 'reading', 'envelopes': 0}
            threading.Thread(target=_run, args=(read_imap(host, user, password),), daemon=True).start()
            return self._json({'ok': True}, 202)
        if self.path == '/api/state':
            states = _load('states.json', {})
            states[body['key']] = body['state']
            HOME.mkdir(parents=True, exist_ok=True)
            (HOME / 'states.json').write_text(json.dumps(states), 'utf-8')
            return self._json({'ok': True})
        if self.path == '/api/lookup':
            r = report()
            ghost = next((g for g in (r or {}).get('ghosts', []) if g['key'] == body.get('key')), None)
            if not ghost:
                return self._json({'error': 'no such ghost'}, 404)
            if not lookups.available():
                return self._json({'error': 'no SerpApi key set'}, 400)
            return self._json(lookups.lookup(ghost))
        return self._json({'error': 'not found'}, 404)

    def _file(self):
        """A mail export dropped on the page: kept just long enough to read its envelopes, then deleted."""
        global progress
        if 'json' in (self.headers.get('Content-Type') or ''):
            return self._json({'error': 'send the file'}, 415)
        size = int(self.headers.get('Content-Length') or 0)
        HOME.mkdir(parents=True, exist_ok=True)
        tmp = HOME / 'incoming.mbox'
        progress = {'stage': 'uploading', 'share': 0}
        left = size
        with open(tmp, 'wb') as f:
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
                progress = {'stage': 'uploading', 'share': 1 - left / (size or 1)}

        def gone():
            try:
                yield from read_mbox(tmp)
            finally:
                tmp.unlink(missing_ok=True)
        threading.Thread(target=_run, args=(gone(),), daemon=True).start()
        return self._json({'ok': True}, 202)


def serve(port=7666, open_browser=True):
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'The graveyard is open at http://127.0.0.1:{port}  (Ctrl+C to close)')
    if open_browser:
        webbrowser.open(f'http://127.0.0.1:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
