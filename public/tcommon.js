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
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };

// ---- class periods ----
let periods; try { periods = JSON.parse(store.do_periods); } catch {}
if (!Array.isArray(periods) || !periods.length) periods = [{ name: DEMO ? 'Demo class' : 'My class', code: store.do_tcode || rnd() }];
const savePeriods = () => { store.do_periods = JSON.stringify(periods); };
const periodOf = c => periods.find(p => p.code === c);
function currentCode(want) { const p = periodOf(want) || periodOf(store.do_tcode) || periods[0]; store.do_tcode = p.code; savePeriods(); return p.code; }
function newPeriod(name) { let c; do c = rnd(); while (periods.some(p => p.code === c)); periods.push({ name: String(name).slice(0, 40), code: c }); savePeriods(); return c; }
function removePeriod(code) { periods = periods.filter(p => p.code !== code); store.removeItem('do_team_' + code); if (!periods.length) periods = [{ name: 'My class', code: rnd() }]; savePeriods(); store.do_tcode = periods[0].code; }
const hostKey = () => store.do_tkey || (store.do_tkey = crypto.randomUUID());

// ---- teams, class list and scores, one set per class period ----
const TKEY = c => 'do_team_' + c;
function loadTM(c) {
  let t; try { t = JSON.parse(store[TKEY(c)]); } catch {}
  if (!t || !Array.isArray(t.teams) || !Array.isArray(t.roster)) t = { teams: [], roster: [], cap: false, scores: {} };
  t.scores = t.scores || {}; return t;
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
  return { teams, roster, cap: !!t.cap, scores };
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
let folders = []; // unit folders for question sets: [{ id, name }]; a set points at one with set.folder
// A demo must not see the last demo's sets. Deleting the database and opening it in the same tick hangs the open
// (the delete has not finished), so wait for the wipe before opening: that is why the question rail used to stay empty in demo.
const demoWipe = DEMO
  ? new Promise(ok => { const d = indexedDB.deleteDatabase('doi-demo'); d.onsuccess = d.onerror = d.onblocked = () => ok(); })
  : Promise.resolve();
const db = demoWipe.then(() => new Promise((ok, no) => { const o = indexedDB.open(DEMO ? 'doi-demo' : 'doi', 1); o.onupgradeneeded = () => o.result.createObjectStore('k'); o.onsuccess = () => ok(o.result); o.onerror = no; }));
const idbGet = k => db.then(d => new Promise(r => { const q = d.transaction('k').objectStore('k').get(k); q.onsuccess = () => r(q.result); }));
const persistSets = () => db.then(d => new Promise(ok => { const tx = d.transaction('k', 'readwrite'), o = tx.objectStore('k'); o.put(sets, 'sets'); o.put(folders, 'folders'); tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => { alert('Could not save in this browser. Use Back up everything to keep a copy.'); ok(); }; })).catch(() => alert('Could not save in this browser. Use Back up everything to keep a copy.'));
function loadSets() {
  return Promise.all([idbGet('sets'), idbGet('set'), idbGet('folders')]).then(([s, old, f]) => {
    sets = s && s.length ? s : [{ id: crypto.randomUUID(), name: old ? 'My questions' : 'My first set', questions: old || [] }];
    folders = cleanFolders(f); tidyFolders();
    persistSets(); return sets;
  }).catch(() => { sets = [{ id: crypto.randomUUID(), name: 'My first set', questions: [] }]; folders = []; return sets; });
}
const setById = id => sets.find(s => s.id === id);
const activeSet = () => setById(store.do_active) || sets[0];

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
  sel.onchange = () => {
    if (sel.value !== '__new') { last = sel.value; return; }
    const n = folders.length < MAX_FOLDERS ? (prompt('Name for the new folder (for example Unit 3: Plate Tectonics):') || '').trim() : '';
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
  const nb = el('button', { className: 'fpopt new', onclick: () => {
    if (folders.length >= MAX_FOLDERS) return toast('That is the most folders.');
    const n = (prompt('Name for the new folder (for example Unit 3: Plate Tectonics):') || '').trim(); if (!n) return;
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
  const text = clean(String(q.question || '')).slice(0, 2000);
  if (q.kind === 'sort') { const sort = SK.clean(q.sort); return sort && plain(text).trim() ? { question: text, bg: 'blank', img: null, kind: 'sort', sort } : null; }
  const img = typeof q.img === 'string' && q.img.startsWith(JPG) ? q.img : null;
  let bg = ['graph', 'lined', 'blank', 'photo'].includes(q.bg) ? q.bg : 'blank'; if (bg === 'photo' && !img) bg = 'blank';
  return plain(text).trim() || img ? { question: text, bg, img: bg === 'photo' ? img : null } : null;
}).filter(Boolean);
function addSet(name, questions, folder) {
  const st = { id: crypto.randomUUID(), name: String(name || 'New set').slice(0, 60), questions: cleanQs(questions) };
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
async function packSet(st) {
  const json = JSON.stringify({ n: st.name, q: st.questions.map(q => q.kind === 'sort' ? [q.question, 'blank', q.sort] : [q.question, q.bg === 'photo' ? 'blank' : q.bg]) });
  if (window.CompressionStream) return 'z.' + b64u(new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
  return 'r.' + b64u(new TextEncoder().encode(json));
}
async function unpackSet(t) {
  const u8 = unb64u(t.slice(2));
  const json = t[0] === 'z' ? await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(u8);
  const o = JSON.parse(json); if (!o || !Array.isArray(o.q)) throw 0;
  return { name: String(o.n || 'Shared set').slice(0, 60), questions: cleanQs(o.q.map(x => (x[2] ? { question: x[0], kind: 'sort', sort: x[2] } : { question: x[0], bg: x[1] }))) };
}
async function copyShareLink(st) {
  const photos = st.questions.filter(q => q.bg === 'photo' || q.img).length;
  const url = location.origin + '/teacher#set=' + await packSet(st);
  if (url.length > 7500) return alert('This set is too long for a link. Use Export instead and send the file.');
  const note = photos ? '\n\n' + photos + ' question(s) use a photo. Photos are not included in links, so those arrive with a blank background.' : '';
  navigator.clipboard.writeText(url).then(() => alert('Link copied. Send it to a colleague: opening it offers to add "' + st.name + '".' + note), () => prompt('Copy this link:', url));
}
async function checkShared(after) { // call after loadSets(); a colleague's link opens /teacher#set=...
  const m = /^#set=([zr]\.[A-Za-z0-9_-]+)$/.exec(location.hash); if (!m || DEMO) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const st = await unpackSet(m[1]); if (!st.questions.length) throw 0;
    if (confirm('Add the set "' + st.name + '" (' + st.questions.length + ' questions) to your sets?')) { const s = addSet(st.name, st.questions); toast('Added "' + s.name + '".'); after && after(s); }
  } catch { alert('That share link could not be read. Ask for a new one.'); }
}

// ---- export / import question sets as a file ----
function downloadJSON(name, data) { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })), download: name }); a.click(); }
const exportSets = list => downloadJSON('draw-it-out-question-sets.json', list);
async function importSetsFile(file) {
  try {
    const data = JSON.parse(await file.text()); let n = 0, last = null;
    (Array.isArray(data) ? data : []).forEach(s => { if (s && Array.isArray(s.questions)) { last = addSet(s.name || 'Imported set', s.questions); n++; } });
    if (!n) throw 0; toast('Imported ' + n + ' set' + (n === 1 ? '' : 's') + '.'); return last;
  } catch { alert('That file is not a Draw It Out question set.'); return null; }
}

// ---- one-file backup of everything that lives in this browser ----
const lastBackup = () => +store.do_lastbackup || 0;
function backupText() { const t = lastBackup(); if (!t) return 'No backup yet'; const d = Math.floor((Date.now() - t) / 864e5); return 'Last backup: ' + (d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'); }
const backupStale = () => !lastBackup() || Date.now() - lastBackup() > 14 * 864e5;
function doBackup() {
  const withNames = confirm('Include class lists and scores in the backup?\n\nOK = include them (the file will contain student names, so keep it private).\nCancel = back up only your question sets and class periods.');
  const data = { app: 'draw-it-out', v: 1, saved: new Date().toISOString(), sets, folders, periods, active: store.do_active, teams: {} };
  if (withNames) periods.forEach(p => { const t = loadTM(p.code); if (t.teams.length || t.roster.length) data.teams[p.code] = t; });
  downloadJSON('draw-it-out-backup-' + new Date().toISOString().slice(0, 10) + '.json', data);
  store.do_lastbackup = Date.now();
}
async function doRestore(file, after) {
  try {
    const d = JSON.parse(await file.text()); if (!d || d.app !== 'draw-it-out' || !Array.isArray(d.sets)) throw 0;
    if (!confirm('Restore this backup? It adds its question sets and class periods to what is already here. Nothing is deleted.')) return;
    let ns = 0, np = 0;
    cleanFolders(d.folders).forEach(f => { if (!folderById(f.id) && folders.length < MAX_FOLDERS) folders.push(f); }); // folders first, so restored sets can point at them
    d.sets.forEach(x => { if (x && typeof x.id === 'string' && !sets.some(y => y.id === x.id)) { const r = { id: x.id, name: String(x.name || 'Restored set').slice(0, 60), questions: cleanQs(x.questions) }; if (x.folder && folderById(x.folder)) r.folder = x.folder; sets.push(r); ns++; } });
    (Array.isArray(d.periods) ? d.periods : []).forEach(x => {
      if (!x || !/^[A-Z0-9]{4,10}$/.test(x.code) || periods.some(y => y.code === x.code)) return;
      periods.push({ name: String(x.name || 'Restored class').slice(0, 40), code: x.code }); np++;
      if (d.teams && d.teams[x.code]) saveTM(x.code, cleanTM(d.teams[x.code]));
    });
    await persistSets(); savePeriods(); alert('Restored ' + ns + ' question set(s) and ' + np + ' class period(s).'); after && after();
  } catch { alert('That file is not a Draw It Out backup.'); }
}

// A one-off host connection (e.g. to kick students out of a class that is being removed, or to send a question from the editor).
function hostSend(code, msgs) {
  const tm = loadTM(code); let sent = false;
  const lq = msgs.find(x => x.t === 'q'); // remembered, so a server restart can be put right (see rememberQ in class.html)
  if (lq) { const { t, ...p } = lq; try { localStorage['do_lastq_' + code] = JSON.stringify(p); } catch { try { localStorage['do_lastq_' + code] = JSON.stringify({ ...p, img: null }); } catch {} } }
  const w = connect(m => { if (m.t === 'state' && !sent) { sent = true; msgs.forEach(x => w.send(x)); setTimeout(() => w.close(), 600); } },
    () => w.send({ t: 'host', code, key: hostKey(), setup: { teams: tm.teams, roster: pubRoster(tm), cap: tm.cap, scores: tm.scores } }));
}
