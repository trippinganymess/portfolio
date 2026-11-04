import assert from 'node:assert/strict';
import test from 'node:test';
import { createScrollMotion } from '../src/lib/home-animation/scroll-motion.js';

test('the robot starts idle even when the page opens at a restored scroll position', () => {
  const motion = createScrollMotion(640, 1000);
  assert.deepEqual(motion.read(1000), { scrolling: false, direction: 1, speed: 0 });
});

test('scrolling stays active between events and settles after a short pause', () => {
  const motion = createScrollMotion(0, 1000);
  motion.record(44, 1016);
  assert.deepEqual(motion.read(1016), { scrolling: true, direction: 1, speed: 2.75 });
  assert.equal(motion.read(1195).scrolling, true);
  assert.deepEqual(motion.read(1196), { scrolling: false, direction: 1, speed: 0 });
});

test('movement resumes in either direction after repeated pauses', () => {
  const motion = createScrollMotion(100, 0);
  motion.record(140, 20);
  assert.equal(motion.read(20).direction, 1);
  assert.equal(motion.read(200).scrolling, false);
  motion.record(120, 220);
  assert.equal(motion.read(220).direction, -1);
  assert.ok(motion.read(220).speed < 0);
  assert.equal(motion.read(400).scrolling, false);
  motion.record(180, 420);
  assert.equal(motion.read(420).direction, 1);
  assert.equal(motion.read(420).scrolling, true);
});

test('events with no movement and subpixel jitter do not postpone hovering', () => {
  const motion = createScrollMotion(0, 0);
  motion.record(100, 100);
  motion.record(100, 200);
  motion.record(100.005, 250);
  assert.equal(motion.read(279).scrolling, true);
  assert.equal(motion.read(280).scrolling, false);
  assert.equal(motion.read(280).speed, 0);
});
