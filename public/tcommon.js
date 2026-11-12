// Shared by the teacher pages: Today (/teacher), class screen (/class) and set editor (/sets). Load after common.js and sortkit.js.
// Everything a teacher owns lives in this browser: class periods, teams, class lists (real names!) and scores in localStorage,
// question sets in IndexedDB. The server only ever receives initials and teams.

const DEMO = new URLSearchParams(location.search).has('demo');
// Demo mode keeps everything in memory so trying it never changes a teacher's real saved data.
const store = DEMO ? new Proxy({}, { get: (o, k) => (k === 'removeItem' ? x => delete o[x] : o[k]), set: (o, k, v) => ((o[k] = String(v)), true) }) : localStorage;

const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd = () => Array.from({ length: 4 }, () => CH[Math.random() * 32 | 0]).join('');
const rid8 = () => Array.from({ length: 8 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.random() * 31 | 0]).join('');
const uid4 = () => 't' + Math.random().toString(36).slice(2, 6);
const $$ = s => [...document.querySelectorAll(s)];
// toast(message) or toast(message, { label, f, ms }): the second form adds one labelled button (for example Undo)
function toast(m, act) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.hidden = true; document.body.append(t); }
  t.textContent = m;
  if (act && act.label) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'toastbtn'; b.textContent = act.label;
    b.onclick = () => { t.hidden = true; clearTimeout(toast.h); act.f(); };
    t.append(' ', b);
  }
  t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), (act && act.ms) || 3000);
}
// ---- in-page dialogs: ask / askText / tell / choose / showCopy replace the browser's confirm / prompt / alert ----
// All return a Promise, so a handler becomes `async` and says `if (!await ask('…', { ok: 'Delete', danger: true })) return;`.
// They use <dialog>.showModal(), so focus stays inside, Escape cancels, and buttons carry words, not just colours.
function dlgCss() {
  if (document.getElementById('dlgcss')) return;
  const st = document.createElement('style'); st.id = 'dlgcss';
  st.textContent = `dialog.dlg{border:0;border-radius:var(--r-xl,16px);padding:22px 22px 18px;max-width:min(92vw,460px);width:100%;box-shadow:0 18px 60px rgba(10,20,40,.35);color:var(--c-ink,#17212B);background:var(--c-surface,#fff);font:var(--fs-md,16px)/1.45 var(--font-body,system-ui,sans-serif)}
dialog.dlg::backdrop{background:rgba(15,23,42,.55)}
dialog.dlg h2{margin:0 0 8px;font-size:var(--fs-xl,21px);line-height:1.25}
dialog.dlg p{margin:0 0 14px;white-space:pre-line;color:var(--c-ink-2,#394551)}
dialog.dlg label{display:block;font-weight:700;margin:0 0 6px}
dialog.dlg input,dialog.dlg textarea{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;min-height:44px;border:2px solid var(--c-line-2,#CBD3DA);border-radius:var(--r-md,10px);margin:0 0 14px}
dialog.dlg textarea{min-height:92px;resize:vertical}
dialog.dlg .derr{margin:-8px 0 14px;font-weight:700;color:var(--c-bad,#B3261E)}
dialog.dlg .derr[hidden]{display:none}
dialog.dlg input[aria-invalid]{border-color:var(--c-bad,#B3261E)}
dialog.dlg input:focus-visible,dialog.dlg textarea:focus-visible{outline:3px solid var(--c-focus,#0B6BCB);outline-offset:1px}
dialog.dlg .dbtns{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
dialog.dlg .dbtns button{min-height:44px;padding:0 18px;border-radius:var(--r-md,10px);border:2px solid var(--c-line-2,#CBD3DA);background:var(--c-surface,#fff);color:inherit;font:inherit;font-weight:700;cursor:pointer}
dialog.dlg .dbtns button:hover{background:var(--c-fill,#E8EDF2)}
dialog.dlg .dbtns button.pri{background:var(--c-primary,#0B6BCB);border-color:var(--c-primary,#0B6BCB);color:#fff}
dialog.dlg .dbtns button.pri:hover{background:var(--c-primary-strong,#0B5CAD)}
dialog.dlg .dbtns button.danger{background:var(--c-bad,#B3261E);border-color:var(--c-bad,#B3261E);color:#fff}
dialog.dlg .dbtns button.danger:hover{background:var(--c-bad-strong,#8C1D18)}
dialog.dlg .dbtns button:focus-visible{outline:3px solid var(--c-focus,#0B6BCB);outline-offset:2px}`;
  document.head.append(st);
}
// core: buttons = [{ label, value, kind: 'pri' | 'danger' | '' }]; `input` adds a text box whose text is returned by the button flagged `submit`.
function dlgOpen({ title, text, input, buttons, cancel = null, focus, node }) {
  return new Promise(res => {
    dlgCss();
    const d = document.createElement('dialog'); d.className = 'dlg';
    const f = document.createElement('form'); f.method = 'dialog'; d.append(f);
    const id = 'dlg' + Math.random().toString(36).slice(2, 7);
    if (title) f.append(el('h2', { textContent: title, id: id + 'h' })); d.setAttribute('aria-labelledby', title ? id + 'h' : '');
    if (text) f.append(el('p', { textContent: text }));
    let inp = null;
    if (input) {
      f.append(el('label', { textContent: input.label || '', htmlFor: id + 'i' }));
      inp = el(input.multiline ? 'textarea' : 'input', { id: id + 'i', value: input.value || '', readOnly: !!input.readOnly });
      if (input.max) inp.maxLength = input.max;
      if (input.list && input.list.length) { const dl = el('datalist', { id: id + 'l' }); input.list.forEach(v => dl.append(el('option', { value: v }))); inp.setAttribute('list', id + 'l'); f.append(dl); }
      f.append(inp);
    }
    if (node) f.append(node);
    const row = el('div', { className: 'dbtns' }); f.append(row);
    let out = cancel, firstPri = null, safe = null;
    // a blank answer to a required box keeps the dialog open and says why, in words
    const err = el('div', { className: 'derr', role: 'alert' }); err.hidden = true; if (inp) inp.after(err);
    const checkReq = () => {
      const bad = input.required && !inp.value.trim() ? input.required : input.check ? input.check(inp.value) : '';
      if (!bad) { err.hidden = true; return true; }
      err.textContent = bad; err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return false;
    };
    if (inp) inp.addEventListener('input', () => { err.hidden = true; inp.removeAttribute('aria-invalid'); });
    buttons.forEach(b => {
      const bt = el('button', { type: 'button', textContent: b.label, className: b.kind || '' });
      bt.onclick = () => { if (b.submit && inp && !checkReq()) return; out = b.fn ? b.fn() : b.submit && inp ? inp.value : b.value; d.close(); };
      row.append(bt); if (b.kind === 'pri' || b.kind === 'danger') firstPri = firstPri || bt; if (b.safe) safe = bt;
    });
    if (inp && !input.readOnly) inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !input.multiline) { e.preventDefault(); const b = buttons.find(x => x.submit); if (b && checkReq()) { out = inp.value; d.close(); } } });
    d.addEventListener('close', () => { d.remove(); res(out); });
    document.body.append(d); d.showModal();
    // a destructive confirm starts on the safe button, a text box on the box, everything else on the main button
    (focus === 'node' && node ? node.querySelector('input') : focus === 'input' && inp ? inp : safe || (inp && !input.readOnly ? inp : firstPri) || row.firstChild).focus();
    if (inp) { if (input.readOnly) inp.select(); else inp.select(); }
  });
}
const ask = (text, o = {}) => dlgOpen({ title: o.title, text, cancel: false, buttons: [{ label: o.cancel || 'Cancel', value: false, safe: !!o.danger }, { label: o.ok || 'OK', value: true, kind: o.danger ? 'danger' : 'pri' }] });
const askText = (label, value = '', o = {}) => dlgOpen({ title: o.title, text: o.text, input: { label, value, max: o.max, required: o.required, check: o.check, list: o.list }, cancel: null, buttons: [{ label: o.cancel || 'Cancel', value: null }, { label: o.ok || 'OK', kind: 'pri', submit: true }] });
const tell = (text, o = {}) => dlgOpen({ title: o.title, text, buttons: [{ label: o.ok || 'OK', value: true, kind: 'pri' }] });
// a dialog holding a tag box: resolves to the list of tags, or null on Cancel
const askTags = (title, value, o = {}) => { const box = tagInput({ value, label: o.label || 'Tags', id: 'dlgtags' }); return dlgOpen({ title, text: o.text, node: box, cancel: null, focus: 'node', buttons: [{ label: 'Cancel', value: null }, { label: o.ok || 'Save tags', kind: 'pri', fn: () => box.getTags() }] }); };
const choose = (text, buttons, o = {}) => dlgOpen({ title: o.title, text, cancel: null, buttons });
const showCopy = (label, text) => dlgOpen({ title: label, input: { label: 'Select the text and copy it', value: text, readOnly: true, multiline: true }, buttons: [{ label: 'Done', value: true, kind: 'pri' }] });
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };

// ---- class periods ----
let periods; try { periods = JSON.parse(store.do_periods); } catch {}
if (!Array.isArray(periods) || !periods.length) periods = [{ name: DEMO ? 'Demo class' : 'My class', code: store.do_tcode || rnd() }];
const savePeriods = () => { store.do_periods = JSON.stringify(periods); };
const periodOf = c => periods.find(p => p.code === c);
function currentCode(want) { const p = periodOf(want) || periodOf(store.do_tcode) || periods[0]; store.do_tcode = p.code; savePeriods(); return p.code; }
function newPeriod(name) { let c; do c = rnd(); while (periods.some(p => p.code === c)); periods.push({ name: String(name).slice(0, 40), code: c }); savePeriods(); return c; }
function removePeriod(code) { lessonsDeleteFor(code); periods = periods.filter(p => p.code !== code); store.removeItem('do_team_' + code); if (!periods.length) periods = [{ name: 'My class', code: rnd() }]; savePeriods(); store.do_tcode = periods[0].code; }
const hostKey = () => store.do_tkey || (store.do_tkey = crypto.randomUUID());

// ---- teams, class list and scores, one set per class period ----
const TKEY = c => 'do_team_' + c;
// what the marks Got it / Almost / Not yet are worth to the student's team (the server has the same rule)
const cleanMp = o => { const n = (v, d) => (Number.isInteger(v) && v >= 0 && v <= 5 ? v : d), x = o && typeof o === 'object' ? o : {}; return { on: x.on !== false, got: n(x.got, 2), almost: n(x.almost, 1), not: n(x.not, 0) }; };
function loadTM(c) {
  let t; try { t = JSON.parse(store[TKEY(c)]); } catch {}
  if (!t || !Array.isArray(t.teams) || !Array.isArray(t.roster)) t = { teams: [], roster: [], cap: false, scores: {} };
  t.scores = t.scores || {}; t.mpts = cleanMp(t.mpts); return t;
}
const saveTM = (c, t) => { try { store[TKEY(c)] = JSON.stringify(t); } catch {} };
const pubRoster = t => t.roster.map(e => ({ rid: e.rid, ini: e.ini, team: e.team }));
const PRE = [['Granite', '🪨', '#475569'], ['Basalt', '🌋', '#b91c1c'], ['Quartz', '💎', '#0284c7'], ['Magma', '🔥', '#ea580c'], ['Glacier', '🧊', '#0891b2'], ['Fossil', '🦴', '#854d0e'], ['Geyser', '💧', '#1d4ed8'], ['Canyon', '🏜️', '#b45309']];
const EMO = ['🪨', '🌋', '💎', '🔥', '🧊', '🦴', '💧', '🏜️', '🌊', '⛰️', '🌍', '⭐'];
// The icon picker on the Teams tab. Any pasted emoji is accepted too; these are just the quick picks.
const TEAM_ICONS = [...EMO, '🚀', '🧲', '⚡', '🌈', '🍀', '🦊', '🐙', '🦉', '🐝', '🦈', '🌵', '🌻', '🍎', '🍕', '🎈', '🎯', '🎨', '🎸', '⚽', '🏀', '🏆', '🥇', '🧩', '🔭', '🧪', '🧬', '📚', '✏️', '🛠️', '🧭', '🌙', '☀️', '🌪️', '🐉', '👾', '🤖'];
const TEAM_COLORS = ['#475569', '#b91c1c', '#ea580c', '#b45309', '#854d0e', '#0E7C4A', '#0891b2', '#0284c7', '#1d4ed8', '#7c3aed', '#be185d', '#17212B'];
const newTeam = (list, name) => {
  const i = list.length, p = PRE[i % PRE.length];
  return { id: uid4(), name: Array.from(name || p[0] + (i >= PRE.length ? ' ' + (Math.floor(i / PRE.length) + 1) : '')).slice(0, 20).join(''), color: p[2], emoji: p[1] };
};
const cleanTM = t => {
  const str = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join(''), ids = new Set();
  const teams = (Array.isArray(t.teams) ? t.teams : []).slice(0, 12).filter(x => x && /^[a-z0-9]{1,8}$/.test(x.id)).map(x => (ids.add(x.id), { id: x.id, name: str(x.name, 20) || 'Team', color: /^#[0-9a-fA-F]{6}$/.test(x.color) ? x.color : '#2563eb', emoji: str(x.emoji, 8) }));
  const roster = (Array.isArray(t.roster) ? t.roster : []).slice(0, 100).filter(x => x && /^[a-z0-9]{4,12}$/.test(x.rid)).map(x => ({ rid: x.rid, first: str(x.first, 40), last: str(x.last, 40), ini: str(x.ini, 6), team: ids.has(x.team) ? x.team : null }));
  const scores = {}; teams.forEach(x => (scores[x.id] = Number.isInteger(t.scores && t.scores[x.id]) ? Math.max(0, Math.min(9999, t.scores[x.id])) : 0));
  return { teams, roster, cap: !!t.cap, scores, mpts: cleanMp(t.mpts) };
};
// two students on one team can't share initials: JD, JD2, JD3...  Returns a list of "Name -> JD2" changes.
function dedupeInitials(roster) {
  const seen = new Map(), changed = [];
  roster.forEach(r => {
    const k = r.team || '', set = seen.get(k) || seen.set(k, new Set()).get(k); const base = String(r.ini || '').trim().toUpperCase(); if (!base) return; let v = base, n = 1;
    while (set.has(v)) v = base + ++n;
    if (v !== base) changed.push((r.first + ' ' + r.last).trim() + ' → ' + v); set.add(v); r.ini = v;
  });
  return changed;
}
const iniOf = nm => { const p = nm.trim().split(/\s+/).filter(Boolean); return ((p.length ? Array.from(p[0])[0] : '') + (p.length > 1 ? Array.from(p[p.length - 1])[0] : '')).toUpperCase(); };

// ---- editing teams (Today → Teams): saved in this browser, pushed to a class that is running ----
// A class may be open on the classroom computer, so the Teams tab never writes the class list or the scores.
const teamChannel = !DEMO && 'BroadcastChannel' in window ? new BroadcastChannel('draw-it-out-teams') : null;
const liveInfo = new Map(); // code -> last { live, here, teams, scores, cap } the server reported
const markLive = (code, info) => liveInfo.set(code, info);
const isLive = code => !!(liveInfo.get(code) || {}).live;
const teamsFor = code => { const li = liveInfo.get(code); return li && li.teams && li.teams.length ? li.teams : loadTM(code).teams; };
const scoresFor = code => { const li = liveInfo.get(code); return (li && li.scores) || loadTM(code).scores || {}; };
const teamAdminHref = code => '/teacher?tab=teams&class=' + code;
// Keep teams, scores and class-list assignments in step after a rename, reorder, add or remove.
function saveTeams(code, teams, opts = {}) {
  const tm = loadTM(code);
  const next = cleanTM({ ...tm, teams }).teams;
  const ids = new Set(next.map(t => t.id));
  tm.teams = next;
  tm.roster.forEach(e => { if (!ids.has(e.team)) e.team = null; });
  tm.scores = Object.fromEntries(next.map(t => [t.id, tm.scores[t.id] || 0]));
  saveTM(code, tm);
  if (!opts.quiet && teamChannel) teamChannel.postMessage({ code, teams: next });
  return tm;
}
// Another tab (the class screen, or a second home tab) applies the same edit without a reload.
const onTeamsSaved = fn => { if (teamChannel) teamChannel.onmessage = e => fn(e.data); };
// Identity-only changes: names, icons, colours and order. Never the class list, never the scores.
function pushTeams(code, teams) {
  if (!isLive(code)) return;
  const key = store['do_key_' + code] || hostKey();
  const w = connect(m => { if (m.t === 'state') { w.send({ t: 'teams', teams }); setTimeout(() => w.close(), 450); } },
    () => w.send({ t: 'host', code, key }));
  setTimeout(() => w.close(), 5000);
}
// A one-off host connection for a command that must not resend (and so overwrite) the class list.
function hostDo(code, msgs) {
  const key = store['do_key_' + code] || hostKey();
  const w = connect(m => { if (m.t === 'state') { msgs.forEach(x => w.send(x)); setTimeout(() => w.close(), 500); } },
    () => w.send({ t: 'host', code, key }));
  setTimeout(() => w.close(), 5000);
}

// ---- question sets (IndexedDB) ----
let sets = [];
// ---- tags: what a question assesses (teacher-only; never sent to the server, students or the projector) ----
// A tag is plain text. "rock cycle" and "Rock Cycle" are one tag; the spelling typed FIRST is the one shown, kept in tagLabels.
// Each question has its own tags; each set can have tags too, and a question counts as carrying its set's tags plus its own.
let tagLabels = {}; // key -> label
function canonTag(t) { // the stored spelling for this tag (registering it if it is new)
  const c = SK.cleanTag(t), k = SK.tagKey(c); if (!c) return '';
  if (!tagLabels[k]) tagLabels[k] = c;
  return tagLabels[k];
}
const tagLabel = t => tagLabels[SK.tagKey(t)] || t; // how a tag is shown (without registering it)
const canonTags = v => { const r = SK.cleanTags(v); return SK.cleanTags(r.tags.map(canonTag)).tags; };
// { key -> { key, label, qs: questions carrying it, sets: set names, own: how many questions have it themselves } }, most used first
function tagUsage() {
  const m = new Map();
  const get = t => { const k = SK.tagKey(t); if (!m.has(k)) m.set(k, { key: k, label: tagLabels[k] || t, qs: 0, own: 0, setIds: new Set() }); return m.get(k); };
  sets.forEach(st => {
    (st.tags || []).forEach(t => get(t).setIds.add(st.id));
    (st.questions || []).forEach(q => { const own = new Set((q.tags || []).map(SK.tagKey)); SK.tagsOf(q, st).forEach(t => { const u = get(t); u.qs++; if (own.has(u.key)) u.own++; }); });
  });
  return [...m.values()].sort((a, b) => b.qs - a.qs || a.label.localeCompare(b.label));
}
// A box for tags: type a tag and press Enter or comma to make a chip; click a chip's ✕ (or Backspace on an empty box) to remove it.
// Suggestions are tags used before, most used first. onChange(tags) gets the cleaned list (at most 5, 30 characters each).
function tagInput({ value = [], onChange, label = 'Tags', id, placeholder = 'Type a tag, then Enter' }) {
  id = id || 'tg' + Math.random().toString(36).slice(2, 7);
  let tags = canonTags(value);
  const box = el('div', { className: 'tgbox', role: 'group', ariaLabel: label, id });
  const input = el('input', { type: 'text', id: id + 'i', className: 'tgin', placeholder, autocomplete: 'off', maxLength: SK.TAG_LEN + 10 });
  input.setAttribute('aria-label', label + ': type a new tag'); input.setAttribute('list', id + 'l');
  const dl = el('datalist', { id: id + 'l' });
  const full = el('span', { className: 'tgfull', textContent: 'That is the most tags (' + SK.MAX_TAGS + ').', hidden: true });
  const status = el('span', { className: 'sr', role: 'status' });
  function paint() {
    box.replaceChildren(...tags.map(t => {
      const x = el('button', { type: 'button', className: 'tgx', title: 'Remove the tag ' + t }, icoEl('x', 'sm')); x.setAttribute('aria-label', 'Remove the tag ' + t);
      x.onclick = () => { tags = tags.filter(y => y !== t); status.textContent = 'Removed ' + t; commit(); input.focus(); };
      return el('span', { className: 'tg' }, t, x);
    }), input, dl, full, status);
    const used = new Set(tags.map(SK.tagKey)); dl.replaceChildren(...tagUsage().filter(u => !used.has(u.key)).slice(0, 30).map(u => el('option', { value: u.label })));
    input.hidden = tags.length >= SK.MAX_TAGS; full.hidden = tags.length < SK.MAX_TAGS;
  }
  function commit() { paint(); onChange && onChange(tags.slice()); }
  function add(text) {
    String(text).split(',').forEach(part => { const t = canonTag(part); if (t && tags.length < SK.MAX_TAGS && !tags.some(y => SK.tagKey(y) === SK.tagKey(t))) { tags.push(t); status.textContent = 'Added ' + t; } });
    input.value = ''; commit(); input.focus();
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (input.value.trim()) add(input.value); }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); commit(); input.focus(); }
  });
  input.addEventListener('change', () => { if (input.value.trim()) add(input.value); }); // picking a suggestion from the list
  input.addEventListener('blur', () => { if (input.value.trim()) add(input.value); });
  paint();
  box.getTags = () => tags.slice(); box.setTags = v => { tags = canonTags(v); paint(); };
  return box;
}
// Rename, merge or delete a tag everywhere it appears: on sets, on questions, and (via tagHistoryHooks) in saved lesson history,
// so the dashboard never splits one skill into two rows. to = '' deletes it. Renaming onto another existing tag merges the two.
const tagHistoryHooks = [];
function retag(fromKey, to) {
  const toLabel = SK.cleanTag(to), toKey = SK.tagKey(toLabel), existing = toKey && tagLabels[toKey];
  const swap = arr => {
    const out = [], seen = new Set();
    (arr || []).forEach(t => {
      const k = SK.tagKey(t), lab = k === fromKey ? (toLabel ? (existing || toLabel) : null) : t;
      if (lab && !seen.has(SK.tagKey(lab))) { seen.add(SK.tagKey(lab)); out.push(lab); }
    });
    return out;
  };
  const label = toLabel ? (existing && toKey !== fromKey ? existing : toLabel) : '';
  if (toLabel && !(existing && toKey !== fromKey)) tagLabels[toKey] = toLabel; // a deliberate rename sets the spelling; a merge keeps the target's
  if (toKey !== fromKey) delete tagLabels[fromKey];
  sets.forEach(st => {
    const a = swap(st.tags); if (a.length) st.tags = a; else delete st.tags;
    (st.questions || []).forEach(q => { const b = swap(q.tags); if (b.length) q.tags = b; else delete q.tags; });
  });
  const hooks = tagHistoryHooks.map(f => { try { return f(fromKey, toKey || '', label); } catch { return null; } });
  return Promise.all([...hooks, persistSets()]);
}
let folders = []; // unit folders for question sets: [{ id, name }]; a set points at one with set.folder
// A demo must not see the last demo's sets. Deleting the database and opening it in the same tick hangs the open
// (the delete has not finished), so wait for the wipe before opening: that is why the question rail used to stay empty in demo.
const demoWipe = DEMO
  ? new Promise(ok => { const d = indexedDB.deleteDatabase('doi-demo'); d.onsuccess = d.onerror = d.onblocked = () => ok(); })
  : Promise.resolve();
// version 2 adds the 'lessons' store (lesson history) beside 'k' (sets, folders, tags)
const db = demoWipe.then(() => new Promise((ok, no) => {
  const o = indexedDB.open(DEMO ? 'doi-demo' : 'doi', 2);
  o.onupgradeneeded = () => { const d = o.result; if (!d.objectStoreNames.contains('k')) d.createObjectStore('k'); if (!d.objectStoreNames.contains('lessons')) d.createObjectStore('lessons', { keyPath: 'id' }); };
  o.onsuccess = () => { o.result.onversionchange = () => o.result.close(); ok(o.result); }; o.onerror = no;
}));
const idbGet = k => db.then(d => new Promise(r => { const q = d.transaction('k').objectStore('k').get(k); q.onsuccess = () => r(q.result); }));
let saveFailShown = false;
function saveFail() { if (saveFailShown) return; saveFailShown = true; tell('Use Back up everything to keep a copy of your work.', { title: 'Could not save in this browser' }).then(() => (saveFailShown = false)); }
const persistSets = () => db.then(d => new Promise(ok => { const tx = d.transaction('k', 'readwrite'), o = tx.objectStore('k'); o.put(sets, 'sets'); o.put(folders, 'folders'); o.put(tagLabels, 'tags'); tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => { saveFail(); ok(); }; })).catch(() => saveFail());
function loadSets() {
  return Promise.all([idbGet('sets'), idbGet('set'), idbGet('folders'), idbGet('tags')]).then(([s, old, f, tl]) => {
    sets = s && s.length ? s : [{ id: crypto.randomUUID(), name: old ? 'My questions' : 'My first set', questions: old || [] }];
    folders = cleanFolders(f); tidyFolders();
    tagLabels = tl && typeof tl === 'object' && !Array.isArray(tl) ? tl : {};
    sets.forEach(st => { st.tags = SK.cleanTags(st.tags).tags; (st.questions || []).forEach(q => { if (q.tags) { q.tags = SK.cleanTags(q.tags).tags; if (!q.tags.length) delete q.tags; } }); if (!st.tags.length) delete st.tags; });
    persistSets(); return sets;
  }).catch(() => { sets = [{ id: crypto.randomUUID(), name: 'My first set', questions: [] }]; folders = []; return sets; });
}
const setById = id => sets.find(s => s.id === id);
const activeSet = () => setById(store.do_active) || sets[0];

// ---- lesson history: one record per question that was asked, kept ONLY in this browser (IndexedDB 'lessons') ----
// { id: code@startTime, code, className, at, q (plain text), kind, tags (the question's own plus its set's, as they were when it was asked),
//   nick (students joined with nicknames, so they are matched by nickname),
//   students: [{ key (class-list id, or the nickname in lower case), name, pulse r|y|g|null, mark got|almost|not|null,
//                sortRight, sortTotal, sortPlaced (sort questions), placeRight, placeTotal, placePlaced (pieces questions), missedIdeas }] }
//   a question with movable pieces is kind 'draw' with model: true, and its students carry the place* numbers
// Nothing here goes to the server. It is in Back up everything only when the teacher chooses to include class lists (it holds names).
const LESSON_KEEP_MS = 365 * 864e5;
const idbDo = (fn) => db.then(d => new Promise(ok => { try { fn(d, ok); } catch { ok(null); } })).catch(() => null);
const lessonPut = rec => idbDo((d, ok) => { const tx = d.transaction('lessons', 'readwrite'); tx.objectStore('lessons').put(rec); tx.oncomplete = () => ok(true); tx.onerror = tx.onabort = () => ok(false); });
const lessonsAll = () => idbDo((d, ok) => { const r = d.transaction('lessons').objectStore('lessons').getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); }).then(x => x || []);
function lessonsWhere(test, change) { // run over every record: change(rec) returns a new record, or null to delete it
  return idbDo((d, ok) => {
    const tx = d.transaction('lessons', 'readwrite'), st = tx.objectStore('lessons'); let n = 0;
    st.openCursor().onsuccess = e => { const c = e.target.result; if (!c) return; if (test(c.value)) { n++; const r = change(c.value); if (r) c.update(r); else c.delete(); } c.continue(); };
    tx.oncomplete = () => ok(n); tx.onerror = tx.onabort = () => ok(0);
  }).then(x => x || 0);
}
const lessonsDeleteFor = code => lessonsWhere(r => r.code === code, () => null);
const lessonsTrim = () => lessonsWhere(r => !(r.at > Date.now() - LESSON_KEEP_MS), () => null); // 12 months, then trimmed
const cleanLesson = r => {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || r.id.length > 80 || !/^[A-Z0-9]{4,10}$/.test(r.code) || !Number.isFinite(r.at)) return null;
  const n = v => (Number.isFinite(v) && v >= 0 && v <= 1000 ? v : null), s = (v, k) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, k);
  const students = (Array.isArray(r.students) ? r.students : []).slice(0, 150).map(x => x && typeof x === 'object' && s(x.key, 40) ? ({
    key: s(x.key, 40), name: s(x.name, 60), pulse: ['r', 'y', 'g'].includes(x.pulse) ? x.pulse : null, mark: ['got', 'almost', 'not'].includes(x.mark) ? x.mark : null,
    sortRight: n(x.sortRight), sortTotal: n(x.sortTotal), sortPlaced: n(x.sortPlaced), placeRight: n(x.placeRight), placeTotal: n(x.placeTotal), placePlaced: n(x.placePlaced), missedIdeas: (Array.isArray(x.missedIdeas) ? x.missedIdeas : []).slice(0, 24).map(i => s(i, 30)).filter(Boolean),
  }) : null).filter(Boolean);
  return { id: r.id, code: r.code, className: s(r.className, 40), at: r.at, q: s(r.q, 200), kind: r.kind === 'sort' ? 'sort' : 'draw', ...(r.kind !== 'sort' && r.model === true ? { model: true } : {}), tags: SK.cleanTags(r.tags).tags, nick: !!r.nick, students };
};
async function lessonsMerge(list) { // restore: add records that are not already here
  const have = new Set((await lessonsAll()).map(r => r.id)); let n = 0;
  for (const raw of Array.isArray(list) ? list : []) { const r = cleanLesson(raw); if (r && !have.has(r.id) && await lessonPut(r)) n++; }
  return n;
}
// renaming, merging or deleting a tag also rewrites saved history, so the dashboard keeps one row per skill
tagHistoryHooks.push((fromKey, toKey, label) => lessonsWhere(r => (r.tags || []).some(t => SK.tagKey(t) === fromKey), r => {
  const out = [], seen = new Set();
  r.tags.forEach(t => { const k = SK.tagKey(t), lab = k === fromKey ? label : t; if (lab && !seen.has(SK.tagKey(lab))) { seen.add(SK.tagKey(lab)); out.push(lab); } });
  return { ...r, tags: out };
}));

// ---- folders: group sets by unit ----
const MAX_FOLDERS = 40;
const cleanFolders = a => (Array.isArray(a) ? a : []).filter(f => f && typeof f.id === 'string' && f.id.length <= 64).slice(0, MAX_FOLDERS).map(f => ({ id: f.id, name: String(f.name || 'Folder').trim().slice(0, 40) || 'Folder' }));
const folderById = id => folders.find(f => f.id === id) || null;
const tidyFolders = () => sets.forEach(x => { if (x.folder && !folderById(x.folder)) delete x.folder; }); // a set never points at a folder that is gone
function addFolder(name) {
  name = String(name || '').trim().slice(0, 40); if (!name || folders.length >= MAX_FOLDERS) return null;
  const f = { id: crypto.randomUUID(), name }; folders.push(f); persistSets(); return f;
}
function renameFolder(f, name) { name = String(name || '').trim().slice(0, 40); if (!name) return; f.name = name; persistSets(); }
function deleteFolder(f) { folders = folders.filter(x => x !== f); tidyFolders(); persistSets(); } // the sets inside are kept, just un-filed
function moveSet(st, folderId) { if (folderId && folderById(folderId)) st.folder = folderId; else delete st.folder; persistSets(); }
// [{ folder, sets }]: each folder in order, then whatever is not in a folder (folder: null)
const setGroups = () => [...folders.map(f => ({ folder: f, sets: sets.filter(x => x.folder === f.id) })), { folder: null, sets: sets.filter(x => !folderById(x.folder)) }];
// A <select> of sets: grouped under folder names once any folders exist.
function fillSetSelect(sel, value) {
  sel.innerHTML = '';
  const opt = x => el('option', { value: x.id, textContent: x.name + ' (' + x.questions.length + ')' });
  if (!folders.length) sets.forEach(x => sel.append(opt(x)));
  else setGroups().forEach(g => { if (!g.sets.length) return; const og = el('optgroup'); og.label = g.folder ? g.folder.name : 'Not in a folder'; g.sets.forEach(x => og.append(opt(x))); sel.append(og); });
  sel.value = value;
}
// "New set" dialog: a name and, if you like, a folder (or make a new folder on the spot). after(set) runs once it is saved.
function newSetDialog(after, presetFolder) {
  const old = document.getElementById('nsdlg'); if (old) old.remove();
  const d = el('dialog', { id: 'nsdlg' }); d.style.maxWidth = '480px';
  const name = el('input', { className: 'inp', id: 'nsname', maxLength: 60, placeholder: 'For example Fractions Unit 3', autocomplete: 'off' });
  name.setAttribute('aria-label', 'Set name');
  const sel = el('select', { className: 'inp', id: 'nsfolder' }); sel.setAttribute('aria-label', 'Folder');
  const fill = v => {
    sel.innerHTML = '';
    sel.append(el('option', { value: '', textContent: 'No folder' }));
    folders.forEach(f => sel.append(el('option', { value: f.id, textContent: f.name })));
    sel.append(el('option', { value: '__new', textContent: '＋ New folder…' }));
    sel.value = v && folderById(v) ? v : '';
  };
  fill(presetFolder); let last = sel.value;
  sel.onchange = async () => {
    if (sel.value !== '__new') { last = sel.value; return; }
    const n = folders.length < MAX_FOLDERS ? ((await askText('Folder name', '', { title: 'New folder', required: 'Type a folder name', text: 'For example Unit 3: Plate Tectonics.', ok: 'Create', max: 40 })) || '').trim() : '';
    const f = n && addFolder(n); fill(f ? f.id : last); last = sel.value;
  };
  const close = () => { d.close(); d.remove(); };
  const form = el('form', { className: 'nsform' },
    el('label', { className: 'lbl', textContent: 'Set name', htmlFor: 'nsname' }), name,
    el('label', { className: 'lbl', textContent: 'Folder (optional)', htmlFor: 'nsfolder' }), sel,
    el('div', { className: 'nsbtns' }, el('button', { type: 'button', className: 'b', textContent: 'Cancel', onclick: close }), el('button', { type: 'submit', className: 'b pri', textContent: 'Create set' })));
  form.onsubmit = e => {
    e.preventDefault();
    const n = name.value.trim(); if (!n) { name.focus(); return toast('Give the set a name first.'); }
    const st = addSet(n, [], sel.value === '__new' ? '' : sel.value); close();
    persistSets().then(() => after && after(st));
  };
  d.append(el('div', { className: 'dh' }, el('h2', { textContent: 'New question set', style: 'font-size:var(--fs-2xl)' })), form);
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal(); name.focus();
}
// "Move to folder" dialog, shared by Today, the class screen and the set editor.
function folderPicker(st, after) {
  const old = document.getElementById('fpdlg'); if (old) old.remove();
  const d = el('dialog', { id: 'fpdlg' }); d.style.maxWidth = '460px';
  const close = () => { d.close(); d.remove(); };
  const choose = id => { moveSet(st, id); close(); toast(id ? 'Moved to "' + folderById(id).name + '".' : 'Taken out of its folder.'); after && after(); };
  const row = (label, count, on, f) => { const b = el('button', { className: 'fpopt' + (on ? ' on' : ''), onclick: f }, el('span', {}, ...(Array.isArray(label) ? label : [label])), on ? el('small', {}, icoEl('check', 'sm'), ' here') : el('small', { textContent: count == null ? '' : count + ' set' + (count === 1 ? '' : 's') })); return b; };
  const list = el('div', { className: 'fplist' });
  list.append(row('No folder', null, !folderById(st.folder), () => choose(null)));
  folders.forEach(f => list.append(row([icoEl('folder', 'sm'), ' ' + f.name], sets.filter(x => x.folder === f.id).length, st.folder === f.id, () => choose(f.id))));
  const nb = el('button', { className: 'fpopt new', onclick: async () => {
    if (folders.length >= MAX_FOLDERS) return toast('That is the most folders.');
    const n = ((await askText('Folder name', '', { title: 'New folder', required: 'Type a folder name', text: 'For example Unit 3: Plate Tectonics.', ok: 'Create', max: 40 })) || '').trim(); if (!n) return;
    const f = addFolder(n); if (f) choose(f.id);
  } }, el('span', { textContent: '＋ New folder…' }));
  list.append(nb);
  d.append(el('div', { className: 'dh' }, el('div', {}, el('div', { className: 'lbl', textContent: 'Move set to a folder' }), el('h2', { textContent: st.name, style: 'font-size:var(--fs-xl);overflow-wrap:anywhere' })), el('button', { className: 'b', textContent: 'Cancel', onclick: close })), list);
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal();
}

// ---- rich text: the server and projector allow only <b> <i> <u> <br> ----
function clean(html) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const walk = n => {
    let o = '';
    n.childNodes.forEach((c, i, a) => {
      if (c.nodeType === 3) o += esc(c.textContent);
      else if (c.nodeType === 1) {
        const tg = c.tagName, inner = walk(c);
        if (tg === 'B' || tg === 'STRONG') o += '<b>' + inner + '</b>';
        else if (tg === 'I' || tg === 'EM') o += '<i>' + inner + '</i>';
        else if (tg === 'U') o += '<u>' + inner + '</u>';
        else if (tg === 'BR') o += '<br>';
        else if (tg === 'DIV' || tg === 'P') { if (o && !o.endsWith('<br>')) o += '<br>'; o += inner; if (i < a.length - 1 && !inner.endsWith('<br>')) o += '<br>'; }
        else if (tg !== 'SCRIPT' && tg !== 'STYLE') o += inner;
      }
    });
    return o;
  };
  return walk(new DOMParser().parseFromString(html, 'text/html').body).replace(/(<br>)+$/, '');
}
const plain = h => new DOMParser().parseFromString(String(h).replace(/<br>/g, ' '), 'text/html').body.textContent;
const JPG = 'data:image/jpeg;base64,';
const cleanQs = a => (Array.isArray(a) ? a : []).slice(0, 200).map(q => {
  q = q || {};
  const text = clean(String(q.question || '')).slice(0, 2000), tags = canonTags(q.tags), tg = o => (tags.length ? { ...o, tags } : o);
  if (q.kind === 'sort') { const sort = SK.clean(q.sort); return sort && plain(text).trim() ? tg({ question: text, bg: 'blank', img: null, kind: 'sort', sort }) : null; }
  const img = typeof q.img === 'string' && q.img.startsWith(JPG) ? q.img : null;
  let bg = SK.BGS.includes(q.bg) ? q.bg : 'blank'; if (bg === 'photo' && !img) bg = 'blank';
  const model = q.model ? SK.cleanModel(q.model) : null; // movable pieces (the same rules the server applies)
  return plain(text).trim() || img ? tg({ question: text, bg, img: bg === 'photo' ? img : null, ...(model ? { model } : {}) }) : null;
}).filter(Boolean);
function addSet(name, questions, folder, tags) {
  const st = { id: crypto.randomUUID(), name: String(name || 'New set').slice(0, 60), questions: cleanQs(questions) };
  const tg = canonTags(tags); if (tg.length) st.tags = tg;
  if (folder && folderById(folder)) st.folder = folder;
  sets.push(st); persistSets(); return st;
}
// photos are resized to <=1600px JPEG so Chromebooks stay fast
function takePhoto(file) {
  return new Promise(res => {
    if (!file || !file.type.startsWith('image/')) return res(null);
    const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => {
      const s = Math.min(1, 1600 / Math.max(i.width, i.height)), c = document.createElement('canvas');
      c.width = Math.round(i.width * s); c.height = Math.round(i.height * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.82));
    };
    i.onerror = () => res(null); i.src = u;
  });
}

// ---- starter sets ----
let starters = null;
const loadStarters = () => starters ? Promise.resolve(starters) : fetch('/starters.json').then(r => r.json()).then(j => (starters = j));
// A dialog listing every starter set; onAdd(set) runs after each import.
async function showStarters(onAdd) {
  let d = $('#sdlg');
  if (!d) {
    d = el('dialog', { id: 'sdlg' }); d.style.maxWidth = '640px';
    d.innerHTML = '<div class="dh"><h2>Starter sets</h2><button class="b" id="sclose">Close</button></div><div style="padding:8px 24px 20px"><p class="mut" style="margin:6px 0 10px">Ready-made drawing questions. Importing adds a copy to your sets, so you can edit it freely.</p><div id="slist"></div></div>';
    document.body.append(d); d.querySelector('#sclose').onclick = () => d.close();
  }
  const box = d.querySelector('#slist'); box.textContent = 'Loading…'; d.showModal();
  try { await loadStarters(); } catch { box.textContent = 'Could not load the starter sets. Check your connection.'; return; }
  box.innerHTML = ''; let last = '';
  starters.forEach(st => {
    if (st.subject !== last) { last = st.subject; box.append(el('h3', { textContent: st.subject, style: 'margin:14px 0 4px;font-size:var(--fs-lg)' })); }
    const row = el('div', {}); row.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--line);border-radius:var(--r-lg);margin:6px 0';
    const t = el('div', { textContent: st.name }); t.append(el('small', { textContent: st.questions.length + ' questions · grades ' + st.grade, style: 'display:block;color:var(--mut)' }));
    const b = el('button', { className: 'b line2', textContent: 'Add' });
    b.onclick = () => { const s = addSet(st.name, st.questions); b.replaceChildren('Added ', icoEl('check', 'sm')); b.disabled = true; toast('Added "' + st.name + '" to your sets.'); onAdd && onAdd(s); };
    row.append(t, b); box.append(row);
  });
}

// ---- share link: the set is packed into the link itself (text only), so nothing is stored on any server ----
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
// a share link is text only, so a piece with the teacher's own picture arrives as a text card
const noPics = m => ({ ...m, pieces: m.pieces.map(p => { if (p.art !== 'img') return p; const { img, ...r } = p; return { ...r, art: 'card' }; }) });
async function packSet(st) {
  const json = JSON.stringify({ n: st.name, t: st.tags || undefined, q: st.questions.map(q => { const a = q.kind === 'sort' ? [q.question, 'blank', q.sort] : [q.question, q.bg === 'photo' ? 'blank' : q.bg, ...(q.model ? [noPics(q.model)] : [])]; if (q.tags && q.tags.length) { if (a.length < 3) a.push(null); a.push(q.tags); } return a; }) });
  if (window.CompressionStream) return 'z.' + b64u(new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
  return 'r.' + b64u(new TextEncoder().encode(json));
}
async function unpackSet(t) {
  const u8 = unb64u(t.slice(2));
  const json = t[0] === 'z' ? await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(u8);
  const o = JSON.parse(json); if (!o || !Array.isArray(o.q)) throw 0;
  return { name: String(o.n || 'Shared set').slice(0, 60), tags: o.t, questions: cleanQs(o.q.map(x => ({ ...(x[2] && x[2].pieces ? { question: x[0], bg: x[1], model: x[2] } : x[2] ? { question: x[0], kind: 'sort', sort: x[2] } : { question: x[0], bg: x[1] }), tags: x[3] }))) };
}
async function copyShareLink(st) {
  const photos = st.questions.filter(q => q.bg === 'photo' || q.img).length;
  const url = location.origin + '/teacher#set=' + await packSet(st);
  if (url.length > 7500) return tell('Use Export instead and send the file.', { title: 'This set is too long for a link' });
  const own = st.questions.reduce((n, q) => n + (q.model ? q.model.pieces.filter(p => p.art === 'img').length : 0), 0);
  const note = (photos ? '\n\n' + photos + ' question(s) use a photo. Photos are not included in links, so those arrive with a blank background.' : '') + (own ? '\n\n' + own + ' piece(s) use your own picture. Pictures are not included in links, so those arrive as text cards. Export the set to send the pictures.' : '');
  navigator.clipboard.writeText(url).then(() => tell('Send it to a colleague: opening it offers to add "' + st.name + '".' + note, { title: 'Link copied' }), () => showCopy('Copy this link', url));
}
async function checkShared(after) { // call after loadSets(); a colleague's link opens /teacher#set=...
  const m = /^#set=([zr]\.[A-Za-z0-9_-]+)$/.exec(location.hash); if (!m || DEMO) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const st = await unpackSet(m[1]); if (!st.questions.length) throw 0;
    if (await ask(st.questions.length + ' questions.', { title: 'Add the set "' + st.name + '" to your sets?', ok: 'Add set', cancel: 'No thanks' })) { const s = addSet(st.name, st.questions, undefined, st.tags); toast('Added "' + s.name + '".'); after && after(s); }
  } catch { tell('Ask for a new one.', { title: 'That share link could not be read' }); }
}

// ---- export / import question sets as a file ----
function downloadJSON(name, data) { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })), download: name }); a.click(); }
const exportSets = list => downloadJSON('draw-it-out-question-sets.json', list);
// Every question in the file goes through the same validator as "Build with AI": good ones are added, bad ones are skipped and listed.
async function importSetsFile(file) {
  let sets;
  try { const data = JSON.parse(await file.text()); const r = SK.parseSets(data); if (r.error) throw 0; sets = SK.checkSets(r.sets); }
  catch { tell('Choose a file that was saved with Export on the Question sets tab.', { title: 'That file is not a Draw It Out question set' }); return null; }
  let last = null, nq = 0; const skipped = [];
  sets.forEach(s => {
    s.rows.forEach(r => { if (!r.q) skipped.push((sets.length > 1 ? '"' + s.name + '", ' : '') + 'question ' + r.n + ': ' + r.problems.join('; ')); });
    const qs = s.rows.filter(r => r.q).map(r => r.q);
    if (qs.length) { last = addSet(s.name, qs, undefined, s.tags); nq += qs.length; }
    if (s.extra) skipped.push((sets.length > 1 ? '"' + s.name + '": ' : '') + s.extra + ' more questions were left out (a set holds at most ' + SK.MAX_QS + ')');
  });
  if (!last) { tell(skipped.slice(0, 12).join('\n') || 'It has no usable questions.', { title: 'Nothing could be imported' }); return null; }
  const made = sets.filter(s => s.rows.some(r => r.q)).length;
  if (skipped.length) await tell(skipped.slice(0, 12).join('\n') + (skipped.length > 12 ? '\n…and ' + (skipped.length - 12) + ' more.' : ''), { title: 'Imported ' + nq + ' question' + (nq === 1 ? '' : 's') + '. ' + skipped.length + ' skipped' });
  else toast('Imported ' + made + ' set' + (made === 1 ? '' : 's') + '.');
  return last;
}

// ---- one-file backup of everything that lives in this browser ----
const lastBackup = () => +store.do_lastbackup || 0;
function backupText() { const t = lastBackup(); if (!t) return 'No backup yet'; const d = Math.floor((Date.now() - t) / 864e5); return 'Last backup: ' + (d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'); }
const backupStale = () => !lastBackup() || Date.now() - lastBackup() > 14 * 864e5;
async function doBackup() {
  const pick = await choose('A class list has real student names, so keep that file private. "Questions only" saves your question sets and class periods without any names.', [{ label: 'Cancel', value: null }, { label: 'Questions only', value: false }, { label: 'Include class lists', value: true, kind: 'pri' }], { title: 'What goes in the backup?' });
  if (pick === null) return;
  const withNames = pick;
  const data = { app: 'draw-it-out', v: 1, saved: new Date().toISOString(), sets, folders, tagLabels, periods, active: store.do_active, teams: {} };
  if (withNames) { periods.forEach(p => { const t = loadTM(p.code); if (t.teams.length || t.roster.length) data.teams[p.code] = t; }); data.lessons = await lessonsAll(); } // lesson history holds names, so it goes in only with the class lists
  downloadJSON('draw-it-out-backup-' + new Date().toISOString().slice(0, 10) + '.json', data);
  store.do_lastbackup = Date.now();
}
async function doRestore(file, after) {
  try {
    const d = JSON.parse(await file.text()); if (!d || d.app !== 'draw-it-out' || !Array.isArray(d.sets)) throw 0;
    if (!await ask('It adds its question sets and class periods to what is already here. Nothing is deleted.', { title: 'Restore this backup?', ok: 'Restore', cancel: 'Cancel' })) return;
    let ns = 0, np = 0;
    if (d.tagLabels && typeof d.tagLabels === 'object' && !Array.isArray(d.tagLabels)) Object.entries(d.tagLabels).forEach(([k, v]) => { const c = SK.cleanTag(v); if (c && SK.tagKey(c) === k && !tagLabels[k]) tagLabels[k] = c; }); // first spelling typed wins
    cleanFolders(d.folders).forEach(f => { if (!folderById(f.id) && folders.length < MAX_FOLDERS) folders.push(f); }); // folders first, so restored sets can point at them
    d.sets.forEach(x => { if (x && typeof x.id === 'string' && !sets.some(y => y.id === x.id)) { const r = { id: x.id, name: String(x.name || 'Restored set').slice(0, 60), questions: cleanQs(x.questions) }; const tg = canonTags(x.tags); if (tg.length) r.tags = tg; if (x.folder && folderById(x.folder)) r.folder = x.folder; sets.push(r); ns++; } });
    (Array.isArray(d.periods) ? d.periods : []).forEach(x => {
      if (!x || !/^[A-Z0-9]{4,10}$/.test(x.code) || periods.some(y => y.code === x.code)) return;
      periods.push({ name: String(x.name || 'Restored class').slice(0, 40), code: x.code }); np++;
      if (d.teams && d.teams[x.code]) saveTM(x.code, cleanTM(d.teams[x.code]));
    });
    const nl = await lessonsMerge(d.lessons);
    await persistSets(); savePeriods(); await tell(ns + ' question set(s) and ' + np + ' class period(s) added' + (nl ? ', and ' + nl + ' saved lesson' + (nl === 1 ? '' : 's') : '') + '.', { title: 'Backup restored' }); after && after();
  } catch { tell('Choose a file made with Back up everything.', { title: 'That file is not a Draw It Out backup' }); }
}

// A one-off host connection (e.g. to kick students out of a class that is being removed, or to send a question from the editor).
function hostSend(code, msgs) {
  const tm = loadTM(code); let sent = false;
  const lq = msgs.find(x => x.t === 'q'); // remembered, so a server restart can be put right (see rememberQ in class.html)
  if (lq) { const { t, ...p } = lq; try { localStorage['do_lastq_' + code] = JSON.stringify(p); } catch { try { localStorage['do_lastq_' + code] = JSON.stringify({ ...p, img: null }); } catch {} } }
  const w = connect(m => { if (m.t === 'state' && !sent) { sent = true; msgs.forEach(x => w.send(x)); setTimeout(() => w.close(), 600); } },
    () => w.send({ t: 'host', code, key: hostKey(), setup: { teams: tm.teams, roster: pubRoster(tm), cap: tm.cap, scores: tm.scores, mpts: tm.mpts } }));
}
