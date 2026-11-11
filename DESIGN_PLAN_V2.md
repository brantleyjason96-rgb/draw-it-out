# Draw It Out — Design Plan 2: a professional, intuitive app

**Status: approved, not yet built. If you are here to build it, read [Build instructions](#build-instructions-for-the-implementer) first.** All four recommendations under [Decisions](#decisions-for-you) were accepted. Clickable mock-ups of the two big layouts are in `mockups/student-draw.html` and `mockups/teaching-screen.html`; no app file in `public/` has been changed.

The first plan (`DESIGN_PLAN.md`, tasks T00–T23) is finished: one set of colours, visible keyboard focus, readable contrast, plain-English student wording. It made the app *consistent and accessible*. It did not change layout, navigation or the look of any screen. This plan does.

Evidence: the 110 screenshots in `design-audit/after/` (37 screens at 1440×900, 1366×768 and 390×844). Screen numbers below (`31`, `53`…) are those file names.

---

## Summary

1. **The app works well but looks home-made in five specific ways**: two different logos, two different fonts, emoji used as icons, buttons that all look equally important, and small capital-letter labels everywhere on teacher pages.
2. **The teaching screen is the biggest problem.** On a 1366-wide laptop it shows about one and a half rows of student drawings, because 25+ controls sit around them. Each question has five buttons; each team has three; the More menu has 13 items.
3. **The student drawing page has five separate floating panels** over the canvas (question, tools button, undo/redo, zoom, "How is your work?"). The proposal is one fixed frame: question on top, tools down the left, everything else in one bottom bar.
4. **The projector is the screen the whole room sees, and it is the plainest.** The leaderboard is a bare list; three drawings side by side use less than half the screen.
5. The work is in **five phases, each shippable on its own**. Phase 1 (shared look) changes every screen a little; phases 2–5 redesign one group of screens each.

---

## Decisions for you

**Decided: the recommendation in every row.**

| # | Question | My recommendation |
|---|---|---|
| Q1 | **Fonts.** Teacher pages load Figtree and Bricolage Grotesque from Google; student pages and the projector use the device's own font. Use one font everywhere? | **Yes: Figtree everywhere, stored in the app itself** (no request to Google from student devices, which also keeps the privacy promise simple). Bricolage only for the logo and page titles. |
| Q2 | **Logo.** The student join card has a blue square with a squiggle; teacher pages have a target-style circle. Which one? | **The blue square with the pen stroke.** It says "draw", and it reads at small sizes. Use it on every page, including the landing page and projector, which have none today. |
| Q3 | **How bold a change on the teaching screen?** (a) Tidy only: same three columns, fewer buttons. (b) Restructure: questions collapse to a slim strip while a question is live, so drawings get the space. | **(b).** During a question you look at drawings, not at the list of questions. Details in [Teaching screen](#3-teaching-screen-class). |
| Q4 | **Student tools: drawer or always-visible rail?** Today the tools are behind a "Tools" button (Quick mode shows a small bar instead). | **Always-visible slim rail on Chromebooks and tablets**, drawer only on phones. One fewer tap for every tool change, and students see what is available. |

---

## What makes it look unprofessional today (applies to every screen)

| # | Finding | Where you can see it | Fix (phase 1) |
|---|---|---|---|
| X1 | Two logos, and no logo at all on the landing page or projector. | `13` vs `40`; `01`; `50` | One logo, one lock-up, on every page. |
| X2 | Two fonts. Student and projector pages look like a different product from teacher pages. | `14` vs `31` | One font, self-hosted (Q1). |
| X3 | Emoji used as icons (✏️ ✋ 📌 🚪 📋 📁 ❄ 🔍) next to plain symbols (⬚ T ◇ ↶ ✕). Emoji look different on Chromebook, iPad and Windows, and cannot take the app's colours. | `15`, `31`, `40` | One small set of line icons (about 30, drawn as SVG inside the app, no download). Emoji stay only where they are *content*: team icons and the three pulse faces. |
| X4 | Every button is a white box with a grey border, so nothing says "press me next". On `31` there are 30 same-weight buttons in view. | `31`, `41` | Three button levels with strict rules: **one** filled primary per area; outlined secondary; borderless tertiary for small, repeated actions. |
| X5 | Small capital-letter labels with wide spacing (`STUDENTS ARE ANSWERING`, `YOUR CLASSES`, `PEN TYPE`, `ON PROJECTOR (3/3)`). Harder to read, and overused they flatten the page. | `31`, `34`, `40`, `15` | Sentence-case labels at 14 px semibold. Capitals removed everywhere. |
| X6 | 8–14 different text sizes per page. | all | Snap to the 8-step scale already in `tokens.css`; body text 16 px. (This is deferred item D2 from plan 1.) |
| X7 | Symbols as words: `▾`, `⋯`, `✕`, `↑ ↓`, `− +` with no label or tooltip a new teacher would understand. | `31` | Icons get a visible label where there is room and a tooltip + screen-reader name where there is not. |
| X8 | Messages appear in three places: top banner, bottom toast, demo bar; the toast can cover the demo bar's button. | `32`, `33` | One message area, top-centre under the bar, never over a control. |

---

## Screen-by-screen proposals

### 1. Landing page (`/start`) — `01`

**Today:** a headline and nine white boxes of text. No logo, no picture of the product, and the link for students is one small line at the very bottom.

**Proposed**
- Top bar: logo left; **Join a class** (for students) and **Start a class** (for teachers) right. A student who lands here by mistake finds the door at once.
- Hero: keep the headline. Beside it, a real picture of the teaching screen with nine drawings arriving (a still image at first; a short loop later).
- Three steps become one horizontal strip with an icon and a tiny screenshot each: *Share the code → Students draw → See everyone, show one*.
- "What you get" shrinks from four boxes to three, with icons; add **Sort questions** (currently not mentioned at all).
- Privacy stays, as a calm two-column block: four short points left, the school-approval note right.
- Footer with logo, demo link, student link.

### 2. Student screens (`/`)

#### 2a. Join — `10`–`13`
**Today:** clean, but the filled-in code becomes a large grey box that looks disabled; Join can sit under the fold with five or more teams; small logo.

**Proposed**
- Class code as **four separate letter boxes** (like a phone PIN). It shows how many letters are expected and makes a wrong code obvious.
- Step 2 shows the code as a small "Class H9FM · change" line instead of the big grey box, giving the room to the team tiles.
- Team tiles: 2 across on phones, 4 across on laptops, so eight teams fit without scrolling. Selected tile fills with the team colour tint plus the tick.
- **Join** button fixed to the bottom of the card, always visible.
- Error ("We can't find that class") appears inside the code boxes with a shake-free red outline and one plain sentence.

#### 2b. Draw — `14`–`19`
**Today:** five floating panels over the page. The question bar covers the top of the drawing. Tools are hidden behind a button. The zoom slider takes a third of the bottom edge. The drawer mixes emoji and symbols.

**Proposed: one fixed frame, nothing floating over the paper**

```
┌──────────────────────────────────────────────────────────┐
│ ● Granite · 0 pts │ Draw a cross-section of Earth…   ⌃  │  question bar (docked)
├────┬─────────────────────────────────────────────────────┤
│ ✎  │                                                     │
│ ⌫  │                                                     │
│ T  │                    paper                            │
│ ◇  │                                                     │
│ ⬚  │                                                     │
│ ●  │                                                     │
├────┴─────────────────────────────────────────────────────┤
│ ↶ ↷ │   How is your work?  [help] [almost] [understand]  │ −  100%  + │
└──────────────────────────────────────────────────────────┘
```

- **Question bar** docked across the top, team chip on its left. Collapses to one line with a single tap; the paper starts below it, so the question never hides work.
- **Tool rail** (Q4): Draw, Eraser, Text, Shapes, Select, and the current colour. Tapping a tool that has options (pen type, thickness, colours) opens a small panel beside the rail, which closes when the student starts drawing. "Move view" leaves the rail: two-finger drag and the space bar already do it; a hand button stays in the zoom group.
- **Bottom bar**: Undo/Redo left; pulse in the middle as three compact buttons with their words; zoom right as `− 100% +` (the slider and magnifier go; tapping `100%` fits the page).
- **Quick mode** is the same frame with fewer tools on the rail, instead of a different layout. Students learn one screen.
- **Colours**: 12 swatches in a 6×2 grid; the rainbow "any colour" button moves to the end with a label.
- **"Leave this class"** moves into a small menu on the team chip, away from the tools, with a confirm.
- **On projector / Frozen** states keep their wording. "On projector" becomes a coloured state of the question bar itself rather than a second banner.
- **Phone**: the rail becomes a bottom row of tools; pulse folds to the three faces.

#### 2c. Sort — `20`–`25`
**Today:** this is the best-designed student screen. Small problems: after sending, a large empty "Cards" tray stays on screen; on reveal with many wrong cards the page is a wall of red.

**Proposed**
- Same docked question bar as Draw.
- When all cards are placed the tray collapses and **I'm done** becomes the one large button.
- After reveal: wrong cards keep the ✕ and "Goes in …" line but use a red *left edge* and normal note colour, not a full red outline. The score moves to the question bar ("You got 3 of 10") so it is the first thing read.
- Lanes get a count ("Igneous · 4").

### 3. Teaching screen (`/class`) — `30`–`35`

**Today (1366×768, `31`):** top bar with 7 controls; left column where each question carries Send, ↑, ↓, Edit, ✕; a middle column that spends four rows (question card, status line, pulse filters + names toggle, "on projector" strip) before the first drawing; a right column where each team has −, +, ⋯; three more buttons under that; a demo bar. About 1½ rows of drawings are visible.

**Proposed (Q3 option b)**

- **Top bar, grouped left to right by what you are doing:**
  *where you are* (← Today · class name) → *the room* (Join code, "9 joined") → *live controls* (Freeze, Projector) → *More*. "Scores" stops being a top-bar button; the scores panel has its own handle.
- **Questions column**
  - Each question shows its text and **one** button: **Send**. Edit, move and delete go behind a single ⋯ on hover/focus; reorder by dragging.
  - While a question is live the column **collapses to a slim strip** showing `2 of 5` with previous/next. One click reopens it. This gives the drawings about 280 px more width: three cards across instead of two on a Chromebook-size laptop.
  - "Add question" and "Starter sets" stay at the bottom; set picker stays at the top.
- **Middle column**
  - Question card: the question, with the status as a sentence under it ("9 of 9 have started"), and the single primary action for that moment on the right (Give point / Reveal answers).
  - **One toolbar row** replaces three rows: pulse filters (with words on wide screens: "Need help 0 · Almost 2 · Understand 7") · Report · names-on-projector switch.
  - "On projector" strip appears only when something is up, in the same row height, with thumbnails instead of name chips.
  - **Student cards**: name and pulse chip on top; drawing; footer with team as a small chip (click to change — the full-width dropdown goes) and **+1**. The whole-card coloured outline for pulse becomes a 4 px top edge plus the chip, so a full grid no longer looks like a set of alarm boxes. Card size slider (small / medium / large) so 30 students fit on one screen.
- **Team scores panel**
  - Each team is one row: rank, icon, name, score, and **+** only. Minus and the other actions move behind ⋯ (taking a point away is rare and should be deliberate).
  - "Rename teams & icons" and "Class list & teams" become one **Set up teams** link. "Leaderboard on projector" stays as the switch.
- **More menu**: from 13 items in one list to three labelled groups, with duplicates removed:
  - *This lesson*: Quick mode · How the class felt · Save drawings
  - *Joining*: Show QR code · Copy student link · Use my phone as a remote
  - *Class*: Set up teams · Rename class · Clear class · Remove class (the two red ones separated at the bottom)
  - Back up / Restore move to Today, where the rest of "my stuff" lives.
- **Sort results (`34`)**: the three rows of controls (names switch, two sort dropdowns, CSV + projector switch) merge into the one toolbar row. The five stat tiles become one line of four. The heat map moves up so it is visible without scrolling. (Deferred item D4 from plan 1.)
- **Demo bar**: one thin line with the "Start my real class" button, and a first-run coach mark (three steps: *Send a question → Click a drawing → Give a point*) instead of the long paragraph.
- **Phone layout** keeps its three tabs; it gets the new icons, buttons and card style only.
- **Under the hood first:** `class.html` is 1,135 lines with 47 inline styles. Its CSS moves to `class.css` before any of the above (deferred item D1). No visible change, but it makes the rest safe.

### 4. Teacher home (`/teacher`), teams, and the question editor — `40`–`45`

#### 4a. Today — `40`
**Today:** tidy but thin. "Classes / Teams" is a two-button toggle; question sets and starter sets are below the fold; a set tile shows an empty grey square; Help is a button with no clear destination.

**Proposed**
- Navigation moves into the top bar as real tabs: **Classes · Question sets · Teams**, with Demo and Help on the right. Each tab is one job; nothing important is below the fold.
- **Class card**: name, join code as a clear chip, teams shown as their coloured icons, "last used Tuesday", and **Start class** as the one primary. ⋯ keeps the rest.
- **Question sets** tab: tiles show the set's colour, question count, and how many are Draw vs Sort. Starter sets sit beside "Your sets" as a second section with a subject filter. Import / New folder / New set become one **New** menu plus a visible **New set** button.
- **Back up everything / Restore** as a quiet footer row on every tab, with the date of the last backup.
- First visit (no classes yet): a single welcome card — *Name your class → Start* — instead of the empty grid.

#### 4b. Teams tab — `41`
**Today:** five controls in one row (Add team, Copy to another class, a "4 teams" dropdown, Create teams, Reset all scores) with no hierarchy; the empty state is one grey sentence.

**Proposed**
- Empty state: a centred card, "How many teams?" with 2–8 as buttons, then **Create teams**. That is the whole first-time job.
- With teams: each team is a row with a drag handle, icon, name, colour; **Add team** under the list. "Copy to another class" and "Reset all scores" move to a ⋯ menu in the card header; Reset keeps its confirm.
- The right-hand preview ("What students and the projector see") becomes a real miniature of the join tiles and leaderboard, updating as you type.

#### 4c. Question editor (`/sets`) — `45`
**Today:** good bones (list · form · live preview). The left column is mostly empty; Save is below the fold on a Chromebook; the preview shows four colour dots that do not match what students get.

**Proposed**
- Left list shows each question with a Draw/Sort icon and a drag handle; **Add question** pinned at the bottom.
- **Save question** in a bar fixed to the bottom of the form, always visible, with "Saved ✓" feedback.
- Bold / Italic / Underline become one compact toolbar joined to the text box.
- The preview uses the real student frame from 2b at small scale, so what you see is what students get. A phone / Chromebook switch above it.
- Sort editor: keep the mock-up already in `mockups/`; restyle with the new buttons and icons.

### 5. Projector — `50`–`55`

**Today:** dark navy with the device font. The join screen (`50`) is good. Three drawings side by side (`52`) sit in the top half with the bottom half empty. The leaderboard (`53`) is a plain list with a small colour blob under each name and the score far to the right. Sort results (`55`) are red bars for anything under about 60%, which reads as "the class failed" to the room.

**Proposed**
- **A thin footer on every view**: logo left, "Join at *site* · code **YC4M**" right. The corner "Join:" label goes. Late students can always join; the question keeps the full width.
- **One drawing / compare**: tiles fill the height that is left under the question; names sit on a label attached to each tile. With three up, the tiles are about 40% larger than today.
- **Leaderboard**: each team is a full-width bar in its team colour, length = points, with rank, icon, name and score *inside the row*; rows move when the order changes, and the top team gets a small crown. With all scores at zero it shows the teams evenly with "First point wins the lead".
- **Sort results**: one neutral colour for the bars, with the percentage; the best-understood idea gets a ✓. No red on the screen the class is looking at. "Hardest cards" becomes "Let's look at these again".
- **Frozen**: keep. Add the logo footer so it matches.
- **Waiting between questions** (new): after a question is cleared, show the class name and join footer instead of the last question.
- Same font as the rest (Q1); question text sizes from plan 1 (T22) stay.

---

## Phases

Each phase ends with new screenshots in `design-audit/v2/` and `npm test` passing. Each can ship without the next.

| Phase | What | Screens touched | Size |
|---|---|---|---|
| **1. Shared look** | One logo; one self-hosted font; icon set; three button levels; sentence-case labels; type scale; one message area. Move `class.html` CSS into `class.css` (no visible change). | All, lightly | Medium |
| **2. Student** | Join (code boxes, fixed Join button). Draw frame (docked question, tool rail, bottom bar, Quick mode in the same frame). Sort polish. | `10`–`25` | Large |
| **3. Teaching screen** | Top-bar groups; questions column with one button and collapse; one toolbar row; new student card; scores panel; grouped More menu; sort-results header; demo coach marks. | `30`–`35` | Large |
| **4. Projector** | Footer with join code; bigger compare tiles; bar leaderboard; neutral sort results; waiting view. | `50`–`55` | Small–medium |
| **5. Home, teams, editor, landing** | Top-bar tabs on Today; class and set cards; Teams empty state and rows; editor save bar and real preview; landing page. | `01`, `40`–`45` | Medium |

**Suggested order if time is short:** 1 → 3 → 2 → 4 → 5. The teaching screen is where you spend the lesson, and it has the most to gain.

The task-by-task build instructions are in [Build instructions](#build-instructions-for-the-implementer) at the end of this file.

---

## What does not change

- How anything works: the server, the tests, privacy design, question sets, backups, share links.
- Drawing ink colours and team colours already saved by teachers.
- Student wording agreed in plan 1 (*How is your work? — I need help / Almost / I understand*, *Frozen. Look at your teacher.*).
- No sign-in, no build step, no new outside service. Phase 1 *removes* the only outside request (Google Fonts).
- Accessibility rules from plan 1 stay as the floor: 44 px touch targets, 3:1 control borders, visible focus, never colour alone.

## Risks

- **Muscle memory.** Teachers who use the app now will find Send, +1 and Freeze in the same places; the things that move are the rare ones (minus a point, delete a question, backup). A one-time "What moved" note on first load covers it.
- **Student tool rail on small Chromebooks (1366×768).** The rail costs 64 px of width but the docked bars give back the height lost to floating panels. To be checked in the mock-up.
- **Self-hosted fonts** add about 60 KB to the first page load on student devices; cached after that.
- **Phase 3 is the riskiest code change** because of the size of `class.html`. That is why the CSS move is in phase 1 and the mock-up comes first.

---

## Build instructions (for the implementer)

This section is written for a person or an AI session who was not part of the planning. Everything above is the *what* and *why*. This is the *how*.

### Start here

1. Read this whole file once. The owner has approved every recommendation in [Decisions](#decisions-for-you); do not reopen them.
2. Open the two mock-ups in a browser (they are plain files, no server needed):
   - `mockups/teaching-screen.html` is **the specification for phase 3**.
   - `mockups/student-draw.html` is **the specification for phase 2**.
   Their `<style>` blocks are also the specification for the shared look in phase 1 (button levels, icon style, switches, menus, chips).
3. Look at the current app: `design-audit/after/` holds 110 screenshots (file names `<number>-<screen>--<width>x<height>.png`).
4. Set up and check the baseline:
   ```
   npm ci
   npm test          # must end with: 43 passed
   ```
5. Work on a branch. Do the tasks in the order listed: phase 1, then 3, then 2, then 4, then 5.

### What the app is made of

No build step, no framework, no database. One Node process (`server.js`) serves `public/` and a WebSocket.

| Screen | File | Shared files it loads |
|---|---|---|
| Student (`/`) | `public/index.html` | `tokens.css`, `style.css`, `sortkit.css`, `common.js`, `sortkit.js`, `sortstu.js` |
| Teaching screen (`/class`) | `public/class.html` (1,135 lines; its own `<style>` is lines 12–181) | `tokens.css`, `tstyle.css`, `sortres.css`, `common.js`, `tcommon.js`, `sortres.js`, `qrcode.js` |
| Today (`/teacher`) | `public/teacher.html` | `tokens.css`, `tstyle.css`, `tcommon.js`, `emoji.js` |
| Question editor (`/sets`) | `public/sets.html` | `tokens.css`, `tstyle.css`, `sortkit.css`, `tcommon.js`, `sortedit.js` |
| Projector (`/projector`) | `public/projector.html` | `tokens.css`, `style.css`, `sortkit.css`, `common.js`, `qrcode.js` |
| Landing (`/start`) | `public/landing.html` | `tokens.css`, `style.css` |

- `public/tokens.css` holds every colour, size, radius and shadow. It is the only stylesheet allowed to contain hex colours.
- `server.js` serves **only** `.html`, `.js`, `.css` and `.json` (the `TYPES` table near the top). Any other file type returns 404 until it is added there.

### Rules (apply to every task)

- **One task = one commit**, message `V07: <title>`. Run the task's **Done when** checks before committing.
- **`npm test` must pass after every task.** It prints `43 passed` today and `44 passed` after V02 adds one test.
- **Behaviour does not change unless a task says so.** This is a redesign of layout and look. Every feature that works today must still work: joining, drawing, sort questions, pulse, freeze (including the timed-freeze menu), compare up to three, points, reports, CSV, backup and restore, share links, the phone remote, the demo.
- **Where a mock-up button only shows a note** ("Not part of this mock-up"), keep the app's existing behaviour for that control. The mock-ups simplify some things (for example Freeze is a plain toggle there); the real feature stays.
- **Where a mock-up and `tokens.css` disagree on a size or colour, `tokens.css` wins.** The mock-ups use a few in-between sizes (15, 17, 20, 22 px); use the nearest token.
- **Do not copy these from the mock-ups:** the Google Fonts `<link>`, the missing `<!doctype>`, the `claude:viewport-fit-sides` meta, the yellow "Mock-up" strip, the stand-in drawings and demo data.
- **Never change ink.** Drawing colours are saved inside students' drawings: the `COLORS=[…]` array, `data-qc` buttons and `S.color` defaults in `index.html`; `COL` in `class.html`; `TEAM_COLORS` and `PRE` in `tcommon.js`; every `fillStyle` / `strokeStyle` in `common.js`.
- **Only touch `server.js` and `test.js` where a task says so** (V02 only). Never touch `package.json`, `package-lock.json`, `Dockerfile`, `render.yaml`, `public/qrcode.js`, `public/starters.json`.
- **No new dependency, no build step, no outside request.** After V02 no page may load anything from another site.
- **Accessibility floor** (from plan 1; do not go below it): touch targets 44 px; borders of text boxes, toggles and drop zones 3:1 against white (`--c-control`); a visible focus ring on every control; status never shown by colour alone (always a word or an icon too); every icon-only button has an `aria-label` and a `title`.
- **Student-facing words stay plain.** Many students are learning English. Keep the wording agreed in plan 1. Any new student text must be short, literal, present tense, with no idioms. New student strings in this plan: `Color`, `Shapes`, `Pen type`, `Thickness`, `Hide` / `Show`, `Stay` / `Leave`, `Your work is on the projector. You cannot draw now.`, `You got 3 of 10`.
- **American spelling in the interface** (`Color`), matching the app today.
- **If the code contradicts this plan** (an element is missing, a feature works differently from how a task describes it), stop and report. Do not guess.
- Things remembered per device (folded panels, card size) go in `localStorage` inside `try/catch`, the same way the pages already do.

### Screenshots

```
PORT=3111 node server.js &
OUT=design-audit/v2 node design-audit/capture.cjs           # all three sizes, about 6 minutes
OUT=design-audit/v2 node design-audit/capture.cjs 1366      # one size
```

- Always set `OUT`. Without it the script overwrites the original baseline.
- The line `STEPFAIL more 390x844` is expected. Any other `FAIL`, `STEPFAIL` or `PAGEERR` line is a problem.
- `capture.cjs` clicks elements by id (`#toolsbtn`, `#dclose`, `.tool[data-t=pen]`, `#pulse .pb[data-p=y]`, `#more`, `#pick button`, `#sdone button`, `#spile .nc[data-card]`, `#sstage .slane`, `#code`, `#go`, `#name`). **When a task removes or renames one of these, update `capture.cjs` in the same commit.**
- Commit the screenshots once at the end of each phase (tasks V08, V19, V26, V35, V46), not after every task.

---

### Phase 1 — shared look

#### V01 — Move the teaching screen's CSS into its own file
- **Why first:** every later task edits this CSS. Moving it while nothing else has changed lets you prove the move changed nothing.
- **Files:** `public/class.html`, new `public/class.css`.
- **Do:** cut the contents of the `<style>` block (lines 12–181) into `public/class.css`, unchanged and in the same order. Replace the block with `<link rel="stylesheet" href="/class.css">` in the same position (after `sortres.css`). Do not move the 47 inline `style="…"` attributes yet.
- **Done when:** `grep -c '<style>' public/class.html` → `0`; screenshots `30`–`35` at all three sizes are the same as in `design-audit/after/`; `npm test` → `43 passed`.

#### V02 — One font, stored in the app
- **Files:** new `public/fonts/` (font files and `OFL.txt`), new `public/fonts.css`, all six pages, `public/style.css`, `public/tokens.css`, `server.js` (one line), `test.js` (one test).
- **Do:**
  1. Add **Figtree** (variable, weights 400–800, Latin and Latin-Extended) and **Bricolage Grotesque** (weight 700) as `.woff2` files in `public/fonts/`. Both are under the SIL Open Font License; include the licence text as `public/fonts/OFL.txt`.
  2. `public/fonts.css`: the `@font-face` rules, `font-display:swap`, URLs under `/fonts/`.
  3. `server.js`: add `'.woff2': 'font/woff2'` and `'.txt': 'text/plain; charset=utf-8'` to `TYPES`. Nothing else.
  4. Every page: add `<link rel="stylesheet" href="/fonts.css">` **before** `tokens.css`. Remove the Google Fonts `<link>` and `preconnect` lines from `class.html`, `sets.html`, `teacher.html`.
  5. `style.css`: body font becomes `var(--font-body)`. Canvas text drawn by `common.js` keeps its current font (it is part of the drawing).
  6. Use `--font-display` only for the logo word-mark and page titles (`h1`, panel titles, score numbers), as in the mock-ups.
  7. `test.js`: one test that `GET /fonts/<the Figtree file>` returns 200 with `Content-Type: font/woff2`.
- **Done when:** `grep -rn 'googleapis\|gstatic' public/` prints nothing; student, projector and landing pages render in Figtree; `npm test` → `44 passed`.
- **Risk:** total font weight should stay under about 120 KB. If the variable file is larger, subset it to Latin + Latin-Extended.

#### V03 — One logo
- **Files:** `public/teacher.html`, `public/landing.html`, `public/index.html`, all six pages (favicon).
- **Do:** the logo is the blue rounded square with the white pen stroke and yellow dot that is already in `public/index.html` (the `<div class="brand">` SVG). Replace the circle logo in `teacher.html` with it. Add the logo and the words "Draw It Out" (display font, 700) to the top of `landing.html`. Add it as the favicon on every page with a `data:image/svg+xml` `<link rel="icon">` (an `.svg` file would not be served).
- **Done when:** `grep -c 'rx="9" fill="#1e3a8a"' public/teacher.html public/landing.html public/index.html` shows at least 1 for each; the circle logo is gone.

#### V04 — One icon set
- **Files:** new `public/icons.js`, new `public/ui.css`, every page and script that prints an icon.
- **Do:**
  1. `icons.js`: a map of icon name → SVG path, plus `icon(name)` (returns the SVG string) and a function that fills every `<svg data-i="name">` on the page. Copy the two `ICON` maps from the mock-ups as the starting set; draw any missing icon in the same style (24×24 box, 2 px stroke, round caps and joins, no fill, `currentColor`).
  2. `ui.css`: the `.i` rule from the mock-ups. Load it on every page after `tokens.css`.
  3. Replace every emoji or text symbol that is used **as an icon** with an SVG icon. Known places: tools drawer and Quick bar in `index.html` (✏️ ✋ ⬚ T ◇ ⌫ 📌 🚪 🔍 ↶ ↷ ▲); top bar, menus, cards and scores in `class.html` (❄ ▾ ⋯ ✕ ✓ ↑ ↓ − + 📋 ◀ ▶); `teacher.html` (📁 ⋯ + ⧉); `sets.html` (▾); `sortres.js`; `tcommon.js`.
  4. **Keep emoji where they are content:** team icons, the three pulse faces (🙋 🙂 💡), emoji a teacher typed into a question, and the ✋ on the frozen card.
- **Done when:** on screenshots `14`–`19`, `30`–`35`, `40`–`45` there is no emoji other than team icons, pulse faces and ✋; every icon-only button has `aria-label` and `title`.

#### V05 — Three button levels
- **Files:** `public/tstyle.css`, `public/style.css`, `public/class.css`, page `<style>` blocks.
- **Do:** implement the three levels exactly as in the mock-up CSS (`.b`, `.b.pri` / `.b.good`, `.b.ter`, plus `.b.sq` and `.b.sm`), and the same three for the student `.btn`. Then apply the rule on every screen: **one filled button per area** (the next thing to press), outlined for other main actions, borderless for small repeated actions.
- **Done when:** on each teacher screenshot no card, column or bar shows two filled buttons; `npm test` passes.

#### V06 — Sentence-case labels and the type scale
- **Files:** all stylesheets and page `<style>` blocks.
- **Do:**
  1. Remove `text-transform:uppercase` and the wide `letter-spacing` from labels: `tstyle.css` `.lbl`, `class.css` `.rr.h`, `sortres.css` `.corner` and `.ln h4`, `teacher.html` `.pv-lbl`, `index.html` `#opts h4`. Labels become 14 px, weight 600–700, sentence case. Check the label text itself is written in sentence case. **Keep** `text-transform:uppercase` on `#join #code` in `index.html`: class codes are capitals.
  2. Snap every `font-size` in px to the scale in `tokens.css`: 13 and below → `--fs-xs` (13); 14 → `--fs-sm`; 15, 16 → `--fs-md`; 17, 18 → `--fs-lg`; 20, 21, 22 → `--fs-xl`; 24 → `--fs-2xl`; 26–30 → `--fs-3xl`; 34 and above → `--fs-4xl`. Leave `clamp(…)` sizes in `projector.html` and font strings used for canvas drawing.
- **Done when:** `grep -n 'text-transform:uppercase' public/*` prints only the `#join #code` line; `grep -ohE 'font-size:[0-9.]+px' public/*.css public/*.html | sort -u` prints nothing outside `projector.html`; no text or button is clipped on any screenshot.

#### V07 — One message area
- **Files:** `public/class.css`, `public/class.html`, `public/tstyle.css`, `public/tcommon.js`.
- **Do:** toasts on teacher pages appear top-centre, just under the top bar, as in the teaching-screen mock-up (`.msg`, `.toast`). The "Class is frozen" notice becomes a row at the top of the middle column (`.frost` in the mock-up), not an overlay. Nothing may cover a button.
- **Done when:** screenshots `32-class-frozen` and `33-class-more-menu`: no message overlaps a control or the demo bar.

#### V08 — Phase 1 screenshots
- Run the capture into `design-audit/v2/phase1/` and commit. Every screen should look like before with the new font, logo, icons, buttons and labels; no layout has moved yet.

---

### Phase 3 — teaching screen (`/class`)

**Specification: `mockups/teaching-screen.html`.** Match its layout, spacing, states and wording. Files for every task: `public/class.html`, `public/class.css`, and where named `public/tcommon.js`, `public/sortres.js`, `public/sortres.css`. The phone layout (under 700 px, three tabs) keeps its structure throughout; V18 restyles it.

#### V10 — Top bar grouped by job
- Order, left to right: Today (back) · class name · divider · join code · "9 joined" · space · Freeze · Projector (the one filled button) · More.
- Remove the "Scores" button; the scores panel gets its own fold control in V14.
- Freeze keeps its existing menu (now, 30 seconds, 1 minute, 2 minutes) and its pressed "Frozen" look.
- **Done when:** matches the mock-up at 1440 and 1366; at 1000 px and below the labels hide and icons stay, with `title` and `aria-label`.

#### V11 — Questions column: one button, and it folds
- Each question shows its number, its text and **Send**. The next unsent question's Send is filled; the others are outlined. The live question shows "Students are answering" instead of Send.
- Edit, Move up, Move down and Delete move into one ⋯ menu per question. Delete keeps its confirmation.
- Sending a question folds the column to a 64 px strip: an open button, "2 of 5", **Back** and **Next** (Next is filled). Opening and folding are remembered on the device.
- The set picker stays at the top; Add question and Starter sets stay at the bottom.
- **Done when:** at 1366×768 with the column folded and scores open, four medium cards fit across (today: two); all question actions still work from the menu.

#### V12 — Question card, one toolbar row, projector strip
- Question card: "Question 2 of 5", the question, one status sentence. On the right, the one action for the moment: **Give *team* a point** (filled green) when a drawing is on the projector; otherwise **Send next question** (outlined). Sort questions keep **Reveal answers to students** here.
- One toolbar row replaces three: the three pulse filters with words and counts (`Need help 1 · Almost 3 · Understand 5`), Report, then on the right the card-size control and the "Names on projector" switch. The row may wrap on narrow screens.
- "On projector 2 of 3" strip: shown only when something is up. Each entry is a small thumbnail of the drawing, the name and a remove button; Clear at the end.
- **Done when:** at 1366×768 the first row of drawings starts no lower than 290 px from the top of the window (today about 345 px); pulse filtering, Report and the names switch work as before.

#### V13 — Student card
- Top: name, then the pulse chip (face and words). The pulse colour is a 4 px top edge on the card, not an outline around it.
- Middle: the drawing; clicking it puts it on or takes it off the projector. A card that is on the projector gets a blue ring and an "On projector" badge on the drawing.
- Bottom: the team as a small chip (colour dot, icon, name) that opens a menu to change team — this replaces the full-width dropdown — and **+1**.
- Card size S / M / L (170 / 230 / 320 px minimum width), remembered on the device. At S the chip words hide and the faces stay.
- **Done when:** 30 students fit without scrolling at 1440×900 on size S; changing a team from the chip updates the student, the scores and the projector as the dropdown did.

#### V14 — Team scores panel
- One row per team: rank, icon, name, score, **+**, and ⋯. Under the row a thin bar in the team colour, length in proportion to the top score.
- ⋯ menu: Take a point away · Rename, icon and color · Reset this team to 0 (red, with the existing confirmation).
- The panel folds to a 64 px strip showing each team's icon and score. Remembered on the device. Below 1000 px wide the open panel slides over the drawings.
- Bottom: "Leaderboard on projector" switch and one link, **Set up teams**, which replaces both "Rename teams & icons" and "Class list & teams" and opens what "Class list & teams" opens today.
- **Done when:** every team action that existed is still reachable; rows re-order when the ranking changes.

#### V15 — More menu in three groups
- **This lesson:** Quick mode (keeps its switch) · How the class felt · Save all drawings as a picture.
- **Joining:** Show QR code · Copy student link · Use my phone as a remote.
- **Class:** Set up teams · Rename this class — then, after a divider, Clear class and Remove this class in red.
- Remove "Back up everything" and "Restore a backup" from this menu. They already exist on Today (`#bkup`, `#rst` in `teacher.html`); confirm that before deleting.
- **Done when:** the menu has 10 items in 3 labelled groups and fits at 1366×768 without scrolling.

#### V16 — Sort results header
- **Files:** `public/sortres.js`, `public/sortres.css`.
- The controls above the numbers (names switch, the two sort dropdowns, Save results (CSV), Results on projector) join the single toolbar row from V12. The five stat tiles become one row of four at 1366 wide (fold "Got every card" into the "Finished" tile as its second line). The heat map must be visible without scrolling at 1366×768.
- **Done when:** screenshot `34-class-sort-results--1366x768` shows the top of the heat map.

#### V17 — Demo bar and first-run steps
- The demo bar is one thin line: "Demo mode. Practice students, nothing saved.", three step chips (*Send the next question → Click a drawing → Give a point*) that tick themselves when done, and **Start my real class**. The long paragraph goes.
- **Done when:** the demo bar is at most 56 px tall at 1366 wide.

#### V18 — Phone layout
- Keep the three tabs and their behaviour. Apply the new buttons, icons, cards and menus. Check every tab at 390×844.

#### V19 — Phase 3 screenshots
- Capture into `design-audit/v2/phase3/` and commit. Compare each of `30`–`35` with the mock-up.

---

### Phase 2 — student screens (`/`)

**Specification for V21–V24: `mockups/student-draw.html`.** Files: `public/index.html`, `public/style.css`, `public/sortkit.css`, `public/sortstu.js`. Do not change the drawing engine in `public/common.js` or how strokes are sent.

#### V20 — Join
- Class code as four separate letter boxes that behave as one field: typing moves forward, Backspace moves back, pasting a whole code fills all four, capitals are automatic. Keep one real `<input id="code">` for the value so the rest of the page (and `capture.cjs`) still works, or update both.
- On the team step, show the code as one small line ("Class H9FM · Change") instead of the large grey box.
- Team tiles: 2 across on phones, 4 across from 700 px. The chosen tile is tinted with its team colour and keeps the tick and `aria-pressed`.
- **Join** stays visible at the bottom of the card however many teams there are.
- **Done when:** with eight teams at 1366×768 the Join button is visible without scrolling; a wrong code shows the existing message next to the boxes.

#### V21 — One fixed frame
- Page layout, top to bottom: question bar (docked, full width) · tool rail and paper · bottom bar. Nothing floats over the paper except an open options panel.
- Question bar: team chip on the left, the question, **Hide / Show** on the right. Hidden means one line with "…", and the paper grows.
- Bottom bar: Undo and Redo on the left; "How is your work?" with its three buttons in the middle; move-the-page, −, the zoom percent (press to fit) and + on the right, then the connection dot. The zoom slider and magnifier go.
- The pulse panel no longer folds, so remove its remembered folded state.
- **Done when:** matches the mock-up at 1366×768; the question never covers the paper; zooming, panning with two fingers and the space bar still work.

#### V22 — Tool rail and options panels
- Rail (80 px): Draw, Eraser, Text, Shapes, Select, a divider, Color (shows the current colour). Each has an icon and a 13 px label; the chosen tool is dark.
- Pressing Draw, Shapes or Color opens a panel beside the rail: Draw → pen type, thickness, colours; Shapes → the shapes and colours; Color → the 12 colours in a 6×2 grid plus the existing "any colour" picker with a label. The panel closes when the student touches the paper, presses Escape, or presses the same tool again.
- Each colour button is named for a screen reader ("Red", not a hex code).
- Under 700 px the rail becomes a row between the paper and the bottom bar, the labels hide, the panel opens above it, and the pulse buttons show faces only. **This replaces the drawer on phones too** (the plan text above says "drawer only on phones"; the approved mock-up supersedes that).
- Remove the Tools button and the drawer (`#toolsbtn`, `#dclose`, "Keep open"). Update `capture.cjs`.
- **Done when:** every tool and option that was in the drawer is reachable from the rail; a tool change takes one press.

#### V23 — Quick mode in the same frame
- Quick mode keeps the frame and shows a shorter rail: Draw, Eraser, Text and four colour dots (the existing `data-qc` colours). No panels.
- **Done when:** switching Quick mode on and off from the teacher's More menu changes only the rail.

#### V24 — States: on projector, frozen, leaving
- On projector: the question bar turns green and shows "Your work is on the projector. You cannot draw now." above the question. Remove the separate banner.
- Frozen: keep the existing frosted card and wording, drawn over the paper area.
- "Leave this class" moves into a small menu on the team chip, with the existing question ("Leave this class? You can join again with your class code.") and **Stay** / **Leave** buttons.
- **Done when:** screenshots `18` and `19` match the mock-up states.

#### V25 — Sort question polish
- Same docked question bar. Each lane title shows a count ("Igneous · 4").
- When every card is placed, the card tray shrinks and **I'm done** is the one large button.
- After the teacher reveals answers: the score sits in the question bar ("You got 3 of 10"); a wrong card keeps its ✕ and "Goes in …" line but has a red left edge instead of a red outline; a right card keeps its ✓.
- **Done when:** screenshot `25-student-sort-revealed`: right and wrong are still told apart without colour.

#### V26 — Phase 2 screenshots
- Capture into `design-audit/v2/phase2/` and commit.

---

### Phases 4 and 5 — mock-up first

There is no mock-up yet for the projector, Today, Teams, the editor or the landing page. For each phase: **first** build a clickable mock-up in `mockups/` from the written proposal above (same approach as the two existing ones), show it to the owner, and only change `public/` once they agree.

#### Phase 4 — projector (`public/projector.html`)
| Task | What | Done when |
|---|---|---|
| V30 | Mock-up `mockups/projector.html` showing all views; owner approves. | Approval. |
| V31 | Thin footer on every view: logo left, "Join at *site* · code **YC4M**" right. Remove the corner "Join:" label. | Footer present on `50`–`55`; nothing overlaps the question. |
| V32 | One drawing and compare: tiles fill the height left under the question; each name is a label attached to its tile. | With three up at 1440×900, each tile is at least 40% larger in area than in `design-audit/after/52-…`. |
| V33 | Leaderboard: one full-width bar per team in its colour, length = points, with rank, icon, name and score inside the row. All zero → even rows and "First point wins the lead". Text on a team colour must reach 4.5:1 (put the text on a dark or white plate if the colour fails; three team colours do). | Readable from the back: name and score at least 5% of screen height. |
| V34 | Sort results: one neutral bar colour with the percentage; a ✓ on the best idea; "Hardest cards" becomes "Let's look at these again". No red. | No red or green bars on `55`. |
| V35 | Waiting view between questions, **only if** the projector already knows a question was cleared without a server change. If it needs one, skip this and report. Then capture into `design-audit/v2/phase4/`. | — |

#### Phase 5 — Today, teams, editor, landing
| Task | File | What |
|---|---|---|
| V40 | `mockups/` | Mock-ups of Today (three tabs), the Teams empty state, and the landing page; owner approves. |
| V41 | `teacher.html` | Top-bar tabs: **Classes · Question sets · Teams**; Demo and Help on the right. Keep the `?tab=teams&class=CODE` link working. |
| V42 | `teacher.html` | Class card: name, join code chip, team icons, last-used day, **Start class** as the one filled button, ⋯ for the rest. First visit: one welcome card (name your class → Start). |
| V43 | `teacher.html` | Question sets tab: tiles with colour, count, Draw/Sort split; starter sets as a second section with a subject filter; one **New set** button plus a **New** menu (folder, import). Backup and restore as a footer row on every tab with the date of the last backup. |
| V44 | `teacher.html` | Teams tab: empty state "How many teams?" with 2–8 and **Create teams**; team rows with a drag handle; Copy to another class and Reset all scores in a ⋯ menu; a live miniature of the join tiles and leaderboard on the right. |
| V45 | `sets.html`, `sortedit.js` | Editor: question list with type icons; **Save question** in a bar fixed to the bottom of the form with "Saved" feedback; B / I / U joined to the text box; the preview uses the real student frame from phase 2 with a phone / Chromebook switch. |
| V46 | `landing.html` | Landing: top bar with logo, **Join a class** and **Start a class**; headline beside a real screenshot of the teaching screen; a three-step strip; three benefit cards including Sort questions; privacy block; footer. Then capture into `design-audit/v2/phase5/`. |

---

### When everything is done

- `npm test` → `44 passed`.
- `grep -rn 'googleapis\|gstatic' public/` prints nothing.
- `grep -hoiE '#[0-9a-f]{6}\b' $(ls public/*.css | grep -v tokens.css)` prints nothing.
- The capture script prints no `FAIL`, `STEPFAIL` or `PAGEERR` line except `STEPFAIL more 390x844`.
- Update `README.md` where it describes a screen that moved (the Scores button, the More menu, the tools drawer), and set the status line at the top of this file to "built".
