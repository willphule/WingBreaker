// Keyboard, mouse, gamepad and touch input, merged into named actions.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;

  const KEYMAP = {
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    fire: ['Space', 'KeyJ', 'KeyZ'],
    alt: ['KeyK', 'KeyX', 'KeyB'],
    dodge: ['ShiftLeft', 'ShiftRight', 'KeyL', 'KeyC'],
    special: ['KeyQ', 'KeyE', 'KeyV'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter', 'Space'],
    back: ['Escape', 'Backspace'],
  };
  const ACTIONS = Object.keys(KEYMAP);
  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Backspace', 'Tab']);

  const I = (G.input = {
    keys: {},
    tapped: {},
    cur: {},
    prev: {},
    held: {},
    ax: 0,
    ay: 0,
    mouse: { x: G.W / 2, y: G.H / 2, down: false, active: false, lastMove: -10 },
    touchMode: false,
    device: 'kb',
    touch: { stickId: null, sx: 0, sy: 0, x: 0, y: 0, buttons: {} },
  });

  const isTyping = (e) => {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  };

  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    I.keys[e.code] = true;
    I.tapped[e.code] = true;
    if (e.code === 'KeyM' && !e.repeat && G.toggleMute) G.toggleMute();
    I.device = 'kb';
    if (PREVENT.has(e.code)) e.preventDefault();
    if (G.audio) G.audio.unlock();
  });
  window.addEventListener('keyup', (e) => {
    I.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    I.keys = {};
  });

  // Converts a client point to logical 960x540 coordinates.
  I.toLogical = function (cx, cy) {
    const r = G.canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * G.W, y: ((cy - r.top) / r.height) * G.H };
  };

  window.addEventListener('mousemove', (e) => {
    if (!G.canvas) return;
    const p = I.toLogical(e.clientX, e.clientY);
    I.mouse.x = p.x;
    I.mouse.y = p.y;
    I.mouse.lastMove = G.time || 0;
    I.mouse.active = true;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target === G.canvas) I.mouse.down = true;
    if (G.audio) G.audio.unlock();
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) I.mouse.down = false;
  });

  // ---- Touch: left half is a floating stick, right side has buttons ----
  const BTN = {
    fire: { x: 862, y: 440, r: 58, label: 'FIRE' },
    alt: { x: 748, y: 478, r: 40, label: 'ALT' },
    dodge: { x: 868, y: 310, r: 40, label: 'DODGE' },
    special: { x: 754, y: 374, r: 34, label: 'BREAK', only: 'hasBreak' },
    pause: { x: 928, y: 30, r: 22, label: 'II' },
  };
  I.touchButtons = BTN;

  function touchPoint(t) {
    return I.toLogical(t.clientX, t.clientY);
  }
  function handleTouches(e) {
    if (!G.inGameplay || !G.inGameplay()) return;
    e.preventDefault();
    I.touchMode = true;
    I.device = 'touch';
    if (G.audio) G.audio.unlock();
    const T = I.touch;
    const seen = new Set();
    T.buttons = {};
    for (const t of e.touches) {
      const p = touchPoint(t);
      seen.add(t.identifier);
      let onButton = false;
      for (const k in BTN) {
        const b = BTN[k];
        if (b.only && !(G.mode && G.mode[b.only])) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 14) {
          T.buttons[k] = true;
          onButton = true;
        }
      }
      if (onButton) continue;
      if (T.stickId === null && p.x < G.W * 0.55) {
        T.stickId = t.identifier;
        T.sx = p.x;
        T.sy = p.y;
      }
      if (t.identifier === T.stickId) {
        T.x = p.x;
        T.y = p.y;
      }
    }
    if (T.stickId !== null && !seen.has(T.stickId)) T.stickId = null;
  }
  window.addEventListener('touchstart', handleTouches, { passive: false });
  window.addEventListener('touchmove', handleTouches, { passive: false });
  window.addEventListener('touchend', handleTouches, { passive: false });
  window.addEventListener('touchcancel', handleTouches, { passive: false });

  let lastGp = null;
  I.update = function (dt) {
    for (const a of ACTIONS) I.prev[a] = I.cur[a];
    const now = {};
    for (const a of ACTIONS) {
      let v = false;
      for (const k of KEYMAP[a]) if (I.keys[k] || I.tapped[k]) v = true;
      now[a] = v;
    }
    I.tapped = {};
    let ax = (now.right ? 1 : 0) - (now.left ? 1 : 0);
    let ay = (now.down ? 1 : 0) - (now.up ? 1 : 0);

    // Gamepad (standard mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (gp) {
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const sx = Math.abs(gp.axes[0]) > 0.2 ? gp.axes[0] : 0;
      const sy = Math.abs(gp.axes[1]) > 0.2 ? gp.axes[1] : 0;
      const any = sx || sy || gp.buttons.some((x) => x.pressed);
      if (any) I.device = 'pad';
      if (sx) ax = sx;
      if (sy) ay = sy;
      if (b(14)) ax = -1;
      if (b(15)) ax = 1;
      if (b(12)) ay = -1;
      if (b(13)) ay = 1;
      if (b(0) || b(7)) now.fire = true;
      if (b(2) || b(6)) now.alt = true;
      if (b(4) || b(5) || b(1)) now.dodge = true;
      if (b(3)) now.special = true;
      if (b(9)) now.pause = true;
      if (b(0)) now.confirm = true;
      if (b(1)) now.back = true;
      if (sx < -0.5 || b(14)) now.left = true;
      if (sx > 0.5 || b(15)) now.right = true;
      if (sy < -0.5 || b(12)) now.up = true;
      if (sy > 0.5 || b(13)) now.down = true;
    }
    I.rx = 0;
    I.ry = 0;
    if (gp && gp.axes.length >= 4) {
      const rx = gp.axes[2], ry = gp.axes[3];
      if (Math.hypot(rx, ry) > 0.3) { I.rx = rx; I.ry = ry; }
    }
    lastGp = gp;

    // Touch
    const T = I.touch;
    if (I.touchMode && G.inGameplay && G.inGameplay()) {
      if (T.stickId !== null) {
        const dx = (T.x - T.sx) / 55;
        const dy = (T.y - T.sy) / 55;
        ax = U.clamp(dx, -1, 1);
        ay = U.clamp(dy, -1, 1);
        if (dx < -0.5) now.left = true;
        if (dx > 0.5) now.right = true;
        if (dy < -0.5) now.up = true;
        if (dy > 0.5) now.down = true;
      }
      if (T.buttons.fire) now.fire = true;
      if (T.buttons.alt) now.alt = true;
      if (T.buttons.dodge) now.dodge = true;
      if (T.buttons.special) now.special = true;
      if (T.buttons.pause) now.pause = true;
    }
    if (I.mouse.down && G.inGameplay && G.inGameplay()) now.fire = true;

    const len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; }
    I.ax = ax;
    I.ay = ay;
    for (const a of ACTIONS) {
      I.cur[a] = now[a];
      I.held[a] = now[a] ? (I.held[a] || 0) + dt : 0;
    }
  };

  I.down = (a) => !!I.cur[a];
  I.pressed = (a) => !!I.cur[a] && !I.prev[a];
  // Pressed, then repeating while held (menu navigation).
  I.repeat = (a) => {
    if (I.pressed(a)) return true;
    const h = I.held[a] || 0;
    if (h > 0.38) {
      const step = 0.11;
      const prevH = h - (G.dt || 0.016);
      return Math.floor((h - 0.38) / step) !== Math.floor((prevH - 0.38) / step);
    }
    return false;
  };
  // Clears edge state so a held key from a menu doesn't fire on the next screen.
  I.consume = () => {
    for (const a of ACTIONS) I.prev[a] = true;
  };

  I.drawTouch = function (ctx) {
    if (!I.touchMode) return;
    const T = I.touch;
    ctx.save();
    if (T.stickId !== null) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(T.sx, T.sy, 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      const dx = U.clamp(T.x - T.sx, -55, 55);
      const dy = U.clamp(T.y - T.sy, -55, 55);
      ctx.arc(T.sx + dx, T.sy + dy, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const k in BTN) {
      const b = BTN[k];
      if (b.only && !(G.mode && G.mode[b.only])) continue;
      ctx.fillStyle = T.buttons[k] ? 'rgba(255,200,90,0.35)' : 'rgba(255,255,255,0.10)';
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      G.text(ctx, b.label, b.x, b.y + 5, { size: b.r > 30 ? 14 : 11, align: 'center', color: 'rgba(255,255,255,0.8)', outline: false });
    }
    ctx.restore();
  };
})();
