// Sort questions, shared by the student page, the teacher pages and the projector. Load before tcommon.js.
// A sort question: students drop sticky-note cards into lanes. The teacher's copy holds the answer key (each card's lane) and an
// optional idea tag per card; the server keeps the key and never sends it to students or the projector.
//   { question, bg:'blank', img:null, kind:'sort', sort:{ lanes:[{id,name}], cards:[{id,text,lane,idea}], shuffle, fb:'reveal'|'now' } }
const SK = {
  LANES: 6, CARDS: 24,
  str: (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n),

  // The same rules the server applies. Returns null unless there are 2+ lanes and 2+ cards that each belong in a lane.
  clean(s) {
    if (!s || typeof s !== 'object') return null;
    const lanes = [], ids = new Set();
    (Array.isArray(s.lanes) ? s.lanes : []).slice(0, SK.LANES).forEach(l => {
      const id = l && typeof l.id === 'string' && /^[A-Za-z0-9]{1,8}$/.test(l.id) && !ids.has(l.id) ? l.id : null, name = id && SK.str(l.name, 24);
      if (id && name) { ids.add(id); lanes.push({ id, name }); }
    });
    const cards = [], seen = new Set();
    (Array.isArray(s.cards) ? s.cards : []).slice(0, SK.CARDS).forEach(c => {
      if (!c || !Number.isInteger(c.id) || c.id < 1 || c.id > 1e6 || seen.has(c.id)) return;
      const text = SK.str(c.text, 60); if (!text || !ids.has(c.lane)) return;
      seen.add(c.id); cards.push({ id: c.id, text, lane: c.lane, idea: SK.str(c.idea, 30) });
    });
    if (lanes.length < 2 || cards.length < 2) return null;
    return { lanes, cards, ideas: [...new Set(cards.map(c => c.idea).filter(Boolean))], shuffle: s.shuffle !== false, fb: s.fb === 'now' ? 'now' : 'reveal' };
  },
  // ---- movable pieces on a Draw question (see MODELS_PLAN.md) ----
  // The teacher's copy of a model: { stage:'wide'|'tall', spots:'hidden'|'shown', fb:'reveal'|'now', tol,
  //   pieces:[{ id, label, art, x, y (where students find it), kx, ky (where it belongs), idea }] }.
  // Positions are in stage units (wide 1000 x 625, tall 625 x 1000), centre of the piece, so every screen shape agrees.
  // The server keeps kx, ky, idea and tol away from students unless spots is 'shown'.
  MODEL: { PIECES: 12, ARTS: ['earth', 'sun', 'moon', 'arrow', 'card'], A: 108, TOL: [20, 150], STAGES: { wide: { w: 1000, h: 625 }, tall: { w: 625, h: 1000 } } },
  stageOf: m => SK.MODEL.STAGES[m && m.stage === 'tall' ? 'tall' : 'wide'],
  // exact rules of the server's cleanModel. Returns null unless there are 2+ pieces with a label and an answer spot.
  cleanModel(m) {
    if (!m || typeof m !== 'object') return null;
    const M = SK.MODEL, st = SK.stageOf(m), lo = M.A / 2, num = v => typeof v === 'number' && isFinite(v);
    const cx = v => Math.round(Math.min(st.w - lo, Math.max(lo, v))), cy = v => Math.round(Math.min(st.h - lo, Math.max(lo, v)));
    const pieces = [], seen = new Set();
    (Array.isArray(m.pieces) ? m.pieces : []).slice(0, M.PIECES).forEach(p => {
      if (!p || !Number.isInteger(p.id) || p.id < 1 || p.id > 1e6 || seen.has(p.id)) return;
      const label = SK.str(p.label, 24); if (!label || !num(p.x) || !num(p.y) || !num(p.kx) || !num(p.ky)) return;
      seen.add(p.id); pieces.push({ id: p.id, label, art: M.ARTS.includes(p.art) ? p.art : 'card', x: cx(p.x), y: cy(p.y), kx: cx(p.kx), ky: cy(p.ky), idea: SK.str(p.idea, 30) });
    });
    if (pieces.length < 2) return null;
    return { stage: m.stage === 'tall' ? 'tall' : 'wide', spots: m.spots === 'shown' ? 'shown' : 'hidden', fb: m.fb === 'now' ? 'now' : 'reveal', tol: num(m.tol) ? Math.round(Math.min(M.TOL[1], Math.max(M.TOL[0], m.tol))) : 60, pieces };
  },
  // A tidy starting scatter: free spots on the stage that are well away from every answer spot, handed out in a shuffled order.
  // Used by the editor's Scatter button and for imported pieces that have no start position.
  scatter(m) {
    const M = SK.MODEL, st = SK.stageOf(m), lo = M.A / 2, P = m.pieces, far = M.A * 1.3, gap = M.A * 1.15, cand = [];
    for (let x = lo + 10; x <= st.w - lo - 10; x += 60) for (let y = lo + 10; y <= st.h - lo - 10; y += 60) {
      const d = Math.min(...P.map(p => Math.hypot(x - p.kx, y - p.ky)));
      if (d >= far) cand.push({ x, y, d });
    }
    cand.sort((a, b) => b.d - a.d);
    const pick = [];
    cand.forEach(c => { if (pick.length < P.length && pick.every(q => Math.hypot(c.x - q.x, c.y - q.y) >= gap)) pick.push(c); });
    while (pick.length < P.length) pick.push({ x: lo + 10 + pick.length * 20, y: st.h - lo - 10 }); // a crowded stage: stack along the bottom rather than fail
    const ord = SK.order(P.map(p => ({ id: p.id })), 'scatter' + P.length, true).map(c => c.id);
    P.forEach((p, i) => { const c = pick[ord.indexOf(p.id)]; p.x = Math.round(c.x); p.y = Math.round(c.y); });
    return m;
  },
  // plain-language problems with a draft model, shown in the editor; an empty list means it can be saved
  modelIssues(m) {
    const out = [], P = m.pieces, A = SK.MODEL.A;
    if (P.length < 2) out.push('Add at least 2 pieces.');
    if (P.some(p => !p.label.trim())) out.push('A piece has no label.');
    const nm = p => '“' + (p.label.trim() || 'A piece') + '”';
    outer: for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      if (Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) < A * .9) { out.push(nm(P[i]) + ' and ' + nm(P[j]) + ' sit on top of each other at the start. Drag one in Student start, or press Scatter.'); break outer; }
    }
    outer2: for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      if (Math.hypot(P[i].kx - P[j].kx, P[i].ky - P[j].ky) < m.tol) { out.push(nm(P[i]) + ' and ' + nm(P[j]) + ' have answer spots closer than “how close counts”. Move one, or choose Tight.'); break outer2; }
    }
    return out;
  },
  // Is each placed piece within tol of its answer spot? m = full model; pl = { pieceId: { x, y } } (only pieces the student moved).
  modelCheck(m, pl) {
    const ok = {}; let right = 0, put = 0;
    m.pieces.forEach(p => { const q = pl && pl[p.id]; if (!q) return; put++; ok[p.id] = Math.hypot(q.x - p.kx, q.y - p.ky) <= m.tol; if (ok[p.id]) right++; });
    return { ok, right, put, total: m.pieces.length };
  },
  // For each wrong piece a student placed: the piece whose answer spot it sits on (within "how close counts"), or null when it is nowhere near
  // any spot. { pieceId: otherPieceId | null }; right and unplaced pieces are not in it. This is the "biggest mix-up" the results panel shows.
  modelMix(m, pl) {
    const out = {};
    m.pieces.forEach(p => {
      const q = pl && pl[p.id]; if (!q || Math.hypot(q.x - p.kx, q.y - p.ky) <= m.tol) return;
      let best = null, bd = m.tol;
      m.pieces.forEach(o => { if (o.id === p.id) return; const d = Math.hypot(q.x - o.kx, q.y - o.ky); if (d <= bd) { bd = d; best = o.id; } });
      out[p.id] = best;
    });
    return out;
  },
  // Everything the class results panel shows, from the full model (with the key) and the students: [{ id, name, team, pl, ... }].
  // A piece's percent is out of the students who moved it (as with Sort cards); a student's score is pieces right out of all pieces.
  modelStats(m, students) {
    const all = students.map(s => ({ ...s, pl: s.pl || {}, g: SK.modelCheck(m, s.pl), mix: SK.modelMix(m, s.pl) }));
    const started = all.filter(s => s.g.put > 0), waiting = all.filter(s => !s.g.put);
    const stat = m.pieces.map(p => {
      const ans = started.filter(s => s.pl[p.id]), right = ans.filter(s => s.g.ok[p.id]).length, swaps = {};
      ans.forEach(s => { if (s.mix[p.id] != null) swaps[s.mix[p.id]] = (swaps[s.mix[p.id]] || 0) + 1; });
      return { ...p, idea: p.idea || '', n: ans.length, right, pct: ans.length ? Math.round(100 * right / ans.length) : null, swaps };
    });
    const names = [...new Set(stat.map(k => k.idea).filter(Boolean))];
    const ideas = names.map(n => { const ks = stat.filter(k => k.idea === n && k.pct != null); return { name: n, pieces: stat.filter(k => k.idea === n).length, pct: ks.length ? Math.round(ks.reduce((a, k) => a + k.pct, 0) / ks.length) : null }; });
    const seen = new Map();
    started.forEach(s => { if (!s.team) return; let t = seen.get(s.team.id); if (!t) seen.set(s.team.id, (t = { team: s.team, right: 0, put: 0, n: 0 })); t.right += s.g.right; t.put += s.g.total; t.n++; });
    const teams = [...seen.values()].map(t => ({ ...t, pct: Math.round(100 * t.right / t.put) }));
    let worst = null; stat.forEach(k => Object.entries(k.swaps).forEach(([id, n]) => { if (!worst || n > worst.n) worst = { k, other: +id, n }; }));
    return { pieces: m.pieces, all, started, waiting, stat, ideas, teams, worst };
  },
  // ---- one validator for every way a question can arrive (editor, file import, "Build with AI" paste) ----
  // These are client copies of the server's cleanHtml / cleanSort limits, plus the tag rules. Problems are written in plain words
  // for a teacher; "notes" are small fixes that were made on the way in (a long name shortened, a sixth tag left out).
  MAX_TEXT: 2000, MAX_TAGS: 5, TAG_LEN: 30, MAX_QS: 200,
  // exact copy of the server's cleanHtml: only <b> <i> <u> <br> survive, any other tag is dropped, stray < > are escaped
  cleanHtml(s) {
    return String(s || '').slice(0, SK.MAX_TEXT).split(/(<[^>]*>)/).map(tok => {
      const m = /^<(\/?)(b|i|u)>$/i.exec(tok);
      if (m) return '<' + m[1] + m[2].toLowerCase() + '>';
      if (/^<br\s*\/?>$/i.test(tok)) return '<br>';
      if (/^<[^>]*>$/.test(tok)) return '';
      return tok.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }).join('');
  },
  plain: h => String(h || '').replace(/<br>/g, ' ').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
  // Tags match without regard to capitals or extra spaces ("rock cycle" = "Rock Cycle"); text only, never markup.
  tagKey: t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().toLowerCase(),
  cleanTag: t => String(t == null ? '' : t).replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SK.TAG_LEN).trim(),
  // -> { tags, notes }: up to 5 distinct tags, 30 characters each. Accepts an array or one comma-separated string.
  cleanTags(v) {
    const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [], tags = [], seen = new Set(), notes = [];
    let longer = 0, extra = 0;
    raw.forEach(x => {
      if (typeof x !== 'string' && typeof x !== 'number') return;
      const full = String(x).replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim(), t = SK.cleanTag(x), k = SK.tagKey(t);
      if (!t || seen.has(k)) return;
      if (full.length > SK.TAG_LEN) longer++;
      if (tags.length >= SK.MAX_TAGS) { extra++; return; }
      seen.add(k); tags.push(t);
    });
    if (longer) notes.push(longer === 1 ? 'a tag was shortened to ' + SK.TAG_LEN + ' characters' : longer + ' tags were shortened to ' + SK.TAG_LEN + ' characters');
    if (extra) notes.push(extra === 1 ? 'a sixth tag was left out (the most is ' + SK.MAX_TAGS + ')' : extra + ' extra tags were left out (the most is ' + SK.MAX_TAGS + ')');
    return { tags, notes };
  },
  // A question and the tags it counts for: its own plus its set's, each once.
  tagsOf(q, set) { return SK.cleanTags([...(set && set.tags || []), ...(q && q.tags || [])]).tags; },
  // Check one question that came from outside. -> { q, problems, notes }. q is null when there are problems.
  // Draw: { question, bg:'blank'|'graph'|'lined', tags }.  Sort: { question, kind:'sort', tags, sort:{ lanes:[{id,name}], cards:[{id,text,lane,idea}] } }.
  checkQuestion(raw) {
    const problems = [], notes = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { q: null, problems: ['this is not a question (it should be an object with a "question" field)'], notes };
    const rawText = String(raw.question == null ? '' : raw.question);
    if (rawText.length > SK.MAX_TEXT) notes.push('the question text was shortened to ' + SK.MAX_TEXT + ' characters');
    const text = SK.cleanHtml(rawText);
    if (/<(?!\/?(?:b|i|u|br)\s*\/?>)[^>]*>/i.test(rawText.slice(0, SK.MAX_TEXT))) notes.push('formatting other than bold, italic, underline and line breaks was removed');
    const img = typeof raw.img === 'string' && raw.img.startsWith('data:image/jpeg;base64,') && raw.img.length < 4e6 ? raw.img : null;
    if (!SK.plain(text).trim() && !img) problems.push('has no question text');
    const tg = SK.cleanTags(raw.tags); notes.push(...tg.notes);
    let q = null;
    if (raw.kind === 'sort' || (raw.sort && typeof raw.sort === 'object')) {
      const s = raw.sort;
      if (!s || typeof s !== 'object') problems.push('is a sort question with no "sort" part');
      else {
        const lanesIn = Array.isArray(s.lanes) ? s.lanes : [], cardsIn = Array.isArray(s.cards) ? s.cards : [];
        if (lanesIn.length < 2) problems.push('needs at least 2 lanes (it has ' + lanesIn.length + ')');
        if (lanesIn.length > SK.LANES) problems.push('has ' + lanesIn.length + ' lanes, and the most is ' + SK.LANES);
        if (cardsIn.length < 2) problems.push('needs at least 2 cards (it has ' + cardsIn.length + ')');
        if (cardsIn.length > SK.CARDS) problems.push('has ' + cardsIn.length + ' cards, and the most is ' + SK.CARDS);
        const ids = new Set(), lanes = [];
        lanesIn.slice(0, SK.LANES).forEach((l, i) => {
          const nm = l && SK.str(l.name, 100), id = l && l.id;
          if (!l || typeof l !== 'object' || !nm) return problems.push('lane ' + (i + 1) + ' has no name');
          if (typeof id !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(id)) return problems.push('the lane "' + nm.slice(0, 24) + '" needs an id of 1 to 8 letters or numbers');
          if (ids.has(id)) return problems.push('two lanes share the id "' + id + '"');
          if (nm.length > 24) notes.push('the lane name "' + nm.slice(0, 24) + '…" was shortened to 24 characters');
          ids.add(id); lanes.push({ id, name: nm }); // SK.clean below does the cutting, exactly as the server does
        });
        const valid = c => c && Number.isInteger(c.id) && c.id >= 1 && c.id <= 1e6;
        const useIds = cardsIn.every(valid) && new Set(cardsIn.map(c => c.id)).size === cardsIn.length; // otherwise cards are simply numbered 1, 2, 3…
        const cards = [];
        cardsIn.slice(0, SK.CARDS).forEach((c, i) => {
          const t = c && SK.str(c.text, 200);
          if (!c || typeof c !== 'object' || !t) return problems.push('card ' + (i + 1) + ' has no text');
          if (t.length > 60) notes.push('the card "' + t.slice(0, 60) + '…" was shortened to 60 characters');
          const shown = t.slice(0, 60);
          if (!ids.has(c.lane)) return problems.push('the card "' + shown + '" points to a lane that does not exist' + (c.lane == null || c.lane === '' ? ' (it has no lane)' : ' ("' + SK.str(c.lane, 20) + '")'));
          const idea = SK.str(c.idea, 100); if (idea.length > 30) notes.push('the idea "' + idea.slice(0, 30) + '…" was shortened to 30 characters');
          cards.push({ id: useIds ? c.id : i + 1, text: t, lane: c.lane, idea });
        });
        if (!problems.length) {
          const sort = SK.clean({ lanes, cards, shuffle: s.shuffle, fb: s.fb });
          if (!sort) problems.push('is not a complete sort question'); else q = { question: text, bg: 'blank', img: null, kind: 'sort', sort };
        }
      }
    } else {
      let bg = ['graph', 'lined', 'blank', 'photo'].includes(raw.bg) ? raw.bg : null;
      if (!bg) { bg = 'blank'; if (raw.bg != null && raw.bg !== '') notes.push('the background "' + SK.str(raw.bg, 20) + '" is not blank, graph or lined, so it was set to blank'); }
      if (bg === 'photo' && !img) { bg = 'blank'; }
      let model = null;
      if (raw.model != null) {
        const m = raw.model, M = SK.MODEL;
        if (typeof m !== 'object' || Array.isArray(m)) problems.push('has a "model" that is not an object');
        else {
          const pin = Array.isArray(m.pieces) ? m.pieces : [], st = SK.stageOf(m);
          if (pin.length < 2) problems.push('needs at least 2 pieces (it has ' + pin.length + ')');
          if (pin.length > M.PIECES) problems.push('has ' + pin.length + ' pieces, and the most is ' + M.PIECES);
          const num = v => typeof v === 'number' && isFinite(v);
          const valid = c => c && Number.isInteger(c.id) && c.id >= 1 && c.id <= 1e6;
          const useIds = pin.every(valid) && new Set(pin.map(c => c.id)).size === pin.length; // otherwise pieces are simply numbered 1, 2, 3…
          let noStart = 0; const pieces = [];
          pin.slice(0, M.PIECES).forEach((p, i) => {
            const lb = p && SK.str(p.label, 100);
            if (!p || typeof p !== 'object' || !lb) return problems.push('piece ' + (i + 1) + ' has no label');
            if (lb.length > 24) notes.push('the piece "' + lb.slice(0, 24) + '…" was shortened to 24 characters');
            if (!num(p.kx) || !num(p.ky)) return problems.push('the piece "' + lb.slice(0, 24) + '" has no answer spot (it needs "kx" and "ky", from 0 to ' + st.w + ' across and 0 to ' + st.h + ' down)');
            if (p.art != null && !M.ARTS.includes(p.art)) notes.push('the picture "' + SK.str(p.art, 20) + '" is not one of ' + M.ARTS.join(', ') + ', so the piece became a text card');
            if (!num(p.x) || !num(p.y)) noStart++;
            pieces.push({ id: useIds ? p.id : i + 1, label: lb, art: p.art, x: num(p.x) ? p.x : p.kx, y: num(p.y) ? p.y : p.ky, kx: p.kx, ky: p.ky, idea: p.idea });
          });
          if (!problems.length) {
            model = SK.cleanModel({ ...m, pieces });
            if (!model) problems.push('is not a complete model');
            else { if (noStart) { SK.scatter(model); notes.push('the pieces had no start positions, so they were scattered'); } }
          }
        }
      }
      if (!problems.length) { q = { question: text, bg, img: bg === 'photo' ? img : null }; if (model) q.model = model; }
    }
    if (q && tg.tags.length) q.tags = tg.tags;
    return { q: problems.length ? null : q, problems, notes };
  },
  // Find the JSON in a reply that may be wrapped in a code block or have sentences around it: from a "[" or "{" to its matching close.
  extractJson(text, want) { // `want(value)` can say which JSON is the one meant, so a "[1]" in a sentence is passed over
    const t = String(text == null ? '' : text);
    for (let i = 0; i < t.length; i++) {
      const open = t[i]; if (open !== '[' && open !== '{') continue;
      let depth = 0, inStr = false, esc = false, end = -1;
      for (let j = i; j < t.length; j++) {
        const c = t[j];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true; else if (c === '[' || c === '{') depth++; else if (c === ']' || c === '}') { depth--; if (!depth) { end = j; break; } }
      }
      if (end < 0) continue;
      try { const v = JSON.parse(t.slice(i, end + 1)); if (v && typeof v === 'object' && (!want || want(v))) return v; } catch {}
    }
    return null;
  },
  // Turn a pasted reply (or a set file) into a list of sets. -> { sets:[{ name, tags, questions:[raw] }], error }
  parseSets(text) {
    const looks = v => (Array.isArray(v) ? v.some(x => x && typeof x === 'object' && ('questions' in x || 'question' in x)) : !!v && ('questions' in v || 'sets' in v || 'question' in v));
    const v = typeof text === 'string' ? SK.extractJson(text, looks) || SK.extractJson(text) : text;
    if (v == null) return { sets: [], error: 'I could not find any JSON in that text. Ask the AI to reply with JSON only, and paste the whole reply.' };
    const one = (o, name) => ({ name: SK.str(o && o.name, 60) || name, tags: SK.cleanTags(o && o.tags).tags, questions: Array.isArray(o && o.questions) ? o.questions : [] });
    let sets = [];
    if (Array.isArray(v)) sets = v.length && v.every(x => x && Array.isArray(x.questions)) ? v.map(x => one(x, 'AI set')) : v.length && v.every(x => x && typeof x === 'object') ? [{ name: 'AI set', tags: [], questions: v }] : [];
    else if (Array.isArray(v.sets)) sets = v.sets.map(x => one(x, 'AI set'));
    else if (Array.isArray(v.questions)) sets = [one(v, 'AI set')];
    else if (v.question !== undefined) sets = [{ name: 'AI set', tags: [], questions: [v] }];
    sets = sets.filter(s => s.questions.length);
    return sets.length ? { sets, error: '' } : { sets: [], error: 'That JSON has no questions in it. It should look like [{"name": "...", "questions": [ ... ]}].' };
  },
  // Check every question of every set. -> [{ name, tags, rows:[{ n, q, problems, notes, on }], extra }]; used by "Build with AI" and by file import.
  checkSets(sets) {
    return sets.map(s => ({
      name: s.name, tags: s.tags,
      rows: s.questions.slice(0, SK.MAX_QS).map((raw, i) => { const c = SK.checkQuestion(raw); return { n: i + 1, q: c.q, problems: c.problems, notes: c.notes, on: !!c.q }; }),
      extra: Math.max(0, s.questions.length - SK.MAX_QS),
    }));
  },
  // plain-language problems with a draft, shown in the editor; an empty list means it can be saved
  issues(s) {
    const out = [], un = s.cards.filter(c => !c.lane || !s.lanes.some(l => l.id === c.lane)).length;
    if (s.lanes.length < 2) out.push('Add at least 2 lanes.');
    if (s.cards.length < 2) out.push('Add at least 2 cards.');
    if (s.lanes.some(l => !l.name.trim())) out.push('A lane has no name.');
    if (s.cards.some(c => !c.text.trim())) out.push('A card is empty.');
    if (un) out.push(un + (un === 1 ? ' card is' : ' cards are') + ' not in the key yet. Drag ' + (un === 1 ? 'it' : 'them') + ' into a lane on the right.');
    return out;
  },
  // every student sees the cards in their own order (stable for that student, so a refresh does not reshuffle)
  order(cards, seed, shuffle) {
    const a = cards.slice(); if (!shuffle) return a;
    let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822519) + 0x6D2B79F5 | 0) >>> 0) / 4294967296;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  // sk = { lane:{cardId:laneId}, idea:{cardId:name} } as the server sends it to hosts
  grade(sk, cards, placed) {
    let right = 0, put = 0; const ok = {};
    cards.forEach(c => { const p = placed && placed[c.id]; if (p) put++; ok[c.id] = !!p && p === sk.lane[c.id]; if (ok[c.id]) right++; });
    return { right, put, total: cards.length, ok };
  },
  tier: p => (p >= 75 ? 'good' : p >= 55 ? 'mid' : 'bad'),
  tierWord: p => (p >= 75 ? 'Solid' : p >= 55 ? 'Close' : 'Reteach'),
  csv(rows) { return '﻿' + rows.map(r => r.map(x => { x = String(x == null ? '' : x); if (/^[=+\-@]/.test(x)) x = "'" + x; return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(',')).join('\r\n'); },

  // a sticky note
  note(card, cls) { const d = document.createElement('div'); d.className = 'nc' + (cls ? ' ' + cls : ''); d.dataset.card = card.id; d.textContent = card.text; return d; },
  // Drag sticky notes (mouse or touch). Drop zones are any element with data-zone; onDrop(cardId, zone) runs on release.
  // A press that barely moves is a tap, not a drag: nothing happens here and the page's own click handler gets it.
  drag(root, onDrop) {
    root.addEventListener('pointerdown', e => {
      const el = e.target.closest('.nc[data-card]');
      if (!el || !root.contains(el) || e.button > 0) return;
      e.preventDefault();
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, x0 = e.clientX, y0 = e.clientY;
      let g = null, last = null;
      const zoneAt = (x, y) => { if (g) g.hidden = true; const t = document.elementFromPoint(x, y); if (g) g.hidden = false; return t && t.closest('[data-zone]'); };
      const mv = ev => {
        if (!g) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
          g = el.cloneNode(true); g.classList.add('ghost'); g.style.cssText = 'width:' + r.width + 'px;left:' + r.left + 'px;top:' + r.top + 'px'; document.body.append(g); el.classList.add('drag-src');
        }
        g.style.left = ev.clientX - dx + 'px'; g.style.top = ev.clientY - dy + 'px';
        const z = zoneAt(ev.clientX, ev.clientY); if (z !== last) { if (last) last.classList.remove('over'); if (z) z.classList.add('over'); last = z; }
      };
      const up = ev => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        if (!g) return;
        const z = zoneAt(ev.clientX, ev.clientY); if (last) last.classList.remove('over');
        g.remove(); el.classList.remove('drag-src');
        if (z && ev.type !== 'pointercancel' && root.contains(z)) onDrop(+el.dataset.card, z.dataset.zone);
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
  }
};
