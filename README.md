# LiftLog

A workout logger for iPhone that suggests weight and reps using progressive overload.
It is a plain-files web app (no build step) meant to be hosted on GitHub Pages and
added to the iPhone home screen from Safari.

## Run locally

```bash
python -m http.server 5173
```

Open http://localhost:5173.

## Tests

```bash
npm test
```

## Files

- `js/engine.js` – progressive overload logic (pure functions, unit-tested)
- `js/planner.js` – weekly plans: splits, blocks, weekly volume, reviews (pure, unit-tested)
- `js/plancontrol.js` – plan lifecycle: pauses, breaks, edits that teach the plan (pure, unit-tested)
- `js/units.js` – lb/kg display; weights are always stored in lb
- `js/library.js` – every exercise as movement × equipment version (plate-loaded, pin/dial, Smith, cable…)
- `js/search.js` – exercise search with filters and synonyms
- `js/merge.js` – matching a custom exercise to the library (moves its history)
- `js/data.js` – muscles, regions, day types; builds the exercise list from the library
- `js/store.js` – data saved in `localStorage`
- `js/app.js` – UI
- `sw.js` – offline cache

## Shipping updates

Bump `VERSION` in `sw.js` whenever files change, so phones fetch the new version.
The phone picks up changes the next time the app is opened.
