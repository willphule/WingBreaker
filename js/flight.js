// Flight mode: a fake-3D rail shooter. The world streams toward the camera; the ship flies in a box ahead of it.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const R = G.r3d;
  const MD = G.models;

  const PZ = 7, FAR = 165, F = 400, GROUND = -7, CEIL = 10, CWALL = 20;
  const BX = 11, BYMIN = -5.2, BYMAX = 7;
  const SHIP_SC = 0.48;

  // Pattern weights per theme: [name, weight, earliest time]
  const THEMES = {
    canyon: {
      sky: ['#2a1838', '#a8503a', '#f0a868'], fog: '#e09468', fogStart: 40, ground: ['#b8683f', '#a65b36'], walls: true,
      music: 'flight', length: 80, sun: '#ffd9a0',
      patterns: [['darts', 3], ['swoop', 2], ['turrets', 2], ['pillars', 3], ['arch', 2], ['wallgap', 1.6, 8], ['gunship', 1.2, 22], ['chasers', 1, 34], ['boostrings', 0.7]],
      bonusTimes: [16, 34, 52, 70], bonusKind: 'pylon',
      intro: [['harrow', 'Wingbreaker, you are clear to engage. Stay low and fast through the canyon.'], ['juno', 'Relay pylons line the canyon walls. Drop three and we can go over the Stormwall!']],
      boss: 'canyon',
    },
    storm: {
      sky: ['#070b18', '#1d2740', '#3a4660'], fog: '#323d55', fogStart: 30, ground: ['#2d3548', '#283044'], groundY: -11, clouds: true, rain: true,
      music: 'storm', length: 84,
      patterns: [['darts', 3], ['drones', 2], ['swoop', 2], ['gunship', 1.4, 18], ['lightning', 2.4], ['mines', 1.4], ['chasers', 1, 30]],
      bonusTimes: [8, 17, 26, 35, 44, 53, 62, 71, 79], bonusKind: 'calmring',
      intro: [['vesk', 'I hate weather. Stay inside the calm-eye rings and you might live.'], ['juno', 'Thread six rings and I can plot a course straight into Halcyon Dock!']],
      boss: 'storm',
    },
    station: {
      sky: ['#000000', '#000000', '#000000'], fog: '#0a0d16', fogStart: 30, corridor: true,
      music: 'station', length: 84,
      patterns: [['lasers', 2.6], ['girders', 2.6], ['turrets', 2], ['darts', 2], ['drones', 2], ['wallgap', 1.6], ['gunship', 1, 26]],
      bonusTimes: [10, 24, 38, 50, 62, 74], bonusKind: 'conduit',
      intro: [['ops', 'You are in the service tunnels. Mind the laser gates, they cycle.'], ['harrow', 'Power conduits hang near the walls. Burn four and the boarding crews go in.']],
      boss: 'station',
    },
    space: {
      sky: ['#04030a', '#0f0a22', '#1c1036'], fog: '#120c26', fogStart: 55, stars: true, planet: true,
      music: 'space', length: 92,
      patterns: [['asteroids', 3], ['darts', 2.5], ['swoop', 2], ['chasers', 1.5, 12], ['gunship', 1.5, 15], ['mines', 1.2], ['drones', 1.5]],
      bonusTimes: [16, 36, 56, 76], bonusKind: 'frigate',
      intro: [['harrow', 'All wings, this is it. Cut through the asteroid screen and break the Crown.'], ['vesk', 'Frigates are escorting the big one. Sink them and it gets a lot quieter.']],
      boss: 'space',
    },
  };

  const BOSSES = {
    canyon: {
      name: 'MESA CRAWLER', body: 'crawlerBody', z: 40, y: -1.2, sway: [6, 1.2], swaySp: [0.45, 0.7], bodyCol: [{ x: 0, y: 0, w: 6, h: 1.8 }],
      parts: [
        { model: 'cannonPod', off: [-7.2, 1.8, 1.5], hp: 240, r: 1.8, fire: { kind: 'spread', n: 5, cd: 2.6, delay: 0.5 } },
        { model: 'cannonPod', off: [7.2, 1.8, 1.5], hp: 240, r: 1.8, fire: { kind: 'spread', n: 5, cd: 2.6, delay: 1.8 } },
        { model: 'rack', off: [0, 3.9, 0.5], hp: 220, r: 2.2, fire: { kind: 'missiles', n: 3, cd: 4.2, delay: 2.5 } },
      ],
      core: { model: 'core', off: [0, 0.6, 4.7], hp: 520, r: 1.8, fire: { kind: 'ring', n: 12, cd: 2.4 } },
      line: ['juno', 'That crawler is huge! Take out its guns first, then hit the core!'],
    },
    storm: {
      name: 'TEMPEST ENGINE', body: 'tempestBody', z: 40, y: 0.8, sway: [4, 1.2], swaySp: [0.35, 0.5], bodyCol: [{ x: 0, y: 0, w: 3.6, h: 3.6 }],
      parts: [0, 1, 2].map((k) => ({ model: 'coil', orbit: { r: 5.6, sp: 0.6, ph: (k * Math.PI * 2) / 3 }, off: [0, 0, 1.5], hp: 210, r: 1.7, fire: { kind: 'aimed', n: 3, cd: 2.2, delay: k * 0.7 } })),
      core: { model: 'coreBlue', off: [0, 0, 4.4], hp: 600, r: 2.1, fire: { kind: 'lightning', cd: 3.2 } },
      line: ['vesk', 'It is making the storm! Kill the coils spinning round it!'],
    },
    station: {
      name: 'GATEKEEPER', body: 'gateFrame', z: 42, y: 1.5, sway: [1.6, 0.6], swaySp: [0.4, 0.6], bodyCol: [{ x: 0, y: 7.5, w: 15, h: 1.5 }, { x: 0, y: -7.5, w: 15, h: 1.5 }, { x: -13.5, y: 0, w: 1.5, h: 6 }, { x: 13.5, y: 0, w: 1.5, h: 6 }],
      parts: [[-10, 4.6], [10, 4.6], [-10, -4.6], [10, -4.6]].map((o, k) => ({ model: 'bigTurret', off: [o[0], o[1], 1.4], hp: 170, r: 1.8, fire: { kind: k < 2 ? 'spread' : 'aimed', n: k < 2 ? 4 : 3, cd: 2.4, delay: k * 0.6 } })),
      core: { model: 'coreBlue', off: [0, 0, 0.5], hp: 640, r: 2.2, fire: { kind: 'sweep', cd: 3.0 } },
      line: ['ops', 'The exit gate has its own defenses. Knock out the corner turrets to drop its shield.'],
    },
    space: {
      name: 'THE HOLLOW CROWN', body: 'crownHull', z: 48, y: 1, sway: [5, 2], swaySp: [0.3, 0.45], bodyCol: [{ x: 0, y: 0, w: 13, h: 2.5 }],
      parts: [
        { model: 'battery', off: [-9, 0, 9.8], hp: 250, r: 2.2, fire: { kind: 'spread', n: 5, cd: 2.4, delay: 0.3 } },
        { model: 'battery', off: [9, 0, 9.8], hp: 250, r: 2.2, fire: { kind: 'spread', n: 5, cd: 2.4, delay: 1.5 } },
        { model: 'spire', off: [-5, 4.5, 3], hp: 210, r: 1.6, hitY: 3, fire: { kind: 'missiles', n: 2, cd: 4.5, delay: 1 } },
        { model: 'spire', off: [5, 4.5, 3], hp: 210, r: 1.6, hitY: 3, fire: { kind: 'missiles', n: 2, cd: 4.5, delay: 3 } },
      ],
      core: { model: 'core', off: [0, 1.2, 9.8], hp: 760, r: 2, fire: { kind: 'ring', n: 14, cd: 2.0 }, fire2: { kind: 'sweep', cd: 4.5 } },
      line: ['crown', 'You are a gnat, pilot. Kneel, or burn with your Meridian.'],
    },
  };

  const EN = {
    dart: { model: 'dart', hp: 22, r: 1.8, d: 1.3, sc: 1.2, scrap: 6, ry: Math.PI },
    drone: { model: 'drone', hp: 16, r: 1.7, d: 1.2, sc: 1.1, scrap: 5 },
    gunship: { model: 'gunship', hp: 120, r: 3.2, d: 2, sc: 1.1, scrap: 20, ry: Math.PI, cache: 0.25 },
    turret: { model: 'turret', hp: 30, r: 1.6, d: 1.3, sc: 1.2, scrap: 6, ry: Math.PI, hitY: 1.3 },
    mine: { model: 'mine', hp: 8, r: 1.1, d: 1, sc: 1, scrap: 2 },
    frigate: { model: 'frigate', hp: 340, col: [{ x: 0, y: 0, w: 3.4, h: 1.6 }], d: 7.5, sc: 1, scrap: 45, ry: Math.PI, cache: 1 },
    missile: { model: null, hp: 6, r: 0.9, d: 0.8, scrap: 0 },
    pylon: { model: 'pylon', hp: 80, col: [{ x: 0, y: 5.5, w: 1.5, h: 6 }], d: 1.4, scrap: 15 },
    conduit: { model: 'conduit', hp: 60, col: [{ x: 0, y: 0, w: 1.2, h: 3 }], d: 1.2, scrap: 15 },
  };

  const WEAPON_COL = { pulse: '#7fe4ff', repeater: '#8dffa8', scatter: '#ffb347', rail: '#d6a8ff' };

  class Flight {
    constructor(mission, stats) {
      this.m = mission;
      this.st = stats;
      this.th = THEMES[mission.theme];
      this.v = new G.Vitals(stats, mission);
      this.dmgOut = U.clamp(1 + (stats.power - mission.power) * 0.025, 0.55, 1.45);
      this.diffMul = U.clamp(1 + (mission.stage - 1) * 0.12, 1, 1.6);
      this.p = { x: 0, y: 0, z: -6, vx: 0, vy: 0, roll: 0, pitch: 0, dodgeT: 0, dodgeCD: 0, dodgeDir: 1, spin: 0, fireCD: 0, altCD: 0, gun: 0 };
      this.ammo = stats.secondary.ammo;
      this.maxAmmo = this.ammo;
      this.S = 36;
      this.dist = 0;
      this.t = 0;
      this.lt = 0;
      this.phase = 'intro';
      this.phaseT = 0;
      this.ents = [];
      this.bolts = [];
      this.eb = [];
      this.parts = [];
      this.arcs = [];
      this.missileQueue = [];
      this.kills = 0;
      this.enemies = 0;
      this.scrap = 0;
      this.caches = 0;
      this.bonusCount = 0;
      this.bonusNeed = mission.bonus.count || 1;
      this.bonusDone = false;
      this.boss = null;
      this.result = null;
      this.flashT = 0;
      this.nextFlash = 3;
      this.gust = 0;
      this.nextGust = 14;
      this.lowHullWarned = false;
      this.view = { F, cx: G.W / 2, cy: G.H * 0.47, camX: 0, camY: 1.6, fogColor: U.hex(this.th.fog), fogStart: this.th.fogStart, fogEnd: FAR };
      this.camRoll = 0;
      this.reticle = null;
      this.lockTarget = null;
      this.script = this.buildScript();
      this.si = 0;
      this.initDecor();
      G.radio.clear();
      G.popups.clear();
      for (const [who, line] of this.th.intro) G.radio.say(who, line, 3.8);
      G.audio.music(this.th.music);
    }

    // ---------- Level script ----------
    buildScript() {
      const th = this.th;
      const ev = [];
      const len = th.length;
      let t = 2;
      while (t < len) {
        const diff = t / len;
        const choices = th.patterns.filter((p) => (p[2] || 0) <= t).map((p) => [p[0], p[1]]);
        const name = U.weighted(choices);
        ev.push({ t, kind: 'pattern', name, diff });
        t += PATTERNS[name].gap * (1.05 - diff * 0.32) + U.rand(0, 0.7);
      }
      th.bonusTimes.forEach((bt, i) => {
        ev.push({ t: bt, kind: 'bonus', i });
        // Keep the bonus target's airspace clear of obstacle patterns.
        for (const e of ev) if (e.kind === 'pattern' && Math.abs(e.t - bt) < 1.4 && PATTERNS[e.name].solid) e.t = bt + 1.6;
      });
      for (let pt = 11; pt < len; pt += 12 + U.rand(0, 4)) ev.push({ t: pt, kind: 'pickup' });
      ev.push({ t: len + 2.5, kind: 'boss' });
      ev.sort((a, b) => a.t - b.t);
      return ev;
    }

    initDecor() {
      this.stars = [];
      this.clouds = [];
      this.rain = [];
      if (this.th.stars) {
        for (let i = 0; i < 220; i++) this.stars.push({ x: U.rand(-90, 90), y: U.rand(-60, 60), z: U.rand(2, FAR) });
      }
      if (this.th.clouds) {
        for (let i = 0; i < 26; i++) this.clouds.push(this.newCloud(U.rand(5, FAR)));
      }
      if (this.th.rain) {
        for (let i = 0; i < 90; i++) this.rain.push({ x: U.rand(0, G.W), y: U.rand(0, G.H), s: U.rand(0.6, 1.2) });
      }
    }
    newCloud(z) {
      let x, y;
      do {
        x = U.rand(-60, 60);
        y = U.rand(-14, 22);
      } while (Math.abs(x) < 15 && y > -9 && y < 11);
      return { x, y, z, s: U.rand(10, 22), a: U.rand(0.25, 0.55) };
    }

    add(e) {
      const d = Object.assign({ x: 0, y: 0, z: FAR, vx: 0, vy: 0, vz: -this.S, rx: 0, ry: 0, rz: 0, sc: 1, t: 0, flash: 0, r: 1, d: 1, type: 'obstacle' }, e);
      if (d.maxHp === undefined) d.maxHp = d.hp;
      if (d.countKill) this.enemies++;
      this.ents.push(d);
      return d;
    }
    enemy(kind, x, y, z, extra) {
      const def = EN[kind];
      const hp = Math.round(def.hp * this.diffMul);
      return this.add(Object.assign({
        type: 'enemy', kind, model: def.model ? MD[def.model] : null, x, y, z, hp, r: def.r || 1, d: def.d || 1, sc: def.sc || 1,
        ry: def.ry || 0, col: def.col, hitY: def.hitY || 0, scrapV: def.scrap, cacheChance: def.cache || 0.04, countKill: true,
        fireCD: U.rand(0.8, 2.2), ai: kind,
      }, extra || {}));
    }

    // ---------- Shooting ----------
    aimDir(ox, oy, oz, cone) {
      const p = this.p;
      const dx0 = p.vx * 0.012, dy0 = p.vy * 0.012;
      let best = null, bestA = cone;
      for (const e of this.ents) {
        if (e.hp <= 0 || e.type !== 'enemy' || e.z < oz + 4 || e.z > FAR - 10) continue;
        if (e.shielded) continue;
        const cy = e.y + (e.hitY || 0) + (e.col ? e.col[0].y : 0);
        const dz = e.z - oz;
        const a = Math.hypot((e.x - ox) / dz - dx0, (cy - oy) / dz - dy0);
        if (a < bestA) {
          bestA = a;
          best = e;
        }
      }
      if (best) {
        const cy = best.y + (best.hitY || 0) + (best.col ? best.col[0].y : 0);
        const dz = best.z - oz;
        // Lead the target a little using its relative velocity.
        const tt = dz / 170;
        return { x: (best.x + best.vx * tt - ox) / dz, y: (cy + best.vy * tt - oy) / dz, target: best };
      }
      return { x: dx0, y: dy0, target: null };
    }

    firePrimary() {
      const st = this.st.primary;
      const p = this.p;
      const col = WEAPON_COL[st.arch];
      const dmg = st.dmg * this.dmgOut;
      const mk = (ox, oy, dir, speed, extra) => {
        this.bolts.push(Object.assign({ x: ox, y: oy, z: PZ + 1.6, vx: dir.x * speed, vy: dir.y * speed, vz: speed, dmg, pierce: st.pierce, col, life: 1.3, r: 0.45, hitSet: null, kind: 'bolt' }, extra || {}));
      };
      const assist = this.st.assist;
      if (st.arch === 'pulse') {
        const d = this.aimDir(p.x, p.y, PZ, assist);
        mk(p.x, p.y - 0.1, d, 170);
        G.audio.play('laser');
      } else if (st.arch === 'repeater') {
        p.gun = 1 - p.gun;
        const ox = p.x + (p.gun ? 0.75 : -0.75);
        const d = this.aimDir(ox, p.y, PZ, assist);
        mk(ox, p.y - 0.1, d, 175, { r: 0.4 });
        G.audio.play('repeater');
      } else if (st.arch === 'scatter') {
        const d = this.aimDir(p.x, p.y, PZ, assist * 0.6);
        for (let i = 0; i < st.pellets; i++) {
          const a = (i / (st.pellets - 1) - 0.5) * 0.16;
          mk(p.x, p.y - 0.1, { x: d.x + a, y: d.y + (i % 2 ? 0.02 : -0.02) }, 150, { life: 0.7, r: 0.5 });
        }
        G.audio.play('scatter');
      } else if (st.arch === 'rail') {
        const d = this.aimDir(p.x, p.y, PZ, assist * 1.2);
        mk(p.x, p.y - 0.1, d, 280, { r: 0.6, rail: true });
        G.audio.play('rail');
        G.shake(2);
      }
    }

    fireSecondary() {
      const s = this.st.secondary;
      const p = this.p;
      if (this.ammo <= 0) {
        G.audio.play('back');
        return;
      }
      const dmg = s.dmg * this.dmgOut;
      if (s.arch === 'seeker') {
        const n = this.st.perks.has('wide') ? 5 : 4;
        const tg = this.ents
          .filter((e) => e.type === 'enemy' && e.hp > 0 && !e.shielded && e.z > PZ + 5 && e.z < FAR * 0.75)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) + a.z * 0.2 - (Math.hypot(b.x - p.x, b.y - p.y) + b.z * 0.2))
          .slice(0, n);
        const shots = Math.min(this.ammo, Math.max(1, tg.length));
        for (let i = 0; i < shots; i++) this.missileQueue.push({ delay: i * 0.08, target: tg[i] || null, dmg });
        this.ammo -= shots;
        this.p.altCD = 0.5;
      } else if (s.arch === 'nova') {
        this.ammo--;
        this.bolts.push({ x: p.x, y: p.y, z: PZ + 1, vx: 0, vy: 0, vz: 70, dmg, col: '#ffffff', life: 0.45, r: 1, kind: 'nova', pierce: 99 });
        G.audio.play('missile');
        this.p.altCD = 1.0;
      } else if (s.arch === 'flak') {
        this.ammo--;
        const d = this.aimDir(p.x, p.y, PZ, 0.25);
        this.bolts.push({ x: p.x, y: p.y, z: PZ + 1, vx: d.x * 90, vy: d.y * 90, vz: 90, dmg, col: '#ffb347', life: 0.5, r: 0.7, kind: 'flak', pierce: 0 });
        G.audio.play('grenade');
        this.p.altCD = 0.45;
      }
    }

    explodeArea(x, y, z, radius, dmg, col) {
      for (const e of this.ents) {
        if (e.hp <= 0 || e.type !== 'enemy' || e.shielded) continue;
        const cy = e.y + (e.hitY || 0) + (e.col ? e.col[0].y : 0);
        const d = Math.hypot(e.x - x, cy - y, (e.z - z) * 0.6);
        if (d < radius + (e.r || 2)) this.damage(e, dmg * (d < radius * 0.5 ? 1 : 0.7), e.x, cy, e.z);
      }
      this.explosion(x, y, z, radius / 3, col);
    }

    damage(e, dmg, hx, hy, hz) {
      if (e.hp <= 0) return;
      if (e.shielded) {
        this.spark(hx, hy, hz, '#8f7dff');
        return;
      }
      e.hp -= dmg;
      e.flash = 0.08;
      const sp = R.project(this.view, hx, hy, hz);
      if (sp) G.popups.add(sp.x + U.rand(-8, 8), sp.y - 10, String(Math.round(dmg)), dmg > 40 ? '#ffd37a' : '#ffffff', dmg > 40 ? 16 : 12, 0.55);
      G.audio.play('hit');
      if (e.hp <= 0) this.kill(e);
    }

    kill(e) {
      e.hp = 0;
      e.dead = true;
      const big = e.kind === 'gunship' || e.kind === 'frigate' || e.bossPart;
      this.explosion(e.x, e.y + (e.hitY || 0), e.z, big ? 2.4 : 1.2, big ? '#ffb347' : '#ff7a3d');
      G.audio.play(big ? 'bigboom' : 'boom');
      if (big) G.shake(8);
      if (e.countKill) this.kills++;
      if (this.st.perks.has('leech')) this.v.addShield(6);
      if (this.st.perks.has('resupply') && Math.random() < 0.18 && this.ammo < this.maxAmmo) {
        this.ammo++;
        G.popups.add(G.W - 90, G.H - 60, '+1 AMMO', '#ffb347', 12);
      }
      const n = Math.min(5, Math.max(1, Math.round((e.scrapV || 0) / 5)));
      for (let i = 0; i < n && e.scrapV; i++) {
        this.add({ type: 'pickup', kind: 'scrap', x: e.x + U.rand(-1, 1), y: e.y + (e.hitY || 0) + U.rand(-1, 1), z: e.z + U.rand(-1, 1), vz: -this.S * 0.5, vx: U.rand(-3, 3), vy: U.rand(-3, 3), value: (e.scrapV / n), auto: true, r: 0.5 });
      }
      if (Math.random() < (e.cacheChance || 0)) this.add({ type: 'pickup', kind: 'cache', x: e.x, y: e.y + (e.hitY || 0), z: e.z, vz: -this.S * 0.6, auto: true, r: 0.8 });
      if (e.bonus) this.bonusHit(e);
      if (e.bossPart) this.bossPartDown(e);
    }

    bonusHit() {
      this.bonusCount++;
      const left = this.bonusNeed - this.bonusCount;
      if (!this.bonusDone && left <= 0) {
        this.bonusDone = true;
        G.audio.play('cache');
        G.radio.say('harrow', 'Bonus objective complete. That opens a new route for us. Good flying.', 3.5, true);
      } else if (left > 0) {
        G.audio.play('ring');
        const lines = {
          pylon: `Pylon down! ${left} to go.`,
          calmring: `Nice line. ${left} more ring${left > 1 ? 's' : ''}.`,
          conduit: `Conduit burning. ${left} more.`,
          frigate: `Frigate down! ${left} left.`,
        };
        G.radio.say(this.th.bonusKind === 'calmring' ? 'juno' : 'juno', lines[this.th.bonusKind] || 'Target hit.', 2.4, true);
      }
    }

    // ---------- Effects ----------
    explosion(x, y, z, scale, col) {
      for (let i = 0; i < 10 + scale * 6; i++) {
        this.parts.push({ x, y, z, vx: U.rand(-6, 6) * scale, vy: U.rand(-6, 6) * scale, vz: U.rand(-6, 6) * scale - this.S * 0.4, life: U.rand(0.3, 0.7), max: 0.7, size: U.rand(0.8, 1.6) * scale, col: U.pick([col, '#ffd37a', '#ff4d3d']), glow: true, drag: 0.92 });
      }
      for (let i = 0; i < 6 + scale * 3; i++) {
        this.parts.push({ x, y, z, vx: U.rand(-10, 10) * scale, vy: U.rand(-4, 12) * scale, vz: U.rand(-8, 8) - this.S * 0.4, life: U.rand(0.5, 1.1), max: 1.1, size: 0.25 * scale + 0.1, col: '#28252e', grav: 25, drag: 0.98 });
      }
      this.parts.push({ x, y, z, vx: 0, vy: 0, vz: -this.S * 0.3, life: 0.25, max: 0.25, size: 4 * scale, col: '#fff2c0', glow: true, drag: 1 });
    }
    spark(x, y, z, col = '#ffd37a') {
      for (let i = 0; i < 5; i++) this.parts.push({ x, y, z, vx: U.rand(-8, 8), vy: U.rand(-8, 8), vz: U.rand(-8, 8) - this.S * 0.5, life: 0.25, max: 0.25, size: 0.4, col, glow: true, drag: 0.9 });
    }

    // ---------- Update ----------
    update(dt) {
      this.t += dt;
      this.phaseT += dt;
      const p = this.p;
      const V = this.view;
      if (this.phase === 'dead') dt *= 0.45;
      this.dist += this.S * dt;
      G.radio.update(dt);
      G.popups.update(dt);

      if (this.phase === 'intro') {
        p.z = U.lerp(-6, PZ, U.clamp(this.phaseT / 1.6, 0, 1) ** 0.6);
        if (this.phaseT > 1.6) {
          this.phase = 'play';
          this.phaseT = 0;
          p.z = PZ;
        }
      } else if (this.phase === 'play' || this.phase === 'boss') {
        this.lt += dt;
        while (this.si < this.script.length && this.script[this.si].t <= this.lt) this.runEvent(this.script[this.si++]);
      }

      if (this.phase !== 'dead' && this.phase !== 'outro') this.updatePlayer(dt);
      if (this.phase === 'outro') {
        p.z += dt * (10 + this.phaseT * 40);
        p.y = U.damp(p.y, 2, 2, dt);
        if (this.phaseT > 2.6) this.finish(true);
      }
      if (this.phase === 'dead' && this.phaseT > 2.4) this.finish(false);

      this.v.update(dt);
      this.updateWeather(dt);
      this.updateEnts(dt);
      this.updateBolts(dt);
      this.updateEnemyBullets(dt);
      this.updateParts(dt);
      if (this.boss) this.updateBoss(dt);

      // Camera follows the ship loosely and rolls with it.
      V.camX = U.damp(V.camX, p.x * 0.7, 6, dt);
      V.camY = U.damp(V.camY, p.y * 0.55 + 1.6, 6, dt);
      this.camRoll = U.damp(this.camRoll, p.roll * 0.22, 5, dt);

      if (!this.lowHullWarned && this.v.hull < this.v.maxHull * 0.3 && this.v.hull > 0) {
        this.lowHullWarned = true;
        G.radio.say('vesk', 'You are leaking, Wingbreaker! Find a repair kit or keep your shield up!', 3, true);
      }
    }

    updatePlayer(dt) {
      const p = this.p;
      const st = this.st;
      const spd = 15 * st.speed;
      p.vx = U.damp(p.vx, I.ax * spd + this.gust, 9, dt);
      p.vy = U.damp(p.vy, -I.ay * spd, 9, dt);
      if (p.dodgeT > 0) {
        p.dodgeT -= dt;
        p.vx += p.dodgeDir * 70 * dt;
      }
      p.x = U.clamp(p.x + p.vx * dt, -BX, BX);
      p.y = U.clamp(p.y + p.vy * dt, BYMIN, BYMAX);
      p.roll = U.damp(p.roll, -(p.vx / spd) * 0.8, 10, dt);
      p.pitch = U.damp(p.pitch, (p.vy / spd) * 0.25, 10, dt);
      p.spin = p.dodgeT > 0 ? -(1 - p.dodgeT / 0.45) * Math.PI * 2 * p.dodgeDir : 0;
      p.dodgeCD -= dt;
      p.fireCD -= dt;
      p.altCD -= dt;
      if (I.pressed('dodge') && p.dodgeCD <= 0) {
        p.dodgeDir = Math.abs(I.ax) > 0.2 ? U.sign(I.ax) : p.dodgeDir * -1;
        p.dodgeT = 0.45;
        p.dodgeCD = st.dodgeCD;
        this.v.invuln = Math.max(this.v.invuln, 0.45);
        G.audio.play('dodge');
        if (st.perks.has('reflex')) this.v.addShield(12);
      }
      if (this.phase !== 'intro') {
        if (I.down('fire') && p.fireCD <= 0) {
          this.firePrimary();
          p.fireCD = 1 / st.primary.rate;
        }
        if (I.pressed('alt') && p.altCD <= 0) this.fireSecondary();
      }
      // Missile salvo queue
      for (const q of this.missileQueue) {
        q.delay -= dt;
        if (q.delay <= 0) {
          this.bolts.push({ x: p.x + U.rand(-1, 1), y: p.y - 0.4, z: PZ + 1, vx: U.rand(-8, 8), vy: U.rand(2, 8), vz: 50, dmg: q.dmg, col: '#ffb347', life: 2.5, r: 0.7, kind: 'missile', target: q.target, pierce: 0 });
          G.audio.play('missile');
          q.done = true;
        }
      }
      this.missileQueue = this.missileQueue.filter((q) => !q.done);
      // Engine trail
      if (Math.random() < 0.9) {
        this.parts.push({ x: p.x + U.rand(-0.15, 0.15), y: p.y + U.rand(-0.1, 0.1), z: p.z - 0.9, vx: 0, vy: 0, vz: -14, life: 0.16, max: 0.16, size: 0.2, col: '#ffb347', glow: true, drag: 1 });
      }
      // Reticle and lock preview
      const aim = this.aimDir(p.x, p.y, PZ, st.assist);
      this.lockTarget = aim.target;
      this.reticle = aim;
    }

    updateWeather(dt) {
      if (this.th.rain) {
        this.nextFlash -= dt;
        if (this.nextFlash <= 0) {
          this.flashT = 0.35;
          this.nextFlash = U.rand(4, 9);
          setTimeout(() => G.audio.play('thunder'), 250);
        }
        this.nextGust -= dt;
        if (this.nextGust <= 0 && this.phase === 'play') {
          this.gustDir = U.chance(0.5) ? 1 : -1;
          this.gustT = 3.5;
          this.nextGust = U.rand(13, 20);
          G.radio.say('juno', this.gustDir > 0 ? 'Crosswind from the left! Lean into it!' : 'Crosswind from the right! Lean into it!', 2.4);
        }
        if (this.gustT > 0) {
          this.gustT -= dt;
          this.gust = U.damp(this.gust, this.gustDir * 7, 3, dt);
        } else this.gust = U.damp(this.gust, 0, 3, dt);
      }
      this.flashT = Math.max(0, this.flashT - dt);
      for (const s of this.stars) {
        s.z -= this.S * 1.6 * dt;
        if (s.z < 1) {
          s.z = FAR;
          s.x = U.rand(-90, 90);
          s.y = U.rand(-60, 60);
        }
      }
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i];
        c.z -= this.S * dt;
        if (c.z < 1) this.clouds[i] = this.newCloud(FAR + U.rand(0, 20));
      }
      for (const r of this.rain) {
        r.y += 900 * r.s * dt;
        r.x -= 260 * r.s * dt;
        if (r.y > G.H) {
          r.y = -20;
          r.x = U.rand(0, G.W + 200);
        }
      }
    }

    runEvent(ev) {
      if (ev.kind === 'pattern') PATTERNS[ev.name].fn(this, ev.diff);
      else if (ev.kind === 'bonus') this.spawnBonus(ev.i);
      else if (ev.kind === 'pickup') {
        const kind = U.weighted([['repair', 4], ['ammo', 3], ['cache', 1]]);
        this.add({ type: 'pickup', kind, x: U.rand(-8, 8), y: U.rand(-3, 5), z: FAR, r: 0.9 });
      } else if (ev.kind === 'boss') this.spawnBoss();
    }

    spawnBonus(i) {
      const k = this.th.bonusKind;
      if (k === 'pylon') {
        const side = i % 2 ? 1 : -1;
        this.enemy('pylon', side * 13.2, GROUND, FAR, { bonus: true, ai: 'static', countKill: false, cacheChance: 0 });
        G.radio.say('juno', 'Relay pylon on the ' + (side < 0 ? 'left' : 'right') + ' wall!', 2.2);
      } else if (k === 'calmring') {
        this.add({ type: 'ring', bonus: true, x: U.rand(-8, 8), y: U.rand(-3, 5.5), z: FAR, rad: 2.8 });
      } else if (k === 'conduit') {
        const side = i % 2 ? 1 : -1;
        this.enemy('conduit', side * 12.5, U.rand(2, 5), FAR, { bonus: true, ai: 'static', countKill: false, cacheChance: 0 });
      } else if (k === 'frigate') {
        const side = i % 2 ? 1 : -1;
        this.enemy('frigate', side * 16, U.rand(1, 5), FAR, { bonus: true, ai: 'frigate', side, countKill: false });
        G.radio.say('vesk', 'Escort frigate, ' + (side < 0 ? 'left' : 'right') + ' side. Sink it before it pulls away!', 2.6);
      }
    }

    // Enemy bullet aimed at where the player will be.
    shoot(x, y, z, speed = 34, spreadX = 0, spreadY = 0, dmg = 10, col = '#ff4d5e') {
      const p = this.p;
      const dz = z - PZ;
      if (dz < 3) return;
      const t = dz / speed;
      const tx = p.x + p.vx * t * 0.5 + spreadX;
      const ty = p.y + p.vy * t * 0.5 + spreadY;
      this.eb.push({ x, y, z, vx: (tx - x) / t, vy: (ty - y) / t, vz: -speed, r: 0.55, dmg: dmg * (0.85 + this.m.stage * 0.08), col, life: 6 });
      G.audio.play('enemyShot');
    }

    updateEnts(dt) {
      const p = this.p;
      for (const e of this.ents) {
        if (e.dead) continue;
        e.t += dt;
        e.flash = Math.max(0, e.flash - dt);
        if (e.ai && AI[e.ai]) AI[e.ai](this, e, dt);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const oz = e.z;
        e.z += e.vz * dt;
        if (e.z < -6 || e.z > FAR + 60 || Math.abs(e.x) > 120 || e.y > 80) e.dead = true;

        // Interactions as the thing passes the ship's depth.
        if (this.phase === 'dead' || this.phase === 'outro') continue;
        if (e.type === 'ring') {
          if (!e.passed && oz >= PZ && e.z < PZ) {
            e.passed = true;
            const d = Math.hypot(p.x - e.x, p.y - e.y);
            if (d < e.rad) {
              G.audio.play('ring');
              if (e.bonus) this.bonusHit(e);
              else {
                this.v.addShield(15);
                this.scrap += 2;
              }
              e.hitT = 0.4;
              const sp = R.project(this.view, e.x, e.y, PZ + 1);
              if (sp) G.popups.add(sp.x, sp.y - 30, e.bonus ? 'CALM RING' : '+SHIELD', e.bonus ? '#ffd37a' : '#5fd4ff', 14);
            } else if (e.bonus) G.radio.say('juno', 'Missed that ring!', 1.6);
          }
          continue;
        }
        if (e.type === 'pickup') {
          const near = Math.abs(e.z - PZ) < 30;
          const reach = 4 * this.st.magnet;
          const dxy = Math.hypot(p.x - e.x, p.y - e.y);
          if (e.auto || (near && dxy < reach + Math.max(0, e.z - PZ) * 0.15)) {
            e.vx = U.damp(e.vx, (p.x - e.x) * 4, 5, dt);
            e.vy = U.damp(e.vy, (p.y - e.y) * 4, 5, dt);
            if (e.auto || near) e.vz = U.damp(e.vz, (PZ - e.z) * 3, 4, dt);
          }
          if (Math.abs(e.z - PZ) < 1.8 && dxy < 1.9) this.collect(e);
          continue;
        }
        if (e.type === 'laser') {
          if (oz >= PZ && e.z < PZ && !e.hitPlayer) {
            for (const b of e.beams) {
              if (this.beamOn(e, b) && Math.abs(p.y - b.y) < 0.75) {
                e.hitPlayer = true;
                this.playerHit(24, 0.6);
                break;
              }
            }
          }
          continue;
        }
        if (e.type === 'hazard') continue;
        if (Math.abs(e.z - PZ) < e.d + 0.6 && !e.hitPlayer) {
          if (this.hitTest(e, p.x, p.y, 0.7)) {
            e.hitPlayer = true;
            if (e.type === 'enemy' && e.hp > 0 && !e.bossPart) {
              this.playerHit(e.kind === 'mine' ? 26 : 18, 0.5);
              this.damage(e, 60, e.x, e.y, e.z);
            } else if (e.type === 'obstacle' || e.type === 'bossbody') {
              this.playerHit(22, 0.7);
              p.vx += (p.x < e.x ? -1 : 1) * 18;
              this.spark(p.x, p.y, PZ, '#ffd37a');
            }
          }
        }
      }
      this.ents = this.ents.filter((e) => !e.dead);
    }

    hitTest(e, x, y, pad) {
      if (e.col) {
        for (const c of e.col) {
          const cx = e.x + c.x, cy = e.y + c.y;
          const dx = Math.max(Math.abs(x - cx) - c.w, 0);
          const dy = Math.max(Math.abs(y - cy) - c.h, 0);
          if (dx * dx + dy * dy < pad * pad) return true;
        }
        return false;
      }
      return Math.hypot(x - e.x, y - (e.y + (e.hitY || 0))) < e.r + pad;
    }

    beamOn(e, b) {
      if (!b.period) return true;
      return ((this.t + b.phase) % b.period) / b.period < 0.55;
    }

    collect(e) {
      e.dead = true;
      const p = this.p;
      const sp = R.project(this.view, p.x, p.y + 1, PZ);
      if (e.kind === 'scrap') {
        const v = e.value * this.st.scrapMult;
        this.scrap += v;
        G.audio.play('scrap');
      } else if (e.kind === 'repair') {
        this.v.heal(this.v.maxHull * 0.3);
        G.audio.play('pickup');
        if (sp) G.popups.add(sp.x, sp.y - 20, '+HULL', '#6fe39a', 16);
      } else if (e.kind === 'ammo') {
        this.ammo = Math.min(this.maxAmmo, this.ammo + Math.max(1, Math.round(this.maxAmmo * 0.5)));
        G.audio.play('pickup');
        if (sp) G.popups.add(sp.x, sp.y - 20, '+ORDNANCE', '#ffb347', 16);
      } else if (e.kind === 'cache') {
        this.caches++;
        G.audio.play('cache');
        if (sp) G.popups.add(sp.x, sp.y - 20, 'LOOT CACHE', '#c77dff', 18);
      }
    }

    playerHit(dmg, inv = 0.15) {
      const r = this.v.hit(dmg * (0.85 + this.m.stage * 0.06), inv);
      if (r === 'dead') this.die();
    }

    die() {
      if (this.phase === 'dead') return;
      this.phase = 'dead';
      this.phaseT = 0;
      this.explosion(this.p.x, this.p.y, PZ, 2.5, '#ffb347');
      G.audio.play('bigboom');
      G.shake(18);
      G.radio.say('harrow', 'Wingbreaker is down! Pull back, pull back!', 3, true);
    }

    updateBolts(dt) {
      for (const b of this.bolts) {
        const ox = b.x, oy = b.y, oz = b.z;
        b.life -= dt;
        if (b.kind === 'missile') {
          if (b.target && (b.target.dead || b.target.hp <= 0)) b.target = null;
          if (b.target) {
            const t = b.target;
            const ty = t.y + (t.hitY || 0) + (t.col ? t.col[0].y : 0);
            const dx = t.x - b.x, dy = ty - b.y, dz = t.z - b.z;
            const d = Math.hypot(dx, dy, dz) || 1;
            const sp = 95;
            b.vx = U.damp(b.vx, (dx / d) * sp, 6, dt);
            b.vy = U.damp(b.vy, (dy / d) * sp, 6, dt);
            b.vz = U.damp(b.vz, (dz / d) * sp, 6, dt);
          } else b.vz = U.damp(b.vz, 110, 3, dt);
          this.parts.push({ x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: -this.S * 0.4, life: 0.35, max: 0.35, size: 0.6, col: '#9aa0b5', glow: true, drag: 1 });
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        if (b.kind === 'nova' && b.life <= 0) {
          this.nova(b);
          continue;
        }
        if (b.kind === 'flak' && b.life <= 0) {
          this.explodeArea(b.x, b.y, b.z, 7 * this.st.secondary.radius, b.dmg, '#ffb347');
          G.audio.play('boom');
          continue;
        }
        if (b.life <= 0 || b.z > FAR + 10) {
          b.dead = true;
          continue;
        }
        if (b.kind === 'nova') continue;
        // Swept collision against everything in the depth range covered this frame.
        const z0 = Math.min(oz, b.z), z1 = Math.max(oz, b.z);
        for (const e of this.ents) {
          if (e.dead) continue;
          const hittable = (e.type === 'enemy' && e.hp > 0) || e.type === 'obstacle' || e.type === 'bossbody';
          if (!hittable) continue;
          if (e.z + e.d < z0 - 0.3 || e.z - e.d > z1 + 0.3) continue;
          const tt = b.z === oz ? 1 : U.clamp((e.z - oz) / (b.z - oz), 0, 1);
          const hx = ox + (b.x - ox) * tt, hy = oy + (b.y - oy) * tt;
          if (!this.hitTest(e, hx, hy, b.r)) continue;
          if (b.hitSet && b.hitSet.has(e)) continue;
          if (e.type !== 'enemy') {
            b.dead = true;
            this.spark(hx, hy, e.z - e.d, '#ffd37a');
            if (e.hp > 0 && e.destructible) this.damage(e, b.dmg, hx, hy, e.z);
            break;
          }
          if (b.kind === 'missile') {
            this.explodeArea(hx, hy, e.z, 3 * this.st.secondary.radius, b.dmg, '#ffb347');
            G.audio.play('boom');
            b.dead = true;
            break;
          }
          this.damage(e, b.dmg, hx, hy, e.z);
          this.spark(hx, hy, e.z, b.col);
          if (this.st.perks.has('chain') && !b.chained) this.chainArc(e, b.dmg * 0.4);
          if (b.pierce > 0) {
            b.pierce--;
            b.hitSet = b.hitSet || new Set();
            b.hitSet.add(e);
          } else {
            b.dead = true;
            break;
          }
        }
      }
      this.bolts = this.bolts.filter((b) => !b.dead && b.life > 0);
      for (const a of this.arcs) a.life -= dt;
      this.arcs = this.arcs.filter((a) => a.life > 0);
    }

    chainArc(from, dmg) {
      let best = null, bd = 12;
      for (const e of this.ents) {
        if (e === from || e.type !== 'enemy' || e.hp <= 0 || e.shielded) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y, e.z - from.z);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) {
        this.arcs.push({ a: [from.x, from.y + (from.hitY || 0), from.z], b: [best.x, best.y + (best.hitY || 0), best.z], life: 0.15 });
        this.damage(best, dmg, best.x, best.y + (best.hitY || 0), best.z);
      }
    }

    nova(b) {
      b.dead = true;
      const R0 = 26 * this.st.secondary.radius;
      for (const e of this.ents) {
        if (e.type !== 'enemy' || e.hp <= 0 || e.shielded) continue;
        if (e.z > PZ && e.z < PZ + 80 && Math.hypot(e.x - b.x, e.y - b.y) < R0) this.damage(e, b.dmg, e.x, e.y + (e.hitY || 0), e.z);
      }
      this.eb.length = 0;
      this.flashT = 0.4;
      this.explosion(b.x, b.y, b.z, 5, '#d6e6ff');
      G.audio.play('nova');
      G.shake(12);
    }

    updateEnemyBullets(dt) {
      const p = this.p;
      for (const b of this.eb) {
        const oz = b.z;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.life -= dt;
        if (this.phase === 'dead' || this.phase === 'outro') continue;
        if (oz >= PZ - 0.6 && b.z <= PZ + 0.6) {
          if (Math.hypot(b.x - p.x, b.y - p.y) < 0.9 + b.r * 0.5) {
            if (p.dodgeT > 0) {
              // Rolling deflects shots straight back at the enemy.
              b.dead = true;
              this.bolts.push({ x: b.x, y: b.y, z: PZ + 0.8, vx: -b.vx, vy: -b.vy, vz: 120, dmg: 20, pierce: 0, col: '#ffd37a', life: 1.2, r: 0.5, kind: 'bolt', chained: true });
              G.audio.play('shieldHit');
            } else {
              b.dead = true;
              this.playerHit(b.dmg);
            }
          }
        }
        if (b.z < -1 || b.life <= 0) b.dead = true;
      }
      this.eb = this.eb.filter((b) => !b.dead);
    }

    updateParts(dt) {
      for (const q of this.parts) {
        q.life -= dt;
        const d = Math.pow(q.drag, dt * 60);
        q.vx *= d;
        q.vy *= d;
        if (q.grav) q.vy -= q.grav * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z += q.vz * dt;
      }
      this.parts = this.parts.filter((q) => q.life > 0 && q.z > 0.5);
      if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
    }

    // ---------- Boss ----------
    spawnBoss() {
      const def = BOSSES[this.th.boss];
      const mul = 1 + (this.m.stage - 1) * 0.08;
      this.phase = 'boss';
      const B = (this.boss = { def, x: 0, y: def.y, z: FAR + 20, t: 0, state: 'enter', parts: [], core: null, deathT: 0 });
      B.body = this.add({ type: 'bossbody', model: MD[def.body], x: 0, y: def.y, z: B.z, vz: 0, ry: Math.PI, col: def.bodyCol, d: 4, ai: null });
      for (const pd of def.parts) {
        const e = this.add({ type: 'enemy', kind: 'bosspart', model: MD[pd.model], x: 0, y: 0, z: B.z, vz: 0, ry: Math.PI, hp: Math.round(pd.hp * mul), r: pd.r, d: 2.2, hitY: pd.hitY || 0, bossPart: true, pd, fireCD: (pd.fire.delay || 0) + 3, ai: null, cacheChance: 0.3, scrapV: 20, sc: 1 });
        B.parts.push(e);
      }
      const cd = def.core;
      B.core = this.add({ type: 'enemy', kind: 'bosscore', model: MD[cd.model], x: 0, y: 0, z: B.z, vz: 0, ry: Math.PI, hp: Math.round(cd.hp * mul), r: cd.r, d: 2.2, bossPart: true, isCore: true, pd: cd, shielded: true, fireCD: 4, fire2CD: 6, ai: null, cacheChance: 1, scrapV: 60, sc: 1 });
      B.maxHp = B.parts.reduce((s, e) => s + e.maxHp, 0) + B.core.maxHp;
      G.audio.music('boss');
      G.audio.play('alarm');
      G.radio.say(def.line[0], def.line[1], 4, true);
    }

    updateBoss(dt) {
      const B = this.boss;
      const def = B.def;
      B.t += dt;
      if (B.state === 'enter') {
        B.z = U.damp(B.z, def.z, 1.4, dt);
        if (B.z < def.z + 2) B.state = 'fight';
      }
      if (B.state === 'fight' || B.state === 'enter') {
        B.x = Math.sin(B.t * def.swaySp[0]) * def.sway[0];
        B.y = def.y + Math.sin(B.t * def.swaySp[1]) * def.sway[1];
      }
      const place = (e, pd) => {
        let ox = pd.off[0], oy = pd.off[1];
        if (pd.orbit) {
          const a = pd.orbit.ph + B.t * pd.orbit.sp;
          ox = Math.cos(a) * pd.orbit.r;
          oy = Math.sin(a) * pd.orbit.r;
        }
        e.x = B.x + ox;
        e.y = B.y + oy;
        e.z = B.z + pd.off[2] * -1 + 0;
      };
      B.body.x = B.x;
      B.body.y = B.y;
      B.body.z = B.z;
      if (def.body === 'tempestBody') B.body.ry += dt * 0.4;
      for (const e of B.parts) if (!e.dead) place(e, e.pd);
      if (!B.core.dead) place(B.core, B.core.pd);

      if (B.state === 'fight' && this.phase !== 'dead') {
        for (const e of B.parts) if (!e.dead) this.bossFire(e, e.pd.fire, dt, 'fireCD');
        if (!B.core.dead) {
          this.bossFire(B.core, B.core.pd.fire, dt, 'fireCD', B.core.shielded ? 1.6 : 1);
          if (B.core.pd.fire2 && !B.core.shielded) this.bossFire(B.core, B.core.pd.fire2, dt, 'fire2CD');
        }
      }
      if (B.state === 'dying') {
        B.deathT += dt;
        if (Math.random() < 0.35) this.explosion(B.x + U.rand(-10, 10), B.y + U.rand(-4, 4), B.z + U.rand(-3, 3), U.rand(1.5, 3), '#ffb347');
        if (Math.random() < 0.1) G.audio.play('boom');
        B.body.y -= dt * B.deathT * 2;
        if (B.deathT > 2.4) {
          this.explosion(B.x, B.y, B.z, 7, '#fff2c0');
          G.audio.play('bigboom');
          G.shake(20);
          this.flashT = 0.5;
          B.body.dead = true;
          this.boss = null;
          this.phase = 'outro';
          this.phaseT = 0;
          G.audio.music('victory');
          G.radio.say('harrow', 'Target destroyed! Outstanding, Wingbreaker. Bring it home.', 3, true);
        }
      }
    }

    bossFire(e, f, dt, key, slow = 1) {
      e[key] -= dt;
      if (e[key] > 0) return;
      e[key] = f.cd * slow * U.rand(0.85, 1.15) / Math.min(1.35, this.diffMul);
      const p = this.p;
      const x = e.x, y = e.y + (e.hitY || 0), z = e.z - 1.5;
      if (f.kind === 'aimed') {
        for (let i = 0; i < f.n; i++) setTimeout(() => !e.dead && this.phase !== 'dead' && this.shoot(e.x, e.y, e.z - 1.5, 40), i * 140);
      } else if (f.kind === 'spread') {
        for (let i = 0; i < f.n; i++) this.shoot(x, y, z, 32, (i - (f.n - 1) / 2) * 2.6, 0);
      } else if (f.kind === 'ring') {
        const cx = U.rand(-3, 3), cy = U.rand(-1, 3);
        const rr = U.rand(3.5, 6.5);
        const speed = 28;
        const t = (z - PZ) / speed;
        for (let i = 0; i < f.n; i++) {
          const a = (i / f.n) * Math.PI * 2;
          const tx = cx + Math.cos(a) * rr, ty = cy + Math.sin(a) * rr;
          this.eb.push({ x, y, z, vx: (tx - x) / t, vy: (ty - y) / t, vz: -speed, r: 0.6, dmg: 9 + this.m.stage, col: '#ff5af0', life: 6 });
        }
        G.audio.play('enemyShot');
      } else if (f.kind === 'missiles') {
        for (let i = 0; i < f.n; i++) {
          this.enemy('missile', x + U.rand(-1.5, 1.5), y + 1, z, { ai: 'missile', vz: -22, vy: U.rand(4, 8), vx: U.rand(-6, 6), countKill: false, cacheChance: 0, scrapV: 0, hp: 6 });
        }
        G.audio.play('missile');
      } else if (f.kind === 'lightning') {
        for (let i = 0; i < 3; i++) this.add({ type: 'hazard', kind: 'strike', x: U.clamp(p.x + U.rand(-5, 5), -BX, BX), y: 0, z: PZ + this.S * 1.3 + i * 6, ai: 'strike' });
        G.audio.play('alarm');
      } else if (f.kind === 'sweep') {
        const yb = U.clamp(p.y + U.rand(-1, 1), BYMIN + 0.5, BYMAX - 0.5);
        this.add({ type: 'laser', beams: [{ y: yb }], z: e.z - 2, vz: -24, span: 22 });
        G.audio.play('alarm');
      }
    }

    bossPartDown(e) {
      const B = this.boss;
      if (!B) return;
      if (e.isCore) {
        B.state = 'dying';
        B.deathT = 0;
        for (const q of B.parts) q.dead = true;
        this.eb.length = 0;
        return;
      }
      if (B.parts.every((q) => q.hp <= 0)) {
        B.core.shielded = false;
        G.audio.play('shieldDown');
        G.radio.say('juno', 'Its shield is down! Hit the core!', 2.5, true);
      }
    }

    finish(success) {
      if (this.result) return;
      this.result = G.makeResult({
        success,
        bonus: this.bonusDone,
        kills: this.kills,
        enemies: Math.max(1, this.enemies),
        damageTaken: this.v.damageTaken,
        maxHp: this.v.maxHull + this.v.maxShield,
        time: this.t,
        scrap: Math.round(this.scrap),
        caches: this.caches,
      });
    }

    // ---------- Drawing ----------
    draw(ctx) {
      const V = this.view;
      const th = this.th;
      ctx.save();
      ctx.translate(G.W / 2, G.H / 2);
      ctx.rotate(this.camRoll);
      ctx.translate(-G.W / 2, -G.H / 2);
      this.drawBackground(ctx);

      // Depth-sorted scene.
      const list = [];
      for (const e of this.ents) list.push([e.z, 0, e]);
      for (const b of this.bolts) list.push([b.z, 1, b]);
      for (const b of this.eb) list.push([b.z, 2, b]);
      for (const q of this.parts) list.push([q.z, 3, q]);
      for (const c of this.clouds) list.push([c.z, 4, c]);
      if (this.phase !== 'dead') list.push([this.p.z, 5, this.p]);
      list.sort((a, b) => b[0] - a[0]);
      for (const it of list) {
        const o = it[2];
        switch (it[1]) {
          case 0: this.drawEnt(ctx, o); break;
          case 1: this.drawBolt(ctx, o); break;
          case 2: this.drawEB(ctx, o); break;
          case 3: this.drawPart(ctx, o); break;
          case 4: this.drawCloud(ctx, o); break;
          case 5: this.drawShip(ctx); break;
        }
      }
      for (const a of this.arcs) {
        const p1 = R.project(V, a.a[0], a.a[1], a.a[2]), p2 = R.project(V, a.b[0], a.b[1], a.b[2]);
        if (!p1 || !p2) continue;
        ctx.strokeStyle = '#bfe8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        for (let i = 1; i < 6; i++) ctx.lineTo(U.lerp(p1.x, p2.x, i / 6) + U.rand(-8, 8), U.lerp(p1.y, p2.y, i / 6) + U.rand(-8, 8));
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      if (th.rain) {
        ctx.strokeStyle = 'rgba(170,190,230,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const r of this.rain) {
          ctx.moveTo(r.x - 80, r.y - 40);
          ctx.lineTo(r.x - 80 - 10 * r.s, r.y - 40 + 26 * r.s);
        }
        ctx.stroke();
      }
      ctx.restore();
      if (this.flashT > 0) {
        ctx.fillStyle = `rgba(220,230,255,${this.flashT * 0.8})`;
        ctx.fillRect(0, 0, G.W, G.H);
      }
      this.drawHUD(ctx);
    }

    drawBackground(ctx) {
      const V = this.view;
      const th = this.th;
      const pad = 140;
      if (!this.skyGrad) {
        const g = ctx.createLinearGradient(0, -pad, 0, V.cy + 10);
        g.addColorStop(0, th.sky[0]);
        g.addColorStop(0.6, th.sky[1]);
        g.addColorStop(1, th.sky[2]);
        this.skyGrad = g;
      }
      ctx.fillStyle = this.skyGrad;
      ctx.fillRect(-pad, -pad, G.W + pad * 2, G.H + pad * 2);
      if (th.sun) {
        const sx = G.W * 0.68 - V.camX * 3, sy = V.cy - 70;
        G.drawGlow(ctx, '#ffb070', sx, sy, 160, 0.6);
        ctx.fillStyle = th.sun;
        ctx.beginPath();
        ctx.arc(sx, sy, 34, 0, Math.PI * 2);
        ctx.fill();
      }
      if (th.planet) {
        const px = G.W * 0.28 - V.camX * 2, py = V.cy - 40 - V.camY * 2;
        G.drawGlow(ctx, '#7d4cb0', px, py, 230, 0.35);
        ctx.strokeStyle = 'rgba(230,190,255,0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(px, py, 200, 36, -0.25, Math.PI, Math.PI * 2);
        ctx.stroke();
        const g = ctx.createRadialGradient(px - 40, py - 40, 10, px, py, 120);
        g.addColorStop(0, '#d99bd0');
        g.addColorStop(0.5, '#7a3f8a');
        g.addColorStop(1, '#1c0f2a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,190,255,0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(px, py, 200, 36, -0.25, 0, Math.PI);
        ctx.stroke();
      }
      if (th.stars) {
        ctx.fillStyle = '#ffffff';
        for (const s of this.stars) {
          const a = R.project(V, s.x, s.y, s.z);
          if (!a) continue;
          const b = R.project(V, s.x, s.y, s.z + 3);
          const al = U.clamp(1 - s.z / FAR, 0.15, 1);
          ctx.strokeStyle = `rgba(220,225,255,${al})`;
          ctx.lineWidth = Math.max(1, a.s * 0.08);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      if (th.corridor) this.drawCorridor(ctx);
      else if (th.ground) this.drawGround(ctx, th.groundY || GROUND);
      if (th.walls) this.drawWalls(ctx);
    }

    fogCol(c, z) {
      const t = U.clamp((z - this.view.fogStart) / (this.view.fogEnd - this.view.fogStart), 0, 1);
      return U.rgb(U.mix(c, this.view.fogColor, t));
    }

    drawGround(ctx, gy) {
      const V = this.view;
      const cols = this.th.ground.map(U.hex);
      const BAND = 10;
      const pad = 160;
      // Far haze from horizon down to the farthest band.
      const yFar = V.cy - (gy - V.camY) * V.F / FAR;
      ctx.fillStyle = this.th.fog;
      ctx.fillRect(-pad, V.cy - 1, G.W + pad * 2, yFar - V.cy + 2);
      const off = this.dist % BAND;
      let z = FAR - ((FAR + off) % BAND);
      let prevY = yFar;
      let prevZ = FAR;
      while (prevZ > 1.2) {
        const zn = Math.max(1.2, z);
        const y = V.cy - (gy - V.camY) * V.F / zn;
        const idx = Math.floor((this.dist + prevZ - 0.01) / BAND) % 2;
        ctx.fillStyle = this.fogCol(cols[idx], prevZ);
        ctx.fillRect(-pad, prevY, G.W + pad * 2, Math.min(G.H + pad, y) - prevY + 1);
        prevY = y;
        prevZ = zn;
        z -= BAND;
        if (y > G.H + pad) break;
      }
      // Converging guide lines add a sense of speed.
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -60; x <= 60; x += 8) {
        const a = R.project(V, x, gy, FAR), b = R.project(V, x, gy, 2);
        if (a && b) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }
      ctx.stroke();
      // Ship shadow
      const sp = R.project(V, this.p.x, gy, Math.max(PZ, this.p.z));
      if (sp && this.phase !== 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, 2.2 * sp.s, 0.5 * sp.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    wallAt(side, wz) {
      const c = 3 * Math.sin(wz * 0.011);
      const hw = 21 + 3 * Math.sin(wz * 0.023 + 1);
      const top = 15 + 5 * Math.sin(wz * 0.05 + side * 2) + 3 * Math.sin(wz * 0.13 + side);
      return { x: c + side * hw, top };
    }

    drawWalls(ctx) {
      const V = this.view;
      const STEP = 6;
      const cols = [U.hex('#8a4a30'), U.hex('#9c5737'), U.hex('#7a3f2a')];
      const off = this.dist % STEP;
      for (const side of [-1, 1]) {
        let z = FAR - ((FAR + off) % STEP);
        let zf = FAR;
        let wf = this.wallAt(side, this.dist + zf);
        while (zf > 1) {
          const zn = Math.max(1.0, z);
          const wn = this.wallAt(side, this.dist + zn);
          const a = R.project(V, wf.x, GROUND, zf), b = R.project(V, wn.x, GROUND, zn);
          const c = R.project(V, wn.x, wn.top, zn), d = R.project(V, wf.x, wf.top, zf);
          if (a && b && c && d) {
            const idx = Math.abs(Math.floor((this.dist + zf) / STEP)) % 3;
            ctx.fillStyle = this.fogCol(U.mix(cols[idx], [0, 0, 0], side > 0 ? 0.15 : 0), zf);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.closePath();
            ctx.fill();
            // Cover everything outside the wall to the screen edge.
            const edge = side < 0 ? -300 : G.W + 300;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(edge, b.y);
            ctx.lineTo(edge, c.y);
            ctx.lineTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.closePath();
            ctx.fill();
          }
          zf = zn;
          wf = wn;
          z -= STEP;
        }
      }
    }

    drawCorridor(ctx) {
      const V = this.view;
      const BAND = 8;
      const off = this.dist % BAND;
      const cFloor = [U.hex('#1f2430'), U.hex('#262c3a')];
      const cWall = [U.hex('#2c3444'), U.hex('#252c3a')];
      const cCeil = [U.hex('#181c26'), U.hex('#1d222e')];
      ctx.fillStyle = '#05070c';
      ctx.fillRect(-200, -200, G.W + 400, G.H + 400);
      let z = FAR - ((FAR + off) % BAND);
      let zf = FAR;
      const quad = (pts, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fill();
      };
      while (zf > 1) {
        const zn = Math.max(1.0, z);
        const P = (x, y, zz) => R.project(V, x, y, zz);
        const fl0 = P(-CWALL, GROUND, zf), fr0 = P(CWALL, GROUND, zf), cl0 = P(-CWALL, CEIL, zf), cr0 = P(CWALL, CEIL, zf);
        const fl1 = P(-CWALL, GROUND, zn), fr1 = P(CWALL, GROUND, zn), cl1 = P(-CWALL, CEIL, zn), cr1 = P(CWALL, CEIL, zn);
        const idx = Math.abs(Math.floor((this.dist + zf) / BAND)) % 2;
        quad([fl0, fr0, fr1, fl1], this.fogCol(cFloor[idx], zf));
        quad([cl0, cr0, cr1, cl1], this.fogCol(cCeil[idx], zf));
        quad([fl0, cl0, cl1, fl1], this.fogCol(cWall[idx], zf));
        quad([fr0, cr0, cr1, fr1], this.fogCol(U.mix(cWall[idx], [0, 0, 0], 0.15), zf));
        // Structural rib every third panel
        if (Math.abs(Math.floor((this.dist + zf) / BAND)) % 3 === 0) {
          const t = U.clamp(1 - zf / FAR, 0, 1);
          ctx.strokeStyle = `rgba(90,104,130,${0.3 + t * 0.6})`;
          ctx.lineWidth = Math.max(1, 1.2 * fl0.s);
          ctx.beginPath();
          ctx.moveTo(fl0.x, fl0.y);
          ctx.lineTo(cl0.x, cl0.y);
          ctx.lineTo(cr0.x, cr0.y);
          ctx.lineTo(fr0.x, fr0.y);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = `rgba(255,179,71,${0.25 + t * 0.6})`;
          ctx.fillRect(fl0.x + 2, fl0.y - 3 * fl0.s * 0.2, Math.max(2, fl0.s * 1.4), Math.max(1, fl0.s * 0.3));
          ctx.fillRect(fr0.x - 2 - Math.max(2, fl0.s * 1.4), fr0.y - 3 * fl0.s * 0.2, Math.max(2, fl0.s * 1.4), Math.max(1, fl0.s * 0.3));
        }
        zf = zn;
        z -= BAND;
      }
      // Light strips along the floor edges.
      for (const x of [-CWALL + 1, CWALL - 1]) {
        const a = R.project(V, x, GROUND + 0.05, FAR), b = R.project(V, x, GROUND + 0.05, 1.2);
        if (a && b) {
          ctx.strokeStyle = 'rgba(95,212,255,0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    drawCloud(ctx, c) {
      const sp = R.project(this.view, c.x, c.y, c.z);
      if (!sp) return;
      const s = c.s * sp.s;
      if (s > 1500) return;
      const fade = U.clamp(c.z / 14, 0, 1) * U.clamp((FAR - c.z) / 40, 0, 1);
      ctx.globalAlpha = c.a * fade;
      ctx.drawImage(G.puff(), sp.x - s, sp.y - s * 0.6, s * 2, s * 1.2);
      ctx.globalAlpha = 1;
    }

    drawEnt(ctx, e) {
      const V = this.view;
      if (e.z < R.NEAR + 0.2) return;
      if (e.type === 'ring') {
        if (e.z < PZ - 0.5) return;
        const sp = R.project(V, e.x, e.y, e.z);
        if (!sp) return;
        const r = e.rad * sp.s;
        const col = e.bonus ? '#ffd37a' : '#5fd4ff';
        ctx.save();
        ctx.globalAlpha = e.passed ? 0.3 : 1;
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(2, 0.35 * sp.s);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = Math.max(4, 0.9 * sp.s);
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (e.type === 'pickup') {
        const sp = R.project(V, e.x, e.y, e.z);
        if (!sp) return;
        const cols = { scrap: '#ffd37a', repair: '#6fe39a', ammo: '#ffb347', cache: '#c77dff' };
        const s = (e.kind === 'scrap' ? 0.5 : 1.1) * sp.s;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.drawGlow(ctx, cols[e.kind], sp.x, sp.y, s * 2.2, 0.9);
        ctx.restore();
        ctx.fillStyle = cols[e.kind];
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(this.t * 2);
        if (e.kind === 'repair') {
          ctx.fillRect(-s * 0.2, -s * 0.6, s * 0.4, s * 1.2);
          ctx.fillRect(-s * 0.6, -s * 0.2, s * 1.2, s * 0.4);
        } else if (e.kind === 'cache') {
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.8);
          ctx.lineTo(s * 0.6, 0);
          ctx.lineTo(0, s * 0.8);
          ctx.lineTo(-s * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
        }
        ctx.restore();
        return;
      }
      if (e.type === 'laser') {
        const span = e.span || CWALL;
        for (const b of e.beams) {
          const a = R.project(V, -span, b.y, e.z), c = R.project(V, span, b.y, e.z);
          if (!a || !c) continue;
          const on = this.beamOn(e, b);
          const warn = !on && ((this.t + b.phase) % b.period) / b.period > 0.85;
          ctx.save();
          if (on) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(255,60,80,0.45)';
            ctx.lineWidth = Math.max(3, 1.2 * a.s);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(c.x, c.y);
            ctx.stroke();
            ctx.strokeStyle = '#ffd0d6';
            ctx.lineWidth = Math.max(1, 0.3 * a.s);
            ctx.stroke();
          } else {
            ctx.strokeStyle = warn ? 'rgba(255,80,90,0.5)' : 'rgba(255,80,90,0.12)';
            ctx.setLineDash([6, 8]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(c.x, c.y);
            ctx.stroke();
          }
          ctx.restore();
          R.drawModel(ctx, V, MD.post, -span + 0.6, b.y, e.z, 0, 0, 0, 1);
          R.drawModel(ctx, V, MD.post, span - 0.6, b.y, e.z, 0, 0, 0, 1);
        }
        return;
      }
      if (e.type === 'hazard' && e.kind === 'strike') {
        const top = R.project(V, e.x, 30, e.z), bot = R.project(V, e.x, -12, e.z);
        if (!top || !bot) return;
        ctx.save();
        if (e.struck) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#dfe9ff';
          ctx.lineWidth = Math.max(2, 0.5 * top.s);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          for (let i = 1; i < 9; i++) ctx.lineTo(U.lerp(top.x, bot.x, i / 9) + U.rand(-1, 1) * top.s * 0.8, U.lerp(top.y, bot.y, i / 9));
          ctx.stroke();
          G.drawGlow(ctx, '#9fc4ff', bot.x, (top.y + bot.y) / 2, top.s * 4, 0.6);
        } else {
          ctx.globalAlpha = 0.3 + Math.sin(this.t * 30) * 0.2;
          ctx.strokeStyle = '#9fc4ff';
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = Math.max(1, 0.25 * top.s);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(bot.x, bot.y);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      if (e.kind === 'missile') {
        const sp = R.project(V, e.x, e.y, e.z);
        if (!sp) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.drawGlow(ctx, '#ff5af0', sp.x, sp.y, 1.4 * sp.s, 1);
        ctx.restore();
        ctx.fillStyle = '#2a1f30';
        ctx.fillRect(sp.x - 0.25 * sp.s, sp.y - 0.25 * sp.s, 0.5 * sp.s, 0.5 * sp.s);
        return;
      }
      if (!e.model) return;
      R.drawModel(ctx, V, e.model, e.x, e.y, e.z, e.rx, e.ry, e.rz, e.sc, { flash: e.flash > 0 ? 0.75 : 0 });
      if (e.shielded) {
        const sp = R.project(V, e.x, e.y, e.z);
        if (sp) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35 + Math.sin(this.t * 6) * 0.1;
          ctx.strokeStyle = '#8f7dff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 3.2 * sp.s, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (e.bonus && e.hp > 0 && e.z < FAR - 5) {
        const top = R.project(V, e.x, e.y + (e.col ? e.col[0].y + e.col[0].h : 2) + 1.5, e.z);
        if (top) {
          const bob = Math.sin(this.t * 6) * 4;
          ctx.fillStyle = '#ffd37a';
          ctx.beginPath();
          ctx.moveTo(top.x, top.y + bob);
          ctx.lineTo(top.x - 8, top.y - 12 + bob);
          ctx.lineTo(top.x + 8, top.y - 12 + bob);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    drawShip(ctx) {
      const p = this.p;
      const V = this.view;
      if (p.z < R.NEAR + 0.5) return;
      const blink = this.v.invuln > 0 && p.dodgeT <= 0 && Math.floor(this.t * 20) % 2 === 0;
      if (blink) return;
      R.drawModel(ctx, V, MD.ship, p.x, p.y, p.z, -p.pitch, p.vx * 0.015, p.roll + p.spin, SHIP_SC, { flash: this.v.flash > 0.2 ? 0.5 : 0 });
      const tail = R.project(V, p.x, p.y, p.z - 0.9);
      if (tail) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.drawGlow(ctx, '#ffb347', tail.x, tail.y, 0.34 * tail.s * (0.9 + Math.random() * 0.2), 1);
        ctx.restore();
      }
      if (this.v.shieldFlash > 0 && this.v.shield > 0) {
        const c = R.project(V, p.x, p.y, p.z);
        if (c) {
          ctx.save();
          ctx.globalAlpha = this.v.shieldFlash * 2;
          ctx.strokeStyle = '#5fd4ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 2.2 * c.s, 1.1 * c.s, -p.roll, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    drawBolt(ctx, b) {
      const V = this.view;
      const a = R.project(V, b.x, b.y, b.z);
      if (!a) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (b.kind === 'nova') {
        G.drawGlow(ctx, '#d6e6ff', a.x, a.y, 2.5 * a.s, 1);
      } else if (b.kind === 'missile' || b.kind === 'flak') {
        G.drawGlow(ctx, b.col, a.x, a.y, 1.2 * a.s, 1);
      } else {
        const len = b.rail ? 6 : 2.6;
        const t = R.project(V, b.x - (b.vx / b.vz) * len, b.y - (b.vy / b.vz) * len, b.z - len);
        if (t) {
          ctx.strokeStyle = b.col;
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1.5, b.r * a.s * 0.9);
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(a.x, a.y);
          ctx.stroke();
        }
        G.drawGlow(ctx, b.col, a.x, a.y, Math.max(3, b.r * 2 * a.s), 0.8);
      }
      ctx.restore();
    }

    drawEB(ctx, b) {
      const a = R.project(this.view, b.x, b.y, b.z);
      if (!a) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      G.drawGlow(ctx, b.col, a.x, a.y, Math.max(4, b.r * 2.4 * a.s), 1);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(a.x, a.y, Math.max(1.5, b.r * 0.45 * a.s), 0, Math.PI * 2);
      ctx.fill();
    }

    drawPart(ctx, q) {
      const a = R.project(this.view, q.x, q.y, q.z);
      if (!a) return;
      const f = q.life / q.max;
      if (q.glow) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.drawGlow(ctx, q.col, a.x, a.y, q.size * a.s * (0.5 + f * 0.6), Math.min(1, f * 1.6));
        ctx.restore();
      } else {
        ctx.fillStyle = q.col;
        const s = Math.max(1, q.size * a.s);
        ctx.fillRect(a.x - s / 2, a.y - s / 2, s, s);
      }
    }

    drawHUD(ctx) {
      const V = this.view;
      const p = this.p;
      // Reticles: near box shows aim line, far box locks onto the assisted target.
      if (this.reticle && (this.phase === 'play' || this.phase === 'boss')) {
        const r = this.reticle;
        const near = R.project(V, p.x + r.x * 18, p.y + r.y * 18, PZ + 18);
        let far = R.project(V, p.x + r.x * 50, p.y + r.y * 50, PZ + 50);
        const t = this.lockTarget;
        if (t) far = R.project(V, t.x, t.y + (t.hitY || 0) + (t.col ? t.col[0].y : 0), t.z) || far;
        ctx.save();
        ctx.translate(G.W / 2, G.H / 2);
        ctx.rotate(this.camRoll);
        ctx.translate(-G.W / 2, -G.H / 2);
        ctx.lineWidth = 2;
        if (near) {
          ctx.strokeStyle = 'rgba(140,255,170,0.7)';
          ctx.strokeRect(near.x - 12, near.y - 12, 24, 24);
        }
        if (far) {
          ctx.strokeStyle = t ? '#ff6b5e' : 'rgba(140,255,170,0.5)';
          const s = t ? 14 + Math.sin(this.t * 12) * 2 : 8;
          ctx.beginPath();
          ctx.moveTo(far.x - s, far.y);
          ctx.lineTo(far.x - s / 2, far.y);
          ctx.moveTo(far.x + s / 2, far.y);
          ctx.lineTo(far.x + s, far.y);
          ctx.moveTo(far.x, far.y - s);
          ctx.lineTo(far.x, far.y - s / 2);
          ctx.moveTo(far.x, far.y + s / 2);
          ctx.lineTo(far.x, far.y + s);
          ctx.stroke();
          if (t) {
            ctx.strokeRect(far.x - s, far.y - s, s * 2, s * 2);
          }
        }
        // Behind-you warning
        const behind = this.ents.some((e) => e.ai === 'chaser' && e.z < PZ && e.hp > 0);
        if (behind) G.text(ctx, '▼ BEHIND YOU ▼', G.W / 2, G.H - 30, { size: 16, align: 'center', color: Math.floor(this.t * 6) % 2 ? '#ff6b5e' : '#ffffff' });
        ctx.restore();
      }
      G.hud.vitals(ctx, this.v);
      G.hud.scoreBox(ctx, this.scrap, `KILLS ${this.kills}` + (this.caches ? `  ·  CACHES ${this.caches}` : ''));
      if (this.m.bonus) G.hud.objective(ctx, this.m.bonus.text, Math.min(this.bonusCount, this.bonusNeed), this.bonusNeed, this.bonusDone);
      if (this.boss && this.boss.state !== 'enter') {
        const B = this.boss;
        const hp = B.parts.reduce((s, e) => s + Math.max(0, e.hp), 0) + Math.max(0, B.core.hp);
        G.hud.bossBar(ctx, B.def.name, hp / B.maxHp, B.core.shielded);
      }
      const ammoName = G.gear.ARCH.secondary[this.st.secondary.arch].name.toUpperCase();
      G.hud.ammo(ctx, ammoName, this.ammo, this.maxAmmo, U.clamp(1 - this.p.dodgeCD / this.st.dodgeCD, 0, 1));
      G.popups.draw(ctx);
      G.radio.draw(ctx);
      G.hud.titleCard(ctx, this.m, this.t);
      if (this.phase === 'outro') G.hud.banner(ctx, 'MISSION COMPLETE', '#ffd37a');
      if (this.phase === 'dead') G.hud.banner(ctx, 'SHIP LOST', '#ff6b5e');
      G.input.drawTouch(ctx);
    }
  }

  // ---------- Enemy behaviours ----------
  const AI = {
    static(f, e) {
      e.vz = -f.S;
    },
    dart(f, e, dt) {
      const age = e.t;
      if (e.hold && e.z < e.holdZ && !e.left) {
        e.vz = U.damp(e.vz, 0, 3, dt);
        e.holdT = (e.holdT || 0) + dt;
        if (e.holdT > 2.6) e.left = true;
      } else if (e.left) {
        e.vz = U.damp(e.vz, -55, 2, dt);
      }
      e.vx = Math.cos(age * e.freq + e.ph) * e.amp;
      e.vy = Math.sin(age * e.freq * 0.7 + e.ph) * e.amp * 0.3;
      e.rz = -e.vx * 0.05;
      e.fireCD -= dt;
      if (e.fireCD <= 0 && e.z > 22 && e.z < 95) {
        f.shoot(e.x, e.y, e.z, 34);
        e.fireCD = U.rand(1.6, 2.8) / f.diffMul;
      }
    },
    swoop(f, e, dt) {
      e.vy = Math.cos(e.t * 2) * 2;
      e.rz = e.side * 0.6;
      e.ry = Math.PI - e.side * 0.5;
      e.fireCD -= dt;
      if (e.fireCD <= 0 && Math.abs(e.x) < 14) {
        f.shoot(e.x, e.y, e.z, 34);
        e.fireCD = U.rand(1.2, 2) / f.diffMul;
      }
    },
    drone(f, e, dt) {
      const a = e.ph + e.t * 2.2;
      e.x = e.cx + Math.cos(a) * e.rad;
      e.y = e.cy + Math.sin(a) * e.rad;
      e.vx = 0;
      e.vy = 0;
      e.ry += dt * 3;
      e.fireCD -= dt;
      if (e.fireCD <= 0 && e.z > 25 && e.z < 90) {
        f.shoot(e.x, e.y, e.z, 30, 0, 0, 8, '#ff5af0');
        e.fireCD = U.rand(2.4, 3.6) / f.diffMul;
      }
    },
    gunship(f, e, dt) {
      if (e.state === 'in') {
        e.vz = U.damp(e.vz, -40, 2, dt);
        e.vy = (e.ty - e.y) * 1.5;
        if (e.z < e.hz) {
          e.state = 'hold';
          e.vz = 0;
        }
      } else if (e.state === 'hold') {
        e.vz = U.damp(e.vz, 0, 4, dt);
        e.vx = Math.sin(e.t * 0.9) * 4;
        e.vy = (e.ty - e.y) * 1.5;
        e.holdT = (e.holdT || 0) + dt;
        e.fireCD -= dt;
        if (e.fireCD <= 0) {
          for (let i = 0; i < 3; i++) setTimeout(() => !e.dead && f.phase !== 'dead' && f.shoot(e.x + (i - 1) * 1.2, e.y - 0.5, e.z - 1.5, 36), i * 160);
          e.fireCD = U.rand(2, 2.6) / f.diffMul;
        }
        if (e.holdT > 8) e.state = 'out';
      } else {
        e.vz = U.damp(e.vz, 30, 1, dt);
        e.vy = U.damp(e.vy, 10, 1, dt);
      }
      e.rz = -e.vx * 0.05;
    },
    chaser(f, e, dt) {
      if (e.z < 38 && !e.holding) {
        e.vz = U.damp(e.vz, 55, 2, dt);
      } else {
        e.holding = true;
        e.holdT = (e.holdT || 0) + dt;
        e.vz = U.damp(e.vz, e.holdT > 4 ? 45 : 0, 2, dt);
        e.ry = U.damp(e.ry, Math.PI, 3, dt);
        e.vx = Math.sin(e.t * 1.6) * 5;
        e.fireCD -= dt;
        if (e.fireCD <= 0 && e.holdT < 4) {
          f.shoot(e.x, e.y, e.z, 34);
          e.fireCD = U.rand(1.4, 2.2) / f.diffMul;
        }
      }
      e.rz = -e.vx * 0.06;
    },
    turret(f, e, dt) {
      e.vz = -f.S;
      e.fireCD -= dt;
      if (e.fireCD <= 0 && e.z > 22 && e.z < 105) {
        f.shoot(e.x, e.y + (e.ceiling ? -1.3 : 1.3), e.z, 32);
        e.fireCD = U.rand(1.8, 2.8) / f.diffMul;
      }
    },
    mine(f, e) {
      e.vz = -f.S;
      e.vy = Math.sin(e.t * 2 + e.ph) * 0.8;
      e.ry += 0.02;
      e.rx += 0.015;
      const p = f.p;
      if (e.hp > 0 && Math.abs(e.z - PZ) < 2 && Math.hypot(p.x - e.x, p.y - e.y) < 2.4 && !e.hitPlayer) {
        e.hitPlayer = true;
        f.playerHit(24, 0.5);
        f.kill(e);
      }
    },
    missile(f, e, dt) {
      const p = f.p;
      const t = Math.max(0.4, (e.z - PZ) / 22);
      e.vx = U.damp(e.vx, (p.x - e.x) / t, 1.6, dt);
      e.vy = U.damp(e.vy, (p.y - e.y) / t, 1.6, dt);
      e.vz = -22;
      if (Math.random() < 0.5) f.parts.push({ x: e.x, y: e.y, z: e.z + 0.5, vx: 0, vy: 0, vz: -f.S * 0.3, life: 0.4, max: 0.4, size: 0.7, col: '#8a6a9a', glow: true, drag: 1 });
      if (e.z < PZ + 0.8 && !e.hitPlayer) {
        e.hitPlayer = true;
        if (Math.hypot(p.x - e.x, p.y - e.y) < 1.6) {
          if (p.dodgeT > 0) f.kill(e);
          else {
            f.playerHit(16, 0.3);
            f.explosion(e.x, e.y, e.z, 1, '#ff5af0');
            e.dead = true;
          }
        }
      }
    },
    frigate(f, e, dt) {
      if (e.z > 72 && !e.leaving) e.vz = -40;
      else if (!e.leaving) {
        e.vz = U.damp(e.vz, 0, 2, dt);
        e.holdT = (e.holdT || 0) + dt;
        e.vx = -e.side * 0.9;
        e.vy = Math.sin(e.t) * 0.6;
        e.fireCD -= dt;
        if (e.fireCD <= 0) {
          for (let i = 0; i < 4; i++) f.shoot(e.x, e.y, e.z - 7, 30, (i - 1.5) * 2.4, 0);
          e.fireCD = 2.6 / f.diffMul;
        }
        if (e.holdT > 15) {
          e.leaving = true;
          G.radio.say('vesk', 'Frigate is pulling away!', 1.8);
        }
      } else e.vz = U.damp(e.vz, 35, 1, dt);
    },
    strike(f, e) {
      e.vz = -f.S;
      if (!e.struck && e.z < PZ + 2.5) {
        e.struck = true;
        e.life = 0.3;
        f.flashT = 0.2;
        G.audio.play('thunder');
        const p = f.p;
        if (Math.abs(p.x - e.x) < 1.9 && Math.abs(e.z - PZ) < 3) f.playerHit(28, 0.5);
      }
      if (e.struck) {
        e.life -= 1 / 60;
        if (e.life <= 0) e.dead = true;
      }
    },
  };

  // ---------- Spawn patterns ----------
  const PATTERNS = {
    darts: {
      gap: 3.6,
      fn(f, diff) {
        const n = U.randi(3, diff > 0.5 ? 6 : 4);
        const x0 = U.rand(-7, 7), y0 = U.rand(-2, 4);
        const v = U.chance(0.5);
        const hold = diff > 0.25 && U.chance(0.5);
        for (let i = 0; i < n; i++) {
          const k = i - (n - 1) / 2;
          f.enemy('dart', x0 + k * 3, y0 + (v ? Math.abs(k) * 1.2 : 0), FAR + Math.abs(k) * 4, {
            vz: -(f.S * 0.6 + 6), amp: U.rand(2, 5), freq: U.rand(1.2, 2), ph: i * 0.6, hold, holdZ: U.rand(40, 60),
          });
        }
      },
    },
    swoop: {
      gap: 3.8,
      fn(f) {
        const side = U.chance(0.5) ? 1 : -1;
        const y = U.rand(0, 5);
        for (let i = 0; i < 3; i++) {
          f.enemy('dart', side * (32 + i * 6), y + i * 0.8, U.rand(48, 70), { ai: 'swoop', side, vx: -side * 14, vz: -5 });
        }
      },
    },
    drones: {
      gap: 4.2,
      fn(f) {
        const cx = U.rand(-5, 5), cy = U.rand(-1, 4);
        for (let i = 0; i < 6; i++) f.enemy('drone', cx, cy, FAR + i * 5, { ai: 'drone', cx, cy, rad: 3.2, ph: (i / 6) * Math.PI * 2, vz: -(f.S * 0.7) });
      },
    },
    gunship: {
      gap: 5,
      fn(f, diff) {
        const n = diff > 0.6 ? 2 : 1;
        for (let i = 0; i < n; i++) f.enemy('gunship', n === 1 ? U.rand(-5, 5) : (i ? 6 : -6), 12, FAR, { ai: 'gunship', state: 'in', hz: U.rand(42, 58), ty: U.rand(1, 5), vz: -40 });
      },
    },
    chasers: {
      gap: 4.5,
      fn(f) {
        G.radio.say('vesk', 'Bandits on your six! They are coming over the top!', 2.4);
        G.audio.play('alarm');
        for (let i = 0; i < 3; i++) f.enemy('dart', U.rand(-8, 8), U.rand(1, 6), -5 - i * 3, { ai: 'chaser', vz: 52, ry: 0 });
      },
    },
    turrets: {
      gap: 3.2,
      fn(f) {
        const n = U.randi(3, 4);
        const ceiling = f.th.corridor && U.chance(0.5);
        for (let i = 0; i < n; i++) {
          const x = U.rand(-11, 11);
          if (ceiling) f.enemy('turret', x, CEIL, FAR + i * 12, { ai: 'turret', rz: Math.PI, ceiling: true, hitY: -1.3 });
          else f.enemy('turret', x, f.th.groundY || GROUND, FAR + i * 12, { ai: 'turret' });
        }
      },
    },
    pillars: {
      gap: 3, solid: true,
      fn(f, diff) {
        const n = U.randi(3, diff > 0.5 ? 6 : 4);
        for (let i = 0; i < n; i++) {
          const x = U.rand(-11, 11);
          f.add({ type: 'obstacle', model: U.pick(MD.rocks), x, y: GROUND, z: FAR + i * 9, col: [{ x: 0, y: 8, w: 1.7, h: 8 }], d: 2, ry: U.rand(0, 6) });
        }
      },
    },
    arch: {
      gap: 3, solid: true,
      fn(f) {
        const x = U.rand(-4, 4);
        f.add({ type: 'obstacle', model: MD.arch, x, y: GROUND, z: FAR, col: [{ x: -6.5, y: 6.5, w: 2, h: 6.5 }, { x: 6.5, y: 6.5, w: 2, h: 6.5 }, { x: 0, y: 14, w: 8.5, h: 1.5 }], d: 1.9 });
        for (let i = 0; i < 4; i++) f.add({ type: 'pickup', kind: 'scrap', x, y: GROUND + 7 - i * 0.2, z: FAR + 3 + i * 3, value: 3, r: 0.5 });
      },
    },
    wallgap: {
      gap: 3.4, solid: true,
      fn(f) {
        const gx = U.rand(-6, 6), gy = U.rand(-2.5, 4);
        const hw = 3.8, hh = 2.9;
        const L = -32, Rr = 32, B = GROUND, T = f.th.corridor ? CEIL : 22;
        const metal = !!f.th.corridor;
        const mb = new R.MB();
        const col = metal ? '#3d4554' : '#8a4a30';
        const parts = [
          [L, B, gx - hw, T], [gx + hw, B, Rr, T], [gx - hw, gy + hh, gx + hw, T], [gx - hw, B, gx + hw, gy - hh],
        ];
        const cols = [];
        for (const [x0, y0, x1, y1] of parts) {
          mb.box((x0 + x1) / 2, (y0 + y1) / 2, 0, x1 - x0, y1 - y0, 2.4, col);
          cols.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: (x1 - x0) / 2, h: (y1 - y0) / 2 });
        }
        if (metal) {
          mb.box(gx, gy + hh + 0.15, -1.25, hw * 2, 0.3, 0.1, '#ffb347', true);
          mb.box(gx, gy - hh - 0.15, -1.25, hw * 2, 0.3, 0.1, '#ffb347', true);
        }
        f.add({ type: 'obstacle', model: mb.build(), x: 0, y: 0, z: FAR, col: cols, d: 1.3 });
        f.add({ type: 'pickup', kind: 'scrap', x: gx, y: gy, z: FAR + 2, value: 4, r: 0.5 });
      },
    },
    mines: {
      gap: 3.8,
      fn(f) {
        const n = U.randi(6, 10);
        for (let i = 0; i < n; i++) f.enemy('mine', U.rand(-11, 11), U.rand(-4, 6), FAR + i * 5, { ai: 'mine', ph: U.rand(0, 6) });
      },
    },
    asteroids: {
      gap: 3.6, solid: true,
      fn(f, diff) {
        const n = U.randi(7, diff > 0.5 ? 13 : 10);
        for (let i = 0; i < n; i++) {
          const sc = U.rand(1.2, 3.2);
          const big = sc > 2.6;
          f.add({ type: big ? 'obstacle' : 'enemy', kind: 'asteroid', model: U.pick(MD.asteroids), x: U.rand(-14, 14), y: U.rand(-6, 8), z: FAR + i * 6, sc, r: sc * 0.85, d: sc * 0.8, hp: big ? 0 : Math.round(12 * sc), maxHp: Math.round(12 * sc), scrapV: big ? 0 : 3, cacheChance: 0.03, spin: [U.rand(-1, 1), U.rand(-1, 1)], ai: 'rock', destructible: false });
        }
      },
    },
    lightning: {
      gap: 3.4,
      fn(f) {
        for (let i = 0; i < 3; i++) f.add({ type: 'hazard', kind: 'strike', x: U.rand(-10, 10), y: 0, z: FAR + i * 14, ai: 'strike' });
      },
    },
    lasers: {
      gap: 3.2, solid: true,
      fn(f, diff) {
        const n = U.randi(1, 3);
        for (let i = 0; i < n; i++) {
          const beams = [];
          const ys = U.shuffle([-4, -1.5, 1, 3.5, 6]).slice(0, U.randi(1, 2));
          for (const y of ys) beams.push(diff > 0.3 && U.chance(0.6) ? { y, period: U.rand(1.6, 2.4), phase: U.rand(0, 2) } : { y });
          f.add({ type: 'laser', beams, z: FAR + i * 18 });
        }
      },
    },
    girders: {
      gap: 3, solid: true,
      fn(f) {
        const n = U.randi(2, 3);
        for (let i = 0; i < n; i++) {
          if (U.chance(0.5)) {
            const y = U.rand(-4, 6);
            f.add({ type: 'obstacle', model: MD.girder, x: 0, y, z: FAR + i * 14, col: [{ x: 0, y: 0, w: 22, h: 0.6 }], d: 0.8 });
          } else {
            const x = U.rand(-9, 9);
            f.add({ type: 'obstacle', model: MD.girder, x, y: 1.5, z: FAR + i * 14, rz: Math.PI / 2, col: [{ x: 0, y: 0, w: 0.6, h: 22 }], d: 0.8 });
          }
        }
      },
    },
    boostrings: {
      gap: 3,
      fn(f) {
        const x0 = U.rand(-6, 6), y0 = U.rand(-2, 4);
        for (let i = 0; i < 4; i++) f.add({ type: 'ring', x: x0 + Math.sin(i * 0.8) * 4, y: y0 + Math.cos(i * 0.8) * 1.5, z: FAR + i * 10, rad: 2.6 });
      },
    },
  };
  AI.rock = function (f, e, dt) {
    e.vz = -f.S;
    e.rx += e.spin[0] * dt;
    e.ry += e.spin[1] * dt;
  };

  G.modes = G.modes || {};
  G.modes.flight = (mission, stats) => new Flight(mission, stats);
})();
