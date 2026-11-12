// The student side of movable pieces on a Draw question (index.html). Needs common.js, sortkit.js and the page's drawing code.
// The student's answer is one small map { pieceId: { x, y } } of the pieces they have moved, in stage units (see common.js: stageRect).
// The server keeps it, so a refresh loses nothing. Pieces move only with the Pieces tool; every other tool draws on top of them.
// Keyboard: Tab to a piece, arrow keys move it (Shift for bigger steps). Dragging with a mouse or finger works the same way.
const MP = (() => {
  let model = null, pl = {}, fb = null, focus = null, drag = null, ctx = null, sendT = 0, rev = 0, wasMove = false;
  const lo = MA / 2;
  const live = msg => { const l = $('#mplive'); if (!l) return; l.textContent = ''; setTimeout(() => (l.textContent = msg), 30); };
  const posOf = p => pl[p.id] || { x: p.x, y: p.y };
  const nMoved = () => (model ? model.pieces.filter(p => pl[p.id]).length : 0);
  const clampPos = (x, y) => { const s = MSTAGE[model.stage] || MSTAGE.wide; return { x: Math.round(Math.min(s.w - lo, Math.max(lo, x))), y: Math.round(Math.min(s.h - lo, Math.max(lo, y))) }; };
  const redraw = () => { rev++; ctx.bump(); ctx.draw(); };
  function push(now) { // while dragging, about 8 updates a second; the last one always goes out
    const go = () => { clearTimeout(sendT); sendT = 0; ctx.send({ t: 'place', p: pl }); };
    if (now) go(); else if (!sendT) sendT = setTimeout(go, 120);
  }
  // "Show outlines": a piece let go near an outline slips into it. The check is still against that piece's own spot.
  function snap(id) {
    if (!model || model.spots !== 'shown' || !pl[id]) return;
    let best = null, bd = 80;
    model.pieces.forEach(q => { if (q.kx == null) return; const d = Math.hypot(pl[id].x - q.kx, pl[id].y - q.ky); if (d < bd && !model.pieces.some(z => z.id !== id && pl[z.id] && Math.hypot(pl[z.id].x - q.kx, pl[z.id].y - q.ky) < 20)) { bd = d; best = q; } });
    if (best) pl[id] = { x: best.kx, y: best.ky };
  }
  function syncList() { // one hidden button per piece, so a keyboard or screen reader can reach each one
    const box = $('#pcl'); if (!box) return;
    if (!model) { box.textContent = ''; return; }
    const have = [...box.children].map(b => b.dataset.id).join(), want = model.pieces.map(p => p.id).join();
    if (have !== want) {
      box.textContent = '';
      model.pieces.forEach(p => {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.id = p.id;
        b.onfocus = () => { focus = p.id; redraw(); };
        b.onblur = () => { if (focus === p.id) { focus = null; redraw(); } };
        b.onkeydown = e => {
          const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return;
          e.preventDefault(); e.stopPropagation(); if (ctx.cantEdit()) return;
          const q = posOf(p), s = e.shiftKey ? 40 : 12; pl[p.id] = clampPos(q.x + k[0] * s, q.y + k[1] * s); snap(p.id);
          push(false); redraw(); ui(); live(p.label + ' moved. ' + nMoved() + ' of ' + model.pieces.length + ' pieces moved.');
        };
        box.append(b);
      });
    }
    [...box.children].forEach((b, i) => { const p = model.pieces[i]; b.setAttribute('aria-label', p.label + (pl[p.id] ? ' (moved).' : ' (not moved yet).') + ' Use the arrow keys to move it.'); });
  }
  function ui() {
    document.querySelectorAll('[data-t=move],[data-qt=move]').forEach(b => (b.hidden = !model));
    const bar = $('#mpbar'); if (bar) bar.hidden = !model;
    syncList();
    const sc = $('#sortscore');
    if (!model) return;
    $('#mpn').textContent = nMoved() + ' of ' + model.pieces.length + ' pieces moved';
    $('#mpnote').textContent = ctx.tool() === 'move' ? '' : 'Pieces are locked while you draw. Choose Pieces to move them.';
    $('#mpreset').disabled = !nMoved();
    if (sc) { const all = nMoved() === model.pieces.length, right = fb ? model.pieces.filter(p => fb.ok[p.id]).length : 0; sc.hidden = !(fb && all); sc.textContent = 'You got ' + right + ' of ' + model.pieces.length; }
  }
  function set(nq, keep, force) {
    model = nq && nq.model ? nq.model : null;
    if (!keep) { pl = {}; fb = null; }
    focus = null; drag = null; clearTimeout(sendT); sendT = 0;
    if (model && (force || !wasMove)) ctx.setTool('move'); else if (!model && ctx.tool() === 'move') ctx.setTool('pen');
    wasMove = !!model; redraw(); ui();
  }
  return {
    init(c) { ctx = c; $('#mpreset').onclick = () => { if (ctx.cantEdit() || !model) return; pl = {}; push(true); redraw(); ui(); live('Pieces put back where they started.'); }; },
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
    paint(x, o) { if (model) paintPieces(x, model, pl, ctx.W(), ctx.H(), { spots: model.spots === 'shown', ok: fb ? fb.ok : undefined, where: fb ? fb.where : undefined, focus, skip: drag ? drag.id : undefined, ...o }); },
    paintLive(x) { if (model && drag) paintPieces(x, model, pl, ctx.W(), ctx.H(), { only: drag.id, focus: drag.id }); },
    dragging: () => !!drag,
    // pointer: p is a point on the page
    down(p, pad) {
      if (!model) return false;
      const hit = pieceAt(model, pl, ctx.W(), ctx.H(), p[0], p[1], pad), r = stageRect(model, ctx.W(), ctx.H()); if (!hit) return false;
      const pos = posOf(hit); drag = { id: hit.id, dx: pos.x - (p[0] - r.x) / r.k, dy: pos.y - (p[1] - r.y) / r.k, moved: false };
      if (document.activeElement && document.activeElement.closest('#pcl')) document.activeElement.blur();
      redraw(); return true;
    },
    move(p) {
      if (!drag) return; const r = stageRect(model, ctx.W(), ctx.H());
      pl[drag.id] = clampPos((p[0] - r.x) / r.k + drag.dx, (p[1] - r.y) / r.k + drag.dy); drag.moved = true; ctx.draw(); push(false);
    },
    drop() {
      if (!drag) return; const d = drag; drag = null;
      if (d.moved) { snap(d.id); push(true); const q = model.pieces.find(x => x.id === d.id); live(q.label + ' moved. ' + nMoved() + ' of ' + model.pieces.length + ' pieces moved.'); }
      redraw(); ui();
    },
    cancel() { drag = null; redraw(); }
  };
})();
