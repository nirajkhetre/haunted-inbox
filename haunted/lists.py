"""Refresh the two public lists shipped with the project. Neither request carries anything about you."""
import json
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

DATA = Path(__file__).parent / 'data'
UA = {'User-Agent': 'haunted-inbox'}


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def refresh():
    breaches = [{'name': b['Title'], 'domain': b['Domain'], 'date': b['BreachDate'], 'count': b['PwnCount'], 'data': b['DataClasses'], 'url': f"https://haveibeenpwned.com/Breach/{b['Name']}"}
                for b in _get('https://haveibeenpwned.com/api/v3/breaches') if b.get('Domain') and b.get('IsVerified') and not b.get('IsFabricated') and not b.get('IsSpamList')]
    meta = _get('https://api.github.com/repos/jdm-contrib/jdm/contents/_data/sites.json')
    sites = []
    for s in _get(meta['download_url']):
        host = urlparse(s.get('url') or '').netloc
        domains = s.get('domains') or ([host] if host else [])
        for d in domains:
            sites.append({'name': s['name'], 'domain': d.removeprefix('www.'), 'url': s.get('url'), 'difficulty': s.get('difficulty'), 'notes': s.get('notes'), 'email': s.get('email')})
    DATA.mkdir(exist_ok=True)
    (DATA / 'breaches.json').write_text(json.dumps(breaches, ensure_ascii=False, indent=0), 'utf-8')
    (DATA / 'sites.json').write_text(json.dumps(sites, ensure_ascii=False, indent=0), 'utf-8')
    (DATA / 'SOURCES.md').write_text(f"Snapshot taken {date.today()}.\n\n- breaches.json: Have I Been Pwned public breach list (CC BY 4.0), verified breaches with a domain. https://haveibeenpwned.com/API/v3#AllBreaches\n- sites.json: JustDeleteMe (MIT). https://github.com/jdm-contrib/jdm\n", 'utf-8')
    return len(breaches), len(sites)


if __name__ == '__main__':
    print(refresh())
