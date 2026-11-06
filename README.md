# Draw It Out

Teachers ask a question, every student draws the answer live, the teacher sees all drawings, puts one on the projector, and awards team points.

- Students: `/` (join with a class code)
- Teachers: `/teacher` (landing page at `/start`, demo at `/teacher?demo=1`)
- Projector: opened from the teacher page

## Run locally
```
npm install
npm start        # http://localhost:3000
npm test         # server tests
```

## Host it for other teachers
Draw It Out is one small Node process (HTTP + WebSocket) with **no database**. Classes live in memory and are deleted after 6 idle hours.

1. **Render (easiest):** push this repo to GitHub, then in Render choose *New + → Blueprint* and select it. `render.yaml` and the `Dockerfile` do the rest. Use the paid *starter* plan: the free plan sleeps when idle and would drop a live class.
2. **Anywhere that runs Docker or Node 18+** (Fly.io, Railway, a VPS): `docker build -t draw-it-out . && docker run -p 3000:3000 draw-it-out`, or `npm ci && node server.js`.
3. Put it behind HTTPS (the hosts above do this for you). WebSockets must be allowed.
4. **Run exactly one instance.** Rooms are held in memory.

Environment variables: `PORT` (default 3000), `MAX_ROOMS` (default 200).

## Privacy design
- No student accounts or sign-in. Students use a nickname or tap their initials.
- A class list (real names) is read in the teacher's browser and is never sent to the server; only initials and a team are.
- Teams, scores and question sets live in the teacher's browser. Teachers can back everything up to one file.
- Question-set share links carry the questions inside the link itself (no server storage).
