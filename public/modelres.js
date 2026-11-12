// Class results for a question with movable pieces: who got which piece, which ideas need reteaching, how each team did, and where
// students put each piece. Needs common.js, sortkit.js (the numbers come from SK.modelStats) and tcommon.js (for el()).
// MR.mount(box, get) then MR.update() whenever anything changes. It uses the same look as the sort results (sortres.css).
//   get() -> { q, sk, full, bg, im, students:[{ id, name, team:{id,name,emoji,color}|null, pl:{pieceId:{x,y}}, objs, bw, bh, aw }],
//              award(s), spot(s), spotId, projSum, setProjSum(on), ctlHost(), toast(m), revealed, reveal() }
// full = the model with the answer key joined on (kx, ky, idea, tol): only the teacher's screen ever has it.
const MR = (() => {
  const ST = { stu: 'need', piece: 'hard', idea: null, sel: null, open: new Set() };
  let box = null, get = null, timer = 0;
  const T = (tag, cls, text, ...kids) => { const e = el(tag, { className: cls || '', textContent: text == null ? '' : text }); kids.forEach(k => e.append(k)); return e; };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const nameOf = (D, id) => (D.pieces.find(p => p.id === id) || {}).label || '';

  const orderStudents = D => {
    const a = D.started.slice(), az = (x, y) => x.name.localeCompare(y.name);
    if (ST.stu === 'need') a.sort((x, y) => x.g.right - y.g.right || az(x, y));
    else if (ST.stu === 'top') a.sort((x, y) => y.g.right - x.g.right || az(x, y));
    else if (ST.stu === 'team') a.sort((x, y) => (x.team ? x.team.name : '~').localeCompare(y.team ? y.team.name : '~') || az(x, y));
    else a.sort(az);
    return a.concat(D.waiting.slice().sort(az));
  };
  const orderPieces = D => { const a = D.stat.slice(); if (ST.piece === 'hard') a.sort((x, y) => (x.pct == null) - (y.pct == null) || x.pct - y.pct || x.id - y.id); return a; };
  // a wrong cell shows the first letter of the piece whose spot it sits on; ? when it is not near any spot
  const mixLetter = (D, s, k) => { const o = s.mix[k.id]; return o === SK.TURN ? '↻' : o == null ? '?' : (nameOf(D, o)[0] || '?').toUpperCase(); };
  // what a wrong piece did, in words
  const mixWords = (D, s, k) => { const o = s.mix[k.id]; return o === SK.TURN ? 'in the right place, turned the wrong way' : o != null ? 'on the spot for “' + nameOf(D, o) + '”' : 'not near any spot'; };

  function render() {
    if (!box || !get) return;
    const c = get(); box.textContent = '';
    if (!c.sk || !c.full) return box.append(T('div', 'mut', 'The answer key for this question is not on this device. Send the question again from your question set.'));
    const D = SK.modelStats(c.full, c.students), n = D.pieces.length;
    if (!D.all.length) return box.append(T('div', 'empty', 'No students yet. Results appear here as students move their pieces.'));

    const sSel = el('select', { className: 'inp' }), cSel = el('select', { className: 'inp' });
    sSel.setAttribute('aria-label', 'Sort students'); cSel.setAttribute('aria-label', 'Sort pieces');
    [['need', 'Needs help first'], ['top', 'Top scores first'], ['az', 'A to Z'], ['team', 'By team']].forEach(([v, t]) => sSel.append(el('option', { value: v, textContent: t }))); sSel.value = ST.stu;
    [['hard', 'Hardest first'], ['set', 'Question set order']].forEach(([v, t]) => cSel.append(el('option', { value: v, textContent: t }))); cSel.value = ST.piece;
    sSel.onchange = () => { ST.stu = sSel.value; render(); }; cSel.onchange = () => { ST.piece = cSel.value; render(); };
    const proj = el('button', { className: 'tog blue' + (c.projSum ? ' on' : ''), onclick: () => c.setProjSum(!c.projSum) }, el('span', { textContent: 'Results on projector' }), document.createElement('i'));
    const csv = el('button', { className: 'b', textContent: 'Save results (CSV)', onclick: () => exportCSV(c, D) });
    const host = c.ctlHost && c.ctlHost();
    if (host) host.replaceChildren(T('span', 'lbl', 'Students'), sSel, T('span', 'lbl', 'Pieces'), cSel, csv, proj);
    else box.append(el('div', { className: 'sctl' }, el('div', { className: 'row' }, T('span', 'lbl', 'Students'), sSel, T('span', 'lbl', 'Pieces'), cSel), el('div', { className: 'row' }, csv, proj)));

    // summary numbers
    const avg = D.started.length ? D.started.reduce((a, s) => a + s.g.right, 0) / D.started.length : 0;
    const low = D.started.filter(s => s.g.right <= Math.floor(n / 2)).length, perfect = D.started.filter(s => s.g.right === n).length, all = D.started.filter(s => s.g.put === n).length;
    const stat = (k, v, s, big, s2) => el('div', { className: 'card sstat' }, T('span', 'lbl', k), T('span', big ? 'v sm' : 'v', v), T('span', 's', s), ...(s2 ? [T('span', 's', s2)] : []));
    box.append(el('div', { className: 'sstats' },
      stat('Class average', avg.toFixed(1) + ' / ' + n, D.started.length ? Math.round(100 * avg / n) + '% of pieces in the right place' : 'Waiting for answers'),
      stat('Moved every piece', all + ' of ' + D.all.length, plural(D.started.length - all, 'student') + ' still working', false, plural(perfect, 'student') + ' got every piece'),
      stat('Need a small group', plural(low, 'student'), 'Got half the pieces or fewer right'),
      D.worst ? stat('Biggest mix-up', D.worst.k.label + ' → ' + nameOf(D, D.worst.other) + '’s spot', plural(D.worst.n, 'student') + ', instead of its own spot', true) : stat('Biggest mix-up', 'None yet', 'A piece put on another piece’s spot shows here')));

    // ideas and teams
    const ideaBox = el('div', { className: 'card spad' }, el('div', { className: 'shead' }, T('h2', '', 'Which ideas are working?'), T('span', 'mut', D.ideas.length ? 'Click an idea to highlight its pieces below.' : 'Tag pieces with ideas in the editor to see this.')));
    D.ideas.forEach(d => {
      const t = d.pct == null ? 'mid' : SK.tier(d.pct), b = el('button', { className: 'idea', onclick: () => { ST.idea = ST.idea === d.name ? null : d.name; render(); } });
      b.setAttribute('aria-pressed', ST.idea === d.name);
      const bar = T('span', 'bar1'); bar.append(el('i', { className: 'f-' + t, style: 'width:' + (d.pct || 0) + '%' }));
      b.append(el('span', {}, T('b', '', d.name), T('small', '', plural(d.pieces, 'piece'))), bar, T('span', 'pct', d.pct == null ? '–' : d.pct + '%'), T('span', 'band b-' + t, d.pct == null ? 'No data' : SK.tierWord(d.pct)));
      ideaBox.append(b);
    });
    const teamBox = el('div', { className: 'card spad' }, el('div', { className: 'shead' }, T('h2', '', 'By team'), T('span', 'mut', 'Pieces in the right place')));
    if (!D.teams.length) teamBox.append(T('div', 'mut', 'Students are not on teams yet.'));
    D.teams.sort((a, b) => b.pct - a.pct).forEach(t => {
      const r = el('div', { className: 'tm' }); r.style.setProperty('--tc', t.team.color);
      const bar = T('span', 'bar1'); bar.append(el('i', { className: 'f-' + SK.tier(t.pct), style: 'width:' + t.pct + '%' }));
      r.append(T('b', '', (t.team.emoji ? t.team.emoji + ' ' : '') + t.team.name), bar, T('span', 'pct', t.pct + '%')); teamBox.append(r);
    });

    // heat map
    const pcs = orderPieces(D), stus = orderStudents(D);
    const tbl = el('table'), hr = el('tr', {}, el('th', { className: 'sticky corner', textContent: 'Student' }));
    pcs.forEach(k => {
      const b = el('button', { onclick: () => { ST.sel = { k: 'p', id: k.id }; render(); } });
      b.setAttribute('aria-label', 'Piece ' + k.label + ', ' + (k.pct == null ? 'no answers' : k.pct + ' percent right'));
      b.append(T('span', 'p b-' + (k.pct == null ? 'mid' : SK.tier(k.pct)), k.pct == null ? '–' : k.pct + '%'), T('span', 't', k.label), T('span', 'i', k.idea));
      hr.append(el('th', { className: 'colh' + (ST.idea && ST.idea !== k.idea ? ' dim' : '') + (ST.sel && ST.sel.k === 'p' && ST.sel.id === k.id ? ' sel' : '') }, b));
    });
    tbl.append(el('thead', {}, hr));
    const tb = el('tbody');
    stus.forEach(s => {
      const selS = ST.sel && ST.sel.k === 's' && ST.sel.id === s.id, tr = el('tr', { className: selS ? 'sel' : '' });
      const rb = el('button', { className: 'rowh', onclick: () => { ST.sel = { k: 's', id: s.id }; render(); } });
      rb.style.setProperty('--tc', s.team ? s.team.color : 'var(--c-line)');
      rb.append(T('span', '', s.name), T('span', 'sc b-' + (s.g.put ? SK.tier(Math.round(100 * s.g.right / n)) : 'mid'), s.g.put ? s.g.right + '/' + n : 'not started'));
      tr.append(el('th', { className: 'sticky', scope: 'row' }, rb));
      pcs.forEach(k => {
        const a = s.pl[k.id], ok = !!a && s.g.ok[k.id], on = ST.sel && ST.sel.k === 'p' && ST.sel.id === k.id;
        const d = T('div', 'cell ' + (!a ? 'none' : ok ? 'ok' : 'no') + (ST.idea && ST.idea !== k.idea ? ' dim' : ''), !a || ok ? '' : mixLetter(D, s, k), ...(ok ? [icoEl('check', 'sm')] : []));
        d.title = s.name + (!a ? ' has not moved “' + k.label + '”' : ok ? ' put “' + k.label + '” in the right place' : ' put “' + k.label + '” ' + mixWords(D, s, k));
        tr.append(el('td', { className: on ? 'colsel' : '' }, d));
      });
      tb.append(tr);
    });
    tbl.append(tb);
    const legend = el('div', { className: 'legend' },
      el('span', {}, el('i', { className: 'swc ok' }, icoEl('check', 'sm')), document.createTextNode('In the right place')),
      el('span', {}, el('i', { className: 'swc no', textContent: 'A' }), document.createTextNode('Wrong. The letter is the first letter of the piece whose spot it sits on; ? means it is not near any spot; ↻ means the right place but turned the wrong way')),
      el('span', {}, T('i', 'swc none', ''), document.createTextNode('Not moved yet')));
    box.append(el('div', { className: 'card spad' }, el('div', { className: 'shead' }, T('h2', '', 'Who got which piece'), T('span', 'mut', (ST.stu === 'need' ? 'Students who need help are at the top. ' : '') + (ST.piece === 'hard' ? 'Hardest pieces are on the left. ' : '') + 'The stripe is the student’s team.')), legend, el('div', { className: 'sscroll' }, tbl)));
    box.append(el('div', { className: 'spair' }, ideaBox, teamBox));
    box.append(detail(c, D, pcs));
  }

  // where every student put one piece, on the board, with its answer spot
  function pieceMap(cv, c, D, k) {
    const m = c.full, st = SK.stageOf(m), x = cv.getContext('2d'), A = SK.MODEL.A;
    cv.width = 720; cv.height = Math.round(720 * st.h / st.w); x.setTransform(cv.width / st.w, 0, 0, cv.height / st.h, 0, 0);
    paintModelBg(x, m, c.bg, c.im, st.w, st.h);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3;
    m.pieces.forEach(p => { // every answer spot, so a mix-up is easy to read: this piece's in green, the others faint
      const me = p.id === k.id; x.setLineDash([10, 7]); x.strokeStyle = me ? '#0E7C4A' : '#94A3B8'; x.fillStyle = me ? 'rgba(14,124,74,.14)' : 'rgba(148,163,184,.10)';
      const zr = me ? SK.tolOf(m, p) : A / 2; x.beginPath(); x.arc(p.kx, p.ky, zr, 0, 7); x.fill(); x.stroke(); x.setLineDash([]);
      x.font = (me ? '800 ' : '700 ') + '26px ' + FONT; x.fillStyle = me ? '#0A5A36' : '#64748B'; x.fillText(p.label, p.kx, p.ky + zr + 18);
    });
    D.started.forEach(s => { const q = s.pl[k.id]; if (!q) return; const ok = s.g.ok[k.id]; x.beginPath(); x.arc(q.x, q.y, 13, 0, 7); x.fillStyle = ok ? 'rgba(14,124,74,.9)' : s.mix[k.id] === SK.TURN ? 'rgba(217,119,6,.95)' : 'rgba(179,38,30,.9)'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); });
  }

  function detail(c, D, pcs) {
    const card = el('div', { className: 'card spad' });
    const sel = ST.sel || (pcs.length ? { k: 'p', id: pcs[0].id } : null);
    if (!sel) return card;
    if (sel.k === 'p') {
      const k = D.stat.find(x => x.id === sel.id); if (!k) return card;
      const missed = D.started.filter(s => s.pl[k.id] && !s.g.ok[k.id]).sort((a, b) => a.g.right - b.g.right);
      const left = el('div', {}, T('span', 'pill', 'Piece' + (k.idea ? ' · ' + k.idea : '')), T('div', 'cq', '“' + k.label + '”'), T('span', 'pill', k.n ? k.right + ' of ' + k.n + ' got it (' + k.pct + '%)' : 'No answers yet'));
      const mapBox = el('div', {}, T('h3', '', 'Where students put it'));
      const cv = el('canvas', { style: 'width:100%;max-width:560px;border-radius:var(--r-md);display:block' }); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Board showing where each student put ' + k.label + '. Green dots are in the right place, red dots are not.');
      mapBox.append(cv, T('div', 'mut', 'Green ring: the answer spot and how close counts. Green dots are right, red dots are not' + (k.turned ? ', orange dots are in the right place but turned the wrong way.' : '.')));
      if (k.turned) mapBox.append(T('div', 'mut', 'Right place, turned the wrong way: ' + k.turned));
      const swaps = Object.entries(k.swaps).sort((a, b) => b[1] - a[1]);
      if (swaps.length) mapBox.append(T('div', 'mut', 'Put on another piece’s spot: ' + swaps.map(([id, n]) => nameOf(D, +id) + ' (' + n + ')').join(', ')));
      const who = el('div', {}, T('h3', '', 'Missed it (' + missed.length + ')'));
      if (!missed.length) who.append(T('span', 'mut', k.n ? 'Nobody. Move on.' : 'Waiting for answers.'));
      missed.forEach(s => who.append(el('button', { className: 'pill bad', textContent: s.name, onclick: () => { ST.sel = { k: 's', id: s.id }; render(); } })));
      if (missed.length) {
        const msg = T('span', 'mut', ''), b = el('button', { className: 'b pri', textContent: 'Copy names for a small group' });
        b.onclick = () => navigator.clipboard.writeText(missed.map(s => s.name).join(', ')).then(() => (msg.textContent = 'Copied'), () => (msg.textContent = missed.map(s => s.name).join(', ')));
        who.append(el('div', { className: 'row', style: 'margin-top:8px' }, b, msg));
      }
      const grid = el('div', { className: 'dgrid' }, left, mapBox, who); grid.style.gridTemplateColumns = 'minmax(130px,.8fr) minmax(260px,2fr) minmax(210px,1fr)'; card.append(grid);
      pieceMap(cv, c, D, k);
    } else {
      const s = D.all.find(x => x.id === sel.id); if (!s) return card;
      const wrong = D.pieces.filter(k => s.pl[k.id] && !s.g.ok[k.id]), by = {};
      wrong.forEach(k => { if (k.idea) by[k.idea] = (by[k.idea] || 0) + 1; });
      const weak = Object.keys(by).filter(i => by[i] >= 2);
      const head = el('div', {});
      if (s.team) { const t = T('span', 'pill', (s.team.emoji ? s.team.emoji + ' ' : '') + s.team.name); t.style.background = s.team.color; t.style.color = '#fff'; head.append(t); }
      head.append(T('div', 'cq', s.name), T('span', 'pill ' + (s.g.put && !wrong.length && s.g.put === D.pieces.length ? 'good' : ''), s.g.put ? s.g.right + ' of ' + D.pieces.length + ' right' : 'Has not started'));
      if (weak.length) head.append(T('span', 'pill bad', 'Trouble with: ' + weak.join(', ')));
      wrong.forEach(k => head.append(T('div', 'mut', k.label + ' → ' + mixWords(D, s, k))));
      const acts = el('div', { className: 'row', style: 'margin-top:8px' });
      acts.append(el('button', { className: 'b', textContent: c.spotId === s.id ? 'Stop showing' : 'Show on projector', onclick: () => c.spot(s) }));
      if (c.award && s.team) acts.append(el('button', { className: 'b' + (s.aw ? ' good' : ''), onclick: () => c.award(s) }, icoEl('check', 'sm'), s.aw ? ' Point given (undo)' : ' +1 for ' + s.team.name));
      head.append(acts);
      const cv = el('canvas', { width: 800, height: 500, style: 'width:100%;max-width:640px;border-radius:var(--r-md);display:block' }); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', s.name + '’s board');
      const where = {}; wrong.forEach(k => { where[k.id] = { x: k.kx, y: k.ky }; });
      card.append(el('div', { className: 'dgrid stu' }, head, el('div', {}, cv)));
      paintBoard(cv, s.objs || [], c.bg, c.im, s.bw || 800, s.bh || 500, { model: c.q.model, pl: s.pl, ok: s.g.ok, where, whereLabels: false });
    }
    return card;
  }

  function exportCSV(c, D) {
    const head = ['Student', 'Team', 'Right', 'Out of'].concat(D.pieces.map(k => k.label));
    const rows = [head].concat(orderStudents(D).map(s => [s.name, s.team ? s.team.name : '', s.g.right, D.pieces.length].concat(D.pieces.map(k => !s.pl[k.id] ? '' : s.g.ok[k.id] ? '✓' : s.mix[k.id] === SK.TURN ? 'turned' : s.mix[k.id] != null ? 'on ' + nameOf(D, s.mix[k.id]) : 'wrong'))));
    const a = el('a', { href: URL.createObjectURL(new Blob([SK.csv(rows)], { type: 'text/csv' })), download: 'pieces-results.csv' }); a.click();
    c.toast('Saved. Student names are in this file, so keep it private.');
  }

  // phone layout (Review tab): the numbers a teacher needs while walking the room
  function phone(wrap, c) {
    if (!c.sk || !c.full) return wrap.append(T('div', 'mut', 'The answer key for this question is not on this device. Send the question again.'));
    const D = SK.modelStats(c.full, c.students), n = D.pieces.length, pad = el('div', { className: 'ph-pad' });
    const avg = D.started.length ? D.started.reduce((a, s) => a + s.g.right, 0) / D.started.length : 0;
    pad.append(el('div', { className: 'card', style: 'padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px' },
      el('div', {}, T('div', 'lbl', 'Class average'), T('div', '', D.started.length ? avg.toFixed(1) + ' / ' + n : '–')),
      el('div', { style: 'text-align:right' }, T('div', 'lbl', 'Moved every piece'), T('div', '', D.started.filter(s => s.g.put === n).length + ' of ' + D.all.length))));
    pad.lastChild.querySelectorAll('div > div:last-child').forEach(d => { d.style.cssText = 'font-family:var(--disp);font-weight:800;font-size:var(--fs-3xl)'; });
    if (D.ideas.length) {
      pad.append(T('div', 'lbl', 'Ideas'));
      D.ideas.forEach(d => { const t = d.pct == null ? 'mid' : SK.tier(d.pct), bar = T('span', 'bar1'); bar.append(el('i', { className: 'f-' + t, style: 'width:' + (d.pct || 0) + '%' })); pad.append(el('div', { className: 'ph-row', style: 'flex-direction:column;align-items:stretch;gap:6px' }, el('div', { style: 'display:flex;justify-content:space-between;gap:8px' }, T('b', '', d.name), T('span', 'band b-' + t, d.pct == null ? '–' : d.pct + '% · ' + SK.tierWord(d.pct))), bar)); });
    }
    pad.append(T('div', 'lbl', 'Pieces to reteach first'));
    orderPieces(D).slice(0, 5).forEach(k => {
      const missed = D.started.filter(s => s.pl[k.id] && !s.g.ok[k.id]), t = k.pct == null ? 'mid' : SK.tier(k.pct);
      const d = el('details', { className: 'ph-row', style: 'display:block;padding:10px 12px' });
      d.open = ST.open.has(k.id); d.ontoggle = () => { d.open ? ST.open.add(k.id) : ST.open.delete(k.id); };
      d.append(el('summary', { style: 'display:flex;gap:10px;align-items:center;cursor:pointer' }, T('span', 'band b-' + t, k.pct == null ? '–' : k.pct + '%'), T('span', '', k.label), T('span', 'mut', k.n ? '· ' + missed.length + ' missed' : '')));
      d.append(el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px' }, ...missed.map(s => T('span', 'pill bad', s.name + (s.mix[k.id] === SK.TURN ? ' → turned' : s.mix[k.id] != null ? ' → ' + nameOf(D, s.mix[k.id]) + '’s spot' : '')))));
      pad.append(d);
    });
    const low = D.started.filter(s => s.g.right <= Math.floor(n / 2)).sort((a, b) => a.g.right - b.g.right);
    if (low.length) { pad.append(T('div', 'lbl', 'Need a small group')); pad.append(el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, ...low.map(s => T('span', 'pill bad', s.name + ' ' + s.g.right + '/' + n)))); }
    wrap.append(pad);
  }

  return {
    mount(b, g) { box = b; get = g; },
    phone,
    // many placements can arrive at once; redraw at most every 250ms
    update() { if (!box || timer) return; timer = setTimeout(() => { timer = 0; render(); }, 250); },
    now() { clearTimeout(timer); timer = 0; render(); },
    reset() { ST.sel = null; ST.idea = null; }
  };
})();
