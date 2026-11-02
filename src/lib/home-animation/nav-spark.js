import * as THREE from 'three';
import { createEffects } from './effects';

export function createNavSpark({ canvas, link }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  camera.position.z = 600;
  const effects = createEffects(scene);
  const origin = new THREE.Vector3();
  let observer;
  let disposed = false;
  let frame;
  let previous = null;
  let elapsed = 0;
  let sparkRemaining = .4;
  let visible = true;

  function resize() {
    const bounds = link.getBoundingClientRect();
    const left = Math.max(0, bounds.left - 128);
    const top = Math.max(0, bounds.top - 128);
    const width = Math.max(1, Math.min(innerWidth, bounds.right + 128) - left);
    const height = Math.max(1, Math.min(innerHeight, bounds.bottom + 128) - top);
    visible = bounds.bottom > 0 && bounds.top < innerHeight;
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    origin.set(bounds.left + bounds.width * .25 - left - width / 2,
      height / 2 - (bounds.top + bounds.height * .45 - top), 105);
  }

  function animate(now) {
    if (disposed) return;
    const delta = previous === null ? 0 : Math.min((now - previous) / 1000, .05);
    previous = now;
    elapsed += delta;
    sparkRemaining -= delta;
    if (visible && sparkRemaining <= 0) {
      effects.shortCircuit(origin, .7 + Math.random() * .5);
      sparkRemaining = .5 + Math.random() * 1.1;
    }
    effects.update(delta, elapsed);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }

  function visibilityChanged() {
    cancelAnimationFrame(frame);
    previous = null;
    if (!document.hidden && !disposed) frame = requestAnimationFrame(animate);
  }

  function contextLost(event) {
    event.preventDefault();
    dispose();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', resize);
    document.removeEventListener('visibilitychange', visibilityChanged);
    canvas.removeEventListener('webglcontextlost', contextLost);
    effects.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.width = canvas.height = 0;
    delete canvas.dataset.ready;
  }

  try {
    observer = new ResizeObserver(resize);
    observer.observe(link);
    observer.observe(link.closest('nav'));
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', resize, { passive: true });
    document.addEventListener('visibilitychange', visibilityChanged);
    canvas.addEventListener('webglcontextlost', contextLost);
    resize();
    canvas.dataset.ready = 'true';
    if (!document.hidden) frame = requestAnimationFrame(animate);
  } catch (error) {
    dispose();
    throw error;
  }
  return { dispose };
}
