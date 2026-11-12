# Draw It Out — Plan: movable models ("Place It")

**Status: proposed, nothing built.** A question you can build in the editor where students drag pieces of a model into the right spots, then draw on top of it.

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
