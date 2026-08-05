# ⚗️ ChemistryNeeshant — Interactive Chemistry Learning App

<div align="center">

![Chemistry Banner](https://img.shields.io/badge/JEE%20Prep-Chemistry-orange?style=for-the-badge&logo=atom&logoColor=white)

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![JEE Prep](https://img.shields.io/badge/JEE-Aspirant%20Tool-brightgreen?style=for-the-badge&logo=bookstack&logoColor=white)](https://github.com/Neeshant01/chemistryneeshant)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![No Dependencies](https://img.shields.io/badge/Dependencies-None-success?style=flat-square)](https://github.com/Neeshant01/chemistryneeshant)
[![Platform](https://img.shields.io/badge/Platform-Browser-blue?style=flat-square&logo=googlechrome)](https://github.com/Neeshant01/chemistryneeshant)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/Neeshant01/chemistryneeshant/pulls)

**JEE aspirants ke liye ek powerful, interactive chemistry learning web application — bina kisi installation ke!**

[🚀 Open App](#-how-to-run) • [✨ Features](#-features) • [🛠 Tech Stack](#️-tech-stack) • [👤 Author](#-author)

</div>

---

## 📖 About / Kya Hai Yeh?

**ChemistryNeeshant** ek pure browser-based interactive chemistry learning platform hai jo specially **JEE Main & Advanced** aspirants ke liye banaya gaya hai. Ismein live simulations, formula database, chapter-wise notes aur ek comprehensive questions bank hai — sab kuch ek hi jagah!

No backend. No server. No installation. **Bas browser open karo aur padhna shuru karo!** 🎯

---

## ✨ Features

### 🧪 Interactive Chemistry Simulations
- **Real-time molecular simulations** — reactions ko visually samjho
- Multiple simulation types covering Physical, Organic & Inorganic Chemistry
- Sim engine (`sim-engine.js`) + extensive registry (`sim-registry.js`) with dozens of pre-built experiments
- Canvas-based rendering for smooth, responsive animations

### 📐 Formula Database
- **Comprehensive formula library** covering all JEE chapters
- Instant search and browse functionality
- Organized by topic — Physical Chemistry, Organic reactions, Electrochemistry, and more
- Copy-ready formulas with derivation hints

### 📚 Chapter-wise Notes with Canvas
- **Draw and annotate** directly on the canvas (`notes-canvas.js`)
- Chapter-structured notes covering entire JEE Chemistry syllabus
- `chapter-data.js` contains structured chapter content for all major topics (1.6MB of content!)
- Save your handwritten/digital notes in-browser

### ❓ Questions Bank
- **Curated JEE-level MCQs** and problems (`questions-bank.js`)
- Chapter-wise filtering to focus your practice
- Instant answer checking and explanations
- Track your attempted questions

### 🎨 Beautiful UI/UX
- Clean, distraction-free study interface
- Responsive design — works on desktop and tablet
- Smooth transitions and animations

---

## 🔧 Prerequisites / Zarooratein

> Kuch bhi install karne ki zaroorat **NAHI** hai!

| Requirement | Details |
|---|---|
| 🌐 **Web Browser** | Chrome, Firefox, Edge, Safari (latest version) |
| 📶 **Internet** | Not required after download! |
| 🟢 **Node.js** | Only if you want to use Live Server (optional) |
| 📦 **Installation** | ❌ None needed |

---

## 🚀 How to Run / Kaise Chalayein

### Method 1: Direct Open (Simplest — Sabse Aasaan)

Simply **double-click** `index.html` in your file manager — that's it! 🎉

---

### Method 2: Clone & Open

```bash
# Step 1: Clone the repository
git clone https://github.com/Neeshant01/chemistryneeshant.git

# Step 2: Go into the folder
cd chemistryneeshant

# Step 3: Open index.html in your browser
# (Double-click the file, or use the command below on Linux/Mac)
xdg-open index.html
```

---

### Method 3: Live Server (Best for Development)

```bash
# Clone karo
git clone https://github.com/Neeshant01/chemistryneeshant.git
cd chemistryneeshant

# Live server se chalao (Node.js required)
npx live-server .

# Browser automatically khul jayega at http://localhost:8080
```

> 💡 **Tip**: Live Server use karne se changes automatically reload ho jaate hain — development ke liye best!

---

## 🗂️ Project Structure / Project Ki Banawat

```
chemistryneeshant/
│
├── 📄 index.html          # Main entry point — yahan se sab shuru hota hai
├── 🎨 style.css           # All styling — UI ka dil (49KB)
├── ⚙️  script.js           # Core app logic & navigation (140KB)
│
├── 📊 chapter-data.js     # Chapter-wise content & notes data (1.6MB!)
├── 🔢 formula-data.js     # Formula database for all JEE topics
├── ❓ questions-bank.js   # JEE MCQ bank with answers (30KB)
│
├── 🧪 sim-engine.js       # Simulation rendering engine (Canvas-based)
├── 🔬 simulations.js      # Simulation logic & physics (138KB)
└── 📋 sim-registry.js     # Registry of all available simulations (175KB!)
    notes-canvas.js        # Canvas-based notes & drawing tool
```

---

## 🛠️ Tech Stack / Kya Use Kiya Gaya

| Technology | Purpose | Why? |
|---|---|---|
| **HTML5** | Structure & Canvas API | Semantic markup + powerful canvas for simulations |
| **CSS3** | Styling & Animations | Smooth UI without any framework |
| **Vanilla JavaScript** | All logic & interactivity | Zero dependencies = lightning fast |
| **Canvas API** | Simulations & Notes drawing | Real-time rendering engine |
| **Web Storage API** | Saving notes locally | Data persistence without a server |

> 🏆 **Pure Vanilla Stack** — No React, No Vue, No jQuery. Just raw web power!

---

## 🧑‍💻 Usage Guide / Kaise Use Karein

1. 🏠 **Home Page** — App open hote hi dashboard dikhega
2. 🧪 **Simulations Tab** — Chemistry reactions ko live dekho aur samjho
3. 📐 **Formulas Tab** — Search karo ya browse karo apna formula
4. 📚 **Notes Tab** — Chapter select karo aur notes padhne ya likhne shuru karo
5. ❓ **Questions Tab** — Chapter-wise MCQs solve karo aur apni progress check karo

---

## 🤝 Contributing / Contribute Karein

Contributions welcome hain! Agar aapko koi bug mile ya naya feature add karna ho:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

<div align="center">

### Nishant Kumar

[![GitHub](https://img.shields.io/badge/GitHub-Neeshant01-black?style=for-the-badge&logo=github)](https://github.com/Neeshant01)

*"Chemistry ko ek simulation ki tarah dekho — har reaction ek kahani hai!"* ⚗️

Made with ❤️ for JEE Aspirants of India 🇮🇳

</div>

---

<div align="center">

⭐ **Agar yeh app helpful lagi toh Star zaroor do!** ⭐

</div>
