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
  // ARTS: built-in pictures ('img' is the teacher's own picture, a data: image kept with the piece). The moon phases are as seen from Earth,
  // lit on the right (or on the left with -l). Angles are degrees, clockwise, 0 = the picture as drawn (an arrow points right).
  MODEL: { PIECES: 12, ARTS: ['earth', 'sun', 'moon', 'arrow', 'card', 'moon-new', 'moon-crescent', 'moon-quarter', 'moon-gibbous', 'moon-full', 'moon-crescent-l', 'moon-quarter-l', 'moon-gibbous-l', 'img'],
    A: 108, SIZE: [0.5, 4], AR: [0.2, 5], TOL: [20, 150], ZONE: [20, 400], ATOL: [10, 90], IMG_MAX: 140000, IMG_TOTAL: 700000, STAGES: { wide: { w: 1000, h: 625 }, tall: { w: 625, h: 1000 } } },
  BGS: ['graph', 'lined', 'blank', 'photo', 'orbit', 'rings', 'phases', 'plates'], // page backgrounds; the last four are drawn diagrams (common.js)
  ang: v => ((Math.round(v) % 360) + 360) % 360,
  angDiff: (a, b) => { const d = (((a - b) % 360) + 360) % 360; return Math.min(d, 360 - d); },
  imgOk: s => typeof s === 'string' && s.length <= SK.MODEL.IMG_MAX && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(s),
  stageOf: m => SK.MODEL.STAGES[m && m.stage === 'tall' ? 'tall' : 'wide'],
  // how far from its answer spot a piece may be and still count: the piece's own zone `tl` (20 to 400) if the teacher set one, else the question's `tol`
  tolOf: (m, p) => (typeof p.tl === 'number' && isFinite(p.tl) ? p.tl : m.tol),
  // The size of a piece on the board, in stage units: its picture size (108) times its own size setting `s` (0.5 to 4). A text card is a wider
  // note; a picture of your own takes its own shape (`ar` = width / height) with its long side at that size. The server has the same rule.
  boxOf(p) {
    const M = SK.MODEL, ok = v => typeof v === 'number' && isFinite(v), s = ok(p && p.s) ? Math.min(M.SIZE[1], Math.max(M.SIZE[0], p.s)) : 1;
    if (p.art === 'card') return { w: M.A * 1.3 * s, h: M.A * .8 * s };
    if (p.art === 'img' && ok(p.ar) && p.ar > 0) { const ar = Math.min(M.AR[1], Math.max(M.AR[0], p.ar)); return ar >= 1 ? { w: M.A * s, h: M.A * s / ar } : { w: M.A * s * ar, h: M.A * s }; }
    return { w: M.A * s, h: M.A * s };
  },
  // exact rules of the server's cleanModel. Returns null unless there are 2+ pieces with a label and an answer spot.
  cleanModel(m) {
    if (!m || typeof m !== 'object') return null;
    const M = SK.MODEL, st = SK.stageOf(m), num = v => typeof v === 'number' && isFinite(v), cl = (v, a, b) => Math.min(b, Math.max(a, v));
    const pieces = [], seen = new Set(); let imgBytes = 0;
    (Array.isArray(m.pieces) ? m.pieces : []).slice(0, M.PIECES).forEach(p => {
      if (!p || !Number.isInteger(p.id) || p.id < 1 || p.id > 1e6 || seen.has(p.id)) return;
      const label = SK.str(p.label, 24); if (!label || !num(p.x) || !num(p.y) || !num(p.kx) || !num(p.ky)) return;
      let art = M.ARTS.includes(p.art) ? p.art : 'card', img = null;
      if (art === 'img') { if (SK.imgOk(p.img) && imgBytes + p.img.length <= M.IMG_TOTAL) { img = p.img; imgBytes += img.length; } else art = 'card'; }
      seen.add(p.id);
      const s = num(p.s) ? Math.round(cl(p.s, M.SIZE[0], M.SIZE[1]) * 20) / 20 : 1, ar = art === 'img' && num(p.ar) ? Math.round(cl(p.ar, M.AR[0], M.AR[1]) * 100) / 100 : null;
      const bx = SK.boxOf({ art, s, ar }), cx = v => Math.round(cl(v, bx.w / 2, st.w - bx.w / 2)), cy = v => Math.round(cl(v, bx.h / 2, st.h - bx.h / 2));
      const o = { id: p.id, label, art, x: cx(p.x), y: cy(p.y), kx: cx(p.kx), ky: cy(p.ky), idea: SK.str(p.idea, 30) };
      if (s !== 1) o.s = s;
      if (num(p.tl)) o.tl = Math.round(cl(p.tl, M.ZONE[0], M.ZONE[1]));
      if (img) { o.img = img; if (ar) o.ar = ar; }
      if (p.turn === true) { o.turn = true; o.a = SK.ang(num(p.a) ? p.a : 0); o.ka = SK.ang(num(p.ka) ? p.ka : 0); }
      pieces.push(o);
    });
    if (pieces.length < 2) return null;
    return { stage: m.stage === 'tall' ? 'tall' : 'wide', spots: m.spots === 'shown' ? 'shown' : 'hidden', fb: m.fb === 'now' ? 'now' : 'reveal', tol: num(m.tol) ? Math.round(Math.min(M.TOL[1], Math.max(M.TOL[0], m.tol))) : 60, atol: num(m.atol) ? Math.round(Math.min(M.ATOL[1], Math.max(M.ATOL[0], m.atol))) : 30, pieces };
  },
  // A tidy starting scatter: free spots on the stage that are well away from every answer spot, handed out in a shuffled order.
  // Used by the editor's Scatter button and for imported pieces that have no start position.
  // `avoid` = [{ x, y, r }]: parts of the background (a Sun, an Earth) that a piece should not start on top of; see bgAvoid.
  scatter(m, avoid) {
    const M = SK.MODEL, st = SK.stageOf(m), P = m.pieces, av = avoid || [];
    const big = M.A * Math.max(...P.map(p => Math.min(M.SIZE[1], Math.max(M.SIZE[0], p.s || 1)))), lo = big / 2; // sized for the biggest piece
    let pick = [];
    for (const f of [1, .8, .6, .4]) { // big pieces crowd the stage: ask for less room between them before giving up
      const far = big * 1.3 * f, gap = big * 1.15 * f, cand = [];
      for (let x = lo + 10; x <= st.w - lo - 10; x += 60) for (let y = lo + 10; y <= st.h - lo - 10; y += 60) {
        const d = Math.min(...P.map(p => Math.hypot(x - p.kx, y - p.ky)), ...av.map(a => Math.hypot(x - a.x, y - a.y) - a.r));
        if (d >= far) cand.push({ x, y, d });
      }
      cand.sort((a, b) => b.d - a.d);
      pick = []; cand.forEach(c => { if (pick.length < P.length && pick.every(q => Math.hypot(c.x - q.x, c.y - q.y) >= gap)) pick.push(c); });
      if (pick.length >= P.length) break;
    }
    while (pick.length < P.length) pick.push({ x: Math.min(st.w - lo, lo + 10 + pick.length * 20), y: st.h - lo - 10 }); // a crowded stage: stack along the bottom rather than fail
    const ord = SK.order(P.map(p => ({ id: p.id })), 'scatter' + P.length, true).map(c => c.id);
    P.forEach((p, i) => { const c = pick[ord.indexOf(p.id)]; p.x = Math.round(c.x); p.y = Math.round(c.y); if (p.turn) p.a = SK.ang((p.ka || 0) + 90 + (p.id * 53) % 181); }); // a turning piece starts 90 to 270 degrees from its answer
    return m;
  },
  // the middle of a drawn diagram (the Sun, the Earth, the layers), so pieces do not start on top of it
  bgAvoid(bg, m) {
    const st = SK.stageOf(m), k = Math.min(st.w / 1000, st.h / 625), r = { orbit: 70, phases: 60, rings: 220 }[bg];
    return r ? [{ x: st.w / 2, y: st.h / 2, r: r * k }] : [];
  },
  // Problems that stop a question from working, in plain words, shown in the editor. An empty list means it can be saved.
  // Things worth a look that do NOT stop it (pieces close together, a piece that already faces the answer) are in modelWarnings.
  modelIssues(m) {
    const out = [], P = m.pieces;
    if (P.length < 2) out.push('Add at least 2 pieces.');
    if (P.some(p => !p.label.trim())) out.push('A piece has no label.');
    const nm = p => '“' + (p.label.trim() || 'A piece') + '”';
    const noPic = P.find(p => p.art === 'img' && !SK.imgOk(p.img)); if (noPic) out.push(nm(noPic) + ' has no picture yet. Choose a picture, or pick a different one from the list.');
    if (P.reduce((n, p) => n + (p.art === 'img' && SK.imgOk(p.img) ? p.img.length : 0), 0) > SK.MODEL.IMG_TOTAL) out.push('The pictures are too big together. Remove one, or use smaller pictures.');
    return out;
  },
  // Worth a look, but the question works and can be saved. A jigsaw (continents that fit together) has pieces whose answer spots are close by nature.
  modelWarnings(m) {
    const out = [], P = m.pieces, big = p => { const b = SK.boxOf(p); return Math.max(b.w, b.h); };
    const nm = p => '“' + (p.label.trim() || 'A piece') + '”';
    outer: for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      if (Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) < .9 * (big(P[i]) + big(P[j])) / 2) { out.push(nm(P[i]) + ' and ' + nm(P[j]) + ' overlap at the start, so one hides the other. Drag one in Student start, or press Scatter.'); break outer; }
    }
    outer2: for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      if (Math.hypot(P[i].kx - P[j].kx, P[i].ky - P[j].ky) < Math.max(SK.tolOf(m, P[i]), SK.tolOf(m, P[j]))) { out.push(nm(P[i]) + ' and ' + nm(P[j]) + ' have answer spots closer than “how close counts”, so a piece put on the other’s spot would also count as right. That is fine for a jigsaw; choose Tight or Very tight to be stricter.'); break outer2; }
    }
    const atol = m.atol || 30, face = P.find(p => p.turn && SK.angDiff(p.a || 0, p.ka || 0) <= atol);
    if (face) out.push(nm(face) + ' already faces the right way at the start. Turn it in Student start.');
    return out;
  },
  // Is each placed piece within tol of its answer spot (and, for a piece that turns, facing within atol of the answer)? m = full model; pl = { pieceId: { x, y, a? } } (only pieces the student moved).
  modelCheck(m, pl) {
    const ok = {}; let right = 0, put = 0;
    m.pieces.forEach(p => { const q = pl && pl[p.id]; if (!q) return; put++; ok[p.id] = Math.hypot(q.x - p.kx, q.y - p.ky) <= SK.tolOf(m, p) && (!p.turn || SK.angDiff(q.a == null ? (p.a || 0) : q.a, p.ka || 0) <= (m.atol || 30)); if (ok[p.id]) right++; });
    return { ok, right, put, total: m.pieces.length };
  },
  // For each wrong piece a student placed: the piece whose answer spot it sits on (within "how close counts"), or null when it is nowhere near
  // any spot. { pieceId: otherPieceId | null }; right and unplaced pieces are not in it. This is the "biggest mix-up" the results panel shows.
  // A piece in its own spot but turned the wrong way is SK.TURN (-1).
  TURN: -1,
  modelMix(m, pl) {
    const out = {}, ok = SK.modelCheck(m, pl).ok;
    m.pieces.forEach(p => {
      const q = pl && pl[p.id]; if (!q || ok[p.id]) return;
      if (Math.hypot(q.x - p.kx, q.y - p.ky) <= SK.tolOf(m, p)) { out[p.id] = SK.TURN; return; }
      let best = null, bd = Infinity;
      m.pieces.forEach(o => { if (o.id === p.id) return; const d = Math.hypot(q.x - o.kx, q.y - o.ky); if (d <= SK.tolOf(m, o) && d < bd) { bd = d; best = o.id; } });
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
      ans.forEach(s => { if (s.mix[p.id] > 0) swaps[s.mix[p.id]] = (swaps[s.mix[p.id]] || 0) + 1; });
      return { ...p, idea: p.idea || '', n: ans.length, right, pct: ans.length ? Math.round(100 * right / ans.length) : null, swaps, turned: ans.filter(s => s.mix[p.id] === SK.TURN).length };
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
      let bg = SK.BGS.includes(raw.bg) ? raw.bg : null;
      if (!bg) { bg = 'blank'; if (raw.bg != null && raw.bg !== '') notes.push('the background "' + SK.str(raw.bg, 20) + '" is not one of ' + SK.BGS.filter(b => b !== 'photo').join(', ') + ', so it was set to blank'); }
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
            if (p.art != null && !M.ARTS.includes(p.art)) notes.push('the picture "' + SK.str(p.art, 20) + '" is not one of ' + M.ARTS.filter(a => a !== 'img').join(', ') + ', so the piece became a text card');
            if (p.art === 'img' && !SK.imgOk(p.img)) notes.push('the own picture for "' + lb.slice(0, 24) + '" is not a PNG, JPEG or WebP under ' + Math.round(M.IMG_MAX / 1000) + ' KB, so the piece became a text card');
            if (!num(p.x) || !num(p.y) || (p.turn === true && !num(p.a))) noStart++;
            pieces.push({ id: useIds ? p.id : i + 1, label: lb, art: p.art, img: p.img, ar: p.ar, s: p.s, tl: p.tl, turn: p.turn, a: p.a, ka: p.ka, x: num(p.x) ? p.x : p.kx, y: num(p.y) ? p.y : p.ky, kx: p.kx, ky: p.ky, idea: p.idea });
          });
          if (!problems.length) {
            model = SK.cleanModel({ ...m, pieces });
            if (!model) problems.push('is not a complete model');
            else { if (noStart) { SK.scatter(model, SK.bgAvoid(bg, model)); notes.push('the pieces had no start positions, so they were scattered'); } }
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
