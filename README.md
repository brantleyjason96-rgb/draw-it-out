# Draw It Out

Teachers ask a question, every student draws the answer live, the teacher sees all drawings, puts one on the projector, and awards team points.

Two kinds of question:
- **Draw**: students draw the answer. A Draw question can also carry **movable pieces** (see below).
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

### Movable pieces on a Draw question: how they work
- In the question editor, **Movable pieces → Add pieces students move**. Add 2 to 12 pieces (a label, plus a picture: Earth, Sun, Moon, an arrow, a text card, a moon phase, or your own picture), drag each one to where it **belongs** (the answer key), and choose how it looks to students. Press **Scatter** (or drag them yourself in *Student start*) to set where pieces begin. Students move them with the **Pieces** tool, then draw on top with the normal tools; the pen never grabs a piece.
- **Size**: every piece has its own size, from 50% to 400%. Use the **Size** slider on the piece, drag the **square on the corner** of the selected piece on the board, or press `+` and `-` with the piece selected. A picture of your own keeps its own shape (a wide continent stays wide), and the size is its longest side. The whole piece always stays on the board.
- **"About the right place" (an answer area for each piece)**: in the answer view each piece has a dashed ring, the area where it counts as right. Choose *Very tight* to *Very loose* for the whole question, then give any piece its own area with the **Area** slider on the piece (20 to 400) or by dragging the round handle on the edge of its ring on the board. **Same as the rest** puts a piece back on the question's setting. For continents that only need to be about right, make each area big. On Reveal, a piece that was outside a big area is shown the **area** ("Africa belongs in this area"), not one exact point.
- **Warnings do not stop you from saving.** Only things that would break the question stop Save (fewer than 2 pieces, a piece with no label, a missing picture). Pieces that overlap at the start, answer spots that are close together, and a turning piece that already faces the answer show as *Worth a look*. That is what you want for a **jigsaw** (continents that fit together): choose *Very tight* (20) or *Tight* under *How close counts as right?* and turn on *Show outlines*.
- **Pieces that turn**: tick *Students turn it* on a piece (an arrow for plate motion, an Earth for its tilt). In *Answer key* turn it to the way it should face; in *Student start* turn it to how students first see it (Scatter starts it 90 to 270 degrees away). Turn it with the round handle above the selected piece, the ↺ ↻ buttons (15 degrees a step), or `[` and `]` on the keyboard. **How close must the turn be?** Tight 15°, Normal 30°, Loose 45°. A piece is right only when it is in place **and** facing within that angle; results show ↻ for "right place, turned the wrong way". Students turn a piece the same ways: tap it, then drag the handle, press **Turn left / Turn right**, or press `[` / `]` on a piece they have tabbed to.
- **Your own pictures**: choose *Your own picture…* for a piece and pick a PNG, JPEG or WebP. It is shrunk to about 256 pixels and kept with the question (up to about 140 KB each, 700 KB per question). The white around a picture is made see-through when it touches the edge (button *White is see-through / kept* to undo). **Share links are text only, so a piece with your own picture arrives as a text card; Export and Back up keep the pictures.**
- **Drawn backgrounds** (any Draw question, with or without pieces): *Orbit diagram* (seasons), *Earth’s layers*, *Moon orbit*, *Plate boundary*, *Ocean (for continents)*, *Sea-floor spreading*, *Ocean–continent boundary*, *Volcano cross-section*, *Fault and earthquake* and *Water cycle scene*, next to Graph, Lined, Blank and Photo. The parts are not labelled, so students label them. They are drawn in code, so they cost no storage. Scatter keeps pieces off the middle of a diagram.
- **Show outlines** polish: outlines take the shape of the piece (a rounded box for a text card), fill in when a piece is in one, and the screen reader says "moved into an outline".
- **Starter set Place It! Move the pieces** (Starter sets, Earth Science): Seasons, Layers of the Earth, Moon phases, and the convergent, divergent and transform plate boundaries (turn the arrows). Tagged, with ideas, ready to send.
- **Starter set Continental Drift: the evidence** (Earth Science): all three kinds in one set. *Place It*: put the 8 colour-coded continent pieces (from the USGS puzzle activity) back into Pangaea by matching fossils and mountains, fit South America to Africa so the fossil colors line up, and label the sea floor. *Sort*: evidence by kind (fossils, rocks and mountains, ancient climate, coastline fit), *Evidence or not?* (the ten statements from the Analyzing Evidence worksheet), and Wegener's clues against later ones. *Draw*: explain the fossil evidence, sea-floor arrows, how Pangaea broke apart, what moves the continents, and why the coasts do not fit perfectly. Tagged MS-ESS2-3.
- **Starter set Draw on a Diagram** (Earth Science): seven Draw questions on the ocean–continent boundary, a volcano, a fault and the water cycle.
- **Board shape**: *Wide* (Chromebook) or *Tall* (phone held upright). Pieces are the same size in both, so a tall board is easier on a phone.
- **Students find the spot** (default): the answer spots, how close counts and the idea tags stay on the server and go to teachers only, as with Sort. **Show outlines**: faint outlines appear on every student's page and pieces slip into them. The spots are public by design in that mode.
- **How close counts**: Very tight, Tight, Normal or Loose (20, 35, 60 or 90 units on a 1000-wide board; a piece at 100% is 108 wide). **Show students if they are right**: only on **Reveal answers**, or right away as each piece is placed. A wrong piece also shows a dashed ghost where it belongs, on Reveal.
- A student's answer is one small map of the pieces they moved. It is saved on the server (a refresh loses nothing), is refused while the class is frozen or their work is on the projector, and goes back with **Undo** on a question. **Reset pieces** puts their pieces back at the start.
- The teaching screen shows each student's board with the pieces in place, green or red rings (only on your screen) and a chip like *2 of 3 right*. The projector shows the pieces without rings or key. Everything Draw has (Pulse, Freeze, marks, Compare, lesson history) works as before.
- **Marks give points to teams.** Your Got it, Almost and Not yet on a drawing (also on a pieces question) give that student's team points: **Got it +2, Almost +1, Not yet +0** by default. Change a mark and the points change with it (the old points are taken back first), so a team's score always matches the marks now showing. A card shows the points its mark gave (*+2*) and a note says which team got them. Two students on one team add up; the *one point per team* rule applies only to the +1 button. Points stay with the team when the next question starts. A student who moves team takes their points along; a student with no team gives none (you are told). Set what each mark is worth, or turn it off, under **Set up teams → Marks give points to the team**. Students and the projector never see the marks or what they earned.
- **Class results** (the *Drawings | Class results* switch on the teaching screen for a pieces question; also a *Class results* panel on the phone's Review tab): class average, who moved every piece, who needs a small group, and the **biggest mix-up** (a piece put on another piece's spot). A heat map of students by pieces (✓ right; a letter = the piece whose spot it sits on, ? = near no spot), results **by idea** and **by team**, and for any piece a board showing where every student put it (green dots right, red dots wrong) with the names of who missed it and **Copy names for a small group**. Click a student for their board with the wrong pieces ringed. **Save results (CSV)** has one row per student and a column per piece.
- **Results on projector** shows class percentages per piece and per idea (no names, no key), the same screen Sort uses. It turns itself off for the next pieces question. A piece's percent on your screen is out of the students who moved it; on the projector it is out of everyone who has started, as with Sort.
- **Lesson history and Dashboard:** a pieces question is saved with each student's pieces right out of all pieces and the ideas they missed. That is their score for the lesson (the mark on the drawing counts only if they moved no piece), so mastery by tag, the class card strip and "who needs help" include it; the Dashboard says so plainly. The drawing on top is not scored.
- Keyboard and screen readers: Tab to a piece (a hidden list of buttons), arrow keys move it (Shift for bigger steps); a live region says what moved. In the editor, click a piece then use the arrow keys.
- Sets with pieces export, import, back up and share by link like any other. Code: `public/modelstu.js` (student), `modeledit.js` (editor), `modelres.js` (class results; the numbers are `SK.modelStats` in `sortkit.js`), `paintPieces` / `stageRect` in `common.js` (drawing, shared), `SK.cleanModel` / `modelCheck` / `scatter` in `sortkit.js` (rules, a copy of the server's), "movable pieces" section of `server.js`. Plan and mock-up: `MODELS_PLAN.md`, `mockups/place-it.html`.

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
Draw It Out is one small Node process (HTTP + WebSocket) with **no database**. Classes live in memory. A class nobody is in is deleted after 10 minutes if no student ever joined, or after 6 hours if students had.

1. **Render (easiest):** push this repo to GitHub, then in Render choose *New + → Blueprint* and select it. `render.yaml` and the `Dockerfile` do the rest. `render.yaml` is set to the **starter** plan (about $7 a month): it stays awake, so a class never meets a sleeping server, and a restart does not catch a class by surprise during the day. (The free plan sleeps after ~15 minutes idle, takes up to a minute to wake, and drops every live class when it restarts. It is fine for trying the app, not for teachers.) Syncing the blueprint starts the paid plan.
2. **Anywhere that runs Docker or Node 18+** (Fly.io, Railway, a VPS): `docker build -t draw-it-out . && docker run -p 3000:3000 draw-it-out`, or `npm ci && node server.js`.
3. Put it behind HTTPS (the hosts above do this for you). WebSockets must be allowed.
4. **Run exactly one instance.** Rooms are held in memory.

### Before you share it with other teachers (a checklist)
1. **Plan:** `render.yaml` uses the starter plan (always on). Free sleeps and drops live classes when it restarts.
2. **A short address students can type.** On Render: the service → *Settings → Custom Domains → Add*, then create the DNS record Render shows (a `CNAME`, or an `ALIAS`/`ANAME` for a bare domain) at your registrar; Render issues the HTTPS certificate on its own. Pick a name that is short and has no look-alike letters (students type it on a phone). Nothing in the app needs changing: the join links, the QR code on the projector and the teacher's "student link" all use whatever address the page was opened on. Tell teachers to share the short address, not the `onrender.com` one.
3. **An uptime monitor** on `https://YOUR-ADDRESS/healthz`. It answers `ok` (GET or HEAD, never cached). With UptimeRobot (free): *Add New Monitor → HTTP(s)*, URL as above, interval 5 minutes, alert contact your email; for a stricter check choose *Keyword* and look for `ok`. Render's own health check (`healthCheckPath: /healthz` in `render.yaml`) restarts the service if it stops answering, but only a monitor outside Render tells you when the whole thing is down.
4. **Check a school network** with the *Test this network* button on `/start`, from a student device on the school wifi.
5. **Know the limits:** one instance (rooms are in memory), 60 students per class, 150 connections per address by default (`MAX_PER_IP`; a whole school shares one address, so raise it for a big school), 300 classes (`MAX_ROOMS`).

Environment variables: `PORT` (default 3000), `MAX_ROOMS` (default 200), `MAX_PER_IP` (sockets per address, default 150; a whole school shares one address), `TRUST_PROXY=1` (behind Render or another proxy: use the address the proxy added to `X-Forwarded-For`; `render.yaml` sets it).

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
