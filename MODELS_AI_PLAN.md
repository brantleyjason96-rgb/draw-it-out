# Plan: Build with AI for questions with movable pieces (Phase D)

**Status: proposed, nothing built.** This plan says how the *prompt* will be built so that an AI tool writes pieces questions that the app accepts, and a teacher can trust. It follows `MODELS_PLAN.md` (phases A–C are built).

Today (`public/aibuild.js`) the app writes a prompt for **Draw** and **Sort** questions; the teacher pastes it into any AI tool, pastes the reply back, and one validator (`SK.checkSets`) checks it. The app never calls an AI service. That does not change.

---

## The one problem that decides the design

A pieces question needs an **answer key**: where each piece belongs (and, for a turning piece, which way it faces). An AI tool **cannot see the board** and is unreliable with coordinates. If we ask it for `"kx": 312, "ky": 205` it will invent numbers that land pieces in the wrong place, and a wrong answer key marks students wrong. So:

> **The AI never writes coordinates. It names *places* the app already knows; the app turns them into coordinates.**

Everything else in this plan follows from that.

---

## Decisions for you (my recommendation is the first option in each row)

| # | Question | Recommendation |
|---|---|---|
| E1 | **Who decides where pieces go?** | **The app.** The AI picks a named slot on a built-in diagram (`"slot": "june"`) or a layout (`"layout": "cycle"`); the app works out the spots, so a key can't be mis-typed. The alternative (AI writes numbers) is the one that fails. |
| E2 | **Photo backgrounds and your own diagrams?** | **Not in the first version.** The AI can't see your photo. Later (step D3): *the AI writes the pieces, you drag the answer spots*. |
| E3 | **One prompt for a mixed set (draw + sort + pieces)?** | **Yes**, with three tick boxes instead of the current "Draw / Sort / Mix" choice. |
| E4 | **Are AI-written pieces questions ticked "add" by default?** | **Yes, but each shows a picture of its answer key, large, with "Check this is right"**, because a wrong key is the one mistake a teacher must catch. (The stricter option, unticked until you open it, is a small change if you prefer it.) |
| E5 | **Own pictures from the AI?** | **No.** An AI reply cannot carry a picture. It may use the built-in pictures or text cards, and the prompt says "use a text card unless a built-in picture is exactly right". |

---

## How a question is written (the AI's format)

It is the app's own question format with two friendlier fields in place of numbers. The validator turns it into the real model, so the same checks apply to a pasted reply, a hand-written file and an imported file ("one validator for every way a question can arrive").

```json
{"question": "Place Earth at the right spot in its orbit for each season in the <b>northern hemisphere</b>.",
 "bg": "orbit", "tags": ["Seasons"],
 "model": { "pieces": [
   {"label": "Northern summer", "art": "earth", "slot": "june",      "idea": "Tilt toward the Sun"},
   {"label": "Autumn",          "art": "earth", "slot": "september", "idea": "Equinox"},
   {"label": "Northern winter", "art": "earth", "slot": "december",  "idea": "Tilt toward the Sun"},
   {"label": "Spring",          "art": "earth", "slot": "march",     "idea": "Equinox"} ] } }
```

For a piece that turns (plate motion): `{"label": "Plate A arrow", "art": "arrow", "slot": "plate-a", "turn": true, "facing": "east"}`. `facing` is a compass word (`east` points right, `south` down, `west` left, `north` up) or a number of degrees. A piece that does not turn must not have `facing`.

For ordering and cycles with no diagram: `"model": {"layout": "cycle", "pieces": [{"label": "Magma"}, {"label": "Igneous rock"}, …]}` with the pieces **in the correct order**. The app places the answer spots (a row, a column, a circle or a grid) and turns on *Show outlines*, because with no diagram the student has nothing else to match against. (Step D2.)

What the validator adds, all in plain words when something is wrong:

- looks the slot up in the catalogue for that `bg`, fills `kx`, `ky` (and `ka` from `facing`), then scatters the start spots away from the diagram's middle (the code for this already exists: `SK.scatter`, `SK.bgAvoid`);
- one problem per mistake: *unknown slot "junee" (the slots on this background are june, september, december, march)*; *two pieces use the slot "june"*; *a piece with `facing` must have `turn: true`*; *"img" pictures cannot be used here*; *8 pieces but this background has 4 slots*.

## The slot catalogue (one source of truth)

A small data table in `public/sortkit.js`, `SK.SLOTS`, keyed by background. Each slot has an **id that says what it is**, coordinates in stage units, and a one-line meaning for the prompt. The drawn diagrams in `common.js` read the same numbers (`SK.GEOM`), so a diagram and its slots cannot drift apart.

| Background | Slots (id → where it is on the diagram) |
|---|---|
| `orbit` | `june` left (axis tilted toward the Sun); `september` bottom; `december` right (tilted away); `march` top. Earth moves counter-clockwise. |
| `rings` | `inner-core` centre; `outer-core` right band; `mantle` left band; `crust` top band. |
| `phases` | eight moon positions around Earth with the Sun's light from the left: `new-moon`, `waxing-crescent`, `first-quarter`, `waxing-gibbous`, `full-moon`, `waning-gibbous`, `third-quarter`, `waning-crescent`. |
| `plates` | `plate-a` (left plate), `plate-b` (right plate); pieces there are arrows that turn. |

The Place It! starter set (phase C) was written with these same numbers, so a test can turn each starter question into the AI format and back and check the answer spots are identical. That proves the catalogue covers what we already ship.

## How the prompt is built

`buildPrompt(opts)` already assembles blocks (intro, task, language support, JSON-only reply, tags, a block per question type, limits, worked examples, final self-check). Phase D adds one block type and changes nothing else.

**New options** (dialog step 1): three tick boxes *Draw / Sort / Place pieces* replace the type choice (old saved choices are mapped over); when *Place pieces* is ticked: **Diagram** (Orbit, Earth's layers, Moon orbit, Plate boundary; later *None: put things in order*) and **Pieces per question** (limited by that diagram's slots).

**The pieces block, in the order the AI reads it**

1. *Format* — the JSON above, with only this diagram's `bg` and slot ids.
2. *The picture* — what the diagram shows and what each slot means, in a few lines. Only the chosen diagram is described, so the prompt stays short. Example for `orbit`: "The picture shows the Sun in the middle and Earth's oval orbit around it. Earth moves counter-clockwise. The axis marks lean toward the right at all four spots. At `june` (left) the north pole leans toward the Sun, so it is summer in the northern hemisphere…".
3. *Rules* — each piece uses a different slot; use at most N pieces; **"you are writing the answer key: check which slot is correct for each label before you reply, because the teacher will check your answer against a picture"**; labels at most 24 characters and as plain as possible; use `"card"` unless a built-in picture is exactly right (list of pictures with one-word meanings); `idea` is 1–4 words and shared by pieces that test the same idea (same rule as Sort cards); ask for something the student can *draw on top of* (an arrow, a label) so the drawing part of the question is real.
4. *Limits* — the numbers the validator enforces (2–12 pieces, label 24, idea 30, slot ids from the list), appended to the existing limits block.
5. *Worked example* — built from the catalogue for the chosen diagram, so it is always valid. A test runs every example through `SK.checkQuestion` with no problems and no notes (the same test the Draw and Sort examples already pass).
6. *Self-check* line extended: "check that every slot exists, no slot is used twice, and the answer is scientifically correct".

The language-support block (short sentences, bold science words, optional sentence frame) applies to pieces questions too, and adds: "labels are one to three words; prefer a picture word over a sentence".

**Size.** One diagram's block is about 1,200 characters; the full prompt for a mixed set stays under about 8,000 characters, which fits any free chat tool. A test asserts the budget.

## What the teacher sees on the way back (step 2)

The preview already lists each question with problems in plain words. For a pieces question it adds:

- **A large picture of the answer key**, drawn by the same painter the editor uses (`paintModelBg` + `paintPieces` with each piece at its answer spot and angle), so a wrong season or a plate arrow facing the wrong way is obvious at a glance.
- A line under it in words: "Northern summer → the *june* position", "Plate A arrow → faces east".
- A note when anything was adjusted ("start positions were scattered").
- A one-line reminder, once per paste: **"The picture is your answer key. Check it before you add."**

Nothing changes on the server: what is added is an ordinary pieces question.

## Tests

- Every worked example, for every diagram, passes `SK.checkQuestion` with `problems = []` and `notes = []`.
- The resolved answer spots are on the stage, at least "how close counts" apart, and `SK.modelIssues` is empty.
- **Round trip**: each Place It! starter question → AI format (slots, compass words) → validator → the same `kx`, `ky`, `ka`.
- **Catalogue and painter agree**: the orbit slots lie on the orbit's ellipse, the phase slots on its circle at 45° steps, the ring slots inside their bands, the plate slots on their plates (computed from `SK.GEOM`).
- Bad replies each give one clear problem: unknown slot, repeated slot, too many pieces, `facing` without `turn`, `turn` without `facing`, `art: "img"`, slot from another diagram, pieces with numbers *and* a slot (numbers win and a note says so).
- The prompt contains only the chosen diagram's slots, stays under the size budget, and still passes the existing Draw and Sort prompt tests.
- A fuzz test: random junk through `SK.checkQuestion` never throws.
- Browser pass (Playwright, as in earlier phases): open the dialog, tick Place pieces, pick each diagram, copy the prompt, paste a hand-made reply, see the key picture, add it, open it in the editor, send it, and place the pieces as a student.

## How we will know the prompt works (the part tests cannot do)

Tests prove the format. They cannot prove an AI follows it, or gets the science right. So, before calling this done:

1. Write 12 learning goals (seasons, moon phases, layers, plate boundaries, and a few off-topic ones to see how it behaves when no diagram fits).
2. Run the prompt in three tools (any three the teacher uses) and paste each reply into the app.
3. Record, per reply: accepted first time? which problems? was the key right? was the wording at grade level?
4. Change the prompt wording where the same mistake repeats, and rerun. **Goal: at least 9 in 10 questions accepted first time in every tool, and no wrong answer key that the picture would not have shown.**
5. Keep the failure log in `READINESS_NOTES.md` so a later change to the prompt can be checked against it.

## Steps (each ships on its own)

- **D1 — Pieces on the four diagrams.** `SK.SLOTS` / `SK.GEOM`; validator turns slots and `facing` into the real model; the prompt block; the dialog tick boxes; the key picture in the preview; tests; README. *Done when:* a teacher can build "Seasons" and "Plate boundaries" sets by pasting a reply, see the key, add them, and send one.
- **D2 — Order and cycle.** `layout` (`row`, `column`, `cycle`, `grid`) with *Show outlines* on; limits per layout (a row of 6, a cycle of 8, a grid of 12); the "start at the top and go clockwise" sentence the prompt asks the AI to put in the question.
- **D3 — You place the spots.** For a photo or your own diagram: the AI writes the pieces without positions, the question lands as a draft marked "Drag each piece to its answer spot", and Send stays off until you have done it. (Needs a "draft" state for a question, which does not exist yet.)
- **D4 — Tune with real tools.** The 12 goals × 3 tools loop above, and the wording fixes it finds.

## Risks and how the plan handles them

- **The AI gets the science wrong** (summer at the wrong slot): the key picture and the sentence under it, shown large and ticked only after a reminder; the self-check line in the prompt; the failure log.
- **A diagram is redrawn and its slots no longer match**: slots and painter read the same numbers (`SK.GEOM`), and a test computes the match.
- **The prompt gets long and tools truncate it**: only one diagram is described; size budget test; the validator's plain-language problems tell the teacher what to ask the AI to fix ("the slot 'junee' does not exist").
- **The AI wraps the answer in prose or a code block**: already handled by `SK.extractJson`.
- **An AI invents extra fields** (`x`, `y`, `kx`): numbers the validator would accept as a real key are *ignored when a slot is given* and a note says so, so a stray number cannot move a key.
- **Privacy:** unchanged. The prompt contains the teacher's learning goal and tags only; no student data; the app still never calls an AI service.
- **Old saved dialog choices** (`do_aib` has a single `type`): mapped to the new tick boxes on load; a test covers it.
