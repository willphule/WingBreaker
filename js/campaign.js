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
      id: 'crownfall', stage: 5, lane: 'C', name: 'Crownfall', mode: 'flight', theme: 'space', power: 45,
      blurb: 'The final strike on the Crown dreadnought.',
      brief: 'This is it. The dreadnought Hollow Crown is in open space with its escort frigates. Cut through the asteroid screen, sink the frigates if you can, and break the Crown for good.',
      bonus: { type: 'escorts', count: 3, text: 'Destroy 3 escort frigates' },
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
    for (const m of order) if (C.available(save, m) && !save.progress.cleared[m.id]) return m;
    return C.byId('crownfall');
  };
  C.modeName = { flight: 'Flight', bike: 'Speeder Chase', foot: 'On Foot', gauntlet: 'Gauntlet' };
})();
