// Headless smoke test for the flight missions. Needs Playwright with Chromium.
//   node tools/smoke.js                 run every flight mission
//   node tools/smoke.js canyon storm    run only these
//   SHOTS=dir node tools/smoke.js       also save screenshots into dir
// Each mission: hold fire while weaving, trigger WINGBREAK, skip to the boss, kill it.
// Fails on any page error or console error (font loading errors are ignored).
const path = require('path');
const { chromium } = require('playwright');

const FLIGHT = ['canyon', 'storm', 'frost', 'dock', 'caldera', 'lantern', 'crownfall', 'ace'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : FLIGHT;
const shots = process.env.SHOTS;
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  for (const id of ids) {
    const before = errors.length;
    await page.goto(`${url}?mission=${id}`);
    await wait(500);
    await page.keyboard.down('Space');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.down(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await wait(400);
      await page.keyboard.up(i % 2 ? 'ArrowLeft' : 'ArrowRight');
    }
    if (shots) await page.screenshot({ path: `${shots}/${id}-play.png` });
    // Fill the break meter and fire WINGBREAK if the mode has one.
    await page.evaluate(() => { if (G.mode && 'brk' in G.mode) G.mode.brk = 1; });
    await page.keyboard.press('KeyQ');
    await wait(1200);
    if (shots) await page.screenshot({ path: `${shots}/${id}-break.png` });
    // Skip to the boss.
    await page.evaluate(() => {
      const f = G.mode;
      const i = f.script.findIndex((e) => e.kind === 'boss');
      f.si = i;
      f.lt = f.script[i].t;
    });
    await wait(2500);
    if (shots) await page.screenshot({ path: `${shots}/${id}-boss.png` });
    await wait(1500);
    // Strip the boss down and finish it.
    await page.evaluate(() => {
      const B = G.mode.boss;
      if (!B) return;
      for (const e of B.parts) if (!e.dead) G.mode.damage(e, 1e6, e.x, e.y, e.z);
      G.mode.damage(B.core, 1e6, B.core.x, B.core.y, B.core.z);
    });
    await wait(1200);
    if (shots) await page.screenshot({ path: `${shots}/${id}-bossdeath.png` });
    await page.keyboard.up('Space');
    const state = await page.evaluate(() => ({ phase: G.mode && G.mode.phase, state: G.state }));
    const ok = errors.length === before;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}  phase=${state.phase} state=${state.state}`);
    if (!ok) console.log('   ' + errors.slice(before).join('\n   '));
  }
  await browser.close();
  if (errors.length) process.exit(1);
})();
