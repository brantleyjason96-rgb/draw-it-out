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
function paintBoard(cv, objs, bg, im, bw, bh) {
  const x = cv.getContext('2d'), s = Math.min(cv.width / bw, cv.height / bh);
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#e5e7eb'; x.fillRect(0, 0, cv.width, cv.height);
  x.setTransform(s, 0, 0, s, (cv.width - bw * s) / 2, (cv.height - bh * s) / 2);
  x.save(); x.beginPath(); x.rect(0, 0, bw, bh); x.clip();
  paintBg(x, bg, im, bw, bh); objs.forEach(o => drawOp(x, o)); x.restore(); x.setTransform(1, 0, 0, 1, 0, 0);
}
// load a photo for the background; calls cb when ready
function loadImg(src, cb) {
  if (!src) return null;
  const i = new Image(); i.onload = cb; i.src = src; return i;
}

// WebSocket with automatic reconnect. onopen runs on every (re)connect so pages can re-handshake.
function connect(onmsg, onopen, onstatus) {
  let ws, delay = 500;
  const api = { send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }, open() { return !!ws && ws.readyState === 1; } };
  (function open() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => { delay = 500; onstatus && onstatus(true); onopen(); };
    ws.onmessage = e => { try { onmsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => { onstatus && onstatus(false); setTimeout(open, (delay = Math.min(delay * 2, 8000))); };
  })();
  return api;
}

// QR code for a join link (needs /qrcode.js loaded first). Returns an <img>-ready SVG string, black on white with a quiet border.
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
}
