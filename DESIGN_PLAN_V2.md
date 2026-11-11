# Draw It Out — Design Plan 2: a professional, intuitive app

**Status: proposal. Nothing in the app has been changed.** This plan needs your answers to the four questions in [Decisions for you](#decisions-for-you) before any work starts.

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

**Before phases 2 and 3 are built**, I would make clickable mock-ups of the two big layouts (student draw frame; teaching screen) in `mockups/`, as was done for the sort editor, so you can try them on a Chromebook before any app code changes.

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
