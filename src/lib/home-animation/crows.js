import * as THREE from 'three';
import { createCrowModel, poseCrowWings } from '../../../public/lib/crow-model.js';

const phases = [
  { name: 'circling', duration: 5 },
  { name: 'landing', duration: 4 },
  { name: 'perched', duration: 2 },
  { name: 'startled', duration: 4 },
  { name: 'away', duration: 3 },
];

export function createRobotCrows({ scene, robot, onPhaseChange }) {
  const root = new THREE.Group();
  root.name = 'Robot visiting crows';
  scene.add(root);
  const template = createCrowModel(THREE);
  // Home uses the older Three renderer, which requires explicit conversion
  // to keep the dream's dark feather colors under its sRGB output.
  const crowMaterials = new Set();
  template.traverse(object => { if (object.material) crowMaterials.add(object.material); });
  for (const material of crowMaterials) {
    material.color.convertSRGBToLinear();
    material.toneMapped = false;
  }
  const slots = [
    { parent: robot.userData.headGroup, position: [8, 34, 12] },
    { parent: robot.userData.upperBodyGroup, position: [-7, 74, 15] },
  ];
  const birds = slots.map((slot, index) => {
    const perch = new THREE.Object3D();
    perch.position.set(...slot.position);
    slot.parent.add(perch);
    const model = template.clone(true);
    model.name = `Home crow ${index + 1}`;
    root.add(model);
    return {
      model, perch, index, size: 23 - index * 2,
      start: new THREE.Vector3(), target: new THREE.Vector3(), orbit: new THREE.Vector3(),
      previous: new THREE.Vector3(), exit: new THREE.Vector3(),
      legs: model.getObjectByName('crow-legs'),
      wings: [1, -1].map(direction => ({ direction, pivot: model.getObjectByName(`crow-wing-${direction}`) })),
    };
  });
  let phaseIndex = 0;
  let phaseTime = 0;
  let initialized = false;
  let disposed = false;
  onPhaseChange?.(phases[phaseIndex].name);

  function advance(delta) {
    if (disposed) return { roll: 0, yaw: 0 };
    phaseTime += delta;
    while (phaseTime >= phases[phaseIndex].duration) {
      phaseTime -= phases[phaseIndex].duration;
      phaseIndex = (phaseIndex + 1) % phases.length;
      for (const bird of birds) bird.start.copy(bird.model.position);
      onPhaseChange?.(phases[phaseIndex].name);
    }
    // The first head shake starts the takeoff. Its envelope returns the head
    // to its idle pose without a jump when the flock leaves.
    const reaction = phases[phaseIndex].name === 'startled'
      ? Math.sin(Math.PI * Math.min(phaseTime / 1.1, 1)) : 0;
    return {
      roll: Math.sin(phaseTime * 19) * .28 * reaction,
      yaw: Math.sin(phaseTime * 12) * .34 * reaction,
    };
  }

  function update(elapsed, bounds, scale) {
    if (disposed) return;
    robot.updateMatrixWorld(true);
    const phase = phases[phaseIndex].name;
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    for (const bird of birds) {
      const size = bird.size * scale;
      bird.perch.getWorldPosition(bird.target);
      bird.target.y += .2 * size;
      bird.target.z += 8;
      if (!initialized) {
        bird.start.set(-halfWidth - 70 - bird.index * 70, halfHeight * .1, 145);
        bird.model.position.copy(bird.start);
      }
      bird.previous.copy(bird.model.position);
      bird.model.visible = phase !== 'away';
      let fold = 0;
      if (phase === 'circling') {
        const angle = elapsed * .8 + bird.index * 2.5;
        bird.orbit.set(
          Math.sin(angle) * bounds.width * .34,
          Math.min(halfHeight - 150, halfHeight * .12 + Math.cos(angle * 1.4) * bounds.height * .12),
          145 + Math.sin(angle) * 15,
        );
        bird.model.position.copy(bird.start).lerp(bird.orbit, THREE.MathUtils.smoothstep(phaseTime, 0, 1.4));
      } else if (phase === 'landing') {
        const progress = THREE.MathUtils.clamp((phaseTime - bird.index * .3) / (4 - bird.index * .3), 0, 1);
        const eased = THREE.MathUtils.smoothstep(progress, 0, 1);
        bird.model.position.copy(bird.start).lerp(bird.target, eased);
        bird.model.position.y += Math.sin(Math.PI * progress) * Math.min(90, bounds.height * .12);
        fold = THREE.MathUtils.smoothstep(progress, .8, 1);
      } else if (phase === 'perched') {
        bird.model.position.copy(bird.target);
        fold = 1;
      } else if (phase === 'startled') {
        const delay = .16 + bird.index * .12;
        const progress = THREE.MathUtils.clamp((phaseTime - delay) / (4 - delay), 0, 1);
        if (phaseTime <= delay) {
          // Keep feet attached to the moving head until the bird pushes off.
          bird.start.copy(bird.target);
          bird.model.position.copy(bird.target);
        } else {
          bird.exit.set((bird.index ? 1 : -1) * (halfWidth + 90), halfHeight + 90, 145);
          bird.model.position.copy(bird.start).lerp(bird.exit, progress);
          bird.model.position.y += Math.sin(progress * Math.PI) * 110 * scale;
        }
        fold = 1 - THREE.MathUtils.smoothstep(progress, 0, .12);
      }
      const dx = bird.model.position.x - bird.previous.x;
      const facing = fold > .99 ? (bird.index ? -1 : 1)
        : Math.abs(dx) > .05 ? (dx > 0 ? -1 : 1) : (bird.index ? -1 : 1);
      bird.model.scale.set(facing * size, size, size);
      bird.model.rotation.z = fold > .99 ? 0 : Math.sin(elapsed * 2 + bird.index) * .08;
      bird.legs.visible = fold > .55;
      poseCrowWings(THREE, bird.wings, elapsed, 12 + bird.index, bird.index * 2, fold);
    }
    initialized = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent?.();
    scene.remove(root);
    for (const bird of birds) bird.perch.parent?.remove(bird.perch);
    const geometries = new Set();
    const materials = new Set();
    template.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  return { advance, update, dispose };
}
