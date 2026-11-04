// A tiny flat-shaded polygon renderer and the low-poly models used by the flight levels.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;

  const NEAR = 0.9;
  const LIGHT = (() => {
    const l = [-0.45, 0.8, -0.4];
    const n = Math.hypot(...l);
    return l.map((x) => x / n);
  })();

  class MB {
    constructor() {
      this.v = [];
      this.f = [];
    }
    vert(x, y, z) {
      this.v.push([x, y, z]);
      return this.v.length - 1;
    }
    face(idx, color, e) {
      this.f.push({ i: idx, c: typeof color === 'string' ? U.hex(color) : color, e: !!e });
    }
    poly(pts, color, e) {
      this.face(pts.map((p) => this.vert(p[0], p[1], p[2])), color, e);
    }
    box(cx, cy, cz, w, h, d, color, e) {
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      const b = this.v.length;
      [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].forEach((p) => this.v.push(p));
      const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
      for (const f of F) this.face(f.map((i) => i + b), color, e);
      return this;
    }
    // Vertical prism/frustum: n sides, radius r1 at base (y=cy) and r2 at top (y=cy+h).
    prism(cx, cy, cz, n, r1, r2, h, color, jitter = 0, colors, e) {
      const b = this.v.length;
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.PI / n;
          const r = (k ? r2 : r1) * (1 + (Math.random() - 0.5) * jitter);
          this.v.push([cx + Math.cos(a) * r, cy + (k ? h : 0) + (k ? (Math.random() - 0.5) * jitter * h * 0.3 : 0), cz + Math.sin(a) * r]);
        }
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const c = colors ? colors[i % colors.length] : color;
        this.face([b + i, b + j, b + n + j, b + n + i], c, e);
      }
      const top = [];
      for (let i = n - 1; i >= 0; i--) top.push(b + n + i);
      this.face(top, color, e);
      return this;
    }
    build() {
      return { v: this.v, f: this.f };
    }
  }

  function icosa(r, jitter, colors) {
    const t = (1 + Math.sqrt(5)) / 2;
    const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const n = Math.hypot(1, t);
    const m = new MB();
    for (const v of V) {
      const k = (r / n) * (1 + (Math.random() - 0.5) * jitter);
      m.v.push([v[0] * k, v[1] * k, v[2] * k]);
    }
    F.forEach((f, i) => m.face(f, colors[i % colors.length]));
    return m;
  }

  function octa(r, colors, e) {
    const m = new MB();
    [[0, r, 0], [0, -r, 0], [r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r]].forEach((p) => m.v.push(p));
    const F = [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]];
    F.forEach((f, i) => m.face(f, colors[i % colors.length], e && i % 2 === 0));
    return m;
  }

  // ---------- Renderer ----------
  const r3d = (G.r3d = { MB, NEAR });

  r3d.project = function (V, x, y, z) {
    if (z <= NEAR) return null;
    const s = V.F / z;
    return { x: V.cx + (x - V.camX) * s, y: V.cy - (y - V.camY) * s, s };
  };

  const faceBuf = [];
  r3d.drawModel = function (ctx, V, M, px, py, pz, rx, ry, rz, sc, opts) {
    const v = M.v;
    const n = v.length;
    if (!M._w) {
      M._w = new Float32Array(n * 3);
      M._s = new Float32Array(n * 2);
    }
    const W = M._w, S = M._s;
    const cz = Math.cos(rz), sz = Math.sin(rz), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
    for (let i = 0; i < n; i++) {
      const x = v[i][0] * sc, y = v[i][1] * sc, z = v[i][2] * sc;
      const x1 = x * cz - y * sz, y1 = x * sz + y * cz;
      const y2 = y1 * cx - z * sx, z2 = y1 * sx + z * cx;
      const x3 = x1 * cy + z2 * sy, z3 = -x1 * sy + z2 * cy;
      const X = x3 + px, Y = y2 + py, Z = z3 + pz;
      W[i * 3] = X;
      W[i * 3 + 1] = Y;
      W[i * 3 + 2] = Z;
      if (Z > NEAR) {
        const s = V.F / Z;
        S[i * 2] = V.cx + (X - V.camX) * s;
        S[i * 2 + 1] = V.cy - (Y - V.camY) * s;
      }
    }
    const fog = V.fogColor;
    const flash = opts && opts.flash;
    const tint = opts && opts.tint;
    const alpha = opts && opts.alpha;
    let count = 0;
    for (const f of M.f) {
      const idx = f.i;
      let zsum = 0, ok = true;
      for (let k = 0; k < idx.length; k++) {
        const Z = W[idx[k] * 3 + 2];
        if (Z <= NEAR) { ok = false; break; }
        zsum += Z;
      }
      if (!ok) continue;
      const a = idx[0] * 3, b = idx[1] * 3, c = idx[2] * 3;
      const ux = W[b] - W[a], uy = W[b + 1] - W[a + 1], uz = W[b + 2] - W[a + 2];
      const wx = W[c] - W[a], wy = W[c + 1] - W[a + 1], wz = W[c + 2] - W[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const vx = W[a] - V.camX, vy = W[a + 1] - V.camY, vz = W[a + 2];
      if (nx * vx + ny * vy + nz * vz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      const l = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl;
      const br = f.e ? 1.05 : 0.42 + 0.62 * Math.max(0, l) + 0.08 * Math.max(0, -nz / nl);
      const zavg = zsum / idx.length;
      let col = f.c;
      if (tint && !f.e) col = U.mix(col, tint, 0.45);
      let r = col[0] * br, g = col[1] * br, bl = col[2] * br;
      const fogT = f.e ? U.clamp((zavg - V.fogStart) / (V.fogEnd - V.fogStart), 0, 1) * 0.6 : U.clamp((zavg - V.fogStart) / (V.fogEnd - V.fogStart), 0, 1);
      r += (fog[0] - r) * fogT;
      g += (fog[1] - g) * fogT;
      bl += (fog[2] - bl) * fogT;
      if (flash) {
        r += (255 - r) * flash;
        g += (255 - g) * flash;
        bl += (255 - bl) * flash;
      }
      let fb = faceBuf[count];
      if (!fb) fb = faceBuf[count] = {};
      fb.z = zavg;
      fb.idx = idx;
      fb.col = `rgb(${r | 0},${g | 0},${bl | 0})`;
      count++;
    }
    const list = faceBuf.slice(0, count).sort((p, q) => q.z - p.z);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.8;
    for (const fb of list) {
      const idx = fb.idx;
      ctx.beginPath();
      ctx.moveTo(S[idx[0] * 2], S[idx[0] * 2 + 1]);
      for (let k = 1; k < idx.length; k++) ctx.lineTo(S[idx[k] * 2], S[idx[k] * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = fb.col;
      ctx.strokeStyle = fb.col;
      ctx.fill();
      ctx.stroke();
    }
    if (alpha !== undefined) ctx.globalAlpha = 1;
  };

  // ---------- Model library ----------
  const L = (G.models = {});

  L.ship = (() => {
    const b = new MB();
    const hull = '#e2e6ef', under = '#7d8799', accent = '#2f6bff', fin = '#ff8c2a';
    const N = [0, 0.05, 2.6];
    const mT = [0, 0.5, 0.3], mR = [0.55, 0, 0.3], mB = [0, -0.35, 0.3], mL = [-0.55, 0, 0.3];
    const tT = [0, 0.4, -1.3], tR = [0.45, 0, -1.3], tB = [0, -0.25, -1.3], tL = [-0.45, 0, -1.3];
    b.poly([N, mT, mR], hull); b.poly([N, mR, mB], under); b.poly([N, mB, mL], under); b.poly([N, mL, mT], hull);
    b.poly([mT, tT, tR, mR], hull); b.poly([mR, tR, tB, mB], under); b.poly([mB, tB, tL, mL], under); b.poly([mL, tL, tT, mT], hull);
    b.poly([tT, tR, tB, tL], '#3a3f4d');
    b.poly([[0, 0.74, -0.25], [0.24, 0.43, 0.35], [0, 0.4, 1.25]], '#7fe4ff', true);
    b.poly([[0, 0.74, -0.25], [0, 0.4, 1.25], [-0.24, 0.43, 0.35]], '#3fb4e8', true);
    for (const s of [1, -1]) {
      b.poly([[0.5 * s, 0, 0.5], [2.5 * s, -0.25, -0.8], [2.7 * s, -0.25, -1.45], [0.45 * s, 0, -1.25]], accent);
      b.poly([[2.5 * s, -0.25, -0.8], [2.7 * s, -0.25, -1.45], [2.78 * s, 0.55, -1.6]], fin);
      b.box(1.2 * s, -0.12, 0.3, 0.22, 0.22, 1.6, '#4b5263');
    }
    b.poly([[0, 0.42, -0.5], [0, 0.4, -1.3], [0, 1.15, -1.6]], fin);
    return b.build();
  })();

  L.dart = (() => {
    const b = new MB();
    const body = '#3d2d44', wing = '#d23a48';
    const N = [0, 0, 1.8], Lf = [-0.45, 0, 0], R = [0.45, 0, 0], T = [0, 0.4, -0.2], B = [0, -0.3, -0.2], Tl = [0, 0, -1.1];
    b.poly([N, T, R], body); b.poly([N, R, B], body); b.poly([N, B, Lf], body); b.poly([N, Lf, T], body);
    b.poly([Tl, R, T], '#2a1f30'); b.poly([Tl, B, R], '#2a1f30'); b.poly([Tl, Lf, B], '#2a1f30'); b.poly([Tl, T, Lf], '#2a1f30');
    for (const s of [1, -1]) b.poly([[0.35 * s, 0, -0.4], [1.9 * s, 0.35, 0.75], [1.7 * s, 0.35, -0.9]], wing);
    b.poly([[-0.16, 0.12, 1.15], [0.16, 0.12, 1.15], [0, 0.24, 0.7]], '#ffdd55', true);
    return b.build();
  })();

  L.drone = (() => {
    const m = octa(0.95, ['#8b5cf6', '#4b2f9a']);
    m.poly([[-1.7, 0, -0.35], [1.7, 0, -0.35], [1.7, 0, 0.35], [-1.7, 0, 0.35]], '#2b2440');
    m.box(0, 0, 0.9, 0.5, 0.5, 0.2, '#ff5af0', true);
    return m.build();
  })();

  L.gunship = (() => {
    const b = new MB();
    b.box(0, 0, 0, 2.6, 1.1, 3.4, '#5b6474');
    b.box(0, 0.65, 0.8, 1.2, 0.5, 1.3, '#9aa4b8');
    b.box(0, -0.1, -0.3, 6.4, 0.25, 1.7, '#3f4756');
    for (const s of [1, -1]) {
      b.box(3.2 * s, 0, -0.3, 0.8, 0.8, 2.2, '#2c313c');
      b.box(1.1 * s, -0.55, 1.6, 0.3, 0.3, 1.5, '#1d2129');
      b.box(3.2 * s, 0, -1.45, 0.5, 0.5, 0.1, '#ff9b3d', true);
    }
    b.box(0, 0.15, 1.72, 1.4, 0.25, 0.1, '#ff4d5e', true);
    return b.build();
  })();

  L.turret = (() => {
    const b = new MB();
    b.prism(0, 0, 0, 6, 1.2, 0.85, 0.8, '#59606e');
    b.box(0, 1.15, 0, 1.2, 0.7, 1.2, '#7a2f36');
    b.box(-0.25, 1.15, 0.95, 0.2, 0.2, 1.7, '#1d2129');
    b.box(0.25, 1.15, 0.95, 0.2, 0.2, 1.7, '#1d2129');
    b.box(0, 1.35, 0.62, 0.6, 0.15, 0.05, '#ff4d5e', true);
    return b.build();
  })();

  L.mine = (() => {
    const m = octa(0.75, ['#ff3344', '#3b1820'], true);
    m.box(0, 0, 0, 1.9, 0.18, 0.18, '#3b1820');
    m.box(0, 0, 0, 0.18, 1.9, 0.18, '#3b1820');
    return m.build();
  })();

  L.pylon = (() => {
    const b = new MB();
    b.prism(0, 0, 0, 4, 1.6, 1.1, 5, '#5c6475');
    b.prism(0, 5, 0, 4, 1.1, 0.7, 5, '#6c7486', 0, ['#6c7486', '#a33a44']);
    b.box(0, 10.4, 0, 1.4, 0.8, 1.4, '#ff4d5e', true);
    b.box(0, 11.3, 0, 3.2, 0.2, 0.3, '#8e97a8');
    b.box(0, 11.3, 0, 0.3, 0.2, 3.2, '#8e97a8');
    return b.build();
  })();

  L.rocks = [0, 1, 2].map(() => {
    const b = new MB();
    const cols = ['#a0583a', '#8a4a30', '#b56a46', '#7a3f2a'];
    b.prism(0, 0, 0, 6, 1.6 + Math.random() * 0.8, 0.9 + Math.random() * 0.6, 14 + Math.random() * 6, '#9a5436', 0.35, cols);
    return b.build();
  });

  L.arch = (() => {
    const b = new MB();
    const cols = ['#a0583a', '#8a4a30', '#b56a46', '#7a3f2a'];
    b.prism(-6.5, 0, 0, 6, 2.2, 1.8, 13, '#9a5436', 0.15, cols);
    b.prism(6.5, 0, 0, 6, 2.2, 1.8, 13, '#9a5436', 0.15, cols);
    b.box(0, 14, 0, 17, 3, 3.6, '#8a4a30');
    return b.build();
  })();

  L.rockWall = (() => {
    const b = new MB();
    b.box(0, 0, 0, 1, 1, 1, '#8a4a30');
    return b.build();
  })();

  L.asteroids = [0, 1, 2].map(() => icosa(1, 0.45, ['#6e6a66', '#57534f', '#7f776f', '#4a4542']).build());

  L.girder = (() => {
    const b = new MB();
    const n = 10, w = 44;
    for (let i = 0; i < n; i++) b.box(-w / 2 + (i + 0.5) * (w / n), 0, 0, w / n, 1.1, 1.3, i % 2 ? '#d9a521' : '#2b2b30');
    return b.build();
  })();

  L.post = (() => {
    const b = new MB();
    b.box(0, 0, 0, 1.2, 1.2, 1.2, '#3b4250');
    b.box(0, 0, 0.62, 0.6, 0.6, 0.05, '#ff4d5e', true);
    return b.build();
  })();

  L.conduit = (() => {
    const b = new MB();
    b.prism(0, -3, 0, 6, 0.9, 0.9, 6, '#30455e');
    b.prism(0, -1.2, 0, 6, 1.05, 1.05, 0.5, '#5fd4ff', 0, null, true);
    b.prism(0, 1.0, 0, 6, 1.05, 1.05, 0.5, '#5fd4ff', 0, null, true);
    return b.build();
  })();

  L.frigate = (() => {
    const b = new MB();
    b.box(0, 0, 0, 3.4, 2.2, 15, '#4a4f63');
    b.box(0, 1.6, -3, 1.8, 1.4, 3.5, '#5d6378');
    b.box(0, -0.2, 7.8, 2.2, 1.2, 1.2, '#363a4a');
    for (const s of [1, -1]) {
      b.box(2.4 * s, 0, -2, 1.4, 1.4, 8, '#3a3e50');
      b.box(2.4 * s, 0, -6.1, 1.0, 1.0, 0.2, '#c77dff', true);
      b.box(1.75 * s, 0.4, 3, 0.1, 0.3, 6, '#c77dff', true);
    }
    return b.build();
  })();

  L.cargo = (() => {
    const b = new MB();
    b.box(0, 0, 0, 2, 2, 2, '#4f6a4a');
    b.box(0, 0, 0, 2.1, 0.4, 2.1, '#ffd37a', true);
    return b.build();
  })();

  // ---------- Boss parts ----------
  L.crawlerBody = (() => {
    const b = new MB();
    b.box(0, 0, 0, 12, 3.6, 9, '#7b6a55');
    b.box(0, 2.4, -0.5, 7, 1.4, 6, '#8d7c66');
    for (const s of [1, -1]) {
      b.box(7.2 * s, -1.6, 0, 2.6, 2.6, 11, '#3a332b');
      b.box(7.2 * s, -1.6, 5.6, 2.2, 1.8, 0.3, '#ff9b3d', true);
    }
    return b.build();
  })();
  L.cannonPod = (() => {
    const b = new MB();
    b.box(0, 0, 0, 2.8, 2, 3.6, '#6a5a48');
    b.box(-0.6, 0, 2.6, 0.5, 0.5, 2.6, '#1d1a17');
    b.box(0.6, 0, 2.6, 0.5, 0.5, 2.6, '#1d1a17');
    b.box(0, 0.6, 1.85, 1.6, 0.3, 0.1, '#ff4d5e', true);
    return b.build();
  })();
  L.rack = (() => {
    const b = new MB();
    b.box(0, 0, 0, 4.4, 1.6, 3, '#57483a');
    for (let i = 0; i < 4; i++) b.box(-1.5 + i, 0.2, 1.55, 0.6, 0.6, 0.1, '#ffb347', true);
    return b.build();
  })();
  L.core = (() => {
    const b = new MB();
    b.prism(0, -1.2, 0, 8, 1.6, 1.6, 2.4, '#ff3344', 0, ['#ff3344', '#ff7a5a'], true);
    return b.build();
  })();
  L.coreBlue = (() => {
    const b = new MB();
    b.prism(0, -1.4, 0, 8, 2, 2, 2.8, '#5fd4ff', 0, ['#5fd4ff', '#a6ecff'], true);
    return b.build();
  })();
  L.tempestBody = icosa(4.2, 0.15, ['#4a5878', '#3a4766', '#5a6a8e', '#2e3854']).build();
  L.coil = (() => {
    const b = new MB();
    b.box(0, 0, 0, 1.2, 1.2, 1.2, '#2e3854');
    b.prism(0, -1.6, 0, 6, 0.8, 0.5, 3.2, '#5fd4ff', 0, ['#5fd4ff', '#2e86b8'], true);
    return b.build();
  })();
  L.arm = (() => {
    const b = new MB();
    b.box(0, 0, 0, 1, 1, 1, '#3a4766');
    return b.build();
  })();
  L.gateFrame = (() => {
    const b = new MB();
    b.box(0, 7.5, 0, 30, 3, 3, '#3b4250');
    b.box(0, -7.5, 0, 30, 3, 3, '#3b4250');
    b.box(-13.5, 0, 0, 3, 12, 3, '#4a5262');
    b.box(13.5, 0, 0, 3, 12, 3, '#4a5262');
    b.box(0, 7.5, 1.55, 24, 0.4, 0.1, '#ffb347', true);
    b.box(0, -7.5, 1.55, 24, 0.4, 0.1, '#ffb347', true);
    return b.build();
  })();
  L.bigTurret = (() => {
    const b = new MB();
    b.box(0, 0, 0, 3, 3, 2.5, '#5a3a40');
    b.box(0, 0, 2, 0.6, 0.6, 2.8, '#1d2129');
    b.box(0, 0.9, 1.3, 2, 0.4, 0.1, '#ff4d5e', true);
    return b.build();
  })();
  L.crownHull = (() => {
    const b = new MB();
    b.box(0, 0, 0, 26, 5, 18, '#3c3650');
    b.box(0, 3.5, -2, 16, 2.4, 12, '#4a4363');
    b.box(0, -3.2, 0, 18, 1.6, 14, '#2c273c');
    for (let i = -2; i <= 2; i++) b.prism(i * 3.6, 4.6, 2, 4, 1.1, 0.15, 4 + (2 - Math.abs(i)) * 1.8, '#c77dff', 0, ['#c77dff', '#7d4cb0']);
    for (const s of [1, -1]) b.box(10 * s, 0, 9.05, 4, 1, 0.1, '#c77dff', true);
    return b.build();
  })();
  L.battery = (() => {
    const b = new MB();
    b.box(0, 0, 0, 4, 2.6, 4, '#4f4866');
    for (let i = 0; i < 3; i++) b.box(-1.2 + i * 1.2, 0, 2.6, 0.4, 0.4, 2, '#18151f');
    b.box(0, 1.0, 2.05, 3, 0.3, 0.1, '#ff4d5e', true);
    return b.build();
  })();
  L.spire = (() => {
    const b = new MB();
    b.prism(0, 0, 0, 5, 1.4, 0.4, 6, '#5e5679', 0, ['#5e5679', '#c77dff']);
    b.box(0, 6.2, 0, 1, 1, 1, '#ff5af0', true);
    return b.build();
  })();
})();
