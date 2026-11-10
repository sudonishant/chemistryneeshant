# Chemistry Neeshant

Chemistry Neeshant is a browser-based, interactive chemistry study notebook for JEE Main and Advanced preparation. It bundles chapter notes, formula lookup, practice questions, canvas simulations, a CBT-style practice flow, and personal study notes into a plain HTML/CSS/JavaScript app.

This repository is a static client-side project. There is no server, database, package manifest, or build pipeline in the repository.

## What is implemented

- Chapter navigation and searchable chapter content from `chapter-data.js`.
- Formula and equation lookup from `formula-data.js`.
- Chapter-specific practice questions and CBT-style scoring from `questions-bank.js` and `script.js`.
- Canvas-based chemistry simulations registered in `sim-registry.js` and implemented in `simulations.js` / `sim-engine.js`.
- Text notes, read markers, preferences, test history, and hand-drawn notes persisted in the browser.
- Scroll and single-page reading modes, themes, font selection, printing, and formula-sheet printing.
- KaTeX rendering for mathematical notation.

The app presents a large, generated reading space (pages 1–2200). Much of that space is generated from chapter data and repeated page templates; it is not equivalent to 2200 individually authored pages.

## Quick start

### Option A: Open the entry point

Clone the repository and open `index.html` in a modern browser:

```bash
git clone https://github.com/sudonishant/chemistryneeshant.git
cd chemistryneeshant
# Open index.html in your browser
```

### Option B: Serve it locally

A local HTTP server is useful for consistent browser behavior and avoids file-URL restrictions in some browser setups. Python 3 is sufficient:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000/> and stop the server with `Ctrl+C` when finished. No `npm install`, build command, or environment variables are required by the repository.

## Architecture

```text
index.html          Static UI shell, dialogs, controls, and script loading order
style.css           Themes, layout, responsive styles, and print styles
script.js           Application orchestration, navigation, persistence, CBT flow,
                    printing, formula sheet, and analytics
chapter-data.js     Chapter and section content used to generate reading pages
formula-data.js    Formula and constants data
questions-bank.js  Practice-question data and question-bank setup
simulations.js     Simulation implementations and parameter logic
sim-engine.js      Canvas rendering and simulation lifecycle helpers
sim-registry.js    Simulation metadata and registry
notes-canvas.js    Drawing canvas, undo/redo, and local persistence
3d-bg-engine.js    Decorative background particle/orbit animation
```

Scripts are loaded directly from `index.html` in this order: data and simulation modules first, then `script.js` as the main orchestrator. The app expects a browser DOM, canvas support, `requestAnimationFrame`, and `localStorage` (it degrades some storage operations when storage is unavailable).

## External resources

The HTML entry point loads these resources from public CDNs at runtime:

- KaTeX 0.16.8 and its auto-render extension for equations.
- Font Awesome 6.4.0 for icons.
- Google Fonts (Architects Daughter, Caveat, Outfit, and JetBrains Mono).

An offline copy of the app may therefore have missing icons, fonts, or equation rendering unless these resources are vendored or replaced. The study datasets themselves are stored in the repository and do not require an API.

## Data, privacy, and safety notes

- Notes, drawings, theme/font preferences, read markers, and CBT history are stored in this browser's `localStorage`. They are not synchronized to an account or backed up by this project.
- Clearing site data, using a different browser/profile, or opening the app under a different origin can remove or hide saved progress.
- The app does not provide a server-side privacy boundary. Do not enter passwords, payment information, or other sensitive personal data into notes.
- Content is educational material and practice tooling, not a substitute for official JEE material, a laboratory protocol, or professional chemical-safety guidance. The simulations are visual/educational models and should not be treated as experimental measurements.
- The repository does not include a backend, authentication, analytics service, or environment-variable configuration.

## Development checks

There is currently no `package.json`, test runner, linter, or CI configuration. For a lightweight source check, run:

```bash
for file in 3d-bg-engine.js chapter-data.js formula-data.js \
  notes-canvas.js questions-bank.js script.js sim-engine.js \
  sim-registry.js simulations.js; do
  node --check "$file"
done
```

This checks JavaScript syntax only; it does not replace opening the app in a browser and exercising navigation, simulations, printing, persistence, and the CBT flow.

## Contributing

Keep changes compatible with a static browser deployment. When changing data or UI behavior, verify the corresponding flow in a browser and update this README if the entry point, external resources, persistence behavior, or local setup changes.
