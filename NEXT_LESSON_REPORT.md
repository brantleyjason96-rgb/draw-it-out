# End-of-lesson report

**More → End-of-lesson report** answers one question: *what do I need to cover next lesson?* It reads four things from the lesson: confidence vs accuracy, what was mixed up, vocabulary, and whose work reached the projector. It opens with a short "Cover next time" list. **Print / save as PDF** gives a paper version (choose "Save as PDF" in the print window), and **Copy summary** / **Save as text file** put it in a doc or planning note.

## What each part does
**Confidence vs accuracy (sort answers, and the points you give)**
- Accuracy comes from two places. On a **sort question** it is the answer key. On a **drawing question** it is **the point you gave** for a correct diagram: green with a point is right, green with no point is "confident but missed some". Students see the red/amber/green buttons on sort screens too ("How sure are you?").
- The colour counted is the one they had **when they handed in**, so a reveal or instant feedback can't change it. If a question gave instant feedback, it is left out of this comparison.
- Points only count when they can tell us something. If points are **limited to one per team**, a missing point says nothing about a student, so those questions are not compared. If **no points were given** on a question, there is nothing to compare. The report says so on that question's line. A point is your judgement, so give one to every student whose diagram is right if you want this comparison to be fair.
- Buckets: *confident and right* (green, 80%+ of cards), *confident but missed some* (green, under 80%), *unsure and wrong* (red, under 60%), *unsure but right* (red, 80%+). Amber is never judged. Anyone in between is counted as in between.
- "Check in with" names students who were confident but missed some (with their score, like "got 4 of 6" or "earned no point on Q1"), and students who tapped "I need help" on two or more questions or ended on it. The red-tap part needs no answer key, so it works on a whiteboard-only lesson. A red tap that turned out right (they had the answer or earned the point) is not flagged; those students are listed as "know more than they think".

**What was mixed up**
- Per card and per **idea tag**: % right, and the most common wrong lane ("Granite was put in Sedimentary instead of Igneous by 5 students").
- A **hidden misconception** is an idea where two or more students said "I understand" and still placed a card wrong. They will not ask for help, so check those first.
- Under 70% right counts as shaky. Tag cards with an idea when you write a sort question to see this by idea instead of by card.

**Vocabulary**
- Type the words you wanted to see in the box (kept on this computer, per class). They are matched against the text students typed on **drawing questions**.
- Capitals, accents, plurals and spelling slips still count, including sound-it-out spellings of long words ("condensashun", "metamorfic"). A slip is shown separately ("spelled it differently"), because that student has the concept and needs the spelling. Short words must match exactly, so "rack" is not "rock".
- It also lists the most-typed labels. Students who typed nothing at all are counted, not accused. Anyone who said "I understand", typed some labels, and used none of your words is named, as a cue to look at their drawing, not proof they don't know it.

**On the projector**
- How many times work was shown, who was shown and how often, who hasn't been shown yet, and which colour those students had (green, amber, red, none) when they were shown.

## How it works
- The teaching screen sends `{ t: 'export' }`; the server replies with the lesson's record (`sessionRecord` in `server.js`). Only a host with the class key gets it.
- When a question ends, the server snapshots it **before** its drawings, answers and colours are wiped. The question on screen is included, marked `live`.
- The record holds only: each student's initials or nickname, colour, whether they were shown, the words they typed (drawing questions), and their full answer (sort questions). **Drawings are not kept.**
- The analysis (`public/nextlesson.js`) is plain functions with no page access, and is covered by the tests.
- Real names are added in your browser from the class list on your computer. They appear in the report and the summary you copy, never on the server.
- The last 40 questions are kept. **Clear class starts a fresh record**, so copy or save the report first.

## Limits worth knowing
- A drawing question has no answer key, so its "accuracy" is only as good as the points you gave. Vocabulary is a second, rougher check.
- Small classes give noisy percentages. A card that 2 of 3 students missed reads as 33%.
- Students who joined partway through are counted from the question they joined. Someone who joined after the projector showings will appear under "Not yet shown".
