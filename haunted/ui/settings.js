'use strict';
// ---------- settings are carved on a big stone that comes up out of the ground ----------
const SKIES = [
  ['auto', 'Follows you', 'Night now, morning when you finish'],
  ['night', 'Always night', 'Dark, with the lantern'],
  ['day', 'Always day', 'Bright, with the sun out'],
  ['device', 'Match my device', 'Whatever your computer is set to'],
];
const seg = (name, value, options) => `<div class="seg" role="radiogroup" data-seg="${name}">${options.map(([v, label]) => `<button role="radio" aria-checked="${String(value) === String(v)}" data-v="${v}">${label}</button>`).join('')}</div>`;
const blob = (name, on) => `<button class="blob" role="switch" aria-checked="${!!on}" data-toggle="${name}" aria-label="${name}"><i><u></u><u></u></i></button>`;
const row = (title, hint, control) => `<div class="setrow"><div><b>${title}</b><small>${hint}</small></div>${control}</div>`;

function settingsHTML() {
  const s = S.set, local = S.local && !S.sample;
  return `<h2>Settings</h2>
<h3>Sky</h3>
<div class="skies">${SKIES.map(([k, t, h]) => `<button class="sky-tile ${k}${s.theme === k ? ' on' : ''}" data-sky="${k}" aria-pressed="${s.theme === k}"><span class="mini"><i class="orb"></i><i class="hillside"></i><svg viewBox="0 0 60 66"><path class="gbody" d="M7 34C7 14 17 4 30 4s23 10 23 30v27q-5.8 7-11.5 0t-11.5 0-11.5 0-11.5 0Z"/><rect x="18" y="25" width="7" height="14" rx="3.5" fill="#160C2E"/><rect x="35" y="25" width="7" height="14" rx="3.5" fill="#160C2E"/></svg></span><b>${t}</b><small>${h}</small></button>`).join('')}</div>
<h3>Sound</h3>
${row('Sound', 'Ghost voices, footsteps, the stone going down', blob('sound', s.sound))}
${row('Volume', '', `<input type="range" id="vol" min="0" max="1" step=".05" value="${s.volume}" aria-label="Volume">`)}
${row('Night air', 'Wind and a slow music box in the background', blob('music', s.music))}
<h3>The graveyard</h3>
${row('Who shows up', 'Most useful if many of yours still write to you', seg('quietOnly', s.quietOnly, [[0, 'Everyone'], [1, 'Quiet 1+ year'], [3, 'Quiet 3+ years']]))}
${row('Press and hold', 'Off: one press lays a ghost to rest', blob('hold', s.hold))}
${row('Calm mode', 'Less movement, fewer effects', blob('calm', s.calm))}
${row('Text size', '', seg('size', s.size, [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]))}
${S.web || S.sample ? `<h3>The web</h3>${row('Ask the web', 'Only a company\'s public name is ever sent, and only when you press the button', blob('web', s.web))}` : ''}
<h3>Your data</h3>
<div class="setbtns"><button class="stone small" id="tourAgain">Show the walkthrough again</button><button class="stone small" id="saveCsv">Save my list as a file</button>${local ? '<button class="stone small warn" id="forget"><i class="fill"></i><span>Hold to forget everything here</span></button>' : ''}</div>
${local ? `<p class="setnote">Your scan is kept only on this computer. ${esc(S.model ? `It was read by ${S.model}, running here.` : '')}</p>` : '<p class="setnote">This is a made-up inbox. To scan yours, it runs on your own computer.</p>'}`;
}

function saveSettings() { store.set('settings', S.set); applySettings(); }
function applySettings() {
  const root = document.documentElement, s = S.set;
  root.dataset.size = s.size; if (s.calm) root.dataset.calm = '1'; else delete root.dataset.calm;
  Snd.apply();
  applySky();
  if (S.ghosts.length && S.stage === 'walk') { buildRuler(); applyFilter(false); }
}
function openSettings() {
  const box = $('#settings'), st = $('#settingsStone');
  $('#setbody').innerHTML = settingsHTML(); box.hidden = false; S.settingsOpen = true; document.body.classList.add('in-settings');
  Snd.wake(); Snd.play('grind', .5); Snd.play('thump', .18);
  if (!calm()) {
    st.animate([{ transform: 'translateY(105%) rotate(-3deg)' }, { transform: 'translateY(-14px) rotate(.6deg)', offset: .72 }, { transform: 'translateY(4px) rotate(-.2deg)', offset: .88 }, { transform: 'none' }], { duration: 680, easing: 'cubic-bezier(.2,.9,.3,1)' });
    burst(S.cam + S.W / 2, S.H, 42, { c: ['#6B5A92', '#2D1A44', '#8D80B8', '#4FB07A'], a: -Math.PI / 2, spread: 2.6, v: 420, g: 760, r: 7, life: .9 });
    $$('#setbody>*').forEach((el, k) => el.animate([{ transform: 'translateY(18px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: 220 + k * 22, easing: 'cubic-bezier(.2,1,.3,1)', fill: 'backwards' }));
  }
}
function closeSettings() {
  if (!S.settingsOpen) return; S.settingsOpen = false; applySky(); document.body.classList.remove('in-settings');
  const box = $('#settings'), st = $('#settingsStone');
  Snd.play('grind', .35);
  if (calm()) { box.hidden = true; return; }
  st.animate([{ transform: 'none' }, { transform: 'translateY(-10px) rotate(.4deg)', offset: .2 }, { transform: 'translateY(108%) rotate(3deg)' }], { duration: 380, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }).onfinish = e => { box.hidden = true; e.target.cancel(); };
}
$('#gear').onclick = openSettings;
$('#setx').onclick = closeSettings;
$('#settings').addEventListener('click', e => {
  if (e.target.id === 'settings') return closeSettings();
  const t = e.target.closest('[data-toggle]');
  if (t) { const k = t.dataset.toggle; S.set[k] = !S.set[k]; t.setAttribute('aria-checked', S.set[k]); saveSettings(); Snd.play('tine', S.set[k] ? 81 : 74, .18); if (k === 'hold' && S.sel) fillCard(S.sel); return; }
  const sky = e.target.closest('[data-sky]');
  if (sky) { S.set.theme = sky.dataset.sky; $$('.sky-tile').forEach(n => { const on = n === sky; n.classList.toggle('on', on); n.setAttribute('aria-pressed', on); }); saveSettings(); Snd.play('tine', 78, .18); return; }
  const v = e.target.closest('[data-seg] button');
  if (v) { const g = v.closest('[data-seg]'), k = g.dataset.seg; S.set[k] = k === 'quietOnly' ? +v.dataset.v : v.dataset.v; g.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b === v)); saveSettings(); Snd.play('tine', 74, .14); return; }
  if (e.target.closest('#tourAgain')) { closeSettings(); store.set('toured', false); if (S.stage === 'walk') setTimeout(startTour, 420); return; }
  if (e.target.closest('#saveCsv')) return saveCsv();
});
// point at a sky and the real sky behind the stone changes, before you commit to anything
$('#settings').addEventListener('pointerover', e => { const sky = e.target.closest('[data-sky]'); if (!sky) return; const k = sky.dataset.sky; S.dawnT = k === 'night' ? 0 : k === 'day' ? 1 : k === 'device' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 0 : 1) : S.ghosts.length ? 1 - open().length / S.ghosts.length : 0; });
$('#settings').addEventListener('pointerout', e => { if (e.target.closest('[data-sky]')) applySky(); });
$('#settings').addEventListener('input', e => { if (e.target.id === 'vol') { S.set.volume = +e.target.value; saveSettings(); } });
$('#settings').addEventListener('change', e => { if (e.target.id === 'vol') Snd.play('hoo', 3, .4, .14); });
// forgetting is the one thing you can't undo, so it takes the same deliberate hold as a grave
$('#settings').addEventListener('pointerdown', e => {
  const b = e.target.closest('#forget'); if (!b) return;
  const fill = b.querySelector('.fill'), a = fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1600, fill: 'forwards' });
  const stop = () => { if (a.playState !== 'finished') a.cancel(); removeEventListener('pointerup', stop); };
  addEventListener('pointerup', stop);
  a.onfinish = async () => { await post('/api/forget', {}).catch(() => {}); store.set('toured', false); location.href = location.pathname; };
});
function saveCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, rows = [['Service', 'Website', 'Joined', 'Last heard from', 'Silent years', 'Hacked after joining', 'May have card', 'How to leave', 'Status']];
  for (const x of S.ghosts) rows.push([x.service, x.domain, x.joined, x.last_heard, x.silent_years, x.breaches.map(b => b.name).join('; '), x.money ? 'yes' : '', x.leave?.url || x.lookup?.delete?.url || '', x.state === 'gone' ? 'at rest' : x.state === 'alive' ? 'still using' : 'ghost']);
  const a = document.createElement('a'); a.download = 'my-ghosts.csv'; a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' })); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
