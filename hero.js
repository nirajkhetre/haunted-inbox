'use strict';
// The way in. The page says plainly what this is and shows a real report. The mailbox is the one piece of theatre, and it earns its place when you press the button.
const Hero = { gone: false, nextPeek: 9000, nextBlink: 2400 };

// a real report from the sample, because showing the thing beats describing it
async function heroPreview() {
  let r; try { r = await (await fetch('sample.json')).json(); } catch { return; }
  if (Hero.gone) return;
  const G = r.ghosts, top = [...G].sort((a, b) => b.score - a.score).slice(0, S.H < 760 ? 3 : 4);
  const count = f => G.filter(f).length, what = x => `joined ${(x.joined || '').slice(0, 4)}, ${x.domain}`;
  $('#preview').innerHTML = `<header><b>Sample report</b><span>${G.length} accounts in ${r.envelopes.toLocaleString('en-US')} emails</span></header>
<div class="pvtiles"><div><b>${count(MATCH.hacked)}</b>Hacked after joining</div><div><b>${count(MATCH.card)}</b>May have your card</div><div><b>${count(MATCH.quiet)}</b>Silent 3+ years</div></div>
${top.map((x, k) => `<div class="pvrow"><span class="no">${String(k + 1).padStart(2, '0')}</span><span><b>${esc(x.service)}</b><small>${esc(what(x))}</small></span><span class="flags">${stamps(x).split('</i>').slice(0, 2).join('</i>')}</i></span></div>`).join('')}`;
  fitMailbox();
  if (!calm()) $$('#preview>*').forEach((el, k) => el.animate([{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 220 + k * 60, easing: 'cubic-bezier(.2,1,.3,1)', fill: 'backwards' }));
}

// the mailbox stands in whatever room the report page leaves, so the two never overlap on any screen
function fitMailbox() {
  const box = $('#mailbox'); if (Hero.gone || getComputedStyle(box).display === 'none') return;
  const free = $('#heroWrap').getBoundingClientRect().bottom - $('#preview').getBoundingClientRect().bottom - 10;
  box.style.height = clamp(free, 170, 500) + 'px';
}
addEventListener('resize', fitMailbox);

function heroEyes(now) {
  const box = $('#mailbox'); if (box.clientHeight === 0) return;
  const m = S.mouse, b = box.getBoundingClientRect(), dx = clamp((m.x - b.left - b.width / 2) / 420, -1, 1), dy = clamp((m.y - b.top - b.height * .3) / 380, -1, 1), wide = Hero.wide ? 1.16 : 1;
  $('#mbEyes').setAttribute('transform', `translate(${dx * 34} ${dy * 12})`);
  for (const r of $$('#mbEyes rect')) { r.style.transformBox = 'fill-box'; r.style.transformOrigin = 'center'; if (!Hero.blinking) r.style.transform = `scale(${wide})`; }
  if (now > Hero.nextBlink && !calm()) { Hero.nextBlink = now + 2600 + Math.random() * 3800; Hero.blinking = true; const a = $$('#mbEyes rect').map(r => r.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1,.06)', offset: .5 }, { transform: 'scale(1,1)' }], { duration: 190 })); a[0].onfinish = () => { Hero.blinking = false; }; }
  if (now > Hero.nextPeek && !calm()) { Hero.nextPeek = now + 16000 + Math.random() * 12000; $('#mbGhost').animate([{ transform: 'none' }, { transform: 'translateY(-172px) rotate(-3deg)', offset: .22 }, { transform: 'translateY(-160px) rotate(3deg)', offset: .78 }, { transform: 'none' }], { duration: 2300, easing: 'cubic-bezier(.3,1.3,.5,1)' }); }
}

function slotCentre() { const s = $('#mbSlot').getBoundingClientRect(); return [s.left + s.width / 2, s.top + s.height / 2]; }
function gulp() {
  const body = $('#mbBody'); body.style.transformBox = 'fill-box'; body.style.transformOrigin = '50% 100%';
  body.animate([{ transform: 'none' }, { transform: 'scale(1.1,.84)', offset: .28 }, { transform: 'scale(.92,1.12)', offset: .6 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.3,1.3,.5,1)' });
  $('#mbLid').animate([{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: 0 }], { duration: 300 });
  Snd.play('gulp'); Snd.play('clank'); $('#mbFlag').classList.add('up'); Snd.play('flag');
}

// the one big moment: your letter goes in, and you follow it through the slot
async function enter(withLetter) {
  if (Hero.gone) return; Hero.gone = true;
  $('#gate').scrollTop = 0;
  const box = $('#mailbox'), visible = box.clientHeight > 0, quick = calm() || !visible;
  document.body.classList.add('leaving');
  if (quick) { $('#gate').hidden = true; document.body.classList.remove('at-gate', 'leaving'); S.iris = 0; return; }
  if (withLetter) {
    const src = $('#walk .letter'), from = src.getBoundingClientRect(), fly = src.cloneNode(true), [cx, cy] = slotCentre();
    fly.className = 'flying'; fly.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`; document.body.appendChild(fly); $('#walk').classList.add('sent');
    const dx = cx - from.left - from.width / 2, dy = cy - from.top - from.height / 2; Hero.wide = true;
    Snd.play('paper', .7);
    await fly.animate([{ transform: 'none' }, { transform: `translate(${dx * .5}px,${dy * .55 - 130}px) rotate(14deg) scale(1.2)`, offset: .5 }, { transform: `translate(${dx * .93}px,${dy}px) rotate(-5deg) scale(.8)`, offset: .86 }, { transform: `translate(${dx}px,${dy}px) scale(.1,.55)` }], { duration: 760, easing: 'cubic-bezier(.45,.05,.5,1)', fill: 'forwards' }).finished;
    fly.remove();
  }
  gulp();
  await wait(260);
  $$('#pitch>*,#preview,#topnav,#fence').forEach((el, k) => el.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${S.H * .7}px)`, opacity: 0 }], { duration: 560, delay: k * 34, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }));
  await wait(300);
  for (const r of $$('#mbEyes rect')) r.animate([{ transform: 'scale(1)' }, { transform: 'scale(1,.02)' }], { duration: 170, fill: 'forwards' });
  Snd.play('creak', .8, .14);
  const b = box.getBoundingClientRect(), s = $('#mbSlot').getBoundingClientRect(), cx = s.left + s.width / 2, cy = s.top + s.height / 2, k = Math.max(S.W / s.width, S.H / s.height) * 2.6;
  box.style.transformOrigin = `${cx - b.left}px ${cy - b.top}px`;
  await box.animate([{ transform: 'none' }, { transform: `translate(${(S.W / 2 - cx) * .3}px,${(S.H / 2 - cy) * .3}px) scale(1.14)`, offset: .3 }, { transform: `translate(${S.W / 2 - cx}px,${S.H / 2 - cy}px) scale(${k})` }], { duration: 900, easing: 'cubic-bezier(.6,0,.85,.25)', fill: 'forwards' }).finished;
  $('#gate').hidden = true; document.body.classList.remove('at-gate', 'leaving');
  S.iris = 0;
  Snd.play('strike', .1);
}
