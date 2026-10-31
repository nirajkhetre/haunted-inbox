'use strict';
// The way in: a haunted mailbox. You post a letter, it swallows it, and the camera falls through its slot into your graveyard.
const Hero = { gone: false, stones: [], tagAt: 0, nextMail: 3000, nextPeek: 5200, nextBlink: 2400 };

function splitHeadline() {
  let i = 0;
  for (const el of [$('#l1'), $('#l2')]) {
    el.innerHTML = el.textContent.split(' ').map(w => {
      const face = /^you/i.test(w);
      return `<span class="word">${[...w].map(c => `<span class="c${face && c === 'o' ? ' face' : ''}" style="--i:${i++}">${esc(c)}${face && c === 'o' ? '<i class="oe"></i><i class="oe r"></i>' : ''}</span>`).join('')}</span>`;
    }).join(' ');
  }
}

function heroTag(x) {
  const b = x.breaches[0], sold = x.lookup?.fate;
  if (b) return `${x.service}: hacked ${b.date.slice(0, 4)}`;
  if (sold?.fate === 'acquired' && sold.by) return `${x.service}: sold to ${sold.by}`;
  if (x.money) return `${x.service}: may have your card`;
  return `${x.service}: silent ${Math.floor(x.silent_years || 0)} years`;
}

// real stones from the sample stand on the hill, so the first thing you see is what this does
async function heroStones() {
  let r; try { r = await (await fetch('sample.json')).json(); } catch { return; }
  if (Hero.gone) return;
  const want = S.W <= 760 ? ['Tumblr', 'Neopets'] : ['Neopets', 'Tumblr', 'Evernote', 'Chegg', 'LinkedIn'], spots = S.W <= 760 ? [.17, .47] : [.07, .2, .33, .46, .585], box = $('#heroStones');
  want.forEach((name, k) => {
    const x = r.ghosts.find(g => g.service === name); if (!x) return;
    const h = { ...x, state: 'ghost' }, el = makeGrave(h, true); el.tabIndex = -1;
    const px = S.W * spots[k], row = k % 2, s = clamp(S.H / 860, .72, 1.08) * (row ? 1.02 : .86);
    el.style.left = px + 'px'; el.style.top = S.H * (S.W <= 760 ? .9 : .86) - (row ? 0 : 42) + 'px'; el.style.setProperty('--s', s); el.style.zIndex = 2 + row;
    el.querySelector('.nm').textContent = heroTag(h); box.appendChild(el); Hero.stones.push(h);
  });
}

function heroEyes(now) {
  const m = S.mouse, box = $('#mailbox').getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height * .3;
  const dx = clamp((m.x - cx) / 420, -1, 1), dy = clamp((m.y - cy) / 380, -1, 1), wide = Hero.wide ? 1.16 : 1;
  $('#mbEyes').setAttribute('transform', `translate(${dx * 34} ${dy * 12})`);
  for (const r of $$('#mbEyes rect')) { r.style.transformBox = 'fill-box'; r.style.transformOrigin = 'center'; if (!Hero.blinking) r.style.transform = `scale(${wide})`; }
  for (const f of $$('.c.face')) { const b = f.getBoundingClientRect(), x = clamp((m.x - b.left - b.width / 2) / 500, -1, 1), y = clamp((m.y - b.top - b.height / 2) / 400, -1, 1); f.style.setProperty('--ex', (x * .02).toFixed(3) + 'em'); f.style.setProperty('--ey', (y * .016).toFixed(3) + 'em'); }
  for (const h of Hero.stones) { if (h.eyes) { const r = h.el.getBoundingClientRect(), ex = m.x - r.left, ey = m.y - r.top + 100, l = Math.hypot(ex, ey) || 1; h.eyes.style.transform = `translate(${(ex / l * 3.5).toFixed(1)}px,${(ey / l * 2.5).toFixed(1)}px)`; } }
  if (now > Hero.nextBlink && !calm()) { Hero.nextBlink = now + 2200 + Math.random() * 3400; Hero.blinking = true; const a = $$('#mbEyes rect').map(r => r.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1,.06)', offset: .5 }, { transform: 'scale(1,1)' }], { duration: 190 })); a[0].onfinish = () => { Hero.blinking = false; }; }
  if (now > Hero.tagAt && Hero.stones.length) { Hero.tagAt = now + 2600; Hero.stones.forEach((h, k) => h.el.classList.toggle('near', k === Hero.tag)); Hero.tag = ((Hero.tag ?? -1) + 1) % Hero.stones.length; }
  if (now > Hero.nextMail && !calm()) { Hero.nextMail = now + 5200 + Math.random() * 2600; idleMail(); }
  if (now > Hero.nextPeek && !calm()) { Hero.nextPeek = now + 7000 + Math.random() * 5000; $('#mbGhost').animate([{ transform: 'none' }, { transform: 'translateY(-172px) rotate(-3deg)', offset: .22 }, { transform: 'translateY(-160px) rotate(3deg)', offset: .78 }, { transform: 'none' }], { duration: 2300, easing: 'cubic-bezier(.3,1.3,.5,1)' }); }
}

const ENVELOPE = '<svg viewBox="0 0 60 42"><rect x="2" y="2" width="56" height="38" rx="5" fill="#FFF8EC" stroke="#160C2E" stroke-width="3.5"/><path d="M4 5l26 20L56 5" fill="none" stroke="#160C2E" stroke-width="3.5" stroke-linejoin="round"/><circle cx="30" cy="25" r="5" fill="#FF4F9A" stroke="#160C2E" stroke-width="2"/></svg>';
function slotCentre() { const s = $('#mbSlot').getBoundingClientRect(); return [s.left + s.width / 2, s.top + s.height / 2]; }
// the mailbox never stops being fed: old letters drift in from nowhere, as they do
function idleMail() {
  if (Hero.gone || document.hidden) return;
  const [cx, cy] = slotCentre(), m = document.createElement('i'); m.className = 'mail'; m.innerHTML = ENVELOPE; const sx = S.W + 60, sy = cy - 180 + Math.random() * 220; m.style.left = sx + 'px'; m.style.top = sy + 'px'; $('#gate').appendChild(m);
  const dx = cx - sx - 26, dy = cy - sy - 18;
  m.animate([{ transform: 'none' }, { transform: `translate(${dx * .42}px,${dy * .2 - 70}px) rotate(-16deg)`, offset: .42 }, { transform: `translate(${dx * .86}px,${dy * .86}px) rotate(9deg) scale(.86)`, offset: .84 }, { transform: `translate(${dx}px,${dy}px) scale(.16,.5)` }], { duration: 1900, easing: 'cubic-bezier(.45,.05,.55,1)', fill: 'forwards' }).onfinish = () => { m.remove(); if (!Hero.gone) gulp(); };
}

function gulp(big) {
  const body = $('#mbBody'); body.style.transformBox = 'fill-box'; body.style.transformOrigin = '50% 100%';
  body.animate([{ transform: 'none' }, { transform: big ? 'scale(1.1,.84)' : 'scale(1.05,.92)', offset: .28 }, { transform: big ? 'scale(.92,1.12)' : 'scale(.97,1.05)', offset: .6 }, { transform: 'none' }], { duration: big ? 520 : 420, easing: 'cubic-bezier(.3,1.3,.5,1)' });
  $('#mbLid').animate([{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: 0 }], { duration: big ? 300 : 220 });
  Snd.play('gulp');
  if (big) { Snd.play('clank'); $('#mbFlag').classList.add('up'); Snd.play('flag'); }
}

async function enter(withLetter) {
  if (Hero.gone) return; Hero.gone = true;
  const quick = calm();
  document.body.classList.add('leaving');
  if (withLetter && !quick) {
    const src = $('#walk .letter'), from = src.getBoundingClientRect(), fly = src.cloneNode(true), [cx, cy] = slotCentre();
    fly.className = 'flying'; fly.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`; document.body.appendChild(fly); $('#walk').classList.add('sent');
    const dx = cx - from.left - from.width / 2, dy = cy - from.top - from.height / 2; Hero.wide = true;
    Snd.play('paper', .7);
    await fly.animate([{ transform: 'none' }, { transform: `translate(${dx * .5}px,${dy * .55 - 150}px) rotate(16deg) scale(1.25)`, offset: .5 }, { transform: `translate(${dx * .93}px,${dy}px) rotate(-5deg) scale(.8)`, offset: .86 }, { transform: `translate(${dx}px,${dy}px) scale(.1,.55)` }], { duration: 760, easing: 'cubic-bezier(.45,.05,.5,1)', fill: 'forwards' }).finished;
    fly.remove();
  }
  gulp(true);
  await wait(quick ? 10 : 280);
  if (!quick) {
    // the words fall off the page, a letter at a time, and everything on the hill goes under
    $$('#pitch .c').forEach((c, k) => c.animate([{ transform: 'none' }, { transform: `translateY(${S.H * 1.1}px) rotate(${(k % 2 ? 1 : -1) * (24 + k % 40)}deg)` }], { duration: 640 + (k % 7) * 40, delay: k * 9, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }));
    for (const el of $$('.lede,.fine,#walk,#own')) el.animate([{ transform: 'none' }, { transform: `translateY(${S.H}px) rotate(5deg)` }], { duration: 640, delay: 90, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' });
    $$('#heroStones .g').forEach((g, k) => g.animate([{ opacity: 1 }, { opacity: 1, offset: .6 }, { opacity: 0 }], { duration: 420, delay: k * 30, fill: 'forwards' }));
    await wait(340);
    for (const r of $$('#mbEyes rect')) r.animate([{ transform: 'scale(1)' }, { transform: 'scale(1,.02)' }], { duration: 170, fill: 'forwards' });
    Snd.play('creak', .8, .14);
    const box = $('#mailbox'), b = box.getBoundingClientRect(), s = $('#mbSlot').getBoundingClientRect(), cx = s.left + s.width / 2, cy = s.top + s.height / 2, k = Math.max(S.W / s.width, S.H / s.height) * 2.6;
    box.style.transformOrigin = `${cx - b.left}px ${cy - b.top}px`;
    await box.animate([{ transform: 'none' }, { transform: `translate(${(S.W / 2 - cx) * .3}px,${(S.H / 2 - cy) * .3}px) scale(1.14)`, offset: .3 }, { transform: `translate(${S.W / 2 - cx}px,${S.H / 2 - cy}px) scale(${k})` }], { duration: 900, easing: 'cubic-bezier(.6,0,.85,.25)', fill: 'forwards' }).finished;
  }
  $('#veil').classList.add('on');
  $('#gate').hidden = true; document.body.classList.remove('at-gate', 'leaving');
  S.iris = 0; $('#veil').classList.remove('on');
  Snd.play('strike', .1);
}
