import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const MAX_STU = 60, MAX_ROOMS = 50;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const ROUTES = { '/': 'index.html', '/teacher': 'teacher.html', '/projector': 'projector.html' };

// ---- static files ----
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/healthz') return res.end('ok');
  const f = path.join(PUB, ROUTES[p] || p);
  if (!f.startsWith(PUB + path.sep) || !TYPES[path.extname(f)]) { res.statusCode = 404; return res.end('Not found'); }
  fs.readFile(f, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(f)]);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  });
});

// ---- rooms: all state in memory (ponytail: lost on restart; add a DB only if that hurts) ----
const rooms = new Map();
const tx = (ws, o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
const cleanCode = c => (typeof c === 'string' ? c.toUpperCase().trim() : '');
const goodCode = c => /^[A-Z0-9]{4,10}$/.test(c);

const PENS = ['pen', 'pencil', 'marker', 'hi'], KINDS = ['rect', 'ellipse', 'tri', 'diamond', 'star'], LINES = ['line', 'arrow'];
const MAX_OBJS = 1500, MAX_PTS = 6000;
const rng = (n, lo, hi) => typeof n === 'number' && n >= lo && n <= hi;
// each student's page is the size of their screen (d = {w,h}); everything must stay on that page
const dm = s => ({ w: s.bw, h: s.bh });
const pt = (a, d) => Array.isArray(a) && a.length === 2 && rng(a[0], -50, d.w + 50) && rng(a[1], -50, d.h + 50);
const dim = n => (Number.isInteger(n) && n >= 300 && n <= 3000 ? n : null);
// Every drawing object is rebuilt field by field, so nothing unexpected is stored or relayed.
function cleanObj(o, d) {
  if (!o || !Number.isInteger(o.id) || o.id < 1 || o.id > 1e9 || !/^#[0-9a-fA-F]{6}$/.test(o.c)) return null;
  const base = { id: o.id, c: o.c };
  if (o.k === 'text') {
    if (typeof o.t !== 'string' || !rng(o.size, 10, 200) || !rng(o.w, 20, d.w) || !rng(o.x, -50, d.w) || !rng(o.y, -50, d.h)) return null;
    return { ...base, k: 'text', x: o.x, y: o.y, w: o.w, size: o.size, t: o.t.slice(0, 300) };
  }
  if (!rng(o.lw, 0.1, 60)) return null;
  const st = { ...base, lw: o.lw, dash: ['solid', 'dashed', 'dotted'].includes(o.dash) ? o.dash : 'solid' };
  if (o.k === 'stroke') {
    if (!PENS.includes(o.pen) || !Array.isArray(o.pts) || !o.pts.length || o.pts.length > MAX_PTS || !o.pts.every(p => pt(p, d))) return null;
    return { ...st, k: 'stroke', pen: o.pen, pts: o.pts.map(p => [p[0], p[1]]) };
  }
  if (o.k === 'line') {
    if (!LINES.includes(o.s) || !Array.isArray(o.pts) || o.pts.length !== 2 || !o.pts.every(p => pt(p, d))) return null;
    return { ...st, k: 'line', s: o.s, pts: o.pts.map(p => [p[0], p[1]]) };
  }
  if (o.k === 'shape') {
    if (!KINDS.includes(o.s) || !rng(o.x, -50, d.w) || !rng(o.y, -50, d.h) || !rng(o.w, 1, d.w + 100) || !rng(o.h, 1, d.h + 100)) return null;
    return { ...st, k: 'shape', s: o.s, x: o.x, y: o.y, w: o.w, h: o.h, fill: ['none', 'light', 'solid'].includes(o.fill) ? o.fill : 'none' };
  }
  return null;
}
const cleanList = (a, d) => (Array.isArray(a) ? a.slice(0, MAX_OBJS).map(o => cleanObj(o, d)).filter(Boolean) : []);
// Questions may carry <b> <i> <u> <br> and nothing else; any other tag is stripped, stray < > are escaped.
function cleanHtml(s) {
  return String(s || '').slice(0, 2000).split(/(<[^>]*>)/).map(tok => {
    const m = /^<(\/?)(b|i|u)>$/i.exec(tok);
    if (m) return '<' + m[1] + m[2].toLowerCase() + '>';
    if (/^<br\s*\/?>$/i.test(tok)) return '<br>';
    if (/^<[^>]*>$/.test(tok)) return '';
    return tok.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }).join('');
}
function cleanQ(q = {}) {
  const img = typeof q.img === 'string' && q.img.startsWith('data:image/jpeg;base64,') && q.img.length < 4e6 ? q.img : null;
  let bg = ['graph', 'lined', 'blank', 'photo'].includes(q.bg) ? q.bg : 'graph';
  if (bg === 'photo' && !img) bg = 'blank';
  return { question: cleanHtml(q.question), bg, img };
}
// ---- teams and roster ----
// The roster only ever holds initials and a team. Real names stay in the teacher's browser and are never sent here.
const MAX_TEAMS = 12, MAX_ROSTER = 100;
function cleanTeams(a) {
  const seen = new Set();
  return (Array.isArray(a) ? a : []).slice(0, MAX_TEAMS).map(t => {
    if (!t || typeof t.id !== 'string' || !/^[a-z0-9]{1,8}$/.test(t.id) || seen.has(t.id)) return null;
    seen.add(t.id);
    return { id: t.id, name: String(t.name || '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Team', color: /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#2563eb', emoji: Array.from(String(t.emoji || '')).slice(0, 2).join('') };
  }).filter(Boolean);
}
const cleanIni = s => Array.from(String(s || '').replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()).slice(0, 6).join('');
function cleanRoster(a, teams) {
  const ids = new Set(teams.map(t => t.id)), seen = new Set();
  return (Array.isArray(a) ? a : []).slice(0, MAX_ROSTER).map(e => {
    if (!e || typeof e.rid !== 'string' || !/^[a-z0-9]{4,12}$/.test(e.rid) || seen.has(e.rid)) return null;
    const ini = cleanIni(e.ini); if (!ini) return null;
    seen.add(e.rid);
    return { rid: e.rid, ini, team: ids.has(e.team) ? e.team : null, sid: null };
  }).filter(Boolean);
}
const cleanScores = (o, teams) => Object.fromEntries(teams.map(t => [t.id, o && Number.isInteger(o[t.id]) && o[t.id] >= 0 && o[t.id] <= 9999 ? o[t.id] : 0]));
const live = s => !!(s && s.ws && s.ws.readyState === 1);
const entryOf = (r, rid) => r.roster.find(e => e.rid === rid);
const pubRoster = r => r.roster.map(e => ({ rid: e.rid, ini: e.ini, team: e.team }));
const stuView = s => ({ id: s.id, name: s.name, objs: s.objs, bw: s.bw, bh: s.bh, team: s.team || null, rid: s.rid || null, aw: !!s.aw });
const stateMsg = r => ({ t: 'state', q: r.q, simple: r.simple, spot: r.spot, hide: r.hide, board: r.board, teams: r.teams, roster: pubRoster(r), scores: r.scores, cap: r.cap, students: [...r.students.values()].map(stuView) });
// a point belongs to the team the student is on; if the student moves teams the point moves with them
function fixAwards(r) {
  r.students.forEach(s => {
    if (!s.aw || s.aw === s.team) return;
    if (s.aw in r.scores) r.scores[s.aw] = Math.max(0, r.scores[s.aw] - 1);
    if (s.team) { r.scores[s.team]++; s.aw = s.team; } else s.aw = null;
  });
}
function release(r, s, why) {
  if (s.rid) { const e = entryOf(r, s.rid); if (e && e.sid === s.id) e.sid = null; }
  r.students.delete(s.id); if (r.spot === s.id) r.spot = null;
  tx(s.ws, { t: 'kicked', why }); s.ws = null;
  toWatchers(r, { t: 'gone', id: s.id }); toWatchers(r, { t: 'spot', spot: r.spot, hide: r.hide });
}
function applySetup(r, m) {
  r.teams = cleanTeams(m.teams); r.cap = !!m.cap;
  const old = new Map(r.roster.map(e => [e.rid, e]));
  r.roster = cleanRoster(m.roster, r.teams).map(e => { const o = old.get(e.rid); if (o) e.sid = o.sid; return e; });
  r.scores = cleanScores(m.scores || r.scores, r.teams);
  r.students.forEach(s => { if (s.rid && !entryOf(r, s.rid)) release(r, s, 'Your teacher updated the class list. Join again.'); });
  r.students.forEach(s => { s.team = s.rid ? entryOf(r, s.rid).team : (r.teams.some(t => t.id === s.team) ? s.team : null); });
  fixAwards(r);
}
// tell everyone what changed: scores to all, team/award flags to the teacher and projector
function pushScores(r) {
  const o = { t: 'score', teams: r.teams, scores: r.scores, cap: r.cap };
  toWatchers(r, o); r.students.forEach(s => { tx(s.ws, o); tx(s.ws, { t: 'myteam', team: s.team || null }); });
  toWatchers(r, { t: 'setup', roster: pubRoster(r), metas: [...r.students.values()].map(s => ({ id: s.id, team: s.team || null, aw: !!s.aw })) });
}
const toWatchers = (r, o) => { const str = JSON.stringify(o); r.watchers.forEach(w => w.readyState === 1 && w.send(str)); }; // stringify once, not once per watcher
// a student can't edit while their work is on the projector
const lockMsg = (r, s) => tx(s.ws, { t: 'lock', proj: r.spot === s.id });

const wss = new WebSocketServer({ server, maxPayload: 6e6 });
wss.on('connection', ws => {
  let room = null, role = null, me = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'host' || m.t === 'watch') {
      const code = cleanCode(m.code);
      let r = rooms.get(code);
      if (m.t === 'host') {
        const key = typeof m.key === 'string' && m.key.length >= 8 && m.key.length <= 80 ? m.key : '';
        if (!goodCode(code) || !key) return tx(ws, { t: 'err', m: 'Bad code' });
        if (!r) {
          if (rooms.size >= MAX_ROOMS) return tx(ws, { t: 'err', m: 'Server busy' });
          r = { key, q: cleanQ(), simple: false, spot: null, hide: true, board: false, teams: [], roster: [], scores: {}, cap: false, qn: 0, students: new Map(), watchers: new Set(), last: Date.now() };
          if (m.setup && typeof m.setup === 'object') applySetup(r, m.setup); // a new room starts from the teacher's saved teams and scores
          rooms.set(code, r);
        } else if (r.key !== key) return tx(ws, { t: 'err', m: 'That code is in use by another teacher. Pick a different one.' });
        role = 'host';
      } else {
        if (!r) return tx(ws, { t: 'err', m: 'No class with that code yet' });
        role = 'watch';
      }
      room = r; r.watchers.add(ws);
      return tx(ws, stateMsg(r));
    }

    if (m.t === 'peek') { // student asks which teams / initials are on offer; initials are only revealed one team at a time
      const r = rooms.get(cleanCode(m.code));
      if (!r) return tx(ws, { t: 'err', m: 'Class not found. Check the code.' });
      if (!r.roster.length) return tx(ws, { t: 'peek', roster: false });
      const open = id => r.roster.filter(e => e.team === id && !live(r.students.get(e.sid))).length;
      if (m.team === undefined) {
        const teams = r.teams.filter(t => r.roster.some(e => e.team === t.id)).map(t => ({ id: t.id, name: t.name, color: t.color, emoji: t.emoji, open: open(t.id) }));
        if (r.roster.some(e => !e.team)) teams.push({ id: '', name: 'No team yet', color: '#6b7280', emoji: '', open: open(null) });
        return tx(ws, { t: 'peek', roster: true, teams });
      }
      const tid = m.team || null;
      return tx(ws, { t: 'peek', roster: true, team: tid || '', list: r.roster.filter(e => e.team === tid).map(e => ({ rid: e.rid, ini: e.ini, taken: live(r.students.get(e.sid)) })) });
    }

    if (m.t === 'join') {
      const r = rooms.get(cleanCode(m.code));
      if (!r) return tx(ws, { t: 'err', m: 'Class not found. Check the code.', nocls: true });
      let s = typeof m.id === 'string' ? r.students.get(m.id) : null;
      if (r.roster.length) { // a class list is loaded: students sign in by picking their initials, never by typing a name
        const e = typeof m.rid === 'string' ? entryOf(r, m.rid) : null;
        if (!e) return tx(ws, { t: 'err', m: 'Pick your initials from the list.', taken: true });
        const es = e.sid ? r.students.get(e.sid) : null;
        if (es && es !== s && live(es)) return tx(ws, { t: 'err', m: 'Those initials are already in use. Ask your teacher if that is you.', taken: true });
        if (es && s && es !== s) release(r, s, ''); // moving onto initials a disconnected student held
        s = es || s;
        if (s && s.rid && s.rid !== e.rid) { const old = entryOf(r, s.rid); if (old && old.sid === s.id) old.sid = null; }
        if (!s) {
          if (r.students.size >= MAX_STU) return tx(ws, { t: 'err', m: 'Class is full' });
          s = { id: randomUUID(), objs: [], bw: dim(m.bw) || 800, bh: dim(m.bh) || 500 };
          r.students.set(s.id, s);
        }
        s.rid = e.rid; e.sid = s.id; s.name = e.ini; s.team = e.team;
      } else {
        const name = String(m.name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
        if (!name) return tx(ws, { t: 'err', m: 'Type your first name' });
        if (!s) {
          if (r.students.size >= MAX_STU) return tx(ws, { t: 'err', m: 'Class is full' });
          s = { id: randomUUID(), name, objs: [], bw: dim(m.bw) || 800, bh: dim(m.bh) || 500 };
          r.students.set(s.id, s);
        }
        s.name = name;
      }
      // the student's own copy is the source of truth, so a server restart or dropped connection loses nothing.
      // A freshly loaded page (have=false) with nothing drawn must not wipe the saved drawing; it gets it sent back instead.
      if (Array.isArray(m.objs) && (m.objs.length || m.have) && r.spot !== s.id) s.objs = cleanList(m.objs, dm(s));
      s.ws = ws; me = s; room = r; role = 'student';
      tx(ws, { t: 'joined', id: s.id, q: r.q, objs: s.objs, bw: s.bw, bh: s.bh, simple: r.simple, proj: r.spot === s.id, teams: r.teams, scores: r.scores, team: s.team || null, ini: s.rid ? s.name : null });
      toWatchers(r, { t: 'join', s: stuView(s) });
      return pushScores(r);
    }

    if (!room) return;

    if (role === 'student') {
      if (room.students.get(me.id) !== me) return; // removed by Clear class
      if (room.spot === me.id) return lockMsg(room, me);
      if (m.t === 'set') { // add a new object or replace one with the same id
        const o = cleanObj(m.o, dm(me)); if (!o) return;
        const i = me.objs.findIndex(x => x.id === o.id);
        if (i >= 0) me.objs[i] = o; else if (me.objs.length < MAX_OBJS) me.objs.push(o); else return;
        toWatchers(room, { t: 'set', id: me.id, o });
      } else if (m.t === 'pts') { // more points for a pen stroke that is still being drawn
        const o = me.objs.find(x => x.id === m.oid), p = Array.isArray(m.p) ? m.p.slice(0, 200).filter(p => pt(p, dm(me))) : [];
        if (o && o.k === 'stroke' && p.length && o.pts.length + p.length <= MAX_PTS) { o.pts.push(...p.map(q => [q[0], q[1]])); toWatchers(room, { t: 'pts', id: me.id, oid: o.id, p }); }
      } else if (m.t === 'del') { me.objs = me.objs.filter(x => x.id !== m.oid); toWatchers(room, { t: 'del', id: me.id, oid: m.oid }); }
      else if (m.t === 'all') { me.objs = cleanList(m.objs, dm(me)); toWatchers(room, { t: 'all', id: me.id, objs: me.objs }); } // undo/redo/reorder
    } else if (role === 'host') {
      if (m.t === 'q') {
        room.q = cleanQ(m);
        room.qn++; room.students.forEach(s => { s.objs = []; s.aw = null; tx(s.ws, { t: 'q', q: room.q }); lockMsg(room, s); }); // a new question: every student can earn a point again
        toWatchers(room, { t: 'q', q: room.q });
        pushScores(room);
      } else if (m.t === 'mode') { // quick mode: students get just the pen and a few colors
        room.simple = !!m.simple;
        room.students.forEach(s => tx(s.ws, { t: 'mode', simple: room.simple }));
        toWatchers(room, { t: 'mode', simple: room.simple });
      } else if (m.t === 'spot') {
        const prev = room.spot;
        room.spot = room.students.has(m.id) ? m.id : null;
        room.hide = !!m.hide;
        toWatchers(room, { t: 'spot', spot: room.spot, hide: room.hide });
        [prev, room.spot].forEach(id => { const s = room.students.get(id); if (s) lockMsg(room, s); });
      } else if (m.t === 'reset') { // "Clear class": send everyone back to the join screen (teams, class list and scores are kept)
        room.students.forEach(s => tx(s.ws, { t: 'kicked' }));
        room.students.clear(); room.spot = null; room.roster.forEach(e => (e.sid = null));
        toWatchers(room, stateMsg(room));
      } else if (m.t === 'setup') { // teams, class list (initials only) and point rule, all replaced at once
        applySetup(room, m); pushScores(room);
      } else if (m.t === 'team') { // no class list loaded: put a nickname-joined student on a team (with a class list, the list decides)
        const s = room.students.get(m.id);
        if (s && !s.rid) { s.team = room.teams.some(t => t.id === m.team) ? m.team : null; fixAwards(room); pushScores(room); }
      } else if (m.t === 'award') { // +1 to the student's team for this question; on:false takes it back
        const s = room.students.get(m.id); if (!s) return;
        if (m.on && !s.aw) {
          if (!s.team) return tx(ws, { t: 'note', m: 'Put this student on a team first.' });
          if (room.cap && [...room.students.values()].some(x => x.aw === s.team)) return tx(ws, { t: 'note', m: 'That team already scored on this question.' });
          s.aw = s.team; room.scores[s.team] = Math.min(9999, (room.scores[s.team] || 0) + 1); pushScores(room);
        } else if (!m.on && s.aw) {
          if (s.aw in room.scores) room.scores[s.aw] = Math.max(0, room.scores[s.aw] - 1);
          s.aw = null; pushScores(room);
        }
      } else if (m.t === 'adj') { // manual +/- on a team
        if (room.teams.some(t => t.id === m.team) && [1, -1, 5, -5].includes(m.d)) { room.scores[m.team] = Math.min(9999, Math.max(0, room.scores[m.team] + m.d)); pushScores(room); }
      } else if (m.t === 'resetscores') {
        room.scores = cleanScores({}, room.teams); room.students.forEach(s => (s.aw = null)); pushScores(room);
      } else if (m.t === 'board') { // projector shows the leaderboard when no one's work is up
        room.board = !!m.on; toWatchers(room, { t: 'board', on: room.board });
      } else if (m.t === 'release') { // free up a student's initials (wrong pick, or a new device)
        const s = room.students.get(m.id); if (s) { release(room, s, 'Your teacher reset your sign-in. Join again.'); pushScores(room); }
      }
    }
  });

  ws.on('close', () => {
    if (!room) return;
    room.watchers.delete(ws);
    if (me && me.ws === ws) me.ws = null;
    room.last = Date.now();
  });
});

// keep connections alive through proxies, drop dead ones, forget classes idle for 6 hours
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
  rooms.forEach((r, code) => {
    const live = r.watchers.size || [...r.students.values()].some(s => s.ws);
    if (live) r.last = Date.now();
    else if (Date.now() - r.last > 6 * 3600e3) rooms.delete(code);
  });
}, 30000);

server.listen(PORT, () => console.log('Draw It Out running on port ' + PORT));
