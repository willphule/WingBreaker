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

Eight missions across five stages. Each mission has a **bonus objective**. Completing one opens the harder upper route in the next stage, with better salvage. Otherwise you take the lower route. Every mission you have unlocked stays on the map for replays.

| Stage | Upper route (needs a bonus) | Standard route |
|---|---|---|
| 1 | Redstone Canyon: flight, destroy 3 relay pylons | |
| 2 | Stormwall: flight, fly through 6 calm-eye rings | Saltflat Chase: speeder bike, wreck the courier |
| 3 | Halcyon Dock: flight, destroy 4 power conduits | Scrapline Gauntlet: tunnel run, collect 60 power cells |
| 4 | Boarding Action: on foot, recover 3 intel drives | Neon Undertow: night speeder chase, wreck the courier |
| 5 | Crownfall: final flight, destroy 3 escort frigates | |

The modes:

- **Flight.** A rail shooter with flat-shaded polygon ships. Steer inside the flight box, hold fire, launch ordnance, and roll to dodge. A roll also knocks enemy shots back at them. Every flight mission ends with a multi-part boss: destroy its weapon pods to drop the core's shield.
- **Speeder chase.** A pseudo-3D road with curves and hills. Shoot or ram raiders, hit boost pads, and catch the courier before it reaches the gate.
- **On foot.** A top-down 2.5D boarding action with cover, squads that alert each other, grenades and a dash. Destroy three reactor cores, then reach extraction before reinforcements catch you.
- **Gauntlet.** A three-lane tunnel that keeps getting faster. Jump low walls and pits, duck under bars, and switch lanes around tall walls.

## Loot and upgrades

- Four gear slots: primary cannon, ordnance, frame and shield array. Each has several archetypes, for example Pulse Laser, Twin Repeater, Scatter Cannon and Rail Lance.
- Five rarities: Standard, Refined, Superior, Mythic and Prototype. Higher rarities have better stats and random perks. Prototypes also carry a unique ability such as Arc Chain or Phoenix Protocol.
- **Power** is the average power of your gear plus your upgrade levels. Compare it with a mission's recommended power. Being under it means you deal less damage and take more.
- Missions pay out scrap and gear based on your rank (S to D), the bonus objective, a first clear, and any loot caches you picked up.
- Spend scrap on permanent upgrades: hull, shield, weapon damage, ordnance ammo, thrusters and salvage. You can also dismantle spare gear for scrap.

Progress saves in the browser's localStorage.

## Controls

| | Keyboard | Gamepad |
|---|---|---|
| Move / steer | Arrows or WASD | Left stick / D-pad |
| Fire (flight, bike, foot), jump (gauntlet) | Space, J or Z (hold) | A / RT |
| Ordnance, missile, grenade | K, X or B | X / LT |
| Dodge roll, boost, dash, duck | Shift, L or C | LB / RB / B |
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
| `js/flight.js` | Flight mode: themes, enemy behaviours, spawn patterns, bosses |
| `js/bike.js` | Speeder chase mode |
| `js/foot.js` | On-foot mode and its deck map |
| `js/gauntlet.js` | Gauntlet mode |
| `js/ui.js` | Title, campaign map, hangar, results, pause, help and settings screens |
| `js/main.js` | Main loop, scaling, mission flow and reward calculation |

To jump straight into a mission while testing, add `?mission=<id>` to the URL, for example `index.html?mission=storm`. The mission ids are `canyon`, `storm`, `saltflat`, `dock`, `scrapline`, `boarding`, `undertow` and `crownfall`.
