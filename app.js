'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REDUCED_OS = matchMedia('(prefers-reduced-motion: reduce)').matches;
const calm = () => REDUCED_OS || S.set.calm;
const store = { get(k, d) { try { const v = localStorage.getItem('haunted.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('haunted.' + k, JSON.stringify(v)); } catch {} } };
const QS = new URLSearchParams(location.search);
const wait = ms => new Promise(r => setTimeout(r, calm() ? Math.min(ms, 40) : ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmtDay = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown';
const fmtMonth = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'unknown';
const safe = u => /^https?:\/\//i.test(u || '') ? esc(u) : '#';
const plural = (n, a, b = a + 's') => `${n} ${n === 1 ? a : b}`;

const S = { ghosts: [], local: false, web: false, sample: false, stage: 'gate', W: innerWidth, H: innerHeight, cam: 0, camT: 0, vel: 0, dawn: 0, dawnT: 0, mouse: { x: innerWidth * .7, y: innerHeight * .4 }, worldW: innerWidth, sel: null, phase: 0, parts: [], filter: 'all', iris: 1, spot: null, spotT: null, keeperAt: null, kx0: 0, touring: false, view: 'report', set: { startIn: 'report', theme: 'auto', sound: false, volume: .8, music: true, calm: false, size: 'm', quietOnly: 0, hold: true, web: true, ...store.get('settings2', {}) } };

// ---------- the sky, the hills, the fog: painted fresh every frame ----------
const sky = $('#sky'), g = sky.getContext('2d'), night = $('#night'), n = night.getContext('2d');
const SKY = [['#0B0620', '#1C1045', '#3B1F6E'], ['#26175C', '#8A3F93', '#F47C7F'], ['#74C4F0', '#BCE5F4', '#FFE2B3']];
const FAR = ['#1A0F40', '#5A3373', '#A5CCCB'], MID = ['#120A30', '#40245A', '#84B793'], LAND = ['#0E0726', '#2D1A44', '#74B26E'], ROAD = ['#221442', '#6B4560', '#D7C088'];
const STONE = [['#8D80B8', '#6E6299'], ['#9F8FB6', '#7D6C97'], ['#C8C4C7', '#A3A0A8']];
const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, k) => Math.round(lerp(v, y[k], t))).join(',')})`; };
const ramp = (stops, d) => { const t = d * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t)); return mix(stops[k], stops[k + 1], t - k); };
const rampHex = (stops, d) => '#' + ramp(stops, d).match(/\d+/g).map(v => (+v).toString(16).padStart(2, '0')).join('');
let rnd = 7; const R = () => (rnd = rnd * 16807 % 2147483647) / 2147483647;
const STARS = Array.from({ length: 170 }, () => ({ x: R(), y: R() * .62, r: R() * 1.6 + .4, t: R() * 6 }));
const TREES = Array.from({ length: 16 }, (_, k) => ({ x: k * 760 + R() * 300, s: .7 + R() * .7, f: R() }));
const FOG = Array.from({ length: 11 }, (_, k) => ({ x: R() * 2400, y: .5 + R() * .3, r: 240 + R() * 340, s: 6 + R() * 12 }));
const fogSprite = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(235,225,255,.75)'); gr.addColorStop(1, 'rgba(235,225,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return c; })();
const base = () => S.H * .57;
const ground = x => base() + 15 * Math.sin(x / 233) + 9 * Math.sin(x / 97 + 1.3);
const rowGap = () => clamp((S.H - base() - 170) / 2.3, 26, 74);

function hill(par, y, amp, f, color) {
  g.fillStyle = color; g.beginPath(); g.moveTo(0, S.H);
  const off = S.cam * par;
  for (let x = 0; x <= S.W + 28; x += 28) g.lineTo(x, y + amp * Math.sin((x + off) / f) + amp * .45 * Math.sin((x + off) / (f * .37) + 2));
  g.lineTo(S.W + 28, S.H); g.closePath(); g.fill();
}
function tree(x, y, s, color, d, f) {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = color; g.lineCap = 'round';
  const limb = (l, w, depth) => { g.lineWidth = w; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -l); g.stroke(); g.translate(0, -l); if (depth) for (const a of [-.55, .48]) { g.save(); g.rotate(a + (f - .5) * .3); limb(l * .72, w * .66, depth - 1); g.restore(); } else if (d > .55) { g.fillStyle = `rgba(116,190,110,${(d - .55) * 2.2})`; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); } };
  limb(42, 8, 4); g.restore();
}
function drawSky(now) {
  const { W, H, cam, dawn: d } = S, gr = g.createLinearGradient(0, 0, 0, base() + 20);
  gr.addColorStop(0, ramp(SKY.map(s => s[0]), d)); gr.addColorStop(.58, ramp(SKY.map(s => s[1]), d)); gr.addColorStop(1, ramp(SKY.map(s => s[2]), d));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (d < .7) for (const s of STARS) { g.globalAlpha = (1 - d / .7) * (.55 + .45 * Math.sin(now / 900 + s.t)); g.fillStyle = '#FFF8EC'; g.fillRect((s.x * W * 1.2 - cam * .02) % (W * 1.2), s.y * H, s.r, s.r); }
  g.globalAlpha = 1;
  // the moon sets as the sun comes up over the same hill
  const mx = (S.stage === 'gate' ? W * .94 : W * .82) - cam * .012, my = H * ((S.stage === 'gate' ? .13 : .17) + d * .55), sy = H * (.74 - d * .62), sx = W * .24 - cam * .012;
  const face = (cx, cy, r, sleepy) => { const lx = clamp((S.mouse.x - cx) / 600, -1, 1) * r * .06, ly = clamp((S.mouse.y - cy) / 500, -1, 1) * r * .05; g.fillStyle = "#160C2E"; for (const dx of [-.3, .3]) { g.beginPath(); g.roundRect(cx + dx * r - r * .075 + lx, cy - r * .22 + ly + sleepy * r * .14, r * .15, r * .34 * (1 - sleepy * .8), r * .075); g.fill(); } g.fillStyle = "#FFB3CF"; for (const dx of [-.56, .56]) { g.beginPath(); g.arc(cx + dx * r, cy + r * .24, r * .1, 0, 7); g.fill(); } };
  if (d < .75 && !(S.stage === 'gate' && W <= 1100)) { const r = Math.min(W, H) * .075; g.globalAlpha = 1 - d / .75; g.fillStyle = "#FFF2C7"; g.strokeStyle = "#160C2E"; g.lineWidth = 4; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#EFDFA6"; for (const [a, b, c] of [[-.45, -.5, .16], [.5, -.38, .11], [.42, .5, .14]]) { g.beginPath(); g.arc(mx + a * r, my + b * r, c * r, 0, 7); g.fill(); } face(mx, my, r, clamp(d * 1.8, 0, 1)); g.globalAlpha = 1; }
  if (d > .12) { const r = Math.min(W, H) * .1, gl = g.createRadialGradient(sx, sy, r * .4, sx, sy, r * 3.6); gl.addColorStop(0, `rgba(255,214,120,${Math.min(.7, d)})`); gl.addColorStop(1, "rgba(255,214,120,0)"); g.fillStyle = gl; g.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8); g.fillStyle = "#FFD25E"; g.strokeStyle = "#160C2E"; g.lineWidth = 4; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); g.stroke(); face(sx, sy, r, clamp(1 - d * 1.6, 0, 1)); }
  hill(.14, base() - H * .1, 34, 340, ramp(FAR, d));
  for (const t of TREES) { const x = (t.x - cam * .3) % (W + 900); if (x > -160) tree(x, base() - H * .035 + 12 * Math.sin(t.x), t.s, ramp(MID, d), d, t.f); }
  hill(.3, base() - H * .035, 24, 250, ramp(MID, d));
  // fog drifts faster the closer it is, and burns off at dawn
  if (d < .9) for (const f of FOG) { g.globalAlpha = .22 * (1 - d); const r = f.r, x = ((f.x + now / 1000 * f.s - cam * .5) % (W + r * 2) + (W + r * 2)) % (W + r * 2) - r; g.drawImage(fogSprite, x - r, H * f.y - r * .36, r * 2, r * .72); }
  g.globalAlpha = 1;
  g.fillStyle = ramp(LAND, d); g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, ground(x + cam));
  g.lineTo(W + 20, H); g.closePath(); g.fill();
  // the path you are walking
  const gap = rowGap(); g.strokeStyle = ramp(ROAD, d); g.lineWidth = gap * .62; g.lineCap = 'round'; g.beginPath();
  for (let x = -20; x <= W + 20; x += 24) { const y = ground(x + cam) + gap * 1.72; x === -20 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
}

// ---------- the night itself, with holes in it where the light falls ----------
function hole(x, y, r, a = 1) {
  const gr = n.createRadialGradient(x, y, r * .25, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  n.fillStyle = gr; n.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawNight(now) {
  const { W, H, dawn: d } = S; n.clearRect(0, 0, W, H);
  const dark = S.stage === 'gate' ? .05 * (1 - d) : .46 * Math.pow(1 - d, 1.25);
  if (dark > .01) {
    n.fillStyle = `rgba(7,3,22,${dark})`; n.fillRect(0, 0, W, H);
    n.globalCompositeOperation = 'destination-out';
    if (S.stage !== 'gate') hole(S.lantern.x, S.lantern.y, Math.max(360, S.W * .3) + 16 * Math.sin(now / 240), .96);
    hole(S.mouse.x, S.mouse.y, 170, .78);
    if (S.sel) hole(S.sel.x - S.cam, S.sel.y - 50, 300, .98);
    n.globalCompositeOperation = 'source-over';
  }
  if (S.stage !== 'gate' && d < .85) { const l = S.lantern, gl = n.createRadialGradient(l.x, l.y, 4, l.x, l.y, 190); gl.addColorStop(0, `rgba(255,200,90,${.34 * (1 - d)})`); gl.addColorStop(1, 'rgba(255,200,90,0)'); n.globalCompositeOperation = 'lighter'; n.fillStyle = gl; n.fillRect(l.x - 190, l.y - 190, 380, 380); n.globalCompositeOperation = 'source-over'; }
  for (let k = S.parts.length - 1; k >= 0; k--) {
    const p = S.parts[k]; p.life -= S.dt; if (p.life <= 0) { S.parts.splice(k, 1); continue; }
    p.x += p.vx * S.dt; p.y += p.vy * S.dt; p.vy += (p.g || 0) * S.dt; p.vx *= .985;
    const t = p.life / p.max; n.globalAlpha = Math.min(1, t * 1.6);
    n.fillStyle = p.c;
    if (p.ink) { n.strokeStyle = '#160C2E'; n.lineWidth = 2; }
    n.beginPath(); n.arc(p.x - S.cam, p.y, p.r * (p.grow ? 1 + (1 - t) * p.grow : t), 0, 7); n.fill(); if (p.ink) n.stroke();
  }
  n.globalAlpha = 1;
  // fireflies drift about at night, and go to bed when it gets light
  if (d < .7 && S.stage !== 'gate' || S.stage === 'gate') for (const f of FLIES) { const x = ((f.x + Math.sin(now / 1700 + f.p) * 60 - S.cam * f.z) % (W + 80) + W + 80) % (W + 80) - 40, y = H * f.y + Math.cos(now / 1300 + f.p) * 26, a = (1 - d) * (.45 + .55 * Math.sin(now / 480 + f.p * 3)); if (a <= .02) continue; n.globalCompositeOperation = 'lighter'; const g2 = n.createRadialGradient(x, y, 0, x, y, 13); g2.addColorStop(0, `rgba(255,226,120,${a})`); g2.addColorStop(1, 'rgba(255,226,120,0)'); n.fillStyle = g2; n.fillRect(x - 13, y - 13, 26, 26); n.globalCompositeOperation = 'source-over'; }
  if (S.stage !== 'gate' && S.W > 760) { const off = S.cam * 1.5, tone = ramp(['#0B0620', '#2A1650', '#3E7A44'], d), rim = ramp(['#07031A', '#160C2E', '#160C2E'], d), base = H - 54; n.fillStyle = tone; n.strokeStyle = rim; n.lineWidth = 4; n.lineJoin = 'round';
    for (let i = Math.floor(off / 1500); (i * 1500 - off) < W + 200; i++) { const sx = i * 1500 - off; for (let k = 0; k < 4; k++) { const px = sx + k * 58; n.beginPath(); n.moveTo(px - 7, H); n.lineTo(px - 7, base - 62); n.lineTo(px, base - 80); n.lineTo(px + 7, base - 62); n.lineTo(px + 7, H); n.closePath(); n.fill(); n.stroke(); } n.fillRect(sx - 20, base - 34, 214, 10); n.strokeRect(sx - 20, base - 34, 214, 10); }
    for (let i = Math.floor(off / 230); (i * 230 - off) < W + 80; i++) { const gx = i * 230 - off, w = 24 + (i * 7 % 13); n.beginPath(); n.moveTo(gx - w, H); n.quadraticCurveTo(gx - w * .5, base - 8 - (i * 5 % 18), gx - w * .3, base - 2); n.quadraticCurveTo(gx, base - 34 - (i * 3 % 22), gx + w * .2, base); n.quadraticCurveTo(gx + w * .6, base - 12 - (i * 11 % 16), gx + w, H); n.closePath(); n.fill(); n.stroke(); } }
  // the opening after the fall through the mailbox: a lantern comes on in the dark
  if (S.iris < 1) { S.iris = Math.min(1, S.iris + S.dt / 1.15); const e = S.iris * S.iris * (3 - 2 * S.iris), l = S.lantern; n.globalCompositeOperation = 'source-over'; n.fillStyle = '#0B0620'; n.fillRect(0, 0, W, H); n.globalCompositeOperation = 'destination-out'; hole(l.x, l.y, 40 + e * Math.hypot(W, H) * 1.5, 1); n.globalCompositeOperation = 'source-over'; }
}
const FLIES = Array.from({ length: 14 }, () => ({ x: R() * 2200, y: .42 + R() * .4, p: R() * 6.3, z: .4 + R() * .7 }));
function burst(x, y, count, o = {}) {
  if (calm()) return;
  for (let k = 0; k < count; k++) { const a = (o.a ?? -Math.PI / 2) + (Math.random() - .5) * (o.spread ?? 2.6), v = (o.v ?? 180) * (.4 + Math.random()), life = (o.life ?? .9) * (.6 + Math.random() * .6); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g ?? 240, r: (o.r ?? 5) * (.5 + Math.random()), c: Array.isArray(o.c) ? o.c[k % o.c.length] : o.c ?? '#6B5A92', life, max: life, ink: o.ink, grow: o.grow }); }
}

// ---------- the keeper: walks when you walk, and the lantern swings late, because it hangs ----------
$('#keeper').innerHTML = `<g id="kwhole"><ellipse cx="62" cy="163" rx="34" ry="6" fill="#07031a" opacity=".4"/>
<g id="kfoot"><path d="M42 150q-3 12 8 12h6q4-8-2-12Z" fill="#160C2E"/><path d="M70 150q-3 12 8 12h6q4-8-2-12Z" fill="#160C2E"/></g>
<g id="kbody"><path d="M18 150C14 110 18 44 62 40s50 70 44 110q-10 8-22 2-11 8-22 0-12 8-22 0-11 5-20-2Z" fill="url(#gCloak)" stroke="#160C2E" stroke-width="4.5" stroke-linejoin="round"/>
<path d="M30 80c2-16 10-26 22-30" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="6" stroke-linecap="round"/>
<path d="M36 86c-2-20 8-32 26-32s28 12 26 32c-1 14-12 20-26 20s-25-6-26-20Z" fill="#FFF8EC" stroke="#160C2E" stroke-width="4.5"/>
<g id="keyes"><rect x="47" y="70" width="8" height="17" rx="4" fill="#160C2E"/><rect x="69" y="70" width="8" height="17" rx="4" fill="#160C2E"/></g>
<circle cx="42" cy="92" r="4.5" fill="#FFB3CF"/><circle cx="82" cy="92" r="4.5" fill="#FFB3CF"/><path d="M57 94q5 5 10 0" fill="none" stroke="#160C2E" stroke-width="3" stroke-linecap="round"/>
<path d="M62 41c-6-18 6-34 18-33-3 8-3 16 1 24" fill="#3F2A86" stroke="#160C2E" stroke-width="4.5" stroke-linejoin="round"/></g>
<g id="karm"><path d="M100 104l26-22" stroke="#160C2E" stroke-width="7" stroke-linecap="round"/><g id="klamp"><path d="M126 82v12" stroke="#160C2E" stroke-width="3.5"/><rect x="115" y="94" width="22" height="28" rx="6" fill="#FFC83D" stroke="#160C2E" stroke-width="4"/><rect x="121" y="100" width="10" height="16" rx="4" fill="#FFF3B0"/></g></g></g>`;
const K = { whole: $('#kwhole'), body: $('#kbody'), lamp: $('#klamp'), eyes: $('#keyes'), foot: $('#kfoot'), swing: 0 };
S.lantern = { x: 0, y: 0 };
function drawKeeper() {
  const home = S.keeperAt ?? (S.W <= 760 ? S.W * .16 : S.W * .22); S.kx0 = S.kx0 || home; const dk = (home - S.kx0) * (1 - Math.pow(.02, S.dt)); S.kx0 += dk;
  const kx = S.kx0, y = ground(kx + S.cam) + rowGap() * 1.7 - 158, sp = clamp((S.vel + dk * 2) / 16, -1, 1);
  const beforeStep = Math.sin(S.phase); S.phase += Math.abs(S.vel + dk * 2) * .0105 * S.dt * 60;
  const step = Math.sin(S.phase), walking = Math.abs(sp) > .04;
  if (walking && beforeStep * step < 0 && S.stage !== 'gate') Snd.play('step', .045 + Math.abs(sp) * .03);
  const bob = walking ? Math.abs(step) * -7 : Math.sin(performance.now() / 700) * 1.6;
  S.kx = kx;
  $('#keeper').style.transform = `translate(${kx - 62}px,${y + bob}px) scale(${sp < -.02 ? -1 : 1},1)`;
  K.body.setAttribute('transform', `rotate(${sp * 5} 62 150) translate(0 ${walking ? Math.abs(step) * 2.5 : 0})`);
  K.foot.setAttribute('transform', `translate(${walking ? step * 5 : 0} 0)`);
  K.swing += (clamp(-sp * 26 + (walking ? step * 5 : 0), -30, 30) - K.swing) * .09;
  K.lamp.setAttribute('transform', `rotate(${K.swing} 126 82)`);
  const look = clamp((S.mouse.x - kx) / 400, -1, 1);
  K.eyes.setAttribute('transform', `translate(${look * 3} ${clamp((S.mouse.y - y - 70) / 600, -1, 1) * 2})`);
  const dir = sp < -.02 ? -1 : 1, a = K.swing * Math.PI / 180;
  S.lantern.x = kx + dir * (64 + Math.sin(-a) * 26); S.lantern.y = y + bob + 82 + Math.cos(a) * 26;
}

// ---------- every account is a stone on the day you joined, with a ghost above it ----------
const GPATH = 'M7 34C7 14 17 4 30 4s23 10 23 30v27q-5.8 7-11.5 0t-11.5 0-11.5 0-11.5 0Z';
const STONES = ['M6 88V34C6 16 19 5 36 5s30 11 30 29v54Z', 'M9 88V24q0-5 5-7l20-10q2-1 4 0l20 10q5 2 5 7v64Z', 'M13 88V15q0-9 9-9h28q9 0 9 9v73Z', 'M3 88V46C3 32 18 24 36 24s33 8 33 22v42Z'];
const ghostSVG = o => `<svg viewBox="0 0 60 70" aria-hidden="true"><path class="gshadow" d="${GPATH}"/><path class="gbody" d="${GPATH}"/><path class="gshine" d="M16 26c2-7 6-11 12-13"/>
<g class="eyes"><rect class="geye" x="18" y="25" width="7" height="14" rx="3.5"/><rect class="geye" x="35" y="25" width="7" height="14" rx="3.5"/></g>
<circle class="gcheek" cx="13" cy="42" r="4"/><circle class="gcheek" cx="47" cy="42" r="4"/>
${o.hacked ? '<path class="gbrow" d="M16 21l9-4M44 21l-9-4"/><path class="gbrow" d="M25 48q5-5 10 0"/>' : '<ellipse class="gmouth" cx="30" cy="46" rx="3" ry="3.6"/>'}</svg>`;
function stoneSVG(x, v) {
  const d = STONES[v.shape], year = (x.joined || '').slice(0, 4);
  return `<svg class="st" viewBox="0 0 72 92" aria-hidden="true"><path class="under" d="${d}" transform="translate(4 2)"/><path class="face" d="${d}"/><path class="shine" d="M${v.shape === 3 ? 12 : 16} ${v.shape === 3 ? 44 : 30}c1-6 5-11 11-14"/>
<text x="36" y="${v.shape === 3 ? 62 : 52}">${esc(year)}</text>
${x.breaches.length ? `<path class="crack" d="M${24 + v.shape * 4} ${v.shape === 3 ? 26 : 8}l7 12-8 8 10 10-6 10"/>` : ''}
${(x.silent_years || 0) >= 5 ? `<path class="moss" d="M${v.shape === 3 ? 6 : 8} 88v-10q5-7 11-3 5-5 11 1 7-1 8 12Z"/>` : ''}
${x.money ? '<circle class="coin" cx="56" cy="74" r="8"/>' : ''}</svg>`;
}
const FLOWERS = `<svg class="flowers" viewBox="0 0 80 56" aria-hidden="true">${[[14, 34, '#FF7DB6'], [40, 22, '#FFC83D'], [64, 36, '#BDAEEA']].map(([x, y, c], k) => `<g style="--i:${k}"><path d="M${x} 56V${y}" stroke="#160C2E" stroke-width="3.5" fill="none"/><path d="M${x} 46q8-1 9-8-9-1-9 8Z" fill="#7CF2B6" stroke="#160C2E" stroke-width="2.5"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${x + Math.cos(a * Math.PI / 180) * 6.5}" cy="${y + Math.sin(a * Math.PI / 180) * 6.5}" r="5" fill="${c}" stroke="#160C2E" stroke-width="2.5"/>`).join('')}<circle cx="${x}" cy="${y}" r="3.5" fill="#FFF8EC" stroke="#160C2E" stroke-width="2"/></g>`).join('')}</svg>`;

const seed = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function layout() {
  const list = S.ghosts; if (!list.length) return;
  const days = d => new Date(d + 'T12:00').getTime() / 864e5, dated = list.filter(x => x.joined);
  const first = new Date((dated[0]?.joined || '2015-01-01').slice(0, 4) + '-01-01T12:00').getTime() / 864e5, last = days(new Date().toISOString().slice(0, 10));
  const start = S.W * .34, span = Math.max(S.W * 1.1, list.length * 62, (last - first) / 365 * 300), ppd = span / Math.max(1, last - first);
  S.first = first; S.ppd = ppd; S.start = start; S.worldW = start + span + S.W * .5;
  const rowEnd = [-1e9, -1e9, -1e9], gap = rowGap();
  list.forEach((x, k) => {
    const want = start + ((x.joined ? days(x.joined) : last) - first) * ppd, order = [(k * 2) % 3, (k * 2 + 1) % 3, (k * 2 + 2) % 3];
    const row = order.reduce((b, r) => rowEnd[r] < rowEnd[b] ? r : b, order[0]), xx = Math.max(want, rowEnd[row] + 76);
    rowEnd[row] = xx; x.row = row; x.x = xx; x.s = (.78 + row * .17) * clamp(S.H / 820, .72, 1.1); x.y = ground(xx) + 22 + row * gap;
    const el = x.el; if (el) { el.style.left = xx + 'px'; el.style.top = x.y + 'px'; el.style.zIndex = 10 + row * 10 + (k % 9); el.style.setProperty('--s', x.s); }
  });
  $$('.post').forEach(p => { const yr = +p.dataset.y, xx = start + (new Date(yr + '-01-01T12:00').getTime() / 864e5 - first) * ppd; p.style.left = xx + 'px'; p.style.top = ground(xx) + 8 + 'px'; });
  S.camT = clamp(S.camT, 0, S.worldW - S.W * .6);
}
function makeGrave(x, rise) {
  const h = seed(x.key), v = { shape: h % 4 };
  const el = document.createElement('button');
  el.className = `g${x.breaches.length ? ' hacked' : ''}${x.money ? ' money' : ''}${(x.silent_years || 0) >= 8 ? ' faint' : ''}${rise ? ' rise' : ''}${x.state === 'gone' ? ' gone' : ''}${x.state === 'alive' ? ' alive' : ''}`;
  el.dataset.k = x.key; el.setAttribute('aria-label', `${x.service}, joined ${fmtDay(x.joined)}${x.breaches.length ? ', hacked after you joined' : ''}`);
  el.innerHTML = `${stoneSVG(x, v)}<span class="gh" style="--d:${2.4 + (h % 17) / 10}s;--dl:-${(h % 30) / 10}s">${ghostSVG({ hacked: x.breaches.length })}</span><span class="hit"></span><span class="nm">${esc(x.service)}</span>${x.state === 'gone' ? FLOWERS : ''}`;
  x.el = el; x.eyes = el.querySelector('.eyes');
  return el;
}
function buildWorld(rise) {
  const w = $('#world'); w.innerHTML = '';
  for (const x of S.ghosts) w.appendChild(makeGrave(x, rise));
  const dated = S.ghosts.filter(x => x.joined);
  if (dated.length) for (let y = +dated[0].joined.slice(0, 4); y <= new Date().getFullYear(); y++) { const p = document.createElement('div'); p.className = 'post'; p.dataset.y = y; p.innerHTML = `<svg viewBox="0 0 88 78" aria-hidden="true"><rect class="wood" x="38" y="26" width="12" height="52"/><path class="board" d="M6 6h68l10 13-10 13H6Z"/><text x="44" y="27">${y}</text></svg>`; w.appendChild(p); }
  layout(); buildRuler(); tally();
}
function cull() {
  const a = S.cam - 220, b = S.cam + S.W + 220, near = S.cam + S.lantern.x;
  for (const x of S.ghosts) { const on = x.x > a && x.x < b; if (x.el && on !== x.vis) { x.vis = on; x.el.style.display = on ? '' : 'none'; } if (on && x.el) { const d = Math.abs(x.x - near) < 170; if (d !== x.near) { x.near = d; x.el.classList.toggle('near', d); } } }
}
function looks() {
  for (const x of S.ghosts) if (x.vis && x.eyes) {
    const dx = S.mouse.x - (x.x - S.cam), dy = S.mouse.y - (x.y - 110), len = Math.hypot(dx, dy) || 1;
    x.eyes.style.transform = `translate(${(dx / len * Math.min(4, len / 40)).toFixed(1)}px,${(dy / len * Math.min(3, len / 50)).toFixed(1)}px)`;
  }
}

// ---------- the frame ----------
let last = performance.now(), tick = 0;
function frame(now) {
  S.dt = Math.min(.05, (now - last) / 1000); last = now; tick++;
  const before = S.cam;
  S.cam += (S.camT - S.cam) * (1 - Math.pow(.0009, S.dt));
  S.vel = (S.cam - before) / (S.dt * 60 || 1);
  if (Math.abs(S.dawnT - S.dawn) > .0005) { S.dawn += (S.dawnT - S.dawn) * (1 - Math.pow(.09, S.dt)); paintStones(); }
  $('#world').style.transform = `translate3d(${-S.cam}px,0,0)`;
  const ui = S.dawn >= .5 ? 'day' : 'night'; if (document.documentElement.dataset.ui !== ui) document.documentElement.dataset.ui = ui;
  drawSky(now); drawKeeper(); drawNight(now);
  if (S.stage === 'gate') heroEyes(now); else placeGuide();
  if (tick % 4 === 0) { cull(); thumb(); }
  if (tick % 3 === 0) looks();
  requestAnimationFrame(frame);
}
function placeGuide() { if (S.W <= 760 || $('#guide').hidden || S.view !== 'grave') return; const g = $('#guide'), h = g.offsetHeight; g.style.setProperty('--gx', Math.round(S.kx0 + 74) + 'px'); g.style.setProperty('--gy', Math.round(clamp(ground(S.kx0 + S.cam) + rowGap() * 1.7 - 148 - h * .5, 76, S.H - h - 96)) + 'px'); }
function paintStones() { const st = document.documentElement.style; st.setProperty('--stone', rampHex(STONE.map(s => s[0]), S.dawn)); st.setProperty('--stone2', rampHex(STONE.map(s => s[1]), S.dawn)); }
function resize() {
  const d = Math.min(1.6, devicePixelRatio || 1); S.W = innerWidth; S.H = innerHeight;
  for (const c of [sky, night]) { c.width = S.W * d; c.height = S.H * d; }
  g.setTransform(d, 0, 0, d, 0, 0); n.setTransform(d, 0, 0, d, 0, 0); layout();
}
addEventListener('resize', resize);

// ---------- walking: the wheel, a drag, the arrow keys, the ruler ----------
const walkable = () => S.stage === 'walk' && S.view === 'grave' && !S.touring && !S.settingsOpen && !$('#scanner').open;
const walkTo = x => { S.camT = clamp(x, 0, Math.max(0, S.worldW - S.W * .6)); };
addEventListener('wheel', e => { if (walkable() && !e.target.closest('#card,#report')) { walkTo(S.camT + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.1); } }, { passive: true });
addEventListener('pointermove', e => { S.mouse.x = e.clientX; S.mouse.y = e.clientY; });
let drag = null;
$('#world').addEventListener('pointerdown', e => { if (walkable()) drag = { x: e.clientX, cam: S.camT, moved: 0 }; });
addEventListener('pointermove', e => { if (drag) { drag.moved = Math.abs(e.clientX - drag.x); if (drag.moved > 5) walkTo(drag.cam - (e.clientX - drag.x) * 1.4); } });
addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.settingsOpen) closeSettings(); else if (S.sel) closeCard(); }
  if (walkable() && !S.sel && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { walkTo(S.camT + (e.key === 'ArrowRight' ? 260 : -260)); }
});
$('#world').addEventListener('click', e => {
  if (drag?.moved > 5 || S.stage !== 'walk' || S.touring) return;
  const el = e.target.closest('.g'); if (!el) { if (S.sel) closeCard(); return; }
  const x = S.ghosts.find(q => q.key === el.dataset.k); if (x && x.state !== 'gone') { Snd.wake(); openCard(x); }
});

// ---------- the ruler: the years underfoot, with the hacked ones in pink ----------
function buildRuler() {
  const dated = S.ghosts.filter(x => x.joined); if (!dated.length) return;
  const y0 = +dated[0].joined.slice(0, 4), y1 = new Date().getFullYear(), per = {};
  for (const x of dated) { const y = x.joined.slice(0, 4); per[y] ??= { all: 0, bad: 0 }; if (x.state !== 'gone' && inView(x)) { per[y].all++; if (x.breaches.length) per[y].bad++; } }
  const most = Math.max(1, ...Object.values(per).map(p => p.all)), box = $('#years');
  box.innerHTML = Array.from({ length: y1 - y0 + 1 }, (_, k) => { const y = y0 + k, p = per[y] || { all: 0, bad: 0 }, tall = 34; return `<div class="yr"><i style="height:${p.all ? 4 + p.all / most * tall : 0}px"></i><u style="height:${p.bad ? 3 + p.bad / most * tall : 0}px"></u><b>${S.W < 760 ? "'" + String(y).slice(2) : y}</b></div>`; }).join('');
}
function thumb() {
  const r = $('#ruler'); if (r.hidden) return;
  const w = r.clientWidth, usable = Math.max(1, S.worldW - S.W * .6), t = $('#thumb'), size = Math.max(36, w * S.W / S.worldW);
  t.style.width = size + 'px'; t.style.left = (S.cam / usable) * (w - size) + 'px';
}
{
  const r = $('#ruler'); let on = false;
  const go = e => { const b = r.getBoundingClientRect(), usable = Math.max(1, S.worldW - S.W * .6); walkTo(clamp((e.clientX - b.left) / b.width, 0, 1) * usable); };
  r.addEventListener('pointerdown', e => { on = true; r.setPointerCapture(e.pointerId); go(e); });
  r.addEventListener('pointermove', e => { if (on) go(e); });
  r.addEventListener('pointerup', () => { on = false; });
}

// ---------- story beats ----------
let skipBeat = null;
async function beat(html, ms) {
  const b = $('#beat'), t = $('#beattext'); let k = 0;
  const wrap = node => { for (const c of [...node.childNodes]) { if (c.nodeType === 3) { const f = document.createDocumentFragment(); for (const part of c.textContent.split(/(\s+)/)) { if (!part) continue; if (/\s/.test(part)) f.append(part); else { const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', k++); s.textContent = part; f.append(s); } } c.replaceWith(f); } else wrap(c); } };
  t.innerHTML = html; wrap(t); b.classList.remove('out'); b.hidden = false; Snd.play('beat');
  await Promise.race([wait(ms), new Promise(r => { skipBeat = r; })]);
  b.classList.add('out'); await wait(280); b.hidden = true;
}
addEventListener('pointerdown', e => { if (!$('#beat').hidden && !e.target.closest('button')) skipBeat?.(); });
function hopAll(pick) { for (const x of S.ghosts.filter(pick)) if (x.vis) x.el.querySelector('.gh svg').animate([{ transform: 'none' }, { transform: 'scale(1.1,.86)' }, { transform: 'translateY(-22px) scale(.92,1.12)' }, { transform: 'none' }], { duration: 560, delay: Math.random() * 180, easing: 'ease-out' }); }
async function reveal() {
  S.stage = 'reveal'; $('#scanbox').hidden = true;
  if (!S.ghosts.length) { await beat('No accounts found in this mailbox.', 2600); return gateBack(); }
  S.stage = 'walk'; $('#bar').hidden = false; $('#ruler').hidden = false; walkTo(0);
  tally(); applyFilter(false); setView(S.set.startIn || 'report', true); maybeTour();
}

// ---------- reading: a replay of the sample, or your real mailbox ----------
async function setScan(p) {
  $('#scanbox').hidden = false;
  $('#stage').textContent = p.stage; $('#cnum').textContent = (p.num ?? 0).toLocaleString('en-US'); $('#clabel').textContent = p.label;
  $('#cbar').style.width = (p.share * 100).toFixed(1) + '%'; $('#cnow').textContent = p.now || '';
}
function spawn(x) {
  x.state = x.state || 'ghost'; if (x.el) return;
  const el = makeGrave(x, true); $('#world').appendChild(el); x.vis = undefined; layoutOne(x);
  burst(x.x, x.y, 12, { c: ['#6B5A92', '#2D1A44', '#8D80B8'], v: 150, g: 460, r: 5, life: .6, spread: 2.2 });
  Snd.play('thump', .16);
}
function layoutOne(x) { const el = x.el; el.style.left = x.x + 'px'; el.style.top = x.y + 'px'; el.style.zIndex = 10 + x.row * 10; el.style.setProperty('--s', x.s); }
async function runSample() {
  S.stage = 'scan'; S.sample = true; await enter(true);
  const r = await (await fetch('sample.json')).json();
  S.ghosts = r.ghosts.map(x => ({ ...x, state: 'ghost', lookup_saved: x.lookup, lookup: undefined })); layout();
  const dated = S.ghosts.filter(x => x.joined);
  const years = [...new Set(dated.map(x => x.joined.slice(0, 4)))]; for (let y = +years[0]; y <= new Date().getFullYear(); y++) { const p = document.createElement('div'); p.className = 'post'; p.dataset.y = y; p.innerHTML = `<svg viewBox="0 0 88 78" aria-hidden="true"><rect class="wood" x="38" y="26" width="12" height="52"/><path class="board" d="M6 6h68l10 13-10 13H6Z"/><text x="44" y="27">${y}</text></svg>`; $('#world').appendChild(p); } layout();
  const total = r.envelopes, t0 = performance.now(), read = 1300;
  S.cam = S.camT = 0;
  while (performance.now() - t0 < read) { const t = (performance.now() - t0) / read; await setScan({ stage: 'Sample: a replay of a real scan', num: Math.round(total * t), label: 'emails read, senders and subjects only', share: t * .2 }); await wait(40); }
  const G = S.ghosts, each = Math.min(190, 6200 / G.length);
  for (let k = 0; k < G.length; k++) {
    const x = G[k]; walkTo(x.x - S.W * .55); spawn(x);
    await setScan({ stage: `Sample: a replay of a real scan, read by ${r.model || 'gemma4:e2b'}`, num: k + 1, label: k ? 'accounts found' : 'account found', share: .2 + .8 * (k + 1) / G.length, now: `${x.service}, since ${x.joined?.slice(0, 4)}${x.breaches.length ? '. Hacked after you joined.' : ''}` });
    await wait(each);
  }
  await wait(420);
  buildRuler(); tally();
  reveal();
}
async function watchReal() {
  S.stage = 'scan'; await enter(false);
  S.ghosts = []; $('#world').innerHTML = ''; S.cam = S.camT = 0;
  const spawned = new Map();
  while (true) {
    const p = await (await fetch('/api/progress')).json();
    if (p.stage === 'uploading') await setScan({ stage: 'opening your export, on this computer', num: Math.round((p.share || 0) * 100), label: '% opened', share: (p.share || 0) * .1 });
    if (p.stage === 'reading') await setScan({ stage: 'Reading senders and subjects only, never the messages', num: p.envelopes || 0, label: 'emails read, senders and subjects only', share: .15 });
    if (p.stage === 'asking') {
      await setScan({ stage: p.model ? `${p.model}, running on this computer` : 'no local model found, so rules only', num: p.found_total || 0, label: 'accounts found so far', share: .2 + .8 * p.done / (p.total || 1), now: `Sender ${p.done} of ${p.total}, from ${(p.envelopes || 0).toLocaleString('en-US')} envelopes` });
      for (const f of p.recent || []) { const id = f.service + f.joined; if (!spawned.has(id)) { spawned.set(id, 1); earlyGrave(f, spawned.size); } }
    }
    if (p.stage === 'error') { $('#scanbox').hidden = true; say(`That didn't work: ${p.message}`, 7000); S.stage = 'gate'; gateBack(); return; }
    if (p.stage === 'done') break;
    await wait(450);
  }
  const res = await (await fetch('/api/report')).json();
  S.ghosts = res.report.ghosts.map(x => ({ ...x, state: x.state || 'ghost' })); buildWorld(false);
  await wait(300); reveal();
}
async function reopen() {
  S.stage = 'scan'; await enter(false); S.stage = 'walk';
  S.ghosts = S.saved.ghosts.map(x => ({ ...x, state: x.state || 'ghost' })); buildWorld(false);
  S.dawn = S.dawnT; paintStones();
  $('#bar').hidden = false; $('#ruler').hidden = false; thumb(); tally(); applyFilter(false); setView(S.set.startIn || 'report', true); maybeTour();
}
function earlyGrave(f, k) {
  const x = { key: 'early' + k, service: f.service, joined: f.joined, domain: '', breaches: f.hacked ? [1] : [], money: null, silent_years: 0, state: 'ghost', x: S.W * .36 + k * 84, row: k % 3, s: .9 };
  x.y = ground(x.x) + 22 + x.row * rowGap(); S.worldW = x.x + S.W; const el = makeGrave(x, true); $('#world').appendChild(el); layoutOne(x); walkTo(x.x - S.W * .55); burst(x.x, x.y, 10, { c: ['#6B5A92', '#2D1A44'], v: 150, g: 460, r: 5, life: .6 });
}
function gateBack() { location.href = location.pathname; }
$('#home').onclick = gateBack;
$('#walk').onclick = () => { Snd.wake(); runSample(); };

// ---------- scanning your own: a local page offers it, the public site tells you how ----------
const post = async (url, body) => { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; };
function scanFormHTML() {
  if (!S.local) return `<h2>It runs on your own computer</h2><p>A tool that reads your mailbox shouldn't live on someone else's server, so this one doesn't. You need <a href="https://www.python.org/downloads/" target="_blank" rel="noopener">Python</a> and <a href="https://ollama.com/download" target="_blank" rel="noopener">Ollama</a>, then:</p>
<code class="cmd">git clone https://github.com/nirajkhetre/haunted-inbox
cd haunted-inbox
ollama pull gemma4:e2b
python -m haunted serve</code><p style="font-size:15px">This same page then opens on your computer, and nothing you give it leaves.</p><a class="stone go" style="width:100%" href="https://github.com/nirajkhetre/haunted-inbox" target="_blank" rel="noopener">Get it on GitHub</a>`;
  return `<h2>Scan your inbox</h2><p>Everything stays on this computer. Only the sender, date and subject of each email are read.</p>
<label class="drop" id="drop"><input type="file" id="pick" accept=".mbox,.mbx,*/*" hidden><span>Drop your mail export here<small>A Google Takeout <b>.mbox</b> file. The most complete, though the export can take a while to arrive.</small></span></label>
<p class="or">or, right now, with an app password</p>
<form id="imap"><label class="field">Your email<input name="user" type="email" autocomplete="off" required></label><label class="field">App password (kept in memory only)<input name="password" type="password" autocomplete="off" required></label><button class="stone go" style="width:100%">Start reading</button><p class="err" id="err" hidden></p></form>`;
}
$('#own').onclick = () => {
  Snd.wake(); Snd.play('creak', .35, .08);
  $('#scanform').innerHTML = scanFormHTML(); $('#scanner').showModal();
  const drop = $('#drop'); if (!drop) return;
  const send = async file => { $('#scanner').close(); Snd.wake(); fetch('/api/scan/file', { method: 'POST', body: file }); await wait(200); watchReal(); };
  $('#pick').onchange = e => e.target.files[0] && send(e.target.files[0]);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); e.dataTransfer.files[0] && send(e.dataTransfer.files[0]); };
  $('#imap').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); try { await post('/api/scan/imap', { user: f.get('user'), password: f.get('password') }); e.target.reset(); $('#scanner').close(); Snd.wake(); watchReal(); } catch (err) { const m = $('#err'); m.textContent = err.message; m.hidden = false; } };
};
$('#scanx').onclick = () => $('#scanner').close();

// ---------- sharing a number, never a name ----------
$('#share').onclick = () => {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 630); gr.addColorStop(0, '#0B0620'); gr.addColorStop(1, '#3B1F6E'); x.fillStyle = gr; x.fillRect(0, 0, 1200, 630);
  const p = new Path2D(GPATH), o = open();
  x.fillStyle = '#0E0726'; x.beginPath(); x.moveTo(0, 630); x.lineTo(0, 520); x.bezierCurveTo(300, 470, 800, 570, 1200, 500); x.lineTo(1200, 630); x.fill();
  for (let k = 0; k < Math.min(o.length, 26); k++) { x.save(); x.translate(60 + (k % 13) * 86 + (k % 2) * 12, k < 13 ? 400 : 480); x.scale(1.2, 1.2); x.fillStyle = '#FFF8EC'; x.strokeStyle = '#160C2E'; x.lineWidth = 3.5; x.fill(p); x.stroke(p); x.fillStyle = '#160C2E'; x.beginPath(); x.roundRect(18, 25, 7, 14, 3.5); x.roundRect(35, 25, 7, 14, 3.5); x.fill(); x.restore(); }
  x.fillStyle = '#FFF8EC'; x.font = '800 84px Display'; x.fillText(`${o.length} ghosts in my inbox.`, 60, 140);
  x.fillStyle = '#FF7DB6'; x.font = '800 46px Display'; x.fillText(`${o.filter(q => q.breaches.length).length} were hacked after I joined.`, 60, 220);
  x.fillStyle = '#FFC83D'; x.font = 'italic 600 32px Display'; x.fillText(S.sample ? 'A made-up inbox. How many are in yours?' : 'How many are in yours?', 60, 290);
  x.fillStyle = '#BDAEEA'; x.font = '400 22px Typed'; x.fillText('Haunted Inbox. Runs on your own computer.', 60, 590);
  const a = document.createElement('a'); a.download = 'my-ghosts.png'; a.href = c.toDataURL('image/png'); a.click();
  say('Saved. It shows only the numbers, no names.');
};

// ---------- start ----------
async function start() {
  applySettings(); resize(); paintStones(); requestAnimationFrame(frame);
  try { const r = await fetch('/api/report'); if (r.ok) { const j = await r.json(); S.local = true; S.web = j.web; S.model = j.model; S.saved = j.report; } } catch {}
  if (S.saved?.ghosts?.length) { const b = document.createElement('button'); b.className = 'stone primary'; b.innerHTML = 'Open my report<small>Pick up where you left off</small>'; b.onclick = () => { Snd.wake(); reopen(); }; $('#cta').prepend(b); }
  heroPreview();
  if (QS.has('dawn')) { S.dawn = S.dawnT = +QS.get('dawn'); paintStones(); }
  else if (S.set.theme !== 'auto') { applySky(); S.dawn = S.dawnT; paintStones(); }
  if (QS.has('walk')) { document.body.classList.add('quick'); runSample(); }
}
