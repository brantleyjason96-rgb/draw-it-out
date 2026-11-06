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
const stuView = s => ({ id: s.id, name: s.name, objs: s.objs, bw: s.bw, bh: s.bh });
const toWatchers = (r, o) => r.watchers.forEach(w => tx(w, o));
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
        s = { id: randomUUID(), name, objs: [], bw: dim(m.bw) || 800, bh: dim(m.bh) || 500 };
        r.students.set(s.id, s);
      }
      s.name = name;
      // the student's own copy is the source of truth, so a server restart or dropped connection loses nothing.
      // A freshly loaded page (have=false) with nothing drawn must not wipe the saved drawing; it gets it sent back instead.
      if (Array.isArray(m.objs) && (m.objs.length || m.have) && r.spot !== s.id) s.objs = cleanList(m.objs, dm(s));
      s.ws = ws; me = s; room = r; role = 'student';
      tx(ws, { t: 'joined', id: s.id, q: r.q, objs: s.objs, bw: s.bw, bh: s.bh, proj: r.spot === s.id });
      return toWatchers(r, { t: 'join', s: stuView(s) });
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
        room.students.forEach(s => { s.objs = []; tx(s.ws, { t: 'q', q: room.q }); lockMsg(room, s); });
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
