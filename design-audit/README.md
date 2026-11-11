# Design audit — start here

This folder is the evidence behind `../DESIGN_PLAN.md`. If you are the model (or person) doing the work, read this page, then the plan.

## What is here

- **113 baseline screenshots** of the app *before* any design change: 38 screens at three sizes.
  File names are `<number>-<screen>--<width>x<height>.png`, for example `25-student-sort-revealed--1366x768.png`.
  - `01` landing · `10`–`25` student · `30`–`35` class screen · `40`–`45` Today and set editor · `50`–`55` projector · `60` the old `/classic` page (removed by task T00)
  - Sizes: `1440x900` (teacher laptop, projector), `1366x768` (student Chromebook), `390x844` (phone)
  - Names ending `-full` are full-page captures.
- **`capture.cjs`** — the script that took them. Re-run it to make "after" screenshots.

## How to do the work

1. Open `../DESIGN_PLAN.md`. Read **Rules for the implementer** first. They apply to every task.
2. Do tasks **T00 to T23 in order**. One task is one commit, with the message `T07: <title>`.
3. Every task lists its files, the exact text to find and replace, and a **Done when** list. Run those checks before you commit. If a find string is missing or a count is different, stop and report it. Do not guess.
4. After every task: `npm test` must print `43 passed`.
5. Do not start anything under **Deferred**. Those need the owner's approval.

## How to take "after" screenshots

```
npm install
PORT=3111 node server.js &
OUT=design-audit/after node design-audit/capture.cjs          # all three sizes, about 6 minutes
OUT=design-audit/after node design-audit/capture.cjs 1366     # one size only
```

- Needs Playwright and Chromium (already installed in Claude Code cloud sessions; do not run `playwright install`).
- Without `OUT`, the script writes into this folder and **overwrites the baseline**. Always set `OUT`.
- The line `STEPFAIL more 390x844` is expected: the More button does not exist on the phone layout.
- Compare an "after" image with the baseline of the same name. Each task says which screens may change and how.

## Status

- Plan written and checked: every find string, count and grep in the plan was run against a scratch copy of the repo, and `npm test` passed.
- Implementation: **done** (T00–T23; "after" screenshots are in `after/`). The next round of design work is proposed in `../DESIGN_PLAN_V2.md`.
