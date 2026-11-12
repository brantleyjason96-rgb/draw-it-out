# Readiness work: running notes

Branch: `ccr-38f40f12-gq1w8o` (no PR opened). One commit per plan item. Test suite: `npm test` (server) plus browser checks with Playwright where the item is UI.
Newest entries at the bottom. "Decision" lines are judgment calls worth a second look.

## Phase 1: Safety (done, commits 0b27316..cad700e)
- 1 Crash guards, 2 student tokens, 3 limits, 4 Remove/Rename student.
- Decision: `TRUST_PROXY=1` added to render.yaml so the per-IP cap uses the last X-Forwarded-For entry. Not verified against Render.
- Decision: with a class list, picking a disconnected student's initials still lets a new device take over (by design), but rotates the token.
- Rename is not offered for class-list students (their name comes from the list).

## Phase 2: Classroom reliability (done)
Commits: "Phase 2 / 5" through "Phase 2 / 16". Server tests 53 -> 62. Every UI item also had a Playwright check against a local server (not kept in the repo; they live in my scratchpad). From item 14 on, a gate runs before each commit: server tests plus loading every page and failing on any page error, console error or native dialog.
- 5 Pen is the default tool.
- 6 `restore` host message (only on a brand-new room); teacher page stores the last question per class in localStorage (`do_lastq_<code>`), including when sent from the set editor. Photos that do not fit in localStorage are stored without the image.
- 7 Reconnect banner appears after 1.2 s offline, once the student is in a class, under the question bar.
- 8 "X of N have started" recounts on set/del/all, painted at most twice a second.
- 9 Undo: server keeps the replaced question and every student's work for 15 s (`UNDO_MS`). Students get a `joined` with `undo:true`; toast with an Undo button on /class (only if there was work to lose). `toast(msg, {label, f, ms})` now supports a button.
- 10 Duplicate nicknames become "Sam 2", "Sam 3" (also applied to teacher renames).
- 11 `live` flag; greyed card with the words "Not connected"; count uses live students only.
- 12 `size` message: empty page re-fits on rotate/resize (>60 px change). Short landscape screens get a one-row bottom bar and smaller page padding. The tool rail already scrolled (overflow-y:auto).
- 13 Dialog helper (`ask`, `askText`, `tell`, `choose`, `showCopy`) on `<dialog>`; 49 native calls replaced. Backup box: Cancel / Questions only / Include class lists.
- 14 Blank class/folder/set name keeps the dialog open with "Type a class name" etc. (The old behaviour was a silent do-nothing, not "My class".)
- 15 Open set and current question remembered per class.
- 16 `/Teacher`, `/teacher/`, `/join` work; friendly 404 page for page-like addresses (plain 404 for assets); `/favicon.ico` served. A favicon already existed inline on every page, so I moved it to `/favicon.svg` and linked that.
- **Bug I introduced and fixed (item 13):** teacher.html had its own `ask()` that collided with the new global `ask()` and stopped the whole /teacher script. Fixed in the item 14 commit (renamed `askStatus`). Caught by the page-error smoke check, which is why that check now gates every commit.
- Decision: undo toast is 15 s; clearing a class forgets the undo.
- Known limit: a phone on its side still has a small drawing area (about 240 px of page height on a 360 px screen); portrait is much better.

## Phase 3: Class timer (done)
Commits "Phase 3 / 17 and 21" through "Phase 3 / 20". Server tests 62 -> 68 (the item 21 tests are in the item 17 commit, since they test the server).
- Server: `timer` host message (`secs` 5-3600, `add`, `pause`, `off`, optional `freeze`). Only milliseconds remaining are ever sent. `timer` is in `state` and `joined`. At zero: one `{done:true}`, timer cleared, optional freeze. A new question and Clear class stop it; freeze does not. Students/watchers cannot send it.
- `public/timerkit.js` is the shared client countdown (performance.now(), so wrong device clocks are fine).
- /class: Timer button next to Freeze and in the phone header; menu 30 s / 1 / 2 / 3 / 5 / 10 min / Custom (accepts 4, 1.5 or 1:30), +1 minute / Pause / Stop while running. Options "Freeze the class when time is up" and "Start this timer with every new question", both off by default and saved per class (`do_timer_<code>`).
- Student: pill beside the question; under 10 s it changes colour and says "Almost time"; at zero "Time is up. Finish your thought." for 5 s; no lock, no sound. Screen readers hear start, pause, the 10 s mark and zero only.
- Projector: footer digits on every view, full-screen countdown when nothing else is showing, optional chime (off by default, projector only, toggle appears on hover/focus of the footer).
- Decision: the "start with every new question" timer re-uses the last duration picked (default 2 minutes) rather than asking each time.
- Decision: Undo of a question (item 9) does not bring back a timer that the new question stopped.
- Known limit: "Start with every new question" only fires from the class screen's `go()`; questions sent from the set editor's "Send now" do not start a timer.
