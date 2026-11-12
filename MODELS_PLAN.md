# Draw It Out — Plan: movable models ("Place It")

**Status: Phases A, B and C are built (see "what was built" under each at the end). Phase D (Build with AI) is planned in `MODELS_AI_PLAN.md` and not built.** Decisions M1–M5 accepted (all recommendations). A clickable mock-up is in `mockups/place-it.html`; no app file in `public/` or `server.js` has changed.** A question you can build in the editor where students drag pieces of a model into the right spots, then draw on top of it.

Open `mockups/place-it.html` in a browser: tab 1 is the editor, tab 2 the student page (drag, draw, keyboard, Reveal, Freeze, phone shape), tab 3 the teaching screen. Changes in tab 1 show up in tabs 2 and 3.

---

## What it looks like in your classroom

You write the question and pick a background (a photo of a diagram, or graph paper). You add pieces: *Sun, Earth, Moon, "Summer", "Winter"*. You drag each piece to where it **belongs** (that is the answer key) and the app scatters them for students. Students see the pieces jumbled, drag each one into place, then use the normal pen, arrows and text to draw on top ("draw an arrow showing which way Earth tilts").

Ideas that fit eighth-grade Earth Science:

| Question | Pieces | Then students draw |
|---|---|---|
| Seasons | Earth ×4 around the Sun | the tilt, and which hemisphere is in summer |
| Lunar eclipse | Sun, Earth, Moon | the shadow, and label umbra |
| Moon phases | 8 moon pictures around Earth | arrows for the orbit direction |
| Layers of Earth | Crust, mantle, outer core, inner core | thickness / temperature notes |
| Plate boundaries | 3 arrow pieces on a cross-section | what forms there (volcano, trench) |
| Pangaea | continent shapes | where the fossil evidence matches |

---

## Decisions for you (my recommendation is the first option in each row)

| # | Question | Recommendation |
|---|---|---|
| M1 | **What can a piece be?** | **Version 1: a text label and/or a built-in picture** (Sun, Earth, Moon, arrow, a few more), plus your own photo as a piece. **Version 2: cut-outs with a see-through background** (continents, layers). Text-only pieces already cover most questions, and they work well for multilingual learners (a short word on a card). |
| M2 | **Can students see where the spots are?** | **Both, per question.** *"Students find the spot"* (no outlines; the app checks against your key; the key never leaves the server, like Sort). *"Show outlines"* (faint dashed spots; pieces snap in; it is a puzzle, so the spots are public on purpose). |
| M3 | **Do pieces need to turn?** | **Not in version 1.** Moon phases and plate arrows would use turning, so it is the first thing in phase C. |
| M4 | **Does it count toward mastery?** | **Yes, by pieces right**, exactly as Sort counts cards right, with the same Idea tags so the dashboard says "needs the seasons idea". Your Got it / Almost / Not yet mark on the drawing stays separate. |
| M5 | **Is it a new question type?** | **No: it is a Draw question with an optional "movable pieces" layer.** Everything Draw already has keeps working: Pulse, Freeze, marks, Compare on the projector, thumbnails, lesson history. A third question type would mean touching about 25 places that branch on `kind === 'sort'`. |

---

## How it works (the design)

### One coordinate system that survives every screen
Each student's page is the size of their screen (`bw` × `bh`), so pixel positions would be wrong on a Chromebook vs a phone. Pieces therefore live on a **stage of 1000 × 625 units** (16:10), drawn centered and scaled to fit each page the same way photos already are (`paintBg`, the "contain" rule). If the background is a photo, the stage takes the photo's shape. Piece positions, the answer key and the tolerance are all in stage units. A student's pen strokes stay in page coordinates as they are today.

### The question
```
{ question, bg, img,                       // as today
  model: { pieces: [{ id, label, art, w, x, y, idea? }],   // x,y = where students find it (scattered start)
           fb: 'reveal' | 'now',            // same option Sort has
           spots: 'hidden' | 'shown',       // M2
           tol: 60 } }                      // how close counts, in stage units (editor slider: tight / normal / loose)
```
Server splits it exactly like `cleanSort`: students and the projector get `pieces` (label, art, size, **start** spot); the key `{ [id]: { x, y }, idea }` is kept in `room.mk` and sent to hosts only. In *shown* mode the targets go into the public part, by design.

### A student's answer
`{ pieceId: { x, y } }`: small, saved on the server, so a refresh or a rejoin loses nothing (same as the sort map). Limits: 12 pieces, labels 24 characters, positions clamped to the stage, unknown ids dropped.

### Moving vs drawing
A new **Move** tool in the student rail (hand-and-box icon, label "Pieces"); it is selected when a model question starts. In Move mode a drag moves a piece and nothing else; in every other tool, pieces are inert so a pen stroke across a piece draws instead of grabbing it. Pieces are painted **under** the ink so arrows sit on top of them. This avoids the one real conflict: a finger can't both draw and drag in the same gesture.
- **Keyboard / switch / screen reader** (the app already does this for Sort): Tab to a piece, Enter picks it up, arrow keys nudge, Enter drops, Esc puts it back; a live-region says "Moon moved to the right of Earth". Tap-a-piece-then-tap-a-place also works on small screens.
- Ink **Undo does not undo piece moves**. A small **Reset pieces** button does that.
- Zoom and pan keep working (`toWorld` already maps the pointer).

### Checking
Piece is right when its center is within `tol` of its key spot. Server computes it (`fbOf`-style) and sends ✓/✕ to a student only when you press **Reveal answers** or the question says "right away". On reveal a wrong piece also shows a ghost where it belongs, like Sort's "Goes in ___". The teacher's thumbnail rings each piece green/red from the key; the projector never gets the key.

### What the teacher sees
- Thumbnails and the projector draw the pieces through the same `paintBoard`, so **Compare (up to 3)** works unchanged.
- Class results for a model question reuse the Sort results panel: pieces × students heat map, **by Idea**, **by team**, "who missed the Moon" for a quick small group, CSV.
- Projector can show class-wide percentages per piece (no names, no key), like Sort.

### Teacher editor (`/sets`)
Under **Draw**, a new section **Movable pieces** (off by default). Two views, like Sort's *Answer key / Student view*:
1. **Answer key**: the background with your pieces; drag each to its correct spot. **Scatter** button makes the student start positions (or drag them yourself).
2. **Student view**: what a student sees (scattered, no spots unless "shown").
Controls: add piece (label / built-in picture / photo), size, Idea tag, tolerance, outlines on/off, "when students see if they're right". Plain-English problems listed under it ("2 pieces overlap at the start", "A piece is off the stage"), and Save / Send now wait until it is complete.

---

## Where it touches the code

| File | Change |
|---|---|
| `server.js` | `cleanModel` next to `cleanSort`; `cleanQ` carries `model`; key in `room.mk`; new `place` message with the same guards as drawing (frozen, locked, picked-for-projector) and a rate limit; `pl` in `joinedMsg` and `stuView`; reset on a new question; include in the Undo snapshot and `restore`; `fbOf` / summary for models. |
| `public/common.js` | `paintModel()`; `paintBoard()` gets a `model` + student's `pl` argument (used by student, class and projector). |
| `public/index.html` | Move tool, drag + keyboard + tap handling, throttled `place` messages (about 8 a second while dragging, final on drop), Reset pieces, live region. Split the ink cache so a moving piece does not repaint 1500 strokes. |
| `public/modeledit.js` (new) | Editor part, modelled on `sortedit.js`. |
| `public/sets.html` | the Movable pieces section, list row chip ("Draw · 4 pieces"), save/send gating. |
| `public/sortkit.js` (`SK`) + `server.js` | Validator copy for `model` (the tests already compare the two), `issues()` for the editor. |
| `public/tcommon.js` | `cleanQs`, share-link packing (`[q, bg, tags]` gets a model slot), export, import, backup, restore. Pieces are small, so links stay short; a photo piece is limited to about 200 px and counts toward the existing photo size note. |
| `public/class.html`, `sortres.js`, `projector.html` | thumbnail painting, key rings, Reveal button for model questions, results panel, projector summary. |
| `public/mastery.js`, `dashboard.js` | pieces-right counts like cards-right. **Add** fields to lesson records (`placeRight/Total`); don't rename `sortRight/Total`, history is already saved in browsers. |
| `public/aibuild.js` | Build-with-AI prompt: add model questions in phase D. |
| `test.js` | see Checks. |

Constraints to keep: no inline event handlers (the security policy blocks them on purpose; new code goes in `.js` files); picture pieces must be `data:` images (already allowed by `img-src`); one server instance, state in memory.

---

## Phases (each one ships on its own)

**A. Place and draw (the useful core).**
Text/label and built-in-picture pieces; editor with answer key and student view; Move tool; server key, placement, check and Reveal; thumbnails and projector; validator, import, export, share link, backup. *Done when:* you can build "Seasons", send it, 30 students place Earth four times and draw on it, you press Reveal, and a refresh mid-lesson loses nothing.

**B. Results and mastery.**
Heat map, by idea, by team, who-missed list, CSV, projector class percentages, lesson history and Dashboard mastery.

**C. Better pieces.**
Rotation (with a tolerance of its own), outlines-and-snap mode polish, cut-out picture pieces with a see-through background, a starter set **Place It!** (Seasons, Layers of Earth, Moon phases, Plate boundaries) beside **Sort It!**.

**D. Build with AI.**
The prompt writes model questions (pieces, spots, ideas) and the shared validator checks them, as for Sort.

---

## What the mock-up showed (changes to the plan)

- **Upright phones make the board small.** A 16:10 stage on a phone held upright is about 310 px wide, so a 108-unit piece is about 33 px: under the 44 px touch size, and labels crowd. **Add a stage shape option, Wide (16:10, default) or Tall (10:16),** chosen per question in the editor (next to Background). Tall suits a diagram a student will do on a phone; Wide suits Chromebooks. The editor shows a warning when pieces would be under 44 px on a phone-shaped page.
- **Reveal works best with a ghost, not only a ring.** A wrong piece gets a red ring and ✕, and a dashed ghost with “*Northern summer* goes here” at the right spot. The ghost sits under the pieces so it never hides one.
- **Pieces are inert while drawing,** and the bottom bar says so (“Pieces are locked while you draw. Choose Pieces to move them again.”). That removes the grab-or-draw confusion, but a student must know to switch tools, so the Pieces tool is selected when the question starts and the hint is always on screen.
- **Overlapping answer spots are a real mistake teachers will make** (two spots closer than the tolerance). The editor now lists it in plain words, as it does for pieces sitting on top of each other at the start.
- **Outline mode needs a rule for which outline a piece takes.** The mock-up slips a piece into the nearest free outline within 80 units; the check is still against that piece’s own spot, so putting a piece in the wrong outline is wrong.

## Risks and how the plan handles them

- **Different screen shapes:** stage units + contain-fit (above). A piece's size is in stage units too, so the editor warns when a piece would be under about 44 px on a phone-sized stage.
- **Touch conflicts (drag vs draw vs pan/zoom):** Move is its own tool; pan stays on the hand button.
- **Server load:** 60 students dragging; throttled messages, one small object per student, cap of 12 pieces.
- **Cheating by looking:** in *hidden* mode the key never goes to a student or the projector, including late joiners and rejoining students (tested for Sort the same way).
- **Frozen / locked / on the projector:** the server refuses placements, not just the browser.
- **Undo a question:** snapshot includes the placements so Undo brings them back.
- **Multilingual learners:** picture-first pieces, short labels, ideas can be tagged for vocabulary; the Text tool still lets students add a sentence frame. (A per-piece "translate" label is a possible later add.)

## Checks (before each phase is called done)
- Server tests in `test.js`: key never in a student, projector or late-watcher message; placements clamped and unknown ids dropped; frozen, locked and picked students are refused; refresh/rejoin restores placements; a new question clears them; Undo restores them; check uses tolerance correctly at the edge; reveal only on press (or "right away").
- Pure tests: the check function, the stage fit for 3 page shapes, validator parity with the server.
- Browser pass (Playwright, as in earlier phases): mouse, touch, keyboard-only, phone on its side, zoomed in, Chromebook-sized window; screenshots into `design-audit/`.
- Page-load gate (no console errors, no native dialogs) before every commit, as before.

## Smallest first step I'd suggest
Phase A with **label pieces only** and the *hidden* mode, to put in front of one real class before building pictures, rotation or results panels. A clickable mock-up in `mockups/` (like the Sort one) can come first if you want to see the editor and student screen before any code.


---

## Phase A: what was built
Labels and built-in pictures (no rotation, no cut-outs), the editor, the Pieces tool, the server key and check, Reveal, thumbnails and projector, and the validator, import, export, share link and backup. `npm test`: 103 tests (90 before; 13 new for pieces). Also run in Chromium end to end: build a question in the editor, send it, place pieces as a student with mouse, touch and keyboard, draw over pieces, Reveal, Freeze, refresh, Undo, reload of saved sets, share-link round trip; no console or security-policy errors on the editor, student, teaching or projector pages.

**Choices made while building**
- The board shape (Wide / Tall) from the mock-up findings is in. Switching it scales every piece's position.
- Piece start spots and answer spots are rounded whole numbers, clamped so the whole picture stays on the board.
- The key is `room.sk = { pos, idea, tol }` for model questions (a sort question uses `{ lane, idea }`); the browser tells them apart by the question's `model`.
- Pieces are painted between the background and the ink; the piece being dragged is painted on top until it lands.
- With the pen (or any other tool) selected, pieces are inert and the bottom bar says so.
- A text-card piece is a sticky note with its label inside; the other pictures show the label under them.
- The Build with AI prompt is not changed (Phase D), but pasted or imported questions with a `model` are checked by the shared validator, and pieces without start positions are scattered.

**Known limits (Phase A)**
- The editor's piece list has no drag-to-reorder; the order is the order added.
- (Done in Phase B.) The class results panel, per-piece percentages, mastery and lesson-history scores for pieces.
- (Done in Phase B for the Review tab.) The phone Questions tab and the teacher's phone remote.
- A teacher page that connects after the question was sent without being a host sees the pieces but no rings.
- `roundRect` is used to draw cards and labels: it needs Chrome 99 or Safari 16 and later.


---

## Phase B: what was built
Class results, the projector summary, CSV, and lesson history, mastery and the Dashboard for pieces. `npm test`: 106 tests (103 before; 3 new). Run in Chromium end to end: three students place pieces, the results panel, piece and student detail, the CSV download, results on the projector, the saved lesson record, two lessons into the Dashboard (Omar and Priya Not yet at 33%, Maya Secure), a backup round trip of the new fields, and the phone Review tab; no console or security-policy errors.

**Choices made while building**
- One teaching screen, two views: *Drawings* (the grid, with rings) and *Class results* (the sort-style panel). A pieces question is still a drawing, so it opens on Drawings.
- The numbers live in `SK.modelStats` (pure, tested) so the panel, the CSV and the tests agree. The panel is `public/modelres.js`; it reuses the sort results' look (`sortres.css`).
- **Biggest mix-up** is a piece put on another piece's answer spot (within how close counts). A wrong piece near no spot shows `?`.
- A pieces question's lesson record is `kind: 'draw'` with `model: true` and `placeRight / placeTotal / placePlaced` per student, so old records and old backups still read. A lesson gives one data point per student: pieces first, the mark only when no piece was moved. `MK.score` takes the lesson (or, as before, just its kind).
- The Dashboard counts pieces lessons separately from "drawings with no marks", so they never appear as unmarked.
- Results on the projector turn off for the next pieces question (they used to carry over for sort questions, and still do).
- Without the answer key on the screen (a teacher page that joined late without hosting) the lesson is saved as a plain drawing, not scored.

**Known limits (Phase B)**
- A piece's percent on the teacher's screen is out of the students who moved it; on the projector it is out of all students who started (the same difference Sort has).
- The panel has no per-team piece breakdown beyond the team bar.
- Pieces results are not in the Dashboard's CSV beyond the existing mastery numbers.


---

## Phase C: what was built
Rotation, drawn diagram backgrounds, pictures of your own, outline polish and the **Place It!** starter set. `npm test`: 116 tests (106 before; 10 new). Run in Chromium end to end: the starter set added and opened in the editor, turning in the editor (checkbox, ↺ ↻, dragging the handle, the angle tolerance), a picture upload (a white-backed PNG made see-through, toggled back, saved, round trip through a share link), a student picking a piece, dragging its handle, using Turn right, and `]` on the keyboard, Reveal with the faint correctly-facing copy, the results table with ↻, and all four diagrams on the student screen; no console or security-policy errors.

**Choices made while building**
- A piece that turns is `{ turn: true, a, ka }` (start angle, answer angle) and the model has `atol` (default 30°, held between 10° and 90°). A student's entry is `{ x, y, a }`; the server fills in the start angle if none is sent and drops an angle sent for a piece that cannot turn.
- The answer angle (`ka`, `atol`) is a key, like the answer spot: only teachers get it, and students get it only with *Show outlines*.
- Angle 0 is the picture as drawn (an arrow points right) and angles go clockwise. Moon phases are drawn lit on the right (or left with the `-l` pictures); a waning crescent is its own picture rather than a turned waxing one.
- The picture is a data URL (PNG, JPEG or WebP, at most 140 KB, 700 KB in all). Anything else, or a picture over the budget, becomes a text card on the server and in the browser rules. A question with pictures is sent to every student and the projector, so the size limit is deliberately small.
- The diagrams are drawn in code, around the middle of the page, so they take no storage and need no picture. They are made for the wide board; on the tall board they are smaller and centred.
- `modelCheck` now needs place **and** angle; `modelMix` gains `SK.TURN` (-1) for "right place, wrong way", which is not counted as a swap.
- Bug found and fixed in the browser run: the teacher screen's merged model did not carry the answer angles, so every turning piece looked wrong there. `modelFull()` in `class.html` now adds `ka` and `atol`.

**Known limits (Phase C)**
- A piece that turns is grabbed as a circle at any angle, so a long arrow can be grabbed slightly off its tip.
- Moon-phase pieces do not turn (the lit side already faces the way the picture shows); a question that needs the lit side to turn would use an arrow or Earth.
- Pictures of your own do not travel in share links (text only, by design); a teacher who wants to send a set with pictures exports it as a file.
- The drawn diagrams are fixed pictures: there is no way yet to add labels or move parts of them. A photo background is still the way to use your own diagram.
- Picture pieces do not use the "cut-out with a see-through background" step beyond the edge-white removal (no magic-wand or manual erase).
