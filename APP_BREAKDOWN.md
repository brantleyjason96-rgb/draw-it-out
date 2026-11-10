# Draw It Out — App Breakdown

**Status key:** ✅ built · 🟡 partly built · 💡 proposed (not in the code yet; for you to accept, cut or reorder)

## 1. The idea in one paragraph

Draw It Out is a live, whole-class response tool. The teacher asks a question, every student answers on their own device (by drawing, or by sorting cards into lanes), and the teacher sees all the work at once. The teacher can put one to three answers on the projector, see at a glance who is stuck, and award points to teams. It needs no student accounts, no database and no install: a student types a class code and is in.

**Why it works for a middle-school science room:** it turns "who gets it?" into something visible in about ten seconds, without anyone having to speak in front of peers. For multilingual learners, drawing and sorting are low-language ways to show understanding.

## 2. Who uses it

| User | What they need |
|---|---|
| **Teacher** | Run a question in under a minute, see every student's thinking, know who to help first, keep the class's attention, keep score. |
| **Student** | Join fast on any device (Chromebook, phone), answer without friction, know their work is saved. |
| **Projector** | A clean, large, read-from-the-back view, with no names or answer keys leaking. |

## 3. The three surfaces

| Surface | URL | Purpose |
|---|---|---|
| Student | `/` | Join with a class code, answer questions |
| Teacher: Today | `/teacher` | Classes, teams, question sets, starter sets, backup |
| Teaching screen | `/class?code=…` | Run the lesson live |
| Question editor | `/sets?id=…` | Build draw and sort questions |
| Projector | opened from the teaching screen | Show student work, leaderboard, or the frozen screen |
| Demo | `/class?demo=1` | Eight practice students, nothing saved |

## 4. Feature breakdown

### 4.1 Question types
- ✅ **Draw:** the student draws the answer on a canvas. Pen, colours, eraser, text.
- ✅ **Sort:** the student drops sticky-note cards into lanes (rock types, layers of the Earth, renewable vs. nonrenewable). The teacher builds the lanes and cards, then drags each card into its correct lane to make the answer key.
- ✅ Cards carry an **idea tag**, so results show which *ideas* to reteach rather than only which students are behind.
- ✅ Sort answers are saved server-side, so a refresh loses nothing.
- ✅ Sort answers can be handed in, locked, and reopened by the teacher ("Let them change it").
- ✅ Right/wrong is shown only when the teacher presses **Reveal answers**, or when the set is configured to show it right away.
- 💡 More question types: **label a diagram** (tap a spot on a teacher-supplied image, e.g. a cross-section of a volcano), **order/sequence** cards (water cycle, rock cycle), **short text answer**.
- 💡 **Image backgrounds for Draw** (a blank map, a graph axes, a diagram to annotate).

### 4.2 Live teaching screen
- ✅ Questions on the left, student drawings in the middle, team scores on the right (collapsible; slide-over on smaller screens). Phone layout under 700px.
- ✅ **Pulse:** students tap 🙋 Stuck / 🙂 Getting there / 💡 Got it. The teacher's card for that student is outlined in that colour, with a text chip so it never relies on colour alone. A class-wide count row filters to "who do I go help."
- ✅ **Freeze:** blurs and locks every student page and the projector ("Eyes up here. Your work is saved."). Timed options of 30s, 1m and 2m. Drawing, text, sorting and colours are blocked server-side, not just visually. Late joiners still land safely on the frozen screen.
- ✅ **Compare:** click up to three drawings to show them side by side on the projector, each at the largest size its shape allows.
- ✅ A new question clears the projector and the freeze.
- 💡 **Anonymous mode** for the projector (hide names so sharing a mistake feels safe).
- 💡 **Pin an exemplar:** save a student drawing from the lesson to a "keep" tray for tomorrow's warm-up.
- 💡 **Answer-then-reveal timer** (countdown visible to students for a quick-draw round).

### 4.3 Teams and points
- ✅ Teams with a name, icon and colour; reorder, add or remove, reset scores.
- ✅ Copy teams between classes, keeping the points of any team already there.
- ✅ Leaderboard on the teaching screen and projector. Each class card shows the top three teams.
- ✅ Real names stay in the teacher's browser; only initials and a team go to the server.
- 💡 **Point presets** (+1, +2, bonus) and an undo for the last award.
- 💡 **Round summary** at the end of a lesson (which team improved most, not just who leads).

### 4.4 Results and reporting
- ✅ **How the class felt report:** a single class score (green 100, amber 50, red 0) with a plain-language reading, a bar per question, how confidence moved from first to last question, and **who to check in with** by name. Export to CSV or copy a summary for a doc or an email home.
- ✅ **Sort results:** a heat map (students × cards), results by idea and by team, "who missed this card" for quick small groups, and **Save results (CSV)**.
- ✅ The projector can show class-wide sort percentages with no names and no key.
- 💡 **Save to Google Drive/Sheets** instead of only a CSV download.
- 💡 **Exit-ticket mode:** a single question at the end of class with an auto-generated "who to see tomorrow" list.
- 💡 **Standards tagging** (e.g. NGSS MS-ESS) on questions, with a class mastery view by standard.

### 4.5 Question sets
- ✅ Build sets in a dedicated editor. Ready-made starter sets (e.g. **Sort It!**).
- ✅ Export, import, back up all data to one file, and **share by link**. The link carries the questions inside the URL, so there is no server storage.
- ✅ Sets stored in the teacher's browser.
- 💡 A small **shared library**, a place teachers can publish and browse sets by unit or topic.
- 💡 **AI-assisted drafting:** type a topic and grade, get a draft draw prompt or sort set to edit.

### 4.6 Multilingual learner support
These are the features most worth building toward, given your student population.
- 🟡 Drawing and sorting are already low-language by design.
- 💡 **Translate the prompt** on the student's screen (home language, chosen by the student).
- 💡 **Read-aloud** for question text and card text.
- 💡 **Picture-supported cards** in sort questions (icon or image beside each word).
- 💡 **Sentence-frame box** under a drawing ("I drew ___ because ___"), optional per student, with a language-selectable prompt.
- 💡 **Home-language response** allowed and flagged to the teacher.

### 4.7 Access, privacy and safety
- ✅ No student accounts or sign-in; nickname or initials only.
- ✅ Sort answer key never leaves the server for students or the projector.
- ✅ Class rooms are deleted after 6 idle hours.
- ✅ Keyboard and screen-reader support on the student sort screen; 44px touch targets on phones.
- 💡 A **full accessibility pass** on the draw canvas (alternative text-description answer option).
- 💡 **Teacher-controlled join:** lock the class code once everyone is in; remove a student.
- 💡 A plain-language **privacy page** you could hand to families and your district.

### 4.8 Hosting and technical shape
- ✅ One small Node process (HTTP + WebSocket), no database. Runs on Render's free plan or any Docker/Node 18+ host.
- ✅ Test suite (`npm test`).
- ⚠️ Constraint: **exactly one instance** (rooms are in memory), and the free plan sleeps after ~15 minutes idle, so open the teacher page a couple of minutes before class.
- 💡 If you outgrow that: persist classes/rooms to a small store so a restart doesn't drop a live lesson.

## 5. A typical lesson, end to end

1. **Before class:** pick or build a question set. Open the class from **Today**. Teams are already set.
2. **Warm-up:** students join with the class code. They see their team colour.
3. **Ask:** send a draw question. Students draw while the teacher watches Pulse colours appear.
4. **Respond:** go to the red outlines first. Freeze the room for a 30-second reteach if many are stuck.
5. **Share:** put two drawings on the projector side by side, compare, and discuss.
6. **Check:** send a sort question (e.g. rock types). Look at the heat map and results by idea, pull a small group for the cards most missed.
7. **Score:** award team points.
8. **After:** save the "how the class felt" report and sort CSV; note who to check in with tomorrow.

## 6. Suggested priorities for what to build next

My recommendation, in order. Cut anything that doesn't match how you actually teach.

1. **Multilingual supports** (translated prompt, read-aloud, picture cards, sentence frames). It is the biggest fit with your students and your TESOL work.
2. **Label-a-diagram question type.** Earth science is diagram-heavy (plate boundaries, layers, the water cycle), and it fills the gap between "draw anything" and "sort cards."
3. **Exit-ticket mode with a next-day check-in list.** It builds on Pulse and the report you already have.
4. **Standards tagging and mastery view.**
5. **Persistence and a shared set library.** Needed once other teachers rely on it.

## 7. Open questions for you

- Is this for **your classroom only**, or are you building it for **other teachers** too? The README suggests the second, which raises the priority of the shared library, persistence and the privacy page.
- Do students use **school Chromebooks** with touch screens, or mouse and trackpad? That decides how much to invest in the drawing canvas.
- Which **home languages** matter most in your room? That sets the translation and read-aloud scope.
- Is the teacher's data staying **in the browser** (current design) acceptable, given that clearing a browser or switching computers loses it? The backup file covers this, but you may want accounts or cloud save later.
