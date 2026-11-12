import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { randomUUID, createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const MAX_STU = 60, MAX_ROOMS = +process.env.MAX_ROOMS || 200;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };
const ROUTES = { '/': 'index.html', '/teacher': 'teacher.html', '/class': 'class.html', '/sets': 'sets.html', '/projector': 'projector.html', '/start': 'landing.html', '/join': 'index.html', '/favicon.ico': 'favicon.svg' };

// ---- static files ----
// Text files are compressed once (gzip) and kept in memory with an ETag, so a repeat load on school wifi is a tiny 304 reply.
// An entry is rebuilt when the file's modified time or size changes. The whole public folder is small, so memory is not a concern.
const TEXTY = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg']);
const staticCache = new Map();
function loadStatic(f, cb) {
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) return cb(null);
    const c = staticCache.get(f);
    if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) return cb(c);
    fs.readFile(f, (e, raw) => {
      if (e) return cb(null);
      const ext = path.extname(f), gz = TEXTY.has(ext) && raw.length > 512 ? zlib.gzipSync(raw, { level: 9 }) : null;
      const hashes = ext === '.html' ? inlineScriptHashes(raw.toString('utf8')) : null;
      const entry = { mtimeMs: st.mtimeMs, size: st.size, ext, raw, hashes, gz: gz && gz.length < raw.length ? gz : null, etag: createHash('sha1').update(raw).digest('base64url').slice(0, 22) };
      staticCache.set(f, entry); cb(entry);
    });
  });
}
// ---- security headers ----
// Content-Security-Policy: scripts only from this site plus the pages' own inline scripts, each allowed by its SHA-256 hash (so no
// 'unsafe-inline' for scripts: an injected script would not match any hash). Styles need 'unsafe-inline' (the pages use style
// attributes). Images may be this site, data: (photos, the QR code) or blob: (a photo being resized). The only network connection
// the page may open is back to this site, including the WebSocket. Nothing may frame these pages.
const inlineScriptHashes = html => [...html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => "'sha256-" + createHash('sha256').update(m[1]).digest('base64') + "'");
const cspFor = (hashes, host) => {
  const h = typeof host === 'string' && /^[A-Za-z0-9.\-:\[\]]{1,100}$/.test(host) ? host : ''; // the Host header is only used when it looks like a host name
  return ["default-src 'self'", "script-src 'self' " + (hashes || []).join(' '), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
    "connect-src 'self'" + (h ? ' ws://' + h + ' wss://' + h : ''), "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
};
const secure = (req, res) => {
  res.setHeader('X-Frame-Options', 'DENY'); // (frame-ancestors in the CSP says the same for newer browsers)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (process.env.TRUST_PROXY && /https/i.test(String(req.headers['x-forwarded-proto'] || ''))) res.setHeader('Strict-Transport-Security', 'max-age=15552000'); // 6 months, only behind HTTPS
};
const matchEtag = (hdr, tag) => !!hdr && (hdr.trim() === '*' || hdr.split(',').some(x => x.trim().replace(/^W\//, '') === tag));
const CACHE = { '.woff2': 'public, max-age=604800', '.svg': 'public, max-age=86400' }; // everything else is revalidated each time (cheap with the ETag)
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.statusCode = 400; return res.end('Bad request'); }
  if (p === '/healthz') { res.setHeader('Cache-Control', 'no-store'); return res.end(req.method === 'HEAD' ? undefined : 'ok'); } // for an uptime monitor
  // /Teacher, /teacher/ and /join all work: page names ignore capitals and a trailing slash
  const route = ROUTES[p] || ROUTES[(p.length > 1 ? p.replace(/\/+$/, '') : p).toLowerCase()];
  const f = path.join(PUB, route || p);
  // a page address (no file extension, or .html) that does not exist gets a friendly page; anything else is a plain 404
  const wantsPage = !path.extname(p) || path.extname(p) === '.html';
  const missing = () => {
    res.statusCode = 404; res.setHeader('X-Content-Type-Options', 'nosniff'); secure(req, res);
    if (!wantsPage) return res.end('Not found');
    fs.readFile(path.join(PUB, 'notfound.html'), (e, d) => { res.setHeader('Content-Type', TYPES['.html']); res.setHeader('Cache-Control', 'no-cache'); if (!e) res.setHeader('Content-Security-Policy', cspFor(inlineScriptHashes(d.toString('utf8')), req.headers.host)); res.end(e ? 'Not found' : d); });
  };
  if (!f.startsWith(PUB + path.sep) || !TYPES[path.extname(f)]) return missing();
  loadStatic(f, entry => {
    if (!entry) return missing();
    const gzip = !!entry.gz && /\bgzip\b/i.test(req.headers['accept-encoding'] || '');
    const tag = '"' + entry.etag + (gzip ? '-gz' : '') + '"';
    res.setHeader('Content-Type', TYPES[entry.ext]);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer'); // class codes and shared-set links are never leaked to other sites
    secure(req, res); if (entry.hashes) res.setHeader('Content-Security-Policy', cspFor(entry.hashes, req.headers.host));
    res.setHeader('Cache-Control', CACHE[entry.ext] || 'no-cache');
    res.setHeader('ETag', tag);
    if (entry.gz) res.setHeader('Vary', 'Accept-Encoding');
    const inm = req.headers['if-none-match'];
    if (matchEtag(inm, '"' + entry.etag + '"') || matchEtag(inm, '"' + entry.etag + '-gz"') || matchEtag(inm, tag)) { res.statusCode = 304; return res.end(); }
    const body = gzip ? entry.gz : entry.raw;
    if (gzip) res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', body.length);
    res.end(req.method === 'HEAD' ? undefined : body);
  });
});

// ---- rooms: all state in memory (ponytail: lost on restart; add a DB only if that hurts) ----
const rooms = new Map();
const tx = (ws, o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
const cleanCode = c => (typeof c === 'string' ? c.toUpperCase().trim() : '');
const goodCode = c => /^[A-Z0-9]{4,10}$/.test(c);

const PENS = ['pen', 'pencil', 'marker', 'hi'], KINDS = ['rect', 'ellipse', 'tri', 'diamond', 'star'], LINES = ['line', 'arrow'];
const MAX_OBJS = 1500, MAX_PTS = 6000;
const MARKS = ['got', 'almost', 'not'];
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
const BGS = ['graph', 'lined', 'blank', 'photo', 'orbit', 'rings', 'phases', 'plates']; // the last four are drawn diagrams (public/common.js)
function cleanQ(q = {}) {
  const img = typeof q.img === 'string' && q.img.startsWith('data:image/jpeg;base64,') && q.img.length < 4e6 ? q.img : null;
  let bg = BGS.includes(q.bg) ? q.bg : 'graph';
  if (bg === 'photo' && !img) bg = 'blank';
  return { question: cleanHtml(q.question), bg, img };
}
// ---- sort questions: cards the student drops into lanes ----
// The answer key (which lane each card belongs in, and each card's idea tag) is kept in r.sk and is only ever sent to hosts.
// Students and the projector get lanes and card text, nothing else.
const MAX_LANES = 6, MAX_CARDS = 24;
const cstr = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
function cleanSort(m) {
  const s = m && m.sort; if (!s || typeof s !== 'object') return null;
  const lanes = [], lid = new Set();
  (Array.isArray(s.lanes) ? s.lanes : []).slice(0, MAX_LANES).forEach(l => {
    const id = l && typeof l.id === 'string' && /^[A-Za-z0-9]{1,8}$/.test(l.id) && !lid.has(l.id) ? l.id : null, name = id && cstr(l.name, 24);
    if (id && name) { lid.add(id); lanes.push({ id, name }); }
  });
  const cards = [], seen = new Set(), lane = {}, idea = {};
  (Array.isArray(s.cards) ? s.cards : []).slice(0, MAX_CARDS).forEach(c => {
    if (!c || !Number.isInteger(c.id) || c.id < 1 || c.id > 1e6 || seen.has(c.id)) return;
    const text = cstr(c.text, 60); if (!text || !lid.has(c.lane)) return;
    seen.add(c.id); cards.push({ id: c.id, text }); lane[c.id] = c.lane;
    const i = cstr(c.idea, 30); if (i) idea[c.id] = i;
  });
  if (lanes.length < 2 || cards.length < 2) return null;
  return { pub: { question: cleanHtml(m.question), bg: 'blank', img: null, kind: 'sort', sort: { lanes, cards, shuffle: s.shuffle !== false, fb: s.fb === 'now' ? 'now' : 'reveal' } }, key: { lane, idea } };
}
const sortOf = r => (r.q.kind === 'sort' ? r.q.sort : null);
// a student's placements, rebuilt against the live question: { cardId: laneId }
function cleanPlace(r, p) {
  const sq = sortOf(r), out = {}; if (!sq || !p || typeof p !== 'object') return out;
  sq.cards.forEach(c => { if (sq.lanes.some(l => l.id === p[c.id])) out[c.id] = p[c.id]; });
  return out;
}
// ---- movable pieces on a draw question: the student drags pieces on a stage, then draws on top ----
// Positions are stage units (wide 1000x625, tall 625x1000), the centre of the piece. The answer key (where each piece belongs, its idea, and
// how close counts) is kept in r.sk = { pos, idea, tol } and is only ever sent to hosts. Students and the projector get the pieces and their
// start spots. Only when the teacher chose "show outlines" (spots: 'shown') are the answer spots public, on purpose.
const MAX_PIECES = 12, PIECE_A = 108, IMG_MAX = 140000, IMG_TOTAL = 700000;
const PIECE_ARTS = ['earth', 'sun', 'moon', 'arrow', 'card', 'moon-new', 'moon-crescent', 'moon-quarter', 'moon-gibbous', 'moon-full', 'moon-crescent-l', 'moon-quarter-l', 'moon-gibbous-l', 'img'];
// the size of a piece on the board; the same rule as SK.boxOf in public/sortkit.js
const boxOf = p => {
  const s = isNum(p.s) ? Math.min(4, Math.max(.5, p.s)) : 1;
  if (p.art === 'card') return { w: PIECE_A * 1.3 * s, h: PIECE_A * .8 * s };
  if (p.art === 'img' && isNum(p.ar) && p.ar > 0) { const ar = Math.min(5, Math.max(.2, p.ar)); return ar >= 1 ? { w: PIECE_A * s, h: PIECE_A * s / ar } : { w: PIECE_A * s * ar, h: PIECE_A * s }; }
  return { w: PIECE_A * s, h: PIECE_A * s };
};
const imgOk = v => typeof v === 'string' && v.length <= IMG_MAX && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v);
const ang = v => ((Math.round(v) % 360) + 360) % 360;
const angDiff = (a, b) => { const d = (((a - b) % 360) + 360) % 360; return Math.min(d, 360 - d); };
const STAGES = { wide: { w: 1000, h: 625 }, tall: { w: 625, h: 1000 } };
const isNum = v => typeof v === 'number' && Number.isFinite(v);
function cleanModel(m) {
  if (!m || typeof m !== 'object') return null;
  const stage = m.stage === 'tall' ? 'tall' : 'wide', st = STAGES[stage], cl = (v, a, b) => Math.min(b, Math.max(a, v));
  const pieces = [], seen = new Set(), pos = {}, idea = {}, ka = {}; let imgBytes = 0;
  (Array.isArray(m.pieces) ? m.pieces : []).slice(0, MAX_PIECES).forEach(p => {
    if (!p || !Number.isInteger(p.id) || p.id < 1 || p.id > 1e6 || seen.has(p.id)) return;
    const label = cstr(p.label, 24); if (!label || !isNum(p.x) || !isNum(p.y) || !isNum(p.kx) || !isNum(p.ky)) return;
    let art = PIECE_ARTS.includes(p.art) ? p.art : 'card', img = null;
    if (art === 'img') { if (imgOk(p.img) && imgBytes + p.img.length <= IMG_TOTAL) { img = p.img; imgBytes += img.length; } else art = 'card'; }
    seen.add(p.id);
    const s = isNum(p.s) ? Math.round(cl(p.s, .5, 4) * 20) / 20 : 1, ar = art === 'img' && isNum(p.ar) ? Math.round(cl(p.ar, .2, 5) * 100) / 100 : null;
    const bx = boxOf({ art, s, ar }), cx = v => Math.round(cl(v, bx.w / 2, st.w - bx.w / 2)), cy = v => Math.round(cl(v, bx.h / 2, st.h - bx.h / 2)); // the whole piece stays on the board
    const o = { id: p.id, label, art, x: cx(p.x), y: cy(p.y) };
    if (s !== 1) o.s = s;
    if (img) { o.img = img; if (ar) o.ar = ar; }
    if (p.turn === true) { o.turn = true; o.a = ang(isNum(p.a) ? p.a : 0); ka[p.id] = ang(isNum(p.ka) ? p.ka : 0); }
    pieces.push(o);
    pos[p.id] = { x: cx(p.kx), y: cy(p.ky) };
    const i = cstr(p.idea, 30); if (i) idea[p.id] = i;
  });
  if (pieces.length < 2) return null;
  const spots = m.spots === 'shown' ? 'shown' : 'hidden', tol = isNum(m.tol) ? Math.round(Math.min(150, Math.max(20, m.tol))) : 60, atol = isNum(m.atol) ? Math.round(Math.min(90, Math.max(10, m.atol))) : 30;
  if (spots === 'shown') pieces.forEach(p => { p.kx = pos[p.id].x; p.ky = pos[p.id].y; if (p.turn) p.ka = ka[p.id]; });
  return { pub: { stage, spots, fb: m.fb === 'now' ? 'now' : 'reveal', pieces }, key: { pos, idea, tol, ang: ka, atol } };
}
// one door for every question that arrives: { nq, nk } or null when it is not complete
function cleanQuestion(m) {
  if (m.kind === 'sort') { const c = cleanSort(m); return c && { nq: c.pub, nk: c.key }; }
  const nq = cleanQ(m);
  if (m.model !== undefined && m.model !== null) { const c = cleanModel(m.model); if (!c) return null; nq.model = c.pub; return { nq, nk: c.key }; }
  return { nq, nk: null };
}
const modelOf = r => r.q.model || null;
// a student's moved pieces, rebuilt against the live question: { pieceId: { x, y } } (a piece the student has not moved is not in it)
function cleanPl(r, p) {
  const mq = modelOf(r), out = {}; if (!mq || !p || typeof p !== 'object') return out;
  const st = STAGES[mq.stage];
  mq.pieces.forEach(c => {
    const v = p[c.id]; if (!v || typeof v !== 'object' || !isNum(v.x) || !isNum(v.y)) return;
    const bx = boxOf(c);
    out[c.id] = { x: Math.round(Math.min(st.w - bx.w / 2, Math.max(bx.w / 2, v.x))), y: Math.round(Math.min(st.h - bx.h / 2, Math.max(bx.h / 2, v.y))) };
    if (c.turn) out[c.id].a = ang(isNum(v.a) ? v.a : c.a || 0); // a piece that can turn always carries its angle; one that cannot never does
  });
  return out;
}
const placedAll = (r, s) => { const sq = sortOf(r); return !!sq && sq.cards.every(c => s.sort && s.sort[c.id]); };
// right/wrong for a student: only when the question gives feedback right away, or the teacher pressed Reveal
// right = within reach of its spot, and (for a piece that turns) facing within the angle tolerance
const pieceRight = (r, id, p) => { const k = r.sk.pos[id]; if (!k || !p) return false; return Math.hypot(p.x - k.x, p.y - k.y) <= r.sk.tol && (!(id in r.sk.ang) || angDiff(p.a || 0, r.sk.ang[id]) <= r.sk.atol); };
function fbOf(r, s) {
  const mq = modelOf(r);
  if (mq) { // pieces: right when the centre is within the teacher's distance of its spot; a wrong piece also learns where it belongs, on Reveal
    if (!r.sk || !(r.revealed || mq.fb === 'now')) return null;
    const ok = {}, where = {};
    Object.keys(s.pl || {}).forEach(id => { const k = r.sk.pos[id], p = s.pl[id]; if (!k) return; ok[id] = pieceRight(r, id, p); if (r.revealed && !ok[id]) where[id] = id in r.sk.ang ? { x: k.x, y: k.y, a: r.sk.ang[id] } : k; });
    return { t: 'fb', ok, where };
  }
  const sq = sortOf(r); if (!sq || !r.sk || !(r.revealed || sq.fb === 'now')) return null;
  const ok = {}, where = {};
  Object.keys(s.sort || {}).forEach(id => { ok[id] = s.sort[id] === r.sk.lane[id]; if (r.revealed && !ok[id]) where[id] = r.sk.lane[id]; });
  return { t: 'fb', ok, where };
}
// everything a student's page needs to (re)build itself: used on join, on rejoin, and when the teacher undoes a question
const joinedMsg = (r, s) => ({ t: 'joined', id: s.id, tok: s.tok, q: r.q, sort: s.sort || {}, pl: s.pl || {}, done: !!s.done, fb: fbOf(r, s), objs: s.objs, bw: s.bw, bh: s.bh, simple: r.simple, proj: r.picks.includes(s.id), frozen: !!r.frozen, pulse: s.pulse || null, timer: timerView(r), host: [...r.watchers].some(w => w.isHost && w.readyState === 1), teams: r.teams, scores: r.scores, team: s.team || null, ini: s.rid ? s.name : null });
const sendFb = (r, s) => { const f = fbOf(r, s); if (f) tx(s.ws, f); };
// class-wide numbers for the projector: % right per card and per idea (no names, no key)
function sortSummary(r) {
  const sq = sortOf(r); if (!sq || !r.sk) return null;
  const list = [...r.students.values()].filter(s => s.sort && Object.keys(s.sort).length);
  const cards = sq.cards.map(c => ({ id: c.id, text: c.text, pct: list.length ? Math.round(100 * list.filter(s => s.sort[c.id] === r.sk.lane[c.id]).length / list.length) : 0 }));
  const by = {}; sq.cards.forEach(c => { const i = r.sk.idea[c.id]; if (i) (by[i] = by[i] || []).push(cards.find(x => x.id === c.id).pct); });
  return { t: 'sum', n: list.length, cards, ideas: Object.entries(by).map(([name, a]) => ({ name, pct: Math.round(a.reduce((x, y) => x + y, 0) / a.length) })) };
}
// the same numbers for a pieces question: % of the students who moved a piece that have it within reach of its spot (no names, no key)
function modelSummary(r) {
  const mq = modelOf(r); if (!mq || !r.sk) return null;
  const list = [...r.students.values()].filter(s => s.pl && Object.keys(s.pl).length);
  const right = (s, id) => pieceRight(r, id, s.pl[id]);
  const cards = mq.pieces.map(c => ({ id: c.id, text: c.label, pct: list.length ? Math.round(100 * list.filter(s => right(s, c.id)).length / list.length) : 0 }));
  const by = {}; mq.pieces.forEach(c => { const i = r.sk.idea[c.id]; if (i) (by[i] = by[i] || []).push(cards.find(x => x.id === c.id).pct); });
  return { t: 'sum', n: list.length, cards, ideas: Object.entries(by).map(([name, a]) => ({ name, pct: Math.round(a.reduce((x, y) => x + y, 0) / a.length) })) };
}
const classSummary = r => (modelOf(r) ? modelSummary(r) : sortSummary(r));
let sumTimer = new Map();
function pushSummary(r) { // at most twice a second, and only while the teacher has results on the projector
  if (!r.sres || sumTimer.get(r)) return;
  sumTimer.set(r, setTimeout(() => { sumTimer.delete(r); const o = classSummary(r); if (o) toPublic(r, o); }, 500));
}
// ---- teams and roster ----
// The roster only ever holds initials and a team. Real names stay in the teacher's browser and are never sent here.
const MAX_TEAMS = 12, MAX_ROSTER = 100;
const trunc = (s, n) => Array.from(String(s == null ? '' : s)).slice(0, n).join(''); // by code point, so an emoji is never cut in half
function cleanTeams(a) {
  const seen = new Set();
  return (Array.isArray(a) ? a : []).slice(0, MAX_TEAMS).map(t => {
    if (!t || typeof t.id !== 'string' || !/^[a-z0-9]{1,8}$/.test(t.id) || seen.has(t.id)) return null;
    seen.add(t.id);
    return { id: t.id, name: trunc(String(t.name || '').replace(/\s+/g, ' ').trim(), 20) || 'Team', color: /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#2563eb', emoji: trunc(t.emoji, 8) };
  }).filter(Boolean);
}
const cleanName = v => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 20);
// two students with the same nickname get " 2", " 3"… so the teacher can tell their cards apart
function uniqueName(r, name, self) {
  const used = new Set([...r.students.values()].filter(x => x !== self).map(x => String(x.name).toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) { const suf = ' ' + n, cand = Array.from(name).slice(0, 20 - suf.length).join('').trimEnd() + suf; if (!used.has(cand.toLowerCase())) return cand; }
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
// pulse = the student's own red / amber / green confidence on the current drawing: 'r' | 'y' | 'g' | null
const stuView = s => ({ id: s.id, name: s.name, objs: s.objs, bw: s.bw, bh: s.bh, team: s.team || null, rid: s.rid || null, aw: !!s.aw, sort: s.sort || {}, pl: s.pl || {}, done: !!s.done, pulse: s.pulse || null, live: live(s) });
// picks = the drawings on the projector (up to 3, side by side). spot is kept as the first pick for older screens.
const stateMsg = (r, host) => ({ t: 'state', fresh: !r.qn && !r.restored, qat: r.qat, marks: host ? r.marks : undefined, timer: timerView(r), q: r.q, sk: host ? r.sk : undefined, revealed: !!r.revealed, sres: !!r.sres, simple: r.simple, spot: r.spot, picks: [...r.picks], hide: r.hide, board: r.board, frozen: !!r.frozen, phist: host ? r.phist : undefined, teams: r.teams, roster: pubRoster(r), scores: r.scores, cap: r.cap, students: [...r.students.values()].map(stuView) });
// a point belongs to the team the student is on; if the student moves teams the point moves with them
function fixAwards(r) {
  r.students.forEach(s => {
    if (!s.aw || s.aw === s.team) return;
    if (s.aw in r.scores) r.scores[s.aw] = Math.max(0, r.scores[s.aw] - 1);
    if (s.team) { r.scores[s.team]++; s.aw = s.team; } else s.aw = null;
  });
}
function release(r, s, why) {
  delete r.marks[s.id];
  if (s.rid) { const e = entryOf(r, s.rid); if (e && e.sid === s.id) e.sid = null; }
  r.students.delete(s.id); r.picks = r.picks.filter(id => id !== s.id); r.spot = r.picks[0] || null;
  tx(s.ws, { t: 'kicked', why }); s.ws = null;
  toWatchers(r, { t: 'gone', id: s.id }); toWatchers(r, { t: 'spot', spot: r.spot, picks: [...r.picks], hide: r.hide });
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
// Rename, re-icon, recolour or reorder teams. Identity only: the class list and the points are not replaced.
// A removed team takes its points with it, and its students and class-list entries become "no team".
function setTeams(r, list) {
  r.teams = cleanTeams(list);
  const ids = new Set(r.teams.map(t => t.id));
  r.scores = cleanScores(r.scores, r.teams);
  r.roster.forEach(e => { if (!ids.has(e.team)) e.team = null; });
  r.students.forEach(s => {
    const e = s.rid && entryOf(r, s.rid);
    if (e) s.team = e.team;
    else if (!ids.has(s.team)) s.team = null;
  });
  fixAwards(r);
  pushScores(r);
}
// tell everyone what changed: scores to all, team/award flags to the teacher and projector
function pushScores(r) {
  const o = { t: 'score', teams: r.teams, scores: r.scores, cap: r.cap };
  toWatchers(r, o); r.students.forEach(s => { tx(s.ws, o); tx(s.ws, { t: 'myteam', team: s.team || null }); });
  toWatchers(r, { t: 'setup', roster: pubRoster(r), metas: [...r.students.values()].map(s => ({ id: s.id, team: s.team || null, aw: !!s.aw })) });
}
const toWatchers = (r, o) => { const str = JSON.stringify(o); r.watchers.forEach(w => w.readyState === 1 && w.send(str)); }; // stringify once, not once per watcher
const toHosts = (r, o) => { const str = JSON.stringify(o); r.watchers.forEach(w => w.isHost && w.readyState === 1 && w.send(str)); }; // the answer key goes here and nowhere else
const toPublic = (r, o) => { const str = JSON.stringify(o); r.watchers.forEach(w => !w.isHost && w.readyState === 1 && w.send(str)); };
// the host copy of the room state carries the answer key; the projector's copy never does
const broadcastState = r => r.watchers.forEach(w => w.readyState === 1 && w.send(JSON.stringify(stateMsg(r, w.isHost))));
// a student can't edit while their work is on the projector
const lockMsg = (r, s) => tx(s.ws, { t: 'lock', proj: r.picks.includes(s.id) });
// ---- the drawings on the projector: up to 3 at a time, side by side ----
const MAX_PICKS = 3;
// Put up to 3 students' work on the projector. Anyone who comes off is unlocked (told they can draw again).
function setPicks(r, ids, hide) {
  const before = new Set(r.picks);
  r.picks = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(id => typeof id === 'string' && r.students.has(id)))].slice(0, MAX_PICKS);
  r.spot = r.picks[0] || null;
  if (hide !== undefined) r.hide = !!hide;
  toWatchers(r, { t: 'spot', spot: r.spot, picks: [...r.picks], hide: r.hide });
  const touched = new Set([...before, ...r.picks]);
  touched.forEach(id => { const s = r.students.get(id); if (s) lockMsg(r, s); });
}
// ---- freeze: stop the whole class so the teacher has every eye ----
const pushFreeze = r => {
  const o = { t: 'freeze', on: !!r.frozen };
  toWatchers(r, o); r.students.forEach(s => tx(s.ws, o));
};
function setFreeze(r, on, secs) {
  clearTimeout(r.fz); r.fz = null;
  r.frozen = !!on;
  const s = r.frozen && Number.isFinite(secs) ? Math.min(900, Math.max(5, Math.round(secs))) : 0;
  if (s) r.fz = setTimeout(() => { r.frozen = false; r.fz = null; pushFreeze(r); }, s * 1000); // a timed freeze lets go on its own
  pushFreeze(r);
}
// ---- class timer (modelled on freeze) ----
// Times travel as milliseconds REMAINING, never as a clock time, so a Chromebook with a wrong clock still shows the right number;
// every page counts down on its own from the moment the message arrived.
const MIN_TIMER_S = 5, MAX_TIMER_S = 3600;
const timerLeft = r => (!r.timer ? 0 : r.timer.paused ? r.timer.left : Math.max(0, r.timer.endsAt - Date.now()));
const timerView = r => (r.timer ? { left: timerLeft(r), paused: !!r.timer.paused, freeze: !!r.timer.freeze } : null);
function pushTimer(r, o) {
  const m = { t: 'timer', ...(o || timerView(r) || { off: true }) };
  toWatchers(r, m); r.students.forEach(s => tx(s.ws, m));
}
function armTimer(r) {
  clearTimeout(r.tm); r.tm = null;
  if (r.timer && !r.timer.paused) r.tm = setTimeout(() => timerDone(r), timerLeft(r));
}
function timerDone(r) { // sent once; the timer is then gone. A running timer keeps going through a freeze.
  const fz = r.timer && r.timer.freeze; r.timer = null; clearTimeout(r.tm); r.tm = null;
  pushTimer(r, { done: true });
  if (fz) setFreeze(r, true); // the teacher chose "freeze the class when time is up"
}
function stopTimer(r) { if (!r.timer) return; clearTimeout(r.tm); r.tm = null; r.timer = null; pushTimer(r); }
function hostTimer(r, m) {
  if (m.off === true) return stopTimer(r);
  if (typeof m.pause === 'boolean') {
    if (!r.timer) return;
    if (m.pause && !r.timer.paused) { r.timer.left = timerLeft(r); r.timer.paused = true; clearTimeout(r.tm); r.tm = null; }
    else if (!m.pause && r.timer.paused) { r.timer.endsAt = Date.now() + r.timer.left; r.timer.paused = false; armTimer(r); }
    return pushTimer(r);
  }
  if (m.add !== undefined) {
    const ms = Math.round(Number(m.add)) * 1000;
    if (!r.timer || !Number.isFinite(ms) || ms < 1000 || ms > MAX_TIMER_S * 1000) return;
    if (r.timer.paused) r.timer.left = Math.min(MAX_TIMER_S * 1000, r.timer.left + ms);
    else r.timer.endsAt = Math.min(Date.now() + MAX_TIMER_S * 1000, r.timer.endsAt + ms);
    armTimer(r); return pushTimer(r);
  }
  const secs = Math.round(Number(m.secs));
  if (!Number.isFinite(secs) || secs < MIN_TIMER_S || secs > MAX_TIMER_S) return;
  clearTimeout(r.tm);
  r.timer = { endsAt: Date.now() + secs * 1000, left: secs * 1000, paused: false, freeze: m.freeze === true };
  armTimer(r); pushTimer(r);
}
// ---- confidence history, for the report at the end of the lesson ----
const plainQ = q => (String(q.question || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
  || (q.kind === 'sort' ? 'Sort question' : q.img ? 'Picture question' : ''));
const pulseCount = s => s.pulse === 'g' || s.pulse === 'y' || s.pulse === 'r' ? s.pulse : null;
// Snapshot the question that is ending, before a new one wipes the colours. Capped so a long day stays small.
function snapshotPulse(r) {
  if (!r.qn) return;
  const c = { g: 0, y: 0, r: 0 }, by = {};
  r.students.forEach(s => { const p = pulseCount(s); if (p) { by[s.id] = p; c[p]++; } });
  r.phist.push({ n: r.qn, q: plainQ(r.q), at: Date.now(), g: c.g, y: c.y, r: c.r, none: r.students.size - c.g - c.y - c.r, by });
  if (r.phist.length > 40) r.phist.shift();
}

// ---- safety net: one bad message or socket must never end every class ----
process.on('uncaughtException', e => console.error('uncaughtException:', e && e.stack || e));
process.on('unhandledRejection', e => console.error('unhandledRejection:', e && e.stack || e));
server.on('clientError', (e, sock) => { try { sock.destroy(); } catch {} });

// ---- limits (items 2-3 of the readiness plan) ----
const UNDO_MS = +process.env.UNDO_MS || 15000;      // how long a replaced question's drawings are kept for Undo
const MSGS_PER_SEC = 60;                                  // per socket; the excess is dropped
const MAX_PER_IP = +process.env.MAX_PER_IP || 150;        // a whole school shares one address, so this is generous
const ROOM_EMPTY_MS = +process.env.ROOM_EMPTY_MS || 10 * 60e3, ROOM_WITH_STUDENTS_MS = 6 * 3600e3, SWEEP_MS = +process.env.SWEEP_MS || 30000; // (the two env overrides are for tests)
// Behind a proxy (Render) the socket address is the proxy's. Set TRUST_PROXY=1 to use the last X-Forwarded-For entry,
// which is the one the proxy itself added; entries to its left can be forged by the client.
const ipOf = req => {
  if (process.env.TRUST_PROXY) { const x = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim(); if (x) return x; }
  return req.socket.remoteAddress || '?';
};
const perIp = new Map();
const newTok = () => randomUUID() + randomUUID();

const wss = new WebSocketServer({ server, maxPayload: 6e6 });
wss.on('connection', (ws, req) => {
  let room = null, role = null, me = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('error', e => console.error('socket error:', e && e.message)); // e.g. a frame over maxPayload; the socket is closed, the process lives on

  const ip = ipOf(req); ws.ip = ip;
  const n = (perIp.get(ip) || 0) + 1; perIp.set(ip, n);
  ws.on('close', () => { const k = (perIp.get(ip) || 1) - 1; if (k > 0) perIp.set(ip, k); else perIp.delete(ip); });
  if (n > MAX_PER_IP) { tx(ws, { t: 'err', m: 'Too many connections from this network. Try again in a minute.' }); return ws.close(); }

  let winStart = 0, winN = 0;
  ws.on('message', raw => {
    const now = Date.now();
    if (now - winStart >= 1000) { winStart = now; winN = 0; }
    if (++winN > MSGS_PER_SEC) return; // drop the excess
    try { handle(raw); } catch (e) { console.error('message handler:', e && e.stack || e); }
  });

  function handle(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'host' || m.t === 'watch') {
      const code = cleanCode(m.code);
      let r = rooms.get(code);
      if (m.t === 'host') {
        const key = typeof m.key === 'string' && m.key.length >= 8 && m.key.length <= 80 ? m.key : '';
        if (!goodCode(code) || !key) return tx(ws, { t: 'err', m: 'Bad code' });
        if (ws.hostCode && ws.hostCode !== code) return tx(ws, { t: 'err', m: 'This connection already runs another class.' }); // one hosted class per socket
        if (!r) {
          if (rooms.size >= MAX_ROOMS) return tx(ws, { t: 'err', m: 'Server busy' });
          r = { key, q: cleanQ(), sk: null, revealed: false, sres: false, simple: false, spot: null, picks: [], hide: true, board: false, frozen: false, fz: null, phist: [], teams: [], roster: [], scores: {}, cap: false, qn: 0, qat: 0, marks: {}, students: new Map(), watchers: new Set(), last: Date.now() };
          if (m.setup && typeof m.setup === 'object') applySetup(r, m.setup); // a new room starts from the teacher's saved teams and scores
          rooms.set(code, r);
        } else if (r.key !== key) return tx(ws, { t: 'err', m: 'That code is in use by another teacher. Pick a different one.' });
        role = 'host'; ws.hostCode = code;
      } else {
        if (!r) return tx(ws, { t: 'err', m: 'No class with that code yet' });
        role = 'watch';
      }
      room = r; ws.isHost = role === 'host'; r.watchers.add(ws);
      return tx(ws, stateMsg(r, ws.isHost));
    }

    if (m.t === 'status') { // the teacher's home page asks whether each class is live and how many students are in it
      const code = cleanCode(m.code), r = rooms.get(code);
      const o = { t: 'status', code, live: !!r, here: r ? [...r.students.values()].filter(live).length : 0 };
      // Scores and team names come back only to a device that holds this class's host key, so the Teams tab and
      // the class cards can show true live standings without exposing them to anyone who guesses a code.
      if (r && typeof m.key === 'string' && m.key === r.key) { o.teams = r.teams; o.scores = r.scores; o.cap = r.cap; }
      return tx(ws, o);
    }

    if (m.t === 'peek') { // student asks which teams / initials are on offer; initials are only revealed one team at a time
      const r = rooms.get(cleanCode(m.code));
      if (!r) return tx(ws, { t: 'err', m: 'Class not found. Check the code.' });
      if (!r.roster.length) return tx(ws, { t: 'peek', roster: false, teams: r.teams.map(t => ({ id: t.id, name: t.name, color: t.color, emoji: t.emoji })) }); // no class list: students may pick a team and type a nickname
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
      // A page that is coming back from a refresh only rejoins on its own while a teacher is still in the class;
      // otherwise it is sent to the join steps, so nobody is left sitting in a room that has finished.
      if (m.resume === true && ![...r.watchers].some(w => w.isHost && w.readyState === 1)) {
        return tx(ws, { t: 'err', m: 'That class has finished. Type the code your teacher gives you.' });
      }
      // The id is only a public label (the teacher's screen and the projector see it). Coming back to a student's work
      // takes their secret token, which is sent only to that student's own page.
      let s = typeof m.id === 'string' ? r.students.get(m.id) : null;
      if (s && !(typeof m.tok === 'string' && s.tok && m.tok === s.tok)) s = null;
      const verified = s;
      if (r.roster.length) { // a class list is loaded: students sign in by picking their initials, never by typing a name
        // A page that is rejoining after a refresh sends the id it already had; the roster entry can come from that,
        // so the student is not asked to pick their initials again.
        const e = (typeof m.rid === 'string' && entryOf(r, m.rid)) || (s && s.rid ? entryOf(r, s.rid) : null);
        if (!e) return tx(ws, { t: 'err', m: 'Pick your initials from the list.', taken: true });
        const es = e.sid ? r.students.get(e.sid) : null;
        if (es && es !== s && live(es)) return tx(ws, { t: 'err', m: 'Those initials are already in use. Ask your teacher if that is you.', taken: true });
        if (es && s && es !== s) release(r, s, ''); // moving onto initials a disconnected student held
        s = es || s;
        if (s && s.rid && s.rid !== e.rid) { const old = entryOf(r, s.rid); if (old && old.sid === s.id) old.sid = null; }
        if (!s) {
          if (r.students.size >= MAX_STU) return tx(ws, { t: 'err', m: 'Class is full' });
          s = { id: randomUUID(), tok: newTok(), objs: [], bw: dim(m.bw) || 800, bh: dim(m.bh) || 500 };
          r.students.set(s.id, s);
        } else if (s !== verified) s.tok = newTok(); // picked up by initials, not by token: the old holder's token stops working
        s.rid = e.rid; e.sid = s.id; s.name = e.ini; s.team = e.team;
      } else {
        let name = cleanName(m.name);
        if (!s) {
          const tm = r.teams.find(t => t.id === m.team); // quick teams: a student can pick a team with no nickname at all
          if (!name && tm) name = tm.name + ' ' + ([...r.students.values()].filter(x => x.team === tm.id).length + 1);
          if (!name) return tx(ws, { t: 'err', m: 'Type a nickname' });
          if (r.students.size >= MAX_STU) return tx(ws, { t: 'err', m: 'Class is full' });
          name = uniqueName(r, name);
          s = { id: randomUUID(), tok: newTok(), name, objs: [], bw: dim(m.bw) || 800, bh: dim(m.bh) || 500, team: tm ? tm.id : null };
          r.students.set(s.id, s);
        } else if (name) s.name = uniqueName(r, name, s);
      }
      // the student's own copy is the source of truth, so a server restart or dropped connection loses nothing.
      // A freshly loaded page (have=false) with nothing drawn must not wipe the saved drawing; it gets it sent back instead.
      if (Array.isArray(m.objs) && (m.objs.length || m.have) && !r.picks.includes(s.id)) s.objs = cleanList(m.objs, dm(s));
      s.ws = ws; me = s; room = r; role = 'student';
      // `host` tells a page that is rejoining after a refresh whether a teacher is still in this class, so a student
      // whose lesson has ended is sent back to the join steps instead of sitting in a room nobody is running.
      tx(ws, joinedMsg(r, s));
      toWatchers(r, { t: 'join', s: stuView(s) });
      return pushScores(r);
    }

    if (!room) return;

    if (role === 'student') {
      if (room.students.get(me.id) !== me) return; // removed by Clear class
      if (m.t === 'bye') { // the student left on purpose (the Leave button): no ghost card left behind on the teacher screen
        const r = room; release(r, me, 'You left the class. Join again with the code when your teacher says.');
        me = null; room = null; role = null;
        return;
      }
      if (m.t === 'size') { // the phone was turned or resized: while the page is still empty, it takes the new shape
        const bw = dim(m.bw), bh = dim(m.bh);
        if (bw && bh && !me.objs.length && !room.picks.includes(me.id)) { me.bw = bw; me.bh = bh; tx(me.ws, { t: 'size', bw, bh }); toWatchers(room, { t: 'join', s: stuView(me) }); }
        return;
      }
      if (room.picks.includes(me.id)) return lockMsg(room, me);
      if (room.frozen) return tx(me.ws, { t: 'freeze', on: true }); // frozen: nothing gets through, not even a colour
      if (m.t === 'pulse') { // how confident the student feels about their drawing: red, amber or green (or none)
        const c = ['r', 'y', 'g'].includes(m.c) ? m.c : null;
        if (me.pulse === c) return;
        me.pulse = c; toWatchers(room, { t: 'pulse', id: me.id, c });
      } else if (m.t === 'sort') { // a sort question: the student's whole answer is one small map, card id to lane id
        if (!sortOf(room) || me.done) return;
        me.sort = cleanPlace(room, m.p);
        if (m.done === true && placedAll(room, me)) me.done = true;
        toWatchers(room, { t: 'sort', id: me.id, p: me.sort, done: !!me.done });
        tx(me.ws, { t: 'sorted', p: me.sort, done: !!me.done }); sendFb(room, me); pushSummary(room);
      } else if (m.t === 'place') { // a model question: the student's moved pieces, one small map
        if (!modelOf(room)) return;
        me.pl = cleanPl(room, m.p);
        toWatchers(room, { t: 'pl', id: me.id, p: me.pl }); sendFb(room, me); pushSummary(room);
      } else if (m.t === 'set') { // add a new object or replace one with the same id
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
        const c = cleanQuestion(m);
        if (!c) return tx(ws, { t: 'note', m: m.kind === 'sort' ? 'That sort question is not complete: it needs 2 lanes, and 2 cards that each belong in a lane.' : 'That question with movable pieces is not complete: it needs 2 pieces, each with a label and an answer spot.' });
        const nq = c.nq, nk = c.nk;
        // keep the question that is ending, with every student's work, for 15 seconds so the teacher can undo a misclick
        clearTimeout(room.undoT);
        room.undo = { q: room.q, sk: room.sk, revealed: room.revealed, qn: room.qn, qat: room.qat, marks: { ...room.marks }, phist: room.phist.length, stu: new Map([...room.students].map(([id, s]) => [id, { objs: s.objs, sort: s.sort, pl: s.pl, done: s.done, aw: s.aw, pulse: s.pulse }])) };
        room.undoT = setTimeout(() => { room.undo = null; }, UNDO_MS);
        snapshotPulse(room); // the colours for the question that just ended go in the report
        room.q = nq; room.sk = nk; room.revealed = false;
        if (room.sres && (nq.model || room.undo.q.model)) { room.sres = false; toWatchers(room, { t: 'sres', on: false }); } // class results on the projector stay with the question they were turned on for
        room.marks = {}; // the teacher's marks belong to the question that just ended
        room.qn++; room.qat = Date.now(); // when this question started: the teacher page files its lesson record under this time
        // A new question starts with nobody on the projector: the students who were up get their page back so they can draw.
        room.students.forEach(s => { s.objs = []; s.sort = {}; s.pl = {}; s.done = false; s.aw = null; s.pulse = null; });
        setPicks(room, []);
        stopTimer(room); // a new question starts with no timer (the teacher page can start one with the question)
        if (room.frozen) setFreeze(room, false); // new question = work time
        room.students.forEach(s => { tx(s.ws, { t: 'q', q: room.q }); lockMsg(room, s); }); // a new question: every student can earn a point again
        toPublic(room, { t: 'q', q: room.q }); toHosts(room, { t: 'q', q: room.q, sk: room.sk, phist: room.phist, at: room.qat });
        pushScores(room);
      } else if (m.t === 'restore') { // a teacher page coming back to a brand-new class (the server restarted): put its last question back without touching any drawing
        if (room.qn || room.restored) return;
        const c = cleanQuestion(m); if (!c) return;
        const nq = c.nq, nk = c.nk;
        room.q = nq; room.sk = nk; room.restored = true;
        if (Number.isFinite(m.at) && m.at > 1.6e12 && m.at <= Date.now()) room.qat = Math.round(m.at); // the original start time, so the lesson record stays one record
        room.students.forEach(s => tx(s.ws, { t: 'restore', q: room.q }));
        toPublic(room, { t: 'restore', q: room.q }); toHosts(room, { t: 'restore', q: room.q, sk: room.sk, at: room.qat });
      } else if (m.t === 'undoq') { // put back the question that was just replaced, with everyone's drawings
        const u = room.undo; if (!u) return tx(ws, { t: 'note', m: 'Too late to undo. Send the question again from the list.' });
        clearTimeout(room.undoT); room.undo = null;
        room.q = u.q; room.sk = u.sk; room.revealed = u.revealed; room.qn = u.qn; room.qat = u.qat; room.marks = { ...u.marks }; room.phist.length = Math.min(room.phist.length, u.phist);
        room.students.forEach((s, id) => { const o = u.stu.get(id); if (o) Object.assign(s, { objs: o.objs, sort: o.sort, pl: o.pl, done: o.done, aw: o.aw, pulse: o.pulse }); });
        broadcastState(room); // teacher screen and projector rebuild from the room
        room.students.forEach(s => tx(s.ws, { ...joinedMsg(room, s), undo: true })); // each student page re-seeds from the server's copy
        pushScores(room);
      } else if (m.t === 'mode') { // quick mode: students get just the pen and a few colors
        room.simple = !!m.simple;
        room.students.forEach(s => tx(s.ws, { t: 'mode', simple: room.simple }));
        toWatchers(room, { t: 'mode', simple: room.simple });
      } else if (m.t === 'spot') { // up to 3 drawings side by side; ids [] clears the projector
        setPicks(room, m.ids !== undefined ? m.ids : m.id, m.hide);
      } else if (m.t === 'mark') { // the teacher's own mark on a drawing: Got it / Almost / Not yet. Private: hosts only, never students or the projector.
        const s = room.students.get(m.id); if (!s || sortOf(room)) return;
        if (m.m === null || m.m === undefined) delete room.marks[s.id]; else if (MARKS.includes(m.m)) room.marks[s.id] = m.m; else return;
        toHosts(room, { t: 'mark', id: s.id, m: room.marks[s.id] || null });
      } else if (m.t === 'timer') { // the class countdown: start, add time, pause or resume, stop
        hostTimer(room, m);
      } else if (m.t === 'freeze') { // stop everything so the teacher has the whole class's attention
        setFreeze(room, m.on, m.secs);
      } else if (m.t === 'reset') { // "Clear class": send everyone back to the join screen (teams, class list and scores are kept)
        room.students.forEach(s => tx(s.ws, { t: 'kicked' }));
        room.undo = null; room.marks = {}; room.students.clear(); room.picks = []; room.spot = null; room.phist = []; room.roster.forEach(e => (e.sid = null));
        setFreeze(room, false); stopTimer(room);
        broadcastState(room);
      } else if (m.t === 'setup') { // teams, class list (initials only) and point rule, all replaced at once
        applySetup(room, m); pushScores(room);
      } else if (m.t === 'teams') { // rename / re-icon / recolour / reorder / add / remove, without touching the class list
        setTeams(room, m.teams);
      } else if (m.t === 'team') { // no class list loaded: put a nickname-joined student on a team (with a class list, the list decides)
        const s = room.students.get(m.id);
        if (s) {
          const tid = room.teams.some(t => t.id === m.team) ? m.team : null, e = s.rid && entryOf(room, s.rid);
          if (e) e.team = tid; // with a class list, the list entry holds the team
          s.team = tid; fixAwards(room); pushScores(room);
        }
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
      } else if (m.t === 'reveal') { // show students which of their cards (or pieces) were right, and where the wrong ones belong
        if (!sortOf(room) && !modelOf(room)) return;
        room.revealed = !!m.on; toWatchers(room, { t: 'reveal', on: room.revealed });
        room.students.forEach(s => { if (room.revealed) sendFb(room, s); else tx(s.ws, { t: 'fb', ok: {}, where: {}, off: true }); });
      } else if (m.t === 'reopen') { // let one student change their sort again
        const s = room.students.get(m.id); if (!s || !s.done) return;
        s.done = false; tx(s.ws, { t: 'sorted', p: s.sort || {}, done: false }); toWatchers(room, { t: 'sort', id: s.id, p: s.sort || {}, done: false });
      } else if (m.t === 'sres') { // class-wide sort results on the projector
        room.sres = !!m.on; toWatchers(room, { t: 'sres', on: room.sres });
        const o = room.sres && classSummary(room); if (o) toPublic(room, o);
      } else if (m.t === 'resetscores') {
        room.scores = cleanScores({}, room.teams); room.students.forEach(s => (s.aw = null)); pushScores(room);
      } else if (m.t === 'board') { // projector shows the leaderboard when no one's work is up
        room.board = !!m.on; toWatchers(room, { t: 'board', on: room.board });
      } else if (m.t === 'release') { // free up a student's initials (wrong pick, or a new device)
        const s = room.students.get(m.id); if (s) { release(room, s, 'Your teacher reset your sign-in. Join again.'); pushScores(room); }
      } else if (m.t === 'rename') { // a nickname-joined student only: with a class list, the list decides the name
        const s = room.students.get(m.id); if (!s || s.rid) return;
        const name = cleanName(m.name); if (!name) return tx(ws, { t: 'note', m: 'Type a name.' });
        s.name = uniqueName(room, name, s); toWatchers(room, { t: 'join', s: stuView(s) });
      }
    }
  }

  ws.on('close', () => {
    if (!room) return;
    room.watchers.delete(ws);
    if (me && me.ws === ws) { me.ws = null; if (room.students.get(me.id) === me) toWatchers(room, { t: 'live', id: me.id, on: false }); } // the card greys out; coming back sends a fresh 'join'
    room.last = Date.now();
  });
});

// keep connections alive through proxies, drop dead ones, forget abandoned classes (10 minutes if nobody joined, 6 hours if students are in it)
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
  rooms.forEach((r, code) => {
    const live = r.watchers.size || [...r.students.values()].some(s => s.ws);
    if (live) r.last = Date.now();
    else if (Date.now() - r.last > (r.students.size ? ROOM_WITH_STUDENTS_MS : ROOM_EMPTY_MS)) { clearTimeout(r.fz); clearTimeout(r.undoT); clearTimeout(r.tm); rooms.delete(code); }
  });
}, SWEEP_MS);

server.listen(PORT, () => console.log('Draw It Out running on port ' + PORT));
