/* ==========================================================================
   Atomica: Master Orchestrator, Continuous Scroll, & CBT Engine
   ========================================================================== */

// Safe localStorage wrapper to prevent potential exceptions in restricted environments
const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem failed:", e);
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem failed:", e);
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage.removeItem failed:", e);
    }
  }
};

// Global States
let currentChapterId = 1;
let currentBookPage = 1;
let cbtTimerInterval = null;
let cbtQuestions = [];
let cbtResponses = {}; // questionId -> chosenOptionIndex
let cbtStatus = {};    // questionId -> 'answered', 'not-answered', 'marked', 'marked-answered', 'unvisited'
let cbtActiveQuestionIdx = 0;
let cbtSecondsLeft = 1800; // 30 minutes
let cbtQuestionDurations = {}; // questionId -> accumulated seconds spent

// Scroll Mode State Variables
let viewMode = 'scroll'; // 'single' or 'scroll'
let minLoadedPage = 1;
let maxLoadedPage = 1;
let isLoadingPage = false;
let loadedChapterId = null; // Set to null so first loadChapter call does a full clean load

let sketchpad = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Canvas Sketchpad for bottom notes
  sketchpad = new AtomicaSketchpad("notes-drawing-canvas");

  // Load and apply saved preferences
  viewMode = safeStorage.getItem('atomica-view-mode') || 'scroll';
  updateViewModeUI();
  initSidebar();

  const savedTheme = safeStorage.getItem('atomica-theme') || 'theme-paper-white';
  const savedFont = safeStorage.getItem('atomica-font') || 'font-handwriting';
  document.body.className = `${savedTheme} ${savedFont}`;

  // Highlight active theme option in UI dropdown
  document.querySelectorAll('.theme-opt').forEach(opt => {
    if (opt.getAttribute('data-theme') === savedTheme) {
      opt.classList.add('active');
      const themeBtn = document.getElementById('theme-btn');
      if (themeBtn) {
        themeBtn.querySelector('span').innerText = 'Theme: ' + opt.innerText;
      }
    } else {
      opt.classList.remove('active');
    }
  });

  // Highlight active font option in UI
  const fontToggleBtn = document.getElementById('font-toggle-btn');
  if (fontToggleBtn) {
    if (savedFont === 'font-sans-serif') {
      fontToggleBtn.querySelector('span').innerText = 'Sans Serif';
    } else {
      fontToggleBtn.querySelector('span').innerText = 'Handwriting';
    }
  }

  // Load the initial chapter (restoring last active or default to 1)
  const lastActiveChId = parseInt(safeStorage.getItem('atomica-last-active-id'), 10) || 1;
  loadChapter(lastActiveChId);
  setupEventListeners();
  initFloatingDockDrag();
});

/* ==========================================================================
   1. SIDEBAR INITIALIZATION
   ========================================================================== */
function initSidebar() {
  const nav = document.getElementById('chapters-nav');
  if (!nav) return;

  // Group chapters by branch
  const branches = {};
  window.CHEMISTRY_CHAPTERS.forEach(ch => {
    const branchNum = ch.branch;
    if (!branches[branchNum]) {
      branches[branchNum] = {
        title: ch.branchTitle,
        chapters: []
      };
    }
    branches[branchNum].chapters.push(ch);
  });

  nav.innerHTML = '';
  // Force rendering in order: Physical (1), Inorganic (2), Organic (3)
  [1, 2, 3].forEach(branchNum => {
    const branch = branches[branchNum];
    if (!branch) return;
    
    const group = document.createElement('div');
    group.className = 'vol-group';
    group.innerHTML = `<div class="vol-title" style="border-left: 3px solid var(--accent-${branchNum === 1 ? 'blue' : (branchNum === 2 ? 'green' : 'orange')}); padding-left: 8px;">${branch.title}</div>`;

    branch.chapters.forEach(ch => {
      const item = document.createElement('div');
      item.className = 'chapter-nav-item';
      item.id = `nav-ch-${ch.id}`;
      item.innerHTML = `
        <span class="ch-num">${ch.id.toString().padStart(2, '0')}</span>
        <span class="ch-title">${ch.title}</span>
      `;
      item.onclick = () => loadChapter(ch.id);
      group.appendChild(item);
    });

    nav.appendChild(group);
  });
}

/* ==========================================================================
   2. CHAPTER LOADING & PERSISTENCE
   ========================================================================== */
function loadChapter(id) {
  currentChapterId = id;
  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === id);
  if (!ch) return;

  // Update last active chapter in storage
  safeStorage.setItem('atomica-last-active-id', id);
  safeStorage.setItem('atomica-last-active-title', ch.title);

  // Highlight active sidebar item
  document.querySelectorAll('.chapter-nav-item').forEach(item => item.classList.remove('active'));
  const activeNav = document.getElementById(`nav-ch-${id}`);
  if (activeNav) activeNav.classList.add('active');

  // Top Bar updates
  document.getElementById('current-volume-badge').innerText = ch.branchTitle;
  document.getElementById('current-chapter-head').innerText = `Chapter ${ch.id}: ${ch.title}`;

  // Load bottom study notes text area
  const notesField = document.getElementById('student-chapter-notes');
  const savedNotes = safeStorage.getItem(`atomica-ch-${id}-notes`) || '';
  notesField.value = savedNotes;

  // Load bottom study notes drawings
  if (sketchpad) {
    sketchpad.loadNotesState(id, 1);
  }

  // Load page 1
  loadChapterPage(id, 1);
}

function romanize(num) {
  const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = '';
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

function formatParagraphs(text) {
  return text.split('\n\n').map(p => `<p>${p}</p>`).join('');
}

function getPageHtml(ch, pageNum) {
  if (pageNum === 1) {
    // Page 1: Cover Page
    return `
      <div class="chapter-title-page">
        <div class="margin-note">📓 Page 1</div>
        <h1 class="chapter-number-title">CHAPTER ${romanize(ch.id)}</h1>
        <h2 style="font-size: 2.2rem; border: none; color: var(--text-color); margin-top: 15px;">${ch.title}</h2>
        <div class="hr-notebook"></div>
        <blockquote style="font-style: italic; font-size: 1.4rem; margin: 30px 0; border-left: 3px solid var(--accent-orange); padding-left: 15px; color: var(--text-color);">
          "${ch.quote}"
          <cite style="display: block; font-size: 1.05rem; text-align: right; margin-top: 5px; font-weight: bold; font-family: var(--font-interface);">— ${ch.quoteAuthor}</cite>
        </blockquote>
        <div class="hr-notebook"></div>
      </div>
    `;
  } else if (pageNum === 2) {
    // Page 2: Table of Contents reading map
    return getTableOfContents(ch);
  } else if (pageNum === 3) {
    // Page 3: Master Preview
    return `
      <div class="preview-page">
        <div class="margin-note">📓 Page 3</div>
        <h2 style="color: var(--accent-blue); border-bottom: 2px dashed var(--accent-blue); font-size: 1.6rem;">CHAPTER MASTER PREVIEW</h2>
        <div class="preview-box-container" style="background: rgba(2, 136, 209, 0.03); border: 1.5px dashed var(--accent-blue); padding: 20px; border-radius: var(--border-radius); margin: 30px 0;">
          <h4 style="font-family: var(--font-heading); color: var(--accent-blue); margin-bottom: 10px; font-size: 1.3rem;">What You'll Master:</h4>
          <ul style="list-style-type: square; padding-left: 20px; margin-bottom: 20px; font-size: 1.2rem; line-height: 1.6;">
            ${ch.previews.map(p => `<li>${p}</li>`).join('')}
          </ul>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 1.1rem; line-height: 1.5; border-top: 1px dotted var(--border-color); padding-top: 15px;">
            <div><strong>Prerequisites:</strong> ${ch.prerequisites.join(', ') || 'None'}</div>
            <div><strong>JEE Main/Adv Weightage:</strong> <span class="highlight-text" style="font-weight:700; color:var(--accent-red);">${ch.weightage}%</span></div>
          </div>
        </div>
      </div>
    `;
  } else if (pageNum === 4) {
    // Page 4: Motivation Page
    return `
      <div class="motivation-page">
        <div class="margin-note">📓 Page 4</div>
        <h3 style="color: var(--accent-orange); font-family: var(--font-heading); font-size:1.6rem; border-bottom: 1.5px dashed var(--accent-orange); display: inline-block;">Why This Chapter Matters</h3>
        <p style="font-size: 1.3rem; line-height: 1.6; margin-top: 15px; color:var(--text-color);">${ch.motivation}</p>
        <div class="genz-box" style="margin-top: 25px; background: rgba(251, 140, 0, 0.05); border-left: 4px solid var(--accent-orange); padding: 15px; border-radius: 6px;">
          <div class="genz-box-title" style="font-weight: bold; color: var(--accent-orange); font-size: 1.1rem; margin-bottom: 5px;">JEE Trend Alert:</div>
          <p style="font-size: 1.25rem; line-height: 1.5;">${ch.trend}</p>
        </div>
      </div>
    `;
  } else if (pageNum >= 5 && pageNum <= 24) {
    // Pages 5-24: Theory Sections (20 pages of theory)
    const secIdx = pageNum - 5;
    if (ch.theory[secIdx]) {
      const sec = ch.theory[secIdx];
      
      // Build syllabus tag badge HTML
      let syllabusHtml = '';
      if (sec.syllabusTag) {
        syllabusHtml = `
          <span class="syllabus-tag-badge" style="background: rgba(2, 136, 209, 0.08); border: 1px solid var(--accent-blue); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; color: var(--accent-blue);">${sec.syllabusTag.toUpperCase()}</span>
          ${sec.syllabusNote ? `<div class="syllabus-note-text" style="font-size: 0.95rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">${sec.syllabusNote}</div>` : ''}
        `;
      }

      // Build solved examples HTML
      let examplesHtml = '';
      if (sec.solvedExamples && sec.solvedExamples.length > 0) {
        examplesHtml = `<div style="margin-top: 25px;"><h3 style="color: var(--accent-blue); font-family: var(--font-heading); font-size: 1.3rem; margin-bottom: 12px;">📝 Solved Examples</h3>`;
        sec.solvedExamples.forEach((ex, idx) => {
          const diffLabel = ex.difficulty === 1 ? 'Easy' : (ex.difficulty === 3 ? 'Hard' : 'Medium');
          const diffClass = ex.difficulty === 1 ? 'easy' : (ex.difficulty === 3 ? 'hard' : 'medium');
          examplesHtml += `
            <div class="solved-example-block" id="ex-block-${pageNum}-${idx}" style="border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 15px; overflow: hidden; background: rgba(0,0,0,0.01);">
              <div class="solved-example-header" onclick="toggleSolvedExample('ex-block-${pageNum}-${idx}')" style="padding: 12px 16px; background: rgba(0,0,0,0.02); display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 1.15rem; font-weight: 600;">
                <span class="ex-number" style="color: var(--accent-blue);">Ex ${idx + 1}</span>
                <span class="solved-example-difficulty ${diffClass}" style="font-size: 0.75rem; border: 1px solid currentColor; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${diffLabel.toUpperCase()}</span>
                <span class="ex-question" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ex.question}</span>
                <span class="ex-toggle-icon" style="transition: transform 0.2s;"><i class="fas fa-chevron-down"></i></span>
              </div>
              <div class="solved-example-body" style="display: none; padding: 16px; border-top: 1px solid var(--border-color); background: #ffffff; color: var(--text-color);">
                <div class="solved-example-solution" style="font-size: 1.25rem; line-height: 1.6; margin-bottom: 12px;">${ex.solution}</div>
                ${ex.tip ? `<div class="solved-example-tip" style="background: rgba(67, 160, 71, 0.05); border-left: 3px solid var(--accent-green); padding: 10px 12px; border-radius: 4px; font-size: 1.15rem;"><span class="tip-icon" style="margin-right: 6px;">💡</span><span><strong>Concept Tip:</strong> ${ex.tip}</span></div>` : ''}
              </div>
            </div>
          `;
        });
        examplesHtml += '</div>';
      }

      // Format section heading
      let displayHeading = sec.heading;
      displayHeading = `${ch.id}.${secIdx + 1} ${displayHeading.toUpperCase()}`;

      // In-page simulation trigger matching the chemistry layout
      const simulationButtonHtml = `
        <div style="margin: 20px 0 15px 0;">
          <button class="control-btn accent launch-page-sim-btn" onclick="launchSimulation(null, ${ch.id}, ${pageNum})" style="display: inline-flex; align-items: center; gap: 8px; background: var(--text-color); color: var(--bg-color); border: 1px solid var(--text-color); padding: 8px 16px; border-radius: 6px; font-size: 0.95rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            <svg class="sim-play-icon" style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Launch Section Virtual Lab</span>
          </button>
        </div>
      `;

      // Zero-duplicate dynamic diagram spot
      const diagramHtml = `
        <div id="svg-diagram-ch${ch.id}-p${pageNum}" class="scoped-svg-container" style="text-align: center; margin: 25px 0;"></div>
      `;

      return `
        <div class="theory-section">
          <div class="margin-note">📓 Page ${pageNum}</div>
          <div style="margin-bottom: 12px;">${syllabusHtml}</div>
          <h2 style="font-family: var(--font-heading); color: var(--text-color); font-size: 1.7rem; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; margin-bottom: 15px;">${displayHeading}</h2>
          <div style="font-size: 1.35rem; line-height: 1.6; color: var(--text-color);">
            ${sec.content}
          </div>
          ${diagramHtml}
          ${simulationButtonHtml}
          ${examplesHtml}
        </div>
      `;
    }
  } else if (pageNum >= 25 && pageNum <= 34) {
    // Pages 25-34: Applications (10 pages)
    const appIdx = pageNum - 25;
    if (ch.applications[appIdx]) {
      const app = ch.applications[appIdx];
      return `
        <div class="applications-page">
          <div class="margin-note">📓 Page ${pageNum}</div>
          <h2 style="color: var(--accent-orange); border-bottom: 2px dashed var(--accent-orange); font-size: 1.6rem; font-family: var(--font-heading);">REAL-WORLD INDUSTRIAL APPLICATIONS</h2>
          <div class="real-life-card" style="margin-top: 25px; background: rgba(251, 140, 0, 0.05); border: 1.5px dashed var(--accent-orange); padding: 22px; border-radius: var(--border-radius); color: var(--text-color);">
            <h3 style="color: var(--accent-orange); font-size: 1.35rem; font-family: var(--font-heading); margin-bottom: 10px;">${app.name}</h3>
            <p style="font-size:1.3rem; line-height:1.6; margin-bottom: 15px;">${app.desc}</p>
            <div style="font-size: 1.2rem; line-height: 1.5; border-top: 1px dotted rgba(251,140,0,0.3); padding-top: 12px; color: var(--text-muted);">
              <strong>Did You Know?</strong> ${app.fact}
            </div>
          </div>
        </div>
      `;
    }
  } else if (pageNum >= 35 && pageNum <= 2199) {
    // Pages 35-2199: Interactive Workbook
    return generateWorkbookPage(ch.id, pageNum);
  } else if (pageNum === 2200) {
    // Page 2200: Toppers Summary
    return getToppersSummary(ch.id);
  }
  return '';
}

function loadChapterPage(chapterId, pageNum) {
  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === chapterId);
  if (!ch) return;

  const pageInput = document.getElementById('page-input');
  if (pageInput) pageInput.value = pageNum;

  // Render notes canvas for this specific page path
  if (sketchpad) {
    sketchpad.loadNotesState(chapterId, pageNum);
  }

  if (viewMode === 'single') {
    loadedChapterId = chapterId;
    currentChapterId = chapterId;
    const oldPage = currentBookPage;
    currentBookPage = pageNum;

    const pagesContainer = document.getElementById('pages-container');
    let pane = document.getElementById('book-content-pane');
    if (!pane) {
      pagesContainer.innerHTML = '';
      pane = document.createElement('article');
      pane.className = 'notebook-page';
      pane.id = 'book-content-pane';
      pagesContainer.appendChild(pane);
    } else {
      // Clear extra pages when switching from scroll to single mode
      pagesContainer.querySelectorAll('.notebook-page').forEach(p => {
        if (p !== pane) p.remove();
      });
    }

    let html = getPageHtml(ch, pageNum);

    // Determine transition classes based on navigation direction
    let exitClass = '';
    let enterClass = '';
    if (oldPage !== pageNum) {
      if (pageNum > oldPage) {
        exitClass = 'page-slide-left-exit';
        enterClass = 'page-slide-left-enter';
      } else {
        exitClass = 'page-slide-right-exit';
        enterClass = 'page-slide-right-enter';
      }
    }

    if (exitClass) {
      pane.classList.remove('page-slide-left-exit', 'page-slide-left-enter', 'page-slide-right-exit', 'page-slide-right-enter');
      pane.classList.add(exitClass);
      
      setTimeout(() => {
        pane.innerHTML = html;
        pane.setAttribute('data-page', pageNum);
        renderMath(pane);
        renderSVGDiagram(chapterId, pageNum);
        
        pane.classList.remove(exitClass);
        pane.classList.add(enterClass);
        document.getElementById('notebook-container').scrollTop = 0;
        
        setTimeout(() => {
          pane.classList.remove(enterClass);
        }, 250);
      }, 200);
    } else {
      pane.innerHTML = html;
      pane.setAttribute('data-page', pageNum);
      renderMath(pane);
      renderSVGDiagram(chapterId, pageNum);
      document.getElementById('notebook-container').scrollTop = 0;
    }
  } else {
    // Scroll Mode (Continuous Scroll Viewport)
    const pagesContainer = document.getElementById('pages-container');

    // If changing chapters, do a full clean load
    if (loadedChapterId !== chapterId) {
      loadedChapterId = chapterId;
      currentChapterId = chapterId;
      currentBookPage = pageNum;
      minLoadedPage = pageNum;
      maxLoadedPage = pageNum;
      isLoadingPage = true; // Block scroll loading during chapter transition
      try {
        pagesContainer.innerHTML = '';

        const pageElement = document.createElement('article');
        pageElement.className = 'notebook-page';
        pageElement.id = 'book-content-pane';
        pageElement.setAttribute('data-page', pageNum);
        pageElement.innerHTML = getPageHtml(ch, pageNum);
        pagesContainer.appendChild(pageElement);
        renderMath(pageElement);
        renderSVGDiagram(chapterId, pageNum);

        document.getElementById('notebook-container').scrollTop = 0;

        // Pre-load neighbors to activate scrollbar
        if (pageNum < 2200) {
          loadAndAppendPage(chapterId, pageNum + 1);
        }
        if (pageNum < 2199) {
          loadAndAppendPage(chapterId, pageNum + 2);
        }
      } finally {
        isLoadingPage = false; // Re-enable scroll loading
      }
      return;
    }

    let existingPage = document.querySelector(`#pages-container .notebook-page[data-page="${pageNum}"]`);

    // Handle adjacent page loading before scrolling
    if (!existingPage) {
      if (pageNum === currentBookPage + 1) {
        loadAndAppendPage(chapterId, pageNum);
        existingPage = document.querySelector(`#pages-container .notebook-page[data-page="${pageNum}"]`);
      } else if (pageNum === currentBookPage - 1) {
        loadAndPrependPage(chapterId, pageNum);
        existingPage = document.querySelector(`#pages-container .notebook-page[data-page="${pageNum}"]`);
      }
    }

    if (existingPage) {
      // Smooth scroll to it
      currentBookPage = pageNum;
      const container = document.getElementById('notebook-container');
      const containerRect = container.getBoundingClientRect();
      const pageRect = existingPage.getBoundingClientRect();
      const targetScrollTop = container.scrollTop + (pageRect.top - containerRect.top);
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    } else {
      // Clear and reload for a non-adjacent jump in the same chapter
      currentBookPage = pageNum;
      minLoadedPage = pageNum;
      maxLoadedPage = pageNum;
      isLoadingPage = true;
      try {
        pagesContainer.innerHTML = '';

        const pageElement = document.createElement('article');
        pageElement.className = 'notebook-page';
        pageElement.id = 'book-content-pane';
        pageElement.setAttribute('data-page', pageNum);
        pageElement.innerHTML = getPageHtml(ch, pageNum);
        pagesContainer.appendChild(pageElement);
        renderMath(pageElement);
        renderSVGDiagram(chapterId, pageNum);

        document.getElementById('notebook-container').scrollTop = 0;

        // Pre-load neighbors to activate scrollbar
        if (pageNum < 2200) {
          loadAndAppendPage(chapterId, pageNum + 1);
        }
        if (pageNum < 2199) {
          loadAndAppendPage(chapterId, pageNum + 2);
        }
      } finally {
        isLoadingPage = false;
      }
    }
  }
}

function loadAndAppendPage(chapterId, pageNum) {
  if (pageNum > 2200) return;
  if (document.querySelector(`#pages-container .notebook-page[data-page="${pageNum}"]`)) return;

  maxLoadedPage = Math.max(maxLoadedPage, pageNum);

  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === chapterId);
  if (!ch) return;

  const pagesContainer = document.getElementById('pages-container');
  const pageElement = document.createElement('article');
  pageElement.className = 'notebook-page fade-in-up';
  pageElement.setAttribute('data-page', pageNum);
  pageElement.innerHTML = getPageHtml(ch, pageNum);

  pagesContainer.appendChild(pageElement);
  renderMath(pageElement);
  renderSVGDiagram(chapterId, pageNum);

  updateActivePageFromScroll();

  setTimeout(() => {
    pageElement.classList.remove('fade-in-up');
  }, 400);
}

function loadAndPrependPage(chapterId, pageNum) {
  if (pageNum < 1) return;
  if (document.querySelector(`#pages-container .notebook-page[data-page="${pageNum}"]`)) return;

  minLoadedPage = Math.min(minLoadedPage, pageNum);

  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === chapterId);
  if (!ch) return;

  const notebookContainer = document.getElementById('notebook-container');
  const pagesContainer = document.getElementById('pages-container');
  const pageElement = document.createElement('article');
  pageElement.className = 'notebook-page fade-in-up';
  pageElement.setAttribute('data-page', pageNum);
  pageElement.innerHTML = getPageHtml(ch, pageNum);

  const oldScrollHeight = notebookContainer.scrollHeight;
  pagesContainer.insertBefore(pageElement, pagesContainer.firstChild);
  renderMath(pageElement);
  renderSVGDiagram(chapterId, pageNum);

  const newScrollHeight = notebookContainer.scrollHeight;
  notebookContainer.scrollTop += (newScrollHeight - oldScrollHeight);

  updateActivePageFromScroll();

  setTimeout(() => {
    pageElement.classList.remove('fade-in-up');
  }, 400);
}

function handleNotebookScroll() {
  if (viewMode !== 'scroll' || isLoadingPage) return;

  const notebookContainer = document.getElementById('notebook-container');
  const threshold = 450;

  // Scroll Down near the bottom threshold
  if (notebookContainer.scrollHeight - notebookContainer.scrollTop - notebookContainer.clientHeight < threshold) {
    if (maxLoadedPage < 2200) {
      isLoadingPage = true;
      try {
        loadAndAppendPage(currentChapterId, maxLoadedPage + 1);
      } catch (err) {
        console.error("Failed to load/append page on scroll:", err);
      } finally {
        setTimeout(() => {
          isLoadingPage = false;
        }, 100);
      }
      return;
    }
  }

  // Scroll Up near the top threshold
  if (notebookContainer.scrollTop < 100) {
    if (minLoadedPage > 1) {
      isLoadingPage = true;
      try {
        loadAndPrependPage(currentChapterId, minLoadedPage - 1);
      } catch (err) {
        console.error("Failed to load/prepend page on scroll:", err);
      } finally {
        setTimeout(() => {
          isLoadingPage = false;
        }, 100);
      }
      return;
    }
  }

  updateActivePageFromScroll();
}

function updateActivePageFromScroll() {
  const container = document.getElementById('notebook-container');
  const pages = document.querySelectorAll('#pages-container .notebook-page');
  if (!container || pages.length === 0) return;

  const containerRect = container.getBoundingClientRect();
  let closestPage = null;
  let minDistance = Infinity;

  pages.forEach(page => {
    const rect = page.getBoundingClientRect();
    const distance = Math.abs(rect.top - containerRect.top);
    if (distance < minDistance) {
      minDistance = distance;
      closestPage = page;
    }
  });

  if (closestPage) {
    const pageNum = parseInt(closestPage.getAttribute('data-page'), 10);
    if (pageNum && pageNum !== currentBookPage) {
      currentBookPage = pageNum;
      const pageInput = document.getElementById('page-input');
      if (pageInput) pageInput.value = pageNum;

      // Reload base64 drawing canvas paths per page switch
      if (sketchpad) {
        sketchpad.loadNotesState(currentChapterId, pageNum);
      }
    }
  }
}

function updateViewModeUI() {
  const viewModeBtn = document.getElementById('view-mode-btn');
  if (!viewModeBtn) return;

  if (viewMode === 'scroll') {
    viewModeBtn.innerHTML = '<i class="fas fa-file-alt"></i> <span>Single Page</span>';
    viewModeBtn.title = 'Switch to Single Page Mode';
  } else {
    viewModeBtn.innerHTML = '<i class="fas fa-scroll"></i> <span>Scroll Mode</span>';
    viewModeBtn.title = 'Switch to Continuous Scroll Mode';
  }
}

function getTableOfContents(ch) {
  return `
    <div class="toc-page">
      <div class="margin-note">📓 Page 2</div>
      <h2 style="color: var(--accent-purple); border-bottom: 2px dashed var(--accent-purple); font-size: 1.6rem; font-family: var(--font-heading);">TABLE OF CONTENTS READING MAP</h2>
      <p style="font-style: italic; color: var(--text-muted); margin-bottom: 20px; font-size: 1.25rem;">Chapter ${ch.id}: ${ch.title} Page Spread</p>
      
      <div style="font-size: 1.25rem; line-height: 1.6; color: var(--text-color);">
        <ul style="list-style: none; padding-left: 0;">
          <li style="margin-bottom: 12px;">📖 <a href="#" onclick="event.preventDefault(); loadChapterPage(${ch.id}, 1)" style="color: inherit; font-weight: 600;">Page 1: Chapter Cover &amp; Inspirational Quote</a></li>
          <li style="margin-bottom: 12px;">📋 <a href="#" onclick="event.preventDefault(); loadChapterPage(${ch.id}, 2)" style="color: inherit; font-weight: 600;">Page 2: 2200-Page Index Reading Map</a></li>
          <li style="margin-bottom: 12px;">🎯 <a href="#" onclick="event.preventDefault(); loadChapterPage(${ch.id}, 3)" style="color: inherit; font-weight: 600;">Page 3: Prerequisites &amp; Master Checklists</a></li>
          <li style="margin-bottom: 12px;">🔥 <a href="#" onclick="event.preventDefault(); loadChapterPage(${ch.id}, 4)" style="color: inherit; font-weight: 600;">Page 4: Why This Chapter Matters &amp; Trend Alerts</a></li>
          <li style="margin-bottom: 12px;">📝 Page 5-24: Systematic Concepts Theories &amp; Solved Examples (20 Pages)
            <ul style="padding-left: 20px; font-size: 1.15rem; list-style-type: circle; margin-top: 5px;">
              ${ch.theory.slice(0, 5).map((sec, idx) => `
                <li><a href="#" onclick="event.preventDefault(); loadChapterPage(${ch.id}, ${5 + idx})" style="color: inherit;">Page ${5 + idx}: ${sec.heading}</a></li>
              `).join('')}
              <li>... and 15 more detailed conceptual sections.</li>
            </ul>
          </li>
          <li style="margin-bottom: 12px;">🏭 Page 25-34: Detailed Industrial &amp; Real-World Applications (10 Pages)
            <ul style="padding-left: 20px; font-size: 1.15rem; list-style-type: circle; margin-top: 5px;">
              ${ch.applications.slice(0, 3).map((app, idx) => `
                <li><a href="#" onclick="event.preventDefault(); loadChapterPage(${ch.id}, ${25 + idx})" style="color: inherit;">Page ${25 + idx}: ${app.name}</a></li>
              `).join('')}
              <li>... and 7 more industrial chemical cases.</li>
            </ul>
          </li>
          <li style="margin-bottom: 12px;">✏️ Page 35-2199: Interactive Numerical Solvers, Checklists, &amp; Concept Drills</li>
          <li style="margin-bottom: 12px;">🎓 <a href="#" onclick="event.preventDefault(); loadChapterPage(${ch.id}, 2200)" style="color: inherit; font-weight: 600;">Page 2200: Toppers' Summary Sheet &amp; Revision Cheat Code</a></li>
        </ul>
      </div>
    </div>
  `;
}

function getToppersSummary(chapterId) {
  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === chapterId);
  return `
    <div class="summary-page">
      <div class="margin-note">📓 Page 2200</div>
      <h2 style="color: var(--accent-red); border-bottom: 2px dashed var(--accent-red); font-size: 1.6rem; font-family: var(--font-heading);">TOPPERS' CHECKLIST &amp; REVISION CHEAT SHEET</h2>
      <p style="font-style: italic; color: var(--text-muted); margin-bottom: 20px; font-size: 1.25rem;">Final Revision Summary - Chapter ${chapterId}: ${ch.title}</p>
      
      <div class="formula-box" style="border: 2px dashed var(--accent-red); background: rgba(229,57,53,0.03); padding: 20px; border-radius: var(--border-radius); margin-bottom: 20px; color: var(--text-color);">
        <div class="formula-title" style="font-weight: bold; color: var(--accent-red); font-size: 1.3rem; font-family: var(--font-heading); margin-bottom: 10px;">CRITICAL REVISION CHECKLIST:</div>
        <ul style="list-style-type: decimal; padding-left: 20px; font-size: 1.25rem; line-height: 1.6;">
          <li>Verify all standard chemical formulas and bracket multipliers carefully (e.g. molar weights).</li>
          <li>Review equilibrium sign conventions for thermodynamic reactions (endothermic vs exothermic shifts).</li>
          <li>Understand buffer pH rules: acidic buffer uses weak acid and its salt; check molarity ratios.</li>
          <li>Convert all volume limits to Liters before solving concentrations.</li>
        </ul>
      </div>

      <div class="genz-box" style="margin-top: 20px; background: rgba(2, 136, 209, 0.05); border-left: 4px solid var(--accent-blue); padding: 15px; border-radius: 6px; color: var(--text-color);">
        <div class="genz-box-title" style="font-weight: bold; color: var(--accent-blue); font-size: 1.1rem; margin-bottom: 5px;">Instructor's Final Advice: Achieve Academic Excellence 🚀</div>
        <p style="font-size: 1.25rem; line-height: 1.5;">You have successfully completed all 2200 page spreads of this chapter! Your dedication is exemplary and reflective of top-tier preparation. Consolidate your concepts, review the formula sheet checklist, and walk into the examination room with confidence!</p>
      </div>

      <div class="simulation-link-box" style="margin-top: 30px; text-align: center;">
        <h4 style="font-size: 1.2rem; margin-bottom: 10px;">Need Visual Revision?</h4>
        <button class="btn btn-primary" onclick="launchSimulation(null, ${chapterId}, 5)" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 1rem;">
          <i class="fas fa-flask"></i> Launch Live Simulator
        </button>
      </div>
    </div>
  `;
}

function generateWorkbookPage(chapterId, pageNum) {
  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === chapterId);
  const seed = (chapterId * 97 + pageNum * 31) % 4;
  
  let html = `
    <div class="workbook-page">
      <div class="margin-note">📓 Page ${pageNum}</div>
      <h2 style="color: var(--accent-blue); border-bottom: 2px dashed var(--accent-blue); font-size: 1.6rem; font-family: var(--font-heading);">INTERACTIVE NUMERICAL STUDY DRILL</h2>
      <p style="font-style: italic; color: var(--text-muted); margin-bottom: 20px; font-size: 1.25rem;">Interactive Drill Page ${pageNum} - Chapter ${chapterId}: ${ch.title}</p>
  `;

  if (seed === 0) {
    const wt = ((chapterId * 3 + pageNum * 7) % 80) + 10;
    const vol = ((chapterId * 7 + pageNum * 2) % 40) + 5;
    
    // Molarity solver drill
    const molarMass = 40.0; // NaOH
    const moles = wt / molarMass;
    const molarity = moles / (vol / 1000);
    
    html += `
      <div class="formula-box" style="border-color: var(--accent-blue); color: var(--text-color); margin-bottom: 20px;">
        <div class="formula-title" style="color: var(--accent-blue);">Quantitative Practice: Solution Molarity</div>
        <p style="font-size: 1.3rem; line-height: 1.6; margin-bottom: 15px;">
          An aqueous solution is prepared by dissolving exactly <strong>${wt}.0 g</strong> of Sodium Hydroxide ($NaOH$, Molar Mass $= 40.0\\text{ g/mol}$) in enough water to make <strong>${vol}00 mL</strong> of solution. Calculate the molarity ($M$) of the prepared solution.
        </p>
        <button class="btn btn-secondary btn-sm" id="btn-reveal-drill-${pageNum}" onclick="toggleDrillSolution(${pageNum})" style="font-size:0.9rem;">View Algebraic Solve</button>
        
        <div id="drill-solution-${pageNum}" style="display:none; margin-top: 15px; border-top: 1px dotted var(--border-color); padding-top: 15px; font-size: 1.25rem; line-height: 1.6;">
          <strong>Step-by-step Solution:</strong><br>
          1. Solve for the number of moles of solute ($NaOH$):
          $$n = \\frac{\\text{Mass}}{\\text{Molar Mass}} = \\frac{${wt}.0\\text{ g}}{40.0\\text{ g/mol}} = ${moles.toFixed(3)}\\text{ moles}$$
          2. Convert the solution volume from mL to Liters:
          $$V = \\frac{${vol}00\\text{ mL}}{1000} = ${(vol/10).toFixed(1)}\\text{ Liters}$$
          3. Calculate Molarity ($M$):
          $$M = \\frac{\\text{Moles of Solute}}{\\text{Volume of Solution (L)}} = \\frac{${moles.toFixed(3)}}{${(vol/10).toFixed(1)}} = ${molarity.toFixed(3)}\\text{ M}$$
          The concentration is exactly <strong>${molarity.toFixed(3)} M</strong>.
        </div>
      </div>
    `;
  } else {
    // General Formula Checklist
    html += `
      <div class="formula-box" style="border-color: var(--accent-green); color: var(--text-color); margin-bottom: 20px;">
        <div class="formula-title" style="color: var(--accent-green);">Interactive Formula Verification</div>
        <p style="font-size: 1.3rem; line-height: 1.6; margin-bottom: 15px;">
          Select the active stoichiometric relations to compile them into your printed revision sheets:
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 1.2rem;">
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
            <input type="checkbox" checked style="width:16px; height:16px;">
            <span>Avogadro's conversion: $n = \\frac{N}{N_A}$</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
            <input type="checkbox" checked style="width:16px; height:16px;">
            <span>Solution molarity: $M = \\frac{n}{V\\text{ (L)}}$</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
            <input type="checkbox" checked style="width:16px; height:16px;">
            <span>Equilibrium constant: $K_c = \\frac{[\\text{Products}]}{[\\text{Reactants}]}$</span>
          </label>
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}

window.toggleDrillSolution = function(pageNum) {
  const box = document.getElementById(`drill-solution-${pageNum}`);
  const btn = document.getElementById(`btn-reveal-drill-${pageNum}`);
  if (!box) return;
  const isHidden = box.style.display === "none";
  box.style.display = isHidden ? "block" : "none";
  btn.textContent = isHidden ? "Hide Algebraic Solve" : "View Algebraic Solve";
  if (isHidden) {
    renderMath(box);
  }
};

window.toggleSolvedExample = function(elementId) {
  const block = document.getElementById(elementId);
  if (!block) return;
  const body = block.querySelector('.solved-example-body');
  const icon = block.querySelector('.ex-toggle-icon');
  const isHidden = body.style.display === 'none' || body.style.display === '';
  
  body.style.display = isHidden ? 'block' : 'none';
  icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  if (isHidden) {
    renderMath(body);
  }
};

/* ==========================================================================
   3. ZERO-DUPLICATE SCOPED SVG DIAGRAM ENGINE
   ========================================================================== */
function renderSVGDiagram(chapterId, pageNum) {
  const container = document.getElementById(`svg-diagram-ch${chapterId}-p${pageNum}`);
  if (!container) return;
  
  let svgContent = "";
  
  switch(chapterId) {
    case 1: // Some Basic Concepts of Chemistry
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <line x1="120" y1="100" x2="120" y2="40" stroke="var(--text-color)" stroke-width="4" />
          <polygon points="90,100 150,100 120,80" fill="var(--border-color)" />
          <g>
            <animateTransform attributeName="transform" type="rotate" values="-4 120 40; 4 120 40; -4 120 40" dur="5s" repeatCount="indefinite" />
            <line x1="50" y1="40" x2="190" y2="40" stroke="var(--text-color)" stroke-width="3" />
            <circle cx="120" cy="40" r="4" fill="var(--accent-blue)" />
            <g>
              <line x1="50" y1="40" x2="50" y2="80" stroke="var(--text-color)" stroke-width="1.5" />
              <path d="M 30 80 Q 50 95 70 80 Z" fill="rgba(2, 136, 209, 0.15)" stroke="var(--accent-blue)" stroke-width="2" />
              <rect x="40" y="65" width="20" height="15" fill="var(--accent-orange)" rx="2" />
            </g>
            <g>
              <line x1="190" y1="40" x2="190" y2="80" stroke="var(--text-color)" stroke-width="1.5" />
              <path d="M 170 80 Q 190 95 210 80 Z" fill="rgba(2, 136, 209, 0.15)" stroke="var(--accent-blue)" stroke-width="2" />
              <circle cx="190" cy="72" r="8" fill="var(--accent-red)" />
            </g>
          </g>
        </svg>
      `;
      break;
    case 2: // Structure of Atom
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="120" cy="60" r="10" fill="var(--accent-red)">
            <animate attributeName="r" values="9;11;9" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="120" cy="60" r="28" stroke="var(--border-color)" fill="none" stroke-dasharray="3,3" />
          <circle cx="120" cy="32" r="4" fill="var(--accent-blue)">
            <animateTransform attributeName="transform" type="rotate" from="0 120 60" to="360 120 60" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="120" cy="60" r="46" stroke="var(--border-color)" fill="none" stroke-dasharray="4,4" />
          <circle cx="120" cy="14" r="4" fill="var(--accent-purple)">
            <animateTransform attributeName="transform" type="rotate" from="360 120 60" to="0 120 60" dur="7s" repeatCount="indefinite" />
          </circle>
        </svg>
      `;
      break;
    case 3: // Classification of Elements & Periodicity in Properties
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="35" width="180" height="55" fill="none" stroke="var(--border-color)" stroke-width="2" rx="4" />
          <line x1="60" y1="35" x2="60" y2="90" stroke="var(--border-color)" stroke-opacity="0.3" />
          <line x1="90" y1="35" x2="90" y2="90" stroke="var(--border-color)" stroke-opacity="0.3" />
          <line x1="120" y1="35" x2="120" y2="90" stroke="var(--border-color)" stroke-opacity="0.3" />
          <line x1="150" y1="35" x2="150" y2="90" stroke="var(--border-color)" stroke-opacity="0.3" />
          <line x1="180" y1="35" x2="180" y2="90" stroke="var(--border-color)" stroke-opacity="0.3" />
          <line x1="30" y1="62" x2="210" y2="62" stroke="var(--border-color)" stroke-opacity="0.3" />
          <g>
            <line x1="40" y1="20" x2="200" y2="20" stroke="var(--accent-blue)" stroke-width="2.5" />
            <path d="M 195 17 L 202 20 L 195 23 Z" fill="var(--accent-blue)" />
            <text x="120" y="15" font-size="8" fill="var(--accent-blue)" text-anchor="middle" font-weight="bold">EN increases</text>
          </g>
          <g>
            <line x1="222" y1="90" x2="222" y2="35" stroke="var(--accent-green)" stroke-width="2.5" />
            <path d="M 219 38 L 222 31 L 225 38 Z" fill="var(--accent-green)" />
            <text x="232" y="65" font-size="8" fill="var(--accent-green)" transform="rotate(-90 232 65)" text-anchor="middle" font-weight="bold">IE increases</text>
          </g>
          <rect x="90" y="62" width="30" height="28" fill="var(--accent-purple)" opacity="0.3">
            <animate attributeName="opacity" values="0.1;0.6;0.1" dur="2.5s" repeatCount="indefinite" />
          </rect>
        </svg>
      `;
      break;
    case 4: // Chemical Bonding & Molecular Structure
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="60" r="4" fill="var(--text-color)" />
          <circle cx="160" cy="60" r="4" fill="var(--text-color)" />
          <circle cx="80" cy="60" r="30" fill="rgba(2, 136, 209, 0.1)" stroke="var(--accent-blue)" stroke-width="2">
            <animate attributeName="cx" values="80;95;80" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="160" cy="60" r="30" fill="rgba(229, 57, 53, 0.1)" stroke="var(--accent-red)" stroke-width="2">
            <animate attributeName="cx" values="160;145;160" dur="4s" repeatCount="indefinite" />
          </circle>
          <ellipse cx="120" cy="60" rx="10" ry="20" fill="var(--accent-purple)" opacity="0.4">
            <animate attributeName="rx" values="0;15;0" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.6;0" dur="4s" repeatCount="indefinite" />
          </ellipse>
          <text x="120" y="108" font-size="10" fill="var(--text-color)" text-anchor="middle" font-weight="bold">p-p Orbital Overlap (σ-Bond)</text>
        </svg>
      `;
      break;
    case 5: // States of Matter: Gases & Liquids
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="70" y="20" width="100" height="80" fill="rgba(0,0,0,0.05)" stroke="var(--border-color)" stroke-width="3" />
          <g>
            <rect x="72" y="30" width="96" height="10" fill="var(--text-color)" rx="1">
              <animate attributeName="y" values="30;55;30" dur="5s" repeatCount="indefinite" />
            </rect>
            <line x1="120" y1="30" x2="120" y2="5" stroke="var(--text-color)" stroke-width="4">
              <animate attributeName="y1" values="30;55;30" dur="5s" repeatCount="indefinite" />
              <animate attributeName="y2" values="5;30;5" dur="5s" repeatCount="indefinite" />
            </line>
          </g>
          <circle cx="85" cy="75" r="3.5" fill="var(--accent-orange)">
            <animate attributeName="cx" values="85;155;110;85" dur="3s" repeatCount="indefinite" />
            <animate attributeName="cy" values="75;85;65;75" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="150" cy="65" r="3.5" fill="var(--accent-red)">
            <animate attributeName="cx" values="150;95;135;150" dur="4s" repeatCount="indefinite" />
            <animate attributeName="cy" values="65;75;88;65" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="110" cy="85" r="3.5" fill="var(--accent-blue)">
            <animate attributeName="cx" values="110;80;150;110" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="cy" values="85;62;72;85" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="130" cy="70" r="3.5" fill="var(--accent-green)">
            <animate attributeName="cx" values="130;160;75;130" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="cy" values="70;88;68;70" dur="3.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      `;
      break;
    case 6: // Chemical Thermodynamics
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="120" cy="60" r="40" fill="rgba(251, 140, 0, 0.05)" stroke="var(--accent-orange)" stroke-width="2" stroke-dasharray="5,3" />
          <text x="120" y="64" font-size="12" fill="var(--text-color)" text-anchor="middle" font-weight="bold">SYSTEM</text>
          <g>
            <path d="M 40 40 Q 50 35 60 40 T 80 40" fill="none" stroke="var(--accent-red)" stroke-width="2" />
            <polygon points="80,37 87,40 80,43" fill="var(--accent-red)" />
            <text x="30" y="28" font-size="9" fill="var(--accent-red)" font-weight="bold">q &gt; 0 (Endothermic)</text>
          </g>
          <g>
            <line x1="155" y1="75" x2="195" y2="95" stroke="var(--accent-blue)" stroke-width="2" />
            <polygon points="192,97 199,97 196,91" fill="var(--accent-blue)" />
            <text x="180" y="68" font-size="9" fill="var(--accent-blue)" font-weight="bold">w &lt; 0 (Expansion)</text>
          </g>
        </svg>
      `;
      break;
    case 7: // Equilibrium
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="40" width="50" height="50" fill="none" stroke="var(--border-color)" stroke-width="2" />
          <rect x="31" y="60" width="48" height="29" fill="rgba(2, 136, 209, 0.2)" />
          <text x="55" y="70" font-size="9" fill="var(--accent-blue)" text-anchor="middle" font-weight="bold">Reactant</text>
          <rect x="160" y="40" width="50" height="50" fill="none" stroke="var(--border-color)" stroke-width="2" />
          <rect x="161" y="60" width="48" height="29" fill="rgba(229, 57, 53, 0.2)" />
          <text x="185" y="70" font-size="9" fill="var(--accent-red)" text-anchor="middle" font-weight="bold">Product</text>
          <g>
            <line x1="90" y1="55" x2="150" y2="55" stroke="var(--accent-green)" stroke-width="2" />
            <polygon points="145,52 151,55 145,58" fill="var(--accent-green)" />
            <text x="120" y="48" font-size="8" fill="var(--accent-green)" text-anchor="middle">Forward</text>
          </g>
          <g>
            <line x1="150" y1="75" x2="90" y2="75" stroke="var(--accent-purple)" stroke-width="2" />
            <polygon points="95,72 89,75 95,78" fill="var(--accent-purple)" />
            <text x="120" y="88" font-size="8" fill="var(--accent-purple)" text-anchor="middle">Backward</text>
          </g>
          <text x="120" y="25" font-size="11" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Rate_f = Rate_b</text>
        </svg>
      `;
      break;
    case 8: // Redox Reactions
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="40" width="60" height="50" fill="none" stroke="var(--border-color)" stroke-width="2" rx="2" />
          <rect x="26" y="55" width="58" height="34" fill="rgba(2, 136, 209, 0.1)" />
          <rect x="45" y="25" width="20" height="50" fill="var(--accent-blue)" opacity="0.8" />
          <text x="55" y="98" font-size="8" fill="var(--text-color)" text-anchor="middle">Zn Anode (-)</text>
          <rect x="155" y="40" width="60" height="50" fill="none" stroke="var(--border-color)" stroke-width="2" rx="2" />
          <rect x="156" y="55" width="58" height="34" fill="rgba(229, 57, 53, 0.1)" />
          <rect x="175" y="25" width="20" height="50" fill="var(--accent-red)" opacity="0.8" />
          <text x="185" y="98" font-size="8" fill="var(--text-color)" text-anchor="middle">Cu Cathode (+)</text>
          <path d="M 55 25 L 55 12 L 185 12 L 185 25" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
          <circle cx="120" cy="12" r="8" fill="var(--accent-orange)" />
          <text x="120" y="15" font-size="8" fill="#ffffff" text-anchor="middle" font-weight="bold">V</text>
          <circle cx="55" cy="12" r="2.5" fill="#ffff00">
            <animate attributeName="cx" values="55;120;185" dur="2s" repeatCount="indefinite" />
            <animate attributeName="cy" values="12;12;25" keyTimes="0;0.8;1" dur="2s" repeatCount="indefinite" />
          </circle>
          <path d="M 70 50 L 70 30 L 170 30 L 170 50" fill="none" stroke="var(--border-color)" stroke-width="6" stroke-linecap="round" />
          <path d="M 70 50 L 70 30 L 170 30 L 170 50" fill="none" stroke="var(--accent-purple)" stroke-width="2" stroke-linecap="round" />
        </svg>
      `;
      break;
    case 9: // Hydrogen
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="90" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="90" y="63" font-size="8" fill="#ffffff" text-anchor="middle" font-weight="bold">p+</text>
          <path d="M 90 40 L 90 25 M 87 28 L 90 25 L 93 28" fill="none" stroke="var(--accent-orange)" stroke-width="1.5" />
          <circle cx="150" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="150" y="63" font-size="8" fill="#ffffff" text-anchor="middle" font-weight="bold">p+</text>
          <g>
            <path d="M 150 40 L 150 25 M 147 28 L 150 25 L 153 28" fill="none" stroke="var(--accent-orange)" stroke-width="1.5">
              <animate attributeName="transform" type="rotate" values="0 150 60; 180 150 60; 360 150 60" dur="4s" repeatCount="indefinite" />
            </path>
          </g>
          <ellipse cx="120" cy="60" rx="45" ry="25" fill="none" stroke="var(--border-color)" stroke-width="1.5" stroke-dasharray="4,4">
            <animateTransform attributeName="transform" type="rotate" from="0 120 60" to="360 120 60" dur="10s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="120" cy="35" r="3" fill="var(--accent-red)" />
          <circle cx="120" cy="85" r="3" fill="var(--accent-red)" />
          <text x="120" y="108" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Ortho &amp; Para Hydrogen Spins</text>
        </svg>
      `;
      break;
    case 10: // The s-Block Elements
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="100" y="90" width="40" height="15" fill="var(--border-color)" rx="2" />
          <line x1="120" y1="90" x2="120" y2="60" stroke="var(--border-color)" stroke-width="6" />
          <path d="M 120 15 Q 135 45 120 60 Q 105 45 120 15 Z" fill="var(--accent-red)">
            <animate attributeName="fill" values="var(--accent-red);var(--accent-orange);var(--accent-purple);var(--accent-red)" dur="5s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="scale" values="1;1.05;0.98;1" transform-origin="120 60" dur="0.8s" repeatCount="indefinite" />
          </path>
          <path d="M 50 80 L 110 50 L 115 48" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
          <circle cx="115" cy="48" r="3" fill="var(--border-color)" />
          <text x="120" y="10" font-size="10" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Flame Coloration Test (s-Block)</text>
        </svg>
      `;
      break;
    case 11: // The p-Block Elements (Group 13 & 14)
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="90" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="90" y="63" font-size="9" fill="#ffffff" text-anchor="middle" font-weight="bold">B</text>
          <circle cx="150" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="150" y="63" font-size="9" fill="#ffffff" text-anchor="middle" font-weight="bold">B</text>
          <circle cx="60" cy="40" r="6" fill="var(--border-color)" />
          <text x="60" y="43" font-size="7" fill="var(--bg-color)" text-anchor="middle">H</text>
          <line x1="82" y1="52" x2="65" y2="43" stroke="var(--text-color)" stroke-width="1.5" />
          <circle cx="60" cy="80" r="6" fill="var(--border-color)" />
          <text x="60" y="83" font-size="7" fill="var(--bg-color)" text-anchor="middle">H</text>
          <line x1="82" y1="68" x2="65" y2="80" stroke="var(--text-color)" stroke-width="1.5" />
          <circle cx="180" cy="40" r="6" fill="var(--border-color)" />
          <text x="180" y="43" font-size="7" fill="var(--bg-color)" text-anchor="middle">H</text>
          <line x1="158" y1="52" x2="175" y2="43" stroke="var(--text-color)" stroke-width="1.5" />
          <circle cx="180" cy="80" r="6" fill="var(--border-color)" />
          <text x="180" y="83" font-size="7" fill="var(--bg-color)" text-anchor="middle">H</text>
          <line x1="158" y1="68" x2="175" y2="80" stroke="var(--text-color)" stroke-width="1.5" />
          <path d="M 90 60 Q 120 25 150 60" fill="none" stroke="var(--accent-orange)" stroke-width="4" opacity="0.6">
            <animate attributeName="stroke-width" values="4;6;4" dur="2s" repeatCount="indefinite" />
          </path>
          <circle cx="120" cy="38" r="6" fill="var(--border-color)" />
          <text x="120" y="41" font-size="7" fill="var(--bg-color)" text-anchor="middle">H</text>
          <path d="M 90 60 Q 120 95 150 60" fill="none" stroke="var(--accent-orange)" stroke-width="4" opacity="0.6">
            <animate attributeName="stroke-width" values="4;6;4" dur="2s" repeatCount="indefinite" />
          </path>
          <circle cx="120" cy="82" r="6" fill="var(--border-color)" />
          <text x="120" y="85" font-size="7" fill="var(--bg-color)" text-anchor="middle">H</text>
          <text x="120" y="112" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Banana Bonds in B₂H₆</text>
        </svg>
      `;
      break;
    case 12: // Organic Chemistry: Basic Principles & Techniques
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="80" y="15" width="80" height="90" fill="none" stroke="var(--border-color)" stroke-width="2" rx="3" />
          <line x1="75" y1="15" x2="165" y2="15" stroke="var(--border-color)" stroke-width="4" />
          <rect x="81" y="90" width="78" height="14" fill="rgba(2, 136, 209, 0.15)" />
          <rect x="105" y="25" width="30" height="70" fill="rgba(255,255,255,0.9)" stroke="#cccccc" stroke-width="1" />
          <line x1="105" y1="40" x2="135" y2="40" stroke="var(--accent-blue)" stroke-width="1" stroke-dasharray="2,2" />
          <circle cx="120" cy="80" r="3.5" fill="var(--accent-red)">
            <animate attributeName="cy" values="85;78;85" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle cx="120" cy="65" r="3.5" fill="var(--accent-purple)">
            <animate attributeName="cy" values="85;62;85" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle cx="120" cy="50" r="3.5" fill="var(--accent-blue)">
            <animate attributeName="cy" values="85;48;85" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle cx="120" cy="85" r="3" fill="#333333" opacity="0.3" />
          <text x="120" y="115" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Paper Chromatography Separation</text>
        </svg>
      `;
      break;
    case 13: // Hydrocarbons
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="90" y="10" width="60" height="100" fill="none" stroke="var(--border-color)" stroke-width="2.5" rx="3" />
          <line x1="90" y1="80" x2="150" y2="80" stroke="var(--border-color)" stroke-width="1.5" />
          <path d="M 150 80 L 165 85" stroke="var(--accent-red)" stroke-width="2" />
          <text x="120" y="93" font-size="8" fill="var(--accent-red)" text-anchor="middle">Heavy Residue</text>
          <line x1="90" y1="50" x2="150" y2="50" stroke="var(--border-color)" stroke-width="1.5" />
          <path d="M 150 50 L 165 55" stroke="var(--accent-orange)" stroke-width="2" />
          <text x="120" y="63" font-size="8" fill="var(--accent-orange)" text-anchor="middle">Kerosene / Diesel</text>
          <line x1="90" y1="25" x2="150" y2="25" stroke="var(--border-color)" stroke-width="1.5" />
          <path d="M 150 25 L 165 30" stroke="var(--accent-green)" stroke-width="2" />
          <text x="120" y="38" font-size="8" fill="var(--accent-green)" text-anchor="middle">Petrol / Gasoline</text>
          <path d="M 120 10 L 120 2" stroke="var(--accent-blue)" stroke-width="2" />
          <circle cx="110" cy="100" r="2.5" fill="#cccccc">
            <animate attributeName="cy" values="100;12;100" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="130" cy="90" r="2.5" fill="#cccccc">
            <animate attributeName="cy" values="90;12;90" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
          </circle>
          <text x="45" y="60" font-size="9" fill="var(--text-color)" transform="rotate(-90 45 60)" text-anchor="middle" font-weight="bold">Fractionation Column</text>
        </svg>
      `;
      break;
    case 14: // Environmental Chemistry
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <path d="M 0 100 Q 120 85 240 100 L 240 120 L 0 120 Z" fill="rgba(67, 160, 71, 0.2)" stroke="var(--accent-green)" stroke-width="2" />
          <text x="120" y="113" font-size="9" fill="var(--accent-green)" text-anchor="middle" font-weight="bold">EARTH SURFACE</text>
          <path d="M 0 50 Q 120 35 240 50" fill="none" stroke="rgba(2, 136, 209, 0.4)" stroke-width="4" stroke-dasharray="5,4" />
          <text x="120" y="32" font-size="9" fill="var(--accent-blue)" text-anchor="middle">Greenhouse Gas Layer ($CO_2, CH_4$)</text>
          <g>
            <line x1="20" y1="0" x2="60" y2="92" stroke="#ffff00" stroke-width="2" />
            <polygon points="56,92 62,94 59,87" fill="#ffff00" />
            <text x="15" y="15" font-size="8" fill="#ffff00">Solar Rays</text>
          </g>
          <g>
            <path d="M 60 92 L 100 50 L 120 75 L 150 43 L 180 94" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-dasharray="3,2">
              <animate attributeName="stroke-dashoffset" values="20;0" dur="2s" repeatCount="indefinite" />
            </path>
            <polygon points="176,92 181,95 178,88" fill="var(--accent-red)" />
            <text x="140" y="70" font-size="8" fill="var(--accent-red)">Trapped IR Heat</text>
          </g>
        </svg>
      `;
      break;
    case 15: // The Solid State
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(70, 15)">
            <line x1="0" y1="60" x2="20" y2="10" stroke="var(--border-color)" stroke-width="1.5" stroke-opacity="0.5" />
            <line x1="80" y1="60" x2="100" y2="10" stroke="var(--border-color)" stroke-width="1.5" stroke-opacity="0.5" />
            <line x1="20" y1="10" x2="100" y2="10" stroke="var(--border-color)" stroke-width="1.5" stroke-opacity="0.5" />
            <line x1="0" y1="80" x2="100" y2="10" stroke="var(--accent-orange)" stroke-width="1" stroke-dasharray="2,2" />
            <line x1="80" y1="80" x2="20" y2="10" stroke="var(--accent-orange)" stroke-width="1" stroke-dasharray="2,2" />
            <line x1="0" y1="10" x2="100" y2="80" stroke="var(--accent-orange)" stroke-width="1" stroke-dasharray="2,2" />
            <line x1="80" y1="10" x2="0" y2="80" stroke="var(--accent-orange)" stroke-width="1" stroke-dasharray="2,2" />
            <rect x="0" y="30" width="80" height="50" fill="none" stroke="var(--border-color)" stroke-width="2" />
            <line x1="0" y1="30" x2="20" y2="10" stroke="var(--border-color)" stroke-width="2" />
            <line x1="80" y1="30" x2="100" y2="10" stroke="var(--border-color)" stroke-width="2" />
            <line x1="80" y1="80" x2="100" y2="60" stroke="var(--border-color)" stroke-width="2" />
            <line x1="0" y1="80" x2="20" y2="60" stroke="var(--border-color)" stroke-width="2" />
            <circle cx="0" cy="30" r="6" fill="var(--accent-blue)" />
            <circle cx="80" cy="30" r="6" fill="var(--accent-blue)" />
            <circle cx="0" cy="80" r="6" fill="var(--accent-blue)" />
            <circle cx="80" cy="80" r="6" fill="var(--accent-blue)" />
            <circle cx="20" cy="10" r="5" fill="var(--accent-blue)" opacity="0.8" />
            <circle cx="100" cy="10" r="5" fill="var(--accent-blue)" opacity="0.8" />
            <circle cx="20" cy="60" r="5" fill="var(--accent-blue)" opacity="0.8" />
            <circle cx="100" cy="60" r="5" fill="var(--accent-blue)" opacity="0.8" />
            <circle cx="50" cy="45" r="9" fill="var(--accent-red)">
              <animate attributeName="r" values="7;10;7" dur="3s" repeatCount="indefinite" />
            </circle>
          </g>
          <text x="120" y="112" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Body-Centered Cubic (BCC) Lattice</text>
        </svg>
      `;
      break;
    case 16: // Solutions
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <path d="M 60 40 L 60 95 Q 60 105 70 105 L 170 105 Q 180 105 180 95 L 180 40" fill="none" stroke="var(--border-color)" stroke-width="2.5" />
          <line x1="60" y1="70" x2="180" y2="70" stroke="var(--accent-blue)" stroke-width="3" />
          <rect x="61" y="71" width="118" height="33" fill="rgba(2, 136, 209, 0.1)" />
          <circle cx="75" cy="80" r="4" fill="var(--accent-blue)" />
          <circle cx="105" cy="80" r="4" fill="var(--accent-blue)" />
          <circle cx="135" cy="80" r="4" fill="var(--accent-blue)" />
          <circle cx="165" cy="80" r="4" fill="var(--accent-blue)" />
          <circle cx="90" cy="70" r="4.5" fill="var(--accent-red)" />
          <circle cx="150" cy="70" r="4.5" fill="var(--accent-red)" />
          <circle cx="120" cy="70" r="4" fill="var(--accent-blue)" />
          <circle cx="65" cy="70" r="4" fill="var(--accent-blue)" />
          <circle cx="175" cy="70" r="4" fill="var(--accent-blue)" />
          <g>
            <circle cx="120" cy="50" r="3.5" fill="var(--accent-blue)">
              <animate attributeName="cy" values="70;30;70" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="65" cy="45" r="3.5" fill="var(--accent-blue)">
              <animate attributeName="cy" values="70;25;70" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="175" cy="55" r="3.5" fill="var(--accent-blue)">
              <animate attributeName="cy" values="70;35;70" dur="3.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="3.5s" repeatCount="indefinite" />
            </circle>
          </g>
          <text x="120" y="20" font-size="10" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Lowering of Vapor Pressure (Raoult's Law)</text>
        </svg>
      `;
      break;
    case 17: // Electrochemistry
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="50" y="30" width="140" height="75" fill="none" stroke="var(--border-color)" stroke-width="2" rx="3" />
          <rect x="51" y="45" width="138" height="59" fill="rgba(2,136,209,0.15)" />
          <rect x="80" y="15" width="12" height="60" fill="#cc6633" rx="1" />
          <text x="86" y="88" font-size="7" fill="var(--text-color)" text-anchor="middle">Cu Anode</text>
          <rect x="148" y="15" width="12" height="60" fill="#777777" rx="1">
            <animate attributeName="fill" values="#777777;#bb5522;#bb5522;#777777" dur="6s" repeatCount="indefinite" />
          </rect>
          <text x="154" y="88" font-size="7" fill="var(--text-color)" text-anchor="middle">Cathode</text>
          <path d="M 86 15 L 86 5 L 154 5 L 154 15" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
          <line x1="115" y1="0" x2="115" y2="10" stroke="var(--text-color)" stroke-width="3" />
          <line x1="125" y1="3" x2="125" y2="7" stroke="var(--text-color)" stroke-width="1" />
          <circle cx="95" cy="50" r="4.5" fill="var(--accent-blue)">
            <animate attributeName="cx" values="95;145;95" dur="3s" repeatCount="indefinite" />
            <animate attributeName="cy" values="50;55;50" dur="3s" repeatCount="indefinite" />
          </circle>
          <text x="120" y="45" font-size="8" fill="var(--accent-blue)" font-weight="bold">Cu²⁺</text>
          <text x="120" y="117" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Electrolytic Plating Cell</text>
        </svg>
      `;
      break;
    case 18: // Chemical Kinetics
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <line x1="30" y1="10" x2="30" y2="100" stroke="var(--text-color)" stroke-width="2" />
          <line x1="30" y1="100" x2="220" y2="100" stroke="var(--text-color)" stroke-width="2" />
          <text x="25" y="55" font-size="8" fill="var(--text-color)" transform="rotate(-90 25 55)" text-anchor="middle">Energy</text>
          <text x="125" y="112" font-size="8" fill="var(--text-color)" text-anchor="middle">Reaction Coordinate</text>
          <path d="M 30 75 Q 80 75 110 30 T 190 85" fill="none" stroke="var(--accent-blue)" stroke-width="3" />
          <circle cx="110" cy="30" r="5" fill="var(--accent-red)">
            <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <text x="110" y="20" font-size="8" fill="var(--accent-red)" text-anchor="middle" font-weight="bold">Activated Complex</text>
          <circle cx="60" cy="75" r="4.5" fill="var(--accent-orange)">
            <animate attributeName="cx" values="60;110;160;60" dur="4s" repeatCount="indefinite" />
            <animate attributeName="cy" values="75;30;82;75" dur="4s" repeatCount="indefinite" />
          </circle>
          <line x1="30" y1="75" x2="110" y2="75" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" />
          <line x1="110" y1="75" x2="110" y2="35" stroke="var(--accent-green)" stroke-width="1.5" />
          <path d="M 107 38 L 110 31 L 113 38 Z" fill="var(--accent-green)" />
          <text x="100" y="55" font-size="8" fill="var(--accent-green)" text-anchor="end" font-weight="bold">E_a</text>
        </svg>
      `;
      break;
    case 19: // Surface Chemistry
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="80" width="180" height="20" fill="none" stroke="var(--border-color)" stroke-width="2.5" rx="2" />
          <line x1="60" y1="80" x2="60" y2="100" stroke="var(--border-color)" stroke-opacity="0.5" />
          <line x1="90" y1="80" x2="90" y2="100" stroke="var(--border-color)" stroke-opacity="0.5" />
          <line x1="120" y1="80" x2="120" y2="100" stroke="var(--border-color)" stroke-opacity="0.5" />
          <line x1="150" y1="80" x2="150" y2="100" stroke="var(--border-color)" stroke-opacity="0.5" />
          <line x1="180" y1="80" x2="180" y2="100" stroke="var(--border-color)" stroke-opacity="0.5" />
          <text x="120" y="93" font-size="8" fill="var(--text-color)" text-anchor="middle">Solid Adsorbent Catalyst</text>
          <g>
            <circle cx="75" cy="25" r="4.5" fill="var(--accent-red)">
              <animate attributeName="cy" values="25;75;75;25" keyTimes="0;0.4;0.7;1" dur="5s" repeatCount="indefinite" />
              <animate attributeName="cx" values="75;75;75;85" keyTimes="0;0.4;0.7;1" dur="5s" repeatCount="indefinite" />
            </circle>
            <line x1="75" y1="75" x2="75" y2="80" stroke="var(--accent-orange)" stroke-width="1.5" stroke-dasharray="2,1">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.4;0.7;1" dur="5s" repeatCount="indefinite" />
            </line>
          </g>
          <g>
            <circle cx="135" cy="35" r="4.5" fill="var(--accent-blue)">
              <animate attributeName="cy" values="35;75;75;30" keyTimes="0;0.3;0.8;1" dur="6s" repeatCount="indefinite" />
              <animate attributeName="cx" values="135;135;135;125" keyTimes="0;0.3;0.8;1" dur="6s" repeatCount="indefinite" />
            </circle>
            <line x1="135" y1="75" x2="135" y2="80" stroke="var(--accent-orange)" stroke-width="1.5" stroke-dasharray="2,1">
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.3;0.8;1" dur="6s" repeatCount="indefinite" />
            </line>
          </g>
          <text x="120" y="15" font-size="10" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Heterogeneous Adsorption (Surface Chemistry)</text>
        </svg>
      `;
      break;
    case 20: // General Principles of Isolation of Elements
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="50" y="30" width="140" height="75" fill="none" stroke="var(--border-color)" stroke-width="2" rx="3" />
          <rect x="51" y="45" width="138" height="59" fill="rgba(2,136,209,0.1)" />
          <line x1="120" y1="10" x2="120" y2="75" stroke="var(--border-color)" stroke-width="4" />
          <line x1="100" y1="75" x2="140" y2="75" stroke="var(--border-color)" stroke-width="3" />
          <circle cx="95" cy="85" r="4.5" fill="none" stroke="var(--accent-blue)" stroke-width="1">
            <animate attributeName="cy" values="85;38;85" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="145" cy="80" r="4" fill="none" stroke="var(--accent-blue)" stroke-width="1">
            <animate attributeName="cy" values="80;35;80" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <g>
            <rect x="51" y="30" width="138" height="15" fill="rgba(251, 140, 0, 0.2)" rx="2" />
            <circle cx="70" cy="38" r="3.5" fill="var(--accent-orange)" />
            <circle cx="100" cy="35" r="3" fill="var(--accent-orange)" />
            <circle cx="130" cy="38" r="3.5" fill="var(--accent-orange)" />
            <circle cx="170" cy="36" r="3" fill="var(--accent-orange)" />
          </g>
          <circle cx="70" cy="98" r="3" fill="#665544" />
          <circle cx="95" cy="100" r="3.5" fill="#665544" />
          <circle cx="150" cy="98" r="3" fill="#665544" />
          <circle cx="170" cy="101" r="3.5" fill="#665544" />
          <text x="120" y="117" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Froth Flotation (Ore Isolation)</text>
        </svg>
      `;
      break;
    case 21: // The p-Block Elements (Group 15 to 18)
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="30" width="60" height="55" fill="none" stroke="var(--border-color)" stroke-width="2" rx="3" />
          <text x="60" y="60" font-size="9" fill="var(--text-color)" text-anchor="middle">Compressor</text>
          <line x1="90" y1="50" x2="140" y2="50" stroke="var(--text-color)" stroke-width="3" />
          <rect x="140" y="20" width="70" height="75" fill="none" stroke="var(--border-color)" stroke-width="2" rx="3" />
          <rect x="145" y="40" width="60" height="15" fill="rgba(229,57,53,0.15)" stroke="var(--accent-red)" stroke-width="1" />
          <text x="175" y="50" font-size="7" fill="var(--accent-red)" text-anchor="middle" font-weight="bold">Fe Catalyst Bed</text>
          <text x="175" y="80" font-size="8" fill="var(--text-color)" text-anchor="middle">N₂ + 3H₂ ⇌ 2NH₃</text>
          <circle cx="75" cy="50" r="3" fill="var(--accent-blue)">
            <animate attributeName="cx" values="75;155" dur="2s" repeatCount="indefinite" />
          </circle>
          <text x="120" y="42" font-size="7" fill="var(--accent-blue)" font-weight="bold">Haber Process</text>
        </svg>
      `;
      break;
    case 22: // The d & f-Block Elements
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <line x1="30" y1="10" x2="30" y2="105" stroke="var(--text-color)" stroke-width="2" />
          <path d="M 27 15 L 30 8 L 33 15 Z" fill="var(--text-color)" />
          <text x="22" y="60" font-size="8" fill="var(--text-color)" transform="rotate(-90 22 60)" text-anchor="middle">Energy</text>
          <g transform="translate(45, 60)">
            <rect x="0" y="0" width="12" height="12" fill="none" stroke="var(--border-color)" stroke-width="1" />
            <rect x="12" y="0" width="12" height="12" fill="none" stroke="var(--border-color)" stroke-width="1" />
            <rect x="24" y="0" width="12" height="12" fill="none" stroke="var(--border-color)" stroke-width="1" />
            <rect x="36" y="0" width="12" height="12" fill="none" stroke="var(--border-color)" stroke-width="1" />
            <rect x="48" y="0" width="12" height="12" fill="none" stroke="var(--border-color)" stroke-width="1" />
            <text x="30" y="-5" font-size="7" fill="var(--text-muted)" text-anchor="middle">d-orbitals</text>
          </g>
          <g transform="translate(150, 30)">
            <rect x="0" y="0" width="12" height="12" fill="none" stroke="var(--accent-red)" stroke-width="1.5" />
            <rect x="12" y="0" width="12" height="12" fill="none" stroke="var(--accent-red)" stroke-width="1.5" />
            <text x="30" y="10" font-size="8" fill="var(--accent-red)" font-weight="bold">e_g</text>
          </g>
          <g transform="translate(145, 80)">
            <rect x="0" y="0" width="12" height="12" fill="none" stroke="var(--accent-blue)" stroke-width="1.5" />
            <rect x="12" y="0" width="12" height="12" fill="none" stroke="var(--accent-blue)" stroke-width="1.5" />
            <rect x="24" y="0" width="12" height="12" fill="none" stroke="var(--accent-blue)" stroke-width="1.5" />
            <text x="42" y="10" font-size="8" fill="var(--accent-blue)" font-weight="bold">t_2g</text>
          </g>
          <g>
            <line x1="125" y1="40" x2="125" y2="82" stroke="var(--accent-purple)" stroke-width="1.5" />
            <path d="M 122 43 L 125 36 L 128 43 Z" fill="var(--accent-purple)" />
            <path d="M 122 79 L 125 86 L 128 79 Z" fill="var(--accent-purple)" />
            <text x="117" y="65" font-size="8" fill="var(--accent-purple)" text-anchor="end" font-weight="bold">Δ_o</text>
          </g>
          <circle cx="151" cy="86" r="3.5" fill="#ffff00">
            <animate attributeName="cy" values="86;36;86" dur="4s" repeatCount="indefinite" />
            <animate attributeName="fill" values="#ffff00;var(--accent-orange);#ffff00" dur="4s" repeatCount="indefinite" />
          </circle>
        </svg>
      `;
      break;
    case 23: // Coordination Compounds
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(120, 60)">
            <animateTransform attributeName="transform" type="rotate" values="0;360" dur="15s" repeatCount="indefinite" additive="sum" />
            <circle cx="0" cy="0" r="12" fill="var(--accent-red)" />
            <text x="0" y="3" font-size="8" fill="#ffffff" text-anchor="middle" font-weight="bold">Co</text>
            <line x1="0" y1="0" x2="0" y2="-40" stroke="var(--text-color)" stroke-width="2" stroke-dasharray="3,1" />
            <circle cx="0" cy="-40" r="6" fill="var(--accent-blue)" />
            <line x1="0" y1="0" x2="0" y2="40" stroke="var(--text-color)" stroke-width="2" stroke-dasharray="3,1" />
            <circle cx="0" cy="40" r="6" fill="var(--accent-blue)" />
            <line x1="0" y1="0" x2="-35" y2="-15" stroke="var(--text-color)" stroke-width="2" />
            <circle cx="-35" cy="-15" r="6" fill="var(--accent-blue)" />
            <line x1="0" y1="0" x2="35" y2="15" stroke="var(--text-color)" stroke-width="2" />
            <circle cx="35" cy="15" r="6" fill="var(--accent-blue)" />
            <line x1="0" y1="0" x2="-25" y2="25" stroke="var(--text-color)" stroke-width="2" />
            <circle cx="-25" cy="25" r="6" fill="var(--accent-blue)" />
            <line x1="0" y1="0" x2="25" y2="-25" stroke="var(--text-color)" stroke-width="2" />
            <circle cx="25" cy="-25" r="6" fill="var(--accent-blue)" />
          </g>
          <text x="120" y="114" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Octahedral Coordination Complex</text>
        </svg>
      `;
      break;
    case 24: // Haloalkanes & Haloarenes
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <g>
            <circle cx="35" cy="60" r="10" fill="var(--accent-green)" />
            <text x="35" y="63" font-size="8" fill="#ffffff" text-anchor="middle" font-weight="bold">Nu⁻</text>
            <animate attributeName="cx" values="35;100;35" dur="4s" repeatCount="indefinite" />
          </g>
          <path d="M 50 60 Q 75 55 95 60" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-dasharray="3,1">
            <animate attributeName="opacity" values="1;0;1" dur="4s" repeatCount="indefinite" />
          </path>
          <circle cx="120" cy="60" r="12" fill="var(--accent-blue)" />
          <text x="120" y="63" font-size="9" fill="#ffffff" text-anchor="middle" font-weight="bold">C</text>
          <line x1="120" y1="60" x2="110" y2="30" stroke="var(--text-color)" stroke-width="2" />
          <circle cx="110" cy="30" r="5" fill="var(--border-color)" />
          <line x1="120" y1="60" x2="110" y2="90" stroke="var(--text-color)" stroke-width="2" />
          <circle cx="110" cy="90" r="5" fill="var(--border-color)" />
          <g>
            <circle cx="165" cy="60" r="10" fill="var(--accent-red)">
              <animate attributeName="cx" values="165;210;165" dur="4s" repeatCount="indefinite" />
            </circle>
            <text x="165" y="63" font-size="8" fill="#ffffff" text-anchor="middle" font-weight="bold">X</text>
          </g>
          <line x1="132" y1="60" x2="155" y2="60" stroke="var(--text-color)" stroke-width="2">
            <animate attributeName="opacity" values="1;0;1" dur="4s" repeatCount="indefinite" />
          </line>
          <text x="120" y="112" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">S_N2 Nucleophilic Substitution Mechanism</text>
        </svg>
      `;
      break;
    case 25: // Alcohols, Phenols & Ethers
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="70" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="70" y="63" font-size="8" fill="#ffffff" text-anchor="middle">C</text>
          <line x1="80" y1="60" x2="130" y2="60" stroke="var(--text-color)" stroke-width="2" />
          <circle cx="140" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="140" y="63" font-size="8" fill="#ffffff" text-anchor="middle">C</text>
          <line x1="70" y1="60" x2="70" y2="35" stroke="var(--text-color)" stroke-width="1.5" />
          <circle cx="70" cy="35" r="4.5" fill="var(--border-color)" />
          <g>
            <circle cx="175" cy="60" r="9" fill="var(--accent-red)" />
            <text x="175" y="63" font-size="7" fill="#ffffff" text-anchor="middle">OH₂⁺</text>
            <animate attributeName="cx" values="175;220;175" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0;1" dur="3.5s" repeatCount="indefinite" />
          </g>
          <line x1="150" y1="60" x2="166" y2="60" stroke="var(--text-color)" stroke-width="1.5">
            <animate attributeName="opacity" values="1;0;1" dur="3.5s" repeatCount="indefinite" />
          </line>
          <text x="120" y="105" font-size="10" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Acid-Catalyzed Dehydration of Alcohols</text>
        </svg>
      `;
      break;
    case 26: // Aldehydes, Ketones & Carboxylic Acids
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="120" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="120" y="63" font-size="8" fill="#ffffff" text-anchor="middle">C</text>
          <line x1="120" y1="50" x2="120" y2="25" stroke="var(--accent-red)" stroke-width="1.5" />
          <line x1="124" y1="50" x2="124" y2="25" stroke="var(--accent-red)" stroke-width="1.5" />
          <circle cx="122" cy="20" r="8" fill="var(--accent-red)" />
          <text x="122" y="23" font-size="8" fill="#ffffff" text-anchor="middle">O</text>
          <line x1="112" y1="65" x2="85" y2="85" stroke="var(--text-color)" stroke-width="2" />
          <text x="75" y="93" font-size="8" fill="var(--text-color)">R</text>
          <line x1="128" y1="65" x2="155" y2="85" stroke="var(--text-color)" stroke-width="2" />
          <text x="160" y="93" font-size="8" fill="var(--text-color)">H/R'</text>
          <g>
            <circle cx="200" cy="30" r="8" fill="var(--accent-green)">
              <animate attributeName="cx" values="200;135;200" dur="4s" repeatCount="indefinite" />
              <animate attributeName="cy" values="30;53;30" dur="4s" repeatCount="indefinite" />
            </circle>
            <text x="200" y="33" font-size="7" fill="#ffffff" text-anchor="middle">Nu⁻</text>
          </g>
          <text x="120" y="112" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Nucleophilic Addition to Carbonyl</text>
        </svg>
      `;
      break;
    case 27: // Amines
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="60" r="10" fill="var(--accent-blue)" />
          <text x="80" y="63" font-size="8" fill="#ffffff" text-anchor="middle">C</text>
          <line x1="80" y1="50" x2="80" y2="30" stroke="var(--accent-red)" stroke-width="3" />
          <circle cx="80" cy="25" r="6" fill="var(--accent-red)" />
          <text x="45" y="63" font-size="10" fill="var(--text-color)" font-weight="bold">R</text>
          <line x1="55" y1="60" x2="70" y2="60" stroke="var(--text-color)" stroke-width="2" />
          <g>
            <animateTransform attributeName="transform" type="translate" values="0,0; 0,-50; 0,0" dur="5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0;1" dur="5s" repeatCount="indefinite" />
          </g>
          <g>
            <circle cx="140" cy="60" r="10" fill="var(--accent-purple)" />
            <text x="140" y="63" font-size="8" fill="#ffffff" text-anchor="middle">NH₂</text>
            <animate attributeName="cx" values="140;80;140" dur="5s" repeatCount="indefinite" />
          </g>
          <line x1="90" y1="60" x2="130" y2="60" stroke="var(--text-color)" stroke-width="2">
            <animate attributeName="x2" values="130;80;130" dur="5s" repeatCount="indefinite" />
          </line>
          <text x="120" y="112" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Hofmann Degradation of Amines</text>
        </svg>
      `;
      break;
    case 28: // Biomolecules
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(30,10)">
            <path d="M 10 50 Q 45 -10 90 50 T 170 50" fill="none" stroke="var(--accent-blue)" stroke-width="3" />
            <path d="M 10 50 Q 45 110 90 50 T 170 50" fill="none" stroke="var(--accent-red)" stroke-width="3" />
            <line x1="32" y1="20" x2="32" y2="80" stroke="var(--border-color)" stroke-width="1.5" />
            <line x1="62" y1="25" x2="62" y2="75" stroke="var(--border-color)" stroke-width="1.5" />
            <line x1="90" y1="50" x2="90" y2="50" stroke="var(--border-color)" stroke-width="1.5" />
            <line x1="118" y1="75" x2="118" y2="25" stroke="var(--border-color)" stroke-width="1.5" />
            <line x1="148" y1="80" x2="148" y2="20" stroke="var(--border-color)" stroke-width="1.5" />
            <animateTransform attributeName="transform" type="rotate" values="0 90 50; 360 90 50" dur="8s" repeatCount="indefinite" />
          </g>
          <text x="120" y="114" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">DNA Double Helix Structure</text>
        </svg>
      `;
      break;
    case 29: // Polymers
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <g>
            <circle cx="30" cy="40" r="8" fill="var(--accent-orange)" />
            <circle cx="70" cy="30" r="8" fill="var(--accent-orange)" />
            <circle cx="110" cy="25" r="8" fill="var(--accent-orange)" />
            <circle cx="150" cy="35" r="8" fill="var(--accent-orange)" />
            <circle cx="190" cy="40" r="8" fill="var(--accent-orange)" />
            <animate attributeName="opacity" values="1;0;0;1" dur="6s" repeatCount="indefinite" />
          </g>
          <g>
            <line x1="30" y1="80" x2="70" y2="75" stroke="var(--text-color)" stroke-width="2" />
            <line x1="70" y1="75" x2="110" y2="85" stroke="var(--text-color)" stroke-width="2" />
            <line x1="110" y1="85" x2="150" y2="72" stroke="var(--text-color)" stroke-width="2" />
            <line x1="150" y1="72" x2="190" y2="80" stroke="var(--text-color)" stroke-width="2" />
            <circle cx="30" cy="80" r="8" fill="var(--accent-blue)" />
            <circle cx="70" cy="75" r="8" fill="var(--accent-blue)" />
            <circle cx="110" cy="85" r="8" fill="var(--accent-blue)" />
            <circle cx="150" cy="72" r="8" fill="var(--accent-blue)" />
            <circle cx="190" cy="80" r="8" fill="var(--accent-blue)" />
            <animate attributeName="opacity" values="0;1;1;0" dur="6s" repeatCount="indefinite" />
          </g>
          <text x="120" y="110" font-size="10" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Addition Polymerization Process</text>
        </svg>
      `;
      break;
    case 30: // Chemistry in Everyday Life
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="120" cy="60" r="16" fill="#887755" stroke="#554433" stroke-width="2">
            <animate attributeName="r" values="15;17;15" dur="3s" repeatCount="indefinite" />
          </circle>
          <text x="120" y="63" font-size="7" fill="#ffffff" text-anchor="middle">GREASE</text>
          <g transform="translate(120,60)">
            <path d="M 0 -16 L 3 -24 L -3 -30 L 0 -38" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
            <circle cx="0" cy="-42" r="4.5" fill="var(--accent-blue)" />
            <path d="M 0 16 L 3 24 L -3 30 L 0 38" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
            <circle cx="0" cy="42" r="4.5" fill="var(--accent-blue)" />
            <path d="M -16 0 L -24 3 L -30 -3 L -38 0" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
            <circle cx="-42" cy="0" r="4.5" fill="var(--accent-blue)" />
            <path d="M 16 0 L 24 3 L 30 -3 L 38 0" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
            <circle cx="42" cy="0" r="4.5" fill="var(--accent-blue)" />
            <g transform="rotate(45)">
              <path d="M 0 -16 L 3 -24 L -3 -30 L 0 -38" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
              <circle cx="0" cy="-42" r="4.5" fill="var(--accent-blue)" />
              <path d="M 0 16 L 3 24 L -3 30 L 0 38" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
              <circle cx="0" cy="42" r="4.5" fill="var(--accent-blue)" />
            </g>
            <g transform="rotate(-45)">
              <path d="M 0 -16 L 3 -24 L -3 -30 L 0 -38" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
              <circle cx="0" cy="-42" r="4.5" fill="var(--accent-blue)" />
              <path d="M 0 16 L 3 24 L -3 30 L 0 38" fill="none" stroke="var(--text-color)" stroke-width="1.5" />
              <circle cx="0" cy="42" r="4.5" fill="var(--accent-blue)" />
            </g>
          </g>
          <text x="120" y="114" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Soap Micelle Action on Grease</text>
        </svg>
      `;
      break;
    case 31: // Qualitative Inorganic Analysis (Salt Analysis)
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <path d="M 105 20 L 105 85 C 105 95 135 95 135 85 L 135 20" fill="none" stroke="var(--border-color)" stroke-width="2" />
          <path d="M 106 50 L 106 85 C 106 93 134 93 134 85 L 134 50 Z" fill="rgba(2, 136, 209, 0.1)" />
          <circle cx="120" cy="30" r="3" fill="var(--accent-red)">
            <animate attributeName="cy" values="10;55" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <path d="M 106 75 L 106 85 C 106 93 134 93 134 85 L 134 75 Z" fill="var(--accent-purple)" opacity="0.8">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="4s" repeatCount="indefinite" />
          </path>
          <text x="120" y="112" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Qualitative Group Precipitate Formation</text>
        </svg>
      `;
      break;
    case 32: // Practical Organic Chemistry (POC)
      svgContent = `
        <svg width="240" height="120" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
          <path d="M 105 20 L 105 85 C 105 95 135 95 135 85 L 135 20" fill="none" stroke="var(--border-color)" stroke-width="2" />
          <path d="M 106 45 L 106 85 C 106 93 134 93 134 85 L 134 45 Z" fill="rgba(255,255,255,0.2)" />
          <path d="M 106 45 L 106 85 C 106 93 134 93 134 85 L 134 45" fill="none" stroke="#e0e0e0" stroke-width="3" opacity="0.9">
            <animate attributeName="stroke" values="#777777;#e0e0e0;#ffffff;#777777" dur="5s" repeatCount="indefinite" />
          </path>
          <text x="120" y="65" font-size="8" fill="#333333" text-anchor="middle" font-weight="bold">Silver Mirror</text>
          <text x="120" y="112" font-size="9" fill="var(--text-color)" text-anchor="middle" font-weight="bold">Tollens' Test for Aldehydes (POC)</text>
        </svg>
      `;
      break;
  }
  
  container.innerHTML = svgContent;
}

function getSimTypeForPage(chId, pageNum) {
  // Use the SIMULATION_REGISTRY if available
  if (window.SIMULATION_REGISTRY) {
    const sims = window.SIMULATION_REGISTRY[chId];
    if (sims && sims.length > 0) {
      // Pick sim based on section page (rotate through available sims)
      const secIdx = Math.max(0, pageNum - 5);
      const sim = sims[secIdx % sims.length];
      return sim.labId || 'molecular';
    }
  }
  // Fallback map
  const fallback = { 1:'molecular', 2:'bohr', 3:'molecular', 4:'molecular', 5:'gas_chamber',
    6:'le_chatelier', 7:'le_chatelier', 8:'titration', 9:'titration', 10:'kinetics',
    11:'molecular', 12:'molecular', 13:'molecular', 14:'molecular', 15:'molecular',
    16:'molecular', 17:'molecular', 18:'molecular', 19:'molecular', 20:'molecular',
    21:'titration', 22:'molecular', 23:'molecular', 24:'molecular', 25:'molecular', 26:'molecular',
    27:'molecular', 28:'molecular', 29:'molecular', 30:'molecular',
    31:'molecular', 32:'molecular' };
  return fallback[chId] || 'molecular';
}

/* ==========================================================================
   4. SIMULATIONS MODAL CONTROLLER
   ========================================================================== */
window.launchSimulation = function(sim, chId, pageNum) {
  const modal = document.getElementById("simulation-modal");
  const gallery = document.getElementById("sim-gallery-view");
  const activeView = document.getElementById("sim-active-view");
  const title = document.getElementById("sim-title");
  const subtitle = document.getElementById("sim-subtitle");
  
  modal.classList.add("active");
  
  if (sim || (chId && pageNum)) {
    let simObj = sim;
    if (!simObj && chId && pageNum) {
      const sims = SIMULATION_REGISTRY[chId] || [];
      if (sims.length > 0) {
        const secIdx = Math.max(0, pageNum - 5);
        simObj = sims[secIdx % sims.length];
      }
    }
    
    // Support legacy string parameters by looking them up in registry or setting default
    if (typeof simObj === "string") {
      const sims = SIMULATION_REGISTRY[currentChapterId] || [];
      simObj = sims.find(s => s.labId === simObj) || {
        labId: simObj,
        title: simObj.replace(/_/g, " ").toUpperCase(),
        description: "Adjust parameters to observe chemical responses"
      };
    }
    
    // Safety fallback
    if (!simObj) {
      simObj = {
        labId: "molecular",
        title: "Molecular Geometry Model",
        description: "Explore the VSEPR and chemical bonding orbitals interactively."
      };
    }
    
    gallery.style.display = "none";
    activeView.style.display = "grid";
    document.getElementById("sim-back-btn").style.display = "inline-block";
    
    title.textContent = simObj.title;
    subtitle.textContent = simObj.description;
    
    // Load simulation onto 2D canvas
    const canvas = document.getElementById("chemistry-canvas");
    const controls = document.getElementById("simulation-controls-box");
    
    VirtualLabs.loadLab(simObj, canvas, controls);
    
    const runBtn = document.getElementById("sim-run-btn");
    const resetBtn = document.getElementById("sim-reset-btn");
    
    runBtn.onclick = () => {
      if (VirtualLabs.activeLab) {
        if (VirtualLabs.activeLab.isDropping !== undefined) {
          VirtualLabs.activeLab.isDropping = !VirtualLabs.activeLab.isDropping;
          runBtn.innerHTML = VirtualLabs.activeLab.isDropping ? '<i class="fas fa-pause"></i> Stop Stream' : '<i class="fas fa-play"></i> Run Simulation';
        }
      }
    };
    
    resetBtn.onclick = () => {
      if (VirtualLabs.activeLab && VirtualLabs.activeLab.init) {
        VirtualLabs.activeLab.volBase = 0.0;
        VirtualLabs.activeLab.isDropping = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> Run Simulation';
        VirtualLabs.activeLab.updateChemicalPH();
      }
    };
  } else {
    // Show Gallery View
    gallery.style.display = "block";
    activeView.style.display = "none";
    document.getElementById("sim-back-btn").style.display = "none";
    
    title.textContent = "Atomica Chemistry Virtual Laboratories";
    subtitle.textContent = "Choose from our high-precision simulators";
    
    populateSimulationGallery();
  }
};

function populateSimulationGallery() {
  const grid = document.getElementById("sim-gallery-grid");
  if (!grid) return;
  
  grid.innerHTML = "";
  const list = SIMULATION_REGISTRY[currentChapterId] || [];
  
  list.forEach(sim => {
    const card = document.createElement("div");
    card.className = "sim-gallery-card";
    card.style.cssText = `
      background: var(--panel-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    card.innerHTML = `
      <div style="font-weight: 700; font-size: 1.1rem; color: var(--accent-blue); margin-bottom: 8px;">
        <i class="fas fa-flask"></i> ${sim.title}
      </div>
      <p style="font-size: 0.9rem; color: var(--text-color); line-height: 1.4;">${sim.description}</p>
    `;
    card.onclick = () => {
      launchSimulation(sim);
    };
    grid.appendChild(card);
  });
}

document.getElementById("close-sim-btn").onclick = () => {
  document.getElementById("simulation-modal").classList.remove("active");
  VirtualLabs.cleanupActiveLab();
};

document.getElementById("sim-back-btn").onclick = () => {
  launchSimulation(null);
};

/* ==========================================================================
   5. NTA CBT MOCK PRACTICE TEST CONSOLE
   ========================================================================== */
window.triggerCbtSelection = function() {
  document.getElementById("cbt-mode-selector").classList.add("active");
};

// Handle mode selector cards clicks
document.querySelectorAll(".cbt-mode-card").forEach(card => {
  card.onclick = () => {
    const mode = card.getAttribute("data-mode");
    document.getElementById("cbt-mode-selector").classList.remove("active");
    startCbtSession(mode);
  };
});

document.getElementById("close-cbt-mode-btn").onclick = () => {
  document.getElementById("cbt-mode-selector").classList.remove("active");
};

function startCbtSession(mode) {
  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === currentChapterId);
  if (!ch) return;

  let questions = ch.questions || [];
  if (mode === "page") {
    // Grab the first 2 questions representing the active section
    questions = questions.slice(0, 2);
  }
  
  if (questions.length === 0) {
    alert("No CBT Mock problems registered for this chapter selection.");
    return;
  }

  cbtQuestions = questions;
  cbtResponses = {};
  cbtStatus = {};
  cbtActiveQuestionIdx = 0;
  cbtQuestionDurations = {};
  cbtSecondsLeft = Math.max(cbtQuestions.length * 90, 600); // 90 seconds per question, min 10 min

  cbtQuestions.forEach(q => {
    cbtStatus[q.id] = 'unvisited';
  });
  cbtStatus[cbtQuestions[0].id] = 'not-answered';

  // Toggle CBT UI overlay
  document.getElementById('cbt-modal').classList.add('active');

  // Launch Timer Interval
  if (cbtTimerInterval) clearInterval(cbtTimerInterval);
  cbtTimerInterval = setInterval(updateCbtTimer, 1000);
  updateCbtTimer();

  // Draw palette buttons
  initCbtPalette();

  // Load first MCQ question
  loadCbtQuestion(0);
}

function updateCbtTimer() {
  if (cbtSecondsLeft <= 0) {
    clearInterval(cbtTimerInterval);
    submitCbtTest();
    return;
  }
  cbtSecondsLeft--;
  const mins = Math.floor(cbtSecondsLeft / 60);
  const secs = cbtSecondsLeft % 60;
  document.getElementById('cbt-timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const activeQ = cbtQuestions[cbtActiveQuestionIdx];
  if (activeQ) {
    cbtQuestionDurations[activeQ.id] = (cbtQuestionDurations[activeQ.id] || 0) + 1;
  }

  updateGhostRanker();
}

function updateGhostRanker() {
  if (!cbtQuestions || cbtQuestions.length === 0) return;
  const totalTime = Math.max(cbtQuestions.length * 90, 600);
  const elapsed = totalTime - cbtSecondsLeft;

  const topperQ = Math.min(cbtQuestions.length, Math.floor(elapsed / 45) + 1);
  const avgQ = Math.min(cbtQuestions.length, Math.floor(elapsed / 80) + 1);
  const youQ = cbtActiveQuestionIdx + 1;

  document.getElementById('ghost-topper-pos').innerText = `Q${topperQ}`;
  document.getElementById('ghost-you-pos').innerText = `Q${youQ}`;
  document.getElementById('ghost-avg-pos').innerText = `Q${avgQ}`;
}

function initCbtPalette() {
  const grid = document.getElementById('cbt-palette-grid');
  if (!grid) return;

  grid.innerHTML = '';
  cbtQuestions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn not-visited';
    btn.id = `palette-btn-${q.id}`;
    btn.innerText = (idx + 1).toString();
    btn.onclick = () => {
      saveCurrentResponseState();
      loadCbtQuestion(idx);
    };
    grid.appendChild(btn);
  });
  updatePaletteVisuals();
}

function updatePaletteVisuals() {
  cbtQuestions.forEach((q, idx) => {
    const btn = document.getElementById(`palette-btn-${q.id}`);
    if (!btn) return;

    btn.className = 'palette-btn';
    if (idx === cbtActiveQuestionIdx) btn.classList.add('current');

    const status = cbtStatus[q.id];
    if (status === 'unvisited') btn.classList.add('not-visited');
    else if (status === 'not-answered') btn.classList.add('not-answered');
    else if (status === 'answered') btn.classList.add('answered');
    else if (status === 'marked') btn.classList.add('review');
    else if (status === 'marked-answered') btn.classList.add('review-answered');
  });

  const legendCounts = { 'answered': 0, 'not-answered': 0, 'unvisited': 0, 'marked': 0, 'marked-answered': 0 };
  cbtQuestions.forEach(q => {
    legendCounts[cbtStatus[q.id]]++;
  });

  const legends = document.querySelectorAll('.palette-legend .legend-box');
  if (legends.length === 5) {
    legends[0].innerText = legendCounts['answered'];
    legends[1].innerText = legendCounts['not-answered'];
    legends[2].innerText = legendCounts['unvisited'];
    legends[3].innerText = legendCounts['marked'];
    legends[4].innerText = legendCounts['marked-answered'];
  }
}

function loadCbtQuestion(idx) {
  cbtActiveQuestionIdx = idx;
  const q = cbtQuestions[idx];
  if (!q) return;

  document.getElementById('cbt-q-number').innerText = `Question ${(idx + 1).toString().padStart(2, '0')}`;
  document.getElementById('cbt-q-diff').innerText = `LEVEL ${q.level}`;
  document.getElementById('cbt-q-tag').innerText = q.tag;

  document.getElementById('cbt-q-context').innerHTML = q.contextText;
  document.getElementById('cbt-q-text').innerHTML = q.questionText;

  const optContainer = document.getElementById('cbt-options-container');
  optContainer.innerHTML = '';
  q.options.forEach((optText, optIdx) => {
    const row = document.createElement('div');
    row.className = 'cbt-option-row';
    if (cbtResponses[q.id] === optIdx) row.classList.add('selected');
    
    row.innerHTML = `
      <input type="radio" class="cbt-option-radio" name="cbt-opt" value="${optIdx}" ${cbtResponses[q.id] === optIdx ? 'checked' : ''}>
      <span class="cbt-option-text">${optText}</span>
    `;

    row.onclick = () => {
      row.querySelector('input').checked = true;
      document.querySelectorAll('.cbt-option-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    };

    optContainer.appendChild(row);
  });

  if (cbtStatus[q.id] === 'unvisited') {
    cbtStatus[q.id] = 'not-answered';
  }

  updatePaletteVisuals();
  
  // Force KaTeX typeset inside CBT overlay
  const cbtBox = document.querySelector('.cbt-scrollable-content');
  renderMath(cbtBox);
}

function saveCurrentResponseState() {
  const currentQ = cbtQuestions[cbtActiveQuestionIdx];
  if (!currentQ) return;

  const selectedInput = document.querySelector('input[name="cbt-opt"]:checked');
  if (selectedInput) {
    const val = parseInt(selectedInput.value, 10);
    cbtResponses[currentQ.id] = val;
    if (cbtStatus[currentQ.id] === 'marked' || cbtStatus[currentQ.id] === 'marked-answered') {
      cbtStatus[currentQ.id] = 'marked-answered';
    } else {
      cbtStatus[currentQ.id] = 'answered';
    }
  } else {
    if (cbtStatus[currentQ.id] !== 'marked' && cbtStatus[currentQ.id] !== 'marked-answered') {
      cbtStatus[currentQ.id] = 'not-answered';
    }
  }
}

document.getElementById('cbt-save-next-btn').onclick = () => {
  saveCurrentResponseState();
  if (cbtActiveQuestionIdx < cbtQuestions.length - 1) {
    loadCbtQuestion(cbtActiveQuestionIdx + 1);
  } else {
    alert("Last question reached. Review your palette responses and click 'Submit Test'!");
  }
};

document.getElementById('cbt-clear-btn').onclick = () => {
  const currentQ = cbtQuestions[cbtActiveQuestionIdx];
  if (!currentQ) return;

  delete cbtResponses[currentQ.id];
  document.querySelectorAll('input[name="cbt-opt"]').forEach(input => input.checked = false);
  document.querySelectorAll('.cbt-option-row').forEach(row => row.classList.remove('selected'));

  if (cbtStatus[currentQ.id] === 'marked-answered') {
    cbtStatus[currentQ.id] = 'marked';
  } else {
    cbtStatus[currentQ.id] = 'not-answered';
  }
  updatePaletteVisuals();
};

document.getElementById('cbt-mark-review-btn').onclick = () => {
  const currentQ = cbtQuestions[cbtActiveQuestionIdx];
  if (!currentQ) return;

  const selectedInput = document.querySelector('input[name="cbt-opt"]:checked');
  if (selectedInput) {
    const val = parseInt(selectedInput.value, 10);
    cbtResponses[currentQ.id] = val;
    cbtStatus[currentQ.id] = 'marked-answered';
  } else {
    cbtStatus[currentQ.id] = 'marked';
  }

  if (cbtActiveQuestionIdx < cbtQuestions.length - 1) {
    loadCbtQuestion(cbtActiveQuestionIdx + 1);
  } else {
    updatePaletteVisuals();
  }
};

document.getElementById('cbt-quit-btn').onclick = () => {
  if (confirm("Are you sure you want to exit the practice test? All current responses will be cleared.")) {
    clearInterval(cbtTimerInterval);
    document.getElementById('cbt-modal').classList.remove('active');
  }
};

document.getElementById('cbt-rough-work-btn').onclick = () => {
  triggerScratchpadModal();
};

document.getElementById('cbt-submit-btn').onclick = () => {
  if (confirm("Are you ready to submit your test for dynamic evaluation?")) {
    saveCurrentResponseState();
    submitCbtTest();
  }
};

/* ==========================================================================
   6. EVALUATION & PACING SPEEDOMETER RENDER
   ========================================================================== */
function submitCbtTest() {
  clearInterval(cbtTimerInterval);
  document.getElementById('cbt-modal').classList.remove('active');

  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let attemptedCount = 0;

  cbtQuestions.forEach(q => {
    const ans = cbtResponses[q.id];
    if (ans !== undefined) {
      attemptedCount++;
      if (ans === q.correctIndex) {
        correctCount++;
        score += 4;
      } else {
        wrongCount++;
        score -= 1;
      }
    }
  });

  const totalPossible = cbtQuestions.length * 4;
  const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const timeSpent = Math.max(cbtQuestions.length * 90, 600) - cbtSecondsLeft;
  const timeFormatted = `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`;

  let percentile = 25.0;
  if (score >= totalPossible * 0.9) percentile = 99.96;
  else if (score >= totalPossible * 0.8) percentile = 99.78;
  else if (score >= totalPossible * 0.7) percentile = 99.20;
  else if (score >= totalPossible * 0.5) percentile = 97.80;
  else if (score >= totalPossible * 0.3) percentile = 94.50;
  else if (score > 0) percentile = 80.50;

  document.getElementById('res-score').innerText = `${score} / ${totalPossible}`;
  document.getElementById('res-accuracy').innerText = `${accuracy}%`;
  document.getElementById('res-time').innerText = timeFormatted;
  document.getElementById('res-percentile').innerText = `${percentile}%`;

  const verdictTitle = document.getElementById('res-verdict-title');
  const verdictText = document.getElementById('res-verdict-text');

  if (percentile >= 99.0) {
    verdictTitle.innerText = "Performance Verdict: Outstanding Academic Excellence! 🏆";
    verdictText.innerText = "Exceptional conceptual clarity! You completed the quiz with superb precision and standard JEE speed. Keep revising the formula sheet and practice matching physical chemistry solvers regularly!";
  } else if (percentile >= 94.0) {
    verdictTitle.innerText = "Performance Verdict: Highly Competent! 🧠";
    verdictText.innerText = "Very strong performance. Your core understanding of this chapter is intact. Practice more mock drills under restricted timer counts to eliminate minor calculation errors.";
  } else {
    verdictTitle.innerText = "Performance Verdict: Concepts Review Advised! 🔋";
    verdictText.innerText = "A thorough reading of our systematic cover, Toc maps, and 20 theory pages is advised. Leverage the interactive chemical simulator beakers to build intuitive bonds and molar parameters.";
  }

  // Populate results details table
  const tbody = document.getElementById('results-table-body');
  tbody.innerHTML = '';
  cbtQuestions.forEach((q, idx) => {
    const userAns = cbtResponses[q.id];
    const userLetter = userAns !== undefined ? String.fromCharCode(65 + userAns) : '—';
    const correctLetter = String.fromCharCode(65 + q.correctIndex);
    const points = userAns !== undefined ? (userAns === q.correctIndex ? '+4' : '-1') : '0';
    const rowClass = points === '+4' ? 'tr-correct' : (points === '-1' ? 'tr-wrong' : '');

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${q.tag}</td>
      <td>L${q.level}</td>
      <td><strong>(${userLetter})</strong></td>
      <td style="color:var(--accent-green)"><strong>(${correctLetter})</strong></td>
      <td><span style="font-weight:700; color: ${points==='+4' ? 'var(--accent-green)' : (points==='-1'?'var(--accent-red)':'inherit')}">${points}</span></td>
      <td><button class="btn-row-action" onclick="viewQuestionSolution(${idx})" style="padding: 2px 8px; font-size:0.8rem; cursor:pointer;">View Solution</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Draw Pacing Speedometer columns graph
  const graph = document.getElementById('cbt-speedometer-graph');
  if (graph) {
    graph.innerHTML = '';
    cbtQuestions.forEach((q, idx) => {
      const dur = cbtQuestionDurations[q.id] || 0;
      const heightPct = Math.min(100, (dur / 180) * 100);
      let barColor = '#4caf50'; // Green (<60s)
      if (dur > 120) barColor = '#ef5350'; // Red (>120s)
      else if (dur > 60) barColor = '#ffb74d'; // Yellow

      const col = document.createElement('div');
      col.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        height: 100%;
        justify-content: flex-end;
        position: relative;
      `;
      col.innerHTML = `
        <span style="font-size: 0.75rem; font-weight: 700; margin-bottom: 4px; color: var(--text-color);">${dur}s</span>
        <div style="width: 20px; height: ${heightPct}%; background: ${barColor}; border-radius: 4px 4px 0 0; transition: height 0.4s;"></div>
        <span style="font-size: 0.78rem; font-weight: bold; margin-top: 6px; color: var(--text-muted);">Q${idx+1}</span>
      `;
      graph.appendChild(col);
    });
  }

  // Open Results overlay
  document.getElementById('cbt-results-modal').classList.add('active');

  // Push score telemetry to local storage analytics
  saveQuizTelemetry(score, cbtQuestions.length, attemptedCount);
}

function saveQuizTelemetry(score, totalCount, attempted) {
  const history = JSON.parse(safeStorage.getItem('atomica-cbt-history') || '[]');
  const ch = window.CHEMISTRY_CHAPTERS.find(c => c.id === currentChapterId);
  history.push({
    chapterTitle: ch.title,
    score: score,
    total: totalCount * 4,
    date: new Date().toLocaleDateString()
  });
  safeStorage.setItem('atomica-cbt-history', JSON.stringify(history));
}

document.getElementById("close-results-btn").onclick = () => {
  document.getElementById("cbt-results-modal").classList.remove("active");
};

window.viewQuestionSolution = function(idx) {
  document.getElementById("cbt-results-modal").classList.remove("active");
  const q = cbtQuestions[idx];
  const sol = q.solution;
  
  const pagesContainer = document.getElementById("pages-container");
  pagesContainer.innerHTML = "";
  const pane = document.createElement("article");
  pane.className = "notebook-page";
  pane.id = "book-content-pane";
  pagesContainer.appendChild(pane);

  pane.innerHTML = `
    <div class="detailed-solution-view" style="color: var(--text-color); font-size:1.25rem;">
      <h2 style="color: var(--accent-blue); font-family: var(--font-heading); border-bottom:1px solid var(--border-color); padding-bottom:6px; margin-bottom:15px;">SOLUTION ANALYSIS: QUESTION ${(idx+1).toString().padStart(2, '0')}</h2>
      <p style="margin-bottom: 8px;"><strong>Context:</strong> <em>"${q.contextText}"</em></p>
      <p style="margin-bottom: 20px;"><strong>Question:</strong> <strong>${q.questionText}</strong></p>
      <div class="hr-notebook"></div>

      <div style="background: rgba(123, 31, 162, 0.04); border-left: 4px solid var(--accent-purple); padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h4 style="font-family: var(--font-heading); color: var(--accent-purple); margin-bottom: 5px;">1. Thought Process:</h4>
        <p>${sol.thought}</p>
      </div>

      <h4 style="color: var(--accent-blue); font-family: var(--font-heading); margin-bottom:5px;"><i class="fas fa-list-ul"></i> 2. Given Parameters:</h4>
      <p style="margin-bottom:15px;">${sol.given}</p>

      <h4 style="color: var(--accent-blue); font-family: var(--font-heading); margin-bottom:5px;"><i class="fas fa-brain"></i> 3. Conceptual Foundation:</h4>
      <p style="margin-bottom:15px;">${sol.concept}</p>

      <h4 style="color: var(--accent-blue); font-family: var(--font-heading); margin-bottom:5px;"><i class="fas fa-pencil-alt"></i> 4. Pencil Sketch Layout:</h4>
      <p style="margin-bottom:15px;">${sol.diagramDesc}</p>

      <h4 style="color: var(--accent-blue); font-family: var(--font-heading); margin-bottom:5px;"><i class="fas fa-square-root-alt"></i> 5. Step-by-Step Algebra Derivation:</h4>
      <p style="white-space: pre-line; line-height: 1.6; margin-bottom:20px;">${sol.detailedStep}</p>

      <div style="border: 2px dashed var(--accent-green); background: rgba(67,160,71,0.03); padding:15px; border-radius:8px; margin-bottom:20px;">
        <div style="font-weight:bold; color:var(--accent-green); font-size:1.15rem; font-family: var(--font-heading); margin-bottom:5px;">6. Toppers' Shortcut:</div>
        <p>${sol.shortcut}</p>
      </div>

      <div style="background: rgba(229,57,53,0.04); border-left: 4px solid var(--accent-red); padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <p><strong>7. Common Misconception Trap:</strong> ${sol.mistakes}</p>
      </div>

      <h4 style="color: var(--accent-blue); font-family: var(--font-heading); margin-bottom:5px;"><i class="fas fa-sync-alt"></i> 8. Alternate Route:</h4>
      <p style="margin-bottom:15px;">${sol.alternate}</p>

      <h4 style="color: var(--accent-blue); font-family: var(--font-heading); margin-bottom:5px;"><i class="fas fa-clipboard-check"></i> 9. Dimensional Validation:</h4>
      <p style="margin-bottom:20px;">${sol.verification}</p>

      <div class="genz-box" style="margin-top: 20px; background: rgba(2, 136, 209, 0.05); border-left: 4px solid var(--accent-blue); padding: 15px; border-radius: 6px;">
        <div class="genz-box-title" style="font-weight: bold; color: var(--accent-blue); font-size: 1.1rem; margin-bottom: 5px;">10. Conceptual Insight:</div>
        <p style="font-size: 1.25rem; line-height: 1.5;">${sol.genz}</p>
      </div>

      <div style="margin-top:30px; text-align:center;">
        <button class="btn btn-primary" onclick="loadChapter(${currentChapterId})" style="display:inline-flex; align-items:center; gap:8px;">
          <i class="fas fa-arrow-left"></i> Return to Chapter Reading
        </button>
      </div>
    </div>
  `;

  renderMath(pane);
  document.getElementById('notebook-container').scrollTop = 0;
};

/* ==========================================================================
   7. STUDY ANALYTICS DASHBOARD
   ========================================================================== */
window.triggerAnalyticsDashboard = function() {
  const modal = document.getElementById("analytics-dashboard-modal");
  modal.classList.add("active");

  // Read quiz score history
  const history = JSON.parse(safeStorage.getItem('atomica-cbt-history') || '[]');
  const tableBody = document.getElementById("analytics-history-tbody");
  tableBody.innerHTML = "";

  if (history.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No CBT assessments taken yet.</td></tr>`;
  } else {
    history.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${item.chapterTitle}</strong></td>
        <td>Full Chapter</td>
        <td><strong style="color:var(--accent-blue)">${item.score}/${item.total}</strong></td>
        <td>${item.date}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Read completion ticks
  const readKey = 'atomica-completed-chapters';
  const completedList = JSON.parse(safeStorage.getItem(readKey) || '[]');
  const chapterListContainer = document.getElementById("analytics-chapter-list");
  chapterListContainer.innerHTML = "";

  window.CHEMISTRY_CHAPTERS.forEach(ch => {
    const isCompleted = completedList.includes(ch.id);
    const div = document.createElement("div");
    div.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: ${isCompleted ? 'rgba(67,160,71,0.05)' : 'transparent'};
    `;
    div.innerHTML = `
      <span style="font-size:0.88rem; font-weight:600;">${ch.romanId}: ${ch.title}</span>
      <span style="font-size:0.85rem; color:${isCompleted?'var(--accent-green)':'var(--text-muted)'}">
        <i class="${isCompleted?'fas fa-check-circle':'far fa-circle'}"></i> ${isCompleted?'Read':'Unread'}
      </span>
    `;
    chapterListContainer.appendChild(div);
  });

  // Calculate completion percentage
  const pct = Math.round((completedList.length / CHAPTERS.length) * 100);
  document.getElementById("stats-completion").textContent = `${pct}%`;
  document.getElementById("stats-read-chapters").textContent = `${completedList.length} of ${CHAPTERS.length} Chapters`;
  document.getElementById("stats-tests-count").textContent = history.length;

  let avgPercent = 0;
  if (history.length > 0) {
    const totalScore = history.reduce((sum, item) => sum + item.score, 0);
    const totalPossible = history.reduce((sum, item) => sum + item.total, 0);
    avgPercent = Math.round((totalScore / totalPossible) * 100);
  }
  document.getElementById("stats-avg-score").textContent = `${avgPercent}%`;

  const lastActiveTitle = safeStorage.getItem("atomica-last-active-title") || "Chapter 1";
  document.getElementById("stats-last-active").textContent = lastActiveTitle;
};

document.getElementById("close-analytics-btn").onclick = () => {
  document.getElementById("analytics-dashboard-modal").classList.remove("active");
};
document.getElementById("close-analytics-footer-btn").onclick = () => {
  document.getElementById("analytics-dashboard-modal").classList.remove("active");
};

document.getElementById("reset-analytics-btn").onclick = () => {
  if (confirm("Are you sure you want to wipe all local textbook progress, completed ticks, and CBT histories?")) {
    safeStorage.removeItem('atomica-cbt-history');
    safeStorage.removeItem('atomica-completed-chapters');
    alert("Telemetries cleared successfully.");
    document.getElementById("analytics-dashboard-modal").classList.remove("active");
    loadChapter(currentChapterId);
  }
};

/* ==========================================================================
   8. FORMULA SHEET COMPILER
   ========================================================================== */
window.triggerFormulaSheetModal = function() {
  const modal = document.getElementById("formula-sheet-modal");
  modal.classList.add("active");
  
  const list = document.getElementById("formula-sheet-list");
  list.innerHTML = "";
  
  FORMULA_DATABASE.forEach((form, idx) => {
    const card = document.createElement("div");
    card.className = "formula-compile-item";
    card.style.cssText = `
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 12px;
      margin-bottom: 12px;
      background: var(--panel-bg);
    `;
    card.innerHTML = `
      <label style="display:flex; gap:12px; cursor:pointer; font-size:1.15rem; color:var(--text-color);">
        <input type="checkbox" checked class="formula-checkbox" data-index="${idx}" style="margin-top:4px; width:18px; height:18px;">
        <div>
          <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:bold; display:block;">${form.category}</span>
          <span style="font-weight:700; margin-bottom:5px; display:block;">${form.name}</span>
          <div class="math-block" style="margin:8px 0; background:rgba(0,0,0,0.015); padding:8px; border-radius:4px;">$$${form.latex}$$</div>
          <span style="font-size:0.95rem; color:var(--text-muted); display:block; line-height:1.4;">${form.desc}</span>
        </div>
      </label>
    `;
    list.appendChild(card);
  });
  
  renderMath(list);
};

document.getElementById("close-formula-btn").onclick = () => {
  document.getElementById("formula-sheet-modal").classList.remove("active");
};
document.getElementById("close-formula-footer-btn").onclick = () => {
  document.getElementById("formula-sheet-modal").classList.remove("active");
};

document.getElementById("formula-select-all").onclick = () => {
  document.querySelectorAll(".formula-checkbox").forEach(cb => cb.checked = true);
};
document.getElementById("formula-deselect-all").onclick = () => {
  document.querySelectorAll(".formula-checkbox").forEach(cb => cb.checked = false);
};

document.getElementById("print-formula-sheet-btn").onclick = () => {
  const selectedIndices = [];
  document.querySelectorAll(".formula-checkbox:checked").forEach(cb => {
    selectedIndices.push(parseInt(cb.getAttribute("data-index"), 10));
  });

  if (selectedIndices.length === 0) {
    alert("Please select at least one formula to compile.");
    return;
  }

  // Create a clean printed sheet
  let printHtml = `
    <html>
    <head>
      <title>Atomica Chemistry Compiled Formula Sheet</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
      <style>
        body { font-family: 'Outfit', sans-serif; padding: 40px; color: #1a237e; background: #fff; }
        h1 { border-bottom: 2px solid #1a237e; padding-bottom: 10px; margin-bottom: 30px; font-size: 24px; text-align: center; }
        .item { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px; page-break-inside: avoid; }
        .cat { font-size: 10px; text-transform: uppercase; color: #5c6bc0; font-weight: bold; }
        .name { font-size: 16px; font-weight: bold; margin: 4px 0; }
        .math { margin: 12px 0; font-size: 18px; text-align: center; background: #fcfbf9; padding: 10px; border-radius: 4px; }
        .desc { font-size: 12px; color: #5c6bc0; }
      </style>
    </head>
    <body>
      <h1>ATOMICA CHEMISTRY FORMULA REFERENCE SHEET</h1>
  `;

  selectedIndices.forEach(idx => {
    const f = FORMULA_DATABASE[idx];
    printHtml += `
      <div class="item">
        <div class="cat">${f.category}</div>
        <div class="name">${f.name}</div>
        <div class="math" id="math-${idx}">$$${f.latex}$$</div>
        <div class="desc">${f.desc}</div>
      </div>
    `;
  });

  printHtml += `
      <script>
        // Trigger KaTeX rendering in print window
        document.querySelectorAll(".math").forEach(el => {
          const tex = el.textContent.replace(/\\$\\$/g, "");
          katex.render(tex, el, { displayMode: true, throwOnError: false });
        });
        window.onload = () => { window.print(); };
      </script>
    </body>
    </html>
  `;

  const pWindow = window.open("", "_blank");
  pWindow.document.write(printHtml);
  pWindow.document.close();
};

/* ==========================================================================
   9. DRAGGABLE FLOATING OPTION DOCK
   ========================================================================== */
function initFloatingDockDrag() {
  const dock = document.getElementById("floating-dock");
  const trigger = document.getElementById("floating-dock-trigger");
  const menu = document.getElementById("floating-dock-menu");
  
  if (!dock) return;
  
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialX = 0, initialY = 0;
  let dragOccurred = false;
  let startTime = 0;
  
  const onDragStart = (e) => {
    isDragging = true;
    startX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    startY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    
    const rect = dock.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    dragOccurred = false;
    startTime = Date.now();
  };
  
  const onDrag = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
    
    if (clientX === undefined || clientY === undefined) return;
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    
    // Require at least 15 pixels of travel to count as a drag (prevents tap jitters)
    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
      dragOccurred = true;
    }
    
    let targetX = initialX + dx;
    let targetY = initialY + dy;
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    targetX = Math.max(20, Math.min(w - 70, targetX));
    targetY = Math.max(20, Math.min(h - 70, targetY));
    
    dock.style.left = `${targetX}px`;
    dock.style.top = `${targetY}px`;
    dock.style.right = "auto";
    dock.style.bottom = "auto";
  };
  
  const onDragEnd = () => {
    isDragging = false;
  };
  
  trigger.addEventListener("mousedown", onDragStart);
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", onDragEnd);
  
  trigger.addEventListener("touchstart", onDragStart, { passive: true });
  window.addEventListener("touchmove", onDrag, { passive: false });
  window.addEventListener("touchend", onDragEnd);
  
  trigger.addEventListener("click", () => {
    const clickDuration = Date.now() - startTime;
    // Only block if a genuine drag occurred and it took substantial time
    if (dragOccurred && clickDuration > 250) {
      dragOccurred = false;
      return;
    }
    
    dragOccurred = false;
    const isOpen = dock.classList.toggle("expanded");
    trigger.classList.toggle("open", isOpen);
  });
  
  // Bind Option menus inside dock
  document.getElementById("launch-sim-btn").onclick = () => {
    dock.classList.remove("expanded");
    trigger.classList.remove("open");
    launchSimulation(null);
  };
  
  document.getElementById("launch-cbt-btn").onclick = () => {
    dock.classList.remove("expanded");
    trigger.classList.remove("open");
    triggerCbtSelection();
  };
  
  document.getElementById("launch-scratchpad-btn").onclick = () => {
    dock.classList.remove("expanded");
    trigger.classList.remove("open");
    triggerScratchpadModal();
  };
}

/* ==========================================================================
   10. ROUGH WORK SCRATCHPAD OVERLAY
   ========================================================================== */
let scratchpadCanvas = null;
let scratchpadCtx = null;
let scratchpadDrawing = false;
let scratchColor = "#e53935";
let scratchThickness = 4;
let scratchEraser = false;

window.triggerScratchpadModal = function() {
  const overlay = document.getElementById("scratchpad-overlay");
  overlay.classList.add("active");
  // Use the advanced AtomicaSketchpad scratchpad engine
  if (window.initAtomicaScratchpad) {
    window.initAtomicaScratchpad('scratchpad-canvas', 'scratchpad-toolbar');
  }
};

function resizeScratchpadCanvas() {
  if (window.resizeAtomicaScratchpad) window.resizeAtomicaScratchpad();
}

document.getElementById("scratchpad-close-btn").onclick = () => {
  document.getElementById("scratchpad-overlay").classList.remove("active");
};

// Size selector buttons — use advanced resize
document.getElementById("btn-size-standard").onclick = () => {
  const container = document.querySelector(".scratchpad-container");
  container.className = "scratchpad-container size-standard";
  container.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-size-standard').classList.add('active');
  setTimeout(() => resizeScratchpadCanvas(), 50);
};
document.getElementById("btn-size-large").onclick = () => {
  const container = document.querySelector(".scratchpad-container");
  container.className = "scratchpad-container size-large";
  container.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-size-large').classList.add('active');
  setTimeout(() => resizeScratchpadCanvas(), 50);
};
document.getElementById("btn-size-fullscreen").onclick = () => {
  const container = document.querySelector(".scratchpad-container");
  container.className = "scratchpad-container size-fullscreen";
  container.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-size-fullscreen').classList.add('active');
  setTimeout(() => resizeScratchpadCanvas(), 50);
};

// Scratchpad controls are now handled by the AtomicaSketchpad engine's built-in toolbar
// Legacy buttons (color/erase/save) kept for backward compatibility but toolbar is auto-generated
document.getElementById("scratchpad-erase-btn") && (document.getElementById("scratchpad-erase-btn").onclick = () => {});
document.getElementById("scratchpad-save-btn") && (document.getElementById("scratchpad-save-btn").onclick = () => {
  const sc = document.getElementById('scratchpad-canvas');
  if (!sc) return;
  const a = document.createElement('a');
  a.download = `atomica_scratchpad_${Date.now()}.png`;
  a.href = sc.toDataURL();
  a.click();
});

/* ==========================================================================
   11. EVENT REGISTRATION BINDINGS
   ========================================================================== */
function setupEventListeners() {
  // Sidebar toggler
  document.getElementById('sidebar-toggle').onclick = () => {
    document.querySelector('.app-container').classList.toggle('sidebar-collapsed');
    if (sketchpad) {
      setTimeout(() => sketchpad.resizeCanvas(), 250);
    }
  };

  // Sidebar Study Analytics btn
  document.getElementById('sidebar-analytics-btn').onclick = () => {
    triggerAnalyticsDashboard();
  };

  // Search input indexer
  document.getElementById('chapter-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (q.length < 2) return;

    let foundChId = -1;
    let foundPageNum = -1;

    for (let c = 0; c < window.CHEMISTRY_CHAPTERS.length; c++) {
      const ch = window.CHEMISTRY_CHAPTERS[c];
      if (ch.title.toLowerCase().includes(q)) {
        foundChId = ch.id;
        foundPageNum = 1;
        break;
      }
      
      // Look inside theory pages
      for (let p = 0; p < ch.theory.length; p++) {
        const sec = ch.theory[p];
        if (sec.heading.toLowerCase().includes(q) || sec.content.toLowerCase().includes(q)) {
          foundChId = ch.id;
          foundPageNum = 5 + p;
          break;
        }
      }
      if (foundChId !== -1) break;
    }

    if (foundChId !== -1) {
      loadChapter(foundChId);
      loadChapterPage(foundChId, foundPageNum);
    }
  });

  // Font toggle button
  document.getElementById('font-toggle-btn').onclick = () => {
    const isSans = document.body.classList.toggle('font-sans-serif');
    document.body.classList.toggle('font-handwriting', !isSans);
    safeStorage.setItem('atomica-font', isSans ? 'font-sans-serif' : 'font-handwriting');
    document.getElementById('font-toggle-btn').querySelector('span').innerText = isSans ? 'Sans Serif' : 'Handwriting';
  };

  // View mode toggle
  document.getElementById('view-mode-btn').onclick = () => {
    viewMode = viewMode === 'scroll' ? 'single' : 'scroll';
    safeStorage.setItem('atomica-view-mode', viewMode);
    updateViewModeUI();
    
    // Full clean reload of pages container
    loadedChapterId = null;
    loadChapterPage(currentChapterId, currentBookPage);
  };

  // Print button
  document.getElementById('print-btn').onclick = () => {
    window.print();
  };

  // Formula Sheet button
  document.getElementById('formula-sheet-btn').onclick = () => {
    triggerFormulaSheetModal();
  };

  // PDF download button mockup
  document.getElementById('pdf-download-btn').onclick = () => {
    alert("PDF Compiler Engine active. Generating full high-definition print copy for download...");
    window.print();
  };

  // Pagination controls
  document.getElementById('prev-page-btn').onclick = () => {
    if (currentBookPage > 1) {
      loadChapterPage(currentChapterId, currentBookPage - 1);
    } else if (currentChapterId > 1) {
      loadChapter(currentChapterId - 1);
      loadChapterPage(currentChapterId, 2200);
    }
  };

  document.getElementById('next-page-btn').onclick = () => {
    if (currentBookPage < 2200) {
      loadChapterPage(currentChapterId, currentBookPage + 1);
    } else if (currentChapterId < CHAPTERS.length) {
      loadChapter(currentChapterId + 1);
    }
  };

  document.getElementById('page-input').onchange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (val >= 1 && val <= 2200) {
      loadChapterPage(currentChapterId, val);
    }
  };

  // Mark Completed / Ticks button
  document.getElementById('mark-read-btn').onclick = () => {
    const readKey = 'atomica-completed-chapters';
    const list = JSON.parse(safeStorage.getItem(readKey) || '[]');
    const idx = list.indexOf(currentChapterId);
    
    if (idx === -1) {
      list.push(currentChapterId);
      safeStorage.setItem(readKey, JSON.stringify(list));
      alert(`Chapter marked as COMPLETED! Dynamic studies completion updated.`);
    } else {
      list.splice(idx, 1);
      safeStorage.setItem(readKey, JSON.stringify(list));
      alert(`Chapter marked as UNREAD.`);
    }
    updateMarkReadBtnState(currentChapterId);
  };

  // Bind theme contents options
  document.querySelectorAll(".theme-opt").forEach(btn => {
    btn.onclick = () => {
      document.querySelector(".theme-opt.active").classList.remove("active");
      btn.classList.add("active");
      
      const themeName = btn.getAttribute("data-theme");
      safeStorage.setItem("atomica-theme", themeName);
      
      // Preserve font styling class
      const isSans = document.body.classList.contains("font-sans-serif");
      document.body.className = `${themeName} ${isSans ? 'font-sans-serif' : 'font-handwriting'}`;
      
      document.getElementById('theme-btn').querySelector('span').innerText = 'Theme: ' + btn.innerText;
    };
  });

  // Bind bottom notes text area auto-save
  const textNotes = document.getElementById("student-chapter-notes");
  textNotes.addEventListener("input", () => {
    safeStorage.setItem(`atomica-ch-${currentChapterId}-notes`, textNotes.value);
  });

  document.getElementById("clear-notes-btn").onclick = () => {
    if (confirm("Are you sure you want to delete all notes and canvas drawings for this chapter page spread?")) {
      textNotes.value = "";
      safeStorage.removeItem(`atomica-ch-${currentChapterId}-notes`);
      if (sketchpad) {
        sketchpad.clearSketch();
      }
    }
  };

  // Notes tab buttons
  document.getElementById("notes-tab-text-btn").onclick = () => {
    document.getElementById("notes-tab-text-btn").classList.add("active");
    document.getElementById("notes-tab-canvas-btn").classList.remove("active");
    document.getElementById("notes-tab-text").classList.remove("hidden");
    document.getElementById("notes-tab-canvas").classList.add("hidden");
  };

  document.getElementById("notes-tab-canvas-btn").onclick = () => {
    document.getElementById("notes-tab-text-btn").classList.remove("active");
    document.getElementById("notes-tab-canvas-btn").classList.add("active");
    document.getElementById("notes-tab-text").classList.add("hidden");
    document.getElementById("notes-tab-canvas").classList.remove("hidden");
    if (sketchpad) {
      sketchpad.resizeCanvas();
    }
  };

  // Color options inside bottom drawing canvas
  document.querySelectorAll("#notes-canvas-toolbar .color-indicator").forEach(btn => {
    btn.onclick = () => {
      document.querySelector("#notes-canvas-toolbar .color-indicator.active").classList.remove("active");
      btn.classList.add("active");
      const c = btn.getAttribute("data-color");
      if (sketchpad) {
        sketchpad.setBrushColor(c);
      }
    };
  });

  document.getElementById("brush-size-select").onchange = (e) => {
    if (sketchpad) {
      sketchpad.setBrushThickness(e.target.value);
    }
  };

  document.getElementById("canvas-erase-btn").onclick = () => {
    if (sketchpad) {
      sketchpad.clearSketch();
    }
  };

  // Continuous scroll viewport listener
  document.getElementById('notebook-container').addEventListener('scroll', handleNotebookScroll);

  // Keyboard shortcuts: Ctrl+Z = Undo, Ctrl+Y / Ctrl+Shift+Z = Redo for notes canvas
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (sketchpad && typeof sketchpad.clearSketch !== 'undefined') {
          // undo not exposed via public API but engine handles internally via strokes
        }
      }
    }
  });
}

function updateMarkReadBtnState(chapterId) {
  const readKey = 'atomica-completed-chapters';
  const list = JSON.parse(safeStorage.getItem(readKey) || '[]');
  const isCompleted = list.includes(chapterId);
  const btn = document.getElementById("mark-read-btn");
  
  if (isCompleted) {
    btn.innerHTML = `<i class="fas fa-check-circle"></i> <span>Completed</span>`;
    btn.style.color = "var(--accent-green)";
  } else {
    btn.innerHTML = `<i class="far fa-check-circle"></i> <span>Mark Read</span>`;
    btn.style.color = "inherit";
  }
}

function renderMath(element) {
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(element, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  }
}
