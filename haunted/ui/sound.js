'use strict';
// Every sound comes from an instrument built here: a ghost's throat, a music box, rusty iron, gravel, wind. Nothing is downloaded.
// Each one takes (context, time, output, ...), so the same code plays live and renders the film's soundtrack.
const Snd = (() => {
  let ctx = null, master = null, bed = null, musicTimer = 0, noteIndex = 0;
  const api = { log: null };
  const R = (a, b) => a + Math.random() * (b - a);
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  // the night is in D Hijaz, which sounds old and a little wrong. Each ghost you settle pulls it towards D major
  const NIGHT = [62, 63, 66, 67, 69, 70, 72, 74], DAY = [62, 64, 66, 67, 69, 71, 73, 74];
  const scale = (i, dawn) => (dawn > .55 ? DAY : NIGHT)[((i % 8) + 8) % 8];

  function noise(c) {
    if (c.__noise) return c.__noise;
    const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (c.__noise = b);
  }
  const hiss = (c, t, len) => { const s = c.createBufferSource(); s.buffer = noise(c); s.start(t, Math.random() * 2, len + .05); return s; };
  const gain = (c, v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
  const shape = (c, t, a, peak, d) => { const g = gain(c); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return g; };
  const filt = (c, type, f, q = 1) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };

  // Karplus-Strong: a burst of noise bouncing round a short loop. It sounds plucked because that is more or less what plucking is
  const pluckCache = new Map();
  function plucked(c, f, len = 2.2, soft = .5) {
    const key = c.sampleRate + ':' + Math.round(f) + ':' + soft;
    if (pluckCache.has(key)) return pluckCache.get(key);
    const N = Math.max(2, Math.round(c.sampleRate / f)), loop = new Float32Array(N), buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) loop[i] = Math.random() * 2 - 1;
    for (let i = 0, p = 0; i < d.length; i++) { const n = (p + 1) % N; d[i] = loop[p]; loop[p] = .9972 * ((1 - soft) * loop[p] + soft * loop[n]); p = n; }
    pluckCache.set(key, buf);
    return buf;
  }

  const FX = {
    // a ghost's voice: two soft buzzes through the mouth shapes of "oo" opening to "oh". Every ghost keeps its own pitch
    hoo(c, t, out, seed = 0, len = .75, vol = .2, rise = 1.06) {
      const f = hz(scale(seed, 0) - 12 + (seed % 3 === 0 ? 12 : 0)), mix = gain(c, 1), f1 = filt(c, 'bandpass', 300, 5), f2 = filt(c, 'bandpass', 780, 7), env = gain(c);
      for (const d of [-.5, .5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * .96, t); o.frequency.exponentialRampToValueAtTime(f * rise, t + len * .5); o.frequency.exponentialRampToValueAtTime(f * .94, t + len); o.detune.value = d * 11; const v = c.createOscillator(), vg = gain(c, f * .012); v.frequency.value = 5.1; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + len + .1); o.connect(mix); o.start(t); o.stop(t + len + .1); }
      f1.frequency.setValueAtTime(290, t); f1.frequency.linearRampToValueAtTime(430, t + len * .6);
      const breath = hiss(c, t, len), bg = gain(c, .05), bf = filt(c, 'bandpass', 950, .8); breath.connect(bf).connect(bg).connect(env);
      mix.connect(f1).connect(env); mix.connect(f2).connect(gain(c, .5)).connect(env);
      env.gain.setValueAtTime(.0001, t); env.gain.exponentialRampToValueAtTime(vol, t + .11); env.gain.setValueAtTime(vol, t + len * .55); env.gain.exponentialRampToValueAtTime(.0001, t + len);
      env.connect(out);
    },
    // letting go: the voice climbs and thins out as it leaves
    sigh(c, t, out, seed = 0) {
      FX.hoo(c, t, out, seed, 1.15, .24, 2.6);
      const n = hiss(c, t, 1.1), f = filt(c, 'bandpass', 700, 3), g = shape(c, t, .25, .1, .85); f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3400, t + 1.05); n.connect(f).connect(g).connect(out);
    },
    // a music box tine: a plucked note with a tiny metal tick on top
    tine(c, t, out, midi = 74, vol = .26) {
      const s = c.createBufferSource(); s.buffer = plucked(c, hz(midi), 2.2, .42); const g = shape(c, t, .003, vol, 2.1); s.connect(g).connect(out); s.start(t);
      const o = c.createOscillator(); o.frequency.value = hz(midi) * 5.41; const k = shape(c, t, .001, vol * .22, .07); o.connect(k).connect(out); o.start(t); o.stop(t + .1);
    },
    settle(c, t, out, i = 0, dawn = 0) { FX.tine(c, t, out, scale(i, dawn) + 12); FX.tine(c, t + .13, out, scale(i + 2, dawn) + 12, .17); FX.tine(c, t + .29, out, scale(i + 4, dawn) + 24, .13); },
    // the mailbox's iron door: a few bright partials that don't line up, like real struck metal
    clank(c, t, out, vol = .22) {
      for (const [r, a, d] of [[1, 1, .28], [2.76, .6, .17], [5.4, .4, .1], [8.93, .22, .06]]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 370 * r * R(.99, 1.01); const g = shape(c, t, .002, vol * a, d); o.connect(g).connect(out); o.start(t); o.stop(t + d + .05); }
      const n = hiss(c, t, .03), hp = filt(c, 'highpass', 2500), g = shape(c, t, .001, vol * .5, .03); n.connect(hp).connect(g).connect(out);
    },
    // a rusty hinge: a slow saw that catches and slips, heard through thin metal
    creak(c, t, out, len = .55, vol = .12) {
      const o = c.createOscillator(); o.type = 'sawtooth'; const curve = new Float32Array(26); for (let i = 0; i < 26; i++) curve[i] = 42 + 46 * (i / 25) + R(-16, 16); o.frequency.setValueCurveAtTime(curve, t, len);
      const a = filt(c, 'bandpass', 1500, 14), b = filt(c, 'bandpass', 2750, 16), g = shape(c, t, .05, vol, len - .05); o.connect(a).connect(g); o.connect(b).connect(g); g.connect(out); o.start(t); o.stop(t + len + .05);
    },
    gulp(c, t, out) {
      const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(330, t + .09); o.frequency.exponentialRampToValueAtTime(70, t + .2); const f = filt(c, 'lowpass', 900, 6), g = shape(c, t, .02, .34, .2); o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + .28);
    },
    flag(c, t, out) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 610; const v = c.createOscillator(), vg = gain(c, 90); v.frequency.value = 26; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + .36); const g = shape(c, t, .004, .1, .32); o.connect(g).connect(out); o.start(t); o.stop(t + .36);
    },
    // paper: a flutter of air that opens and shuts
    paper(c, t, out, len = .55) {
      const n = hiss(c, t, len), f = filt(c, 'highpass', 1900), g = gain(c); g.gain.setValueAtTime(.0001, t);
      for (let k = t, on = true; k < t + len; k += R(.022, .05), on = !on) g.gain.setTargetAtTime(on ? .055 * (1 - (k - t) / len) + .004 : .004, k, .006);
      g.gain.setTargetAtTime(.0001, t + len, .02); n.connect(f).connect(g).connect(out);
    },
    // gravel under the keeper's feet: a handful of tiny crunches
    step(c, t, out, vol = .05) {
      for (let k = 0, n = 3 + Math.floor(R(0, 4)); k < n; k++) { const at = t + R(0, .05), s = hiss(c, at, .03), f = filt(c, 'bandpass', R(1300, 4100), 1.2), g = shape(c, at, .002, vol * R(.5, 1), R(.012, .034)); s.connect(f).connect(g).connect(out); }
    },
    // a stone going down: soil on top of a low thud
    thump(c, t, out, vol = .34) {
      const o = c.createOscillator(); o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(40, t + .2); const g = shape(c, t, .004, vol, .22); o.connect(g).connect(out); o.start(t); o.stop(t + .3);
      const n = hiss(c, t, .2), f = filt(c, 'lowpass', 520), ng = shape(c, t, .004, vol * .45, .18); n.connect(f).connect(ng).connect(out);
      for (let k = 0; k < 4; k++) FX.step(c, t + .06 + k * .05, out, vol * .12);
    },
    grind(c, t, out, len = .62) {
      const n = hiss(c, t, len), f = filt(c, 'bandpass', 620, .7), g = gain(c); g.gain.setValueAtTime(.0001, t);
      for (let k = t; k < t + len; k += .024) g.gain.setValueAtTime(R(.02, .16) * (1 - .55 * (k - t) / len), k);
      g.gain.setTargetAtTime(.0001, t + len, .03); n.connect(f).connect(g).connect(out);
    },
    // a match catching: a scratch, a few crackles, then a soft breath of flame
    strike(c, t, out, vol = .11) {
      const s = hiss(c, t, .07), hp = filt(c, 'highpass', 3000), g = shape(c, t, .003, vol, .06); s.connect(hp).connect(g).connect(out);
      for (let k = 0; k < 5; k++) { const at = t + .05 + R(0, .22), n = hiss(c, at, .012), f = filt(c, 'highpass', 4200), ng = shape(c, at, .001, vol * .5, .01); n.connect(f).connect(ng).connect(out); }
      const fl = hiss(c, t + .05, .4), lp = filt(c, 'lowpass', 700), fg = shape(c, t + .05, .08, vol * .5, .3); fl.connect(lp).connect(fg).connect(out);
    },
    // holding: the ghost hums lower and lower, and the note can be cut short
    hold(c, t, out, seed = 0, len = .9) {
      const f = hz(scale(seed, 0) - 12), o = c.createOscillator(), o2 = c.createOscillator(); o.type = o2.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .5, t + len); o2.frequency.setValueAtTime(f * 1.5, t); o2.frequency.exponentialRampToValueAtTime(f * .75, t + len);
      const fo = filt(c, 'bandpass', 340, 4), g = gain(c); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .25); g.gain.setValueAtTime(.18, t + len - .05); g.gain.exponentialRampToValueAtTime(.0001, t + len + .1);
      o.connect(fo); o2.connect(fo); fo.connect(g).connect(out); o.start(t); o2.start(t); o.stop(t + len + .15); o2.stop(t + len + .15);
      return () => { const n = c.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(.0001, n, .04); o.stop(n + .2); o2.stop(n + .2); };
    },
    bell(c, t, out, midi = 50, vol = .1) {
      for (const [r, a, d] of [[.5, 1, 4], [1, .8, 3], [1.2, .4, 2.2], [1.5, .3, 1.8], [2, .3, 1.5], [2.51, .14, 1.1]]) { const o = c.createOscillator(); o.frequency.value = hz(midi) * r; const g = shape(c, t, .004, vol * a, d); o.connect(g).connect(out); o.start(t); o.stop(t + d + .1); }
    },
    wind(c, t, out, len, from = 1, to = 1) {
      const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true; const f = filt(c, 'lowpass', 380, 1.4), g = gain(c), w = c.createOscillator(), wg = gain(c, 170); w.frequency.value = .09; w.connect(wg).connect(f.frequency);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.075 * from + .0002, t + 2); g.gain.linearRampToValueAtTime(.075 * to + .0002, t + len - .5); g.gain.linearRampToValueAtTime(.0001, t + len);
      s.connect(f).connect(g).connect(out); s.start(t); w.start(t); s.stop(t + len); w.stop(t + len); return g;
    },
    bird(c, t, out, vol = .04) {
      const b = R(2100, 3400), o = c.createOscillator(); for (let k = 0; k < 4; k++) { o.frequency.setValueAtTime(b * R(.9, 1.25), t + k * .07); o.frequency.exponentialRampToValueAtTime(b * R(.8, 1.4), t + k * .07 + .05); } const g = shape(c, t, .01, vol, .3); o.connect(g).connect(out); o.start(t); o.stop(t + .35);
    },
    morning(c, t, out) { [62, 69, 74, 78, 81, 86].forEach((m, k) => FX.tine(c, t + k * .13, out, m + 12, .24)); FX.bell(c, t, out, 62, .06); },
    beat(c, t, out) { FX.bell(c, t, out, 50, .05); FX.tine(c, t, out, 74, .1); },
  };

  function wake() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = gain(ctx, S.set.sound ? S.set.volume : 0);
      const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination); startBed();
    }
    ctx.resume?.(); return ctx;
  }
  // the air of the place: wind that dies down with the night, a distant bell, birds once it's morning, and a slow music box
  function startBed() {
    if (!ctx || bed || !S.set.music) return;
    bed = gain(ctx, 1); bed.connect(master);
    let windGain = FX.wind(ctx, ctx.currentTime, bed, 3600);
    bed.__wind = windGain; clearTimeout(musicTimer);
    const tick = () => {
      if (!bed) return;
      const t = ctx.currentTime + .05, d = S.dawn || 0;
      windGain.gain.cancelScheduledValues(t); windGain.gain.setTargetAtTime(.075 * Math.max(.05, 1 - d) + .0002, t, 2);
      const walk = [0, 2, 4, 5, 4, 2, 1, 2][noteIndex % 8] + (noteIndex % 16 > 7 ? 2 : 0);
      if (noteIndex % 2 === 0) FX.tine(ctx, t, bed, scale(walk, d) + 12, .06);
      if (noteIndex % 12 === 0) FX.bell(ctx, t, bed, 50, .018 * (1 - d) + .004);
      if (d > .55 && Math.random() < .5) FX.bird(ctx, t + Math.random(), bed);
      noteIndex++; musicTimer = setTimeout(tick, 1400);
    };
    tick();
  }
  function stopBed() { clearTimeout(musicTimer); if (bed) { const b = bed; bed = null; b.gain.setTargetAtTime(.0001, ctx.currentTime, .3); setTimeout(() => b.disconnect(), 1500); } }

  api.wake = wake;
  api.play = (name, ...args) => {
    if (api.log) { api.log.push([performance.now() / 1000, name, args]); return () => {}; }
    if (!S.set.sound || !FX[name]) return () => {};
    const c = wake(); if (!c) return () => {};
    return FX[name](c, c.currentTime, master, ...args) || (() => {});
  };
  api.apply = () => { if (!ctx) return; master.gain.setTargetAtTime(S.set.sound ? S.set.volume : 0, ctx.currentTime, .05); if (S.set.sound && S.set.music) startBed(); else stopBed(); };
  // the film plays the same instruments, offline, from a list of what happened and when
  api.render = async (events, length, dawnAt, morningAt) => {
    const sr = 44100, off = new OfflineAudioContext(2, Math.ceil(length * sr), sr), out = gain(off, 1), comp = off.createDynamicsCompressor(); out.connect(comp).connect(off.destination);
    const music = gain(off, 1); music.connect(out);
    FX.wind(off, 0, music, dawnAt + 3, 1, .7);
    let i = 0;
    for (let t = 1; t < length - 1.5; t += 1.4, i++) { const d = t > dawnAt ? Math.min(1, (t - dawnAt) / Math.max(1, morningAt - dawnAt)) : 0, walk = [0, 2, 4, 5, 4, 2, 1, 2][i % 8] + (i % 16 > 7 ? 2 : 0); if (i % 2 === 0) FX.tine(off, t, music, scale(walk, d) + 12, .1); if (i % 12 === 0) FX.bell(off, t, music, 50, .05 * (1 - d) + .012); if (i % 8 === 4) FX.hoo(off, t, music, i, 4.8, .035, 1.02); if (d > .55 && i % 2) FX.bird(off, t + .4, music, .03); }
    for (const [t, name, args] of events) if (FX[name] && t < length) { try { FX[name](off, Math.max(.01, t), out, ...args); } catch (e) { console.error(name, e); } }
    const b = await off.startRendering(), L = b.getChannelData(0), Rr = b.getChannelData(1), pcm = new Int16Array(L.length * 2);
    for (let k = 0; k < L.length; k++) { pcm[k * 2] = Math.max(-1, Math.min(1, L[k])) * 32767; pcm[k * 2 + 1] = Math.max(-1, Math.min(1, Rr[k])) * 32767; }
    let bin = ''; const u = new Uint8Array(pcm.buffer); for (let k = 0; k < u.length; k += 32768) bin += String.fromCharCode.apply(null, u.subarray(k, k + 32768));
    return btoa(bin);
  };
  return api;
})();
