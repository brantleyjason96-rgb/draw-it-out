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

await test('the Figtree font file is served as woff2', async () => {
  const r = await fetch('http://localhost:' + PORT + '/fonts/figtree-latin-wght-normal.woff2');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'font/woff2');
});

console.log(pass + ' passed'); srv.kill();

