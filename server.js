import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const W = 800, H = 500, MAX_OPS = 40000, MAX_STU = 60, MAX_ROOMS = 50;
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
const num = n => typeof n === 'number' && n >= -50 && n <= W + 50;

const SHAPES = ['rect', 'ellipse', 'line', 'arrow'];
function cleanOp(o) {
  if (!o || !Number.isInteger(o.k) || !/^#[0-9a-fA-F]{6}$/.test(o.c)) return null;
  if (typeof o.w !== 'number' || o.w < 1 || o.w > 120) return null;
  const pt = a => Array.isArray(a) && a.length === 2 && num(a[0]) && num(a[1]);
  if (!pt(o.a) || !pt(o.b)) return null;
  const op = { k: o.k, c: o.c, w: o.w, e: false, a: [o.a[0], o.a[1]], b: [o.b[0], o.b[1]] };
  if (typeof o.tx === 'string') { op.tx = o.tx.slice(0, 200); return op.tx.trim() && o.w >= 10 ? op : null; } // text box
  if (o.w > 60) return null;
  if (SHAPES.includes(o.s)) return { ...op, s: o.s };                                                     // shape
  return { ...op, e: !!o.e };                                                                              // pen / eraser segment
}
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
function dropLast(ops) {
  if (!ops.length) return ops;
  const k = ops[ops.length - 1].k;
  return ops.filter(o => o.k !== k);
}
const stuView = s => ({ id: s.id, name: s.name, done: s.done, ops: s.ops });
const toWatchers = (r, o) => r.watchers.forEach(w => tx(w, o));
// a student can't edit once submitted, or while their work is on the projector
const lockMsg = (r, s) => tx(s.ws, { t: 'lock', done: s.done, proj: r.spot === s.id });

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
          r = { key, q: cleanQ(), spot: null, hide: true, students: new Map(), watchers: new Set(), last: Date.now() };
          rooms.set(code, r);
        } else if (r.key !== key) return tx(ws, { t: 'err', m: 'That code is in use by another teacher. Pick a different one.' });
        role = 'host';
      } else {
        if (!r) return tx(ws, { t: 'err', m: 'No class with that code yet' });
        role = 'watch';
      }
      room = r; r.watchers.add(ws);
      return tx(ws, { t: 'state', q: r.q, spot: r.spot, hide: r.hide, students: [...r.students.values()].map(stuView) });
    }

    if (m.t === 'join') {
      const r = rooms.get(cleanCode(m.code));
      if (!r) return tx(ws, { t: 'err', m: 'Class not found. Check the code.', nocls: true });
      const name = String(m.name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
      if (!name) return tx(ws, { t: 'err', m: 'Type your first name' });
      let s = typeof m.id === 'string' ? r.students.get(m.id) : null;
      if (!s) {
        if (r.students.size >= MAX_STU) return tx(ws, { t: 'err', m: 'Class is full' });
        s = { id: randomUUID(), name, done: false, ops: [] };
        r.students.set(s.id, s);
      }
      s.name = name;
      // the student's own copy is the source of truth, so a server restart or dropped connection loses nothing
      // (an empty list from a refreshed page must not wipe the saved drawing; it gets sent back instead)
      if (Array.isArray(m.ops) && m.ops.length && !s.done && r.spot !== s.id) s.ops = m.ops.slice(0, MAX_OPS).map(cleanOp).filter(Boolean);
      s.ws = ws; me = s; room = r; role = 'student';
      tx(ws, { t: 'joined', id: s.id, q: r.q, ops: s.ops, done: s.done, proj: r.spot === s.id });
      return toWatchers(r, { t: 'join', s: stuView(s) });
    }

    if (!room) return;

    if (role === 'student') {
      if (room.students.get(me.id) !== me) return; // removed by Clear class
      if (m.t === 'done') { // submit is one-way for the student; only the teacher can reopen
        if (m.v && !me.done) { me.done = true; toWatchers(room, { t: 'done', id: me.id, v: true }); lockMsg(room, me); }
        return;
      }
      if (me.done || room.spot === me.id) return lockMsg(room, me);
      if (m.t === 'd') {
        const o = cleanOp(m.o);
        if (o && me.ops.length < MAX_OPS) { me.ops.push(o); toWatchers(room, { t: 'd', id: me.id, o }); }
      } else if (m.t === 'undo') { me.ops = dropLast(me.ops); toWatchers(room, { t: 'undo', id: me.id }); }
      else if (m.t === 'clear') { me.ops = []; toWatchers(room, { t: 'clear', id: me.id }); }
    } else if (role === 'host') {
      if (m.t === 'q') {
        room.q = cleanQ(m);
        room.students.forEach(s => { s.ops = []; s.done = false; tx(s.ws, { t: 'q', q: room.q }); lockMsg(room, s); });
        toWatchers(room, { t: 'q', q: room.q });
      } else if (m.t === 'spot') {
        const prev = room.spot;
        room.spot = room.students.has(m.id) ? m.id : null;
        room.hide = !!m.hide;
        toWatchers(room, { t: 'spot', spot: room.spot, hide: room.hide });
        [prev, room.spot].forEach(id => { const s = room.students.get(id); if (s) lockMsg(room, s); });
      } else if (m.t === 'reset') { // "Clear class": send everyone back to the join screen
        room.students.forEach(s => tx(s.ws, { t: 'kicked' }));
        room.students.clear(); room.spot = null;
        toWatchers(room, { t: 'state', q: room.q, spot: null, hide: room.hide, students: [] });
      } else if (m.t === 'reopen') { // teacher "unsubmit"
        const s = room.students.get(m.id);
        if (s && s.done) {
          s.done = false; toWatchers(room, { t: 'done', id: s.id, v: false });
          if (room.spot === s.id) { room.spot = null; toWatchers(room, { t: 'spot', spot: null, hide: room.hide }); } // projected work stays locked, so take it off
          lockMsg(room, s);
        }
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
