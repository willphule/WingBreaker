// Gauntlet: a side-view, three-lane tunnel run that keeps speeding up. Jump, duck and switch lanes.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const I = G.input;

  const LANE_Y = [338, 402, 466];
  const LANE_S = [0.82, 0.91, 1.0];
  const PX = 230;
  const GRAV = 2100, JUMP_V = 700;

  class Gauntlet {
    constructor(mission, stats) {
      this.m = mission;
      this.st = stats;
      this.v = new G.Vitals(stats, mission);
      this.fx = new G.Particles2D();
      this.diffMul = U.clamp(1 + (mission.stage - 1) * 0.08, 1, 1.4);
      this.t = 0;
      this.phase = 'intro';
      this.phaseT = 0;
      this.x = 0;
      this.speed = 480;
      this.lane = 1;
      this.laneF = 1;
      this.h = 0;
      this.vh = 0;
      this.duck = false;
      this.cells = 0;
      this.cellsTotal = 0;
      this.scrap = 0;
      this.caches = 0;
      this.hits = 0;
      this.obs = [];
      this.result = null;
      this.sector = 1;
      this.bonusDone = false;
      this.build();
      G.radio.clear();
      G.radio.top = true;
      G.popups.clear();
      G.radio.say('vesk', 'Scrapline is live. Up and down to change lanes, jump with fire, duck with dodge.', 4.2);
      G.radio.say('juno', 'Grab the power cells! Sixty of them gets us into the Dock core.', 3.4);
      G.audio.music('gauntlet');
    }

    build() {
      let x = 1400;
      this.length = 0;
      const total = 62000;
      const pats = ['tallTwo', 'lowAll', 'barAll', 'gap', 'slalom', 'mixed', 'cells', 'ramp', 'tallTwo', 'mixed'];
      let i = 0;
      while (x < total) {
        const prog = x / total;
        const name = i < 4 ? ['cells', 'lowAll', 'tallTwo', 'barAll'][i] : U.pick(pats);
        x = this.pattern(name, x, prog);
        x += U.rand(380, 620) * (1.25 - prog * 0.45) + 300 * prog;
        if (i % 3 === 2) {
          this.cellRow(x - 200, U.randi(0, 2), U.chance(0.4));
        }
        if (i % 9 === 8) this.obs.push({ kind: 'repair', x: x - 120, lane: U.randi(0, 2), w: 30 });
        i++;
      }
      this.length = x + 800;
      this.cellsTotal = this.obs.filter((o) => o.kind === 'cell').length;
    }
    add(kind, x, lane, extra) {
      const o = Object.assign({ kind, x, lane, w: 34 }, extra || {});
      this.obs.push(o);
      return o;
    }
    cellRow(x, lane, high) {
      for (let k = 0; k < 4; k++) this.add('cell', x + k * 70, lane, { w: 24, y: high ? 60 + Math.sin((k / 3) * Math.PI) * 30 : 16 });
    }
    pattern(name, x, prog) {
      const L = [0, 1, 2];
      switch (name) {
        case 'tallTwo': {
          const open = U.randi(0, 2);
          for (const l of L) if (l !== open) this.add('tall', x, l, { w: 40 });
          this.add('cell', x, open, { w: 24, y: 16 });
          return x + 60;
        }
        case 'lowAll':
          for (const l of L) this.add('low', x, l, { w: 36 });
          for (const l of L) this.add('cell', x, l, { w: 24, y: 85 });
          return x + 60;
        case 'barAll':
          for (const l of L) this.add('bar', x, l, { w: 70 });
          return x + 90;
        case 'gap':
          for (const l of L) this.add('gap', x, l, { w: 150 + prog * 60 });
          return x + 230;
        case 'slalom': {
          let lane = U.chance(0.5) ? 0 : 2;
          const n = 3 + Math.round(prog * 2);
          const gap = 340 + prog * 320; // more room as the run speeds up
          for (let k = 0; k < n; k++) {
            const lanes = lane === 0 ? [0, 1] : [1, 2];
            for (const l of lanes) this.add('tall', x + k * gap, l, { w: 40 });
            lane = 2 - lane;
          }
          return x + n * gap;
        }
        case 'mixed': {
          const order = U.shuffle(['tall', 'low', 'bar']);
          L.forEach((l, k) => this.add(order[k], x, l, { w: order[k] === 'bar' ? 70 : 38 }));
          return x + 80;
        }
        case 'cells':
          this.cellRow(x, U.randi(0, 2), false);
          this.cellRow(x + 360, U.randi(0, 2), true);
          return x + 640;
        case 'ramp': {
          const l = U.randi(0, 2);
          this.add('ramp', x, l, { w: 90 });
          for (const k of L) if (k !== l) this.add('tall', x + 60, k, { w: 40 });
          for (const k of L) this.add('gap', x + 210, k, { w: 260 });
          for (let k = 0; k < 3; k++) this.add('cell', x + 230 + k * 60, l, { w: 24, y: 120 });
          return x + 520;
        }
      }
      return x;
    }

    playerHeight() {
      return this.duck && this.h < 1 ? 30 : 68;
    }

    update(dt) {
      this.t += dt;
      this.phaseT += dt;
      G.radio.update(dt);
      G.popups.update(dt);
      this.fx.update(dt);
      this.v.update(dt);
      if (this.phase === 'intro' && this.phaseT > 1.5) {
        this.phase = 'play';
        this.phaseT = 0;
      }
      const prog = this.x / this.length;
      const target = (480 + prog * 600) * this.diffMul;
      if (this.phase === 'play' || this.phase === 'intro') {
        this.speed = U.approach(this.speed, target, 140 * dt);
        if (I.pressed('up') && this.lane > 0) {
          this.lane--;
          G.audio.play('menu');
        }
        if (I.pressed('down') && this.lane < 2) {
          this.lane++;
          G.audio.play('menu');
        }
        if (I.pressed('fire') && this.h <= 0.01) {
          this.vh = JUMP_V;
          G.audio.play('jump');
        }
        this.duck = I.down('dodge') || I.down('alt');
      } else if (this.phase === 'dead') this.speed = U.approach(this.speed, 0, 900 * dt);
      this.laneF = U.damp(this.laneF, this.lane, 16, dt);
      // Jump physics
      if (this.h > 0 || this.vh > 0) {
        this.vh -= GRAV * dt;
        this.h += this.vh * dt;
        if (this.h <= 0) {
          this.h = 0;
          this.vh = 0;
          G.audio.play('land');
          for (let i = 0; i < 6; i++) this.fx.add({ x: PX + U.rand(-20, 20), y: this.groundY(), vx: U.rand(-120, -40), vy: U.rand(-80, -20), life: 0.35, size: 5, color: '#8a7f73', drag: 0.94 });
        }
      }
      const ox = this.x;
      this.x += this.speed * dt;
      if (this.phase === 'play') this.collide(ox);
      const sec = 1 + Math.floor(prog * 4);
      if (sec > this.sector && sec <= 4) {
        this.sector = sec;
        G.popups.add(G.W / 2, 140, `SECTOR ${sec}  ·  SPEED UP`, '#ffd37a', 22, 1.6);
        G.audio.play('alarm');
        if (sec === 3) G.radio.say('vesk', 'Halfway! It only gets faster from here.', 2.6);
        if (sec === 4) G.radio.say('juno', 'Last sector, I can see the exit!', 2.6);
      }
      if (this.phase === 'play' && this.x > this.length) {
        this.phase = 'outro';
        this.phaseT = 0;
        G.audio.music('victory');
        G.radio.say('harrow', 'You are through the scrapline. Remind me never to ask that again.', 3.2, true);
      }
      if (this.phase === 'outro') {
        this.speed = U.approach(this.speed, 200, 400 * dt);
        if (this.phaseT > 2.6) this.finish(true);
      }
      if (this.phase === 'dead' && this.phaseT > 2.4) this.finish(false);
      // Exhaust sparks
      if (this.phase !== 'dead' && Math.random() < 0.7) this.fx.add({ x: PX - 34, y: this.groundY() - this.h - 18 * this.scale(), vx: -this.speed * 0.3 - U.rand(0, 60), vy: U.rand(-20, 20), life: 0.25, size: 9, color: '#ffb347', glow: true, drag: 0.92 });
    }

    groundY() {
      const i = U.clamp(this.laneF, 0, 2);
      const a = Math.floor(i), b = Math.min(2, a + 1);
      return U.lerp(LANE_Y[a], LANE_Y[b], i - a);
    }
    scale() {
      const i = U.clamp(this.laneF, 0, 2);
      const a = Math.floor(i), b = Math.min(2, a + 1);
      return U.lerp(LANE_S[a], LANE_S[b], i - a);
    }

    collide(ox) {
      const lane = Math.round(this.laneF);
      const x0 = ox - 26, x1 = this.x + 26;
      for (const o of this.obs) {
        if (o.done || o.lane !== lane) continue;
        if (o.x + o.w / 2 < x0 || o.x - o.w / 2 > x1) continue;
        // Player overlaps this obstacle horizontally this frame.
        switch (o.kind) {
          case 'cell':
            if (Math.abs(this.h + 30 - o.y) < 50) {
              o.done = true;
              this.cells++;
              this.scrap += 2 * this.st.scrapMult;
              G.audio.play('scrap');
              if (!this.bonusDone && this.cells >= this.m.bonus.count) {
                this.bonusDone = true;
                G.audio.play('cache');
                G.radio.say('harrow', 'That is enough cells. Bonus objective complete!', 3, true);
              }
            }
            break;
          case 'repair':
            if (this.h < 60) {
              o.done = true;
              this.v.heal(this.v.maxHull * 0.3);
              G.audio.play('pickup');
              G.popups.add(PX, this.groundY() - 100, '+HULL', '#6fe39a', 16);
            }
            break;
          case 'ramp':
            if (this.h < 10) {
              this.vh = JUMP_V * 1.35;
              this.h = 1;
              G.audio.play('jump');
            }
            break;
          case 'low':
            if (this.h < 36) this.hit(o);
            break;
          case 'tall':
            this.hit(o);
            break;
          case 'bar':
            if (this.h + this.playerHeight() > 42) this.hit(o);
            break;
          case 'gap':
            if (this.h <= 0.5 && o.x - o.w / 2 + 20 < this.x && this.x < o.x + o.w / 2 - 10) this.fall(o);
            break;
        }
      }
    }

    hit(o) {
      if (this.v.invuln > 0) return;
      o.done = true;
      this.hits++;
      this.speed *= 0.6;
      const r = this.v.hit(20 * (0.9 + this.m.stage * 0.05), 1.0);
      this.fx.burst(PX + 30, this.groundY() - 40, '#ffb347', 16, 260, 22);
      G.audio.play('boom');
      if (r === 'dead') this.die();
    }
    fall() {
      if (this.v.invuln > 0) return;
      this.hits++;
      // Bounce the rider back up out of the pit, at a cost.
      this.vh = JUMP_V * 0.9;
      this.h = 1;
      this.speed *= 0.7;
      const r = this.v.hit(26, 1.0);
      this.fx.burst(PX, this.groundY(), '#ff4d5e', 12, 200, 20);
      G.audio.play('hurt');
      if (r === 'dead') this.die();
    }
    die() {
      this.phase = 'dead';
      this.phaseT = 0;
      this.fx.burst(PX, this.groundY() - 40, '#ffb347', 40, 400, 36);
      G.audio.play('bigboom');
      G.shake(16);
      G.radio.say('harrow', 'We lost you in the tunnel! Pull out!', 3, true);
    }

    finish(success) {
      if (this.result) return;
      this.result = G.makeResult({
        success, bonus: this.bonusDone, kills: this.cells, enemies: Math.max(1, this.cellsTotal), damageTaken: this.v.damageTaken,
        maxHp: this.v.maxHull + this.v.maxShield, time: this.t, scrap: Math.round(this.scrap + (success ? 40 : 0)), caches: this.caches,
      });
    }

    // ---------- Drawing ----------
    draw(ctx) {
      const W = G.W, H = G.H;
      const cam = this.x;
      // Back wall
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b0a10');
      g.addColorStop(0.5, '#1b1820');
      g.addColorStop(1, '#0d0c12');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Far parallax: junk silhouettes
      ctx.fillStyle = '#231f2a';
      for (let i = -1; i < 12; i++) {
        const bx = i * 110 - ((cam * 0.15) % 110);
        const hh = 40 + ((i + Math.floor(cam * 0.15 / 110)) * 37 % 5) * 18;
        ctx.fillRect(bx, 300 - hh, 90, hh);
      }
      // Pipes
      ctx.fillStyle = '#2e2a35';
      ctx.fillRect(0, 210, W, 14);
      ctx.fillRect(0, 238, W, 6);
      for (let i = -1; i < 16; i++) {
        const bx = i * 80 - ((cam * 0.4) % 80);
        ctx.fillStyle = '#3a3542';
        ctx.fillRect(bx, 206, 10, 22);
      }
      // Ceiling with rushing lights
      ctx.fillStyle = '#121016';
      ctx.fillRect(0, 0, W, 120);
      for (let i = -1; i < 10; i++) {
        const lx = i * 140 - ((cam * 0.9) % 140);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.drawGlow(ctx, '#ffb347', lx, 118, 40, 0.5);
        ctx.restore();
        ctx.fillStyle = '#ffd37a';
        ctx.fillRect(lx - 16, 116, 32, 4);
      }
      // Floor strip
      ctx.fillStyle = '#2a2530';
      ctx.beginPath();
      ctx.moveTo(0, 304);
      ctx.lineTo(W, 304);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      for (let l = 0; l < 3; l++) {
        const y = LANE_Y[l];
        ctx.fillStyle = l % 2 ? '#332d3b' : '#2d2834';
        ctx.fillRect(0, y - 30 * LANE_S[l], W, 60 * LANE_S[l]);
        ctx.strokeStyle = 'rgba(255,179,71,0.25)';
        ctx.setLineDash([40, 40]);
        ctx.lineDashOffset = cam % 80;
        ctx.beginPath();
        ctx.moveTo(0, y + 30 * LANE_S[l]);
        ctx.lineTo(W, y + 30 * LANE_S[l]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Gaps (drawn into the floor)
      for (const o of this.obs) {
        if (o.kind !== 'gap') continue;
        const sx = o.x - cam + PX;
        if (sx < -300 || sx > W + 300) continue;
        const s = LANE_S[o.lane];
        const y = LANE_Y[o.lane];
        ctx.fillStyle = '#050407';
        ctx.fillRect(sx - o.w / 2, y - 30 * s, o.w, 60 * s);
        ctx.fillStyle = '#ff4d5e';
        ctx.fillRect(sx - o.w / 2, y - 30 * s, 4, 60 * s);
        ctx.fillRect(sx + o.w / 2 - 4, y - 30 * s, 4, 60 * s);
      }
      // Objects, far lane to near lane, with the player in its lane.
      const pl = Math.round(this.laneF);
      for (let l = 0; l < 3; l++) {
        for (const o of this.obs) {
          if (o.lane !== l || o.done || o.kind === 'gap') continue;
          const sx = o.x - cam + PX;
          if (sx < -120 || sx > W + 120) continue;
          this.drawObs(ctx, o, sx);
        }
        if (l === pl) this.drawPlayer(ctx);
      }
      this.fx.draw(ctx);
      // Speed streaks
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const n = Math.floor(this.speed / 80);
      for (let i = 0; i < n; i++) {
        const y = 130 + ((i * 97 + Math.floor(this.t * 30) * 13) % 380);
        const x = (i * 211 - cam * 2) % W;
        const xx = x < 0 ? x + W : x;
        ctx.moveTo(xx, y);
        ctx.lineTo(xx + this.speed * 0.08, y);
      }
      ctx.stroke();
      this.drawWarnings(ctx);
      this.drawHUD(ctx);
    }

    drawObs(ctx, o, sx) {
      const s = LANE_S[o.lane];
      const y = LANE_Y[o.lane];
      const top = (h, w, front, cap) => {
        ctx.fillStyle = front;
        ctx.fillRect(sx - w / 2, y - h * s, w, h * s);
        ctx.fillStyle = cap;
        ctx.beginPath();
        ctx.moveTo(sx - w / 2, y - h * s);
        ctx.lineTo(sx - w / 2 + 10 * s, y - h * s - 10 * s);
        ctx.lineTo(sx + w / 2 + 10 * s, y - h * s - 10 * s);
        ctx.lineTo(sx + w / 2, y - h * s);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(sx + w / 2, y);
        ctx.lineTo(sx + w / 2, y - h * s);
        ctx.lineTo(sx + w / 2 + 10 * s, y - h * s - 10 * s);
        ctx.lineTo(sx + w / 2 + 10 * s, y - 10 * s);
        ctx.fill();
      };
      switch (o.kind) {
        case 'tall':
          top(170, o.w * s, '#5a4f63', '#7a6d86');
          ctx.fillStyle = '#ff4d5e';
          ctx.fillRect(sx - o.w * s / 2 + 4, y - 150 * s, o.w * s - 8, 6);
          ctx.fillStyle = '#ffb347';
          for (let k = 0; k < 4; k++) ctx.fillRect(sx - o.w * s / 2, y - (30 + k * 34) * s, o.w * s, 4);
          break;
        case 'low':
          top(32, o.w * s, '#7a5a3a', '#9c7650');
          ctx.fillStyle = '#ffb347';
          ctx.fillRect(sx - o.w * s / 2, y - 22 * s, o.w * s, 5);
          break;
        case 'bar': {
          const bh = 44 * s;
          ctx.fillStyle = '#3a3542';
          ctx.fillRect(sx - 4, y - 150 * s, 8, 150 * s - bh - 12 * s);
          ctx.fillStyle = '#c9a227';
          ctx.fillRect(sx - o.w * s / 2, y - bh - 16 * s, o.w * s, 16 * s);
          ctx.fillStyle = '#2b2b30';
          for (let k = 0; k < 4; k++) ctx.fillRect(sx - o.w * s / 2 + k * o.w * s / 4, y - bh - 16 * s, o.w * s / 8, 16 * s);
          break;
        }
        case 'ramp':
          ctx.fillStyle = '#5fd4ff';
          ctx.beginPath();
          ctx.moveTo(sx - o.w * s / 2, y);
          ctx.lineTo(sx + o.w * s / 2, y - 30 * s);
          ctx.lineTo(sx + o.w * s / 2, y);
          ctx.fill();
          break;
        case 'cell': {
          const cy = y - o.y * s;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, '#5fd4ff', sx, cy, 18 * s, 0.9);
          ctx.restore();
          ctx.fillStyle = '#dff6ff';
          ctx.fillRect(sx - 5 * s, cy - 8 * s, 10 * s, 16 * s);
          break;
        }
        case 'repair':
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, '#6fe39a', sx, y - 26 * s, 22 * s, 0.9);
          ctx.restore();
          ctx.fillStyle = '#fff';
          ctx.fillRect(sx - 3 * s, y - 34 * s, 6 * s, 16 * s);
          ctx.fillRect(sx - 8 * s, y - 29 * s, 16 * s, 6 * s);
          break;
      }
    }

    drawPlayer(ctx) {
      if (this.phase === 'dead') return;
      if (this.v.invuln > 0 && Math.floor(this.t * 20) % 2 === 0) return;
      const s = this.scale();
      const gy = this.groundY();
      const y = gy - this.h * s;
      ctx.save();
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(PX, gy, 34 * s * (1 - Math.min(0.6, this.h / 200)), 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(PX, y);
      ctx.scale(s, s);
      ctx.rotate(this.vh ? -this.vh / 4000 : 0);
      const duck = this.duck && this.h < 1;
      // bike
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      G.drawGlow(ctx, '#5fd4ff', 0, -6, 34, 0.5);
      ctx.restore();
      ctx.fillStyle = this.v.flash > 0.2 ? '#fff' : '#e2e6ef';
      ctx.beginPath();
      ctx.moveTo(-38, -10);
      ctx.lineTo(30, -12);
      ctx.lineTo(44, -20);
      ctx.lineTo(10, -28);
      ctx.lineTo(-30, -24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2f6bff';
      ctx.fillRect(-30, -16, 50, 5);
      ctx.fillStyle = '#1d2129';
      ctx.fillRect(-40, -22, 10, 12);
      // rider
      ctx.fillStyle = '#3a4255';
      if (duck) {
        ctx.beginPath();
        ctx.ellipse(-4, -32, 18, 8, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e6ef';
        ctx.beginPath();
        ctx.arc(14, -34, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-14, -26);
        ctx.lineTo(2, -58);
        ctx.lineTo(12, -54);
        ctx.lineTo(6, -26);
        ctx.fill();
        ctx.fillStyle = '#e2e6ef';
        ctx.beginPath();
        ctx.arc(8, -64, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb347';
        ctx.fillRect(9, -67, 8, 4);
      }
      ctx.restore();
    }

    // Short flashing hints for what is coming up in the player's lane.
    drawWarnings(ctx) {
      if (this.phase !== 'play') return;
      const lane = this.lane;
      let hint = null;
      for (const o of this.obs) {
        if (o.done || o.lane !== lane) continue;
        const dx = o.x - this.x;
        if (dx < 40 || dx > this.speed * 0.95) continue;
        if (o.kind === 'low' || o.kind === 'gap') hint = '▲ JUMP';
        else if (o.kind === 'bar') hint = '▼ DUCK';
        else if (o.kind === 'tall') hint = '◆ CHANGE LANE';
        if (hint) break;
      }
      if (hint && Math.floor(this.t * 8) % 2 === 0) G.text(ctx, hint, PX + 150, this.groundY() - 110, { size: 20, color: '#ffd37a' });
    }

    drawHUD(ctx) {
      G.hud.vitals(ctx, this.v);
      G.hud.scoreBox(ctx, this.scrap, `CELLS ${this.cells}/${this.cellsTotal}`);
      G.hud.objective(ctx, this.m.bonus.text, Math.min(this.cells, this.m.bonus.count), this.m.bonus.count, this.bonusDone);
      const x = G.W / 2 - 200, y = 58, w = 400;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y, w, 4);
      for (let k = 1; k < 4; k++) ctx.fillRect(x + (w * k) / 4 - 1, y - 3, 2, 10);
      ctx.fillStyle = '#5fd4ff';
      ctx.fillRect(x, y, w * U.clamp(this.x / this.length, 0, 1), 4);
      G.text(ctx, `${Math.round(this.speed / 4)} KM/H`, 24, G.H - 20, { size: 18, color: '#ffffff' });
      G.text(ctx, 'UP/DOWN lane · FIRE jump · DODGE duck', G.W - 16, G.H - 14, { size: 12, align: 'right', color: '#7f8db0', outline: false });
      G.popups.draw(ctx);
      G.radio.draw(ctx);
      G.hud.titleCard(ctx, this.m, this.t);
      if (this.phase === 'outro') G.hud.banner(ctx, 'MISSION COMPLETE', '#ffd37a');
      if (this.phase === 'dead') G.hud.banner(ctx, 'WIPED OUT', '#ff6b5e');
      G.input.drawTouch(ctx);
    }
  }

  G.modes = G.modes || {};
  G.modes.gauntlet = (mission, stats) => new Gauntlet(mission, stats);
})();
