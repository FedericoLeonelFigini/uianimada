/* ================
   Utilidades
================ */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =============
   Smooth anchor
   (browser ya hace mucho, esto es por fallback)
============= */
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

/* =========================
   Scroll-reveal con IO
========================= */
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

/* =========================
   Botón magnético (suave)
========================= */
(function setupMagnet(){
  const wrap = document.querySelector('.magnet');
  const target = document.querySelector('.magnet__target');
  if (!wrap || !target) return;

  let raf, hovering = false;
  const strength = 22; // px
  const rotate = 6;    // deg

  function animate(x, y, w, h){
    const dx = (x - (w/2)) / (w/2);
    const dy = (y - (h/2)) / (h/2);
    const tx = dx * strength;
    const ty = dy * strength;
    const rx = -dy * rotate;
    const ry = dx * rotate;
    target.style.transform = `translate(${tx}px, ${ty}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }

  function reset(){
    target.style.transform = 'translate(0,0) rotateX(0) rotateY(0)';
  }

  wrap.addEventListener('pointerenter', () => { hovering = true; }, { passive:true });
  wrap.addEventListener('pointerleave', () => { hovering = false; cancelAnimationFrame(raf); reset(); }, { passive:true });
  wrap.addEventListener('pointermove', (e) => {
    if (prefersReduced || !hovering) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => animate(x, y, rect.width, rect.height));
  }, { passive:true });
})();

/* =========================
   Tilt 3D en cards
========================= */
(function setupTilt(){
  const cards = document.querySelectorAll('.tilt');
  if (!cards.length) return;

  const maxTilt = 8; // deg

  cards.forEach(card => {
    let raf;
    function run(e){
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;   // 0..1
      const py = (e.clientY - r.top) / r.height;   // 0..1
      const rx = (maxTilt/2 - py * maxTilt);       // invert y
      const ry = (px * maxTilt - maxTilt/2);
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    }
    function reset(){ card.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'; }

    card.addEventListener('pointermove', (e) => {
      if (prefersReduced) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => run(e));
    }, { passive:true });

    card.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); reset(); }, { passive:true });
  });
})();

/* =========================
   Mejora de carga de imágenes
========================= */
(async function decodeImages(){
  const imgs = Array.from(document.images).filter(img => !img.complete);
  await Promise.allSettled(imgs.map(img => img.decode?.().catch(()=>{})));
  // (Opcional) añadir clase "ready" si quieres animarlas al aparecer
})();
