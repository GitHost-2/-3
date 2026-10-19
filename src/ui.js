import { clockLabel, phaseLabel } from './env.js';

const ICON_PAUSE = 'M6 5h4v14H6zM14 5h4v14h-4z';
const ICON_PLAY = 'M7 4l13 8-13 8z';
const ICON_REPLAY = 'M12 5V1L7 6l5 5V7a5 5 0 11-5 5H5a7 7 0 107-7z';

export function createUI(h) {
  const $ = (id) => document.getElementById(id);
  const playBtn = $('play'), icon = $('play-icon'), range = $('time'), clock = $('clock');
  const phase = $('phase'), fullBtn = $('full'), infoBtn = $('info'), credits = $('credits'), hint = $('hint');

  let scrubbing = false;
  let lastClock = '', lastPhase = '', lastIcon = '';

  range.addEventListener('pointerdown', () => { scrubbing = true; h.onScrubStart(); });
  addEventListener('pointerup', () => { if (scrubbing) { scrubbing = false; h.onScrubEnd(); } });
  range.addEventListener('input', () => h.onScrub(Number(range.value) / 1000));
  playBtn.addEventListener('click', () => h.onToggle());

  fullBtn.addEventListener('click', () => {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) Promise.resolve(el.requestFullscreen()).catch(() => {});
    } catch (_) { /* algunos visores no permiten pantalla completa */ }
  });

  const closeCredits = () => { credits.hidden = true; infoBtn.focus(); };
  infoBtn.addEventListener('click', () => { credits.hidden = false; $('credits-close').focus(); });
  $('credits-close').addEventListener('click', closeCredits);
  credits.addEventListener('click', (e) => { if (e.target === credits) closeCredits(); });

  // La interfaz se esconde sola para dejar ver el cielo.
  let idleTimer = 0;
  const wake = () => {
    document.body.classList.remove('ui-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (credits.hidden) document.body.classList.add('ui-idle'); }, 4500);
  };
  ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, wake, { passive: true }));
  wake();

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !credits.hidden) { closeCredits(); return; }
    if (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName) && e.key === ' ') return;
    if (e.key === ' ') { e.preventDefault(); h.onToggle(); }
    else if (e.key === 'ArrowRight') h.onNudge(0.02);
    else if (e.key === 'ArrowLeft') h.onNudge(-0.02);
    else if (e.key === 'r' || e.key === 'R') h.onRestart();
    else if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('ui-idle');
  });

  setTimeout(() => hint.classList.add('gone'), 12000);

  return {
    hideHint() { hint.classList.add('gone'); },
    update(t, playing) {
      if (!scrubbing) {
        const v = String(Math.round(t * 1000));
        if (range.value !== v) range.value = v;
      }
      const c = clockLabel(t);
      if (c !== lastClock) { clock.textContent = c; lastClock = c; }
      const p = phaseLabel(t);
      if (p !== lastPhase) { phase.textContent = p; lastPhase = p; }
      const finished = t >= 1;
      const d = finished ? ICON_REPLAY : playing ? ICON_PAUSE : ICON_PLAY;
      if (d !== lastIcon) {
        icon.setAttribute('d', d);
        playBtn.setAttribute('aria-label', finished ? 'Volver al atardecer' : playing ? 'Pausar el paso del tiempo' : 'Reanudar el paso del tiempo');
        lastIcon = d;
      }
    },
  };
}
