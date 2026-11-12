// The Dashboard tab on /teacher: who needs help, where the class is on each tag, and confidence against mastery.
// Everything is worked out in this browser from saved lesson records (tcommon.js) by mastery.js. Nothing is sent anywhere.
// Load after tcommon.js and mastery.js.

const DASH = (() => {
  const RANGES = [['week', 'This week'], ['month', 'Last 30 days'], ['all', 'All']];
  let code = '', rng = (() => { try { return localStorage.do_drange || 'month'; } catch { return 'month'; } })(), lessons = null, open = new Set(), last = null;
  const fmt = at => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const word = n => n + ' ' + (n === 1 ? 'time' : 'times');
  const nm = n => (n === 1 ? '1 student' : n + ' students');

  async function load() { lessons = await lessonsAll(); return lessons; }
  const classes = () => periods.map(p => ({ code: p.code, name: p.name }));
  const current = () => periods.find(p => p.code === code) || null;

  // ---- the numbers, as text: used by Copy summary and Save as CSV, and checked by the tests
  function summaryText(b, cls, rangeName) {
    const L = [];
    L.push('Dashboard for ' + cls + ' (' + (RANGES.find(r => r[0] === rangeName) || RANGES[1])[1].toLowerCase() + '): ' + b.lessons.length + ' question' + (b.lessons.length === 1 ? '' : 's') + ' asked.');
    L.push('');
    L.push('Who needs help:');
    if (!b.help.length) L.push('  Nobody is in the Not yet band on a tag or has been red twice.');
    b.help.forEach(h => L.push('  ' + h.name + ': ' + h.reasons.map(r => r.type === 'tag' ? 'Not yet on ' + r.label + ' (' + r.value + '%, last ' + fmt(r.at) + ')' : 'red ' + word(r.count) + ' (last ' + fmt(r.at) + ')').join('; ')));
    L.push('');
    L.push('Mastery by tag (students in each band):');
    b.rows.forEach(r => L.push('  ' + r.label + ': ' + r.counts.not + ' Not yet, ' + r.counts.getting + ' Getting there, ' + r.counts.secure + ' Secure' + (r.counts.nodata ? ', ' + r.counts.nodata + ' not enough data' : '')));
    if (b.greenLow.length || b.redHigh.length) {
      L.push('');
      if (b.greenLow.length) L.push('Said green but scored low: ' + b.greenLow.map(x => x.name + ' (' + x.count + ')').join(', '));
      if (b.redHigh.length) L.push('Said red but scored high: ' + b.redHigh.map(x => x.name + ' (' + x.count + ')').join(', '));
    }
    return L.join('\n');
  }
  function csvRows(b, cls) {
    const rows = [['Class', 'Student', 'Tag', 'Data points', 'Mastery %', 'Band', 'Last measured']];
    b.rows.forEach(r => r.people.forEach(p => rows.push([cls, p.name, r.label, p.n, p.value == null ? '' : p.value, p.band ? MK.BAND_WORD[p.band] : 'Not enough data', fmt(p.last)])));
    return rows;
  }

  // ---- drawing the page
  const t = (tag, cls, text) => el(tag, { className: cls || '', textContent: text == null ? '' : text });
  function bar(c) {
    const tot = c.not + c.getting + c.secure, box = el('div', { className: 'mbar', role: 'img' });
    box.setAttribute('aria-label', c.not + ' Not yet, ' + c.getting + ' Getting there, ' + c.secure + ' Secure' + (c.nodata ? ', ' + c.nodata + ' not enough data' : ''));
    if (!tot) { box.append(t('span', 'mseg nodata', 'Not enough data yet')); return box; }
    [['not', c.not, 'Not yet'], ['getting', c.getting, 'Getting there'], ['secure', c.secure, 'Secure']].forEach(([k, n, w]) => { if (!n) return; const s = t('span', 'mseg ' + k, n + ' ' + w); s.style.flex = n + ' 1 0'; box.append(s); });
    return box;
  }
  function tagRow(r, cls) {
    const isOpen = open.has(r.key), row = el('div', { className: 'mrow' + (isOpen ? ' open' : '') });
    const head = el('button', { type: 'button', className: 'mhead', 'aria-expanded': isOpen ? 'true' : 'false' });
    head.append(el('span', { className: 'mname' }, t('b', '', r.label), t('small', 'mut', r.qs.length + ' question' + (r.qs.length === 1 ? '' : 's'))), bar(r.counts), icoEl('chev', 'sm'));
    head.onclick = () => { isOpen ? open.delete(r.key) : open.add(r.key); render(); };
    row.append(head);
    if (r.counts.nodata && (r.counts.not + r.counts.getting + r.counts.secure)) row.append(t('div', 'mut mnote', r.counts.nodata + ' more ' + (r.counts.nodata === 1 ? 'student has' : 'students have') + ' fewer than two data points, so no number yet.'));
    if (isOpen) {
      const det = el('div', { className: 'mdet' });
      if (r.key === MK.NOTAG) det.append(el('p', { className: 'mnote' }, 'These questions have no tag, so they cannot be grouped by skill. ', el('a', { href: '/teacher?tab=sets', textContent: 'Tag them on the Question sets tab' }), '.'));
      const ppl = el('div', { className: 'mcol' }, t('h4', '', 'Students'));
      if (!r.people.length) ppl.append(t('p', 'mut', 'No one has a score on this tag yet.'));
      r.people.forEach(p => ppl.append(el('div', { className: 'mp' }, t('span', 'mpn', p.name), t('span', 'mpv ' + (p.band || 'nodata'), p.band ? p.value + '% · ' + MK.BAND_WORD[p.band] : 'Not enough data (' + p.n + ')'), t('small', 'mut', 'last ' + fmt(p.last)))));
      const qsc = el('div', { className: 'mcol' }, t('h4', '', 'Questions behind it'));
      r.qs.slice().reverse().forEach(q => qsc.append(el('div', { className: 'mq' }, t('span', 'mqt', q.q), t('small', 'mut', fmt(q.at) + ' · ' + (q.kind === 'sort' ? 'Sort' : q.model ? 'Pieces' : 'Draw') + ' · ' + (q.avg == null ? (q.kind === 'sort' ? 'no one placed cards' : q.model ? 'no one moved pieces' : 'no marks, confidence only') : 'class average ' + q.avg + '%')))));
      det.append(ppl, qsc);
      if (r.ideas.length) { const id = el('div', { className: 'mcol' }, t('h4', '', 'Ideas most often missed')); r.ideas.slice(0, 6).forEach(i => id.append(el('div', { className: 'mq' }, t('span', 'mqt', i.idea), t('small', 'mut', 'missed ' + word(i.misses))))); det.append(id); }
      row.append(det);
    }
    return row;
  }
  function people(list, none, line) {
    const box = el('div', { className: 'plist' });
    if (!list.length) return box.append(t('p', 'mut', none)), box;
    list.forEach(x => box.append(el('div', { className: 'pl' }, t('b', '', x.name), t('span', '', line(x)))));
    return box;
  }

  function render() {
    const root = $('#dashbody'); if (!root || lessons == null) return;
    const sel = $('#dclass'); sel.replaceChildren(...classes().map(c => el('option', { value: c.code, textContent: c.name, selected: c.code === code })));
    $$('#drange button').forEach(b => b.setAttribute('aria-pressed', b.dataset.r === rng ? 'true' : 'false'));
    const cls = current(), b = MK.build(lessons, { code, ...MK.range(rng) }); last = { b, cls: cls ? cls.name : '', rng };
    root.replaceChildren();
    const any = lessons.some(l => l.code === code);
    $('#dcsv').disabled = $('#dcopy').disabled = !b.lessons.length;
    // the honest limit, always in view
    const sg = b.signals, notes = [];
    notes.push('This shows what the app measures: sort accuracy, pieces placed in the right spot, the confidence colour each student picks, and the marks you give drawings. A drawing you did not mark counts as confidence only. On a question with pieces, the score is the pieces placed right; the drawing on top is not scored.');
    if (sg.drawUnmarked) notes.push(sg.drawUnmarked + ' of the ' + sg.draw + ' drawing question' + (sg.draw === 1 ? '' : 's') + ' in this range ' + (sg.drawUnmarked === 1 ? 'has' : 'have') + ' no marks, so ' + (sg.drawUnmarked === 1 ? 'it shows' : 'they show') + ' confidence only.');
    const nn = el('div', { className: 'dnote' }, ...notes.map(n => t('p', '', n)));
    if (b.nick && cls) nn.append(el('p', { className: 'nick' }, 'Students joined with nicknames, so history is matched by nickname. Add a class list for reliable tracking. ', el('a', { href: '/class?code=' + code + '&setup=1', textContent: 'Teams and class list' }), '.'));
    if (!b.lessons.length) {
      root.append(nn, el('div', { className: 'dempty' }, t('b', '', any ? 'Nothing in this date range.' : 'Run a class and this fills in.'), t('p', 'mut', any ? 'Try “Last 30 days” or “All”. Sort questions, pieces questions and marked drawings count toward mastery.' : 'Sort questions, pieces questions and marked drawings count toward mastery.')));
      return;
    }
    // 1. who needs help
    const help = el('section', { className: 'dsec', id: 'dhelp' }, t('h2', '', 'Who needs help'), t('p', 'mut', 'In the Not yet band on a tag, or red twice or more.'));
    help.append(people(b.help, 'Nobody is in the Not yet band on a tag or has been red twice so far.', h => h.reasons.map(r => r.type === 'tag' ? 'Not yet on ' + r.label + ' (' + r.value + '%)' : 'Red ' + word(r.count)).join(' · ') + ' · last ' + fmt(h.at)));
    // 2. mastery by tag
    const tags = el('section', { className: 'dsec', id: 'dtags' }, t('h2', '', 'Mastery by tag'), t('p', 'mut', 'Students in each band. The most recent three lessons on a tag count double. Under two data points shows “not enough data”. Click a row for the students, the questions and the ideas most often missed.'));
    b.rows.forEach(r => tags.append(tagRow(r, cls)));
    // 3. confidence against mastery
    const conf = el('section', { className: 'dsec', id: 'dconf' }, t('h2', '', 'Confidence against mastery'), t('p', 'mut', 'The two groups worth a conversation: students who say green but score low, and students who say red but score high.'));
    const g = el('div', { className: 'cg' }, t('h3', '', 'Said green, scored low'), people(b.greenLow, b.withConf ? 'No one stands out.' : 'Needs a confidence colour and a score on the same question.', x => word(x.count) + ' · last on “' + x.q.slice(0, 50) + '” ' + fmt(x.at)));
    const rd = el('div', { className: 'cg' }, t('h3', '', 'Said red, scored high'), people(b.redHigh, b.withConf ? 'No one stands out.' : 'Needs a confidence colour and a score on the same question.', x => word(x.count) + ' · last on “' + x.q.slice(0, 50) + '” ' + fmt(x.at)));
    conf.append(el('div', { className: 'cgs' }, g, rd));
    root.append(nn, help, tags, conf);
  }

  async function show(want) {
    if (want && periodOf(want)) code = want; else if (!periodOf(code)) code = (periodOf(store.do_tcode) ? store.do_tcode : (periods[0] || {}).code) || '';
    await load(); render();
  }
  function init() {
    $('#dclass').onchange = e => { code = e.target.value; open.clear(); const u = new URL(location.href); u.searchParams.set('class', code); history.replaceState(null, '', u); render(); };
    $$('#drange button').forEach(b => (b.onclick = () => { rng = b.dataset.r; try { localStorage.do_drange = rng; } catch {} open.clear(); render(); }));
    $('#dcsv').onclick = () => { if (!last) return; const rows = csvRows(last.b, last.cls); const a = el('a', { href: URL.createObjectURL(new Blob([SK.csv(rows)], { type: 'text/csv;charset=utf-8' })), download: 'draw-it-out-' + last.cls.replace(/[^\w]+/g, '-').toLowerCase() + '-mastery.csv' }); a.click(); toast('Saved. The file has student names, so keep it private.'); };
    $('#dcopy').onclick = () => { if (!last) return; const txt = summaryText(last.b, last.cls, last.rng); navigator.clipboard.writeText(txt).then(() => toast('Summary copied.'), () => showCopy('Copy this summary', txt)); };
  }
  return { show, render, init, load, summaryText, csvRows, get lessons() { return lessons; }, set code(c) { code = c; } };
})();
