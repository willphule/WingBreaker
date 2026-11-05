# Wingbreaker

A fast arcade flying game in a fake-3D world, where every mission changes the rules.

You fly the last prototype interceptor of the Meridian Reach, call sign **Wingbreaker**, against the Hollow Crown armada. You fly through red canyons, a man-made hurricane, an orbital shipyard and open space. When the ship can't go somewhere, you take a speeder bike or go in on foot. Between missions you bring back loot and tune the ship in the hangar.

It runs in any modern browser. There is nothing to install and no build step.

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

To get one self-contained file you can share or host anywhere:

```bash
node tools/build.js
```

This writes `dist/wingbreaker.html`.

## The campaign

Twelve missions across five stages and an epilogue. Each mission has a **bonus objective**. Completing one opens the harder upper route in the next stage, with better salvage. The middle and lower routes only need a clear. The middle route is all flight. Every mission you have unlocked stays on the map for replays.

| Stage | Upper route (needs a bonus) | Middle route (flight) | Lower route |
|---|---|---|---|
| 1 | | Redstone Canyon: destroy 3 relay pylons | |
| 2 | Stormwall: fly through 6 calm-eye rings | Frostline Rift: free 4 captured pilots | Saltflat Chase: speeder bike, wreck the courier |
| 3 | Halcyon Dock: destroy 4 power conduits | Caldera Run: destroy 5 magma pumps | Scrapline Gauntlet: tunnel run, collect 60 power cells |
| 4 | Boarding Action: on foot, recover 3 intel drives | Lantern Escort: keep the Lantern above 50% hull | Neon Undertow: night speeder chase, wreck the courier |
| 5 | | Crownfall: destroy 3 escort frigates | |
| Epilogue | | Ace of Crowns: shoot down 8 Crown aces (opens after Crownfall) | |

What each flight mission brings:

- **Redstone Canyon.** Rock pillars, arches and walls with gaps. Boss: the Mesa Crawler.
- **Stormwall.** Lightning strikes, crosswinds and mines. Boss: the Tempest Engine and its orbiting coils.
- **Frostline Rift.** An ice canyon where icicles drop from above. Their shadows on the ice show where they will land. Boss: the Rime Harvester, with drill arms and an icicle cannon.
- **Halcyon Dock.** Station tunnels with cycling laser gates, girders and ceiling turrets. Boss: the Gatekeeper.
- **Caldera Run.** A lava field where vents glow before they erupt, and bombs arc in from the lava. Boss: the Forgeworm, a segmented worm that rises out of the lava.
- **Lantern Escort.** Escort a crippled refugee carrier through a nebula. Raiders, marked with orange chevrons, shoot at the carrier instead of you, and the carrier gives covering fire. Boss: the carrier Spite, which launches fighters from its hangar bays.
- **Crownfall.** An asteroid screen and escort frigates. Boss: the Hollow Crown dreadnought.
- **Ace of Crowns.** A duel in high orbit with Veyra Solace, the Crown's top ace. She weaves hard, calls in wingmen as she weakens, and dives straight past you.

The modes:

- **Flight.** A rail shooter with flat-shaded polygon ships. Steer inside the flight box, hold fire, launch ordnance, and roll to dodge. A roll also knocks enemy shots back at them. Every flight mission ends with a multi-part boss: destroy its weapon pods to drop the core's shield.
  - **Chains.** Kills in quick succession build a chain. The longer the chain, the more scrap each kill drops, up to double.
  - **Close calls.** Let an enemy shot slip past close without hitting you and you get a little shield back.
  - **WINGBREAK.** Kills, chains, close calls and shots you knock back with a roll fill the break meter at the bottom of the screen. When it is full, press Q to unleash it: for six seconds the world slows down around you, your cannon fires a triple gold stream at double rate, and nothing can hurt you. It ends in a shockwave that wipes enemy shots off the screen.
- **Every mode** has kill chains that raise scrap, and a split-second freeze on big hits. In the gauntlet the chain is a streak of power cells, and getting hit breaks it.
- **Speeder chase.** A pseudo-3D road with curves and hills. Shoot or ram raiders, hit boost pads, and catch the courier before it reaches the gate.
- **On foot.** A top-down 2.5D boarding action with cover, squads that alert each other, grenades and a dash. Destroy three reactor cores, then reach extraction before reinforcements catch you.
- **Gauntlet.** A three-lane tunnel that keeps getting faster. Jump low walls and pits, duck under bars, and switch lanes around tall walls.

## Endless Sortie

Clear Redstone Canyon and **Endless Sortie** opens on the title screen. Pick any flight sector you have cleared and fly it in waves until your ship is lost. Every wave ends with a boss, each new wave brings a different boss from across the campaign, and enemies get tougher every wave. Between waves your hull is patched and your ordnance is topped up. In Lantern Escort the Lantern flies with you, gets repaired between waves, and the run ends if it is lost. Score comes from kills (more during a chain), close calls and cleared waves. Your best score and wave are saved for each sector, and you keep the scrap and salvage when the run ends.

## Loot and upgrades

- Four gear slots: primary cannon, ordnance, frame and shield array. Each has several archetypes, for example Pulse Laser, Twin Repeater, Scatter Cannon and Rail Lance.
- Five rarities: Standard, Refined, Superior, Mythic and Prototype. Higher rarities have better stats and random perks. Prototypes also carry a unique ability such as Arc Chain or Phoenix Protocol.
- **Power** is the average power of your gear plus your upgrade levels. Compare it with a mission's recommended power. Being under it means you deal less damage and take more.
- Missions pay out scrap and gear based on your rank (S to D), the bonus objective, a first clear, and any loot caches you picked up.
- Spend scrap on permanent upgrades: hull, shield, weapon damage, ordnance ammo, thrusters and salvage. You can also dismantle spare gear for scrap.

- **Paint schemes.** Six paint schemes for your ship, earned with S ranks on campaign missions (1, 3, 5, 8 and all 12). Apply them in the hangar's Paint Shop, which shows a turning preview of the ship. The speeder bike uses the same paint.

Progress saves in the browser's localStorage.

## Controls

| | Keyboard | Gamepad |
|---|---|---|
| Move / steer | Arrows or WASD | Left stick / D-pad |
| Fire (flight, bike, foot), jump (gauntlet) | Space, J or Z (hold) | A / RT |
| Ordnance, missile, grenade | K, X or B | X / LT |
| Dodge roll, boost, dash, duck | Shift, L or C | LB / RB / B |
| WINGBREAK (flight, when the meter is full) | Q, E or V | Y |
| Aim (on foot) | Mouse, or auto-aim | Right stick |
| Pause | Esc or P | Start |
| Mute | M | |

On touch screens, drag on the left half of the screen to steer and use the on-screen buttons on the right. Menus work with the keyboard, a gamepad, a mouse or touch.

## Code layout

| File | What it does |
|---|---|
| `js/util.js` | Shared namespace, math and color helpers, glow and cloud sprite caches |
| `js/input.js` | Keyboard, mouse, gamepad and touch input mapped to actions |
| `js/audio.js` | Synthesized sound effects and a step sequencer for music (no audio files) |
| `js/save.js` | localStorage save with safe fallbacks |
| `js/gear.js` | Archetypes, rarities, perks, loot rolls and the loadout stat model |
| `js/campaign.js` | Mission list and branching route rules |
| `js/common.js` | Shield and hull model, HUD widgets, radio chatter, popups, 2D particles |
| `js/models.js` | Flat-shaded polygon renderer and all low-poly models |
| `js/flight.js` | Flight mode: themes, enemy behaviours, spawn patterns, hazards, escort logic, bosses, chains and WINGBREAK |
| `js/bike.js` | Speeder chase mode |
| `js/foot.js` | On-foot mode and its deck map |
| `js/gauntlet.js` | Gauntlet mode |
| `js/ui.js` | Title, campaign map, hangar, results, pause, help and settings screens |
| `js/main.js` | Main loop, scaling, mission flow and reward calculation |

`tools/smoke.js` is a headless smoke test for the flight missions. It needs Playwright with Chromium: run `node tools/smoke.js`, or `node tools/smoke.js canyon storm` for only some missions.

To jump straight into a mission while testing, add `?mission=<id>` to the URL, for example `index.html?mission=storm`. The mission ids are `canyon`, `storm`, `frost`, `saltflat`, `dock`, `caldera`, `scrapline`, `boarding`, `lantern`, `undertow`, `crownfall` and `ace`. For a sortie, use `sortie-` and a flight mission id, for example `?mission=sortie-frost`.
