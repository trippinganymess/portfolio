// Shared by the dream's flock and the crows visiting the home robot.
export function createCrowModel(THREE) {
  const model = new THREE.Group();
  const feather = new THREE.MeshBasicMaterial({ color: 0x141b2c, side: THREE.DoubleSide });
  const sheen = new THREE.MeshBasicMaterial({ color: 0x28304a, side: THREE.DoubleSide });
  const feet = new THREE.MeshBasicMaterial({ color: 0x393652 });
  function ellipsoid(radius, x, y, z, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    model.add(mesh);
    return mesh;
  }
  function shape(points, material, parent = model) {
    const outline = new THREE.Shape();
    points.forEach(([x, y], i) => i ? outline.lineTo(x, y) : outline.moveTo(x, y));
    outline.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(outline), material);
    parent.add(mesh);
    return mesh;
  }
  ellipsoid(.31, 0, .17, 0, 1.2, .73, .68, feather);
  ellipsoid(.21, -.31, .37, .04, 1, 1, .83, feather);
  shape([[-.45,.43],[-.75,.32],[-.43,.28]], feather).position.z = .05;
  shape([[.15,.19],[.7,-.03],[.66,-.18],[.17,-.05]], feather);
  ellipsoid(.025, -.375, .425, .206, 1, 1, 1, new THREE.MeshBasicMaterial({ color: 0xd5bac7 })).name = 'crow-eye';
  for (const direction of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.name = `crow-wing-${direction}`;
    pivot.position.set(.05, .2, direction * .1);
    shape([[0,0],[.03,.43],[.35,1.02],[.8,1.32],[.75,.97],[.61,.69],[.57,.41],[.35,.11]], direction > 0 ? feather : sheen, pivot).position.z = direction * .06;
    if (direction < 0) pivot.scale.x = -.82;
    model.add(pivot);
  }
  const legs = new THREE.Group();
  legs.name = 'crow-legs';
  for (const points of [[[-.14,.04,.06],[-.16,-.18,.08],[-.3,-.2,.08]], [[.09,.03,.13],[.12,-.18,.14],[-.01,-.2,.14]]]) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    legs.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .018, 5, false), feet));
  }
  model.add(legs);
  return model;
}

export function poseCrowWings(THREE, wings, elapsed, speed, phase, fold) {
  const flap = Math.sin(elapsed * speed + phase);
  for (const { pivot, direction } of wings) {
    pivot.rotation.x = THREE.MathUtils.lerp(direction * flap * .82, direction * 1.42, fold);
    pivot.rotation.z = THREE.MathUtils.lerp(direction * flap * .7, direction * -1, fold);
    pivot.scale.y = 1 - fold * .53;
  }
}
