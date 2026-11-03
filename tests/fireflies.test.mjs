import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/lib/fireflies.js', import.meta.url), 'utf8');

function eventTarget(properties = {}) {
  const listeners = new Map();
  return {
    ...properties,
    listeners,
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    emit(name) { for (const listener of [...(listeners.get(name) ?? [])]) listener(); },
  };
}

function createScene(ratio = 1, reduced = false) {
  const frames = new Map();
  const cores = [];
  const glows = [];
  let frameId = 0;
  let gradients = 0;
  let clears = 0;
  let transform;
  const context = {
    createRadialGradient() { gradients++; return { addColorStop() {} }; },
    fillRect() {},
    setTransform(...args) { transform = args; },
    clearRect() { clears++; cores.length = glows.length = 0; },
    drawImage(sprite, x, y, width, height) { glows.push({ x, y, width, height }); },
    beginPath() {},
    arc(x, y, radius) { cores.push({ x, y, radius, alpha: this.globalAlpha }); },
    fill() {},
  };
  const canvas = { getContext: () => context };
  const motion = eventTarget({ matches: reduced });
  const resolutions = [];
  const window = eventTarget({
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: ratio,
    matchMedia(query) {
      if (query.includes('prefers-reduced-motion')) return motion;
      const media = eventTarget({ media: query });
      resolutions.push(media);
      return media;
    },
  });
  const document = eventTarget({
    hidden: false,
    createElement: () => ({ getContext: () => context }),
  });
  let seed = 824;
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const scope = {
    window, document, Math: math,
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  vm.runInNewContext(source.replace('export function createFireflies', 'function createFireflies'), scope);
  const animation = scope.createFireflies(canvas);
  return {
    canvas, window, document, motion, resolutions, frames, cores, glows, animation,
    get gradients() { return gradients; },
    get clears() { return clears; },
    get transform() { return transform; },
    step(now) {
      assert.equal(frames.size, 1, 'Exactly one animation loop is pending');
      const [id, callback] = [...frames][0];
      frames.delete(id);
      callback(now);
    },
  };
}

test('sharp core and glow diameters stay in CSS pixels at DPR 1, 2, and 3', () => {
  const scenes = [1, 2, 3].map(ratio => createScene(ratio));
  for (const [index, rig] of scenes.entries()) {
    const ratio = index + 1;
    assert.equal(rig.canvas.width, 1440 * ratio);
    assert.equal(rig.canvas.height, 900 * ratio);
    assert.deepEqual(rig.transform, [ratio, 0, 0, ratio, 0, 0]);
    assert.ok(rig.cores.length > 140, 'Most lights have separately drawn sharp centers');
    assert.ok(rig.cores.every(core => core.radius >= 0.625 && core.radius <= 1.05));
    assert.ok(rig.glows.length < 3 * 162, 'Density remains the existing area-based count');
    assert.deepEqual(rig.cores, scenes[0].cores);
    assert.deepEqual(rig.glows, scenes[0].glows);
    rig.animation.dispose();
  }
});

test('resizing and changing display density repaint without extra loops or sprites', () => {
  const rig = createScene(2);
  const gradients = rig.gradients;
  for (const [width, height] of [[390, 844], [900, 900], [1440, 900], [375, 812]]) {
    rig.window.innerWidth = width;
    rig.window.innerHeight = height;
    rig.window.emit('resize');
    assert.equal(rig.canvas.width, width * 2);
    assert.equal(rig.canvas.height, height * 2);
    assert.equal(rig.frames.size, 1);
    assert.ok(rig.cores.length > 20);
  }
  const oldResolution = rig.resolutions.at(-1);
  rig.window.devicePixelRatio = 3;
  oldResolution.emit('change');
  assert.equal(rig.canvas.width, 375 * 3);
  assert.equal(rig.canvas.height, 812 * 3);
  assert.equal(oldResolution.listeners.get('change').size, 0);
  assert.equal(rig.resolutions.at(-1).listeners.get('change').size, 1);
  assert.equal(rig.frames.size, 1);
  assert.equal(rig.gradients, gradients, 'Glow sprites are reused after resizing');
  rig.animation.dispose();
});

test('reduced motion and hidden tabs stop painting and resume a single loop', () => {
  const rig = createScene(3, true);
  assert.equal(rig.frames.size, 0);
  assert.equal(rig.cores.length, 0);
  rig.motion.matches = false;
  rig.motion.emit('change');
  rig.step(1000);
  const beforeHide = structuredClone(rig.cores);
  rig.document.hidden = true;
  rig.document.emit('visibilitychange');
  assert.equal(rig.frames.size, 0);
  rig.document.hidden = false;
  rig.document.emit('visibilitychange');
  rig.step(60000);
  assert.deepEqual(rig.cores, beforeHide, 'Resuming does not jump ahead by hidden time');
  rig.motion.matches = true;
  rig.motion.emit('change');
  rig.window.emit('resize');
  assert.equal(rig.frames.size, 0);
  assert.equal(rig.cores.length, 0, 'Resize does not revive a reduced-motion effect');
  rig.animation.dispose();
});

test('dispose removes every listener and cancels pending work, including repeated cleanup', () => {
  const rig = createScene();
  const pending = [...rig.frames.values()][0];
  rig.animation.dispose();
  const clears = rig.clears;
  rig.animation.dispose();
  pending(1000);
  assert.equal(rig.clears, clears);
  assert.equal(rig.frames.size, 0);
  assert.equal(rig.canvas.width, 0);
  assert.equal(rig.canvas.height, 0);
  for (const target of [rig.window, rig.document, rig.motion, ...rig.resolutions]) {
    for (const listeners of target.listeners.values()) assert.equal(listeners.size, 0);
  }
});

test('painting is capped at 30 fps with cached sprites and slow independent pulses', () => {
  const rig = createScene();
  const gradients = rig.gradients;
  rig.step(0);
  const original = structuredClone(rig.cores);
  const clears = rig.clears;
  for (let frame = 1; frame <= 120; frame++) rig.step(frame * 1000 / 60);
  assert.ok(rig.clears - clears <= 60, 'A 60 Hz display does not paint at full refresh rate');
  assert.ok(rig.clears - clears >= 58);
  assert.equal(rig.gradients, gradients, 'No per-frame gradient allocations');
  assert.ok(rig.cores.every((core, index) => Math.hypot(core.x - original[index].x, core.y - original[index].y) < 22));
  const rising = rig.cores.filter((core, index) => core.alpha > original[index].alpha).length;
  assert.ok(rising > 20 && rising < rig.cores.length - 20, 'Lights pulse out of phase');
  rig.animation.dispose();
});
