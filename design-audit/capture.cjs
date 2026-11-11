// Design audit screenshots. Usage: PORT=3111 node server.js &   then   OUT=design-audit/after node design-audit/capture.cjs [1440|1366|390]
// Needs the pre-installed Playwright + Chromium. Not part of the app; nothing in public/ depends on it.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || __dirname; // set OUT=design-audit/after to keep the baseline
const B = process.env.BASE || 'http://localhost:3111'; // start the app first: PORT=3111 node server.js
const VPS = [[1440, 900], [1366, 768], [390, 844]];
const only = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const br = await chromium.launch();
  for (const [w, h] of VPS) {
    if (only && String(w) !== only) continue;
    const tag = w + 'x' + h;
    const mk = async () => { const c = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 500, isMobile: w < 500 }); return c; };
    const shot = async (p, name) => { try { await p.screenshot({ path: `${OUT}/${name}--${tag}.png` }); console.log('ok', name, tag); } catch (e) { console.log('FAIL', name, tag, e.message.split('\n')[0]); } };
    const step = async (name, fn) => { try { await fn(); } catch (e) { console.log('STEPFAIL', name, tag, e.message.split('\n')[0]); } };
    const tc = await mk(), sc = await mk(), pc = await mk();
    const T = await tc.newPage(), S = await sc.newPage(), P = await pc.newPage();
    for (const [n, pg] of [['T', T], ['S', S], ['P', P]]) pg.on('pageerror', e => console.log('PAGEERR', n, tag, e.message));

    // landing
    await T.goto(B + '/start'); await sleep(400); await shot(T, '01-landing');
    await T.screenshot({ path: `${OUT}/01-landing-full--${tag}.png`, fullPage: true });
    // student join, code step
    await S.goto(B + '/'); await sleep(500); await shot(S, '10-student-join-code');
    await step('err', async () => { await S.fill('#code', 'ZZZZ'); await S.click('#go'); await sleep(700); await shot(S, '11-student-join-error'); });

    // teacher demo
    await T.goto(B + '/class?demo=1'); await sleep(6500);
    const code = await T.evaluate(() => code);
    const starters = await T.evaluate(async () => { const r = await (await fetch('/starters.json')).json(); return r.sets || r; });
    await T.evaluate(q => sendQ(q), starters[0].questions[0]); await sleep(11000);
    await shot(T, '30-class-draw');

    // student joins
    await step('join', async () => {
      await S.fill('#code', code); await S.click('#go'); await sleep(900); await shot(S, '12-student-join-team');
      await S.fill('#name', 'Amira'); await S.locator('#pick button').first().click(); await sleep(200); await shot(S, '13-student-join-team-picked');
      await S.click('#go'); await sleep(1500);
    });
    await step('draw', async () => {
      const m = S.mouse; const cx = w / 2, cy = h / 2;
      await S.click('#toolsbtn'); await sleep(500); await S.click('.tool[data-t=pen]'); await sleep(300); await shot(S, '15-student-tools-drawer');
      await S.click('#dclose'); await sleep(500);
      await m.move(cx - 80, cy); await m.down(); for (let i = 0; i <= 30; i++) await m.move(cx - 80 + Math.cos(i / 30 * 6.3) * 60 + 60 - 60, cy + Math.sin(i / 30 * 6.3) * 60); await m.up();
      await sleep(300); await shot(S, '14-student-draw');
      await S.click('#pulse .pb[data-p=y]'); await sleep(400); await shot(S, '16-student-pulse-on');
    });
    await step('quick', async () => { await T.evaluate(() => ws.send({ t: 'mode', simple: true })); await sleep(700); await shot(S, '17-student-quick-mode'); await T.evaluate(() => ws.send({ t: 'mode', simple: false })); await sleep(400); });

    // projector
    await P.goto(B + '/projector?code=' + code); await sleep(1500); await shot(P, '50-projector-join');
    await step('spot', async () => {
      const ids = await T.evaluate(() => { const a = [...S.stu.values()]; const me = a.find(x => x.name === 'Amira') || a[0]; const o = a.filter(x => x !== me).slice(0, 2); return [me.id, ...o.map(x => x.id)]; });
      await T.evaluate(i => ws.send({ t: 'spot', ids: [i], hide: false }), ids[1]); await sleep(1200); await shot(P, '51-projector-one');
      await T.evaluate(i => ws.send({ t: 'spot', ids: i, hide: false }), ids); await sleep(1500);
      await shot(P, '52-projector-compare3'); await shot(T, '31-class-projecting'); await shot(S, '18-student-on-projector');
      await T.evaluate(() => ws.send({ t: 'spot', ids: [], hide: true })); await sleep(500);
      await T.evaluate(() => ws.send({ t: 'board', on: true })); await sleep(1200); await shot(P, '53-projector-leaderboard');
      await T.evaluate(() => ws.send({ t: 'board', on: false }));
    });
    await step('freeze', async () => {
      await T.evaluate(() => ws.send({ t: 'freeze', on: true })); await sleep(1500);
      await shot(S, '19-student-frozen'); await shot(P, '54-projector-frozen'); await shot(T, '32-class-frozen');
      await T.evaluate(() => ws.send({ t: 'freeze', on: false })); await sleep(600);
    });
    // teacher menus (desktop only elements may be hidden on phone)
    await step('more', async () => { await T.click('#more', { timeout: 2000 }); await sleep(400); await shot(T, '33-class-more-menu'); await T.keyboard.press('Escape'); await T.mouse.click(5, h - 5); await sleep(300); });
    await step('report', async () => { await T.evaluate(() => document.querySelector('#rep').showModal ? null : null); });

    // sort question
    const sq = starters[9].questions[0];
    await step('sort', async () => {
      await T.evaluate(q => sendQ(q), sq); await sleep(1500);
      await shot(S, '20-student-sort-start');
      // student: tap card then lane, for all cards
      for (let i = 0; i < 12; i++) {
        const c = S.locator('#spile .nc[data-card]').first(); if (!(await c.count())) break;
        await c.click(); await sleep(60);
        if (i === 0) await shot(S, '21-student-sort-card-picked');
        await S.locator('#sstage .slane').nth(i % 3).locator('h3').click(); await sleep(80);
        if (i === 4) await shot(S, '22-student-sort-midway');
      }
      await sleep(300); await shot(S, '23-student-sort-all-placed');
      await S.locator('#sdone button').click(); await sleep(700); await shot(S, '24-student-sort-sent');
      await sleep(14000);
      await shot(T, '34-class-sort-results');
      await T.screenshot({ path: `${OUT}/34-class-sort-results-full--${tag}.png`, fullPage: true });
      await T.evaluate(() => ws.send({ t: 'reveal', on: true })); await sleep(900); await shot(S, '25-student-sort-revealed'); await shot(T, '35-class-sort-revealed');
      await T.evaluate(() => ws.send({ t: 'sres', on: true })); await sleep(900); await shot(P, '55-projector-sort-summary');
      await T.evaluate(() => ws.send({ t: 'sres', on: false }));
    });
    await step('leave', async () => { S.once('dialog', d => d.accept()); });

    // other teacher pages (own context so localStorage is real)
    await T.goto(B + '/teacher'); await sleep(1500); await shot(T, '40-today-classes');
    await T.screenshot({ path: `${OUT}/40-today-classes-full--${tag}.png`, fullPage: true });
    await T.goto(B + '/teacher?tab=teams'); await sleep(1200); await shot(T, '41-today-teams');
    await T.screenshot({ path: `${OUT}/41-today-teams-full--${tag}.png`, fullPage: true });
    await step('sets', async () => {
      await T.goto(B + '/teacher'); await sleep(1000);
      const href = await T.evaluate(() => { const a = [...document.querySelectorAll('a')].find(a => a.getAttribute('href') && a.getAttribute('href').startsWith('/sets?id=')); return a ? a.getAttribute('href') : null; });
      console.log('sets href', href);
      if (href) { await T.goto(B + href); await sleep(1500); await shot(T, '45-sets-editor'); await T.screenshot({ path: `${OUT}/45-sets-editor-full--${tag}.png`, fullPage: true }); }
    });
    await tc.close(); await sc.close(); await pc.close();
  }
  await br.close();
})();
