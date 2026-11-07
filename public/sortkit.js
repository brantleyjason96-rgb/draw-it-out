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
