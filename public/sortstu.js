// The student side of sort questions (index.html). Needs common.js and sortkit.js.
// The student's whole answer is one small map { cardId: laneId }; the server keeps it and checks it against the key.
// Drag a sticky note into a lane, or tap a note and then tap a lane (easier on a trackpad or a small screen).
const SS = (() => {
  let q = null, map = {}, done = false, fb = null, sel = null, seed = '', send = () => {};
  const active = () => !!q && q.kind === 'sort';
  const $v = () => $('#sortview');
  const laneName = id => (q.sort.lanes.find(l => l.id === id) || {}).name || '';
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // the question box floats at the top and grows with the question: keep the sort area just below it
  function layout() { if (active()) $v().style.top = Math.round($('#qbox').getBoundingClientRect().bottom + 10) + 'px'; }

  function note(c, extra) {
    const cls = [extra, sel === c.id ? 'sel' : '', fb && c.id in fb.ok ? (fb.ok[c.id] ? 'right' : 'wrong') : ''].filter(Boolean).join(' ');
    const n = SK.note(c, cls);
    if (fb && fb.where && fb.where[c.id]) n.append(mk('span', 'where', 'Belongs in ' + laneName(fb.where[c.id])));
    return n;
  }
  function render() {
    if (!active()) return;
    const s = q.sort, ord = SK.order(s.cards, seed, s.shuffle);
    const st = $('#sstage'); st.textContent = ''; st.style.gridTemplateColumns = 'repeat(' + s.lanes.length + ',minmax(0,1fr))';
    s.lanes.forEach(l => {
      const d = mk('div', 'slane'); d.dataset.zone = l.id; d.append(mk('h3', '', l.name));
      ord.filter(c => map[c.id] === l.id).forEach(c => d.append(note(c)));
      st.append(d);
    });
    const un = ord.filter(c => !map[c.id]), pile = $('#spile'); pile.textContent = '';
    pile.append(mk('h4', '', done ? 'Cards' : 'Cards to sort (' + un.length + ')'));
    un.forEach(c => pile.append(note(c)));
    if (!un.length) pile.append(mk('div', 'sempty', done ? 'Your answer is in.' : '✓ Every card is placed. Check your work, then press “I’m done”.'));
    const n = s.cards.length, placed = n - un.length, right = fb ? s.cards.filter(c => fb.ok[c.id]).length : 0;
    const dn = $('#sdone'); dn.textContent = '';
    dn.append(mk('b', '', fb && placed === n ? 'You got ' + right + ' of ' + n + ' right' : placed + ' of ' + n + ' placed'));
    const b = mk('button', 'btn', done ? 'Done ✓' : 'I’m done'); b.disabled = done || placed < n; b.onclick = () => { done = true; send({ t: 'sort', p: map, done: true }); sel = null; render(); };
    dn.append(b);
    $('#smsg').hidden = !(done && !fb);
    $v().classList.toggle('sdone', done); $('#spile').classList.toggle('lockable', true);
  }
  function place(id, zone) {
    if (!active() || done || !q.sort.cards.some(c => c.id === id)) return;
    if (zone === 'pile') delete map[id]; else if (q.sort.lanes.some(l => l.id === zone)) map[id] = zone; else return;
    sel = null; render(); send({ t: 'sort', p: map });
  }
  function show(nq) {
    q = nq; const on = active();
    document.body.classList.toggle('sorting', on); $v().hidden = !on;
    if (on) { render(); layout(); }
  }

  const root = $v();
  SK.drag(root, place);
  root.addEventListener('click', e => { // tap a note, then tap a lane (or the pile)
    if (!active() || done) return;
    const n = e.target.closest('.nc[data-card]');
    if (n) { sel = sel === +n.dataset.card ? null : +n.dataset.card; return render(); }
    const z = e.target.closest('[data-zone]');
    if (z && sel) place(sel, z.dataset.zone);
  });
  addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe($('#qbox'));
  $('#qt').addEventListener('click', () => setTimeout(layout, 0));

  return {
    init(fn) { send = fn; },
    active,
    show,
    // a new question: every student starts with an empty answer
    newQ(nq) { map = {}; done = false; fb = null; sel = null; show(nq); },
    // joining or rejoining: the server hands back this student's answer, so a refresh loses nothing
    joined(m) { seed = m.id; map = m.sort || {}; done = !!m.done; fb = m.fb ? { ok: m.fb.ok, where: m.fb.where } : null; sel = null; show(m.q); },
    // returns true when the message was about sorting
    msg(m) {
      if (m.t === 'sorted') { done = !!m.done; if (done) map = m.p || map; render(); return true; }
      if (m.t === 'fb') { fb = m.off ? null : { ok: m.ok || {}, where: m.where || {} }; render(); return true; }
      return false;
    }
  };
})();
