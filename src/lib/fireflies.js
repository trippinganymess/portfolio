// The lake's warm, icy, and chalk-white fireflies, painted without another
// WebGL context so they can accompany every portfolio page.
const COLORS = [[255, 223, 158], [203, 224, 245], [238, 242, 245]];

function createGlow(color) {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const context = sprite.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, `rgba(${color.join(',')}, 1)`);
  gradient.addColorStop(0.22, `rgba(${color.join(',')}, 0.85)`);
  gradient.addColorStop(0.5, `rgba(${color.join(',')}, 0.32)`);
  gradient.addColorStop(1, `rgba(${color.join(',')}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return sprite;
}

function createFirefly() {
  return {
    x: Math.random(),
    y: Math.random(),
    freqX: 0.25 + Math.random() * 0.45,
    freqY: 0.35 + Math.random() * 0.55,
    ampX: 8 + Math.random() * 28,
    ampY: 6 + Math.random() * 24,
    pulseSpeed: 1.5 + Math.random() * 3.2,
    phase: Math.random() * Math.PI * 2,
    size: 7 + Math.random() * 12,
    color: Math.random() > 0.32 ? 0 : (Math.random() > 0.5 ? 1 : 2),
  };
}

export function createFireflies(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return { dispose() {} };

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sprites = COLORS.map(createGlow);
  const fireflies = [];
  let width = 0;
  let height = 0;
  let frame;
  let previous = null;
  let elapsed = 0;
  let disposed = false;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.globalCompositeOperation = 'lighter';
    const count = Math.min(190, Math.max(24, Math.round(width * height / 8000)));
    while (fireflies.length < count) fireflies.push(createFirefly());
    fireflies.length = count;
  }

  function paint() {
    context.clearRect(0, 0, width, height);
    for (const firefly of fireflies) {
      const x = firefly.x * width + Math.sin(elapsed * firefly.freqX + firefly.phase) * firefly.ampX;
      const y = firefly.y * height + Math.cos(elapsed * firefly.freqY + firefly.phase) * firefly.ampY;
      const flicker = 0.25 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * firefly.pulseSpeed + firefly.phase), 2.2);
      context.globalAlpha = flicker * 0.7;
      context.drawImage(sprites[firefly.color], x - firefly.size / 2, y - firefly.size / 2, firefly.size, firefly.size);
    }
  }

  function animate(now) {
    if (disposed) return;
    elapsed += previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    paint();
    frame = requestAnimationFrame(animate);
  }

  function visibilityChanged() {
    cancelAnimationFrame(frame);
    previous = null;
    if (motion.matches) context.clearRect(0, 0, width, height);
    if (!disposed && !document.hidden && !motion.matches) {
      frame = requestAnimationFrame(animate);
    }
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibilityChanged);
  motion.addEventListener('change', visibilityChanged);
  resize();
  visibilityChanged();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibilityChanged);
      motion.removeEventListener('change', visibilityChanged);
      canvas.width = canvas.height = 0;
    },
  };
}
