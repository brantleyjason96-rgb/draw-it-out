# Draw It Out

Teachers ask a question, every student draws the answer live, the teacher sees all drawings, puts one on the projector, and awards team points.

Two kinds of question:
- **Draw**: students draw the answer.
- **Sort**: students drop sticky-note cards into lanes (rock types, parts of speech, branches of government, rational or irrational). The teacher builds the lanes and cards in the question editor and drags each card into its correct lane to make the answer key. Cards can carry an *idea* tag, so the class results show which ideas to reteach, not just who is behind.

- Students: `/` (join with a class code)
- Teachers: `/teacher` is **Today** (classes, question sets, starter sets, backup). From there:
  - `/class?code=…` is the teaching screen (also a phone layout under 700px wide)
  - `/sets?id=…` is the question editor (its own screen)
  - `/class?demo=1` is the demo (eight practice students; nothing is saved)
  - `/classic` is the previous single-page teacher screen, kept as a fallback
- Landing page: `/start`
- Projector: opened from the teaching screen

### Sort questions: how they work
- The **answer key stays on the server** and goes to teachers only. Students and the projector get lane names and card text, never which lane is right.
- A student's whole answer is one small map of card to lane. It is saved on the server, so a refresh loses nothing, and it works on any screen size.
- Right and wrong reaches a student only when the teacher presses **Reveal answers**, or when the question is set to show it right away. A handed-in answer is locked until the teacher chooses *Let them change it*.
- The class screen shows a heat map (students by cards), results by idea and by team, a list of who missed each card for a quick small group, and **Save results (CSV)**.
- The projector can show one student's lanes, or class-wide percentages (no names, no key).
- Sets with sort questions export, import, back up and share by link like any other. A few ready-made sort questions are in the starter set **Sort It!**
- Code: `public/sortkit.js` (shared), `sortedit.js` (editor), `sortstu.js` (student), `sortres.js` (class results); server rules are in the "sort questions" section of `server.js`.

## Run locally
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

## Privacy design
- No student accounts or sign-in. Students use a nickname or tap their initials.
- A class list (real names) is read in the teacher's browser and is never sent to the server; only initials and a team are.
- Teams, scores and question sets live in the teacher's browser. Teachers can back everything up to one file.
- Question-set share links carry the questions inside the link itself (no server storage).
