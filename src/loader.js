// Controla la pantalla de carga (el HTML/CSS ya está en la página y se ve al instante).
// Si existe assets/loading-birds.json, el build lo incrusta y se reproduce con lottie-web.
import lottieData from 'virtual:loading-lottie-data';
import lottie from 'virtual:lottie-player';

export function createLoader() {
  const root = document.getElementById('loader');
  const bar = document.getElementById('bar');
  const blocks = Array.from(bar.children);
  const stepEl = document.getElementById('lstep');
  const pctEl = document.getElementById('lpct');
  const titleEl = document.getElementById('ltitle');

  if (lottieData && lottie) {
    try {
      lottie.loadAnimation({
        container: document.getElementById('lottie'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: lottieData,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      });
      root.classList.add('has-lottie');
      document.getElementById('credit-lottie').hidden = false;
    } catch (err) {
      console.warn('No se pudo reproducir la animación Lottie; se usan los pajaritos SVG.', err);
    }
  }

  let lastBlocks = -1;
  return {
    progress(p, label) {
      p = Math.min(1, Math.max(0, p));
      const on = Math.round(p * blocks.length);
      if (on !== lastBlocks) {
        blocks.forEach((b, i) => b.classList.toggle('on', i < on));
        lastBlocks = on;
      }
      pctEl.textContent = `${Math.round(p * 100)}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      root.style.setProperty('--p', String(p));
      if (label) stepEl.textContent = label;
    },
    finish() {
      root.classList.add('done');
      return new Promise((resolve) => setTimeout(() => { root.remove(); resolve(); }, 950));
    },
    fail(message) {
      root.classList.add('failed');
      titleEl.textContent = 'No se pudo mostrar la escena';
      stepEl.textContent = message;
    },
  };
}
