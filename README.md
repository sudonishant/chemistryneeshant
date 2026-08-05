# Chemistry Neeshant: Interactive Chemistry Learning Portal 🧪⚛️

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Chemistry Neeshant** is an interactive web-based chemistry learning portal designed specifically for **JEE Main & Advanced 2026/2027 aspirants**. It features real-time chemical reaction & atomic model simulations, an exhaustive formula database, chapter-wise notes canvas, and a multi-level practice question bank.

---

## 🌟 Key Features

- ⚛️ **Interactive Simulation Engine (`sim-engine.js` & `simulations.js`):** Visual 2D/3D canvas simulations for Atomic Structure (Bohr model, Orbitals), Chemical Kinetics, Thermodynamics, and Organic Reaction Mechanisms.
- 📘 **Chapter-wise Revision Notes (`chapter-data.js` & `notes-canvas.js`):** Comprehensive notes for Physical, Organic, and Inorganic Chemistry with interactive diagram canvas.
- 📐 **Instant Formula & Equation Lookup (`formula-data.js`):** Searchable chemistry formula database with unit conversions, key constants, and reaction balance helpers.
- 📝 **Multi-Level Practice Question Bank (`questions-bank.js`):** JEE-pattern MCQs with instant solution explanations, difficulty filters, and bookmarking.
- ⚡ **Zero-Dependency Lightweight Web App:** Built using pure vanilla HTML5, CSS3, and JavaScript — no build steps or heavy frameworks required!

---

## 🚀 How to Run Locally

### Option 1: Direct File Access (No Installation Required)
Simply download or clone the repository and double-click `index.html` to open it in any web browser (Chrome, Firefox, Edge, Safari):

```bash
git clone https://github.com/sudonishant/chemistryneeshant.git
cd chemistryneeshant
# Open index.html directly in browser
```

### Option 2: Using Live Server (Recommended for Live Reloading)
If you have Node.js installed, you can use `live-server` or `serve`:

```bash
# Using live-server
npx live-server .

# OR using python HTTP server
python3 -m http.server 8000
```

Then navigate to **`http://localhost:8000`** in your browser!

---

## 📂 Project Architecture

```
chemistryneeshant/
├── index.html          # Main HTML5 entrypoint & app structure
├── style.css           # Glassmorphic UI styles, dark mode, responsive layout
├── script.js           # Main application logic & view router
├── sim-engine.js       # HTML5 Canvas 2D/3D physics & animation renderer
├── sim-registry.js     # Simulation registry & state controller
├── simulations.js      # Individual chemistry simulation modules (Atomic, Kinetics, Thermo)
├── chapter-data.js     # Chapter notes dataset (Physical, Organic, Inorganic)
├── formula-data.js     # Complete chemistry formula & constants database
├── questions-bank.js   # Practice question bank & solutions engine
└── notes-canvas.js     # Interactive drawing & annotation canvas utility
```

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend UI** | HTML5 Semantic Layout, CSS3 Grid/Flexbox |
| **Animation Engine** | Vanilla JS `requestAnimationFrame` + HTML5 `<canvas>` |
| **Styling** | Custom Glassmorphism Theme (Dark & Modern modes) |
| **Database** | In-Memory JSON Datasets (`chapter-data`, `formula-data`, `questions-bank`) |

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).

---

## 👤 Author
**Nishant Kumar**
- **GitHub**: [@sudonishant](https://github.com/sudonishant)
- **Website**: [neeshant.online](https://neeshant.online)
