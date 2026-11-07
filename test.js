// Server tests: node test.js  (starts its own server on a spare port)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const PORT = 4100 + Math.floor(Math.random() * 500);
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(600);

function client() {
  const ws = new WebSocket('ws://localhost:' + PORT), got = [];
  const c = { ws, got, ready: new Promise(r => ws.on('open', r)), send: o => ws.send(JSON.stringify(o)) };
  ws.on('message', d => got.push(JSON.parse(d)));
  c.last = t => [...got].reverse().find(m => m.t === t);
  c.wait = async (t, n = 40) => { for (let i = 0; i < n; i++) { const m = c.last(t); if (m) return m; await sleep(25); } throw new Error('timeout waiting for ' + t); };
  c.clear = () => (got.length = 0);
  return c;
}
let pass = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n', e); process.exitCode = 1; } };

const CODE = 'TEST', KEY = 'k'.repeat(12);
const teams = [{ id: 'ta', name: 'Granite', color: '#2563eb', emoji: '🪨' }, { id: 'tb', name: 'Basalt', color: '#dc2626', emoji: '🌋' }];
const roster = [{ rid: 'r0001', ini: 'jd', team: 'ta' }, { rid: 'r0002', ini: 'ab', team: 'ta' }, { rid: 'r0003', ini: 'cd', team: 'tb' }];

const host = client(); await host.ready;
host.send({ t: 'host', code: CODE, key: KEY, setup: { teams, roster, scores: { ta: 3 }, cap: false } });
const st = await host.wait('state');

await test('host setup is cleaned and kept', () => {
  assert.equal(st.teams.length, 2); assert.equal(st.roster[0].ini, 'JD'); assert.equal(st.scores.ta, 3); assert.equal(st.scores.tb, 0);
  assert.ok(!('sid' in st.roster[0]), 'claims are not exposed');
});

async function join(rid, id) {
  const c = client(); await c.ready; c.send({ t: 'join', code: CODE, rid, id, bw: 800, bh: 500 });
  await Promise.race([c.wait('joined'), c.wait('err')]); return c;
}

await test('peek shows teams first, initials only after picking one team', async () => {
  const c = client(); await c.ready;
  c.send({ t: 'peek', code: CODE }); const a = await c.wait('peek');
  assert.equal(a.teams.length, 2); assert.ok(!a.list); assert.ok(!JSON.stringify(a).includes('JD'));
  c.clear(); c.send({ t: 'peek', code: CODE, team: 'ta' }); const b = await c.wait('peek');
  assert.deepEqual(b.list.map(x => x.ini), ['JD', 'AB']);
});

await test('free-typed names are refused while a class list is loaded', async () => {
  const c = client(); await c.ready; c.send({ t: 'join', code: CODE, name: 'Jane Doe' });
  const e = await c.wait('err'); assert.match(e.m, /initials/); assert.ok(!c.last('joined'));
});

let jd, jdId;
await test('student joins by initials and is on the right team', async () => {
  jd = await join('r0001'); const j = jd.last('joined'); jdId = j.id;
  assert.equal(j.team, 'ta'); assert.equal(j.ini, 'JD');
  const h = await host.wait('join'); assert.equal(h.s.name, 'JD'); assert.equal(h.s.team, 'ta');
});

await test('connected student\'s initials are taken; same student can reconnect', async () => {
  const other = await join('r0001'); assert.ok(other.last('err') && !other.last('joined'));
  const again = await join('r0001', jdId); jd = again; assert.ok(again.last('joined')); assert.equal(again.last('joined').id, jdId);
});

await test('award adds a point, repeat does not double count, undo removes it', async () => {
  host.send({ t: 'award', id: jdId, on: true }); await sleep(80);
  assert.equal(host.last('score').scores.ta, 4);
  host.send({ t: 'award', id: jdId, on: true }); await sleep(80);
  assert.equal(host.last('score').scores.ta, 4);
  host.send({ t: 'award', id: jdId, on: false }); await sleep(80);
  assert.equal(host.last('score').scores.ta, 3);
});

await test('a student cannot award points', async () => {
  const before = host.last('score').scores.ta;
  jd.send({ t: 'award', id: jdId, on: true }); jd.send({ t: 'adj', team: 'ta', d: 5 }); await sleep(100);
  assert.equal(host.last('score').scores.ta, before);
});

await test('a new question lets the student earn again; points stay', async () => {
  host.send({ t: 'award', id: jdId, on: true }); await sleep(60);
  host.send({ t: 'q', question: 'Draw a volcano', bg: 'blank' }); await sleep(60);
  assert.equal(host.last('score').scores.ta, 4);
  host.send({ t: 'award', id: jdId, on: true }); await sleep(80);
  assert.equal(host.last('score').scores.ta, 5);
});

await test('cap rule: one point per team per question', async () => {
  host.send({ t: 'setup', teams, roster, cap: true }); await sleep(60);
  const ab = await join('r0002'); const abId = ab.last('joined').id;
  host.send({ t: 'q', question: 'Next', bg: 'blank' }); await sleep(60);
  host.send({ t: 'award', id: jdId, on: true }); await sleep(60);
  const s = host.last('score').scores.ta; host.clear();
  host.send({ t: 'award', id: abId, on: true }); await sleep(80);
  assert.equal(host.last('note').m.includes('already'), true); assert.equal(host.last('score'), undefined); assert.equal(s, 6);
  host.send({ t: 'setup', teams, roster, cap: false }); await sleep(60);
});

await test('moving a student to another team moves their point', async () => {
  const before = host.last('score').scores; // ta has JD's award this question
  const r2 = roster.map(e => (e.rid === 'r0001' ? { ...e, team: 'tb' } : e));
  host.send({ t: 'setup', teams, roster: r2, cap: false }); await sleep(80);
  const a = host.last('score').scores;
  assert.equal(a.ta, before.ta - 1); assert.equal(a.tb, before.tb + 1);
  assert.equal(jd.last('myteam').team, 'tb');
  host.send({ t: 'setup', teams, roster, cap: false }); await sleep(60);
});

await test('release frees the initials and kicks the student', async () => {
  host.send({ t: 'release', id: jdId }); await sleep(80);
  assert.ok(jd.last('kicked')); assert.ok(host.last('gone'));
  const back = await join('r0001'); assert.ok(back.last('joined'));
});

await test('manual adjust and reset scores', async () => {
  host.send({ t: 'adj', team: 'tb', d: 5 }); await sleep(60);
  assert.equal(host.last('score').scores.tb >= 5, true);
  host.send({ t: 'resetscores' }); await sleep(60);
  assert.deepEqual(host.last('score').scores, { ta: 0, tb: 0 });
});

await test('no class list: nickname join still works and host can assign a team', async () => {
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code: 'FREE', key: KEY }); await h2.wait('state');
  const c = client(); await c.ready; c.send({ t: 'join', code: 'FREE', name: 'Sam' }); const j = await c.wait('joined');
  h2.send({ t: 'setup', teams, roster: [], cap: false }); h2.send({ t: 'team', id: j.id, team: 'tb' }); await sleep(100);
  assert.equal(c.last('myteam').team, 'tb');
  h2.send({ t: 'award', id: j.id, on: true }); await sleep(60); assert.equal(h2.last('score').scores.tb, 1);
});

await test('quick teams: no class list, peek offers teams, student picks a team with no nickname', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'QUICK', key: KEY, setup: { teams, roster: [] } }); await h.wait('state');
  const c = client(); await c.ready; c.send({ t: 'peek', code: 'QUICK' }); const pk = await c.wait('peek');
  assert.equal(pk.roster, false); assert.equal(pk.teams.length, 2);
  c.send({ t: 'join', code: 'QUICK', team: 'tb', bw: 800, bh: 500 }); const j = await c.wait('joined');
  assert.equal(j.team, 'tb'); const card = await h.wait('join'); assert.equal(card.s.name, 'Basalt 1');
  const d = client(); await d.ready; d.send({ t: 'join', code: 'QUICK', team: 'tb', name: 'Zed' }); await d.wait('joined');
  assert.equal(d.last('joined').team, 'tb');
  const e = client(); await e.ready; e.send({ t: 'join', code: 'QUICK' }); assert.match((await e.wait('err')).m, /nickname/);
  // rejoin must not revert a team the teacher changed
  h.send({ t: 'team', id: j.id, team: 'ta' }); await sleep(60);
  c.send({ t: 'join', code: 'QUICK', id: j.id, team: 'tb' }); await sleep(80);
  assert.equal(c.last('myteam').team, 'ta');
});

await test('status: live classes report how many students are connected', async () => {
  const c = client(); await c.ready;
  c.send({ t: 'status', code: CODE }); const a = await c.wait('status'); assert.equal(a.live, true); assert.ok(a.here >= 1);
  c.clear(); c.send({ t: 'status', code: 'NOPE1' }); const b = await c.wait('status'); assert.deepEqual([b.live, b.here], [false, 0]);
});

console.log(pass + ' passed'); srv.kill();
