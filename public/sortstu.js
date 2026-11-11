// The student side of sort questions (index.html). Needs common.js and sortkit.js.
// The student's whole answer is one small map { cardId: laneId }; the server keeps it and checks it against the key.
// Drag a sticky note into a lane, or tap a note and then tap a lane (easier on a trackpad or a small screen).
const SS = (() => {
  let q = null, map = {}, done = false, fb = null, sel = null, seed = '', send = () => {};
  const active = () => !!q && q.kind === 'sort';
  const $v = () => $('#sortview');
  const laneName = id => (q.sort.lanes.find(l => l.id === id) || {}).name || '';
  let refocus = null; // after a keyboard move, put focus back where the student expects it (render() rebuilds the page)
  const blocked = () => document.body.classList.contains('frozen') || $('#sstage').matches('.locked .lockable');
  const live = msg => { const l = $('#sortlive'); if (!l) return; l.textContent = ''; setTimeout(() => (l.textContent = msg), 30); };
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // the question box floats at the top and grows with the question: keep the sort area just below it
  function layout() { if (active()) $v().style.top = Math.round($('#qbox').getBoundingClientRect().bottom + 10) + 'px'; }

  function note(c, extra) {
    const cls = [extra, sel === c.id ? 'sel' : '', fb && c.id in fb.ok ? (fb.ok[c.id] ? 'right' : 'wrong') : ''].filter(Boolean).join(' ');
    const n = SK.note(c, cls);
    if (fb && fb.where && fb.where[c.id]) n.append(mk('span', 'where', 'Goes in ' + laneName(fb.where[c.id])));
    if (!done) { // reachable and operable by keyboard or screen reader: Enter or Space picks the card up
      n.tabIndex = 0; n.setAttribute('role', 'button'); n.setAttribute('aria-pressed', String(sel === c.id));
      n.setAttribute('aria-label', c.text + '. ' + (map[c.id] ? 'In ' + laneName(map[c.id]) + '.' : 'Not placed yet.') + (sel === c.id ? ' Picked up. Choose a lane, or press 1 to ' + q.sort.lanes.length + '.' : ' Press Enter to pick it up.'));
    }
    return n;
  }
  // a lane (or the pile) header doubles as the place to drop the picked-up card when using the keyboard
  function target(h, name) {
    if (done) return h;
    h.tabIndex = 0; h.setAttribute('role', 'button'); h.setAttribute('aria-disabled', String(!sel));
    h.setAttribute('aria-label', sel ? 'Put the picked-up card in ' + name : name + '. Pick up a card first.');
    return h;
  }
  function render() {
    if (!active()) return;
    // render() rebuilds the page (a message from the server does this too), so remember what had focus and put it back
    const f = document.activeElement, keep = f && $v().contains(f) ? (f.dataset.card ? { card: f.dataset.card } : f.matches('[role=button]') && f.parentElement.dataset.zone ? { zone: f.parentElement.dataset.zone } : f.closest('#sdone') ? { done: true } : null) : null;
    const s = q.sort, ord = SK.order(s.cards, seed, s.shuffle);
    const st = $('#sstage'); st.textContent = ''; st.style.gridTemplateColumns = 'repeat(' + s.lanes.length + ',minmax(0,1fr))';
    s.lanes.forEach(l => {
      const d = mk('div', 'slane'); d.dataset.zone = l.id; d.append(target(mk('h3', '', l.name + ' · ' + ord.filter(c => map[c.id] === l.id).length), l.name));
      ord.filter(c => map[c.id] === l.id).forEach(c => d.append(note(c)));
      st.append(d);
    });
    const un = ord.filter(c => !map[c.id]), pile = $('#spile'); pile.textContent = '';
    pile.append(target(mk('h4', '', done ? 'Cards' : 'Cards to sort (' + un.length + ')'), 'the pile'));
    un.forEach(c => pile.append(note(c)));
    if (!un.length) { const e = mk('div', 'sempty', done ? 'Your answer was sent.' : 'All cards are placed. Check your work. Then press “I’m done”.'); if (!done) e.prepend(icoEl('check', 'sm'), ' '); pile.append(e); }
    const n = s.cards.length, placed = n - un.length, right = fb ? s.cards.filter(c => fb.ok[c.id]).length : 0;
    const dn = $('#sdone'); dn.textContent = '';
    dn.append(mk('b', '', placed + ' of ' + n + ' placed'));
    const sn = $('#sortscore'); if (sn) { sn.hidden = !(fb && placed === n); sn.textContent = 'You got ' + right + ' of ' + n; } // the score sits in the question bar
    const b = mk('button', 'btn', done ? 'Done' : 'I’m done'); if (done) b.append(' ', icoEl('check', 'sm')); b.disabled = done || placed < n; b.onclick = () => { done = true; send({ t: 'sort', p: map, done: true }); sel = null; render(); };
    dn.append(b);
    $('#smsg').hidden = !(done && !fb);
    $v().classList.toggle('allplaced', !un.length && !done); // the tray shrinks and I’m done becomes the one large button
    $v().classList.toggle('sdone', done); $('#spile').classList.toggle('lockable', true);
    const r = refocus || keep; refocus = null;
    if (r) {
      let t = null;
      if (r.card) t = $v().querySelector('.nc[data-card="' + r.card + '"]');
      else if (r.done) t = $v().querySelector('#sdone button');
      else if (r.zone) t = $v().querySelector('[data-zone="' + r.zone + '"] > [role=button]');
      else if (r.first) t = $v().querySelector('#spile .nc[data-card]') || $v().querySelector('#sdone button:not(:disabled)');
      if (t) t.focus();
    }
  }
  function place(id, zone) {
    if (!active() || done || !q.sort.cards.some(c => c.id === id)) return;
    if (zone === 'pile') delete map[id]; else if (q.sort.lanes.some(l => l.id === zone)) map[id] = zone; else return;
    const cd = q.sort.cards.find(c => c.id === id), left = q.sort.cards.length - Object.keys(map).length;
    sel = null; render(); send({ t: 'sort', p: map });
    live('Placed ' + cd.text + (zone === 'pile' ? ' back in the pile' : ' in ' + laneName(zone)) + '. ' + (left ? left + ' left to sort.' : 'All cards placed. Press I’m done when you are ready.'));
  }
  function show(nq) {
    q = nq; const on = active();
    document.body.classList.toggle('sorting', on); $v().hidden = !on;
    if (on) { render(); layout(); }
  }

  const root = $v();
  SK.drag(root, place);
  function pick(id, kb) {
    sel = sel === id ? null : id; if (kb) refocus = { card: id }; render();
    const c = q.sort.cards.find(x => x.id === id);
    if (kb) live(sel ? 'Picked up ' + c.text + '. Choose a lane, or press 1 to ' + q.sort.lanes.length + '.' : 'Put ' + c.text + ' down.');
  }
  root.addEventListener('keydown', e => { // Enter or Space: pick a card up, then Enter on a lane to put it there. Escape puts it down.
    if (!active() || done || blocked()) return;
    if (e.key === 'Escape' && sel) { e.preventDefault(); const id = sel; sel = null; refocus = { card: id }; render(); live('Put the card down.'); return; }
    if (sel && /^[0-9]$/.test(e.key)) { // shortcut: with a card picked up, 1, 2, 3... sends it to that lane and 0 back to the pile
      const k = +e.key, lane = k === 0 ? 'pile' : (q.sort.lanes[k - 1] || {}).id;
      if (lane) { e.preventDefault(); refocus = { first: true }; place(sel, lane); }
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const n = e.target.closest('.nc[data-card]');
    if (n && e.target === n) { e.preventDefault(); return pick(+n.dataset.card, true); }
    const h = e.target.closest('h3[role=button],h4[role=button]'), z = h && h.parentElement.closest('[data-zone]');
    if (z) { e.preventDefault(); if (sel) { refocus = { first: true }; place(sel, z.dataset.zone); } else live('Pick up a card first.'); }
  });
  root.addEventListener('click', e => { // tap a note, then tap a lane (or the pile)
    if (!active() || done) return;
    const n = e.target.closest('.nc[data-card]');
    if (n) return pick(+n.dataset.card);
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
