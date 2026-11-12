# Draw It Out: readiness plan

Work order for getting the app ready for other teachers, plus three new features: a class timer, an AI prompt builder for question sets, and a home-screen data dashboard.

Do the phases in order. Each numbered item is one commit with a server test (`test.js`) or a browser check. Keep the existing rules: no database, no accounts, no student names on the server, no new dependencies unless a step says so.

Findings marked *(tested)* were reproduced against a local server on 2026-11-12.

---

## Phase 1: Safety. Nothing ships to other teachers before this.

1. **One oversized message crashes the server** *(tested)*. A single 7 MB WebSocket message exits the process with `RangeError: Max payload size exceeded`, ending every class.
   - Add `ws.on('error', …)` on every socket in `server.js`.
   - Wrap the body of the `message` handler in try/catch.
   - Add `process.on('uncaughtException')` and `unhandledRejection` handlers that log and keep running.
   - Test: send a 7 MB frame, then confirm a second client can still join.
2. **A student can take over another student's work** *(tested)*. `watch` needs no key, and `stateMsg` sends every student's `id`, which is also the rejoin secret. Rejoining with that id renamed and wiped another student.
   - Give each student a separate secret `token` returned only in `joined`; require it to rejoin.
   - Keep `id` as a public label only.
   - Test: a watcher's ids cannot be used to join.
3. **Anyone can lock teachers out** *(tested)*. One socket created 205 classes, then a real teacher got "Server busy".
   - One hosted class per socket.
   - Delete a class with no students and no teacher after 10 minutes (keep 6 hours when students are still in it).
   - Per-socket message rate limit (about 60 a second, drop the excess).
   - Cap sockets per IP address generously (about 150, since a whole school shares one address).
4. **The teacher cannot remove one student** *(tested)*. The server already handles `release`; no button sends it.
   - Add **Remove student** and **Rename** to each student card's menu on `/class`.
   - Server: add a host `rename` message, cleaned like a nickname.

## Phase 2: Classroom reliability

5. **Students start on the Select tool**, so the first drag draws nothing *(tested)*. Change the default in `public/index.html:568` to `tool:'pen'`.
6. **After a server restart the teacher and students disagree** *(tested)*. Students keep the old question; the teacher sees "Nothing sent yet"; late joiners get no question.
   - The teacher page remembers the last question it sent.
   - When it reconnects to a brand-new class, it sends a new `restore` message that sets the question without wiping drawings or counting as a new question.
7. **Students get no message when the connection drops** *(tested)*; only a dot turns red. Show a banner: "Reconnecting… keep drawing, your work is saved."
8. **"X of N have started" goes stale** *(tested: read 1 of 35 with 35 drawings)*. Refresh the line in `public/class.html:417` on `set`, `del` and `all` messages, throttled to twice a second.
9. **Sending a new question wipes all drawings with no undo.**
   - Server keeps the previous question's drawings for 15 seconds.
   - Teacher gets a toast, "Question sent. Undo", which restores them.
10. **Duplicate nicknames are allowed** *(tested)*. On join, add " 2", " 3" to a name already in use.
11. **Students who closed the tab still count as joined** *(tested)*.
    - Send a `live` flag in the student view.
    - Grey out the card, and count only live students in "N have joined".
12. **Phones get a tall narrow page that never re-fits** *(tested)*.
    - While the page is still empty, re-measure and send the new size on rotate or resize.
    - Make the tool rail scroll when it is taller than the screen.
13. **Replace native `prompt`, `confirm` and `alert`** (about 35 places) with one small in-page dialog helper in `tcommon.js` with labelled buttons. Start with the backup box ("Include class lists" / "Questions only" / "Cancel").
14. **A blank class name silently becomes "My class".** Show "Type a class name" instead.
15. **The teaching screen forgets the open question set** after a reload. Save the last set id per class.
16. **Route polish.**
    - Accept `/teacher/`, `/Teacher`, `/join`.
    - Add a friendly not-found page with Join and Teacher links.
    - Add a favicon.

## Phase 3: Class timer (new)

**What the teacher gets:** a **Timer** button next to Freeze on `/class` (and in the phone header). Every student, the projector and the teacher see the same countdown.

17. **Server** (model it on `setFreeze`).
    - Host message `timer`: `{secs}` to start (5 to 3600), `{add: 60}` to add time, `{pause: true|false}`, `{off: true}`.
    - Room holds `timer: {endsAt, left, paused}`.
    - Send **time remaining in milliseconds**, never a clock time, so a Chromebook with a wrong clock still shows the right number. Each client counts down locally from when the message arrived.
    - Include the timer in `state` and `joined`, so a late joiner or a refreshed page sees it.
    - At zero, send `timer: {done: true}` once.
    - A new question and Clear class stop the timer.
    - A timer keeps running during a freeze.
18. **Teacher controls.**
    - Menu: 30 seconds, 1, 2, 3, 5 and 10 minutes, and Custom.
    - While running, the button shows the time and offers +1 minute, Pause and Stop.
    - Option, off by default: **Freeze the class when time is up**.
    - Option, off by default: **Start this timer with every new question**, remembered per class.
19. **Student page.**
    - A pill in the top bar beside the question, in large digits.
    - Under 10 seconds it changes colour **and** adds the words "Almost time".
    - At zero: "Time is up. Finish your thought." for 5 seconds.
    - Drawing is not locked unless the teacher chose the freeze option.
    - No sound on student devices.
20. **Projector.**
    - Large countdown in the footer on every view.
    - Full-screen countdown when nothing else is showing.
    - Optional soft chime at zero on the projector only.
21. **Tests.**
    - A late joiner receives the remaining time.
    - Pause holds the value; add extends it.
    - A new question clears it.
    - Students cannot send `timer`.

## Phase 4: AI prompt builder for question sets (new)

**What the teacher gets:** on the Question sets tab, **Build with AI**. The app writes a prompt; the teacher pastes it into any AI tool they already use; they paste the answer back; the app checks it and adds the set. The app itself never calls an AI service, so there is no key, no cost and no student data involved.

22. **Step 1, Build the prompt** (a dialog on `/teacher`, Question sets tab).
    - Question type: Draw, Sort cards, or a mix.
    - Goal: free text for the learning goal or standard (for example "MS-ESS2-1: cycling of Earth's materials").
    - Grade band and number of questions (3 to 10).
    - Language support: none, simpler wording, or simpler wording plus a sentence frame in each question. This is for multilingual learners.
    - For sort questions: number of lanes (2 to 4), cards per question (6 to 12), and "tag each card with the idea it tests".
    - Output: a read-only prompt box and a **Copy prompt** button.
23. **The prompt text** must state the exact format and limits so the answer imports cleanly.
    - Reply with JSON only, in the set-file format: `[{"name": …, "questions": [ … ]}]`.
    - Draw question: `{"question", "bg": "blank"|"graph"|"lined", "goal"}`.
    - Sort question: `{"question", "kind": "sort", "goal", "sort": {"lanes": [{"id", "name"}], "cards": [{"id", "text", "lane", "idea"}]}}`.
    - Limits, matching `cleanSort` in `server.js`: 2 to 6 lanes, 2 to 24 cards, lane name 24 characters, card text 60, idea 30, question 2000, only `<b> <i> <u> <br>` tags, and every card's `lane` must be a real lane id.
    - Ask for misconception-based wrong lanes and for draw prompts that can be answered with a sketch and labels in about two minutes.
    - Include one worked example of each question type.
24. **Step 2, Paste the answer.**
    - A large text box and **Check it**.
    - Accept a reply wrapped in a code block or with extra sentences around the JSON: take the first `[` or `{` to the matching close.
    - Validate with one shared function. Move the limits into a client copy of the `cleanSort` and `cleanHtml` rules in `sortkit.js`, so the editor, file import and this import all agree.
    - Show a preview list of the questions.
    - Problems are in plain words, per question: "Question 3: the card 'Basalt' points to a lane that does not exist". The teacher can import the good ones and skip the bad ones.
25. **Add the `goal` field to every question.**
    - Editor: an optional "Goal" box on `/sets`.
    - It is kept in export, backup and share links.
    - It is never sent to students.
    - The dashboard (Phase 5) groups by it.
26. **Harden the existing file import.** `importSetsFile` in `public/tcommon.js:313` adds questions without checking them. Run it through the same validator.

## Phase 5: Home-screen data dashboard (new)

**What the teacher gets:** a **Dashboard** tab on `/teacher`, and a summary strip on each class card, answering two questions: *who needs help* and *where is the class on each goal*.

**The honest limit:** the app can only show what it measures. Three signals exist or are added here:
- **Sort accuracy.** Right or wrong per card, already grouped by idea.
- **Confidence.** The student's own red, amber or green.
- **Teacher marks** on drawings (new, item 28), because a drawing has no right answer the app can score.

27. **Save each lesson in the teacher's browser.**
    - Results currently vanish when the class is cleared or the server restarts.
    - When a question ends (next question, Clear class, or leaving the page), `/class` writes a record to IndexedDB, in a new `lessons` store beside sets.
    - Record: class code, date, question text, `goal`, kind, and per student `{key, name, pulse, mark, sortRight, sortTotal, missedIdeas}`.
    - Student key: the class-list id when there is a class list, otherwise the nickname in lower case.
    - Nothing new goes to the server; names stay on this computer, as now.
    - Include the store in **Back up everything** and Restore.
    - Add "Delete this class's history".
    - Keep 12 months, then trim.
28. **Teacher marks on drawings.**
    - Each drawing card gets three small buttons: **Got it**, **Almost**, **Not yet** (icon and word, never colour alone).
    - Keyboard: 1, 2, 3 on the focused card.
    - Marks are private to the teacher: never sent to students or the projector.
    - On the phone review screen, the same three buttons sit under the drawing.
    - Without marks, drawing questions show confidence only and the dashboard says so.
29. **Mastery number.** Per student, per goal:
    - sort questions = percent of cards right;
    - marked drawings = Got it 100, Almost 50, Not yet 0;
    - averaged, with the most recent three lessons counted double.
    - Bands: **Not yet** under 50, **Getting there** 50 to 79, **Secure** 80 and up.
    - Show "not enough data" below two data points instead of a number.
30. **Dashboard tab layout.**
    - Class picker and date range (This week, Last 30 days, All).
    - **Who needs help**: students in the Not yet band on any goal, or red twice or more, listed with the goal and the last date. This list comes first.
    - **Mastery by goal**: one row per goal with a three-part bar (Not yet, Getting there, Secure) and the count of students in each. Click a row for the student list and the ideas most often missed.
    - **Confidence against mastery**: students who say green but score low, and students who say red but score high. These are the two groups worth a conversation.
    - **Save as CSV** and **Copy summary**.
    - Empty state: "Run a class and this fills in. Sort questions and marked drawings count toward mastery."
31. **Class card strip on Today.** For example, "4 need help · Rock cycle 62% secure", linking to the Dashboard for that class.
32. **Nickname classes.**
    - Show a note: "Students joined with nicknames, so history is matched by nickname. Add a class list for reliable tracking."
    - Link the note to Teams and class list.
33. **Privacy copy.** Update the landing page and README: lesson history with names is stored only in the teacher's browser and in backup files they choose to make.

## Phase 6: Enhancements

34. **Quick question box** on `/class`: type and send without opening the editor.
35. **Student cards** sized to the page shape when only a few students are in.
36. **Backup reminder** on Today after 14 days or 5 lessons without a backup.
37. **"Can my school network run this?"** check on the landing page: tries the live connection and says plainly whether it worked.

## Hosting

38. **Move off the free Render plan** before sharing: it sleeps after 15 minutes, and a restart drops live classes. Set `plan: starter` in `render.yaml`.
39. **Compression and caching** in `server.js`: gzip text responses and send an `ETag`, so repeat loads on school wifi are fast.
40. **Security headers**: `Content-Security-Policy` (self only, plus `data:` images), `X-Frame-Options: DENY`.
41. **Short custom domain** for students to type.
42. **Uptime monitor** on `/healthz`.

## Not yet reviewed

Sort questions, teams and class-list upload, the confidence report, the phone remote, share links and real touch devices were not exercised in the 2026-11-12 test. Review them before Phase 5, which builds on sort results and the class list.
