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

## Phase 4: AI prompt builder and question tags (done)
Commits "Phase 4 / 24 (part 1)" through "Phase 4 / 26". Server tests 68 -> 79. I ordered the work so the shared validator (item 24) came first, because the prompt, the paste step, tags and file import all depend on it; commit messages say which plan item each is.
- Validator (`SK.checkQuestion`, `SK.cleanTags`, `SK.parseSets`, `SK.checkSets`, `SK.extractJson` in sortkit.js): client copy of the server's cleanHtml/cleanSort limits plus tag rules. `test.js` loads sortkit.js and compares it with the real server for html, lane/card/idea cut-offs.
- Build with AI (`public/aibuild.js`, button on the Question sets tab): step 1 builds the prompt (type, goal, tags, grade, 3-10 questions, language support, lanes/cards/ideas); step 2 pastes and checks the answer. The app never calls an AI service. The worked examples inside the prompt are tested against the validator for every option combination.
- Tags: data model (labels registry in IndexedDB, first spelling typed wins), editor row, bulk add/remove, set-wide tags, chips in /sets, Question sets tab and /class, "No tag" chips, filter, Tags dialog (rename/merge/delete). `retag()` calls `tagHistoryHooks` for lesson history in Phase 5. Tags travel through Export, import, backup, restore and share links. They never reach the server (tested). All 45 starter questions are tagged.
- Decision: a card's `id` that is not a whole number (an AI often writes "c1") is replaced with 1, 2, 3 instead of rejecting the question; over-limit lane/card/idea text is shortened with a note; too many lanes/cards is a problem (the question is skipped), because silently dropping cards changes the question.
- Decision: a tag may not contain a comma in practice (a comma ends the tag when typing).
- Decision: bulk "Remove tag from selected" asks for the tag by name (with suggestions) rather than listing checkboxes.
- Known limit: the Question sets tab filter shows at most 12 tags in the row; the rest are in the Tags dialog.
- Known limit: Merge in the Tags dialog offers the 8 most used other tags as buttons (use Rename-to-an-existing-name to merge into any other tag).
- **Process slip (Phase 4 / 26):** my commit chain ran the notes commit after the gate had failed, so the file-import code (item 26) went into the commit titled "Notes for Phase 4" (4209756) instead of its own commit, with one test assertion wrong. The next commit (7188223, titled "Phase 4 / 26 follow-up") fixes the assertion. I did not rewrite pushed history. Item 26's code is in 4209756.

## Review before Phase 5 ("Not yet reviewed" in the plan)
I exercised these in a real browser (Chromium, with touch emulation for the phone cases) against a local server. No bugs found; no code changes.
- Sort questions: teacher sends one, two students on a 390x780 touch phone tap card then lane, hand in, teacher sees averages/mix-up/matrix, Reveal marks wrong cards with where they belong, projector shows idea percentages. 
- Teams and class list: paste a list (header row, optional team, a duplicate pair of initials), teams created, random assignment, student picks team then initials and lands on the right team; teacher card shows "Jin L.".
- Confidence report: three pulses over two questions give the per-question and per-team report.
- Phone remote: teacher page in a phone viewport shows Review / Questions / Teams, Send works, the timer menu opens from the header.
- Share links: a link made from a set with tags and a sort question opens a dialog in a fresh browser and imports with its tags and sort question intact.
- Not covered: real touch devices (I only emulated touch), real Chromebooks, a real projector.

## Phase 5: Home-screen data dashboard (done)
Commits "Phase 5 / 27" through "Phase 5 / 32 and 33". Server tests 79 -> 87 (marks, start-time stamp, and six mastery tests that load `public/mastery.js` the way the browser does).
- 27 Lesson history: IndexedDB version 2 adds a `lessons` store. One record per question, filed under the time the *server* says the question started (new `qat` on state and `at` on the teacher's `q`), so reloads, two teacher devices and Undo keep it one record. Per student: key, name, pulse, mark, sortRight/Total/Placed, missedIdeas. Saved on a new question, before Clear class, on pagehide/hidden, and every minute. 12-month trim. Delete history on the class card and in the class menu; removing a class deletes it. Backup includes it only with class lists. Restore merges by id after cleaning.
- 28 Marks are held on the server by anonymous student id and only ever sent to teacher screens (state for hosts and a `mark` message via toHosts). This is what lets the phone remote and the laptop agree. Plan item says "never sent to students or the projector": true, tested. They are stored in server memory like everything else.
- 29 `public/mastery.js`: pure functions for scores, weights, bands, tag rows, help list, confidence vs mastery, ranges and the class-card strip.
- 30-32 Dashboard tab (`public/dashboard.js`), strip on class cards, nickname note with a link that opens the class-list sheet.
- 33 Landing page and README privacy copy.
- Decision: a student who placed no sort cards has no score (not 0%).
- Decision: "This week" starts on Monday. "Who needs help" ignores the Untagged row (a skill cannot be Not yet on "no tag").
- Decision: a paired phone (opened from the QR) is a *remote*: it does not keep lesson history, so student names are not copied onto the phone.
- Decision: the strip on a class card looks at the last 30 days.
- Known limit: a question sent from the set editor's "Send now" has no tags in history (it is not in a saved set).
- Known limit: a sort question whose answer key is missing (a teacher page that connected after the question was sent without being a host) is not recorded.
- Known limit: students who were removed during the lesson (Remove student) are not in that lesson's record.

## Phase 6: Enhancements (done)
Commits "Phase 6 / 34" through "Phase 6 / 37".
- 34 Quick question box on /class (and the phone Questions tab): Enter sends, Shift+Enter new line, cleaned like any question, not saved to the set; Undo, auto-timer and lesson history apply.
- 35 Student cards take the shape of the student's page; with 1-3 students the cards grow. This needed a CSS fix: the grid squeezed rows to the screen height (min-height:0 on the card), which made tall cards overlap. With 35 phone-shaped pages the grid is now longer (use the S size).
- 36 Backup reminder banner on Today (14 days or 5 lessons since the last backup, only when there is something to lose, "Not now" waits 3 days). For a browser that has never backed up, "14 days" counts from the first time it opened Today after this change (`do_first`).
- 37 "Test this network" on /start; five outcomes tested.

## Hosting (done where code can do it)
Commits "Hosting / 38" through "Hosting / 41 and 42". Server tests 87 -> 90.
- 38 `plan: starter` in render.yaml. **Nothing is deployed by this; syncing the blueprint on Render starts the paid plan (about $7 a month).** README explains why.
- 39 Gzip + ETag + 304 for text files (kept in memory, rebuilt when the file changes); fonts cached a week; `/healthz` no-store, GET and HEAD.
- 40 CSP with a SHA-256 hash for each page's inline scripts (no `unsafe-inline` for scripts), `X-Frame-Options: DENY`, Permissions-Policy, HSTS only behind an HTTPS proxy. Tests keep the hashes honest and fail if someone adds an inline event handler. Browser check with the policy enforced found no violations in the main flows. **If you add a new inline `onclick="..."` or an external script/image/font from another site, the policy will block it on purpose.**
- 41, 42 cannot be done from code (a domain has to be bought; a monitor has to be created in an outside service). The README has a checklist with the exact steps.

## What is waiting for you
1. Decide whether to sync the Render blueprint (starts the paid plan). Until then the app still runs on whatever plan is live now, with the old behaviour on restarts.
2. Buy a short domain and point it at the service; create the uptime monitor (README, "Before you share it with other teachers").
3. Try it on real student devices on your school wifi: the **Test this network** button on /start, a phone on its side, a Chromebook, a real projector, and the new Dashboard after a few real lessons. I could only emulate touch.
4. Read the "Decision" and "Known limit" lines above; they are the judgment calls most worth a second look. The biggest: marks live on the server by anonymous id (so the phone and laptop agree); a paired phone keeps no lesson history; "this week" starts on Monday.
5. The process slip in Phase 4 (item 26's code is inside the commit titled "Notes for Phase 4").

## How it was checked
- `npm test`: 90 server and pure-logic tests (the browser-side validator and mastery code are loaded into the test the same way a page loads them, and the validator is compared with the real server).
- Before every commit from item 14 on, a gate loaded every page in Chromium and failed on any page error, console error or native dialog.
- Each UI item also got a Playwright run against a local server (clicks, keyboard, phone and touch viewports, reloads, a second teacher device, a restarted server). Those scripts are not in the repo (Playwright is not a dependency; "no new dependencies"). Screenshots were looked at for the timer, the dashboard, the tag screens, the cards and the dialogs.
- Not run: a real load test with 35 live devices, real Chromebooks, a real projector, a real Render deploy.
