(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  /* ============================================================
     CUSTOM CURSOR
     ============================================================ */
  if (!reduceMotion && !isTouch) {
    const dot = document.querySelector(".cursor-dot");
    const ring = document.querySelector(".cursor-ring");
    const label = document.querySelector(".cursor-label");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    });

    function tickRing() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      requestAnimationFrame(tickRing);
    }
    tickRing();

    document.querySelectorAll("a, button, [data-tilt]").forEach((el) => {
      const isProject = el.hasAttribute("data-tilt");
      el.addEventListener("mouseenter", () => {
        ring.classList.add("is-active");
        label.textContent = isProject ? "VOIR" : "→";
      });
      el.addEventListener("mouseleave", () => {
        ring.classList.remove("is-active");
        label.textContent = "";
      });
    });
  }

  /* ============================================================
     MAGNETIC ELEMENTS (nav / contact links)
     ============================================================ */
  if (!reduceMotion && !isTouch) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const relX = e.clientX - r.left - r.width / 2;
        const relY = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${relX * 0.25}px, ${relY * 0.4}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "translate(0, 0)";
      });
    });
  }

  /* ============================================================
     MAGNETIC HERO TITLE — letters drift toward the cursor
     ============================================================ */
  if (!reduceMotion && !isTouch) {
    const lines = document.querySelectorAll("[data-line]");
    lines.forEach((line) => {
      const text = line.textContent;
      line.textContent = "";
      [...text].forEach((ch) => {
        const span = document.createElement("span");
        span.textContent = ch;
        span.style.display = "inline-block";
        span.style.willChange = "transform";
        line.appendChild(span);
      });
    });

    const spans = document.querySelectorAll("[data-line] span");
    window.addEventListener("mousemove", (e) => {
      spans.forEach((span) => {
        const r = span.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const radius = 160;
        if (dist < radius) {
          const strength = (1 - dist / radius) * 14;
          const angle = Math.atan2(dy, dx);
          span.style.transform = `translate(${-Math.cos(angle) * strength}px, ${-Math.sin(angle) * strength}px)`;
        } else {
          span.style.transform = "translate(0, 0)";
        }
      });
    });
  }

  /* Ambient hero background is now handled by hero3d.js (WebGL/Three.js) */

  /* ============================================================
     EXHIBIT VISUALS — generative pattern per project, tied to the
     "museum label" identity. Each variant reads differently so the
     cards don't feel like copies of one template.
     ============================================================ */
  document.querySelectorAll(".exhibit-gfx").forEach((canvasEl) => {
    const ctx = canvasEl.getContext("2d");
    const variant = Number(canvasEl.dataset.variant || 0);
    let w, h;

    function resize() {
      const rect = canvasEl.parentElement.getBoundingClientRect();
      w = canvasEl.width = rect.width;
      h = canvasEl.height = rect.height;
      render();
    }

    function render() {
      ctx.clearRect(0, 0, w, h);
      const cell = 28;

      if (variant === 0) {
        // Les Abattoirs — checker-field, mirrors the pixel fresco piece
        for (let y = 0; y < h; y += cell) {
          for (let x = 0; x < w; x += cell) {
            const n = Math.sin(x * 0.02) + Math.cos(y * 0.025);
            if (n > 0.6) {
              ctx.fillStyle = "rgba(58,92,255,0.5)";
              ctx.fillRect(x, y, 3, 3);
            } else if (n < -0.7) {
              ctx.fillStyle = "rgba(255,59,48,0.35)";
              ctx.fillRect(x, y, 3, 3);
            }
          }
        }
      } else if (variant === 1) {
        // Un Coup de Pouce — radiating connection nodes, mirrors matching/mise en relation
        const cols = Math.ceil(w / cell);
        const rows = Math.ceil(h / cell);
        const cx = cols / 2;
        const cy = rows / 2;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const d = Math.hypot(i - cx, j - cy);
            const ring = Math.sin(d * 0.9);
            if (ring > 0.75) {
              ctx.fillStyle = "rgba(58,92,255,0.45)";
              ctx.beginPath();
              ctx.arc(i * cell, j * cell, 1.6, 0, Math.PI * 2);
              ctx.fill();
            } else if (ring < -0.85) {
              ctx.fillStyle = "rgba(255,59,48,0.3)";
              ctx.beginPath();
              ctx.arc(i * cell, j * cell, 1.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      } else {
        // DevMate — diagonal weave, mirrors "plusieurs services tissés ensemble"
        const step = cell * 0.6;
        for (let y = -h; y < h * 2; y += step) {
          ctx.strokeStyle = "rgba(58,92,255,0.18)";
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + w * 0.35);
          ctx.stroke();
        }
        for (let y = -h; y < h * 2; y += step * 1.7) {
          ctx.strokeStyle = "rgba(255,59,48,0.14)";
          ctx.beginPath();
          ctx.moveTo(0, y + w * 0.35);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }
    }

    resize();
    window.addEventListener("resize", resize);
  });

  /* ============================================================
     3D TILT ON EXHIBIT CARD
     ============================================================ */
  if (!reduceMotion && !isTouch) {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      const card = el.querySelector(".exhibit-card");
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `rotateY(${px * 4}deg) rotateX(${-py * 4}deg)`;
      });
      el.addEventListener("mouseleave", () => {
        card.style.transform = "rotateY(0) rotateX(0)";
      });
    });
  }

  /* ============================================================
     SCROLL REVEAL
     ============================================================ */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }
})();
