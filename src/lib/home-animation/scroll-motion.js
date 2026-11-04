const IDLE_DELAY_MS = 180;

export function createScrollMotion(initialPosition, initialTime) {
  let position = initialPosition;
  let time = initialTime;
  let lastMovement = -Infinity;
  let direction = 1;
  let speed = 0;

  function record(nextPosition, now) {
    const distance = nextPosition - position;
    if (Math.abs(distance) > 0.01) {
      lastMovement = now;
      direction = Math.sign(distance);
      speed = Math.max(-3, Math.min(3, distance / Math.max(now - time, 16)));
    }
    position = nextPosition;
    time = now;
  }

  function read(now) {
    const scrolling = now - lastMovement < IDLE_DELAY_MS;
    return { scrolling, direction, speed: scrolling ? speed : 0 };
  }

  return { record, read };
}
