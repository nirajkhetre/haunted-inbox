'use strict';
// ---------- the plain view: what was found, the riskiest first, and what to do. The graveyard is the same data, one click away ----------
const TILES = [['all', 'Accounts to review'], ['hacked', 'Hacked after you joined'], ['card', 'May still have your card'], ['quiet', 'Silent for 3+ years']];
const sev = x => x.breaches.length ? 'hacked' : x.money ? 'card' : 'quiet';

function setView(v, quiet) {
  S.view = v; document.body.dataset.view = v; $('#report').hidden = false;
  $$('#viewSwitch button').forEach(b => b.setAttribute('aria-checked', b.dataset.view === v));
  if (S.sel && S.view === 'grave') fillCard(S.sel);
  guide(); renderRows(); thumb();
  if (quiet) return;
  Snd.play('paper', .3);
  if (v === 'grave' && !S.beatsDone && !S.touring) { S.beatsDone = true; graveBeats(); }
}
$('#viewSwitch').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
$('#walkBtn').onclick = () => setView('grave');

// the graveyard's own short story, the first time you walk in
async function graveBeats() {
  const G = S.ghosts, oldest = G.find(x => x.joined && x.state !== 'gone'), sold = G.filter(x => (x.lookup_saved || x.lookup)?.fate?.fate === 'acquired').length;
  closeCard(); walkTo(0); $('#guide').hidden = true; S.inBeats = true;
  if (oldest) { await beat(`Your oldest ghost: <em>${esc(oldest.service)}</em>, ${oldest.joined.slice(0, 4)}.`, 2000); if (lastWords(oldest)) await beat(`Its last words to you: <em>${esc(lastWords(oldest))}</em>`, 2400); }
  if (sold) await beat(`<em>${sold}</em> now belong to someone else. Nobody asked you.`, 2400);
  S.inBeats = false; guide();
}

function renderRows() {
  if (!S.ghosts.length) return;
  const o = open(), n = nextGhost();
  $('#repTiles').innerHTML = TILES.map(([k, label]) => `<button class="tile ${k}${S.filter === k ? ' on' : ''}" data-f="${k}" aria-pressed="${S.filter === k}"><b>${o.filter(MATCH[k]).length}</b><span>${label}</span></button>`).join('');
  $('#repNext').innerHTML = (S.sample ? '<p class="repnote">Sample report. This is a made-up person\'s inbox. The companies and the hacks are real, from public lists.</p>' : '') + (n
    ? `<div class="nextrow"><p><small>${S.ghosts.length === o.length ? 'Start here' : 'Next'}</small><b>${esc(n.service)}</b> ${esc(why(n))}.</p><button class="stone primary small" id="repGo">Review</button></div>`
    : `<div class="nextrow"><p><b>${o.length ? 'Nothing here matches that filter.' : 'You\'ve dealt with everything here.'}</b> ${o.length ? 'Pick another number above.' : 'Run it again in a year to catch anything new.'}</p></div>`);
  const go = $('#repGo'); if (go) go.onclick = () => { Snd.wake(); openCard(n); };
  const rows = S.ghosts.filter(inView).sort((a, b) => (a.state !== 'ghost' && a.state ? 1 : 0) - (b.state !== 'ghost' && b.state ? 1 : 0) || b.score - a.score);
  const quiet = x => x.silent_years == null ? '' : x.silent_years < 1 ? 'This year' : `${Math.floor(x.silent_years)} year${Math.floor(x.silent_years) === 1 ? '' : 's'} ago`;
  $('#repTable').innerHTML = `<div class="rowhead" aria-hidden="true"><span></span><span>Account</span><span class="when">Joined</span><span class="when">Last heard</span><span>What we found</span><span></span></div>` + rows.map(x => `<button class="row${x.state === 'gone' || x.state === 'alive' ? ' done' : ''}" data-k="${esc(x.key)}"><span class="dot ${sev(x)}"></span><span class="who"><b>${esc(x.service)}</b><small>${esc(x.domain)}</small></span><span class="when">${(x.joined || '').slice(0, 4)}</span><span class="when">${quiet(x)}</span><span class="flags">${x.breaches.length ? `<i class="flag h">Hacked ${x.breaches[0].date.slice(0, 4)}</i>` : ''}${x.leaked?.includes('Passwords') ? '<i class="flag h">Passwords</i>' : ''}${x.money ? '<i class="flag m">Your card?</i>' : ''}${!x.breaches.length && !x.money ? '<i class="flag">No problems found</i>' : ''}</span><span class="state">${x.state === 'gone' ? 'Closed' : x.state === 'alive' ? 'Still using' : 'Review'}</span></button>`).join('');
}
$('#repTiles').addEventListener('click', e => { const b = e.target.closest('.tile'); if (!b) return; S.filter = b.dataset.f; closeCard(); tally(); applyFilter(); });
$('#repTable').addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; const x = S.ghosts.find(q => q.key === r.dataset.k); if (!x) return; Snd.wake(); if (x.state === 'gone' || x.state === 'alive') return showUndo(x); openCard(x); });

// a mistake here is cheap: every choice can be taken back
let toastT = 0;
function showUndo(x) {
  const t = $('#toast'); clearTimeout(toastT);
  t.innerHTML = `<span>${esc(x.service)}: ${x.state === 'gone' ? 'marked as closed' : 'marked as still in use'}.</span><button id="undoBtn">Undo</button>`; t.hidden = false;
  t.animate([{ transform: 'translate(-50%,24px)', opacity: 0 }, { transform: 'translate(-50%,0)', opacity: 1 }], { duration: calm() ? 1 : 260, easing: 'cubic-bezier(.2,1,.3,1)' });
  $('#undoBtn').onclick = () => { undo(x); t.hidden = true; };
  toastT = setTimeout(() => { t.hidden = true; }, 6500);
}
function undo(x) {
  x.state = 'ghost'; const el = x.el; el.classList.remove('gone', 'alive'); el.querySelector('.flowers')?.remove();
  for (const n of [el.querySelector('.st'), el.querySelector('.gh')]) { n.getAnimations().forEach(a => a.cancel()); n.style.animation = ''; }
  el.querySelector('.nm').style.opacity = ''; x.eyes = el.querySelector('.eyes');
  saveState(x); tally(true); buildRuler(); guide();
}
