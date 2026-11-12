// "Build with AI": the app writes a prompt, the teacher pastes it into any AI tool they already use, pastes the answer back, and the
// app checks it and adds the set. The app itself never calls an AI service, so there is no key, no cost and no student data involved.
// Load after sortkit.js and tcommon.js (the dialog uses el, tagInput, tagUsage, SK, toast, showCopy).

const AIB = (() => {
  const GRADES = ['5th grade', '6th grade', '7th grade', '8th grade', '9th to 12th grade'];
  const DEFAULTS = { type: 'draw', goal: '', tags: [], grade: '8th grade', n: 5, lang: 'none', lanes: 3, cards: 8, ideas: true };

  const q = (n, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(+n) || d));
  const clampOpts = o => {
    const x = { ...DEFAULTS, ...o };
    x.type = ['draw', 'sort', 'mix'].includes(x.type) ? x.type : 'draw';
    x.n = q(x.n, 3, 10, 5); x.lanes = q(x.lanes, 2, 4, 3); x.cards = q(x.cards, 6, 12, 8);
    x.lang = ['none', 'simple', 'frame'].includes(x.lang) ? x.lang : 'none';
    x.goal = String(x.goal || '').trim().slice(0, 600); x.tags = SK.cleanTags(x.tags).tags; x.ideas = x.ideas !== false;
    x.grade = String(x.grade || DEFAULTS.grade).slice(0, 40);
    return x;
  };

  // Worked examples. They are real data: a test checks that they pass the same validator the pasted answer goes through.
  function examples(o) {
    const tags = o.tags.length ? o.tags : ['Rock cycle'];
    const frame = o.lang === 'frame' ? '<br>Sentence frame: Magma becomes ___ when it ___.' : '';
    const draw = { question: 'Draw the <b>rock cycle</b> with 3 arrows. Label what happens along each arrow.' + frame, bg: 'blank', tags };
    const laneDefs = [['A', 'Igneous'], ['B', 'Sedimentary'], ['C', 'Metamorphic'], ['D', 'Not a rock']].slice(0, Math.max(2, o.lanes));
    const cards = [
      ['Granite', 'A', 'Forms from magma'], ['Obsidian', 'A', 'Cools fast'], ['Sandstone', 'B', 'Made of grains'], ['Has fossils', 'B', 'Clues in layers'],
      ['Marble', 'C', 'Heat and pressure'], ['Slate', 'C', 'Heat and pressure'], ['Plastic', 'D', 'Not a rock'], ['Wood', 'D', 'Not a rock'],
    ].filter(c => laneDefs.some(l => l[0] === c[1]));
    const sort = {
      question: 'Sort each rock or clue into the lane where it belongs.' + frame, kind: 'sort', tags,
      sort: { lanes: laneDefs.map(l => ({ id: l[0], name: l[1] })), cards: cards.map((c, i) => ({ id: i + 1, text: c[0], lane: c[1], ...(o.ideas ? { idea: c[2] } : {}) })) },
    };
    return { draw, sort };
  }

  function buildPrompt(opts) {
    const o = clampOpts(opts), ex = examples(o);
    const nSort = o.type === 'sort' ? o.n : o.type === 'mix' ? Math.round(o.n / 2) : 0, nDraw = o.n - nSort;
    const L = [];
    L.push('You are helping a middle school teacher write a question set for Draw It Out, a classroom tool. In it, students answer by making a quick sketch with labels' + (nSort ? ', or by sorting cards into lanes' : '') + '.');
    L.push('');
    L.push('Write ' + o.n + ' questions about this learning goal: ' + (o.goal || '(the teacher has not said yet)'));
    L.push('The students are in ' + o.grade + '.');
    if (o.type === 'mix') L.push('Write ' + nDraw + ' draw questions and ' + nSort + ' sort questions, mixed in an order that makes sense.');
    else if (o.type === 'draw') L.push('Every question is a draw question.');
    else L.push('Every question is a sort question.');
    if (o.lang !== 'none') {
      L.push('');
      L.push('LANGUAGE SUPPORT: many of these students are multilingual learners. Use short sentences (under 15 words), everyday words, one idea per sentence, and no idioms. Keep the science words students must learn, and make each one <b>bold</b> the first time it appears.' +
        (o.lang === 'frame' ? ' End every question with a line break and then a sentence frame that starts with "Sentence frame:" (for example "Sentence frame: The ___ moves ___ because ___.") so students can write full sentences in their labels.' : ''));
    }
    L.push('');
    L.push('REPLY WITH JSON ONLY. No sentences before or after it, no explanation. Use this shape: a list holding one set.');
    L.push('[{"name": "A short title for the set", "questions": [ ...the questions... ]}]');
    if (o.tags.length) {
      L.push('');
      L.push('TAGS: put exactly these tags on every question, spelled exactly like this, and no others: ' + o.tags.map(t => JSON.stringify(t)).join(', ') + '. Write them as "tags": [' + o.tags.map(t => JSON.stringify(t)).join(', ') + '] on each question.');
    } else {
      L.push('');
      L.push('TAGS: give every question a "tags" list of 1 to 3 short labels for the skill or standard it assesses (for example "Rock cycle" or "Reading a diagram"). Use the same label every time the same skill appears.');
    }
    if (nDraw) {
      L.push('');
      L.push('DRAW QUESTIONS look like this:');
      L.push('{"question": "...", "bg": "blank", "tags": [ ... ]}');
      L.push('- "bg" is "blank" for a free sketch, "graph" when the answer needs axes or a grid, or "lined" when the answer is mostly written labels.');
      L.push('- A student must be able to answer with a sketch and labels in about two minutes. Say exactly what to include (for example "label 3 parts" or "use arrows to show the direction"). Do not ask for a paragraph, a realistic painting, or anything that needs research.');
    }
    if (nSort) {
      L.push('');
      L.push('SORT QUESTIONS look like this:');
      L.push('{"question": "...", "kind": "sort", "tags": [ ... ], "sort": {"lanes": [{"id": "A", "name": "..."}, ...], "cards": [{"id": 1, "text": "...", "lane": "A"' + (o.ideas ? ', "idea": "..."' : '') + '}, ...]}}');
      L.push('- Each sort question has exactly ' + o.lanes + ' lanes (ids "A", "B"' + (o.lanes > 2 ? ', "C"' : '') + (o.lanes > 3 ? ', "D"' : '') + ') and exactly ' + o.cards + ' cards, numbered 1, 2, 3 and so on.');
      L.push('- Every card\'s "lane" must be the id of one of that question\'s lanes. Each card belongs in exactly one lane, and every lane gets at least 2 cards.');
      L.push('- Make the wrong lanes tempting. Write some cards that a student with a common misconception would put in the wrong lane, and keep the cards short enough to read at a glance.');
      L.push(o.ideas
        ? '- Give every card an "idea": 1 to 4 words naming the concept that card tests (for example "Cooling rate"). Cards that test the same concept share the same idea text.'
        : '- Leave the "idea" field out.');
    }
    L.push('');
    L.push('LIMITS. The app rejects anything outside them, so stay inside:');
    L.push('- Question text: at most 2000 characters (aim for under 300). The only formatting allowed is <b>, <i>, <u> and <br>. No markdown, no other HTML.');
    if (nSort) L.push('- Lanes: 2 to 6 per question. Lane id: 1 to 8 letters or numbers. Lane name: at most 24 characters. Cards: 2 to 24 per question. Card text: at most 60 characters. Idea: at most 30 characters.');
    L.push('- Tags: at most 5 per question, at most 30 characters each, plain text only.');
    L.push('- The set name: at most 60 characters.');
    L.push('');
    L.push('WORKED EXAMPLE' + (nDraw && nSort ? 'S' : '') + ' (the format only; write new content about the learning goal):');
    if (nDraw) { L.push('A draw question:'); L.push(JSON.stringify(ex.draw)); }
    if (nSort) { L.push('A sort question:'); L.push(JSON.stringify(ex.sort)); }
    L.push('');
    L.push('Before you reply, check each question against the limits above, and check that every card\'s lane exists. Then reply with the JSON only.');
    return L.join('\n');
  }

  // ---- the dialog ----
  let saved = {}; try { saved = JSON.parse(localStorage.do_aib || '{}'); } catch {}
  const remember = o => { saved = { type: o.type, grade: o.grade, n: o.n, lang: o.lang, lanes: o.lanes, cards: o.cards, ideas: o.ideas }; try { localStorage.do_aib = JSON.stringify(saved); } catch {} };

  function radios(name, legend, opts, value, onPick) {
    const fs = el('fieldset', { className: 'aibfs' }, el('legend', { textContent: legend }));
    opts.forEach(([v, text, sub]) => {
      const id = 'aib-' + name + '-' + v, r = el('input', { type: 'radio', name: 'aib-' + name, id, value: v, checked: v === value });
      r.onchange = () => onPick(v);
      fs.append(el('label', { className: 'aibopt', htmlFor: id }, r, el('span', {}, text, ...(sub ? [el('small', { textContent: sub })] : []))));
    });
    return fs;
  }

  // Check a pasted reply. -> { error } or [{ name, tags, rows:[{ n, q, problems, notes, on }] }]
  function check(text) {
    const p = SK.parseSets(text); if (p.error) return { error: p.error };
    return p.sets.map(s => ({
      name: s.name, tags: s.tags,
      rows: s.questions.slice(0, SK.MAX_QS).map((raw, i) => { const c = SK.checkQuestion(raw); return { n: i + 1, q: c.q, problems: c.problems, notes: c.notes, on: !!c.q }; }),
      extra: Math.max(0, s.questions.length - SK.MAX_QS),
    }));
  }
  // The preview list: one row per question, problems in plain words, a tick box on each good one.
  function paint(sets, onChange) {
    const out = [], good = sets.reduce((a, s) => a + s.rows.filter(r => r.q).length, 0), bad = sets.reduce((a, s) => a + s.rows.filter(r => !r.q).length, 0);
    out.push(el('p', { className: 'aibsum', textContent: good + (good === 1 ? ' question looks' : ' questions look') + ' good' + (bad ? ', and ' + bad + (bad === 1 ? ' needs' : ' need') + ' fixing. You can add the good ones now and skip the rest.' : '. Untick any you do not want.') }));
    sets.forEach((s, si) => {
      const nm = el('input', { type: 'text', className: 'aibin', value: s.name, maxLength: 60, id: 'aibsn' + si }); nm.oninput = () => { s.name = nm.value.trim() || 'AI set'; };
      out.push(el('div', { className: 'aibf' }, el('label', { htmlFor: 'aibsn' + si, textContent: sets.length > 1 ? 'Set ' + (si + 1) + ' name' : 'Set name' }), nm));
      if (s.tags.length) out.push(el('div', { className: 'tgrow' }, el('span', { className: 'mut', textContent: 'Tags on the whole set: ' }), ...s.tags.map(t => el('span', { className: 'tg ro', textContent: tagLabel(t) }))));
      const ul = el('ul', { className: 'aiblist' });
      s.rows.forEach(r => {
        const id = 'aibq' + si + '-' + r.n, cb = el('input', { type: 'checkbox', id, checked: r.on, disabled: !r.q }); cb.onchange = () => { r.on = cb.checked; onChange(); };
        const kind = r.q ? (r.q.kind === 'sort' ? 'Sort' : 'Draw') : '';
        const txt = r.q ? SK.plain(r.q.question) : '';
        const li = el('li', { className: 'aibrow' + (r.q ? '' : ' bad') },
          cb, el('div', { className: 'aibrowb' },
            el('label', { htmlFor: id, className: 'aibrowt' }, el('b', { textContent: 'Question ' + r.n }), ...(kind ? [el('span', { className: 'chip', textContent: kind })] : []), ...(txt ? [el('span', { className: 'aibq', textContent: ' ' + txt.slice(0, 160) + (txt.length > 160 ? '…' : '') })] : [])),
            ...(r.q && r.q.kind === 'sort' ? [el('small', { className: 'mut', textContent: r.q.sort.lanes.map(l => l.name).join(' · ') + ' — ' + r.q.sort.cards.length + ' cards' })] : []),
            ...(r.q && r.q.tags ? [el('div', { className: 'tgrow' }, ...r.q.tags.map(t => el('span', { className: 'tg ro', textContent: tagLabel(t) })))] : []),
            ...r.problems.map(m => el('div', { className: 'aibprob' }, icoEl('x', 'sm'), ' Question ' + r.n + ': ' + m + '.')),
            ...r.notes.map(m => el('div', { className: 'aibfix', textContent: 'Fixed: ' + m + '.' }))));
        ul.append(li);
      });
      out.push(ul);
      if (s.extra) out.push(el('p', { className: 'aibbad', textContent: s.extra + ' more questions were left out: a set holds at most ' + SK.MAX_QS + '.' }));
    });
    return out;
  }

  function open(onDone) {
    document.getElementById('aibdlg')?.remove();
    const o = { ...DEFAULTS, ...saved, goal: '', tags: [] };
    const d = el('dialog', { id: 'aibdlg', className: 'aib' }); d.setAttribute('aria-labelledby', 'aibh');
    const close = () => { d.close(); };
    d.addEventListener('close', () => d.remove());

    const head = el('div', { className: 'aibh' }, el('h2', { id: 'aibh', textContent: 'Build a question set with AI' }), el('button', { type: 'button', className: 'b', textContent: 'Close', onclick: close }));
    const step = el('p', { className: 'aibstep', textContent: 'Step 1 of 2: build the prompt' });
    const body = el('div', { className: 'aibbody' });

    // ---- step 1
    const s1 = el('div', { className: 'aibp' });
    const out = el('textarea', { id: 'aibout', readOnly: true, rows: 10, className: 'aibout' }); out.setAttribute('aria-label', 'The prompt to copy');
    const refresh = () => { o.n = q(o.n, 3, 10, 5); out.value = buildPrompt(o); lanesRow.hidden = o.type === 'draw'; remember(clampOpts(o)); copyNote.textContent = ''; };
    const typeFs = radios('type', 'Question type', [['draw', 'Draw', 'Students sketch and label'], ['sort', 'Sort cards', 'Students drop cards into lanes'], ['mix', 'A mix of both']], o.type, v => { o.type = v; refresh(); });
    const goal = el('textarea', { id: 'aibgoal', rows: 2, className: 'aibin', placeholder: 'For example: MS-ESS2-1: cycling of Earth\'s materials. Or: how plate boundaries make mountains, volcanoes and earthquakes.' });
    goal.oninput = () => { o.goal = goal.value; refresh(); };
    const tags = tagInput({ value: [], label: 'Tags for every question', id: 'aibtags', onChange: t => { o.tags = t; refresh(); } });
    const grade = el('select', { id: 'aibgrade', className: 'aibin' }, ...GRADES.map(g => el('option', { value: g, textContent: g, selected: g === o.grade })));
    grade.onchange = () => { o.grade = grade.value; refresh(); };
    const num = el('select', { id: 'aibn', className: 'aibin' }, ...[3, 4, 5, 6, 7, 8, 9, 10].map(n => el('option', { value: n, textContent: n, selected: n === o.n })));
    num.onchange = () => { o.n = +num.value; refresh(); };
    const langFs = radios('lang', 'Language support (for multilingual learners)', [['none', 'None'], ['simple', 'Simpler wording', 'Short sentences, everyday words, science words in bold'], ['frame', 'Simpler wording plus a sentence frame', 'Each question ends with "Sentence frame: …"']], o.lang, v => { o.lang = v; refresh(); });
    const lanes = el('select', { id: 'aiblanes', className: 'aibin' }, ...[2, 3, 4].map(n => el('option', { value: n, textContent: n, selected: n === o.lanes })));
    lanes.onchange = () => { o.lanes = +lanes.value; refresh(); };
    const cards = el('select', { id: 'aibcards', className: 'aibin' }, ...[6, 7, 8, 9, 10, 11, 12].map(n => el('option', { value: n, textContent: n, selected: n === o.cards })));
    cards.onchange = () => { o.cards = +cards.value; refresh(); };
    const ideas = el('input', { type: 'checkbox', id: 'aibideas', checked: o.ideas }); ideas.onchange = () => { o.ideas = ideas.checked; refresh(); };
    const lanesRow = el('div', { className: 'aibsort' },
      el('div', {}, el('label', { htmlFor: 'aiblanes', textContent: 'Lanes per sort question' }), lanes),
      el('div', {}, el('label', { htmlFor: 'aibcards', textContent: 'Cards per sort question' }), cards),
      el('label', { className: 'aibchk', htmlFor: 'aibideas' }, ideas, ' Tag each card with the idea it tests'));
    const field = (label, forId, node, hint) => el('div', { className: 'aibf' }, el('label', { htmlFor: forId, textContent: label }), ...(hint ? [el('small', { textContent: hint })] : []), node);
    const copyNote = el('span', { className: 'aibnote', role: 'status' });
    const copyBtn = el('button', { type: 'button', className: 'b pri', id: 'aibcopy', textContent: 'Copy prompt' });
    copyBtn.onclick = async () => {
      if (!o.goal.trim()) { goal.focus(); copyNote.textContent = 'Type the learning goal first.'; return; }
      try { await navigator.clipboard.writeText(out.value); copyNote.textContent = 'Copied. Paste it into your AI tool.'; } catch { showCopy('Copy the prompt', out.value); }
    };
    const next = el('button', { type: 'button', className: 'b', id: 'aibnext', textContent: 'Next: paste the answer' });
    s1.append(typeFs, field('Learning goal or standard', 'aibgoal', goal, 'What should students show they understand?'),
      field('What does each question assess? (tags)', 'aibtagsi', tags, 'Every question gets exactly these tags, so the set lands on your dashboard already labelled. Optional.'),
      el('div', { className: 'aibtwo' }, field('Grade', 'aibgrade', grade), field('Number of questions', 'aibn', num)),
      langFs, lanesRow,
      el('div', { className: 'aibf' }, el('label', { htmlFor: 'aibout', textContent: 'Your prompt' }), el('small', { textContent: 'Copy this into ChatGPT, Gemini, Claude or any AI tool you already use.' }), out),
      el('div', { className: 'aibbtns' }, copyBtn, copyNote, el('span', { style: 'flex:1' }), next));

    // ---- step 2: paste the answer, check it, import the good questions
    const s2 = el('div', { className: 'aibp', hidden: true });
    const paste = el('textarea', { id: 'aibpaste', rows: 9, className: 'aibin', placeholder: 'Paste the AI\'s whole reply here. A code block, or sentences around the JSON, are fine.' }); paste.setAttribute('aria-label', 'Paste the AI\'s reply here');
    const results = el('div', { className: 'aibres', id: 'aibres', role: 'region', ariaLabel: 'Check results' }); results.setAttribute('aria-live', 'polite');
    const checkBtn = el('button', { type: 'button', className: 'b pri', id: 'aibcheck', textContent: 'Check it' });
    const back = el('button', { type: 'button', className: 'b', id: 'aibback', textContent: 'Back to the prompt' });
    const addBtn = el('button', { type: 'button', className: 'b pri', id: 'aibadd', textContent: 'Add to my sets', hidden: true });
    let checked = null; // [{ name, tags, rows:[{ n, q, problems, notes, on }] }]
    const nSel = () => checked ? checked.reduce((a, s) => a + s.rows.filter(r => r.q && r.on).length, 0) : 0;
    const syncAdd = () => { const n = nSel(); addBtn.hidden = !checked; addBtn.disabled = !n; addBtn.textContent = n ? 'Add ' + n + ' question' + (n === 1 ? '' : 's') + ' to my sets' : 'Nothing to add'; };
    function show() { results.replaceChildren(...paint(checked, syncAdd)); syncAdd(); }
    checkBtn.onclick = () => {
      results.replaceChildren(); checked = null;
      if (!paste.value.trim()) { results.append(el('p', { className: 'aibbad', role: 'alert', textContent: 'Paste the AI\'s reply first.' })); paste.focus(); return syncAdd(); }
      checked = check(paste.value);
      if (checked.error) { results.append(el('p', { className: 'aibbad', role: 'alert', textContent: checked.error })); checked = null; return syncAdd(); }
      show();
    };
    addBtn.onclick = () => {
      const made = [];
      checked.forEach(s => { const qs = s.rows.filter(r => r.q && r.on).map(r => r.q); if (qs.length) made.push(addSet(s.name, qs, undefined, s.tags)); });
      const n = made.reduce((a, s) => a + s.questions.length, 0);
      d.close(); toast('Added ' + (made.length === 1 ? '"' + made[0].name + '"' : made.length + ' sets') + ' with ' + n + ' question' + (n === 1 ? '' : 's') + '.'); onDone && onDone(made);
    };
    next.onclick = () => { s1.hidden = true; s2.hidden = false; step.textContent = 'Step 2 of 2: paste the answer'; paste.focus(); };
    back.onclick = () => { s2.hidden = true; s1.hidden = false; step.textContent = 'Step 1 of 2: build the prompt'; goal.focus(); };
    s2.append(el('div', { className: 'aibf' }, el('label', { htmlFor: 'aibpaste', textContent: 'The AI\'s answer' }), el('small', { textContent: 'Copy the whole reply from your AI tool and paste it here. Nothing is added until you press the Add button.' }), paste),
      el('div', { className: 'aibbtns' }, back, el('span', { style: 'flex:1' }), checkBtn), results, el('div', { className: 'aibbtns' }, el('span', { style: 'flex:1' }), addBtn));

    body.append(s1, s2);
    d.append(head, step, body);
    document.body.append(d); d.showModal();
    refresh(); goal.focus();
    return { d, body, step, s1, next, o, refresh };
  }
  return { buildPrompt, examples, clampOpts, open, check, GRADES, DEFAULTS };
})();
