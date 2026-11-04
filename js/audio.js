// Synthesized sound effects and a small step-sequencer for music. No audio files needed.
(function () {
  'use strict';
  const G = window.G;

  const A = (G.audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    muted: false,
    musicVol: 0.5,
    sfxVol: 0.8,
    last: {},
    track: null,
    pendingTrack: null,
  });

  let noiseBuf = null;

  A.unlock = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      A.ctx = new AC();
    } catch (e) {
      return;
    }
    const c = A.ctx;
    A.master = c.createGain();
    A.master.gain.value = A.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    A.master.connect(comp);
    comp.connect(c.destination);
    A.sfxBus = c.createGain();
    A.sfxBus.gain.value = A.sfxVol;
    A.sfxBus.connect(A.master);
    A.musicBus = c.createGain();
    A.musicBus.gain.value = A.musicVol * 0.55;
    A.musicBus.connect(A.master);
    noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (A.pendingTrack) {
      const t = A.pendingTrack;
      A.pendingTrack = null;
      A.music(t);
    }
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.master) A.master.gain.value = m ? 0 : 0.9;
  };
  A.setVolumes = function (music, sfx) {
    A.musicVol = music;
    A.sfxVol = sfx;
    if (A.musicBus) A.musicBus.gain.value = music * 0.55;
    if (A.sfxBus) A.sfxBus.gain.value = sfx;
  };

  function tone(freq, dur, type, vol, slideTo, bus, when, attack = 0.004) {
    const c = A.ctx;
    const t = when || c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || A.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterType, freq, bus, when, slideTo) {
    const c = A.ctx;
    const t = when || c.currentTime;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filterType || 'lowpass';
    f.frequency.setValueAtTime(freq || 2000, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus || A.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  const SFX = {
    laser: () => tone(880, 0.09, 'square', 0.08, 220),
    repeater: () => tone(1200, 0.06, 'square', 0.05, 500),
    scatter: () => { noise(0.12, 0.18, 'bandpass', 1800, null, null, 400); tone(300, 0.1, 'sawtooth', 0.06, 120); },
    rail: () => { tone(1600, 0.25, 'sawtooth', 0.09, 90); noise(0.2, 0.1, 'highpass', 3000); },
    enemyShot: () => tone(520, 0.12, 'triangle', 0.05, 260),
    hit: () => tone(240, 0.05, 'square', 0.06, 120),
    boom: () => { noise(0.45, 0.45, 'lowpass', 1600, null, null, 120); tone(120, 0.35, 'sine', 0.3, 35); },
    bigboom: () => { noise(1.2, 0.6, 'lowpass', 1200, null, null, 60); tone(80, 1.0, 'sine', 0.45, 25); },
    hurt: () => { noise(0.25, 0.4, 'lowpass', 900); tone(160, 0.25, 'sawtooth', 0.15, 60); },
    shieldHit: () => { tone(660, 0.12, 'sine', 0.12, 330); noise(0.08, 0.12, 'highpass', 4000); },
    shieldDown: () => { tone(500, 0.4, 'square', 0.1, 80); },
    shieldUp: () => { tone(300, 0.3, 'sine', 0.08, 900); },
    pickup: () => { tone(880, 0.08, 'square', 0.06); tone(1320, 0.12, 'square', 0.05, null, null, A.ctx.currentTime + 0.06); },
    scrap: () => tone(1500 + Math.random() * 300, 0.05, 'triangle', 0.05),
    cache: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, null, null, A.ctx.currentTime + i * 0.07)); },
    missile: () => { noise(0.35, 0.18, 'bandpass', 900, null, null, 3000); },
    nova: () => { tone(60, 1.2, 'sawtooth', 0.25, 30); noise(1.0, 0.4, 'lowpass', 3000, null, null, 100); },
    dodge: () => noise(0.25, 0.2, 'bandpass', 600, null, null, 3000),
    ring: () => { tone(988, 0.12, 'sine', 0.1); tone(1480, 0.2, 'sine', 0.08, null, null, A.ctx.currentTime + 0.08); },
    alarm: () => { tone(880, 0.18, 'square', 0.07); tone(660, 0.18, 'square', 0.07, null, null, A.ctx.currentTime + 0.2); },
    menu: () => tone(660, 0.04, 'square', 0.04),
    select: () => { tone(523, 0.07, 'square', 0.06); tone(784, 0.1, 'square', 0.06, null, null, A.ctx.currentTime + 0.05); },
    back: () => tone(392, 0.08, 'square', 0.05, 262),
    jump: () => tone(300, 0.18, 'square', 0.07, 700),
    land: () => noise(0.1, 0.2, 'lowpass', 500),
    thunder: () => noise(1.6, 0.5, 'lowpass', 500, null, null, 60),
    engine: () => tone(90, 0.3, 'sawtooth', 0.05, 140),
    upgrade: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.06, null, null, A.ctx.currentTime + i * 0.06)); },
    radio: () => { noise(0.06, 0.08, 'bandpass', 2500); tone(1800, 0.04, 'square', 0.03); },
    grenade: () => tone(200, 0.1, 'triangle', 0.08, 400),
    dash: () => noise(0.18, 0.2, 'bandpass', 1200, null, null, 300),
  };

  A.play = function (name) {
    if (!A.ctx || A.muted || !noiseBuf) return;
    const now = performance.now();
    if (A.last[name] && now - A.last[name] < 35) return;
    A.last[name] = now;
    const f = SFX[name];
    if (f) {
      try { f(); } catch (e) { /* ignore audio scheduling errors */ }
    }
  };

  // ---------------- Music ----------------
  // Chords are semitone offsets from the track root. Patterns are 16 steps per bar.
  const TRACKS = {
    title: { bpm: 92, root: 45, prog: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]], bass: 'x.......x...x...', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', arp: 2, lead: 0.35, pad: true },
    hangar: { bpm: 84, root: 43, prog: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-2, 2, 5]], bass: 'x.....x.........', kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', arp: 4, lead: 0.25, pad: true },
    flight: { bpm: 140, root: 45, prog: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]], bass: 'x.xxx.xxx.xxx.xx', kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..x...x...x...x.', arp: 1, lead: 0.5 },
    storm: { bpm: 132, root: 40, prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5]], bass: 'x..x..x.x..x..x.', kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', arp: 1, lead: 0.4 },
    station: { bpm: 128, root: 42, prog: [[0, 3, 7], [3, 7, 10], [5, 8, 12], [-2, 2, 5]], bass: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x', arp: 1, lead: 0.45 },
    space: { bpm: 146, root: 44, prog: [[0, 3, 7], [-4, 0, 3], [-5, -1, 2], [-2, 2, 5]], bass: 'x.xxx.xxx.xxx.xx', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..xx..xx..xx..xx', arp: 1, lead: 0.55 },
    boss: { bpm: 156, root: 41, prog: [[0, 3, 6], [0, 3, 6], [1, 4, 8], [-1, 3, 6]], bass: 'xxx.xxx.xxx.xx.x', kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x.xx', hat: 'xxxxxxxxxxxxxxxx', arp: 1, lead: 0.6 },
    bike: { bpm: 150, root: 47, prog: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], bass: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', arp: 1, lead: 0.5 },
    foot: { bpm: 108, root: 38, prog: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-4, 0, 3]], bass: 'x..x....x..x..x.', kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', arp: 2, lead: 0.3 },
    gauntlet: { bpm: 168, root: 46, prog: [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [-4, 0, 3]], bass: 'xxxxxxxxxxxxxxxx', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: 1, lead: 0.6 },
    victory: { bpm: 110, root: 48, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bass: 'x...x...x...x...', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', arp: 2, lead: 0.5, pad: true },
  };

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function makeLead(tr) {
    // A repeating two-bar phrase built from chord tones, so it always fits the harmony.
    const steps = [];
    for (let i = 0; i < 32; i++) {
      const on = i % 2 === 0 ? Math.random() < tr.lead : Math.random() < tr.lead * 0.3;
      steps.push(on ? Math.floor(Math.random() * 4) : -1);
    }
    return steps;
  }

  let sched = null;
  A.music = function (name) {
    if (!A.ctx) {
      A.pendingTrack = name;
      return;
    }
    if (A.track && A.track.name === name) return;
    A.stopMusic();
    const tr = TRACKS[name];
    if (!tr) return;
    A.track = { name, tr, step: 0, next: A.ctx.currentTime + 0.1, lead: makeLead(tr) };
    sched = setInterval(tick, 25);
  };
  A.stopMusic = function () {
    if (sched) clearInterval(sched);
    sched = null;
    A.track = null;
  };

  function tick() {
    const T = A.track;
    if (!T || !A.ctx) return;
    const c = A.ctx;
    const tr = T.tr;
    const stepDur = 60 / tr.bpm / 4;
    const bus = A.musicBus;
    while (T.next < c.currentTime + 0.12) {
      const s = T.step % 16;
      const bar = Math.floor(T.step / 16) % tr.prog.length;
      const chord = tr.prog[bar];
      const when = T.next;
      if (tr.kick[s] === 'x') tone(150, 0.22, 'sine', 0.5, 40, bus, when);
      if (tr.snare[s] === 'x') { noise(0.16, 0.22, 'bandpass', 1800, bus, when); tone(200, 0.08, 'triangle', 0.1, 120, bus, when); }
      if (tr.hat[s] === 'x') noise(0.04, 0.07, 'highpass', 7000, bus, when);
      if (tr.bass[s] === 'x') {
        const n = tr.root + chord[0] + (s % 4 === 2 ? 12 : 0);
        tone(midi(n), stepDur * 0.9, 'sawtooth', 0.13, null, bus, when);
        tone(midi(n - 12), stepDur * 0.9, 'square', 0.06, null, bus, when);
      }
      if (s % tr.arp === 0) {
        const idx = Math.floor(s / tr.arp) % 3;
        const n = tr.root + 24 + chord[idx] + (Math.floor(s / 8) % 2 ? 12 : 0);
        tone(midi(n), stepDur * 0.7, 'square', 0.028, null, bus, when);
      }
      if (tr.pad && s === 0) {
        for (const off of chord) tone(midi(tr.root + 12 + off), stepDur * 15, 'triangle', 0.035, null, bus, when, 0.3);
      }
      const li = T.lead[T.step % 32];
      if (li >= 0) {
        const n = tr.root + 36 + (li < 3 ? chord[li] : chord[0] + 12);
        tone(midi(n), stepDur * 1.6, 'triangle', 0.06, null, bus, when);
      }
      T.next += stepDur;
      T.step++;
    }
  }
})();
