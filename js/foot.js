// On foot: a top-down 2.5D boarding action. Destroy the reactor cores, then reach the extraction pad.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const I = G.input;

  const T = 48; // tile size
  const WH = 26; // wall height in pixels
  // Legend: # wall, . floor, P start, g grunt, r rusher, h heavy, t turret, C reactor core,
  // X extraction, i intel drive, + repair, a grenades, c crate, L blast door (opens when cores are down)
  const MAP = [
    "########################################",
    "#......#.................#.............#",
    "#..P...#....g.......g....#....i....h...#",
    "#......#.................#.............#",
    "#......#.....cc....C.....#.....c.c.....#",
    "#...+.......................g..........#",
    "#......#.....cc..........#.....c.c.....#",
    "#......#.................#.............#",
    "####.###.......g.....r...#######.#######",
    "#......#########.#########.....#.#.....#",
    "#.i....#.......#.#.......#.....#.#..a..#",
    "#......#..t....#.#....r..#..g..#.#.....#",
    "#......#.......#.........#.....#.......#",
    "#......#...........g.....#.....#.#.....#",
    "#..g...#.......#.#.......####.##.#..+..#",
    "#......####.####.####.####.......#######",
    "#......#.....................r.........#",
    "#...............cc.........cc..........#",
    "#......#....g..........C.........h.....#",
    "#......#.......cc.........cc.......g...#",
    "###.####...........r...................#",
    "#......#####.##########.###########L####",
    "#...a..#.........#......#......#.......#",
    "#......#...h.....#..i...#..t...#...X...#",
    "#...g..#.........#......#......L.......#",
    "#................#......#......#.......#",
    "#......#..C..................r.#.......#",
    "########################################"
  ];

  const EDEF = {
    grunt: { hp: 45, speed: 105, r: 14, col: '#c23a48', scrap: 6 },
    rusher: { hp: 34, speed: 235, r: 12, col: '#8b5cf6', scrap: 5 },
    heavy: { hp: 170, speed: 66, r: 19, col: '#7a5a3a', scrap: 14 },
    turret: { hp: 85, speed: 0, r: 16, col: '#5a606e', scrap: 8 },
  };

  class Foot {
    constructor(mission, stats) {
      this.combo = new G.Combo();
      this.m = mission;
      this.st = stats;
      this.v = new G.Vitals(stats, mission);
      this.dmgOut = U.clamp(1 + (stats.power - mission.power) * 0.025, 0.55, 1.45);
      this.diffMul = U.clamp(1 + (mission.stage - 1) * 0.1, 1, 1.5);
      this.fx = new G.Particles2D();
      this.grid = MAP.map((r) => r.split(''));
      this.H = this.grid.length;
      this.W = this.grid[0].length;
      this.crateHp = {};
      this.ents = [];
      this.bullets = [];
      this.grenades = [];
      this.pickups = [];
      this.cores = [];
      this.t = 0;
      this.phase = 'intro';
      this.phaseT = 0;
      this.kills = 0;
      this.enemies = 0;
      this.scrap = 0;
      this.caches = 0;
      this.intel = 0;
      this.bonusDone = false;
      this.doorsOpen = false;
      this.result = null;
      this.aim = 0;
      this.fireCD = 0;
      this.nades = 3 + Math.round(stats.secondary.ammo / 6);
      this.maxNades = this.nades + 2;
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const c = this.grid[y][x];
          const cx = x * T + T / 2, cy = y * T + T / 2;
          if (c === 'P') this.p = { x: cx, y: cy, vx: 0, vy: 0, r: 13, dashT: 0, dashCD: 0, dashA: 0, face: 0 };
          else if (c === 'g') this.spawn('grunt', cx, cy);
          else if (c === 'r') this.spawn('rusher', cx, cy);
          else if (c === 'h') this.spawn('heavy', cx, cy);
          else if (c === 't') this.spawn('turret', cx, cy);
          else if (c === 'C') this.cores.push({ x: cx, y: cy, hp: 260 * this.diffMul, max: 260 * this.diffMul, r: 26, flash: 0 });
          else if (c === 'X') this.exit = { x: cx, y: cy };
          else if (c === 'i') this.pickups.push({ kind: 'intel', x: cx, y: cy });
          else if (c === '+') this.pickups.push({ kind: 'repair', x: cx, y: cy });
          else if (c === 'a') this.pickups.push({ kind: 'nades', x: cx, y: cy });
          else if (c === 'c') this.crateHp[x + ',' + y] = 40;
          if ('PghrtCXi+a'.includes(c)) this.grid[y][x] = '.';
        }
      }
      this.cam = { x: this.p.x, y: this.p.y };
      this.prerender();
      G.radio.clear();
      G.popups.clear();
      G.radio.say('harrow', 'Boots on the deck, Wingbreaker. Three reactor cores. Destroy them all and the blast doors to extraction open.', 4.4);
      G.radio.say('juno', 'Their intel drives glow green. Grab three if you can find them!', 3.2);
      G.audio.music('foot');
    }

    spawn(kind, x, y, alert = false) {
      const d = EDEF[kind];
      const hp = d.hp * this.diffMul;
      this.ents.push({ kind, x, y, vx: 0, vy: 0, r: d.r, hp, max: hp, speed: d.speed, col: d.col, scrap: d.scrap, alert, fireCD: U.rand(0.5, 1.5), strafe: U.chance(0.5) ? 1 : -1, strafeT: 0, flash: 0, ang: 0, meleeCD: 0, burst: 0 });
      this.enemies++;
    }

    // ---------- Map helpers ----------
    tile(tx, ty) {
      if (ty < 0 || ty >= this.H || tx < 0 || tx >= this.W) return '#';
      return this.grid[ty][tx];
    }
    solidTile(tx, ty) {
      const c = this.tile(tx, ty);
      return c === '#' || c === 'c' || (c === 'L' && !this.doorsOpen);
    }
    solidAt(x, y) {
      return this.solidTile(Math.floor(x / T), Math.floor(y / T));
    }
    moveCircle(o, dx, dy) {
      o.x += dx;
      this.resolve(o, dx, 0);
      o.y += dy;
      this.resolve(o, 0, dy);
      for (const c of this.cores) {
        if (c.hp <= 0) continue;
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < c.r + o.r && d > 0) {
          o.x = c.x + ((o.x - c.x) / d) * (c.r + o.r);
          o.y = c.y + ((o.y - c.y) / d) * (c.r + o.r);
        }
      }
    }
    resolve(o, dx, dy) {
      const r = o.r;
      const x0 = Math.floor((o.x - r) / T), x1 = Math.floor((o.x + r) / T);
      const y0 = Math.floor((o.y - r) / T), y1 = Math.floor((o.y + r) / T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (!this.solidTile(tx, ty)) continue;
          if (dx > 0) o.x = tx * T - r - 0.01;
          else if (dx < 0) o.x = (tx + 1) * T + r + 0.01;
          if (dy > 0) o.y = ty * T - r - 0.01;
          else if (dy < 0) o.y = (ty + 1) * T + r + 0.01;
        }
      }
    }
    los(ax, ay, bx, by) {
      const d = Math.hypot(bx - ax, by - ay);
      const n = Math.ceil(d / 14);
      for (let i = 1; i < n; i++) {
        const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
        if (this.solidAt(x, y)) return false;
      }
      return true;
    }

    prerender() {
      const c = document.createElement('canvas');
      c.width = this.W * T;
      c.height = this.H * T;
      const g = c.getContext('2d');
      g.fillStyle = '#07080d';
      g.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const ch = this.grid[y][x];
          if (ch === '#') continue;
          const px = x * T, py = y * T;
          g.fillStyle = (x + y) % 2 ? '#262b36' : '#232833';
          g.fillRect(px, py, T, T);
          g.strokeStyle = 'rgba(0,0,0,0.35)';
          g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
          g.fillStyle = 'rgba(255,255,255,0.035)';
          g.fillRect(px + 4, py + 4, T - 8, 2);
          if ((x * 7 + y * 13) % 11 === 0) {
            g.fillStyle = 'rgba(255,179,71,0.18)';
            g.fillRect(px + T / 2 - 8, py + T / 2 - 1, 16, 2);
          }
          if ((x * 5 + y * 3) % 17 === 0) {
            g.strokeStyle = 'rgba(0,0,0,0.4)';
            g.beginPath();
            for (let k = 8; k < T; k += 8) {
              g.moveTo(px + k, py + 8);
              g.lineTo(px + k, py + T - 8);
            }
            g.stroke();
          }
        }
      }
      if (this.exit) {
        const { x, y } = this.exit;
        g.strokeStyle = 'rgba(111,227,154,0.6)';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y, 52, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 1;
      }
      this.floor = c;
      // Minimap
      const mm = document.createElement('canvas');
      mm.width = this.W * 3;
      mm.height = this.H * 3;
      const m = mm.getContext('2d');
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        const ch = this.grid[y][x];
        m.fillStyle = ch === '#' ? 'rgba(120,135,170,0.55)' : ch === 'L' ? '#ff4d5e' : 'rgba(20,26,40,0.6)';
        m.fillRect(x * 3, y * 3, 3, 3);
      }
      this.mini = mm;
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
      const p = this.p;
      if (this.phase === 'intro' && this.phaseT > 1) {
        this.phase = 'play';
        this.phaseT = 0;
      }
      const alive = this.phase === 'play' || this.phase === 'intro';
      if (alive) this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateBullets(dt);
      this.updateGrenades(dt);
      for (const c of this.cores) c.flash = Math.max(0, c.flash - dt);
      // Pickups
      for (const k of this.pickups) {
        if (k.done || !alive) continue;
        if (Math.hypot(k.x - p.x, k.y - p.y) < 28) {
          k.done = true;
          if (k.kind === 'intel') {
            this.intel++;
            G.audio.play('cache');
            G.popups.add(G.W / 2, G.H / 2 - 60, `INTEL DRIVE ${this.intel}/3`, '#6fe39a', 18);
            if (this.intel >= this.m.bonus.count && !this.bonusDone) {
              this.bonusDone = true;
              G.radio.say('juno', 'That is all three drives. Bonus objective complete!', 3, true);
            }
          } else if (k.kind === 'repair') {
            this.v.heal(this.v.maxHull * 0.35);
            G.audio.play('pickup');
            G.popups.add(G.W / 2, G.H / 2 - 60, '+HULL', '#6fe39a', 16);
          } else if (k.kind === 'nades') {
            this.nades = Math.min(this.maxNades + 2, this.nades + 2);
            G.audio.play('pickup');
            G.popups.add(G.W / 2, G.H / 2 - 60, '+2 GRENADES', '#ffb347', 16);
          } else if (k.kind === 'scrap') {
            this.scrap += k.value;
            G.audio.play('scrap');
          } else if (k.kind === 'cache') {
            this.caches++;
            G.audio.play('cache');
            G.popups.add(G.W / 2, G.H / 2 - 60, 'LOOT CACHE', '#c77dff', 18);
          }
        }
      }
      // Scrap is pulled toward the player.
      for (const k of this.pickups) {
        if (k.done || (k.kind !== 'scrap' && k.kind !== 'cache')) continue;
        const d = Math.hypot(p.x - k.x, p.y - k.y);
        if (d < 140 * this.st.magnet) {
          k.x += ((p.x - k.x) / d) * 340 * dt;
          k.y += ((p.y - k.y) / d) * 340 * dt;
        }
      }
      this.pickups = this.pickups.filter((k) => !k.done);
      if (this.doorsOpen && alive && this.exit && Math.hypot(p.x - this.exit.x, p.y - this.exit.y) < 46) {
        this.phase = 'outro';
        this.phaseT = 0;
        G.audio.music('victory');
        G.radio.say('harrow', 'We have you. Dropship is pulling out. Good work in there.', 3, true);
      }
      if (this.phase === 'outro' && this.phaseT > 2.6) this.finish(true);
      if (this.phase === 'dead' && this.phaseT > 2.4) this.finish(false);
      // Camera leads slightly toward the aim.
      const lead = 70;
      this.cam.x = U.damp(this.cam.x, p.x + Math.cos(this.aim) * lead, 6, dt);
      this.cam.y = U.damp(this.cam.y, p.y + Math.sin(this.aim) * lead, 6, dt);
    }

    updatePlayer(dt) {
      const p = this.p;
      const st = this.st;
      p.dashT -= dt;
      p.dashCD -= dt;
      const spd = 210 * st.speed * (p.dashT > 0 ? 2.8 : 1);
      let mx = I.ax, my = I.ay;
      if (p.dashT > 0) {
        mx = Math.cos(p.dashA);
        my = Math.sin(p.dashA);
      }
      p.vx = U.damp(p.vx, mx * spd, 14, dt);
      p.vy = U.damp(p.vy, my * spd, 14, dt);
      this.moveCircle(p, p.vx * dt, p.vy * dt);
      if (Math.hypot(I.ax, I.ay) > 0.2) p.face = Math.atan2(I.ay, I.ax);
      if (I.pressed('dodge') && p.dashCD <= 0) {
        p.dashT = 0.2;
        p.dashCD = st.dodgeCD * 0.9;
        p.dashA = Math.hypot(I.ax, I.ay) > 0.2 ? Math.atan2(I.ay, I.ax) : this.aim;
        this.v.invuln = Math.max(this.v.invuln, 0.25);
        G.audio.play('dash');
        if (st.perks.has('reflex')) this.v.addShield(12);
      }
      // Aiming: mouse, right stick, or assisted auto-aim.
      const mouseRecent = I.mouse.active && I.device === 'kb' && G.time - I.mouse.lastMove < 2.5;
      if (I.rx || I.ry) this.aim = Math.atan2(I.ry, I.rx);
      else if (mouseRecent) {
        const wx = I.mouse.x - G.W / 2 + this.cam.x, wy = I.mouse.y - G.H / 2 + this.cam.y + 12;
        this.aim = Math.atan2(wy - p.y, wx - p.x);
      } else {
        const t = this.autoTarget();
        const goal = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.face;
        this.aim += U.angDiff(this.aim, goal) * Math.min(1, dt * 14);
      }
      this.fireCD -= dt;
      if (I.down('fire') && this.fireCD <= 0) this.shootPlayer();
      if (I.pressed('alt')) this.throwGrenade();
    }

    autoTarget() {
      const p = this.p;
      let best = null, bs = 1e9;
      const targets = this.ents.filter((e) => e.hp > 0).concat(this.cores.filter((c) => c.hp > 0));
      for (const e of targets) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > 430) continue;
        const a = Math.abs(U.angDiff(p.face, Math.atan2(e.y - p.y, e.x - p.x)));
        if (a > 1.4 && d > 120) continue;
        if (!this.los(p.x, p.y, e.x, e.y)) continue;
        const s = d + a * 160 + (e.max && !e.kind ? 80 : 0);
        if (s < bs) {
          bs = s;
          best = e;
        }
      }
      return best;
    }

    shootPlayer() {
      const st = this.st.primary;
      const p = this.p;
      const col = { pulse: '#7fe4ff', repeater: '#8dffa8', scatter: '#ffb347', rail: '#d6a8ff' }[st.arch];
      const dmg = st.dmg * this.dmgOut * 1.1;
      const n = st.pellets;
      const spread = st.arch === 'scatter' ? 0.32 : st.arch === 'repeater' ? 0.08 : 0.03;
      for (let i = 0; i < n; i++) {
        const a = this.aim + (n > 1 ? (i / (n - 1) - 0.5) * spread : U.rand(-spread, spread));
        const sp = st.arch === 'rail' ? 1400 : 950;
        this.bullets.push({ x: p.x + Math.cos(this.aim) * 18, y: p.y + Math.sin(this.aim) * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, col, friendly: true, life: st.arch === 'scatter' ? 0.35 : 0.8, pierce: st.pierce, r: st.arch === 'rail' ? 5 : 3 });
      }
      this.fireCD = 1 / (st.rate * 0.85);
      this.fx.add({ x: p.x + Math.cos(this.aim) * 22, y: p.y + Math.sin(this.aim) * 22 - 12, life: 0.06, size: 18, color: col, glow: true });
      G.audio.play(st.arch === 'rail' ? 'rail' : st.arch === 'scatter' ? 'scatter' : st.arch === 'repeater' ? 'repeater' : 'laser');
    }

    throwGrenade() {
      if (this.nades <= 0) {
        G.audio.play('back');
        return;
      }
      this.nades--;
      const p = this.p;
      const sp = 430;
      this.grenades.push({ x: p.x, y: p.y, vx: Math.cos(this.aim) * sp, vy: Math.sin(this.aim) * sp, fuse: 0.75, z: 0, vz: 260 });
      G.audio.play('grenade');
    }

    updateGrenades(dt) {
      for (const g of this.grenades) {
        g.fuse -= dt;
        g.vz -= 900 * dt;
        g.z = Math.max(0, g.z + g.vz * dt);
        const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
        if (this.solidAt(nx, g.y)) g.vx *= -0.5;
        else g.x = nx;
        if (this.solidAt(g.x, ny)) g.vy *= -0.5;
        else g.y = ny;
        g.vx *= Math.pow(0.2, dt);
        g.vy *= Math.pow(0.2, dt);
        if (g.fuse <= 0) {
          g.dead = true;
          const R = 95 * this.st.secondary.radius;
          const dmg = this.st.secondary.dmg * this.dmgOut * 1.2;
          for (const e of this.ents) if (e.hp > 0 && Math.hypot(e.x - g.x, e.y - g.y) < R + e.r) this.hurtEnemy(e, dmg);
          for (const c of this.cores) if (c.hp > 0 && Math.hypot(c.x - g.x, c.y - g.y) < R + c.r) this.hurtCore(c, dmg);
          for (let ty = Math.floor((g.y - R) / T); ty <= Math.floor((g.y + R) / T); ty++)
            for (let tx = Math.floor((g.x - R) / T); tx <= Math.floor((g.x + R) / T); tx++) if (this.tile(tx, ty) === 'c') this.hurtCrate(tx, ty, 60);
          this.fx.burst(g.x, g.y, '#ffb347', 26, 320, 40, 0.6);
          G.audio.play('boom');
          G.shake(6);
        }
      }
      this.grenades = this.grenades.filter((g) => !g.dead);
    }

    updateEnemies(dt) {
      const p = this.p;
      const playing = this.phase === 'play';
      for (const e of this.ents) {
        e.flash = Math.max(0, e.flash - dt);
        if (e.hp <= 0) continue;
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy);
        const see = d < 500 && this.los(e.x, e.y, p.x, p.y);
        if (!e.alert && see && d < 440) {
          e.alert = true;
          // Wake nearby squadmates.
          for (const o of this.ents) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 260) o.alert = true;
        }
        if (!e.alert || !playing) {
          e.vx = U.damp(e.vx, 0, 6, dt);
          e.vy = U.damp(e.vy, 0, 6, dt);
          continue;
        }
        const ang = Math.atan2(dy, dx);
        e.ang += U.angDiff(e.ang, ang) * Math.min(1, dt * 8);
        let tx = 0, ty = 0;
        if (e.kind === 'grunt' || e.kind === 'heavy') {
          const want = e.kind === 'grunt' ? 230 : 170;
          const toward = see ? U.clamp((d - want) / 100, -1, 1) : 1;
          e.strafeT -= dt;
          if (e.strafeT <= 0) {
            e.strafeT = U.rand(1, 2.4);
            e.strafe *= -1;
          }
          tx = Math.cos(ang) * toward + Math.cos(ang + Math.PI / 2) * e.strafe * 0.7;
          ty = Math.sin(ang) * toward + Math.sin(ang + Math.PI / 2) * e.strafe * 0.7;
          e.fireCD -= dt;
          if (see && e.fireCD <= 0 && d < 520) {
            if (e.kind === 'grunt') {
              e.burst = 3;
              e.fireCD = U.rand(1.6, 2.4) / this.diffMul;
            } else {
              for (let k = -2; k <= 2; k++) this.enemyShot(e, ang + k * 0.16, 300, 9);
              e.fireCD = U.rand(2.2, 2.8) / this.diffMul;
            }
          }
          if (e.burst > 0) {
            e.burstT = (e.burstT || 0) - dt;
            if (e.burstT <= 0) {
              e.burst--;
              e.burstT = 0.13;
              this.enemyShot(e, ang + U.rand(-0.08, 0.08), 380, 8);
            }
          }
        } else if (e.kind === 'rusher') {
          tx = Math.cos(ang);
          ty = Math.sin(ang);
          e.meleeCD -= dt;
          if (d < e.r + p.r + 6 && e.meleeCD <= 0) {
            e.meleeCD = 0.8;
            this.playerHit(14);
            p.vx += Math.cos(ang) * 320;
            p.vy += Math.sin(ang) * 320;
          }
        } else if (e.kind === 'turret') {
          e.fireCD -= dt;
          if (see && e.fireCD <= 0 && d < 560) {
            this.enemyShot(e, e.ang, 460, 9);
            e.fireCD = 1.1 / this.diffMul;
          }
        }
        const len = Math.hypot(tx, ty);
        if (len > 1) {
          tx /= len;
          ty /= len;
        }
        e.vx = U.damp(e.vx, tx * e.speed, 6, dt);
        e.vy = U.damp(e.vy, ty * e.speed, 6, dt);
        if (e.speed) this.moveCircle(e, e.vx * dt, e.vy * dt);
      }
      // Keep enemies from stacking on each other.
      for (let i = 0; i < this.ents.length; i++) {
        const a = this.ents[i];
        if (a.hp <= 0 || !a.speed) continue;
        for (let j = i + 1; j < this.ents.length; j++) {
          const b = this.ents[j];
          if (b.hp <= 0 || !b.speed) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const m = a.r + b.r;
          if (d < m && d > 0) {
            const push = (m - d) / 2;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
          }
        }
      }
      for (const e of this.ents) if (e.hp <= 0) e.deadT = (e.deadT || 0) + dt;
      this.ents = this.ents.filter((e) => e.hp > 0 || e.deadT < 0.4);
    }

    enemyShot(e, a, sp, dmg) {
      this.bullets.push({ x: e.x + Math.cos(a) * (e.r + 4), y: e.y + Math.sin(a) * (e.r + 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: dmg * (0.9 + this.m.stage * 0.05), col: '#ff5a6a', friendly: false, life: 2.2, r: 4 });
      G.audio.play('enemyShot');
    }

    updateBullets(dt) {
      const p = this.p;
      for (const b of this.bullets) {
        b.life -= dt;
        const steps = 2;
        for (let s = 0; s < steps && !b.dead; s++) {
          b.x += (b.vx * dt) / steps;
          b.y += (b.vy * dt) / steps;
          const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
          if (this.solidTile(tx, ty)) {
            if (this.tile(tx, ty) === 'c' && b.friendly) this.hurtCrate(tx, ty, b.dmg);
            b.dead = true;
            this.fx.add({ x: b.x, y: b.y - 10, life: 0.15, size: 10, color: b.col, glow: true });
            break;
          }
          if (b.friendly) {
            for (const e of this.ents) {
              if (e.hp <= 0 || (b.hitSet && b.hitSet.has(e))) continue;
              if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
                this.hurtEnemy(e, b.dmg);
                if (this.st.perks.has('chain')) this.chain(e, b.dmg * 0.4);
                if (b.pierce > 0) {
                  b.pierce--;
                  (b.hitSet = b.hitSet || new Set()).add(e);
                } else {
                  b.dead = true;
                  break;
                }
              }
            }
            if (b.dead) break;
            for (const c of this.cores) {
              if (c.hp > 0 && Math.hypot(c.x - b.x, c.y - b.y) < c.r + b.r) {
                this.hurtCore(c, b.dmg);
                b.dead = true;
                break;
              }
            }
          } else if (this.phase === 'play' && Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) {
            b.dead = true;
            this.playerHit(b.dmg);
          }
        }
      }
      this.bullets = this.bullets.filter((b) => !b.dead && b.life > 0);
    }

    chain(from, dmg) {
      let best = null, bd = 160;
      for (const e of this.ents) {
        if (e === from || e.hp <= 0) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) {
        this.hurtEnemy(best, dmg);
        this.fx.add({ x: (best.x + from.x) / 2, y: (best.y + from.y) / 2 - 12, life: 0.12, size: 30, color: '#bfe8ff', glow: true });
      }
    }

    hurtEnemy(e, dmg) {
      if (e.hp <= 0) return;
      e.hp -= dmg;
      e.flash = 0.08;
      e.alert = true;
      G.popups.add(e.x - this.cam.x + G.W / 2 + U.rand(-6, 6), e.y - this.cam.y + G.H / 2 - 34, String(Math.round(dmg)), '#ffffff', 12, 0.5);
      G.audio.play('hit');
      if (e.hp <= 0) {
        this.kills++;
        const mul = this.combo.kill();
        this.combo.freeze(e.kind === 'heavy' ? 0.08 : 0.035);
        e.deadT = 0;
        this.fx.burst(e.x, e.y - 12, e.col, 14, 200, 20);
        G.audio.play('boom');
        if (this.st.perks.has('leech')) this.v.addShield(6);
        if (this.st.perks.has('resupply') && Math.random() < 0.15) this.nades++;
        for (let i = 0; i < 2; i++) this.pickups.push({ kind: 'scrap', x: e.x + U.rand(-10, 10), y: e.y + U.rand(-10, 10), value: (e.scrap / 2) * this.st.scrapMult * mul });
        if (Math.random() < (e.kind === 'heavy' ? 0.35 : 0.05)) this.pickups.push({ kind: 'cache', x: e.x, y: e.y });
      }
    }

    hurtCrate(tx, ty, dmg) {
      const k = tx + ',' + ty;
      this.crateHp[k] = (this.crateHp[k] || 40) - dmg;
      if (this.crateHp[k] <= 0) {
        this.grid[ty][tx] = '.';
        const cx = tx * T + T / 2, cy = ty * T + T / 2;
        this.fx.burst(cx, cy - 10, '#c9a227', 10, 180, 16);
        G.audio.play('boom');
        this.pickups.push({ kind: 'scrap', x: cx, y: cy, value: 3 * this.st.scrapMult });
        if (Math.random() < 0.12) this.pickups.push({ kind: Math.random() < 0.5 ? 'repair' : 'nades', x: cx, y: cy });
      }
    }

    hurtCore(c, dmg) {
      if (c.hp <= 0) return;
      c.hp -= dmg;
      c.flash = 0.08;
      G.audio.play('hit');
      if (c.hp <= 0) {
        this.fx.burst(c.x, c.y - 20, '#ff4d5e', 40, 380, 50, 0.9);
        G.audio.play('bigboom');
        G.shake(14);
        this.combo.freeze(0.14);
        this.scrap += 25 * this.st.scrapMult;
        this.pickups.push({ kind: 'cache', x: c.x, y: c.y + 30 });
        const left = this.cores.filter((q) => q.hp > 0).length;
        if (left > 0) G.radio.say('harrow', `Core down. ${left} to go.`, 2.4, true);
        else this.openDoors();
      }
    }

    openDoors() {
      this.doorsOpen = true;
      G.audio.play('alarm');
      G.radio.say('ops', 'All cores are down! The blast doors are open. Get to the extraction pad in the south-east bay!', 4, true);
      G.radio.say('vesk', 'And they are sending everyone after you. Move!', 3);
      // Reinforcements arrive out of sight.
      let n = 0;
      for (let tries = 0; tries < 200 && n < 6; tries++) {
        const tx = U.randi(1, this.W - 2), ty = U.randi(1, this.H - 2);
        if (this.tile(tx, ty) !== '.') continue;
        const x = tx * T + T / 2, y = ty * T + T / 2;
        if (Math.hypot(x - this.p.x, y - this.p.y) < 450) continue;
        this.spawn(n % 3 === 2 ? 'grunt' : 'rusher', x, y, true);
        n++;
      }
    }

    playerHit(dmg) {
      const hull = this.v.hull;
      const r = this.v.hit(dmg, 0.12);
      if (this.v.hull < hull) this.combo.freeze(0.05);
      if (r === 'dead' && this.phase !== 'dead') {
        this.phase = 'dead';
        this.phaseT = 0;
        this.fx.burst(this.p.x, this.p.y - 12, '#ffb347', 30, 260, 30);
        G.audio.play('bigboom');
        G.radio.say('harrow', 'We lost your signal! Wingbreaker, respond!', 3, true);
      }
    }

    finish(success) {
      if (this.result) return;
      this.result = G.makeResult({
        success, bonus: this.bonusDone, kills: this.kills, enemies: Math.max(1, this.enemies), damageTaken: this.v.damageTaken,
        maxHp: this.v.maxHull + this.v.maxShield, time: this.t, bestChain: this.combo.best, scrap: Math.round(this.scrap), caches: this.caches,
      });
    }

    // ---------- Drawing ----------
    draw(ctx) {
      const W = G.W, H = G.H;
      const ox = Math.round(this.cam.x - W / 2), oy = Math.round(this.cam.y - H / 2);
      ctx.fillStyle = '#07080d';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(this.floor, -ox, -oy);
      ctx.save();
      ctx.translate(-ox, -oy);
      // Floor-level things: exit pad, pickups, grenades' shadows
      if (this.exit) {
        const { x, y } = this.exit;
        ctx.save();
        ctx.globalAlpha = this.doorsOpen ? 0.8 + Math.sin(this.t * 5) * 0.2 : 0.3;
        ctx.strokeStyle = this.doorsOpen ? '#6fe39a' : '#3a5a48';
        ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x, y, 18 + k * 14 + ((this.t * 20) % 14), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      for (const k of this.pickups) this.drawPickup(ctx, k);
      // Row-ordered walls and actors for the 2.5D look.
      const r0 = Math.max(0, Math.floor(oy / T) - 1), r1 = Math.min(this.H - 1, Math.floor((oy + H) / T) + 2);
      const c0 = Math.max(0, Math.floor(ox / T) - 1), c1 = Math.min(this.W - 1, Math.floor((ox + W) / T) + 1);
      const actors = [];
      for (const e of this.ents) actors.push({ y: e.y, f: () => this.drawEnemy(ctx, e) });
      for (const c of this.cores) actors.push({ y: c.y, f: () => this.drawCore(ctx, c) });
      if (this.phase !== 'dead') actors.push({ y: this.p.y, f: () => this.drawPlayer(ctx) });
      actors.sort((a, b) => a.y - b.y);
      let ai = 0;
      for (let r = r0; r <= r1; r++) {
        while (ai < actors.length && actors[ai].y < r * T) actors[ai++].f();
        for (let c = c0; c <= c1; c++) this.drawWall(ctx, c, r);
      }
      while (ai < actors.length) actors[ai++].f();
      // Projectiles and effects on top
      for (const g of this.grenades) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(g.x, g.y, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = Math.floor(this.t * 12) % 2 ? '#ffb347' : '#3a3f4d';
        ctx.beginPath();
        ctx.arc(g.x, g.y - 8 - g.z * 0.12, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.bullets) {
        G.drawGlow(ctx, b.col, b.x, b.y - 12, b.r * 4, 1);
        ctx.strokeStyle = b.col;
        ctx.lineWidth = b.r;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 12);
        ctx.lineTo(b.x - b.vx * 0.02, b.y - 12 - b.vy * 0.02);
        ctx.stroke();
      }
      ctx.restore();
      this.fx.draw(ctx);
      ctx.restore();
      // Lighting: a soft pool of light around the player.
      const px = this.p.x - ox, py = this.p.y - oy;
      const grd = ctx.createRadialGradient(px, py, 160, px, py, 620);
      grd.addColorStop(0, 'rgba(4,5,10,0)');
      grd.addColorStop(1, 'rgba(4,5,10,0.6)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      this.drawHUD(ctx, ox, oy);
    }

    drawWall(ctx, tx, ty) {
      const c = this.tile(tx, ty);
      const isDoor = c === 'L';
      if (c !== '#' && c !== 'c' && !isDoor) return;
      const x = tx * T, y = ty * T;
      if (isDoor && this.doorsOpen) {
        ctx.fillStyle = 'rgba(111,227,154,0.18)';
        ctx.fillRect(x, y, T, T);
        return;
      }
      if (c === 'c') {
        const h = 18;
        ctx.fillStyle = '#5a4a2a';
        ctx.fillRect(x + 4, y + T - h - 4, T - 8, h);
        ctx.fillStyle = '#8a7340';
        ctx.fillRect(x + 4, y + 4 - h, T - 8, T - 8);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 8, y + 8 - h, T - 16, T - 16);
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 8 - h);
        ctx.lineTo(x + T - 8, y + T - 8 - h);
        ctx.stroke();
        return;
      }
      const southOpen = !this.solidTile(tx, ty + 1) || this.tile(tx, ty + 1) === 'c';
      // Front (south) face
      if (southOpen) {
        ctx.fillStyle = isDoor ? '#6a2a2e' : '#2c3242';
        ctx.fillRect(x, y + T - WH, T, WH);
        ctx.fillStyle = isDoor ? '#ffb347' : 'rgba(95,212,255,0.35)';
        if (isDoor) for (let k = 0; k < 4; k++) ctx.fillRect(x + k * 12, y + T - WH + 4, 6, WH - 8);
        else if ((tx + ty) % 3 === 0) ctx.fillRect(x + 8, y + T - 10, T - 16, 2);
      }
      // Top face
      ctx.fillStyle = isDoor ? '#a33a44' : '#454d60';
      ctx.fillRect(x, y - WH, T, T);
      ctx.fillStyle = isDoor ? '#c4505a' : '#525b70';
      if (!this.solidTile(tx, ty - 1)) ctx.fillRect(x, y - WH, T, 3);
      if (!this.solidTile(tx - 1, ty)) ctx.fillRect(x, y - WH, 2, T);
      if (!this.solidTile(tx + 1, ty)) ctx.fillRect(x + T - 2, y - WH, 2, T);
    }

    drawPickup(ctx, k) {
      const bob = Math.sin(this.t * 4 + k.x) * 3;
      const col = { intel: '#6fe39a', repair: '#6fe39a', nades: '#ffb347', scrap: '#ffd37a', cache: '#c77dff' }[k.kind];
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      G.drawGlow(ctx, col, k.x, k.y - 14 + bob, k.kind === 'scrap' ? 10 : 22, 0.8);
      ctx.restore();
      ctx.fillStyle = col;
      if (k.kind === 'intel') {
        ctx.fillRect(k.x - 7, k.y - 22 + bob, 14, 10);
        ctx.fillStyle = '#0b2a18';
        ctx.fillRect(k.x - 4, k.y - 19 + bob, 8, 2);
      } else if (k.kind === 'repair') {
        ctx.fillRect(k.x - 2, k.y - 22 + bob, 4, 14);
        ctx.fillRect(k.x - 7, k.y - 17 + bob, 14, 4);
      } else if (k.kind === 'nades') {
        ctx.beginPath();
        ctx.arc(k.x, k.y - 15 + bob, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (k.kind === 'cache') {
        ctx.beginPath();
        ctx.moveTo(k.x, k.y - 26 + bob);
        ctx.lineTo(k.x + 8, k.y - 15 + bob);
        ctx.lineTo(k.x, k.y - 4 + bob);
        ctx.lineTo(k.x - 8, k.y - 15 + bob);
        ctx.fill();
      } else ctx.fillRect(k.x - 3, k.y - 17 + bob, 6, 6);
    }

    drawPlayer(ctx) {
      const p = this.p;
      if (this.v.invuln > 0 && p.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0) return;
      const flash = this.v.flash > 0.2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      const by = p.y - 12;
      // gun
      ctx.save();
      ctx.translate(p.x, by);
      ctx.rotate(this.aim);
      ctx.fillStyle = '#1d2129';
      ctx.fillRect(4, -3, 22, 6);
      ctx.fillStyle = '#5fd4ff';
      ctx.fillRect(22, -2, 4, 4);
      ctx.restore();
      // body
      ctx.fillStyle = flash ? '#fff' : '#d9dde6';
      ctx.beginPath();
      ctx.arc(p.x, by, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f6bff';
      ctx.beginPath();
      ctx.arc(p.x, by, 13, Math.PI * 0.15, Math.PI * 0.85);
      ctx.fill();
      // helmet + visor facing aim
      ctx.fillStyle = '#e8ebf2';
      ctx.beginPath();
      ctx.arc(p.x, by - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(this.aim) * 4, by - 4 + Math.sin(this.aim) * 3, 4, 0, Math.PI * 2);
      ctx.fill();
      if (this.v.shieldFlash > 0 && this.v.shield > 0) {
        ctx.strokeStyle = `rgba(95,212,255,${this.v.shieldFlash * 3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, by, 19, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawEnemy(ctx, e) {
      const dead = e.hp <= 0;
      ctx.save();
      if (dead) ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.4);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 4, e.r + 2, (e.r + 2) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      const by = e.y - 12;
      const col = e.flash > 0 ? '#ffffff' : e.col;
      if (e.kind === 'turret') {
        ctx.fillStyle = '#3b4250';
        ctx.fillRect(e.x - 16, e.y - 16, 32, 22);
        ctx.save();
        ctx.translate(e.x, by - 4);
        ctx.rotate(e.ang);
        ctx.fillStyle = '#1d2129';
        ctx.fillRect(0, -4, 26, 8);
        ctx.restore();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(e.x, by - 4, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4d5e';
        ctx.fillRect(e.x - 3, by - 7, 6, 3);
      } else {
        ctx.save();
        ctx.translate(e.x, by);
        ctx.rotate(e.ang);
        ctx.fillStyle = '#1d1a22';
        if (e.kind === 'rusher') {
          ctx.fillRect(6, -10, 14, 3);
          ctx.fillRect(6, 7, 14, 3);
        } else ctx.fillRect(4, -3, e.kind === 'heavy' ? 26 : 20, e.kind === 'heavy' ? 8 : 6);
        ctx.restore();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(e.x, by, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(e.x, by, e.r, Math.PI * 0.1, Math.PI * 0.9);
        ctx.fill();
        // Crown-crest helmet
        ctx.fillStyle = '#c77dff';
        ctx.beginPath();
        ctx.moveTo(e.x - 6, by - e.r + 4);
        ctx.lineTo(e.x - 3, by - e.r - 3);
        ctx.lineTo(e.x, by - e.r + 2);
        ctx.lineTo(e.x + 3, by - e.r - 3);
        ctx.lineTo(e.x + 6, by - e.r + 4);
        ctx.fill();
        ctx.fillStyle = '#ffdd55';
        ctx.fillRect(e.x + Math.cos(e.ang) * e.r * 0.5 - 3, by + Math.sin(e.ang) * e.r * 0.4 - 2, 6, 3);
      }
      if (!dead && e.hp < e.max) {
        G.hud.bar(ctx, e.x - 16, by - e.r - 12, 32, 3, e.hp / e.max, '#ff4d5e', 'rgba(0,0,0,0.5)');
      }
      if (!e.alert && !dead) G.text(ctx, '?', e.x, by - e.r - 6, { size: 12, align: 'center', color: '#aab6d6', lw: 3 });
      ctx.restore();
    }

    drawCore(ctx, c) {
      const dead = c.hp <= 0;
      const x = c.x, y = c.y;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 30, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      if (dead) {
        ctx.fillStyle = '#1a1a20';
        ctx.beginPath();
        ctx.ellipse(x, y, 26, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,120,60,0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y, 12 + Math.sin(this.t * 9) * 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const h = 54;
      const pulse = 0.6 + Math.sin(this.t * 5) * 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      G.drawGlow(ctx, '#ff4d5e', x, y - h / 2, 60, pulse * 0.7);
      ctx.restore();
      ctx.fillStyle = c.flash > 0 ? '#fff' : '#3b2a35';
      ctx.fillRect(x - 24, y - h, 48, h);
      ctx.fillStyle = c.flash > 0 ? '#fff' : `rgba(255,77,94,${pulse})`;
      ctx.fillRect(x - 12, y - h + 6, 24, h - 12);
      ctx.fillStyle = '#524050';
      ctx.beginPath();
      ctx.ellipse(x, y - h, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7a8a';
      ctx.beginPath();
      ctx.ellipse(x, y - h, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      G.hud.bar(ctx, x - 26, y - h - 20, 52, 5, c.hp / c.max, '#ff4d5e', 'rgba(0,0,0,0.5)');
    }

    drawHUD(ctx, ox, oy) {
      G.hud.vitals(ctx, this.v);
      this.combo.draw(ctx);
      G.hud.scoreBox(ctx, this.scrap, `KILLS ${this.kills}` + (this.caches ? `  ·  CACHES ${this.caches}` : ''));
      G.hud.objective(ctx, this.m.bonus.text, Math.min(this.intel, 3), 3, this.bonusDone);
      const left = this.cores.filter((c) => c.hp > 0).length;
      const main = left > 0 ? `Destroy reactor cores  ${3 - left}/3` : 'Reach the extraction pad';
      G.text(ctx, main, G.W / 2, 60, { size: 14, align: 'center', color: left > 0 ? '#ff8a8a' : '#6fe39a' });
      // Minimap
      const mw = this.mini.width, mh = this.mini.height;
      const mx = G.W - mw - 14, my = 60;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.mini, mx, my);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(mx - 0.5, my - 0.5, mw + 1, mh + 1);
      const dot = (x, y, col, r = 2.5) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(mx + (x / T) * 3, my + (y / T) * 3, r, 0, Math.PI * 2);
        ctx.fill();
      };
      for (const c of this.cores) if (c.hp > 0) dot(c.x, c.y, '#ff4d5e', 3);
      if (this.exit) dot(this.exit.x, this.exit.y, this.doorsOpen ? '#6fe39a' : '#3a5a48', 3);
      for (const e of this.ents) if (e.hp > 0 && e.alert) dot(e.x, e.y, '#ffb347', 1.5);
      dot(this.p.x, this.p.y, '#5fd4ff', 3);
      // Off-screen arrow to the next objective.
      const goal = left > 0 ? this.cores.filter((c) => c.hp > 0).sort((a, b) => Math.hypot(a.x - this.p.x, a.y - this.p.y) - Math.hypot(b.x - this.p.x, b.y - this.p.y))[0] : this.exit;
      if (goal) {
        const sx = goal.x - ox, sy = goal.y - oy;
        if (sx < 0 || sx > G.W || sy < 0 || sy > G.H) {
          const a = Math.atan2(sy - G.H / 2, sx - G.W / 2);
          const ax = G.W / 2 + Math.cos(a) * 230, ay = G.H / 2 + Math.sin(a) * 200;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(a);
          ctx.fillStyle = left > 0 ? 'rgba(255,77,94,0.8)' : 'rgba(111,227,154,0.8)';
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-6, -9);
          ctx.lineTo(-6, 9);
          ctx.fill();
          ctx.restore();
        }
      }
      // Grenades + dash
      G.hud.ammo(ctx, 'GRENADES', this.nades, Math.max(this.nades, this.maxNades), U.clamp(1 - this.p.dashCD / (this.st.dodgeCD * 0.9), 0, 1));
      // Aim cursor for mouse users
      if (I.mouse.active && I.device === 'kb' && G.time - I.mouse.lastMove < 2.5) {
        ctx.strokeStyle = 'rgba(140,255,170,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(I.mouse.x, I.mouse.y, 8, 0, Math.PI * 2);
        ctx.moveTo(I.mouse.x - 13, I.mouse.y);
        ctx.lineTo(I.mouse.x - 4, I.mouse.y);
        ctx.moveTo(I.mouse.x + 4, I.mouse.y);
        ctx.lineTo(I.mouse.x + 13, I.mouse.y);
        ctx.stroke();
      }
      G.popups.draw(ctx);
      G.radio.draw(ctx);
      G.hud.titleCard(ctx, this.m, this.t);
      if (this.phase === 'outro') G.hud.banner(ctx, 'EXTRACTED', '#ffd37a');
      if (this.phase === 'dead') G.hud.banner(ctx, 'K.I.A.', '#ff6b5e');
      G.input.drawTouch(ctx);
    }
  }

  G.modes = G.modes || {};
  G.modes.foot = (mission, stats) => new Foot(mission, stats);
})();
