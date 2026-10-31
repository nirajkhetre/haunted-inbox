'use strict';
// ---------- the first visit: five short steps over the real report, skippable at any time ----------
const TOUR = [
  { text: 'This is what we found in the mailbox. Click a number to show only those.', at: '#repTiles' },
  { text: 'The riskiest account is always here, so you know where to start.', at: '.nextrow' },
  { text: 'Each account shows when you joined, what leaked, and the last message it sent you.', at: '#card', go() { const x = nextGhost(); if (x) openCard(x); } },
  { text: 'Two steps: close the account on their site, then mark it here. You can always undo.', at: '.path' },
  { text: 'Prefer to see it by year? The graveyard shows the same accounts, one stone each, and the sky gets lighter as you finish.', at: '#viewSwitch', last: true, go() { closeCard(); } },
];
let tourAt = -1;
function startTour() {
  if (S.touring || S.stage !== 'walk') return;
  S.touring = true; tourAt = -1; closeCard(); setView('report', true);
  $('#tour').hidden = false; $('#tourStones').innerHTML = TOUR.map(() => '<i></i>').join('');
  document.body.classList.add('touring');
  tourStep(0);
}
async function tourStep(k) {
  tourAt = k; const step = TOUR[k], box = $('#tourBubble');
  box.classList.remove('in');
  $$('#tourStones i').forEach((n, j) => { n.className = j < k ? 'done' : j === k ? 'now' : ''; });
  $('#tourNext').textContent = step.last ? 'Done' : 'Next';
  step.go?.();
  await wait(calm() ? 10 : step.go ? 720 : 240);
  if (tourAt !== k) return;
  $('#tourText').innerHTML = step.text.split(' ').map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(' ');
  placeTour(step.at);
  box.classList.add('in');
}
function placeTour(sel) {
  const target = $(sel)?.getBoundingClientRect(), spot = $('#tourSpot'), box = $('#tourBubble'), m = 14;
  if (!target) return;
  const pad = 8, t = { l: target.left - pad, r: target.right + pad, top: Math.max(4, target.top - pad), bot: Math.min(S.H - 4, target.bottom + pad) };
  spot.style.cssText = `left:${t.l}px;top:${t.top}px;width:${t.r - t.l}px;height:${t.bot - t.top}px`;
  const w = box.offsetWidth, h = box.offsetHeight;
  let x, y;
  if (S.H - t.bot > h + 40) { y = t.bot + 16; x = clamp(t.l, m, S.W - w - m); }
  else if (t.top > h + 40) { y = t.top - h - 16; x = clamp(t.l, m, S.W - w - m); }
  else if (t.l > w + 40) { x = t.l - w - 16; y = clamp(t.top, 70, S.H - h - m); }
  else { x = clamp(t.r + 16, m, S.W - w - m); y = clamp(t.top, 70, S.H - h - m); }
  box.style.setProperty('--x', Math.round(x) + 'px'); box.style.setProperty('--y', Math.round(y) + 'px');
}
function endTour() {
  if (!S.touring) return;
  S.touring = false; store.set('toured2', true);
  $('#tourBubble').classList.remove('in'); document.body.classList.remove('touring'); $('#tour').hidden = true;
  if (S.sel) closeCard();
  guide();
}
$('#tourNext').onclick = () => { Snd.wake(); if (TOUR[tourAt]?.last) endTour(); else tourStep(tourAt + 1); };
$('#tourSkip').onclick = endTour;
addEventListener('keydown', e => { if (!S.touring) return; if (e.key === 'Escape') { e.stopPropagation(); endTour(); } if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); $('#tourNext').click(); } }, true);
addEventListener('resize', () => { if (S.touring) placeTour(TOUR[tourAt].at); });
const maybeTour = () => { if (!store.get('toured2', false) && !QS.has('notour')) setTimeout(startTour, calm() ? 50 : 800); };
