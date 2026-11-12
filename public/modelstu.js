// The student side of movable pieces on a Draw question (index.html). Needs common.js, sortkit.js and the page's drawing code.
// The student's answer is one small map { pieceId: { x, y, a? } } of the pieces they have moved, in stage units (see common.js: stageRect);
// a piece that can turn also carries its angle a, in degrees. The server keeps it, so a refresh loses nothing.
// Pieces move only with the Pieces tool; every other tool draws on top of them.
// Keyboard: Tab to a piece, arrow keys move it (Shift for bigger steps), [ and ] turn it. Mouse and touch: drag it; tap it to pick it,
// then drag the round handle above it, or press Turn left / Turn right.
const MP = (() => {
  let model = null, pl = {}, fb = null, focus = null, sel = null, drag = null, ctx = null, sendT = 0, rev = 0, wasMove = false;
  const lo = MA / 2, STEP = 15;
  const live = msg => { const l = $('#mplive'); if (!l) return; l.textContent = ''; setTimeout(() => (l.textContent = msg), 30); };
  const posOf = p => pl[p.id] || { x: p.x, y: p.y };
  const angOf = p => { const q = pl[p.id]; return q && q.a != null ? q.a : p.a || 0; };
  const pieceById = id => (model ? model.pieces.find(p => p.id === id) : null);
  const nMoved = () => (model ? model.pieces.filter(p => pl[p.id]).length : 0);
  const clampPos = (x, y, p) => { const s = MSTAGE[model.stage] || MSTAGE.wide, b = pieceBox(p); return { x: Math.round(Math.min(s.w - b.w / 2, Math.max(b.w / 2, x))), y: Math.round(Math.min(s.h - b.h / 2, Math.max(b.h / 2, y))) }; };
  // one place that writes a piece's entry: a piece that can turn always carries its angle, one that cannot never does
  const put = (p, x, y, a) => { const q = clampPos(x, y, p); if (p.turn) q.a = ((Math.round(a == null ? angOf(p) : a) % 360) + 360) % 360; pl[p.id] = q; };
  const redraw = () => { rev++; ctx.bump(); ctx.draw(); };
  function push(now) { // while dragging, about 8 updates a second; the last one always goes out
    const go = () => { clearTimeout(sendT); sendT = 0; ctx.send({ t: 'place', p: pl }); };
    if (now) go(); else if (!sendT) sendT = setTimeout(go, 120);
  }
  // "Show outlines": a piece let go near an outline slips into it. The check is still against that piece's own spot.
  function snap(id) {
    if (!model || model.spots !== 'shown' || !pl[id]) return null;
    let best = null, bd = 80;
    model.pieces.forEach(q => { if (q.kx == null) return; const d = Math.hypot(pl[id].x - q.kx, pl[id].y - q.ky); if (d < bd && !model.pieces.some(z => z.id !== id && pl[z.id] && Math.hypot(pl[z.id].x - q.kx, pl[z.id].y - q.ky) < 20)) { bd = d; best = q; } });
    if (best) { pl[id] = { ...pl[id], x: best.kx, y: best.ky }; return true; }
    return null;
  }
  function turn(id, deg) {
    const p = pieceById(id); if (!p || !p.turn || ctx.cantEdit()) return;
    const q = posOf(p); put(p, q.x, q.y, angOf(p) + deg); push(false); redraw(); ui();
    live(p.label + ' turned to ' + pl[p.id].a + ' degrees. ' + nMoved() + ' of ' + model.pieces.length + ' pieces moved.');
  }
  function syncList() { // one hidden button per piece, so a keyboard or screen reader can reach each one
    const box = $('#pcl'); if (!box) return;
    if (!model) { box.textContent = ''; return; }
    const have = [...box.children].map(b => b.dataset.id).join(), want = model.pieces.map(p => p.id).join();
    if (have !== want) {
      box.textContent = '';
      model.pieces.forEach(p => {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.id = p.id;
        b.onfocus = () => { focus = p.id; sel = p.id; redraw(); ui(); };
        b.onblur = () => { if (focus === p.id) { focus = null; redraw(); } };
        b.onkeydown = e => {
          if (p.turn && (e.key === '[' || e.key === ']')) { e.preventDefault(); e.stopPropagation(); turn(p.id, e.key === '[' ? -STEP : STEP); return; }
          const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return;
          e.preventDefault(); e.stopPropagation(); if (ctx.cantEdit()) return;
          const q = posOf(p), s = e.shiftKey ? 40 : 12; put(p, q.x + k[0] * s, q.y + k[1] * s); snap(p.id);
          push(false); redraw(); ui(); live(p.label + ' moved. ' + nMoved() + ' of ' + model.pieces.length + ' pieces moved.');
        };
        box.append(b);
      });
    }
    [...box.children].forEach((b, i) => { const p = model.pieces[i]; b.setAttribute('aria-label', p.label + (pl[p.id] ? ' (moved).' : ' (not moved yet).') + ' Use the arrow keys to move it.' + (p.turn ? ' It can turn: press [ or ] to turn it. It faces ' + angOf(p) + ' degrees.' : '')); });
  }
  function ui() {
    document.querySelectorAll('[data-t=move],[data-qt=move]').forEach(b => (b.hidden = !model));
    const bar = $('#mpbar'); if (bar) bar.hidden = !model;
    syncList();
    const sc = $('#sortscore');
    if (!model) return;
    const sp = sel != null ? pieceById(sel) : null, canTurn = !!(sp && sp.turn) && ctx.tool() === 'move';
    $('#mpn').textContent = nMoved() + ' of ' + model.pieces.length + ' pieces moved';
    $('#mpnote').textContent = ctx.tool() === 'move' ? '' : 'Pieces are locked while you draw. Choose Pieces to move them.';
    $('#mpreset').disabled = !nMoved();
    const t = $('#mpturn'); t.hidden = !canTurn; if (canTurn) { $('#mpl').setAttribute('aria-label', 'Turn ' + sp.label + ' left'); $('#mpr').setAttribute('aria-label', 'Turn ' + sp.label + ' right'); }
    if (sc) { const all = nMoved() === model.pieces.length, right = fb ? model.pieces.filter(p => fb.ok[p.id]).length : 0; sc.hidden = !(fb && all); sc.textContent = 'You got ' + right + ' of ' + model.pieces.length; }
  }
  function set(nq, keep, force) {
    model = nq && nq.model ? nq.model : null;
    if (!keep) { pl = {}; fb = null; }
    focus = null; sel = null; drag = null; clearTimeout(sendT); sendT = 0;
    if (model && (force || !wasMove)) ctx.setTool('move'); else if (!model && ctx.tool() === 'move') ctx.setTool('pen');
    wasMove = !!model; redraw(); ui();
  }
  return {
    init(c) {
      ctx = c;
      $('#mpreset').onclick = () => { if (ctx.cantEdit() || !model) return; pl = {}; push(true); redraw(); ui(); live('Pieces put back where they started.'); };
      $('#mpl').onclick = () => turn(sel, -STEP); $('#mpr').onclick = () => turn(sel, STEP);
    },
    active: () => !!model,
    model: () => model,
    rev: () => rev,
    ui,
    newQ: nq => set(nq, false, true), // a new question always starts on the Pieces tool
    restore: nq => set(nq, true),
    joined(m) { set(m.q, false); if (model) { pl = m.pl || {}; fb = m.fb ? { ok: m.fb.ok || {}, where: m.fb.where || {} } : null; } redraw(); ui(); },
    // the server told this student which of their pieces are right (Reveal, or "right away")
    msg(m) {
      if (!model || m.t !== 'fb') return false;
      fb = m.off ? null : { ok: m.ok || {}, where: m.where || {} }; redraw(); ui(); return true;
    },
    // painting: the page's cache calls paint() between the background and the drawing; the piece being dragged is painted live on top
    paint(x, o) { if (model) paintPieces(x, model, pl, ctx.W(), ctx.H(), { spots: model.spots === 'shown', ok: fb ? fb.ok : undefined, where: fb ? fb.where : undefined, focus: ctx.tool() === 'move' || focus != null ? (sel != null ? sel : focus) : undefined, skip: drag ? drag.id : undefined, ...o }); },
    paintLive(x) { if (model && drag) paintPieces(x, model, pl, ctx.W(), ctx.H(), { only: drag.id, focus: drag.id }); },
    dragging: () => !!drag,
    // pointer: p is a point on the page. True when a piece (or its turn handle) was grabbed.
    down(p, pad) {
      if (!model) return false;
      const W = ctx.W(), H = ctx.H(), r = stageRect(model, W, H);
      if (sel != null && handleAt(model, pl, sel, W, H, p[0], p[1], pad)) { drag = { id: sel, rot: true, moved: false }; redraw(); return true; }
      const hit = pieceAt(model, pl, W, H, p[0], p[1], pad);
      if (!hit) { if (sel != null) { sel = null; redraw(); ui(); } return false; }
      const pos = posOf(hit); sel = hit.id; drag = { id: hit.id, dx: pos.x - (p[0] - r.x) / r.k, dy: pos.y - (p[1] - r.y) / r.k, moved: false };
      if (document.activeElement && document.activeElement.closest('#pcl')) document.activeElement.blur();
      redraw(); ui(); return true;
    },
    move(p) {
      if (!drag) return; const r = stageRect(model, ctx.W(), ctx.H()), pc = pieceById(drag.id);
      if (drag.rot) { const a = angleTo(posOf(pc), (p[0] - r.x) / r.k, (p[1] - r.y) / r.k); const q = posOf(pc); put(pc, q.x, q.y, Math.round(a / 5) * 5); }
      else { put(pc, (p[0] - r.x) / r.k + drag.dx, (p[1] - r.y) / r.k + drag.dy); }
      drag.moved = true; ctx.draw(); push(false);
    },
    drop() {
      if (!drag) return; const d = drag; drag = null;
      if (d.moved) { const pc = pieceById(d.id), slipped = d.rot ? null : snap(d.id); push(true); live(pc.label + (d.rot ? ' turned to ' + pl[d.id].a + ' degrees. ' : slipped ? ' moved into an outline. ' : ' moved. ') + nMoved() + ' of ' + model.pieces.length + ' pieces moved.'); }
      redraw(); ui();
    },
    cancel() { drag = null; redraw(); }
  };
})();
