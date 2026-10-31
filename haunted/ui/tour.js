'use strict';
// ---------- the first walk: the keeper takes you round with the lantern, and everything else stays dark ----------
const domSpot = sel => { const b = $(sel)?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2, r: Math.max(b.width, b.height) * .62 + 34 }; };
const ghostSpot = (x, r = 170) => x && { x: x.x - S.cam, y: x.y - 62, r };
const stepHop = x => x?.el.querySelector('.gh svg').animate([{ transform: 'none' }, { transform: 'scale(1.14,.82)', offset: .25 }, { transform: 'translateY(-30px) scale(.9,1.14)', offset: .6 }, { transform: 'none' }], { duration: 620, easing: 'ease-out' });
const visibleGhost = pick => { const inside = S.ghosts.filter(x => x.x > S.cam + S.W * .3 && x.x < S.cam + S.W * .8 && x.state !== 'gone'); return inside.find(pick) || S.ghosts.find(pick) || inside[0]; };
const TOUR = [
  { text: "I'm the keeper. Every stone here is an account you made, standing on the day you signed up.",
    go() { const x = visibleGhost(() => true); stepHop(x); Snd.play('hoo', seed(x.key), .7, .14); return () => ghostSpot(x, 300); } },
  { text: 'Scroll to walk through the years. Or grab this ruler.',
    async go() { const from = S.camT; setTimeout(() => { if (S.touring) walkTo(from + 720); }, 500); setTimeout(() => { if (S.touring) walkTo(from); }, 2100); return () => domSpot('#ruler'); } },
  { text: 'A pink ghost was hacked after you joined. A gold coin means it may still have your card.',
    go() { const x = visibleGhost(g => g.breaches.length && g.money) || visibleGhost(g => g.breaches.length); S.tourGhost = x; walkTo(x.x - S.W * .4); setTimeout(() => { stepHop(x); Snd.play('hoo', seed(x.key), .7, .16); }, 800); return () => ghostSpot(x, 190); } },
  { text: 'Click any ghost to read its stone. Its last words to you are on it.',
    async go() { openCard(S.tourGhost); return () => domSpot('#card'); } },
  { text: "Two steps. Close the account, then hold here, and it's laid to rest.",
    go() { const f = $('#hold .fill'); f && setTimeout(() => { if (S.touring && f.isConnected) f.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)', offset: .7 }, { transform: 'scaleX(0)' }], { duration: 1700, easing: 'ease-in-out' }); }, 600); return () => domSpot('.path'); } },
  { text: 'Every ghost you settle brings the morning closer.',
    go() { closeCard(); if (S.set.theme === 'auto') { S.dawnT = 1; setTimeout(() => { if (S.touring) applySky(); }, 3000); } return () => ({ x: S.W * .24, y: S.H * .3, r: Math.max(S.W, S.H) }); } },
  { text: "Not sure where to start? Press this and I'll take you to the worst one.", last: true,
    go() { S.tourGuide = true; guide(); return () => domSpot('#guideGo'); } },
];
let tourAt = -1, tourSpot = null;
function startTour() {
  if (S.touring || S.stage !== 'walk') return;
  S.touring = true; S.tourGuide = false; tourAt = -1; closeCard(); guide();
  $('#tour').hidden = false; $('#tourStones').innerHTML = TOUR.map(() => '<i></i>').join('');
  document.body.classList.add('touring');
  tourStep(0);
}
async function tourStep(k) {
  tourAt = k; const step = TOUR[k], box = $('#tourBubble');
  box.classList.remove('in');
  $$('#tourStones i').forEach((n, j) => { n.className = j < k ? 'done' : j === k ? 'now' : ''; });
  $('#tourNext').textContent = step.last ? 'Got it' : 'Next';
  const spot = await step.go();
  tourSpot = spot;
  const words = step.text.split(' ').map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(' ');
  await wait(calm() ? 10 : 260);
  if (tourAt !== k) return;
  $('#tourText').innerHTML = words;
  placeBubble(spot());
  box.classList.add('in');
  Snd.play('step', .06);
}
function placeBubble(p) {
  const box = $('#tourBubble'), w = box.offsetWidth, h = box.offsetHeight, m = 16;
  if (S.W <= 760 || !p) { box.style.setProperty('--x', Math.round((S.W - w) / 2) + 'px'); box.style.setProperty('--y', (p && p.y > S.H * .45 ? 104 : S.H - h - 150) + 'px'); return; }
  let x = p.x + p.r * .72, y = p.y - h / 2;
  if (x + w > S.W - m) x = p.x - p.r * .72 - w;
  if (x < m || p.r > S.W * .4) x = Math.round((S.W - w) / 2);
  if (p.r > S.W * .4) y = S.H * .22;
  if (y + h > S.H - 130) y = p.y - p.r * .72 - h;
  box.style.setProperty('--x', Math.round(clamp(x, m, S.W - w - m)) + 'px'); box.style.setProperty('--y', Math.round(clamp(y, 76, S.H - h - 110)) + 'px');
}
function endTour() {
  if (!S.touring) return;
  S.touring = false; S.tourGuide = false; tourSpot = null; S.spotT = null; S.keeperAt = null; store.set('toured', true);
  $('#tourBubble').classList.remove('in'); document.body.classList.remove('touring');
  $$('#tourStones i').forEach((n, k) => n.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(40px)', opacity: 0 }], { duration: 300, delay: k * 34, fill: 'forwards' }));
  setTimeout(() => { $('#tour').hidden = true; }, 520);
  if (S.sel) closeCard();
  applySky(); guide();
}
$('#tourNext').onclick = () => { Snd.wake(); Snd.play('tine', 74 + tourAt, .15); if (TOUR[tourAt]?.last) endTour(); else tourStep(tourAt + 1); };
$('#tourSkip').onclick = () => { Snd.play('hoo', 5, .4, .12); endTour(); };
addEventListener('keydown', e => { if (!S.touring) return; if (e.key === 'Escape') { e.stopPropagation(); endTour(); } if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); $('#tourNext').click(); } }, true);
function tourFrame() {
  if (!S.touring || !tourSpot) return;
  const p = tourSpot(); if (!p) return;
  S.spotT = p; S.keeperAt = S.W <= 760 ? null : clamp(p.x - p.r * .9 - 40, 70, S.W * .42);
  if ($('#tourBubble').classList.contains('in')) placeBubble(p);
}
const maybeTour = () => { if (!store.get('toured', false) && !QS.has('notour')) setTimeout(startTour, calm() ? 50 : 500); };
