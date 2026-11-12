// The movable-pieces part of the question editor (/sets). Needs common.js, sortkit.js and tcommon.js (for el()).
// ME.mount({...}) wires the piece list, the options and the preview board to one draft model:
//   { stage:'wide'|'tall', spots:'hidden'|'shown', fb:'reveal'|'now', tol, pieces:[{ id, label, art, x, y, kx, ky, idea }] }
// ctx: get() -> the draft's model, changed() -> call after any edit (marks the question unsaved), issues(list) -> what still needs fixing,
//      bg() -> { bg, im } the draft's background and its loaded photo, el: { rows, opts, canvas, tabs, hint } -> containers on the page
// Two views of one board, like Sort's answer key: "key" (drag each piece to where it belongs; the dashed ring is how close counts) and
// "start" (what a student sees first; drag pieces to change where they begin).
const ME = (() => {
  let c = null, view = 'key', selId = null, cv = null, drag = null, raf = 0;
  const D = () => c.get();
  const ART = { earth: 'Earth', sun: 'Sun', moon: 'Moon', arrow: 'Arrow', card: 'Text card', 'moon-new': 'Moon: new', 'moon-crescent': 'Moon: crescent (lit right)', 'moon-quarter': 'Moon: quarter (lit right)', 'moon-gibbous': 'Moon: gibbous (lit right)', 'moon-full': 'Moon: full', 'moon-crescent-l': 'Moon: crescent (lit left)', 'moon-quarter-l': 'Moon: quarter (lit left)', 'moon-gibbous-l': 'Moon: gibbous (lit left)', img: 'Your own picture…' };
  const STEP = 15;
  const lo = () => SK.MODEL.A / 2;
  const clampX = (m, v, p) => { const w = p ? SK.boxOf(p).w / 2 : lo(); return Math.round(Math.min(SK.stageOf(m).w - w, Math.max(w, v))); };
  const clampY = (m, v, p) => { const h = p ? SK.boxOf(p).h / 2 : lo(); return Math.round(Math.min(SK.stageOf(m).h - h, Math.max(h, v))); };
  // keep the whole piece on the board after its size or picture changes
  const fit = (m, p) => { p.x = clampX(m, p.x, p); p.y = clampY(m, p.y, p); p.kx = clampX(m, p.kx, p); p.ky = clampY(m, p.ky, p); };
  // size is a number from 0.5 to 4 (100% = 1, which is simply not stored)
  const setSize = (p, v) => { const s = Math.round(Math.min(SK.MODEL.SIZE[1], Math.max(SK.MODEL.SIZE[0], v)) * 20) / 20; if (s === 1) delete p.s; else p.s = s; fit(D(), p); };
  const nextId = m => m.pieces.reduce((n, p) => Math.max(n, p.id), 0) + 1;
  const blank = () => {
    const m = { stage: 'wide', spots: 'hidden', fb: 'reveal', tol: 60, pieces: [{ id: 1, label: '', art: 'earth', x: 0, y: 0, kx: 330, ky: 312, idea: '' }, { id: 2, label: '', art: 'earth', x: 0, y: 0, kx: 670, ky: 312, idea: '' }] };
    return SK.scatter(m);
  };
  // the free spot farthest from the points in `avoid` (a grid search; good enough for a handful of pieces)
  function freeSpot(m, avoid, margin) {
    const st = SK.stageOf(m), L = lo() + (margin || 0); let best = null, bd = -1;
    for (let x = L + 10; x <= st.w - L - 10; x += 40) for (let y = L + 10; y <= st.h - L - 10; y += 40) {
      const d = avoid.length ? Math.min(...avoid.map(a => Math.hypot(x - a.x, y - a.y))) : 1e9;
      if (d > bd) { bd = d; best = { x, y }; }
    }
    return best || { x: L + 10, y: L + 10 };
  }
  const touch = full => { c.changed(); paint(); report(); if (full) renderLists(); };
  function report() { c.issues(SK.modelIssues(D()), SK.modelWarnings(D())); }
  const plNow = () => (view === 'key' ? Object.fromEntries(D().pieces.map(p => [p.id, p.turn ? { x: p.kx, y: p.ky, a: p.ka || 0 } : { x: p.kx, y: p.ky }])) : {});
  const angNow = p => (view === 'key' ? p.ka || 0 : p.a || 0);
  const setAng = (p, a) => { const v = SK.ang(a); if (view === 'key') p.ka = v; else p.a = v; };

  // ---- your own pictures: shrunk to fit the question (at most IMG_MAX bytes), with the white around them made see-through ----
  async function bitmapOf(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch {} }
    return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
  }
  // near-white pixels joined to the edge become see-through (the picture's own whites inside stay). false when it already has see-through parts.
  function cutOut(cv) {
    const x = cv.getContext('2d'), w = cv.width, h = cv.height, im = x.getImageData(0, 0, w, h), d = im.data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return false;
    const near = k => d[k * 4] > 232 && d[k * 4 + 1] > 232 && d[k * 4 + 2] > 232, seen = new Uint8Array(w * h), q = [];
    const add = (px, py) => { if (px < 0 || py < 0 || px >= w || py >= h) return; const k = py * w + px; if (seen[k] || !near(k)) return; seen[k] = 1; q.push(k); };
    for (let i = 0; i < w; i++) { add(i, 0); add(i, h - 1); } for (let j = 0; j < h; j++) { add(0, j); add(w - 1, j); }
    while (q.length) { const k = q.pop(), px = k % w, py = (k - px) / w; d[k * 4 + 3] = 0; add(px + 1, py); add(px - 1, py); add(px, py + 1); add(px, py - 1); }
    x.putImageData(im, 0, 0); return true;
  }
  async function pieceImage(file, cut) {
    const bmp = await bitmapOf(file), w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    for (const side of [256, 192, 128, 96]) {
      const k = Math.min(1, side / Math.max(w0, h0)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); if (cut) cutOut(cv);
      const url = cv.toDataURL('image/png'); if (SK.imgOk(url)) return url;
    }
    return null;
  }
  function choosePicture(p) {
    const f = el('input', { type: 'file', accept: 'image/*' });
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      try {
        const cut = await pieceImage(file, true), raw = await pieceImage(file, false);
        if (!cut || !raw) return tell('Try a smaller or simpler picture. A piece picture can be about ' + Math.round(SK.MODEL.IMG_MAX / 1000) + ' KB.', { title: 'That picture is too big' });
        const b0 = await bitmapOf(file); p.ar = Math.round((b0.width || b0.naturalWidth) / (b0.height || b0.naturalHeight) * 100) / 100; // the picture keeps its own shape
        p.art = 'img'; p.img = cut; p._pic = { cut, raw }; fit(D(), p); c.changed(); renderLists(); paint(); report();
      } catch { tell('Choose a PNG, JPEG or WebP picture.', { title: 'That file could not be read as a picture' }); }
    };
    f.click();
  }

  // ---- the board ----
  function paint() {
    if (!cv || !D()) return;
    const m = D(), st = SK.stageOf(m), box = c.el.canvas, availW = Math.max(240, box.clientWidth || 600), maxH = Math.max(320, Math.round(innerHeight * .68));
    const k = Math.min(availW / st.w, maxH / st.h), cssW = Math.round(st.w * k), cssH = Math.round(st.h * k), d = devicePixelRatio || 1;
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    if (cv.width !== Math.round(cssW * d) || cv.height !== Math.round(cssH * d)) { cv.width = Math.round(cssW * d); cv.height = Math.round(cssH * d); }
    const x = cv.getContext('2d'), b = c.bg(), key = view === 'key';
    x.setTransform(cv.width / st.w, 0, 0, cv.height / st.h, 0, 0);
    paintModelBg(x, m, b.bg, b.im, st.w, st.h);
    paintPieces(x, m, plNow(), st.w, st.h, { tolRings: key ? m.tol : 0, spots: !key && m.spots === 'shown', focus: selId, resize: true });
    cv.setAttribute('aria-label', (key ? 'Answer key board. ' : 'Student start board. ') + 'Drag a piece, or choose one and use the arrow keys to move it.');
  }
  const paintSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  function toStage(e) { const r = cv.getBoundingClientRect(), st = SK.stageOf(D()); return { x: (e.clientX - r.left) / r.width * st.w, y: (e.clientY - r.top) / r.height * st.h }; }
  function setPos(p, x, y) { const m = D(); if (view === 'key') { p.kx = clampX(m, x, p); p.ky = clampY(m, y, p); } else { p.x = clampX(m, x, p); p.y = clampY(m, y, p); } }
  function buildBoard() {
    c.el.canvas.textContent = ''; cv = el('canvas', { tabIndex: 0, style: 'display:block;max-width:100%;border-radius:var(--r-lg);touch-action:none;margin:0 auto;box-shadow:0 0 0 1px var(--c-line-2)' });
    cv.setAttribute('role', 'application'); c.el.canvas.append(cv);
    cv.addEventListener('pointerdown', e => {
      const m = D(), st = SK.stageOf(m), t = toStage(e), hit = pieceAt(m, plNow(), st.w, st.h, t.x, t.y, 6);
      const sp = selId != null ? m.pieces.find(q => q.id === selId) : null;
      if (sp && resizeAt(m, plNow(), sp.id, st.w, st.h, t.x, t.y, 6)) { e.preventDefault(); cv.setPointerCapture(e.pointerId); drag = { id: sp.id, size: true, moved: false }; return; }
      if (sp && sp.turn && handleAt(m, plNow(), sp.id, st.w, st.h, t.x, t.y, 6)) { e.preventDefault(); cv.setPointerCapture(e.pointerId); drag = { id: sp.id, rot: true, moved: false }; return; }
      if (!hit) { selId = null; paint(); renderLists(); return; }
      e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.focus(); const was = selId; selId = hit.id; if (was !== selId) renderLists();
      const pos = plNow()[hit.id] || { x: hit.x, y: hit.y }; drag = { id: hit.id, dx: pos.x - t.x, dy: pos.y - t.y, moved: false }; paint();
    });
    cv.addEventListener('pointermove', e => { if (!drag) return; const p = D().pieces.find(q => q.id === drag.id), t = toStage(e); if (!p) return; if (drag.size) { const pos = plNow()[p.id] || { x: p.x, y: p.y }, b1 = SK.boxOf({ ...p, s: 1 }); setSize(p, Math.max(2 * Math.abs(t.x - pos.x) / b1.w, 2 * Math.abs(t.y - pos.y) / b1.h)); } else if (drag.rot) { const pos = plNow()[p.id] || { x: p.x, y: p.y }; setAng(p, Math.round(angleTo(pos, t.x, t.y) / 5) * 5); } else setPos(p, t.x + drag.dx, t.y + drag.dy); drag.moved = true; paintSoon(); });
    const up = () => { if (drag && drag.moved) { c.changed(); report(); if (drag.size) renderLists(); } drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('keydown', e => {
      const p = D().pieces.find(q => q.id === selId); if (!p) return;
      if (e.key === '+' || e.key === '=' || e.key === '-') { e.preventDefault(); setSize(p, (p.s || 1) + (e.key === '-' ? -.1 : .1)); touch(true); return; }
      if (p.turn && (e.key === '[' || e.key === ']')) { e.preventDefault(); setAng(p, angNow(p) + (e.key === '[' ? -STEP : STEP)); touch(); return; }
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return; e.preventDefault();
      const pos = view === 'key' ? { x: p.kx, y: p.ky } : { x: p.x, y: p.y }, s = e.shiftKey ? 30 : 6; setPos(p, pos.x + k[0] * s, pos.y + k[1] * s); touch();
    });
  }

  // ---- the piece list and options ----
  function row(...kids) { return el('div', { className: 'srow' }, ...kids); }
  function renderLists() {
    const m = D(), E = c.el;
    E.rows.textContent = '';
    const ideas = [...new Set(m.pieces.map(p => p.idea).filter(Boolean))];
    const dl = el('datalist', { id: 'mideas' }); ideas.forEach(i => dl.append(el('option', { value: i }))); E.rows.append(dl);
    m.pieces.forEach((p, i) => {
      const inp = el('input', { className: 'inp', value: p.label, maxLength: 24, placeholder: 'Piece ' + (i + 1) + ' label, like Summer' }); inp.setAttribute('aria-label', 'Piece ' + (i + 1) + ' label');
      inp.oninput = () => { p.label = inp.value; touch(); }; inp.onfocus = () => { selId = p.id; paint(); };
      const art = el('select', { className: 'inp', style: 'flex:none;width:112px' }); art.setAttribute('aria-label', 'Picture for piece ' + (i + 1));
      Object.entries(ART).forEach(([v, t]) => art.append(el('option', { value: v, textContent: t }))); art.value = p.art; art.onchange = () => { p.art = art.value; if (p.art !== 'img') delete p.ar; fit(D(), p); touch(true); if (p.art === 'img' && !p.img) choosePicture(p); };
      const x = el('button', { className: 'b sq danger', title: 'Remove piece', disabled: m.pieces.length <= 2 }, icoEl('x')); x.setAttribute('aria-label', 'Remove piece ' + (i + 1));
      x.onclick = () => { m.pieces.splice(i, 1); if (selId === p.id) selId = null; touch(true); };
      const idea = el('input', { className: 'inp', value: p.idea || '', maxLength: 30, placeholder: 'Idea (optional), for results', style: 'font-size:var(--fs-sm);min-height:36px' }); idea.setAttribute('list', 'mideas'); idea.setAttribute('aria-label', 'Idea for piece ' + (i + 1));
      idea.oninput = () => { p.idea = SK.str(idea.value, 30); c.changed(); report(); };
      // turning: the checkbox, and two buttons that turn the piece in the view you are looking at
      // size: a slider here, or drag the square on the corner of the selected piece, or press + and - on the board
      const szv = el('span', { className: 'mut', style: 'min-width:46px;text-align:right', textContent: Math.round((p.s || 1) * 100) + '%' });
      const sz = el('input', { type: 'range', min: 50, max: 400, step: 5, value: Math.round((p.s || 1) * 100), style: 'flex:1;min-width:80px' }); sz.setAttribute('aria-label', 'Size of piece ' + (i + 1));
      sz.oninput = () => { setSize(p, sz.value / 100); szv.textContent = sz.value + '%'; selId = p.id; touch(); };
      const szrow = el('div', { style: 'display:flex;gap:8px;align-items:center;font-size:var(--fs-sm)' }, el('span', { className: 'mut', textContent: 'Size' }), sz, szv);
      const tl = el('label', { style: 'display:flex;gap:6px;align-items:center;font-size:var(--fs-sm);white-space:nowrap' }), tb = el('input', { type: 'checkbox', checked: !!p.turn }); tb.setAttribute('aria-label', 'Piece ' + (i + 1) + ' can turn'); tl.append(tb, 'Students turn it');
      tb.onchange = () => { if (tb.checked) { p.turn = true; p.ka = p.ka || 0; p.a = SK.ang(p.ka + 90 + (p.id * 53) % 181); selId = p.id; } else delete p.turn; touch(true); };
      const turns = [];
      if (p.turn) [['↺', -STEP, 'Turn left'], ['↻', STEP, 'Turn right']].forEach(([g, d, t]) => { const b = el('button', { type: 'button', className: 'b sm sq', textContent: g, title: t + ' (' + (view === 'key' ? 'the way it should face' : 'the way it starts') + ')' }); b.setAttribute('aria-label', t + ' piece ' + (i + 1)); b.onclick = () => { setAng(p, angNow(p) + d); selId = p.id; touch(); }; turns.push(b); });
      const pic = [];
      if (p.art === 'img') {
        if (p.img) pic.push(el('img', { src: p.img, alt: '', style: 'height:36px;width:36px;object-fit:contain;background:var(--c-fill);border-radius:6px' }));
        pic.push(el('button', { type: 'button', className: 'b sm', textContent: p.img ? 'Change picture' : 'Choose a picture', onclick: () => choosePicture(p) }));
        if (p._pic && p._pic.raw !== p._pic.cut) { const cut = p.img === p._pic.cut; pic.push(el('button', { type: 'button', className: 'b sm', textContent: cut ? 'White is see-through' : 'White is kept', title: 'The white around the picture', onclick: () => { p.img = cut ? p._pic.raw : p._pic.cut; touch(true); } })); }
        pic.push(el('span', { className: 'mut', style: 'font-size:var(--fs-xs)', textContent: 'PNG with a see-through background looks best.' }));
      }
      E.rows.append(el('div', { style: 'border:1px solid var(--c-line);border-radius:var(--r-lg);padding:8px;display:flex;flex-direction:column;gap:6px;margin-bottom:8px;' + (selId === p.id ? 'border-color:var(--c-primary)' : '') }, row(inp, art, x), ...(pic.length ? [el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, ...pic)] : []), idea, szrow, el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, tl, ...turns)));
    });
    const add = el('button', { className: 'b sm', textContent: '+ Add piece', disabled: m.pieces.length >= SK.MODEL.PIECES });
    add.onclick = () => {
      const id = nextId(m), key = freeSpot(m, [...m.pieces.map(p => ({ x: p.kx, y: p.ky })), ...m.pieces.map(p => ({ x: p.x, y: p.y }))], 110), start = freeSpot(m, [...m.pieces.map(p => ({ x: p.x, y: p.y })), ...m.pieces.map(p => ({ x: p.kx, y: p.ky })), key], 0); // answer spot toward the middle, start spot out in the open
      m.pieces.push({ id, label: '', art: 'earth', x: start.x, y: start.y, kx: key.x, ky: key.y, idea: '' }); selId = id; touch(true);
      const f = E.rows.querySelectorAll('input.inp'); const labels = [...f].filter(i => i.placeholder.startsWith('Piece')); labels[labels.length - 1].focus();
    };
    const sc = el('button', { className: 'b sm', textContent: 'Scatter the start positions', title: 'Spread the pieces over free spots, away from the answer spots' });
    sc.onclick = () => { SK.scatter(m, SK.bgAvoid(c.bg().bg, m)); setView('start'); touch(); };
    E.rows.append(el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, add, sc, el('span', { className: 'mut', style: 'font-size:var(--fs-sm)', textContent: m.pieces.length + ' of ' + SK.MODEL.PIECES })));

    E.opts.textContent = '';
    const seg = (label, cur, list, f, hint) => {
      const s = el('div', { className: 'seg' }); s.setAttribute('role', 'group'); s.setAttribute('aria-label', label);
      list.forEach(([v, t]) => { const b = el('button', { type: 'button', textContent: t, className: String(cur) === String(v) ? 'on' : '' }); b.onclick = () => f(v); s.append(b); });
      return el('div', { className: 'sec' }, el('div', { style: 'font-weight:700', textContent: label }), s, hint ? el('div', { className: 'mut', style: 'font-size:var(--fs-sm)', textContent: hint }) : '');
    };
    E.opts.append(
      seg('Board shape', m.stage, [['wide', 'Wide (Chromebook)'], ['tall', 'Tall (phone)']], v => {
        if (v === m.stage) return; const a = SK.stageOf(m), b = SK.stageOf({ stage: v });
        m.pieces.forEach(p => { p.x = p.x * b.w / a.w; p.y = p.y * b.h / a.h; p.kx = p.kx * b.w / a.w; p.ky = p.ky * b.h / a.h; });
        m.stage = v; m.pieces.forEach(p => fit(m, p)); touch(true);
      }, m.stage === 'tall' ? 'Pieces are about the same size on every screen, so a tall board is easier on a phone held upright.' : 'On a phone held upright a wide board gets small. Choose Tall for a question meant for phones.'),
      seg('Can students see where the spots are?', m.spots, [['hidden', 'Students find the spot'], ['shown', 'Show outlines']], v => { m.spots = v; touch(true); },
        m.spots === 'hidden' ? 'The answer spots are never sent to students or the projector. The app checks each piece against your key.' : 'Faint outlines show on every student’s page and pieces slip into them. The spots are public, so this is a puzzle more than a check.'),
      seg('How close counts as right?', m.tol, [[20, 'Very tight'], [35, 'Tight'], [60, 'Normal'], [90, 'Loose']], v => { m.tol = +v; touch(true); })
    );
    if (m.pieces.some(p => p.turn)) E.opts.append(seg('How close must the turn be?', m.atol || 30, [[15, 'Tight (15°)'], [30, 'Normal (30°)'], [45, 'Loose (45°)']], v => { m.atol = +v; touch(true); }, 'In Answer key, turn each piece to the way it should face. In Student start, turn it to the way students first see it.'));
    const fb = el('select', { className: 'inp' }); fb.setAttribute('aria-label', 'When students see if they are right');
    [['reveal', 'Only when I press Reveal answers'], ['now', 'Right away, as they place each piece']].forEach(([v, t]) => fb.append(el('option', { value: v, textContent: t }))); fb.value = m.fb;
    fb.onchange = () => { m.fb = fb.value; touch(); };
    E.opts.append(el('div', { className: 'sec' }, el('div', { style: 'font-weight:700', textContent: 'Show students if they are right' }), fb));
  }
  function setView(v) {
    view = v; c.el.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    c.el.hint.textContent = v === 'key' ? 'Drag each piece to where it belongs. The dashed ring is how close counts as right. These spots stay on the server. Pick a piece to see its handles: the square corner changes its size.' : 'This is what a student sees first. Drag pieces to change where they start, or press Scatter.';
    paint();
  }
  return {
    blank,
    mount(ctx) { c = ctx; buildBoard(); c.el.tabs.querySelectorAll('button').forEach(b => (b.onclick = () => setView(b.dataset.v))); addEventListener('resize', () => paintSoon()); addEventListener('pieceimg', () => paintSoon()); },
    // call whenever the draft changes (another question picked, a model switched on)
    render() { selId = null; renderLists(); setView(view); report(); },
    preview() { paint(); },
    view: setView
  };
})();
