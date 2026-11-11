# Session data

**More → Save lesson data** (spreadsheet or JSON) pulls everything a class collected during the lesson. This page lists what is in the file and what you can work out from it.

## How it works
- The teaching screen sends `{ t: 'export' }`. The server replies with one record for the lesson so far (`sessionRecord` in `server.js`). Only a host with the class key gets it; students and the projector are ignored.
- When a question ends (a new one is sent), the server snapshots it **before** the drawings, sort answers, colours and points are wiped. The question on screen is added as `live: true`. Asking changes nothing.
- Drawings are not stored. Each is reduced to numbers (see below), so the record stays small. The last 40 questions are kept. **Clear class starts a fresh record**, so save first.
- The server only knows initials or nicknames. The teaching screen adds real names from the class list on your computer, so **the file contains student names**. Treat it like a gradebook.
- `rid` is the class-list id. It stays the same from lesson to lesson, so you can join files from different days without names.

## What is collected, per question
| Field | Meaning |
|---|---|
| `n`, `kind`, `q`, `bg`, `picture`, `quick` | Question number, drawing or sort, text, background, whether it had a picture, whether Quick mode was on |
| `start`, `end`, `elapsed` | When it ran |
| `freezes`, `frozenSecs` | How often you froze the class, and for how long |
| `scores` | Team points as they stood when the question ended |
| `sort` | Per card: answer-key lane, idea tag, how many placed it, how many were right, which wrong lanes were chosen |

## Per student, per question
| Field | Meaning |
|---|---|
| `team`, `late` | Team at the time; joined after the question started |
| `pulse`, `trail` | Final colour, and every colour tap as `[seconds, colour]` |
| `first`, `last` | Seconds from question start to first and last mark (or card placement) |
| `revisions` | Delete and undo/redo/reorder actions (drawing questions) |
| `drawing` | `n` objects; counts of strokes, lines, arrows, shapes, text; `labels` (the text typed); `ink` length in px; `colors` used; `cover` = share of the page the work spans |
| `sort` | Cards placed, cards correct, finished or not, and the full card → lane map |
| `shown`, `awarded` | Their work was on the projector; they earned the team a point |

## What can be worked out from it
**Understanding**
- Confidence vs. reality: students who said green but placed cards wrongly (sort), or red but got everything right. This is the strongest use of the file.
- Which sort card, and which *idea*, the class misses most, and the specific wrong lane they pick. That shows the misconception, not just the miss.
- A student's confidence over a lesson: rising, flat, or falling, and whether they changed their mind (`trail`).
- Who is red on the same idea across several questions, and who stays quiet (no colour, no marks).
- Vocabulary: which required words appeared in `labels`, which never did, and who labelled the most.

**Effort and pacing**
- How long students took to start (`first`) and finish (`last`), and the median, so you can see if a question was too long or too short.
- Who started late, finished early, or never started. Late joiners are flagged.
- Persistence: students who deleted and redrew a lot (`revisions`) versus a single pass.
- Pace across the lesson: whether time per question grew or shrank, and how freezes lined up with it.

**Drawing quality (rough signals, not grades)**
- How much a student drew (`n`, `ink`, `cover`), compared with the class.
- Labelled versus unlabelled diagrams; arrows used for processes and cycles; colour used to separate parts.
- Sparse or tiny drawings, which are worth a look.

**Participation and equity**
- Whose work is shown on the projector, and who has never been shown (`shown` across questions).
- How points are spread across students, versus across teams.
- Team comparison: confidence, accuracy, speed and points together. Is the leading team the most correct or just the fastest?
- Who needs a point or a showcase moment because they have had neither.

**Groups and planning**
- Re-teach groups: students who share the same wrong lane on the same card.
- Pairing: confident and accurate students beside confident but wrong ones, or beside red ones.
- Exit-ticket style cut: who to check in with tomorrow, ranked by red count, wrong cards and silence.
- Ready to move on: share of the class in the right lane, plus share green. Together these answer "go or re-teach?"

**Across lessons (join files by `rid`)**
- Growth per student and per class, by topic or by idea tag.
- Class period comparison: same questions, different hours.
- Which questions or sort cards reliably work, so you can reuse or fix them.
- Before-and-after on a unit: first sort question versus the last.
- Evidence for a conference, an IEP/504 note, or a TESOL case study: for example, whether multilingual learners label more once a word bank is added. Compare the `labels` and `first` columns before and after.

## Not collected yet (would need a small addition)
- Drawings themselves (only numbers are kept). A PNG per student per question would allow side-by-side growth.
- The question's answer, so confidence can be checked against a drawing automatically. Only sort questions have a key today.
- Home language or ELL level (a teacher-set tag on the class list), which would make the multilingual-learner comparisons one click.
- Reveal timing, "reopen" use, and manual +/- point adjustments, which are not logged per question.
- A per-student, per-question teacher note.
