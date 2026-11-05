// The branching campaign. Clearing a mission's bonus objective opens the harder upper route (lane A).
(function () {
  'use strict';
  const G = window.G;

  const M = [
    {
      id: 'canyon', stage: 1, lane: 'C', name: 'Redstone Canyon', mode: 'flight', theme: 'canyon', power: 10,
      blurb: 'Low-level run through the red canyons to break the Crown blockade.',
      brief: 'The Hollow Crown has walled off the Meridian Reach. Fly the canyon floor under their radar and punch through. Their relay pylons line the canyon walls. Knock them out and we can slip a strike team over the Stormwall.',
      bonus: { type: 'pylons', count: 3, text: 'Destroy 3 relay pylons' },
    },
    {
      id: 'storm', stage: 2, lane: 'A', name: 'Stormwall', mode: 'flight', theme: 'storm', power: 18,
      blurb: 'Fly into a man-made hurricane that hides the Crown fleet.',
      brief: 'The Stormwall is a weather engine the size of a city. Lightning, crosswinds and interceptors. The calm-eye rings are the only safe air. Thread enough of them and we can plot a course straight into Halcyon Dock.',
      bonus: { type: 'rings', count: 6, text: 'Fly through 6 calm-eye rings' },
    },
    {
      id: 'saltflat', stage: 2, lane: 'B', name: 'Saltflat Chase', mode: 'bike', theme: 'salt', power: 16,
      blurb: 'Your ship is grounded. Take a speeder bike after a Crown courier.',
      brief: 'Ground fire clipped your wing. While the crew patches it, grab a speeder. A Crown courier is racing for the gate with the fleet\'s docking codes. Wreck it before it escapes and the Dock is ours.',
      bonus: { type: 'courier', text: 'Wreck the courier before the gate' },
    },
    {
      id: 'frost', stage: 2, lane: 'C', name: 'Frostline Rift', mode: 'flight', theme: 'frost', power: 17,
      blurb: 'A frozen rift where the Crown keeps captured pilots on ice.',
      brief: 'North of the canyon the rift freezes solid. The Crown has hung captured Meridian pilots in ice cages along the route, and the overhangs keep shedding icicles the size of towers. Shoot the cages open to free our people. Watch for shadows on the ice. They show where the icicles will land.',
      bonus: { type: 'cages', count: 4, text: 'Free 4 captured pilots' },
    },
    {
      id: 'dock', stage: 3, lane: 'A', name: 'Halcyon Dock', mode: 'flight', theme: 'station', power: 27,
      blurb: 'Fly through the guts of the Crown\'s orbital shipyard.',
      brief: 'Halcyon Dock builds and refuels their carriers. Fly the service tunnels. Laser gates, girders, turrets in every wall. Its power conduits run along the tunnel. Burn four and the boarding crews can get aboard.',
      bonus: { type: 'conduits', count: 4, text: 'Destroy 4 power conduits' },
    },
    {
      id: 'scrapline', stage: 3, lane: 'B', name: 'Scrapline Gauntlet', mode: 'gauntlet', theme: 'scrap', power: 25,
      blurb: 'A high-speed tunnel run through the junk lines. Do not blink.',
      brief: 'The only way past the Dock\'s outer wall is the scrapline, a mag-rail tunnel where the Crown dumps wrecks. It gets faster the deeper you go. Jump, duck, switch lanes. Grab sixty power cells on the way and we can cut into the Dock\'s core.',
      bonus: { type: 'cells', count: 60, text: 'Collect 60 power cells' },
    },
    {
      id: 'caldera', stage: 3, lane: 'C', name: 'Caldera Run', mode: 'flight', theme: 'lava', power: 26,
      blurb: 'Skim a live volcano to cut the fuel lines feeding the Dock.',
      brief: 'Halcyon Dock runs on geothermal fuel pumped out of the Ashfall caldera. Fly low over the lava. The vents erupt with very little warning, so watch for the glow. Destroy five magma pumps and the Dock runs dry. Something big lives in the lava. Try not to wake it.',
      bonus: { type: 'pumps', count: 5, text: 'Destroy 5 magma pumps' },
    },
    {
      id: 'boarding', stage: 4, lane: 'A', name: 'Boarding Action', mode: 'foot', theme: 'interior', power: 36,
      blurb: 'Leave the cockpit. Storm the carrier on foot.',
      brief: 'You\'re inside the carrier Sovereign\'s Hand. Destroy the three reactor cores, then get to the extraction pad. Crown intel drives are scattered through the decks. Grab them for a bigger haul.',
      bonus: { type: 'intel', count: 3, text: 'Recover 3 intel drives' },
    },
    {
      id: 'undertow', stage: 4, lane: 'B', name: 'Neon Undertow', mode: 'bike', theme: 'night', power: 34,
      blurb: 'Night chase through the undercity of the Crown capital.',
      brief: 'A second courier is running the capital\'s undercity highway with the Crown\'s flagship schedule. It\'s fast and it\'s guarded. Survive to the end of the highway. Wreck the courier for a better shot at the flagship.',
      bonus: { type: 'courier', text: 'Wreck the courier before the gate' },
    },
    {
      id: 'lantern', stage: 4, lane: 'C', name: 'Lantern Escort', mode: 'flight', theme: 'nebula', power: 35,
      blurb: 'Shield a crippled refugee carrier through the Veil nebula.',
      brief: 'The carrier Lantern is limping home through the Veil nebula with two thousand civilians aboard, and Crown raiders are on its tail. Fly ahead of it, kill the raiders before they line up their shots, and keep its hull above half. The Lantern will give covering fire where it can.',
      bonus: { type: 'escort', count: 1, text: 'Keep the Lantern above 50% hull' },
    },
    {
      id: 'crownfall', stage: 5, lane: 'C', name: 'Crownfall', mode: 'flight', theme: 'space', power: 45,
      blurb: 'The final strike on the Crown dreadnought.',
      brief: 'This is it. The dreadnought Hollow Crown is in open space with its escort frigates. Cut through the asteroid screen, sink the frigates if you can, and break the Crown for good.',
      bonus: { type: 'escorts', count: 3, text: 'Destroy 3 escort frigates' },
    },
    {
      id: 'ace', stage: 6, lane: 'C', name: 'Ace of Crowns', mode: 'flight', theme: 'orbit', power: 50,
      blurb: 'The Crown\'s best pilot survived. She wants a rematch.',
      brief: 'Veyra Solace, the Crown\'s top ace, slipped away before the dreadnought fell. She is in high orbit over the Reach with her personal squadron, calling you out by name. Shoot down her gold-trimmed wingmen, then beat her one on one. She is faster than anything you have fought, and she likes to dive straight past you.',
      bonus: { type: 'aces', count: 8, text: 'Shoot down 8 Crown aces' },
    },
  ];

  const C = (G.campaign = { missions: M });
  C.byId = (id) => M.find((m) => m.id === id);
  C.stages = () => {
    const out = {};
    for (const m of M) (out[m.stage] = out[m.stage] || []).push(m);
    return out;
  };

  // Route rules: stage 1 is always open. Lower/center routes need any clear from the previous stage.
  // The upper route (lane A) needs the previous stage's bonus objective.
  C.available = function (save, m) {
    if (m.stage === 1) return true;
    const prev = M.filter((x) => x.stage === m.stage - 1);
    const p = save.progress;
    const anyClear = prev.some((x) => p.cleared[x.id]);
    if (!anyClear) return false;
    if (m.lane === 'A') return prev.some((x) => p.bonus[x.id]);
    return true;
  };
  C.lockReason = function (save, m) {
    const prev = M.filter((x) => x.stage === m.stage - 1);
    const p = save.progress;
    if (!prev.some((x) => p.cleared[x.id])) return 'Clear a stage ' + (m.stage - 1) + ' mission first.';
    if (m.lane === 'A') return 'Complete a stage ' + (m.stage - 1) + ' bonus objective to open this route.';
    return '';
  };
  // Recommended next mission: the first available, uncleared one, preferring the upper route.
  C.suggested = function (save) {
    const order = M.slice().sort((a, b) => a.stage - b.stage || (a.lane === 'A' ? -1 : 1));
    for (const m of order) if (C.available(save, m) && !save.progress.cleared[m.id] && m.stage <= 5) return m;
    return C.byId('crownfall');
  };
  // Endless Sortie: fly a cleared flight sector in waves until the ship is lost.
  C.sortieSectors = ['canyon', 'storm', 'frost', 'dock', 'caldera', 'lantern', 'crownfall', 'ace'];
  C.sortie = function (sector) {
    const base = C.byId(sector);
    if (!base || C.sortieSectors.indexOf(sector) < 0) return null;
    return {
      id: 'sortie', sortie: true, sector, stage: 1, lane: 'C', name: base.name + ' Sortie', mode: 'flight', theme: base.theme,
      power: G.gear.stats(G.save.data).power, eyebrow: 'ENDLESS SORTIE',
      bonus: { text: 'Survive. Score. Go again.', count: 1 },
    };
  };
  C.modeName = { flight: 'Flight', bike: 'Speeder Chase', foot: 'On Foot', gauntlet: 'Gauntlet' };
})();
