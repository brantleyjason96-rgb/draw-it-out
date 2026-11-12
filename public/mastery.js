// Mastery and the dashboard's numbers, worked out from saved lesson records (see tcommon.js). Pure functions: no page, no storage.
// The honest limit: the app can only show what it measures. Three signals exist:
//   sort accuracy (right or wrong per card), confidence (the student's own red / amber / green) and the teacher's marks on drawings.
// A drawing has no right answer the app can score, so a drawing counts toward mastery only when the teacher marked it.
// A drawing with movable pieces is different: where the pieces went can be scored (pieces right out of all pieces, like Sort cards), so that
// is its score. The drawing on top is still marked by the teacher, but a lesson gives one data point per student: pieces first, the mark only
// when the student moved no piece.
const MK = (() => {
  const MARK_SCORE = { got: 100, almost: 50, not: 0 };
  const CONF = { g: 3, y: 2, r: 1 };
  const NOTAG = '';                                    // the key of the "Untagged" row
  const bandOf = v => (v == null ? null : v < 50 ? 'not' : v < 80 ? 'getting' : 'secure');
  const BAND_WORD = { not: 'Not yet', getting: 'Getting there', secure: 'Secure' };

  // One lesson's score for one student, 0 to 100, or null when there is nothing to score.
  // `how` is the lesson record, or just its kind ('sort' | 'draw') for a lesson without pieces.
  function score(st, how) {
    const kind = typeof how === 'string' ? how : how && how.kind, model = !!(how && typeof how === 'object' && how.model);
    if (kind === 'sort') return st.sortPlaced > 0 && st.sortTotal > 0 ? 100 * st.sortRight / st.sortTotal : null; // a student who placed nothing has no score, not a zero
    if (model && st.placePlaced > 0 && st.placeTotal > 0) return 100 * st.placeRight / st.placeTotal;
    return st.mark && st.mark in MARK_SCORE ? MARK_SCORE[st.mark] : null;
  }
  // Average of a student's data points on one tag, the most recent three counted double. pts = [{ at, score }].
  // Fewer than two data points is "not enough data": no number, no band.
  function mastery(pts) {
    const a = pts.slice().sort((x, y) => x.at - y.at), n = a.length;
    if (n < 2) return { n, value: null, band: null };
    let sum = 0, w = 0; a.forEach((p, i) => { const k = i >= n - 3 ? 2 : 1; sum += k * p.score; w += k; });
    const value = Math.round(sum / w);
    return { n, value, band: bandOf(value) };
  }
  // the lesson's tags, or the one "no tag" key
  const keysOf = l => { const t = (l.tags || []).map(SK.tagKey).filter(Boolean); return t.length ? [...new Set(t)] : [NOTAG]; };
  const labelOf = (l, k) => (k === NOTAG ? 'Untagged' : (l.tags || []).find(t => SK.tagKey(t) === k) || k);

  // Date ranges: 'week' = since Monday this week, 'month' = the last 30 days, 'all'.
  function range(name, now = Date.now()) {
    if (name === 'all') return { from: 0, to: Infinity };
    const d = new Date(now);
    if (name === 'week') { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); return { from: m.getTime(), to: Infinity }; }
    return { from: now - 30 * 864e5, to: Infinity };
  }

  // lessons: all saved records. opts: { code, from, to }. Returns everything the dashboard shows.
  function build(lessons, opts = {}) {
    const from = opts.from || 0, to = opts.to == null ? Infinity : opts.to;
    const ls = lessons.filter(l => (!opts.code || l.code === opts.code) && l.at >= from && l.at <= to).sort((a, b) => a.at - b.at);
    const students = new Map();                         // key -> { key, name, tags: Map(tagKey -> { label, pts }), red: [at], conf: [{ at, pulse, score, q }] }
    const tags = new Map();                             // tagKey -> { key, label, lessons:[], ... }
    const stu = (k, name) => { let s = students.get(k); if (!s) { s = { key: k, name, tags: new Map(), red: [], conf: [] }; students.set(k, s); } if (name) s.name = name; return s; };
    const sig = { sort: 0, pieces: 0, marked: 0, draw: 0, drawUnmarked: 0 };
    ls.forEach(l => {
      const keys = keysOf(l);
      keys.forEach(k => { let t = tags.get(k); if (!t) { t = { key: k, label: labelOf(l, k), lessons: [] }; tags.set(k, t); } t.lessons.push(l); });
      let anyMark = false;
      l.students.forEach(st => {
        const s = stu(st.key, st.name), sc = score(st, l);
        if (st.mark) anyMark = true;
        if (st.pulse === 'r') s.red.push(l.at);
        if (st.pulse) s.conf.push({ at: l.at, pulse: st.pulse, score: sc, q: l.q, tags: keys.map(k => labelOf(l, k)) });
        if (sc == null) return;
        keys.forEach(k => { let e = s.tags.get(k); if (!e) { e = { label: labelOf(l, k), pts: [] }; s.tags.set(k, e); } e.pts.push({ at: l.at, score: sc, q: l.q }); });
      });
      if (l.kind === 'sort') sig.sort++; else if (l.model) sig.pieces++; else { sig.draw++; if (anyMark) sig.marked++; else sig.drawUnmarked++; }
    });
    // per tag: each student's number and band, the questions behind it, the ideas most often missed
    const rows = [...tags.values()].map(t => {
      const people = [];
      students.forEach(s => { const e = s.tags.get(t.key); if (!e) return; const m = mastery(e.pts); people.push({ key: s.key, name: s.name, n: m.n, value: m.value, band: m.band, last: Math.max(...e.pts.map(p => p.at)) }); });
      const counts = { not: 0, getting: 0, secure: 0, nodata: 0 };
      people.forEach(p => { counts[p.band || 'nodata']++; });
      const asked = new Map();                          // idea -> { misses, of }
      t.lessons.filter(l => l.kind === 'sort' || l.model).forEach(l => l.students.forEach(st => { if (!(st.sortPlaced > 0 || st.placePlaced > 0)) return; (st.missedIdeas || []).forEach(i => { const o = asked.get(i) || { idea: i, misses: 0 }; o.misses++; asked.set(i, o); }); }));
      const ideas = [...asked.values()].sort((a, b) => b.misses - a.misses || a.idea.localeCompare(b.idea));
      const qs = t.lessons.map(l => { const sc = l.students.map(st => score(st, l)).filter(x => x != null); return { id: l.id, q: l.q, at: l.at, kind: l.kind, model: !!l.model, n: sc.length, avg: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null }; });
      return { key: t.key, label: t.label, people: people.sort((a, b) => (a.value ?? 1e3) - (b.value ?? 1e3) || a.name.localeCompare(b.name)), counts, ideas, qs };
    }).sort((a, b) => (a.key === NOTAG) - (b.key === NOTAG) || b.qs.length - a.qs.length || a.label.localeCompare(b.label));
    // who needs help: Not yet on any tag, or red twice or more
    const help = [];
    students.forEach(s => {
      const reasons = [];
      s.tags.forEach((e, k) => { if (k === NOTAG) return; const m = mastery(e.pts); if (m.band === 'not') reasons.push({ type: 'tag', label: e.label, value: m.value, at: Math.max(...e.pts.map(p => p.at)) }); });
      if (s.red.length >= 2) reasons.push({ type: 'red', count: s.red.length, at: Math.max(...s.red) });
      if (reasons.length) help.push({ key: s.key, name: s.name, reasons, at: Math.max(...reasons.map(r => r.at)) });
    });
    help.sort((a, b) => b.reasons.length - a.reasons.length || b.at - a.at || a.name.localeCompare(b.name));
    // confidence against mastery: green but scored low, red but scored high (the two groups worth a conversation)
    const greenLow = [], redHigh = [];
    students.forEach(s => {
      const gl = s.conf.filter(c => c.pulse === 'g' && c.score != null && c.score < 50), rh = s.conf.filter(c => c.pulse === 'r' && c.score != null && c.score >= 80);
      if (gl.length) greenLow.push({ key: s.key, name: s.name, count: gl.length, at: Math.max(...gl.map(c => c.at)), q: gl[gl.length - 1].q });
      if (rh.length) redHigh.push({ key: s.key, name: s.name, count: rh.length, at: Math.max(...rh.map(c => c.at)), q: rh[rh.length - 1].q });
    });
    const byCount = (a, b) => b.count - a.count || b.at - a.at || a.name.localeCompare(b.name); greenLow.sort(byCount); redHigh.sort(byCount);
    const withConf = [...students.values()].filter(s => s.conf.some(c => c.score != null)).length;
    return { lessons: ls, students, rows, help, greenLow, redHigh, signals: sig, withConf, nick: ls.length > 0 && ls.some(l => l.nick) };
  }
  // the strip on a class card: "4 need help · Rock cycle 62% secure"
  function strip(lessons, code, now = Date.now()) {
    const b = build(lessons, { code, ...range('month', now) }); if (!b.lessons.length) return null;
    const top = b.rows.filter(r => r.key !== NOTAG && r.people.some(p => p.band)).sort((x, y) => y.qs.length - x.qs.length)[0];
    const pct = top ? Math.round(100 * top.counts.secure / Math.max(1, top.counts.not + top.counts.getting + top.counts.secure)) : null;
    return { help: b.help.length, tag: top ? top.label : null, secure: pct, lessons: b.lessons.length };
  }
  return { score, mastery, band: bandOf, BAND_WORD, range, build, strip, NOTAG, CONF, MARK_SCORE };
})();
