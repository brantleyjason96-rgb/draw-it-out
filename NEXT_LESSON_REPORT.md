# End-of-lesson report

**More → End-of-lesson report** answers one question: *what do I need to cover next lesson?* It reads four things from the lesson: confidence vs accuracy, what was mixed up, vocabulary, and whose work reached the projector. It ends with a short "Cover next time" list, and **Copy summary** / **Save as text file** put it in a doc or planning note.

## What each part does
**Confidence vs accuracy (sort questions)**
- Accuracy is only known where there is an answer key, so this part reads **sort questions**. Students now see the red/amber/green buttons on sort screens too ("How sure are you?").
- The colour counted is the one they had **when they handed in**, so a reveal or instant feedback can't change it. If a question gave instant feedback, it is left out of this comparison.
- Buckets: *confident and right* (green, 80%+ of cards), *confident but missed some* (green, under 80%), *unsure and wrong* (red, under 60%), *unsure but right* (red, 80%+). Amber is never judged. Anyone in between is counted as in between.
- "Check in with" names students who were confident but missed some (with their score, like "got 4 of 6") or knew they needed help.

**What was mixed up**
- Per card and per **idea tag**: % right, and the most common wrong lane ("Granite was put in Sedimentary instead of Igneous by 5 students").
- A **hidden misconception** is an idea where two or more students said "I understand" and still placed a card wrong. They will not ask for help, so check those first.
- Under 70% right counts as shaky. Tag cards with an idea when you write a sort question to see this by idea instead of by card.

**Vocabulary**
- Type the words you wanted to see in the box (kept on this computer, per class). They are matched against the text students typed on **drawing questions**.
- Capitals, accents, plurals and small spelling slips still count. A spelling slip is shown separately ("spelled it differently"), because that student has the concept and needs the spelling.
- It also lists the most-typed labels, and anyone who said "I understand" but used none of your words. That is a cue to look at their drawing, not proof they don't know it.

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
- Drawing questions have no answer key, so confidence is not compared with accuracy there. The vocabulary check is the nearest thing.
- Small classes give noisy percentages. A card that 2 of 3 students missed reads as 33%.
- Students who joined partway through are counted from the question they joined. Someone who joined after the projector showings will appear under "Not yet shown".
