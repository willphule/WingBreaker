// Shared namespace, math helpers, color helpers and sprite caches.
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.W = 960;
  G.H = 540;
  G.FONT = "'Oxanium', 'Barlow Semi Condensed', system-ui, sans-serif";
  G.BODY_FONT = "'Barlow Semi Condensed', system-ui, sans-serif";

  const U = (G.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    sign: (v) => (v < 0 ? -1 : 1),
    approach: (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t)),
    // Frame-rate independent smoothing of a toward b.
    damp: (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt),
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    angDiff: (a, b) => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    weighted: (list) => {
      // list: [[item, weight], ...]
      let total = 0;
      for (const [, w] of list) total += w;
      let r = Math.random() * total;
      for (const [item, w] of list) {
        r -= w;
        if (r <= 0) return item;
      }
      return list[list.length - 1][0];
    },
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    hex: (h) => {
      h = h.replace('#', '');
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    rgb: (c, f = 1, a) => {
      const r = Math.max(0, Math.min(255, c[0] * f)) | 0;
      const g = Math.max(0, Math.min(255, c[1] * f)) | 0;
      const b = Math.max(0, Math.min(255, c[2] * f)) | 0;
      return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
    },
    mix: (c1, c2, t) => [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t],
    fmt: (n) => Math.round(n).toLocaleString('en-US'),
    timeStr: (s) => {
      s = Math.max(0, s);
      const m = Math.floor(s / 60);
      const r = Math.floor(s % 60);
      return `${m}:${r < 10 ? '0' : ''}${r}`;
    },
  });

  // Pre-rendered radial glow sprites, keyed by color. Drawn with 'lighter' for bolts and blasts.
  const glowCache = {};
  G.glow = function (color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const rgb = U.hex(color);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, U.rgb(U.mix(rgb, [255, 255, 255], 0.5), 1, 0.95));
    grd.addColorStop(0.45, U.rgb(rgb, 1, 0.45));
    grd.addColorStop(1, U.rgb(rgb, 1, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    glowCache[color] = c;
    return c;
  };

  // Soft cloud puff sprite for storm levels and smoke.
  let puff = null;
  G.puff = function () {
    if (puff) return puff;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 64 + (Math.random() - 0.5) * 50;
      const y = 64 + (Math.random() - 0.5) * 30;
      const r = 26 + Math.random() * 22;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    puff = c;
    return c;
  };

  G.drawGlow = function (ctx, color, x, y, r, alpha = 1) {
    if (r < 0.5) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(G.glow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  };

  // Text with a dark outline so it reads over any background.
  G.text = function (ctx, str, x, y, opts = {}) {
    ctx.font = `${opts.weight || 700} ${opts.size || 16}px ${opts.font || G.FONT}`;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.base || 'alphabetic';
    if (opts.outline !== false) {
      ctx.lineWidth = opts.lw || 4;
      ctx.strokeStyle = opts.stroke || 'rgba(4,6,14,0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = opts.color || '#e9eeff';
    ctx.fillText(str, x, y);
  };
})();
