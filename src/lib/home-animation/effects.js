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
  const particleGroup = new THREE.Group();
  root.add(particleGroup);
  scene.add(root);

  const sparkTexture = radialTexture([
    [0, 'rgba(255, 255, 255, 1)'],
    [0.2, 'rgba(255, 255, 255, 0.85)'],
    [0.5, 'rgba(255, 255, 255, 0.2)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  const noteTextures = [noteTexture('♪'), noteTexture('♫')];
  const textures = [sparkTexture, ...noteTextures];
  const notes = [];
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
  let disposed = false;

  function clearGroup(group) {
    [...group.children].forEach(disposeObjects);
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
  }

  function clear() {
    clearGroup(particleGroup);
    hotSparks.length = 0;
    trailGeometry.setDrawRange(0, 0);
    tipGeometry.setDrawRange(0, 0);
    notes.length = 0;
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

  return { update, sparks, musicNote, dispose };
}
