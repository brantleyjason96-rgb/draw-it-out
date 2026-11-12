// shared by student, teacher and projector pages
// W,H = the drawing page size. Each student's page is the size of their screen (the student page sets these);
// the teacher and projector pages size every layer from the student's own dimensions instead.
let W = 800, H = 500;
const $ = s => document.querySelector(s);

function paintBg(x, bg, im, pw, ph) {
  const w = pw || W, h = ph || H; // default: the student page's own size
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  if (bg === 'photo') {
    if (im && im.complete && im.naturalWidth) {
      const s = Math.min(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * s, ih = im.naturalHeight * s;
      x.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih);
    }
    return;
  }
  x.strokeStyle = '#cfe3f4'; x.lineWidth = 1; x.beginPath();
  if (bg === 'graph') {
    for (let i = 0; i <= w; i += 25) { x.moveTo(i, 0); x.lineTo(i, h); }
    for (let i = 0; i <= h; i += 25) { x.moveTo(0, i); x.lineTo(w, i); }
  } else if (bg === 'lined') {
    for (let i = 60; i < h; i += 40) { x.moveTo(0, i); x.lineTo(w, i); }
  }
  x.stroke();
}

// ---- movable pieces (model questions): a fixed-shape stage fitted into every page, pieces in stage units ----
// model = { stage, pieces:[{ id, label, art, x, y, kx?, ky? }] }; pl = { id: { x, y } } for the pieces a student has moved (the rest sit at x, y).
// Pieces are painted under the drawing, so a student's arrows sit on top of them.
const MSTAGE = { wide: { w: 1000, h: 625 }, tall: { w: 625, h: 1000 } }, MA = 108;
function stageRect(model, bw, bh) { const s = MSTAGE[model.stage] || MSTAGE.wide, k = Math.min(bw / s.w, bh / s.h); return { k, x: (bw - s.w * k) / 2, y: (bh - s.h * k) / 2, w: s.w * k, h: s.h * k, sw: s.w, sh: s.h }; }
// outside the stage the page is plain grey; inside it is the question's own background (photo, graph, lined, blank)
function paintModelBg(x, model, bg, im, bw, bh) {
  const r = stageRect(model, bw, bh);
  x.fillStyle = '#E5E7EB'; x.fillRect(0, 0, bw, bh);
  x.save(); x.translate(r.x, r.y); x.beginPath(); x.rect(0, 0, r.w, r.h); x.clip(); paintBg(x, bg, im, r.w, r.h); x.restore();
}
const pieceBox = p => (p.art === 'card' ? { w: MA * 1.3, h: MA * .8 } : { w: MA, h: MA });
const P2 = typeof Path2D === 'function' ? {
  land: new Path2D('M22 34c8-8 18-6 22 2s-6 12-10 18-14 4-14-4 0-10 2-16zM56 54c8-4 18 0 20 8s-8 16-14 14-10-14-6-22z'), axis: new Path2D('M30 12l40 76'),
  rays: new Path2D('M50 3v12M50 85v12M3 50h12M85 50h12M17 17l8 8M75 75l8 8M83 17l-8 8M25 75l-8 8'), arrow: new Path2D('M8 40h52V22l32 28-32 28V60H8z')
} : null;
function drawArt(x, art, cx, cy, s) { // the same pictures as the editor's list, drawn in a 100 x 100 box
  if (!P2) return;
  x.save(); x.translate(cx - s / 2, cy - s / 2); x.scale(s / 100, s / 100); x.lineCap = 'round'; x.lineJoin = 'round';
  const dot = (X, Y, r, c) => { x.beginPath(); x.arc(X, Y, r, 0, 7); x.fillStyle = c; x.fill(); };
  if (art === 'earth') { dot(50, 50, 46, '#3B82F6'); x.fillStyle = '#4ADE80'; x.fill(P2.land); x.strokeStyle = '#17212B'; x.lineWidth = 2.5; x.setLineDash([5, 4]); x.stroke(P2.axis); x.setLineDash([]); dot(30, 12, 4, '#fff'); x.lineWidth = 2; x.stroke(); }
  else if (art === 'sun') { x.strokeStyle = '#F59E0B'; x.lineWidth = 6; x.stroke(P2.rays); dot(50, 50, 30, '#FBBF24'); }
  else if (art === 'moon') { dot(50, 50, 44, '#CBD5E1'); dot(36, 38, 8, '#94A3B8'); dot(62, 58, 11, '#94A3B8'); dot(44, 72, 5, '#94A3B8'); }
  else if (art === 'arrow') { x.fillStyle = '#EF4444'; x.strokeStyle = '#7F1D1D'; x.lineWidth = 3; x.fill(P2.arrow); x.stroke(P2.arrow); }
  x.restore();
}
function wrapLines(x, text, maxW) {
  const out = []; let line = '';
  String(text).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (line && x.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; });
  out.push(line); return out;
}
// one piece, centred on pos. o: { fs (label size), ok (true | false | undefined), focus }
function drawPiece(x, p, pos, o) {
  const card = p.art === 'card', b = pieceBox(p), fs = o.fs || 21;
  x.save(); x.font = '700 ' + fs + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (card) {
    x.shadowColor = 'rgba(23,33,43,.35)'; x.shadowBlur = 3; x.shadowOffsetY = 1; x.fillStyle = '#FDE68A'; x.beginPath(); x.roundRect(pos.x - b.w / 2, pos.y - b.h / 2, b.w, b.h, 8); x.fill();
    x.shadowColor = 'transparent'; x.fillStyle = '#422006';
    const ln = wrapLines(x, p.label, b.w - 12).slice(0, 3), lh = fs * 1.15; ln.forEach((t, i) => x.fillText(t, pos.x, pos.y + (i - (ln.length - 1) / 2) * lh));
  } else {
    x.shadowColor = 'rgba(23,33,43,.35)'; x.shadowBlur = 3; x.shadowOffsetY = 1; drawArt(x, p.art, pos.x, pos.y, MA); x.shadowColor = 'transparent';
    const w = Math.min(x.measureText(p.label).width + 10, MA * 2.4), y = pos.y + MA / 2 + 4 + fs * .65;
    x.fillStyle = 'rgba(255,255,255,.88)'; x.beginPath(); x.roundRect(pos.x - w / 2, y - fs * .65, w, fs * 1.3, 6); x.fill(); x.fillStyle = '#17212B'; x.fillText(p.label, pos.x, y);
  }
  const ring = (c, lw) => { x.strokeStyle = c; x.lineWidth = lw; x.beginPath(); if (card) x.roundRect(pos.x - b.w / 2 - 3, pos.y - b.h / 2 - 3, b.w + 6, b.h + 6, 10); else x.arc(pos.x, pos.y, MA / 2 + 4, 0, 7); x.stroke(); };
  if (o.focus) { x.setLineDash([8, 5]); ring('#0B6BCB', 5); x.setLineDash([]); }
  if (o.ok !== undefined) {
    ring(o.ok ? '#0E7C4A' : '#B3261E', 5);
    const bx = pos.x + b.w / 2 - 2, by = pos.y - b.h / 2 + 2; x.beginPath(); x.arc(bx, by, 14, 0, 7); x.fillStyle = o.ok ? '#0E7C4A' : '#B3261E'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = '#fff'; x.font = '800 18px ' + FONT; x.fillText(o.ok ? '✓' : '✕', bx, by + 1);
  }
  x.restore();
}
// o: { ok:{id:bool}, where:{id:{x,y}}, spots, tolRings:tol, focus, skip, only, fs }
function paintPieces(x, model, pl, bw, bh, o = {}) {
  const r = stageRect(model, bw, bh), fs = Math.max(21, 10 / r.k);
  x.save(); x.translate(r.x, r.y); x.scale(r.k, r.k);
  const circle = (X, Y, rad, stroke, fill) => { x.beginPath(); x.arc(X, Y, rad, 0, 7); x.setLineDash([10, 7]); x.lineWidth = 3; if (fill) { x.fillStyle = fill; x.fill(); } x.strokeStyle = stroke; x.stroke(); x.setLineDash([]); };
  if (o.spots) model.pieces.forEach(p => { if (p.kx != null) circle(p.kx, p.ky, MA / 2 + 8, '#0B6BCB', 'rgba(11,107,203,.07)'); });
  if (o.tolRings) model.pieces.forEach((p, i) => { circle(p.kx, p.ky, o.tolRings, '#0B6BCB', 'rgba(11,107,203,.10)'); x.font = '700 ' + fs * .8 + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillStyle = '#0B5CAD'; x.fillText(String(i + 1), p.kx, p.ky - o.tolRings - 2); });
  if (o.where) model.pieces.forEach(p => {
    const k = o.where[p.id]; if (!k) return; circle(k.x, k.y, MA / 2 + 4, '#B3261E', 'rgba(179,38,30,.08)');
    x.font = '800 ' + fs + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; const t = p.label + ' goes here', w = x.measureText(t).width + 10, y = k.y + MA / 2 + 12 + fs * .65;
    x.fillStyle = '#fff'; x.beginPath(); x.roundRect(k.x - w / 2, y - fs * .65, w, fs * 1.3, 6); x.fill(); x.fillStyle = '#8C1D18'; x.fillText(t, k.x, y);
  });
  model.pieces.forEach(p => {
    if (o.skip === p.id || (o.only != null && o.only !== p.id)) return;
    const pos = pl && pl[p.id] ? pl[p.id] : { x: p.x, y: p.y };
    drawPiece(x, p, pos, { fs, ok: o.ok ? o.ok[p.id] : undefined, focus: o.focus === p.id });
  });
  x.restore();
}
// which piece is under a point (page units)? the one painted last wins
function pieceAt(model, pl, bw, bh, px, py, pad = 0) {
  const r = stageRect(model, bw, bh), sx = (px - r.x) / r.k, sy = (py - r.y) / r.k;
  for (let i = model.pieces.length - 1; i >= 0; i--) {
    const p = model.pieces[i], pos = pl && pl[p.id] ? pl[p.id] : { x: p.x, y: p.y }, b = pieceBox(p), t = pad / r.k;
    if (Math.abs(sx - pos.x) <= b.w / 2 + t && Math.abs(sy - pos.y) <= b.h / 2 + t) return p;
  }
  return null;
}

// ---- drawing objects (shared by student, teacher and projector) ----
// stroke {pts,pen} | line {s:'line'|'arrow',pts:[a,b]} | shape {s,x,y,w,h,fill} | text {x,y,w,t,size}; all have id, c (color), lw, dash
const FONT = '"Segoe Print","Comic Sans MS",system-ui,sans-serif';
const PEN = { pen: { n: 'Pen', m: 1, a: 1 }, pencil: { n: 'Pencil', m: .6, a: .7 }, marker: { n: 'Marker', m: 2.5, a: 1 }, hi: { n: 'Highlighter', m: 6, a: .35 } };
const mx = document.createElement('canvas').getContext('2d'); // for measuring text
const ew = o => o.lw * (PEN[o.pen] || PEN.pen).m;
function wrap(o) {
  mx.font = o.size + 'px ' + FONT; const out = [];
  (o.t || '').split('\n').forEach(par => {
    let line = '';
    par.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (line && mx.measureText(t).width > o.w) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function bbox(o) {
  if (o.k === 'text') return { x: o.x, y: o.y, w: o.w, h: wrap(o).length * o.size * 1.25 };
  if (o.k === 'shape') return { x: o.x, y: o.y, w: o.w, h: o.h };
  const xs = o.pts.map(p => p[0]), ys = o.pts.map(p => p[1]), pad = ew(o) / 2 + (o.k === 'line' ? 8 : 0);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}
function dashOf(x, o) { const w = ew(o); x.setLineDash(o.dash === 'dashed' ? [w * 3, w * 2.2] : o.dash === 'dotted' ? [.1, w * 2.2] : []); }
function shapePath(x, o) {
  const { x: X, y: Y, w, h } = o; x.beginPath();
  if (o.s === 'rect') x.rect(X, Y, w, h);
  else if (o.s === 'ellipse') x.ellipse(X + w / 2, Y + h / 2, w / 2, h / 2, 0, 0, 7);
  else if (o.s === 'tri') { x.moveTo(X + w / 2, Y); x.lineTo(X + w, Y + h); x.lineTo(X, Y + h); x.closePath(); }
  else if (o.s === 'diamond') { x.moveTo(X + w / 2, Y); x.lineTo(X + w, Y + h / 2); x.lineTo(X + w / 2, Y + h); x.lineTo(X, Y + h / 2); x.closePath(); }
  else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .42 : 1, px = X + w / 2 + Math.cos(a) * r * w / 2, py = Y + h / 2 + Math.sin(a) * r * h / 2; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); }
}
function drawOp(x, o) {
  x.save(); x.lineCap = x.lineJoin = 'round'; x.strokeStyle = x.fillStyle = o.c;
  if (o.k === 'stroke') {
    const p = PEN[o.pen] || PEN.pen; x.globalAlpha = p.a; if (o.pen === 'hi') { x.globalCompositeOperation = 'multiply'; x.lineCap = 'butt'; }
    x.lineWidth = ew(o); dashOf(x, o); const P = o.pts;
    if (P.length === 1) { x.beginPath(); x.arc(P[0][0], P[0][1], x.lineWidth / 2, 0, 7); x.fill(); }
    else {
      x.beginPath(); x.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length - 1; i++) x.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
      x.lineTo(P[P.length - 1][0], P[P.length - 1][1]); x.stroke();
    }
  } else if (o.k === 'shape') {
    shapePath(x, o); if (o.fill !== 'none') { x.globalAlpha = o.fill === 'light' ? .25 : 1; x.fill(); x.globalAlpha = 1; }
    x.lineWidth = o.lw; dashOf(x, o); shapePath(x, o); x.stroke();
  } else if (o.k === 'line') {
    const [a, b] = o.pts; x.lineWidth = o.lw; dashOf(x, o); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    if (o.s === 'arrow') { // arrowhead at the end point
      x.setLineDash([]); const t = Math.atan2(b[1] - a[1], b[0] - a[0]), h = 14 + o.lw * 2; x.beginPath();
      x.moveTo(b[0] - h * Math.cos(t - .45), b[1] - h * Math.sin(t - .45)); x.lineTo(b[0], b[1]); x.lineTo(b[0] - h * Math.cos(t + .45), b[1] - h * Math.sin(t + .45)); x.stroke();
    }
  } else {
    x.font = o.size + 'px ' + FONT; x.textBaseline = 'top';
    wrap(o).forEach((l, i) => x.fillText(l, o.x, o.y + i * o.size * 1.25 + o.size * .125));
  }
  x.restore();
}
// draw a student's page (background + drawing) straight into cv, scaled to fit with gray bars if the shapes differ
// mp (optional) = { model, pl, ok, where }: a model question's pieces go between the background and the drawing
function paintBoard(cv, objs, bg, im, bw, bh, mp) {
  const x = cv.getContext('2d'), s = Math.min(cv.width / bw, cv.height / bh);
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#e5e7eb'; x.fillRect(0, 0, cv.width, cv.height);
  x.setTransform(s, 0, 0, s, (cv.width - bw * s) / 2, (cv.height - bh * s) / 2);
  x.save(); x.beginPath(); x.rect(0, 0, bw, bh); x.clip();
  if (mp && mp.model) { paintModelBg(x, mp.model, bg, im, bw, bh); paintPieces(x, mp.model, mp.pl, bw, bh, mp); } else paintBg(x, bg, im, bw, bh);
  objs.forEach(o => drawOp(x, o)); x.restore(); x.setTransform(1, 0, 0, 1, 0, 0);
}
// load a photo for the background; calls cb when ready
function loadImg(src, cb) {
  if (!src) return null;
  const i = new Image(); i.onload = cb; i.src = src; return i;
}

// ---- confidence pulse (student page, teaching screen and projector all agree on these) ----
// r = I need help, y = almost, g = I understand. Colour is never the only signal: every place that shows one also shows the word.
const PULSES = {
  r: { k: 'r', n: 'I need help', short: 'Need help', c: '#B3261E', soft: '#FBE4E1', e: '🙋' },
  y: { k: 'y', n: 'Almost', short: 'Almost', c: '#8F5500', soft: '#FFF4DC', e: '🙂' },
  g: { k: 'g', n: 'I understand', short: 'I understand', c: '#0E7C4A', soft: '#E6F4EC', e: '💡' },
};
const PULSE_ORDER = ['r', 'y', 'g'];
const pulseOf = c => PULSES[c] || null;

// ---- team labels and standings (shared by student, teacher and projector pages) ----
// A team's icon can be a multi-part emoji (flag, family), so it is trimmed by code point, never by UTF-16 unit.
const cleanIcon = s => {
  s = String(s || '').trim();
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) { const g = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next(); return g.done ? '' : Array.from(g.value.segment).slice(0, 8).join(''); } } catch {}
  return Array.from(s).slice(0, 8).join('');
};
const teamLabel = t => { const i = cleanIcon(t && t.emoji); return (i ? i + ' ' : '') + ((t && t.name) || 'Team'); };
// Standard competition ranking: scores 12, 9, 9, 4 rank 1, 2, 2, 4. The lead is shared when teams tie on top.
function rankTeams(teams, scores = {}) {
  const list = (teams || []).map(t => ({ team: t, score: Math.max(0, +scores[t.id] || 0) }))
    .sort((a, b) => b.score - a.score);
  const top = list.length ? list[0].score : 0;
  let rank = 0, last = null;
  return list.map((x, i) => {
    // With no points on the board, show plain positions (1, 2, 3) rather than a row of tied firsts.
    if (top === 0) return { ...x, rank: i + 1, leader: false };
    if (x.score !== last) { rank = i + 1; last = x.score; }
    return { ...x, rank, leader: x.score === top };
  });
}
// the widest bar in a score list, never below 1, so 0-point teams still get a visible sliver
const scoreMax = list => Math.max(1, ...list.map(x => x.score));

// WebSocket with automatic reconnect. onopen runs on every (re)connect so pages can re-handshake.
function connect(onmsg, onopen, onstatus) {
  let ws, delay = 500, closed = false;
  const api = { send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }, open() { return !!ws && ws.readyState === 1; }, close() { closed = true; if (ws) ws.close(); } };
  (function open() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => { delay = 500; onstatus && onstatus(true); onopen(); };
    ws.onmessage = e => { try { onmsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => { onstatus && onstatus(false); if (!closed) setTimeout(open, (delay = Math.min(delay * 2, 8000))); };
  })();
  return api;
}

// QR code for a join link (needs /qrcode.js loaded first). Returns an <img>-ready SVG string, black on white with a quiet border.
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
}
