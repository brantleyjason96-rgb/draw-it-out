# Draw It Out

Teachers ask a question, every student draws the answer live, the teacher sees all drawings, puts one on the projector, and awards team points.

Two kinds of question:
- **Draw**: students draw the answer.
- **Sort**: students drop sticky-note cards into lanes (rock types, parts of speech, branches of government, rational or irrational). The teacher builds the lanes and cards in the question editor and drags each card into its correct lane to make the answer key. Cards can carry an *idea* tag, so the class results show which ideas to reteach, not just who is behind.

- Students: `/` (join with a class code)
- Teachers: `/teacher` is **Today** (classes, question sets, starter sets, backup). From there:
  - **Classes** tab: pick a class to start; each card shows the top three teams by points.
  - **Teams** tab: rename teams, pick an icon and colour, reorder, add or remove teams, reset scores. Copy the same teams into another class — buttons on the Teams tab, on each class card's ⋯ menu, and a link on the empty team list — with the points of any team that is already there kept. If the class is running, students and the projector update straight away. Link straight to it: `/teacher?tab=teams&class=CODE`.
  - `/class?code=…` is the teaching screen: questions on the left, drawings in the middle (click up to three to compare them on the projector), a ranked **Team scores** column on the right (collapsible; a slide-over on smaller screens), also a phone layout under 700px. The top bar holds **❄ Freeze**, and each card is outlined in the student's own red/amber/green pulse.
  - `/sets?id=…` is the question editor (its own screen)
  - `/class?demo=1` is the demo (eight practice students; nothing is saved)
- Landing page: `/start`
- Projector: opened from the teaching screen. Shows one student's work, or up to three side by side, or the leaderboard, and the frozen screen while the class is frozen.

### Sort questions: how they work
- The **answer key stays on the server** and goes to teachers only. Students and the projector get lane names and card text, never which lane is right.
- A student's whole answer is one small map of card to lane. It is saved on the server, so a refresh loses nothing, and it works on any screen size.
- Right and wrong reaches a student only when the teacher presses **Reveal answers**, or when the question is set to show it right away. A handed-in answer is locked until the teacher chooses *Let them change it*.
- The class screen shows a heat map (students by cards), results by idea and by team, a list of who missed each card for a quick small group, and **Save results (CSV)**.
- The projector can show one student's lanes, or class-wide percentages (no names, no key).
- Sets with sort questions export, import, back up and share by link like any other. A few ready-made sort questions are in the starter set **Sort It!**
- Code: `public/sortkit.js` (shared), `sortedit.js` (editor), `sortstu.js` (student), `sortres.js` (class results); server rules are in the "sort questions" section of `server.js`.

## Pulse, Freeze and Compare
Three things the teacher runs from the teaching screen (`/class`), all of which reach every student and the projector straight away.

**Pulse — how is it going?**
- On their drawing, a student taps **🙋 I need help / 🙂 Almost / 💡 I understand**. Tap again to clear it, or tap another to change it. Their page is not touched: no marks are added, nothing is handed in.
- The three buttons live on the right edge of the student's page, clear of the tools. The **How is your work?** label is also the toggle: tapping it folds the three buttons into a slim chip (a dot in their chosen colour shows the last answer stays put), and tapping again brings them back. Each student's folded or open choice is remembered.
- The teacher's card for that student gets an **outline in that colour**, plus a chip that spells it out (never colour alone). The row above the grid shows the class at a glance — `🙋 4 · 🙂 2 · 💡 2 · 1 no answer` — and clicking a colour shows only those students, which is the "who do I go and help" button.
- Pulse is for drawing questions. It clears when a new question is sent, so a colour always describes the drawing on screen.

**Freeze — the whole class's attention**
- **❄ Freeze** in the top bar (and in the phone header) stops every student's page: the drawing is blurred behind a frosted card — *Frozen. Look at your teacher. Your work is saved.* — with a little frost and falling snow. The projector shows a matching **Class frozen** screen.
- Nothing gets through while frozen: drawing, text, sorting and colours are all held on the server, not just hidden in the browser. Joining still works, so a late arrival lands on the frozen screen instead of an error.
- From the button's menu: freeze now, or for 30 seconds / 1 minute / 2 minutes. A timed freeze lets go on its own. Sending a new question, or **Clear class**, also unfreezes.

**Compare — up to three drawings side by side**
- Clicking a drawing in the grid puts it on the projector. Click another and it goes **alongside** it, up to three; clicking a card that is already up takes it down; clicking a fourth drops the one that has been up longest (with a toast saying who). A strip above the grid always shows what is up — `On projector (2/3) · Maya ✕ · Omar ✕ · Clear`.
- The projector lays 1, 2 or 3 out at the biggest size each drawing's own page shape allows, so nothing is stretched and the drawings stay legible from the back of the room. Side by side is for drawings: a sort question shows the first pick.
- **A new question clears the projector**, so nobody is left locked out of the next one. (This was a bug before: a student whose work was up stayed locked when the next question went out.)

**How the class felt (report)**
- **More → How the class felt**, the Report button next to the colours, or the Teams tab on a phone.
- One number for the lesson — green counts 100, amber 50, red 0 — with a plain reading (*"The class felt mostly comfortable"*), a stacked bar per question, the number who answered nothing, and how confidence moved from the first question to the last.
- **Who to check in with**: students who ended the last question on red, or were red twice or more, by name. **By team** for the same view against your team points.
- **Save report (CSV)** writes the per-question table and a student × question grid in one file; **Copy summary** puts the same thing on the clipboard for a doc or an email home.
- The server keeps the last 40 questions' colours (never names — those are joined in on your computer), so a refresh of the teaching screen doesn't lose the report. **Clear class** starts a fresh one.


```
npm install
npm start        # http://localhost:3000
npm test         # server tests
```

## Host it for other teachers
Draw It Out is one small Node process (HTTP + WebSocket) with **no database**. Classes live in memory and are deleted after 6 idle hours.

1. **Render (easiest):** push this repo to GitHub, then in Render choose *New + → Blueprint* and select it. `render.yaml` and the `Dockerfile` do the rest. It is set to the **free** plan, which sleeps after ~15 minutes idle and takes up to a minute to wake: open the teacher page a couple of minutes before class. Switch `plan` to `starter` for an always-on server.
2. **Anywhere that runs Docker or Node 18+** (Fly.io, Railway, a VPS): `docker build -t draw-it-out . && docker run -p 3000:3000 draw-it-out`, or `npm ci && node server.js`.
3. Put it behind HTTPS (the hosts above do this for you). WebSockets must be allowed.
4. **Run exactly one instance.** Rooms are held in memory.

Environment variables: `PORT` (default 3000), `MAX_ROOMS` (default 200).

## Class timer
- **Timer** next to **Freeze** (and in the phone header): 30 seconds to 10 minutes, or a custom time like `4`, `1.5` or `1:30` (5 seconds to 60 minutes). While it runs the button shows the time and offers **+1 minute**, **Pause** and **Stop**.
- Every student page, the projector and the teacher see the same countdown. The server sends **time remaining in milliseconds**, never a clock time, so a device with the wrong clock still shows the right number. A late joiner or a refreshed page picks up what is left.
- Under 10 seconds the student's pill changes colour **and** says "Almost time"; at zero it says "Time is up. Finish your thought." for 5 seconds. Drawing is not locked and there is no sound on student devices.
- Two options, off by default and remembered per class: **Freeze the class when time is up** and **Start this timer with every new question**.
- The projector shows the digits in its footer on every view and full-screen when nothing else is showing, with an optional soft chime (projector only, off by default).

## Build with AI, and tags
- **Question sets → Build with AI** writes a prompt (type, learning goal, tags, grade, 3 to 10 questions, language support, lanes and cards for sort questions). Paste it into any AI tool, paste the answer back, and the app checks it. **The app never calls an AI service**: no key, no cost, no student data.
- The check uses one validator (`public/sortkit.js`, a copy of the server's limits) shared with the question editor and file import. Problems are listed per question in plain words and the good questions can be added while the bad ones are skipped.
- **Tags** say what each question assesses (up to 5 per question, 30 characters, plain text; "rock cycle" and "Rock Cycle" are one tag and the first spelling typed is shown). A set can have tags too. Add them in the editor, to several questions at once, or let Build with AI add them. Filter sets by tag, and rename, merge or delete tags from the **Tags** dialog (saved lesson history follows).
- Tags are teacher-only. They are never sent to the server, students or the projector, and they travel in export, import, backup, restore and share links.

## Lesson history and the Dashboard
- When a question ends (the next question, **Clear class**, or leaving the page) the class screen saves one record in **this browser** (IndexedDB): the question, its tags, and for each student their confidence colour, your mark and their sort score. Students are matched by class-list id, or by nickname when there is no class list. Records older than 12 months are trimmed; **Delete lesson history** is on each class card.
- **Teacher marks**: on a drawing, **Got it / Almost / Not yet** (keys 1, 2, 3 on the focused card; also on the phone). Marks are private: the server holds them by anonymous student id for teacher screens only.
- **Mastery** per student per tag: sort questions count the percent of cards right; a drawing counts only when marked (Got it 100, Almost 50, Not yet 0); the most recent three data points count double. Under two data points shows "not enough data". Bands: **Not yet** under 50, **Getting there** 50 to 79, **Secure** 80 and up.
- The **Dashboard** tab shows who needs help, mastery by tag (click a row for students, questions and the ideas most often missed), and confidence against mastery, with CSV and a copyable summary. It says plainly what the app measures: sort accuracy, confidence and your marks. Code: `public/mastery.js` (pure, tested), `public/dashboard.js`.

## Privacy design
- No student accounts or sign-in. Students use a nickname or tap their initials.
- **Lesson history with student names is stored only in the teacher's browser**, and in backup files the teacher chooses to make. **Back up everything** includes it only when "Include class lists" is chosen.
- A student's rejoin secret is a separate token returned only to that student's page; the ids that teacher and projector screens see cannot be used to join.
- The server holds teacher marks by anonymous student id (no names) and sends them to teacher screens only. Tags never reach the server.
- A class list (real names) is read in the teacher's browser and is never sent to the server; only initials and a team are.
- Teams, scores and question sets live in the teacher's browser. Teachers can back everything up to one file.
- Question-set share links carry the questions inside the link itself (no server storage).
