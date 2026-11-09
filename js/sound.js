// ─────────────────────────────────────────────────────────────
//  Moonhollow sound kit: all music & effects are synthesized live
//  with the Web Audio API. No audio files, no downloads, no licences.
//  Modes: 'all' (music + effects) → 'sfx' (effects only) → 'off'
// ─────────────────────────────────────────────────────────────

const KEY = 'moonhollow-sound';
let ctx = null, master, musicBus, sfxBus, verbIn, melBus, drumBus;
let mode = (() => { try { return localStorage.getItem(KEY) || 'all'; } catch { return 'all'; } })();
let current = null, wanted = null, nextT = 0, step = 0, timer = null;

const N = (name) => {               // note name → frequency, e.g. 'A4'
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (semis + (+m[3] - 4) * 12) / 12);
};

function impulse(seconds, c = ctx) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

function buildGraph(c) {
  master = c.createGain(); master.gain.value = 0.9; master.connect(c.destination);
  // music: everything passes through musicBus (the 🔊 setting turns it up/down)
  musicBus = c.createGain(); musicBus.connect(master);
  drumBus = c.createGain(); drumBus.gain.value = 0.85; drumBus.connect(musicBus);  // drums stay dry & punchy
  melBus = c.createGain(); melBus.gain.value = 1.8; melBus.connect(musicBus);   // tunes up front, with a little room
  const mVerb = c.createConvolver(); mVerb.buffer = impulse(1.6, c);
  const mWet = c.createGain(); mWet.gain.value = 0.22;
  melBus.connect(mVerb).connect(mWet).connect(musicBus);
  // sound effects
  sfxBus = c.createGain(); sfxBus.connect(master);
  const verb = c.createConvolver(); verb.buffer = impulse(2.8, c);
  const wet = c.createGain(); wet.gain.value = 0.32;
  verbIn = c.createGain();
  verbIn.connect(verb).connect(wet).connect(master);
  sfxBus.connect(verbIn);
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  buildGraph(ctx);
  applyMode(true);
  return ctx;
}

function applyMode(instant) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const set = (g, v) => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(v, t, instant ? 0.001 : 0.25); };
  set(musicBus, mode === 'all' ? 0.85 : 0);
  set(sfxBus, mode === 'off' ? 0 : 1);
}

// Browsers only allow sound after the first tap/click.
function unlock() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (wanted !== current) startMusic(wanted);
}
['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, unlock, { passive: true }));
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});

// ── building blocks ──────────────────────────────────────────
function tone({ f, type = 'sine', at = 0, dur = 0.3, vol = 0.2, attack = 0.01, to = null, bus = sfxBus, lp = null, detune = 0 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (lp) { const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lp; o.connect(flt); node = flt; }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise({ at = 0, dur = 0.3, vol = 0.15, type = 'bandpass', f = 1200, to = null, q = 1, bus = sfxBus }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t);
  if (to) flt.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(flt).connect(g).connect(bus);
  s.start(t); s.stop(t + dur + 0.05);
}

function bell(f, at = 0, vol = 0.12, dur = 1.6, bus = sfxBus) {
  tone({ f, at, vol, dur, bus });
  tone({ f: f * 2.76, at, vol: vol * 0.35, dur: dur * 0.5, bus });
  tone({ f: f * 5.4, at, vol: vol * 0.12, dur: dur * 0.25, bus });
}

function howlVoice(at, base, vol, len) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'sine';
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
  const lfoG = ctx.createGain(); lfoG.gain.setValueAtTime(0, t); lfoG.gain.linearRampToValueAtTime(base * 0.025, t + len * 0.5);
  lfo.connect(lfoG); lfoG.connect(o.frequency); lfoG.connect(o2.frequency);
  for (const osc of [o, o2]) {
    osc.frequency.setValueAtTime(base * 0.62, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.12, t + len * 0.28);
    osc.frequency.linearRampToValueAtTime(base * 1.18, t + len * 0.7);
    osc.frequency.exponentialRampToValueAtTime(base * 0.78, t + len);
  }
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = base * 2.6; flt.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.35);
  g.gain.setValueAtTime(vol, t + len * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const g2 = ctx.createGain(); g2.gain.value = 0.6;
  o.connect(flt).connect(g); o2.connect(g2).connect(g); g.connect(sfxBus);
  [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + len + 0.1); });
}

// ── sound effects ────────────────────────────────────────────
const FX = {
  tap() { tone({ f: 520, to: 820, dur: 0.09, vol: 0.09, type: 'sine' }); },
  select() { tone({ f: N('E5'), dur: 0.12, vol: 0.12, type: 'triangle' }); tone({ f: N('B5'), at: 0.07, dur: 0.18, vol: 0.12, type: 'triangle' }); },
  unselect() { tone({ f: N('B5'), dur: 0.1, vol: 0.09, type: 'triangle' }); tone({ f: N('E5'), at: 0.06, dur: 0.14, vol: 0.09, type: 'triangle' }); },
  flip() { noise({ dur: 0.38, vol: 0.16, f: 500, to: 3800, q: 0.8 }); tone({ f: N('C6'), at: 0.28, dur: 0.6, vol: 0.06 }); },
  join() { [N('C5'), N('E5'), N('G5')].forEach((f, i) => bell(f, i * 0.09, 0.08, 1)); },
  howl() { howlVoice(0, 430, 0.12, 2.8); howlVoice(0.5, 360, 0.07, 2.6); },
  morning() {
    [N('G5'), N('B5'), N('D6'), N('G6')].forEach((f, i) => bell(f, i * 0.14, 0.09, 1.8));
    for (let i = 0; i < 3; i++) tone({ f: 2600, to: 3800, at: 0.9 + i * 0.13, dur: 0.09, vol: 0.03 });
  },
  death() {
    ['G4', 'F#4', 'F4', 'E4'].forEach((n, i) => tone({ f: N(n), at: i * 0.32, dur: i === 3 ? 1.1 : 0.34, vol: 0.1, type: 'triangle', lp: 1400 }));
  },
  day() { [N('C5'), N('G5')].forEach((f, i) => bell(f, i * 0.12, 0.06, 1.2)); },
  vote() { bell(N('A5'), 0, 0.1, 1); bell(N('E6'), 0.12, 0.08, 1.2); },
  cast() { tone({ f: 340, to: 180, dur: 0.12, vol: 0.13 }); noise({ dur: 0.06, vol: 0.05, f: 2000 }); },
  gong() {
    [1, 2.02, 2.76, 3.9, 5.1].forEach((m, i) => tone({ f: 98 * m, to: 96 * m, dur: 3.4 - i * 0.4, vol: 0.12 / (i + 1), attack: 0.005 }));
    noise({ dur: 0.4, vol: 0.05, f: 600, type: 'lowpass' });
  },
  seer() { ['E6', 'G#6', 'B6', 'E7', 'B6'].forEach((n, i) => bell(N(n), i * 0.08, 0.05, 1.4)); },
  tick() { tone({ f: 1250, dur: 0.05, vol: 0.06 }); },
  win() {
    const notes = ['C5', 'E5', 'G5', 'C6'];
    notes.forEach((n, i) => tone({ f: N(n), at: i * 0.12, dur: 0.22, vol: 0.12, type: 'square', lp: 2400 }));
    ['C6', 'E6', 'G6'].forEach((n) => tone({ f: N(n), at: 0.5, dur: 1.4, vol: 0.07, type: 'triangle' }));
    ['C7', 'G6', 'E7'].forEach((n, i) => bell(N(n), 0.6 + i * 0.1, 0.03, 1));
  },
  lose() {
    howlVoice(0, 380, 0.1, 2.4);
    ['A3', 'C4', 'E4'].forEach((n) => tone({ f: N(n), at: 0.4, dur: 2.2, vol: 0.05, type: 'triangle', lp: 900, attack: 0.3 }));
  },
};

export function play(name) {
  if (mode === 'off' || !ensure() || ctx.state !== 'running') return;
  try { FX[name]?.(); } catch (e) { console.warn('sfx', e); }
}

// ── background music: two original, playful tunes ─────────────
// A tiny step sequencer: each song is 16 sixteenth-notes per bar, looping.
// Instruments are synthesized, so there are no audio files.
const I = {
  kick(at, v = 0.32) { tone({ f: 150, to: 42, at, dur: 0.22, vol: v, attack: 0.002, bus: drumBus }); },
  clap(at, v = 0.07) {
    for (const d of [0, 0.012, 0.024]) noise({ at: at + d, dur: 0.09, vol: v, f: 1500, q: 0.9, bus: drumBus });
  },
  hat(at, v = 0.022) { noise({ at, dur: 0.035, vol: v, type: 'highpass', f: 7500, bus: drumBus }); },
  shaker(at, v = 0.016) { noise({ at, dur: 0.06, vol: v, type: 'highpass', f: 5200, bus: drumBus }); },
  block(at, f = 900, v = 0.05) { tone({ f, at, dur: 0.07, vol: v, attack: 0.001, bus: drumBus }); tone({ f: f * 2.4, at, dur: 0.03, vol: v * 0.4, attack: 0.001, bus: drumBus }); },
  // plucky round bass (a cartoon double-bass pizzicato)
  bass(at, n, len = 0.22, v = 0.11) {
    tone({ f: N(n), type: 'triangle', at, dur: len, vol: v, attack: 0.004, lp: 700, bus: melBus });
    tone({ f: N(n) / 2, type: 'sine', at, dur: len * 0.9, vol: v * 0.55, attack: 0.004, bus: melBus });
  },
  // marimba-ish pluck for the melody
  pluck(at, n, len = 0.28, v = 0.06) {
    tone({ f: N(n), type: 'sine', at, dur: len, vol: v, attack: 0.002, bus: melBus });
    tone({ f: N(n) * 4, type: 'sine', at, dur: len * 0.25, vol: v * 0.25, attack: 0.001, bus: melBus });
  },
  // ukulele-ish chord stab
  strum(at, notes, v = 0.03) { notes.forEach((n, i) => tone({ f: N(n), type: 'triangle', at: at + i * 0.012, dur: 0.18, vol: v, attack: 0.003, lp: 2600, bus: melBus })); },
  // a soft whistle for the day tune
  whistle(at, n, len = 0.3, v = 0.035) { tone({ f: N(n), type: 'sine', at, dur: len, vol: v, attack: 0.03, bus: melBus }); },
  // a playful ghostly "wooo" slide (night spice)
  boo(at) { tone({ f: N('E5'), to: N('A4'), type: 'sine', at, dur: 0.7, vol: 0.03, attack: 0.08, bus: melBus }); },
};
// parse "A2 . E2 . | ..." into arrays of 16 steps per bar ('.' = rest, '-' = hold)
const bars = (str) => str.split('|').map((b) => b.trim().split(/\s+/));

const SONGS = {
  // 🌙 "Tiptoe Through Moonhollow": sneaky, bouncy, a little spooky (A minor, swing)
  night: {
    bpm: 108, swing: 0.16, bars: 8,
    bass: bars(`A2 . . . E2 . . . A2 . . . C3 . E2 . | F2 . . . C3 . . . F2 . . . A2 . C3 . |
                D2 . . . A2 . . . D2 . . . F2 . A2 . | E2 . . . B2 . . . E2 . G#2 . B2 . E2 .`),
    lead: bars(`E5 . . E5 F5 . E5 . . . C5 . . . . . | D5 . . D5 E5 . D5 . . . A4 . . . . . |
                F5 . . F5 E5 . D5 . C5 . . B4 . . . . | B4 . C5 . D5 . . . E5 . . . . . . . |
                E5 . . E5 F5 . E5 . . . C5 . A4 . . . | D5 . . F5 E5 . D5 . C5 . . A4 . . . . |
                F5 . E5 . D5 . C5 . B4 . . G#4 . . . . | A4 . . . . . . . . . . . . . . .`),
    play(s, at) {
      const st = this.stepLen, i = s % 16, bar = Math.floor(s / 16) % this.bars;
      if (i % 2) at += st * this.swing;                        // swing the off-beats
      if (i === 0 || i === 8) I.kick(at, 0.2);
      if (i === 4 || i === 12) I.block(at, 1050, 0.045);      // tick…
      if (i === 6 || i === 14) I.block(at, 760, 0.035);       // …tock
      if (i % 2 === 0) I.hat(at, 0.012);
      const b = this.bass[bar % 4][i]; if (b && b !== '.') I.bass(at, b, 0.2, 0.1);
      const n = this.lead[bar][i]; if (n && n !== '.') I.pluck(at, n, 0.26, 0.05);
      if (bar === 7 && i === 8) I.boo(at);                      // a little ghost every 8 bars
    },
  },
  // ☀️ "Village Fair": sunny, bouncy, whistle-able (C major, I–vi–IV–V)
  day: {
    bpm: 120, swing: 0.1, bars: 8,
    chords: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']],
    bass: bars(`C3 . . . G2 . C3 . . . G2 . C3 . E3 . | A2 . . . E2 . A2 . . . E2 . A2 . C3 . |
                F2 . . . C3 . F2 . . . C3 . F2 . A2 . | G2 . . . D3 . G2 . . . B2 . G2 . D3 .`),
    lead: bars(`E5 . G5 . A5 . G5 . E5 . . . C5 . D5 . | E5 . . . E5 . D5 . C5 . . . A4 . . . |
                F5 . . . A5 . . . G5 . F5 . E5 . . . | D5 . . . E5 . F5 . G5 . . . . . . . |
                E5 . G5 . A5 . G5 . E5 . . . C5 . D5 . | E5 . . . E5 . D5 . C5 . A4 . C5 . . . |
                F5 . E5 . D5 . . . B4 . . . D5 . . . | C5 . . . . . . . G5 . E5 . C5 . . .`),
    play(s, at) {
      const st = this.stepLen, i = s % 16, bar = Math.floor(s / 16) % this.bars;
      if (i % 2) at += st * this.swing;
      if (i === 0 || i === 8 || i === 10) I.kick(at, i === 10 ? 0.16 : 0.26);
      if (i === 4 || i === 12) I.clap(at);
      if (i % 2 === 0) I.hat(at, 0.02); else I.shaker(at);
      if (i === 2 || i === 6 || i === 10 || i === 14) I.strum(at, this.chords[bar % 4]);
      const b = this.bass[bar % 4][i]; if (b && b !== '.') I.bass(at, b, 0.18, 0.11);
      const n = this.lead[bar][i];
      if (n && n !== '.') (bar < 4 ? I.pluck(at, n, 0.24, 0.055) : I.whistle(at, n, 0.28, 0.04));
    },
  },
};
for (const song of Object.values(SONGS)) song.stepLen = 60 / song.bpm / 4;   // one sixteenth note

function startMusic(name) {
  current = name;
  if (!name || !ctx) return;
  nextT = ctx.currentTime + 0.15; step = 0;
  if (!timer) timer = setInterval(pump, 150);
}

function pump() {
  if (!ctx || !current || ctx.state !== 'running' || mode !== 'all') { if (ctx) nextT = Math.max(nextT, ctx.currentTime); return; }
  const song = SONGS[current];
  while (nextT < ctx.currentTime + 0.5) {
    try { song.play(step, nextT - ctx.currentTime); } catch {}
    nextT += song.stepLen; step++;
  }
}

/** choose the background song: 'night' | 'day' | null */
export function music(name) {
  wanted = name;
  if (ctx && ctx.state === 'running' && name !== current) startMusic(name);
}

export function getMode() { return mode; }
export function cycleMode() {
  mode = mode === 'all' ? 'sfx' : mode === 'sfx' ? 'off' : 'all';
  try { localStorage.setItem(KEY, mode); } catch {}
  ensure(); applyMode();
  if (mode === 'all' && ctx) { ctx.resume(); startMusic(wanted); }
  return mode;
}

/** Render a song to raw audio offline (for exporting a preview). */
export async function renderPreview(name, seconds = 20, rate = 44100) {
  const saved = { ctx, master, musicBus, sfxBus, verbIn, melBus, drumBus, mode };
  const off = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  ctx = off; mode = 'all';
  buildGraph(off); musicBus.gain.value = 0.85;
  const song = SONGS[name];
  for (let t = 0.05, k = 0; t < seconds - 0.5; t += song.stepLen, k++) song.play(k, t);
  const buf = await off.startRendering();
  ({ ctx, master, musicBus, sfxBus, verbIn, melBus, drumBus, mode } = saved);
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
