// All diameters and wandering distances are in CSS pixels, independent of DPR.
const SETTINGS = {
  areaPerFirefly: 8000,
  minCount: 24,
  maxCount: 190,
  coreDiameter: [1.25, 2.1],
  innerDiameter: [5, 8.75],
  haloDiameter: [15, 25],
  coreOpacity: 0.85,
  innerOpacity: 0.26,
  haloOpacity: 0.035,
  foregroundChance: 0.04,
  foregroundScale: 1.4,
  motionSpeed: 0.65,
  pulseSeconds: [3.5, 9],
  maxFPS: 30,
};

const CORE_COLOR = [255, 246, 220];
// Warm ivory, amber, and a small yellow-green accent; no icy blue lights.
const COLORS = [[255, 232, 180], [255, 205, 120], [221, 230, 156]];
const COLOR_WEIGHTS = [0.62, 0.30, 0.08];
const TAU = Math.PI * 2;
const randomBetween = ([min, max]) => min + Math.random() * (max - min);

function createGlow(color) {
  const sprite = document.createElement('canvas');
  // Fixed, oversampled sprites keep soft layers smooth even at mobile DPRs.
  // The transparent margin prevents a rectangular edge when interpolating.
  sprite.width = sprite.height = 128;
  const context = sprite.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 62);
  gradient.addColorStop(0, `rgba(${color.join(',')}, 1)`);
  gradient.addColorStop(0.2, `rgba(${color.join(',')}, 0.6)`);
  gradient.addColorStop(0.5, `rgba(${color.join(',')}, 0.12)`);
  gradient.addColorStop(0.8, `rgba(${color.join(',')}, 0.015)`);
  gradient.addColorStop(1, `rgba(${color.join(',')}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return sprite;
}

function createFirefly() {
  const foreground = Math.random() < SETTINGS.foregroundChance;
  const scale = foreground ? SETTINGS.foregroundScale : 1;
  const colorRoll = Math.random();
  let color = 0;
  let weight = COLOR_WEIGHTS[0];
  while (color < COLORS.length - 1 && colorRoll > weight) {
    weight += COLOR_WEIGHTS[++color];
  }

  return {
    x: Math.random(),
    y: Math.random(),
    freqX: 0.12 + Math.random() * 0.18,
    freqY: 0.1 + Math.random() * 0.17,
    ampX: (10 + Math.random() * 24) * scale,
    ampY: (8 + Math.random() * 20) * scale,
    phaseX: Math.random() * TAU,
    phaseY: Math.random() * TAU,
    driftPhase: Math.random() * TAU,
    pulseSpeed: TAU / randomBetween(SETTINGS.pulseSeconds),
    pulsePhase: Math.random() * TAU,
    pulseDrift: Math.random() * TAU,
    opacity: 0.65 + Math.random() * 0.25,
    coreDiameter: randomBetween(SETTINGS.coreDiameter) * scale,
    innerDiameter: randomBetween(SETTINGS.innerDiameter) * scale,
    haloDiameter: randomBetween(SETTINGS.haloDiameter) * scale,
    foreground,
    color,
  };
}

export function createFireflies(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return { dispose() {} };

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sprites = COLORS.map(createGlow);
  const foregroundCore = createGlow(CORE_COLOR);
  const fireflies = [];
  let width = 0;
  let height = 0;
  let frame;
  let previous = null;
  let lastPaint = null;
  let elapsed = 0;
  let disposed = false;
  let pixelRatio = 0;
  let resolution;
  const frameInterval = 1000 / SETTINGS.maxFPS;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    context.globalCompositeOperation = 'source-over';
    if (ratio !== pixelRatio) {
      resolution?.removeEventListener('change', resize);
      pixelRatio = ratio;
      // Moving between monitors / changing zoom can change DPR without resize.
      resolution = window.matchMedia(`(resolution: ${ratio}dppx)`);
      resolution.addEventListener('change', resize);
    }
    const count = Math.min(SETTINGS.maxCount, Math.max(SETTINGS.minCount,
      Math.round(width * height / SETTINGS.areaPerFirefly)));
    while (fireflies.length < count) fireflies.push(createFirefly());
    fireflies.length = count;
    if (!motion.matches && !document.hidden) paint();
  }

  function paint() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = `rgb(${CORE_COLOR.join(',')})`;
    const time = elapsed * SETTINGS.motionSpeed;
    for (const firefly of fireflies) {
      // Interleaved frequencies avoid a short repeating orbit; each axis turns
      // smoothly, with independent phases and no pointer attraction.
      const x = firefly.x * width + firefly.ampX * (
        Math.sin(time * firefly.freqX + firefly.phaseX)
        + 0.3 * Math.sin(time * firefly.freqY * 0.73 + firefly.driftPhase));
      const y = firefly.y * height + firefly.ampY * (
        Math.sin(time * firefly.freqY + firefly.phaseY)
        + 0.3 * Math.cos(time * firefly.freqX * 0.57 + firefly.driftPhase));
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * firefly.pulseSpeed + firefly.pulsePhase
        + 0.3 * Math.sin(elapsed * firefly.pulseSpeed * 0.37 + firefly.pulseDrift));
      const brightness = (0.16 + 0.84 * pulse * pulse) * firefly.opacity;
      const sprite = sprites[firefly.color];

      context.globalAlpha = brightness * SETTINGS.haloOpacity;
      context.drawImage(sprite, x - firefly.haloDiameter / 2, y - firefly.haloDiameter / 2,
        firefly.haloDiameter, firefly.haloDiameter);
      context.globalAlpha = brightness * SETTINGS.innerOpacity;
      context.drawImage(sprite, x - firefly.innerDiameter / 2, y - firefly.innerDiameter / 2,
        firefly.innerDiameter, firefly.innerDiameter);

      context.globalAlpha = brightness * SETTINGS.coreOpacity;
      if (firefly.foreground) {
        // Only the few nearer lights have a slightly softened center.
        const diameter = firefly.coreDiameter * 1.6;
        context.drawImage(foregroundCore, x - diameter / 2, y - diameter / 2, diameter, diameter);
      } else {
        // Vector core is painted after the glow, at the full backing resolution.
        context.beginPath();
        context.arc(x, y, firefly.coreDiameter / 2, 0, TAU);
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  function animate(now) {
    if (disposed) return;
    elapsed += previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (lastPaint === null || now - lastPaint >= frameInterval) {
      paint();
      lastPaint = lastPaint === null ? now : now - ((now - lastPaint) % frameInterval);
    }
    frame = requestAnimationFrame(animate);
  }

  function visibilityChanged() {
    cancelAnimationFrame(frame);
    previous = null;
    lastPaint = null;
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
      resolution?.removeEventListener('change', resize);
      canvas.width = canvas.height = 0;
    },
  };
}
