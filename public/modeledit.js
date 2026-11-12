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
  const ART = { earth: 'Earth', sun: 'Sun', moon: 'Moon', arrow: 'Arrow', card: 'Text card' };
  const lo = () => SK.MODEL.A / 2;
  const clampX = (m, v) => Math.round(Math.min(SK.stageOf(m).w - lo(), Math.max(lo(), v))), clampY = (m, v) => Math.round(Math.min(SK.stageOf(m).h - lo(), Math.max(lo(), v)));
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
  function report() { c.issues(SK.modelIssues(D())); }
  const plNow = () => (view === 'key' ? Object.fromEntries(D().pieces.map(p => [p.id, { x: p.kx, y: p.ky }])) : {});

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
    paintPieces(x, m, plNow(), st.w, st.h, { tolRings: key ? m.tol : 0, spots: !key && m.spots === 'shown', focus: selId });
    cv.setAttribute('aria-label', (key ? 'Answer key board. ' : 'Student start board. ') + 'Drag a piece, or choose one and use the arrow keys to move it.');
  }
  const paintSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  function toStage(e) { const r = cv.getBoundingClientRect(), st = SK.stageOf(D()); return { x: (e.clientX - r.left) / r.width * st.w, y: (e.clientY - r.top) / r.height * st.h }; }
  function setPos(p, x, y) { const m = D(); if (view === 'key') { p.kx = clampX(m, x); p.ky = clampY(m, y); } else { p.x = clampX(m, x); p.y = clampY(m, y); } }
  function buildBoard() {
    c.el.canvas.textContent = ''; cv = el('canvas', { tabIndex: 0, style: 'display:block;max-width:100%;border-radius:var(--r-lg);touch-action:none;margin:0 auto;box-shadow:0 0 0 1px var(--c-line-2)' });
    cv.setAttribute('role', 'application'); c.el.canvas.append(cv);
    cv.addEventListener('pointerdown', e => {
      const m = D(), st = SK.stageOf(m), t = toStage(e), hit = pieceAt(m, plNow(), st.w, st.h, t.x, t.y, 6);
      if (!hit) { selId = null; paint(); return; }
      e.preventDefault(); cv.setPointerCapture(e.pointerId); cv.focus(); selId = hit.id;
      const pos = plNow()[hit.id] || { x: hit.x, y: hit.y }; drag = { id: hit.id, dx: pos.x - t.x, dy: pos.y - t.y, moved: false }; paint();
    });
    cv.addEventListener('pointermove', e => { if (!drag) return; const p = D().pieces.find(q => q.id === drag.id), t = toStage(e); if (!p) return; setPos(p, t.x + drag.dx, t.y + drag.dy); drag.moved = true; paintSoon(); });
    const up = () => { if (drag && drag.moved) { c.changed(); report(); } drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('keydown', e => {
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return;
      const p = D().pieces.find(q => q.id === selId); if (!p) return; e.preventDefault();
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
      Object.entries(ART).forEach(([v, t]) => art.append(el('option', { value: v, textContent: t }))); art.value = p.art; art.onchange = () => { p.art = art.value; touch(); };
      const x = el('button', { className: 'b sq danger', title: 'Remove piece', disabled: m.pieces.length <= 2 }, icoEl('x')); x.setAttribute('aria-label', 'Remove piece ' + (i + 1));
      x.onclick = () => { m.pieces.splice(i, 1); if (selId === p.id) selId = null; touch(true); };
      const idea = el('input', { className: 'inp', value: p.idea || '', maxLength: 30, placeholder: 'Idea (optional), for results', style: 'font-size:var(--fs-sm);min-height:36px' }); idea.setAttribute('list', 'mideas'); idea.setAttribute('aria-label', 'Idea for piece ' + (i + 1));
      idea.oninput = () => { p.idea = SK.str(idea.value, 30); c.changed(); report(); };
      E.rows.append(el('div', { style: 'border:1px solid var(--c-line);border-radius:var(--r-lg);padding:8px;display:flex;flex-direction:column;gap:6px;margin-bottom:8px' }, row(inp, art, x), idea));
    });
    const add = el('button', { className: 'b sm', textContent: '+ Add piece', disabled: m.pieces.length >= SK.MODEL.PIECES });
    add.onclick = () => {
      const id = nextId(m), key = freeSpot(m, [...m.pieces.map(p => ({ x: p.kx, y: p.ky })), ...m.pieces.map(p => ({ x: p.x, y: p.y }))], 110), start = freeSpot(m, [...m.pieces.map(p => ({ x: p.x, y: p.y })), ...m.pieces.map(p => ({ x: p.kx, y: p.ky })), key], 0); // answer spot toward the middle, start spot out in the open
      m.pieces.push({ id, label: '', art: 'earth', x: start.x, y: start.y, kx: key.x, ky: key.y, idea: '' }); selId = id; touch(true);
      const f = E.rows.querySelectorAll('input.inp'); const labels = [...f].filter(i => i.placeholder.startsWith('Piece')); labels[labels.length - 1].focus();
    };
    const sc = el('button', { className: 'b sm', textContent: 'Scatter the start positions', title: 'Spread the pieces over free spots, away from the answer spots' });
    sc.onclick = () => { SK.scatter(m); setView('start'); touch(); };
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
        m.stage = v; m.pieces.forEach(p => { p.x = clampX(m, p.x); p.y = clampY(m, p.y); p.kx = clampX(m, p.kx); p.ky = clampY(m, p.ky); }); touch(true);
      }, m.stage === 'tall' ? 'Pieces are about the same size on every screen, so a tall board is easier on a phone held upright.' : 'On a phone held upright a wide board gets small. Choose Tall for a question meant for phones.'),
      seg('Can students see where the spots are?', m.spots, [['hidden', 'Students find the spot'], ['shown', 'Show outlines']], v => { m.spots = v; touch(true); },
        m.spots === 'hidden' ? 'The answer spots are never sent to students or the projector. The app checks each piece against your key.' : 'Faint outlines show on every student’s page and pieces slip into them. The spots are public, so this is a puzzle more than a check.'),
      seg('How close counts as right?', m.tol, [[35, 'Tight'], [60, 'Normal'], [90, 'Loose']], v => { m.tol = +v; touch(true); })
    );
    const fb = el('select', { className: 'inp' }); fb.setAttribute('aria-label', 'When students see if they are right');
    [['reveal', 'Only when I press Reveal answers'], ['now', 'Right away, as they place each piece']].forEach(([v, t]) => fb.append(el('option', { value: v, textContent: t }))); fb.value = m.fb;
    fb.onchange = () => { m.fb = fb.value; touch(); };
    E.opts.append(el('div', { className: 'sec' }, el('div', { style: 'font-weight:700', textContent: 'Show students if they are right' }), fb));
  }
  function setView(v) {
    view = v; c.el.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    c.el.hint.textContent = v === 'key' ? 'Drag each piece to where it belongs. The dashed ring is how close counts as right. These spots stay on the server.' : 'This is what a student sees first. Drag pieces to change where they start, or press Scatter.';
    paint();
  }
  return {
    blank,
    mount(ctx) { c = ctx; buildBoard(); c.el.tabs.querySelectorAll('button').forEach(b => (b.onclick = () => setView(b.dataset.v))); addEventListener('resize', () => paintSoon()); },
    // call whenever the draft changes (another question picked, a model switched on)
    render() { selId = null; renderLists(); setView(view); report(); },
    preview() { paint(); },
    view: setView
  };
})();
