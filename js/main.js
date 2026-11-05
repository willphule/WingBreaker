// Main loop, screen sizing, mission flow and reward calculation.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const I = G.input;

  G.canvas = document.getElementById('game');
  G.ctx = G.canvas.getContext('2d');
  G.time = 0;
  G.dt = 0.016;
  G.state = 'menu';
  G.mode = null;
  G.mission = null;
  G.inGameplay = () => G.state === 'mission';

  function resize() {
    const wrap = document.getElementById('wrap');
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / G.W, vh / G.H);
    const cw = Math.floor(G.W * scale), ch = Math.floor(G.H * scale);
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    G.pxScale = Math.min(scale * dpr, 2.2);
    G.canvas.width = Math.round(G.W * G.pxScale);
    G.canvas.height = Math.round(G.H * G.pxScale);
    document.getElementById('ui').style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', resize);

  // ---------- Mission flow ----------
  G.startMission = function (id) {
    const m = G.campaign.byId(id);
    const s = G.save.data;
    const st = G.gear.stats(s);
    G.mission = m;
    G.popups.clear();
    G.radio.clear();
    G.mode = G.modes[m.mode](m, st);
    G.state = 'mission';
    G.ui.hide();
    s.progress.lastMission = id;
    G.save.write();
    I.consume();
    G.shakeAmt = 0;
  };
  G.pause = function () {
    if (G.state !== 'mission') return;
    G.state = 'paused';
    G.audio.muffle(1);
    G.ui.pause(G.mission);
  };
  G.resume = function () {
    G.ui.hide();
    G.state = 'mission';
    G.audio.muffle(0);
    I.consume();
  };
  G.abandon = function () {
    const m = G.mission;
    G.state = 'menu';
    G.mode = null;
    G.radio.clear();
    G.audio.muffle(0);
    G.ui.map(m && m.id);
  };

  function rankOf(res) {
    if (!res.success) return { rank: 'D', score: 0 };
    const killR = U.clamp(res.kills / Math.max(1, res.enemies), 0, 1);
    const dmgR = U.clamp(res.damageTaken / Math.max(1, res.maxHp) / 1.5, 0, 1);
    const score = 0.45 * killR + 0.35 * (1 - dmgR) + 0.2 * (res.bonus ? 1 : 0);
    const rank = score >= 0.85 ? 'S' : score >= 0.7 ? 'A' : score >= 0.55 ? 'B' : score >= 0.4 ? 'C' : 'D';
    return { rank, score };
  }
  const RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];

  function rewards(m, res) {
    const s = G.save.data;
    const C = G.campaign;
    const st = G.gear.stats(s);
    const { rank } = rankOf(res);
    const firstClear = res.success && !s.progress.cleared[m.id];
    let scrap = res.scrap;
    if (res.success) scrap += Math.round((60 + 25 * m.stage + { S: 120, A: 80, B: 40, C: 20, D: 0 }[rank]) * st.scrapMult);
    else scrap = Math.round(scrap * 0.5);
    const luck = ({ S: 1.2, A: 0.8, B: 0.4 }[rank] || 0) + (res.bonus ? 0.5 : 0) + 0.1 * m.stage;
    const rankPow = { S: 3, A: 2, B: 1, C: 0, D: 0 }[rank];
    let n = 0;
    if (res.success) n = 1 + (rank === 'S' || rank === 'A' ? 1 : 0) + (res.bonus ? 1 : 0) + (firstClear ? 1 : 0);
    const items = [];
    for (let i = 0; i < n; i++) items.push(G.gear.roll(s, m.power + rankPow, luck));
    for (let i = 0; i < res.caches; i++) items.push(G.gear.roll(s, m.power + rankPow + 1, luck + 1));
    // Keep the inventory to 40 by salvaging the weakest spare gear.
    let note = '';
    let salvaged = 0;
    while (s.inventory.length + items.length > 40) {
      const spare = s.inventory.filter((i) => !G.gear.isEquipped(s, i)).sort((a, b) => a.power - b.power || a.rarity - b.rarity)[0];
      if (!spare) break;
      scrap += G.gear.dismantleValue(spare);
      s.inventory = s.inventory.filter((i) => i !== spare);
      salvaged++;
    }
    if (salvaged) note = `Inventory full: ${salvaged} weak item${salvaged > 1 ? 's were' : ' was'} salvaged for scrap.`;
    for (const it of items) s.inventory.push(it);
    s.scrap += scrap;

    const before = new Set(C.missions.filter((x) => C.available(s, x)).map((x) => x.id));
    if (res.success) {
      s.progress.cleared[m.id] = true;
      if (res.bonus) s.progress.bonus[m.id] = true;
      const prev = s.progress.best[m.id];
      if (!prev || RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(prev)) s.progress.best[m.id] = rank;
    }
    const unlocks = C.missions.filter((x) => C.available(s, x) && !before.has(x.id)).map((x) => x.name);
    s.stats.missions++;
    if (m.mode !== 'gauntlet') s.stats.kills += res.kills;
    if (res.bestChain) s.stats.bestChain = Math.max(s.stats.bestChain || 0, res.bestChain);
    if (!res.success) s.stats.deaths++;
    let ending = false;
    if (m.id === 'crownfall' && res.success && !s.progress.campaignDone) {
      s.progress.campaignDone = true;
      ending = true;
    }
    G.save.write();
    return { rank, scrap, items, unlocks, note, ending };
  }

  function endMission(res) {
    const m = G.mission;
    G.state = 'menu';
    G.mode = null;
    G.radio.clear();
    G.audio.muffle(0);
    const rw = rewards(m, res);
    G.lastResult = { res, rw };
    G.ui.results(m, res, rw);
  }

  // ---------- Menu backdrop: starfield and the hero ship ----------
  const stars = Array.from({ length: 160 }, () => ({ x: U.rand(-60, 60), y: U.rand(-40, 40), z: U.rand(1, 120) }));
  function drawMenu(ctx, dt) {
    const g = ctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, '#05060f');
    g.addColorStop(0.6, '#0d1028');
    g.addColorStop(1, '#1a1030');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.W, G.H);
    G.drawGlow(ctx, '#3b2a6e', G.W * 0.75, G.H * 0.35, 380, 0.35);
    G.drawGlow(ctx, '#ff8c2a', G.W * 0.15, G.H * 0.95, 300, 0.15);
    const V = { F: 420, cx: G.W / 2, cy: G.H / 2, camX: 0, camY: 0, fogColor: [13, 16, 40], fogStart: 60, fogEnd: 120 };
    for (const s of stars) {
      s.z -= dt * 14;
      if (s.z < 1) {
        s.z = 120;
        s.x = U.rand(-60, 60);
        s.y = U.rand(-40, 40);
      }
      const p = G.r3d.project(V, s.x, s.y, s.z);
      if (!p) continue;
      const a = U.clamp(1 - s.z / 120, 0.1, 1);
      ctx.fillStyle = `rgba(220,225,255,${a})`;
      ctx.fillRect(p.x, p.y, Math.max(1, 2.2 - s.z / 50), Math.max(1, 2.2 - s.z / 50));
    }
    const scene = G.menuScene;
    if (scene === 'title' || scene === 'results') {
      const t = G.time;
      const sx = scene === 'title' ? 4.2 : 5.4;
      G.r3d.drawModel(ctx, V, G.models.ship, sx, -0.4 + Math.sin(t * 1.3) * 0.25, 12, 0.25 + Math.sin(t * 0.7) * 0.08, 2.5 + t * 0.35, Math.sin(t * 0.9) * 0.25, 1.15);
    }
  }

  // ---------- Loop ----------
  let last = performance.now();
  G.toggleMute = function () {
    const st = G.save.data.settings;
    st.muted = !st.muted;
    G.audio.setMuted(st.muted);
    G.save.write();
    G.popups.add(G.W / 2, 90, st.muted ? 'SOUND OFF' : 'SOUND ON', '#aab6d6', 14, 1);
  };
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = U.clamp((now - last) / 1000, 0, 0.05);
    last = now;
    try {
      step(dt);
    } catch (e) {
      // Log and keep the loop alive rather than freezing the game.
      console.error(e);
    }
  }
  function step(dt) {
    G.dt = dt;
    G.time += dt;
    I.update(dt);

    if (G.state === 'mission') {
      if (I.pressed('pause')) G.pause();
      else {
        G.mode.update(dt);
        if (G.mode.result) endMission(G.mode.result);
      }
    } else G.ui.update();

    const ctx = G.ctx;
    ctx.setTransform(G.pxScale, 0, 0, G.pxScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (G.mode && (G.state === 'mission' || G.state === 'paused')) {
      ctx.save();
      if (G.shakeAmt > 0.2 && G.state === 'mission') ctx.translate(U.rand(-1, 1) * G.shakeAmt, U.rand(-1, 1) * G.shakeAmt);
      G.mode.draw(ctx);
      ctx.restore();
      if (G.state === 'paused') {
        ctx.fillStyle = 'rgba(4,6,14,0.6)';
        ctx.fillRect(0, 0, G.W, G.H);
      }
    } else drawMenu(ctx, dt);
    G.shakeAmt *= Math.exp(-9 * dt);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'mission') G.pause();
  });

  // ---------- Boot ----------
  resize();
  G.save.load();
  const st = G.save.data.settings;
  G.audio.setVolumes(st.music, st.sfx);
  G.audio.setMuted(st.muted);
  const q = new URLSearchParams(location.search);
  const direct = q.get('mission') || (location.hash.startsWith('#play-') ? location.hash.slice(6) : null);
  if (direct && G.campaign.byId(direct)) G.startMission(direct);
  else G.ui.title();
  requestAnimationFrame(frame);
  // Exposed for automated checks.
  G.debug = { rewards, rankOf };
})();
