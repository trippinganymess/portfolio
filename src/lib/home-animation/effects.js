import * as THREE from 'three';

function radialTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function noteTexture(symbol) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.font = 'bold 42px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(125, 249, 255, 0.85)';
  context.shadowBlur = 8;
  context.fillStyle = '#e0f2fe';
  context.fillText(symbol, 32, 34);
  return new THREE.CanvasTexture(canvas);
}

function jaggedPath(start, end, segments, sway) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const normal = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
  const points = [];
  let displacement = 0;
  for (let index = 0; index <= segments; index++) {
    const progress = index / segments;
    const point = new THREE.Vector3().lerpVectors(start, end, progress);
    if (index > 0 && index < segments) {
      displacement = displacement * 0.65 + (Math.random() - 0.5) * sway;
      point.addScaledVector(normal, displacement * Math.sin(progress * Math.PI));
    }
    points.push(point);
  }
  return points;
}

function strikePaths(start, target) {
  const distance = start.distanceTo(target);
  const mainPoints = jaggedPath(start, target, 70, Math.min(70, distance * 0.07));
  const branches = [];
  for (let index = 0; index < 3; index++) {
    const origin = mainPoints[Math.floor(12 + index * 14 + Math.random() * 6)].clone();
    const end = origin.clone().add(new THREE.Vector3(
      (Math.random() - 0.2) * 180,
      (Math.random() - 0.7) * 160,
      0,
    ));
    branches.push(jaggedPath(origin, end, 18, 45));
  }
  return { mainPoints, branches };
}

// Screen-facing ribbons retain the hard, irregular bends of an electric arc.
function arcRibbon(points, width) {
  const vertices = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const taper = 1 - i / points.length * 0.65;
    const nx = -(b.y - a.y) / length * width * taper;
    const ny = (b.x - a.x) / length * width * taper;
    vertices.push(a.x - nx, a.y - ny, a.z, b.x - nx, b.y - ny, b.z, a.x + nx, a.y + ny, a.z);
    vertices.push(a.x + nx, a.y + ny, a.z, b.x - nx, b.y - ny, b.z, b.x + nx, b.y + ny, b.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function buildArc(group, points, width = 1) {
  for (const [radius, color, opacity] of [[8, 0x749cff, 0.055], [3, 0x9ccfff, 0.18], [0.85, 0xc9e6ff, 0.8], [0.3, 0xffffff, 1]]) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    material.userData.peakOpacity = opacity;
    group.add(new THREE.Mesh(arcRibbon(points, radius * width), material));
  }
}

function disposeObjects(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry && !object.isSprite) geometries.add(object.geometry);
    if (object.material) {
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      entries.forEach((material) => materials.add(material));
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  root.parent?.remove(root);
}

export function createEffects(scene) {
  const root = new THREE.Group();
  const scorchGroup = new THREE.Group();
  const boltGroup = new THREE.Group();
  const particleGroup = new THREE.Group();
  const arcGroup = new THREE.Group();
  root.add(scorchGroup, boltGroup, particleGroup, arcGroup);
  scene.add(root);

  const scorchTexture = radialTexture([
    [0, 'rgba(2, 3, 8, 0.86)'],
    [0.35, 'rgba(8, 10, 22, 0.56)'],
    [0.7, 'rgba(15, 18, 38, 0.18)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  const sparkTexture = radialTexture([
    [0, 'rgba(255, 255, 255, 1)'],
    [0.2, 'rgba(255, 255, 255, 0.85)'],
    [0.5, 'rgba(255, 255, 255, 0.2)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  const exhaustTexture = radialTexture([
    [0, 'rgba(217, 243, 255, 0.7)'],
    [0.4, 'rgba(130, 188, 255, 0.22)'],
    [1, 'rgba(30, 30, 40, 0)'],
  ]);
  const noteTextures = [noteTexture('♪'), noteTexture('♫')];
  const textures = [scorchTexture, sparkTexture, exhaustTexture, ...noteTextures];
  const particleSystems = [];
  const notes = [];
  const scorchMaterials = [];
  const arcs = [];
  const hotSparks = [];
  const sparkLimit = 320;
  const trailPositions = new THREE.Float32BufferAttribute(new Float32Array(sparkLimit * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const trailColors = new THREE.Float32BufferAttribute(new Float32Array(sparkLimit * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const tipPositions = new THREE.Float32BufferAttribute(new Float32Array(sparkLimit * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const tipColors = new THREE.Float32BufferAttribute(new Float32Array(sparkLimit * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', trailPositions);
  trailGeometry.setAttribute('color', trailColors);
  trailGeometry.setDrawRange(0, 0);
  const tipGeometry = new THREE.BufferGeometry();
  tipGeometry.setAttribute('position', tipPositions);
  tipGeometry.setAttribute('color', tipColors);
  tipGeometry.setDrawRange(0, 0);
  const trails = new THREE.LineSegments(trailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const tips = new THREE.Points(tipGeometry, new THREE.PointsMaterial({ map: sparkTexture, size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  trails.frustumCulled = tips.frustumCulled = false;
  root.add(trails, tips);
  let boltAge = null;
  let disposed = false;

  function clearGroup(group) {
    [...group.children].forEach(disposeObjects);
  }

  function createScorch(mainPoints, branches, target) {
    const positions = [];
    function trace(points, steps, scatter, depth) {
      for (let index = 0; index < points.length - 1; index++) {
        for (let step = 0; step < steps; step++) {
          const point = new THREE.Vector3().lerpVectors(points[index], points[index + 1], step / steps);
          positions.push(
            point.x + (Math.random() - 0.5) * scatter,
            point.y + (Math.random() - 0.5) * scatter,
            depth,
          );
        }
      }
    }
    function smudge(origin, count, radius) {
      for (let index = 0; index < count; index++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        positions.push(origin.x + Math.cos(angle) * distance, origin.y + Math.sin(angle) * distance, -19);
      }
    }
    trace(mainPoints, 2, 4, -20);
    branches.forEach((points) => trace(points, 1, 3, -22));
    smudge(mainPoints[0], 8, 20);
    smudge(target, 12, 24);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: scorchTexture,
      size: 18,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    scorchGroup.add(new THREE.Points(geometry, material));
    scorchMaterials.push({ material, opacity: 0.2, age: 0 });

    const lineGeometry = arcRibbon(mainPoints, 0.6);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x05060d, transparent: true, opacity: 0 });
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.position.z = -15;
    scorchGroup.add(line);
    scorchMaterials.push({ material: lineMaterial, opacity: 0.12, age: 0 });
  }

  function createStrike(start, target) {
    if (disposed) return;
    clearGroup(boltGroup);
    const { mainPoints, branches } = strikePaths(start, target);
    createScorch(mainPoints, branches, target);

    buildArc(boltGroup, mainPoints, 1.5);
    branches.forEach((points) => buildArc(boltGroup, points, 0.65));
    boltAge = 0;
    sparks(target, 44, 0xd9ebff, 230);
    sparks(target, 17, 0xffc77a, 150);
    shortCircuit(target, 1.7);
  }

  function resizeStrike(start, target) {
    if (disposed) return;
    clearGroup(scorchGroup);
    clearGroup(boltGroup);
    scorchMaterials.length = 0;
    boltAge = null;
    const { mainPoints, branches } = strikePaths(start, target);
    createScorch(mainPoints, branches, target);
    scorchMaterials.forEach((scorch) => {
      scorch.age = 0.18;
      scorch.material.opacity = scorch.opacity;
    });
  }

  function addParticles(positions, velocities, options, life, decay) {
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);
    const material = new THREE.PointsMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...options,
    });
    const points = new THREE.Points(geometry, material);
    particleGroup.add(points);
    particleSystems.push({ points, velocities, life, decay });
  }

  function sparks(origin, count = 25, color = 0xd7ebff, speed = 150) {
    if (disposed) return;
    const tint = new THREE.Color(color);
    for (let index = 0; index < count; index++) {
      if (hotSparks.length >= sparkLimit) break;
      const angle = Math.random() * Math.PI * 2;
      const magnitude = (0.25 + Math.random() * 0.9) * speed;
      hotSparks.push({
        x: origin.x + (Math.random() - 0.5) * 3, y: origin.y + (Math.random() - 0.5) * 3, z: Math.max(105, origin.z),
        vx: Math.cos(angle) * magnitude, vy: Math.sin(angle) * magnitude + 20,
        age: 0, lifetime: 0.16 + Math.random() * 0.42, tail: 0.018 + Math.random() * 0.025,
        r: tint.r, g: tint.g, b: tint.b,
      });
    }
  }

  function shortCircuit(origin, strength = 1) {
    if (disposed) return;
    const discharge = new THREE.Group();
    const start = origin.clone();
    start.z = Math.max(106, start.z);
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = (14 + Math.random() * 27) * strength;
      const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * distance, Math.sin(angle) * distance, 0));
      const points = jaggedPath(start, end, 10, 12 * strength);
      buildArc(discharge, points, 0.65);
      const branchStart = points[4];
      const branchEnd = branchStart.clone().add(new THREE.Vector3(Math.cos(angle + 0.8) * distance * 0.45, Math.sin(angle + 0.8) * distance * 0.45, 0));
      buildArc(discharge, jaggedPath(branchStart, branchEnd, 5, 7), 0.28);
    }
    arcGroup.add(discharge);
    arcs.push({ group: discharge, age: 0, lifetime: 0.09 + Math.random() * 0.09 });
    sparks(start, Math.round(7 * strength), 0xd7e7ff, 130 * strength);
  }

  function exhaust(origin, scale = 1) {
    if (disposed) return;
    const positions = new Float32Array(12);
    const velocities = [];
    for (let index = 0; index < 4; index++) {
      positions.set([
        origin.x + (Math.random() - 0.5) * 4 * scale,
        origin.y + (Math.random() - 0.5) * 2 * scale,
        origin.z,
      ], index * 3);
      velocities.push({ x: (Math.random() - 0.5) * 35 * scale, y: (-75 - Math.random() * 50) * scale, gravity: -20 });
    }
    addParticles(positions, velocities, { map: exhaustTexture, size: 10 * scale, opacity: 0.5, toneMapped: false }, 0.5, 2.1);
  }

  function musicNote(origin, scale = 1) {
    if (disposed) return;
    const material = new THREE.SpriteMaterial({ map: noteTextures[Math.random() > 0.5 ? 0 : 1], transparent: true, opacity: 0.5 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(11 * scale, 11 * scale, 1);
    sprite.position.set(
      origin.x + (-14 + (Math.random() - 0.5) * 14) * scale,
      origin.y + (106 + (Math.random() - 0.5) * 8) * scale,
      110,
    );
    particleGroup.add(sprite);
    notes.push({
      sprite,
      x: (-12 + (Math.random() - 0.5) * 14) * scale,
      y: (28 + Math.random() * 14) * scale,
      scale,
      phase: Math.random() * Math.PI * 2,
      life: 1,
    });
  }

  function update(delta, elapsed) {
    if (disposed) return;
    const step = Math.min(Math.max(delta, 0), 0.1);
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      arc.age += step;
      if (arc.age >= arc.lifetime) {
        disposeObjects(arc.group);
        arcs.splice(i, 1);
      } else {
        const flicker = arc.age > 0.035 && arc.age < 0.055 ? 0.12 : 1;
        const fade = (1 - arc.age / arc.lifetime) * flicker;
        arc.group.children.forEach(({ material }) => { material.opacity = material.userData.peakOpacity * fade; });
      }
    }
    for (let i = hotSparks.length - 1; i >= 0; i--) {
      const spark = hotSparks[i];
      spark.age += step;
      if (spark.age >= spark.lifetime) { hotSparks.splice(i, 1); continue; }
      spark.x += spark.vx * step;
      spark.y += spark.vy * step;
      spark.vx *= Math.exp(-step * 1.3);
      spark.vy -= 320 * step;
    }
    hotSparks.forEach((spark, i) => {
      const fade = (1 - spark.age / spark.lifetime) ** 1.2;
      const tail = Math.min(spark.age, spark.tail);
      trailPositions.setXYZ(i * 2, spark.x - spark.vx * tail, spark.y - spark.vy * tail, spark.z);
      trailPositions.setXYZ(i * 2 + 1, spark.x, spark.y, spark.z);
      trailColors.setXYZ(i * 2, spark.r * fade * 0.2, spark.g * fade * 0.14, spark.b * fade * 0.1);
      trailColors.setXYZ(i * 2 + 1, spark.r * fade, spark.g * fade, spark.b * fade);
      tipPositions.setXYZ(i, spark.x, spark.y, spark.z);
      tipColors.setXYZ(i, fade, fade * (0.75 + spark.g * 0.25), fade * (0.7 + spark.b * 0.3));
    });
    for (const attribute of [trailPositions, trailColors, tipPositions, tipColors]) attribute.needsUpdate = true;
    trailGeometry.setDrawRange(0, hotSparks.length * 2);
    tipGeometry.setDrawRange(0, hotSparks.length);
    if (boltAge !== null) {
      boltAge += step;
      if (boltAge >= 0.32) {
        clearGroup(boltGroup);
        boltAge = null;
      } else {
        const flicker = boltAge < 0.035 ? 1 : boltAge < 0.075 ? 0.1 : boltAge < 0.12 ? 0.8 : boltAge < 0.17 ? 0 : 0.45;
        const fade = Math.min(1, (0.32 - boltAge) / 0.1);
        boltGroup.children.forEach(({ material }) => {
          material.opacity = material.userData.peakOpacity * flicker * fade;
        });
      }
    }
    for (const scorch of scorchMaterials) {
      if (scorch.age >= 0.18) continue;
      scorch.age = Math.min(0.18, scorch.age + step);
      const progress = scorch.age / 0.18;
      scorch.material.opacity = scorch.opacity * (1 - (1 - progress) ** 2);
    }
    for (let index = notes.length - 1; index >= 0; index--) {
      const note = notes[index];
      note.life -= step * 0.65;
      if (note.life <= 0) {
        disposeObjects(note.sprite);
        notes.splice(index, 1);
        continue;
      }
      note.sprite.position.x += (note.x + Math.sin(elapsed * 4 + note.phase) * 12 * note.scale) * step;
      note.sprite.position.y += note.y * step;
      note.sprite.material.opacity = Math.min(0.5, note.life * 0.65);
    }
    for (let index = particleSystems.length - 1; index >= 0; index--) {
      const system = particleSystems[index];
      system.life -= step * system.decay;
      if (system.life <= 0) {
        disposeObjects(system.points);
        particleSystems.splice(index, 1);
        continue;
      }
      system.points.material.opacity = Math.max(0, system.life);
      const attribute = system.points.geometry.attributes.position;
      system.velocities.forEach((velocity, particle) => {
        attribute.array[particle * 3] += velocity.x * step;
        attribute.array[particle * 3 + 1] += velocity.y * step;
        velocity.y -= velocity.gravity * step;
      });
      attribute.needsUpdate = true;
    }
  }

  function clear() {
    clearGroup(scorchGroup);
    clearGroup(boltGroup);
    clearGroup(particleGroup);
    clearGroup(arcGroup);
    hotSparks.length = 0;
    arcs.length = 0;
    trailGeometry.setDrawRange(0, 0);
    tipGeometry.setDrawRange(0, 0);
    particleSystems.length = 0;
    notes.length = 0;
    scorchMaterials.length = 0;
    boltAge = null;
  }

  function dispose() {
    if (disposed) return;
    clear();
    disposeObjects(trails);
    disposeObjects(tips);
    textures.forEach((texture) => texture?.dispose());
    root.parent?.remove(root);
    disposed = true;
  }

  return { createStrike, resizeStrike, update, sparks, shortCircuit, exhaust, musicNote, clear, dispose };
}
