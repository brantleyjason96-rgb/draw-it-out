// Results for a sort question on the class screen: who got which card, which ideas need reteaching, how each team did.
// Needs common.js, sortkit.js and tcommon.js (for el()). SR.mount(box, get) then SR.update() whenever anything changes.
//   get() -> { q, sk, students:[{id,name,team:{id,name,emoji,color}|null,sort:{cardId:laneId},done,aw}], award(s), spot(s), reopen(s), spotId, projSum, setProjSum(on), toast(m) }
// sk is the answer key the server sends to teachers only: { lane:{cardId:laneId}, idea:{cardId:ideaName} }.
const SR = (() => {
  const ST = { stu: 'need', card: 'hard', idea: null, sel: null, open: new Set() };
  let box = null, get = null, timer = 0;
  const T = (tag, cls, text) => el(tag, { className: cls || '', textContent: text == null ? '' : text });
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  function compute(c) {
    const sq = c.q.sort, cards = sq.cards, lanes = sq.lanes, laneName = id => (lanes.find(l => l.id === id) || {}).name || '';
    const all = c.students.map(s => ({ ...s, g: SK.grade(c.sk, cards, s.sort) }));
    const started = all.filter(s => s.g.put > 0), waiting = all.filter(s => !s.g.put);
    const stat = cards.map(k => {
      const ans = started.filter(s => s.sort[k.id]), right = ans.filter(s => s.sort[k.id] === c.sk.lane[k.id]).length;
      const dist = {}; lanes.forEach(l => (dist[l.id] = 0)); ans.forEach(s => dist[s.sort[k.id]]++);
      return { ...k, idea: c.sk.idea[k.id] || '', lane: c.sk.lane[k.id], n: ans.length, right, pct: ans.length ? Math.round(100 * right / ans.length) : null, dist };
    });
    const names = [...new Set(stat.map(k => k.idea).filter(Boolean))];
    const ideas = names.map(n => { const ks = stat.filter(k => k.idea === n && k.pct != null); return { name: n, cards: stat.filter(k => k.idea === n).length, pct: ks.length ? Math.round(ks.reduce((a, k) => a + k.pct, 0) / ks.length) : null }; });
    const teams = [], seen = new Map();
    started.forEach(s => { if (!s.team) return; let t = seen.get(s.team.id); if (!t) seen.set(s.team.id, (t = { team: s.team, right: 0, put: 0, n: 0 })); t.right += s.g.right; t.put += s.g.total; t.n++; });
    seen.forEach(t => teams.push({ ...t, pct: Math.round(100 * t.right / t.put) }));
    let worst = null; stat.forEach(k => lanes.forEach(l => { if (l.id !== k.lane && k.dist[l.id] && (!worst || k.dist[l.id] > worst.n)) worst = { k, lane: l.id, n: k.dist[l.id] }; }));
    return { cards, lanes, laneName, all, started, waiting, stat, ideas, teams, worst, finished: all.filter(s => s.done).length };
  }

  const orderStudents = (D) => {
    const a = D.started.slice(), az = (x, y) => x.name.localeCompare(y.name);
    if (ST.stu === 'need') a.sort((x, y) => x.g.right - y.g.right || az(x, y));
    else if (ST.stu === 'top') a.sort((x, y) => y.g.right - x.g.right || az(x, y));
    else if (ST.stu === 'team') a.sort((x, y) => (x.team ? x.team.name : '~').localeCompare(y.team ? y.team.name : '~') || az(x, y));
    else a.sort(az);
    return a.concat(D.waiting.slice().sort(az));
  };
  const orderCards = D => { const a = D.stat.slice(); if (ST.card === 'hard') a.sort((x, y) => (x.pct == null) - (y.pct == null) || x.pct - y.pct || x.id - y.id); return a; };

  function render() {
    if (!box || !get) return;
    const c = get(); box.textContent = '';
    if (!c.sk) return box.append(T('div', 'mut', 'The answer key for this question is not on this device. Send the question again from your question set.'));
    const D = compute(c);
    if (!D.all.length) return box.append(T('div', 'empty', 'No students yet. Results appear here as students place their cards.'));

    // controls
    const sSel = el('select', { className: 'inp' }), cSel = el('select', { className: 'inp' });
    sSel.setAttribute('aria-label', 'Sort students'); cSel.setAttribute('aria-label', 'Sort cards');
    [['need', 'Needs help first'], ['top', 'Top scores first'], ['az', 'A to Z'], ['team', 'By team']].forEach(([v, t]) => sSel.append(el('option', { value: v, textContent: t }))); sSel.value = ST.stu;
    [['hard', 'Hardest first'], ['set', 'Question set order']].forEach(([v, t]) => cSel.append(el('option', { value: v, textContent: t }))); cSel.value = ST.card;
    sSel.onchange = () => { ST.stu = sSel.value; render(); }; cSel.onchange = () => { ST.card = cSel.value; render(); };
    const proj = el('button', { className: 'tog blue' + (c.projSum ? ' on' : ''), onclick: () => c.setProjSum(!c.projSum) }, el('span', { textContent: 'Results on projector' }), document.createElement('i'));
    const csv = el('button', { className: 'b', textContent: 'Save results (CSV)', onclick: () => exportCSV(c, D) });
    box.append(el('div', { className: 'sctl' }, el('div', { className: 'row' }, T('span', 'lbl', 'Students'), sSel, T('span', 'lbl', 'Cards'), cSel), el('div', { className: 'row' }, csv, proj)));

    // summary numbers
    const avg = D.started.length ? D.started.reduce((a, s) => a + s.g.right, 0) / D.started.length : 0, n = D.cards.length;
    const low = D.started.filter(s => s.g.right <= Math.floor(n / 2)).length, perfect = D.started.filter(s => s.g.right === n).length;
    const stat = (k, v, s, big) => el('div', { className: 'card sstat' }, T('span', 'lbl', k), T('span', big ? 'v sm' : 'v', v), T('span', 's', s));
    box.append(el('div', { className: 'sstats' },
      stat('Class average', avg.toFixed(1) + ' / ' + n, D.started.length ? Math.round(100 * avg / n) + '% of cards in the right lane' : 'Waiting for answers'),
      stat('Finished', D.finished + ' of ' + D.all.length, plural(D.started.length - D.finished, 'student') + ' still working'),
      stat('Need a small group', plural(low, 'student'), 'Got half the cards or fewer right'),
      stat('Got every card', plural(perfect, 'student'), 'Possible helpers or an extension group'),
      D.worst ? stat('Biggest mix-up', D.worst.k.text + ' → ' + D.laneName(D.worst.lane), plural(D.worst.n, 'student') + ', instead of ' + D.laneName(D.worst.k.lane), true) : stat('Biggest mix-up', 'None yet', 'Wrong placements show here')));

    // ideas and teams
    const ideaBox = el('div', { className: 'card spad' }, el('div', { className: 'shead' }, T('h2', '', 'Which ideas are working?'), T('span', 'mut', D.ideas.length ? 'Click an idea to highlight its cards below.' : 'Tag cards with ideas in the editor to see this.')));
    D.ideas.forEach(d => {
      const t = d.pct == null ? 'mid' : SK.tier(d.pct), b = el('button', { className: 'idea', onclick: () => { ST.idea = ST.idea === d.name ? null : d.name; render(); } });
      b.setAttribute('aria-pressed', ST.idea === d.name);
      const bar = T('span', 'bar1'); bar.append(el('i', { className: 'f-' + t, style: 'width:' + (d.pct || 0) + '%' }));
      b.append(el('span', {}, T('b', '', d.name), T('small', '', plural(d.cards, 'card'))), bar, T('span', 'pct', d.pct == null ? '–' : d.pct + '%'), T('span', 'band b-' + t, d.pct == null ? 'No data' : SK.tierWord(d.pct)));
      ideaBox.append(b);
    });
    const teamBox = el('div', { className: 'card spad' }, el('div', { className: 'shead' }, T('h2', '', 'By team'), T('span', 'mut', 'Cards in the right lane')));
    if (!D.teams.length) teamBox.append(T('div', 'mut', 'Students are not on teams yet.'));
    D.teams.sort((a, b) => b.pct - a.pct).forEach(t => {
      const r = el('div', { className: 'tm' }); r.style.setProperty('--tc', t.team.color);
      const bar = T('span', 'bar1'); bar.append(el('i', { className: 'f-' + SK.tier(t.pct), style: 'width:' + t.pct + '%' }));
      r.append(T('b', '', (t.team.emoji ? t.team.emoji + ' ' : '') + t.team.name), bar, T('span', 'pct', t.pct + '%')); teamBox.append(r);
    });
    box.append(el('div', { className: 'spair' }, ideaBox, teamBox));

    // heat map
    const cards = orderCards(D), stus = orderStudents(D);
    const tbl = el('table'); const hr = el('tr', {}, el('th', { className: 'sticky corner', textContent: 'Student' }));
    cards.forEach(k => {
      const b = el('button', { onclick: () => { ST.sel = { k: 'c', id: k.id }; render(); } });
      b.setAttribute('aria-label', 'Card ' + k.text + ', ' + (k.pct == null ? 'no answers' : k.pct + ' percent right'));
      b.append(T('span', 'p b-' + (k.pct == null ? 'mid' : SK.tier(k.pct)), k.pct == null ? '–' : k.pct + '%'), T('span', 't', k.text), T('span', 'i', k.idea));
      hr.append(el('th', { className: 'colh' + (ST.idea && ST.idea !== k.idea ? ' dim' : '') + (ST.sel && ST.sel.k === 'c' && ST.sel.id === k.id ? ' sel' : '') }, b));
    });
    tbl.append(el('thead', {}, hr));
    const tb = el('tbody');
    stus.forEach(s => {
      const selS = ST.sel && ST.sel.k === 's' && ST.sel.id === s.id, tr = el('tr', { className: selS ? 'sel' : '' });
      const rb = el('button', { className: 'rowh', onclick: () => { ST.sel = { k: 's', id: s.id }; render(); } });
      rb.style.setProperty('--tc', s.team ? s.team.color : '#e5e7eb');
      rb.append(T('span', '', s.name), T('span', 'sc b-' + (s.g.put ? SK.tier(Math.round(100 * s.g.right / n)) : 'mid'), s.g.put ? s.g.right + '/' + n : 'not started'));
      tr.append(el('th', { className: 'sticky', scope: 'row' }, rb));
      cards.forEach(k => {
        const a = s.sort[k.id], ok = a && a === c.sk.lane[k.id], on = ST.sel && ST.sel.k === 'c' && ST.sel.id === k.id;
        const d = T('div', 'cell ' + (!a ? 'none' : ok ? 'ok' : 'no') + (ST.idea && ST.idea !== k.idea ? ' dim' : ''), !a ? '' : ok ? '✓' : (D.laneName(a)[0] || '?').toUpperCase());
        d.title = s.name + (a ? ' put “' + k.text + '” in ' + D.laneName(a) : ' has not placed “' + k.text + '”');
        tr.append(el('td', { className: on ? 'colsel' : '' }, d));
      });
      tb.append(tr);
    });
    tbl.append(tb);
    const legend = el('div', { className: 'legend' },
      el('span', {}, el('i', { className: 'swc ok', textContent: '✓' }), document.createTextNode('In the right lane')),
      el('span', {}, el('i', { className: 'swc no', textContent: D.laneName(D.lanes[0].id)[0].toUpperCase() }), document.createTextNode('Wrong. The letter is the first letter of the lane the student chose')),
      el('span', {}, T('i', 'swc none', ''), document.createTextNode('Not placed yet')));
    box.append(el('div', { className: 'card spad' }, el('div', { className: 'shead' }, T('h2', '', 'Who got which card'), T('span', 'mut', (ST.stu === 'need' ? 'Students who need help are at the top. ' : '') + (ST.card === 'hard' ? 'Hardest cards are on the left. ' : '') + 'The stripe is the student’s team.')), legend, el('div', { className: 'sscroll' }, tbl)));
    const lanesLegend = D.lanes.map(l => l.name[0].toUpperCase() + ' = ' + l.name);
    if (new Set(D.lanes.map(l => l.name[0].toUpperCase())).size < D.lanes.length) legend.append(T('span', '', 'Lanes share a first letter, so hover a red cell to see the lane.')); else legend.append(T('span', '', lanesLegend.join('   ')));

    // detail
    box.append(detail(c, D, cards));
  }

  function detail(c, D, cards) {
    const card = el('div', { className: 'card spad' });
    const sel = ST.sel || (cards.length ? { k: 'c', id: cards[0].id } : null);
    if (!sel) return card;
    if (sel.k === 'c') {
      const k = D.stat.find(x => x.id === sel.id); if (!k) return card;
      const missed = D.started.filter(s => s.sort[k.id] && s.sort[k.id] !== k.lane).sort((a, b) => a.g.right - b.g.right);
      const left = el('div', {}, T('span', 'pill', 'Card' + (k.idea ? ' · ' + k.idea : '')), T('div', 'cq', '“' + k.text + '”'), T('span', 'pill good', 'Belongs in ' + D.laneName(k.lane)), T('span', 'pill', k.n ? k.right + ' of ' + k.n + ' got it (' + k.pct + '%)' : 'No answers yet'));
      const dist = el('div', {}, T('h3', '', 'Where students put it'));
      D.lanes.forEach(l => {
        const r = el('div', { className: 'dr' + (l.id === k.lane ? ' right' : '') }), bar = T('span', 'bar1'); bar.append(el('i', { className: l.id === k.lane ? 'f-good' : 'f-bad', style: 'width:' + (k.n ? Math.round(100 * k.dist[l.id] / k.n) : 0) + '%' }));
        r.append(T('span', '', l.name + (l.id === k.lane ? ' ✓' : '')), bar, T('span', 'pct', k.dist[l.id])); dist.append(r);
      });
      const who = el('div', {}, T('h3', '', 'Missed it (' + missed.length + ')'));
      if (!missed.length) who.append(T('span', 'mut', k.n ? 'Nobody. Move on.' : 'Waiting for answers.'));
      missed.forEach(s => who.append(el('button', { className: 'pill bad', textContent: s.name, onclick: () => { ST.sel = { k: 's', id: s.id }; render(); } })));
      if (missed.length) {
        const msg = T('span', 'mut', ''), b = el('button', { className: 'b pri', textContent: 'Copy names for a small group' });
        b.onclick = () => navigator.clipboard.writeText(missed.map(s => s.name).join(', ')).then(() => (msg.textContent = 'Copied ✓'), () => (msg.textContent = missed.map(s => s.name).join(', ')));
        who.append(el('div', { className: 'row', style: 'margin-top:8px' }, b, msg));
      }
      card.append(el('div', { className: 'dgrid' }, left, dist, who));
    } else {
      const s = D.all.find(x => x.id === sel.id); if (!s) return card;
      const miss = D.cards.filter(k => s.sort[k.id] && s.sort[k.id] !== c.sk.lane[k.id]), by = {};
      miss.forEach(k => { const i = c.sk.idea[k.id]; if (i) by[i] = (by[i] || 0) + 1; });
      const weak = Object.keys(by).filter(i => by[i] >= 2);
      const head = el('div', {});
      if (s.team) { const t = T('span', 'pill', (s.team.emoji ? s.team.emoji + ' ' : '') + s.team.name); t.style.background = s.team.color; t.style.color = '#fff'; head.append(t); }
      head.append(T('div', 'cq', s.name), T('span', 'pill ' + (s.g.put && !miss.length ? 'good' : ''), s.g.put ? s.g.right + ' of ' + D.cards.length + ' right' : 'Has not started'));
      if (weak.length) head.append(T('span', 'pill bad', 'Trouble with: ' + weak.join(', ')));
      const acts = el('div', { className: 'row', style: 'margin-top:8px' });
      acts.append(el('button', { className: 'b', textContent: c.spotId === s.id ? 'Stop showing' : 'Show on projector', onclick: () => c.spot(s) }));
      if (c.award && s.team) acts.append(el('button', { className: 'b' + (s.aw ? ' good' : ''), textContent: s.aw ? '✓ Point given (undo)' : '✓ +1 for ' + s.team.name, onclick: () => c.award(s) }));
      if (s.done) acts.append(el('button', { className: 'b', textContent: 'Let them change it', title: 'Reopens their answer', onclick: () => c.reopen(s) }));
      head.append(acts);
      const g = el('div', { className: 'dgrid stu' }, head);
      D.lanes.forEach(l => {
        const here = D.cards.filter(k => s.sort[k.id] === l.id), col = el('div', { className: 'ln' }, T('h4', '', l.name));
        here.forEach(k => { const ok = c.sk.lane[k.id] === l.id; col.append(el('div', { className: 'sn ' + (ok ? 'ok' : 'no') }, T('span', '', k.text), T('em', '', ok ? '✓' : 'Belongs in ' + D.laneName(c.sk.lane[k.id])))); });
        if (!here.length) col.append(T('span', 'mut', 'Nothing placed here'));
        g.append(col);
      });
      card.append(g);
    }
    return card;
  }

  function exportCSV(c, D) {
    const head = ['Student', 'Team', 'Right', 'Out of', 'Handed in'].concat(D.cards.map(k => k.text));
    const rows = [head].concat(orderStudents(D).map(s => [s.name, s.team ? s.team.name : '', s.g.right, D.cards.length, s.done ? 'yes' : 'no'].concat(D.cards.map(k => { const a = s.sort[k.id]; return !a ? '' : a === c.sk.lane[k.id] ? '✓' : D.laneName(a); }))));
    const a = el('a', { href: URL.createObjectURL(new Blob([SK.csv(rows)], { type: 'text/csv' })), download: 'sort-results.csv' }); a.click();
    c.toast('Saved. Student names are in this file, so keep it private.');
  }

  // phone layout (Review tab): the numbers a teacher needs while walking the room
  function phone(wrap, c) {
    if (!c.sk) return wrap.append(T('div', 'mut', 'The answer key for this question is not on this device. Send the question again.'));
    const D = compute(c), n = D.cards.length, pad = el('div', { className: 'ph-pad' });
    const avg = D.started.length ? D.started.reduce((a, s) => a + s.g.right, 0) / D.started.length : 0;
    pad.append(el('div', { className: 'card', style: 'padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px' },
      el('div', {}, T('div', 'lbl', 'Class average'), T('div', '', D.started.length ? avg.toFixed(1) + ' / ' + n : '–')),
      el('div', { style: 'text-align:right' }, T('div', 'lbl', 'Handed in'), T('div', '', D.finished + ' of ' + D.all.length))));
    pad.lastChild.querySelectorAll('div > div:last-child').forEach(d => { d.style.cssText = 'font-family:var(--disp);font-weight:800;font-size:28px'; });
    const rv = el('button', { className: 'b big' + (c.revealed ? ' good' : ' line2'), textContent: c.revealed ? '✓ Answers revealed (hide)' : 'Reveal answers to students', style: 'min-height:60px', onclick: c.reveal });
    pad.append(rv);
    if (D.ideas.length) {
      pad.append(T('div', 'lbl', 'Ideas'));
      D.ideas.forEach(d => { const t = d.pct == null ? 'mid' : SK.tier(d.pct), bar = T('span', 'bar1'); bar.append(el('i', { className: 'f-' + t, style: 'width:' + (d.pct || 0) + '%' })); pad.append(el('div', { className: 'ph-row', style: 'flex-direction:column;align-items:stretch;gap:6px' }, el('div', { style: 'display:flex;justify-content:space-between;gap:8px' }, T('b', '', d.name), T('span', 'band b-' + t, d.pct == null ? '–' : d.pct + '% · ' + SK.tierWord(d.pct))), bar)); });
    }
    pad.append(T('div', 'lbl', 'Cards to reteach first'));
    orderCards(D).slice(0, 5).forEach(k => {
      const missed = D.started.filter(s => s.sort[k.id] && s.sort[k.id] !== k.lane), t = k.pct == null ? 'mid' : SK.tier(k.pct);
      const d = el('details', { className: 'ph-row', style: 'display:block;padding:10px 12px' });
      d.open = ST.open.has(k.id); d.ontoggle = () => { d.open ? ST.open.add(k.id) : ST.open.delete(k.id); };
      d.append(el('summary', { style: 'display:flex;gap:10px;align-items:center;cursor:pointer' }, T('span', 'band b-' + t, k.pct == null ? '–' : k.pct + '%'), T('span', '', k.text), T('span', 'mut', k.n ? '· ' + missed.length + ' missed' : '')));
      d.append(T('div', 'mut', 'Belongs in ' + D.laneName(k.lane) + '.'));
      d.append(el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px' }, ...missed.map(s => T('span', 'pill bad', s.name + ' → ' + D.laneName(s.sort[k.id])))));
      pad.append(d);
    });
    const low = D.started.filter(s => s.g.right <= Math.floor(n / 2)).sort((a, b) => a.g.right - b.g.right);
    if (low.length) { pad.append(T('div', 'lbl', 'Need a small group')); pad.append(el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, ...low.map(s => T('span', 'pill bad', s.name + ' ' + s.g.right + '/' + n)))); }
    wrap.append(pad);
  }

  return {
    mount(b, g) { box = b; get = g; },
    phone,
    // many answers can arrive at once; redraw at most every 250ms
    update() { if (!box || timer) return; timer = setTimeout(() => { timer = 0; render(); }, 250); },
    now() { clearTimeout(timer); timer = 0; render(); },
    reset() { ST.sel = null; ST.idea = null; }
  };
})();
