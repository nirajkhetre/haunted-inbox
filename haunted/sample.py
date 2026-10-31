"""A made-up person's mailbox, as a real .mbox file, so the demo runs through the same code as yours. Fourteen years of signing up for things."""
import random
from datetime import date, timedelta
from email.utils import format_datetime
from datetime import datetime, timezone
from pathlib import Path

ACCOUNTS = [  # name, domain, year joined, how long they kept writing, yearly volume, paid?
    ('Neopets', 'neopets.com', 2012, 3, 6, 0), ('MySpace', 'myspace.com', 2012, 2, 4, 0), ('Tumblr', 'tumblr.com', 2012, 8, 20, 0), ('Last.fm', 'last.fm', 2012, 4, 8, 0),
    ('Adobe', 'adobe.com', 2013, 13, 8, 1), ('Dropbox', 'dropbox.com', 2013, 13, 6, 0), ('LinkedIn', 'linkedin.com', 2013, 13, 40, 0), ('Wattpad', 'wattpad.com', 2013, 4, 14, 0), ('Quizlet', 'quizlet.com', 2013, 6, 5, 0),
    ('MyFitnessPal', 'myfitnesspal.com', 2014, 3, 16, 0), ('Duolingo', 'duolingo.com', 2014, 12, 30, 0), ('Evernote', 'evernote.com', 2014, 7, 5, 1), ('Imgur', 'imgur.com', 2014, 4, 3, 0),
    ('Chegg', 'chegg.com', 2015, 4, 10, 1), ('Zynga', 'zynga.com', 2015, 3, 12, 0), ('Kickstarter', 'kickstarter.com', 2015, 9, 6, 1), ('Patreon', 'patreon.com', 2015, 8, 8, 1), ('Dubsmash', 'dubsmash.com', 2015, 2, 5, 0),
    ('Spotify', 'spotify.com', 2016, 10, 16, 1), ('Netflix', 'netflix.com', 2016, 10, 12, 1), ('Uber', 'uber.com', 2016, 10, 14, 1), ('Snapchat', 'snapchat.com', 2016, 3, 3, 0), ('Pinterest', 'pinterest.com', 2016, 8, 24, 0),
    ('eBay', 'ebay.com', 2017, 9, 10, 1), ('Edmodo', 'edmodo.com', 2017, 3, 12, 0), ('Coursera', 'coursera.org', 2017, 9, 12, 1), ('Udemy', 'udemy.com', 2017, 6, 18, 1), ('Canva', 'canva.com', 2017, 9, 8, 0),
    ('Twitch', 'twitch.tv', 2018, 7, 14, 1), ('Steam', 'steampowered.com', 2018, 8, 10, 1), ('Epic Games', 'epicgames.com', 2018, 6, 12, 1), ('Discord', 'discord.com', 2018, 8, 6, 0), ('Grammarly', 'grammarly.com', 2018, 5, 20, 1),
    ('Trello', 'trello.com', 2019, 5, 6, 0), ('Zoom', 'zoom.us', 2019, 7, 6, 0), ('Medium', 'medium.com', 2019, 6, 26, 1), ('Notion', 'notion.so', 2019, 7, 5, 0), ('Figma', 'figma.com', 2020, 6, 4, 0),
    ('Shein', 'shein.com', 2020, 2, 30, 1), ('Domino\'s', 'dominos.com', 2020, 3, 12, 1), ('Robinhood', 'robinhood.com', 2021, 2, 8, 0), ('Coinbase', 'coinbase.com', 2021, 3, 6, 0), ('Nitro PDF', 'gonitro.com', 2021, 1, 2, 0),
    ('Replit', 'replit.com', 2022, 2, 6, 0), ('Vercel', 'vercel.com', 2023, 3, 6, 0), ('Perplexity', 'perplexity.ai', 2024, 1, 4, 0),
]
LISTS = [('Morning Brew', 'morningbrew.com'), ('The Hustle', 'thehustle.co'), ('TLDR', 'tldrnewsletter.com'), ('Product Hunt Daily', 'producthunt.com'), ('Dense Discovery', 'densediscovery.com'), ('NYT Cooking', 'nytimes.com'), ('Atlas Obscura', 'atlasobscura.com'), ('Hacker Newsletter', 'hackernewsletter.com'), ('Sidebar', 'sidebar.io'), ('The Verge', 'theverge.com'), ('Dribbble Weekly', 'dribbble.com'), ('Austin Kleon', 'austinkleon.com')]
LIST_SUBJECTS = ['This week in tiny cities', 'The one chart everyone is arguing about', 'Why soup is having a moment', 'Five links worth your Sunday', 'Issue {n}: the quiet internet', 'A short history of the paperclip', 'Stop scrolling, read this', 'What we are reading this month', '50% off ends tonight', 'Your weekend reading is here']
PEOPLE = [('Priya Nair', 'priya.nair42@gmail.com'), ('Tom Becker', 'tombecker@outlook.com'), ('Grandma', 'rosie.m1948@yahoo.com'), ('Lena Ortiz', 'lena@lenaortiz.studio'), ('Dad', 'r.rivera@icloud.com'), ('Study Group', 'bio201-group@westfield.edu'), ('Marcus', 'marcus@plainbakery.co')]
PEOPLE_SUBJECTS = ['Re: notes from thursday', 'photos from the lake', 'are you coming on sunday?', 'Fwd: recipe', 'happy birthday!!', 'quick question', 'Re: Re: the plan', 'look what I found', 'call me when free']
ACTIVITY = ['Your weekly summary', 'What you missed this week', 'We miss you, {me}', 'New in {s}: a better way to explore', 'Updates to our Terms of Service', 'Your {y} year in review', 'People you may know', 'Recommended for you', 'A new sign-in to your {s} account', 'Reset your {s} password', 'Your account security matters']
SIGNUP = ['Welcome to {s}!', 'Confirm your email address', 'Verify your {s} account', 'Your {s} account is ready', 'Thanks for joining {s}', 'Activate your {s} account', 'Bienvenido a {s}']
MONEY = ['Your {s} receipt', 'Payment received, thank you', 'Your {s} subscription renews soon', 'Invoice for your {s} order', 'Your order confirmation']
ME = 'Sam'


def _msg(name, addr, subject, day, rnd, listy=False):
    when = datetime(day.year, day.month, day.day, rnd.randint(6, 23), rnd.randint(0, 59), tzinfo=timezone.utc)
    head = f"From {rnd.randint(10**15, 10**16)}@xxx {when.strftime('%a %b %d %H:%M:%S +0000 %Y')}\nFrom: {name} <{addr}>\nTo: sam@example.invalid\nSubject: {subject}\nDate: {format_datetime(when)}\n"
    if listy:
        head += f"List-Unsubscribe: <mailto:leave@{addr.split('@')[1]}>\n"
    return head + '\nThe body of this made-up email is not read by anything.\n\n'


def build(path, today=date(2026, 10, 31)):
    rnd = random.Random(1999)
    out = []
    for s, domain, year, span, volume, paid in ACCOUNTS:
        start = date(year, rnd.randint(1, 12), rnd.randint(1, 28))
        out.append((start, _msg(s, f'hello@{domain}', rnd.choice(SIGNUP).format(s=s), start, rnd)))
        for y in range(span):
            for _ in range(rnd.randint(max(1, volume // 2), volume)):
                day = start + timedelta(days=rnd.randint(2, 364) + 365 * y)
                if day > today:
                    continue
                pool = MONEY if paid and rnd.random() < .22 else ACTIVITY
                out.append((day, _msg(s, f'no-reply@mail.{domain}', rnd.choice(pool).format(s=s, me=ME, y=day.year), day, rnd, listy=pool is ACTIVITY)))
    for s, domain in LISTS:
        y0 = rnd.randint(2016, 2023)
        for n in range(rnd.randint(30, 120)):
            day = date(y0, 1, 1) + timedelta(days=rnd.randint(0, 365 * (2026 - y0)))
            out.append((day, _msg(s, f'hello@{domain}', rnd.choice(LIST_SUBJECTS).format(n=n), day, rnd, listy=True)))
    for name, addr in PEOPLE:
        for _ in range(rnd.randint(20, 70)):
            day = date(2013, 1, 1) + timedelta(days=rnd.randint(0, 4900))
            out.append((day, _msg(name, addr, rnd.choice(PEOPLE_SUBJECTS), day, rnd)))
    out.sort(key=lambda r: r[0])
    Path(path).write_text(''.join(m for _, m in out), 'utf-8', newline='\n')
    return len(out)
