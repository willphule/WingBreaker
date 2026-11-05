// Menu screens as a DOM layer over the canvas: title, campaign map, hangar, results, pause, settings.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;
  const I = G.input;

  const root = () => document.getElementById('ui');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const UI = (G.ui = { active: false, onBack: null, screen: null });

  UI.show = function (name, html, onBack) {
    const r = root();
    r.innerHTML = `<div class="screen screen-${name}">${html}</div>`;
    r.style.display = 'block';
    UI.active = true;
    UI.screen = name;
    UI.onBack = onBack || null;
    r.querySelectorAll('.nav').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        if (document.activeElement !== el) {
          el.focus({ preventScroll: true });
        }
      });
      el.addEventListener('click', () => {
        if (!el.disabled) G.audio.play('select');
      });
    });
    const first = r.querySelector('[data-autofocus]') || r.querySelector('.nav:not([disabled])');
    if (first) first.focus({ preventScroll: true });
    I.consume();
  };
  UI.hide = function () {
    const r = root();
    r.innerHTML = '';
    r.style.display = 'none';
    UI.active = false;
    UI.screen = null;
  };

  // Keyboard/gamepad navigation across .nav elements by screen position.
  UI.update = function () {
    if (!UI.active) return;
    const r = root();
    const navs = [...r.querySelectorAll('.nav')].filter((e) => !e.disabled && e.offsetParent !== null);
    if (!navs.length) return;
    let cur = document.activeElement;
    if (!navs.includes(cur)) cur = null;
    const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    for (const [a, dx, dy] of dirs) {
      if (!I.repeat(a)) continue;
      if (cur && cur.type === 'range' && dx) {
        const step = parseFloat(cur.step || '0.1');
        cur.value = U.clamp(parseFloat(cur.value) + dx * step, parseFloat(cur.min), parseFloat(cur.max));
        cur.dispatchEvent(new Event('input'));
        continue;
      }
      if (!cur) {
        navs[0].focus();
        continue;
      }
      const cr = cur.getBoundingClientRect();
      const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      let best = null, bs = 1e9;
      for (const n of navs) {
        if (n === cur) continue;
        const nr = n.getBoundingClientRect();
        const nx = nr.left + nr.width / 2, ny = nr.top + nr.height / 2;
        const ddx = nx - cx, ddy = ny - cy;
        const along = ddx * dx + ddy * dy;
        if (along <= 2) continue;
        const perp = Math.abs(ddx * dy) + Math.abs(ddy * dx);
        const s = along + perp * 2.2;
        if (s < bs) {
          bs = s;
          best = n;
        }
      }
      if (best) {
        best.focus({ preventScroll: true });
        best.scrollIntoView({ block: 'nearest' });
        G.audio.play('menu');
        cur = best;
      }
    }
    if (I.pressed('confirm') && cur && !cur.disabled) {
      if (cur.type === 'checkbox') cur.click();
      else if (cur.type !== 'range') cur.click();
    }
    if (I.pressed('back') && UI.onBack) {
      G.audio.play('back');
      UI.onBack();
    }
  };

  const save = () => G.save.data;
  const rarityColor = (r) => G.gear.RARITY[r].color;
  const powerOf = () => G.gear.power(save());
  const icons = { flight: '✈', bike: '⇶', foot: '◉', gauntlet: '≋' };

  // ---------- Title ----------
  UI.title = function () {
    const s = save();
    const started = Object.keys(s.progress.cleared).length > 0;
    UI.show('title', `
      <div class="title-block">
        <div class="eyebrow">A Meridian Reach strike campaign</div>
        <h1 class="logo">WING<span>BREAKER</span></h1>
        <p class="tag">Fly the canyons, storms and stations of the Hollow Crown. Every mission changes the rules. Every bonus objective opens a new route.</p>
      </div>
      <div class="menu-col">
        <button class="nav btn primary" data-autofocus id="b-play">${started ? 'Continue Campaign' : 'Start Campaign'}</button>
        ${s.progress.cleared.canyon ? '<button class="nav btn" id="b-sortie">Endless Sortie</button>' : ''}
        <button class="nav btn" id="b-hangar">Hangar &amp; Loadout</button>
        <button class="nav btn" id="b-help">How to Play</button>
        <button class="nav btn" id="b-settings">Settings</button>
      </div>
      <div class="foot-note">Keyboard, gamepad or touch · ${G.save.available ? 'Progress saves on this device' : 'Storage is blocked, so progress will not be saved'}</div>
    `);
    document.getElementById('b-play').onclick = () => (s.seenIntro ? UI.map() : UI.intro());
    if (document.getElementById('b-sortie')) document.getElementById('b-sortie').onclick = () => UI.sortie();
    document.getElementById('b-hangar').onclick = () => UI.hangar(UI.title);
    document.getElementById('b-help').onclick = () => UI.help(UI.title);
    document.getElementById('b-settings').onclick = () => UI.settings(UI.title);
    G.audio.music('title');
    G.menuScene = 'title';
  };

  UI.intro = function () {
    UI.show('intro', `
      <div class="panel intro-panel">
        <div class="eyebrow">Transmission · Cmdr. Harrow</div>
        <h2>The Crown closed the sky.</h2>
        <p>Three months ago the Hollow Crown armada swept into the Meridian Reach and locked every lane behind a wall of storms, guns and stations. Our fleet is gone. What is left is one prototype interceptor and you, call sign <b>Wingbreaker</b>.</p>
        <p>We hit them in a chain of strikes. Fly what you have to fly. When your ship can't go somewhere, you take a bike or go in on foot. Hit every mission's <b class="gold">bonus objective</b> if you can. Each one opens a harder route with better salvage.</p>
        <p>Bring back loot from every run, then tune your ship in the hangar. Your <b>power</b> sets how hard you hit, and how hard they hit back.</p>
        <button class="nav btn primary" data-autofocus id="b-go">To the Campaign Map</button>
      </div>
    `, UI.title);
    document.getElementById('b-go').onclick = () => {
      save().seenIntro = true;
      G.save.write();
      UI.map();
    };
  };

  // ---------- Campaign map ----------
  UI.map = function (selectId) {
    const s = save();
    const C = G.campaign;
    const sel = C.byId(selectId || s.progress.lastMission || C.suggested(s).id) || C.suggested(s);
    const X = (st) => 50 + (st - 1) * 98;
    const Y = { A: 112, C: 200, B: 288 };
    const nodes = C.missions;
    let lines = '';
    for (const m of nodes) {
      for (const n of nodes) {
        if (n.stage !== m.stage + 1) continue;
        const upper = n.lane === 'A';
        const lit = s.progress.cleared[m.id] && (!upper || s.progress.bonus[m.id]);
        lines += `<line x1="${X(m.stage)}" y1="${Y[m.lane]}" x2="${X(n.stage)}" y2="${Y[n.lane]}" class="${upper ? 'up' : 'low'} ${lit ? 'lit' : ''}"/>`;
      }
    }
    let btns = '';
    for (const m of nodes) {
      const av = C.available(s, m);
      const cl = s.progress.cleared[m.id];
      const bo = s.progress.bonus[m.id];
      const best = s.progress.best[m.id];
      btns += `<button class="nav node ${av ? '' : 'locked'} ${cl ? 'cleared' : ''} ${m.id === sel.id ? 'sel' : ''} lane-${m.lane}" data-id="${m.id}" style="left:${X(m.stage)}px;top:${Y[m.lane]}px" aria-label="${esc(m.name)}">
        <span class="ico">${av ? icons[m.mode] : '🔒'}</span>
        <span class="nm">${esc(m.name)}</span>
        ${cl ? `<span class="badge">${best || '✓'}${bo ? ' ★' : ''}</span>` : ''}
      </button>`;
    }
    const av = C.available(s, sel);
    const pw = powerOf();
    const pcls = pw >= sel.power ? 'ok' : pw >= sel.power - 5 ? 'warn' : 'bad';
    const stages = [1, 2, 3, 4, 5, 6].map((n) => `<div class="stage-lbl" style="left:${X(n)}px">${n === 6 ? 'EPILOGUE' : 'STAGE ' + n}</div>`).join('');
    UI.show('map', `
      <header class="bar">
        <div><div class="eyebrow">Meridian Reach</div><h2>Campaign Map</h2></div>
        <div class="stats"><span>POWER <b>${pw}</b></span><span class="scrap">◆ ${U.fmt(s.scrap)}</span></div>
      </header>
      <div class="map-wrap">
        <div class="map-area">
          ${stages}
          <svg class="routes" width="600" height="360" viewBox="0 0 600 360">${lines}</svg>
          ${btns}
          <div class="legend"><span class="lg up"></span> Upper route opens with a bonus objective <span class="lg low"></span> Standard route</div>
        </div>
        <aside class="panel brief">
          <div class="eyebrow">${sel.stage === 6 ? 'Epilogue' : 'Stage ' + sel.stage} · ${C.modeName[sel.mode]}${sel.lane === 'A' ? ' · Upper route' : ''}</div>
          <h3>${esc(sel.name)}</h3>
          <div class="pw ${pcls}">Recommended power ${sel.power} · yours ${pw}</div>
          <p class="brief-text">${esc(sel.brief)}</p>
          <div class="bonus-line"><span>BONUS</span> ${esc(sel.bonus.text)}</div>
          ${s.progress.cleared[sel.id] ? `<div class="done-line">Cleared · best rank ${s.progress.best[sel.id] || '-'}${s.progress.bonus[sel.id] ? ' · bonus done' : ''}</div>` : ''}
          ${av ? `<button class="nav btn primary" id="b-launch" data-autofocus>Launch Mission</button>` : `<div class="lock-line">${esc(C.lockReason(s, sel))}</div>`}
        </aside>
      </div>
      <footer class="bar-bottom">
        <button class="nav btn small" id="b-back">◂ Title</button>
        <button class="nav btn small" id="b-hangar">Hangar &amp; Loadout</button>
      </footer>
    `, UI.title);
    root().querySelectorAll('.node').forEach((b) => {
      b.onclick = () => {
        UI.map(b.dataset.id);
        const nb = root().querySelector(`.node[data-id="${b.dataset.id}"]`);
        if (nb) nb.focus({ preventScroll: true });
      };
    });
    if (av) document.getElementById('b-launch').onclick = () => G.startMission(sel.id);
    document.getElementById('b-back').onclick = UI.title;
    document.getElementById('b-hangar').onclick = () => UI.hangar(() => UI.map(sel.id));
    G.audio.music('hangar');
    G.menuScene = 'map';
  };

  // ---------- Hangar ----------
  const hangarState = { tab: 'loadout', slot: 'primary', item: null };

  function itemCard(it, compareTo) {
    const g = G.gear;
    const a = g.ARCH[it.slot][it.arch];
    const R = g.RARITY[it.rarity];
    const stats = g.itemStats(it);
    const delta = compareTo && compareTo.id !== it.id ? it.power - compareTo.power : null;
    const perks = it.perks.map((p) => `<li><b>${esc(g.PERKS[p].name)}</b> ${esc(g.PERKS[p].desc)}</li>`).join('');
    const uq = g.uniqueInfo(it);
    return `
      <div class="card" style="--rc:${R.color}">
        <div class="card-top">
          <div><div class="rar">${R.name} ${g.SLOT_NAMES[it.slot]}</div><div class="iname">${esc(it.name)}</div><div class="arch">${esc(a.name)}</div></div>
          <div class="ipow">${it.power}${delta !== null ? `<small class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}</small>` : ''}</div>
        </div>
        <p class="adesc">${esc(a.desc)}</p>
        <dl>${stats.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${perks ? `<ul class="perks">${perks}</ul>` : ''}
        ${uq ? `<div class="unique"><b>${esc(uq.name)}</b> ${esc(uq.desc)}</div>` : ''}
      </div>`;
  }
  UI.itemCard = itemCard;

  UI.hangar = function (onBack) {
    UI._hangarBack = onBack || UI._hangarBack || UI.map;
    const s = save();
    const g = G.gear;
    const hs = hangarState;
    const pw = powerOf();
    let body = '';
    if (hs.tab === 'loadout') {
      const slots = g.SLOTS.map((sl) => {
        const it = g.equipped(s, sl);
        const fresh = s.inventory.some((i) => i.slot === sl && i.fresh);
        return `<button class="nav slot ${hs.slot === sl ? 'sel' : ''}" data-slot="${sl}" style="--rc:${rarityColor(it.rarity)}">
          <span class="sl">${g.SLOT_NAMES[sl]}${fresh ? ' <i class="new">NEW</i>' : ''}</span>
          <span class="sn">${esc(it.name)}</span>
          <span class="sp">${it.power}</span>
        </button>`;
      }).join('');
      const items = s.inventory.filter((i) => i.slot === hs.slot).sort((a, b) => b.power - a.power || b.rarity - a.rarity);
      const eq = g.equipped(s, hs.slot);
      if (!hs.item || !items.find((i) => i.id === hs.item)) hs.item = eq.id;
      const selIt = g.find(s, hs.item) || eq;
      const list = items.map((it) => `<button class="nav irow ${it.id === hs.item ? 'sel' : ''}" data-id="${it.id}" style="--rc:${rarityColor(it.rarity)}">
          <span class="in">${esc(it.name)}${it.fresh ? ' <i class="new">NEW</i>' : ''}</span>
          <span class="ia">${esc(g.ARCH[it.slot][it.arch].name)}</span>
          <span class="ip">${it.power}</span>${g.isEquipped(s, it) ? '<span class="eqd">EQUIPPED</span>' : ''}
        </button>`).join('');
      const isEq = g.isEquipped(s, selIt);
      body = `
        <div class="hg-grid">
          <div class="slots">${slots}</div>
          <div class="ilist">${list}</div>
          <div class="detail">
            ${itemCard(selIt, eq)}
            <div class="row">
              <button class="nav btn primary small" id="b-equip" ${isEq ? 'disabled' : ''}>${isEq ? 'Equipped' : 'Equip'}</button>
              <button class="nav btn small danger" id="b-dis" ${isEq ? 'disabled' : ''}>Dismantle +◆${g.dismantleValue(selIt)}</button>
            </div>
          </div>
        </div>`;
    } else {
      const ups = g.UPGRADES.map((u) => {
        const lv = s.upgrades[u.key];
        const maxed = lv >= u.max;
        const cost = maxed ? 0 : u.cost[lv];
        const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
        return `<div class="up-row">
          <div><div class="un">${esc(u.name)}</div><div class="ud">${esc(u.desc)}</div><div class="pips">${pips}</div></div>
          <button class="nav btn small ${maxed ? '' : 'primary'}" data-up="${u.key}" ${maxed || s.scrap < cost ? 'disabled' : ''}>${maxed ? 'Maxed' : `Install ◆${cost}`}</button>
        </div>`;
      }).join('');
      body = `<div class="ups"><p class="hint">Upgrades are permanent and each level adds +1 power.</p>${ups}</div>`;
    }
    UI.show('hangar', `
      <header class="bar">
        <div><div class="eyebrow">Interceptor "Wingbreaker"</div><h2>Hangar</h2></div>
        <div class="stats"><span>POWER <b>${pw}</b></span><span class="scrap">◆ ${U.fmt(s.scrap)}</span></div>
      </header>
      <div class="tabs">
        <button class="nav tab ${hs.tab === 'loadout' ? 'on' : ''}" id="t-load">Loadout</button>
        <button class="nav tab ${hs.tab === 'upgrades' ? 'on' : ''}" id="t-up">Upgrades</button>
      </div>
      ${body}
      <footer class="bar-bottom"><button class="nav btn small" id="b-back">◂ Back</button><button class="nav btn small" id="b-paint">Paint Shop</button><span class="hint">Inventory ${s.inventory.length}/40</span></footer>
    `, () => UI._hangarBack());
    const refocus = (sel) => {
      const el = root().querySelector(sel);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest' });
      }
    };
    document.getElementById('t-load').onclick = () => { hs.tab = 'loadout'; UI.hangar(); refocus('#t-load'); };
    document.getElementById('t-up').onclick = () => { hs.tab = 'upgrades'; UI.hangar(); refocus('#t-up'); };
    document.getElementById('b-back').onclick = () => UI._hangarBack();
    document.getElementById('b-paint').onclick = () => UI.paint();
    if (hs.tab === 'loadout') {
      root().querySelectorAll('.slot').forEach((b) => (b.onclick = () => { hs.slot = b.dataset.slot; hs.item = null; UI.hangar(); refocus(`.slot[data-slot="${hs.slot}"]`); }));
      root().querySelectorAll('.irow').forEach((b) => (b.onclick = () => {
        hs.item = +b.dataset.id;
        const it = g.find(s, hs.item);
        if (it && it.fresh) { it.fresh = false; G.save.write(); }
        UI.hangar();
        refocus(`.irow[data-id="${hs.item}"]`);
      }));
      const eqB = document.getElementById('b-equip');
      if (eqB) eqB.onclick = () => {
        const it = g.find(s, hs.item);
        if (!it) return;
        s.equipped[it.slot] = it.id;
        it.fresh = false;
        G.save.write();
        G.audio.play('upgrade');
        UI.hangar();
        refocus(`.irow[data-id="${hs.item}"]`);
      };
      const dB = document.getElementById('b-dis');
      if (dB) dB.onclick = () => {
        const it = g.find(s, hs.item);
        if (!it || g.isEquipped(s, it)) return;
        s.scrap += g.dismantleValue(it);
        s.inventory = s.inventory.filter((i) => i.id !== it.id);
        hs.item = null;
        G.save.write();
        G.audio.play('scrap');
        UI.hangar();
        refocus(`.slot[data-slot="${hs.slot}"]`);
      };
    } else {
      root().querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => {
        const u = g.UPGRADES.find((x) => x.key === b.dataset.up);
        const lv = s.upgrades[u.key];
        if (lv >= u.max || s.scrap < u.cost[lv]) return;
        s.scrap -= u.cost[lv];
        s.upgrades[u.key]++;
        G.save.write();
        G.audio.play('upgrade');
        UI.hangar();
        refocus(`[data-up="${u.key}"]`);
      }));
    }
    G.menuScene = 'hangar';
  };

  // ---------- Results ----------
  UI.results = function (mission, res, rw) {
    const cards = rw.items.map((it) => `<div class="mini-card" style="--rc:${rarityColor(it.rarity)}"><div class="rar">${G.gear.RARITY[it.rarity].name}</div><div class="iname">${esc(it.name)}</div><div class="arch">${esc(G.gear.ARCH[it.slot][it.arch].name)} · ${it.power}</div></div>`).join('');
    const rows = (mission.sortie ? [
      ['Score', `${U.fmt(res.score)}${rw.newBest ? ' <span class="gold">New best!</span>' : ''}`],
      ['Wave reached', res.wave],
      ['Enemies destroyed', res.kills],
      ['Best chain', `x${res.bestChain}`],
      ['Close calls', res.grazes],
      ['WINGBREAKs', res.breaks],
    ] : [
      ['Result', res.success ? 'Mission complete' : 'Mission failed'],
      [mission.mode === 'gauntlet' ? 'Power cells' : 'Enemies destroyed', `${res.kills} / ${res.enemies}`],
      ['Damage taken', Math.round(res.damageTaken)],
      ['Time', U.timeStr(res.time)],
      ['Bonus objective', res.bonus ? '<span class="gold">Complete</span>' : 'Missed'],
      ...(res.bestChain !== undefined ? [[mission.mode === 'gauntlet' ? 'Best streak' : 'Best chain', `x${res.bestChain}`]] : []),
      ...(res.grazes !== undefined ? [['Close calls', res.grazes], ['WINGBREAKs', res.breaks]] : []),
    ]).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    UI.show('results', `
      <div class="res-wrap">
        <div class="panel res-main">
          <div class="eyebrow">${esc(mission.name)} · ${mission.sortie ? 'Sortie over' : 'After-action report'}</div>
          <div class="res-head">
            <div class="rank rank-${rw.rank}">${res.success ? rw.rank : '✕'}</div>
            <dl class="res-stats">${rows}</dl>
          </div>
          ${rw.unlocks.length ? `<div class="unlock">Route opened: ${rw.unlocks.map(esc).join(', ')}</div>` : ''}
          ${rw.paints && rw.paints.length ? `<div class="unlock">Paint unlocked: ${rw.paints.map(esc).join(', ')}. Apply it in the hangar's Paint Shop.</div>` : ''}
          ${rw.note ? `<div class="hint">${esc(rw.note)}</div>` : ''}
        </div>
        <div class="panel res-loot">
          <div class="eyebrow">Salvage</div>
          <div class="scrap-big">◆ ${U.fmt(rw.scrap)}</div>
          ${cards ? `<div class="loot-grid">${cards}</div>` : '<p class="hint">No gear recovered.</p>'}
          ${rw.items.length ? '<p class="hint">New gear is waiting in the hangar.</p>' : ''}
        </div>
      </div>
      <footer class="bar-bottom">
        ${res.success && !mission.sortie ? '' : `<button class="nav btn small" id="b-retry">${mission.sortie ? 'Fly Again' : 'Retry Mission'}</button>`}
        ${rw.items.length ? '<button class="nav btn small" id="b-hangar">Open Hangar</button>' : ''}
        <button class="nav btn primary" id="b-cont" data-autofocus>Continue</button>
      </footer>
    `, () => document.getElementById('b-cont').click());
    const back = () => (mission.sortie ? UI.sortie() : UI.map(mission.id));
    const next = () => (rw.ending ? UI.ending() : back());
    document.getElementById('b-cont').onclick = next;
    const h = document.getElementById('b-hangar');
    if (h) h.onclick = () => UI.hangar(back);
    const r = document.getElementById('b-retry');
    if (r) r.onclick = () => G.startMission(again(mission));
    G.audio.music(res.success ? 'victory' : 'hangar');
    G.menuScene = 'results';
  };

  UI.ending = function () {
    UI.show('ending', `
      <div class="panel intro-panel">
        <div class="eyebrow">Transmission · Cmdr. Harrow</div>
        <h2>The Crown has fallen.</h2>
        <p>The dreadnought is breaking up over the Reach, and the storm walls are already thinning. The lanes are open. People are coming home.</p>
        <p>You did that, Wingbreaker. Every route you flew is still on the map. Go back for better salvage, chase the ranks you missed, and try the routes you didn't take.</p>
        <p>One more thing. Long-range scopes picked up a single Crown fighter slipping out of the wreckage, and it is broadcasting your call sign. <b class="gold">Ace of Crowns</b> is now open on the map.</p>
        <button class="nav btn primary" data-autofocus id="b-go">Back to the Map</button>
      </div>
    `, () => UI.map());
    document.getElementById('b-go').onclick = () => UI.map();
    G.audio.music('victory');
  };

  // A fresh copy of the mission to fly again (sortie missions are built per run).
  const again = (m) => (m.sortie ? G.campaign.sortie(m.sector) : m.id);

  // ---------- Paint Shop ----------
  UI.paint = function (focusId) {
    const s = save();
    const nS = G.sRanks(s);
    const cur = (G.paints.find((p) => p.id === s.paint) || G.paints[0]).id;
    const cards = G.paints.map((pt) => {
      const open = nS >= pt.need;
      const sw = [pt.hull, pt.under, pt.accent, pt.fin, pt.glass[0]].map((c) => `<i style="background:${c}"></i>`).join('');
      const info = !open ? `Needs ${pt.need} S rank${pt.need > 1 ? 's' : ''}` : pt.id === cur ? 'Equipped' : 'Select to apply';
      return `<button class="nav btn paint-card ${open ? '' : 'locked'} ${pt.id === cur ? 'sel' : ''}" data-id="${pt.id}"><span class="sw">${sw}</span><span class="nm">${esc(pt.name)}</span><span class="sc">${info}</span></button>`;
    }).join('');
    UI.show('paint', `
      <header class="bar">
        <div><div class="eyebrow">Hangar</div><h2>Paint Shop</h2></div>
        <div class="stats"><span>S RANKS <b>${nS}</b> / ${G.campaign.missions.length}</span></div>
      </header>
      <div class="panel paint-panel">
        <p class="hint">Earn paint schemes with S ranks on campaign missions. Replays count.</p>
        <div class="paint-list">${cards}</div>
      </div>
      <footer class="bar-bottom"><button class="nav btn small" id="b-back">◂ Hangar</button></footer>
    `, () => UI.hangar());
    root().querySelectorAll('.paint-card').forEach((b) => {
      if (b.classList.contains('locked')) return;
      b.onclick = () => {
        s.paint = b.dataset.id;
        G.save.write();
        G.audio.play('upgrade');
        UI.paint(b.dataset.id);
      };
    });
    if (focusId) {
      const nb = root().querySelector(`.paint-card[data-id="${focusId}"]`);
      if (nb) nb.focus({ preventScroll: true });
    }
    document.getElementById('b-back').onclick = () => UI.hangar();
    G.menuScene = 'paint';
  };

  // ---------- Endless Sortie ----------
  UI.sortie = function () {
    const s = save();
    const C = G.campaign;
    const so = s.sortie || { best: {}, bestWave: {} };
    const cards = C.sortieSectors.map((id) => {
      const m = C.byId(id);
      const open = !!s.progress.cleared[id];
      const info = !open ? 'Clear this mission to open it' : so.best[id] ? `Best ${U.fmt(so.best[id])} · wave ${so.bestWave[id] || 1}` : 'No runs yet';
      return `<button class="nav btn sortie-card ${open ? '' : 'locked'}" data-id="${id}"><span class="nm">${esc(m.name)}</span><span class="sc">${info}</span></button>`;
    }).join('');
    UI.show('sortie', `
      <header class="bar">
        <div><div class="eyebrow">Endless flight</div><h2>Sortie</h2></div>
        <div class="stats"><span>POWER <b>${powerOf()}</b></span><span class="scrap">◆ ${U.fmt(s.scrap)}</span></div>
      </header>
      <div class="panel sortie-panel">
        <p class="brief-text">Fly one sector for as long as you can. Every wave ends with a boss, and each new wave brings a different one. Enemies get tougher every wave. Score comes from kills, chains, close calls and cleared waves. You keep the scrap and salvage when the run ends.</p>
        <div class="sortie-grid">${cards}</div>
      </div>
      <footer class="bar-bottom">
        <button class="nav btn small" id="b-back">◂ Title</button>
        <button class="nav btn small" id="b-hangar">Hangar &amp; Loadout</button>
      </footer>
    `, UI.title);
    root().querySelectorAll('.sortie-card').forEach((b) => {
      if (!b.classList.contains('locked')) b.onclick = () => G.startMission(C.sortie(b.dataset.id));
    });
    document.getElementById('b-back').onclick = UI.title;
    document.getElementById('b-hangar').onclick = () => UI.hangar(UI.sortie);
    G.audio.music('hangar');
    G.menuScene = 'map';
  };

  // ---------- Pause ----------
  UI.pause = function (mission) {
    UI.show('pause', `
      <div class="panel pause-panel">
        <div class="eyebrow">${esc(mission.name)}</div>
        <h2>Paused</h2>
        <div class="menu-col">
          <button class="nav btn primary" data-autofocus id="b-res">Resume</button>
          <button class="nav btn" id="b-restart">Restart Mission</button>
          <button class="nav btn" id="b-help">Controls</button>
          <button class="nav btn" id="b-set">Settings</button>
          <button class="nav btn danger" id="b-quit">Abandon Mission</button>
        </div>
      </div>
    `, G.resume);
    document.getElementById('b-res').onclick = G.resume;
    document.getElementById('b-restart').onclick = () => G.startMission(again(mission));
    document.getElementById('b-help').onclick = () => UI.help(() => UI.pause(mission));
    document.getElementById('b-set').onclick = () => UI.settings(() => UI.pause(mission));
    document.getElementById('b-quit').onclick = () => G.abandon();
  };

  // ---------- Help ----------
  UI.help = function (onBack) {
    UI.show('help', `
      <div class="panel help-panel">
        <h2>How to Play</h2>
        <div class="help-grid">
          <section><h4>Flight</h4><ul>
            <li><kbd>Arrows</kbd>/<kbd>WASD</kbd> steer</li><li><kbd>Space</kbd>/<kbd>J</kbd> fire (hold)</li>
            <li><kbd>K</kbd>/<kbd>X</kbd> ordnance</li><li><kbd>Shift</kbd>/<kbd>L</kbd> evasive roll. It also bats enemy shots back</li><li><kbd>Q</kbd>/<kbd>E</kbd> WINGBREAK when the break meter is full</li></ul><p class="hint">Quick kills build a chain that raises scrap. Kills, chains, close calls and batted-back shots fill the break meter.</p></section>
          <section><h4>Speeder Chase</h4><ul>
            <li>Throttle is automatic</li><li><kbd>Left</kbd>/<kbd>Right</kbd> steer, <kbd>Down</kbd> brake</li>
            <li><kbd>Space</kbd> fire, <kbd>K</kbd> missile</li><li><kbd>Shift</kbd> boost</li></ul></section>
          <section><h4>On Foot</h4><ul>
            <li><kbd>WASD</kbd> move, mouse aims (or auto-aim)</li><li><kbd>Space</kbd>/click fire</li>
            <li><kbd>K</kbd> grenade, <kbd>Shift</kbd> dash</li></ul></section>
          <section><h4>Gauntlet</h4><ul>
            <li><kbd>Up</kbd>/<kbd>Down</kbd> change lane</li><li><kbd>Space</kbd> jump</li><li><kbd>Shift</kbd> duck (hold)</li></ul></section>
        </div>
        <p class="hint">Your shield recharges a few seconds after you stop taking hits. Hull does not, so grab green repair kits. <kbd>Esc</kbd>/<kbd>P</kbd> pauses. <kbd>M</kbd> mutes. A gamepad works too: stick to move, A fire, X ordnance, bumpers dodge, Y WINGBREAK, Start to pause.</p>
        <button class="nav btn primary" data-autofocus id="b-back">Back</button>
      </div>
    `, onBack);
    document.getElementById('b-back').onclick = onBack;
  };

  // ---------- Settings ----------
  UI.settings = function (onBack) {
    const st = save().settings;
    let armed = false;
    UI.show('settings', `
      <div class="panel settings-panel">
        <h2>Settings</h2>
        <label class="set-row"><span>Music volume</span><input class="nav" type="range" id="s-music" min="0" max="1" step="0.1" value="${st.music}"></label>
        <label class="set-row"><span>Effects volume</span><input class="nav" type="range" id="s-sfx" min="0" max="1" step="0.1" value="${st.sfx}"></label>
        <label class="set-row"><span>Mute all sound (M)</span><input class="nav" type="checkbox" id="s-mute" ${st.muted ? 'checked' : ''}></label>
        <label class="set-row"><span>Screen shake</span><input class="nav" type="checkbox" id="s-shake" ${st.shake ? 'checked' : ''}></label>
        <div class="row">
          <button class="nav btn small danger" id="s-reset">Erase save data</button>
          <button class="nav btn primary small" data-autofocus id="b-back">Done</button>
        </div>
        <p class="hint" id="s-msg"></p>
      </div>
    `, onBack);
    const apply = () => {
      st.music = parseFloat(document.getElementById('s-music').value);
      st.sfx = parseFloat(document.getElementById('s-sfx').value);
      st.muted = document.getElementById('s-mute').checked;
      st.shake = document.getElementById('s-shake').checked;
      G.audio.setVolumes(st.music, st.sfx);
      G.audio.setMuted(st.muted);
      G.save.write();
    };
    ['s-music', 's-sfx'].forEach((id) => document.getElementById(id).addEventListener('input', apply));
    ['s-mute', 's-shake'].forEach((id) => document.getElementById(id).addEventListener('change', apply));
    document.getElementById('s-reset').onclick = () => {
      if (!armed) {
        armed = true;
        document.getElementById('s-msg').textContent = 'Press Erase again to wipe all progress, loot and upgrades.';
        document.getElementById('s-reset').textContent = 'Erase, I am sure';
        return;
      }
      G.save.reset();
      document.getElementById('s-msg').textContent = 'Save data erased.';
      armed = false;
      document.getElementById('s-reset').textContent = 'Erase save data';
    };
    document.getElementById('b-back').onclick = onBack;
  };
})();
