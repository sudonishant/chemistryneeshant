/* ==========================================================================
   Atomica: Reusable Visualizers, Plotters, & 3D Molecule Vector Engines
   ========================================================================== */

/**
 * 1. ChemicalGraphPlotter
 * Draws high-performance scientific plots on standard 2D Canvas.
 * Supports kinetics rate plots, thermodynamic energy profiles, and gas laws.
 */
class ChemicalGraphPlotter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }
  
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  drawAxes(xLabel, yLabel, bounds) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "12px 'JetBrains Mono', monospace";
    
    // Y-Axis line
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(50, h - 40);
    ctx.stroke();
    
    // X-Axis line
    ctx.beginPath();
    ctx.moveTo(50, h - 40);
    ctx.lineTo(w - 20, h - 40);
    ctx.stroke();
    
    // Axis Labels
    ctx.save();
    ctx.translate(15, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
    
    ctx.textAlign = "center";
    ctx.fillText(xLabel, w / 2, h - 10);
    
    // Draw scale bounds ticks
    ctx.textAlign = "right";
    ctx.fillText(bounds.yMin.toString(), 45, h - 36);
    ctx.fillText(bounds.yMax.toString(), 45, 25);
    
    ctx.textAlign = "center";
    ctx.fillText(bounds.xMin.toString(), 50, h - 25);
    ctx.fillText(bounds.xMax.toString(), w - 25, h - 25);
  }
  
  plotLine(points, color, thickness = 3) {
    if (points.length < 2) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Project math coords into canvas pixels
    // Assume bounds: X: 0 to 100, Y: 0 to 100
    const project = (pt) => {
      const px = 50 + (pt.x / 100) * (w - 70);
      const py = (h - 40) - (pt.y / 100) * (h - 60);
      return { x: px, y: py };
    };
    
    ctx.beginPath();
    const first = project(points[0]);
    ctx.moveTo(first.x, first.y);
    
    for (let i = 1; i < points.length; i++) {
      const p = project(points[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

/**
 * 2. MolecularGeometry3D
 * Custom vector projection engine that renders 3D molecules in 2D space.
 * Features depth-sorting, shaded sphere gradients, and interactive rotations.
 */
class MolecularGeometry3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.angleX = -0.4; // Starting rotation angles
    this.angleY = 0.6;
    this.atoms = [];
    this.bonds = [];
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    
    this.setupRotationListeners();
  }
  
  setupRotationListeners() {
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });
    
    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      
      // Update rotation angles based on mouse drag movement
      this.angleY += dx * 0.007;
      this.angleX += dy * 0.007;
      
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      
      this.render(); // Re-render updated projection
    });
    
    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });
    
    // Support touch controls
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    });
    
    this.canvas.addEventListener("touchmove", (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      
      this.angleY += dx * 0.008;
      this.angleX += dy * 0.008;
      
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      
      this.render();
      e.preventDefault();
    });
    
    this.canvas.addEventListener("touchend", () => {
      this.isDragging = false;
    });
  }
  
  setMolecule(modelName) {
    // Structural vectors: [x, y, z, Symbol, Color, Size (radius)]
    this.atoms = [];
    this.bonds = [];
    
    const colors = {
      "C": "#5c5d64",   // Carbon: charcoal grey
      "H": "#ecf0f1",   // Hydrogen: light white
      "O": "#e74c3c",   // Oxygen: reactive red
      "N": "#2980b9",   // Nitrogen: orbital blue
      "F": "#1abc9c",   // Fluorine: electronegative turquoise
      "S": "#f1c40f",   // Sulphur: yellow
      "Cl": "#2ecc71",  // Chlorine: light green
      "P": "#e67e22",   // Phosphorus: orange
      "Xe": "#9b59b6",  // Xenon: noble violet
      "LP": "rgba(155, 89, 182, 0.45)" // Lone Pair: translucent purple
    };
    
    if (modelName === "Linear" || modelName === "CO2") {
      this.atoms = [
        { x: 0, y: 0, z: 0, symbol: "C", color: colors.C, r: 24 },
        { x: 85, y: 0, z: 0, symbol: "O", color: colors.O, r: 20 },
        { x: -85, y: 0, z: 0, symbol: "O", color: colors.O, r: 20 }
      ];
      this.bonds = [
        { a: 0, b: 1, double: true },
        { a: 0, b: 2, double: true }
      ];
    } 
    else if (modelName === "Trigonal Planar" || modelName === "BF3") {
      this.atoms = [
        { x: 0, y: 0, z: 0, symbol: "B", color: colors.P, r: 22 },
        { x: 0, y: 80, z: 0, symbol: "F", color: colors.F, r: 18 },
        { x: 69.28, y: -40, z: 0, symbol: "F", color: colors.F, r: 18 },
        { x: -69.28, y: -40, z: 0, symbol: "F", color: colors.F, r: 18 }
      ];
      this.bonds = [
        { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 }
      ];
    }
    else if (modelName === "Tetrahedral" || modelName === "CH4") {
      this.atoms = [
        { x: 0, y: 0, z: 0, symbol: "C", color: colors.C, r: 24 },
        { x: 0, y: 80, z: 0, symbol: "H", color: colors.H, r: 14 },
        { x: 0, y: -26.6, z: 75.4, symbol: "H", color: colors.H, r: 14 },
        { x: 65.3, y: -26.6, z: -37.7, symbol: "H", color: colors.H, r: 14 },
        { x: -65.3, y: -26.6, z: -37.7, symbol: "H", color: colors.H, r: 14 }
      ];
      this.bonds = [
        { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 }, { a: 0, b: 4 }
      ];
    }
    else if (modelName === "Bent" || modelName === "H2O") {
      // H2O with 2 Lone Pairs
      this.atoms = [
        { x: 0, y: 0, z: 0, symbol: "O", color: colors.O, r: 22 },
        { x: -65.3, y: -46.2, z: 0, symbol: "H", color: colors.H, r: 14 },
        { x: 65.3, y: -46.2, z: 0, symbol: "H", color: colors.H, r: 14 },
        // Lone pairs projected as smaller translucent clouds
        { x: 0, y: 55, z: 45, symbol: "LP", color: colors.LP, r: 12, isLP: true },
        { x: 0, y: 55, z: -45, symbol: "LP", color: colors.LP, r: 12, isLP: true }
      ];
      this.bonds = [
        { a: 0, b: 1 }, { a: 0, b: 2 },
        { a: 0, b: 3, dashed: true }, { a: 0, b: 4, dashed: true }
      ];
    }
    else if (modelName === "Trigonal Pyramidal" || modelName === "NH3") {
      // Ammonia with 1 Lone Pair
      this.atoms = [
        { x: 0, y: -15, z: 0, symbol: "N", color: colors.N, r: 22 },
        { x: 69.28, y: -40, z: -40, symbol: "H", color: colors.H, r: 14 },
        { x: -69.28, y: -40, z: -40, symbol: "H", color: colors.H, r: 14 },
        { x: 0, y: -40, z: 80, symbol: "H", color: colors.H, r: 14 },
        { x: 0, y: 65, z: 0, symbol: "LP", color: colors.LP, r: 13, isLP: true }
      ];
      this.bonds = [
        { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 },
        { a: 0, b: 4, dashed: true }
      ];
    }
    else if (modelName === "Trigonal Bipyramidal" || modelName === "PCl5") {
      this.atoms = [
        { x: 0, y: 0, z: 0, symbol: "P", color: colors.P, r: 24 },
        // Axial positions
        { x: 0, y: 90, z: 0, symbol: "Cl", color: colors.Cl, r: 18 },
        { x: 0, y: -90, z: 0, symbol: "Cl", color: colors.Cl, r: 18 },
        // Equatorials
        { x: 0, y: 0, z: 85, symbol: "Cl", color: colors.Cl, r: 18 },
        { x: 73.6, y: 0, z: -42.5, symbol: "Cl", color: colors.Cl, r: 18 },
        { x: -73.6, y: 0, z: -42.5, symbol: "Cl", color: colors.Cl, r: 18 }
      ];
      this.bonds = [
        { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 }, { a: 0, b: 4 }, { a: 0, b: 5 }
      ];
    }
    else { // Fallback Octahedral (SF6)
      this.atoms = [
        { x: 0, y: 0, z: 0, symbol: "S", color: colors.S, r: 24 },
        { x: 0, y: 85, z: 0, symbol: "F", color: colors.F, r: 16 },
        { x: 0, y: -85, z: 0, symbol: "F", color: colors.F, r: 16 },
        { x: 85, y: 0, z: 0, symbol: "F", color: colors.F, r: 16 },
        { x: -85, y: 0, z: 0, symbol: "F", color: colors.F, r: 16 },
        { x: 0, y: 0, z: 85, symbol: "F", color: colors.F, r: 16 },
        { x: 0, y: 0, z: -85, symbol: "F", color: colors.F, r: 16 }
      ];
      this.bonds = [
        { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 }, { a: 0, b: 4 }, { a: 0, b: 5 }, { a: 0, b: 6 }
      ];
    }
    
    this.render();
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear canvas with deep transparent slate backing
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, w, h);
    
    // Vector rotate and project math
    const cx = w / 2;
    const cy = h / 2;
    
    const cosX = Math.cos(this.angleX);
    const sinX = Math.sin(this.angleX);
    const cosY = Math.cos(this.angleY);
    const sinY = Math.sin(this.angleY);
    
    // Calculate projected coordinates
    const projectedAtoms = this.atoms.map((atom, idx) => {
      // 1. Rotate around X-axis
      let y1 = atom.y * cosX - atom.z * sinX;
      let z1 = atom.y * sinX + atom.z * cosX;
      
      // 2. Rotate around Y-axis
      let x2 = atom.x * cosY + z1 * sinY;
      let z2 = -atom.x * sinY + z1 * cosY;
      
      // Perspective scale factor
      const scale = 300 / (300 + z2);
      
      return {
        id: idx,
        px: cx + x2 * scale,
        py: cy - y1 * scale, // invert Y axis for viewport
        pz: z2, // Store rotated depth
        radius: atom.r * scale,
        color: atom.color,
        symbol: atom.symbol,
        isLP: atom.isLP
      };
    });
    
    // Draw Bonds: Depth sorting is critical. We draw bonds before atoms.
    this.bonds.forEach(bond => {
      const a = projectedAtoms[bond.a];
      const b = projectedAtoms[bond.b];
      
      ctx.lineWidth = bond.dashed ? 2 : 6;
      ctx.strokeStyle = bond.dashed ? "rgba(155, 89, 182, 0.4)" : "rgba(255, 255, 255, 0.15)";
      
      if (bond.dashed) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      
      if (bond.double) {
        // Draw double bonds as double lines
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const len = Math.sqrt(dx*dx + dy*dy);
        const ox = (-dy / len) * 4;
        const oy = (dx / len) * 4;
        
        ctx.beginPath();
        ctx.moveTo(a.px + ox, a.py + oy);
        ctx.lineTo(b.px + ox, b.py + oy);
        ctx.moveTo(a.px - ox, a.py - oy);
        ctx.lineTo(b.px - ox, b.py - oy);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
      }
    });
    
    ctx.setLineDash([]); // Reset dashed lines
    
    // Sort atoms by depth (Painter's algorithm: draw elements from back to front)
    const sortedAtoms = [...projectedAtoms].sort((a, b) => b.pz - a.pz);
    
    // Draw Atoms as shiny 3D spheres
    sortedAtoms.forEach(atom => {
      ctx.beginPath();
      ctx.arc(atom.px, atom.py, atom.radius, 0, 2 * Math.PI);
      
      // High-performance radial gradient overlay
      const gradient = ctx.createRadialGradient(
        atom.px - atom.radius * 0.3, 
        atom.py - atom.radius * 0.3, 
        atom.radius * 0.1, 
        atom.px, 
        atom.py, 
        atom.radius
      );
      
      if (atom.isLP) {
        gradient.addColorStop(0, "rgba(216, 191, 216, 0.8)");
        gradient.addColorStop(0.5, "rgba(186, 85, 211, 0.5)");
        gradient.addColorStop(1, "rgba(155, 89, 182, 0.05)");
      } else {
        // Normal atomic spheres
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.2, atom.color);
        gradient.addColorStop(1, "#000000");
      }
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Element Text label
      if (atom.symbol !== "LP") {
        ctx.fillStyle = atom.symbol === "H" ? "#333333" : "#ffffff";
        ctx.font = `bold ${Math.max(9, atom.radius * 0.65)}px 'Outfit', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(atom.symbol, atom.px, atom.py + 1);
      }
    });
    
    // Draw Rotate Drag Help watermark hint
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "11px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("◀ CLICK & DRAG TO ROTATE IN 3D SPACE ▶", w / 2, h - 20);
  }
}

/**
 * 3. TitrationCurveVisualizer
 * Dynamically evaluates solution pH during base chemical drops and draws titration curves.
 */
class TitrationCurveVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }
  
  /**
   * Evaluates the pH curve of an acid-base neutralization.
   * acidStrength: 'strong' | 'weak'
   * baseStrength: 'strong'
   */
  calculatePH(volBase_ml, acidConc, baseConc, volAcid_ml, Ka = 1.8e-5) {
    const V_a = volAcid_ml;
    const V_b = volBase_ml;
    const C_a = acidConc;
    const C_b = baseConc;
    
    // Moles in total volume
    const molesAcid = C_a * (V_a / 1000);
    const molesBase = C_b * (V_b / 1000);
    
    // Total solution volume in liters
    const totalVolume = (V_a + V_b) / 1000;
    
    if (molesBase === 0) {
      // Starting point: purely acid
      return -Math.log10(molesAcid / (V_a / 1000));
    }
    
    if (molesBase < molesAcid) {
      // Acid in excess
      const excessMolesAcid = molesAcid - molesBase;
      const concH = excessMolesAcid / totalVolume;
      
      // If weak acid, solve using buffer equations (Henderson-Hasselbalch)
      // Salt formed = molesBase, remaining acid = excessMolesAcid
      if (Ka < 1.0) {
        const pKa = -Math.log10(Ka);
        const pH = pKa + Math.log10(molesBase / excessMolesAcid);
        return Math.max(1.0, pH);
      }
      
      return -Math.log10(concH);
    } 
    else if (Math.abs(molesBase - molesAcid) < 1e-9) {
      // Equivalence point
      if (Ka < 1.0) {
        // Hydrolysis of salt of weak acid and strong base
        const pKw = 14.0;
        const pKa = -Math.log10(Ka);
        const saltConc = molesAcid / totalVolume;
        const pH = 7.0 + 0.5 * (pKa + Math.log10(saltConc));
        return pH;
      }
      return 7.0; // Neutral for strong-strong
    } 
    else {
      // Base in excess
      const excessMolesBase = molesBase - molesAcid;
      const concOH = excessMolesBase / totalVolume;
      const pOH = -Math.log10(concOH);
      return 14.0 - pOH;
    }
  }
}
