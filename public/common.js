// shared by student, teacher and projector pages
// W,H = the drawing page size. Each student's page is the size of their screen (the student page sets these);
// the teacher and projector pages size every layer from the student's own dimensions instead.
let W = 800, H = 500;
const $ = s => document.querySelector(s);

function paintBg(x, bg, im, pw, ph) {
  const w = pw || W, h = ph || H; // default: the student page's own size
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  if (typeof DIAG === 'object' && DIAG[bg]) return diagram(x, bg, w, h); // a drawn diagram (orbit, rings, phases, plates, ocean, seafloor, subduction, volcano, fault, watercycle)
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
const pieceBox = p => SK.boxOf(p); // the size of a piece on the board: its picture size times its own size setting (sortkit.js)
const P2 = typeof Path2D === 'function' ? {
  land: new Path2D('M22 34c8-8 18-6 22 2s-6 12-10 18-14 4-14-4 0-10 2-16zM56 54c8-4 18 0 20 8s-8 16-14 14-10-14-6-22z'), axis: new Path2D('M30 12l40 76'),
  rays: new Path2D('M50 3v12M50 85v12M3 50h12M85 50h12M17 17l8 8M75 75l8 8M83 17l-8 8M25 75l-8 8'), arrow: new Path2D('M8 40h52V22l32 28-32 28V60H8z')
} : null;
// the teacher's own pictures: decoded once, then painted like any other piece. A page repaints when one arrives (the 'pieceimg' event).
const PIMG = new Map();
function pieceImg(src) {
  let i = PIMG.get(src);
  if (!i) { i = new Image(); i.onload = () => dispatchEvent(new Event('pieceimg')); i.src = src; PIMG.set(src, i); }
  return i.complete && i.naturalWidth ? i : null;
}
// a moon as seen from Earth: c = 1 full, .5 gibbous, 0 half, -.5 crescent, -1 new; lit on the right unless flipped. Drawn in a 100 x 100 box.
function moonArt(x, c, flip) {
  x.save(); if (flip) { x.translate(100, 0); x.scale(-1, 1); }
  x.beginPath(); x.arc(50, 50, 44, 0, 7); x.fillStyle = '#1F2937'; x.fill();
  if (c > -1) {
    x.beginPath(); x.arc(50, 50, 44, -Math.PI / 2, Math.PI / 2);
    for (let i = 0; i <= 24; i++) { const t = Math.PI / 2 - Math.PI * i / 24; x.lineTo(50 - c * 44 * Math.cos(t), 50 + 44 * Math.sin(t)); }
    x.closePath(); x.fillStyle = '#F8FAFC'; x.fill();
  }
  x.beginPath(); x.arc(50, 50, 44, 0, 7); x.strokeStyle = '#94A3B8'; x.lineWidth = 2; x.stroke(); x.restore();
}
const MOON_C = { new: -1, crescent: -.5, quarter: 0, gibbous: .5, full: 1 };
function drawArt(x, art, cx, cy, s, src) { // the same pictures as the editor's list, drawn in a 100 x 100 box
  if (!P2) return;
  x.save(); x.translate(cx - s / 2, cy - s / 2); x.scale(s / 100, s / 100); x.lineCap = 'round'; x.lineJoin = 'round';
  const dot = (X, Y, r, c) => { x.beginPath(); x.arc(X, Y, r, 0, 7); x.fillStyle = c; x.fill(); };
  if (art === 'earth') { dot(50, 50, 46, '#3B82F6'); x.fillStyle = '#4ADE80'; x.fill(P2.land); x.strokeStyle = '#17212B'; x.lineWidth = 2.5; x.setLineDash([5, 4]); x.stroke(P2.axis); x.setLineDash([]); dot(30, 12, 4, '#fff'); x.lineWidth = 2; x.stroke(); }
  else if (art === 'sun') { x.strokeStyle = '#F59E0B'; x.lineWidth = 6; x.stroke(P2.rays); dot(50, 50, 30, '#FBBF24'); }
  else if (art === 'moon') { dot(50, 50, 44, '#CBD5E1'); dot(36, 38, 8, '#94A3B8'); dot(62, 58, 11, '#94A3B8'); dot(44, 72, 5, '#94A3B8'); }
  else if (art === 'arrow') { x.fillStyle = '#EF4444'; x.strokeStyle = '#7F1D1D'; x.lineWidth = 3; x.fill(P2.arrow); x.stroke(P2.arrow); }
  else if (art.startsWith('moon-')) { const k = art.slice(5).replace(/-l$/, ''); moonArt(x, MOON_C[k] == null ? 1 : MOON_C[k], /-l$/.test(art)); }
  else if (art === 'img') {
    const im = src && pieceImg(src);
    if (im) { const k = Math.min(100 / im.naturalWidth, 100 / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k; x.drawImage(im, (100 - w) / 2, (100 - h) / 2, w, h); }
    else { x.setLineDash([6, 5]); x.lineWidth = 3; x.strokeStyle = '#94A3B8'; x.strokeRect(8, 8, 84, 84); }
  }
  x.restore();
}
function wrapLines(x, text, maxW) {
  const out = []; let line = '';
  String(text).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (line && x.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; });
  out.push(line); return out;
}
// the handle for turning a selected piece sits above it (in the piece's own frame), so it turns with the piece
const handleR = p => { const b = pieceBox(p); return Math.max(b.w, b.h) / 2 + 40; }; // how far above the piece the handle sits: its size plus a stem
const handlePos = (pos, a, r) => { const t = ((a || 0) - 90) * Math.PI / 180, d = r || MA / 2 + 40; return { x: pos.x + d * Math.cos(t), y: pos.y + d * Math.sin(t) }; };
const angleTo = (pos, sx, sy) => ((Math.round(Math.atan2(sy - pos.y, sx - pos.x) * 180 / Math.PI + 90) % 360) + 360) % 360;
// one piece, centred on pos (and turned by pos.a if it can turn). o: { fs (label size), ok (true | false | undefined), focus (selected), alpha, noLabel }
function drawPiece(x, p, pos, o) {
  const card = p.art === 'card', b = pieceBox(p), fs = o.fs || 21, turn = p.turn ? (pos.a != null ? pos.a : p.a || 0) : 0;
  x.save(); x.font = '700 ' + fs + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; if (o.alpha != null) x.globalAlpha = o.alpha;
  const rot = fn => { x.save(); x.translate(pos.x, pos.y); x.rotate(turn * Math.PI / 180); fn(); x.restore(); };
  if (card) {
    rot(() => {
      x.shadowColor = 'rgba(23,33,43,.35)'; x.shadowBlur = 3; x.shadowOffsetY = 1; x.fillStyle = '#FDE68A'; x.beginPath(); x.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 8); x.fill();
      x.shadowColor = 'transparent'; x.fillStyle = '#422006'; const cf = fs * Math.min(2, Math.max(.8, p.s || 1)); x.font = '700 ' + cf + 'px ' + FONT;
      const ln = wrapLines(x, p.label, b.w - 12).slice(0, 4), lh = cf * 1.15; ln.forEach((t, i) => x.fillText(t, 0, (i - (ln.length - 1) / 2) * lh));
    });
  } else {
    rot(() => { x.shadowColor = 'rgba(23,33,43,.35)'; x.shadowBlur = 3; x.shadowOffsetY = 1; drawArt(x, p.art, 0, 0, Math.max(b.w, b.h), p.img); });
    if (!o.noLabel) { const w = Math.min(x.measureText(p.label).width + 10, MA * 2.4), y = pos.y + b.h / 2 + 4 + fs * .65; x.fillStyle = 'rgba(255,255,255,.88)'; x.beginPath(); x.roundRect(pos.x - w / 2, y - fs * .65, w, fs * 1.3, 6); x.fill(); x.fillStyle = '#17212B'; x.fillText(p.label, pos.x, y); }
  }
  const boxy = card || p.art === 'img', R = Math.max(b.w, b.h) / 2;
  const ring = (c, lw) => { x.strokeStyle = c; x.lineWidth = lw; x.beginPath(); if (boxy) rot(() => { x.beginPath(); x.roundRect(-b.w / 2 - 3, -b.h / 2 - 3, b.w + 6, b.h + 6, 10); x.stroke(); }); else { x.arc(pos.x, pos.y, R + 4, 0, 7); x.stroke(); } };
  if (o.focus) {
    x.setLineDash([8, 5]); ring('#0B6BCB', 5); x.setLineDash([]);
    if (p.turn) { // the turn handle: a dot on a short stem, with a turning arrow in it
      const h = handlePos(pos, turn, R + 40), e = h; const r0 = R + 6, ra = (turn - 90) * Math.PI / 180;
      x.strokeStyle = '#0B6BCB'; x.lineWidth = 4; x.beginPath(); x.moveTo(pos.x + r0 * Math.cos(ra), pos.y + r0 * Math.sin(ra)); x.lineTo(e.x, e.y); x.stroke();
      x.beginPath(); x.arc(h.x, h.y, 20, 0, 7); x.fillStyle = '#0B6BCB'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
      x.fillStyle = '#fff'; x.font = '800 26px ' + FONT; x.fillText('↻', h.x, h.y + 1);
    }
    if (o.resize) { // the size handle: a small square on the bottom-right corner (the editor only)
      const cx = pos.x + b.w / 2, cy = pos.y + b.h / 2; x.beginPath(); x.roundRect(cx - 13, cy - 13, 26, 26, 6); x.fillStyle = '#0B6BCB'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
      x.fillStyle = '#fff'; x.font = '800 20px ' + FONT; x.fillText('⤡', cx, cy + 1);
    }
  }
  if (o.ok !== undefined) {
    ring(o.ok ? '#0E7C4A' : '#B3261E', 5);
    const bx = pos.x + b.w / 2 - 2, by = pos.y - b.h / 2 + 2; x.beginPath(); x.arc(bx, by, 14, 0, 7); x.fillStyle = o.ok ? '#0E7C4A' : '#B3261E'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = '#fff'; x.font = '800 18px ' + FONT; x.fillText(o.ok ? '✓' : '✕', bx, by + 1);
  }
  x.restore();
}
// o: { ok:{id:bool}, where:{id:{x,y,a?}}, whereLabels, spots, tolRings:tol, focus (selected piece id), skip, only, fs }
function paintPieces(x, model, pl, bw, bh, o = {}) {
  const r = stageRect(model, bw, bh), fs = Math.max(21, 10 / r.k);
  x.save(); x.translate(r.x, r.y); x.scale(r.k, r.k);
  const shape = (p, X, Y, pad, stroke, fill) => { const b = pieceBox(p); x.setLineDash([10, 7]); x.lineWidth = 3; x.beginPath(); if (p.art === 'card' || p.art === 'img') x.roundRect(X - b.w / 2 - pad, Y - b.h / 2 - pad, b.w + pad * 2, b.h + pad * 2, 12); else x.arc(X, Y, Math.max(b.w, b.h) / 2 + pad, 0, 7); if (fill) { x.fillStyle = fill; x.fill(); } x.strokeStyle = stroke; x.stroke(); x.setLineDash([]); };
  const circle = (X, Y, rad, stroke, fill) => { x.setLineDash([10, 7]); x.lineWidth = 3; x.beginPath(); x.arc(X, Y, rad, 0, 7); if (fill) { x.fillStyle = fill; x.fill(); } x.strokeStyle = stroke; x.stroke(); x.setLineDash([]); };
  if (o.spots) model.pieces.forEach(p => { // outlines in the shape of the piece; one that has a piece in it is filled in more
    if (p.kx == null) return; const taken = model.pieces.some(q => pl && pl[q.id] && Math.hypot(pl[q.id].x - p.kx, pl[q.id].y - p.ky) < 20);
    shape(p, p.kx, p.ky, 8, '#0B6BCB', taken ? 'rgba(11,107,203,.22)' : 'rgba(11,107,203,.07)');
  });
  if (o.tolRings) model.pieces.forEach((p, i) => { // the area where a piece counts as right: the question's setting, or the piece's own
    const rad = p.tl || o.tolRings; circle(p.kx, p.ky, rad, '#0B6BCB', 'rgba(11,107,203,.10)'); x.font = '700 ' + fs * .8 + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillStyle = '#0B5CAD'; x.fillText(String(i + 1), p.kx, p.ky - rad - 2);
    if (o.zoneHandle === p.id) { x.beginPath(); x.arc(p.kx + rad, p.ky, 15, 0, 7); x.fillStyle = '#0B6BCB'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = '#fff'; x.font = '800 20px ' + FONT; x.textBaseline = 'middle'; x.fillText('↔', p.kx + rad, p.ky + 1); }
  });
  if (o.where) model.pieces.forEach(p => {
    const k = o.where[p.id]; if (!k) return;
    if (k.r) circle(k.x, k.y, k.r, '#B3261E', 'rgba(179,38,30,.08)'); else shape(p, k.x, k.y, 4, '#B3261E', 'rgba(179,38,30,.08)'); // a big area is drawn as an area
    if (p.turn && k.a != null) drawPiece(x, p, { x: k.x, y: k.y, a: k.a }, { fs, alpha: .38, noLabel: true }); // a faint copy of the piece, facing the right way
    if (pl && pl[p.id] && Math.hypot(pl[p.id].x - k.x, pl[p.id].y - k.y) < MA) return; // already in the right place (only the angle is wrong): the faint copy says which way, a label on top of the piece would only crowd it
    if (o.whereLabels === false) return; // the teacher's board lists where each piece belongs in words, so the labels would only crowd it
    x.font = '800 ' + fs + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; const t = p.label + (k.r ? ' belongs in this area' : ' goes here'), w = x.measureText(t).width + 10, y = k.y + (k.r || pieceBox(p).h / 2) + 12 + fs * .65;
    x.fillStyle = '#fff'; x.beginPath(); x.roundRect(k.x - w / 2, y - fs * .65, w, fs * 1.3, 6); x.fill(); x.fillStyle = '#8C1D18'; x.fillText(t, k.x, y);
  });
  model.pieces.forEach(p => {
    if (o.skip === p.id || (o.only != null && o.only !== p.id)) return;
    const pos = pl && pl[p.id] ? pl[p.id] : { x: p.x, y: p.y };
    drawPiece(x, p, pos, { fs, ok: o.ok ? o.ok[p.id] : undefined, focus: o.focus === p.id, resize: o.resize && o.focus === p.id });
  });
  x.restore();
}
// which piece is under a point (page units)? the one painted last wins. A piece that turns is a circle, so it is grabbed the same way at any angle.
function pieceAt(model, pl, bw, bh, px, py, pad = 0) {
  const r = stageRect(model, bw, bh), sx = (px - r.x) / r.k, sy = (py - r.y) / r.k;
  for (let i = model.pieces.length - 1; i >= 0; i--) {
    const p = model.pieces[i], pos = pl && pl[p.id] ? pl[p.id] : { x: p.x, y: p.y }, b = pieceBox(p), t = pad / r.k;
    if (p.turn ? Math.hypot(sx - pos.x, sy - pos.y) <= Math.max(b.w, b.h) / 2 + t : Math.abs(sx - pos.x) <= b.w / 2 + t && Math.abs(sy - pos.y) <= b.h / 2 + t) return p;
  }
  return null;
}
// is a point on the turn handle of piece `id`? (page units)
function handleAt(model, pl, id, bw, bh, px, py, pad = 0) {
  const p = model.pieces.find(q => q.id === id); if (!p || !p.turn) return false;
  const r = stageRect(model, bw, bh), pos = pl && pl[id] ? pl[id] : { x: p.x, y: p.y }, h = handlePos(pos, pos.a != null ? pos.a : p.a || 0, handleR(p));
  return Math.hypot((px - r.x) / r.k - h.x, (py - r.y) / r.k - h.y) <= 24 + pad / r.k;
}
// is a point on the handle on the edge of piece `id`'s answer area? (page units; the editor's answer view only)
function zoneAt(model, id, bw, bh, px, py, pad = 0) {
  const p = model.pieces.find(q => q.id === id); if (!p) return false;
  const r = stageRect(model, bw, bh), rad = p.tl || model.tol;
  return Math.hypot((px - r.x) / r.k - (p.kx + rad), (py - r.y) / r.k - p.ky) <= 22 + pad / r.k;
}
// is a point on the size handle (the bottom-right corner) of piece `id`? (page units; the editor only)
function resizeAt(model, pl, id, bw, bh, px, py, pad = 0) {
  const p = model.pieces.find(q => q.id === id); if (!p) return false;
  const r = stageRect(model, bw, bh), pos = pl && pl[id] ? pl[id] : { x: p.x, y: p.y }, b = pieceBox(p);
  return Math.hypot((px - r.x) / r.k - (pos.x + b.w / 2), (py - r.y) / r.k - (pos.y + b.h / 2)) <= 20 + pad / r.k;
}

// ---- drawn diagrams: page backgrounds for pieces questions (orbit, Earth's layers, moon phases, plate boundaries) ----
// Each is drawn around the middle of the page, scaled to fit, in the same units as a wide stage (so answer spots can be worked out from the numbers).
const DIAG = {
  orbit(x) {
    x.setLineDash([10, 8]); x.strokeStyle = '#94A3B8'; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 0, 310, 213, 0, 0, 7); x.stroke();
    x.setLineDash([4, 5]); x.strokeStyle = '#64748B'; [[-310, 0], [0, 208], [310, 0], [0, -207]].forEach(([X, Y]) => { x.beginPath(); x.moveTo(X - 24, Y + 66); x.lineTo(X + 24, Y - 66); x.stroke(); }); x.setLineDash([]);
    x.save(); x.translate(-219, 151); x.rotate(35 * Math.PI / 180); x.fillStyle = '#64748B'; x.beginPath(); x.moveTo(-14, -11); x.lineTo(16, 0); x.lineTo(-14, 11); x.closePath(); x.fill(); x.restore();
    x.fillStyle = '#475569'; x.font = '700 20px ' + FONT; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('Earth moves this way', -350, 233);
    x.strokeStyle = '#F59E0B'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); [[0, -80, 0, -66], [0, 66, 0, 80], [-80, 0, -66, 0], [66, 0, 80, 0], [-56, -56, -46, -46], [46, 46, 56, 56], [56, -56, 46, -46], [-46, 46, -56, 56]].forEach(([a, b, c, d]) => { x.moveTo(a, b); x.lineTo(c, d); }); x.stroke();
    x.beginPath(); x.arc(0, 0, 46, 0, 7); x.fillStyle = '#FBBF24'; x.fill(); x.fillStyle = '#7C2D12'; x.textAlign = 'center'; x.fillText('Sun', 0, 6);
  },
  rings(x) {
    [[250, '#78716C'], [210, '#F97316'], [125, '#FACC15'], [60, '#FEF3C7']].forEach(([r, c]) => { x.beginPath(); x.arc(0, 0, r, 0, 7); x.fillStyle = c; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); });
    x.fillStyle = '#475569'; x.font = '700 20px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('A slice through the middle of Earth', 0, -290);
  },
  phases(x) {
    x.setLineDash([10, 8]); x.strokeStyle = '#94A3B8'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 215, 0, 7); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#F59E0B'; x.fillStyle = '#F59E0B'; x.lineWidth = 5; x.lineCap = 'round';
    [-110, 0, 110].forEach(y => { x.beginPath(); x.moveTo(-480, y); x.lineTo(-395, y); x.stroke(); x.beginPath(); x.moveTo(-385, y); x.lineTo(-405, y - 10); x.lineTo(-405, y + 10); x.closePath(); x.fill(); });
    x.fillStyle = '#92400E'; x.font = '700 20px ' + FONT; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('Sunlight', -480, -142);
    x.beginPath(); x.arc(0, 0, 40, 0, 7); x.fillStyle = '#3B82F6'; x.fill(); x.fillStyle = '#4ADE80'; x.beginPath(); x.arc(-8, -6, 14, 0, 7); x.arc(14, 12, 9, 0, 7); x.fill();
    x.fillStyle = '#475569'; x.textAlign = 'center'; x.fillText('Looking down on Earth’s north pole', 0, -290);
  },
  // ---- more drawn diagrams (no labels on the parts, so students label and draw them) ----
  ocean(x) { // open water for placing continents; faint lines like a map grid
    x.fillStyle = '#DBEAFE'; x.fillRect(-2000, -2000, 4000, 4000);
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.setLineDash([10, 10]); x.beginPath();
    for (let i = -500; i <= 500; i += 125) { x.moveTo(i, -2000); x.lineTo(i, 2000); }
    for (let j = -312; j <= 312; j += 104) { x.moveTo(-2000, j); x.lineTo(2000, j); }
    x.stroke(); x.setLineDash([]);
  },
  seafloor(x) { // a mid-ocean ridge between two continents, with stripes of sea floor that match on both sides
    x.fillStyle = '#FDBA74'; x.fillRect(-500, 90, 1000, 222); // mantle
    x.fillStyle = '#BFDBFE'; x.fillRect(-500, -170, 1000, 260); // water
    const cuts = [0, 45, 120, 200, 290, 390], cols = ['#44403C', '#A8A29E'];
    for (let s = -1; s <= 1; s += 2) cuts.slice(0, -1).forEach((c, i) => { x.fillStyle = cols[i % 2]; x.fillRect(s > 0 ? c : -cuts[i + 1], -50, cuts[i + 1] - c, 140); });
    x.fillStyle = '#A16207'; x.fillRect(-500, -170, 110, 260); x.fillRect(390, -170, 110, 260); // the two continents
    x.fillStyle = '#44403C'; x.beginPath(); x.moveTo(-45, -50); x.lineTo(-18, -92); x.lineTo(18, -92); x.lineTo(45, -50); x.closePath(); x.fill(); // the ridge
    x.fillStyle = '#EF4444'; x.beginPath(); x.moveTo(-30, 90); x.quadraticCurveTo(-14, 20, -8, -52); x.lineTo(8, -52); x.quadraticCurveTo(14, 20, 30, 90); x.closePath(); x.fill(); // magma rising
    x.fillStyle = '#475569'; x.font = '700 20px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('A slice through the Atlantic Ocean floor', 0, -250);
  },
  subduction(x) { // an ocean plate sliding under a continent
    x.fillStyle = '#FDBA74'; x.fillRect(-500, -20, 1000, 332); // mantle
    x.fillStyle = '#BFDBFE'; x.fillRect(-500, -100, 410, 80); // ocean
    x.fillStyle = '#9CA3AF'; x.beginPath(); x.moveTo(-500, -20); x.lineTo(-100, -20); x.lineTo(-86, -12); x.lineTo(260, 190); x.lineTo(222, 232); x.lineTo(-112, 34); x.lineTo(-500, 34); x.closePath(); x.fill(); // ocean plate
    x.fillStyle = '#A8A29E'; x.beginPath(); x.moveTo(-100, -20); x.lineTo(-40, -100); x.lineTo(500, -100); x.lineTo(500, 60); x.lineTo(130, 60); x.lineTo(-86, -12); x.closePath(); x.fill(); // continent
    x.fillStyle = '#475569'; x.font = '700 20px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('An ocean plate meets a continent', 0, -210);
  },
  volcano(x) { // a cone with a vent and a magma chamber
    x.fillStyle = '#D6B98C'; x.fillRect(-500, 70, 1000, 242); x.strokeStyle = '#A16207'; x.lineWidth = 3; x.beginPath(); x.moveTo(-500, 150); x.lineTo(500, 150); x.moveTo(-500, 230); x.lineTo(500, 230); x.stroke();
    x.fillStyle = '#92400E'; x.beginPath(); x.moveTo(-290, 70); x.lineTo(-50, -150); x.lineTo(-24, -128); x.lineTo(24, -128); x.lineTo(50, -150); x.lineTo(290, 70); x.closePath(); x.fill();
    x.fillStyle = '#EF4444'; x.fillRect(-12, -128, 24, 290); x.beginPath(); x.ellipse(0, 190, 150, 60, 0, 0, 7); x.fill(); // vent and magma chamber
    x.fillStyle = '#9CA3AF'; [[-20, -190, 38], [24, -228, 46], [-8, -270, 40], [50, -178, 30]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }); // ash cloud
    x.strokeStyle = '#F97316'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(40, -120); x.quadraticCurveTo(90, -40, 130, 20); x.stroke();
    x.fillStyle = '#475569'; x.font = '700 20px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText('A volcano cut in half', -480, -290);
  },
  fault(x) { // layers of rock broken by a fault, one side dropped
    const strata = (dy) => { [['#D6B98C', 0], ['#FCA5A5', 60], ['#FDE68A', 120], ['#A8A29E', 190]].forEach(([c, y], i, a) => { x.fillStyle = c; x.fillRect(-500, -40 + dy + y, 1000, (a[i + 1] ? a[i + 1][1] : 400) - y); }); };
    x.save(); x.beginPath(); x.moveTo(-500, -312); x.lineTo(50, -312); x.lineTo(-120, 312); x.lineTo(-500, 312); x.closePath(); x.clip(); strata(0); x.restore();
    x.save(); x.beginPath(); x.moveTo(500, -312); x.lineTo(50, -312); x.lineTo(-120, 312); x.lineTo(500, 312); x.closePath(); x.clip(); strata(45); x.restore();
    x.strokeStyle = '#17212B'; x.lineWidth = 4; x.setLineDash([12, 8]); x.beginPath(); x.moveTo(35, -80); x.lineTo(-120, 312); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#475569'; x.font = '700 20px ' + FONT; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('Rock layers and a fault, from the side', -480, -280);
  },
  watercycle(x) { // sun, sea, mountain and cloud; students draw the cycle
    x.fillStyle = '#BFDBFE'; x.fillRect(-500, 130, 380, 182); x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); [[-440, 180], [-340, 230], [-260, 170], [-200, 260]].forEach(([a, b]) => { x.moveTo(a, b); x.quadraticCurveTo(a + 20, b - 12, a + 40, b); x.quadraticCurveTo(a + 60, b + 12, a + 80, b); }); x.stroke();
    x.fillStyle = '#86EFAC'; x.beginPath(); x.moveTo(-120, 312); x.lineTo(-120, 140); x.lineTo(60, 140); x.lineTo(230, -60); x.lineTo(310, 40); x.lineTo(350, 10); x.lineTo(500, 160); x.lineTo(500, 312); x.closePath(); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(230, -60); x.lineTo(196, -18); x.lineTo(226, -26); x.lineTo(250, -14); x.lineTo(268, -26); x.lineTo(262, -30); x.closePath(); x.fill(); // snow
    x.strokeStyle = '#3B82F6'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(200, -10); x.quadraticCurveTo(110, 120, 30, 160); x.quadraticCurveTo(-60, 190, -140, 200); x.stroke(); // river
    x.strokeStyle = '#F59E0B'; x.lineWidth = 6; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.moveTo(-400 + Math.cos(a) * 52, -230 + Math.sin(a) * 52); x.lineTo(-400 + Math.cos(a) * 68, -230 + Math.sin(a) * 68); } x.stroke();
    x.fillStyle = '#FBBF24'; x.beginPath(); x.arc(-400, -230, 40, 0, 7); x.fill();
    x.fillStyle = '#E2E8F0'; [[120, -190, 50], [170, -210, 62], [230, -190, 48], [175, -165, 44], [110, -160, 36]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
  },
  plates(x) {
    x.fillStyle = '#DBEAFE'; x.fillRect(-500, -312, 1000, 300); x.fillStyle = '#FDBA74'; x.fillRect(-500, 98, 1000, 214);
    x.fillStyle = '#9CA3AF'; x.fillRect(-420, -12, 420, 110); x.fillStyle = '#A8A29E'; x.fillRect(0, -12, 420, 110);
    x.strokeStyle = '#17212B'; x.lineWidth = 3; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(0, -90); x.lineTo(0, 98); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#17212B'; x.font = '700 22px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#7C2D12'; x.fillText('Plate A', -210, 126); x.fillText('Plate B', 210, 126); x.fillText('Mantle', 0, 235);
    x.fillStyle = '#475569'; x.font = '700 18px ' + FONT; x.fillText('The boundary', 0, -110);
  }
};
function diagram(x, name, w, h) { const s = Math.min(w / 1000, h / 625); x.save(); x.fillStyle = '#F8FAFC'; x.fillRect(0, 0, w, h); x.translate(w / 2, h / 2); x.scale(s, s); DIAG[name](x); x.restore(); }

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
