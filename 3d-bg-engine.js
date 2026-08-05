/* ==========================================================================
   3D Ambient Background Particle & Atomic Orbital Canvas Engine
   ========================================================================== */

(function () {
  const canvas = document.createElement("canvas");
  canvas.id = "bg-3d-canvas";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "-1";
  canvas.style.opacity = "0.45";
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  let width, height;
  let particles = [];
  let rotationAngle = 0;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // Create 3D floating particles
  for (let i = 0; i < 70; i++) {
    particles.push({
      x: (Math.random() - 0.5) * width * 1.5,
      y: (Math.random() - 0.5) * height * 1.5,
      z: Math.random() * 800 + 100,
      radius: Math.random() * 2.5 + 1,
      color: `hsl(${Math.random() * 60 + 190}, 85%, 65%)`,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      speedZ: (Math.random() - 0.5) * 0.8
    });
  }

  function draw3DOrbit(cx, cy, rx, ry, tiltAngle, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tiltAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Electron dot on orbit
    const eAngle = rotationAngle * 1.5;
    const ex = rx * Math.cos(eAngle);
    const ey = ry * Math.sin(eAngle);
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#69f0ae";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#69f0ae";
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    rotationAngle += 0.008;

    const fov = 400;
    const centerX = width / 2;
    const centerY = height / 2;

    // Draw background 3D floating particles
    particles.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.z += p.speedZ;

      if (p.z <= 10) p.z = 800;
      if (p.z > 800) p.z = 10;

      const scale = fov / (fov + p.z);
      const projX = centerX + p.x * scale;
      const projY = centerY + p.y * scale;

      ctx.beginPath();
      ctx.arc(projX, projY, p.radius * scale, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, scale * 1.2);
      ctx.fill();
    });

    // Draw 3D Rotating Nucleus & Orbits at Top-Right & Bottom-Left
    draw3DOrbit(width * 0.85, height * 0.2, 120, 45, rotationAngle, "rgba(64, 196, 255, 0.25)");
    draw3DOrbit(width * 0.85, height * 0.2, 120, 45, -rotationAngle * 1.2, "rgba(224, 64, 251, 0.25)");

    draw3DOrbit(width * 0.15, height * 0.8, 140, 50, rotationAngle * 0.8, "rgba(255, 215, 64, 0.25)");
    draw3DOrbit(width * 0.15, height * 0.8, 140, 50, -rotationAngle * 0.9, "rgba(105, 240, 174, 0.25)");

    requestAnimationFrame(render);
  }

  render();

  // Add 3D Tilt Effect to Cards
  document.addEventListener("mousemove", (e) => {
    const cards = document.querySelectorAll(".glass-card, .sim-card, .chapter-card, .stat-card");
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardX = rect.left + rect.width / 2;
      const cardY = rect.top + rect.height / 2;

      const dist = Math.hypot(mouseX - cardX, mouseY - cardY);
      if (dist < 300) {
        const tiltX = (cardY - mouseY) / 25;
        const tiltY = (mouseX - cardX) / 25;
        card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(8px)`;
        card.style.transition = "transform 0.1s ease-out";
      } else {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
        card.style.transition = "transform 0.5s ease-out";
      }
    });
  });
})();
