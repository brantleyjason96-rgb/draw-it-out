// shared by student, teacher and projector pages
const W = 800, H = 500;
const $ = s => document.querySelector(s);

function paintBg(x, bg, im) {
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  if (bg === 'photo') {
    if (im && im.complete && im.naturalWidth) {
      const s = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
      x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    }
    return;
  }
  x.strokeStyle = '#cfe3f4'; x.lineWidth = 1; x.beginPath();
  if (bg === 'graph') {
    for (let i = 0; i <= W; i += 25) { x.moveTo(i, 0); x.lineTo(i, H); }
    for (let i = 0; i <= H; i += 25) { x.moveTo(0, i); x.lineTo(W, i); }
  } else if (bg === 'lined') {
    for (let i = 60; i < H; i += 40) { x.moveTo(0, i); x.lineTo(W, i); }
  }
  x.stroke();
}

const mkLayer = () => Object.assign(document.createElement('canvas'), { width: W, height: H });

function drawOp(x, o) {
  x.globalCompositeOperation = o.e ? 'destination-out' : 'source-over';
  x.strokeStyle = x.fillStyle = o.c; x.lineWidth = o.w; x.lineCap = x.lineJoin = 'round';
  const [x1, y1] = o.a, [x2, y2] = o.b;
  if (o.tx) { x.font = o.w + 'px "Segoe Print","Comic Sans MS",system-ui,sans-serif'; x.textBaseline = 'top'; x.fillText(o.tx, x1, y1); }
  else if (o.s === 'rect') x.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  else if (o.s === 'ellipse') { x.beginPath(); x.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, 7); x.stroke(); }
  else {
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2);
    if (o.s === 'arrow') { // arrowhead at the end point
      const a = Math.atan2(y2 - y1, x2 - x1), h = 16 + o.w;
      x.moveTo(x2, y2); x.lineTo(x2 - h * Math.cos(a - 0.45), y2 - h * Math.sin(a - 0.45));
      x.moveTo(x2, y2); x.lineTo(x2 - h * Math.cos(a + 0.45), y2 - h * Math.sin(a + 0.45));
    }
    x.stroke(); // plain pen/eraser segments and lines
  }
  x.globalCompositeOperation = 'source-over';
}
function replay(layer, ops) {
  const x = layer.getContext('2d'); x.clearRect(0, 0, W, H); ops.forEach(o => drawOp(x, o));
}
// remove the most recent stroke (all segments sharing the last stroke id)
function dropLast(ops) {
  if (!ops.length) return ops;
  const k = ops[ops.length - 1].k; return ops.filter(o => o.k !== k);
}
function compose(cv, layer, bg, im) {
  const x = cv.getContext('2d'); paintBg(x, bg, im); x.drawImage(layer, 0, 0);
}
// load a photo for the background; calls cb when ready
function loadImg(src, cb) {
  if (!src) return null;
  const i = new Image(); i.onload = cb; i.src = src; return i;
}

// WebSocket with automatic reconnect. onopen runs on every (re)connect so pages can re-handshake.
function connect(onmsg, onopen, onstatus) {
  let ws, delay = 500;
  const api = { send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } };
  (function open() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => { delay = 500; onstatus && onstatus(true); onopen(); };
    ws.onmessage = e => { try { onmsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => { onstatus && onstatus(false); setTimeout(open, (delay = Math.min(delay * 2, 8000))); };
  })();
  return api;
}
