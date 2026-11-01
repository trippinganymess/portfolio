import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from '../public/games/kill-a-spirit/vendor/three/build/three.module.js';

const source = readFileSync(new URL('../public/games/kill-a-spirit/scenery.js', import.meta.url), 'utf8');

function createScene(width = 1440, height = 900) {
  // Only texture painting is stubbed; geometry, transforms, and flight logic
  // use the real Three.js build shipped with the game.
  const context2d = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (object, key) => object[key] ?? (() => {}) });
  const window = { innerWidth: width, innerHeight: height };
  let seed = 824;
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  vm.runInNewContext(source, {
    window, Math: math,
    document: { createElement: () => ({ getContext: () => context2d }) },
  });
  const scene = new THREE.Scene();
  const calls = [];
  const scenery = window.createDreamScenery(THREE, scene, {
    onCrowFlightChange: flying => calls.push(flying),
  });
  let elapsed = 0;
  function step(dt, started = true, wind = 0.8) {
    elapsed += dt;
    scenery.update(dt, elapsed, wind, started);
    const state = scenery.getCrowFlockState();
    assert.equal(calls.at(-1) ?? false, state.flying > 0, 'Audio tracks the entire airborne flock');
    return state;
  }
  function advance(seconds, started = true) {
    let remaining = seconds;
    while (remaining > 1e-8) {
      const dt = Math.min(0.1, remaining);
      step(dt, started);
      remaining -= dt;
    }
    return scenery.getCrowFlockState();
  }
  step(0, false);
  return { scene, scenery, window, calls, step, advance, state: () => scenery.getCrowFlockState() };
}

function assertOutsideViewport(position, window) {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 200);
  camera.position.set(0, 0.3, aspect < 0.8 ? 31 : 19.5);
  camera.lookAt(0, -0.35, -8);
  camera.updateMatrixWorld(true);
  const ndc = new THREE.Vector3(...position).project(camera);
  assert.ok(Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1, 'Crow starts beyond the screen edge');
}

function assertPerches(rig) {
  rig.scene.updateMatrixWorld(true);
  const reserved = rig.state().birds.filter(bird => bird.perchId !== null);
  assert.equal(new Set(reserved.map(bird => bird.perchId)).size, reserved.length, 'Each crow reserves its own branch');
  for (const bird of reserved.filter(bird => bird.state === 'perched')) {
    const model = rig.scene.getObjectByName(`Crow ${bird.id}`);
    const perch = rig.scene.getObjectByName(`Crow perch ${bird.perchId}`);
    const foot = model.localToWorld(new THREE.Vector3(0, -0.2, 0));
    const branch = perch.getWorldPosition(new THREE.Vector3());
    assert.ok(foot.distanceTo(branch) < 0.025, 'Resting feet stay on the swaying branch');
  }
}

test('game time schedules varied flocks every 12 seconds, starting outside the screen', () => {
  const rig = createScene();
  rig.advance(60, false);
  assert.equal(rig.state().total, 0, 'Preview time must not spawn crows');
  assert.equal(rig.advance(11.9).waves, 0);
  const sizes = new Set();
  for (let wave = 1; wave <= 7; wave++) {
    rig.advance(0.1);
    const state = rig.state();
    assert.equal(state.waves, wave);
    assert.equal(state.nextArrivalAt, (wave + 1) * 12);
    sizes.add(state.lastWaveSize);
    const arrivals = state.birds.filter(bird => bird.scheduledAt === wave * 12);
    assert.equal(arrivals.length, state.lastWaveSize);
    for (const bird of arrivals) assertOutsideViewport(bird.startPosition, rig.window);
    // Staggered flights can outlast the interval and overlap the next wave.
    rig.advance(11.9);
    assertPerches(rig);
  }
  assert.deepEqual([...sizes].sort(), [1, 2, 3]);
  assert.deepEqual([...new Set(rig.state().birds.map(bird => bird.treeIndex))].sort(), [0, 1]);
});

test('offscreen entrances and settled crows work through portrait and desktop resizing', () => {
  const rig = createScene(390, 844);
  rig.advance(12);
  for (const bird of rig.state().birds) assertOutsideViewport(bird.startPosition, rig.window);
  rig.advance(15);
  assert.ok(rig.state().birds.some(bird => bird.state === 'perched'));
  assertPerches(rig);
  for (const [width, height] of [[900, 900], [1440, 900], [390, 844]]) {
    rig.window.innerWidth = width;
    rig.window.innerHeight = height;
    rig.step(0);
    assertPerches(rig);
  }
});

test('arrivals continue after branches fill without growing the model pool indefinitely', () => {
  const rig = createScene();
  let previousWaves = 0;
  let departures = 0;
  let overlappingWaves = 0;
  for (let frame = 0; frame < 4800; frame++) {
    const state = rig.step(0.1);
    assert.ok(state.poolSize <= state.poolLimit);
    assert.ok(state.perched <= state.perchCapacity);
    if (state.birds.some(bird => bird.state === 'departing')) departures++;
    if (state.waves !== previousWaves) {
      assert.equal(state.waves, previousWaves + 1);
      assert.equal(state.birds.filter(bird => bird.scheduledAt === state.waves * 12).length, state.lastWaveSize);
      if (state.birds.some(bird => bird.state === 'incoming' && bird.scheduledAt < state.waves * 12)) {
        overlappingWaves++;
        assert.equal(rig.calls.at(-1), true, 'Crow audio continues across overlapping arrival waves');
      }
      previousWaves = state.waves;
    }
    assertPerches(rig);
  }
  assert.equal(rig.state().waves, 40);
  assert.ok(departures > 0, 'Older birds leave to allow continuous arrivals');
  assert.ok(overlappingWaves > 0, 'Longer flights overlap later arrivals');
});

test('shatter ripples startle resting crows, which return to their reserved branches', () => {
  const rig = createScene();
  rig.advance(35);
  const original = rig.state().birds.filter(bird => bird.state === 'perched')
    .map(bird => ({ id: bird.id, perchId: bird.perchId }));
  assert.ok(original.length > 0);
  const flyingBefore = rig.state().flying;
  rig.scenery.reactToShatter(new THREE.Vector3(0, 1, 0));
  assert.equal(rig.state().flying, flyingBefore, 'Resting crows wait for the ripple while incoming flights continue');
  assert.equal(rig.state().pendingStartles, original.length);
  rig.advance(1.4);
  for (const bird of original) {
    assert.equal(rig.state().birds.find(entry => entry.id === bird.id).state, 'startled');
  }
  for (let i = 0; i < 3; i++) {
    rig.scenery.reactToShatter(new THREE.Vector3(1, 0, 0));
    rig.advance(0.2);
  }
  rig.window.innerWidth = 390;
  rig.window.innerHeight = 844;
  rig.advance(6);
  for (const bird of original) {
    const returned = rig.state().birds.find(entry => entry.id === bird.id);
    assert.equal(returned.state, 'perched', 'Repeated shatters do not trap a crow in flight');
    assert.equal(returned.perchId, bird.perchId);
  }
  assertPerches(rig);
  assert.equal(rig.state().waves, 3, 'Regular flock arrivals continue during the reaction');
  assert.ok(rig.state().birds.some(bird => bird.scheduledAt === 36 && bird.state === 'incoming'));
  assert.equal(rig.calls.at(-1), true, 'Arrival audio continues after the startled crows return');
});
