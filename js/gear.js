// Loot: weapon/ordnance/frame/shield archetypes, rarities, perks, random rolls and the stat model.
(function () {
  'use strict';
  const G = window.G;
  const U = G.U;

  const SLOTS = ['primary', 'secondary', 'frame', 'shield'];
  const SLOT_NAMES = { primary: 'Primary Cannon', secondary: 'Ordnance', frame: 'Frame', shield: 'Shield Array' };

  const ARCH = {
    primary: {
      pulse: { name: 'Pulse Laser', code: 'PL', dmg: 10, rate: 7, pellets: 1, pierce: 0, desc: 'Balanced bolts. Reliable at any range.' },
      repeater: { name: 'Twin Repeater', code: 'TR', dmg: 5.6, rate: 13, pellets: 1, pierce: 0, desc: 'Alternating twin barrels. Very high fire rate.' },
      scatter: { name: 'Scatter Cannon', code: 'SC', dmg: 5, rate: 3.2, pellets: 5, pierce: 0, desc: 'Fires a five-shot spread. Shreds swarms up close.' },
      rail: { name: 'Rail Lance', code: 'RL', dmg: 30, rate: 2.1, pellets: 1, pierce: 2, desc: 'Slow, heavy slugs that punch through targets.' },
    },
    secondary: {
      seeker: { name: 'Seeker Pod', code: 'SK', dmg: 34, ammo: 14, desc: 'Locks up to four targets and fires homing missiles.' },
      nova: { name: 'Nova Charge', code: 'NV', dmg: 150, ammo: 3, desc: 'A huge blast that clears the space ahead and erases enemy fire.' },
      flak: { name: 'Flak Mortar', code: 'FM', dmg: 60, ammo: 10, desc: 'A shell that bursts mid-range, hitting everything nearby.' },
    },
    frame: {
      kestrel: { name: 'Kestrel Frame', code: 'KF', hull: 100, speed: 1, dodge: 1.2, desc: 'Even balance of armor and handling.' },
      bulwark: { name: 'Bulwark Frame', code: 'BF', hull: 145, speed: 0.88, dodge: 1.5, desc: 'Heavy plating. Slower to steer and dodge.' },
      swift: { name: 'Swift Frame', code: 'SF', hull: 76, speed: 1.15, dodge: 0.8, desc: 'Light and twitchy. Dodges recover fast.' },
    },
    shield: {
      aegis: { name: 'Aegis Array', code: 'AA', cap: 60, delay: 2.6, rate: 30, desc: 'Standard recharging shield.' },
      bastion: { name: 'Bastion Array', code: 'BA', cap: 95, delay: 3.4, rate: 26, desc: 'Deep capacity, slow to start recharging.' },
      flicker: { name: 'Flicker Array', code: 'FA', cap: 40, delay: 1.4, rate: 48, desc: 'Small, but snaps back almost at once.' },
    },
  };

  const RARITY = [
    { name: 'Standard', color: '#c3cbdc', mult: 1.0, perks: 0, scrap: 15 },
    { name: 'Refined', color: '#6fe39a', mult: 1.07, perks: 1, scrap: 30 },
    { name: 'Superior', color: '#5aaeff', mult: 1.14, perks: 1, scrap: 60 },
    { name: 'Mythic', color: '#c77dff', mult: 1.22, perks: 2, scrap: 120 },
    { name: 'Prototype', color: '#ffb547', mult: 1.3, perks: 2, scrap: 240 },
  ];

  const PERKS = {
    overclock: { slots: ['primary'], name: 'Overclock', desc: '+18% fire rate' },
    highyield: { slots: ['primary'], name: 'High Yield', desc: '+18% damage' },
    tracking: { slots: ['primary'], name: 'Tracking Rounds', desc: 'Much stronger aim assist' },
    leech: { slots: ['primary'], name: 'Leech', desc: 'Kills restore 6 shield' },
    piercing: { slots: ['primary'], name: 'Piercing', desc: 'Shots pass through one more target' },
    extrarack: { slots: ['secondary'], name: 'Extra Rack', desc: '+40% ordnance ammo' },
    payload: { slots: ['secondary'], name: 'Heavy Payload', desc: '+30% ordnance damage' },
    resupply: { slots: ['secondary'], name: 'Resupply', desc: 'Kills sometimes restore 1 ammo' },
    reinforced: { slots: ['frame'], name: 'Reinforced', desc: '+15% hull' },
    agile: { slots: ['frame'], name: 'Agile', desc: '-25% dodge cooldown' },
    magnet: { slots: ['frame'], name: 'Salvage Magnet', desc: 'Wider pickup pull, +10% scrap' },
    scavenger: { slots: ['primary', 'secondary', 'frame', 'shield'], name: 'Scavenger', desc: '+15% scrap' },
    quickcharge: { slots: ['shield'], name: 'Quick Charge', desc: 'Recharge starts 30% sooner' },
    overcharge: { slots: ['shield'], name: 'Overcharge', desc: '+20% shield capacity' },
    reflex: { slots: ['shield'], name: 'Reflex Field', desc: 'Dodging restores 12 shield' },
  };

  const UNIQUE = {
    primary: { key: 'chain', name: 'Arc Chain', desc: 'Hits arc to a nearby enemy for 40% damage' },
    secondary: { key: 'wide', name: 'Wide Blast', desc: 'Ordnance blasts are 60% larger, +1 missile per salvo' },
    frame: { key: 'phoenix', name: 'Phoenix Protocol', desc: 'Once per mission, survive a killing blow with 35% hull' },
    shield: { key: 'overdrive', name: 'Overdrive', desc: 'Shield refills at once when hull falls below 30% (every 20s)' },
  };

  const MAKERS = ['Halden', 'Okaro', 'Vantis', 'Meridian', 'Kessler-Ru', 'Ashgrove', 'Tamsin', 'Corvo', 'Lune & Sable'];
  const NAMES = ['Ashfall', 'Cold Verdict', 'Hummingbird', 'Last Light', 'Grey Tithe', 'Low Sun', 'Splinter', 'Widow Moth',
    'Iron Psalm', 'Saltwind', 'Fathom', 'Kingfisher', 'Black Static', 'Ember Rite', 'Quiet Comet', 'Tallow', 'Brightwake',
    'Third Oath', 'Lodestar', 'Paper Tiger', 'Harrow\'s Due', 'Glasswing', 'Thornback', 'Deep Ninth'];

  const UPGRADES = [
    { key: 'hull', name: 'Hull Plating', desc: '+10% hull per level', max: 5, cost: [120, 240, 400, 650, 1000] },
    { key: 'shield', name: 'Shield Capacitors', desc: '+10% shield capacity per level', max: 5, cost: [120, 240, 400, 650, 1000] },
    { key: 'weapons', name: 'Weapon Calibration', desc: '+6% primary damage per level', max: 5, cost: [150, 300, 500, 800, 1200] },
    { key: 'ordnance', name: 'Ordnance Racks', desc: '+25% ordnance ammo per level', max: 3, cost: [200, 450, 800] },
    { key: 'thrusters', name: 'Thruster Tuning', desc: '-10% dodge cooldown, +4% speed per level', max: 3, cost: [180, 400, 750] },
    { key: 'salvage', name: 'Salvage Rig', desc: '+15% scrap from every source per level', max: 3, cost: [160, 380, 700] },
  ];

  const gear = (G.gear = { SLOTS, SLOT_NAMES, ARCH, RARITY, PERKS, UNIQUE, UPGRADES });

  function newItem(save, slot, arch, rarity, power, perks, unique, name) {
    const a = ARCH[slot][arch];
    return {
      id: save.nextId++,
      slot,
      arch,
      rarity,
      power,
      perks: perks || [],
      unique: unique || null,
      name: name || `${U.pick(MAKERS)} ${a.code}-${U.randi(2, 49)}`,
      fresh: true,
    };
  }

  gear.giveStarterKit = function (save) {
    const kit = [
      newItem(save, 'primary', 'pulse', 0, 8, [], null, 'Halden PL-7'),
      newItem(save, 'secondary', 'seeker', 0, 8, [], null, 'Okaro SK-2'),
      newItem(save, 'frame', 'kestrel', 0, 8, [], null, 'Kestrel Mk I'),
      newItem(save, 'shield', 'aegis', 0, 8, [], null, 'Aegis-1'),
      newItem(save, 'primary', 'repeater', 0, 7, [], null, 'Corvo TR-3'),
      newItem(save, 'shield', 'flicker', 1, 9, ['quickcharge'], null, 'Tamsin FA-11'),
    ];
    for (const it of kit) {
      it.fresh = false;
      save.inventory.push(it);
    }
    save.equipped = { primary: kit[0].id, secondary: kit[1].id, frame: kit[2].id, shield: kit[3].id };
  };

  // Roll a random item. luck shifts the rarity curve upward.
  gear.roll = function (save, power, luck = 0, forceSlot) {
    const slot = forceSlot || U.pick(SLOTS);
    const arch = U.pick(Object.keys(ARCH[slot]));
    const w = [50, 30, 14, 5, 1.2].map((x, i) => [i, x * (i === 0 ? Math.max(0.2, 1 - luck * 0.25) : 1 + luck * i * 0.35)]);
    const rarity = U.weighted(w);
    const pwr = Math.max(1, Math.round(power + U.randi(-2, 4) + rarity));
    const pool = Object.keys(PERKS).filter((k) => PERKS[k].slots.includes(slot));
    U.shuffle(pool);
    const perks = pool.slice(0, RARITY[rarity].perks);
    const unique = rarity === 4 ? UNIQUE[slot].key : null;
    const name = rarity >= 3 ? `"${U.pick(NAMES)}" ${ARCH[slot][arch].code}` : undefined;
    return newItem(save, slot, arch, rarity, pwr, perks, unique, name);
  };

  gear.find = (save, id) => save.inventory.find((i) => i.id === id);
  gear.equipped = (save, slot) => gear.find(save, save.equipped[slot]);
  gear.isEquipped = (save, item) => save.equipped[item.slot] === item.id;
  gear.dismantleValue = (item) => RARITY[item.rarity].scrap + Math.round(item.power * 1.5);
  gear.uniqueInfo = (item) => (item.unique ? UNIQUE[item.slot] : null);

  gear.power = function (save) {
    let sum = 0;
    for (const s of SLOTS) sum += (gear.equipped(save, s) || { power: 1 }).power;
    let up = 0;
    for (const k in save.upgrades) up += save.upgrades[k];
    return Math.round(sum / 4 + up);
  };

  // A short list of display stats for one item (used in the hangar).
  gear.itemStats = function (item) {
    const a = ARCH[item.slot][item.arch];
    const m = RARITY[item.rarity].mult;
    switch (item.slot) {
      case 'primary':
        return [
          ['Damage', (a.dmg * m * a.pellets).toFixed(0) + (a.pellets > 1 ? ` (${a.pellets}x)` : '')],
          ['Fire rate', a.rate.toFixed(1) + '/s'],
          ['Pierce', String(a.pierce)],
        ];
      case 'secondary':
        return [['Damage', (a.dmg * m).toFixed(0)], ['Ammo', String(a.ammo)]];
      case 'frame':
        return [['Hull', (a.hull * m).toFixed(0)], ['Handling', Math.round(a.speed * 100) + '%'], ['Dodge', a.dodge.toFixed(2) + 's']];
      case 'shield':
        return [['Capacity', (a.cap * m).toFixed(0)], ['Delay', a.delay.toFixed(1) + 's'], ['Recharge', (a.rate * m).toFixed(0) + '/s']];
    }
    return [];
  };

  // Combined stats for the current loadout, used by every game mode.
  gear.stats = function (save) {
    const eq = {};
    for (const s of SLOTS) eq[s] = gear.equipped(save, s);
    const perks = new Set();
    let scav = 0;
    for (const s of SLOTS) {
      const it = eq[s];
      if (!it) continue;
      for (const p of it.perks) {
        if (p === 'scavenger') scav++;
        perks.add(p);
      }
      if (it.unique) perks.add(it.unique);
    }
    const up = save.upgrades;
    const rm = (it) => RARITY[it.rarity].mult;
    const P = ARCH.primary[eq.primary.arch];
    const S2 = ARCH.secondary[eq.secondary.arch];
    const F = ARCH.frame[eq.frame.arch];
    const SH = ARCH.shield[eq.shield.arch];
    return {
      power: gear.power(save),
      perks,
      hull: Math.round(F.hull * rm(eq.frame) * (1 + 0.1 * up.hull) * (perks.has('reinforced') ? 1.15 : 1)),
      shield: Math.round(SH.cap * rm(eq.shield) * (1 + 0.1 * up.shield) * (perks.has('overcharge') ? 1.2 : 1)),
      shieldDelay: SH.delay * (perks.has('quickcharge') ? 0.7 : 1),
      shieldRate: SH.rate * rm(eq.shield),
      primary: {
        arch: eq.primary.arch,
        dmg: P.dmg * rm(eq.primary) * (1 + 0.06 * up.weapons) * (perks.has('highyield') ? 1.18 : 1),
        rate: P.rate * (perks.has('overclock') ? 1.18 : 1),
        pellets: P.pellets,
        pierce: P.pierce + (perks.has('piercing') ? 1 : 0),
      },
      secondary: {
        arch: eq.secondary.arch,
        dmg: S2.dmg * rm(eq.secondary) * (perks.has('payload') ? 1.3 : 1),
        ammo: Math.round(S2.ammo * (1 + 0.25 * up.ordnance) * (perks.has('extrarack') ? 1.4 : 1)),
        radius: perks.has('wide') ? 1.6 : 1,
      },
      speed: F.speed * (1 + 0.04 * up.thrusters),
      dodgeCD: F.dodge * (perks.has('agile') ? 0.75 : 1) * (1 - 0.1 * up.thrusters),
      scrapMult: 1 + 0.15 * up.salvage + 0.15 * scav + (perks.has('magnet') ? 0.1 : 0),
      magnet: perks.has('magnet') ? 2 : 1,
      assist: perks.has('tracking') ? 0.3 : 0.14,
    };
  };
})();
