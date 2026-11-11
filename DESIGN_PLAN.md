# Draw It Out — Design Plan

## Summary

1. The app has two unrelated style systems: `style.css` (student, projector, landing, classic: blue `#2563eb`, Tailwind grays) and `tstyle.css` (teacher pages: blue `#0B6BCB`, blue-grays). 140 distinct colours, 25 font sizes and 15 radii are in use, mostly in per-page `<style>` blocks.
2. This plan adds one file, `public/tokens.css`, points both systems at it, then moves each screen onto the tokens with find/replace tables whose counts were checked against the files by script.
3. The audit (113 screenshots in `design-audit/`: 38 screens × 3 sizes) found **2 issues that block use**, **22 that hurt use** and **10 polish** items (every one is fixed by a task). The worst: the projector's join code prints on top of the question; right answers on a sort are marked by colour alone; keyboard focus is invisible on teacher pages (2.09:1).
4. 24 tasks, each one commit: retire `/classic` (T00), tokens (T01–T04), student (T05–T09), projector (T10–T11), class screen (T12–T14), Today / editor / landing (T15–T17), cross-cutting (T18–T20), then the three changes you approved — new pulse words (T21), bigger projector text (T22) — and a final check (T23). The only server change is deleting the `/classic` route. No new dependency, no build step.
5. Approved and now in the task list: plain pulse words (**How is your work? — I need help / Almost / I understand**), bigger question text on the projector, and retiring `/classic`. Five ideas stay under **Deferred** (splitting `class.html`, full type scale, fonts and logo, sort-results header, team palette).

---

## Rules for the implementer (read before every task)

- Do the tasks **in order**. One task = one commit, message `T07: <title>`. Do not start a task until its **Depends on** tasks are committed.
- **Never touch:** `server.js` (except the one deletion in T00), `test.js`, `package.json`, `package-lock.json`, `Dockerfile`, `render.yaml`, `public/qrcode.js`, `public/starters.json`, `public/emoji.js`, `public/sortkit.js`, `public/sortedit.js`, `mockups/`.
- **Never change drawing colours.** These are ink, not UI, and are saved inside students' drawings: the `COLORS=[…]` array, the `data-qc="…"` buttons and `S.color` defaults in `index.html`; the `COL = […]` array in `class.html`; `TEAM_COLORS`, `PRE` in `tcommon.js`; every `fillStyle` / `strokeStyle` in `common.js`. All of them live **outside** `<style>` blocks, which is why every colour table below is scoped to the `<style>` block.
- **SVG attributes** (`fill="#…"`, `stroke="#…"`) stay as hex. `var()` does not work there.
- `#fff` is never replaced. White is white.
- A table row "Find → Replace" means: replace **every** occurrence **inside the stated scope**, case-insensitively, and only when the next character is not a hex digit (so `#fff` must not match inside `#fff4dc`). With GNU sed, the style-block scope is
  `sed -i -E '/<style>/,/<\/style>/ s/#1e3a8a\b/var(--c-question)/Ig' public/index.html`.
  Rows that contain spaces, commas or brackets are **literal** strings: use the editor's plain find/replace, not a regex. Do literal rows first, in table order.
- If a "Find" string is not found, or its count differs from the table, **stop and report**. Do not guess.
- Do not reformat, re-indent, reorder or "tidy" any line you were not told to change.
- After every task run `npm test` (must print `43 passed`) and the task's **Done when** commands from the repo root.
- Screenshot check: `PORT=3111 node server.js &` then `OUT=design-audit/after node design-audit/capture.cjs`. Baseline images are in `design-audit/` (`<screen>--<width>x<height>.png`). Compare the named screens by eye; only the differences listed in the task are allowed.

---

## Audit

Sizes: 1440×900 (teacher laptop / projector), 1366×768 (student Chromebook), 390×844 (phone). Ranking: **B** blocks use · **H** hurts use · **P** polish. The last column is the task that fixes it.

### Student — join (`10`–`13`)
| # | Rank | Finding | Evidence | Task |
|---|---|---|---|---|
| S1 | H | The chosen team is shown only by a pale blue fill (`#dbeafe` on white, 1.2:1). No tick, no `aria-pressed`. A student cannot tell which team is picked; a screen reader hears nothing. | `13-student-join-team-picked` | T06 |
| S2 | H | Placeholder `e.g. ABC123` renders as huge bold capitals `E.G. ABC123`. It looks like a filled-in code, is six characters when real codes are four, and "e.g." is not newcomer English. | `10-student-join-code` | T06 |
| S3 | H | Text-box borders are `#9ca3af` on white = 2.54:1 (needs 3:1). | computed | T05 |
| S4 | H | Helper text uses "optional" and bracketed asides: `Tap your team. A nickname is optional (no last names).` | `12-student-join-team` | T09 |
| S5 | P | On a 768-px-high Chromebook the Join button sits at the very bottom edge with four teams, and the "Teacher?" link is below the fold. | `13-…--1366x768` | T06 |

### Student — drawing (`14`–`19`)
| # | Rank | Finding | Evidence | Task |
|---|---|---|---|---|
| S6 | H | Tools drawer: the fifth colour column is cut off (yellow and purple are half hidden). The grid forces 5 columns but each swatch has a 36 px minimum, so they overflow the 194 px panel. | `15-student-tools-drawer--1366x768` | T07 |
| S7 | H | "Your work is on the projector" banner is fixed at `top:92px` and covers the second line of the question. | `18-student-on-projector--1366x768` | T07 |
| S8 | H | Team chip: white 15 px text on the team colour. Fails for three of the twelve team colours (`#ea580c` 3.56, `#0891b2` 3.68, `#0284c7` 4.10; needs 4.5). | computed | T07 |
| S9 | H | Phone: the Tools button overlaps the zoom bar; in Quick mode the zoom bar overlaps Undo/Redo. | `16-…--390x844`, `17-…--390x844` | T07 |
| S10 | H | Pulse label is 11 px, bold, upper-case, letter-spaced (`HOW'S IT GOING?`). Tool labels are 12 px. Small capitals are the hardest text on the page for a new reader of English. | `16-student-pulse-on--1366x768` | T07 |
| S11 | H | Idioms: "Hold on for a moment…", "Eyes up here", "carry on", "Rub out". | `18`, `19` | T09 |
| S18 | H | Pulse words are idioms: "How's it going?", "Getting there", "Got it". "Getting there" is the hardest for a newcomer. | `16-student-pulse-on` | T21 |
| S12 | P | Colour swatches announce themselves as hex codes (`aria-label="#dc2626"`). | code | T07 |
| S13 | P | No visible focus ring on the dark question bar or drawer header (browser default on navy). | code | T07 |

### Student — sort (`20`–`25`)
| # | Rank | Finding | Evidence | Task |
|---|---|---|---|---|
| S14 | **B** | After "Reveal answers", a right card differs from a wrong one only by a green vs red outline (green on the yellow note is 3.03:1). Wrong cards get a text line; right cards get nothing. A colour-blind student cannot read their result. | `25-student-sort-revealed` | T08 |
| S15 | H | `hyphens:auto` splits words on cards ("min-eral crystals"). Word fragments are hard to decode for ELLs. | `22-student-sort-midway--390x844` | T08 |
| S16 | H | "Belongs in Sedimentary" is 12 px; idea tags are 11 px at 75 % opacity. | `25-…` | T08 |
| S17 | P | "Your answer is in." is an idiom. | `24-student-sort-sent` | T09 |

### Projector (`50`–`55`)
| # | Rank | Finding | Evidence | Task |
|---|---|---|---|---|
| P1 | **B** | The corner "Join: CODE" is fixed top-right and prints on top of the question whenever the leaderboard or sort results are showing. | `53-projector-leaderboard--1440x900` | T11 |
| P2 | H | The question is 34 px on every projector view. On a 6-ft-high image that is about 1.9-inch capitals; 30 ft needs about 3 inches. | `50-projector-join` | T22 |
| P3 | H | Pulse chips beside student names are 20 px at 1440 wide; "showing 1 of 3" line is 24 px. | `52-projector-compare3` | T11 |
| P4 | P | "Eyes on your teacher." → plain wording to match the student screen. | `54-projector-frozen` | T11 |

### Class screen (`30`–`35`)
| # | Rank | Finding | Evidence | Task |
|---|---|---|---|---|
| C1 | H | Keyboard focus ring is `#7DB8F5` on white = 2.09:1 on every teacher page (needs 3:1). It only works on the dark top bar. | computed | T13 |
| C2 | H | Text-box and dropdown borders `#CBD3DA` on white = 1.51:1; the "off" toggle track `#C5CED7` = 1.59:1. | computed | T13 |
| C3 | H | At 1366×768 the question card, status line, pulse row and projector strip take 330 px before the first drawing; barely one row of student work shows. | `31-class-projecting--1366x768` | T14 |
| C4 | H | The ✕ on each "On projector" chip is 60 % opacity = 2.75:1. | `31-…` | T14 |
| C5 | H | Touch targets under 44 px on a touch laptop: team +/− (36), heat-map rows (40), "who missed it" pills (26). Rules use `(pointer:coarse)`, which a touch-screen laptop with a trackpad does **not** match. | code | T14, T20 |
| C6 | P | Toast is dark on the dark demo bar: its edges disappear. | `33-class-more-menu--1440x900` | T13 |
| C7 | P | The demo bar is 120 px tall at 1366 wide, so the demo looks more cramped than a real class. | `30-class-draw--1366x768` | T14 |
| C8 | P | Phone ❄ button has a `title` but no `aria-label`. | code | T14 |
| C9 | P | "–" for "no answer" in the heat map is `#8793A0` on `#EEF1F4` = 2.76:1. | computed | T04 |

### Today, set editor, landing (`40`–`45`, `01`)
| # | Rank | Finding | Evidence | Task |
|---|---|---|---|---|
| T1 | H | Teams tab: the two right-hand cards have no padding; text touches the border. The padding rule targets `.ta-cols>.card` but these cards are one level deeper. | `41-today-teams--1366x768` | T15 |
| T2 | H | Team colour swatches are 36 px on touch (28 px with a mouse). | code | T15 |
| T3 | P | Landing link colour `#1d4ed8` is a third blue. | `01-landing` | T17 |

No blocking issues were found on Today, the set editor, or the landing page.

---

## Tokens

### `public/tokens.css` (new file, complete contents — T01 creates it exactly as written)

```css
/* Design tokens for every page. Load this BEFORE style.css or tstyle.css. No rules here, only variables. */
:root{
/* text */
--c-ink:#17212B;--c-ink-2:#394551;--c-muted:#5B6772;
/* surfaces */
--c-bg:#F3F5F7;--c-surface:#FFFFFF;--c-surface-2:#F8FAFB;--c-fill:#E8EDF2;--c-canvas-gap:#E5E7EB;--c-desk:#D1D5DB;--c-grid:#E4EEF7;--c-scrim:rgba(23,33,43,.6);
/* lines: --c-line and --c-line-2 are decoration; --c-control is for text boxes, toggles and drop zones (3:1 on white) */
--c-line:#E1E6EB;--c-line-2:#CBD3DA;--c-control:#76838F;
/* primary */
--c-primary:#0B6BCB;--c-primary-strong:#0B5CAD;--c-primary-soft:#F1F7FE;--c-primary-line:#BBD8F5;--c-primary-tint:#DCEBFB;--c-primary-glow:rgba(11,107,203,.2);
--c-focus:#0B6BCB;--c-focus-on-dark:#7DB8F5;
/* dark chrome (teacher top bar, student drawer) and the student question bar */
--c-dark:#17212B;--c-dark-2:#2A3846;--c-dark-line:#3A4856;--c-sky:#2F8BEA;--c-on-sky:#0B1320;--c-question:#1E3A8A;
/* status: every use must also carry a word or an icon */
--c-good:#0E7C4A;--c-good-strong:#0A5A36;--c-good-soft:#E6F4EC;--c-good-on-dark:#3DD68C;
--c-bad:#B3261E;--c-bad-strong:#8C1D18;--c-bad-soft:#FBE4E1;--c-bad-line:#E3B1AD;--c-bad-on-dark:#F87171;
--c-warn:#8F5500;--c-warn-strong:#5E4300;--c-warn-soft:#FFF4DC;--c-warn-line:#F0D79A;--c-warn-fill:#D99A12;--c-warn-on-dark:#FBBF24;
/* sticky notes (sort cards) */
--c-note:#FDE68A;--c-note-ink:#422006;
/* freeze */
--c-frost:#0C4A6E;--c-frost-2:#0E5B85;--c-frost-soft:#E0F2FE;
/* projector */
--c-stage:#0B1220;--c-stage-accent:#93C5FD;--c-stage-ink:#E2E8F0;
/* type */
--font-system:system-ui,-apple-system,'Segoe UI',sans-serif;
--font-body:'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif;
--font-display:'Bricolage Grotesque','Figtree',system-ui,sans-serif;
--fs-xs:13px;--fs-sm:14px;--fs-md:16px;--fs-lg:18px;--fs-xl:21px;--fs-2xl:24px;--fs-3xl:30px;--fs-4xl:38px;
/* spacing */
--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;
/* radius */
--r-xs:4px;--r-sm:8px;--r-md:10px;--r-lg:12px;--r-xl:16px;--r-2xl:22px;--r-pill:99px;
/* shadow */
--sh-1:0 1px 3px rgba(23,33,43,.2);--sh-2:0 4px 14px rgba(23,33,43,.25);--sh-3:0 18px 40px rgba(23,33,43,.28);
/* smallest touch target */
--touch:44px;
}
```

### Old value → new token

Contrast figures are WCAG ratios computed for the new value.

| Token | New value | Old values it replaces | Files affected | Contrast |
|---|---|---|---|---|
| `--c-ink` | `#17212B` | `#1f2937`, `#111827` (text), `#17212B` | style.css, tstyle.css, projector.html | 16.3 on white |
| `--c-ink-2` | `#394551` | `#394551`, `#374151` | index.html, class.html, teacher.html, sets.html, tstyle.css, sortres.css | 8.3 on `--c-fill` |
| `--c-muted` | `#5B6772` | `#5b6470`, `#5B6772`, `#4b5563`, `#8793A0` | style.css, tstyle.css, index.html, sortres.css | 5.8 on white, 5.3 on `--c-bg`, 4.9 on `--c-fill` |
| `--c-bg` | `#F3F5F7` | `#f3f4f6`, `#F3F5F7` | style.css, tstyle.css, index.html, class.html, teacher.html | — |
| `--c-surface-2` | `#F8FAFB` | `#F8FAFB`, `#FAFBFC` | sortres.css, teacher.html | — |
| `--c-fill` | `#E8EDF2` | `#E8EDF2`, `#E4EBF2`, `#EDF1F5`, `#EEF1F4` (sortres) | index.html, class.html, teacher.html, sets.html, tstyle.css, sortres.css | — |
| `--c-canvas-gap` | `#E5E7EB` | `#e5e7eb` (behind drawings) | class.html, sets.html, projector.html | — |
| `--c-desk` | `#D1D5DB` | `#d1d5db` | index.html | — |
| `--c-grid` | `#E4EEF7` | `#E4EEF7` | tstyle.css | — |
| `--c-scrim` | `rgba(23,33,43,.6)` | `rgba(23,33,43,.6)`, `rgba(23,33,43,.35)` | tstyle.css, class.html | — |
| `--c-line` | `#E1E6EB` | `#e5e7eb` (borders), `#E1E6EB`, `#EEF1F4` (class) | style.css, tstyle.css, class.html | decoration only |
| `--c-line-2` | `#CBD3DA` | `#CBD3DA`, `#D5DEE6`, `#C5CED7` (JS dots) | tstyle.css, class.html, sets.html | decoration only |
| `--c-control` | `#76838F` | `#9ca3af`, `#AEB9C4`, `#B8C4CF`, `#C5CED7` (toggle), `--line2` on `.inp` | index.html, teacher.html, sets.html, tstyle.css | 3.88 on white, 3.55 on `--c-bg` |
| `--c-primary` | `#0B6BCB` | `#2563eb` (UI only), `#0B6BCB` | style.css, tstyle.css | white on it 5.28 |
| `--c-primary-strong` | `#0B5CAD` | `#1d4ed8`, `#0B5CAD` | index.html, landing.html, tstyle.css | 6.7 on white, 6.1 on `--c-bg` |
| `--c-primary-soft` | `#F1F7FE` | `#eff6ff`, `#F1F7FE` | index.html, tstyle.css | — |
| `--c-primary-line` | `#BBD8F5` | `#bfdbfe`, `#c7d2fe`, `#BBD8F5`, `#BBD7F5`, `#CFE3F8` | index.html, class.html, sets.html | decoration only |
| `--c-primary-tint` | `#DCEBFB` | `#e0e7ff`, `#DCEBFB`, `#D6E7FA` | index.html, class.html, tstyle.css | `--c-primary-strong` on it 5.5 |
| `--c-primary-glow` | `rgba(11,107,203,.2)` | `#2563eb33` | index.html | — |
| `--c-focus` / `--c-focus-on-dark` | `#0B6BCB` / `#7DB8F5` | `#7DB8F5` everywhere | style.css, tstyle.css, index.html | 5.28 on white / 7.8 on `--c-dark`, 5.0 on `--c-question` |
| `--c-dark` | `#17212B` | `#111827` (surfaces), `#17212B` | index.html, tstyle.css | white on it 16.3 |
| `--c-dark-2` | `#2A3846` | `#1F2937` (hover), `#2A3846` | index.html, tstyle.css | — |
| `--c-dark-line` | `#3A4856` | `#3A4856` | class.html, tstyle.css | decoration only |
| `--c-question` | `#1E3A8A` | `#1e3a8a` | style.css, index.html, sets.html | white on it 10.4 |
| `--c-good` | `#0E7C4A` | `#059669`, `#0E7C4A` | style.css, sortkit.css, index.html, class.html, tstyle.css | 5.25 on white, 4.2 on `--c-note` (outline) |
| `--c-good-strong` | `#0A5A36` | `#065f46`, `#0A5A36`, `#0A6A3E` | style.css, index.html, sets.html, tstyle.css, sortres.css | 7.3 on `--c-good-soft` |
| `--c-good-soft` | `#E6F4EC` | `#d1fae5`, `#E6F4EC` | style.css, index.html, class.html, sets.html, tstyle.css, sortres.css | — |
| `--c-bad` | `#B3261E` | `#dc2626` (UI), `#b91c1c`, `#C62828`, `#B3261E` | style.css, sortkit.css, index.html, class.html, teacher.html, tstyle.css, common.js | 6.5 on white, 5.4 on `--c-bad-soft`, 5.25 on `--c-note` |
| `--c-bad-strong` | `#8C1D18` | `#7f1d1d`, `#8C1D18` | sortkit.css, sortres.css | 7.3 on `--c-note` |
| `--c-bad-soft` | `#FBE4E1` | `#fee2e2`, `#FDECEC`, `#FBE4E1` | index.html, class.html, sortres.css, common.js | — |
| `--c-bad-line` | `#E3B1AD` | `#fca5a5`, `#E3B1AD` | index.html, class.html | decoration only |
| `--c-bad-on-dark` / `--c-good-on-dark` / `--c-warn-on-dark` | `#F87171` / `#3DD68C` / `#FBBF24` | `#dc2626` (dot on dark bar, 3.4 → 6.0), `#3DD68C`, `#34d399`, `#f87171`, `#fbbf24` | tstyle.css, projector.html | ≥ 6 on `--c-dark` |
| `--c-warn` | `#8F5500` | `#92400e`, `#8F5500` | index.html, class.html | 6.1 on white; white on it 6.1 |
| `--c-warn-strong` | `#5E4300` | `#92400e` (chip text), `#7A5200`, `#5E4300` | style.css, class.html, teacher.html, tstyle.css | 8.4 on `--c-warn-soft` |
| `--c-warn-soft` | `#FFF4DC` | `#fef3c7`, `#FDF0CE`, `#FFE9B8`, `#FFF4DC` | style.css, index.html, class.html, teacher.html, tstyle.css | — |
| `--c-warn-line`, `--c-warn-fill` | `#F0D79A`, `#D99A12` | same | tstyle.css, class.html, sortres.css | bar fill; always shown with a % |
| `--c-note`, `--c-note-ink` | `#FDE68A`, `#422006` | same, `#fde047` | sortkit.css, projector.html | 11.7 |
| `--c-frost`, `--c-frost-2`, `--c-frost-soft` | `#0C4A6E`, `#0E5B85`, `#E0F2FE` | same, `#0A3B57`, `#082f49`, `#0b3f5e`, `#bae6fd`, `#dceeff`, `#e8f3ff`, `#f4faff` | index.html, class.html, projector.html | soft on frost 8.2 |
| `--c-stage`, `--c-stage-accent`, `--c-stage-ink` | `#0B1220`, `#93C5FD`, `#E2E8F0` | same, `#9ec8ee` | projector.html, index.html | accent on stage 10.4 |
| `--r-xs` … `--r-pill` | 4, 8, 10, 12, 16, 22, 99 px | 3/4 → 4 · 6/7/8/9 → 8 · 10 → 10 · 12/14 → 12 · 16/18 → 16 · 20/22/26 → 22 · 99 → 99 | all (T18) | — |
| `--sh-1`, `--sh-2`, `--sh-3` | see file | 14 different shadows (`#0002`–`#0005`, six `rgba(23,33,43,…)`, two navy, one black) | index.html, class.html, sets.html, tstyle.css, sortkit.css | — |
| `--fs-*`, `--sp-*` | see file | **Not mass-replaced.** Used for every rule this plan adds. Existing sizes below 13 px are raised (T07, T08, T14). See Deferred D2. | — | — |

---

## Tasks

### T00 — Retire `/classic`
- **Depends on:** nothing. Do this first, so no later task has to style a page that is being removed.
- **Files:** `server.js` (one deletion), delete `public/classic.html`, `README.md` (one line), `design-audit/capture.cjs` (one line).
- **Must not touch:** every other character of `server.js`.
- **Changes:**
  1. `server.js`, in the `const ROUTES = {…}` line: delete exactly `'/classic': 'classic.html', ` (including the space after the comma). The line then reads `…'/sets': 'sets.html', '/projector': 'projector.html', '/start': 'landing.html' };`.
  2. `git rm public/classic.html`.
  3. `README.md`: delete the whole line ``  - `/classic` is the previous single-page teacher screen, kept as a fallback``.
  4. `design-audit/capture.cjs`: delete the whole line that contains `/classic?demo=1`.
- **Done when:**
  - `grep -rn "classic" server.js public README.md design-audit/capture.cjs` prints nothing.
  - With the server running: `curl -s -o /dev/null -w '%{http_code}' localhost:3111/classic` prints `404`, and the same command for `/class?demo=1`, `/teacher`, `/sets`, `/projector`, `/start` and `/` prints `200`.
  - `git diff --stat HEAD~1 -- server.js` shows `1 file changed, 1 insertion(+), 1 deletion(-)`.
  - `npm test` → `43 passed`.
- **Risk:** low. Nothing in `public/` links to `/classic` and no test uses it. A teacher with an old bookmark gets "Not found"; the README no longer advertises the page.

### T01 — Add `tokens.css` and load it on every page
- **Depends on:** T00.
- **Files:** create `public/tokens.css`; edit `public/index.html`, `class.html`, `teacher.html`, `sets.html`, `projector.html`, `landing.html` (one line each).
- **Must not touch:** anything else.
- **Changes:**
  1. Create `public/tokens.css` with exactly the contents of the code block in the **Tokens** section above.
  2. In `index.html`, `projector.html`, `landing.html`: on the line directly **above** `<link rel="stylesheet" href="/style.css">` add `<link rel="stylesheet" href="/tokens.css">`.
  3. In `class.html`, `teacher.html`, `sets.html`: on the line directly **above** `<link rel="stylesheet" href="/tstyle.css">` add `<link rel="stylesheet" href="/tokens.css">`.
- **Done when:**
  - `grep -L 'href="/tokens.css"' public/*.html` prints nothing.
  - `grep -c 'href="/tokens.css"' public/*.html` prints `1` for all six files.
  - With the server running, `curl -sI localhost:3111/tokens.css | grep -i content-type` prints `text/css`.
  - `npm test` → `43 passed`. No screenshot changes.
- **Risk:** low. The file only defines variables nothing uses yet.

### T02 — Point `style.css` at the tokens
- **Depends on:** T01.
- **Files:** `public/style.css`.
- **Must not touch:** all HTML files.
- **Changes:** replace the whole file with exactly:

```css
/* Student, projector and landing pages. Colours and sizes come from tokens.css, which must load first. */
:root{--ink:var(--c-ink);--mut:var(--c-muted);--line:var(--c-line);--pri:var(--c-primary);--bg:var(--c-bg)}
*{box-sizing:border-box}
body{margin:0;font:16px/1.4 var(--font-system);color:var(--ink);background:var(--bg)}
button,select,input,textarea{font:inherit}
:focus-visible{outline:3px solid var(--c-focus);outline-offset:2px}
main{padding:16px;max-width:1200px;margin:auto}
.btn{background:var(--pri);color:#fff;border:0;border-radius:10px;padding:12px 18px;cursor:pointer;min-height:44px}
.btn.alt{background:#fff;color:var(--ink);border:1px solid var(--line)}
.btn.on{background:var(--ink);color:#fff}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
canvas{width:100%;height:auto;display:block;border-radius:8px;border:1px solid var(--line);background:#fff}
.qbar{background:var(--c-question);color:#fff;border-radius:14px;padding:14px 18px;font-size:22px;margin-bottom:12px;overflow-wrap:anywhere}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--c-bad);margin-right:6px}
.dot.ok{background:var(--c-good)}
.chip{font-size:13px;padding:2px 8px;border-radius:99px;background:var(--c-warn-soft);color:var(--c-warn-strong)}
.chip.done{background:var(--c-good-soft);color:var(--c-good-strong)}
[hidden]{display:none!important}
```

  (Differences from today: the `:root` line, the body font variable, one new `:focus-visible` line, six colours, `.chip` 12 px → 13 px. Radii are handled in T18.)
- **Done when:**
  - `grep -oiE '#[0-9a-f]{3,8}\b' public/style.css | grep -vi '^#fff$'` prints nothing.
  - Screenshots `10-student-join-code`, `01-landing`: the blue button is slightly deeper (`#0B6BCB`), layout identical.
  - `npm test` → `43 passed`.
- **Risk:** low. Student, projector and landing pages take the token blue and grays; that is intended.

### T03 — Point `tstyle.css` at the tokens
- **Depends on:** T01.
- **Files:** `public/tstyle.css`.
- **Must not touch:** all HTML files.
- **Changes:**
  1. Replace the two-line `:root{…}` rule (it starts `:root{--ink:#17212B;` and ends `sans-serif}`) with exactly:

```css
:root{--ink:var(--c-ink);--mut:var(--c-muted);--line:var(--c-line);--line2:var(--c-line-2);--bg:var(--c-bg);--panel:var(--c-surface);--pri:var(--c-primary);--pri-d:var(--c-primary-strong);--pri-l:var(--c-primary-soft);--good:var(--c-good);--good-d:var(--c-good-strong);--bad:var(--c-bad);--dark:var(--c-dark);--dark2:var(--c-dark-2);--sky:var(--c-sky);--amber:var(--c-warn-soft);--amber-b:var(--c-warn-line);--amber-d:var(--c-warn-strong);
--disp:var(--font-display);--body:var(--font-body)}
```

  2. In the rest of the file (everything after that rule):

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `box-shadow:0 18px 40px rgba(23,33,43,.28)` | `box-shadow:var(--sh-3)` | 1 |
  | `box-shadow:0 30px 80px rgba(0,0,0,.45)` | `box-shadow:var(--sh-3)` | 1 |
  | `background:rgba(23,33,43,.6)` | `background:var(--c-scrim)` | 1 |
  | `#dc2626` | `var(--c-bad-on-dark)` | 1 |
  | `#3dd68c` | `var(--c-good-on-dark)` | 1 |
  | `#3a4856` | `var(--c-dark-line)` | 1 |
  | `#0b1320` | `var(--c-on-sky)` | 1 |
  | `#e8edf2` | `var(--c-fill)` | 1 |
  | `#394551` | `var(--c-ink-2)` | 1 |
  | `#e6f4ec` | `var(--c-good-soft)` | 1 |
  | `#0a5a36` | `var(--c-good-strong)` | 1 |
  | `#dcebfb` | `var(--c-primary-tint)` | 1 |
  | `#e4eef7` | `var(--c-grid)` | 2 |
  | `#d5dee6` | `var(--c-line-2)` | 1 |
  | `#f3f5f7` | `var(--c-bg)` | 1 |

  3. Leave `#7DB8F5` (focus ring) and `#C5CED7` (toggle track) alone; T13 changes them.
- **Done when:**
  - `grep -oiE '#[0-9a-f]{3,8}\b' public/tstyle.css | grep -viE '^#(fff|7DB8F5|C5CED7)$'` prints nothing.
  - Screenshots `30-class-draw`, `40-today-classes`, `45-sets-editor`: no visible change except the red "not connected" dot is lighter.
  - `npm test` → `43 passed`.
- **Risk:** low. `--good-d` moves from `#0A6A3E` to `#0A5A36` (slightly darker green text on the "+1" button).

### T04 — Tokens in `sortkit.css` and `sortres.css`
- **Depends on:** T01.
- **Files:** `public/sortkit.css`, `public/sortres.css`.
- **Must not touch:** `sortkit.js`, `sortedit.js`, `sortres.js`, `sortstu.js`.
- **Changes:** whole-file scope.

  `sortkit.css`:

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `box-shadow:0 1px 3px #0003` | `box-shadow:var(--sh-1)` | 1 |
  | `box-shadow:0 8px 20px #0005` | `box-shadow:var(--sh-2)` | 1 |
  | `#fde68a` | `var(--c-note)` | 1 |
  | `#422006` | `var(--c-note-ink)` | 1 |
  | `#059669` | `var(--c-good)` | 1 |
  | `#dc2626` | `var(--c-bad)` | 1 |
  | `#7f1d1d` | `var(--c-bad-strong)` | 1 |

  `sortres.css`:

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `#fbe4e1` | `var(--c-bad-soft)` | 4 |
  | `#f8fafb` | `var(--c-surface-2)` | 4 |
  | `#e6f4ec` | `var(--c-good-soft)` | 4 |
  | `#8c1d18` | `var(--c-bad-strong)` | 4 |
  | `#0a5a36` | `var(--c-good-strong)` | 4 |
  | `#e8edf2` | `var(--c-fill)` | 2 |
  | `#eef1f4` | `var(--c-fill)` | 1 |
  | `#8793a0` | `var(--c-muted)` | 1 |
  | `#d99a12` | `var(--c-warn-fill)` | 1 |
  | `#394551` | `var(--c-ink-2)` | 1 |

- **Done when:**
  - `grep -oiE '#[0-9a-f]{3,8}\b' public/sortkit.css public/sortres.css | grep -vi '#fff$'` prints nothing.
  - Screenshot `34-class-sort-results`: the "–" cells are darker gray (4.9:1, was 2.76:1). `25-student-sort-revealed`: outlines slightly darker green and red. Nothing else.
  - `npm test` → `43 passed`.
- **Risk:** low.

---

### T05 — Student page: colours and shadows to tokens
- **Depends on:** T02.
- **Files:** `public/index.html`, **`<style>` block only**.
- **Must not touch:** anything after `</style>` in `index.html`.
- **Changes:**

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `radial-gradient(120% 110% at 50% -10%,#dceeff 0%,#e8f3ff 45%,#f4faff 100%)` | `linear-gradient(180deg,var(--c-frost-soft),var(--c-surface))` | 1 |
  | `box-shadow:0 1px 2px #1e3a8a14,0 12px 32px -12px #1e3a8a40` | `box-shadow:var(--sh-2)` | 1 |
  | `box-shadow:0 4px 14px #0004` | `box-shadow:var(--sh-2)` | 6 |
  | `box-shadow:0 4px 14px #0005` | `box-shadow:var(--sh-2)` | 1 |
  | `box-shadow:0 4px 14px #0003` | `box-shadow:var(--sh-2)` | 1 |
  | `box-shadow:4px 0 18px #0004` | `box-shadow:var(--sh-3)` | 1 |
  | `box-shadow:0 2px 8px #0002` | `box-shadow:var(--sh-1)` | 2 |
  | `box-shadow:0 24px 70px rgba(15,45,90,.35)` | `box-shadow:var(--sh-3)` | 1 |
  | `#2563eb33` | `var(--c-primary-glow)` | 2 |
  | `#ffffff26` | `rgba(255,255,255,.15)` | 1 |
  | `#ffffffdd` | `rgba(255,255,255,.87)` | 1 |
  | `#fff6` | `rgba(255,255,255,.4)` | 1 |
  | `#065f46` | `var(--c-good-strong)` | 1 |
  | `#0e7c4a` | `var(--c-good)` | 2 |
  | `#111827` | `var(--c-dark)` | 3 |
  | `#1d4ed8` | `var(--c-primary-strong)` | 1 |
  | `#1e3a8a` | `var(--c-question)` | 2 |
  | `#1f2937` | `var(--c-dark-2)` | 1 |
  | `#374151` | `var(--c-ink-2)` | 2 |
  | `#4b5563` | `var(--c-muted)` | 2 |
  | `#8f5500` | `var(--c-warn)` | 2 |
  | `#92400e` | `var(--c-warn)` | 2 |
  | `#9ca3af` | `var(--c-control)` | 2 |
  | `#9ec8ee` | `var(--c-stage-accent)` | 1 |
  | `#b91c1c` | `var(--c-bad)` | 2 |
  | `#bfdbfe` | `var(--c-primary-line)` | 1 |
  | `#c62828` | `var(--c-bad)` | 2 |
  | `#c7d2fe` | `var(--c-primary-line)` | 1 |
  | `#d1d5db` | `var(--c-desk)` | 1 |
  | `#e0e7ff` | `var(--c-primary-tint)` | 1 |
  | `#e6f4ec` | `var(--c-good-soft)` | 1 |
  | `#e8edf2` | `var(--c-fill)` | 1 |
  | `#eff6ff` | `var(--c-primary-soft)` | 3 |
  | `#f3f4f6` | `var(--c-bg)` | 2 |
  | `#f3f5f7` | `var(--c-bg)` | 1 |
  | `#fca5a5` | `var(--c-bad-line)` | 1 |
  | `#fdecec` | `var(--c-bad-soft)` | 1 |
  | `#fee2e2` | `var(--c-bad-soft)` | 1 |
  | `#fff4dc` | `var(--c-warn-soft)` | 1 |

- **Done when:**
  - `sed -n '/<style>/,/<\/style>/p' public/index.html | grep -oiE '#[0-9a-f]{3,8}\b' | grep -vi '^#fff$'` prints nothing.
  - `grep -c "COLORS=\['#111111','#6b7280','#dc2626'" public/index.html` prints `1` (ink colours untouched).
  - Screenshots `10`–`25`: same layout. Allowed differences: text-box and lane borders darker (3.88:1, was 2.54:1); blues and reds shift to the token values; frozen background is a simple top-to-bottom fade.
  - `npm test` → `43 passed`.
- **Risk:** low. Shadows become neutral instead of navy-tinted.

### T06 — Join screen: selected team, code box, fit on a Chromebook
- **Depends on:** T05.
- **Files:** `public/index.html`.
- **Must not touch:** the join/peek message handling (`ws.send`, `sendJoin`, `onmsg`).
- **Changes:**
  1. HTML. Find `<input id="code" maxlength="10" placeholder="e.g. ABC123" autocomplete="off"` → replace with `<input id="code" maxlength="10" autocomplete="off"` (placeholder removed; the visible label "Class code" and the line "Type your class code" stay).
  2. JS. Find exactly
     `[...box.children].forEach(x => (x.style.background = '#fff')); b.style.background = '#dbeafe';`
     → replace with
     `[...box.children].forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true');`
  3. CSS. Directly after the line that starts `#pick button:disabled{` add:

```css
#pick button.on{position:relative;background:var(--c-primary-soft);box-shadow:0 0 0 3px var(--c-ink)}
#pick button.on::after{content:'✓';position:absolute;top:2px;right:8px;font-size:var(--fs-lg);font-weight:800;color:var(--c-ink)}
```

  4. CSS. In the rule `#pick .back{…}` change `min-height:40px` → `min-height:44px`.
  5. CSS. In the rule `#join .card{…}` change `margin:clamp(16px,8vh,72px) auto` → `margin:clamp(12px,4vh,72px) auto`. In `#join .brand{…}` change `margin:0 0 18px` → `margin:0 0 10px`.
- **Done when:**
  - `grep -c "dbeafe\|e.g. ABC123" public/index.html` prints `0`.
  - Screenshot `13-student-join-team-picked` at all sizes: the picked tile has a dark ring and a ✓ in its top-right corner; at 1366×768 the whole Join button is at least 20 px above the bottom edge.
  - In the browser console on the team step, after one tap: `document.querySelectorAll('#pick [aria-pressed=true]').length` is `1`.
  - Joining still works: `capture.cjs` logs `ok 14-student-draw` for all three sizes.
  - `npm test` → `43 passed`.
- **Risk:** low. The ring (`--c-ink` on white, 16:1) replaces a colour-only cue.

### T07 — Drawing screen: clipped colours, covered question, team chip, phone overlap, small labels
- **Depends on:** T05.
- **Files:** `public/index.html`.
- **Must not touch:** drawing logic (anything using `S.`, `V.`, `objs`, `ws.send`) other than the two strings named below.
- **Changes:**
  1. CSS. `.sw{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}` → `.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,1fr));gap:8px}`.
  2. CSS. In `#lockmsg{…}` change `top:92px;left:50%;transform:translateX(-50%)` → `top:auto;bottom:140px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 24px);text-align:center`.
  3. CSS. In `#ptog .plb{…}` change `font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;` → `font-size:var(--fs-sm);font-weight:700;`.
  4. CSS. In the first `.tool{…}` rule (the one containing `min-height:64px`) change `font-size:12px` → `font-size:var(--fs-sm)`.
  5. CSS. In `#tm{…}` change `border-radius:99px;padding:2px 12px;font-size:15px;font-weight:600;margin-bottom:6px;color:#fff;border:2px solid rgba(255,255,255,.4)` → `border-radius:8px;padding:2px 12px;font-size:15px;font-weight:600;margin-bottom:6px;color:var(--c-ink);background:#fff;border:0;border-left:10px solid var(--tc,var(--c-muted))`.
  6. JS. Find `el.style.background = t ? t.color : '#6b7280';` → replace with `el.style.setProperty('--tc', t ? t.color : '#6b7280');`.
  7. CSS. Directly before the line `/* confidence pulse: red / amber / green on the right edge` add:

```css
@media(max-width:420px){#zv{display:none}}
#qbox :focus-visible,#dhead :focus-visible{outline-color:#fff}
@media(any-pointer:coarse){.sw{grid-template-columns:repeat(auto-fill,minmax(44px,1fr))}.swb{min-height:44px}}
```

  8. JS. Directly after the line starting `const COLORS=[` add the line
     `const CNAME={'#111111':'Black','#6b7280':'Gray','#dc2626':'Red','#f97316':'Orange','#facc15':'Yellow','#22c55e':'Light green','#059669':'Green','#06b6d4':'Light blue','#2563eb':'Blue','#7c3aed':'Purple','#db2777':'Pink','#92400e':'Brown'};`
     and in the line that builds the Color section change `aria-label="${c}"></button>` → `aria-label="${CNAME[c]||c}"></button>`.
  9. HTML. `aria-label="How are you going with your drawing?"` → `aria-label="How is your drawing going?"`.
- **Done when:**
  - `grep -c "repeat(5,1fr)\|top:92px\|font-size:11px\|el.style.background = t" public/index.html` prints `0`.
  - Screenshot `15-student-tools-drawer--1366x768`: every colour circle is fully inside the white panel (four per row).
  - `18-student-on-projector`: the brown banner sits near the bottom of the page, above the Undo bar, and does not touch the blue question bar or any other control (check 390×844 too).
  - `16-student-pulse-on--390x844` and `17-student-quick-mode--390x844`: no bar overlaps another; the "100%" readout is gone on the phone only.
  - `14-student-draw`: the team chip is white with dark text and a team-colour stripe on its left.
  - `npm test` → `43 passed`.
- **Risk:** medium. Item 2 moves a banner from the top to the lower part of the page; on a phone it can sit over the bottom of the drawing while the student's work is projected (their tools are locked at that moment, so nothing is blocked). Item 5/6 changes how the team colour is shown; check a team with a light colour still reads.

### T08 — Student sort: mark right and wrong with icons, stop splitting words
- **Depends on:** T04, T05.
- **Files:** `public/sortkit.css`, `public/index.html` (`<style>` only).
- **Must not touch:** `sortstu.js`, `sortkit.js`, and how `right` / `wrong` classes are decided.
- **Changes:**
  1. `sortkit.css`, in `.nc{…}`: `hyphens:auto` → `hyphens:manual`.
  2. `sortkit.css`: `.nc small{display:block;font-size:11px;opacity:.75;margin-top:2px}` → `.nc small{display:block;font-size:var(--fs-xs);opacity:.85;margin-top:2px}`.
  3. `sortkit.css`, in `.nc .where{…}`: `font-size:12px` → `font-size:var(--fs-sm)`.
  4. `sortkit.css`: add at the end of the file:

```css
/* right or wrong is never colour alone: a tick or a cross sits in the corner of the note */
.nc.right,.nc.wrong{position:relative;padding-right:36px}
.nc.right::after,.nc.wrong::after{position:absolute;top:6px;right:8px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:800;line-height:1;color:#fff}
.nc.right::after{content:'✓';background:var(--c-good)}
.nc.wrong::after{content:'✕';background:var(--c-bad)}
```

  5. `index.html`, in `.slane h3{…}`: `overflow-wrap:anywhere;hyphens:auto` → `overflow-wrap:anywhere;hyphens:manual`.
- **Done when:**
  - `grep -c "hyphens:auto" public/sortkit.css public/index.html` prints `0` for both.
  - Screenshot `25-student-sort-revealed` (all sizes): every green-outlined card has a white ✓ on a green circle; every red-outlined card has a white ✕ on a red circle. White on `#0E7C4A` = 5.25:1, on `#B3261E` = 6.54:1.
  - `22-student-sort-midway--390x844`: no card text ends a line with a hyphen.
  - `45-sets-editor` and `55-projector-sort-summary`: unchanged (they never use `.right` / `.wrong`).
  - `npm test` → `43 passed`.
- **Risk:** low. Long words now wrap whole or break without a hyphen; on a phone with three lanes a 12-letter word still fits ("Metamorphic" does today).

### T09 — Student copy in plain English
- **Depends on:** T06, T07, T08 (same files; avoids merge noise).
- **Files:** `public/index.html`, `public/sortstu.js`, `README.md`.
- **Must not touch:** any string in `server.js`; the pulse words `Stuck`, `Getting there`, `Got it`, `How's it going?` (T21 changes those everywhere at once); any logic in `sortstu.js` — change text inside quotes only.
- **Changes:** replace each old string with the new one, character for character. Curly apostrophes (’) and the ellipsis character (…) are part of the old strings.

  `index.html`:

  | # | Old | New |
  |---|---|---|
  | 1 | `Tap your team. A nickname is optional (no last names).` | `Tap your team. You can type a nickname too. Do not use your last name.` |
  | 2 | `Type a nickname (no last names)` | `Type a nickname. Do not use your last name.` |
  | 3 | `Nickname (optional)` | `Nickname (you can skip this)` |
  | 4 | `Your nickname (no last names)` (2 places: the `placeholder` attribute and the JS line) | `Your nickname` |
  | 5 | `Connecting… the class server may be waking up. This can take up to a minute. Stay on this page.` | `Connecting… Please wait. This can take one minute. Stay on this page.` |
  | 6 | `Rejoining your class…` | `Going back to your class…` |
  | 7 | `Class ended. Join again when your teacher says so.` | `This class has ended. Your teacher will tell you when to join again.` |
  | 8 | `Answer sent. Hold on for your teacher…` | `Answer sent. Wait for your teacher.` |
  | 9 | `Your work is on the projector. Hold on for a moment…` | `Your teacher is showing your work to the class. Please wait.` |
  | 10 | `Eyes up here. Your work is saved — you can carry on when your teacher says.` | `Look at your teacher. Your work is saved. You can start again soon.` |
  | 11 | `Drag to slide around the page when zoomed in. Two fingers move and pinch with any tool.` | `Drag to move the page. Use two fingers to move and zoom at any time.` |
  | 12 | `<b>◐</b>Partial</button>` | `<b>◐</b>Part</button>` |
  | 13 | `<b>▣</b>Whole object</button>` | `<b>▣</b>All</button>` |
  | 14 | `Rub out just part of a pen line, line or arrow. Shapes and text can’t be cut: switch to Whole object for those.` | `Erase one part of a line or arrow. To erase a shape or text, tap All.` |
  | 15 | `Touch anything to remove all of it: a pen line, shape, or text box.` | `Tap a line, shape or text to erase all of it.` |
  | 16 | `Tap anything to select it. Drag it to move. Drag the white circles to resize. Then change its color, shape or thickness here.` | `Tap something to choose it. Drag it to move it. Drag the white circles to change its size. You can change its color here.` |

  `sortstu.js`:

  | # | Old | New |
  |---|---|---|
  | 17 | `'Belongs in '` | `'Goes in '` |
  | 18 | `'Your answer is in.'` | `'Your answer was sent.'` |
  | 19 | `'✓ Every card is placed. Check your work, then press “I’m done”.'` | `'✓ All cards are placed. Check your work. Then press “I’m done”.'` |

  `README.md`: `*Frozen. Eyes up here. Your work is saved.*` → `*Frozen. Look at your teacher. Your work is saved.*`
- **Done when:**
  - `grep -c "Hold on\|Eyes up\|carry on\|Rub out\|is optional\|(optional)\|no last names\|says so" public/index.html` prints `0`.
  - `grep -c "Belongs in\|answer is in\|Every card" public/sortstu.js` prints `0`.
  - `grep -c "Stuck\|Getting there\|Got it" public/index.html` is unchanged from before the task (`git diff --stat` shows only the lines above).
  - Screenshots `12`, `18`, `19`, `24`, `25` show the new sentences with no clipped or wrapped-off text at 390 wide.
  - `npm test` → `43 passed`.
- **Risk:** low. Text only. Row 9 is longer; T07 already lets that banner wrap.

---

### T10 — Projector: colours to tokens
- **Depends on:** T02.
- **Files:** `public/projector.html`.
- **Must not touch:** message handling; canvas sizing (`fit`, `b.cv.style`).
- **Changes:**
  1. `<style>` block only:

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `radial-gradient(120% 110% at 50% -10%,#082f49 0%,#0b3f5e 45%,#0c4a6e 100%)` | `var(--c-frost)` | 1 |
  | `#0b1220` | `var(--c-stage)` | 1 |
  | `#111827` | `var(--c-ink)` | 1 |
  | `#93c5fd` | `var(--c-stage-accent)` | 6 |
  | `#bae6fd` | `var(--c-frost-soft)` | 1 |
  | `#e0f2fe` | `var(--c-frost-soft)` | 1 |
  | `#e2e8f0` | `var(--c-stage-ink)` | 1 |
  | `#e5e7eb` | `var(--c-canvas-gap)` | 1 |
  | `#fde047` | `var(--c-note)` | 1 |

  2. Script. Find `{ good: '#34d399', mid: '#fbbf24', bad: '#f87171' }` → replace with `{ good: 'var(--c-good-on-dark)', mid: 'var(--c-warn-on-dark)', bad: 'var(--c-bad-on-dark)' }`.
- **Done when:**
  - `sed -n '/<style>/,/<\/style>/p' public/projector.html | grep -oiE '#[0-9a-f]{3,8}\b' | grep -vi '^#fff$'` prints nothing.
  - Screenshots `50`–`55`: unchanged except the frozen screen background is one flat deep blue and the sort bars are the token green / amber / red.
  - `npm test` → `43 passed`.
- **Risk:** low.

### T11 — Projector: join code no longer covers the question; bigger name chips
- **Depends on:** T10.
- **Files:** `public/projector.html`.
- **Must not touch:** the script.
- **Changes:**
  1. CSS. Add directly after the line that starts `#corner b{`:

```css
/* the corner code is fixed top-right: keep the question clear of it on both sides so it stays centred */
body:has(#corner:not([hidden])) .qbar{padding-left:clamp(190px,17vw,300px);padding-right:clamp(190px,17vw,300px)}
```

  2. CSS. `.pchip{font-size:clamp(14px,1.4vw,20px);` → `.pchip{font-size:clamp(18px,1.8vw,28px);`
  3. CSS. `#who{text-align:center;font-size:24px;` → `#who{text-align:center;font-size:clamp(24px,2.4vw,36px);`
  4. HTML. `<p>Eyes on your teacher.</p>` → `<p>Look at your teacher.</p>`
- **Done when:**
  - Screenshot `53-projector-leaderboard--1440x900` and `55-projector-sort-summary--1440x900`: no question text is under or within 16 px of "Join: CODE".
  - `50-projector-join` at all sizes: identical to the baseline (the question size is not changed by this task).
  - `51-projector-one` and `52-projector-compare3`: drawings are the same size as the baseline (question size is unchanged while drawings show).
  - `npm test` → `43 passed`.
- **Risk:** low. The side padding only applies while the corner code is visible (leaderboard and sort results). A long question wraps onto one more line there.

---

### T12 — Class screen: colours and shadows to tokens
- **Depends on:** T03.
- **Files:** `public/class.html`.
- **Must not touch:** the bot code (`function bot`, `COL = [`, `c: '#dc2626'`), `sendQ`, `onmsg`.
- **Changes:**
  1. `<style>` block only:

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `linear-gradient(180deg,#0C4A6E,#0A3B57)` | `var(--c-frost)` | 1 |
  | `box-shadow:0 12px 30px rgba(12,74,110,.45)` | `box-shadow:var(--sh-3)` | 1 |
  | `box-shadow:-18px 0 40px rgba(23,33,43,.22)` | `box-shadow:var(--sh-3)` | 1 |
  | `box-shadow:0 6px 18px rgba(23,33,43,.10)` | `box-shadow:var(--sh-1)` | 1 |
  | `box-shadow:0 2px 8px rgba(23,33,43,.15)` | `box-shadow:var(--sh-1)` | 1 |
  | `background:rgba(23,33,43,.35)` | `background:var(--c-scrim)` | 1 |
  | `#0c4a6e` | `var(--c-frost)` | 2 |
  | `#0e5b85` | `var(--c-frost-2)` | 2 |
  | `#0e7c4a` | `var(--c-good)` | 1 |
  | `#394551` | `var(--c-ink-2)` | 5 |
  | `#3a4856` | `var(--c-dark-line)` | 1 |
  | `#7a5200` | `var(--c-warn-strong)` | 2 |
  | `#8f5500` | `var(--c-warn)` | 1 |
  | `#bbd8f5` | `var(--c-primary-line)` | 1 |
  | `#c62828` | `var(--c-bad)` | 1 |
  | `#cbd3da` | `var(--c-line-2)` | 1 |
  | `#cfe3f8` | `var(--c-primary-line)` | 1 |
  | `#d5dee6` | `var(--c-line-2)` | 3 |
  | `#d6e7fa` | `var(--c-primary-tint)` | 1 |
  | `#e0f2fe` | `var(--c-frost-soft)` | 4 |
  | `#e4ebf2` | `var(--c-fill)` | 1 |
  | `#e5e7eb` | `var(--c-canvas-gap)` | 2 |
  | `#e6f4ec` | `var(--c-good-soft)` | 1 |
  | `#e8edf2` | `var(--c-fill)` | 4 |
  | `#edf1f5` | `var(--c-fill)` | 2 |
  | `#eef1f4` | `var(--c-line)` | 1 |
  | `#f3f5f7` | `var(--c-bg)` | 2 |
  | `#fdecec` | `var(--c-bad-soft)` | 1 |
  | `#fdf0ce` | `var(--c-warn-soft)` | 2 |
  | `#fff4dc` | `var(--c-warn-soft)` | 1 |

  2. Outside the style block, literal replacements (each occurs once unless a count is given):

  | Find | Replace with |
  |---|---|
  | `style="background:#FFE9B8;color:#5E4300"` | `style="background:var(--c-warn-soft);color:var(--c-warn-strong)"` |
  | `border-color:#E3B1AD` | `border-color:var(--c-bad-line)` |
  | `background:#FFF4DC;border:1px solid #F0D79A;border-radius:10px;padding:10px 12px;color:#5E4300` | `background:var(--c-warn-soft);border:1px solid var(--c-warn-line);border-radius:10px;padding:10px 12px;color:var(--c-warn-strong)` |
  | `tm ? tm.color : '#e5e7eb'` | `tm ? tm.color : 'var(--c-line)'` |
  | `: '#C5CED7') })));` | `: 'var(--c-line-2)') })));` |
  | `background:#E4EBF2;overflow:hidden` (2) | `background:var(--c-fill);overflow:hidden` |
  | `border-radius:50%;background:#E8EDF2;display:flex` | `border-radius:50%;background:var(--c-fill);display:flex` |
  | `(x.leader ? '#FDF0CE' : '#E8EDF2')` | `(x.leader ? 'var(--c-warn-soft)' : 'var(--c-fill)')` |
  | `(x.leader ? '#7A5200' : '#394551')` | `(x.leader ? 'var(--c-warn-strong)' : 'var(--c-ink-2)')` |

  3. Leave `stroke="#0E7C4A"` (SVG attribute) and the bot colours as they are.
- **Done when:**
  - `sed -n '/<style>/,/<\/style>/p' public/class.html | grep -oiE '#[0-9a-f]{3,8}\b' | grep -vi '^#fff$'` prints nothing.
  - `sed '/<style>/,/<\/style>/d' public/class.html | grep -oiE '#[0-9a-f]{6}\b' | sort -u | tr '\n' ' '` prints exactly `#059669 #0E7C4A #111111 #2563eb #7c3aed #dc2626 #f97316` (bot ink colours and one SVG stroke).
  - Screenshots `30`–`35` at all sizes: no layout change. The demo's practice drawings still appear (bots untouched).
  - `npm test` → `43 passed`.
- **Risk:** low. Tracks behind progress bars become one gray instead of three.

### T13 — Teacher pages: visible focus ring, text-box borders, toggle, toast
- **Depends on:** T03.
- **Files:** `public/tstyle.css`.
- **Must not touch:** HTML files.
- **Changes:**
  1. `:focus-visible{outline:3px solid #7DB8F5;outline-offset:2px}` → replace with these two lines:

```css
:focus-visible{outline:3px solid var(--c-focus);outline-offset:2px}
.tb :focus-visible,.ph-h :focus-visible,.stepper :focus-visible,#demobar :focus-visible,#frzbar :focus-visible{outline-color:var(--c-focus-on-dark)}
```

  2. In `.tog i{…}`: `background:#C5CED7` → `background:var(--c-control)`.
  3. In `.inp{…}`: `border:1px solid var(--line2)` → `border:1px solid var(--c-control)`.
  4. In `#toast{…}`: after `border-radius:12px;` insert `border:2px solid var(--c-surface);box-shadow:var(--sh-2);`.
- **Done when:**
  - `grep -oiE '#[0-9a-f]{3,8}\b' public/tstyle.css | grep -vi '^#fff$'` prints nothing.
  - On `/teacher`, press Tab until "Start class" has focus: the ring is solid blue `#0B6BCB` (5.28:1 on white). Press Shift+Tab back to "Try the demo" in the dark bar: the ring is light blue `#7DB8F5` (7.8:1).
  - Screenshot `45-sets-editor`: text boxes have a clearly visible gray border (3.88:1). `30-class-draw`: the off toggle track is mid-gray with a white knob (3.88:1).
  - `33-class-more-menu--1440x900`: the toast has a white outline.
  - `npm test` → `43 passed`.
- **Risk:** low. Every `.inp` on Today, class and the editor gets a darker border; that is the point.

### T14 — Class screen: more drawings on a small laptop, touch targets, small fixes
- **Depends on:** T12.
- **Files:** `public/class.html`, `public/sortres.css`.
- **Must not touch:** the script. This task is CSS and one HTML attribute.
- **Changes:**
  1. `class.html` CSS. `#pstrip .pk span:last-child{opacity:.6}` → `#pstrip .pk span:last-child{opacity:1}`.
  2. `class.html` CSS. In `.pchip{…}`: `font-size:12px` → `font-size:var(--fs-xs)`. In `.srow .rk{…}`: `font-size:12px` → `font-size:var(--fs-xs)`.
  3. `class.html` CSS. `@media(pointer:coarse){#pulsesum .pb,#pstrip .pk{min-height:44px}}` → `@media(any-pointer:coarse){#pulsesum .pb,#pstrip .pk,.srow .r2 .b{min-height:44px}}`.
  4. `class.html` CSS. Directly before the line `/* phone layout (D1 and D2) */` add:

```css
/* short screens (1366×768 laptops): give the height back to the drawings */
@media(max-height:820px) and (min-width:701px){
 main{padding:12px 16px;gap:10px}
 .qbar{padding:10px 16px}
 .qbar .q{font-size:20px}
 .grid{grid-auto-rows:minmax(220px,1fr)}
 #demobar{flex-wrap:nowrap;padding:8px 12px}
 #demobar .dlong{display:none}
 #demobar .dshort{display:inline}
}
```

  5. `class.html` HTML. `id="pfreeze" aria-pressed="false" title="Freeze the class"` → `id="pfreeze" aria-pressed="false" aria-label="Freeze the class" title="Freeze the class"`.
  6. `sortres.css`. Add at the end of the file:

```css
@media(any-pointer:coarse){.rowh,.cell{height:44px}button.pill{min-height:44px;padding:0 14px}}
```

- **Done when:**
  - `grep -c "opacity:.6\|(pointer:coarse)" public/class.html` prints `0`.
  - Screenshot `31-class-projecting--1366x768`: the top of the first row of student cards is at least 30 px higher than in the baseline, the demo bar is one line, and part of a second row of cards is visible.
  - `31-…--1440x900`: identical to the baseline apart from the ✕ on projector chips being fully dark (6.19:1).
  - `31-…--390x844`: identical to the baseline.
  - `npm test` → `43 passed`.
- **Risk:** low–medium. The media query is height-based: a teacher with a short browser window on a big monitor also gets the compact spacing. Nothing is hidden, only tightened.

---

### T15 — Today page: tokens, padded side cards, 44 px colour swatches
- **Depends on:** T03.
- **Files:** `public/teacher.html`.
- **Must not touch:** script; SVG `stroke=` / `fill=` attributes; the tile colour array.
- **Changes:**
  1. `<style>` block only:

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `#394551` | `var(--c-ink-2)` | 2 |
  | `#7a5200` | `var(--c-warn-strong)` | 1 |
  | `#aeb9c4` | `var(--c-control)` | 1 |
  | `#b3261e` | `var(--c-bad)` | 1 |
  | `#e8edf2` | `var(--c-fill)` | 1 |
  | `#f3f5f7` | `var(--c-bg)` | 1 |
  | `#fafbfc` | `var(--c-surface-2)` | 1 |
  | `#fdf0ce` | `var(--c-warn-soft)` | 1 |

  2. CSS. `.ta-cols>.card{padding:16px 18px}` → `.ta-cols>.card,.ta-side>.card{padding:16px 18px}`.
  3. CSS. In the rule starting `@media(pointer:coarse){.tcard-move .b{`: `.swbtn{width:36px;height:36px}` → `.swbtn{width:44px;height:44px}`.
- **Done when:**
  - `sed -n '/<style>/,/<\/style>/p' public/teacher.html | grep -oiE '#[0-9a-f]{3,8}\b' | grep -vi '^#fff$'` prints nothing.
  - Screenshot `41-today-teams` (all sizes): "What students and the projector see" and "Good to know" have 16 px of space between text and card edge.
  - `40-today-classes`: unchanged apart from a darker dashed border on "New class".
  - `npm test` → `43 passed`.
- **Risk:** low.

### T16 — Set editor: tokens
- **Depends on:** T03, T04.
- **Files:** `public/sets.html`, `<style>` block only.
- **Must not touch:** everything after `</style>` (the preview dock's four ink dots and the canvas preview colours are drawing colours).
- **Changes:**

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `box-shadow:0 14px 34px rgba(23,33,43,.14)` | `box-shadow:var(--sh-2)` | 1 |
  | `#0a5a36` | `var(--c-good-strong)` | 1 |
  | `#1e3a8a` | `var(--c-question)` | 1 |
  | `#394551` | `var(--c-ink-2)` | 1 |
  | `#9ca3af` | `var(--c-control)` | 1 |
  | `#b8c4cf` | `var(--c-control)` | 1 |
  | `#bbd7f5` | `var(--c-primary-line)` | 1 |
  | `#d5dee6` | `var(--c-line-2)` | 2 |
  | `#e5e7eb` | `var(--c-canvas-gap)` | 1 |
  | `#e6f4ec` | `var(--c-good-soft)` | 1 |
  | `#e8edf2` | `var(--c-fill)` | 1 |

- **Done when:**
  - `sed -n '/<style>/,/<\/style>/p' public/sets.html | grep -oiE '#[0-9a-f]{3,8}\b' | grep -vi '^#fff$'` prints nothing.
  - Screenshot `45-sets-editor`: no layout change; dashed drop-zone borders are darker.
  - `npm test` → `43 passed`.
- **Risk:** low.

### T17 — Landing page: one blue
- **Depends on:** T02.
- **Files:** `public/landing.html`.
- **Changes:**

  | Find (case-insensitive) | Replace with | Count |
  |---|---|---|
  | `#1d4ed8` | `var(--c-primary-strong)` | 1 |

  Also: `<p style="font-size:15px;margin-top:14px">` → `<p style="font-size:16px;margin-top:14px">`.
- **Done when:** `grep -ci '#1d4ed8' public/landing.html` prints `0`; screenshot `01-landing` unchanged apart from the link blue; `npm test` → `43 passed`.
- **Risk:** low.

---

### T18 — One radius scale
- **Depends on:** T05, T10, T12, T15, T16, T17 (all colour tasks done, so diffs stay readable).
- **Files:** `public/index.html`, `class.html`, `teacher.html`, `sets.html`, `projector.html`, `style.css`, `tstyle.css`, `sortkit.css`, `sortres.css`, `tcommon.js`.
- **Must not touch:** any `border-radius` whose value is `50%`, `0`, or has more than one number (for example `0 18px 18px 0`).
- **Changes:** whole-file scope in each file listed. Match the exact text including `px`, followed by a non-digit.

  | Find | Replace with | Count before (all files) |
  |---|---|---|
  | `border-radius:3px`, `border-radius:4px` | `border-radius:var(--r-xs)` | 3 |
  | `border-radius:6px`, `7px`, `8px`, `9px` | `border-radius:var(--r-sm)` | 17 |
  | `border-radius:10px` | `border-radius:var(--r-md)` | 18 |
  | `border-radius:12px`, `border-radius:14px` | `border-radius:var(--r-lg)` | 52 |
  | `border-radius:16px`, `border-radius:18px` | `border-radius:var(--r-xl)` | 7 |
  | `border-radius:20px`, `22px`, `26px` | `border-radius:var(--r-2xl)` | 3 |
  | `border-radius:99px` | `border-radius:var(--r-pill)` | 25 |

  (Counts were taken before T02–T17. T07 and T08 add a few `8px` / `50%` values; convert the `8px` one too.)
- **Done when:**
  - `grep -ohE 'border-radius:[0-9]+px' public/index.html public/class.html public/teacher.html public/sets.html public/projector.html public/landing.html public/*.css public/tcommon.js` prints nothing.
  - Screenshots, all screens: corners that were 14 px are now 12 px; nothing moves.
  - `npm test` → `43 passed`.
- **Risk:** low. Purely visual, 2 px at most.

### T19 — One red for "stuck" in the shared script
- **Depends on:** T05, T12.
- **Files:** `public/common.js` (one line), `public/sortres.js` (one string).
- **Must not touch:** every other line of `common.js` (canvas drawing colours).
- **Changes:**
  1. `common.js`: `c: '#C62828', soft: '#FDECEC', e: '🙋'` → `c: '#B3261E', soft: '#FBE4E1', e: '🙋'`.
  2. `sortres.js`: `s.team ? s.team.color : '#e5e7eb'` → `s.team ? s.team.color : 'var(--c-line)'`.
- **Done when:**
  - `grep -rci 'C62828\|FDECEC' public/ --include=*.js --include=*.html --include=*.css | grep -v ':0'` prints nothing.
  - Screenshot `30-class-draw`: the "Stuck" chip and card outline are the same red as other red text on the page.
  - `npm test` → `43 passed`.
- **Risk:** low. The saved report (CSV) does not contain colours.

### T20 — Touch rules also apply to touch-screen laptops
- **Depends on:** T14, T15.
- **Files:** `public/index.html`, `teacher.html`, `sets.html`, `tstyle.css`.
- **Changes:** replace every `@media(pointer:coarse)` with `@media(any-pointer:coarse)` (index.html 1, teacher.html 2, sets.html 1, tstyle.css 1). Leave `@media(pointer:fine)` in `index.html` alone.
- **Done when:** `grep -c '(pointer:coarse)' public/*.html public/*.css | grep -v ':0'` prints nothing; at 1366×768 with a mouse-only device the screenshots are unchanged; `npm test` → `43 passed`.
- **Risk:** low–medium. On a touch-screen Chromebook, buttons and sort cards grow to 44 px even when the student uses the trackpad. That is the intended behaviour for this audience.

### T21 — New pulse words: "How is your work? — I need help / Almost / I understand"
- **Depends on:** T07, T09, T14, T19 (same lines and files).
- **Files:** `public/index.html`, `public/common.js`, `public/class.html`, `README.md`.
- **Must not touch:** the pulse keys `r`, `y`, `g`; the `c`, `soft` and `e` values in `PULSES`; `ws.send({ t: 'pulse'` and everything in `server.js`. Only the words change.
- **Changes:** replace each old string with the new one, character for character.

  `index.html`:

  | # | Old | New |
  |---|---|---|
  | 1 | `aria-label="How is your drawing going?"` | `aria-label="How is your work?"` |
  | 2 | `<span class="plb">How's it going?</span>` | `<span class="plb">How is your work?</span>` |
  | 3 | `aria-label="Stuck — I need help" aria-pressed="false"><i aria-hidden="true">🙋</i><span>Stuck</span>` | `aria-label="I need help" aria-pressed="false"><i aria-hidden="true">🙋</i><span>I need help</span>` |
  | 4 | `aria-label="Getting there" aria-pressed="false"><i aria-hidden="true">🙂</i><span>Getting there</span>` | `aria-label="Almost" aria-pressed="false"><i aria-hidden="true">🙂</i><span>Almost</span>` |
  | 5 | `aria-label="Got it" aria-pressed="false"><i aria-hidden="true">💡</i><span>Got it</span>` | `aria-label="I understand" aria-pressed="false"><i aria-hidden="true">💡</i><span>I understand</span>` |

  `common.js`:

  | # | Old | New |
  |---|---|---|
  | 6 | `// r = stuck, y = getting there, g = got it.` | `// r = I need help, y = almost, g = I understand.` |
  | 7 | `n: 'Stuck', short: 'Stuck'` | `n: 'I need help', short: 'Need help'` |
  | 8 | `n: 'Getting there', short: 'Getting there'` | `n: 'Almost', short: 'Almost'` |
  | 9 | `n: 'Got it', short: 'Got it'` | `n: 'I understand', short: 'I understand'` |

  `class.html` (teacher report, tooltips and CSV, so the teacher sees the same words the students tap):

  | # | Old | New |
  |---|---|---|
  | 10 | `tot.g + ' got it, ' + tot.y + ' getting there, ' + tot.r + ' stuck' }` | `tot.g + ' understand, ' + tot.y + ' almost, ' + tot.r + ' need help' }` |
  | 11 | `[r.g + ' got it', r.y + ' getting there', r.r + ' stuck']` | `[r.g + ' understand', r.y + ' almost', r.r + ' need help']` |
  | 12 | `'stuck on ' + t.r + ' questions' : t.last === 'r' ? 'stuck on the last question'` | `'needed help on ' + t.r + ' questions' : t.last === 'r' ? 'needed help on the last question'` |
  | 13 | `'Got it', 'Getting there', 'Stuck', 'No answer'` | `'I understand', 'Almost', 'I need help', 'No answer'` |
  | 14 | `r.g + ' got it, ' + r.y + ' getting there, ' + r.r + ' stuck' + (r.none` | `r.g + ' understand, ' + r.y + ' almost, ' + r.r + ' need help' + (r.none` |
  | 15 | `' said ' + p.n.toLowerCase() + ` | `' said “' + p.n + '”' + ` |

  `README.md`:

  | # | Old | New |
  |---|---|---|
  | 16 | `**🙋 Stuck / 🙂 Getting there / 💡 Got it**` | `**🙋 I need help / 🙂 Almost / 💡 I understand**` |
  | 17 | `**How's it going?**` | `**How is your work?**` |

- **Done when:**
  - `grep -c "Stuck\|Getting there\|Got it\|How's it going\|got it\|getting there" public/index.html public/common.js public/class.html README.md` prints `0` for all four files.
  - `grep -c "I need help" public/index.html public/common.js public/class.html` prints `1`, `2`, `1` (grep counts lines).
  - Screenshot `16-student-pulse-on--1366x768`: the panel reads "How is your work?" then 🙋 I need help, 🙂 Almost, 💡 I understand, each on one line. At 390×844 the panel still shows the three emoji only.
  - `30-class-draw`: student cards show chips "🙋 I need help", "🙂 Almost", "💡 I understand", each on one line. `52-projector-compare3`: the same words beside the names.
  - `npm test` → `43 passed`.
- **Risk:** low–medium. Words only, but they reach four places (student, teacher card, projector, report CSV). A CSV saved before this change uses the old column names. The server stores only `r` / `y` / `g`, so a class that is running during the update is not affected.

### T22 — Projector: bigger question text; QR code beside the join code
- **Depends on:** T11, T18.
- **Files:** `public/projector.html`.
- **Must not touch:** the script. It finds `#join`, `#url`, `#code` and `#qr` by id, and all four ids are kept.
- **Changes:**
  1. HTML. Replace the **whole line** that starts with ` <div id="join">` by exactly this one line:

```html
 <div id="join"><div class="jl">Go to <span id="url"></span><b id="code"></b></div><div class="jr"><div id="qr" role="img" aria-label="QR code to join"></div><div class="jcap">or scan to join</div></div></div>
```

  2. CSS. `.qbar{background:transparent;font-size:34px;text-align:center}` → `.qbar{background:transparent;font-size:clamp(34px,min(3vw,5vh),54px);line-height:1.25;text-align:center}`
  3. CSS. Replace the whole rule `#join{text-align:center;margin:auto;padding-bottom:4vh;font-size:clamp(24px,3vw,40px)}` with these five lines:

```css
#join{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:clamp(24px,6vw,110px);text-align:center;margin:auto;padding-bottom:4vh;font-size:clamp(24px,3vw,40px)}
#qr{width:clamp(200px,min(26vw,46vh),440px);height:clamp(200px,min(26vw,46vh),440px);background:#fff;border-radius:var(--r-lg);padding:6px}
.jcap{font-size:clamp(22px,2vw,32px);margin-top:10px;color:var(--c-stage-accent)}
body:has(#join:not([hidden])) main{max-width:none;padding:12px 24px}
body:has(#join:not([hidden])) .qbar{font-size:clamp(34px,min(3.6vw,6vh),64px)}
```

- **Done when:**
  - `grep -c 'qbar{background:transparent;font-size:34px' public/projector.html` prints `0`, and `grep -c 'id="qr" role="img" aria-label="QR code to join"></div>' public/projector.html` prints `1` (the inline `style` on the QR box is gone).
  - Screenshot `50-projector-join--1440x900`: the join code is on the left and the QR code on the right, side by side; the question is about 52 px (was 34 px); nothing is cut off. At 1366×768 the question is about 46 px and the QR code and "or scan to join" are fully on screen.
  - `51-projector-one`, `52-projector-compare3`, `53-projector-leaderboard`, `55-projector-sort-summary` at 1440×900: question text is about 43 px; every drawing, team row and bar is fully on screen.
  - `54-projector-frozen`: unchanged.
  - `npm test` → `43 passed`.
- **Risk:** medium. The question takes more height, so drawings on the projector are a little smaller (they still fill the space that is left; the script sizes them to fit). A very long question (three or more lines) on a 720-px-high projector leaves the least room; check `52-projector-compare3--1366x768`. If any drawing is cut off, stop and report it.

### T23 — Final check and "after" screenshots
- **Depends on:** all tasks.
- **Files:** `design-audit/after/` (new images only). No app files.
- **Note:** the baseline folder still holds `60-classic--*.png`; there is no "after" for it because T00 removed the page.
- **Changes:** start the server on port 3111, run `OUT=design-audit/after node design-audit/capture.cjs`, commit the images.
- **Done when:**
  - The script prints no line starting `FAIL`, `STEPFAIL` or `PAGEERR` except `STEPFAIL more 390x844` (the More button does not exist on the phone layout; this is in the baseline too).
  - `grep -hoiE '#[0-9a-f]{6}\b' $(ls public/*.css | grep -v tokens.css) | sort -u` prints nothing (`tokens.css` is the only stylesheet with hex colours).
  - `npm test` → `43 passed`.
  - `git diff --stat <commit of T00> -- server.js test.js public/sortkit.js public/sortedit.js public/qrcode.js public/starters.json` is empty (nothing but T00 touched the server).
- **Risk:** none.

---

## Deferred — needs your approval, not in the task list

Already decided and moved into the tasks: pulse wording (T21), bigger projector text (T22), retiring `/classic` (T00).

- **D1. Split `class.html`.** 1,124 lines with 53 inline `style=` attributes and about 40 style strings built in JavaScript. Moving the CSS to `class.css` and the phone layout to its own script would make later design work much safer, but it is a refactor, not a restyle.
- **D2. Full type and spacing scale.** 25 font sizes are in use (14, 15, 13, 18, 20, 17 are the top six). Snapping 15 → 16 and 17 → 18 touches about 90 rules on dense screens and needs a visual pass per screen. Tokens `--fs-*` and `--sp-*` exist now; this plan only raises text under 13 px.
- **D3. One font and one logo.** Teacher pages load Figtree and Bricolage Grotesque from Google Fonts; student pages use the system font (faster, and no third-party request from student devices). The student join card and the teacher top bar also use two different logos. Options: self-host the fonts and use them everywhere, or keep the split on purpose. Either way, pick one logo.
- **D4. Sort results header on the class screen.** Three stacked rows of controls sit above the numbers (`34-class-sort-results--1366x768`). Merging them into one row means changing markup built in `sortres.js`.
- **D5. Team colours that fail as text backgrounds.** `#ea580c`, `#0891b2`, `#0284c7` in `TEAM_COLORS`. T07 removes the only place white text sat on them, so nothing fails today; darkening the palette would also change teams teachers have already saved.
