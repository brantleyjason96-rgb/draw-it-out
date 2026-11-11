// The sort-question part of the set editor (/sets). Needs common.js, sortkit.js and tcommon.js (for el()).
// SE.mount({...}) wires the editor fields (lanes, cards, ideas, options) and the answer key board to one draft object:
//   { lanes:[{id,name}], ideas:[name], cards:[{id,text,idea,lane}], shuffle, fb }
// ctx: get() -> draft, changed() -> call after any edit (marks the question unsaved), issues(list) -> called with what still needs fixing,
//      el: { lanes, cards, ideas, opts, key, stu } -> containers on the page, question() -> current question html for the preview
const SE = (() => {
  let c = null, view = 'key', ln = 1;
  const D = () => c.get();
  const laneId = () => { const ids = new Set(D().lanes.map(l => l.id)); let id; do id = 'L' + ln++; while (ids.has(id)); return id; };
  const cardId = () => D().cards.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  const laneOf = id => D().lanes.find(l => l.id === id);
  const blank = () => ({ lanes: [{ id: 'L1', name: '' }, { id: 'L2', name: '' }], ideas: [], cards: [], shuffle: true, fb: 'reveal' });

  function touch(full) { c.changed(); renderBoard(); renderStu(); report(); if (full) renderLists(); }
  function report() { c.issues(SK.issues(D())); }

  function row(...kids) { return el('div', { className: 'srow' }, ...kids); }
  function renderLists() {
    const d = D(), E = c.el;
    // lanes
    E.lanes.textContent = '';
    d.lanes.forEach((l, i) => {
      const inp = el('input', { className: 'inp', value: l.name, maxLength: 24, placeholder: 'Lane ' + (i + 1) + ' name, like Igneous' }); inp.setAttribute('aria-label', 'Lane ' + (i + 1) + ' name');
      inp.oninput = () => { l.name = inp.value; touch(); };
      const x = el('button', { className: 'b sq danger', title: 'Remove lane', disabled: d.lanes.length <= 2 }, icoEl('x')); x.setAttribute('aria-label', 'Remove lane ' + (i + 1));
      x.onclick = () => { d.lanes.splice(i, 1); d.cards.forEach(k => { if (k.lane === l.id) k.lane = null; }); touch(true); };
      E.lanes.append(row(inp, x));
    });
    const al = el('button', { className: 'b sm', textContent: '+ Add lane', disabled: d.lanes.length >= SK.LANES, onclick: () => { d.lanes.push({ id: laneId(), name: '' }); touch(true); const i = E.lanes.querySelectorAll('input'); i[i.length - 1].focus(); } });
    E.lanes.append(al);
    // cards
    E.cards.textContent = '';
    d.cards.forEach((k, i) => {
      const inp = el('input', { className: 'inp', value: k.text, maxLength: 60, placeholder: 'Card text' }); inp.setAttribute('aria-label', 'Card ' + (i + 1) + ' text');
      inp.oninput = () => { k.text = inp.value; touch(); };
      const sel = el('select', { className: 'inp', style: 'flex:none;width:130px;font-size:var(--fs-sm)' }); sel.setAttribute('aria-label', 'Idea for card ' + (i + 1));
      [['', 'No idea'], ...d.ideas.map(x => [x, x])].forEach(([v, t]) => sel.append(el('option', { value: v, textContent: t }))); sel.value = d.ideas.includes(k.idea) ? k.idea : '';
      sel.onchange = () => { k.idea = sel.value; touch(); };
      const x = el('button', { className: 'b sq danger', title: 'Remove card' }, icoEl('x')); x.setAttribute('aria-label', 'Remove card ' + (i + 1));
      x.onclick = () => { d.cards.splice(i, 1); touch(true); };
      E.cards.append(row(inp, sel, x));
    });
    E.cards.append(el('button', { className: 'b sm', textContent: '+ Add card', disabled: d.cards.length >= SK.CARDS, onclick: () => { d.cards.push({ id: cardId(), text: '', idea: '', lane: null }); touch(true); const i = E.cards.querySelectorAll('input'); i[i.length - 1].focus(); } }));
    // ideas
    E.ideas.textContent = '';
    const chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    d.ideas.forEach((n, i) => {
      const x = el('button', { title: 'Remove idea' }, icoEl('x')); x.setAttribute('aria-label', 'Remove idea ' + n);
      x.onclick = () => { d.ideas.splice(i, 1); d.cards.forEach(k => { if (k.idea === n) k.idea = ''; }); touch(true); };
      chips.append(el('span', { className: 'ichip' }, document.createTextNode(n), x));
    });
    if (!d.ideas.length) chips.append(el('span', { className: 'mut', textContent: 'No ideas yet. Add one, like “Vocabulary”, then tag cards with it.', style: 'font-size:var(--fs-sm)' }));
    const ni = el('input', { className: 'inp', maxLength: 30, placeholder: 'New idea' }); ni.setAttribute('aria-label', 'New idea name');
    const add = () => { const v = SK.str(ni.value, 30); if (!v || d.ideas.includes(v) || d.ideas.length >= 8) return; d.ideas.push(v); touch(true); const f = E.ideas.querySelector('input'); if (f) f.focus(); };
    ni.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    E.ideas.append(chips, row(ni, el('button', { className: 'b sm', textContent: 'Add', onclick: add })));
    // options
    E.opts.textContent = '';
    const tg = el('button', { className: 'tog' + (d.shuffle ? ' on' : ''), type: 'button', style: 'width:100%;justify-content:space-between' }); tg.setAttribute('aria-pressed', d.shuffle);
    tg.append(el('span', { textContent: 'Shuffle the cards for each student' }), document.createElement('i'));
    tg.onclick = () => { d.shuffle = !d.shuffle; touch(true); };
    const fb = el('select', { className: 'inp' }); fb.setAttribute('aria-label', 'When students see if they are right');
    [['reveal', 'Only when I press Reveal answers'], ['now', 'Right away, as they place each card']].forEach(([v, t]) => fb.append(el('option', { value: v, textContent: t }))); fb.value = d.fb;
    fb.onchange = () => { d.fb = fb.value; touch(); };
    E.opts.append(tg, el('div', { className: 'mut', textContent: 'Show students if they are right', style: 'font-size:var(--fs-sm);margin-top:2px' }), fb);
  }

  // answer key board: drag each sticky note into the lane where it belongs
  function renderBoard() {
    const d = D(), box = c.el.key; box.textContent = '';
    const un = d.cards.filter(k => !k.lane || !laneOf(k.lane));
    const mk = (k) => { const n = SK.note({ id: k.id, text: k.text || '(empty card)' }); if (k.idea) n.append(el('small', { textContent: k.idea })); return n; };
    if (!d.cards.length) box.append(el('div', { className: 'mut', textContent: 'Add cards on the left. They appear here, and you drag each one into the lane where it belongs.', style: 'padding:6px 2px' }));
    if (un.length) { const t = el('div', { className: 'zone tray' }); t.dataset.zone = 'none'; t.append(el('h3', {}, document.createTextNode('Not in the key yet'), el('span', { textContent: un.length }))); un.forEach(k => t.append(mk(k))); box.append(t); }
    const b = el('div', { className: 'board' }); b.style.gridTemplateColumns = 'repeat(' + Math.max(1, d.lanes.length) + ',minmax(0,1fr))';
    d.lanes.forEach(l => {
      const z = el('div', { className: 'zone' }); z.dataset.zone = l.id;
      const cs = d.cards.filter(k => k.lane === l.id);
      z.append(el('h3', {}, document.createTextNode(l.name || '(unnamed)'), el('span', { textContent: cs.length }))); cs.forEach(k => z.append(mk(k))); b.append(z);
    });
    box.append(b);
  }
  // what a student will see (cards in a shuffled pile, lanes empty)
  function renderStu() {
    const d = D(), box = c.el.stu; box.textContent = '';
    const dev = el('div', { className: 'dev' }), qb = el('div', { className: 'qb' }); qb.innerHTML = c.question() || '<span style="opacity:.6">Your question appears here…</span>';
    const lanes = el('div', { className: 'slanes' }); lanes.style.gridTemplateColumns = 'repeat(' + Math.max(1, d.lanes.length) + ',minmax(0,1fr))';
    d.lanes.forEach(l => lanes.append(el('div', { className: 'slane' }, el('h3', { textContent: l.name || '…' }))));
    const pile = el('div', { className: 'spile' });
    SK.order(d.cards, 'preview', d.shuffle).forEach(k => pile.append(SK.note({ id: k.id, text: k.text || '(empty card)' }, 'still')));
    dev.append(qb, lanes, pile, el('div', { className: 'dock' }, el('span', { textContent: '0 of ' + d.cards.length + ' placed' }), el('span', { textContent: d.shuffle ? 'Cards are shuffled for each student' : 'Cards stay in this order' })));
    box.append(dev, el('div', { className: 'mut', textContent: 'The answer key and the ideas are never sent to students.', style: 'font-size:var(--fs-md);margin-top:10px' }));
  }
  function setView(v) {
    view = v; c.el.key.hidden = v !== 'key'; c.el.stu.hidden = v !== 'stu';
    c.el.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    if (v === 'stu') renderStu();
  }

  return {
    blank,
    mount(ctx) {
      c = ctx;
      SK.drag(c.el.key, (id, zone) => { const k = D().cards.find(x => x.id === id); if (!k) return; k.lane = zone === 'none' ? null : zone; touch(); });
      c.el.tabs.querySelectorAll('button').forEach(b => (b.onclick = () => setView(b.dataset.v)));
    },
    // call whenever the draft object is replaced (another question picked) or the question text changes
    render() { renderLists(); renderBoard(); renderStu(); report(); },
    preview() { renderStu(); },
    view: setView
  };
})();
