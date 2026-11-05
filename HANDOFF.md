# Polish pass: plan and handoff

This file is the plan for the "polish and a little extra" pass, and the handoff if the pass stops part-way.
Work goes in the order below, and each batch is committed on its own, so whatever is checked off is in the repo and working.
The pass is mostly about flight mode, since that is the part that is landing best.

Status key: `[x]` done and pushed, `[ ]` not started, `[~]` partly done (see note).

## A. Flight feel

- [ ] **A1. Hit-stop and slow motion.** A time scale inside `Flight`. Big kills freeze the action for a few frames. Boss kills and WINGBREAK get a short slow-motion stretch.
- [ ] **A2. Better explosions.** An expanding shockwave ring, tumbling polygon debris, and smoke that hangs in the air. All scale with the size of the blast.
- [ ] **A3. Damaged enemies smoke.** Anything below half health trails smoke and the odd spark, boss weapon pods included, so you can see what is nearly dead.
- [ ] **A4. Speed and motion.** Wingtip vapour trails when you bank hard or roll. Speed lines at the screen edges that get stronger on boost rings, WINGBREAK and the outro.
- [ ] **A5. Shots.** A muzzle flash at the ship's guns. Short trails on enemy shots so they are easier to read.
- [ ] **A6. Boss entrance and death.** A "WARNING" strobe card with the boss name and letterbox bars while it arrives. On death: slow motion, a white flash and a shockwave.
- [ ] **A7. Camera.** A small field-of-view punch on boost rings and WINGBREAK, and a small kick when the rail cannon fires.

## B. The extra: chains, close calls and WINGBREAK

- [ ] **B1. Kill chain.** Kills less than about 2.2 seconds apart build a chain. The HUD shows `CHAIN x7` with a draining timer bar. Scrap dropped during a chain is worth more (up to double). Each step plays a rising blip.
- [ ] **B2. Close calls.** An enemy shot that passes very close without hitting gives a `CLOSE CALL` popup, a little shield and some break meter.
- [ ] **B3. WINGBREAK.** A break meter fills from kills, chains, close calls and shots knocked back with a roll. When it is full, press **Q or E** (gamepad **Y**, touch **BREAK**) to unleash it: about 6 seconds where the world slows down and you don't, your cannon fires a triple gold stream at double rate, and you can't be hurt. It ends with a shockwave that wipes enemy shots off the screen.
- [ ] **B4. Results.** The results screen shows best chain, close calls and WINGBREAKs used. Best chain is saved in the overall stats.

## C. Audio

- [ ] **C1. New and layered sounds.** Explosions get a crack, a body and a tail. New sounds for close calls, chain steps (rising pitch), break meter full, WINGBREAK, a low-hull warning beep and the boss warning klaxon.
- [ ] **C2. Music filter.** The music goes muffled during slow motion, pause and death, then opens back up.

## D. Docs

- [ ] **D1.** README updated with the new controls and mechanics. This file updated with what got done.

## Stretch (only if budget is left)

- [ ] **S1.** Chain counter and hit-stop for the speeder, on-foot and gauntlet modes.
- [ ] **S2.** An endless "Sortie" flight mode with a local high-score table.
- [ ] **S3.** Ship paint schemes unlocked by S ranks.

## How it is tested

- `node --check` on every changed script.
- A headless Chromium smoke test (`tools/smoke.js`, needs Playwright) that loads each flight mission with `?mission=<id>`, holds fire while steering, jumps to the boss, and fails on any console error.

## Notes for whoever picks this up

- All flight code is in `js/flight.js`. HUD widgets are in `js/common.js`, sounds and music in `js/audio.js`, input in `js/input.js`.
- There is no build step. `node tools/build.js` bundles everything into `dist/wingbreaker.html`.
- `?mission=<id>` jumps straight into a mission.
