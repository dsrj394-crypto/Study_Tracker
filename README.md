# Study Tracker (VibeSprint MVP)

A simple study progress tracker. Students create subjects and topics, mark topics complete, and see a progress bar and exam countdown for each subject.

**Built by:** (add your name / team name here)
**Live demo:** (paste your live link here)

## Features

1. Add subjects (with an exam date) and topics.
2. Mark topics complete or incomplete.
3. Progress bar with percentage and an "X days left" countdown per subject. The nearest exam is listed first.
4. Starts with fictional sample data so it works on first load.
5. Clear messages confirm every action and flag missing input.
6. Study priority order: set a topic to High, Medium or Low. After the exam-moved-earlier simulation, the app lists unfinished topics in priority order with a days-per-topic suggestion.
7. Theme selector: Light, Dark and JellyFish (inspired by the JellyFish VS Code theme). The choice is remembered between visits.
8. Difficulty alerts: pick Hard, Medium or Easy when adding a subject. A banner appears once the exam is within the recommended prep window (Hard: 7 days, Medium: 4 days, Easy: 2 days) and topics are still unfinished.
9. Sort subjects by Date (default), Difficulty, or Pending % (least complete first).
10. Exam date can be edited directly at any time via the date field on each subject card — this is independent of "Simulate exam moved earlier" / "Reset date", which only undo the simulation.
11. Attach a reference PDF to a subject (optionally when adding it, or any time after) and to individual topics. Attached PDFs open in a new tab and can be removed or replaced. PDFs are stored as base64 in `localStorage`, so each file is capped at 8MB to avoid filling up browser storage.
12. On the day of an exam, the subject's card shows a "Good luck" banner, and a toast wishes the user luck for any exam happening today as soon as the app loads.

## Judge demo path

1. **Add a topic and mark it complete.** The progress bar and percentage update.
2. **Tap "Simulate exam moved earlier".** The exam date moves 3 days earlier (never before today).
3. **See the result.** A warning banner shows the old and new countdown, unfinished topics are highlighted, and a study priority order is shown. "Reset date" restores the original date.

## How to run

No install, no build step, no secrets. Open `index.html` in any modern browser.

## Project structure

```
study-tracker/
├── index.html           Page structure
├── styles.css           Styles (light and dark mode)
├── app.js               All logic (state, rendering, events)
├── ADDING-FEATURES.md   Guide for changing the code
├── README.md            This file
└── .gitignore           Keeps secrets and junk out of Git
```

There is no backend: the challenge rules require a browser-only prototype with no API, database or login. Data is saved in the browser with `localStorage`.

## Rules compliance

- Browser-only, local calculations, no external API or paid service
- No `.env` and no secrets or API keys
- Core journey works end-to-end with validation and visible success messages
- Fictional sample data only

## Adding features

See [ADDING-FEATURES.md](ADDING-FEATURES.md).
