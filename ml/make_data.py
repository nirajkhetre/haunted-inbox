"""Training cards with the answer known first: pick what a sender really is, then write the mail that kind of sender sends.

Real service names come from the public lists. No one's real mail goes in here, ever.
Services are split before anything else, so no name in the frozen test was ever seen in training.
"""
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from haunted.reader import INSTRUCTIONS, card_text  # noqa: E402
from ml.frozen import FROZEN  # noqa: E402

HERE = Path(__file__).parent
DATA = HERE.parent / 'haunted' / 'data'

# what a real account sends. {s} is the service, {n} a number, {me} the owner
SIGNUP = ['Welcome to {s}!', 'Welcome to {s}, {me}', 'Confirm your email address', 'Verify your {s} account', 'Your {s} account is ready', 'Thanks for joining {s}', 'Activate your {s} account',
          'Please confirm your email', 'One more step to finish signing up', 'You are in! Here is how {s} works', 'Get started with {s}', '{me}, finish setting up your profile']
SECURITY = ['Reset your {s} password', 'A new sign-in to your {s} account', 'Your password was changed', 'New login from Chrome on Windows', 'Your {s} verification code', 'Your code is {n}', '{n} is your {s} code', 'Did you just log in?', 'Security alert for your account', 'New device added to your account', 'Your one-time password']
MONEY = ['Your {s} receipt', 'Payment received, thank you', 'Your {s} subscription renews soon', 'Invoice for your {s} order', 'Your order confirmation', 'Order #{n} has shipped', 'Your refund is on its way', 'Your free trial ends tomorrow', 'Your card was declined', 'We could not process your payment', 'Your statement is ready', 'Your booking is confirmed', 'Your ride on Tuesday evening', 'Your e-ticket for Friday']
# no keyword in these at all, and they still only ever come from an account you made
QUIET = ['{me}, you have 3 new notifications', 'Someone commented on your photo', '{me}, you were mentioned', 'You have a new follower', 'Your streak is about to end', 'You earned 200 points', 'Your video got 10 new views', 'New message from Alex', 'Your weekly stats, {me}', 'Your 2019 year in review', 'People you may know', 'Your storage is almost full', 'Your saved search has 4 new results', 'A reminder about your upcoming trip', 'Your report is ready to download', 'Your friend joined {s}', 'You left something in your cart', 'Your wishlist item is on sale', 'You have 2 unread messages', 'Alex invited you to a workspace', 'Someone found your review useful', 'Your check-in earned a badge', 'New photos near you', 'Your plan for tomorrow']
FILLER = ['We miss you, {me}', 'Updates to our Terms of Service', 'New in {s}: a better way to explore', 'What you missed this week', 'Recommended for you', 'Our privacy policy is changing', 'Tips to get more out of {s}', 'Your weekly summary']

# the same four kinds of mail, in other languages: signup, security, money, activity
ABROAD = {
    'es': (['Bienvenido a {s}', 'Confirma tu correo electrónico', 'Activa tu cuenta'], ['Restablece tu contraseña', 'Tu código de verificación es {n}', 'Nuevo inicio de sesión'], ['Tu recibo de {s}', 'Tu pedido está en camino', 'Pago recibido'], ['Tu resumen semanal', 'Tienes un mensaje nuevo', 'A alguien le gustó tu foto']),
    'fr': (['Bienvenue sur {s}', 'Confirmez votre adresse e-mail', 'Activez votre compte'], ['Réinitialisez votre mot de passe', 'Votre code de vérification', 'Nouvelle connexion à votre compte'], ['Votre facture {s}', 'Votre commande a été expédiée', 'Paiement reçu'], ['Vos statistiques de la semaine', 'Vous avez un nouveau message', 'Rappel de votre rendez-vous']),
    'de': (['Willkommen bei {s}', 'Bestätige deine E-Mail-Adresse', 'Aktiviere dein Konto'], ['Passwort zurücksetzen', 'Dein Bestätigungscode', 'Neue Anmeldung bei deinem Konto'], ['Deine Rechnung von {s}', 'Deine Bestellung ist unterwegs', 'Zahlung erhalten'], ['Du hast 3 neue Benachrichtigungen', 'Dein Wochenrückblick', 'Neue Nachricht für dich']),
    'pt': (['Boas-vindas ao {s}', 'Confirme seu e-mail', 'Ative sua conta'], ['Redefina sua senha', 'Seu código de acesso é {n}', 'Novo acesso à sua conta'], ['Seu recibo do {s}', 'Seu pedido foi enviado', 'Pagamento aprovado'], ['Seu resumo da semana', 'Você tem uma nova mensagem', 'Avalie o seu pedido']),
    'it': (['Benvenuto su {s}', 'Conferma il tuo indirizzo e-mail', 'Attiva il tuo account'], ['Reimposta la password', 'Il tuo codice di verifica', 'Nuovo accesso al tuo account'], ['La tua ricevuta {s}', 'Il tuo ordine è stato spedito', 'Pagamento ricevuto'], ['Il tuo riepilogo settimanale', 'Hai un nuovo messaggio', 'Qualcuno ha commentato la tua foto']),
    'pl': (['Witaj w {s}', 'Potwierdź swój adres e-mail', 'Aktywuj konto'], ['Zresetuj hasło', 'Twój kod weryfikacyjny', 'Nowe logowanie na konto'], ['Twoja faktura {s}', 'Twoje zamówienie zostało wysłane', 'Płatność otrzymana'], ['Twoje podsumowanie tygodnia', 'Masz nową wiadomość', 'Nowy obserwujący']),
    'tr': (['{s} hesabınıza hoş geldiniz', 'E-posta adresinizi doğrulayın', 'Hesabınızı etkinleştirin'], ['Şifre sıfırlama talebiniz', 'Doğrulama kodunuz {n}', 'Hesabınıza yeni giriş'], ['{s} faturanız', 'Siparişiniz kargoya verildi', 'Ödemeniz alındı'], ['Haftalık özetiniz', 'Yeni bir mesajınız var', 'Yeni bir takipçiniz var']),
    'id': (['Selamat datang di {s}', 'Konfirmasi email kamu', 'Aktifkan akun kamu'], ['Atur ulang kata sandi', 'Kode verifikasi kamu {n}', 'Login baru ke akun kamu'], ['Tanda terima {s}', 'Pesanan kamu sedang dikirim', 'Pembayaran diterima'], ['Ringkasan mingguan kamu', 'Kamu punya pesan baru', 'Ada yang menyukai fotomu']),
    'ru': (['Добро пожаловать в {s}', 'Подтвердите адрес электронной почты', 'Активируйте аккаунт'], ['Сброс пароля', 'Ваш код подтверждения {n}', 'Вход в аккаунт с нового устройства'], ['Ваш чек от {s}', 'Ваш заказ подтверждён', 'Платёж получен'], ['Ваша неделя в цифрах', 'У вас новое сообщение', 'На вас подписались']),
    'ja': (['{s}へようこそ', 'メールアドレスの確認', 'ご登録ありがとうございます'], ['パスワードの再設定', '認証コード: {n}', '新しい端末からのログイン'], ['{s}のご利用明細', 'ご注文の確認', 'お支払いを確認しました'], ['新しいお知らせが3件あります', '今週のまとめ', 'メッセージが届いています']),
    'ko': (['{s}에 오신 것을 환영합니다', '이메일 주소를 확인해 주세요', '회원가입을 환영합니다'], ['비밀번호 재설정', '인증 코드 {n}', '새로운 기기에서 로그인되었습니다'], ['{s} 영수증', '주문하신 상품이 배송되었습니다', '결제가 완료되었습니다'], ['이번 주 요약', '새 메시지가 도착했습니다', '새로운 알림이 있습니다']),
    'zh': (['欢迎加入{s}', '请确认您的邮箱地址', '激活您的账户'], ['重置您的密码', '您的验证码是 {n}', '您的账户在新设备上登录'], ['您的{s}收据', '您的订单已发货', '付款成功'], ['您的每周总结', '您有一条新消息', '有人赞了您的照片']),
    'hi': (['{s} में आपका स्वागत है', 'अपना ईमेल सत्यापित करें', 'अपना खाता सक्रिय करें'], ['अपना पासवर्ड रीसेट करें', 'आपका OTP {n} है', 'आपके खाते में नया लॉगिन'], ['आपकी {s} रसीद', 'आपका ऑर्डर भेज दिया गया है', 'भुगतान सफल रहा'], ['आपका साप्ताहिक सारांश', 'आपको एक नया संदेश मिला है', 'किसी ने आपकी फ़ोटो पसंद की']),
    'ar': (['مرحبا بك في {s}', 'أكد عنوان بريدك الإلكتروني', 'فعّل حسابك'], ['إعادة تعيين كلمة المرور', 'رمز التحقق الخاص بك {n}', 'تسجيل دخول جديد إلى حسابك'], ['إيصالك من {s}', 'تم شحن طلبك', 'تم استلام الدفع'], ['ملخصك الأسبوعي', 'لديك رسالة جديدة', 'أعجب شخص بصورتك']),
}
# a newsletter that happens to use the words a keyword search looks for. This is where the trick breaks
LIST_TRAPS = ['Welcome to issue {n}', 'The password manager we would actually pay for', 'How to verify a photo in 30 seconds', 'Order of the day: soup', 'Account-based marketing, explained', 'The receipt that changed retail', 'Sign in with your face? Not so fast', 'Why nobody will confirm the rumour', 'Log in, log off: a week without screens', 'Payment apps are eating banks', 'Subscription fatigue is real', 'Activate your weekend with these five walks', 'Your order of operations is wrong', 'Welcome back: the best of the summer']
LIST_PLAIN = ['This week in tiny cities', 'The one chart everyone is arguing about', 'Why soup is having a moment', 'Five links worth your Sunday', 'Issue {n}: the quiet internet', 'A short history of the bicycle', 'Morning briefing: markets slide', 'Top stories for Thursday', 'The best of the week', 'Weekend reads', 'Edition #{n}', 'What we are reading', 'Breaking: the storm moves north', 'New episode: the man who mapped caves', 'Lo mejor de la semana', 'La lettre du dimanche', 'Das Wichtigste am Morgen', '今週のおすすめ記事', 'Главные новости дня', 'Noticias de hoy', '50% off everything this weekend', 'Last chance: the sale ends tonight', 'New arrivals you will love', 'Our biggest sale of the year']
# people write like people, even when they mention the same words
PERSON = ['Re: notes from thursday', 'photos from the lake', 'are you coming on sunday?', 'Fwd: recipe', 'happy birthday!!', 'quick question', 'Re: Re: the plan', 'look what I found', 'call me when you can', 'Re: invoice for March', 'Fwd: your order', 'can you confirm the time?', 'Re: my password for the wifi', 'welcome back!', 'Re: receipt for the flowers', 'meeting tomorrow', 'Lunch?', 'Re: draft 3', 'hola, cómo estás', 'à demain', 'ist das okay?', 'ありがとう', 'привет']
PEOPLE = ['Priya Nair', 'Tom Becker', 'Lena Ortiz', 'Kenji Mori', 'Amara Okafor', 'Sofia Rossi', 'Lucas Silva', 'Fatima Zahra', 'Ivan Petrov', 'Grace Lee', 'Marek Nowak', 'Aisha Khan', 'Noah Fischer', 'Mei Chen', 'Dad', 'Rosie', 'Mr Adeyemi']
# mail that says "account" but is not yours: scams and strangers
SCAM = ['Your account has been suspended', 'Verify your account now or lose access', 'URGENT: confirm your password', 'You won a prize, claim your payment', 'Invoice overdue, open immediately', 'Your mailbox is full, log in here', 'Final notice: your subscription', 'Unusual sign-in, click to secure', 'Crypto payment received: 0.5 BTC', 'Dear customer, verify your details']
SCAM_NAMES = [('Account Team', 'secure-login-update.xyz'), ('Billing Dept', 'pay-notice-center.top'), ('Support', 'mail-verify-now.click'), ('Security', 'account-alert-service.icu'), ('Prize Office', 'lucky-winner-claims.buzz'), ('Webmaster', 'inbox-quota-renew.online')]
OTHER = ['Your parcel is out for delivery', 'Parent meeting on Friday', 'The office is closed on Monday', 'Road works on your street', 'Your appointment on 3 June', 'Your exam results are available', 'Library books due', 'Annual general meeting: agenda', 'Water supply notice', 'Holiday schedule']
OTHER_NAMES = [('City Council', 'citycouncil.gov'), ('Westfield School', 'westfield.edu'), ('Main Street Dental', 'mainstreetdental.com'), ('Building Management', 'parkviewapartments.com'), ('Harbor Library', 'harborlibrary.org'), ('Community Clinic', 'communityclinic.org')]
ME = ['Sam', 'Niki', 'Alex', 'Jo', 'Maya', 'Ravi', 'Lea', 'Omar', 'Yuki', 'Ana']
NEWS = ['Daily Brief', 'The Weekly', 'Morning Note', 'Sunday Letter', 'The Digest', 'Field Notes', 'Late Edition', 'The Roundup', 'Tiny Dispatch', 'The Long Read', 'Signal', 'Second Coffee', 'Paper Trail', 'Open Tabs', 'The Margin', 'Slow News', 'Good Bones', 'Monday Map']


def services():
    """Real names, from the public lists. One per domain."""
    seen, out, frozen = set(), [], {r[2] for r in FROZEN}
    rows = [(b['name'], b['domain']) for b in json.loads((DATA / 'breaches.json').read_text('utf-8'))] + [(s.get('name') or '', s['domain']) for s in json.loads((DATA / 'sites.json').read_text('utf-8'))]
    for name, domain in rows:
        d = '.'.join(domain.lower().split('.')[-2:])
        name = re.sub(r'\s*\(.*', '', name).strip()
        if name and d and d not in seen and d not in frozen and 2 < len(name) < 28:
            seen.add(d)
            out.append((name, d))
    return out


def fill(t, s, me, rnd):
    return t.format(s=s, me=me, n=rnd.randint(1000, 999999))


def dates(rnd, n):
    start = rnd.randint(2009, 2024)
    return sorted(f'{start + rnd.randint(0, 4)}-{rnd.randint(1, 12):02d}-{rnd.randint(1, 28):02d}' for _ in range(n))


def to_card(name, domain, subjects, rnd, count=None):
    subjects = list(dict.fromkeys(subjects))[:8]
    days = dates(rnd, len(subjects))
    return {'key': domain, 'domain': domain, 'name': name, 'count': count or len(subjects) + rnd.randint(0, 120), 'first': days[0], 'last': days[-1], 'list_share': 0, 'personal': False,
            'subjects': [{'date': d, 'text': s} for d, s in zip(days, subjects)], 'money': None}


def account(service, rnd):
    name, domain = service
    me = rnd.choice(ME)
    signup, security, money, quiet = (SIGNUP, SECURITY, MONEY, QUIET) if rnd.random() < .65 else ABROAD[rnd.choice(list(ABROAD))]
    filler = FILLER if signup is SIGNUP else []
    style = rnd.random()
    if style < .35:  # the plain case
        picks = rnd.sample(signup, 1) + rnd.sample(security, rnd.randint(0, 2)) + rnd.sample(money, rnd.randint(0, 2)) + rnd.sample(filler + quiet, rnd.randint(0, 3))
    elif style < .65:  # the signup is long gone: only security, money or activity is left
        picks = rnd.sample(security + money, rnd.randint(1, 2)) + rnd.sample(filler + quiet, rnd.randint(1, 3))
    else:  # no keyword anywhere: the mail only makes sense if you have an account
        picks = rnd.sample(quiet, rnd.randint(2, 3)) + rnd.sample(filler, min(len(filler), rnd.randint(0, 1)))
    rnd.shuffle(picks)
    return to_card(name if rnd.random() < .8 else f'no-reply@{domain}', domain, [fill(p, name, me, rnd) for p in picks], rnd), {'kind': 'account', 'service': name}


def listing(service, rnd):
    name, domain = service
    trap = rnd.random() < .5
    picks = rnd.sample(LIST_PLAIN, rnd.randint(2, 7)) + (rnd.sample(LIST_TRAPS, rnd.randint(1, 2)) if trap else [])
    rnd.shuffle(picks)
    return to_card(name, domain, [fill(p, name, '', rnd) for p in picks], rnd), {'kind': 'list', 'service': name}


def person(rnd):
    who = rnd.choice(PEOPLE)
    domain = rnd.choice(['lenaortiz.studio', 'plainbakery.co', 'fischer-law.de', 'northwind.io', 'mori-design.jp', 'okafor.dev', 'rossi-arch.it', 'silvaconsult.com.br'])
    return to_card(who, domain, rnd.sample(PERSON, rnd.randint(1, 6)), rnd, count=rnd.randint(1, 60)), {'kind': 'person', 'service': who}


def other(rnd):
    if rnd.random() < .5:
        name, domain = rnd.choice(SCAM_NAMES)
        return to_card(name, domain, rnd.sample(SCAM, rnd.randint(1, 3)), rnd, count=rnd.randint(1, 4)), {'kind': 'other', 'service': name}
    name, domain = rnd.choice(OTHER_NAMES)
    return to_card(name, domain, rnd.sample(OTHER, rnd.randint(1, 4)), rnd), {'kind': 'other', 'service': name}


def example(rnd, pool, news_pool):
    r = rnd.random()
    if r < .5:
        return account(rnd.choice(pool), rnd)
    if r < .75:
        name, domain = rnd.choice(news_pool)
        return listing((name, domain), rnd)
    return person(rnd) if r < .88 else other(rnd)


def row(card, answer):
    return {'system': INSTRUCTIONS, 'user': card_text(card), 'answer': json.dumps(answer, ensure_ascii=False, separators=(',', ':')), 'card': card, 'truth': answer}


def build(train=2000, heldout=300, seed=2026):
    rnd = random.Random(seed)
    all_services = services()
    rnd.shuffle(all_services)
    cut = len(all_services) // 5
    held, rest = all_services[:cut], all_services[cut:]  # split by name first, so the test never meets a name from training
    newsy = lambda part: [(f'{a} {b}' if rnd.random() < .5 else n, d) for (n, d), a, b in zip(part, (rnd.choice(NEWS) for _ in part), (rnd.choice(['Weekly', 'Daily', 'Letter', 'Notes']) for _ in part))]
    runs = HERE / 'runs'
    runs.mkdir(exist_ok=True)
    for name, n, pool in (('train', train, rest), ('heldout', heldout, held)):
        news = newsy(pool[:len(pool) // 3])
        with open(runs / f'{name}.jsonl', 'w', encoding='utf-8') as f:
            for _ in range(n):
                f.write(json.dumps(row(*example(rnd, pool, news)), ensure_ascii=False) + '\n')
    return len(all_services), len(rest), len(held)


if __name__ == '__main__':
    print(build())
    for line in list(open(HERE / 'runs' / 'train.jsonl', encoding='utf-8'))[:4]:
        r = json.loads(line)
        print(r['user'], '\n=>', r['answer'], '\n')
