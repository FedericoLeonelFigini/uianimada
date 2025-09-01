/* =====================================================
   UI Animada • Motor de Fondo Avanzado
   - Modo ONDAS: círculos concéntricos que se expanden
     y afectan partículas cercanas (repulsión/atracción).
   - Modo PARTÍCULAS: constelación con enlaces dinámicos.
   - Optimizaciones: DPR cap, desync ctx, passive listeners,
     pause en pestaña oculta, prefers-reduced-motion.
===================================================== */

/* ----- Utilidades generales ----- */
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Smooth anchor fallback */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length > 1) {
    const el = document.querySelector(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }
  }
}, { passive: true });

/* Scroll-reveal */
(function setupReveal(){
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });
  els.forEach(el => io.observe(el));
})();

/* Tilt 3D en cards */
(function setupTilt(){
  const cards = document.querySelectorAll('.tilt');
  if (!cards.length) return;
  const maxTilt = 8;
  cards.forEach(card => {
    let raf;
    function run(e){
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (maxTilt/2 - py * maxTilt);
      const ry = (px * maxTilt - maxTilt/2);
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    }
    function reset(){ card.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'; }
    card.addEventListener('pointermove', (e) => { if (!prefersReduced){ cancelAnimationFrame(raf); raf = requestAnimationFrame(() => run(e)); } }, { passive:true });
    card.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); reset(); }, { passive:true });
  });
})();

/* -------------- Motor de Fondo -------------- */
(function Engine(){
  const canvas = document.querySelector('canvas.bg-canvas') || (() => {
    const c = document.createElement('canvas'); c.className = 'bg-canvas'; document.body.appendChild(c); return c;
  })();
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  // Paleta desde CSS variables
  const css = getComputedStyle(document.documentElement);
  const BRAND  = (css.getPropertyValue('--brand')   || '#d4af37').trim();
  const BRAND2 = (css.getPropertyValue('--brand-2') || '#f2e9c3').trim();
  const ACCENT = (css.getPropertyValue('--accent')  || '#7ac6ff').trim();

  // Config general
  const DPR = Math.min(1.8, devicePixelRatio || 1);
  let W = 0, H = 0;

  // Estado
  const STATE = {
    mode: 'waves',             // 'waves' | 'particles'
    running: !prefersReduced,
    pointer: { x: -1e6, y: -1e6, down: false },
    waves: [],                 // ondas activas
    particles: [],             // partículas
    linkDist: 120,             // en px (se multiplica por DPR adentro)
    maxLines: 900              // límite de líneas por frame
  };

  /* -------- Resizing / init ---------- */
  function resize(){
    W = Math.round(innerWidth * DPR);
    H = Math.round(innerHeight * DPR);
    canvas.width = W; canvas.height = H;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    initParticles();
    if (prefersReduced) drawStatic();
  }

  function initParticles(){
    const count = Math.max(40, Math.min(90, Math.round((innerWidth * innerHeight) / 16000)));
    STATE.particles = new Array(count).fill(0).map(() => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() * 2 - 1) * 0.18 * DPR,
      vy: (Math.random() * 2 - 1) * 0.18 * DPR,
      r:  (Math.random() * 1.2 + 0.8) * DPR
    }));
  }

  /* -------- Ondas ---------- */
  function spawnWave(x, y, color){
    STATE.waves.push({
      x, y,
      r: 0,
      maxR: Math.hypot(W, H) * 0.6,     // llega hasta ~60% de la diagonal
      width: 14 * DPR,                  // grosor base
      speed: 3.2 * DPR,                 // velocidad de expansión
      alpha: 0.33,
      color
    });
  }

  /* -------- Físicas simples ---------- */
  function step(){
    ctx.clearRect(0, 0, W, H);

    const linkDist = STATE.linkDist * DPR;
    const linkDist2 = linkDist * linkDist;

    // Ondas
    for (let i = STATE.waves.length - 1; i >= 0; i--){
      const w = STATE.waves[i];
      w.r += w.speed;
      w.alpha *= 0.985;
      if (w.r > w.maxR || w.alpha < 0.02){ STATE.waves.splice(i,1); continue; }

      // Visual de la onda (anillo)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // mezcla aditiva
      ctx.strokeStyle = w.color;
      ctx.globalAlpha = w.alpha;
      ctx.lineWidth = w.width * (1 - w.r / w.maxR) + 1;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // Partículas (movimiento + reacción a ondas)
    for (let i = 0; i < STATE.particles.length; i++){
      const p = STATE.particles[i];

      // Reacción a ondas (repulsión radial leve)
      for (let k = 0; k < STATE.waves.length; k++){
        const w = STATE.waves[k];
        const dx = p.x - w.x, dy = p.y - w.y;
        const d = Math.hypot(dx, dy);
        const edge = Math.abs(d - w.r);

        if (edge < 80 * DPR){ // banda cercana al borde de la onda
          const force = (80 * DPR - edge) / (80 * DPR);
          const nx = dx / (d || 1e-3);
          const ny = dy / (d || 1e-3);
          // Push-out con leve torque
          p.vx += nx * 0.05 * force * DPR + ny * 0.01 * force * DPR;
          p.vy += ny * 0.05 * force * DPR - nx * 0.01 * force * DPR;
        }
      }

      // Movimiento base
      p.x += p.vx; p.y += p.vy;

      // Rebote en bordes
      if (p.x < 0) { p.x = 0; p.vx *= -1; }
      else if (p.x > W) { p.x = W; p.vx *= -1; }
      if (p.y < 0) { p.y = 0; p.vy *= -1; }
      else if (p.y > H) { p.y = H; p.vy *= -1; }
    }

    // Dibujo de partículas + enlaces
    let lines = 0;
    ctx.lineWidth = 1 * DPR;
    for (let i = 0; i < STATE.particles.length; i++){
      const a = STATE.particles[i];

      // Punto
      ctx.fillStyle = BRAND;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
      ctx.fill();

      // Enlaces
      if (STATE.mode !== 'waves'){
        for (let j = i + 1; j < STATE.particles.length; j++){
          const b = STATE.particles[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx*dx + dy*dy;
          if (d2 < linkDist2){
            const alpha = 1 - (d2 / linkDist2);
            ctx.strokeStyle = ACCENT;
            ctx.globalAlpha = Math.min(0.35, 0.45 * alpha);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            if (++lines > STATE.maxLines) break;
          }
        }
        if (lines > STATE.maxLines) break;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStatic(){
    // En modo reducido, una sola pasada de puntos (sin animación)
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BRAND;
    ctx.globalAlpha = 0.55;
    STATE.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  let rafId = 0;
  function loop(){
    if (!STATE.running) return;
    step();
    rafId = requestAnimationFrame(loop);
  }

  /* -------- Eventos ---------- */
  let resizeT;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(resize, 150);
  }, { passive:true });

  addEventListener('pointermove', (e) => {
    STATE.pointer.x = e.clientX * DPR;
    STATE.pointer.y = e.clientY * DPR;
  }, { passive:true });

  addEventListener('pointerdown', (e) => {
    STATE.pointer.down = true;
    const x = e.clientX * DPR, y = e.clientY * DPR;

    // Color alternante para mezcla
    const color = (STATE.mode === 'waves')
      ? (Math.random() < .5 ? BRAND : BRAND2)
      : (Math.random() < .5 ? ACCENT : BRAND);

    spawnWave(x, y, color);

    // Impulso leve a partículas cercanas
    for (const p of STATE.particles){
      const dx = p.x - x, dy = p.y - y;
      const d2 = dx*dx + dy*dy;
      const r2 = (180 * DPR) * (180 * DPR);
      if (d2 < r2){
        const d = Math.sqrt(d2) || 1;
        const k = (1 - d / (180 * DPR)) * 0.6;
        p.vx += (dx / d) * 0.9 * k;
        p.vy += (dy / d) * 0.9 * k;
      }
    }
  }, { passive:true });

  addEventListener('pointerup', () => { STATE.pointer.down = false; }, { passive:true });
  addEventListener('pointerleave', () => { STATE.pointer.down = false; }, { passive:true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden){
      STATE.running = false; cancelAnimationFrame(rafId);
    } else if (!prefersReduced){
      STATE.running = true; loop();
    }
  });

  // Toggle modo fondo
  const toggleBtn = document.querySelector('.mode-toggle');
  function applyModeLabel(){
    if (!toggleBtn) return;
    if (STATE.mode === 'waves'){
      toggleBtn.textContent = 'Ondas';
      toggleBtn.setAttribute('aria-pressed', 'false');
    } else {
      toggleBtn.textContent = 'Partículas';
      toggleBtn.setAttribute('aria-pressed', 'true');
    }
  }
  toggleBtn?.addEventListener('click', () => {
    STATE.mode = (STATE.mode === 'waves') ? 'particles' : 'waves';
    applyModeLabel();
  }, { passive:true });
  applyModeLabel();

  // Init
  resize();
  if (!prefersReduced){ STATE.running = true; loop(); }
})();

/* =====================================================
   Extra: Ripple para botones .ripple (táctil + mouse)
===================================================== */
(function rippleButtons(){
  const btns = document.querySelectorAll('.ripple');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const r = btn.getBoundingClientRect();
      const span = document.createElement('span');
      const size = Math.max(r.width, r.height) * 1.8;
      Object.assign(span.style, {
        position:'absolute', width:size+'px', height:size+'px',
        left:(e.clientX - r.left - size/2)+'px',
        top:(e.clientY - r.top - size/2)+'px',
        borderRadius:'50%', pointerEvents:'none',
        background:`radial-gradient(circle, rgba(255,255,255,.28), transparent 50%)`,
        transform:'scale(0)', opacity:'0', transition:'transform .5s ease, opacity .8s ease'
      });
      btn.style.position = 'relative';
      btn.appendChild(span);
      requestAnimationFrame(() => {
        span.style.transform = 'scale(1)';
        span.style.opacity = '1';
      });
      setTimeout(() => span.remove(), 700);
    }, { passive:true });
  });
})();
