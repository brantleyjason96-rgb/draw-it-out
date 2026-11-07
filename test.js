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

await test('host can move a class-list student to another team without replacing the list', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'MOVE', key: KEY, setup: { teams, roster } }); await h.wait('state');
  const c = client(); await c.ready; c.send({ t: 'join', code: 'MOVE', rid: 'r0001', bw: 800, bh: 500 }); const j = await c.wait('joined');
  h.send({ t: 'team', id: j.id, team: 'tb' }); await sleep(100);
  assert.equal(c.last('myteam').team, 'tb');
  assert.equal(h.last('setup').roster.find(e => e.rid === 'r0001').team, 'tb');
  assert.equal(h.last('setup').roster.length, 3);
});

// ---- sort questions ----
const SORT = {
  t: 'q', kind: 'sort', question: 'Sort the rocks',
  sort: {
    lanes: [{ id: 'A', name: 'Igneous' }, { id: 'B', name: 'Sedimentary' }, { id: 'C', name: 'Metamorphic' }], shuffle: true, fb: 'reveal',
    cards: [{ id: 1, text: 'Granite', lane: 'A', idea: 'Examples' }, { id: 2, text: 'Limestone', lane: 'B', idea: 'Examples' }, { id: 3, text: 'Marble', lane: 'C', idea: 'Examples' }, { id: 4, text: 'Has fossils', lane: 'B', idea: 'Clues' }]
  }
};
const SH = 'SORT';
const sh = client(); await sh.ready; sh.send({ t: 'host', code: SH, key: KEY, setup: { teams, roster: [] } }); await sh.wait('state');
const proj = client(); await proj.ready; proj.send({ t: 'watch', code: SH }); await proj.wait('state');
const sa = client(); await sa.ready; sa.send({ t: 'join', code: SH, name: 'Sam', bw: 800, bh: 500 }); const saJ = await sa.wait('joined');
const sb = client(); await sb.ready; sb.send({ t: 'join', code: SH, name: 'Bea', bw: 800, bh: 500 }); const sbJ = await sb.wait('joined');

await test('sort question: the answer key goes to the teacher only', async () => {
  sh.clear(); proj.clear(); sa.clear();
  sh.send(SORT); await sleep(100);
  const hq = sh.last('q'); assert.equal(hq.q.kind, 'sort'); assert.equal(hq.sk.lane[1], 'A'); assert.equal(hq.sk.idea[4], 'Clues');
  const sq = sa.last('q').q, pq = proj.last('q').q;
  for (const q of [sq, pq]) {
    assert.equal(q.kind, 'sort'); assert.equal(q.sort.cards.length, 4); assert.equal(q.sort.lanes.length, 3);
    const txt = JSON.stringify(q); assert.ok(!('lane' in q.sort.cards[0]) && !txt.includes('Clues') && !txt.includes('"idea"'), 'no key in ' + txt);
  }
  assert.equal(sa.last('sk'), undefined); assert.equal(proj.last('sk'), undefined);
  // a projector that connects later still never sees the key
  const late = client(); await late.ready; late.send({ t: 'watch', code: SH }); const ls = await late.wait('state');
  assert.equal(ls.sk, undefined); assert.ok(!JSON.stringify(ls).includes('Clues'));
  const hs = client(); await hs.ready; hs.send({ t: 'host', code: SH, key: KEY }); assert.equal((await hs.wait('state')).sk.lane[2], 'B');
});

await test('sort question that is not complete is refused', async () => {
  sh.clear(); const before = sh.last('q');
  sh.send({ t: 'q', kind: 'sort', question: 'x', sort: { lanes: [{ id: 'A', name: 'Only one' }], cards: [{ id: 1, text: 'x', lane: 'A' }] } }); await sleep(80);
  assert.match(sh.last('note').m, /not complete/); assert.equal(sh.last('q'), undefined); assert.equal(before, undefined);
});

await test('sort answers are cleaned: unknown cards and lanes are dropped', async () => {
  sh.clear();
  sa.send({ t: 'sort', p: { 1: 'A', 2: 'A', 3: 'Z', 99: 'A', 4: 'B', x: 'A' } }); await sleep(100);
  const m = sh.last('sort'); assert.deepEqual(m.p, { 1: 'A', 2: 'A', 4: 'B' }); assert.equal(m.done, false);
  assert.deepEqual(sa.last('sorted').p, { 1: 'A', 2: 'A', 4: 'B' });
});

await test('no feedback until the teacher reveals; done needs every card placed', async () => {
  assert.equal(sa.last('fb'), undefined);
  sa.send({ t: 'sort', p: { 1: 'A', 2: 'A', 4: 'B' }, done: true }); await sleep(80);
  assert.equal(sh.last('sort').done, false, 'incomplete answer cannot be handed in');
  sa.send({ t: 'sort', p: { 1: 'A', 2: 'A', 3: 'C', 4: 'B' }, done: true }); await sleep(80);
  assert.equal(sh.last('sort').done, true);
  sa.send({ t: 'sort', p: { 1: 'B', 2: 'B', 3: 'B', 4: 'B' } }); await sleep(80);
  assert.deepEqual(sh.last('sort').p, { 1: 'A', 2: 'A', 3: 'C', 4: 'B' }, 'locked once handed in');
});

await test('reveal tells each student what was right and where wrong cards belong', async () => {
  sh.send({ t: 'reveal', on: true }); await sleep(100);
  const f = sa.last('fb'); assert.deepEqual(f.ok, { 1: true, 2: false, 3: true, 4: true }); assert.deepEqual(f.where, { 2: 'B' });
  assert.equal(proj.last('reveal').on, true);
  sh.send({ t: 'reveal', on: false }); await sleep(80); assert.equal(sa.last('fb').off, true);
});

await test('teacher can reopen a handed-in answer', async () => {
  sh.send({ t: 'reopen', id: saJ.id }); await sleep(80);
  assert.equal(sa.last('sorted').done, false);
  sa.send({ t: 'sort', p: { 1: 'A', 2: 'B', 3: 'C', 4: 'B' } }); await sleep(80);
  assert.equal(sh.last('sort').p[2], 'B');
});

await test('feedback "now" tells students right away, without the key', async () => {
  const q = { ...SORT, sort: { ...SORT.sort, fb: 'now' } };
  sh.send(q); await sleep(80); sb.clear();
  sb.send({ t: 'sort', p: { 1: 'C', 2: 'B' } }); await sleep(80);
  const f = sb.last('fb'); assert.deepEqual(f.ok, { 1: false, 2: true }); assert.deepEqual(f.where, {});
  assert.equal(sa.last('q').q.sort.fb, 'now');
});

await test('a new question clears sort answers; a rejoin gets its answer back', async () => {
  sb.send({ t: 'sort', p: { 1: 'A' } }); await sleep(60);
  const again = client(); await again.ready; again.send({ t: 'join', code: SH, name: 'Bea', id: sbJ.id, bw: 800, bh: 500 });
  const j = await again.wait('joined'); assert.deepEqual(j.sort, { 1: 'A' });
  sh.send({ t: 'q', question: 'Draw it', bg: 'blank' }); await sleep(80);
  assert.equal(sh.last('state'), undefined);
  sb.send({ t: 'sort', p: { 1: 'A' } }); await sleep(60);
  const st2 = client(); await st2.ready; st2.send({ t: 'host', code: SH, key: KEY }); const s2 = await st2.wait('state');
  assert.equal(s2.sk, null); assert.deepEqual(s2.students.find(x => x.name === 'Bea').sort, {});
});

await test('class-wide summary for the projector has percentages, no names and no key', async () => {
  sh.send(SORT); await sleep(80);
  sa.send({ t: 'sort', p: { 1: 'A', 2: 'B', 3: 'C', 4: 'B' } }); sb.send({ t: 'sort', p: { 1: 'B', 2: 'B', 3: 'C', 4: 'A' } }); await sleep(100);
  proj.clear(); sh.send({ t: 'sres', on: true }); await sleep(120);
  const m = proj.last('sum'); assert.equal(m.n, 2);
  assert.equal(m.cards.find(c => c.id === 1).pct, 50); assert.equal(m.cards.find(c => c.id === 2).pct, 100);
  assert.deepEqual(m.ideas.map(i => [i.name, i.pct]).sort(), [['Clues', 50], ['Examples', 83]]);
  assert.ok(!JSON.stringify(m).includes('Sam') && !JSON.stringify(m).includes('"lane"'));
});

await test('students cannot reveal, reopen or read results', async () => {
  sh.clear(); sa.send({ t: 'reveal', on: true }); sa.send({ t: 'sres', on: false }); sa.send({ t: 'reopen', id: sbJ.id }); await sleep(80);
  assert.equal(sh.last('reveal'), undefined); assert.equal(sh.last('sres'), undefined); assert.equal(sh.last('sort'), undefined);
});

// ---- team names and icons (Today → Teams) ----
let rh, rj;
await test('teams: a rename and new icon reach the class and keep the points', async () => {
  rh = client(); await rh.ready;
  rh.send({ t: 'host', code: 'RENAME', key: KEY, setup: { teams, roster, scores: { ta: 4, tb: 2 }, cap: false } });
  await rh.wait('state');
  rj = client(); await rj.ready; rj.send({ t: 'join', code: 'RENAME', rid: 'r0001', bw: 800, bh: 500 });
  await rj.wait('joined'); rh.clear(); rj.clear();
  rh.send({ t: 'teams', teams: [{ id: 'ta', name: 'Granite Crew', color: '#0E7C4A', emoji: '🚀' }, teams[1]] }); await sleep(90);
  const sc = rh.last('score');
  assert.equal(sc.teams[0].name, 'Granite Crew'); assert.equal(sc.teams[0].emoji, '🚀'); assert.equal(sc.teams[0].color, '#0E7C4A');
  assert.equal(sc.scores.ta, 4, 'points survive a rename');
  assert.equal(rj.last('score').teams[0].name, 'Granite Crew');
  rh.send({ t: 'adj', team: 'ta', d: 1 }); await sleep(60);
  assert.equal(rh.last('score').scores.ta, 5);
});

await test('teams: removing a team drops its points and unassigns its students', async () => {
  rh.send({ t: 'teams', teams: [teams[1]] }); await sleep(90);
  const sc = rh.last('score');
  assert.equal(sc.teams.length, 1); assert.deepEqual(sc.scores, { tb: 2 });
  assert.equal(rh.last('setup').roster.find(e => e.rid === 'r0001').team, null);
  assert.equal(rj.last('myteam').team, null);
});

await test('teams: only a host can change team names', async () => {
  rj.clear();
  rj.send({ t: 'teams', teams: [{ id: 'tb', name: 'Hacked' }] }); await sleep(100);
  assert.equal(rj.last('score'), undefined);
  rh.clear(); rh.send({ t: 'status', code: 'RENAME', key: KEY }); await sleep(80);
  assert.equal(rh.last('status').teams[0].name, teams[1].name);
});

await test('status: team names and scores come back only with the host key', async () => {
  const c = client(); await c.ready;
  c.send({ t: 'status', code: 'RENAME' }); const a = await c.wait('status');
  assert.equal(a.teams, undefined); assert.equal(a.scores, undefined);
  c.clear(); c.send({ t: 'status', code: 'RENAME', key: 'not-the-key-1' }); const b = await c.wait('status');
  assert.equal(b.scores, undefined);
  c.clear(); c.send({ t: 'status', code: 'RENAME', key: KEY }); const d = await c.wait('status');
  assert.deepEqual(d.scores, { tb: 2 }); assert.equal(d.teams[0].name, 'Basalt');
});

await test('teams: long names and multi-part emoji are cut cleanly, never mid-character', async () => {
  const h = client(); await h.ready;
  h.send({ t: 'host', code: 'CLEAN', key: KEY, setup: { teams: [{ id: 'ta', name: 'Granite Granite Granite', color: 'nope', emoji: '🏳️‍🌈' }], roster: [] } });
  const s = await h.wait('state');
  assert.equal(Array.from(s.teams[0].name).length, 20);
  assert.equal(s.teams[0].emoji, '🏳️‍🌈');
  assert.equal(s.teams[0].color, '#2563eb');
  assert.equal(s.teams[0].name, 'Granite Granite Gran');
});

console.log(pass + ' passed'); srv.kill();
