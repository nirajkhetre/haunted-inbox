'use strict';
// ---------- which ghosts, and how close to morning ----------
const MATCH = { all: () => true, hacked: x => x.breaches.length > 0, card: x => !!x.money, quiet: x => (x.silent_years || 0) >= 3 };
const FILTERS = [['all', 'All'], ['hacked', 'Hacked'], ['card', 'May have your card'], ['quiet', 'Silent 3+ years']];
const inView = x => MATCH[S.filter](x) && (x.silent_years || 0) >= (S.set.quietOnly || 0);
const open = () => S.ghosts.filter(x => x.state === 'ghost' || !x.state);
const nextGhost = () => open().filter(inView).sort((a, b) => b.score - a.score)[0];
S.kxOffset = () => (S.W <= 760 ? S.W * .5 : S.W * .42);

function applySky() {
  const m = S.set.theme, rest = S.ghosts.length - open().length;
  S.dawnT = m === 'night' ? 0 : m === 'day' ? 1 : m === 'device' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 0 : 1) : S.ghosts.length ? rest / S.ghosts.length : 0;
  if (QS.has('dawn')) S.dawnT = +QS.get('dawn');
}
function tally(bump) {
  const o = open(), total = S.ghosts.length, rest = total - o.length;
  $('#filters').innerHTML = FILTERS.map(([k, label]) => `<button class="f${S.filter === k ? ' on' : ''}" data-f="${k}" aria-pressed="${S.filter === k}">${label}<b>${o.filter(MATCH[k]).length}</b></button>`).join('');
  const t = total ? rest / total : 0, u = 1 - t, sun = $('#sun');
  sun.setAttribute('cx', (u * u * 4 + 2 * u * t * 50 + t * t * 96).toFixed(1)); sun.setAttribute('cy', (u * u * 30 + 2 * u * t * -14 + t * t * 30).toFixed(1));
  $('#arc2').style.strokeDashoffset = (1 - t).toFixed(3);
  $('#meterText').innerHTML = `<b>${rest}</b> of ${total} dealt with`;
  renderRows();
  if (bump) { $('#meter').classList.remove('bump'); void $('#meter').offsetWidth; $('#meter').classList.add('bump'); }
  applySky();
}
function applyFilter(move = true) {
  let k = 0;
  for (const x of S.ghosts) if (x.el) { const on = inView(x); if (x.hid === !on) continue; x.hid = !on; x.el.style.setProperty('--wait', (k++ % 11) * 24 + 'ms'); x.el.classList.toggle('hid', !on); }
  const first = nextGhost(); if (move && first) walkTo(first.x - S.kxOffset());
  if (k) Snd.play('grind', .4);
  buildRuler(); guide(); renderRows();
}
$('#filters').addEventListener('click', e => { const b = e.target.closest('.f'); if (!b) return; S.filter = b.dataset.f; closeCard(); tally(); applyFilter(); });

// ---------- the keeper tells you what to do next, at every moment ----------
function why(x) {
  const b = x.breaches[0];
  if (b) return `was hacked in ${b.date.slice(0, 4)}${x.leaked.includes('Passwords') ? ', passwords included' : ''}${x.money ? ', and it may still have your card' : ''}`;
  if (x.money) return 'may still have your card';
  return x.silent_years >= 1 ? `has been silent for ${x.silent_years} years` : 'is still writing to you';
}
let sayT = 0;
function guide() {
  const g = $('#guide'), go = $('#guideGo'); clearTimeout(sayT);
  if (S.stage !== 'walk' || S.touring || S.view !== 'grave' || S.inBeats) { g.hidden = true; return; }
  g.hidden = false;
  if (S.sel) { g.classList.add('quietly'); $('#guideText').textContent = 'Read the details, then do the two steps.'; go.hidden = true; return; }
  g.classList.remove('quietly');
  const n = nextGhost();
  if (!n) { $('#guideText').textContent = open().length ? 'Nothing here matches that. Try another group up top.' : 'That was the last one. Morning.'; go.hidden = true; return; }
  const rest = S.ghosts.length - open().length;
  $('#guideText').innerHTML = `${rest ? 'Next' : 'Start'} with <b>${esc(n.service)}</b>. It ${esc(why(n))}.`;
  go.hidden = false; go.textContent = 'Show me'; go.onclick = () => { Snd.wake(); takeTo(n); };
}
function say(text, ms = 3200) { const g = $('#guide'); if (S.stage !== 'walk' || S.touring || S.view !== 'grave') return; g.hidden = false; g.classList.remove('quietly'); $('#guideText').textContent = text; $('#guideGo').hidden = true; clearTimeout(sayT); sayT = setTimeout(guide, ms); }
async function takeTo(x) { walkTo(x.x - (S.W <= 760 ? S.W * .5 : S.W * .34)); await wait(calm() ? 10 : 720); if (S.stage === 'walk') openCard(x); }

// ---------- the card: the stone itself lifts out of the ground and opens ----------
const DIFF = { easy: 'easy to leave', medium: 'takes a few steps', hard: 'hard to leave', limited: 'only partly possible', impossible: 'they will not let you' };
const lastWords = x => (x.silent_years || 0) >= 1 ? x.last_words?.text : null;
function cardHTML(x) {
  const leak = x.breaches.map(b => `<div class="note hack"><h4>Hacked after you joined</h4><b>${esc(b.name)}, ${fmtMonth(b.date)}</b>, ${(b.count || 0).toLocaleString('en-US')} accounts.<div class="leaks">${b.data.slice(0, 8).map(d => `<span${/password|credit|bank|phone/i.test(d) ? ' class="bad"' : ''}>${esc(d)}</span>`).join('')}</div><small>From the public <a href="${safe(b.url)}" target="_blank" rel="noopener">Have I Been Pwned</a> list. It doesn't prove your own data was in it.</small></div>`).join('');
  const u = x.lookup || {}, url = x.leave?.url || u.delete?.url;
  const fate = u.fate ? `<div class="note fate"><h4>${u.fate.fate === 'acquired' ? `Sold${u.fate.by ? ` to ${esc(u.fate.by)}` : ' to another company'}` : 'The company shut down'}</h4><q>${esc(u.fate.quote)}</q><small><a href="${safe(u.fate.url)}" target="_blank" rel="noopener">${esc(u.fate.source)}</a>. Found by web search, so check it. Where did your data go?</small></div>` : '';
  const silent = x.silent_years == null ? '' : x.silent_years < 1 ? 'still writing to you' : `silent for ${x.silent_years} years`, canAsk = (S.web && S.set.web || S.sample) && !x.lookup && url;
  return `<p class="lies">${S.view === 'grave' ? 'here lies your account at' : 'Your account at'} ${esc(x.domain)}</p><h2 class="gname">${esc(x.service)}</h2>
<div class="fields"><div><span>Joined</span><b>${fmtDay(x.joined)}</b></div><div><span>Last heard from</span><b>${fmtMonth(x.last_heard)}</b></div><div><span>Emails</span><b>${x.emails}</b></div><div><span>Status</span><b>${esc(silent ? silent[0].toUpperCase() + silent.slice(1) : 'Unknown')}</b></div></div>
<div class="stamps">${stamps(x)}</div>
${lastWords(x) ? `<p class="words"><small>${S.view === 'grave' ? 'its last words to you' : 'the last message it sent you'}</small><q>${esc(lastWords(x))}</q></p>` : ''}
${leak}${fate}
${x.money ? `<div class="note card2"><h4>May still have your card</h4><q>${esc(x.money.text)}</q> <small>${fmtDay(x.money.date)}</small></div>` : ''}
${canAsk ? '<button class="sticker" id="ask">Who owns this company now?</button>' : ''}
<div class="note"><h4>${x.confident ? 'How we know you signed up' : 'The first thing they sent you (we are less sure about this one)'}</h4><q>${esc(x.proof.text)}</q> <small>${fmtDay(x.proof.date)}</small></div>
${x.leave?.notes ? `<div class="note"><h4>How to leave</h4>${esc(x.leave.notes.slice(0, 280))}</div>` : ''}
${u.delete && !x.leave ? `<div class="note"><h4>Found on their own site</h4>${esc(u.delete.title)}</div>` : ''}
<div id="asked"></div>`;
}
function actionsHTML(x) {
  const url = x.leave?.url || x.lookup?.delete?.url, diff = x.leave?.difficulty, webOn = (S.web && S.set.web) || S.sample;
  const first = url ? `<a class="stone go" href="${safe(url)}" target="_blank" rel="noopener">Close the account<small>${esc(x.domain)}${diff ? `, ${esc(DIFF[diff] || diff)}` : ''}</small></a>`
    : webOn && !x.lookup ? `<button class="stone go" id="ask2">Find the way out<small>Looks for their delete page</small></button>`
    : `<a class="stone go" href="https://duckduckgo.com/?q=${encodeURIComponent(`how to delete ${x.service} account`)}" target="_blank" rel="noopener">Search for the way out<small>Opens a web search for this company</small></a>`;
  return `<ol class="path"><li><i>1</i>${first}</li><li><i>2</i><button class="stone hold" id="hold"><i class="fill"></i><span>${needHold() ? 'Hold once it\'s closed' : 'Mark as closed'}</span></button></li></ol><button class="keepit" id="keep">I still use this one</button>`;
}
const needHold = () => S.set.hold && S.view === 'grave';
function fillCard(x) {
  const c = $('#card');
  $('#cardbody').innerHTML = cardHTML(x); $('#cardbody').scrollTop = 0;
  let acts = c.querySelector('.acts'); if (!acts) { acts = document.createElement('div'); acts.className = 'acts'; c.appendChild(acts); }
  acts.innerHTML = actionsHTML(x);
  wireHold(x);
  $('#keep').onclick = () => keep(x);
  for (const id of ['#ask', '#ask2']) { const b = $(id); if (b) b.onclick = () => askWeb(x, b); }
}
function openCard(x) {
  if (S.sel) S.sel.el?.classList.remove('sel');
  const wasOpen = !!S.sel, c = $('#card');
  S.sel = x; x.el.classList.add('sel'); document.body.classList.add('focus');
  walkTo(x.x - (S.W <= 760 ? S.W * .5 : S.W * .34));
  c.hidden = false; c.classList.remove('out'); fillCard(x); guide();
  Snd.play('hoo', seed(x.key), .6, .16);
  if (calm()) return;
  const a = x.el.querySelector('.st').getBoundingClientRect(), b = c.getBoundingClientRect();
  if (!wasOpen) { if (S.view === 'grave' && a.width) c.animate([{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scale(${a.width / b.width},${a.height / b.height})`, offset: 0 }, { transform: 'translate(0,-8px) scale(1.012)', offset: .78 }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.22,.9,.3,1)' }); else c.animate([{ transform: 'translateX(112%) rotate(3deg)' }, { transform: 'translateX(-10px) rotate(-.4deg)', offset: .72 }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1)' }); }
  $$('#cardbody>*').slice(0, 7).forEach((el, k) => el.animate([{ transform: 'translateY(16px) scale(.97)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, delay: (wasOpen ? 40 : 240) + k * 34, easing: 'cubic-bezier(.2,1,.3,1)', fill: 'backwards' }));
  c.querySelector('.acts').animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 420, delay: wasOpen ? 0 : 300, easing: 'cubic-bezier(.2,1.2,.3,1)', fill: 'backwards' });
}
function closeCard() {
  const c = $('#card'); if (c.hidden) return;
  const x = S.sel; document.body.classList.remove('focus'); x?.el?.classList.remove('sel'); S.sel = null; guide();
  const stone = x?.el?.querySelector('.st'), hidden = !stone || x.state === 'gone' || calm() || !stone.getBoundingClientRect().width;
  if (hidden) { c.hidden = true; return; }
  const a = stone.getBoundingClientRect(), b = c.getBoundingClientRect();
  c.animate([{ transform: 'none' }, { transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scale(${a.width / b.width},${a.height / b.height})` }], { duration: 300, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }).onfinish = e => { c.hidden = true; e.target.cancel(); };
}
$('#cardx').onclick = closeCard;
async function askWeb(x, b) {
  b.disabled = true; b.innerHTML = '<span class="thinking"><i></i><i></i><i></i></span>';
  try {
    x.lookup = S.sample ? (x.lookup_saved || { none: true }) : await post('/api/lookup', { key: x.key });
    if (S.sel === x) { fillCard(x); Snd.play('tine', 74, .16); }
    if (!x.lookup.fate && !x.lookup.delete) { const a = $('#asked'); if (a) a.innerHTML = '<div class="note">The web had nothing clear to say about this one, so we say nothing.</div>'; }
  } catch { b.textContent = "Couldn't reach the web"; }
}

// ---------- laying to rest: hold to light the candles, let go of it for good ----------
function wireHold(x) {
  const b = $('#hold'), fill = b.querySelector('.fill'), sd = seed(x.key); let anim = null, candles = [], stopHum = () => {};
  if (!needHold()) { b.onclick = () => { lightCandles(); banish(x, candles); }; }
  function lightCandles() { candles = [-46, -24, 24, 46, 0].map((dx, k) => { const c = document.createElement('i'); c.className = 'candle'; c.style.cssText = `left:${dx}px;--i:${k};bottom:${k === 4 ? -26 : -14}px`; x.el.appendChild(c); setTimeout(() => { if (c.isConnected && anim) Snd.play('strike', .06); }, k * 70); return c; }); }
  const start = e => {
    e.preventDefault(); if (anim || !needHold()) return; b.setPointerCapture?.(e.pointerId); lightCandles(); stopHum = Snd.play('hold', sd);
    x.el.querySelector('.gh svg').animate([{ transform: 'none' }, { transform: 'scale(1.12,.84) translateY(6px)' }], { duration: 900, easing: 'ease-in', fill: 'forwards' });
    anim = fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: calm() ? 60 : 900, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'forwards' });
    anim.onfinish = () => { anim = null; banish(x, candles); };
  };
  const stop = () => { if (!anim) return; anim.cancel(); anim = null; stopHum(); candles.forEach(c => c.remove()); candles = []; x.el.querySelector('.gh svg').getAnimations().forEach(a => a.cancel()); };
  b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && needHold()) { e.preventDefault(); start(e); } });
  b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
}
async function banish(x, candles) {
  if (S.view === 'report' && !calm()) { const c = $('#card'), st = document.createElement('div'); st.className = 'bigstamp'; st.textContent = 'Closed'; c.appendChild(st); await st.animate([{ transform: 'translate(-50%,-50%) rotate(-11deg) scale(2.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(-11deg) scale(.96)', opacity: 1, offset: .75 }, { transform: 'translate(-50%,-50%) rotate(-11deg) scale(1)', opacity: 1 }], { duration: 190, easing: 'cubic-bezier(.5,0,.9,.6)' }).finished; Snd.play('thump', .3); c.animate([{ transform: 'none' }, { transform: 'translate(2px,3px) rotate(.3deg)' }, { transform: 'none' }], { duration: 170 }); await wait(520); st.remove(); }
  closeCard(); $('#card').hidden = true;
  const gh = x.el.querySelector('.gh'), st = x.el.querySelector('.st'), nm = x.el.querySelector('.nm'), svg = gh.querySelector('svg'), sd = seed(x.key);
  gh.style.animation = 'none'; svg.getAnimations().forEach(a => a.cancel()); nm.style.opacity = 0;
  const steps = 14, path = Array.from({ length: steps + 1 }, (_, k) => { const t = k / steps; return { transform: `translate(${Math.sin(t * 9) * 56 * (1 - t * .3)}px,${-t * t * 620}px) rotate(${t * 540}deg) scale(${1 - t * .82},${1 + Math.sin(t * 9) * .12 - t * .82})`, opacity: t > .86 ? (1 - t) * 7 : 1 }; });
  svg.animate([{ transform: 'scale(1.18,.72) translateY(10px)' }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
  await wait(150);
  Snd.play('sigh', sd);
  const fly = gh.animate(path, { duration: calm() ? 60 : 1050, easing: 'cubic-bezier(.45,.02,.9,.55)', fill: 'forwards' });
  const trail = setInterval(() => { const b = gh.getBoundingClientRect(); burst(b.left + b.width / 2 + S.cam, b.top + b.height * .7, 3, { c: ['#FFF8EC', '#BDAEEA', '#FF7DB6'], g: -30, v: 44, r: 6, life: .75, spread: 6.3 }); }, 40);
  await wait(760);
  clearInterval(trail);
  burst(x.x, x.y - 310, 34, { c: ['#FFC83D', '#FFF8EC', '#FF7DB6', '#7CF2B6'], v: 320, g: 300, r: 7, life: 1.2, spread: 6.3, ink: true });
  Snd.play('settle', S.ghosts.length - open().length, S.dawn);
  candles.forEach((c, k) => { c.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(16px) scale(.4)', opacity: 0 }], { duration: 300, delay: k * 40, fill: 'forwards' }); });
  Snd.play('grind');
  st.animate([{ transform: 'none' }, { transform: 'translateX(-3px) rotate(-2deg)' }, { transform: 'translateX(3px) rotate(2deg)' }, { transform: 'translateX(-2px) rotate(-1deg)' }, { transform: 'translateY(112px) rotate(5deg)' }], { duration: 620, easing: 'ease-in', fill: 'forwards' });
  await wait(380);
  burst(x.x, x.y, 26, { c: ['#6B5A92', '#8D80B8', '#2D1A44'], a: -Math.PI / 2, spread: 2.4, v: 170, g: 420, r: 7, life: .7 });
  Snd.play('thump');
  await wait(250);
  fly.cancel(); candles.forEach(c => c.remove());
  x.state = 'gone'; x.el.classList.add('gone'); x.el.insertAdjacentHTML('beforeend', FLOWERS);
  x.eyes = null;
  saveState(x); tally(true); buildRuler(); renderRows();
  const left = open().length;
  showUndo(x);
  if (!left) return peace();
  guide();
  const n = nextGhost();
  $('#guideText').innerHTML = `Done. The sky is a little lighter. ${n ? `Next: <b>${esc(n.service)}</b>.` : ''}`;
}
async function keep(x) {
  closeCard();
  const svg = x.el.querySelector('.gh svg');
  svg.animate([{ transform: 'none' }, { transform: 'scale(1.1,.86)' }, { transform: 'translateY(-26px) scale(.92,1.1)' }, { transform: 'none' }], { duration: 520, easing: 'ease-out' });
  Snd.play('tine', 78, .2);
  await wait(420);
  x.state = 'alive'; x.el.classList.add('alive');
  burst(x.x, x.y - 110, 14, { c: ['#FFC83D', '#FFF3B0'], v: 110, g: 40, r: 4, life: .8, spread: 6.3 });
  Snd.play('tine', 81, .16);
  saveState(x); tally(true); buildRuler(); renderRows();
  showUndo(x);
  if (!open().length) return peace();
  guide();
  $('#guideText').textContent = `${x.service} stays.`;
}
function saveState(x) { if (S.local && !S.sample) post('/api/state', { key: x.key, state: x.state }).catch(() => {}); }
async function peace() {
  if (S.set.theme === 'auto') S.dawnT = 1;
  Snd.play('morning');
  if (S.view === 'grave') await beat('<em>Morning.</em> Your graveyard is at peace.', 3200);
  say('You have dealt with everything here. Run it again in a year to catch anything new.', 8000);
}

// ghosts answer when you come close, each in its own voice
{
  let last = null;
  $('#world').addEventListener('pointerover', e => { const el = e.target.closest('.g'); if (!el || el === last || S.stage !== 'walk') return; last = el; if (!el.classList.contains('gone')) Snd.play('hoo', seed(el.dataset.k), .55, .07); });
}
