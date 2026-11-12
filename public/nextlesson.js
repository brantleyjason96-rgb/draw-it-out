// The end-of-lesson report: turns the session record (server.js sessionRecord) into what to cover next time.
// Pure functions, no page access. NL.analyze(record, { terms, nameOf }) -> a plain object; NL.text(analysis, { cls, date }) -> a summary to copy.
//
// Confidence is the student's red / amber / green tap. Accuracy comes only from sort questions, the one kind that has an answer key,
// so "confident but wrong" is a sort-question finding. Drawing questions are read through the words students typed on them.
const NL = (() => {
  // A sort answer is "right" at 80%+ of the cards. Someone who tapped "I understand" and landed below that missed some;
  // someone who tapped "I need help" and landed below 60% was right to. A card or idea is shaky below 70% right.
  const T = { right: 0.8, wrong: 0.6, shaky: 0.7 };
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  function lev(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const parseTerms = text => [...new Set(String(text || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean))].slice(0, 40);
  const sameWord = (w, t) => w === t || w === t + 's' || w === t + 'es' || t === w + 's' || t === w + 'es';
  // how a typed label matches a target word or phrase: 'exact', 'close' (a spelling slip), or null
  function match(label, term) {
    const l = norm(label), t = norm(term);
    if (!l || !t) return null;
    if (t.includes(' ')) {
      const padded = ' ' + l + ' ';
      if (padded.includes(' ' + t + ' ') || padded.includes(' ' + t + 's ') || padded.includes(' ' + t + 'es ')) return 'exact';
      return t.length >= 8 && lev(l, t) <= 2 ? 'close' : null;
    }
    const words = l.split(' ');
    if (words.some(w => sameWord(w, t))) return 'exact';
    const slack = t.length >= 11 ? 3 : t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0; // long words get more room: sound-it-out spellings like condensashun are off by 3
    return slack && words.some(w => w.length >= 4 && lev(w, t) <= slack) ? 'close' : null;
  }
  const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
  const topWrong = e => Object.entries(e.wrong).sort((a, b) => b[1] - a[1])[0] || null;

  function analyze(rec, o = {}) {
    const terms = o.terms || [], nameOf = o.nameOf || (s => s.ini), qs = (rec && rec.questions) || [];
    const people = new Map();
    const who = s => {
      const k = s.rid || s.id; let p = people.get(k);
      if (!p) people.set(k, p = { key: k, name: nameOf(s), over: [], aware: [], under: [], shown: [], labels: [], greens: 0, drew: false, seq: [] });
      return p;
    };

    // ---- confidence vs accuracy, and what was mixed up ----
    // Accuracy is the sort answer on a sort question, and the point the teacher gave on a drawing question.
    const calib = [], cards = [], ideaMap = new Map();
    // seq is the colours a student tapped, in order; a red that turned out right ("under") does not count as a red flag
    const tally = (p, s, under) => { if (s.pulse) p.seq.push(under ? 'u' : s.pulse); };
    qs.forEach(q => {
      if (q.kind === 'sort' && q.sort) {
        const total = q.sort.cards.length, lane = new Map(q.sort.lanes.map(l => [l.id, l.name])), skip = q.sort.feedback === 'now';
        const row = { n: q.n, q: q.q, basis: 'sort', answered: 0, noAnswer: 0, solid: 0, over: 0, under: 0, aware: 0, mixed: 0, none: 0, skipped: skip ? 'feedback' : null };
        const cs = q.sort.cards.map(c => ({ n: q.n, q: q.q, text: c.text, lane: lane.get(c.lane) || c.lane, idea: c.idea, placed: 0, right: 0, wrong: {}, confWrong: 0, id: c.id, key: c.lane }));
        q.students.forEach(s => {
          const p = who(s);
          if (!s.sort || !s.sort.placed) { row.noAnswer++; tally(p, s, false); return; }
          row.answered++;
          const acc = s.sort.correct == null ? null : s.sort.correct / total;
          cs.forEach(c => {
            const at = s.sort.place[c.id]; if (!at) return;
            c.placed++;
            if (at === c.key) c.right++;
            else { const nm = lane.get(at) || at; c.wrong[nm] = (c.wrong[nm] || 0) + 1; if (!skip && s.pulse === 'g') c.confWrong++; }
          });
          if (skip || acc == null) { tally(p, s, false); return; } // instant feedback means the colour came after the answer was known
          let under = false;
          if (!s.pulse) row.none++;
          else if (s.pulse === 'g') { if (acc >= T.right) row.solid++; else { row.over++; p.over.push({ n: q.n, got: s.sort.correct, of: total }); } }
          else if (s.pulse === 'r') { if (acc >= T.right) { row.under++; p.under.push(q.n); under = true; } else if (acc < T.wrong) { row.aware++; p.aware.push(q.n); } else row.mixed++; }
          else row.mixed++;
          tally(p, s, under);
        });
        calib.push(row); cards.push(...cs);
      } else if (q.kind === 'draw') {
        // With one point per team, a missing point says nothing about a student, so those questions are not compared.
        const given = q.students.filter(s => s.awarded).length;
        const row = { n: q.n, q: q.q, basis: 'points', given, answered: q.students.length, noAnswer: 0, solid: 0, over: 0, under: 0, aware: 0, mixed: 0, none: 0, skipped: q.capped ? 'capped' : given ? null : 'nopoints' };
        q.students.forEach(s => {
          const p = who(s);
          if (row.skipped) { tally(p, s, false); return; }
          let under = false;
          if (!s.pulse) row.none++;
          else if (s.pulse === 'g') { if (s.awarded) row.solid++; else { row.over++; p.over.push({ n: q.n, point: true }); } }
          else if (s.pulse === 'r') { if (s.awarded) { row.under++; p.under.push(q.n); under = true; } else { row.aware++; p.aware.push(q.n); } }
          else row.mixed++;
          tally(p, s, under);
        });
        calib.push(row);
      }
    });
    cards.forEach(c => {
      c.pct = pct(c.right, c.placed); c.mix = topWrong(c);
      if (!c.idea) return;
      const i = ideaMap.get(c.idea) || { name: c.idea, placed: 0, right: 0, confWrong: 0, cards: [] };
      i.placed += c.placed; i.right += c.right; i.confWrong += c.confWrong; i.cards.push(c); ideaMap.set(c.idea, i);
    });
    const ideas = [...ideaMap.values()].map(i => ({ ...i, pct: pct(i.right, i.placed), worst: [...i.cards].filter(c => c.placed).sort((a, b) => a.pct - b.pct)[0] || null })).sort((a, b) => a.pct - b.pct);
    const shaky = cards.filter(c => c.placed >= 2 && c.pct < T.shaky * 100).sort((a, b) => a.pct - b.pct);
    const totals = calib.filter(r => !r.skipped).reduce((a, r) => { ['solid', 'over', 'under', 'aware', 'mixed', 'none'].forEach(k => (a[k] += r[k])); return a; }, { solid: 0, over: 0, under: 0, aware: 0, mixed: 0, none: 0 });

    // ---- vocabulary and projector (every question) ----
    qs.forEach(q => q.students.forEach(s => {
      const p = who(s);
      if (s.shown) p.shown.push({ n: q.n, pulse: s.pulse || null });
      if (q.kind === 'draw') { p.drew = true; p.labels.push(...(s.labels || [])); if (s.pulse === 'g') p.greens++; }
    }));
    const drawers = [...people.values()].filter(p => p.drew);
    const rank = { exact: 2, close: 1 };
    const termRows = terms.map(term => {
      const r = { term, exact: 0, close: 0, none: 0, who: [] };
      drawers.forEach(p => {
        const best = p.labels.reduce((b, l) => { const m = match(l, term); return m && rank[m] > (rank[b] || 0) ? m : b; }, null);
        r[best || 'none']++; if (best) r.who.push(p.key);
      });
      return r;
    }).sort((a, b) => (a.exact + a.close) - (b.exact + b.close));
    const used = new Set(); termRows.forEach(r => r.who.forEach(k => used.add(k)));
    const said = new Map();
    drawers.forEach(p => new Set(p.labels.map(norm).filter(l => l.length > 1)).forEach(l => said.set(l, (said.get(l) || 0) + 1)));
    const vocab = { drawers: drawers.length, terms: termRows, top: [...said.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 12).map(([label, n]) => ({ label, n })),
      confidentNoWords: terms.length ? drawers.filter(p => p.greens && p.labels.length && !used.has(p.key)).map(p => p.name) : [],
      noLabels: drawers.filter(p => !p.labels.length).length };

    const all = [...people.values()];
    const sc = { g: 0, y: 0, r: 0, none: 0 };
    all.forEach(p => p.shown.forEach(x => { sc[x.pulse || 'none']++; }));
    const projector = { total: all.reduce((a, p) => a + p.shown.length, 0), colours: sc,
      rows: all.filter(p => p.shown.length).sort((a, b) => b.shown.length - a.shown.length || (a.name < b.name ? -1 : 1)).map(p => ({ name: p.name, times: p.shown.length })),
      never: all.filter(p => !p.shown.length).map(p => p.name).sort() };

    // who to check in with: said "I understand" but missed it, or asked for help (twice, or last), whether or not accuracy is known
    const watch = all.map(p => ({ name: p.name, over: p.over, aware: p.aware, reds: p.seq.filter(x => x === 'r').length, lastRed: p.seq[p.seq.length - 1] === 'r' }))
      .filter(w => w.over.length || w.aware.length || w.lastRed || w.reds >= 2)
      .sort((a, b) => b.over.length - a.over.length || b.reds - a.reds || b.aware.length - a.aware.length || (a.name < b.name ? -1 : 1));
    const boost = all.filter(p => p.under.length).map(p => p.name);

    const out = { students: all.length, sortQs: calib.filter(r => r.basis === 'sort').length, drawQs: qs.filter(q => q.kind === 'draw').length, usable: calib.some(r => !r.skipped), calib, totals, cards, shaky, ideas, watch, boost, vocab, projector };
    out.priorities = priorities(out, terms);
    return out;
  }

  // one line saying why a student is on the check-in list
  const why = w => {
    const r = [];
    if (w.over.length) r.push('said “I understand” but ' + w.over.map(x => (x.point ? 'earned no point on Q' + x.n : 'got ' + x.got + ' of ' + x.of + ' on Q' + x.n)).join(', '));
    if (w.reds >= 2) r.push('tapped “I need help” on ' + w.reds + ' questions');
    else if (w.lastRed) r.push('ended on “I need help”');
    else if (w.aware.length) r.push('knew they needed help');
    return r.join('; ');
  };
  const skipNote = k => ({ feedback: 'Instant feedback was on, so confidence is not compared here.', capped: 'Points are limited to one per team here, so a missing point is not counted as a miss.', nopoints: 'No points were given on this question, so there is nothing to compare.' }[k] || '');
  // how one question's comparison reads in words
  const rowText = r => (r.skipped ? skipNote(r.skipped) : r.basis === 'points'
    ? r.solid + ' confident and got the point, ' + r.over + ' confident but no point, ' + r.aware + ' unsure and no point, ' + r.under + ' unsure but got the point' + (r.mixed ? ', ' + r.mixed + ' in between' : '') + (r.none ? ', ' + r.none + ' gave no colour' : '')
    : r.solid + ' confident and right, ' + r.over + ' confident but missed some, ' + r.aware + ' unsure and wrong, ' + r.under + ' unsure but right' + (r.mixed ? ', ' + r.mixed + ' in between' : '') + (r.none ? ', ' + r.none + ' gave no colour' : '') + (r.noAnswer ? ', ' + r.noAnswer + ' did not answer' : ''));
  const mixText = c => (c.mix ? '“' + c.text + '” was put in ' + c.mix[0] + ' instead of ' + c.lane + ' by ' + c.mix[1] + (c.mix[1] === 1 ? ' student' : ' students') : '');
  const list = (a, n = 8) => a.slice(0, n).join(', ') + (a.length > n ? ' and ' + (a.length - n) + ' more' : '');
  // the short list at the top: what to do with the first ten minutes tomorrow
  function priorities(a, terms) {
    const p = [];
    const weak = a.ideas.filter(i => i.placed >= 2 && i.pct < T.shaky * 100);
    if (weak.length) weak.slice(0, 3).forEach(i => p.push({ h: 'Re-teach', t: i.name + ': ' + i.pct + '% right.' + (i.worst && i.worst.mix ? ' ' + mixText(i.worst) + '.' : '') }));
    else if (a.shaky.length) a.shaky.slice(0, 3).forEach(c => p.push({ h: 'Re-teach', t: '“' + c.text + '”: ' + c.pct + '% right. ' + mixText(c) + '.' }));
    const hidden = (a.ideas.length ? a.ideas : a.cards).filter(x => x.confWrong >= 2).sort((x, y) => y.confWrong - x.confWrong)[0];
    if (hidden) p.push({ h: 'Hidden misconception', t: (hidden.name || '“' + hidden.text + '”') + ': ' + hidden.confWrong + ' placements were wrong from students who said “I understand”. Check this one first, because they will not ask for help.' });
    if (a.watch.length) p.push({ h: 'Check in with', t: list(a.watch.map(w => w.name)) + '.' });
    const lowWords = a.vocab.terms.filter(r => a.vocab.drawers && (r.exact + r.close) / a.vocab.drawers < 0.5);
    if (lowWords.length) p.push({ h: 'Vocabulary', t: list(lowWords.map(r => r.term + ' (' + (r.exact + r.close) + ' of ' + a.vocab.drawers + ')'), 6) + ' showed up on few drawings.' });
    if (a.projector.never.length && a.projector.total) p.push({ h: 'Next on the projector', t: list(a.projector.never) + ' ' + (a.projector.never.length === 1 ? 'has' : 'have') + ' not had work shown yet.' });
    return p;
  }

  // plain text for a doc, an email, or a planning note
  function text(a, m = {}) {
    const L = ['Next lesson report' + (m.cls ? ' — ' + m.cls : '') + (m.date ? ' (' + m.date + ')' : ''), ''];
    if (!a.priorities.length) L.push('Nothing stood out yet. Confidence is compared with sort answers or the points you give, and vocabulary needs drawing questions plus the words you want to see.');
    a.priorities.forEach(x => L.push(x.h + ': ' + x.t));
    if (a.calib.length) {
      L.push('', 'Confidence vs accuracy (sort answers, or the points you gave on drawing questions)');
      const t = a.totals; L.push('  Confident and right ' + t.solid + ' · Confident but missed some ' + t.over + ' · Unsure but right ' + t.under + ' · Unsure and wrong ' + t.aware + ' · In between ' + t.mixed + ' · No colour ' + t.none);
      a.calib.forEach(r => L.push('  Q' + r.n + ' ' + r.q + ' (' + (r.basis === 'points' ? 'points' : 'sort') + '): ' + rowText(r)));
    }
    if (a.watch.length) L.push('', 'Check in with', ...a.watch.map(w => '  ' + w.name + ': ' + why(w)));
    if (a.boost.length) L.push('', 'Know more than they think: ' + a.boost.join(', '));
    if (a.sortQs) {
      L.push('', 'What was mixed up');
      (a.ideas.length ? a.ideas : []).forEach(i => L.push('  ' + i.name + ': ' + i.pct + '% right' + (i.confWrong ? ' · ' + i.confWrong + ' wrong from confident students' : '')));
      a.shaky.slice(0, 10).forEach(c => L.push('  Q' + c.n + ' “' + c.text + '”: ' + c.pct + '% right. ' + mixText(c)));
    }
    if (a.drawQs) {
      L.push('', 'Vocabulary (' + a.vocab.drawers + ' students on drawing questions)');
      a.vocab.terms.forEach(r => L.push('  ' + r.term + ': used by ' + r.exact + (r.close ? ', spelled differently by ' + r.close : '') + ', not used by ' + r.none));
      if (a.vocab.top.length) L.push('  Most-typed labels: ' + a.vocab.top.map(x => x.label + ' ×' + x.n).join(', '));
      if (a.vocab.noLabels) L.push('  ' + a.vocab.noLabels + (a.vocab.noLabels === 1 ? ' student typed' : ' students typed') + ' no labels');
      if (a.vocab.confidentNoWords.length) L.push('  Said “I understand” but used none of your words: ' + a.vocab.confidentNoWords.join(', '));
    }
    L.push('', 'On the projector');
    const pr = a.projector;
    L.push('  ' + pr.total + ' showing' + (pr.total === 1 ? '' : 's') + (pr.total ? ' (' + pr.colours.g + ' from students on green, ' + pr.colours.y + ' amber, ' + pr.colours.r + ' red, ' + pr.colours.none + ' no colour)' : ''));
    if (pr.rows.length) L.push('  Shown: ' + pr.rows.map(r => r.name + (r.times > 1 ? ' ×' + r.times : '')).join(', '));
    if (pr.never.length) L.push('  Not yet shown: ' + pr.never.join(', '));
    return L.join('\n');
  }
  return { T, analyze, text, parseTerms, match, norm, mixText, why, rowText, skipNote };
})();
