import * as THREE from 'three';

function roundedDeck(width, depth, thickness, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: 1.1, bevelThickness: 0.8, bevelSegments: 2, curveSegments: 8, steps: 1 });
}

export function createLandingStation() {
  const station = new THREE.Group();
  const deck = new THREE.Group();
  station.add(deck);
  const shell = new THREE.MeshStandardMaterial({ color: 0x969da5, metalness: 0.78, roughness: 0.34, envMapIntensity: 0.65 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc3c7ca, metalness: 0.8, roughness: 0.26 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x262d39, metalness: 0.6, roughness: 0.47 });
  const indicator = new THREE.MeshStandardMaterial({ color: 0xaad9ed, emissive: 0x72bcdf, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.4 });
  for (const material of [shell, rim, dark, indicator]) material.color.convertSRGBToLinear();

  function mesh(parent, geometry, material, position) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  const underDeck = mesh(deck, roundedDeck(228, 70, 6, 10), dark, [0, -6, 0]);
  const topDeck = mesh(deck, roundedDeck(230, 72, 5, 10), shell, [0, 0, 0]);
  underDeck.rotation.x = topDeck.rotation.x = -1.2;

  // Recessed concentric docking rings and small flush landing lights.
  const landingSurface = new THREE.Group();
  landingSurface.rotation.x = -1.2;
  landingSurface.position.y = 5;
  deck.add(landingSurface);
  const landingRings = new THREE.Group();
  landingSurface.add(landingRings);
  for (const radius of [36, 44, 48]) {
    const ring = mesh(landingRings, new THREE.TorusGeometry(radius, radius === 44 ? 0.7 : 0.4, 6, 80), radius === 44 ? rim : dark, [0, 0, 1]);
    ring.scale.y = 0.6;
  }
  for (const x of [-88, -62, 49, 75, 101]) {
    mesh(landingSurface, new THREE.BoxGeometry(7, 1.4, 0.8), indicator, [x, -24, 1]);
    mesh(landingSurface, new THREE.CylinderGeometry(1.4, 1.4, 1, 10).rotateX(Math.PI / 2), dark, [x, 25, 1]);
  }
  mesh(deck, new THREE.BoxGeometry(206, 2.4, 2.5), rim, [2, -11, 32]);
  for (let i = 0; i < 9; i++) mesh(deck, new THREE.BoxGeometry(6, 2, 1), dark, [-78 + i * 11, -15, 32]);
  const launchHousing = mesh(deck, roundedDeck(82, 32, 5, 4), rim, [0, -14, 38]);

  // The cantilever is attached to the page edge, including on narrow screens.
  const column = mesh(station, new THREE.BoxGeometry(18, 1, 35), shell, [111, 0, -2]);
  const columnInset = mesh(station, new THREE.BoxGeometry(4, 1, 1), dark, [103, 0, 17]);
  const bracket = mesh(station, new THREE.BoxGeometry(96, 7, 25), dark, [65, 0, 0]);
  bracket.rotation.z = 0.31;
  const foot = mesh(station, new THREE.BoxGeometry(28, 9, 42), rim, [112, 0, 0]);
  const dockLight = new THREE.PointLight(0x92d6ff, 0.7, 145, 2);
  dockLight.position.set(-22, 19, 26);
  deck.add(dockLight);

  station.userData.resize = (width, height, contactX) => {
    station.scale.x = width / 220;
    landingRings.position.x = contactX / station.scale.x;
    launchHousing.position.x = (width / 2 - 51) / station.scale.x;
    launchHousing.scale.x = 1 / station.scale.x;
    dockLight.position.x = landingRings.position.x;
    deck.position.y = height - 14;
    column.scale.y = height + 10;
    column.position.y = height / 2 - 5;
    columnInset.scale.y = height - 10;
    columnInset.position.y = height / 2 - 5;
    bracket.position.y = height - 31;
    foot.position.y = -2;
  };
  station.userData.update = (elapsed, travel) => {
    indicator.emissiveIntensity = 0.48 + Math.sin(elapsed * 1.5) * 0.08 + travel * 0.35;
    dockLight.intensity = 0.6 + travel * 0.5;
  };
  return station;
}
