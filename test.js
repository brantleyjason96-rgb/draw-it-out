// Server tests: node test.js  (starts its own server on a spare port)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import WebSocket from 'ws';

const PORT = 4100 + Math.floor(Math.random() * 500);
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, MAX_PER_IP: '1000' }, stdio: 'ignore' }); // the suite opens more sockets than one school would; the limit itself is tested on its own server below
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

async function join(rid, id, tok) {
  const c = client(); await c.ready; c.send({ t: 'join', code: CODE, rid, id, tok, bw: 800, bh: 500 });
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

let jd, jdId, jdTok;
await test('student joins by initials and is on the right team', async () => {
  jd = await join('r0001'); const j = jd.last('joined'); jdId = j.id; jdTok = j.tok;
  assert.equal(j.team, 'ta'); assert.equal(j.ini, 'JD');
  const h = await host.wait('join'); assert.equal(h.s.name, 'JD'); assert.equal(h.s.team, 'ta');
});

await test('connected student\'s initials are taken; same student can reconnect', async () => {
  const other = await join('r0001'); assert.ok(other.last('err') && !other.last('joined'));
  const again = await join('r0001', jdId, jdTok); jd = again; assert.ok(again.last('joined')); assert.equal(again.last('joined').id, jdId);
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
  c.send({ t: 'join', code: 'QUICK', id: j.id, tok: j.tok, team: 'tb' }); await sleep(80);
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
  const again = client(); await again.ready; again.send({ t: 'join', code: SH, name: 'Bea', id: sbJ.id, tok: sbJ.tok, bw: 800, bh: 500 });
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

// ---- confidence pulse, freeze, and up to 3 on the projector ----
let ph2, pj, pproj, pjId;
const pjoin = async () => { const c = client(); await c.ready; c.send({ t: 'join', code: 'PULSE', name: 'Pip', bw: 800, bh: 500 }); await c.wait('joined'); return c; };
await test('pulse: a student colour reaches the teacher and the projector, and survives a reconnect', async () => {
  ph2 = client(); await ph2.ready; ph2.send({ t: 'host', code: 'PULSE', key: KEY }); await ph2.wait('state');
  pproj = client(); await pproj.ready; pproj.send({ t: 'watch', code: 'PULSE' }); await pproj.wait('state');
  pj = await pjoin(); pjId = pj.last('joined').id;
  ph2.clear(); pproj.clear();
  pj.send({ t: 'pulse', c: 'y' }); await sleep(80);
  assert.equal(ph2.last('pulse').c, 'y'); assert.equal(pproj.last('pulse').c, 'y'); assert.equal(ph2.last('pulse').id, pjId);
  pj.send({ t: 'pulse', c: 'nonsense' }); await sleep(80);
  assert.equal(ph2.last('pulse').c, null, 'only red, amber and green are accepted');
  pj.send({ t: 'pulse', c: 'r' }); await sleep(80);
  const back = client(); await back.ready; back.send({ t: 'host', code: 'PULSE', key: KEY });
  const st = await back.wait('state');
  assert.equal(st.students.find(x => x.id === pjId).pulse, 'r');
  back.ws.close();
});

await test('freeze: stops drawing on every screen, blocks work, and lets go when told', async () => {
  ph2.clear(); pj.clear(); pproj.clear();
  ph2.send({ t: 'freeze', on: true, secs: 60 }); await sleep(90);
  assert.equal(ph2.last('freeze').on, true); assert.equal(pproj.last('freeze').on, true); assert.equal(pj.last('freeze').on, true);
  ph2.clear(); pj.clear();
  pj.send({ t: 'set', o: { id: 1, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [40, 40]] } });
  pj.send({ t: 'pulse', c: 'g' });
  await sleep(90);
  assert.equal(ph2.last('set'), undefined, 'nothing is stored or relayed while frozen');
  assert.equal(ph2.last('pulse'), undefined);
  assert.equal(pj.last('freeze').on, true, 'the student is told why');
  const late = await pjoin(); assert.equal(late.last('joined').frozen, true); late.ws.close();
  ph2.send({ t: 'freeze', on: false }); await sleep(90);
  assert.equal(pj.last('freeze').on, false);
  pj.clear(); ph2.clear();
  pj.send({ t: 'set', o: { id: 1, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [40, 40]] } });
  await sleep(80);
  assert.ok(ph2.last('set'), 'unfrozen students can draw again');
});

await test('freeze: a timed freeze lets go on its own', async () => {
  pj.clear();
  ph2.send({ t: 'freeze', on: true, secs: 5 }); await sleep(60);
  assert.equal(pj.last('freeze').on, true);
  await sleep(5400);
  assert.equal(pj.last('freeze').on, false, 'the server unfreezes after the seconds it was given');
});

await test('projector: up to three drawings side by side, and no more', async () => {
  const extra = [await pjoin(), await pjoin(), await pjoin()];
  const ids = [pjId, ...extra.map(c => c.last('joined').id)];
  ph2.clear(); pproj.clear();
  ph2.send({ t: 'spot', ids: ids.slice(0, 3), hide: true }); await sleep(90);
  let m = pproj.last('spot');
  assert.deepEqual(m.picks, ids.slice(0, 3)); assert.equal(m.spot, ids[0], 'spot stays the first pick for older screens');
  ph2.send({ t: 'spot', ids: [...ids, 'nobody'], hide: true }); await sleep(90);
  m = pproj.last('spot'); assert.equal(m.picks.length, 3); assert.deepEqual(m.picks, ids.slice(0, 3));
  extra[0].clear(); ph2.clear();
  extra[0].send({ t: 'set', o: { id: 2, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10]] } });
  await sleep(80);
  assert.equal(extra[0].last('lock').proj, true, 'everything on the projector is locked');
  assert.equal(ph2.last('set'), undefined);
  extra[2].send({ t: 'set', o: { id: 2, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10]] } });
  await sleep(80);
  assert.ok(ph2.last('set'), 'a student who is not up can still draw');
  pj.clear(); ph2.clear();
  ph2.send({ t: 'spot', ids: [], hide: true }); await sleep(90);
  assert.deepEqual(pproj.last('spot').picks, []); assert.equal(pj.last('lock').proj, false);
});

await test('a new question takes everyone off the projector and unlocks them', async () => {
  ph2.send({ t: 'spot', ids: [pjId], hide: true }); await sleep(90);
  assert.equal(pj.last('lock').proj, true, 'on the projector = locked');
  pj.clear(); ph2.clear();
  ph2.send({ t: 'q', question: 'Next one', bg: 'blank' }); await sleep(150);
  assert.deepEqual(ph2.last('spot').picks, [], 'the teaching screen is told the projector is clear');
  assert.equal(pj.last('lock').proj, false, 'and the student can draw again');
  pj.clear();
  pj.send({ t: 'set', o: { id: 3, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [30, 30]] } });
  await sleep(80);
  assert.ok(ph2.last('set'), 'their drawing counts on the new question');
});

await test('the report keeps one pulse snapshot per question, and clears with the class', async () => {
  pj.clear();
  pj.send({ t: 'pulse', c: 'g' }); await sleep(70);
  ph2.send({ t: 'q', question: 'Third', bg: 'blank' }); await sleep(120);
  const q = ph2.last('q');
  assert.ok(Array.isArray(q.phist), 'the host gets the history with the new question');
  assert.equal(q.phist.length, 1, 'the question that just ended is snapshotted');
  assert.equal(q.phist[0].g, 1); assert.equal(q.phist[0].r, 0);
  assert.equal(q.phist[0].by[pjId], 'g');
  assert.equal(q.phist[0].q, 'Next one');
  const st = client(); await st.ready; st.send({ t: 'host', code: 'PULSE', key: KEY });
  const s = await st.wait('state');
  assert.equal(s.phist.length, 1, 'a refresh of the teaching screen keeps the report');
  st.ws.close();
  ph2.send({ t: 'reset' }); await sleep(150);
  const st2 = client(); await st2.ready; st2.send({ t: 'host', code: 'PULSE', key: KEY });
  const s2 = await st2.wait('state');
  assert.deepEqual(s2.phist, [], 'clearing the class starts a fresh report');
  st2.ws.close();
});

// ---- a refresh in the middle of a lesson must not lose the student ----
const RES = 'RESUME';
const resHost = client(); await resHost.ready;
resHost.send({ t: 'host', code: RES, key: KEY, setup: { teams, roster: [{ rid: 'r0001', ini: 'MA', team: 'ta' }, { rid: 'r0002', ini: 'JI', team: 'tb' }], cap: false, scores: {} } });
await resHost.wait('state');
resHost.send({ t: 'q', question: 'Draw a cell', bg: 'graph' }); await sleep(80);
let resHost2;
const rjoin = async (msg) => { const c = client(); await c.ready; c.send({ t: 'join', code: RES, bw: 800, bh: 500, ...msg }); await Promise.race([c.wait('joined'), c.wait('err')]); return c; };

await test('refresh: rejoining with only the id remembered keeps the same student, team and drawing', async () => {
  const a = await rjoin({ rid: 'r0001' });
  const id = a.last('joined').id, tok = a.last('joined').tok;
  assert.equal(a.last('joined').team, 'ta');
  a.send({ t: 'set', o: { id: 1, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[20, 20], [90, 90]] } });
  await sleep(120);
  a.ws.close(); // the tab is refreshed: the socket goes, the page comes back with what it remembered
  await sleep(120);
  const b = await rjoin({ id, tok }); // no rid, no name - just the id and token this tab kept
  const j = b.last('joined');
  b.ws.close();
  assert.equal(j.id, id, 'the same student, not a new one');
  assert.equal(j.team, 'ta', 'still on their team');
  assert.equal(j.ini, 'MA');
  assert.equal(j.objs.length, 1, 'their drawing comes back from the server');
  const cards = resHost.got.filter(m => m.t === 'join').map(m => m.s.id);
  assert.ok(cards.length >= 2, 'the teacher was told the page came back');
  assert.equal(new Set(cards).size, 1, 'the same card, never a duplicate');
});

await test('refresh: a stale id falls back to picking initials instead of a dead page', async () => {
  const c = await rjoin({ id: 'not-a-real-id' });
  const e = c.last('err');
  assert.ok(e && /Pick your initials/.test(e.m), 'told to pick their initials again');
  assert.equal(e.taken, true, 'the page can show the list straight away');
  c.ws.close();
});

await test('refresh: someone else already signed in under those initials is still refused', async () => {
  const a = await rjoin({ rid: 'r0002' });
  assert.equal(a.last('joined').team, 'tb');
  const id2 = a.last('joined').id, tok2 = a.last('joined').tok;
  const b = await rjoin({ rid: 'r0002' }); // a different tab, the first one is still live
  assert.match(b.last('err').m, /already in use/);
  assert.ok(!b.last('joined'));
  a.ws.close(); await sleep(120);
  const c = await rjoin({ id: id2, tok: tok2 }); // and after the tab closes, the id alone gets back in
  assert.equal(c.last('joined').id, id2);
  c.ws.close();
});

await test('refresh: a page with stale work cannot overwrite a drawing that is on the projector', async () => {
  const a = await rjoin({ rid: 'r0001' });
  if (!a.last('joined')) console.log('DEBUG', JSON.stringify(a.got));
  const id = a.last('joined').id, tok = a.last('joined').tok;
  a.send({ t: 'set', o: { id: 7, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[30, 30], [70, 70]] } });
  await sleep(120);
  resHost.send({ t: 'spot', ids: [id] }); await sleep(120);
  a.ws.close(); await sleep(120);
  // the page reloads with its copy of the drawing (have: true) while the work is on the projector
  const b = await rjoin({ id, tok, have: true, objs: [{ id: 9, k: 'stroke', pen: 'pen', c: '#ff0000', lw: 3, dash: 'solid', pts: [[10, 10], [20, 20]] }] });
  const objs = b.last('joined').objs;
  assert.ok(objs.some(o => o.id === 7), 'the drawing the server already had is still there');
  assert.ok(!objs.some(o => o.id === 9), 'the stale copy from the reloaded page did not replace it');
  resHost.send({ t: 'spot', ids: [] }); await sleep(120);
  b.ws.close();
});

await test('refresh: a rejoin is refused when no teacher is running that class, and leaves no ghost', async () => {
  const a = await rjoin({ rid: 'r0002' });
  const id = a.last('joined').id, tok = a.last('joined').tok;
  assert.equal(a.last('joined').host, true, 'the page is told a teacher is there');
  a.ws.close(); await sleep(100);
  resHost.ws.close(); await sleep(150); // the last teacher screen in this class goes away
  const b = client(); await b.ready; b.send({ t: 'join', code: RES, id, tok, resume: true, bw: 800, bh: 500 });
  const e = await b.wait('err');
  assert.match(e.m, /finished/);
  assert.ok(!b.last('joined'), 'the page is not put into a class nobody is running');
  // a plain join still works (that is how a student gets in after the teacher is back)
  const c = await rjoin({ id, tok });
  assert.equal(c.last('joined').id, id, 'their drawing and team are still there');
  c.ws.close();
  resHost2 = client(); await resHost2.ready; resHost2.send({ t: 'host', code: RES, key: KEY }); await resHost2.wait('state');
});

await test('leaving on purpose removes the student instead of leaving a ghost card', async () => {
  const a = await rjoin({ rid: 'r0001' });
  const id = a.last('joined').id;
  resHost2.clear();
  a.send({ t: 'bye' });
  const k = await a.wait('kicked');
  assert.match(k.why, /left the class/);
  const gone = await resHost2.wait('gone');
  assert.equal(gone.id, id, 'the teacher screen is told to drop the card');
  const st = client(); await st.ready; st.send({ t: 'host', code: RES, key: KEY });
  const state = await st.wait('state');
  assert.ok(!state.students.some(s => s.id === id), 'the student is not in the room any more');
  st.ws.close();
});


// ---- Phase 1: safety ----
await test('safety: a 7 MB frame closes that socket only; the server and other classes keep running', async () => {
  const bad = client(); await bad.ready;
  const closed = new Promise(r => bad.ws.on('close', r)); bad.ws.on('error', () => {});
  bad.ws.send('x'.repeat(7e6));
  await Promise.race([closed, sleep(3000)]);
  const h = client(); await h.ready; h.send({ t: 'host', code: 'AFTER', key: KEY }); await h.wait('state');
  const c = client(); await c.ready; c.send({ t: 'join', code: 'AFTER', name: 'Ok', bw: 800, bh: 500 });
  assert.ok(await c.wait('joined'), 'a second client can still join');
  assert.equal((await fetch('http://localhost:' + PORT + '/healthz')).status, 200);
});

await test('safety: garbage and hostile messages do not take the server down', async () => {
  const c = client(); await c.ready;
  for (const m of ['null', '[]', '"x"', '{"t":"join"}', '{"t":"host","code":{},"key":[]}', '{"t":"q"}', '{"t":"sort","p":5}']) c.ws.send(m);
  c.send({ t: 'join', code: 'AFTER', name: { toString: 1 }, objs: 'no', bw: {}, bh: [] });
  await sleep(150);
  assert.equal((await fetch('http://localhost:' + PORT + '/healthz')).status, 200);
});

await test('tokens: watchers see ids but cannot use them to take over a student', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TOKEN', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'TOKEN', name: 'Alice', bw: 800, bh: 500 }); const aj = await a.wait('joined');
  assert.ok(aj.tok && aj.tok.length >= 32 && aj.tok !== aj.id, 'the student gets a separate secret');
  a.send({ t: 'set', o: { id: 1, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [40, 40]] } }); await sleep(80);
  const w = client(); await w.ready; w.send({ t: 'watch', code: 'TOKEN' }); const ws0 = await w.wait('state');
  const seen = ws0.students.find(x => x.name === 'Alice'); assert.equal(seen.id, aj.id);
  assert.ok(!JSON.stringify(ws0).includes(aj.tok), 'the token is not in what a watcher receives');
  assert.ok(!JSON.stringify(h.got).includes(aj.tok), 'nor in what the teacher receives');
  for (const extra of [{}, { tok: 'x'.repeat(72) }, { tok: seen.id }]) {
    const e = client(); await e.ready; e.send({ t: 'join', code: 'TOKEN', name: 'Mallory', id: seen.id, ...extra, bw: 800, bh: 500, objs: [], have: true });
    const j = await e.wait('joined');
    assert.notEqual(j.id, seen.id, 'a new student, not Alice'); assert.notEqual(j.tok, aj.tok);
  }
  const st = client(); await st.ready; st.send({ t: 'host', code: 'TOKEN', key: KEY }); const s2 = await st.wait('state');
  const alice = s2.students.find(x => x.id === aj.id);
  assert.equal(alice.name, 'Alice', 'not renamed'); assert.equal(alice.objs.length, 1, 'not wiped');
  const back = client(); await back.ready; back.send({ t: 'join', code: 'TOKEN', id: aj.id, tok: aj.tok, bw: 800, bh: 500 });
  const bj = await back.wait('joined'); assert.equal(bj.id, aj.id); assert.equal(bj.objs.length, 1);
});

await test('tokens: picking a disconnected student\'s initials works but cuts off the old token', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TOKR', key: KEY, setup: { teams, roster } }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'TOKR', rid: 'r0001', bw: 800, bh: 500 }); const aj = await a.wait('joined');
  a.ws.close(); await sleep(100);
  const b = client(); await b.ready; b.send({ t: 'join', code: 'TOKR', rid: 'r0001', bw: 800, bh: 500 }); const bj = await b.wait('joined');
  assert.equal(bj.id, aj.id); assert.notEqual(bj.tok, aj.tok, 'a new device gets a new secret');
  const c = client(); await c.ready; c.send({ t: 'join', code: 'TOKR', id: aj.id, tok: aj.tok, bw: 800, bh: 500 });
  assert.match((await c.wait('err')).m, /initials/, 'the old token no longer works');
});

await test('limits: one hosted class per socket', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'ONE1', key: KEY }); await h.wait('state'); h.clear();
  for (let i = 0; i < 5; i++) h.send({ t: 'host', code: 'MANY' + i, key: KEY });
  await sleep(150);
  assert.match(h.last('err').m, /already runs another class/);
  const probe = client(); await probe.ready; probe.send({ t: 'status', code: 'MANY0' });
  assert.equal((await probe.wait('status')).live, false, 'no extra class was created');
  h.clear(); h.send({ t: 'host', code: 'ONE1', key: KEY }); assert.ok(await h.wait('state'), 'the same class can be re-entered');
});

await test('limits: a flood of messages is dropped, not processed', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'FLOOD', key: KEY }); await h.wait('state');
  const c = client(); await c.ready; c.send({ t: 'join', code: 'FLOOD', name: 'Fl', bw: 800, bh: 500 }); await c.wait('joined');
  h.clear();
  for (let i = 1; i <= 400; i++) c.send({ t: 'set', o: { id: i, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [40, 40]] } });
  await sleep(500);
  const n = h.got.filter(m => m.t === 'set').length;
  assert.ok(n > 0 && n <= 65, 'about 60 got through, not 400 (' + n + ')');
});

await test('teacher can remove one student, and rename a nickname student (not a class-list one)', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'REMOVE', key: KEY, setup: { teams, roster } }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'REMOVE', rid: 'r0001', bw: 800, bh: 500 }); const aj = await a.wait('joined');
  h.clear(); h.send({ t: 'rename', id: aj.id, name: 'Hacker' }); await sleep(80);
  assert.equal(h.last('join'), undefined, 'a class-list student keeps the name from the list');
  h.send({ t: 'release', id: aj.id }); await sleep(80);
  assert.ok(a.last('kicked')); assert.equal(h.last('gone').id, aj.id);
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code: 'RENAME2', key: KEY }); await h2.wait('state');
  const b = client(); await b.ready; b.send({ t: 'join', code: 'RENAME2', name: 'Bob', bw: 800, bh: 500 }); const bj = await b.wait('joined');
  h2.clear(); h2.send({ t: 'rename', id: bj.id, name: '  Robert    with a very long name indeed ' }); await sleep(80);
  const card = h2.last('join').s; assert.equal(card.id, bj.id); assert.equal(card.name, 'Robert with a very l', 'trimmed, spaces squeezed, cut at 20 like a nickname');
  h2.clear(); h2.send({ t: 'rename', id: bj.id, name: '   ' }); await sleep(80);
  assert.match(h2.last('note').m, /name/); assert.equal(h2.last('join'), undefined);
});

await test('students cannot rename or remove each other', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'NOMOD', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'NOMOD', name: 'Ann', bw: 800, bh: 500 }); const aj = await a.wait('joined');
  const b = client(); await b.ready; b.send({ t: 'join', code: 'NOMOD', name: 'Ben', bw: 800, bh: 500 }); await b.wait('joined');
  h.clear(); b.send({ t: 'rename', id: aj.id, name: 'Zed' }); b.send({ t: 'release', id: aj.id }); await sleep(100);
  assert.equal(h.last('join'), undefined); assert.equal(h.last('gone'), undefined); assert.equal(a.last('kicked'), undefined);
});

// a second server with tight limits, to test the connection cap and the sweep of abandoned classes
await test('limits: per-address cap, and classes nobody uses are swept', async () => {
  const P2 = PORT + 600, s2 = spawn('node', ['server.js'], { env: { ...process.env, PORT: P2, MAX_PER_IP: '4', ROOM_EMPTY_MS: '300', SWEEP_MS: '200' }, stdio: 'ignore' });
  try {
    await sleep(600);
    const mk = () => { const ws = new WebSocket('ws://localhost:' + P2), got = []; ws.on('message', d => got.push(JSON.parse(d))); ws.on('error', () => {}); return { ws, got, open: new Promise(r => ws.on('open', r)), closed: new Promise(r => ws.on('close', r)) }; };
    const send = (x, o) => x.ws.send(JSON.stringify(o));
    const socks = [mk(), mk(), mk(), mk()]; await Promise.all(socks.map(x => x.open));
    const fifth = mk(); await Promise.race([fifth.closed, sleep(1500)]);
    assert.equal(fifth.ws.readyState >= 2, true, 'the 5th connection from one address is refused');
    assert.ok(fifth.got.some(m => m.t === 'err'), 'and told why');
    socks[0].ws.close(); await sleep(150);
    const again = mk(); await again.open; await sleep(150); assert.equal(again.ws.readyState, 1, 'a freed slot can be used again');
    send(socks[1], { t: 'host', code: 'EMPTY', key: KEY }); send(socks[2], { t: 'host', code: 'BUSY', key: KEY }); await sleep(150);
    send(socks[3], { t: 'join', code: 'BUSY', name: 'S', bw: 800, bh: 500 }); await sleep(150);
    socks.forEach(x => x.ws.close()); await sleep(900);
    send(again, { t: 'status', code: 'EMPTY' }); send(again, { t: 'status', code: 'BUSY' }); await sleep(200);
    const stat = c => again.got.find(m => m.t === 'status' && m.code === c);
    assert.equal(stat('EMPTY').live, false, 'an empty abandoned class is deleted'); assert.equal(stat('BUSY').live, true, 'a class with a student in it is kept');
  } finally { s2.kill(); }
});


// ---- Phase 2: classroom reliability ----
await test('restore: a brand-new class takes the teacher\'s last question back without wiping drawings', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'RESTO', key: KEY }); const st0 = await h.wait('state');
  assert.equal(st0.fresh, true, 'the teacher page can tell the class is brand new');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'RESTO', name: 'Rae', bw: 800, bh: 500 }); await a.wait('joined');
  a.send({ t: 'set', o: { id: 1, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [40, 40]] } }); await sleep(80);
  const p = client(); await p.ready; p.send({ t: 'watch', code: 'RESTO' }); await p.wait('state');
  a.clear(); h.clear(); p.clear();
  h.send({ t: 'restore', question: 'Draw the water cycle', bg: 'blank' }); await sleep(100);
  assert.match(a.last('restore').q.question, /water cycle/); assert.match(p.last('restore').q.question, /water cycle/); assert.ok(h.last('restore'));
  assert.equal(a.last('q'), undefined, 'not a new question'); assert.equal(h.last('q'), undefined);
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code: 'RESTO', key: KEY }); const st = await h2.wait('state');
  assert.equal(st.fresh, false); assert.match(st.q.question, /water cycle/); assert.equal(st.students[0].objs.length, 1, 'the drawing stays');
  const late = client(); await late.ready; late.send({ t: 'join', code: 'RESTO', name: 'Lee', bw: 800, bh: 500 });
  assert.match((await late.wait('joined')).q.question, /water cycle/, 'late joiners get the question');
  h.send({ t: 'restore', question: 'Something else', bg: 'blank' }); await sleep(80);
  assert.match((await (async () => { const x = client(); await x.ready; x.send({ t: 'host', code: 'RESTO', key: KEY }); return x.wait('state'); })()).q.question, /water cycle/, 'a second restore is ignored');
});

await test('restore: refused once a real question has been sent, and students cannot restore', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'RESTO2', key: KEY }); await h.wait('state');
  h.send({ t: 'q', question: 'Real one', bg: 'blank' }); await sleep(60);
  h.send({ t: 'restore', question: 'Old one', bg: 'blank' }); await sleep(80);
  const a = client(); await a.ready; a.send({ t: 'join', code: 'RESTO2', name: 'Al', bw: 800, bh: 500 });
  assert.match((await a.wait('joined')).q.question, /Real one/);
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code: 'RESTO3', key: KEY }); await h2.wait('state');
  const s = client(); await s.ready; s.send({ t: 'join', code: 'RESTO3', name: 'Sy', bw: 800, bh: 500 }); await s.wait('joined');
  s.send({ t: 'restore', question: 'Hijack', bg: 'blank' }); await sleep(80);
  const l = client(); await l.ready; l.send({ t: 'join', code: 'RESTO3', name: 'Lu', bw: 800, bh: 500 });
  assert.ok(!/Hijack/.test((await l.wait('joined')).q.question));
});


await test('undo: a replaced question comes back with every drawing, for 15 seconds', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'UNDO', key: KEY }); await h.wait('state');
  h.send({ t: 'q', question: 'First', bg: 'blank' }); await sleep(60);
  const a = client(); await a.ready; a.send({ t: 'join', code: 'UNDO', name: 'Una', bw: 800, bh: 500 }); await a.wait('joined');
  a.send({ t: 'set', o: { id: 1, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [40, 40]] } });
  a.send({ t: 'pulse', c: 'g' }); await sleep(80);
  h.send({ t: 'q', question: 'Second', bg: 'blank' }); await sleep(80);
  assert.equal(h.last('q').q.question, 'Second');
  a.clear(); h.clear(); h.send({ t: 'undoq' }); await sleep(120);
  const st = h.last('state'); assert.equal(st.q.question, 'First'); assert.equal(st.students[0].objs.length, 1); assert.equal(st.students[0].pulse, 'g');
  assert.equal(st.fresh, false);
  const j = a.last('joined'); assert.equal(j.undo, true); assert.equal(j.q.question, 'First'); assert.equal(j.objs.length, 1); assert.equal(j.pulse, 'g');
  h.clear(); h.send({ t: 'undoq' }); await sleep(80);
  assert.match(h.last('note').m, /Too late/, 'only once');
  // the report history is rolled back too
  h.send({ t: 'q', question: 'Third', bg: 'blank' }); await sleep(80);
  assert.equal(h.last('q').phist.length, 1, 'First was snapshotted once, not twice');
});

await test('undo: students cannot undo, and Clear class forgets the old question', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'UNDO2', key: KEY }); await h.wait('state');
  h.send({ t: 'q', question: 'A', bg: 'blank' }); await sleep(40);
  const a = client(); await a.ready; a.send({ t: 'join', code: 'UNDO2', name: 'Ula', bw: 800, bh: 500 }); await a.wait('joined');
  h.send({ t: 'q', question: 'B', bg: 'blank' }); await sleep(60);
  a.send({ t: 'undoq' }); await sleep(80);
  const peek = client(); await peek.ready; peek.send({ t: 'host', code: 'UNDO2', key: KEY }); assert.equal((await peek.wait('state')).q.question, 'B', 'a student cannot undo');
  h.send({ t: 'reset' }); await sleep(80); h.clear(); h.send({ t: 'undoq' }); await sleep(80);
  assert.match(h.last('note').m, /Too late/);
});

await test('undo: the window closes after UNDO_MS', async () => {
  const P2 = PORT + 700, s2 = spawn('node', ['server.js'], { env: { ...process.env, PORT: P2, UNDO_MS: '300' }, stdio: 'ignore' });
  try {
    await sleep(600);
    const mk = () => { const ws = new WebSocket('ws://localhost:' + P2), got = []; ws.on('message', d => got.push(JSON.parse(d))); return { ws, got, open: new Promise(r => ws.on('open', r)) }; };
    const send = (x, o) => x.ws.send(JSON.stringify(o));
    const h = mk(); await h.open; send(h, { t: 'host', code: 'LATE', key: KEY }); send(h, { t: 'q', question: 'One', bg: 'blank' }); send(h, { t: 'q', question: 'Two', bg: 'blank' });
    await sleep(700); send(h, { t: 'undoq' }); await sleep(150);
    assert.match(h.got.filter(m => m.t === 'note').pop().m, /Too late/);
  } finally { s2.kill(); }
});


await test('duplicate nicknames get a number; rejoining keeps your own name', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'DUPS', key: KEY }); await h.wait('state');
  const names = [];
  for (const n of ['Sam', 'sam', 'Sam', ' SAM ', 'Alex']) { const c = client(); await c.ready; c.send({ t: 'join', code: 'DUPS', name: n, bw: 800, bh: 500 }); await c.wait('joined'); names.push(c); }
  const st = client(); await st.ready; st.send({ t: 'host', code: 'DUPS', key: KEY }); const s = await st.wait('state');
  assert.deepEqual(s.students.map(x => x.name), ['Sam', 'sam 2', 'Sam 3', 'SAM 4', 'Alex']);
  const j = names[0].last('joined'); const again = client(); await again.ready; again.send({ t: 'join', code: 'DUPS', name: 'Sam', id: j.id, tok: j.tok, bw: 800, bh: 500 }); await again.wait('joined');
  const st2 = client(); await st2.ready; st2.send({ t: 'host', code: 'DUPS', key: KEY }); assert.equal((await st2.wait('state')).students[0].name, 'Sam', 'not renamed to "Sam 2"');
  const long = client(); await long.ready; long.send({ t: 'join', code: 'DUPS', name: 'Abcdefghijklmnopqrst', bw: 800, bh: 500 }); await long.wait('joined');
  const long2 = client(); await long2.ready; long2.send({ t: 'join', code: 'DUPS', name: 'Abcdefghijklmnopqrst', bw: 800, bh: 500 }); await long2.wait('joined');
  const st3 = client(); await st3.ready; st3.send({ t: 'host', code: 'DUPS', key: KEY }); const all = (await st3.wait('state')).students.map(x => x.name);
  assert.ok(all.includes('Abcdefghijklmnopqr 2') && all.every(n => n.length <= 20), all.join('|'));
});


await test('live flag: a closed tab is marked not live, and a return makes it live again', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'LIVE1', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'LIVE1', name: 'Lia', bw: 800, bh: 500 }); const aj = await a.wait('joined');
  const b = client(); await b.ready; b.send({ t: 'join', code: 'LIVE1', name: 'Bo', bw: 800, bh: 500 }); await b.wait('joined');
  const st0 = client(); await st0.ready; st0.send({ t: 'host', code: 'LIVE1', key: KEY });
  assert.deepEqual((await st0.wait('state')).students.map(x => x.live), [true, true]);
  h.clear(); a.ws.close(); await sleep(120);
  const m = h.last('live'); assert.deepEqual([m.id, m.on], [aj.id, false]);
  const st1 = client(); await st1.ready; st1.send({ t: 'host', code: 'LIVE1', key: KEY });
  assert.deepEqual((await st1.wait('state')).students.map(x => x.live), [false, true], 'a teacher who reloads still sees who left');
  h.clear(); const back = client(); await back.ready; back.send({ t: 'join', code: 'LIVE1', name: 'Lia', id: aj.id, tok: aj.tok, bw: 800, bh: 500 }); await back.wait('joined');
  assert.equal(h.last('join').s.live, true);
  h.clear(); b.send({ t: 'bye' }); await sleep(100);
  assert.equal(h.last('live'), undefined, 'leaving on purpose removes the card instead'); assert.ok(h.last('gone'));
});


await test('size: an empty page takes a new shape; a page with a drawing does not', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'SIZE', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'SIZE', name: 'Sia', bw: 360, bh: 700 }); const aj = await a.wait('joined');
  assert.deepEqual([aj.bw, aj.bh], [360, 700]);
  a.clear(); h.clear(); a.send({ t: 'size', bw: 780, bh: 330 }); await sleep(100);
  assert.deepEqual([a.last('size').bw, a.last('size').bh], [780, 330]); assert.deepEqual([h.last('join').s.bw, h.last('join').s.bh], [780, 330]);
  a.send({ t: 'size', bw: 99999, bh: 'x' }); a.send({ t: 'size', bw: 10, bh: 10 }); await sleep(80);
  assert.equal(a.got.filter(m => m.t === 'size').length, 1, 'nonsense sizes are ignored');
  a.send({ t: 'set', o: { id: 1, k: 'stroke', pen: 'pen', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [40, 40]] } }); await sleep(60);
  a.clear(); a.send({ t: 'size', bw: 400, bh: 800 }); await sleep(80);
  assert.equal(a.last('size'), undefined, 'once something is drawn the page keeps its shape');
  const back = client(); await back.ready; back.send({ t: 'join', code: 'SIZE', name: 'Sia', id: aj.id, tok: aj.tok, bw: 400, bh: 800 });
  assert.deepEqual([(await back.wait('joined')).bw, back.last('joined').bh], [780, 330]);
});


await test('routes: /Teacher, /teacher/, /join and /favicon.ico work; unknown pages get a friendly 404', async () => {
  const get = async p => { const r = await fetch('http://localhost:' + PORT + p, { redirect: 'manual' }); return { s: r.status, t: r.headers.get('content-type'), b: await r.text() }; };
  for (const p of ['/teacher', '/teacher/', '/Teacher', '/TEACHER/', '/class/?code=ABCD', '/Sets']) { const r = await get(p); assert.equal(r.s, 200, p); assert.match(r.t, /text\/html/, p); }
  assert.match((await get('/join')).b, /<title>Draw It Out<\/title>/, '/join is the student page');
  assert.match((await get('/join/')).b, /<title>Draw It Out<\/title>/);
  const fav = await get('/favicon.ico'); assert.equal(fav.s, 200); assert.match(fav.t, /svg/);
  const nf = await get('/no-such-page'); assert.equal(nf.s, 404); assert.match(nf.t, /text\/html/);
  assert.match(nf.b, /href="\/"/); assert.match(nf.b, /href="\/teacher"/); assert.match(nf.b, /Join a class/);
  assert.equal((await get('/nope.html')).s, 404);
  const js = await get('/missing.js'); assert.equal(js.s, 404); assert.equal(js.b, 'Not found', 'missing files are a plain 404, not a page');
  assert.equal((await get('/../server.js')).s, 404, 'no way out of the public folder');
  assert.equal((await get('/%2e%2e/server.js')).s, 404);
  assert.equal((await get('/%E0%A4%A')).s, 400, 'a broken address does not crash the server');
  assert.equal((await get('/healthz')).b, 'ok');
});


// ---- Phase 3: class timer ----
await test('timer: start sends milliseconds remaining to everyone, and a late joiner gets what is left', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TIME1', key: KEY }); const st0 = await h.wait('state'); assert.equal(st0.timer, null);
  const a = client(); await a.ready; a.send({ t: 'join', code: 'TIME1', name: 'Tia', bw: 800, bh: 500 }); await a.wait('joined');
  const p = client(); await p.ready; p.send({ t: 'watch', code: 'TIME1' }); await p.wait('state');
  h.clear(); a.clear(); p.clear(); h.send({ t: 'timer', secs: 120 }); await sleep(100);
  for (const c of [h, a, p]) { const m = c.last('timer'); assert.ok(m.left > 118000 && m.left <= 120000, 'left=' + m.left); assert.equal(m.paused, false); assert.equal(m.at, undefined, 'no clock time is sent'); assert.ok(!('endsAt' in m)); }
  await sleep(1100);
  const late = client(); await late.ready; late.send({ t: 'join', code: 'TIME1', name: 'Lou', bw: 800, bh: 500 });
  const j = await late.wait('joined'); assert.ok(j.timer.left > 116000 && j.timer.left < 119000, 'late joiner sees the time left (' + j.timer.left + ')');
  const w = client(); await w.ready; w.send({ t: 'watch', code: 'TIME1' }); const s = await w.wait('state'); assert.ok(s.timer.left < 119000 && s.timer.left > 116000, 'a refreshed projector or teacher page too');
});

await test('timer: pause holds the value, resume continues, add extends, stop clears', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TIME2', key: KEY }); await h.wait('state');
  h.send({ t: 'timer', secs: 60 }); await sleep(1100);
  h.clear(); h.send({ t: 'timer', pause: true }); await sleep(80);
  const held = h.last('timer'); assert.equal(held.paused, true); assert.ok(held.left < 59500 && held.left > 57500, 'left=' + held.left);
  await sleep(1200);
  const w = client(); await w.ready; w.send({ t: 'watch', code: 'TIME2' }); const s = await w.wait('state');
  assert.equal(s.timer.paused, true); assert.equal(s.timer.left, held.left, 'a paused timer does not move');
  h.clear(); h.send({ t: 'timer', add: 60 }); await sleep(80);
  assert.equal(h.last('timer').left, held.left + 60000, 'add extends a paused timer'); assert.equal(h.last('timer').paused, true);
  h.send({ t: 'timer', pause: false }); await sleep(1100);
  const r = client(); await r.ready; r.send({ t: 'watch', code: 'TIME2' }); const s2 = await r.wait('state');
  assert.equal(s2.timer.paused, false); assert.ok(s2.timer.left < held.left + 60000 - 900 && s2.timer.left > held.left + 60000 - 2500, 'running again: ' + s2.timer.left);
  h.clear(); h.send({ t: 'timer', add: 30 }); await sleep(80);
  assert.ok(h.last('timer').left > s2.timer.left + 28000, 'add extends a running timer');
  h.send({ t: 'timer', add: 99999 }); h.send({ t: 'timer', add: -5 }); h.send({ t: 'timer', add: 'x' }); await sleep(80);
  assert.ok(h.last('timer').left <= 3600000, 'nonsense or huge additions are ignored or capped');
  h.clear(); h.send({ t: 'timer', off: true }); await sleep(80); assert.equal(h.last('timer').off, true);
  h.clear(); h.send({ t: 'timer', pause: true }); h.send({ t: 'timer', add: 10 }); await sleep(80); assert.equal(h.last('timer'), undefined, 'nothing to pause or extend');
});

await test('timer: out-of-range starts are refused (5 s to 60 min)', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TIME3', key: KEY }); await h.wait('state'); h.clear();
  for (const secs of [0, 4, 3601, -1, 'abc', null, NaN, {}]) h.send({ t: 'timer', secs });
  await sleep(100); assert.equal(h.last('timer'), undefined);
  h.send({ t: 'timer', secs: 5 }); h.send({ t: 'timer', secs: 3600 }); await sleep(100);
  assert.ok(h.last('timer').left > 3598000, 'the last valid start wins');
});

await test('timer: a new question and Clear class stop it, and a freeze does not', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TIME4', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'TIME4', name: 'Tom', bw: 800, bh: 500 }); await a.wait('joined');
  h.send({ t: 'timer', secs: 90 }); await sleep(60); a.clear();
  h.send({ t: 'freeze', on: true }); await sleep(80);
  const w = client(); await w.ready; w.send({ t: 'watch', code: 'TIME4' }); assert.ok((await w.wait('state')).timer, 'the timer keeps running during a freeze');
  h.send({ t: 'q', question: 'Next', bg: 'blank' }); await sleep(100);
  assert.equal(a.last('timer').off, true, 'students are told it stopped');
  const w2 = client(); await w2.ready; w2.send({ t: 'watch', code: 'TIME4' }); assert.equal((await w2.wait('state')).timer, null);
  h.send({ t: 'timer', secs: 90 }); await sleep(60); h.send({ t: 'reset' }); await sleep(100);
  const w3 = client(); await w3.ready; w3.send({ t: 'watch', code: 'TIME4' }); assert.equal((await w3.wait('state')).timer, null, 'Clear class stops it');
});

await test('timer: students and watchers cannot send timer messages', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TIME5', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'TIME5', name: 'Uma', bw: 800, bh: 500 }); await a.wait('joined');
  const p = client(); await p.ready; p.send({ t: 'watch', code: 'TIME5' }); await p.wait('state'); h.clear();
  a.send({ t: 'timer', secs: 30 }); p.send({ t: 'timer', secs: 30 }); await sleep(100);
  assert.equal(h.last('timer'), undefined);
  h.send({ t: 'timer', secs: 100 }); await sleep(60); h.clear();
  a.send({ t: 'timer', off: true }); a.send({ t: 'timer', add: 600 }); a.send({ t: 'timer', pause: true }); p.send({ t: 'timer', off: true }); await sleep(100);
  assert.equal(h.last('timer'), undefined); const w = client(); await w.ready; w.send({ t: 'watch', code: 'TIME5' });
  const s = await w.wait('state'); assert.equal(s.timer.paused, false); assert.ok(s.timer.left < 100000);
});

await test('timer: at zero everyone gets done once; the freeze option freezes the class', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'TIME6', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'TIME6', name: 'Val', bw: 800, bh: 500 }); await a.wait('joined');
  const p = client(); await p.ready; p.send({ t: 'watch', code: 'TIME6' }); await p.wait('state'); h.clear(); a.clear(); p.clear();
  h.send({ t: 'timer', secs: 5, freeze: true }); await sleep(5600);
  for (const c of [h, a, p]) assert.equal(c.got.filter(m => m.t === 'timer' && m.done).length, 1, 'exactly one done');
  assert.equal(a.last('freeze').on, true, 'the class froze when time was up');
  const w = client(); await w.ready; w.send({ t: 'watch', code: 'TIME6' }); assert.equal((await w.wait('state')).timer, null, 'no timer left after done');
  h.send({ t: 'freeze', on: false }); await sleep(60);
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code: 'TIME7', key: KEY }); await h2.wait('state');
  const b = client(); await b.ready; b.send({ t: 'join', code: 'TIME7', name: 'Wes', bw: 800, bh: 500 }); await b.wait('joined');
  h2.send({ t: 'timer', secs: 5 }); await sleep(5600);
  assert.equal(b.got.filter(m => m.t === 'timer' && m.done).length, 1); assert.equal(b.last('freeze'), undefined, 'without the option, nothing freezes and drawing stays open');
});


// ---- Phase 4: the shared question validator (public/sortkit.js) is loaded here exactly as the browser loads it ----
const SK = new Function(fs.readFileSync('public/sortkit.js', 'utf8') + '\nreturn SK;')(); // same realm, so deepEqual works
const okQ = r => { const c = SK.checkQuestion(r); assert.deepEqual(c.problems, [], JSON.stringify(c.problems)); return c.q; };

await test('validator: agrees with the server on formatting, lengths and sort rules', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'VALID', key: KEY }); await h.wait('state');
  const texts = ['Plain <b>bold</b> and <I>italic</I> <u>under</u>', 'x<script>alert(1)</script>y <img src=x onerror=1> a < b > c', 'line<br>one<br/>two<BR />three', '<b>unclosed', 'a'.repeat(2500), '<<b>>nested<</b>>', 'Tom & Jerry &lt;tag&gt;'];
  for (const text of texts) {
    h.clear(); h.send({ t: 'q', question: text, bg: 'blank' }); await sleep(60);
    assert.equal(SK.cleanHtml(text), h.last('q').q.question, 'html rules match the server for ' + JSON.stringify(text.slice(0, 40)));
  }
  const lanes = [{ id: 'A', name: 'Igneous rocks form from cooling magma and lava' }, { id: 'B', name: 'Sedimentary' }, { id: 'C', name: 'Metamorphic' }];
  const cards = [{ id: 1, text: 'Granite '.repeat(10), lane: 'A', idea: 'Where it forms, and what it looks like' }, { id: 2, text: 'Limestone', lane: 'B' }, { id: 3, text: 'Marble', lane: 'C', idea: 'Clue' }];
  h.clear(); h.send({ t: 'q', kind: 'sort', question: 'Sort', sort: { lanes, cards } }); await sleep(80);
  const srv = h.last('q'), mine = okQ({ question: 'Sort', kind: 'sort', sort: { lanes, cards } });
  assert.deepEqual(mine.sort.lanes, srv.q.sort.lanes, 'lane names are cut at the same length');
  assert.deepEqual(mine.sort.cards.map(c => [c.id, c.text]), srv.q.sort.cards.map(c => [c.id, c.text]), 'card text is cut at the same length');
  assert.deepEqual(Object.fromEntries(mine.sort.cards.map(c => [c.id, c.idea]).filter(x => x[1])), srv.sk.idea, 'ideas are cut at the same length');
  assert.deepEqual(Object.fromEntries(mine.sort.cards.map(c => [c.id, c.lane])), srv.sk.lane);
});

await test('validator: tags are cleaned (5 max, 30 characters, text only, case-insensitive)', () => {
  const g = SK.cleanTags(['Rock cycle', ' rock   CYCLE ', 'MS-ESS2-1', '<b>Bold</b> tag', 'x'.repeat(40), 'five', 'six', 'seven', 7, null, {}, '']);
  assert.deepEqual(g.tags, ['Rock cycle', 'MS-ESS2-1', 'Bold tag', 'x'.repeat(30), 'five']);
  assert.ok(g.notes.some(n => /shortened/.test(n)) && g.notes.some(n => /extra tags were left out/.test(n)), g.notes.join('|'));
  assert.deepEqual(SK.cleanTags('Rock cycle, Plate tectonics ,, rock CYCLE').tags, ['Rock cycle', 'Plate tectonics'], 'a comma-separated string works');
  assert.deepEqual(SK.cleanTags(undefined).tags, []);
  assert.equal(SK.cleanTag('<script>alert(1)</script>x'), 'alert(1) x');
  assert.equal(SK.tagKey('  Rock   Cycle '), 'rock cycle');
  assert.deepEqual(SK.tagsOf({ tags: ['B', 'a'] }, { tags: ['A', 'c'] }), ['A', 'c', 'B'], 'a question counts its set\'s tags plus its own, once each');
});

await test('validator: draw questions', () => {
  assert.deepEqual(okQ({ question: 'Draw it', bg: 'graph', tags: ['Rock cycle'] }), { question: 'Draw it', bg: 'graph', img: null, tags: ['Rock cycle'] });
  const odd = SK.checkQuestion({ question: 'Hi <marquee>there</marquee>', bg: 'neon' });
  assert.equal(odd.q.bg, 'blank'); assert.equal(odd.q.question, 'Hi there'); assert.ok(odd.notes.some(n => /formatting/.test(n)) && odd.notes.some(n => /neon/.test(n)));
  assert.match(SK.checkQuestion({ question: '   ', bg: 'blank' }).problems[0], /no question text/);
  assert.match(SK.checkQuestion({ question: '<b></b>' }).problems[0], /no question text/);
  assert.match(SK.checkQuestion('nope').problems[0], /not a question/); assert.match(SK.checkQuestion(null).problems[0], /not a question/); assert.match(SK.checkQuestion([1]).problems[0], /not a question/);
  assert.equal(SK.checkQuestion({ question: 'a'.repeat(2100) }).q.question.length, 2000); assert.ok(SK.checkQuestion({ question: 'a'.repeat(2100) }).notes.some(n => /2000/.test(n)));
  const jpg = 'data:image/jpeg;base64,/9j/4AAQ';
  assert.equal(okQ({ question: '', bg: 'photo', img: jpg }).img, jpg, 'a photo question with no text is fine');
  assert.equal(SK.checkQuestion({ question: 'x', bg: 'photo', img: 'http://evil/x.png' }).q.bg, 'blank', 'only embedded JPEGs are kept');
});

await test('validator: sort questions report problems in plain words', () => {
  const lanes = [{ id: 'A', name: 'Igneous' }, { id: 'B', name: 'Sedimentary' }];
  const good = [{ id: 1, text: 'Granite', lane: 'A' }, { id: 2, text: 'Limestone', lane: 'B' }];
  const p = (o) => SK.checkQuestion({ question: 'Sort', kind: 'sort', sort: { lanes, cards: good, ...o } }).problems;
  assert.deepEqual(p({}), []);
  assert.deepEqual(p({ cards: [...good, { id: 3, text: 'Basalt', lane: 'Z' }] }), ['the card "Basalt" points to a lane that does not exist ("Z")']);
  assert.match(p({ cards: [...good, { id: 3, text: 'Basalt' }] })[0], /Basalt.*no lane/);
  assert.match(p({ lanes: [lanes[0]] })[0], /at least 2 lanes/); assert.match(p({ cards: [good[0]] })[0], /at least 2 cards/);
  assert.match(p({ lanes: [...lanes, ...'CDEFG'.split('').map(x => ({ id: x, name: x }))] }).join(), /has 7 lanes, and the most is 6/);
  assert.match(p({ cards: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, text: 'c' + i, lane: 'A' })) }).join(), /25 cards, and the most is 24/);
  assert.match(p({ lanes: [{ id: 'A', name: '' }, lanes[1]] })[0], /lane 1 has no name/); assert.match(p({ lanes: [{ id: 'A b', name: 'x' }, lanes[1]] })[0], /id of 1 to 8 letters or numbers/);
  assert.match(p({ lanes: [lanes[0], { id: 'A', name: 'Dup' }] })[0], /share the id "A"/); assert.match(p({ cards: [{ id: 1, text: '', lane: 'A' }, good[1]] })[0], /card 1 has no text/);
  assert.deepEqual(SK.checkQuestion({ question: 'Sort', kind: 'sort' }).problems, ['is a sort question with no "sort" part']);
  const auto = okQ({ question: 'Sort', kind: 'sort', sort: { lanes, cards: [{ id: 'c1', text: 'Granite', lane: 'A' }, { id: 'c2', text: 'Limestone', lane: 'B', idea: 'Clue' }] } });
  assert.deepEqual(auto.sort.cards.map(c => c.id), [1, 2], 'text ids are replaced with numbers');
  assert.equal(auto.sort.cards[1].idea, 'Clue');
  const dupIds = okQ({ question: 'Sort', kind: 'sort', sort: { lanes, cards: [{ id: 1, text: 'a', lane: 'A' }, { id: 1, text: 'b', lane: 'B' }] } }); assert.deepEqual(dupIds.sort.cards.map(c => c.id), [1, 2]);
});

await test('validator: finds the JSON in a reply (code block, sentences around it, brackets in prose)', () => {
  const set = [{ name: 'Rocks', questions: [{ question: 'Draw it', bg: 'blank', tags: ['Rock cycle'] }] }];
  const js = JSON.stringify(set);
  for (const reply of [js, '```json\n' + js + '\n```', 'Sure! Here is your set [as requested]:\n\n' + js + '\n\nHope this helps {really}.', '  \n' + js, 'Intro [1] and {x}\n```\n' + js + '\n```\nOutro']) {
    const r = SK.parseSets(reply); assert.equal(r.error, '', reply.slice(0, 30)); assert.equal(r.sets[0].name, 'Rocks'); assert.equal(r.sets[0].questions[0].question, 'Draw it');
  }
  assert.match(SK.parseSets('no json here at all').error, /could not find any JSON/);
  assert.match(SK.parseSets('[1, 2, 3] and {"a": 1}').error, /no questions/);
  assert.match(SK.parseSets('{"name":"x","questions":[').error, /could not find/, 'a cut-off reply is not mistaken for a set');
  assert.equal(SK.parseSets('{"questions":[{"question":"A"}]}').sets[0].questions.length, 1, 'a single set object');
  assert.equal(SK.parseSets('[{"question":"A"},{"question":"B"}]').sets[0].questions.length, 2, 'a bare list of questions');
  assert.equal(SK.parseSets('{"sets":[{"name":"S1","questions":[{"question":"A"}]},{"name":"S2","questions":[{"question":"B"}]}]}').sets.length, 2);
  assert.equal(SK.parseSets('[{"name":"A \\"quoted\\" ] name","questions":[{"question":"A } tricky"}]}]').sets[0].name, 'A "quoted" ] name', 'brackets inside strings do not end the JSON');
  assert.deepEqual(SK.parseSets('[{"name":"T","tags":["a","A","b"],"questions":[{"question":"A"}]}]').sets[0].tags, ['a', 'b']);
});


await test('privacy: tags never reach the server, students or the projector', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'PRIVT', key: KEY }); await h.wait('state');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'PRIVT', name: 'Pat', bw: 800, bh: 500 }); await a.wait('joined');
  const p = client(); await p.ready; p.send({ t: 'watch', code: 'PRIVT' }); await p.wait('state');
  h.send({ t: 'q', question: 'Draw it', bg: 'blank', tags: ['SecretTag'], setTags: ['SetSecret'] });
  h.send({ t: 'q', kind: 'sort', question: 'Sort', tags: ['SecretTag2'], sort: { tags: ['x'], lanes: [{ id: 'A', name: 'a', tags: ['SecretLane'] }, { id: 'B', name: 'b' }], cards: [{ id: 1, text: 'one', lane: 'A', tags: ['SecretCard'] }, { id: 2, text: 'two', lane: 'B' }] } });
  await sleep(150);
  const late = client(); await late.ready; late.send({ t: 'join', code: 'PRIVT', name: 'Lee', bw: 800, bh: 500 }); await late.wait('joined');
  const lw = client(); await lw.ready; lw.send({ t: 'watch', code: 'PRIVT' }); await lw.wait('state');
  const lh = client(); await lh.ready; lh.send({ t: 'host', code: 'PRIVT', key: KEY }); await lh.wait('state');
  for (const [who, c] of [['student', a], ['late student', late], ['projector', p], ['late projector', lw], ['teacher', h], ['reloaded teacher', lh]]) assert.ok(!/Secret|"tags"/.test(JSON.stringify(c.got)), who + ' never sees tags');
});


// ---- the AI prompt (public/aibuild.js is loaded here without a browser: only buildPrompt and examples are used) ----
const AIB = new Function('SK', 'el', 'tagInput', 'tagUsage', 'toast', 'showCopy', 'localStorage', 'tagLabel', fs.readFileSync('public/aibuild.js', 'utf8') + '\nreturn AIB;')(SK, null, null, null, null, null, {}, t => t);

await test('prompt: the worked examples pass the same validator the pasted answer goes through', () => {
  for (const type of ['draw', 'sort', 'mix']) for (const lanes of [2, 3, 4]) for (const ideas of [true, false]) for (const lang of ['none', 'frame']) for (const tags of [[], ['Rock cycle', 'MS-ESS2-1']]) {
    const ex = AIB.examples(AIB.clampOpts({ type, lanes, ideas, lang, tags }));
    for (const k of ['draw', 'sort']) {
      const c = SK.checkQuestion(ex[k]); assert.deepEqual(c.problems, [], type + ' ' + k + ' lanes=' + lanes + ': ' + JSON.stringify(c.problems));
      assert.deepEqual(c.notes, [], 'no fixes needed: ' + JSON.stringify(c.notes));
      assert.deepEqual(c.q.tags, tags.length ? tags : ['Rock cycle']);
    }
    const s = ex.sort.sort; for (const l of s.lanes) assert.ok(s.cards.filter(c => c.lane === l.id).length >= 2, 'every lane in the example has 2+ cards (' + lanes + ' lanes)');
    assert.equal(!!s.cards[0].idea, ideas);
  }
});

await test('prompt: states the format, the limits and the options the teacher chose', () => {
  const p = AIB.buildPrompt({ type: 'mix', goal: 'MS-ESS2-1: cycling of Earth\'s materials', tags: ['Rock cycle', 'MS-ESS2-1'], grade: '8th grade', n: 6, lang: 'frame', lanes: 4, cards: 10, ideas: true });
  for (const re of [/REPLY WITH JSON ONLY/, /\[\{"name"/, /"bg": "blank"/, /"kind": "sort"/, /at most 2000 characters/, /<b>, <i>, <u> and <br>/, /Lane name: at most 24 characters/, /Card text: at most 60 characters/, /Idea: at most 30 characters/, /at most 5 per question, at most 30 characters/,
    /Lanes: 2 to 6/, /Cards: 2 to 24/, /exactly 4 lanes/, /exactly 10 cards/, /"idea"/, /MS-ESS2-1: cycling of Earth's materials/, /8th grade/, /Write 3 draw questions and 3 sort questions/, /exactly these tags.*"Rock cycle", "MS-ESS2-1"/, /Sentence frame:/,
    /misconception/, /two minutes/, /every card's lane must be|every card's lane exists/i, /multilingual/, /WORKED EXAMPLES/]) assert.match(p, re);
  const draw = AIB.buildPrompt({ type: 'draw', goal: 'g', n: 3 }); assert.ok(!/SORT QUESTIONS/.test(draw) && !/Lane name/.test(draw) && !/sort question:/.test(draw)); assert.match(draw, /Every question is a draw question/); assert.match(draw, /1 to 3 short labels/);
  const sort = AIB.buildPrompt({ type: 'sort', goal: 'g', n: 4, ideas: false }); assert.ok(!/DRAW QUESTIONS/.test(sort)); assert.match(sort, /Leave the "idea" field out/);
  assert.ok(!/multilingual/.test(AIB.buildPrompt({ goal: 'g' })), 'no language block when support is off');
  assert.match(AIB.buildPrompt({ goal: 'g', lang: 'simple' }), /Use short sentences/); assert.ok(!/Sentence frame:/.test(AIB.buildPrompt({ goal: 'g', lang: 'simple' }).split('WORKED')[0]));
  // option limits are enforced
  const c = AIB.clampOpts({ n: 99, lanes: 9, cards: 1, type: 'x', lang: 'y', tags: ['a', 'b', 'c', 'd', 'e', 'f'] }); assert.deepEqual([c.n, c.lanes, c.cards, c.type, c.lang, c.tags.length], [10, 4, 6, 'draw', 'none', 5]);
  assert.equal(AIB.clampOpts({ n: 1 }).n, 3);
});


await test('paste check: good questions pass, bad ones say what is wrong, per question', () => {
  const reply = 'Here you go!\n```json\n' + JSON.stringify([{ name: 'Rocks & minerals', tags: ['Unit 3'], questions: [
    { question: 'Draw the <b>rock cycle</b>.', bg: 'blank', tags: ['Rock cycle', 'MS-ESS2-1'] },
    { question: 'Sort these.', kind: 'sort', tags: ['Rock cycle'], sort: { lanes: [{ id: 'A', name: 'Igneous' }, { id: 'B', name: 'Sedimentary' }], cards: [{ id: 1, text: 'Granite', lane: 'A', idea: 'Forms' }, { id: 2, text: 'Basalt', lane: 'Z' }, { id: 3, text: 'Sandstone', lane: 'B' }] } },
    { question: '', bg: 'graph' },
    { question: 'Graph the <script>x</script> speed.', bg: 'neon', tags: ['t1', 't2', 't3', 't4', 't5', 't6'] },
    { question: 'Sort fine', kind: 'sort', sort: { lanes: [{ id: 'A', name: 'x'.repeat(40) }, { id: 'B', name: 'Y' }], cards: [{ id: 'a', text: 'one', lane: 'A' }, { id: 'b', text: 'two', lane: 'B' }] } },
  ] }]) + '\n```\nLet me know if you want more!';
  const r = AIB.check(reply); assert.equal(r.length, 1); const rows = r[0].rows;
  assert.equal(r[0].name, 'Rocks & minerals'); assert.deepEqual(r[0].tags, ['Unit 3']);
  assert.deepEqual(rows.map(x => !!x.q), [true, false, false, true, true]);
  assert.deepEqual(rows[1].problems, ['the card "Basalt" points to a lane that does not exist ("Z")']);
  assert.deepEqual(rows[2].problems, ['has no question text']);
  assert.ok(rows[3].notes.some(n => /formatting/.test(n)) && rows[3].notes.some(n => /neon/.test(n)) && rows[3].notes.some(n => /extra tags|sixth/.test(n)), rows[3].notes.join('|'));
  assert.equal(rows[3].q.tags.length, 5);
  assert.ok(rows[4].notes.some(n => /shortened to 24/.test(n))); assert.equal(rows[4].q.sort.lanes[0].name.length, 24);
  assert.deepEqual(rows[0].q.tags, ['Rock cycle', 'MS-ESS2-1']);
  assert.match(AIB.check('nothing useful').error, /could not find any JSON/);
  assert.match(AIB.check('{"hello": 1}').error, /no questions|could not find/);
  const many = AIB.check(JSON.stringify([{ name: 'Big', questions: Array.from({ length: 205 }, (_, i) => ({ question: 'Q' + i })) }]));
  assert.equal(many[0].rows.length, 200); assert.equal(many[0].extra, 5);
});


await test('starter sets: every question is valid and carries tags', () => {
  const st = JSON.parse(fs.readFileSync('public/starters.json', 'utf8'));
  assert.ok(st.length >= 10);
  for (const s of st) for (const [i, q] of s.questions.entries()) {
    const c = SK.checkQuestion(q); assert.deepEqual(c.problems, [], s.name + ' question ' + (i + 1));
    assert.ok(c.q.tags && c.q.tags.length >= 1 && c.q.tags.length <= 5, s.name + ' question ' + (i + 1) + ' has tags');
    assert.deepEqual(c.notes, [], s.name + ' question ' + (i + 1) + ' needed no fixes: ' + c.notes.join('|'));
  }
});


await test('file import: checkSets keeps good questions, skips and explains bad ones (also in old files without tags)', () => {
  const file = [
    { name: 'Old export', questions: [{ question: 'Draw it', bg: 'graph' }, { question: '', bg: 'blank' }, { question: 'Sort', kind: 'sort', bg: 'blank', img: null, sort: { lanes: [{ id: 'A', name: 'a' }, { id: 'B', name: 'b' }], cards: [{ id: 1, text: 'x', lane: 'A' }, { id: 2, text: 'y', lane: 'Q' }], shuffle: false, fb: 'now' } }] },
    { name: 'New', tags: ['Unit 3'], questions: [{ question: 'Sort ok', kind: 'sort', sort: { lanes: [{ id: 'A', name: 'a' }, { id: 'B', name: 'b' }], cards: [{ id: 1, text: 'x', lane: 'A' }, { id: 2, text: 'y', lane: 'B' }], shuffle: false, fb: 'now' }, tags: ['T'] }, 7, null, { question: '<script>x</script>', bg: 'photo' }] },
  ];
  const r = SK.parseSets(file); assert.equal(r.error, ''); const c = SK.checkSets(r.sets);
  assert.deepEqual(c[0].rows.map(x => !!x.q), [true, false, false]); assert.equal(c[0].rows[0].q.tags, undefined, 'a file without tags imports as untagged');
  assert.deepEqual(c[0].rows[1].problems, ['has no question text']); assert.match(c[0].rows[2].problems[0], /Q/);
  assert.deepEqual(c[1].rows.map(x => !!x.q), [true, false, false, true]); assert.deepEqual([c[1].rows[3].q.question, c[1].rows[3].q.bg], ['x', 'blank'], 'markup is stripped, a photo background without a photo becomes blank');
  assert.equal(c[1].rows[0].q.sort.fb, 'now'); assert.equal(c[1].rows[0].q.sort.shuffle, false, 'sort options survive'); assert.deepEqual(c[1].rows[0].q.tags, ['T']); assert.deepEqual(r.sets[1].tags, ['Unit 3']);
  assert.match(c[1].rows[1].problems[0], /not a question/);
  const evil = SK.checkQuestion({ question: '<img src=x onerror=alert(1)>Hi<b onclick=1>there</b>', bg: 'blank' }).q.question; assert.ok(!/onerror|onclick|<img/.test(evil) && !/<b[^>]/.test(evil), 'hostile markup never gets through: ' + evil); // (a tag with attributes is dropped whole, exactly as the server does)
});


// ---- Phase 5: lesson history needs the question's start time from the server ----
await test('lesson history: the server stamps each question with its start time (and restore keeps the original)', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'QAT1', key: KEY }); const s0 = await h.wait('state'); assert.equal(s0.qat, 0);
  const t0 = Date.now(); h.send({ t: 'q', question: 'First', bg: 'blank' }); await sleep(80);
  const q1 = h.last('q'); assert.ok(q1.at >= t0 && q1.at <= Date.now(), 'the teacher gets the start time with the question');
  const a = client(); await a.ready; a.send({ t: 'join', code: 'QAT1', name: 'Quin', bw: 800, bh: 500 }); await a.wait('joined'); const p = client(); await p.ready; p.send({ t: 'watch', code: 'QAT1' }); await p.wait('state');
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code: 'QAT1', key: KEY }); assert.equal((await h2.wait('state')).qat, q1.at, 'a reloaded teacher page learns it');
  await sleep(30); h.send({ t: 'q', question: 'Second', bg: 'blank' }); await sleep(80); assert.ok(h.last('q').at > q1.at);
  h.send({ t: 'undoq' }); await sleep(100); assert.equal(h.last('state').qat, q1.at, 'undo brings the old start time back, so the old lesson record is reused');
  const old = Date.now() - 5000; const r = client(); await r.ready; r.send({ t: 'host', code: 'QAT2', key: KEY }); await r.wait('state');
  r.send({ t: 'restore', question: 'Back', bg: 'blank', at: old }); await sleep(80); assert.equal(r.last('restore').at, old);
  const r2 = client(); await r2.ready; r2.send({ t: 'host', code: 'QAT2', key: KEY }); assert.equal((await r2.wait('state')).qat, old);
  const r3 = client(); await r3.ready; r3.send({ t: 'host', code: 'QAT3', key: KEY }); await r3.wait('state'); r3.send({ t: 'restore', question: 'x', bg: 'blank', at: Date.now() + 1e7 }); await sleep(60);
  assert.ok(r3.last('restore').at <= Date.now(), 'a start time in the future is not believed');
});


await test('marks: the teacher\'s marks on drawings reach hosts only, clear with a new question, and come back with undo', async () => {
  const h = client(); await h.ready; h.send({ t: 'host', code: 'MARKS', key: KEY }); await h.wait('state');
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code: 'MARKS', key: KEY }); await h2.wait('state'); // a second teacher device (the phone)
  const a = client(); await a.ready; a.send({ t: 'join', code: 'MARKS', name: 'Mia', bw: 800, bh: 500 }); const aj = await a.wait('joined');
  const p = client(); await p.ready; p.send({ t: 'watch', code: 'MARKS' }); await p.wait('state');
  h.send({ t: 'q', question: 'Draw', bg: 'blank' }); await sleep(60); h.clear(); h2.clear(); a.clear(); p.clear();
  h.send({ t: 'mark', id: aj.id, m: 'got' }); await sleep(80);
  assert.deepEqual([h.last('mark').id, h.last('mark').m], [aj.id, 'got']); assert.equal(h2.last('mark').m, 'got', 'the phone sees it too');
  assert.equal(a.last('mark'), undefined, 'the student never sees it'); assert.equal(p.last('mark'), undefined, 'nor the projector');
  const hs = client(); await hs.ready; hs.send({ t: 'host', code: 'MARKS', key: KEY }); assert.deepEqual((await hs.wait('state')).marks, { [aj.id]: 'got' }, 'a reloaded teacher page has the marks');
  const late = client(); await late.ready; late.send({ t: 'watch', code: 'MARKS' }); const ls = await late.wait('state'); assert.equal(ls.marks, undefined);
  for (const c of [a, p, late]) assert.ok(!/"marks"|"mark"|"got"|"almost"/.test(JSON.stringify(c.got)), 'no marks anywhere in what students or projectors receive');
  h.send({ t: 'mark', id: aj.id, m: 'almost' }); h.send({ t: 'mark', id: aj.id, m: 'bogus' }); h.send({ t: 'mark', id: 'nobody', m: 'got' }); await sleep(80);
  assert.equal(h.last('mark').m, 'almost'); assert.equal(h.got.filter(x => x.t === 'mark' && x.m === 'almost').length, 1, 'a bad value or student is ignored');
  a.send({ t: 'mark', id: aj.id, m: 'not' }); p.send({ t: 'mark', id: aj.id, m: 'not' }); await sleep(80);
  const hs2 = client(); await hs2.ready; hs2.send({ t: 'host', code: 'MARKS', key: KEY }); assert.equal((await hs2.wait('state')).marks[aj.id], 'almost', 'students and watchers cannot mark');
  h.send({ t: 'mark', id: aj.id, m: null }); await sleep(60); assert.equal(h.last('mark').m, null);
  h.send({ t: 'mark', id: aj.id, m: 'not' }); await sleep(60);
  h.send({ t: 'q', question: 'Next', bg: 'blank' }); await sleep(100);
  const hs3 = client(); await hs3.ready; hs3.send({ t: 'host', code: 'MARKS', key: KEY }); assert.deepEqual((await hs3.wait('state')).marks, {}, 'a new question clears marks');
  h.send({ t: 'undoq' }); await sleep(100);
  const hs4 = client(); await hs4.ready; hs4.send({ t: 'host', code: 'MARKS', key: KEY }); assert.equal((await hs4.wait('state')).marks[aj.id], 'not', 'undo brings the marks back');
  h.send({ t: 'q', kind: 'sort', question: 'Sort', sort: { lanes: [{ id: 'A', name: 'a' }, { id: 'B', name: 'b' }], cards: [{ id: 1, text: 'x', lane: 'A' }, { id: 2, text: 'y', lane: 'B' }] } }); await sleep(80); h.clear();
  h.send({ t: 'mark', id: aj.id, m: 'got' }); await sleep(60); assert.equal(h.last('mark'), undefined, 'marks are for drawings, not sort questions');
  h.send({ t: 'q', question: 'D', bg: 'blank' }); await sleep(60); h.send({ t: 'mark', id: aj.id, m: 'got' }); await sleep(60);
  h.send({ t: 'release', id: aj.id }); await sleep(80);
  const hs5 = client(); await hs5.ready; hs5.send({ t: 'host', code: 'MARKS', key: KEY }); assert.deepEqual((await hs5.wait('state')).marks, {}, 'removing a student removes their mark');
});


// ---- Phase 5: mastery (public/mastery.js, pure) ----
const MK = new Function('SK', fs.readFileSync('public/mastery.js', 'utf8') + '\nreturn MK;')(SK);
const DAY = 864e5, NOW = Date.UTC(2026, 10, 12, 15, 0, 0); // Thursday 12 Nov 2026
const les = (daysAgo, o) => ({ id: 'L' + daysAgo + (o.q || ''), code: 'ABCD', at: NOW - daysAgo * DAY, q: 'Q', kind: 'draw', tags: [], nick: false, students: [], ...o });
const sst = (key, o = {}) => ({ key, name: key.toUpperCase(), pulse: null, mark: null, sortRight: null, sortTotal: null, sortPlaced: null, missedIdeas: [], ...o });
const sortSt = (key, right, total = 4, o = {}) => sst(key, { sortRight: right, sortTotal: total, sortPlaced: total, ...o });

await test('mastery: scores, weights (latest three double), bands and "not enough data"', () => {
  assert.equal(MK.score(sortSt('a', 3), 'sort'), 75); assert.equal(MK.score(sst('a', { sortRight: 0, sortTotal: 4, sortPlaced: 0 }), 'sort'), null, 'placing nothing is no score, not 0%');
  assert.deepEqual(['got', 'almost', 'not', null].map(m => MK.score(sst('a', { mark: m }), 'draw')), [100, 50, 0, null]);
  assert.equal(MK.mastery([{ at: 1, score: 100 }]).value, null); assert.deepEqual(MK.mastery([]), { n: 0, value: null, band: null });
  assert.equal(MK.mastery([{ at: 1, score: 100 }, { at: 2, score: 0 }]).value, 50);
  // five points: the oldest two count once, the newest three twice: (100+100 + 2*(0+0+0)) / (1+1+6) = 25
  const five = [100, 100, 0, 0, 0].map((s, i) => ({ at: i + 1, score: s })); assert.equal(MK.mastery(five).value, 25);
  assert.equal(MK.mastery(five.slice().reverse()).value, 25, 'order of arrival does not matter, time does');
  assert.deepEqual([49, 50, 79, 80, 100, 0].map(MK.band), ['not', 'getting', 'getting', 'secure', 'secure', 'not']);
  assert.equal(MK.mastery([{ at: 1, score: 100 }, { at: 2, score: 100 }, { at: 3, score: 0 }]).band, 'getting', '(100+100+0)*... = 67');
});

await test('mastery: a question with two tags counts toward both; no tag goes in "Untagged"', () => {
  const L = [les(3, { q: 'A', tags: ['Rock cycle', 'Reading a diagram'], students: [sst('ann', { mark: 'got' }), sst('bo', { mark: 'not' })] }),
    les(2, { q: 'B', tags: ['rock CYCLE'], students: [sst('ann', { mark: 'got' }), sst('bo', { mark: 'almost' })] }),
    les(1, { q: 'C', tags: [], students: [sst('ann', { mark: 'not' }), sst('bo', { mark: 'not' })] })];
  const b = MK.build(L); const byKey = Object.fromEntries(b.rows.map(r => [r.key, r]));
  assert.deepEqual(Object.keys(byKey).sort(), ['', 'reading a diagram', 'rock cycle'].sort());
  assert.deepEqual(byKey['rock cycle'].people.map(p => [p.name, p.value, p.band]), [['BO', 25, 'not'], ['ANN', 100, 'secure']], 'two lessons carry the tag, the spellings are one tag');
  assert.deepEqual(byKey['reading a diagram'].people.map(p => p.value), [null, null], 'one data point is not enough');
  assert.equal(byKey['reading a diagram'].counts.nodata, 2);
  assert.equal(b.rows[b.rows.length - 1].key, '', 'Untagged is last'); assert.equal(byKey[''].label, 'Untagged'); assert.equal(byKey[''].people[0].value, null);
  assert.deepEqual(byKey['rock cycle'].counts, { not: 1, getting: 0, secure: 1, nodata: 0 });
});

await test('mastery: sort questions use percent of cards right; ideas most often missed come with the tag', () => {
  const L = [1, 2].map(d => les(d, { q: 'S' + d, kind: 'sort', tags: ['Classifying'], students: [sortSt('ann', 4), sortSt('bo', 1, 4, { missedIdeas: ['Cooling rate', 'Clues'] }), sortSt('cy', 2, 4, { missedIdeas: ['Cooling rate'] }), sst('di')] }));
  const b = MK.build(L), r = b.rows[0];
  assert.deepEqual(r.people.map(p => [p.name, p.value, p.band]).sort(), [['ANN', 100, 'secure'], ['BO', 25, 'not'], ['CY', 50, 'getting']].sort());
  assert.ok(!r.people.some(p => p.name === 'DI'), 'a student who placed nothing is not in the numbers');
  assert.deepEqual(r.ideas.map(i => [i.idea, i.misses]), [['Cooling rate', 4], ['Clues', 2]]);
  assert.deepEqual(r.qs.map(q => [q.q, q.n, q.avg]), [['S2', 3, 58], ['S1', 3, 58]]);
});

await test('mastery: who needs help (Not yet on a tag, or red twice or more), most urgent first', () => {
  const mk = (d, tags, studs) => les(d, { q: 'q' + d, tags, students: studs });
  const L = [mk(5, ['Cells'], [sst('ann', { mark: 'not', pulse: 'r' }), sst('bo', { mark: 'got', pulse: 'r' }), sst('cy', { mark: 'got' })]),
    mk(3, ['Cells'], [sst('ann', { mark: 'not', pulse: 'r' }), sst('bo', { mark: 'got', pulse: 'g' }), sst('cy', { mark: 'got' })]),
    mk(1, ['Atoms'], [sst('bo', { mark: 'got', pulse: 'r' }), sst('cy', { pulse: 'r' }), sst('ann', { mark: 'got' })]),
    mk(0, [], [sst('dee', { mark: 'not' }), sst('dee2', { pulse: 'r' })]), mk(0.5, [], [sst('dee', { mark: 'not' })])];
  const b = MK.build(L);
  assert.deepEqual(b.help.map(h => [h.name, h.reasons.map(r => r.type + (r.label ? ':' + r.label : '') + (r.count ? ':' + r.count : '')).join('+')]),
    [['ANN', 'tag:Cells+red:2'], ['BO', 'red:2']], 'ANN has two reasons; the Untagged row never makes someone "Not yet"; one red alone is not enough');
  assert.equal(b.help[0].at, NOW - 3 * DAY, 'the last date is the last time that tag was assessed');
});

await test('mastery: confidence against mastery finds green-but-low and red-but-high', () => {
  const L = [les(2, { q: 'Q1', tags: ['T'], kind: 'sort', students: [sortSt('ann', 1, 4, { pulse: 'g' }), sortSt('bo', 4, 4, { pulse: 'r' }), sortSt('cy', 4, 4, { pulse: 'g' }), sortSt('di', 1, 4, { pulse: 'r' })] }),
    les(1, { q: 'Q2', tags: ['T'], students: [sst('ann', { pulse: 'g', mark: 'not' }), sst('bo', { pulse: 'r', mark: 'got' }), sst('cy', { pulse: 'g' })] })];
  const b = MK.build(L);
  assert.deepEqual(b.greenLow.map(x => [x.name, x.count, x.q]), [['ANN', 2, 'Q2']]); assert.deepEqual(b.redHigh.map(x => [x.name, x.count]), [['BO', 2]]);
  assert.equal(b.withConf, 4, 'confidence with a score behind it');
});

await test('mastery: date ranges, class filter, and the honest counts of what was measured', () => {
  const L = [les(40, { q: 'old', tags: ['T'], students: [sst('ann', { mark: 'got' })] }), les(10, { q: 'mid', tags: ['T'], students: [sst('ann', { mark: 'got' })] }), les(0.2, { q: 'now', tags: ['T'], students: [sst('ann', { mark: 'not' })] }), { ...les(1, { q: 'other', tags: ['T'], students: [sst('ann', { mark: 'got' })] }), code: 'WXYZ' }, les(2, { q: 'plain', kind: 'draw', tags: [], students: [sst('ann', { pulse: 'g' })] })];
  assert.deepEqual(MK.build(L, { code: 'ABCD', ...MK.range('all', NOW) }).lessons.map(l => l.q), ['old', 'mid', 'plain', 'now']);
  assert.deepEqual(MK.build(L, { code: 'ABCD', ...MK.range('month', NOW) }).lessons.map(l => l.q), ['mid', 'plain', 'now']);
  assert.deepEqual(MK.build(L, { code: 'ABCD', ...MK.range('week', NOW) }).lessons.map(l => l.q), ['plain', 'now'], 'this week starts on Monday (10 Nov 2026)');
  const w = MK.range('week', Date.UTC(2026, 10, 15, 12)); assert.equal(new Date(w.from).getDay(), 1, 'a Sunday still belongs to the week that began on Monday');
  const b = MK.build(L, { code: 'ABCD', ...MK.range('all', NOW) }); assert.deepEqual(b.signals, { sort: 0, pieces: 0, marked: 3, draw: 4, drawUnmarked: 1 }, 'one drawing question has confidence only, no marks');
  const s = MK.strip(L, 'ABCD', NOW); assert.equal(s.help, 0, 'one Not yet is below two data points in the month'); assert.equal(MK.strip(L, 'NONE', NOW), null);
  assert.equal(MK.build([], {}).rows.length, 0);
});


await test('static files: gzip when asked, an ETag, 304 on a repeat, fonts left alone', async () => {
  const u = p => 'http://localhost:' + PORT + p;
  const raw = fs.readFileSync('public/class.html');
  const plain = await fetch(u('/class'), { headers: { 'accept-encoding': 'identity' } });
  assert.equal(plain.headers.get('content-encoding'), null); assert.equal((await plain.arrayBuffer()).byteLength, raw.length);
  const gz = await new Promise((ok, no) => { import('node:http').then(({ default: http }) => http.get(u('/class'), { headers: { 'accept-encoding': 'gzip' } }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => ok({ r, body: Buffer.concat(c) })); }).on('error', no)); });
  assert.equal(gz.r.headers['content-encoding'], 'gzip'); assert.match(gz.r.headers['vary'], /Accept-Encoding/i); assert.equal(+gz.r.headers['content-length'], gz.body.length);
  assert.ok(gz.body.length < raw.length / 2, 'smaller on the wire: ' + gz.body.length + ' vs ' + raw.length);
  const { gunzipSync } = await import('node:zlib'); assert.equal(gunzipSync(gz.body).toString(), raw.toString(), 'the same file after unzipping');
  const tagGz = gz.r.headers['etag'], tagPlain = plain.headers.get('etag'); assert.ok(tagGz && tagPlain && tagGz !== tagPlain, 'each form has its own ETag');
  const again = await fetch(u('/class'), { headers: { 'accept-encoding': 'identity', 'if-none-match': tagPlain } }); assert.equal(again.status, 304); assert.equal((await again.text()), '');
  assert.equal(again.headers.get('cache-control'), 'no-cache', 'pages are revalidated, which is now cheap');
  const wrong = await fetch(u('/class'), { headers: { 'accept-encoding': 'identity', 'if-none-match': '"nope"' } }); assert.equal(wrong.status, 200);
  const star = await fetch(u('/tcommon.js'), { headers: { 'if-none-match': '*' } }); assert.equal(star.status, 304);
  const js = await fetch(u('/tcommon.js')); assert.match(js.headers.get('content-type'), /javascript/); assert.equal(js.headers.get('x-content-type-options'), 'nosniff');
  const font = await fetch(u('/fonts/figtree-latin-wght-normal.woff2'), { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(font.headers.get('content-encoding'), null, 'fonts are already compressed'); assert.match(font.headers.get('cache-control'), /max-age=604800/);
  const head = await fetch(u('/class'), { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const hz = await fetch(u('/healthz')); assert.equal(await hz.text(), 'ok'); assert.equal(hz.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(u('/healthz'), { method: 'HEAD' })).status, 200);
  const nf = await fetch(u('/nothing-here'), { headers: { 'accept-encoding': 'gzip' } }); assert.equal(nf.status, 404);
});


await test('security headers: a strict CSP whose hashes match each page\'s own scripts, and no framing', async () => {
  const { createHash } = await import('node:crypto');
  for (const [route, file] of [['/', 'index'], ['/teacher', 'teacher'], ['/class', 'class'], ['/sets', 'sets'], ['/projector', 'projector'], ['/start', 'landing']]) {
    const r = await fetch('http://localhost:' + PORT + route); const csp = r.headers.get('content-security-policy');
    assert.ok(csp, route + ' has a CSP'); assert.equal(r.headers.get('x-frame-options'), 'DENY'); assert.match(r.headers.get('permissions-policy'), /camera=\(\)/);
    assert.match(csp, /default-src 'self'/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /object-src 'none'/); assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /connect-src 'self' ws:\/\/localhost:\d+ wss:\/\/localhost:\d+/, 'the WebSocket is allowed back to this site only');
    const script = csp.split(';').map(x => x.trim()).find(x => x.startsWith('script-src'));
    assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(script), route + ' scripts: ' + script);
    const html = fs.readFileSync('public/' + file + '.html', 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => "'sha256-" + createHash('sha256').update(m[1]).digest('base64') + "'");
    assert.ok(inline.length >= 1); for (const h of inline) assert.ok(script.includes(h), route + ' allows its own inline script ' + h.slice(0, 20));
    assert.ok(!/ on(click|change|input|submit|load|error|keydown)=/i.test(html), file + ' has no inline event handlers (the CSP would block them)');
  }
  const js = await fetch('http://localhost:' + PORT + '/tcommon.js'); assert.equal(js.headers.get('content-security-policy'), null, 'only pages carry the policy'); assert.equal(js.headers.get('x-frame-options'), 'DENY');
  const nf = await fetch('http://localhost:' + PORT + '/nowhere'); assert.equal(nf.status, 404); assert.match(nf.headers.get('content-security-policy'), /default-src 'self'/); assert.equal(nf.headers.get('x-frame-options'), 'DENY');
  assert.equal((await fetch('http://localhost:' + PORT + '/class')).headers.get('strict-transport-security'), null, 'no HSTS unless behind an HTTPS proxy');
  const evil = await fetch('http://localhost:' + PORT + '/class', { headers: { host: 'localhost:1; script-src *' } }).catch(() => null); // (fetch refuses to change Host; a bad value would be ignored by the server anyway)
  assert.ok(evil === null || !/script-src \*/.test(evil.headers.get('content-security-policy') || ''), 'a strange Host header cannot add to the policy');
});

await test('security headers: HSTS only when behind an HTTPS proxy', async () => {
  const P2 = PORT + 800, s2 = spawn('node', ['server.js'], { env: { ...process.env, PORT: P2, TRUST_PROXY: '1' }, stdio: 'ignore' });
  try {
    await sleep(600);
    const a = await fetch('http://localhost:' + P2 + '/class', { headers: { 'x-forwarded-proto': 'https' } }); assert.match(a.headers.get('strict-transport-security'), /max-age=15552000/);
    const b = await fetch('http://localhost:' + P2 + '/class', { headers: { 'x-forwarded-proto': 'http' } }); assert.equal(b.headers.get('strict-transport-security'), null);
  } finally { s2.kill(); }
});

// ---- Phase A: movable pieces on a draw question (see MODELS_PLAN.md) ----
const MODEL = (extra = {}) => ({
  t: 'q', question: 'Place the seasons', bg: 'blank',
  model: { stage: 'wide', spots: 'hidden', fb: 'reveal', tol: 60, pieces: [
    { id: 1, label: 'Summer', art: 'earth', x: 860, y: 105, kx: 190, ky: 312, idea: 'Tilt toward the Sun' },
    { id: 2, label: 'Autumn', art: 'earth', x: 130, y: 120, kx: 500, ky: 520, idea: 'Equinox' },
    { id: 3, label: 'Winter', art: 'card', x: 140, y: 500, kx: 810, ky: 312, idea: 'Tilt toward the Sun' }], ...extra }
});
const MP_CODE = 'PIECE';
const mh = client(); await mh.ready; mh.send({ t: 'host', code: MP_CODE, key: KEY }); await mh.wait('state');
const mproj = client(); await mproj.ready; mproj.send({ t: 'watch', code: MP_CODE }); await mproj.wait('state');
const ma = client(); await ma.ready; ma.send({ t: 'join', code: MP_CODE, name: 'Pia', bw: 800, bh: 500 }); const maJ = await ma.wait('joined');
const mb = client(); await mb.ready; mb.send({ t: 'join', code: MP_CODE, name: 'Quin', bw: 400, bh: 800 }); await mb.wait('joined');
// a rejoin with the student's token takes over the connection, so a test that rejoins puts the student's own socket back afterwards
const reattach = async () => { ma.clear(); ma.send({ t: 'join', code: MP_CODE, id: maJ.id, tok: maJ.tok, bw: 800, bh: 500 }); await ma.wait('joined'); ma.clear(); };

await test('pieces: the answer key goes to the teacher only', async () => {
  mh.clear(); mproj.clear(); ma.clear();
  mh.send(MODEL()); await sleep(100);
  const hq = mh.last('q'); assert.deepEqual(hq.sk.pos[1], { x: 190, y: 312 }); assert.equal(hq.sk.idea[2], 'Equinox'); assert.equal(hq.sk.tol, 60);
  assert.equal(hq.q.model.pieces.length, 3);
  for (const q of [ma.last('q').q, mproj.last('q').q]) {
    const txt = JSON.stringify(q); assert.equal(q.model.pieces.length, 3);
    assert.ok(!('kx' in q.model.pieces[0]) && !txt.includes('Equinox') && !txt.includes('"tol"') && !txt.includes('190'), 'no key in ' + txt);
    assert.deepEqual([q.model.pieces[0].x, q.model.pieces[0].y], [860, 105], 'the start spot is public');
  }
  assert.equal(ma.last('sk'), undefined); assert.equal(mproj.last('sk'), undefined);
  const late = client(); await late.ready; late.send({ t: 'watch', code: MP_CODE }); const ls = await late.wait('state');
  assert.equal(ls.sk, undefined); assert.ok(!JSON.stringify(ls).includes('Equinox') && !JSON.stringify(ls).includes('"kx"'));
  const rj = client(); await rj.ready; rj.send({ t: 'join', code: MP_CODE, id: maJ.id, tok: maJ.tok, bw: 800, bh: 500 }); const j = await rj.wait('joined');
  assert.ok(!JSON.stringify(j).includes('Equinox') && !JSON.stringify(j).includes('"kx"'), 'a rejoining student gets no key either'); rj.ws.close(); await reattach();
  const hs = client(); await hs.ready; hs.send({ t: 'host', code: MP_CODE, key: KEY }); assert.deepEqual((await hs.wait('state')).sk.pos[3], { x: 810, y: 312 }); hs.ws.close();
});

await test('pieces: with "show outlines" the answer spots are public on purpose (the ideas still are not)', async () => {
  ma.clear(); mh.send(MODEL({ spots: 'shown' })); await sleep(100);
  const q = ma.last('q').q; assert.deepEqual([q.model.pieces[0].kx, q.model.pieces[0].ky], [190, 312]); assert.ok(!JSON.stringify(q).includes('Equinox'));
  mh.send(MODEL()); await sleep(80);
});

await test('pieces: a model that is not complete is refused', async () => {
  mh.clear(); mh.send({ t: 'q', question: 'x', bg: 'blank', model: { pieces: [{ id: 1, label: 'Only one', x: 100, y: 100, kx: 300, ky: 300 }] } }); await sleep(80);
  assert.match(mh.last('note').m, /not complete/); assert.equal(mh.last('q'), undefined);
  mh.clear(); mh.send({ t: 'q', question: 'x', bg: 'blank', model: { pieces: [{ id: 1, label: 'A', x: 100, y: 100 }, { id: 2, label: 'B', x: 200, y: 100 }] } }); await sleep(80);
  assert.equal(mh.last('q'), undefined, 'a piece with no answer spot is dropped, leaving fewer than two');
});

await test('pieces: placements are cleaned and relayed, and nothing is judged until Reveal', async () => {
  mh.send(MODEL()); await sleep(80); mh.clear(); mproj.clear(); ma.clear();
  ma.send({ t: 'place', p: { 1: { x: 195, y: 320 }, 2: { x: 5000, y: -40 }, 3: { x: 'a', y: 1 }, 99: { x: 1, y: 1 }, x: { x: 1, y: 1 } } }); await sleep(100);
  const pl = mh.last('pl'); assert.equal(pl.id, maJ.id); assert.deepEqual(Object.keys(pl.p).sort(), ['1', '2']);
  assert.deepEqual(pl.p[2], { x: 946, y: 54 }, 'clamped to the stage, centre kept 54 units from the edge');
  assert.deepEqual(mproj.last('pl').p, pl.p); assert.equal(ma.last('fb'), undefined, 'no right or wrong before Reveal');
  mh.clear(); ma.send({ t: 'place', p: { 1: { x: 195, y: 320 }, 2: { x: 500, y: 300 }, 3: { x: 805, y: 300 } } }); await sleep(80);
  assert.deepEqual(Object.keys(mh.last('pl').p).sort(), ['1', '2', '3']);
});

await test('pieces: Reveal tells each student which pieces are right and where the wrong ones go', async () => {
  ma.clear(); mh.clear(); mh.send({ t: 'reveal', on: true }); await sleep(100);
  const fb = ma.last('fb'); assert.deepEqual(fb.ok, { 1: true, 2: false, 3: true }); assert.deepEqual(fb.where, { 2: { x: 500, y: 520 } });
  assert.equal(mh.last('reveal').on, true);
  ma.send({ t: 'place', p: { 1: { x: 195, y: 320 }, 2: { x: 500, y: 515 }, 3: { x: 805, y: 300 } } }); await sleep(80);
  assert.deepEqual(ma.last('fb').ok, { 1: true, 2: true, 3: true }); assert.deepEqual(ma.last('fb').where, {});
  ma.clear(); mh.send({ t: 'reveal', on: false }); await sleep(80); assert.equal(ma.last('fb').off, true);
  const late = client(); await late.ready; late.send({ t: 'join', code: MP_CODE, id: maJ.id, tok: maJ.tok, bw: 800, bh: 500 }); assert.equal((await late.wait('joined')).fb, null, 'hidden again for a rejoin'); late.ws.close(); await reattach();
});

await test('pieces: "right away" gives right and wrong as each piece is placed, without the answer spot', async () => {
  mh.send(MODEL({ fb: 'now' })); await sleep(80); ma.clear();
  ma.send({ t: 'place', p: { 2: { x: 500, y: 300 }, 1: { x: 195, y: 320 } } }); await sleep(80);
  const fb = ma.last('fb'); assert.deepEqual(fb.ok, { 1: true, 2: false }); assert.deepEqual(fb.where, {}, 'where only comes with Reveal');
  mh.send(MODEL()); await sleep(80);
});

await test('pieces: a refresh keeps the placements, a new question clears them, Undo brings them back', async () => {
  ma.send({ t: 'place', p: { 1: { x: 400, y: 300 } } }); await sleep(60);
  const rj = client(); await rj.ready; rj.send({ t: 'join', code: MP_CODE, id: maJ.id, tok: maJ.tok, bw: 800, bh: 500 });
  assert.deepEqual((await rj.wait('joined')).pl, { 1: { x: 400, y: 300 } }); rj.ws.close(); await reattach();
  mh.clear(); mh.send({ t: 'q', question: 'Next', bg: 'blank' }); await sleep(100);
  const st = client(); await st.ready; st.send({ t: 'watch', code: MP_CODE }); assert.deepEqual((await st.wait('state')).students.find(x => x.id === maJ.id).pl, {}); st.ws.close();
  ma.clear(); ma.send({ t: 'place', p: { 1: { x: 400, y: 300 } } }); await sleep(60); assert.equal(mh.last('pl'), undefined, 'not a model question: placements are ignored');
  mh.send(MODEL()); await sleep(80); ma.send({ t: 'place', p: { 1: { x: 410, y: 310 } } }); await sleep(60);
  mh.send({ t: 'q', question: 'Different', bg: 'blank' }); await sleep(80); mh.clear(); ma.clear(); mh.send({ t: 'undoq' }); await sleep(120);
  assert.deepEqual(ma.last('joined').pl, { 1: { x: 410, y: 310 } }); assert.equal(ma.last('joined').undo, true);
  assert.deepEqual(mh.last('state').students.find(x => x.id === maJ.id).pl, { 1: { x: 410, y: 310 } });
});

await test('pieces: frozen, or on the projector, nothing is accepted', async () => {
  mh.send({ t: 'freeze', on: true }); await sleep(60); mh.clear();
  ma.send({ t: 'place', p: { 1: { x: 100, y: 100 } } }); await sleep(80);
  assert.equal(mh.last('pl'), undefined); assert.equal(ma.last('freeze').on, true);
  mh.send({ t: 'freeze', on: false }); await sleep(60);
  mh.send({ t: 'spot', ids: [maJ.id], hide: false }); await sleep(60); mh.clear();
  ma.send({ t: 'place', p: { 1: { x: 100, y: 100 } } }); await sleep(80); assert.equal(mh.last('pl'), undefined); assert.equal(ma.last('lock').proj, true);
  mh.send({ t: 'spot', ids: [] }); await sleep(60);
});

await test('pieces: a pen drawing still works on a model question (pieces do not get in the way of ink)', async () => {
  mh.clear(); ma.send({ t: 'set', o: { id: 1, k: 'line', s: 'arrow', c: '#111111', lw: 3, dash: 'solid', pts: [[10, 10], [200, 120]] } }); await sleep(80);
  assert.equal(mh.last('set').o.s, 'arrow');
});

await test('pieces: the browser validator agrees with the server', async () => {
  const raw = { id: 1, label: 'S'.repeat(40), art: 'earth', x: 5000, y: -9, kx: 190.6, ky: 312.2, idea: 'I'.repeat(50) };
  const input = { question: 'Seasons', bg: 'blank', model: { stage: 'tall', tol: 500, spots: 'shown', fb: 'now', pieces: [raw, { id: 2, label: 'B', art: 'nope', x: 10, y: 10, kx: -300, ky: 9999 }] } };
  mh.clear(); mh.send({ t: 'q', ...input }); await sleep(100);
  const srv = mh.last('q'), mine = okQ(input).model;
  assert.equal(mine.stage, srv.q.model.stage); assert.equal(mine.tol, srv.sk.tol); assert.equal(mine.spots, srv.q.model.spots); assert.equal(mine.fb, srv.q.model.fb);
  assert.deepEqual(mine.pieces.map(p => [p.id, p.label, p.art, p.x, p.y]), srv.q.model.pieces.map(p => [p.id, p.label, p.art, p.x, p.y]));
  assert.deepEqual(Object.fromEntries(mine.pieces.map(p => [p.id, { x: p.kx, y: p.ky }])), srv.sk.pos);
  assert.deepEqual(Object.fromEntries(mine.pieces.map(p => [p.id, p.idea]).filter(x => x[1])), srv.sk.idea);
  mh.send(MODEL()); await sleep(80);
});

await test('pieces: the checker works at the edge of "how close counts"', async () => {
  const m = SK.cleanModel(MODEL().model), edge = (dx, dy) => SK.modelCheck(m, { 1: { x: 190 + dx, y: 312 + dy } });
  assert.equal(edge(60, 0).ok[1], true, 'exactly the distance'); assert.equal(edge(61, 0).ok[1], false);
  assert.equal(edge(42, 42).ok[1], true); assert.equal(edge(43, 43).ok[1], false);
  const r = SK.modelCheck(m, {}); assert.deepEqual([r.right, r.put, r.total, r.ok], [0, 0, 3, {}], 'nothing moved, nothing judged');
});

await test('pieces: the scatter puts every piece on the stage, apart, and away from every answer spot', async () => {
  for (const stage of ['wide', 'tall']) {
    const m = SK.cleanModel({ ...MODEL().model, stage }); SK.scatter(m); const st = SK.stageOf(m);
    m.pieces.forEach((p, i) => {
      assert.ok(p.x >= 54 && p.x <= st.w - 54 && p.y >= 54 && p.y <= st.h - 54, stage + ': on the stage');
      m.pieces.forEach(q => assert.ok(Math.hypot(p.x - q.kx, p.y - q.ky) >= 108 * 1.3 - 1, stage + ': clear of every answer spot'));
      m.pieces.slice(i + 1).forEach(q => assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 108 * 1.1, stage + ': clear of each other'));
    });
    assert.deepEqual(SK.modelIssues(m), [], stage + ': no problems listed');
  }
  const m = SK.cleanModel(MODEL().model); m.pieces[1].x = m.pieces[0].x; m.pieces[1].y = m.pieces[0].y; m.pieces[2].label = ' ';
  assert.ok(SK.modelWarnings(m).some(t => /overlap at the start/.test(t)), 'overlapping pieces are a warning'); assert.ok(!SK.modelIssues(m).some(t => /overlap/.test(t)), 'and do not stop the question');
});

await test('pieces: a pasted or imported question with no start positions is scattered and says so', async () => {
  const c = SK.checkQuestion({ question: 'Seasons', bg: 'blank', model: { pieces: [{ label: 'Summer', art: 'earth', kx: 190, ky: 312 }, { label: 'Winter', art: 'moon', kx: 810, ky: 312 }] } });
  assert.deepEqual(c.problems, []); assert.ok(c.notes.some(n => /scattered/.test(n))); assert.equal(c.q.model.pieces.length, 2);
  assert.ok(SK.checkQuestion({ question: 'x', model: { pieces: [{ label: 'a', kx: 1, ky: 1 }] } }).problems.some(t => /at least 2 pieces/.test(t)));
  assert.ok(SK.checkQuestion({ question: 'x', model: { pieces: [{ label: 'a', kx: 1, ky: 1 }, { label: 'b' }] } }).problems.some(t => /no answer spot/.test(t)));
});

// ---- Phase B: results, projector summary and mastery for a question with movable pieces ----
const KEYED = () => SK.cleanModel(MODEL().model); // pieces 1 (190,312) Tilt, 2 (500,520) Equinox, 3 (810,312) Tilt; tol 60
const pst = (id, pl, team = null) => ({ id, name: id.toUpperCase(), team, pl });

await test('pieces results: right, wrong and mix-ups are worked out from the answer key', () => {
  const m = KEYED();
  assert.deepEqual(SK.modelMix(m, { 1: { x: 500, y: 520 }, 2: { x: 500, y: 521 }, 3: { x: 5, y: 5 } }), { 1: 2, 3: null }, 'piece 1 sits on piece 2’s spot; piece 2 is right and not listed; piece 3 is near no spot');
  assert.deepEqual(SK.modelMix(m, { 3: { x: 5, y: 5 } }), { 3: null });
  const D = SK.modelStats(m, [
    pst('ann', { 1: { x: 190, y: 312 }, 2: { x: 500, y: 520 }, 3: { x: 810, y: 312 } }, { id: 'ta', name: 'Granite' }),
    pst('bo', { 1: { x: 500, y: 520 }, 2: { x: 190, y: 312 }, 3: { x: 810, y: 312 } }, { id: 'ta', name: 'Granite' }),
    pst('cy', { 1: { x: 190, y: 312 } }, { id: 'tb', name: 'Basalt' }),
    pst('di', {})]);
  assert.equal(D.started.length, 3); assert.equal(D.waiting.length, 1);
  assert.deepEqual(D.all.map(s => s.g.right), [3, 1, 1, 0]);
  assert.deepEqual(D.stat.map(k => [k.id, k.n, k.right, k.pct]), [[1, 3, 2, 67], [2, 2, 1, 50], [3, 2, 2, 100]], 'a piece’s percent is out of the students who moved it');
  assert.deepEqual(D.stat[0].swaps, { 2: 1 }); assert.deepEqual(D.stat[1].swaps, { 1: 1 });
  assert.deepEqual(D.ideas.map(i => [i.name, i.pieces, i.pct]), [['Tilt toward the Sun', 2, 84], ['Equinox', 1, 50]]);
  assert.deepEqual(D.teams.map(t => [t.team.name, t.right, t.put, t.pct]), [['Granite', 4, 6, 67], ['Basalt', 1, 3, 33]]);
  assert.equal(D.worst.n, 1); assert.ok([1, 2].includes(D.worst.k.id));
  assert.equal(SK.modelStats(m, [pst('x', {})]).worst, null); assert.equal(SK.modelStats(m, []).started.length, 0);
});

await test('pieces results: the projector gets class percentages and never the key or a name', async () => {
  const code = 'PSUM', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  const pr = client(); await pr.ready; pr.send({ t: 'watch', code }); await pr.wait('state');
  const st = [];
  for (const n of ['Ann', 'Bo']) { const c = client(); await c.ready; c.send({ t: 'join', code, name: n, bw: 800, bh: 500 }); await c.wait('joined'); st.push(c); }
  h.send(MODEL()); await sleep(80); h.send({ t: 'sres', on: true }); await sleep(80); pr.clear();
  st[0].send({ t: 'place', p: { 1: { x: 190, y: 312 }, 2: { x: 500, y: 520 }, 3: { x: 810, y: 312 } } });
  st[1].send({ t: 'place', p: { 1: { x: 500, y: 520 }, 3: { x: 810, y: 312 } } }); await sleep(900);
  const sum = pr.last('sum'); assert.ok(sum, 'a summary was pushed');
  assert.equal(sum.n, 2); assert.deepEqual(sum.cards.map(c => [c.text, c.pct]), [['Summer', 50], ['Autumn', 50], ['Winter', 100]]);
  assert.deepEqual(sum.ideas.map(i => [i.name, i.pct]).sort(), [['Equinox', 50], ['Tilt toward the Sun', 75]]);
  const txt = JSON.stringify(sum); assert.ok(!/Ann|Bo\b|"kx"|"ky"|"pos"|"tol"|190|520/.test(txt), 'no names, no key in ' + txt);
  // switching results off, then a new model question, leaves the projector on the drawings
  h.send({ t: 'q', question: 'Different', bg: 'blank' }); await sleep(80); h.send({ t: 'sres', on: true }); h.send(MODEL()); await sleep(100);
  pr.clear(); h.send({ t: 'sres', on: true }); await sleep(60); h.send(MODEL()); await sleep(100);
  assert.equal(pr.last('sres').on, false, 'results on the projector are turned off for the next pieces question');
  const lateH = client(); await lateH.ready; lateH.send({ t: 'host', code, key: KEY }); assert.equal((await lateH.wait('state')).sres, false); lateH.ws.close();
  [h, pr, ...st].forEach(c => c.ws.close());
});

await test('mastery: pieces right out of all pieces is the score, the mark only when nothing was moved', () => {
  const ps = (key, right, placed = 4, o = {}) => sst(key, { placeRight: right, placeTotal: 4, placePlaced: placed, ...o });
  const lesson = { kind: 'draw', model: true };
  assert.equal(MK.score(ps('a', 3), lesson), 75);
  assert.equal(MK.score(ps('a', 4, 4, { mark: 'not' }), lesson), 100, 'the pieces decide, not the mark on the drawing');
  assert.equal(MK.score(ps('a', 0, 0, { mark: 'almost' }), lesson), 50, 'nothing moved: the mark counts');
  assert.equal(MK.score(ps('a', 0, 0), lesson), null, 'nothing moved and no mark: no score, not 0%');
  assert.equal(MK.score(ps('a', 3), 'draw'), null, 'a plain drawing ignores piece numbers'); assert.equal(MK.score(ps('a', 3, 4, { mark: 'got' }), { kind: 'draw' }), 100);
  const L = [
    les(3, { q: 'Seasons', model: true, tags: ['Seasons'], students: [ps('a', 4, 4, { missedIdeas: [] }), ps('b', 1, 4, { missedIdeas: ['Tilt toward the Sun', 'Equinox'] }), ps('c', 0, 0)] }),
    les(1, { q: 'Seasons 2', model: true, tags: ['Seasons'], students: [ps('a', 2), ps('b', 3, 4, { missedIdeas: ['Equinox'] })] })];
  const b = MK.build(L, { code: 'ABCD', ...MK.range('all', NOW) });
  assert.deepEqual(b.signals, { sort: 0, pieces: 2, marked: 0, draw: 0, drawUnmarked: 0 }, 'pieces lessons are not "unmarked drawings"');
  const row = b.rows.find(r => r.label === 'Seasons'); assert.equal(row.qs.length, 2);
  const by = Object.fromEntries(row.people.map(p => [p.key, p.value])); assert.deepEqual(by, { a: 75, b: 50 }, 'a: (100+50)/2, b: (25+75)/2; c has no data point');
  assert.deepEqual(row.ideas.map(i => [i.idea, i.misses]), [['Equinox', 2], ['Tilt toward the Sun', 1]], 'ideas missed come from pieces too');
  assert.deepEqual(row.qs.map(q => [q.model, q.avg]), [[true, 63], [true, 63]], 'class average per question (62.5 twice), model flagged');
});

// ---- Phase C: turning pieces, pictures of your own, diagram backgrounds, the Place It! starter set ----
const PNG = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TURNQ = (extra = {}, p2 = {}) => ({
  t: 'q', question: 'Turn the arrows', bg: 'plates',
  model: { stage: 'wide', spots: 'hidden', fb: 'reveal', tol: 60, atol: 30, pieces: [
    { id: 1, label: 'Plate A', art: 'arrow', turn: true, x: 100, y: 100, a: 200, kx: 290, ky: 337, ka: 0 },
    { id: 2, label: 'Plate B', art: 'arrow', turn: true, x: 900, y: 100, a: 90, kx: 710, ky: 337, ka: 180, ...p2 },
    { id: 3, label: 'Sun', art: 'sun', x: 500, y: 520, kx: 500, ky: 520 }], ...extra }
});

await test('turning: the angle rules are the same in the browser and on the server, and wrap around 360', async () => {
  assert.equal(SK.angDiff(350, 10), 20); assert.equal(SK.angDiff(0, 180), 180); assert.equal(SK.angDiff(-10, 350), 0); assert.equal(SK.ang(-90), 270); assert.equal(SK.ang(725.4), 5);
  const code = 'TURNA', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  const input = TURNQ({ atol: 500 }, { a: -90, ka: 725 }); h.send(input); await sleep(100);
  const srv = h.last('q'), mine = SK.cleanModel(input.model);
  assert.equal(mine.atol, srv.sk.atol); assert.equal(mine.atol, 90, 'the angle tolerance is held between 10 and 90');
  assert.deepEqual(Object.fromEntries(mine.pieces.filter(p => p.turn).map(p => [p.id, p.ka])), srv.sk.ang); assert.deepEqual(srv.sk.ang, { 1: 0, 2: 5 });
  assert.deepEqual(mine.pieces.map(p => [p.id, !!p.turn, p.a]), srv.q.model.pieces.map(p => [p.id, !!p.turn, p.a]), 'start angles agree'); assert.equal(srv.q.model.pieces[1].a, 270);
  assert.ok(!('turn' in srv.q.model.pieces[2]) && !('a' in srv.q.model.pieces[2]), 'a piece that cannot turn carries no angle');
  h.ws.close();
});

await test('turning: the answer angle never reaches students unless the outlines are shown', async () => {
  const code = 'TURNB', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  const s = client(); await s.ready; s.send({ t: 'join', code, name: 'Tia', bw: 800, bh: 500 }); await s.wait('joined');
  const pr = client(); await pr.ready; pr.send({ t: 'watch', code }); await pr.wait('state'); s.clear(); pr.clear();
  h.send(TURNQ()); await sleep(100);
  for (const q of [s.last('q').q, pr.last('q').q]) { const txt = JSON.stringify(q); assert.ok(!/"ka"|"ang"|"atol"|"kx"/.test(txt), 'no answer angle in ' + txt); assert.equal(q.model.pieces[0].a, 200, 'the start angle is public'); }
  s.clear(); h.send(TURNQ({ spots: 'shown' })); await sleep(100);
  assert.equal(s.last('q').q.model.pieces[0].ka, 0); assert.equal(s.last('q').q.model.pieces[1].ka, 180); assert.ok(!/"atol"/.test(JSON.stringify(s.last('q').q)));
  [h, s, pr].forEach(c => c.ws.close());
});

await test('turning: right needs the place and the angle; Reveal says where and which way', async () => {
  const code = 'TURNC', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  const s = client(); await s.ready; s.send({ t: 'join', code, name: 'Uma', bw: 800, bh: 500 }); await s.wait('joined');
  h.send(TURNQ()); await sleep(80); h.send({ t: 'reveal', on: true }); await sleep(60); s.clear();
  s.send({ t: 'place', p: { 1: { x: 292, y: 335, a: 20 }, 2: { x: 710, y: 337, a: 100 }, 3: { x: 500, y: 520, a: 77 } } }); await sleep(100);
  const fb = s.last('fb');
  assert.deepEqual(fb.ok, { 1: true, 2: false, 3: true }, 'piece 1 is 20 degrees off (inside 30); piece 2 is in place but 80 degrees off');
  assert.deepEqual(fb.where, { 2: { x: 710, y: 337, a: 180 } }, 'the ghost has the answer angle; a piece that cannot turn has none');
  const pl = h.last('pl').p; assert.equal(pl[1].a, 20); assert.equal(pl[2].a, 100); assert.ok(!('a' in pl[3]), 'an angle sent for a piece that cannot turn is dropped');
  s.send({ t: 'place', p: { 1: { x: 292, y: 335, a: 355 }, 2: { x: 710, y: 337 } } }); await sleep(100);
  assert.deepEqual(s.last('fb').ok, { 1: true, 2: false }, '355 is 5 degrees from 0; a turning piece with no angle sent is judged at its start angle (90)');
  assert.equal(h.last('pl').p[2].a, 90);
  s.send({ t: 'place', p: { 1: { x: 292, y: 335, a: 'x' } } }); await sleep(80); assert.equal(h.last('pl').p[1].a, 200, 'a bad angle becomes the start angle');
  [h, s].forEach(c => c.ws.close());
});

await test('turning: the projector percentages use the angle too', async () => {
  const code = 'TURND', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  const pr = client(); await pr.ready; pr.send({ t: 'watch', code }); await pr.wait('state');
  const s = client(); await s.ready; s.send({ t: 'join', code, name: 'Vik', bw: 800, bh: 500 }); await s.wait('joined');
  h.send(TURNQ()); await sleep(80); h.send({ t: 'sres', on: true }); await sleep(60); pr.clear();
  s.send({ t: 'place', p: { 1: { x: 290, y: 337, a: 0 }, 2: { x: 710, y: 337, a: 0 } } }); await sleep(800);
  assert.deepEqual(pr.last('sum').cards.map(c => [c.text, c.pct]), [['Plate A', 100], ['Plate B', 0], ['Sun', 0]]);
  [h, s, pr].forEach(c => c.ws.close());
});

await test('turning: results tell a wrong place from a right place turned the wrong way', () => {
  const m = SK.cleanModel(TURNQ().model);
  const D = SK.modelStats(m, [
    { id: 'a', name: 'A', team: null, pl: { 1: { x: 290, y: 337, a: 0 }, 2: { x: 710, y: 337, a: 180 } } },
    { id: 'b', name: 'B', team: null, pl: { 1: { x: 290, y: 337, a: 90 }, 2: { x: 100, y: 100, a: 180 } } }]);
  assert.deepEqual(D.all.map(s => s.g.right), [2, 0]); assert.equal(D.all[1].mix[1], SK.TURN, 'right place, wrong way');
  assert.equal(D.all[1].mix[2], null, 'nowhere near a spot'); assert.deepEqual([D.stat[0].turned, D.stat[1].turned], [1, 0]);
  assert.equal(D.worst, null, 'turned the wrong way is not a swap with another piece');
});

await test('turning: the editor rules scatter turning pieces away from the answer and flag one that already faces it', () => {
  const m = SK.cleanModel(TURNQ().model); SK.scatter(m);
  m.pieces.filter(p => p.turn).forEach(p => assert.ok(SK.angDiff(p.a, p.ka) >= 90, 'starts 90 or more degrees from its answer, got ' + SK.angDiff(p.a, p.ka)));
  assert.deepEqual(SK.modelIssues(m), []);
  m.pieces[1].a = m.pieces[1].ka + 10; assert.ok(SK.modelWarnings(m).some(t => /already faces the right way/.test(t))); assert.deepEqual(SK.modelIssues(m), [], 'a warning, not a reason to refuse it');
  m.pieces[1].a = 270; m.pieces[0].art = 'img'; m.pieces[0].img = null; assert.ok(SK.modelIssues(m).some(t => /has no picture yet/.test(t)));
});

await test('pictures of your own: only small PNG, JPEG or WebP data pictures are kept, and the rest become text cards', async () => {
  const mkq = img => ({ question: 'x', bg: 'blank', model: { pieces: [{ id: 1, label: 'Mine', art: 'img', img, x: 100, y: 100, kx: 300, ky: 300 }, { id: 2, label: 'B', art: 'moon', x: 700, y: 100, kx: 700, ky: 300 }] } });
  assert.equal(SK.cleanModel(mkq(PNG).model).pieces[0].art, 'img'); assert.equal(SK.cleanModel(mkq(PNG).model).pieces[0].img, PNG);
  for (const bad of ['http://example.com/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGI+', PNG + '"onerror="x', 'data:image/png;base64,' + 'A'.repeat(140001), null]) {
    assert.equal(SK.cleanModel(mkq(bad).model).pieces[0].art, 'card', 'not kept: ' + String(bad).slice(0, 30));
  }
  const code = 'PICA', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state'); const s = client(); await s.ready; s.send({ t: 'join', code, name: 'Wen', bw: 800, bh: 500 }); await s.wait('joined');
  s.clear(); h.send({ t: 'q', ...mkq(PNG) }); await sleep(100); assert.equal(s.last('q').q.model.pieces[0].img, PNG, 'students get the picture'); assert.equal(h.last('q').q.model.pieces[0].art, 'img');
  s.clear(); h.send({ t: 'q', ...mkq('data:image/svg+xml;base64,PHN2Zz4=') }); await sleep(100); assert.equal(s.last('q').q.model.pieces[0].art, 'card'); assert.ok(!('img' in s.last('q').q.model.pieces[0]));
  const big = 'data:image/png;base64,' + 'A'.repeat(130000), many = { question: 'x', bg: 'blank', model: { pieces: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, label: 'P' + i, art: 'img', img: big, x: 100 + i * 100, y: 100, kx: 100 + i * 100, ky: 400 })) } };
  const kept = SK.cleanModel(many.model).pieces.filter(p => p.art === 'img').length; assert.equal(kept, 5, 'about 700 KB of pictures in all: 5 of 130 KB');
  s.clear(); h.send({ t: 'q', ...many }); await sleep(150); assert.equal(s.last('q').q.model.pieces.filter(p => p.art === 'img').length, kept, 'the server keeps the same ones');
  const c = SK.checkQuestion({ question: 'x', model: { pieces: [{ label: 'a', art: 'img', img: 'nope', kx: 1, ky: 1 }, { label: 'b', kx: 5, ky: 5 }] } }); assert.ok(c.notes.some(n => /own picture/.test(n)));
  [h, s].forEach(x => x.ws.close());
});

await test('backgrounds: the drawn diagrams are accepted by the browser rules and the server, anything else is not', async () => {
  const DRAWN = ['orbit', 'rings', 'phases', 'plates', 'ocean', 'seafloor', 'subduction', 'volcano', 'fault', 'watercycle'];
  for (const bg of DRAWN) assert.equal(okQ({ question: 'Q', bg }).bg, bg);
  const c = SK.checkQuestion({ question: 'Q', bg: 'spiral' }); assert.equal(c.q.bg, 'blank'); assert.match(c.notes[0], /orbit, rings, phases, plates, ocean, seafloor, subduction, volcano, fault, watercycle/);
  const code0 = fs.readFileSync('public/common.js', 'utf8'), sets0 = fs.readFileSync('public/sets.html', 'utf8');
  for (const bg of DRAWN) { assert.ok(new RegExp('\\n  ' + bg + '\\(x\\) \\{').test(code0), bg + ' has a painter in common.js'); assert.ok(sets0.includes("['" + bg + "', "), bg + ' is in the editor list'); }
  const code = 'BGSA', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  for (const bg of DRAWN) { h.clear(); h.send({ t: 'q', question: 'Q', bg }); await sleep(60); assert.equal(h.last('q').q.bg, bg); }
  h.clear(); h.send({ t: 'q', question: 'Q', bg: 'spiral' }); await sleep(60); assert.equal(h.last('q').q.bg, 'graph', 'an unknown background is the server default, as before'); h.ws.close();
});

await test('starter set Place It!: seasons, layers, moon phases and three plate boundaries, all valid, tagged and solvable', () => {
  const st = JSON.parse(fs.readFileSync('public/starters.json', 'utf8')), set = st.find(s => s.id === 'es-placeit');
  assert.ok(set, 'the set is there'); assert.equal(set.questions.length, 6); assert.equal(set.subject, 'Earth Science');
  assert.equal(st.map(s => s.subject).join().match(/Earth Science(,Earth Science)*/)[0].split(',').length, st.filter(s => s.subject === 'Earth Science').length, 'with the other Earth Science sets');
  assert.deepEqual(set.questions.map(q => q.bg), ['orbit', 'rings', 'phases', 'plates', 'plates', 'plates']);
  for (const q of set.questions) {
    const c = SK.checkQuestion(q); assert.deepEqual([c.problems, c.notes], [[], []], q.question.slice(0, 40));
    const m = c.q.model, right = Object.fromEntries(m.pieces.map(p => [p.id, { x: p.kx, y: p.ky, ...(p.turn ? { a: p.ka } : {}) }]));
    assert.equal(SK.modelCheck(m, right).right, m.pieces.length, 'every piece is right at its answer spot: ' + q.question.slice(0, 40));
    assert.equal(SK.modelCheck(m, {}).right, 0); assert.deepEqual(SK.modelIssues(m), []); assert.deepEqual(SK.modelWarnings(m), [], 'a shipped starter has nothing worth a look');
    m.pieces.forEach(p => assert.ok(!SK.modelCheck(m, { [p.id]: { x: p.x, y: p.y, ...(p.turn ? { a: p.a } : {}) } }).ok[p.id], 'a piece does not start already right: ' + p.label));
  }
  const arrows = set.questions.slice(3).map(q => q.model.pieces.map(p => p.ka)); assert.deepEqual(arrows, [[0, 180], [180, 0], [270, 90]], 'convergent, divergent, transform');
});

await test('starter sets Continental Drift and Draw on a Diagram: every question valid, tagged and solvable', () => {
  const st = JSON.parse(fs.readFileSync('public/starters.json', 'utf8')), drift = st.find(s => s.id === 'es-drift'), dia = st.find(s => s.id === 'es-diagrams');
  assert.ok(drift && dia); assert.equal(drift.subject, 'Earth Science'); assert.equal(dia.subject, 'Earth Science');
  assert.deepEqual(drift.questions.map(q => q.kind === 'sort' ? 'sort' : q.model ? 'place' : 'draw'), ['place', 'place', 'place', 'sort', 'sort', 'draw', 'sort', 'place', 'draw', 'draw', 'draw', 'draw'], 'all three kinds');
  assert.ok(dia.questions.every(q => !q.model && !q.kind), 'the diagram set is all Draw questions');
  assert.deepEqual([...new Set(dia.questions.map(q => q.bg))], ['subduction', 'volcano', 'fault', 'watercycle']);
  for (const q of [...drift.questions, ...dia.questions]) {
    const c = SK.checkQuestion(q); assert.deepEqual([c.problems, c.notes], [[], []], q.question.slice(0, 40));
    assert.ok(q.tags && q.tags.length >= 2, 'tagged: ' + q.question.slice(0, 40));
    if (q.model) {
      const m = c.q.model, right = Object.fromEntries(m.pieces.map(p => [p.id, { x: p.kx, y: p.ky }]));
      assert.equal(SK.modelCheck(m, right).right, m.pieces.length, 'every piece is right at its answer spot: ' + q.question.slice(0, 40));
      assert.equal(SK.modelCheck(m, {}).right, 0); assert.deepEqual(SK.modelIssues(m), []); assert.deepEqual(SK.modelWarnings(m), []);
      m.pieces.forEach(p => assert.ok(!SK.modelCheck(m, { [p.id]: { x: p.x, y: p.y } }).ok[p.id], 'a piece does not start already right: ' + p.label));
    }
    if (q.kind === 'sort') { const s = c.q.sort; assert.equal(s.cards.length, q.sort.cards.length, 'no card was dropped'); assert.ok(s.cards.every(k => s.lanes.some(l => l.id === k.lane))); }
  }
  const pangaea = drift.questions[0].model; assert.deepEqual(pangaea.pieces.map(p => p.label), ['North America', 'South America', 'Africa', 'Eurasia', 'Greenland', 'India', 'Australia', 'Antarctica'], 'the 8 pieces of the puzzle');
  assert.ok(pangaea.pieces.reduce((n, p) => n + p.img.length, 0) < 300000, 'the pictures stay small, because every student is sent them');
  assert.ok(pangaea.pieces.every(p => p.art === 'img' && SK.imgOk(p.img) && p.ar > 0), 'the continents are the teacher-supplied pictures');
  assert.equal(drift.questions[3].sort.lanes.length, 4); assert.equal(drift.questions[6].sort.lanes.length, 2);
  const world = drift.questions[2]; assert.equal(world.bg, 'photo'); assert.match(world.img, /^data:image\/jpeg;base64,/); assert.equal(SK.checkQuestion(world).q.img, world.img, 'the map is kept');
  assert.deepEqual(world.model.pieces.map(p => p.label), pangaea.pieces.map(p => p.label), 'the same 8 pieces, placed on today’s map');
  const ws = drift.questions[4].sort, laneOf = i => ws.lanes.find(l => l.id === ws.cards[i - 1].lane).name;
  assert.deepEqual([1, 2, 5, 6, 8, 9].map(laneOf), Array(6).fill('Evidence'), 'the worksheet key: evidence');
  assert.deepEqual([3, 4, 7, 10].map(laneOf), Array(4).fill('Not evidence'), 'the worksheet key: not evidence');
});

await test('diagrams: Scatter keeps pieces off the middle of a diagram (the Sun, the Earth, the layers)', () => {
  for (const [bg, stage] of [['orbit', 'wide'], ['phases', 'wide'], ['rings', 'wide'], ['orbit', 'tall']]) {
    const m = SK.cleanModel({ ...MODEL().model, stage }), av = SK.bgAvoid(bg, m); assert.equal(av.length, 1); SK.scatter(m, av);
    m.pieces.forEach(p => assert.ok(Math.hypot(p.x - av[0].x, p.y - av[0].y) >= av[0].r, bg + '/' + stage + ': ' + p.label + ' starts on the diagram'));
  }
  assert.deepEqual(SK.bgAvoid('graph', SK.cleanModel(MODEL().model)), [], 'a plain background has nothing to avoid');
});

// ---- piece sizes, and a jigsaw whose pieces are close together ----
await test('sizes: a piece is as big as its size setting says, and the browser and the server agree where it may sit', async () => {
  assert.deepEqual(SK.boxOf({ art: 'earth' }), { w: 108, h: 108 }); assert.deepEqual(SK.boxOf({ art: 'earth', s: 2 }), { w: 216, h: 216 });
  assert.deepEqual(SK.boxOf({ art: 'card', s: 1 }), { w: 140.4, h: 86.4 }); assert.equal(SK.boxOf({ art: 'earth', s: 99 }).w, 432, 'the biggest is 400%'); assert.equal(SK.boxOf({ art: 'earth', s: 0.01 }).w, 54, 'the smallest is 50%');
  assert.deepEqual(SK.boxOf({ art: 'img', s: 2, ar: 2 }), { w: 216, h: 108 }, 'a wide picture: its long side is the size'); assert.deepEqual(SK.boxOf({ art: 'img', s: 1, ar: 0.5 }), { w: 54, h: 108 });
  assert.deepEqual(SK.boxOf({ art: 'img', s: 1 }), { w: 108, h: 108 }, 'no shape known: a square');
  const input = { question: 'Continents', bg: 'blank', model: { pieces: [
    { id: 1, label: 'Africa', art: 'img', img: PNG, ar: 0.8, s: 3, x: 5000, y: -50, kx: 5000, ky: 9999 },
    { id: 2, label: 'Small', art: 'earth', s: 0.01, x: 0, y: 0, kx: 0, ky: 0 }, { id: 3, label: 'Big card', art: 'card', s: 2.337, x: 100, y: 100, kx: 5000, ky: 0 }] } };
  const code = 'SIZEA', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  const s = client(); await s.ready; s.send({ t: 'join', code, name: 'Xan', bw: 800, bh: 500 }); await s.wait('joined'); s.clear();
  h.send({ t: 'q', ...input }); await sleep(100);
  const srv = h.last('q'), mine = SK.cleanModel(input.model);
  assert.deepEqual(mine.pieces.map(p => [p.id, p.s, p.ar, p.x, p.y]), srv.q.model.pieces.map(p => [p.id, p.s, p.ar, p.x, p.y]), 'size, shape and where the whole piece may sit agree');
  assert.deepEqual(Object.fromEntries(mine.pieces.map(p => [p.id, { x: p.kx, y: p.ky }])), srv.sk.pos);
  const p1 = mine.pieces[0], b1 = SK.boxOf(p1); assert.equal(p1.s, 3); assert.equal(p1.ar, 0.8); assert.equal(p1.x, 1000 - Math.round(b1.w / 2), 'the whole of a big piece stays on the board, on the right'); assert.equal(p1.y, Math.round(b1.h / 2), 'and at the top');
  assert.equal(mine.pieces[1].s, 0.5); assert.equal(mine.pieces[2].s, 2.35, 'sizes are kept to 5%');
  assert.ok(!('s' in SK.cleanModel({ pieces: [{ id: 1, label: 'a', art: 'earth', s: 1, x: 1, y: 1, kx: 1, ky: 1 }, { id: 2, label: 'b', x: 1, y: 1, kx: 1, ky: 1 }] }).pieces[0]), 'a normal size is not stored');
  const sq = s.last('q').q.model.pieces; assert.equal(sq[0].s, 3); assert.equal(sq[0].ar, 0.8); assert.ok(!('s' in sq[0] && sq[0].s === 1)); assert.ok(!('kx' in sq[0]), 'the size is public, the answer spot is not');
  // a student's piece is kept whole on the board using its size
  s.send({ t: 'place', p: { 1: { x: 5000, y: 5000 }, 2: { x: -9, y: -9 } } }); await sleep(100);
  const pl = h.last('pl').p; assert.deepEqual(pl[1], { x: 1000 - Math.round(b1.w / 2), y: 625 - Math.round(b1.h / 2) }); assert.deepEqual(pl[2], { x: 27, y: 27 }, 'a half-size piece may sit closer to the edge');
  [h, s].forEach(c => c.ws.close());
});

await test('sizes: pieces that are close together are a warning, not a reason to refuse the question (continents that fit together)', () => {
  const jig = { stage: 'wide', tol: 20, pieces: [
    { id: 1, label: 'South America', art: 'img', img: PNG, ar: 0.6, s: 2.5, x: 120, y: 450, kx: 380, ky: 330 },
    { id: 2, label: 'Africa', art: 'img', img: PNG, ar: 0.85, s: 3, x: 850, y: 450, kx: 470, ky: 300 },
    { id: 3, label: 'Antarctica', art: 'img', img: PNG, ar: 1.6, s: 2, x: 500, y: 560, kx: 520, ky: 440 }] };
  const m = SK.cleanModel(jig); assert.ok(m, 'saved'); assert.equal(m.tol, 20, 'Very tight (20) is allowed');
  assert.deepEqual(SK.modelIssues(m), [], 'nothing stops it from being saved');
  const w = SK.modelWarnings(m); assert.ok(w.some(t => /answer spots closer/.test(t)) === (Math.hypot(380 - 470, 330 - 300) < 20), 'warned only when they are closer than "how close counts"');
  m.tol = 150; assert.ok(SK.modelWarnings(m).some(t => /answer spots closer/.test(t) && /fine for a jigsaw/.test(t)), 'a loose setting warns, and says it is fine for a jigsaw');
  assert.deepEqual(SK.modelIssues(m), [], 'still nothing stops it');
  m.pieces[1].x = m.pieces[0].x; m.pieces[1].y = m.pieces[0].y; assert.ok(SK.modelWarnings(m).some(t => /overlap at the start/.test(t))); assert.deepEqual(SK.modelIssues(m), []);
  m.pieces[0].label = ' '; assert.ok(SK.modelIssues(m).some(t => /no label/.test(t)), 'a piece with no label still stops it');
  const t = SK.cleanModel({ ...jig, tol: 5 }); assert.equal(t.tol, 20, 'closer than 20 is held at 20');
});

await test('sizes: Scatter works for big pieces too, by asking for less room when the stage is crowded', () => {
  const m = SK.cleanModel({ pieces: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: 'P' + i, art: 'img', img: PNG, ar: 1, s: 2.5, x: 500, y: 300, kx: 150 + (i % 3) * 350, ky: 150 + Math.floor(i / 3) * 330 })) });
  SK.scatter(m); const st = SK.stageOf(m);
  m.pieces.forEach(p => { const b = SK.boxOf(p); assert.ok(p.x >= b.w / 2 - 1 && p.x <= st.w - b.w / 2 + 1 && p.y >= b.h / 2 - 1 && p.y <= st.h - b.h / 2 + 1, 'on the board: ' + p.label + ' ' + p.x + ',' + p.y); });
  assert.equal(new Set(m.pieces.map(p => p.x + ',' + p.y)).size, 6, 'six different start spots');
  const small = SK.cleanModel({ pieces: [{ id: 1, label: 'a', art: 'earth', x: 1, y: 1, kx: 200, ky: 200 }, { id: 2, label: 'b', art: 'earth', x: 1, y: 1, kx: 800, ky: 400 }] }); SK.scatter(small);
  small.pieces.forEach(p => small.pieces.forEach(q => assert.ok(Math.hypot(p.x - q.kx, p.y - q.ky) >= 108 * 1.3 - 1, 'normal-size pieces are scattered as before')));
});

await test('sizes: a pasted or imported question keeps the size and shape of its pieces', () => {
  const c = SK.checkQuestion({ question: 'Fit the continents', bg: 'blank', model: { spots: 'shown', pieces: [{ label: 'Africa', art: 'img', img: PNG, ar: 0.85, s: 3, kx: 500, ky: 300 }, { label: 'Europe', art: 'card', s: 0.8, kx: 520, ky: 120 }] } });
  assert.deepEqual([c.problems, c.q.model.pieces[0].s, c.q.model.pieces[0].ar, c.q.model.pieces[1].s], [[], 3, 0.85, 0.8]);
});

// ---- the teacher's marks give points to the student's team ----
await test('marks give points: Got it 2, Almost 1, Not yet 0 by default, and a changed mark takes back the old points', async () => {
  const code = 'MPTS1', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY, setup: { teams, roster: [] } }); const st0 = await h.wait('state');
  assert.deepEqual(st0.mpts, { on: true, got: 2, almost: 1, not: 0 });
  const mkS = async (name, team) => { const c = client(); await c.ready; c.send({ t: 'join', code, name, team, bw: 800, bh: 500 }); const j = await c.wait('joined'); return { c, id: j.id }; };
  const a = await mkS('Ann', 'ta'), b = await mkS('Bo', 'ta'), z = await mkS('Cy', 'tb'), none = await mkS('Di', null);
  const pr = client(); await pr.ready; pr.send({ t: 'watch', code }); await pr.wait('state');
  const score = (t = 'ta') => h.last('score').scores[t];
  const base = score(); h.clear();
  h.send({ t: 'mark', id: a.id, m: 'got' }); await sleep(80); assert.equal(score(), base + 2, 'Got it is worth 2');
  h.send({ t: 'mark', id: a.id, m: 'almost' }); await sleep(80); assert.equal(score(), base + 1, 'changing to Almost takes 1 back');
  h.send({ t: 'mark', id: b.id, m: 'got' }); await sleep(80); assert.equal(score(), base + 3, 'two students on one team add up (no one-point-per-team limit for marks)');
  h.send({ t: 'mark', id: a.id, m: 'not' }); await sleep(80); assert.equal(score(), base + 2, 'Not yet gives nothing and takes the old points back');
  h.send({ t: 'mark', id: a.id, m: null }); h.send({ t: 'mark', id: b.id, m: null }); await sleep(100); assert.equal(score(), base, 'taking the marks off takes every point back');
  h.send({ t: 'mark', id: z.id, m: 'got' }); await sleep(80); assert.equal(score('tb'), 2 + (st0.scores.tb || 0) + 0, 'the other team'); assert.equal(score(), base);
  h.clear(); h.send({ t: 'mark', id: none.id, m: 'got' }); await sleep(80); assert.match(h.last('note').m, /Put this student on a team/); assert.equal(h.last('mark').m, 'got', 'the mark itself is still saved');
  // students and the projector never learn what a mark is worth or who earned what
  for (const c of [a.c, pr]) { const txt = JSON.stringify(c.got); assert.ok(!/"mpts"|"mp"/.test(txt), 'no mark points in what this screen received'); }
  const h3 = client(); await h3.ready; h3.send({ t: 'host', code, key: KEY }); const hs = await h3.wait('state'); assert.equal(hs.students.find(x => x.id === z.id).mp, 2, 'a teacher screen is told what each mark earned'); h3.ws.close();
  const ps = client(); await ps.ready; ps.send({ t: 'watch', code }); assert.ok(!('mp' in (await ps.wait('state')).students[0]), 'the projector is not'); ps.ws.close();
  [h, a.c, b.c, z.c, none.c, pr].forEach(x => x.ws.close());
});

await test('marks give points: points follow a student who changes team, stay when the next question starts, and come back right after Undo', async () => {
  const code = 'MPTS2', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY, setup: { teams, roster: [] } }); await h.wait('state');
  const c = client(); await c.ready; c.send({ t: 'join', code, name: 'Eve', team: 'ta', bw: 800, bh: 500 }); const id = (await c.wait('joined')).id;
  const score = t => h.last('score').scores[t]; const a0 = score('ta') || 0, b0 = score('tb') || 0;
  h.send({ t: 'mark', id, m: 'got' }); await sleep(80); assert.equal(score('ta'), a0 + 2);
  h.send({ t: 'team', id, team: 'tb' }); await sleep(80); assert.deepEqual([score('ta'), score('tb')], [a0, b0 + 2], 'the 2 points moved with the student');
  h.send({ t: 'q', question: 'Next', bg: 'blank' }); await sleep(100); assert.equal(score('tb'), b0 + 2, 'points already earned stay');
  h.send({ t: 'mark', id, m: 'got' }); await sleep(80); assert.equal(score('tb'), b0 + 4, 'a new question, a new mark, new points');
  h.send({ t: 'q', question: 'Another', bg: 'blank' }); await sleep(80); h.send({ t: 'undoq' }); await sleep(120);
  assert.equal(score('tb'), b0 + 4, 'Undo does not change the score'); h.send({ t: 'mark', id, m: 'almost' }); await sleep(80);
  assert.equal(score('tb'), b0 + 3, 'and the mark that came back with Undo still knows what it gave');
  [h, c].forEach(x => x.ws.close());
});

await test('marks give points: the teacher can change what marks are worth, or turn it off, and the marks showing are re-priced', async () => {
  const code = 'MPTS3', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY, setup: { teams, roster: [] } }); await h.wait('state');
  const c = client(); await c.ready; c.send({ t: 'join', code, name: 'Fay', team: 'ta', bw: 800, bh: 500 }); const id = (await c.wait('joined')).id;
  const score = () => h.last('score').scores.ta; const a0 = score() || 0;
  h.send({ t: 'mark', id, m: 'got' }); await sleep(80); h.send({ t: 'mpts', on: true, got: 4, almost: 2, not: 1 }); await sleep(100);
  assert.deepEqual(h.last('score').mpts, { on: true, got: 4, almost: 2, not: 1 }); assert.equal(score(), a0 + 4, 'the mark already on is worth the new amount');
  h.send({ t: 'mark', id, m: 'not' }); await sleep(80); assert.equal(score(), a0 + 1, 'Not yet can be worth something');
  h.send({ t: 'mpts', on: false }); await sleep(100); assert.equal(score(), a0, 'switched off: the points are taken back'); assert.equal(h.last('score').mpts.on, false);
  h.send({ t: 'mark', id, m: 'got' }); await sleep(80); assert.equal(score(), a0, 'and marks give nothing while it is off');
  h.send({ t: 'mpts', on: true, got: 99, almost: -3, not: 'x' }); await sleep(100); assert.deepEqual(h.last('score').mpts, { on: true, got: 2, almost: 1, not: 0 }, 'values out of range fall back to the defaults');
  const h2 = client(); await h2.ready; h2.send({ t: 'host', code, key: KEY }); assert.deepEqual((await h2.wait('state')).mpts, { on: true, got: 2, almost: 1, not: 0 }, 'a second teacher screen gets them');
  [h, h2, c].forEach(x => x.ws.close());
});

// ---- "about the right place": an answer area for each piece ----
await test('areas: a piece can have its own area, up to 400, and the browser and the server agree on what counts', async () => {
  const input = { question: 'Continents', bg: 'blank', model: { tol: 60, pieces: [
    { id: 1, label: 'Africa', art: 'earth', x: 100, y: 100, kx: 500, ky: 300, tl: 220 },
    { id: 2, label: 'Spain', art: 'earth', x: 800, y: 100, kx: 300, ky: 300, tl: 5000 },
    { id: 3, label: 'Plain', art: 'earth', x: 100, y: 500, kx: 700, ky: 500 },
    { id: 4, label: 'Tiny', art: 'earth', x: 500, y: 500, kx: 850, ky: 150, tl: 1 }] } };
  const m = SK.cleanModel(input.model); assert.deepEqual(m.pieces.map(p => p.tl), [220, 400, undefined, 20], 'held between 20 and 400; none means the question setting');
  assert.deepEqual([1, 2, 3, 4].map(i => SK.tolOf(m, m.pieces[i - 1])), [220, 400, 60, 20]);
  const code = 'ZONA', h = client(); await h.ready; h.send({ t: 'host', code, key: KEY }); await h.wait('state');
  const s = client(); await s.ready; s.send({ t: 'join', code, name: 'Yu', bw: 800, bh: 500 }); await s.wait('joined'); s.clear();
  h.send({ t: 'q', ...input }); await sleep(100);
  const srv = h.last('q'); assert.deepEqual(srv.sk.tols, { 1: 220, 2: 400, 4: 20 }); assert.ok(!/"tols"|"tl"/.test(JSON.stringify(s.last('q').q)), 'the areas are a key: students do not get them');
  // 200 away from Africa's spot counts (area 220); 200 away from the plain piece (area 60) does not; 25 away from the tiny one (area 20) does not
  assert.deepEqual(SK.modelCheck(m, { 1: { x: 700, y: 300 }, 3: { x: 700, y: 700 }, 4: { x: 850, y: 175 } }).ok, { 1: true, 3: false, 4: false });
  h.send({ t: 'reveal', on: true }); await sleep(60); s.clear();
  s.send({ t: 'place', p: { 1: { x: 700, y: 300 }, 2: { x: 300, y: 300 }, 3: { x: 700, y: 700 }, 4: { x: 850, y: 175 } } }); await sleep(100);
  const fb = s.last('fb'); assert.deepEqual(fb.ok, { 1: true, 2: true, 3: false, 4: false }, 'the server counts the same pieces');
  assert.deepEqual(fb.where[4], { x: 850, y: 150 }, 'a small area is shown as the exact spot'); assert.equal(fb.where[3].r, undefined, 'a normal area too');
  s.send({ t: 'place', p: { 1: { x: 100, y: 100 }, 2: { x: 900, y: 600 } } }); await sleep(100);
  const far = s.last('fb'); assert.deepEqual(far.ok, { 1: false, 2: false }); assert.deepEqual(far.where[1], { x: 500, y: 300, r: 220 }, 'a big area is shown as an area, not one exact point'); assert.equal(far.where[2].r, 400);
  [h, s].forEach(c => c.ws.close());
});

await test('areas: a big area is "about right" in the results too, and the question-wide setting can be very loose', () => {
  const m = SK.cleanModel({ tol: 150, pieces: [{ id: 1, label: 'A', art: 'earth', x: 1, y: 1, kx: 300, ky: 300 }, { id: 2, label: 'B', art: 'earth', x: 1, y: 1, kx: 600, ky: 300, tl: 40 }] });
  assert.equal(m.tol, 150, 'Very loose is 150'); assert.equal(SK.cleanModel({ ...m, tol: 999 }).tol, 150, 'the question-wide setting stops at 150; a piece can go to 400');
  const mix = SK.modelMix(m, { 1: { x: 600, y: 330 }, 2: { x: 300, y: 330 } });
  assert.equal(mix[1], 2, 'A, put on B’s spot, is a mix-up with B'); assert.equal(mix[2], 1, 'B put on A’s spot (inside A’s area of 150, outside its own of 40)');
  assert.ok(!SK.modelWarnings(m).some(t => /answer spots closer/.test(t)), 'spots 300 apart are farther than the bigger of the two areas (150): nothing to look at');
  const near = SK.cleanModel({ tol: 20, pieces: [{ id: 1, label: 'A', art: 'earth', x: 1, y: 1, kx: 300, ky: 300, tl: 200 }, { id: 2, label: 'B', art: 'earth', x: 1, y: 1, kx: 400, ky: 300 }] });
  assert.ok(SK.modelWarnings(near).some(t => /answer spots closer/.test(t)), 'a big area that covers a neighbour’s spot is worth a look, never a blocker'); assert.deepEqual(SK.modelIssues(near), []);
  const c = SK.checkQuestion({ question: 'Q', bg: 'blank', model: { pieces: [{ label: 'a', kx: 100, ky: 100, tl: 250 }, { label: 'b', kx: 600, ky: 400 }] } }); assert.equal(c.q.model.pieces[0].tl, 250);
});

await test('the Figtree font file is served as woff2', async () => {
  const r = await fetch('http://localhost:' + PORT + '/fonts/figtree-latin-wght-normal.woff2');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'font/woff2');
});

console.log(pass + ' passed'); srv.kill();

