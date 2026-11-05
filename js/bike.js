// Speeder chase: a segment-based pseudo-3D road with curves and hills. Shoot raiders, catch the courier.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const I = G.input;

  const SEG = 200, ROADW = 2000, CAMH = 1000, DRAW = 230, RUMBLE = 3;
  const DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
  const PLAYER_Z = CAMH * DEPTH;
  const MAXS = SEG * 60; // one segment per frame at 60fps
  const BIKE_W = 0.13;

  const THEMES = {
    salt: {
      sky: ['#7fb2e0', '#cfe2f0', '#f4efe2'], fog: '#efe8d8',
      grass: ['#e9e1cd', '#e0d7c0'], road: ['#8f8b84', '#8a867f'], rumble: ['#c0583c', '#f4f0e6'], lane: '#f4f0e6',
      decor: [['pillar', 4], ['mesa', 2], ['sign', 1], ['wreck', 1]], music: 'bike', length: 3900,
      far: '#b9a58e', near: '#a68d74',
      intro: [['juno', 'Bike is fueled. The courier has a head start, so open it up!'], ['vesk', 'Raiders on the flats. Shoot them or ram them, I do not care which.']],
    },
    night: {
      sky: ['#05030f', '#1a0d33', '#3b1550'], fog: '#2a1240', night: true,
      grass: ['#120a22', '#0f081d'], road: ['#2a2838', '#262433'], rumble: ['#ff3df2', '#2ad8ff'], lane: '#ffd37a',
      decor: [['tower', 4], ['neon', 3], ['billboard', 1.2], ['lamp', 2]], music: 'bike', length: 4300,
      far: '#1c1034', near: '#2a1546',
      intro: [['ops', 'Undercity highway is all yours. Crown patrols are thick tonight.'], ['juno', 'Courier spotted way ahead. It is faster than the last one, so keep your speed up!']],
    },
  };

  const easeIn = (a, b, t) => a + (b - a) * Math.pow(t, 2);
  const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);

  class Bike {
    constructor(mission, stats) {
      this.combo = new G.Combo();
      this.m = mission;
      this.st = stats;
      this.th = THEMES[mission.theme];
      this.v = new G.Vitals(stats, mission);
      this.dmgOut = U.clamp(1 + (stats.power - mission.power) * 0.025, 0.55, 1.45);
      this.diffMul = U.clamp(1 + (mission.stage - 1) * 0.12, 1, 1.6);
      this.fx = new G.Particles2D();
      this.segments = [];
      this.items = [];
      this.buildTrack();
      this.position = 0;
      this.playerX = 0;
      this.speed = 0;
      this.lean = 0;
      this.boostT = 0;
      this.boostCD = 0;
      this.fireCD = 0;
      this.altCD = 0;
      this.ammo = Math.min(10, Math.max(3, Math.round(stats.secondary.ammo * 0.6)));
      this.maxAmmo = this.ammo;
      this.cars = [];
      this.bolts = [];
      this.eb = [];
      this.t = 0;
      this.phase = 'intro';
      this.phaseT = 0;
      this.kills = 0;
      this.enemies = 0;
      this.scrap = 0;
      this.caches = 0;
      this.skyOff = 0;
      this.hillOff = 0;
      this.result = null;
      this.bonusDone = false;
      this.courierGone = false;
      this.spawnTimer = 2;
      this.populate();
      G.radio.clear();
      G.popups.clear();
      for (const [w, l] of this.th.intro) G.radio.say(w, l, 3.6);
      G.audio.music(this.th.music);
    }

    // ---------- Track ----------
    addSeg(curve, y) {
      const n = this.segments.length;
      const lastY = n ? this.segments[n - 1].p2.world.y : 0;
      this.segments.push({
        index: n,
        p1: { world: { y: lastY, z: n * SEG }, camera: {}, screen: {} },
        p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
        curve,
        sprites: [],
        dyn: [],
        color: Math.floor(n / RUMBLE) % 2,
      });
    }
    addRoad(enter, hold, leave, curve, hill) {
      const startY = this.segments.length ? this.segments[this.segments.length - 1].p2.world.y : 0;
      const endY = startY + hill * SEG;
      const total = enter + hold + leave;
      for (let n = 0; n < enter; n++) this.addSeg(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
      for (let n = 0; n < hold; n++) this.addSeg(curve, easeInOut(startY, endY, (enter + n) / total));
      for (let n = 0; n < leave; n++) this.addSeg(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    }
    buildTrack() {
      const len = this.th.length;
      this.addRoad(10, 60, 10, 0, 0);
      while (this.segments.length < len) {
        const r = Math.random();
        const c = U.pick([-6, -4, -3, -2, 2, 3, 4, 6]);
        const h = U.pick([-40, -20, 0, 0, 20, 40, 60]);
        const L = U.randi(30, 80);
        if (r < 0.25) this.addRoad(20, L, 20, 0, h);
        else this.addRoad(25, L, 25, c, h * 0.7);
      }
      this.finishIndex = this.segments.length;
      this.addRoad(20, DRAW + 80, 20, 0, 0);
      this.trackLen = this.segments.length * SEG;
      this.finishZ = this.finishIndex * SEG;
      // Scenery
      const th = this.th;
      for (let i = 20; i < this.segments.length; i += U.randi(3, 7)) {
        for (const side of [-1, 1]) {
          if (Math.random() < 0.6) {
            const kind = U.weighted(th.decor);
            const far = kind === 'mesa' || kind === 'tower' ? U.rand(2.4, 5) : U.rand(1.35, 2.6);
            this.segments[i].sprites.push({ kind, offset: side * far, seed: Math.random() });
          }
        }
      }
      this.segments[this.finishIndex].sprites.push({ kind: 'finish', offset: 0, seed: 0 });
      // Road items: barricades, boost pads, scrap lines, repairs
      for (let i = 120; i < this.finishIndex - 40; i += U.randi(35, 70)) {
        const r = Math.random();
        const lane = U.pick([-0.66, 0, 0.66]);
        if (r < 0.35) this.items.push({ kind: 'barricade', z: i * SEG, offset: lane, w: 0.2 });
        else if (r < 0.55) this.items.push({ kind: 'boost', z: i * SEG, offset: lane, w: 0.18 });
        else if (r < 0.85) for (let k = 0; k < 5; k++) this.items.push({ kind: 'scrap', z: (i + k * 2) * SEG, offset: lane, w: 0.12 });
        else this.items.push({ kind: U.chance(0.6) ? 'repair' : 'ammo', z: i * SEG, offset: lane, w: 0.14 });
      }
    }
    findSeg(z) {
      return this.segments[Math.max(0, Math.floor(z / SEG)) % this.segments.length];
    }

    populate() {
      const mk = (z, kind) => this.addCar(z, kind);
      for (let i = 0; i < 6; i++) mk((40 + i * 45) * SEG, U.chance(0.3) ? 'gunner' : 'raider');
      const cz = 140 * SEG;
      this.courier = this.addCar(cz, 'courier');
      this.addCar(cz + 6 * SEG, 'raider').escort = this.courier;
      this.addCar(cz - 6 * SEG, 'gunner').escort = this.courier;
    }
    addCar(z, kind) {
      const hp = { raider: 40, gunner: 55, courier: 420 }[kind] * this.diffMul;
      const c = {
        kind, z, offset: U.pick([-0.6, 0, 0.6]), target: 0, speed: MAXS * (kind === 'courier' ? 0.84 : U.rand(0.6, 0.78)),
        hp, maxHp: hp, w: kind === 'courier' ? 0.2 : BIKE_W, flash: 0, t: Math.random() * 10, fireCD: U.rand(1, 3), laneT: 0, countKill: kind !== 'courier',
      };
      if (c.countKill) this.enemies++;
      this.cars.push(c);
      return c;
    }

    // ---------- Update ----------
    update(rdt) {
      const dt = this.combo.step(rdt);
      this.t += dt;
      this.phaseT += dt;
      G.radio.update(dt);
      G.popups.update(dt);
      this.fx.update(dt);
      this.v.update(dt);
      const pz = this.position + PLAYER_Z;
      const pseg = this.findSeg(pz);
      if (this.phase === 'intro' && this.phaseT > 1.2) {
        this.phase = 'play';
        this.phaseT = 0;
      }
      const alive = this.phase === 'play' || this.phase === 'intro';
      // Throttle is automatic; brake slows you, boost speeds you up.
      let maxS = MAXS * (0.92 + 0.08 * this.st.speed);
      this.boostT -= dt;
      this.boostCD -= dt;
      if (alive && I.pressed('dodge') && this.boostCD <= 0) {
        this.boostT = 1.6;
        this.boostCD = this.st.dodgeCD * 3.5;
        G.audio.play('dash');
        if (this.st.perks.has('reflex')) this.v.addShield(12);
      }
      if (this.boostT > 0) maxS *= 1.32;
      const offroad = this.playerX < -1.05 || this.playerX > 1.05;
      if (this.phase === 'dead') this.speed = U.approach(this.speed, 0, MAXS * dt);
      else if (this.phase === 'outro') this.speed = U.approach(this.speed, MAXS * 0.4, MAXS * 0.5 * dt);
      else if (I.down('down')) this.speed = U.approach(this.speed, MAXS * 0.3, MAXS * 1.1 * dt);
      else this.speed = U.approach(this.speed, maxS, (this.speed > maxS ? MAXS * 0.8 : MAXS / 3.2) * dt);
      if (offroad && this.speed > MAXS * 0.35) this.speed = U.approach(this.speed, MAXS * 0.35, MAXS * 1.3 * dt);
      const sp = this.speed / MAXS;
      if (alive) {
        const steer = I.ax * dt * 2.6 * Math.min(1, sp * 1.5 + 0.2) * this.st.speed;
        this.playerX += steer;
        this.lean = U.damp(this.lean, I.ax, 8, dt);
      } else this.lean = U.damp(this.lean, 0, 4, dt);
      this.playerX -= dt * 2 * sp * sp * pseg.curve * 0.28; // centrifugal drift
      this.playerX = U.clamp(this.playerX, -2.2, 2.2);
      this.position = Math.min(this.position + this.speed * dt, this.trackLen - DRAW * SEG - SEG);
      this.skyOff += pseg.curve * sp * dt * 0.02;
      this.hillOff += pseg.curve * sp * dt * 0.04;
      if (offroad && this.speed > MAXS * 0.2 && Math.random() < 0.5) this.fx.add({ x: G.W / 2 + U.rand(-40, 40), y: G.H - 30, vx: U.rand(-80, 80), vy: U.rand(-120, -40), life: 0.5, size: 6, color: this.th.night ? '#3a2a55' : '#d8ccb0', drag: 0.95 });

      // Weapons
      this.fireCD -= dt;
      this.altCD -= dt;
      if (alive && this.phase === 'play') {
        if (I.down('fire') && this.fireCD <= 0) this.fire();
        if (I.pressed('alt') && this.altCD <= 0) this.fireMissile();
      }

      this.updateCars(dt, pz);
      this.updateBolts(dt);
      this.updateItems(pz);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.phase === 'play' && pz < this.finishZ - 60 * SEG) {
        this.spawnTimer = U.rand(3.5, 6) / this.diffMul;
        const ahead = this.cars.filter((c) => c.z > pz && c.kind !== 'courier').length;
        if (ahead < 6) this.addCar(pz + U.rand(120, 190) * SEG, U.chance(0.35) ? 'gunner' : 'raider');
      }
      // Offroad scenery crash
      if (offroad && this.phase === 'play') {
        for (const s of pseg.sprites) {
          if (s.kind === 'finish') continue;
          const w = 0.35;
          if (Math.abs(this.playerX - s.offset) < w && this.speed > MAXS * 0.15) {
            this.speed = MAXS * 0.1;
            this.playerHit(20);
            this.playerX += this.playerX > s.offset ? 0.3 : -0.3;
            this.fx.burst(G.W / 2, G.H - 60, '#ffb347', 10, 200, 14);
            G.audio.play('boom');
          }
        }
      }

      if (this.phase === 'play' && pz >= this.finishZ) {
        this.phase = 'outro';
        this.phaseT = 0;
        G.audio.music('victory');
        if (!this.bonusDone && !this.courierGone) {
          this.courierGone = true;
          G.radio.say('harrow', 'You made the gate, but the courier got away. Still, good riding.', 3.2, true);
        } else G.radio.say('harrow', 'Through the gate! Nice riding, Wingbreaker.', 3, true);
      }
      if (this.phase === 'outro' && this.phaseT > 2.6) this.finish(true);
      if (this.phase === 'dead' && this.phaseT > 2.4) this.finish(false);
    }

    fire() {
      const st = this.st.primary;
      const pz = this.position + PLAYER_Z;
      const col = { pulse: '#7fe4ff', repeater: '#8dffa8', scatter: '#ffb347', rail: '#d6a8ff' }[st.arch];
      const target = this.aimTarget(pz);
      const n = Math.min(3, st.pellets);
      for (let i = 0; i < n; i++) {
        const spread = n > 1 ? (i - 1) * 0.08 : 0;
        this.bolts.push({ z: pz + SEG * 0.5, x: this.playerX + spread + (st.arch === 'repeater' ? (Math.floor(this.t * 30) % 2 ? 0.04 : -0.04) : 0), target, dmg: st.dmg * this.dmgOut * (n > 1 ? 1.5 : 1), col, life: 0.8, pierce: st.pierce, spd: MAXS * 2.8 });
      }
      this.fireCD = 1 / st.rate;
      G.audio.play(st.arch === 'rail' ? 'rail' : st.arch === 'scatter' ? 'scatter' : st.arch === 'repeater' ? 'repeater' : 'laser');
    }
    fireMissile() {
      if (this.ammo <= 0) {
        G.audio.play('back');
        return;
      }
      this.ammo--;
      this.altCD = 0.6;
      const pz = this.position + PLAYER_Z;
      const target = this.aimTarget(pz, 1.0) || null;
      this.bolts.push({ z: pz + SEG, x: this.playerX, target, dmg: this.st.secondary.dmg * this.dmgOut * 1.4, col: '#ffb347', life: 2.2, pierce: 0, spd: MAXS * 2.2, missile: true });
      G.audio.play('missile');
    }
    aimTarget(pz, tol = 0.32) {
      let best = null, bd = 1e9;
      for (const c of this.cars) {
        if (c.hp <= 0 || c.z < pz || c.z > pz + 70 * SEG) continue;
        const dx = Math.abs(c.offset - this.playerX);
        if (dx > tol) continue;
        const score = c.z - pz + dx * 30000;
        if (score < bd) {
          bd = score;
          best = c;
        }
      }
      return best;
    }

    updateCars(dt, pz) {
      for (const c of this.cars) {
        c.t += dt;
        c.flash = Math.max(0, c.flash - dt);
        if (c.hp <= 0) continue;
        const rel = c.z - pz;
        // Lane choice: wander, then block or ram the player when close.
        c.laneT -= dt;
        if (c.laneT <= 0) {
          c.laneT = U.rand(1.2, 2.6);
          if (c.kind === 'courier') c.target = U.pick([-0.6, 0, 0.6]);
          else if (rel < 12 * SEG && rel > -2 * SEG) c.target = U.clamp(this.playerX + U.rand(-0.1, 0.1), -0.8, 0.8);
          else c.target = U.pick([-0.6, 0, 0.6]);
        }
        c.offset = U.damp(c.offset, c.target, c.kind === 'courier' ? 1.6 : 2.2, dt);
        let spd = c.speed;
        if (c.kind === 'courier') {
          if (rel < 25 * SEG) spd = MAXS * 0.94;
          if (rel < 8 * SEG) spd = MAXS * 0.98;
        } else if (c.escort && c.escort.hp > 0) {
          spd = c.escort.speed;
        } else if (rel < -1 * SEG) spd = this.speed * 1.02 + 400; // fell behind: try to catch up alongside
        c.z += spd * dt;
        // Shooting back
        c.fireCD -= dt;
        if ((c.kind === 'gunner' || c.kind === 'courier') && rel > 4 * SEG && rel < 80 * SEG && c.fireCD <= 0 && this.phase === 'play') {
          c.fireCD = (c.kind === 'courier' ? U.rand(1.0, 1.8) : U.rand(1.8, 3)) / this.diffMul;
          if (c.kind === 'courier' && Math.random() < 0.5) {
            this.items.push({ kind: 'mine', z: c.z - SEG * 2, offset: c.offset, w: 0.12 });
          } else {
            this.eb.push({ z: c.z - SEG, x: c.offset, vx: (this.playerX - c.offset) * 0.25, spd: c.speed - MAXS * 0.55, life: 4, col: '#ff4d5e' });
            G.audio.play('enemyShot');
          }
        }
        // Collision with the player
        if (Math.abs(c.z - pz) < SEG * 0.9 && Math.abs(c.offset - this.playerX) < (c.w + BIKE_W) * 0.8 && this.phase === 'play' && !c.hitCD) {
          c.hitCD = 0.6;
          const side = c.offset > this.playerX ? 1 : -1;
          c.offset += side * 0.25;
          c.target = c.offset;
          this.playerX -= side * 0.12;
          this.speed *= 0.82;
          this.playerHit(c.kind === 'courier' ? 14 : 9);
          this.damageCar(c, 35 * this.dmgOut, true);
          G.audio.play('boom');
        }
        if (c.hitCD) c.hitCD = Math.max(0, c.hitCD - dt) || 0;
        if (c.kind === 'courier' && c.z >= this.finishZ && !this.courierGone && c.hp > 0) {
          this.courierGone = true;
          G.radio.say('juno', 'The courier made it through the gate. We lost it!', 3, true);
        }
      }
      this.cars = this.cars.filter((c) => (c.hp > 0 || c.deadT < 1) && (c.z > pz - 6 * SEG || c.kind === 'courier') && !(c.kind === 'courier' && c.z > this.finishZ + 10 * SEG));
      for (const c of this.cars) if (c.hp <= 0) c.deadT = (c.deadT || 0) + dt;
      // Enemy shots travel back toward the player
      for (const b of this.eb) {
        const oz = b.z;
        b.z += b.spd * dt;
        b.x += b.vx * dt;
        b.life -= dt;
        if (this.phase === 'play' && oz >= pz - SEG && b.z <= pz + SEG * 0.5 + this.speed * dt && Math.abs(b.x - this.playerX) < 0.1) {
          b.dead = true;
          this.playerHit(10);
        }
        if (b.z < pz - 3 * SEG) b.dead = true;
      }
      this.eb = this.eb.filter((b) => !b.dead && b.life > 0);
    }

    damageCar(c, dmg, ram) {
      if (c.hp <= 0) return;
      c.hp -= dmg;
      c.flash = 0.08;
      const s = this.screenOf(c.z, c.offset);
      if (s) G.popups.add(s.x, s.y - 30 * s.k / 900 - 10, String(Math.round(dmg)), ram ? '#ffb347' : '#ffffff', 13, 0.5);
      G.audio.play('hit');
      if (c.hp <= 0) {
        c.deadT = 0;
        if (s) this.fx.burst(s.x, s.y - 20, '#ff7a3d', 18, 260, 26);
        G.audio.play(c.kind === 'courier' ? 'bigboom' : 'boom');
        G.shake(c.kind === 'courier' ? 12 : 4);
        if (c.countKill) this.kills++;
        const mul = c.countKill ? this.combo.kill() : 1;
        this.combo.freeze(c.kind === 'courier' ? 0.2 : 0.04);
        if (this.st.perks.has('leech')) this.v.addShield(6);
        this.scrap += (c.kind === 'courier' ? 60 : c.kind === 'gunner' ? 10 : 7) * this.st.scrapMult * mul;
        if (Math.random() < (c.kind === 'courier' ? 1 : 0.05)) {
          this.caches++;
          G.audio.play('cache');
          G.popups.add(G.W / 2, G.H / 2 - 60, 'LOOT CACHE', '#c77dff', 18);
        }
        if (c.kind === 'courier') {
          this.bonusDone = true;
          G.radio.say('harrow', 'Courier wrecked! We have their codes. Bonus objective complete.', 3.4, true);
        }
      }
    }

    updateBolts(dt) {
      const pz = this.position + PLAYER_Z;
      for (const b of this.bolts) {
        const oz = b.z;
        b.z += b.spd * dt;
        b.life -= dt;
        if (b.target && b.target.hp > 0) b.x = U.damp(b.x, b.target.offset, b.missile ? 6 : 3.5, dt);
        if (b.z > pz + 90 * SEG) b.dead = true;
        for (const c of this.cars) {
          if (c.hp <= 0 || (b.hitSet && b.hitSet.has(c))) continue;
          if (c.z >= oz - SEG * 0.5 && c.z <= b.z + SEG * 0.5 && Math.abs(c.offset - b.x) < c.w * 0.9 + 0.03) {
            if (b.missile) {
              for (const o of this.cars) if (o.hp > 0 && Math.abs(o.z - c.z) < 6 * SEG && Math.abs(o.offset - c.offset) < 0.5 * this.st.secondary.radius) this.damageCar(o, b.dmg);
              const s = this.screenOf(c.z, c.offset);
              if (s) this.fx.burst(s.x, s.y - 20, '#ffb347', 20, 300, 30);
              G.audio.play('boom');
              b.dead = true;
              break;
            }
            this.damageCar(c, b.dmg);
            if (b.pierce > 0) {
              b.pierce--;
              (b.hitSet = b.hitSet || new Set()).add(c);
            } else {
              b.dead = true;
              break;
            }
          }
        }
      }
      this.bolts = this.bolts.filter((b) => !b.dead && b.life > 0);
    }

    updateItems(pz) {
      for (const it of this.items) {
        if (it.done) continue;
        if (Math.abs(it.z - pz) < SEG * 0.8 && Math.abs(it.offset - this.playerX) < it.w + BIKE_W * 0.6 && (this.phase === 'play' || this.phase === 'intro')) {
          it.done = true;
          if (it.kind === 'barricade' || it.kind === 'mine') {
            this.speed *= 0.45;
            this.playerHit(it.kind === 'mine' ? 16 : 20);
            this.fx.burst(G.W / 2, G.H - 70, '#ffb347', 14, 240, 22);
            G.audio.play('boom');
          } else if (it.kind === 'boost') {
            this.boostT = Math.max(this.boostT, 1.4);
            this.speed = Math.max(this.speed, MAXS * 1.1);
            G.audio.play('dash');
          } else if (it.kind === 'scrap') {
            this.scrap += 3 * this.st.scrapMult;
            G.audio.play('scrap');
          } else if (it.kind === 'repair') {
            this.v.heal(this.v.maxHull * 0.3);
            G.audio.play('pickup');
            G.popups.add(G.W / 2, G.H - 140, '+HULL', '#6fe39a', 16);
          } else if (it.kind === 'ammo') {
            this.ammo = Math.min(this.maxAmmo, this.ammo + 3);
            G.audio.play('pickup');
            G.popups.add(G.W / 2, G.H - 140, '+ORDNANCE', '#ffb347', 16);
          }
        }
      }
      if (this.items.length > 400) this.items = this.items.filter((i) => !i.done && i.z > pz - SEG * 5);
    }

    playerHit(dmg) {
      const hull = this.v.hull;
      const r = this.v.hit(dmg * (0.85 + this.m.stage * 0.06), 0.25);
      if (this.v.hull < hull) this.combo.freeze(0.05);
      if (r === 'dead' && this.phase !== 'dead') {
        this.phase = 'dead';
        this.phaseT = 0;
        this.fx.burst(G.W / 2, G.H - 70, '#ffb347', 40, 400, 40);
        G.audio.play('bigboom');
        G.shake(16);
        G.radio.say('harrow', 'Wingbreaker, you are down! Get out of there!', 3, true);
      }
    }

    finish(success) {
      if (this.result) return;
      this.result = G.makeResult({
        success, bonus: this.bonusDone, kills: this.kills, enemies: Math.max(1, this.enemies), damageTaken: this.v.damageTaken,
        maxHp: this.v.maxHull + this.v.maxShield, time: this.t, bestChain: this.combo.best, scrap: Math.round(this.scrap), caches: this.caches,
      });
    }

    // ---------- Rendering ----------
    project(p, camX, camY, camZ) {
      p.camera.x = (p.world.x || 0) - camX;
      p.camera.y = (p.world.y || 0) - camY;
      p.camera.z = (p.world.z || 0) - camZ;
      p.screen.scale = DEPTH / p.camera.z;
      p.screen.x = G.W / 2 + p.screen.scale * p.camera.x * G.W / 2;
      p.screen.y = G.H / 2 - p.screen.scale * p.camera.y * G.H / 2;
      p.screen.w = p.screen.scale * ROADW * G.W / 2;
    }

    screenOf(z, offset) {
      const seg = this.segments[Math.floor(z / SEG)];
      if (!seg || !seg.p1.screen.scale || seg.drawnAt !== this.frame) return null;
      const t = (z % SEG) / SEG;
      const sc = U.lerp(seg.p1.screen.scale, seg.p2.screen.scale, t);
      const x = U.lerp(seg.p1.screen.x, seg.p2.screen.x, t) + sc * offset * ROADW * G.W / 2;
      const y = U.lerp(seg.p1.screen.y, seg.p2.screen.y, t);
      return { x, y, k: sc * ROADW * G.W / 2, clip: seg.clip };
    }

    draw(ctx) {
      this.frame = (this.frame || 0) + 1;
      const th = this.th;
      const W = G.W, H = G.H;
      // Sky
      const g = ctx.createLinearGradient(0, 0, 0, H / 2);
      g.addColorStop(0, th.sky[0]);
      g.addColorStop(0.6, th.sky[1]);
      g.addColorStop(1, th.sky[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      this.drawBackdrop(ctx);

      const base = this.findSeg(this.position);
      const basePct = (this.position % SEG) / SEG;
      const pz = this.position + PLAYER_Z;
      const pseg = this.findSeg(pz);
      const pPct = (pz % SEG) / SEG;
      const playerY = U.lerp(pseg.p1.world.y, pseg.p2.world.y, pPct);
      let maxy = H;
      let x = 0;
      let dx = -(base.curve * basePct);
      const drawn = [];
      for (let n = 0; n < DRAW; n++) {
        const seg = this.segments[base.index + n];
        if (!seg) break;
        seg.dyn.length = 0;
        seg.fog = Math.pow(n / DRAW, 1.6);
        this.project(seg.p1, this.playerX * ROADW - x, playerY + CAMH, this.position);
        this.project(seg.p2, this.playerX * ROADW - x - dx, playerY + CAMH, this.position);
        x += dx;
        dx += seg.curve;
        seg.clip = maxy;
        seg.drawnAt = this.frame;
        drawn.push(seg);
        if (seg.p1.camera.z <= DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
        this.drawSegment(ctx, seg);
        maxy = seg.p1.screen.y;
      }
      // Bucket dynamic objects by segment for back-to-front drawing.
      const bucket = (z, o) => {
        const seg = this.segments[Math.floor(z / SEG)];
        if (seg && seg.drawnAt === this.frame && z > this.position + SEG) seg.dyn.push(o);
      };
      for (const c of this.cars) bucket(c.z, { t: 'car', o: c, z: c.z });
      for (const b of this.bolts) bucket(b.z, { t: 'bolt', o: b, z: b.z });
      for (const b of this.eb) bucket(b.z, { t: 'eb', o: b, z: b.z });
      for (const it of this.items) if (!it.done) bucket(it.z, { t: 'item', o: it, z: it.z });
      for (let i = drawn.length - 1; i >= 0; i--) {
        const seg = drawn[i];
        if (seg.p1.camera.z <= DEPTH) continue;
        for (const s of seg.sprites) this.drawDecor(ctx, seg, s);
        seg.dyn.sort((a, b) => b.z - a.z);
        for (const d of seg.dyn) this.drawDyn(ctx, d);
      }
      this.drawPlayer(ctx);
      this.fx.draw(ctx);
      if (this.boostT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const r0 = 200 + Math.random() * 100;
          ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0 * 0.6);
          ctx.lineTo(W / 2 + Math.cos(a) * (r0 + 120), H / 2 + Math.sin(a) * (r0 + 120) * 0.6);
        }
        ctx.stroke();
      }
      this.drawHUD(ctx);
    }

    drawBackdrop(ctx) {
      const th = this.th;
      const W = G.W, H = G.H;
      const hor = H / 2;
      if (th.night) {
        // Moon and two skyline layers.
        G.drawGlow(ctx, '#ff8fe0', W * 0.75 - this.skyOff * 200, hor - 150, 120, 0.4);
        ctx.fillStyle = '#ffe6f6';
        ctx.beginPath();
        ctx.arc(W * 0.75 - ((this.skyOff * 200) % (W * 1.5)), hor - 150, 28, 0, Math.PI * 2);
        ctx.fill();
        this.skyline(ctx, th.far, this.skyOff * 400, 0.55, 1);
        this.skyline(ctx, th.near, this.hillOff * 700, 0.9, 2);
      } else {
        G.drawGlow(ctx, '#fff6d0', W * 0.3, hor - 120, 140, 0.7);
        this.mountains(ctx, th.far, this.skyOff * 400, 70, 1);
        this.mountains(ctx, th.near, this.hillOff * 700, 40, 2);
      }
    }
    mountains(ctx, col, off, hgt, seed) {
      const W = G.W, H = G.H;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, H / 2 + 2);
      for (let x = 0; x <= W; x += 16) {
        const wx = x + off;
        const y = H / 2 - hgt * (0.5 + 0.3 * Math.sin(wx * 0.01 * seed + seed) + 0.2 * Math.sin(wx * 0.037 + seed * 3)) * (Math.abs(Math.sin(wx * 0.004 + seed)) + 0.2);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H / 2 + 2);
      ctx.fill();
    }
    skyline(ctx, col, off, hscale, seed) {
      const W = G.W, H = G.H;
      ctx.fillStyle = col;
      const bw = 34 * seed;
      const start = -((off % bw) + bw) % bw - bw;
      for (let x = start; x < W + bw; x += bw) {
        const i = Math.floor((x + off) / bw);
        const h = (40 + ((Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1 * 120) * hscale;
        ctx.fillRect(x, H / 2 - h, bw - 3, h + 2);
        if (seed === 2) {
          ctx.fillStyle = 'rgba(255,211,122,0.55)';
          for (let wy = H / 2 - h + 6; wy < H / 2 - 4; wy += 9) for (let wx = x + 4; wx < x + bw - 8; wx += 8) if (((i * 7 + wy * 3 + wx) | 0) % 5 === 0) ctx.fillRect(wx, wy, 3, 4);
          ctx.fillStyle = col;
        }
      }
    }

    drawSegment(ctx, seg) {
      const th = this.th;
      const p1 = seg.p1.screen, p2 = seg.p2.screen;
      const W = G.W;
      const fogc = U.hex(th.fog);
      const fog = (c) => U.rgb(U.mix(U.hex(c), fogc, seg.fog));
      const c = seg.color;
      ctx.fillStyle = fog(th.grass[c]);
      ctx.fillRect(0, p2.y, W, p1.y - p2.y + 1);
      const poly = (x1, y1, x2, y2, x3, y3, x4, y4, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
      };
      const r1 = p1.w / 7, r2 = p2.w / 7;
      poly(p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, fog(th.rumble[c]));
      poly(p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, fog(th.rumble[c]));
      poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, fog(th.road[c]));
      if (c === 0) {
        const lw1 = p1.w / 40, lw2 = p2.w / 40;
        for (const k of [-1 / 3, 1 / 3]) {
          const x1 = p1.x + p1.w * k, x2 = p2.x + p2.w * k;
          poly(x1 - lw1, p1.y, x1 + lw1, p1.y, x2 + lw2, p2.y, x2 - lw2, p2.y, fog(th.lane));
        }
      }
      if (seg.index === this.finishIndex || seg.index === this.finishIndex + 1) {
        const n = 10;
        for (let i = 0; i < n; i++) {
          const xa = U.lerp(p1.x - p1.w, p1.x + p1.w, i / n), xb = U.lerp(p1.x - p1.w, p1.x + p1.w, (i + 1) / n);
          const xc = U.lerp(p2.x - p2.w, p2.x + p2.w, (i + 1) / n), xd = U.lerp(p2.x - p2.w, p2.x + p2.w, i / n);
          poly(xa, p1.y, xb, p1.y, xc, p2.y, xd, p2.y, (i + seg.index) % 2 ? '#111' : '#fff');
        }
      }
    }

    spriteAt(seg, offset, t = 0.5) {
      const sc = U.lerp(seg.p1.screen.scale, seg.p2.screen.scale, t);
      return {
        x: U.lerp(seg.p1.screen.x, seg.p2.screen.x, t) + sc * offset * ROADW * G.W / 2,
        y: U.lerp(seg.p1.screen.y, seg.p2.screen.y, t),
        k: sc * ROADW * G.W / 2,
      };
    }

    clipTo(ctx, y) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-50, -50, G.W + 100, y + 50);
      ctx.clip();
    }

    drawDecor(ctx, seg, s) {
      const p = this.spriteAt(seg, s.offset, 0);
      const k = p.k;
      if (k < 2) return;
      const night = this.th.night;
      this.clipTo(ctx, seg.clip);
      ctx.globalAlpha = 1 - seg.fog * 0.7;
      const x = p.x, y = p.y;
      switch (s.kind) {
        case 'pillar': {
          const w = 0.12 * k, h = (0.5 + s.seed * 0.5) * k;
          ctx.fillStyle = '#f6f3ea';
          ctx.beginPath();
          ctx.moveTo(x - w, y);
          ctx.lineTo(x - w * 0.6, y - h);
          ctx.lineTo(x + w * 0.6, y - h);
          ctx.lineTo(x + w, y);
          ctx.fill();
          ctx.fillStyle = '#d9d2c2';
          ctx.fillRect(x, y - h, w * 0.6, h);
          break;
        }
        case 'mesa': {
          const w = (0.6 + s.seed * 0.5) * k, h = (0.4 + s.seed * 0.3) * k;
          ctx.fillStyle = '#b07a52';
          ctx.beginPath();
          ctx.moveTo(x - w, y);
          ctx.lineTo(x - w * 0.75, y - h);
          ctx.lineTo(x + w * 0.7, y - h);
          ctx.lineTo(x + w, y);
          ctx.fill();
          ctx.fillStyle = '#c98f63';
          ctx.fillRect(x - w * 0.75, y - h, w * 1.45, h * 0.15);
          break;
        }
        case 'sign': {
          ctx.fillStyle = '#4a4a4a';
          ctx.fillRect(x - 0.01 * k, y - 0.25 * k, 0.02 * k, 0.25 * k);
          ctx.fillStyle = '#ffb347';
          ctx.beginPath();
          ctx.moveTo(x, y - 0.38 * k);
          ctx.lineTo(x + 0.08 * k, y - 0.25 * k);
          ctx.lineTo(x - 0.08 * k, y - 0.25 * k);
          ctx.fill();
          break;
        }
        case 'wreck': {
          ctx.fillStyle = '#5a5550';
          ctx.beginPath();
          ctx.moveTo(x - 0.25 * k, y);
          ctx.lineTo(x - 0.1 * k, y - 0.14 * k);
          ctx.lineTo(x + 0.2 * k, y - 0.08 * k);
          ctx.lineTo(x + 0.28 * k, y);
          ctx.fill();
          ctx.fillStyle = '#3c3936';
          ctx.fillRect(x - 0.05 * k, y - 0.22 * k, 0.03 * k, 0.12 * k);
          break;
        }
        case 'tower': {
          const w = (0.3 + s.seed * 0.3) * k, h = (0.9 + s.seed * 1.3) * k;
          ctx.fillStyle = '#1b1230';
          ctx.fillRect(x - w, y - h, w * 2, h);
          ctx.fillStyle = s.seed > 0.5 ? 'rgba(42,216,255,0.6)' : 'rgba(255,211,122,0.55)';
          const step = Math.max(3, 0.06 * k);
          for (let wy = y - h + step; wy < y - step; wy += step * 1.6) for (let wx = x - w + step * 0.6; wx < x + w - step; wx += step * 1.4) if (((wx * 13 + wy * 7 + s.seed * 99) | 0) % 3 === 0) ctx.fillRect(wx, wy, step * 0.6, step * 0.7);
          break;
        }
        case 'neon': {
          ctx.fillStyle = '#2a2240';
          ctx.fillRect(x - 0.012 * k, y - 0.6 * k, 0.024 * k, 0.6 * k);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, s.seed > 0.5 ? '#ff3df2' : '#2ad8ff', x, y - 0.6 * k, 0.12 * k, 0.9);
          ctx.restore();
          break;
        }
        case 'lamp': {
          ctx.fillStyle = '#2a2240';
          ctx.fillRect(x - 0.01 * k, y - 0.45 * k, 0.02 * k, 0.45 * k);
          ctx.fillRect(x - (s.offset > 0 ? 0.12 : 0) * k, y - 0.45 * k, 0.12 * k, 0.02 * k);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, '#ffd37a', x + (s.offset > 0 ? -0.1 : 0.1) * k, y - 0.43 * k, 0.08 * k, 0.8);
          ctx.restore();
          break;
        }
        case 'billboard': {
          const w = 0.5 * k, h = 0.25 * k;
          ctx.fillStyle = '#2a2240';
          ctx.fillRect(x - 0.02 * k, y - 0.5 * k, 0.04 * k, 0.5 * k);
          ctx.fillStyle = '#120a22';
          ctx.fillRect(x - w / 2, y - 0.5 * k - h, w, h);
          ctx.strokeStyle = '#ff3df2';
          ctx.lineWidth = Math.max(1, 0.01 * k);
          ctx.strokeRect(x - w / 2, y - 0.5 * k - h, w, h);
          if (k > 60) G.text(ctx, 'KNEEL', x, y - 0.5 * k - h * 0.32, { size: Math.min(60, h * 0.45), align: 'center', color: '#ffd37a', outline: false });
          break;
        }
        case 'finish': {
          const w = 1.25 * k, h = 0.7 * k;
          ctx.fillStyle = night ? '#2a2240' : '#5a5550';
          ctx.fillRect(x - w - 0.05 * k, y - h, 0.06 * k, h);
          ctx.fillRect(x + w, y - h, 0.06 * k, h);
          ctx.fillRect(x - w - 0.05 * k, y - h - 0.12 * k, w * 2 + 0.1 * k, 0.12 * k);
          if (k > 30) G.text(ctx, 'GATE', x, y - h - 0.03 * k, { size: Math.min(80, 0.09 * k), align: 'center', color: '#ffd37a', outline: false });
          break;
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawDyn(ctx, d) {
      const seg = this.segments[Math.floor(d.z / SEG)];
      const t = (d.z % SEG) / SEG;
      const o = d.o;
      const p = this.spriteAt(seg, d.t === 'car' ? o.offset : o.x !== undefined ? o.x : o.offset, t);
      const k = p.k;
      if (k < 1.5) return;
      this.clipTo(ctx, seg.clip);
      if (d.t === 'car') {
        if (o.hp <= 0) {
          ctx.globalAlpha = Math.max(0, 1 - (o.deadT || 0));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, '#ff7a3d', p.x, p.y - 0.08 * k, 0.2 * k * (1 + o.deadT), 1);
          ctx.restore();
          ctx.globalAlpha = 1;
        } else {
          drawBike(ctx, p.x, p.y, k * (o.kind === 'courier' ? 1.5 : 1), o.kind, (o.target - o.offset) * 2, o.flash > 0, this.t + o.t);
          if (o.kind === 'courier' && k > 8) {
            const bw = 0.3 * k;
            G.hud.bar(ctx, p.x - bw / 2, p.y - 0.36 * k, bw, Math.max(3, 0.02 * k), o.hp / o.maxHp, '#c77dff', 'rgba(0,0,0,0.4)');
          }
        }
      } else if (d.t === 'bolt') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.drawGlow(ctx, o.col, p.x, p.y - 0.06 * k, Math.max(4, (o.missile ? 0.08 : 0.045) * k), 1);
        ctx.restore();
      } else if (d.t === 'eb') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.drawGlow(ctx, o.col, p.x, p.y - 0.06 * k, Math.max(4, 0.06 * k), 1);
        ctx.restore();
      } else if (d.t === 'item') {
        const x = p.x, y = p.y;
        if (o.kind === 'barricade') {
          const w = 0.2 * k, h = 0.1 * k;
          ctx.fillStyle = '#2b2b30';
          ctx.fillRect(x - w, y - h, w * 2, h);
          ctx.fillStyle = '#ffb347';
          for (let i = 0; i < 4; i++) ctx.fillRect(x - w + i * w * 0.5, y - h, w * 0.25, h * 0.5);
        } else if (o.kind === 'mine') {
          ctx.fillStyle = '#3b1820';
          ctx.beginPath();
          ctx.ellipse(x, y - 0.02 * k, 0.06 * k, 0.025 * k, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, '#ff3344', x, y - 0.04 * k, 0.05 * k * (1 + Math.sin(this.t * 12) * 0.3), 1);
          ctx.restore();
        } else if (o.kind === 'boost') {
          ctx.fillStyle = 'rgba(95,212,255,0.7)';
          const w = 0.16 * k;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(x - w, y - i * 0.012 * k);
            ctx.lineTo(x, y - 0.03 * k - i * 0.012 * k);
            ctx.lineTo(x + w, y - i * 0.012 * k);
            ctx.lineTo(x, y - 0.015 * k - i * 0.012 * k);
            ctx.fill();
          }
        } else {
          const col = { scrap: '#ffd37a', repair: '#6fe39a', ammo: '#ffb347' }[o.kind];
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, col, x, y - 0.08 * k, (o.kind === 'scrap' ? 0.05 : 0.09) * k, 1);
          ctx.restore();
          if (o.kind === 'repair') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x - 0.01 * k, y - 0.11 * k, 0.02 * k, 0.06 * k);
            ctx.fillRect(x - 0.03 * k, y - 0.09 * k, 0.06 * k, 0.02 * k);
          }
        }
      }
      ctx.restore();
    }

    drawPlayer(ctx) {
      if (this.phase === 'dead') return;
      const blink = this.v.invuln > 0 && Math.floor(this.t * 20) % 2 === 0;
      if (blink) return;
      const k = (DEPTH / PLAYER_Z) * ROADW * G.W / 2;
      const bounce = Math.sin(this.t * 30) * (this.speed / MAXS) * 1.5;
      ctx.save();
      drawBike(ctx, G.W / 2, G.H - 18 + bounce, k, 'player', this.lean, this.v.flash > 0.2, this.t, this.boostT > 0);
      ctx.restore();
    }

    drawHUD(ctx) {
      G.hud.vitals(ctx, this.v);
      this.combo.draw(ctx);
      G.hud.scoreBox(ctx, this.scrap, `KILLS ${this.kills}` + (this.caches ? `  ·  CACHES ${this.caches}` : ''));
      G.hud.objective(ctx, this.m.bonus.text, this.bonusDone ? 1 : 0, 1, this.bonusDone);
      // Track progress strip with player and courier markers.
      const x = G.W / 2 - 200, y = 58, w = 400;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y, w, 4);
      const pz = this.position + PLAYER_Z;
      ctx.fillStyle = '#ffd37a';
      ctx.fillRect(x + w - 2, y - 5, 4, 14);
      if (this.courier && this.courier.hp > 0 && !this.courierGone) {
        const cx = x + w * U.clamp(this.courier.z / this.finishZ, 0, 1);
        ctx.fillStyle = '#c77dff';
        ctx.beginPath();
        ctx.arc(cx, y + 2, 6, 0, Math.PI * 2);
        ctx.fill();
        const gap = Math.max(0, (this.courier.z - pz) / SEG);
        G.text(ctx, gap < 1 ? 'COURIER ALONGSIDE' : `COURIER ${Math.round(gap * 2)}m`, G.W / 2, y + 24, { size: 12, align: 'center', color: '#c77dff' });
      }
      const px = x + w * U.clamp(pz / this.finishZ, 0, 1);
      ctx.fillStyle = '#5fd4ff';
      ctx.beginPath();
      ctx.moveTo(px, y - 4);
      ctx.lineTo(px - 6, y - 12);
      ctx.lineTo(px + 6, y - 12);
      ctx.fill();
      // Speed
      const kmh = Math.round(this.speed / 40);
      G.text(ctx, String(kmh), 24, G.H - 108, { size: 34, weight: 800, color: this.boostT > 0 ? '#5fd4ff' : '#ffffff' });
      G.text(ctx, 'KM/H', 24 + ctx.measureText(String(kmh)).width + 8, G.H - 108, { size: 12, color: '#aab6d6' });
      G.hud.ammo(ctx, 'MISSILES', this.ammo, this.maxAmmo, U.clamp(1 - this.boostCD / (this.st.dodgeCD * 3.5), 0, 1));
      G.text(ctx, 'BOOST', G.W - 48, G.H - 66, { size: 10, align: 'right', color: '#5a6b8c', outline: false });
      G.popups.draw(ctx);
      G.radio.draw(ctx);
      G.hud.titleCard(ctx, this.m, this.t);
      if (this.phase === 'outro') G.hud.banner(ctx, 'MISSION COMPLETE', '#ffd37a');
      if (this.phase === 'dead') G.hud.banner(ctx, 'BIKE WRECKED', '#ff6b5e');
      G.input.drawTouch(ctx);
    }
  }

  // Hoverbike seen from behind. k = pixels per road half-width unit.
  function drawBike(ctx, x, y, k, kind, lean, flash, t, boosting) {
    const s = k * BIKE_W * 0.62;
    const pal = kind === 'player' ? G.paints.find((p) => p.id === G.save.data.paint) || G.paints[0] : null;
    const cols = pal ? [pal.hull, pal.accent, pal.fin] : {
      raider: ['#3d2d44', '#d23a48', '#ff4d5e'],
      gunner: ['#454a3a', '#c9a227', '#ff4d5e'],
      courier: ['#2c2440', '#c77dff', '#ffd37a'],
    }[kind];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(U.clamp(lean, -1, 1) * 0.22);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    const hy = -s * 0.45 + Math.sin(t * 7) * s * 0.03;
    // hover glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    G.drawGlow(ctx, pal ? pal.glass[0] : cols[2], 0, hy + s * 0.32, s * 0.7, 0.5);
    ctx.restore();
    // side pods
    ctx.fillStyle = flash ? '#fff' : cols[1];
    ctx.beginPath();
    ctx.moveTo(-s, hy + s * 0.1);
    ctx.lineTo(-s * 0.5, hy - s * 0.18);
    ctx.lineTo(-s * 0.35, hy + s * 0.25);
    ctx.lineTo(-s * 0.9, hy + s * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s, hy + s * 0.1);
    ctx.lineTo(s * 0.5, hy - s * 0.18);
    ctx.lineTo(s * 0.35, hy + s * 0.25);
    ctx.lineTo(s * 0.9, hy + s * 0.32);
    ctx.closePath();
    ctx.fill();
    // body
    ctx.fillStyle = flash ? '#fff' : cols[0];
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, hy + s * 0.3);
    ctx.lineTo(-s * 0.32, hy - s * 0.25);
    ctx.lineTo(s * 0.32, hy - s * 0.25);
    ctx.lineTo(s * 0.45, hy + s * 0.3);
    ctx.closePath();
    ctx.fill();
    // engine
    ctx.fillStyle = '#1d2129';
    ctx.fillRect(-s * 0.25, hy + s * 0.05, s * 0.5, s * 0.22);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    G.drawGlow(ctx, boosting ? '#5fd4ff' : cols[2], 0, hy + s * 0.16, s * (boosting ? 0.6 : 0.32) * (0.9 + Math.random() * 0.2), 1);
    ctx.restore();
    // rider
    ctx.fillStyle = pal ? pal.gun : '#221b28';
    ctx.beginPath();
    ctx.ellipse(0, hy - s * 0.42, s * 0.24, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal ? pal.hull : cols[1];
    ctx.beginPath();
    ctx.arc(0, hy - s * 0.72, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kind === 'player' ? '#ffb347' : '#ff4d5e';
    ctx.fillRect(-s * 0.1, hy - s * 0.76, s * 0.2, s * 0.05);
    if (kind === 'courier') {
      ctx.fillStyle = '#ffd37a';
      ctx.fillRect(-s * 0.55, hy - s * 0.32, s * 1.1, s * 0.06);
    }
    ctx.restore();
  }

  G.modes = G.modes || {};
  G.modes.bike = (mission, stats) => new Bike(mission, stats);
})();
