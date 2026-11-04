// Save data stored in localStorage. Every access is guarded so the game still runs without storage.
(function () {
  'use strict';
  const G = window.G;
  const KEY = 'wingbreaker_save_v1';

  function fresh() {
    const s = {
      v: 1,
      scrap: 150,
      nextId: 1,
      inventory: [],
      equipped: {},
      upgrades: { hull: 0, shield: 0, weapons: 0, ordnance: 0, thrusters: 0, salvage: 0 },
      progress: { cleared: {}, bonus: {}, best: {}, campaignDone: false, lastMission: null },
      settings: { music: 0.5, sfx: 0.8, shake: true, muted: false },
      stats: { missions: 0, kills: 0, deaths: 0 },
      seenIntro: false,
    };
    return s;
  }

  const S = (G.save = {
    data: null,
    available: true,
  });

  S.load = function () {
    let d = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) d = JSON.parse(raw);
    } catch (e) {
      S.available = false;
    }
    if (!d || d.v !== 1) {
      d = fresh();
      S.data = d;
      G.gear.giveStarterKit(d);
    } else {
      // Fill in any fields added after the save was made.
      const f = fresh();
      for (const k in f) if (d[k] === undefined) d[k] = f[k];
      for (const k in f.upgrades) if (d.upgrades[k] === undefined) d.upgrades[k] = 0;
      for (const k in f.settings) if (d.settings[k] === undefined) d.settings[k] = f.settings[k];
      S.data = d;
    }
    return S.data;
  };

  S.write = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(S.data));
    } catch (e) {
      S.available = false;
    }
  };

  S.reset = function () {
    S.data = fresh();
    G.gear.giveStarterKit(S.data);
    S.write();
  };
})();
