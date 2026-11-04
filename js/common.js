// Shared gameplay pieces: shield/hull model, HUD widgets, radio chatter, popups and 2D particles.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;

  // ---------- Screen shake ----------
  G.shakeAmt = 0;
  G.shake = function (amt) {
    if (G.save && G.save.data && !G.save.data.settings.shake) return;
    G.shakeAmt = Math.min(22, Math.max(G.shakeAmt, amt));
  };

  // ---------- Shield + hull (recharging shield over non-regenerating hull) ----------
  class Vitals {
    constructor(stats, mission) {
      this.maxHull = stats.hull;
      this.hull = stats.hull;
      this.maxShield = stats.shield;
      this.shield = stats.shield;
      this.delay = stats.shieldDelay;
      this.rate = stats.shieldRate;
      this.perks = stats.perks;
      this.sinceHit = 99;
      this.invuln = 0;
      this.flash = 0;
      this.shieldFlash = 0;
      this.phoenixUsed = false;
      this.overdriveCD = 0;
      this.damageTaken = 0;
      this.hits = 0;
      this.recharging = false;
      const gap = mission.power - stats.power;
      this.dmgIn = U.clamp(1 + gap * 0.035, 0.6, 1.9);
    }
    get dead() {
      return this.hull <= 0;
    }
    hit(amount, invuln = 0.12) {
      if (this.invuln > 0 || this.hull <= 0) return 'blocked';
      let amt = amount * this.dmgIn;
      this.damageTaken += amt;
      this.hits++;
      this.sinceHit = 0;
      this.recharging = false;
      this.invuln = invuln;
      if (this.shield > 0) {
        const a = Math.min(this.shield, amt);
        this.shield -= a;
        amt -= a;
        this.shieldFlash = 0.3;
        G.audio.play('shieldHit');
        if (this.shield <= 0.01) {
          this.shield = 0;
          G.audio.play('shieldDown');
        }
      }
      if (amt > 0) {
        this.hull -= amt;
        this.flash = 0.35;
        G.audio.play('hurt');
        G.shake(7);
      } else {
        G.shake(3);
      }
      if (this.perks.has('overdrive') && this.hull > 0 && this.hull < this.maxHull * 0.3 && this.overdriveCD <= 0) {
        this.shield = this.maxShield;
        this.overdriveCD = 20;
        G.audio.play('shieldUp');
        G.popups.add(G.W / 2, G.H / 2 + 60, 'OVERDRIVE', '#5fd4ff', 18);
      }
      if (this.hull <= 0) {
        if (this.perks.has('phoenix') && !this.phoenixUsed) {
          this.phoenixUsed = true;
          this.hull = this.maxHull * 0.35;
          this.invuln = 2;
          G.audio.play('shieldUp');
          G.popups.add(G.W / 2, G.H / 2 + 60, 'PHOENIX PROTOCOL', '#ffb547', 20);
          return 'phoenix';
        }
        this.hull = 0;
        return 'dead';
      }
      return 'hit';
    }
    heal(n) {
      this.hull = Math.min(this.maxHull, this.hull + n);
    }
    addShield(n) {
      this.shield = Math.min(this.maxShield, this.shield + n);
    }
    update(dt) {
      this.sinceHit += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.flash = Math.max(0, this.flash - dt);
      this.shieldFlash = Math.max(0, this.shieldFlash - dt);
      this.overdriveCD = Math.max(0, this.overdriveCD - dt);
      if (this.hull > 0 && this.sinceHit > this.delay && this.shield < this.maxShield) {
        if (!this.recharging) {
          this.recharging = true;
          G.audio.play('shieldUp');
        }
        this.shield = Math.min(this.maxShield, this.shield + this.rate * dt);
      }
    }
  }
  G.Vitals = Vitals;

  // ---------- Popups (floating numbers / labels in screen space) ----------
  G.popups = {
    list: [],
    add(x, y, text, color = '#fff', size = 14, life = 0.8) {
      if (this.list.length > 60) this.list.shift();
      this.list.push({ x, y, text, color, size, life, max: life });
    },
    clear() {
      this.list.length = 0;
    },
    update(dt) {
      for (const p of this.list) {
        p.life -= dt;
        p.y -= 30 * dt;
      }
      this.list = this.list.filter((p) => p.life > 0);
    },
    draw(ctx) {
      for (const p of this.list) {
        ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
        G.text(ctx, p.text, p.x, p.y, { size: p.size, align: 'center', color: p.color, lw: 3 });
      }
      ctx.globalAlpha = 1;
    },
  };

  // ---------- Radio chatter ----------
  const CAST = {
    harrow: { name: 'Cmdr. Harrow', color: '#ffb347', skin: '#c99a76', hair: '#d8d8d8', style: 'beret' },
    vesk: { name: 'Vesk', color: '#ff6b5e', skin: '#8f6a52', hair: '#1c1c22', style: 'mohawk' },
    juno: { name: 'Juno', color: '#5fd4ff', skin: '#e6bf9c', hair: '#ff8fb8', style: 'bob' },
    crown: { name: 'Crown Regent', color: '#c77dff', skin: '#9da3b8', hair: '#2a2338', style: 'crown' },
    veyra: { name: 'Veyra Solace', color: '#e0b0ff', skin: '#d9b8a0', hair: '#f1ecf7', style: 'bob' },
    lantern: { name: 'Capt. Oduya, Lantern', color: '#9fe6b4', skin: '#6b4a35', hair: '#1c1c22', style: 'beret' },
    ops: { name: 'Dock Ops', color: '#9fe6b4', skin: '#b08968', hair: '#3a2c22', style: 'headset' },
  };
  G.radio = {
    cur: null,
    queue: [],
    say(who, text, dur = 3.6, urgent = false) {
      const m = { who, text, dur, t: 0 };
      if (urgent) {
        this.cur = m;
        G.audio.play('radio');
      } else if (!this.cur) {
        this.cur = m;
        G.audio.play('radio');
      } else if (this.queue.length < 3) this.queue.push(m);
    },
    clear() {
      this.cur = null;
      this.queue.length = 0;
      this.top = false;
    },
    update(dt) {
      if (!this.cur) return;
      this.cur.t += dt;
      if (this.cur.t > this.cur.dur) {
        this.cur = this.queue.shift() || null;
        if (this.cur) G.audio.play('radio');
      }
    },
    draw(ctx) {
      const m = this.cur;
      if (!m) return;
      const c = CAST[m.who] || CAST.harrow;
      const a = Math.min(1, m.t * 6, (m.dur - m.t) * 4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      const x = 14, y = this.top ? 66 : G.H - 92, w = 380, h = 74;
      ctx.fillStyle = 'rgba(6,10,22,0.82)';
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w - 14, y);
      ctx.lineTo(x + w, y + 14);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      drawPortrait(ctx, c, x + 9, y + 9, 56, m.t);
      G.text(ctx, c.name.toUpperCase(), x + 76, y + 22, { size: 12, color: c.color, outline: false });
      const shown = m.text.slice(0, Math.floor(m.t * 70));
      wrapText(ctx, shown, x + 76, y + 40, w - 88, 16, { size: 14, font: G.BODY_FONT, weight: 500, color: '#e6ecff' });
      ctx.restore();
    },
  };

  function drawPortrait(ctx, c, x, y, s, t) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, s, s);
    ctx.clip();
    ctx.fillStyle = U.rgb(U.hex(c.color), 0.35);
    ctx.fillRect(x, y, s, s);
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < s; i += 3) ctx.fillRect(x, y + i, s, 1);
    const cx = x + s / 2;
    // shoulders
    ctx.fillStyle = '#2b3550';
    ctx.beginPath();
    ctx.ellipse(cx, y + s + 6, s * 0.48, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.ellipse(cx, y + s * 0.5, s * 0.22, s * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.hair;
    if (c.style === 'beret') {
      ctx.beginPath();
      ctx.ellipse(cx - 3, y + s * 0.27, s * 0.27, s * 0.1, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(cx + 6, y + s * 0.24, 4, 4);
    } else if (c.style === 'mohawk') {
      ctx.fillRect(cx - 3, y + s * 0.12, 6, s * 0.2);
    } else if (c.style === 'bob') {
      ctx.beginPath();
      ctx.ellipse(cx, y + s * 0.38, s * 0.26, s * 0.2, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - s * 0.26, y + s * 0.38, 6, s * 0.22);
      ctx.fillRect(cx + s * 0.26 - 6, y + s * 0.38, 6, s * 0.22);
    } else if (c.style === 'crown') {
      ctx.fillStyle = '#c77dff';
      ctx.beginPath();
      ctx.moveTo(cx - 14, y + s * 0.3);
      for (let i = 0; i <= 4; i++) {
        ctx.lineTo(cx - 14 + i * 7, y + s * (i % 2 ? 0.2 : 0.08));
      }
      ctx.lineTo(cx + 14, y + s * 0.3);
      ctx.fill();
    } else if (c.style === 'headset') {
      ctx.fillRect(cx - s * 0.22, y + s * 0.3, s * 0.44, 5);
      ctx.fillStyle = '#9fe6b4';
      ctx.fillRect(cx + s * 0.18, y + s * 0.45, 6, 8);
    }
    // eyes, blinking
    const blink = Math.sin(t * 3.1) > 0.97;
    ctx.fillStyle = '#11131c';
    if (!blink) {
      ctx.fillRect(cx - 7, y + s * 0.48, 4, 3);
      ctx.fillRect(cx + 3, y + s * 0.48, 4, 3);
    }
    // mouth moves while talking
    const open = (Math.sin(t * 22) + 1) * 1.5;
    ctx.fillRect(cx - 4, y + s * 0.63, 8, 1 + open);
    ctx.restore();
    ctx.strokeStyle = c.color;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }

  function wrapText(ctx, str, x, y, maxW, lh, opts) {
    ctx.font = `${opts.weight || 500} ${opts.size}px ${opts.font || G.BODY_FONT}`;
    const words = str.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        G.text(ctx, line, x, yy, Object.assign({ outline: false }, opts));
        line = w;
        yy += lh;
      } else line = test;
    }
    if (line) G.text(ctx, line, x, yy, Object.assign({ outline: false }, opts));
  }
  G.wrapText = wrapText;

  // ---------- HUD widgets ----------
  const HUD = (G.hud = {});

  HUD.bar = function (ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,0.08)', segs = 0) {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * U.clamp(frac, 0, 1), h);
    if (segs) {
      ctx.fillStyle = 'rgba(4,6,14,0.7)';
      for (let i = 1; i < segs; i++) ctx.fillRect(x + (w * i) / segs - 1, y, 2, h);
    }
  };

  HUD.vitals = function (ctx, v) {
    const x = 16, y = 14;
    const sf = v.shield / Math.max(1, v.maxShield);
    const hf = v.hull / Math.max(1, v.maxHull);
    ctx.save();
    ctx.fillStyle = 'rgba(6,10,22,0.6)';
    ctx.fillRect(x - 8, y - 6, 276, 38);
    // Shield bar, Halo-style segmented, flashes when broken.
    const broken = v.shield <= 0;
    const sCol = broken ? (Math.floor(G.time * 6) % 2 ? '#ff4d5e' : 'rgba(255,77,94,0.3)') : v.shieldFlash > 0 ? '#ffffff' : '#5fd4ff';
    G.text(ctx, 'SHIELD', x, y + 10, { size: 10, color: '#8fb9d9', outline: false });
    HUD.bar(ctx, x + 52, y + 1, 200, 11, broken ? 1 : sf, broken ? sCol : sCol, 'rgba(95,212,255,0.1)', 10);
    G.text(ctx, 'HULL', x, y + 27, { size: 10, color: '#d9b08f', outline: false });
    const hCol = hf < 0.3 ? (Math.floor(G.time * 4) % 2 ? '#ff4d5e' : '#ff8a4d') : '#ffb347';
    HUD.bar(ctx, x + 52, y + 18, 200, 8, hf, hCol, 'rgba(255,179,71,0.1)');
    ctx.restore();
    if (v.flash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${v.flash * 0.5})`;
      ctx.fillRect(0, 0, G.W, G.H);
    }
    if (hf < 0.3 && v.hull > 0) {
      const a = 0.15 + Math.sin(G.time * 5) * 0.08;
      const grd = ctx.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.35, G.W / 2, G.H / 2, G.H * 0.85);
      grd.addColorStop(0, 'rgba(255,0,0,0)');
      grd.addColorStop(1, `rgba(255,0,30,${a})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, G.W, G.H);
    }
  };

  HUD.scoreBox = function (ctx, scrap, extra) {
    G.text(ctx, '◆ ' + U.fmt(scrap), G.W - 16, 28, { size: 16, align: 'right', color: '#ffd37a' });
    if (extra) G.text(ctx, extra, G.W - 16, 48, { size: 12, align: 'right', color: '#aab6d6' });
  };

  HUD.objective = function (ctx, text, have, need, done) {
    const label = done ? `✓ ${text}` : `${text}  ${have}/${need}`;
    G.text(ctx, 'BONUS', G.W / 2, 20, { size: 10, align: 'center', color: done ? '#6fe39a' : '#ffd37a', outline: false });
    G.text(ctx, label, G.W / 2, 38, { size: 14, align: 'center', color: done ? '#6fe39a' : '#ffffff' });
  };

  HUD.bossBar = function (ctx, name, frac, shielded) {
    const w = 420, x = (G.W - w) / 2, y = 52;
    G.text(ctx, name, G.W / 2, y + 2, { size: 13, align: 'center', color: '#ff8a8a' });
    HUD.bar(ctx, x, y + 8, w, 8, frac, shielded ? '#8f7dff' : '#ff4d5e', 'rgba(255,77,94,0.12)');
  };

  HUD.ammo = function (ctx, label, ammo, max, cdFrac) {
    const x = G.W - 16, y = G.H - 20;
    ctx.fillStyle = 'rgba(6,10,22,0.6)';
    ctx.fillRect(x - 200, y - (cdFrac !== undefined ? 70 : 36), 208, cdFrac !== undefined ? 80 : 46);
    G.text(ctx, label, x, y - 18, { size: 11, align: 'right', color: '#aab6d6', outline: false });
    const n = Math.min(max, 20);
    for (let i = 0; i < n; i++) {
      const filled = i < ammo * (n / max);
      ctx.fillStyle = filled ? '#ffb347' : 'rgba(255,179,71,0.15)';
      ctx.fillRect(x - (i + 1) * 9, y - 10, 6, 10);
    }
    if (cdFrac !== undefined) {
      ctx.strokeStyle = cdFrac >= 1 ? '#5fd4ff' : 'rgba(95,212,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x - 14, y - 50, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * U.clamp(cdFrac, 0, 1));
      ctx.stroke();
      G.text(ctx, 'DODGE', x - 32, y - 46, { size: 10, align: 'right', color: cdFrac >= 1 ? '#5fd4ff' : '#5a6b8c', outline: false });
    }
  };

  HUD.titleCard = function (ctx, mission, t) {
    if (t > 4) return;
    const a = Math.min(1, t * 2, (4 - t) * 1.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(4,6,14,0.55)';
    ctx.fillRect(0, G.H * 0.36, G.W, 104);
    G.text(ctx, `${mission.stage === 6 ? 'EPILOGUE' : 'STAGE ' + mission.stage}  ·  ${G.campaign.modeName[mission.mode].toUpperCase()}`, G.W / 2, G.H * 0.36 + 28, { size: 13, align: 'center', color: '#ffb347', outline: false });
    G.text(ctx, mission.name.toUpperCase(), G.W / 2, G.H * 0.36 + 66, { size: 38, weight: 800, align: 'center', color: '#ffffff', outline: false });
    G.text(ctx, 'BONUS: ' + mission.bonus.text, G.W / 2, G.H * 0.36 + 90, { size: 14, align: 'center', color: '#ffd37a', outline: false });
    ctx.restore();
  };

  HUD.banner = function (ctx, text, color = '#ffffff', sub) {
    G.text(ctx, text, G.W / 2, G.H / 2 - 10, { size: 40, weight: 800, align: 'center', color, lw: 6 });
    if (sub) G.text(ctx, sub, G.W / 2, G.H / 2 + 22, { size: 16, align: 'center', color: '#dfe6ff' });
  };

  // ---------- 2D particles for the screen-space modes ----------
  class Particles2D {
    constructor() {
      this.list = [];
    }
    add(p) {
      if (this.list.length > 500) this.list.shift();
      p.life = p.life || 0.6;
      p.max = p.life;
      p.vx = p.vx || 0;
      p.vy = p.vy || 0;
      p.grav = p.grav || 0;
      p.drag = p.drag === undefined ? 1 : p.drag;
      p.size = p.size || 4;
      this.list.push(p);
    }
    burst(x, y, color, n = 14, speed = 220, size = 18, life = 0.5) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.7), size: size * (0.5 + Math.random() * 0.6), color, glow: true, drag: 0.9 });
      }
      for (let i = 0; i < n / 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.5 + Math.random());
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.7, size: 3, color: '#2a2a33', grav: 500, drag: 0.98 });
      }
    }
    update(dt) {
      for (const p of this.list) {
        p.life -= dt;
        p.vy += p.grav * dt;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      this.list = this.list.filter((p) => p.life > 0);
    }
    draw(ctx, ox = 0, oy = 0) {
      ctx.save();
      for (const p of this.list) {
        const f = p.life / p.max;
        if (p.glow) {
          ctx.globalCompositeOperation = 'lighter';
          G.drawGlow(ctx, p.color, p.x - ox, p.y - oy, p.size * (0.4 + f * 0.6), Math.min(1, f * 1.5));
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, f * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - ox - p.size / 2, p.y - oy - p.size / 2, p.size, p.size);
        }
      }
      ctx.restore();
    }
  }
  G.Particles2D = Particles2D;

  // Builds the shared result payload each mode hands back when it ends.
  G.makeResult = function (o) {
    return Object.assign({ success: false, bonus: false, kills: 0, enemies: 1, damageTaken: 0, maxHp: 1, time: 0, scrap: 0, caches: 0 }, o);
  };
})();
