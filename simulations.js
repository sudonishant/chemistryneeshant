/* ==========================================================================
   Atomica: Virtual Laboratories Engine
   ========================================================================== */

const VirtualLabs = {
  activeAnimationId: null,
  activeLab: null,

  // General visual cleanup
  cleanupActiveLab() {
    if (this.activeAnimationId) {
      cancelAnimationFrame(this.activeAnimationId);
      this.activeAnimationId = null;
    }
    if (this.activeLab && this.activeLab.destroy) {
      this.activeLab.destroy();
    }
    this.activeLab = null;
  },

  // Launcher entrypoint
  loadLab(sim, canvas, controlsContainer) {
    this.cleanupActiveLab();
    
    let labId = typeof sim === 'string' ? sim : (sim.labId || 'molecular');
    console.log(`Launching virtual laboratory: ${labId}`);
    
    switch(labId) {
      case "titration":
        this.activeLab = new AcidBaseTitrationLab(canvas, controlsContainer);
        break;
      case "bohr":
        this.activeLab = new BohrSpectroscopyLab(canvas, controlsContainer);
        break;
      case "gas_chamber":
        this.activeLab = new GasChamberLab(canvas, controlsContainer);
        break;
      case "rutherford":
        this.activeLab = new RutherfordScatteringLab(canvas, controlsContainer);
        break;
      case "kinetics":
        this.activeLab = new KineticsCollisionLab(canvas, controlsContainer);
        break;
      case "le_chatelier":
        this.activeLab = new LeChatelierLab(canvas, controlsContainer);
        break;
      case "flame_test":
        this.activeLab = new FlameTestLab(canvas, controlsContainer);
        break;
      case "salt_analyzer":
        this.activeLab = new SaltAnalyzerLab(canvas, controlsContainer, sim);
        break;
      case "galvanic_cell":
        this.activeLab = new GalvanicCellLab(canvas, controlsContainer);
        break;
      case "beer_lambert":
        this.activeLab = new BeerLambertLab(canvas, controlsContainer, sim);
        break;
      case "radioactive_decay":
        this.activeLab = new RadioactiveDecayLab(canvas, controlsContainer);
        break;
      case "stoichiometry_lab":
        this.activeLab = new StoichiometryLab(canvas, controlsContainer, sim);
        break;
      case "solution_mixer":
        this.activeLab = new SolutionMixerLab(canvas, controlsContainer, sim);
        break;
      case "molecule_viewer":
        this.activeLab = new StandalonePlotterLab(canvas, controlsContainer, sim);
        break;
      case "orbital_viewer":
        this.activeLab = new OrbitalViewerLab(canvas, controlsContainer, sim);
        break;
      case "graph_plotter":
        this.activeLab = new StandalonePlotterLab(canvas, controlsContainer, sim);
        break;
      default:
        // Default structural plotter lab
        this.activeLab = new StandalonePlotterLab(canvas, controlsContainer, sim);
        break;
    }
    
    this.activeLab.init();
    
    // Launch standard render tick loop
    const tick = (timestamp) => {
      if (this.activeLab) {
        this.activeLab.render();
        this.activeAnimationId = requestAnimationFrame(tick);
      }
    };
    this.activeAnimationId = requestAnimationFrame(tick);
  }
};

// ==========================================================================
// 1. ACID-BASE TITRATION LABORATORY
// ==========================================================================
class AcidBaseTitrationLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.volBase = 0.0; // ml of NaOH added
    this.acidMolarity = 0.1;
    this.baseMolarity = 0.1;
    this.volAcid = 25.0; // mL
    this.indicator = "phenolphthalein";
    this.isDropping = false;
    this.dropY = 120;
    this.pH = 1.0;
    
    this.solver = new TitrationCurveVisualizer(canvas);
  }
  
  init() {
    // Generate UI Controls dynamically
    this.controls.innerHTML = `
      <h3 class="sim-section-title">Reagent Settings</h3>
      <div class="sim-control-group">
        <div class="sim-label">Solvent Acid Conc: <span class="sim-value-label" id="lbl-acid-conc">0.10 M</span></div>
        <input type="range" class="sim-slider" id="slider-acid-conc" min="0.05" max="0.5" step="0.05" value="0.10">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Titrant Base Conc: <span class="sim-value-label" id="lbl-base-conc">0.10 M</span></div>
        <input type="range" class="sim-slider" id="slider-base-conc" min="0.05" max="0.5" step="0.05" value="0.10">
      </div>
      
      <h3 class="sim-section-title">Chemical Indicator</h3>
      <div class="sim-control-group">
        <label for="select-indicator" class="visually-hidden" style="display:none;">Choose Indicator</label>
        <select class="theme-dropdown" id="select-indicator" style="width:100%">
          <option value="phenolphthalein" selected>Phenolphthalein (pH 8.2 - 10)</option>
          <option value="methyl_orange">Methyl Orange (pH 3.1 - 4.4)</option>
          <option value="bromothymol_blue">Bromothymol Blue (pH 6.0 - 7.6)</option>
        </select>
      </div>

      <h3 class="sim-section-title">Dispense Control</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button class="control-btn accent" id="btn-titrate-add">Add 1.0 mL</button>
        <button class="control-btn" id="btn-titrate-toggle">Drop Stream</button>
      </div>
      <button class="control-btn" id="btn-titrate-reset" style="width:100%; border-color:var(--reaction-red);">Reset Lab</button>
      
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Base Added:</span><span id="read-vol-base">0.0 mL</span></div>
        <div class="sim-readout-row"><span>Solution pH:</span><span id="read-ph" style="color:var(--atomic-teal); font-weight:bold;">1.00</span></div>
      </div>
    `;
    
    // Bind listeners
    document.getElementById("slider-acid-conc").addEventListener("input", (e) => {
      this.acidMolarity = parseFloat(e.target.value);
      document.getElementById("lbl-acid-conc").textContent = `${this.acidMolarity.toFixed(2)} M`;
      this.updateChemicalPH();
    });
    
    document.getElementById("slider-base-conc").addEventListener("input", (e) => {
      this.baseMolarity = parseFloat(e.target.value);
      document.getElementById("lbl-base-conc").textContent = `${this.baseMolarity.toFixed(2)} M`;
      this.updateChemicalPH();
    });
    
    document.getElementById("select-indicator").addEventListener("change", (e) => {
      this.indicator = e.target.value;
    });
    
    document.getElementById("btn-titrate-add").addEventListener("click", () => {
      this.volBase = Math.min(50.0, this.volBase + 1.0);
      this.updateChemicalPH();
    });
    
    const streamBtn = document.getElementById("btn-titrate-toggle");
    streamBtn.addEventListener("click", () => {
      this.isDropping = !this.isDropping;
      streamBtn.textContent = this.isDropping ? "Stop Stream" : "Drop Stream";
      streamBtn.classList.toggle("accent");
    });
    
    document.getElementById("btn-titrate-reset").addEventListener("click", () => {
      this.volBase = 0.0;
      this.isDropping = false;
      streamBtn.textContent = "Drop Stream";
      streamBtn.classList.remove("accent");
      this.updateChemicalPH();
    });
    
    this.updateChemicalPH();
  }
  
  updateChemicalPH() {
    this.pH = this.solver.calculatePH(this.volBase, this.acidMolarity, this.baseMolarity, this.volAcid, 1.0);
    document.getElementById("read-vol-base").textContent = `${this.volBase.toFixed(1)} mL`;
    document.getElementById("read-ph").textContent = this.pH.toFixed(2);
  }
  
  getIndicatorColor() {
    const pH = this.pH;
    // CSS transparency hex variables or hsla matching standard lab indicators
    if (this.indicator === "phenolphthalein") {
      if (pH < 8.2) return "rgba(255,255,255,0.05)"; // Colorless acid
      if (pH >= 10.0) return "rgba(255, 51, 102, 0.6)"; // Bright Magenta
      // Intermediate gradient
      const alpha = (pH - 8.2) / 1.8 * 0.55;
      return `rgba(255, 51, 102, ${0.05 + alpha})`;
    } 
    else if (this.indicator === "methyl_orange") {
      if (pH < 3.1) return "rgba(231, 76, 60, 0.55)"; // Red
      if (pH >= 4.4) return "rgba(241, 196, 15, 0.55)"; // Yellow
      // Intermediate Orange
      const factor = (pH - 3.1) / 1.3;
      const r = Math.round(231 + (241 - 231) * factor);
      const g = Math.round(76 + (196 - 76) * factor);
      return `rgba(${r}, ${g}, 30, 0.55)`;
    } 
    else { // Bromothymol Blue
      if (pH < 6.0) return "rgba(241, 196, 15, 0.55)"; // Acid yellow
      if (pH >= 7.6) return "rgba(41, 128, 185, 0.55)"; // Basic Blue
      // Intermediate green
      const factor = (pH - 6.0) / 1.6;
      const g = Math.round(196 + (128 - 196) * factor);
      return `rgba(39, ${g}, 96, 0.55)`;
    }
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Chemistry Drop Stream increments
    if (this.isDropping) {
      this.volBase = Math.min(50.0, this.volBase + 0.08);
      this.updateChemicalPH();
      
      // Update drop animation
      this.dropY += 8;
      if (this.dropY > 230) {
        this.dropY = 120; // reset to burette tap
      }
    } else {
      this.dropY = 120;
    }
    
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);
    
    // Draw Bench stand
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(100, 390);
    ctx.lineTo(240, 390);
    ctx.moveTo(170, 390);
    ctx.lineTo(170, 40);
    ctx.stroke();
    
    // Draw clamps
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(170, 100);
    ctx.lineTo(135, 100);
    ctx.moveTo(170, 260);
    ctx.lineTo(135, 260);
    ctx.stroke();
    
    // Draw Burette tube (filled based on NaOH level)
    const basePct = (50 - this.volBase) / 50;
    ctx.fillStyle = "rgba(0, 242, 254, 0.25)";
    ctx.fillRect(125, 60 + (100 * (1 - basePct)), 10, 100 * basePct);
    
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(125, 60, 10, 100);
    
    // Burette lines
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let l = 0; l <= 10; l++) {
      ctx.beginPath();
      ctx.moveTo(125, 60 + l * 10);
      ctx.lineTo(131, 60 + l * 10);
      ctx.stroke();
    }
    
    // Draw burette tip and tap
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(130, 160);
    ctx.lineTo(130, 185);
    ctx.stroke();
    // Tap nozzle
    ctx.fillStyle = this.isDropping ? "var(--reaction-red)" : "var(--acid-green)";
    ctx.fillRect(126, 170, 8, 4);
    
    // Droplet animation
    if (this.isDropping) {
      ctx.fillStyle = "rgba(0, 242, 254, 0.6)";
      ctx.beginPath();
      ctx.arc(130, this.dropY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw Erlenmeyer Flask (solvent beaker)
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(110, 240);
    ctx.lineTo(150, 240); // Rim
    ctx.lineTo(150, 260); // Neck
    ctx.lineTo(190, 340); // Side
    ctx.lineTo(70, 340);  // Bottom
    ctx.lineTo(110, 260);
    ctx.closePath();
    ctx.stroke();
    
    // Liquid fill inside flask matching indicator color
    const liqColor = this.getIndicatorColor();
    ctx.fillStyle = liqColor;
    ctx.beginPath();
    ctx.moveTo(115, 270);
    ctx.lineTo(145, 270);
    ctx.lineTo(180, 338);
    ctx.lineTo(80, 338);
    ctx.closePath();
    ctx.fill();
    
    // Draw Magnetic stirrer bar rotating inside liquid
    const theta = (Date.now() / 100) % (Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(130 - Math.cos(theta) * 12, 330);
    ctx.lineTo(130 + Math.cos(theta) * 12, 330);
    ctx.stroke();
    
    // Draw the pH Titration Curve Real-time graph on the right of canvas
    ctx.save();
    ctx.translate(280, 50);
    
    // Graph boundary
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 360, 300);
    
    // Graph axis helper tags
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText("pH 14", -32, 10);
    ctx.fillText("pH 7", -32, 150);
    ctx.fillText("pH 0", -32, 290);
    ctx.fillText("Vol NaOH added (mL)", 100, 318);
    
    // Draw sigmoid pH curve
    ctx.strokeStyle = "var(--atomic-teal)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let ml = 0; ml <= 50; ml += 0.5) {
      const gPH = this.solver.calculatePH(ml, this.acidMolarity, this.baseMolarity, this.volAcid, 1.0);
      const gx = (ml / 50) * 360;
      const gy = 300 - (gPH / 14) * 300;
      if (ml === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.stroke();
    
    // Glowing tracker node representing the current volume
    const currentGx = (this.volBase / 50) * 360;
    const currentGy = 300 - (this.pH / 14) * 300;
    ctx.fillStyle = "var(--reaction-red)";
    ctx.beginPath();
    ctx.arc(currentGx, currentGy, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  destroy() {
    this.isDropping = false;
  }
}

// ==========================================================================
// 2. BOHR ATOMIC SPECTROSCOPY LABORATORY
// ==========================================================================
class BohrSpectroscopyLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.ni = 3;
    this.nf = 2;
    
    this.electronAngle = 0.0;
    this.activeOrbit = 3;
    this.isTransitioning = false;
    this.photonWave = null;
    this.spectralLines = []; // Captured historical wavelengths
  }
  
  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">Quantum Levels</h3>
      <div class="sim-control-group">
        <label for="sel-bohr-ni" class="sim-label">Initial Orbit (n_initial)</label>
        <select class="theme-dropdown" id="sel-bohr-ni" style="width:100%">
          <option value="6">n = 6</option>
          <option value="5">n = 5</option>
          <option value="4">n = 4</option>
          <option value="3" selected>n = 3</option>
          <option value="2">n = 2</option>
        </select>
      </div>
      <div class="sim-control-group">
        <label for="sel-bohr-nf" class="sim-label">Target Orbit (n_final)</label>
        <select class="theme-dropdown" id="sel-bohr-nf" style="width:100%">
          <option value="3">n = 3</option>
          <option value="2" selected>n = 2 (Balmer Series)</option>
          <option value="1">n = 1 (Lyman Series)</option>
        </select>
      </div>
      
      <button class="control-btn accent" id="btn-bohr-jump" style="width:100%; margin-top:10px;">Trigger Transition Orbit Jump</button>
      <button class="control-btn" id="btn-bohr-clear" style="width:100%; border-color:var(--reaction-red);">Clear Spectral Plates</button>
      
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Energy Released:</span><span id="bohr-read-energy">-- eV</span></div>
        <div class="sim-readout-row"><span>Wavelength (λ):</span><span id="bohr-read-wl" style="color:var(--copper-orange); font-weight:bold;">-- nm</span></div>
      </div>
    `;
    
    const niSelect = document.getElementById("sel-bohr-ni");
    const nfSelect = document.getElementById("sel-bohr-nf");
    
    niSelect.addEventListener("change", (e) => {
      this.ni = parseInt(e.target.value, 10);
      this.activeOrbit = this.ni;
    });
    nfSelect.addEventListener("change", (e) => {
      this.nf = parseInt(e.target.value, 10);
    });
    
    document.getElementById("btn-bohr-jump").addEventListener("click", () => {
      this.triggerTransition();
    });
    
    document.getElementById("btn-bohr-clear").addEventListener("click", () => {
      this.spectralLines = [];
    });
    
    this.activeOrbit = this.ni;
  }
  
  triggerTransition() {
    if (this.isTransitioning || this.nf >= this.ni) return;
    this.isTransitioning = true;
    
    const R_H = 1.09737e7;
    const invLambda = R_H * (1 / (this.nf * this.nf) - 1 / (this.ni * this.ni));
    const lambda_nm = (1 / invLambda) * 1e9;
    const energy_ev = 13.6 * (1 / (this.nf * this.nf) - 1 / (this.ni * this.ni));
    
    document.getElementById("bohr-read-energy").textContent = `${energy_ev.toFixed(2)} eV`;
    document.getElementById("bohr-read-wl").textContent = `${lambda_nm.toFixed(1)} nm`;
    
    // Electron visual decay transition timeline
    let currentOrbitRadius = this.ni;
    const interval = setInterval(() => {
      this.activeOrbit -= 0.05;
      if (this.activeOrbit <= this.nf) {
        this.activeOrbit = this.nf;
        clearInterval(interval);
        this.isTransitioning = false;
        
        // Trigger a photon sine-wave ejection
        this.photonWave = {
          x: 180, y: 220,
          dx: Math.cos(-0.5) * 6,
          dy: Math.sin(-0.5) * 6,
          waveOffset: 0,
          wavelength: lambda_nm,
          color: this.getWavelengthColor(lambda_nm)
        };
        
        // Capture line on spectral strip
        if (!this.spectralLines.includes(lambda_nm)) {
          this.spectralLines.push(lambda_nm);
        }
      }
    }, 15);
  }
  
  getWavelengthColor(wl) {
    // Return approximate CSS color representing the emitted wavelength
    if (wl < 400) return "rgba(168, 85, 247, 0.4)"; // UV
    if (wl >= 400 && wl < 440) return "#8b5cf6"; // Violet
    if (wl >= 440 && wl < 490) return "#3b82f6"; // Blue/Teal
    if (wl >= 490 && wl < 560) return "#10b981"; // Green
    if (wl >= 560 && wl < 590) return "#f59e0b"; // Yellow
    if (wl >= 590 && wl < 630) return "#f97316"; // Orange
    if (wl >= 630 && wl <= 700) return "#ef4444"; // Red
    return "rgba(239, 68, 68, 0.35)"; // Infrared
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);
    
    // Draw Rutherford orbital center nucleus
    ctx.fillStyle = "var(--reaction-red)";
    ctx.beginPath();
    ctx.arc(180, 220, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "var(--reaction-red)";
    
    // Draw concentric orbits (n=1 to n=5)
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    for (let orbit = 1; orbit <= 5; orbit++) {
      const radius = orbit * 32;
      ctx.strokeStyle = orbit === this.ni ? "rgba(0, 242, 254, 0.4)" : "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.arc(180, 220, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Animate and draw orbital electron
    this.electronAngle += 0.035;
    const eRadius = this.activeOrbit * 32;
    const ex = 180 + Math.cos(this.electronAngle) * eRadius;
    const ey = 220 + Math.sin(this.electronAngle) * eRadius;
    
    ctx.fillStyle = "var(--atomic-teal)";
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 8;
    ctx.shadowColor = "var(--atomic-teal)";
    
    ctx.shadowBlur = 0; // Reset
    
    // Animate and draw photon release packet
    if (this.photonWave) {
      const p = this.photonWave;
      p.x += p.dx;
      p.y += p.dy;
      p.waveOffset += 0.3;
      
      // Draw sine-wave packet
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const offsetDist = i - 20;
        const wx = p.x + (p.dx / 6) * offsetDist;
        const wy = p.y + (p.dy / 6) * offsetDist;
        const sineShift = Math.sin(i * 0.5 - p.waveOffset) * 12;
        
        // Orthogonal vector offset for sine displacement
        const ox = (-p.dy / 6) * sineShift;
        const oy = (p.dx / 6) * sineShift;
        
        if (i === 0) ctx.moveTo(wx + ox, wy + oy);
        else ctx.lineTo(wx + ox, wy + oy);
      }
      ctx.stroke();
      
      // Clean up offscreen photon
      if (p.x > w || p.y < 0 || p.x < 0 || p.y > h) {
        this.photonWave = null;
      }
    }
    
    // ==========================================
    // DRAW HYDROGEN SPECTRUM PLATE (Balmer / Lyman strip)
    // ==========================================
    ctx.save();
    ctx.translate(390, 60);
    
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px 'Outfit', sans-serif";
    ctx.fillText("HYDROGEN EMISSION SPECTRUM", 0, -10);
    
    // Dark strip plate
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 260, 100);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 260, 100);
    
    // Scale: maps standard wavelengths 380nm to 750nm (visible range) to 0-260px
    const mapWavelengthToPx = (wl) => {
      if (wl < 380) return 10; // UV cap
      if (wl > 750) return 250; // IR cap
      return 260 * (1 - (wl - 380) / (750 - 380));
    };
    
    // Draw background rainbow reference spectrum with low opacity
    for (let x = 0; x < 260; x++) {
      const wl = 380 + (x / 260) * (750 - 380);
      ctx.fillStyle = this.getWavelengthColor(wl);
      ctx.fillRect(260 - x, 0, 1, 100);
    }
    // Dark overlay to dim rainbow
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, 260, 100);
    
    // Draw historical emission lines
    this.spectralLines.forEach(lineWl => {
      const px = mapWavelengthToPx(lineWl);
      ctx.strokeStyle = this.getWavelengthColor(lineWl);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, 100);
      ctx.stroke();
      
      // Label text
      ctx.fillStyle = "#ffffff";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.save();
      ctx.translate(px - 3, 85);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${lineWl.toFixed(0)}nm`, 0, 0);
      ctx.restore();
    });
    
    // Scale ticks
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px 'JetBrains Mono'";
    ctx.fillText("380nm", 0, 115);
    ctx.fillText("750nm", 225, 115);
    
    ctx.restore();
  }
  
  destroy() {
    this.spectralLines = [];
  }
}

// ==========================================================================
// 3. IDEAL VS. REAL GAS CHAMBER LABORATORY
// ==========================================================================
class GasChamberLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    
    this.volume = 4.0; // Liters (slider)
    this.temp = 300.0; // Kelvin (slider)
    this.particles = [];
    this.numParticles = 40;
    
    this.initParticles();
  }
  
  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">Chamber States</h3>
      <div class="sim-control-group">
        <div class="sim-label">Piston Volume: <span class="sim-value-label" id="lbl-gas-vol">4.0 L</span></div>
        <input type="range" class="sim-slider" id="slider-gas-vol" min="1.0" max="6.0" step="0.1" value="4.0">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Temperature: <span class="sim-value-label" id="lbl-gas-temp">300 K</span></div>
        <input type="range" class="sim-slider" id="slider-gas-temp" min="100" max="600" step="10" value="300">
      </div>
      
      <h3 class="sim-section-title">Solvers Readout</h3>
      <div class="sim-readout-card">
        <div class="sim-readout-row">
          <span>Ideal Gas P:</span>
          <span style="color:var(--atomic-teal); font-weight:bold;" id="lbl-ideal-p">-- atm</span>
        </div>
        <div class="sim-readout-row">
          <span>van der Waals P:</span>
          <span style="color:var(--reaction-red); font-weight:bold;" id="lbl-real-p">-- atm</span>
        </div>
      </div>
    `;
    
    document.getElementById("slider-gas-vol").addEventListener("input", (e) => {
      this.volume = parseFloat(e.target.value);
      document.getElementById("lbl-gas-vol").textContent = `${this.volume.toFixed(1)} L`;
    });
    
    document.getElementById("slider-gas-temp").addEventListener("input", (e) => {
      this.temp = parseFloat(e.target.value);
      document.getElementById("lbl-gas-temp").textContent = `${this.temp.toFixed(0)} K`;
      this.adjustParticleVelocities();
    });
    
    this.adjustParticleVelocities();
  }
  
  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: 40 + Math.random() * 200,
        y: 80 + Math.random() * 250,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        r: 4
      });
    }
  }
  
  adjustParticleVelocities() {
    // Velocity scales with square root of temperature (kinetic molecular theory v ~ sqrt(T))
    const scale = Math.sqrt(this.temp / 300.0) * 1.5;
    this.particles.forEach(p => {
      const angle = Math.random() * Math.PI * 2;
      p.vx = Math.cos(angle) * scale;
      p.vy = Math.sin(angle) * scale;
    });
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);
    
    // Gas Chamber boundaries
    // X boundary is fixed: 30 to 290
    // Top boundary is adjusted by volume (piston head)
    const chamberLeft = 30;
    const chamberRight = 290;
    const chamberBottom = 380;
    // Map volume 1.0 to 6.0 liters to piston Y coordinate
    const pistonY = 380 - (this.volume / 6.0) * 300;
    
    // Draw Gas Chamber Stand
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(chamberLeft - 5, pistonY - 20);
    ctx.lineTo(chamberLeft - 5, chamberBottom + 5);
    ctx.lineTo(chamberRight + 5, chamberBottom + 5);
    ctx.lineTo(chamberRight + 5, pistonY - 20);
    ctx.stroke();
    
    // Draw sliding piston head
    ctx.fillStyle = "#64748b";
    ctx.fillRect(chamberLeft, pistonY - 10, chamberRight - chamberLeft, 10);
    
    // Piston shaft
    ctx.fillStyle = "#475569";
    ctx.fillRect((chamberLeft + chamberRight) / 2 - 8, 40, 16, pistonY - 10);
    
    // Move and animate bouncing particles
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      
      // Collisions with left/right chamber walls
      if (p.x - p.r < chamberLeft) {
        p.x = chamberLeft + p.r;
        p.vx = -p.vx;
      }
      if (p.x + p.r > chamberRight) {
        p.x = chamberRight - p.r;
        p.vx = -p.vx;
      }
      
      // Collisions with bottom wall
      if (p.y + p.r > chamberBottom) {
        p.y = chamberBottom - p.r;
        p.vy = -p.vy;
      }
      
      // Collisions with sliding piston head
      if (p.y - p.r < pistonY) {
        p.y = pistonY + p.r;
        p.vy = -p.vy;
      }
      
      // Render particles as glowing atoms
      ctx.fillStyle = "var(--atomic-teal)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // ==========================================
    // REAL-TIME EQUATION SOLVER & PV CHART
    // ==========================================
    
    // Solve Ideal gas: P = nRT / V
    const R = 0.0821;
    const n = 0.5; // moles
    const P_ideal = (n * R * this.temp) / this.volume;
    
    // Solve van der Waals Real Gas: P = nRT/(V - nb) - a(n^2)/(V^2)
    // Constants for a heavy gas like CO2: a = 3.59, b = 0.0427
    const a = 3.59;
    const b = 0.0427;
    const P_real = (n * R * this.temp) / (this.volume - n * b) - a * (n * n) / (this.volume * this.volume);
    
    document.getElementById("lbl-ideal-p").textContent = `${P_ideal.toFixed(2)} atm`;
    document.getElementById("lbl-real-p").textContent = `${Math.max(0.1, P_real).toFixed(2)} atm`;
    
    // Render P-V curves on the right side of canvas
    ctx.save();
    ctx.translate(350, 60);
    
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, 300, 240);
    
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.fillText("P (atm)", -5, -8);
    ctx.fillText("Volume (L)", 120, 256);
    
    // Draw Ideal PV curve in blue
    ctx.strokeStyle = "var(--atomic-teal)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let v = 1.0; v <= 6.0; v += 0.1) {
      const pVal = (n * R * this.temp) / v;
      // Project to chart coordinates
      const cx = ((v - 1.0) / 5.0) * 300;
      const cy = 240 - (pVal / 30.0) * 240; // Max pressure cap 30 atm
      if (v === 1.0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    
    // Draw Real van der Waals PV curve in red
    ctx.strokeStyle = "var(--reaction-red)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let v = 1.0; v <= 6.0; v += 0.1) {
      const pVal = (n * R * this.temp) / (v - n * b) - a * (n * n) / (v * v);
      const cx = ((v - 1.0) / 5.0) * 300;
      const cy = 240 - (Math.max(0, pVal) / 30.0) * 240;
      if (v === 1.0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    
    // Current operating points
    ctx.fillStyle = "var(--atomic-teal)";
    ctx.beginPath();
    ctx.arc(((this.volume - 1.0) / 5.0) * 300, 240 - (P_ideal / 30.0) * 240, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "var(--reaction-red)";
    ctx.beginPath();
    ctx.arc(((this.volume - 1.0) / 5.0) * 300, 240 - (Math.max(0, P_real) / 30.0) * 240, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

// ==========================================================================
// 4. RUTHERFORD ALPHA SCATTERING LABORATORY
// ==========================================================================
class RutherfordScatteringLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.impactParam = 20.0; // Y offset initial
    this.alphaParticles = [];
    this.isFiring = false;
  }
  
  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">Gun Coordinates</h3>
      <div class="sim-control-group">
        <div class="sim-label">Impact Parameter (b): <span class="sim-value-label" id="lbl-ruth-b">20.0 fm</span></div>
        <input type="range" class="sim-slider" id="slider-ruth-b" min="-80.0" max="80.0" step="2.0" value="20.0">
      </div>
      
      <button class="control-btn accent" id="btn-ruth-fire" style="width:100%">Fire Alpha Ray</button>
      <button class="control-btn" id="btn-ruth-clear" style="width:100%; border-color:var(--reaction-red);">Clear Trajectories</button>
      
      <div class="sim-readout-card">
        <p style="font-size:0.8rem; line-height:1.4; color:var(--text-muted);">
          Alpha rays are fired towards a highly dense **Gold Nucleus ($Z=79$)**. Heavy deflections demonstrate concentrated positive electrostatic charge inside the atomic core.
        </p>
      </div>
    `;
    
    document.getElementById("slider-ruth-b").addEventListener("input", (e) => {
      this.impactParam = parseFloat(e.target.value);
      document.getElementById("lbl-ruth-b").textContent = `${this.impactParam.toFixed(1)} fm`;
    });
    
    document.getElementById("btn-ruth-fire").addEventListener("click", () => {
      this.fireAlpha();
    });
    
    document.getElementById("btn-ruth-clear").addEventListener("click", () => {
      this.alphaParticles = [];
    });
  }
  
  fireAlpha() {
    // Add new particle at left bounds
    this.alphaParticles.push({
      x: 20,
      y: 220 + this.impactParam,
      vx: 4.5,
      vy: 0,
      trail: [],
      deflected: false
    });
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);
    
    // Central Gold Nucleus ($Z=79, +79e$)
    const nX = w / 2;
    const nY = h / 2;
    
    ctx.fillStyle = "rgba(255, 215, 0, 0.85)"; // Gold yellow
    ctx.beginPath();
    ctx.arc(nX, nY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "gold";
    
    // Label details
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px 'Outfit'";
    ctx.textAlign = "center";
    ctx.fillText("Au", nX, nY - 2);
    ctx.fillText("+79e", nX, nY + 8);
    
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px 'JetBrains Mono'";
    ctx.fillText("Alpha Emitter gun", 60, h / 2 - 95);
    
    // Gun body
    ctx.fillStyle = "#334155";
    ctx.fillRect(10, h / 2 - 90, 50, 180);
    
    // Electrostatic Kinetic integration
    this.alphaParticles.forEach((p, pIdx) => {
      // Store trail points
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 100) p.trail.shift();
      
      // Calculate electrostatic distance vector from nucleus
      const dx = p.x - nX;
      const dy = p.y - nY;
      const r2 = dx*dx + dy*dy;
      const r = Math.sqrt(r2);
      
      // Coulomb repulsion equation: F = k * q1 * q2 / r^2
      // q1 = 2 (alpha), q2 = 79 (gold). constant scaling.
      const kFactor = 4500.0; // Adjusted constant for canvas speed scaling
      const force = kFactor / (r2 + 400); // 400 soft bounds to prevent infinity division
      
      // Force vectors
      const fx = (dx / r) * force;
      const fy = (dy / r) * force;
      
      // Apply accelerations
      p.vx += fx * 0.1;
      p.vy += fy * 0.1;
      
      // Move alpha particle
      p.x += p.vx;
      p.y += p.vy;
      
      // Draw trails
      ctx.strokeStyle = "rgba(0, 242, 254, 0.45)";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      if (p.trail.length > 0) {
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let t = 1; t < p.trail.length; t++) {
          ctx.lineTo(p.trail[t].x, p.trail[t].y);
        }
      }
      ctx.stroke();
      
      // Draw alpha sphere
      ctx.fillStyle = "var(--atomic-teal)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Remove particles offscreen
    this.alphaParticles = this.alphaParticles.filter(p => p.x < w + 50 && p.x > -50 && p.y < h + 50 && p.y > -50);
  }
}

// ==========================================================================
// 5. CHEMICAL KINETICS & COLLISION LABORATORY
// ==========================================================================
class KineticsCollisionLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    
    this.temp = 300.0;
    this.Ea = 50.0;
    this.particles = [];
    this.timeSeries = [];
    this.timeStep = 0;
    
    this.initChamber();
  }
  
  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">Collision parameters</h3>
      <div class="sim-control-group">
        <div class="sim-label">Chamber Temp: <span class="sim-value-label" id="lbl-kin-temp">300 K</span></div>
        <input type="range" class="sim-slider" id="slider-kin-temp" min="150" max="600" step="10" value="300">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Activation Energy (Ea): <span class="sim-value-label" id="lbl-kin-ea">50.0 kJ</span></div>
        <input type="range" class="sim-slider" id="slider-kin-ea" min="20" max="100" step="5" value="50">
      </div>
      
      <button class="control-btn accent" id="btn-kin-reset" style="width:100%">Inject New Reactants</button>
      
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Reactants Remaining:</span><span id="lbl-reactants-count">--</span></div>
        <div class="sim-readout-row"><span>Products Formed:</span><span id="lbl-products-count" style="color:var(--copper-orange); font-weight:bold;">--</span></div>
      </div>
    `;
    
    document.getElementById("slider-kin-temp").addEventListener("input", (e) => {
      this.temp = parseFloat(e.target.value);
      document.getElementById("lbl-kin-temp").textContent = `${this.temp.toFixed(0)} K`;
      this.rescaleVelocities();
    });
    
    document.getElementById("slider-kin-ea").addEventListener("input", (e) => {
      this.Ea = parseFloat(e.target.value);
      document.getElementById("lbl-kin-ea").textContent = `${this.Ea.toFixed(1)} kJ`;
    });
    
    document.getElementById("btn-kin-reset").addEventListener("click", () => {
      this.initChamber();
    });
    
    this.initChamber();
  }
  
  initChamber() {
    this.particles = [];
    this.timeSeries = [];
    this.timeStep = 0;
    
    // Inject 25 Red (Reactant A) and 25 Blue (Reactant B)
    for (let i = 0; i < 20; i++) {
      this.particles.push({ type: "A", x: 20 + Math.random()*250, y: 40 + Math.random()*250, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, r: 6 });
      this.particles.push({ type: "B", x: 20 + Math.random()*250, y: 40 + Math.random()*250, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, r: 6 });
    }
    
    this.rescaleVelocities();
  }
  
  rescaleVelocities() {
    const scale = Math.sqrt(this.temp / 300.0) * 1.8;
    this.particles.forEach(p => {
      const angle = Math.random() * Math.PI * 2;
      p.vx = Math.cos(angle) * scale;
      p.vy = Math.sin(angle) * scale;
    });
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);
    
    // Left side Collision chamber stand bounds
    const boxSize = 290;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 30, boxSize, boxSize);
    
    // Count particles
    let countA = 0, countB = 0, countProd = 0;
    
    // Move particles
    this.particles.forEach(p => {
      if (p.type === "A") countA++;
      else if (p.type === "B") countB++;
      else countProd++;
      
      p.x += p.vx;
      p.y += p.vy;
      
      // Wall reflections
      if (p.x - p.r < 20) { p.x = 20 + p.r; p.vx = -p.vx; }
      if (p.x + p.r > 20 + boxSize) { p.x = 20 + boxSize - p.r; p.vx = -p.vx; }
      if (p.y - p.r < 30) { p.y = 30 + p.r; p.vy = -p.vy; }
      if (p.y + p.r > 30 + boxSize) { p.y = 30 + boxSize - p.r; p.vy = -p.vy; }
      
      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (p.type === "A") ctx.fillStyle = "var(--neutral-blue)"; // Blue A
      else if (p.type === "B") ctx.fillStyle = "var(--reaction-red)";  // Red B
      else {
        // Shaded golden product sphere
        const grad = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, p.r);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "gold");
        grad.addColorStop(1, "#b58900");
        ctx.fillStyle = grad;
      }
      ctx.fill();
    });
    
    // Check collisions between reactants A and B
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        
        // Reactants A & B collision
        if (((p1.type === "A" && p2.type === "B") || (p1.type === "B" && p2.type === "A"))) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < p1.r + p2.r) {
            // Collision detected! Calculate collision kinetic energy
            // Combined relative kinetic energy proportional to relative velocities
            const rvx = p2.vx - p1.vx;
            const rvy = p2.vy - p1.vy;
            const collisionEnergy = 12.0 * (rvx*rvx + rvy*rvy); // scalar multiplier scale
            
            // Check if energy overcomes the activation energy barrier
            if (collisionEnergy >= this.Ea) {
              // React and transform into a single gold product sphere C!
              p1.type = "C";
              p2.type = "C";
              p1.r = 7.5; // Slightly larger mass co-volume
              p2.r = 7.5;
              
              // Spark visual indicator
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc((p1.x + p2.x)/2, (p1.y + p2.y)/2, 15, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              // Elastic bounce rebound
              const tempVx = p1.vx;
              const tempVy = p1.vy;
              p1.vx = p2.vx;
              p1.vy = p2.vy;
              p2.vx = tempVx;
              p2.vy = tempVy;
            }
          }
        }
      }
    }
    
    document.getElementById("lbl-reactants-count").textContent = `${countA + countB} (A + B)`;
    document.getElementById("lbl-products-count").textContent = `${countProd} (C)`;
    
    // Push historical concentration points every 5 animation frames
    this.timeStep++;
    if (this.timeStep % 8 === 0 && countA + countB > 0) {
      this.timeSeries.push({
        t: this.timeSeries.length,
        reactants: ((countA + countB) / 40) * 100,
        products: (countProd / 40) * 100
      });
      if (this.timeSeries.length > 50) this.timeSeries.shift();
    }
    
    // Draw Concentration vs. Time rate graph on right side
    ctx.save();
    ctx.translate(350, 40);
    
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, 300, 230);
    
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.fillText("Conc (%)", -5, -6);
    ctx.fillText("Reaction Duration (t)", 90, 246);
    
    // Plot reactants decay line (Blue)
    ctx.strokeStyle = "var(--atomic-teal)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    this.timeSeries.forEach((pt, idx) => {
      const gx = (idx / 50) * 300;
      const gy = 230 - (pt.reactants / 100) * 230;
      if (idx === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    });
    ctx.stroke();
    
    // Plot products growth line (Gold)
    ctx.strokeStyle = "var(--copper-orange)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    this.timeSeries.forEach((pt, idx) => {
      const gx = (idx / 50) * 300;
      const gy = 230 - (pt.products / 100) * 230;
      if (idx === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    });
    ctx.stroke();
    
    ctx.restore();
  }
}

// ==========================================================================
// 6. LE CHATELIER'S EQUILIBRIUM LABORATORY
// ==========================================================================
class LeChatelierLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    
    // Initial moles representing N2 + 3H2 <=> 2NH3
    this.N2 = 3.0;
    this.H2 = 6.0;
    this.NH3 = 2.0;
    this.Kc = 0.5; // Target equilibrium constant
    this.temperature = 300.0;
    this.volume = 5.0;
  }
  
  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">Le Chatelier Stressors</h3>
      <div class="sim-control-group">
        <label class="sim-label">Inject Nitrogen (N2):</label>
        <button class="control-btn accent" id="btn-add-n2">Add +1.0 mole N₂</button>
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Chamber Volume: <span class="sim-value-label" id="lbl-eq-vol">5.0 L</span></div>
        <input type="range" class="sim-slider" id="slider-eq-vol" min="2.0" max="10.0" step="0.5" value="5.0">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Temperature: <span class="sim-value-label" id="lbl-eq-temp">300 K</span></div>
        <input type="range" class="sim-slider" id="slider-eq-temp" min="200" max="500" step="10" value="300">
      </div>
      
      <button class="control-btn" id="btn-eq-reset" style="width:100%; border-color:var(--reaction-red);">Re-establish Initial</button>
      
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Reaction Quotient Q:</span><span id="read-eq-q" style="font-weight:bold;">--</span></div>
        <div class="sim-readout-row"><span>Equilibrium Constant K:</span><span id="read-eq-k" style="color:var(--acid-green); font-weight:bold;">--</span></div>
      </div>
    `;
    
    document.getElementById("btn-add-n2").addEventListener("click", () => {
      this.N2 += 1.0;
    });
    
    document.getElementById("slider-eq-vol").addEventListener("input", (e) => {
      this.volume = parseFloat(e.target.value);
      document.getElementById("lbl-eq-vol").textContent = `${this.volume.toFixed(1)} L`;
    });
    
    document.getElementById("slider-eq-temp").addEventListener("input", (e) => {
      this.temperature = parseFloat(e.target.value);
      document.getElementById("lbl-eq-temp").textContent = `${this.temperature.toFixed(0)} K`;
      // Raising temp shifts equilibrium of exothermic synthesis back to reactants
      // Kc decreases as temp increases
      this.Kc = 0.5 * Math.exp(-0.01 * (this.temperature - 300.0));
    });
    
    document.getElementById("btn-eq-reset").addEventListener("click", () => {
      this.N2 = 3.0;
      this.H2 = 6.0;
      this.NH3 = 2.0;
      this.Kc = 0.5;
      this.temperature = 300.0;
      this.volume = 5.0;
      document.getElementById("slider-eq-vol").value = "5.0";
      document.getElementById("slider-eq-temp").value = "300";
      document.getElementById("lbl-eq-vol").textContent = "5.0 L";
      document.getElementById("lbl-eq-temp").textContent = "300 K";
    });
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Le Chatelier dynamic kinetic shifts towards Kc
    // Reaction: N2 + 3H2 <=> 2NH3
    // Q_c = ([NH3]^2) / ([N2] * [H2]^3)
    const concN2 = this.N2 / this.volume;
    const concH2 = this.H2 / this.volume;
    const concNH3 = this.NH3 / this.volume;
    
    const Q = (concNH3 * concNH3) / (concN2 * Math.pow(concH2, 3));
    
    // Shift rate depending on distance between Q and K
    const shiftStrength = 0.003;
    const delta = this.Kc - Q;
    
    if (Math.abs(delta) > 1e-4) {
      const shiftAmount = delta * shiftStrength;
      
      // If delta > 0 (K > Q): shift forward (reactants decrease, products increase)
      // N2 + 3H2 => 2NH3
      this.N2 = Math.max(0.1, this.N2 - shiftAmount);
      this.H2 = Math.max(0.1, this.H2 - shiftAmount * 3);
      this.NH3 = Math.max(0.1, this.NH3 + shiftAmount * 2);
    }
    
    document.getElementById("read-eq-q").textContent = Q.toExponential(3);
    document.getElementById("read-eq-k").textContent = this.Kc.toFixed(3);
    
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);
    
    // Draw the molecular synthesis chamber
    ctx.save();
    ctx.translate(30, 40);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 260, 250);
    
    // Draw visual particle clouds representing equilibrium density
    const numDrawN2 = Math.round(this.N2 * 2);
    const numDrawH2 = Math.round(this.H2 * 1.5);
    const numDrawNH3 = Math.round(this.NH3 * 2.5);
    
    // Nitrogen atoms (large teal doublets)
    ctx.fillStyle = "var(--atomic-teal)";
    for (let i = 0; i < numDrawN2; i++) {
      const rx = 20 + (Math.sin(i * 45) * 0.5 + 0.5) * 220;
      const ry = 20 + (Math.cos(i * 12) * 0.5 + 0.5) * 210;
      ctx.beginPath();
      ctx.arc(rx, ry, 6, 0, Math.PI*2);
      ctx.arc(rx + 8, ry, 6, 0, Math.PI*2);
      ctx.fill();
    }
    
    // Hydrogen atoms (small white circles)
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < numDrawH2; i++) {
      const rx = 20 + (Math.sin(i * 19) * 0.5 + 0.5) * 220;
      const ry = 20 + (Math.cos(i * 35) * 0.5 + 0.5) * 210;
      ctx.beginPath();
      ctx.arc(rx, ry, 3.5, 0, Math.PI*2);
      ctx.fill();
    }
    
    // Ammonia molecules (triangular clusters)
    ctx.fillStyle = "var(--indicator-purple)";
    for (let i = 0; i < numDrawNH3; i++) {
      const rx = 20 + (Math.sin(i * 59) * 0.5 + 0.5) * 220;
      const ry = 20 + (Math.cos(i * 72) * 0.5 + 0.5) * 210;
      ctx.beginPath();
      ctx.arc(rx, ry, 7, 0, Math.PI*2);
      ctx.arc(rx - 5, ry + 6, 4, 0, Math.PI*2);
      ctx.arc(rx + 5, ry + 6, 4, 0, Math.PI*2);
      ctx.fill();
    }
    
    ctx.restore();
    
    // ==========================================
    // DRAW BAR CHART LEVEL READOUT
    // ==========================================
    ctx.save();
    ctx.translate(340, 60);
    
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px 'Outfit'";
    ctx.fillText("Active Reagent Quantities (Moles)", 0, -10);
    
    // Draw columns
    const maxMoles = 15.0;
    const barW = 50;
    const maxBarH = 180;
    
    // N2 Bar
    const hN2 = (this.N2 / maxMoles) * maxBarH;
    ctx.fillStyle = "var(--atomic-teal)";
    ctx.fillRect(20, 200 - hN2, barW, hN2);
    ctx.fillText("N₂", 35, 220);
    ctx.fillText(this.N2.toFixed(1), 32, 190 - hN2);
    
    // H2 Bar
    const hH2 = (this.H2 / maxMoles) * maxBarH;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(100, 200 - hH2, barW, hH2);
    ctx.fillText("H₂", 115, 220);
    ctx.fillText(this.H2.toFixed(1), 112, 190 - hH2);
    
    // NH3 Bar
    const hNH3 = (this.NH3 / maxMoles) * maxBarH;
    ctx.fillStyle = "var(--indicator-purple)";
    ctx.fillRect(180, 200 - hNH3, barW, hNH3);
    ctx.fillText("NH₃", 192, 220);
    ctx.fillText(this.NH3.toFixed(1), 192, 190 - hNH3);
    
    ctx.restore();
  }
}

// ==========================================================================
// 7. STANDALONE MOLECULAR & PLOTTER GRAPH TEMPLATE LAB
// ==========================================================================
class StandalonePlotterLab {
  constructor(canvas, controls, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.sim = sim;
    
    // Determine mode based on title/labId
    const title = (sim && sim.title) ? sim.title : "";
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes("flame") || titleLower.includes("coloration")) {
      this.mode = "flame_test";
    } else if (titleLower.includes("cation") || titleLower.includes("anion") || titleLower.includes("lassaigne") || titleLower.includes("test") || titleLower.includes("identification") || titleLower.includes("nessler") || titleLower.includes("chromyl") || titleLower.includes("ring test")) {
      this.mode = "salt_analyzer";
    } else if (titleLower.includes("plot") || titleLower.includes("graph") || titleLower.includes("isotherm") || titleLower.includes("curve") || titleLower.includes("kinetics") || titleLower.includes("arrhenius") || titleLower.includes("solubility") || titleLower.includes("raoult") || titleLower.includes("boyle") || titleLower.includes("charles") || titleLower.includes("graham")) {
      this.mode = "graph_plotter";
    } else if (titleLower.includes("3d") || titleLower.includes("structure") || titleLower.includes("geometry") || titleLower.includes("overlap") || titleLower.includes("bonding") || titleLower.includes("diborane") || titleLower.includes("silicate") || titleLower.includes("fullerene") || titleLower.includes("benzene") || titleLower.includes("glucose") || titleLower.includes("lattice")) {
      this.mode = "molecule_viewer";
    } else {
      this.mode = "schematic";
    }
    
    this.plotter = new ChemicalGraphPlotter(canvas);
    this.molecular = new MolecularGeometry3D(canvas);
    
    // Custom states
    this.flameIon = "Na+";
    this.reagentAdded = "none";
    this.sliderValue = 50.0;
    this.animationTick = 0;
  }
  
  init() {
    this.controls.innerHTML = "";
    const title = (this.sim && this.sim.title) ? this.sim.title : "";
    
    if (this.mode === "flame_test") {
      this.controls.innerHTML = `
        <h3 class="sim-section-title">Flame Test Burner</h3>
        <div class="sim-control-group">
          <label for="sel-flame-ion" class="sim-label">Select Metal Cation:</label>
          <select class="theme-dropdown" id="sel-flame-ion" style="width:100%">
            <option value="Na+" selected>Sodium (Na+) - Golden Yellow</option>
            <option value="Li+">Lithium (Li+) - Crimson Red</option>
            <option value="K+">Potassium (K+) - Lilac / Light Purple</option>
            <option value="Ca2+">Calcium (Ca2+) - Brick Red</option>
            <option value="Ba2+">Barium (Ba2+) - Apple Green</option>
            <option value="Sr2+">Strontium (Sr2+) - Crimson Red</option>
            <option value="Cu2+">Copper (Cu2+) - Greenish Blue</option>
          </select>
        </div>
        <div class="sim-readout-card">
          <div class="sim-readout-row"><span>Cation:</span><span id="read-flame-ion">Na+</span></div>
          <div class="sim-readout-row"><span>Wavelength:</span><span id="read-flame-wave" style="color:var(--atomic-teal); font-weight:bold;">589 nm</span></div>
        </div>
      `;
      document.getElementById("sel-flame-ion").addEventListener("change", (e) => {
        this.flameIon = e.target.value;
        const waveMap = { "Na+": "589 nm", "Li+": "671 nm", "K+": "404 nm", "Ca2+": "622 nm", "Ba2+": "553 nm", "Sr2+": "640 nm", "Cu2+": "510 nm" };
        document.getElementById("read-flame-ion").textContent = this.flameIon;
        document.getElementById("read-flame-wave").textContent = waveMap[this.flameIon];
      });
      
    } else if (this.mode === "salt_analyzer") {
      this.controls.innerHTML = `
        <h3 class="sim-section-title">Reagent Dispatcher</h3>
        <div class="sim-control-group">
          <label for="sel-salt-reagent" class="sim-label">Add Qualitative Reagent:</label>
          <select class="theme-dropdown" id="sel-salt-reagent" style="width:100%">
            <option value="none" selected>No Reagent (Clear Solution)</option>
            <option value="HCl">Dilute Hydrochloric Acid (HCl)</option>
            <option value="H2S">Hydrogen Sulfide Gas (H2S)</option>
            <option value="NH4OH">Ammonium Hydroxide (NH4OH)</option>
            <option value="AgNO3">Silver Nitrate (AgNO3)</option>
            <option value="FeCl3">Iron(III) Chloride (FeCl3)</option>
            <option value="Nessler">Nessler's Reagent</option>
          </select>
        </div>
        <div class="sim-readout-card">
          <p id="read-salt-result" style="font-size:0.85rem; line-height:1.4; color:var(--text-color);">
            Select a chemical reagent from the menu above to test the active ionic analyte.
          </p>
        </div>
      `;
      document.getElementById("sel-salt-reagent").addEventListener("change", (e) => {
        this.reagentAdded = e.target.value;
        const resultLabel = document.getElementById("read-salt-result");
        
        const descriptions = {
          "none": "No reagent added. Solution remains clear and colorless.",
          "HCl": "Dilute HCl added. Evolved white gelatinous precipitate of Lead Chloride ($PbCl_2$) or Silver Chloride ($AgCl$) for Group I cations.",
          "H2S": "H₂S gas bubbled through. Forms a distinct black sulfide precipitate ($CuS$ / $PbS$) if Group II cations are present.",
          "NH4OH": "NH₄OH base added. Yields reddish-brown ferric hydroxide ($Fe(OH)_3$) or gelatinous white aluminium hydroxide ($Al(OH)_3$) precipitate.",
          "AgNO3": "Silver Nitrate added. Combines with chloride/halides to form heavy white silver halide precipitate ($AgCl \\downarrow$).",
          "FeCl3": "FeCl₃ added. Reacts with acetate ions to produce a deep red-colored iron acetate complex.",
          "Nessler": "Nessler's Reagent added. Combines with ammonium ions ($NH_4^+$) to form a highly characteristic reddish-brown precipitate (iodide of Millon's base)."
        };
        resultLabel.innerHTML = descriptions[this.reagentAdded];
      });
      
    } else if (this.mode === "graph_plotter") {
      this.controls.innerHTML = `
        <h3 class="sim-section-title">Variable Adjuster</h3>
        <div class="sim-control-group">
          <div class="sim-label">Parameter Shift: <span class="sim-value-label" id="lbl-graph-val">50.0</span></div>
          <input type="range" class="sim-slider" id="slider-graph-val" min="10" max="100" step="5" value="50">
        </div>
        <div class="sim-readout-card">
          <p style="font-size:0.8rem; line-height:1.4; color:var(--text-muted);">
            Adjusting the slider shifts variables (like temperature or pressure) in real time. Observe the exponential transition of the plotted curve.
          </p>
        </div>
      `;
      document.getElementById("slider-graph-val").addEventListener("input", (e) => {
        this.sliderValue = parseFloat(e.target.value);
        document.getElementById("lbl-graph-val").textContent = this.sliderValue.toFixed(1);
      });
      
    } else if (this.mode === "molecule_viewer") {
      this.controls.innerHTML = `
        <h3 class="sim-section-title">Molecular Models</h3>
        <div class="sim-control-group">
          <label for="sel-moldem-type" class="sim-label">Choose Molecule Model:</label>
          <select class="theme-dropdown" id="sel-moldem-type" style="width:100%">
            <option value="CH4" selected>Methane (CH4) - Tetrahedral</option>
            <option value="CO2">Carbon Dioxide (CO2) - Linear</option>
            <option value="BF3">Boron Trifluoride (BF3) - Trigonal Planar</option>
            <option value="H2O">Water (H2O) - Bent Angular</option>
            <option value="NH3">Ammonia (NH3) - Trigonal Pyramidal</option>
            <option value="PCl5">Phosphorus Pentachloride (PCl5) - Trigonal Bipyramidal</option>
            <option value="SF6">Sulfur Hexafluoride (SF6) - Octahedral</option>
          </select>
        </div>
        <div class="sim-readout-card">
          <p style="font-size:0.8rem; line-height:1.4; color:var(--text-muted);">
            Drag your cursor directly over the structural stage to rotate molecular orbitals in 3D perspective grids!
          </p>
        </div>
      `;
      
      const molSelect = document.getElementById("sel-moldem-type");
      molSelect.addEventListener("change", (e) => {
        this.molecular.setMolecule(e.target.value);
      });
      
      // Determine starting molecule based on title
      let startMol = "CH4";
      if (title.includes("CO2") || title.includes("Linear")) startMol = "CO2";
      else if (title.includes("BF3") || title.includes("Planar")) startMol = "BF3";
      else if (title.includes("H2O") || title.includes("Bent")) startMol = "H2O";
      else if (title.includes("NH3") || title.includes("Pyramidal")) startMol = "NH3";
      else if (title.includes("PCl5") || title.includes("Bipyramidal")) startMol = "PCl5";
      else if (title.includes("SF6") || title.includes("Octahedral")) startMol = "SF6";
      
      molSelect.value = startMol;
      this.molecular.setMolecule(startMol);
      
    } else { // schematic mode
      this.controls.innerHTML = `
        <h3 class="sim-section-title">System Controller</h3>
        <div class="sim-control-group">
          <div class="sim-label">Reactant Feed: <span class="sim-value-label" id="lbl-schem-val">5.0 moles</span></div>
          <input type="range" class="sim-slider" id="slider-schem-val" min="1" max="15" step="0.5" value="5">
        </div>
        <div class="sim-readout-card">
          <div class="sim-readout-row"><span>Reactant:</span><span>A</span></div>
          <div class="sim-readout-row"><span>Product Yield:</span><span id="read-schem-yield" style="color:var(--atomic-teal); font-weight:bold;">5.0 moles</span></div>
        </div>
      `;
      document.getElementById("slider-schem-val").addEventListener("input", (e) => {
        this.sliderValue = parseFloat(e.target.value);
        document.getElementById("lbl-schem-val").textContent = `${this.sliderValue.toFixed(1)} moles`;
        document.getElementById("read-schem-yield").textContent = `${this.sliderValue.toFixed(1)} moles`;
      });
    }
  }
  
  render() {
    this.animationTick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);
    
    if (this.mode === "flame_test") {
      // Draw burner base
      ctx.fillStyle = "#34495e";
      ctx.fillRect(w/2 - 20, h - 80, 40, 80);
      ctx.fillStyle = "#7f8c8d";
      ctx.fillRect(w/2 - 10, h - 180, 20, 100);
      
      // Select color based on selected ion
      let flameColor = "rgba(241, 196, 15, 0.8)"; // Na+ yellow
      let coreColor = "rgba(255, 255, 255, 0.95)";
      
      if (this.flameIon === "Li+" || this.flameIon === "Sr2+") {
        flameColor = "rgba(231, 76, 60, 0.8)"; // Crimson red
      } else if (this.flameIon === "K+") {
        flameColor = "rgba(155, 89, 182, 0.8)"; // Lilac
      } else if (this.flameIon === "Ca2+") {
        flameColor = "rgba(230, 126, 34, 0.8)"; // Brick red
      } else if (this.flameIon === "Ba2+") {
        flameColor = "rgba(46, 204, 113, 0.8)"; // Apple green
      } else if (this.flameIon === "Cu2+") {
        flameColor = "rgba(26, 188, 156, 0.8)"; // Blue green
      }
      
      // Draw burner flame particles with flicker animation
      ctx.save();
      ctx.translate(w/2, h - 185);
      
      const flicker = Math.sin(this.animationTick * 0.15) * 5;
      const heightFlicker = Math.cos(this.animationTick * 0.1) * 10;
      
      // Outer Flame
      const gradOuter = ctx.createRadialGradient(0, -20, 5, 0, -40, 70);
      gradOuter.addColorStop(0, flameColor);
      gradOuter.addColorStop(1, "rgba(6, 9, 14, 0)");
      ctx.fillStyle = gradOuter;
      ctx.beginPath();
      ctx.moveTo(-30 + flicker/2, 0);
      ctx.quadraticCurveTo(-45, -70 + heightFlicker, 0, -130 + heightFlicker);
      ctx.quadraticCurveTo(45, -70 + heightFlicker, 30 - flicker/2, 0);
      ctx.closePath();
      ctx.fill();
      
      // Inner Core Flame
      const gradInner = ctx.createRadialGradient(0, -10, 2, 0, -25, 35);
      gradInner.addColorStop(0, coreColor);
      gradInner.addColorStop(0.5, "rgba(52, 152, 219, 0.6)"); // light blue core
      gradInner.addColorStop(1, "rgba(6, 9, 14, 0)");
      ctx.fillStyle = gradInner;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.quadraticCurveTo(-20, -35, 0, -70);
      ctx.quadraticCurveTo(20, -35, 15, 0);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
      
      // Draw wire loop
      ctx.strokeStyle = "#95a5a6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w/2 - 150, h - 180);
      ctx.lineTo(w/2 - 5, h - 185);
      ctx.stroke();
      
      // Draw loop ring
      ctx.strokeStyle = "#bdc3c7";
      ctx.beginPath();
      ctx.arc(w/2 - 5, h - 185, 6, 0, Math.PI*2);
      ctx.stroke();
      
    } else if (this.mode === "salt_analyzer") {
      // Draw stand
      ctx.strokeStyle = "#7f8c8d";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w/2 - 80, h - 40);
      ctx.lineTo(w/2 + 80, h - 40);
      ctx.moveTo(w/2 - 50, h - 40);
      ctx.lineTo(w/2 - 50, 80);
      ctx.lineTo(w/2 + 10, 80);
      ctx.stroke();
      
      // Draw test tube holder ring
      ctx.strokeStyle = "#34495e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w/2, 140, 24, 0, Math.PI);
      ctx.stroke();
      
      // Draw test tube
      const ttX = w/2;
      const ttY = 100;
      const ttW = 44;
      const ttH = 260;
      
      ctx.save();
      ctx.translate(ttX, ttY);
      
      // Draw solution inside test tube
      let solutionColor = "rgba(255, 255, 255, 0.08)"; // clear fallback
      let pptColor = "none";
      
      if (this.reagentAdded === "HCl") {
        pptColor = "rgba(255, 255, 255, 0.85)"; // White Lead chloride precipitate
      } else if (this.reagentAdded === "H2S") {
        pptColor = "rgba(24, 25, 28, 0.95)"; // Black sulfide precipitate
      } else if (this.reagentAdded === "NH4OH") {
        pptColor = "rgba(160, 82, 45, 0.85)"; // Reddish-brown ferric hydroxide
      } else if (this.reagentAdded === "AgNO3") {
        pptColor = "rgba(255, 255, 255, 0.9)"; // White AgCl precipitate
      } else if (this.reagentAdded === "FeCl3") {
        solutionColor = "rgba(139, 0, 0, 0.85)"; // Deep blood-red iron acetate
      } else if (this.reagentAdded === "Nessler") {
        pptColor = "rgba(139, 69, 19, 0.9)"; // Red-brown precipitate of Millon's base
      }
      
      // Liquid body (lower half of test tube)
      ctx.fillStyle = solutionColor;
      ctx.beginPath();
      ctx.moveTo(-ttW/2 + 2, ttH - 120);
      ctx.lineTo(ttW/2 - 2, ttH - 120);
      ctx.lineTo(ttW/2 - 2, ttH - ttW/2);
      ctx.arc(0, ttH - ttW/2, ttW/2 - 2, 0, Math.PI);
      ctx.lineTo(-ttW/2 + 2, ttH - 120);
      ctx.closePath();
      ctx.fill();
      
      // Precipitate at bottom (draw as small curved mass or particles)
      if (pptColor !== "none") {
        ctx.fillStyle = pptColor;
        ctx.beginPath();
        ctx.arc(0, ttH - ttW/2, ttW/2 - 2, 0, Math.PI);
        ctx.lineTo(ttW/2 - 2, ttH - 30);
        ctx.lineTo(-ttW/2 + 2, ttH - 30);
        ctx.closePath();
        ctx.fill();
        
        // draw particle specs
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        for (let i = 0; i < 15; i++) {
          const rx = -12 + (Math.sin(i*23) * 0.5 + 0.5) * 24;
          const ry = (ttH - 25) + (Math.cos(i*7) * 0.5 + 0.5) * 18;
          ctx.fillRect(rx, ry, 2, 2);
        }
      }
      
      // Glass body outline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-ttW/2, 0);
      ctx.lineTo(-ttW/2, ttH - ttW/2);
      ctx.arc(0, ttH - ttW/2, ttW/2, Math.PI, 0, true);
      ctx.lineTo(ttW/2, 0);
      ctx.stroke();
      
      // Lip rim
      ctx.beginPath();
      ctx.ellipse(0, 0, ttW/2 + 4, 3, 0, 0, Math.PI*2);
      ctx.stroke();
      
      ctx.restore();
      
    } else if (this.mode === "graph_plotter") {
      this.plotter.clear();
      
      const bounds = { xMin: 0, xMax: 10, yMin: 0, yMax: 100 };
      const sliderPercent = this.sliderValue / 100.0;
      
      // Determine axis labels dynamically
      let xLabel = "Concentration / Temp";
      let yLabel = "Reaction Velocity / Extent";
      const titleLower = (this.sim && this.sim.title) ? this.sim.title.toLowerCase() : "";
      
      if (titleLower.includes("isotherm")) {
        xLabel = "Pressure P (bar)";
        yLabel = "Adsorption Extent x/m";
      } else if (titleLower.includes("kinetics") || titleLower.includes("decay") || titleLower.includes("rate law") || titleLower.includes("order")) {
        xLabel = "Time t (s)";
        yLabel = "Reactant Conc [A] (M)";
      } else if (titleLower.includes("arrhenius")) {
        xLabel = "1/T (Reciprocal Temp, 1/K)";
        yLabel = "ln(k) (Rate Constant Log)";
      } else if (titleLower.includes("raoult") || titleLower.includes("vapor") || titleLower.includes("solution")) {
        xLabel = "Mole Fraction of A (x_A)";
        yLabel = "Vapor Pressure P (mmHg)";
      } else if (titleLower.includes("kohlrausch") || titleLower.includes("conduct") || titleLower.includes("electrolyte")) {
        xLabel = "sqrt(Concentration) (C^0.5)";
        yLabel = "Molar Conductivity (S cm^2/mol)";
      } else if (titleLower.includes("broglie") || titleLower.includes("wavelength")) {
        xLabel = "Velocity v (10^6 m/s)";
        yLabel = "de Broglie Wavelength (A)";
      } else if (titleLower.includes("bohr") || titleLower.includes("orbit")) {
        xLabel = "Quantum Orbit n";
        yLabel = "Orbit Radius r_n (A)";
      } else if (titleLower.includes("maxwell") || titleLower.includes("speed") || titleLower.includes("distribution")) {
        xLabel = "Molecular Speed (m/s)";
        yLabel = "Probability Density P(v)";
      } else if (titleLower.includes("solubility") || titleLower.includes("ksp")) {
        xLabel = "Common Ion Conc (M)";
        yLabel = "Solubility s (M)";
      }
      
      this.plotter.drawAxes(xLabel, yLabel, bounds);
      
      const points = [];
      
      if (titleLower.includes("isotherm")) {
        // Freundlich isotherm: y = k * P^(1/n)
        const k = 15 + sliderPercent * 50;
        const invN = 0.3 + (1 - sliderPercent) * 0.5;
        for (let x = 0; x <= 10; x += 0.25) {
          const y = k * Math.pow(x, invN);
          points.push({ x: x * 10, y: Math.min(100, y) });
        }
      } else if (titleLower.includes("kinetics") || titleLower.includes("decay") || titleLower.includes("rate law") || titleLower.includes("order")) {
        // First order decay: [A] = [A]0 * e^(-kt)
        const k = 0.1 + sliderPercent * 0.5;
        const A0 = 90;
        for (let x = 0; x <= 10; x += 0.25) {
          const y = A0 * Math.exp(-k * x);
          points.push({ x: x * 10, y: y });
        }
      } else if (titleLower.includes("arrhenius")) {
        // Arrhenius plot: ln(k) = ln(A) - Ea/RT
        // We plot against 1/T where 1/T ranges from 0.5 to 10
        const Ea = 30 + (1 - sliderPercent) * 60;
        const A = 90;
        for (let x = 0.5; x <= 10; x += 0.25) {
          const y = A - (Ea * x / 1.5);
          points.push({ x: x * 10, y: Math.max(5, y) });
        }
      } else if (titleLower.includes("raoult") || titleLower.includes("vapor") || titleLower.includes("solution")) {
        // Raoult's Law: P_total = P_A*x_A + P_B*(1-x_A)
        const PA = 30 + sliderPercent * 50;
        const PB = 80 - sliderPercent * 40;
        for (let x = 0; x <= 10; x += 0.5) {
          const xA = x / 10;
          const y = PA * xA + PB * (1 - xA);
          points.push({ x: x * 10, y: y });
        }
      } else if (titleLower.includes("kohlrausch") || titleLower.includes("conduct") || titleLower.includes("electrolyte")) {
        const lambda0 = 85;
        const b = 10 + sliderPercent * 25;
        if (titleLower.includes("weak")) {
          // weak electrolyte curve
          for (let x = 0.05; x <= 10; x += 0.2) {
            const y = lambda0 / (1 + x * 0.9);
            points.push({ x: x * 10, y: y });
          }
        } else {
          // strong electrolyte straight line
          for (let x = 0; x <= 10; x += 0.5) {
            const y = lambda0 - b * Math.sqrt(x);
            points.push({ x: x * 10, y: Math.max(5, y) });
          }
        }
      } else if (titleLower.includes("broglie") || titleLower.includes("wavelength")) {
        // lambda = h / mv
        const massFactor = 0.5 + sliderPercent * 1.5;
        for (let x = 0.5; x <= 10; x += 0.25) {
          const y = 70 / (x * massFactor);
          points.push({ x: x * 10, y: Math.min(98, y) });
        }
      } else if (titleLower.includes("bohr") || titleLower.includes("orbit")) {
        // radius: r = 0.529 * n^2 / Z
        const Z = 1 + Math.floor(sliderPercent * 3);
        for (let x = 1; x <= 10; x += 0.5) {
          const n = x / 2.5; // scale orbit number
          const y = 8 * (n * n) / Z;
          points.push({ x: x * 10, y: Math.min(100, y) });
        }
      } else if (titleLower.includes("maxwell") || titleLower.includes("speed") || titleLower.includes("distribution")) {
        // Maxwell speed distribution
        const T = 100 + sliderPercent * 900;
        for (let x = 0; x <= 10; x += 0.25) {
          const factor = x * 1.5;
          const y = 200 * (factor * factor) * Math.exp(-factor * factor * 180 / T) / Math.sqrt(T);
          points.push({ x: x * 10, y: Math.min(95, y * 5) });
        }
      } else if (titleLower.includes("solubility") || titleLower.includes("ksp")) {
        // Solubility with common ion effect
        const Ksp = 1e-4 + sliderPercent * 1e-2;
        for (let x = 0.1; x <= 10; x += 0.25) {
          const y = Ksp / x * 500;
          points.push({ x: x * 10, y: Math.min(95, y) });
        }
      } else {
        // Standard exponential curve
        for (let x = 0; x <= 10; x += 0.25) {
          const y = 100 * (1 - Math.exp(-x * (0.2 + sliderPercent)));
          points.push({ x: x * 10, y: y });
        }
      }
      
      this.plotter.plotLine(points, "var(--atomic-teal)", 4.5);
      
    } else if (this.mode === "molecule_viewer") {
      this.molecular.render();
      
    } else { // default schematic mode
      // Weighing balance scale representation
      const leftWeight = this.sliderValue;
      const rightWeight = this.sliderValue;
      
      // Draw pivot triangle
      ctx.fillStyle = "#5c5d64";
      ctx.beginPath();
      ctx.moveTo(w/2, h - 220);
      ctx.lineTo(w/2 - 20, h - 120);
      ctx.lineTo(w/2 + 20, h - 120);
      ctx.closePath();
      ctx.fill();
      
      // Stand rod
      ctx.fillStyle = "#bdc3c7";
      ctx.fillRect(w/2 - 6, h - 300, 12, 180);
      ctx.fillRect(w/2 - 80, h - 300, 160, 10); // cross bar
      
      // Left arm hanger
      ctx.strokeStyle = "#95a5a6";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w/2 - 70, h - 295);
      ctx.lineTo(w/2 - 110, h - 210);
      ctx.lineTo(w/2 - 30, h - 210);
      ctx.closePath();
      ctx.stroke();
      
      // Left Pan
      ctx.fillStyle = "rgba(241, 196, 15, 0.75)";
      ctx.fillRect(w/2 - 120, h - 210, 100, 6);
      
      // Right arm hanger
      ctx.beginPath();
      ctx.moveTo(w/2 + 70, h - 295);
      ctx.lineTo(w/2 + 30, h - 210);
      ctx.lineTo(w/2 + 110, h - 210);
      ctx.closePath();
      ctx.stroke();
      
      // Right Pan
      ctx.fillStyle = "rgba(241, 196, 15, 0.75)";
      ctx.fillRect(w/2 + 20, h - 210, 100, 6);
      
      // Draw masses
      ctx.fillStyle = "var(--reaction-red)";
      const numCylsLeft = Math.ceil(leftWeight);
      for (let i = 0; i < numCylsLeft; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        ctx.fillRect(w/2 - 110 + col * 18, h - 225 - row * 16, 14, 12);
      }
      
      ctx.fillStyle = "var(--accent-blue)";
      const numCylsRight = Math.ceil(rightWeight);
      for (let i = 0; i < numCylsRight; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        ctx.fillRect(w/2 + 30 + col * 18, h - 225 - row * 16, 14, 12);
      }
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Reactant A: ${leftWeight.toFixed(1)} moles`, w/2 - 70, h - 140);
      ctx.fillText(`Product B: ${rightWeight.toFixed(1)} moles`, w/2 + 70, h - 140);
    }
  }
  
  destroy() {
    // Handled
  }
}

// ==========================================================================
// 8. FLAME TEST LABORATORY
// ==========================================================================
class FlameTestLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.selectedIon = "Na+";
    this.tick = 0;
    this.IONS = {
      "Li+":  { color: "#e53935", name: "Lithium",   wave: "671 nm", rgb: [229, 57, 53] },
      "Na+":  { color: "#f9a825", name: "Sodium",    wave: "589 nm", rgb: [249, 168, 37] },
      "K+":   { color: "#9c27b0", name: "Potassium", wave: "404 nm", rgb: [156, 39, 176] },
      "Ca2+": { color: "#ef6c00", name: "Calcium",   wave: "622 nm", rgb: [239, 108, 0] },
      "Ba2+": { color: "#2e7d32", name: "Barium",    wave: "553 nm", rgb: [46, 125, 50] },
      "Sr2+": { color: "#b71c1c", name: "Strontium", wave: "640 nm", rgb: [183, 28, 28] },
      "Cu2+": { color: "#00838f", name: "Copper",    wave: "510 nm", rgb: [0, 131, 143] },
      "Pb2+": { color: "#9e9e9e", name: "Lead",      wave: "405 nm", rgb: [158, 158, 158] },
    };
  }
  init() {
    const ionOptions = Object.entries(this.IONS).map(([ion, data]) =>
      `<option value="${ion}"${ion === "Na+" ? " selected" : ""}>${data.name} (${ion}) — ${data.wave}</option>`
    ).join("");
    this.controls.innerHTML = `
      <h3 class="sim-section-title">🔥 Flame Test Burner</h3>
      <div class="sim-control-group">
        <label for="sel-flame-ion" class="sim-label">Select Metal Cation:</label>
        <select class="theme-dropdown" id="sel-flame-ion" style="width:100%">${ionOptions}</select>
      </div>
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Cation:</span><span id="flame-read-ion" style="font-weight:bold; color:var(--copper-orange);">Na+</span></div>
        <div class="sim-readout-row"><span>Emission λ:</span><span id="flame-read-wave" style="font-weight:bold; color:var(--atomic-teal);">589 nm</span></div>
        <div class="sim-readout-row"><span>Element:</span><span id="flame-read-name">Sodium</span></div>
      </div>
      <div class="sim-readout-card" style="margin-top:10px;">
        <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
          Metal ions in flame are excited by thermal energy. On falling back to ground state, they emit characteristic wavelengths visible as colors.
        </p>
      </div>
    `;
    document.getElementById("sel-flame-ion").addEventListener("change", (e) => {
      this.selectedIon = e.target.value;
      const d = this.IONS[e.target.value];
      document.getElementById("flame-read-ion").textContent = e.target.value;
      document.getElementById("flame-read-wave").textContent = d.wave;
      document.getElementById("flame-read-name").textContent = d.name;
    });
  }
  render() {
    this.tick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const d = this.IONS[this.selectedIon];
    const [r, g, b] = d.rgb;

    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    // Bench surface
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, h - 60, w, 60);
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, h - 62, w, 4);

    // Bunsen burner base
    const bx = w / 2 - 20;
    ctx.fillStyle = "#475569";
    ctx.fillRect(bx - 30, h - 130, 60, 70);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(bx - 20, h - 180, 40, 55);
    // Air inlet ring
    ctx.fillStyle = "#334155";
    ctx.fillRect(bx - 22, h - 160, 44, 10);
    // Burner tip
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(bx - 8, h - 190, 16, 15);

    // Flame animation
    const flicker = Math.sin(this.tick * 0.18) * 8;
    const flicker2 = Math.cos(this.tick * 0.13) * 5;
    const fx = w / 2;
    const fy = h - 192;

    // Outer flame
    const grad = ctx.createRadialGradient(fx, fy - 40, 5, fx, fy - 60, 90);
    grad.addColorStop(0, `rgba(${r},${g},${b}, 0.95)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b}, 0.5)`);
    grad.addColorStop(1, "rgba(6,9,14,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(fx - 35 + flicker, fy);
    ctx.quadraticCurveTo(fx - 55, fy - 80 + flicker2, fx, fy - 170 + flicker);
    ctx.quadraticCurveTo(fx + 55, fy - 80 + flicker2, fx + 35 - flicker, fy);
    ctx.closePath();
    ctx.fill();

    // Blue inner core
    const coreGrad = ctx.createRadialGradient(fx, fy - 10, 2, fx, fy - 30, 40);
    coreGrad.addColorStop(0, "rgba(255,255,255,0.9)");
    coreGrad.addColorStop(0.4, "rgba(100,180,255,0.7)");
    coreGrad.addColorStop(1, "rgba(6,9,14,0)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(fx - 15, fy);
    ctx.quadraticCurveTo(fx - 20, fy - 40, fx, fy - 80);
    ctx.quadraticCurveTo(fx + 20, fy - 40, fx + 15, fy);
    ctx.closePath();
    ctx.fill();

    // Wire loop (platinum)
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(150, h - 180);
    ctx.lineTo(fx - 5, fy + 5);
    ctx.stroke();
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(fx - 5, fy + 5, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Salt bead on loop
    ctx.fillStyle = `rgba(${r},${g},${b}, 0.85)`;
    ctx.beginPath();
    ctx.arc(fx - 5, fy + 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Label handle
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "12px 'JetBrains Mono'";
    ctx.textAlign = "left";
    ctx.fillText("Pt wire loop", 90, h - 195);

    // Color swatch panel (right side)
    ctx.save();
    ctx.translate(w - 220, 40);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 12px 'Outfit', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("FLAME COLOR REFERENCE", 0, -8);

    const allIons = Object.entries(this.IONS);
    allIons.forEach(([ion, data], i) => {
      const isActive = ion === this.selectedIon;
      const row = Math.floor(i / 2);
      const col = i % 2;
      const rx = col * 100;
      const ry = row * 36;

      ctx.fillStyle = isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.roundRect(rx, ry, 90, 28, 6);
      ctx.fill();
      if (isActive) {
        ctx.strokeStyle = data.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, 90, 28);
      }

      ctx.fillStyle = data.color;
      ctx.beginPath();
      ctx.arc(rx + 14, ry + 14, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isActive ? "#ffffff" : "rgba(255,255,255,0.5)";
      ctx.font = `${isActive ? "bold " : ""}10px 'JetBrains Mono'`;
      ctx.fillText(ion, rx + 28, ry + 11);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "9px 'JetBrains Mono'";
      ctx.fillText(data.wave, rx + 28, ry + 22);
    });
    ctx.restore();
  }
  destroy() {}
}

// ==========================================================================
// 9. SALT ANALYZER LABORATORY
// ==========================================================================
class SaltAnalyzerLab {
  constructor(canvas, controls, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.sim = sim;
    this.reagentAdded = "none";
    this.tick = 0;
    this.pptFalling = 0;
    this.REAGENTS = {
      none:    { label: "No Reagent",                    solution: [255,255,255,0.05], ppt: null,              result: "No reagent added. Solution remains clear and colorless." },
      HCl:     { label: "Dilute HCl",                    solution: [255,255,255,0.05], ppt: [255,255,255,0.9], result: "White curdy precipitate → AgCl↓ or PbCl₂↓ (Group I cations confirmed)." },
      H2S:     { label: "H₂S Gas",                       solution: [255,255,255,0.05], ppt: [24,25,28,0.95],   result: "Black precipitate → CuS↓ or PbS↓ (Group II sulfide group)." },
      NH4OH:   { label: "NH₄OH (Excess)",                solution: [255,255,255,0.05], ppt: [139,90,43,0.85],  result: "Reddish-brown gelatinous ppt → Fe(OH)₃↓ or white Al(OH)₃↓." },
      AgNO3:   { label: "Silver Nitrate",                solution: [255,255,255,0.05], ppt: [255,255,255,0.95], result: "Heavy white precipitate AgCl↓ (insoluble in HNO₃, soluble in NH₄OH)." },
      FeCl3:   { label: "FeCl₃ Solution",               solution: [139,0,0,0.75],    ppt: null,              result: "Blood-red coloration → Iron(III) acetate complex in acidic medium." },
      Nessler: { label: "Nessler's Reagent",             solution: [255,255,255,0.05], ppt: [139,69,19,0.9],   result: "Reddish-brown precipitate → NH₄⁺ detected (Millon's base iodide)." },
      BaCl2:   { label: "BaCl₂ Solution",               solution: [255,255,255,0.05], ppt: [255,255,255,0.9],  result: "White precipitate → BaSO₄↓ (sulfate confirmed; insoluble in acids)." },
      NaOH:    { label: "NaOH (excess)",                solution: [255,255,255,0.05], ppt: [0,128,0,0.7],     result: "Green precipitate → Ni(OH)₂↓ or Fe(OH)₂↓ (Group IV/V cations)." },
      K2CrO4:  { label: "K₂CrO₄",                      solution: [255,255,255,0.05], ppt: [255,215,0,0.9],   result: "Yellow precipitate → BaCrO₄↓ or PbCrO₄↓ (barium/lead confirmed)." },
    };
  }

  init() {
    const options = Object.entries(this.REAGENTS).map(([k, v]) =>
      `<option value="${k}"${k === "none" ? " selected" : ""}>${v.label}</option>`
    ).join("");
    this.controls.innerHTML = `
      <h3 class="sim-section-title">⚗️ Qualitative Analysis</h3>
      <div class="sim-control-group">
        <label for="sel-salt-rg" class="sim-label">Add Reagent:</label>
        <select class="theme-dropdown" id="sel-salt-rg" style="width:100%">${options}</select>
      </div>
      <div class="sim-control-group" style="margin-top:8px;">
        <button class="control-btn accent" id="btn-add-reagent" style="width:100%">Add Reagent Dropwise</button>
      </div>
      <div class="sim-control-group">
        <button class="control-btn" id="btn-reset-salt" style="width:100%; border-color:var(--reaction-red);">Reset Test Tube</button>
      </div>
      <div class="sim-readout-card">
        <p id="read-salt-result" style="font-size:0.82rem; line-height:1.5; color:var(--text-color);">
          Select a reagent and click "Add Reagent Dropwise" to observe the reaction.
        </p>
      </div>
    `;
    document.getElementById("btn-add-reagent").addEventListener("click", () => {
      this.reagentAdded = document.getElementById("sel-salt-rg").value;
      this.pptFalling = 1;
      document.getElementById("read-salt-result").textContent = this.REAGENTS[this.reagentAdded].result;
    });
    document.getElementById("btn-reset-salt").addEventListener("click", () => {
      this.reagentAdded = "none";
      this.pptFalling = 0;
      document.getElementById("sel-salt-rg").value = "none";
      document.getElementById("read-salt-result").textContent = "Select a reagent and click \"Add Reagent Dropwise\" to observe the reaction.";
    });
  }

  render() {
    this.tick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    // Bench
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, h - 50, w, 50);
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, h - 52, w, 4);

    // Lab stand vertical rod
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(120, h - 52);
    ctx.lineTo(120, 80);
    ctx.stroke();
    // Base plate
    ctx.fillStyle = "#475569";
    ctx.fillRect(70, h - 64, 100, 14);
    // Clamp ring
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w/2, 200, 30, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(120, 200);
    ctx.lineTo(w/2 - 30, 200);
    ctx.stroke();

    // Test tube
    const tx = w / 2;
    const ty = 140;
    const ttW = 50, ttH = 280;
    const rg = this.REAGENTS[this.reagentAdded];
    const [sr, sg, sb, sa] = rg.solution;

    // Liquid fill
    ctx.fillStyle = `rgba(${sr},${sg},${sb},${sa})`;
    ctx.beginPath();
    ctx.moveTo(tx - ttW/2 + 3, ty + ttH - 120);
    ctx.lineTo(tx + ttW/2 - 3, ty + ttH - 120);
    ctx.lineTo(tx + ttW/2 - 3, ty + ttH - ttW/2);
    ctx.arc(tx, ty + ttH - ttW/2, ttW/2 - 3, 0, Math.PI);
    ctx.lineTo(tx - ttW/2 + 3, ty + ttH - 120);
    ctx.closePath();
    ctx.fill();

    // Precipitate
    if (rg.ppt && this.pptFalling > 0) {
      if (this.pptFalling < 60) this.pptFalling++;
      const pptHeight = Math.min(50, (this.pptFalling / 60) * 50);
      const [pr, pg, pb, pa] = rg.ppt;
      ctx.fillStyle = `rgba(${pr},${pg},${pb},${pa})`;
      ctx.beginPath();
      ctx.arc(tx, ty + ttH - ttW/2, ttW/2 - 3, 0, Math.PI);
      ctx.lineTo(tx + ttW/2 - 3, ty + ttH - ttW/2 - pptHeight + 10);
      ctx.lineTo(tx - ttW/2 + 3, ty + ttH - ttW/2 - pptHeight + 10);
      ctx.closePath();
      ctx.fill();

      // Particles
      ctx.fillStyle = `rgba(${pr},${pg},${pb},0.4)`;
      for (let i = 0; i < 12; i++) {
        const px = tx - 16 + (Math.sin(i * 2.1 + this.tick * 0.02) * 0.5 + 0.5) * 32;
        const py = ty + ttH - ttW/2 - 60 - Math.abs(Math.sin(i * 1.3 + this.tick * 0.03)) * pptHeight;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dropper animation
    if (this.reagentAdded !== "none" && this.pptFalling > 0 && this.pptFalling < 30) {
      const dropY = ty - 30 + (this.pptFalling / 30) * (ty + 80);
      ctx.fillStyle = `rgba(${sr > 50 ? sr : 200},${sg},${sb},0.7)`;
      ctx.beginPath();
      ctx.arc(tx + 20, Math.min(dropY, ty + ttH - 140), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glass tube outline
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx - ttW/2, ty);
    ctx.lineTo(tx - ttW/2, ty + ttH - ttW/2);
    ctx.arc(tx, ty + ttH - ttW/2, ttW/2, Math.PI, 0, true);
    ctx.lineTo(tx + ttW/2, ty);
    ctx.stroke();
    // Lip rim
    ctx.beginPath();
    ctx.ellipse(tx, ty, ttW/2 + 4, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Glass shine
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx - ttW/2 + 6, ty + 20);
    ctx.lineTo(tx - ttW/2 + 6, ty + ttH - 80);
    ctx.stroke();

    // Reagent dropper bottle (right)
    ctx.save();
    ctx.translate(w - 160, 80);
    ctx.fillStyle = "#1e3a5f";
    ctx.beginPath();
    ctx.roundRect(0, 30, 60, 100, 8);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(18, 0, 24, 35);
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(30, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "9px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText(this.REAGENTS[this.reagentAdded].label.slice(0,8), 30, 80);
    ctx.restore();
  }

  destroy() {}
}

// ==========================================================================
// 10. GALVANIC CELL (ELECTROCHEMISTRY) LABORATORY
// ==========================================================================
class GalvanicCellLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.concZn = 1.0;  // [Zn2+] M
    this.concCu = 1.0;  // [Cu2+] M
    this.tick = 0;
    this.electronPos = 0;
    this.ionParticles = [];
    this.initIons();
  }

  initIons() {
    this.ionParticles = [];
    for (let i = 0; i < 20; i++) {
      this.ionParticles.push({
        x: 50 + Math.random() * 80,
        y: 300 + Math.random() * 80,
        type: i < 10 ? "K+" : "Cl-",
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
      });
    }
  }

  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">⚡ Daniell Cell Setup</h3>
      <div class="sim-control-group">
        <div class="sim-label">[Zn²⁺] Concentration: <span class="sim-value-label" id="lbl-zn-conc">1.00 M</span></div>
        <input type="range" class="sim-slider" id="slider-zn-conc" min="0.01" max="2.0" step="0.01" value="1.0">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">[Cu²⁺] Concentration: <span class="sim-value-label" id="lbl-cu-conc">1.00 M</span></div>
        <input type="range" class="sim-slider" id="slider-cu-conc" min="0.01" max="2.0" step="0.01" value="1.0">
      </div>
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>E°cell (std):</span><span style="color:var(--acid-green); font-weight:bold;">+1.10 V</span></div>
        <div class="sim-readout-row"><span>E cell (Nernst):</span><span id="read-ecell" style="color:var(--atomic-teal); font-weight:bold;">+1.10 V</span></div>
        <div class="sim-readout-row"><span>ΔG (kJ/mol):</span><span id="read-dg" style="color:var(--copper-orange); font-weight:bold;">-212.3 kJ</span></div>
      </div>
      <div class="sim-readout-card" style="margin-top:8px;">
        <p style="font-size:0.78rem; line-height:1.4; color:var(--text-muted);">
          Nernst: E = E° − (0.0592/n)log([Zn²⁺]/[Cu²⁺])<br>
          Zn → Zn²⁺ + 2e⁻ (anode, oxidation)<br>
          Cu²⁺ + 2e⁻ → Cu (cathode, reduction)
        </p>
      </div>
    `;

    const updateNernst = () => {
      const E0 = 1.10;
      const n = 2;
      const Q = this.concZn / this.concCu;
      const Ecell = E0 - (0.05916 / n) * Math.log10(Q);
      const dG = -n * 96485 * Ecell / 1000;
      document.getElementById("read-ecell").textContent = `${Ecell.toFixed(3)} V`;
      document.getElementById("read-dg").textContent = `${dG.toFixed(1)} kJ`;
    };

    document.getElementById("slider-zn-conc").addEventListener("input", (e) => {
      this.concZn = parseFloat(e.target.value);
      document.getElementById("lbl-zn-conc").textContent = `${this.concZn.toFixed(2)} M`;
      updateNernst();
    });

    document.getElementById("slider-cu-conc").addEventListener("input", (e) => {
      this.concCu = parseFloat(e.target.value);
      document.getElementById("lbl-cu-conc").textContent = `${this.concCu.toFixed(2)} M`;
      updateNernst();
    });

    updateNernst();
  }

  render() {
    this.tick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    // Bench
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, h - 40, w, 40);

    // --- LEFT BEAKER (Zn anode) ---
    const lx = 100, ly = 200, bw = 160, bh = 200;
    // ZnSO4 solution (light blue-grey)
    ctx.fillStyle = "rgba(140,200,220,0.25)";
    ctx.fillRect(lx, ly + 30, bw, bh - 30);
    // Beaker outline
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(lx, ly, bw, bh);
    // Beaker label
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("ZnSO₄ (aq)", lx + bw/2, ly + bh + 20);
    ctx.fillText(`[Zn²⁺] = ${this.concZn.toFixed(2)} M`, lx + bw/2, ly + bh + 36);
    // Zinc electrode
    ctx.fillStyle = "#78909c";
    ctx.fillRect(lx + bw/2 - 8, ly - 30, 16, bh - 20);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 13px 'Outfit'";
    ctx.fillText("Zn (−)", lx + bw/2, ly - 38);
    // ANODE label
    ctx.fillStyle = "var(--reaction-red)";
    ctx.font = "11px 'JetBrains Mono'";
    ctx.fillText("ANODE", lx + bw/2, ly - 52);
    // Dissolution particles (Zn2+ leaving)
    for (let i = 0; i < 5; i++) {
      const angle = (this.tick * 0.05 + i * 1.26) % (Math.PI * 2);
      const px = lx + bw/2 + Math.cos(angle) * 35;
      const py = ly + 60 + Math.sin(angle * 0.7) * 20 + i * 18;
      ctx.fillStyle = `rgba(120,144,156,${0.3 + 0.2 * Math.sin(this.tick * 0.08 + i)})`;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "8px 'JetBrains Mono'";
      ctx.fillText("Zn²⁺", px + 6, py + 3);
    }

    // --- RIGHT BEAKER (Cu cathode) ---
    const rx = w - 100 - bw, ry = 200;
    // CuSO4 solution (blue)
    ctx.fillStyle = "rgba(30,100,200,0.3)";
    ctx.fillRect(rx, ry + 30, bw, bh - 30);
    // Beaker
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(rx, ry, bw, bh);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("CuSO₄ (aq)", rx + bw/2, ry + bh + 20);
    ctx.fillText(`[Cu²⁺] = ${this.concCu.toFixed(2)} M`, rx + bw/2, ry + bh + 36);
    // Copper electrode (copper-colored)
    ctx.fillStyle = "#b87333";
    ctx.fillRect(rx + bw/2 - 8, ry - 30, 16, bh - 20);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 13px 'Outfit'";
    ctx.fillText("Cu (+)", rx + bw/2, ry - 38);
    // CATHODE label
    ctx.fillStyle = "var(--atomic-teal)";
    ctx.font = "11px 'JetBrains Mono'";
    ctx.fillText("CATHODE", rx + bw/2, ry - 52);
    // Cu deposition particles
    for (let i = 0; i < 5; i++) {
      const angle = (this.tick * 0.04 + i * 1.26) % (Math.PI * 2);
      const px = rx + bw/2 + Math.cos(angle) * 30;
      const py = ry + 60 + Math.sin(angle * 0.8) * 20 + i * 18;
      ctx.fillStyle = `rgba(184,115,51,${0.5 + 0.3 * Math.cos(this.tick * 0.06 + i)})`;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- WIRE (External circuit) ---
    const wireY = 130;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lx + bw/2, ly - 30);
    ctx.lineTo(lx + bw/2, wireY);
    ctx.lineTo(rx + bw/2, wireY);
    ctx.lineTo(rx + bw/2, ry - 30);
    ctx.stroke();

    // Voltmeter box
    const vmx = (lx + bw/2 + rx + bw/2) / 2;
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(vmx - 40, wireY - 30, 80, 60, 8);
    ctx.fill();
    ctx.stroke();
    const E0 = 1.10;
    const Q = this.concZn / this.concCu;
    const Ecell = E0 - (0.05916 / 2) * Math.log10(Q);
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 14px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText(`${Ecell.toFixed(3)} V`, vmx, wireY + 8);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px 'Outfit'";
    ctx.fillText("Voltmeter", vmx, wireY - 15);

    // Electron flow animation
    this.electronPos = (this.electronPos + 2) % (2 * (vmx - lx - bw/2 + 40));
    const totalWire = vmx - lx - bw/2 - 40;
    for (let i = 0; i < 3; i++) {
      const pos = (this.electronPos + i * 60) % (totalWire * 2);
      let ex, ey;
      if (pos < totalWire) {
        ex = lx + bw/2 + pos;
        ey = wireY;
      } else {
        ex = vmx + 40 + (pos - totalWire);
        ey = wireY;
      }
      if (ex < vmx - 40 || ex > vmx + 40) {
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "8px 'JetBrains Mono'";
        ctx.fillText("e⁻", ex + 4, ey - 6);
      }
    }

    // Salt bridge
    const sbY = 240;
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(lx + bw, sbY);
    ctx.lineTo(rx, sbY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px 'Outfit'";
    ctx.textAlign = "center";
    ctx.fillText("Salt Bridge (KCl)", (lx + bw + rx) / 2, sbY - 14);

    // Salt bridge ions
    this.ionParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      // Keep within salt bridge
      const inBridge = p.x > lx + bw && p.x < rx && p.y > sbY - 8 && p.y < sbY + 8;
      if (!inBridge) {
        p.x = lx + bw + 20 + Math.random() * (rx - lx - bw - 40);
        p.y = sbY + (Math.random() - 0.5) * 10;
        p.vx = p.type === "K+" ? 1.2 : -1.2;
        p.vy = (Math.random() - 0.5) * 0.5;
      }
      ctx.fillStyle = p.type === "K+" ? "#fbbf24" : "#60a5fa";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  destroy() {}
}

// ==========================================================================
// 11. BEER-LAMBERT SPECTROPHOTOMETRY LABORATORY
// ==========================================================================
class BeerLambertLab {
  constructor(canvas, controls, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.sim = sim;
    this.concentration = 0.5;  // M
    this.pathlength = 1.0;     // cm
    this.molarExtinction = 200; // L mol-1 cm-1
    this.calibData = [];
    this.tick = 0;
    // Generate calibration points
    for (let c = 0; c <= 1.0; c += 0.1) {
      this.calibData.push({ c, A: this.molarExtinction * c * this.pathlength });
    }
  }

  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">🔬 Spectrophotometry (Beer-Lambert)</h3>
      <div class="sim-control-group">
        <div class="sim-label">Solution Concentration: <span class="sim-value-label" id="lbl-bl-conc">0.50 M</span></div>
        <input type="range" class="sim-slider" id="slider-bl-conc" min="0.01" max="1.0" step="0.01" value="0.5">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Path Length (l): <span class="sim-value-label" id="lbl-bl-path">1.0 cm</span></div>
        <input type="range" class="sim-slider" id="slider-bl-path" min="0.1" max="5.0" step="0.1" value="1.0">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Molar Extinction (ε): <span class="sim-value-label" id="lbl-bl-ext">200</span></div>
        <input type="range" class="sim-slider" id="slider-bl-ext" min="50" max="500" step="10" value="200">
      </div>
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Absorbance A:</span><span id="read-bl-abs" style="color:var(--atomic-teal); font-weight:bold;">100.0</span></div>
        <div class="sim-readout-row"><span>Transmittance %T:</span><span id="read-bl-trans" style="color:var(--copper-orange); font-weight:bold;">--</span></div>
        <div class="sim-readout-row"><span>Law: A = εCl</span><span style="color:var(--text-muted); font-size:0.8rem;">verified ✓</span></div>
      </div>
    `;

    const update = () => {
      const A = this.molarExtinction * this.concentration * this.pathlength;
      const T = Math.pow(10, -A) * 100;
      document.getElementById("read-bl-abs").textContent = A.toFixed(2);
      document.getElementById("read-bl-trans").textContent = `${Math.max(0, T).toFixed(2)}%`;
    };

    document.getElementById("slider-bl-conc").addEventListener("input", (e) => {
      this.concentration = parseFloat(e.target.value);
      document.getElementById("lbl-bl-conc").textContent = `${this.concentration.toFixed(2)} M`;
      update();
    });
    document.getElementById("slider-bl-path").addEventListener("input", (e) => {
      this.pathlength = parseFloat(e.target.value);
      document.getElementById("lbl-bl-path").textContent = `${this.pathlength.toFixed(1)} cm`;
      update();
    });
    document.getElementById("slider-bl-ext").addEventListener("input", (e) => {
      this.molarExtinction = parseFloat(e.target.value);
      document.getElementById("lbl-bl-ext").textContent = this.molarExtinction.toFixed(0);
      update();
    });

    update();
  }

  render() {
    this.tick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    const A = this.molarExtinction * this.concentration * this.pathlength;
    const transmit = Math.max(0, Math.pow(10, -A));

    // Spectrophotometer bench
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(20, h/2 - 30, w - 40, 80);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, h/2 - 30, w - 40, 80);

    // Light source (left)
    const srcX = 60;
    const srcY = h/2 + 10;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(srcX, srcY, 18, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    const srcGlow = ctx.createRadialGradient(srcX, srcY, 5, srcX, srcY, 30);
    srcGlow.addColorStop(0, "rgba(245,158,11,0.4)");
    srcGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = srcGlow;
    ctx.beginPath();
    ctx.arc(srcX, srcY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("Source", srcX, srcY + 32);

    // Collimator / slit
    ctx.fillStyle = "#334155";
    ctx.fillRect(srcX + 22, srcY - 18, 12, 36);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(srcX + 22, srcY - 3, 12, 6);

    // Cuvette (colored based on concentration)
    const cvX = w/2 - 30;
    const alpha = Math.min(0.85, this.concentration * 0.6);
    const hue = 220 - this.molarExtinction * 0.1; // shift hue based on extinction
    ctx.fillStyle = `hsla(${hue}, 70%, 40%, ${alpha})`;
    ctx.fillRect(cvX, srcY - 40, 60, 80);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cvX, srcY - 40, 60, 80);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText(`C = ${this.concentration.toFixed(2)} M`, cvX + 30, srcY + 56);
    ctx.fillText(`l = ${this.pathlength.toFixed(1)} cm`, cvX + 30, srcY + 68);

    // Incident beam (solid bright)
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(srcX + 34, srcY);
    ctx.lineTo(cvX, srcY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("I₀", (srcX + 34 + cvX) / 2, srcY - 12);

    // Transmitted beam (dimmed by absorbance)
    const transAlpha = Math.max(0.05, transmit);
    ctx.strokeStyle = `rgba(253,230,138,${transAlpha})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cvX + 60, srcY);
    ctx.lineTo(w - 80, srcY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("I", (cvX + 60 + w - 80) / 2, srcY - 12);

    // Detector
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(w - 80, srcY - 20, 40, 40);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(w - 75, srcY - 15, 30, 30);
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 11px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText(`${(transmit * 100).toFixed(1)}%T`, w - 60, srcY + 42);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.fillText("Detector", w - 60, srcY + 54);

    // A = εCl display
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 14px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText(`A = ε × C × l = ${this.molarExtinction} × ${this.concentration.toFixed(2)} × ${this.pathlength.toFixed(1)} = ${A.toFixed(2)}`, w/2, 50);

    // Calibration curve (A vs C)
    ctx.save();
    ctx.translate(60, h/2 + 80);
    const graphW = w - 120, graphH = h/2 - 100;

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, graphW, graphH);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("Absorbance A (A = εCl)", graphW/2, graphH + 20);
    ctx.save();
    ctx.translate(-30, graphH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Absorbance A", 0, 0);
    ctx.restore();

    // Line
    const maxA = this.molarExtinction * 1.0 * this.pathlength;
    ctx.strokeStyle = "var(--atomic-teal)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let c = 0; c <= 1.0; c += 0.05) {
      const Aval = this.molarExtinction * c * this.pathlength;
      const px = (c / 1.0) * graphW;
      const py = graphH - (Aval / Math.max(maxA, 1)) * graphH;
      if (c === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current sample point
    const sampleX = (this.concentration / 1.0) * graphW;
    const sampleY = graphH - (A / Math.max(maxA, 1)) * graphH;
    ctx.fillStyle = "var(--reaction-red)";
    ctx.beginPath();
    ctx.arc(Math.min(graphW, sampleX), Math.max(0, sampleY), 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  destroy() {}
}

// ==========================================================================
// 12. RADIOACTIVE DECAY LABORATORY
// ==========================================================================
class RadioactiveDecayLab {
  constructor(canvas, controls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.halfLife = 30.0;  // seconds in sim time (very fast for demo)
    this.totalNuclei = 180;
    this.nuclei = [];
    this.timeSeries = [];
    this.elapsed = 0;
    this.lastDecayTime = 0;
    this.running = true;
    this.initNuclei();
  }

  initNuclei() {
    this.nuclei = [];
    this.timeSeries = [];
    this.elapsed = 0;
    for (let i = 0; i < this.totalNuclei; i++) {
      this.nuclei.push({ decayed: false, flash: 0 });
    }
  }

  lambda() {
    return Math.LN2 / this.halfLife;
  }

  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">☢️ Radioactive Decay</h3>
      <div class="sim-control-group">
        <div class="sim-label">Half-Life (t½): <span class="sim-value-label" id="lbl-hl">30.0 s</span></div>
        <input type="range" class="sim-slider" id="slider-hl" min="5" max="120" step="5" value="30">
      </div>
      <div class="sim-control-group">
        <button class="control-btn accent" id="btn-decay-reset" style="width:100%">Reset Nuclei</button>
      </div>
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Parent N(t):</span><span id="read-nt" style="color:var(--reaction-red); font-weight:bold;">180</span></div>
        <div class="sim-readout-row"><span>Daughter D(t):</span><span id="read-dt" style="color:var(--acid-green); font-weight:bold;">0</span></div>
        <div class="sim-readout-row"><span>Elapsed time:</span><span id="read-elapsed">0.0 s</span></div>
        <div class="sim-readout-row"><span>λ (decay const):</span><span id="read-lambda">0.0231 s⁻¹</span></div>
      </div>
      <div class="sim-readout-card" style="margin-top:8px;">
        <p style="font-size:0.78rem; line-height:1.4; color:var(--text-muted);">
          N(t) = N₀ · e^(−λt)<br>
          t½ = 0.693 / λ<br>
          First-order kinetics: Rate ∝ N
        </p>
      </div>
    `;
    document.getElementById("slider-hl").addEventListener("input", (e) => {
      this.halfLife = parseFloat(e.target.value);
      document.getElementById("lbl-hl").textContent = `${this.halfLife.toFixed(1)} s`;
      document.getElementById("read-lambda").textContent = `${this.lambda().toFixed(4)} s⁻¹`;
    });
    document.getElementById("btn-decay-reset").addEventListener("click", () => {
      this.initNuclei();
    });
    document.getElementById("read-lambda").textContent = `${this.lambda().toFixed(4)} s⁻¹`;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    // Update decay physics
    this.elapsed += 0.016; // ~60fps increment
    const dt = 0.016;
    const pDecay = 1 - Math.exp(-this.lambda() * dt);

    let parentCount = 0, daughterCount = 0;
    this.nuclei.forEach(n => {
      if (!n.decayed) {
        parentCount++;
        if (Math.random() < pDecay) {
          n.decayed = true;
          n.flash = 15;
        }
      } else {
        daughterCount++;
        if (n.flash > 0) n.flash--;
      }
    });

    if (document.getElementById("read-nt")) {
      document.getElementById("read-nt").textContent = parentCount;
      document.getElementById("read-dt").textContent = daughterCount;
      document.getElementById("read-elapsed").textContent = `${this.elapsed.toFixed(1)} s`;
    }

    // Push time series point every 30 frames
    if (Math.floor(this.elapsed / 0.5) > this.timeSeries.length) {
      this.timeSeries.push({ t: this.elapsed, N: parentCount, D: daughterCount });
      if (this.timeSeries.length > 100) this.timeSeries.shift();
    }

    // Draw nuclei grid (15 x 12)
    const cols = 15, rows = 12;
    const cellW = 250 / cols, cellH = 200 / rows;
    const gridX = 30, gridY = 60;

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px 'Outfit'";
    ctx.textAlign = "left";
    ctx.fillText("Isotope Lattice (● = parent nucleus, ○ = daughter)", gridX, gridY - 10);

    this.nuclei.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const nx = gridX + col * cellW + cellW / 2;
      const ny = gridY + row * cellH + cellH / 2;

      if (n.decayed) {
        if (n.flash > 0) {
          // Flash on decay
          ctx.fillStyle = `rgba(255,200,0,${n.flash / 15})`;
          ctx.beginPath();
          ctx.arc(nx, ny, cellW * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(34,197,94,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(nx, ny, cellW * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const grd = ctx.createRadialGradient(nx - 2, ny - 2, 1, nx, ny, cellW * 0.38);
        grd.addColorStop(0, "#ff6b6b");
        grd.addColorStop(1, "#b91c1c");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(nx, ny, cellW * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Legend
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px 'Outfit'";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(gridX + 8, gridY + 220, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("= Parent nucleus (radioactive)", gridX + 20, gridY + 225);
    ctx.strokeStyle = "rgba(34,197,94,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gridX + 170, gridY + 220, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("= Daughter (stable)", gridX + 183, gridY + 225);

    // Decay curve graph (right)
    ctx.save();
    ctx.translate(320, 50);
    const gW = w - 360, gH = h - 100;

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, gW, gH);

    // Theoretical N(t) curve
    const N0 = this.totalNuclei;
    const tMax = this.halfLife * 4;
    ctx.strokeStyle = "rgba(239,68,68,0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let t = 0; t <= tMax; t += tMax / 200) {
      const N = N0 * Math.exp(-this.lambda() * t);
      const px = (t / tMax) * gW;
      const py = gH - (N / N0) * gH;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Parent measured line
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    this.timeSeries.forEach((pt, idx) => {
      const px = (pt.t / tMax) * gW;
      const py = gH - (pt.N / N0) * gH;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Daughter measured line
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    this.timeSeries.forEach((pt, idx) => {
      const px = (pt.t / tMax) * gW;
      const py = gH - (pt.D / N0) * gH;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Axes labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("Time →", gW/2, gH + 18);
    ctx.save();
    ctx.translate(-20, gH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Nuclei count", 0, 0);
    ctx.restore();

    // Half-life marker
    const hlPx = (this.halfLife / tMax) * gW;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(hlPx, 0);
    ctx.lineTo(hlPx, gH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("t½", hlPx, 12);

    ctx.restore();
  }

  destroy() {}
}

// ==========================================================================
// 13. STOICHIOMETRY LAB
// ==========================================================================
class StoichiometryLab {
  constructor(canvas, controls, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.sim = sim;
    this.molesA = 2.0;
    this.molesB = 3.0;
    this.ratio_a = 1;
    this.ratio_b = 1;
    this.tick = 0;
    // Parse stoichiometry from title
    const title = (sim && sim.title) ? sim.title.toLowerCase() : "";
    if (title.includes("haber") || title.includes("n2") || title.includes("nh3")) {
      this.ratio_a = 1; this.ratio_b = 3; this.product = "NH₃"; this.reactA = "N₂"; this.reactB = "H₂"; this.ratio_p = 2;
    } else if (title.includes("water") || title.includes("h2o")) {
      this.ratio_a = 2; this.ratio_b = 1; this.product = "H₂O"; this.reactA = "H₂"; this.reactB = "O₂"; this.ratio_p = 2;
    } else {
      this.ratio_a = 1; this.ratio_b = 1; this.product = "C"; this.reactA = "A"; this.reactB = "B"; this.ratio_p = 1;
    }
  }

  limiting() {
    const maxFromA = this.molesA / this.ratio_a * this.ratio_p;
    const maxFromB = this.molesB / this.ratio_b * this.ratio_p;
    if (maxFromA <= maxFromB) return { limit: "A", product: maxFromA };
    return { limit: "B", product: maxFromB };
  }

  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">⚗️ Stoichiometry Calculator</h3>
      <div class="sim-control-group">
        <div class="sim-label">Moles of ${this.reactA}: <span class="sim-value-label" id="lbl-mol-a">2.00</span></div>
        <input type="range" class="sim-slider" id="slider-mol-a" min="0.1" max="5.0" step="0.1" value="2.0">
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Moles of ${this.reactB}: <span class="sim-value-label" id="lbl-mol-b">3.00</span></div>
        <input type="range" class="sim-slider" id="slider-mol-b" min="0.1" max="5.0" step="0.1" value="3.0">
      </div>
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>Limiting Reagent:</span><span id="read-limit" style="color:var(--reaction-red); font-weight:bold;">A</span></div>
        <div class="sim-readout-row"><span>Product ${this.product} (mol):</span><span id="read-product" style="color:var(--atomic-teal); font-weight:bold;">2.00</span></div>
        <div class="sim-readout-row"><span>Excess reagent:</span><span id="read-excess" style="color:var(--copper-orange); font-weight:bold;">--</span></div>
      </div>
    `;
    const update = () => {
      const { limit, product } = this.limiting();
      document.getElementById("read-limit").textContent = limit;
      document.getElementById("read-product").textContent = product.toFixed(2) + " mol";
      const excessB = this.molesB - (this.molesA / this.ratio_a) * this.ratio_b;
      const excessA = this.molesA - (this.molesB / this.ratio_b) * this.ratio_a;
      document.getElementById("read-excess").textContent = limit === "A" ? `B excess: ${Math.max(0, excessB).toFixed(2)} mol` : `A excess: ${Math.max(0, excessA).toFixed(2)} mol`;
    };
    document.getElementById("slider-mol-a").addEventListener("input", (e) => { this.molesA = parseFloat(e.target.value); document.getElementById("lbl-mol-a").textContent = this.molesA.toFixed(2); update(); });
    document.getElementById("slider-mol-b").addEventListener("input", (e) => { this.molesB = parseFloat(e.target.value); document.getElementById("lbl-mol-b").textContent = this.molesB.toFixed(2); update(); });
    update();
  }

  render() {
    this.tick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    const { limit, product } = this.limiting();
    const maxMoles = 5.0;

    // Bar chart
    const bars = [
      { label: `${this.reactA}\n(${this.ratio_a} mol)`, value: this.molesA, color: "#60a5fa", isLimit: limit === "A" },
      { label: `${this.reactB}\n(${this.ratio_b} mol)`, value: this.molesB, color: "#f87171", isLimit: limit === "B" },
      { label: `${this.product}\nproduced`, value: product, color: "#4ade80", isLimit: false },
    ];

    const barW = 90, gap = 60, chartH = h - 180;
    const startX = (w - (bars.length * (barW + gap) - gap)) / 2;
    const baseY = h - 100;

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 13px 'Outfit'";
    ctx.textAlign = "center";
    ctx.fillText(`${this.reactA} + ${this.reactB}  →  ${this.product}`, w/2, 40);

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "11px 'JetBrains Mono'";
    ctx.fillText(`Ratio: ${this.ratio_a} : ${this.ratio_b}  →  ${this.ratio_p}`, w/2, 60);

    bars.forEach((bar, i) => {
      const bx = startX + i * (barW + gap);
      const barH = (bar.value / maxMoles) * chartH;
      const by = baseY - barH;

      // Glow effect for limiting reagent
      if (bar.isLimit) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ef4444";
      }

      const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
      grad.addColorStop(0, bar.color);
      grad.addColorStop(1, bar.color + "88");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, barH, [6, 6, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (bar.isLimit) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(bx, by, barW, barH);
        ctx.setLineDash([]);
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 10px 'JetBrains Mono'";
        ctx.fillText("LIMITING", bx + barW/2, by - 20);
        ctx.fillText("REAGENT", bx + barW/2, by - 8);
      }

      // Value label
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 13px 'JetBrains Mono'";
      ctx.textAlign = "center";
      ctx.fillText(`${bar.value.toFixed(2)}`, bx + barW/2, by - (bar.isLimit ? 35 : 8));

      // X-axis label
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "12px 'Outfit'";
      ctx.fillText(bar.label.split("\n")[0], bx + barW/2, baseY + 20);
      ctx.font = "10px 'JetBrains Mono'";
      ctx.fillText(bar.label.split("\n")[1], bx + barW/2, baseY + 34);
    });

    // Baseline
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX - 10, baseY);
    ctx.lineTo(startX + bars.length * (barW + gap), baseY);
    ctx.stroke();

    // Mole animation (floating circles)
    for (let j = 0; j < Math.round(this.molesA); j++) {
      const angle = (this.tick * 0.02 + j * 0.7) % (Math.PI * 2);
      const cx = startX + barW/2 + Math.cos(angle) * 25;
      const cy = baseY - (this.molesA / maxMoles) * chartH - 40 + Math.sin(angle * 1.3) * 10;
      ctx.fillStyle = "rgba(96,165,250,0.6)";
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  destroy() {}
}

// ==========================================================================
// 14. SOLUTION MIXER LAB
// ==========================================================================
class SolutionMixerLab {
  constructor(canvas, controls, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.sim = sim;
    this.molality = 1.0;
    this.Kb = 0.52;
    this.Kf = 1.86;
    this.vantHoff = 1;
    this.solute = "NaCl";
    this.tick = 0;
    this.bubbles = [];
    for (let i = 0; i < 25; i++) this.bubbles.push({ x: 60 + Math.random()*200, y: 200 + Math.random()*150, r: 2 + Math.random() * 4, vy: -0.5 - Math.random() });
  }

  init() {
    this.controls.innerHTML = `
      <h3 class="sim-section-title">🧪 Colligative Properties</h3>
      <div class="sim-control-group">
        <label for="sel-solute" class="sim-label">Solute:</label>
        <select class="theme-dropdown" id="sel-solute" style="width:100%">
          <option value="glucose">Glucose (C₆H₁₂O₆) — i=1</option>
          <option value="NaCl" selected>NaCl — i=2</option>
          <option value="MgCl2">MgCl₂ — i=3</option>
          <option value="AlCl3">AlCl₃ — i=4</option>
        </select>
      </div>
      <div class="sim-control-group">
        <div class="sim-label">Molality (m): <span class="sim-value-label" id="lbl-molality">1.00 mol/kg</span></div>
        <input type="range" class="sim-slider" id="slider-molality" min="0.1" max="5.0" step="0.1" value="1.0">
      </div>
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>van 't Hoff i:</span><span id="read-i" style="font-weight:bold; color:var(--copper-orange);">2</span></div>
        <div class="sim-readout-row"><span>ΔTb (°C):</span><span id="read-dtb" style="color:var(--reaction-red); font-weight:bold;">+1.04 °C</span></div>
        <div class="sim-readout-row"><span>ΔTf (°C):</span><span id="read-dtf" style="color:var(--atomic-teal); font-weight:bold;">-3.72 °C</span></div>
        <div class="sim-readout-row"><span>Osmotic π (atm):</span><span id="read-pi" style="color:var(--acid-green); font-weight:bold;">--</span></div>
      </div>
    `;
    const update = () => {
      const dTb = this.vantHoff * this.Kb * this.molality;
      const dTf = this.vantHoff * this.Kf * this.molality;
      const pi = this.vantHoff * this.molality * 0.0821 * 298;
      document.getElementById("read-i").textContent = this.vantHoff;
      document.getElementById("read-dtb").textContent = `+${dTb.toFixed(2)} °C`;
      document.getElementById("read-dtf").textContent = `-${dTf.toFixed(2)} °C`;
      document.getElementById("read-pi").textContent = `${pi.toFixed(2)} atm`;
    };
    document.getElementById("sel-solute").addEventListener("change", (e) => {
      const iMap = { glucose: 1, NaCl: 2, MgCl2: 3, AlCl3: 4 };
      this.vantHoff = iMap[e.target.value] || 1;
      this.solute = e.target.value;
      update();
    });
    document.getElementById("slider-molality").addEventListener("input", (e) => {
      this.molality = parseFloat(e.target.value);
      document.getElementById("lbl-molality").textContent = `${this.molality.toFixed(2)} mol/kg`;
      update();
    });
    update();
  }

  render() {
    this.tick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    // Flask
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(130, 100);
    ctx.lineTo(170, 100);
    ctx.lineTo(170, 140);
    ctx.lineTo(270, 350);
    ctx.lineTo(30, 350);
    ctx.lineTo(130, 140);
    ctx.closePath();
    ctx.stroke();

    // Solution fill color based on concentration
    const alpha = 0.2 + Math.min(0.5, this.molality * 0.1);
    const hue = 210 - this.vantHoff * 15;
    ctx.fillStyle = `hsla(${hue}, 70%, 45%, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(155, 170);
    ctx.lineTo(170, 140);
    ctx.lineTo(270, 348);
    ctx.lineTo(30, 348);
    ctx.lineTo(130, 140);
    ctx.lineTo(145, 170);
    ctx.closePath();
    ctx.fill();

    // Boiling bubbles (if elevated temp)
    const dTb = this.vantHoff * this.Kb * this.molality;
    if (dTb > 0.5) {
      this.bubbles.forEach(b => {
        b.y += b.vy * (0.5 + dTb * 0.3);
        if (b.y < 160) { b.y = 345; b.x = 50 + Math.random() * 200; }
        ctx.strokeStyle = `rgba(255,255,255,0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // Thermometer
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(290, 80, 16, 200);
    ctx.beginPath();
    ctx.arc(298, 285, 14, 0, Math.PI * 2);
    ctx.fill();
    // Mercury fill
    const baseTemp = 100; // water boiling
    const pct = Math.min(1, (baseTemp + dTb) / 120);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(293, 285 - pct * 200, 10, pct * 200);
    ctx.beginPath();
    ctx.arc(298, 285, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px 'JetBrains Mono'";
    ctx.textAlign = "left";
    ctx.fillText(`${(baseTemp + dTb).toFixed(2)}°C`, 312, 170);
    ctx.fillText("Boiling point", 312, 185);

    // Freezing point flask (right)
    const dTf = this.vantHoff * this.Kf * this.molality;
    ctx.strokeStyle = "rgba(100,180,255,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(500, 100, 120, 180);
    ctx.fillStyle = `rgba(100,180,255,${0.1 + Math.min(0.4, this.molality * 0.08)})`;
    ctx.fillRect(500, 100, 120, 180);
    // Ice crystals
    if (dTf > 2) {
      ctx.strokeStyle = "rgba(200,230,255,0.6)";
      ctx.lineWidth = 1;
      for (let i = 0; i < Math.floor(dTf); i++) {
        const ix = 510 + (i % 5) * 22;
        const iy = 150 + Math.floor(i / 5) * 30;
        ctx.beginPath();
        ctx.moveTo(ix, iy - 10); ctx.lineTo(ix, iy + 10);
        ctx.moveTo(ix - 9, iy - 5); ctx.lineTo(ix + 9, iy + 5);
        ctx.moveTo(ix - 9, iy + 5); ctx.lineTo(ix + 9, iy - 5);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText(`${(0 - dTf).toFixed(2)}°C`, 560, 310);
    ctx.fillText("Freezing point", 560, 326);

    // Equations display
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px 'JetBrains Mono'";
    ctx.textAlign = "left";
    ctx.fillText(`ΔTb = i·Kb·m = ${this.vantHoff}×${this.Kb}×${this.molality.toFixed(1)} = +${dTb.toFixed(2)}°C`, 30, h - 60);
    ctx.fillText(`ΔTf = i·Kf·m = ${this.vantHoff}×${this.Kf}×${this.molality.toFixed(1)} = -${dTf.toFixed(2)}°C`, 30, h - 40);
  }

  destroy() {}
}

// ==========================================================================
// 15. ORBITAL VIEWER LAB
// ==========================================================================
class OrbitalViewerLab {
  constructor(canvas, controls, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.controls = controls;
    this.sim = sim;
    this.orbital = "1s";
    this.tick = 0;
    this.angleY = 0;
  }

  init() {
    const title = (this.sim && this.sim.title) ? this.sim.title.toLowerCase() : "";
    let startOrbital = "1s";
    if (title.includes("2p") || title.includes("p orbital")) startOrbital = "2p";
    else if (title.includes("3d") || title.includes("d orbital")) startOrbital = "3d";
    else if (title.includes("4f") || title.includes("f orbital")) startOrbital = "4f";

    this.orbital = startOrbital;

    this.controls.innerHTML = `
      <h3 class="sim-section-title">🔮 Atomic Orbital Viewer</h3>
      <div class="sim-control-group">
        <label for="sel-orbital" class="sim-label">Select Orbital:</label>
        <select class="theme-dropdown" id="sel-orbital" style="width:100%">
          <option value="1s"${startOrbital === "1s" ? " selected" : ""}>1s — Spherical</option>
          <option value="2s">2s — Radial node</option>
          <option value="2p"${startOrbital === "2p" ? " selected" : ""}>2p — Dumbbell</option>
          <option value="3d"${startOrbital === "3d" ? " selected" : ""}>3d — Four-lobe</option>
          <option value="4f"${startOrbital === "4f" ? " selected" : ""}>4f — Complex</option>
        </select>
      </div>
      <div class="sim-readout-card">
        <div class="sim-readout-row"><span>n (principal):</span><span id="read-n" style="font-weight:bold; color:var(--atomic-teal);">1</span></div>
        <div class="sim-readout-row"><span>l (azimuthal):</span><span id="read-l" style="font-weight:bold;">0 (s)</span></div>
        <div class="sim-readout-row"><span>Radial nodes:</span><span id="read-rn">0</span></div>
        <div class="sim-readout-row"><span>Angular nodes:</span><span id="read-an">0</span></div>
      </div>
      <div class="sim-readout-card" style="margin-top:8px;">
        <p style="font-size:0.78rem; line-height:1.4; color:var(--text-muted);">
          Radial nodes = n − l − 1<br>
          Angular nodes = l<br>
          Total nodes = n − 1
        </p>
      </div>
    `;

    document.getElementById("sel-orbital").addEventListener("change", (e) => {
      this.orbital = e.target.value;
      const info = { "1s": [1,0,0,0], "2s": [2,0,1,0], "2p": [2,1,0,1], "3d": [3,2,0,2], "4f": [4,3,0,3] };
      const [n, l, rn, an] = info[this.orbital] || [1,0,0,0];
      document.getElementById("read-n").textContent = n;
      document.getElementById("read-l").textContent = `${l} (${["s","p","d","f"][l]})`;
      document.getElementById("read-rn").textContent = rn;
      document.getElementById("read-an").textContent = an;
    });
  }

  render() {
    this.tick++;
    this.angleY += 0.012;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2, cy = h / 2;

    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);

    const cosY = Math.cos(this.angleY);
    const sinY = Math.sin(this.angleY);

    // Draw orbital shape based on type
    if (this.orbital === "1s" || this.orbital === "2s") {
      // Spherical s orbital
      const r = this.orbital === "2s" ? 120 : 80;
      const r2 = this.orbital === "2s" ? 55 : 0; // inner node for 2s

      const grd = ctx.createRadialGradient(cx - 20, cy - 20, 5, cx, cy, r);
      grd.addColorStop(0, "rgba(99,102,241,0.6)");
      grd.addColorStop(0.5, "rgba(99,102,241,0.3)");
      grd.addColorStop(1, "rgba(99,102,241,0.0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(148,163,184,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      if (r2 > 0) {
        // Radial node ring for 2s
        ctx.strokeStyle = "rgba(255,100,100,0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,100,100,0.35)";
        ctx.font = "10px 'JetBrains Mono'";
        ctx.textAlign = "center";
        ctx.fillText("radial node", cx + r2 + 20, cy - 10);
      }

      // Nucleus dot
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.orbital === "2p") {
      // Dumbbell shape (pz)
      const lobeH = 130;
      const lobeW = 55;
      // Top lobe (positive)
      let grad = ctx.createRadialGradient(cx, cy - lobeH * 0.45, 5, cx, cy - lobeH * 0.5, lobeW * 0.8);
      grad.addColorStop(0, "rgba(99,102,241,0.8)");
      grad.addColorStop(0.5, "rgba(99,102,241,0.4)");
      grad.addColorStop(1, "rgba(99,102,241,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - lobeH / 2, lobeW * Math.abs(cosY) + 15, lobeH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bottom lobe (negative)
      grad = ctx.createRadialGradient(cx, cy + lobeH * 0.45, 5, cx, cy + lobeH * 0.5, lobeW * 0.8);
      grad.addColorStop(0, "rgba(239,68,68,0.8)");
      grad.addColorStop(0.5, "rgba(239,68,68,0.4)");
      grad.addColorStop(1, "rgba(239,68,68,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy + lobeH / 2, lobeW * Math.abs(cosY) + 15, lobeH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Nodal plane label
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 150, cy);
      ctx.lineTo(cx + 150, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "10px 'JetBrains Mono'";
      ctx.textAlign = "left";
      ctx.fillText("nodal plane (angular node)", cx + 80, cy + 15);
      // Labels
      ctx.fillStyle = "rgba(99,102,241,0.8)";
      ctx.font = "bold 12px 'JetBrains Mono'";
      ctx.textAlign = "center";
      ctx.fillText("+", cx, cy - lobeH + 10);
      ctx.fillStyle = "rgba(239,68,68,0.8)";
      ctx.fillText("−", cx, cy + lobeH - 5);

    } else if (this.orbital === "3d") {
      // Four-lobe d orbital (dz2-like cross pattern)
      const lobeR = 100;
      const angles = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2];
      const colors = ["rgba(99,102,241,0.7)", "rgba(239,68,68,0.7)", "rgba(99,102,241,0.7)", "rgba(239,68,68,0.7)"];
      angles.forEach((a, i) => {
        const lx = cx + Math.cos(a + this.angleY) * lobeR / 2;
        const ly = cy + Math.sin(a + this.angleY) * lobeR / 2;
        const grad = ctx.createRadialGradient(lx, ly, 5, lx, ly, lobeR / 2);
        grad.addColorStop(0, colors[i]);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(lx, ly, lobeR / 2, lobeR / 3, a + this.angleY, 0, Math.PI * 2);
        ctx.fill();
      });
      // Nucleus
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "10px 'JetBrains Mono'";
      ctx.textAlign = "center";
      ctx.fillText("2 nodal planes", cx, cy + lobeR + 20);

    } else if (this.orbital === "4f") {
      // Simplified f orbital (8-lobe)
      const lobeR = 80;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + this.angleY;
        const lx = cx + Math.cos(a) * lobeR * 0.6;
        const ly = cy + Math.sin(a) * lobeR * 0.6;
        const c = i % 2 === 0 ? "rgba(99,102,241,0.65)" : "rgba(239,68,68,0.65)";
        const grd = ctx.createRadialGradient(lx, ly, 3, lx, ly, lobeR / 2);
        grd.addColorStop(0, c);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(lx, ly, lobeR / 2, lobeR / 3, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    const axisLen = 160;
    ctx.beginPath();
    ctx.moveTo(cx - axisLen, cy); ctx.lineTo(cx + axisLen, cy);
    ctx.moveTo(cx, cy - axisLen); ctx.lineTo(cx, cy + axisLen);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "11px 'JetBrains Mono'";
    ctx.textAlign = "center";
    ctx.fillText("x", cx + axisLen + 12, cy + 4);
    ctx.fillText("z", cx, cy - axisLen - 8);
    ctx.fillText(`Orbital: ${this.orbital}`, cx, 30);
  }

  destroy() {}
}
