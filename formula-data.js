/* ==========================================================================
   Atomica: Comprehensive Chemistry Formula Reference Database
   Covers all 26 JEE chapters — Physical, Inorganic & Organic Chemistry
   ========================================================================== */

const FORMULA_DATABASE = [
  // ── PHYSICAL CHEMISTRY ──────────────────────────────────────────────────
  { category: "Mole Concept", name: "Number of Moles", latex: "n = \\frac{m}{M} = \\frac{N}{N_A}", desc: "n = moles, m = mass (g), M = molar mass (g/mol), N = number of particles, Nₐ = 6.022×10²³" },
  { category: "Mole Concept", name: "Molarity", latex: "M = \\frac{n_{\\text{solute}}}{V_{\\text{solution (L)}}}", desc: "Concentration in moles per litre of solution" },
  { category: "Mole Concept", name: "Dilution Law", latex: "M_1 V_1 = M_2 V_2", desc: "Moles of solute are conserved on dilution" },
  { category: "Mole Concept", name: "Mole Fraction", latex: "\\chi_A = \\frac{n_A}{n_A + n_B}", desc: "Ratio of moles of component A to total moles" },
  { category: "Mole Concept", name: "Percentage Composition", latex: "\\%\\text{ by mass} = \\frac{\\text{mass of element}}{\\text{molar mass of compound}} \\times 100", desc: "Mass fraction of an element in a compound" },

  { category: "Atomic Structure", name: "Bohr Orbit Radius", latex: "r_n = 0.529 \\cdot \\frac{n^2}{Z} \\text{ Å}", desc: "Radius of nth Bohr orbit; Z = atomic number" },
  { category: "Atomic Structure", name: "Bohr Orbit Energy", latex: "E_n = -13.6 \\cdot \\frac{Z^2}{n^2} \\text{ eV}", desc: "Energy of electron in nth orbit of hydrogen-like atom" },
  { category: "Atomic Structure", name: "Rydberg Formula", latex: "\\frac{1}{\\lambda} = R_H Z^2 \\left(\\frac{1}{n_f^2} - \\frac{1}{n_i^2}\\right)", desc: "Wavelength of spectral lines; R_H = 1.097×10⁷ m⁻¹" },
  { category: "Atomic Structure", name: "de Broglie Wavelength", latex: "\\lambda = \\frac{h}{mv} = \\frac{h}{p}", desc: "Matter wave wavelength; h = Planck's constant, p = momentum" },
  { category: "Atomic Structure", name: "Heisenberg Uncertainty", latex: "\\Delta x \\cdot \\Delta p \\geq \\frac{h}{4\\pi}", desc: "Fundamental limit on simultaneous position and momentum precision" },

  { category: "Chemical Bonding", name: "Formal Charge", latex: "FC = V - L - \\frac{B}{2}", desc: "V = valence electrons, L = lone pair electrons, B = bonding electrons" },
  { category: "Chemical Bonding", name: "Bond Order (MO Theory)", latex: "B.O. = \\frac{N_b - N_a}{2}", desc: "Nᵦ = bonding electrons, Nₐ = antibonding electrons" },
  { category: "Chemical Bonding", name: "Dipole Moment", latex: "\\mu = q \\times d \\quad (\\text{unit: Debye})", desc: "Product of charge magnitude and bond length; 1 D = 3.336×10⁻³⁰ C·m" },

  { category: "States of Matter", name: "Ideal Gas Law", latex: "PV = nRT", desc: "P (atm), V (L), n (mol), R = 0.0821 L·atm/mol·K, T (K)" },
  { category: "States of Matter", name: "van der Waals Equation", latex: "\\left(P + \\frac{an^2}{V^2}\\right)(V - nb) = nRT", desc: "a = intermolecular attraction, b = excluded volume correction" },
  { category: "States of Matter", name: "Graham's Law", latex: "\\frac{r_1}{r_2} = \\sqrt{\\frac{M_2}{M_1}}", desc: "Rate of effusion inversely proportional to square root of molar mass" },
  { category: "States of Matter", name: "RMS Speed", latex: "u_{rms} = \\sqrt{\\frac{3RT}{M}}", desc: "Root mean square molecular speed at temperature T" },
  { category: "States of Matter", name: "Kinetic Energy (gas)", latex: "\\bar{E}_k = \\frac{3}{2}RT \\text{ per mole}", desc: "Average kinetic energy of one mole of ideal gas molecules" },

  { category: "Thermodynamics", name: "First Law", latex: "\\Delta U = q + w = q - P\\Delta V", desc: "ΔU = internal energy change; q = heat; w = work done ON system" },
  { category: "Thermodynamics", name: "Gibbs Free Energy", latex: "\\Delta G = \\Delta H - T\\Delta S", desc: "Spontaneous if ΔG < 0; equilibrium if ΔG = 0" },
  { category: "Thermodynamics", name: "Standard Free Energy & K", latex: "\\Delta G^\\circ = -RT\\ln K_{eq}", desc: "Relates standard free energy change to equilibrium constant" },
  { category: "Thermodynamics", name: "Hess's Law", latex: "\\Delta H_{rxn} = \\sum \\Delta H_f(\\text{products}) - \\sum \\Delta H_f(\\text{reactants})", desc: "Enthalpy of reaction from standard formation enthalpies" },
  { category: "Thermodynamics", name: "Kirchhoff's Law", latex: "\\Delta H_{T_2} = \\Delta H_{T_1} + \\Delta C_p(T_2 - T_1)", desc: "Temperature dependence of reaction enthalpy" },

  { category: "Chemical Equilibrium", name: "Equilibrium Constant (Kc)", latex: "K_c = \\frac{[C]^c[D]^d}{[A]^a[B]^b}", desc: "For aA + bB ⇌ cC + dD at equilibrium" },
  { category: "Chemical Equilibrium", name: "Kp and Kc Relation", latex: "K_p = K_c(RT)^{\\Delta n_g}", desc: "Δnᵍ = moles of gaseous products − moles of gaseous reactants" },
  { category: "Chemical Equilibrium", name: "Van't Hoff Equation", latex: "\\ln\\frac{K_2}{K_1} = \\frac{\\Delta H^\\circ}{R}\\left(\\frac{1}{T_1} - \\frac{1}{T_2}\\right)", desc: "Temperature dependence of equilibrium constant" },
  { category: "Chemical Equilibrium", name: "Reaction Quotient", latex: "Q_c < K_c \\Rightarrow \\text{forward shift};\\quad Q_c > K_c \\Rightarrow \\text{reverse shift}", desc: "Le Chatelier prediction using reaction quotient" },

  { category: "Ionic Equilibrium", name: "pH and pOH", latex: "\\text{pH} = -\\log[H^+] \\qquad \\text{pOH} = -\\log[OH^-]", desc: "At 298 K: pH + pOH = 14" },
  { category: "Ionic Equilibrium", name: "Henderson-Hasselbalch", latex: "\\text{pH} = pK_a + \\log\\frac{[A^-]}{[HA]}", desc: "pH of acidic buffer; salt/acid concentration ratio" },
  { category: "Ionic Equilibrium", name: "Degree of Ionisation (weak acid)", latex: "\\alpha = \\sqrt{\\frac{K_a}{C}}", desc: "For weak acid at concentration C; valid when α ≪ 1" },
  { category: "Ionic Equilibrium", name: "Common Ion Effect (Ksp)", latex: "K_{sp} = [M^{m+}]^m [X^{x-}]^x", desc: "Solubility product; precipitation occurs when IP > Ksp" },
  { category: "Ionic Equilibrium", name: "Buffer Capacity", latex: "\\beta = 2.303 \\cdot C \\cdot \\frac{K_a[H^+]}{(K_a + [H^+])^2}", desc: "Maximum at pH = pKa (equal acid and salt concentrations)" },

  { category: "Redox & Electrochemistry", name: "Nernst Equation", latex: "E = E^\\circ - \\frac{RT}{nF}\\ln Q = E^\\circ - \\frac{0.0592}{n}\\log Q", desc: "Cell potential at non-standard conditions; n = electrons transferred" },
  { category: "Redox & Electrochemistry", name: "Standard EMF & ΔG", latex: "\\Delta G^\\circ = -nFE^\\circ_{cell}", desc: "F = Faraday constant = 96485 C/mol" },
  { category: "Redox & Electrochemistry", name: "Faraday's Law", latex: "m = \\frac{M \\cdot I \\cdot t}{n \\cdot F}", desc: "Mass deposited at electrode; I = current (A), t = time (s)" },
  { category: "Redox & Electrochemistry", name: "Kohlrausch's Law", latex: "\\Lambda_m = \\Lambda_m^\\circ - b\\sqrt{C}", desc: "Molar conductivity decreases linearly with √C for strong electrolytes" },

  { category: "Chemical Kinetics", name: "Rate Law", latex: "r = k[A]^m[B]^n", desc: "m+n = overall order; k = rate constant (units depend on order)" },
  { category: "Chemical Kinetics", name: "First-Order Half Life", latex: "t_{1/2} = \\frac{0.693}{k}", desc: "Independent of initial concentration for first-order reactions" },
  { category: "Chemical Kinetics", name: "Arrhenius Equation", latex: "k = Ae^{-E_a/RT}", desc: "A = frequency factor, Eₐ = activation energy (J/mol)" },
  { category: "Chemical Kinetics", name: "Integrated Rate Law (1st order)", latex: "\\ln\\frac{[A]_0}{[A]_t} = kt", desc: "[A]₀ = initial concentration, [A]ₜ = concentration at time t" },
  { category: "Chemical Kinetics", name: "Temperature Coefficient", latex: "\\mu = \\frac{k_{T+10}}{k_T} \\approx 2\\text{ to }3", desc: "Rate roughly doubles for every 10°C rise in temperature" },

  // ── PHYSICAL CHEMISTRY — PART II ────────────────────────────────────────
  { category: "Solid State", name: "Packing Efficiency (FCC)", latex: "\\text{PE}_{FCC} = \\frac{4 \\times \\frac{4}{3}\\pi r^3}{a^3} \\times 100 = 74.05\\%", desc: "Relation: a = 2√2 r for FCC unit cell" },
  { category: "Solid State", name: "Density of Unit Cell", latex: "\\rho = \\frac{Z \\cdot M}{N_A \\cdot a^3}", desc: "Z = atoms per unit cell, a = edge length (cm), M = molar mass (g/mol)" },
  { category: "Solid State", name: "Bragg's Law", latex: "n\\lambda = 2d\\sin\\theta", desc: "n = order of diffraction, d = interplanar spacing, θ = glancing angle" },

  { category: "Solutions", name: "Raoult's Law", latex: "P_A = \\chi_A \\cdot P_A^*", desc: "Partial pressure of solvent A over solution; P* = vapour pressure of pure solvent" },
  { category: "Solutions", name: "Elevation of Boiling Point", latex: "\\Delta T_b = K_b \\cdot m", desc: "Kᵦ = ebullioscopic constant; m = molality of solution" },
  { category: "Solutions", name: "Depression of Freezing Point", latex: "\\Delta T_f = K_f \\cdot m", desc: "Kf = cryoscopic constant; m = molality" },
  { category: "Solutions", name: "Osmotic Pressure", latex: "\\pi = iMRT = \\frac{nRT}{V}", desc: "i = van't Hoff factor for electrolytes; M = molarity" },
  { category: "Solutions", name: "Van't Hoff Factor", latex: "i = 1 + \\alpha(n-1) \\quad (\\text{dissociation})", desc: "α = degree of dissociation, n = ions per formula unit" },

  { category: "Surface Chemistry", name: "Freundlich Isotherm", latex: "\\frac{x}{m} = k \\cdot P^{1/n}", desc: "Empirical equation; x/m = mass adsorbed per gram of adsorbent" },
  { category: "Surface Chemistry", name: "Langmuir Isotherm", latex: "\\frac{x}{m} = \\frac{aP}{1 + bP}", desc: "Monolayer adsorption model; a and b are empirical constants" },

  // ── INORGANIC CHEMISTRY ──────────────────────────────────────────────────
  { category: "Periodic Table", name: "Effective Nuclear Charge (Slater)", latex: "Z_{eff} = Z - \\sigma", desc: "σ = shielding constant calculated using Slater's rules" },
  { category: "Periodic Table", name: "Ionisation Energy Trend", latex: "IE_1 < IE_2 < IE_3 \\cdots", desc: "Successive IEs always increase; large jump after noble gas configuration" },

  { category: "Coordination Chemistry", name: "CFSE (Octahedral, d⁶)", latex: "\\text{CFSE} = -2.4\\Delta_o + P", desc: "Δₒ = crystal field splitting energy; P = pairing energy; compare to determine HS/LS" },
  { category: "Coordination Chemistry", name: "Magnetic Moment", latex: "\\mu = \\sqrt{n(n+2)} \\text{ BM}", desc: "n = number of unpaired electrons; BM = Bohr Magneton" },
  { category: "Coordination Chemistry", name: "Werner's Theory (Primary + Secondary)", latex: "\\text{Primary valence} = \\text{oxidation state}; \\quad \\text{Secondary} = \\text{coordination number}", desc: "Primary satisfied by anions, secondary by ligands in coordination sphere" },

  { category: "Metallurgy", name: "Ellingham Criterion", latex: "\\Delta G = \\Delta H - T\\Delta S < 0 \\Rightarrow \\text{spontaneous reduction}", desc: "Metal oxide with more negative ΔG can reduce another metal oxide" },

  // ── ORGANIC CHEMISTRY ───────────────────────────────────────────────────
  { category: "Reaction Mechanisms", name: "SN2 Rate Law", latex: "\\text{Rate} = k[\\text{Alkyl halide}][\\text{Nucleophile}]", desc: "Bimolecular; inversion of configuration (Walden inversion); favoured by 1° halides" },
  { category: "Reaction Mechanisms", name: "SN1 Rate Law", latex: "\\text{Rate} = k[\\text{Alkyl halide}]", desc: "Unimolecular; racemisation; favoured by 3° halides in polar protic solvents" },
  { category: "Reaction Mechanisms", name: "E2 Elimination", latex: "\\text{Rate} = k[\\text{Substrate}][\\text{Base}]", desc: "Anti-periplanar geometry required; forms Zaitsev's product (more substituted alkene)" },

  { category: "Stereochemistry", name: "Degree of Unsaturation (DBE)", latex: "DBE = \\frac{2C + 2 + N - H - X}{2}", desc: "C = carbons, H = hydrogens, N = nitrogens, X = halogens in molecular formula" },
  { category: "Stereochemistry", name: "Optical Activity", latex: "[\\alpha]_D^{20} = \\frac{\\alpha}{l \\cdot c}", desc: "Specific rotation; l = path length (dm), c = concentration (g/mL)" },

  { category: "Carbonyl Chemistry", name: "Aldol Condensation", latex: "2\\,CH_3CHO \\xrightarrow{\\text{dil. NaOH}} CH_3CH(OH)CH_2CHO", desc: "α-H required; β-hydroxy aldehyde loses water on heating to form enone" },
  { category: "Carbonyl Chemistry", name: "Cannizzaro Reaction", latex: "2\\,HCHO \\xrightarrow{\\text{conc. NaOH}} CH_3OH + HCOONa", desc: "Disproportionation of aldehydes lacking α-H; hydride transfer mechanism" },

  { category: "Biomolecules", name: "Zwitterion pH", latex: "pI = \\frac{pK_{a1} + pK_{a2}}{2}", desc: "Isoelectric point of amino acid; net charge = 0 at pI" },
  { category: "Biomolecules", name: "Glucose Fischer Projection", latex: "\\text{D-Glucose: [}\\alpha\\text{]} = +52.7°; \\text{MW} = 180\\text{ g/mol}", desc: "Aldohexose; mutarotation in solution; Haworth projection shows ring form" },

  { category: "Polymers", name: "Degree of Polymerisation", latex: "n = \\frac{M_n}{M_0}", desc: "Mₙ = number-average molar mass, M₀ = molar mass of monomer repeat unit" },

  // ── INDUSTRIAL PROCESSES ─────────────────────────────────────────────────
  { category: "Industrial Chemistry", name: "Haber-Bosch Process", latex: "N_2 + 3H_2 \\rightleftharpoons 2NH_3 \\quad \\Delta H = -92\\text{ kJ/mol}", desc: "450°C, 200 atm, Fe catalyst; high pressure favours NH₃ (Le Chatelier)" },
  { category: "Industrial Chemistry", name: "Contact Process (H₂SO₄)", latex: "2SO_2 + O_2 \\rightleftharpoons 2SO_3 \\quad \\Delta H = -197\\text{ kJ/mol}", desc: "V₂O₅ catalyst; SO₃ absorbed in conc. H₂SO₄ to form oleum" },
  { category: "Industrial Chemistry", name: "Ostwald Process (HNO₃)", latex: "4NH_3 + 5O_2 \\xrightarrow{Pt,\\,820^\\circ C} 4NO + 6H_2O", desc: "NO oxidised to NO₂, dissolved in water: 3NO₂ + H₂O → 2HNO₃ + NO" }
];

// Export to global scope
window.FORMULA_DATABASE = FORMULA_DATABASE;
console.log(`Formula database loaded: ${FORMULA_DATABASE.length} formulas across ${[...new Set(FORMULA_DATABASE.map(f=>f.category))].length} categories.`);
