import * as THREE from 'three';

// Profiles follow the supplied drawing, including its single foot and bent arm.
const UNIT = 0.21;
const ORIGIN = [280, 680];
export const ROBOT_HEIGHT = 206;

function shapeFromPath(path, pivot) {
  const tokens = path.match(/[MLCQZ]|-?\d*\.?\d+/g);
  const shape = new THREE.Shape();
  let index = 0;
  const point = () => [(Number(tokens[index++]) - pivot[0]) * UNIT, (pivot[1] - Number(tokens[index++])) * UNIT];
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === 'M') shape.moveTo(...point());
    if (command === 'L') shape.lineTo(...point());
    if (command === 'C') shape.bezierCurveTo(...point(), ...point(), ...point());
    if (command === 'Q') shape.quadraticCurveTo(...point(), ...point());
    if (command === 'Z') shape.closePath();
  }
  return shape;
}

export function createSketchRobot() {
  const robotRoot = new THREE.Group();
  robotRoot.userData.pivot = ORIGIN;
  const grain = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < grain.length; i += 4) {
    const value = 190 + Math.floor(Math.random() * 38);
    grain.set([value, value, value, 255], i);
  }
  const metalGrain = new THREE.DataTexture(grain, 64, 64, THREE.RGBAFormat);
  metalGrain.wrapS = metalGrain.wrapT = THREE.RepeatWrapping;
  metalGrain.repeat.set(3, 3);
  metalGrain.needsUpdate = true;

  const armor = new THREE.MeshStandardMaterial({ color: 0xe9e7df, metalness: 0.48, roughness: 0.4, roughnessMap: metalGrain, envMapIntensity: 0.7 });
  const edgeMetal = new THREE.MeshStandardMaterial({ color: 0xb5b9ba, metalness: 0.78, roughness: 0.3, envMapIntensity: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x515860, metalness: 0.85, roughness: 0.28, envMapIntensity: 1 });
  const recess = new THREE.MeshStandardMaterial({ color: 0x20252a, metalness: 0.4, roughness: 0.53 });
  const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x353a3c, metalness: 0.15, roughness: 0.62 });
  const ink = new THREE.LineBasicMaterial({ color: 0x252b30, transparent: true, opacity: 0.66, toneMapped: false });
  const fineInk = new THREE.LineBasicMaterial({ color: 0x41484d, transparent: true, opacity: 0.46, toneMapped: false });
  const glow = new THREE.MeshBasicMaterial({ color: 0xd9f8ff, toneMapped: false });
  for (const material of [armor, edgeMetal, steel, recess, cableMaterial, ink, fineInk]) material.color.convertSRGBToLinear();

  function group(parent, pivot, depth = 0) {
    const result = new THREE.Group();
    const parentPivot = parent.userData.pivot;
    result.position.set((pivot[0] - parentPivot[0]) * UNIT, (parentPivot[1] - pivot[1]) * UNIT, depth * UNIT);
    result.userData.pivot = pivot;
    parent.add(result);
    return result;
  }

  function place(parent, mesh, x, y, z = 0) {
    const pivot = parent.userData.pivot;
    mesh.position.set((x - pivot[0]) * UNIT, (pivot[1] - y) * UNIT, z * UNIT);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function seam(parent, path, z, faint = false) {
    const points = [];
    for (const subpath of path.match(/M[^M]+/g)) {
      const curve = shapeFromPath(subpath, parent.userData.pivot).getPoints(16);
      for (let i = 1; i < curve.length; i++) {
        points.push(new THREE.Vector3(curve[i - 1].x, curve[i - 1].y, z * UNIT), new THREE.Vector3(curve[i].x, curve[i].y, z * UNIT));
      }
    }
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), faint ? fineInk : ink);
    parent.add(line);
    return line;
  }

  function plate(parent, path, depth, front, material = armor, bevel = 2) {
    const shape = shapeFromPath(path, parent.userData.pivot);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth * UNIT, bevelEnabled: bevel > 0, bevelSegments: 2, steps: 1,
      bevelSize: bevel * UNIT, bevelThickness: bevel * UNIT, curveSegments: 12,
    });
    // Formed panels have a broad convex highlight, while their traced edge
    // remains faithful to the drawing. Small plates retain flat normals.
    if (material === armor && depth >= 30) {
      geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      const positions = geometry.attributes.position;
      const normals = geometry.attributes.normal;
      const normal = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        if (normals.getZ(i) < 0.999) continue;
        normal.set((positions.getX(i) - center.x) / size.x * 1.4, (positions.getY(i) - center.y) / size.y * 0.9, 1).normalize();
        normals.setXYZ(i, normal.x, normal.y, normal.z);
      }
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = (front - depth) * UNIT;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    seam(parent, path, front + bevel + 0.5);
    return mesh;
  }

  function disc(parent, x, y, radius, depth, z, material = armor) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * UNIT, radius * UNIT, depth * UNIT, 48), material);
    mesh.rotation.x = Math.PI / 2;
    return place(parent, mesh, x, y, z);
  }

  function ring(parent, x, y, radius, thickness, z, material = edgeMetal) {
    return place(parent, new THREE.Mesh(new THREE.TorusGeometry(radius * UNIT, thickness * UNIT, 8, 64), material), x, y, z);
  }

  function rod(parent, start, end, radius, material = steel) {
    const pivot = parent.userData.pivot;
    const from = new THREE.Vector3((start[0] - pivot[0]) * UNIT, (pivot[1] - start[1]) * UNIT, start[2] * UNIT);
    const to = new THREE.Vector3((end[0] - pivot[0]) * UNIT, (pivot[1] - end[1]) * UNIT, end[2] * UNIT);
    const direction = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * UNIT, radius * UNIT, direction.length(), 12), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function piston(parent, start, end, radius, ribs = 7) {
    rod(parent, start, end, radius * 0.68, steel);
    for (let i = 1; i <= ribs; i++) {
      const t = i / (ribs + 1);
      const a = start.map((value, axis) => THREE.MathUtils.lerp(value, end[axis], t - 0.021));
      const b = start.map((value, axis) => THREE.MathUtils.lerp(value, end[axis], t + 0.021));
      rod(parent, a, b, radius, i % 2 ? edgeMetal : armor);
    }
  }

  function cable(parent, coordinates, radius = 2) {
    const pivot = parent.userData.pivot;
    const curve = new THREE.CatmullRomCurve3(coordinates.map(([x, y, z = 0]) => new THREE.Vector3((x - pivot[0]) * UNIT, (pivot[1] - y) * UNIT, z * UNIT)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius * UNIT, 6, false), cableMaterial);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function radialTeeth(parent, x, y, radius, count, z) {
    const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(3.5 * UNIT, 7 * UNIT, 3 * UNIT), edgeMetal, count);
    const transform = new THREE.Object3D();
    const pivot = parent.userData.pivot;
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      transform.position.set((x - pivot[0] + Math.cos(angle) * radius) * UNIT, (pivot[1] - y + Math.sin(angle) * radius) * UNIT, z * UNIT);
      transform.rotation.z = angle - Math.PI / 2;
      transform.updateMatrix();
      teeth.setMatrixAt(i, transform.matrix);
    }
    teeth.castShadow = teeth.receiveShadow = true;
    parent.add(teeth);
  }

  function bearing(parent, x, y, radius, z, detailed = false) {
    disc(parent, x, y, radius, 10, z, armor);
    ring(parent, x, y, radius - 3, 1.8, z + 6, steel);
    disc(parent, x, y, radius * 0.81, 4, z + 6, recess);
    ring(parent, x, y, radius * 0.75, 2.7, z + 9, edgeMetal);
    if (detailed) radialTeeth(parent, x, y, radius * 0.67, Math.round(radius * 0.75), z + 9);
    disc(parent, x, y, radius * 0.55, 5, z + 10, armor);
    ring(parent, x, y, radius * 0.52, 1.3, z + 13, steel);
    ring(parent, x, y, radius * 0.3, 1.5, z + 14, steel);
    disc(parent, x, y, radius * 0.22, 3, z + 14, edgeMetal);
    ring(parent, x, y, radius * 0.13, 0.9, z + 16, steel);
  }

  function bolt(parent, x, y, z, radius = 3) {
    disc(parent, x, y, radius, 1.8, z, steel);
    disc(parent, x, y, radius * 0.48, 2, z + 1, edgeMetal);
  }

  const baseGroup = group(robotRoot, ORIGIN);
  // Flat sole, long toe, open ankle yoke and concentric drive housing.
  plate(baseGroup, 'M 74 1144 L 170 1141 L 208 1134 L 323 1139 L 371 1147 L 411 1149 L 412 1167 L 74 1165 Z', 49, 24, armor, 1.5);
  plate(baseGroup, 'M 207 1018 L 274 1022 Q 336 1026 355 1052 Q 369 1070 367 1123 L 354 1140 L 273 1138 L 239 1118 L 215 1095 Z', 40, 6, armor, 4);
  seam(baseGroup, 'M 224 1038 L 274 1042 L 325 1049 L 329 1080 L 320 1084 L 320 1126', 11, true);
  seam(baseGroup, 'M 80 1156 L 179 1157 L 255 1154 L 362 1158 L 400 1158', 27);
  seam(baseGroup, 'M 359 1051 L 350 1056 L 354 1088 L 366 1091', 11);
  plate(baseGroup, 'M 54 1008 C 57 957 88 927 123 919 C 162 907 207 927 234 954 Q 260 984 251 1021 L 217 1019 Q 224 986 201 971 C 175 950 120 958 102 984 L 93 1048 L 76 1072 Q 56 1052 54 1008 Z', 31, -3, armor, 2.5);
  bearing(baseGroup, 142, 1048, 66, 18, true);
  ring(baseGroup, 142, 1048, 49, 1, 35, edgeMetal);
  for (const [x, y] of [[137, 1017], [129, 1079], [103, 1134], [318, 1117], [354, 1100]]) bolt(baseGroup, x, y, 35);
  plate(baseGroup, 'M 184 1108 L 237 1068 L 264 1104 L 234 1134 L 198 1138 Z', 7, 23, edgeMetal, 1);
  bearing(baseGroup, 223, 1106, 22, 30);
  rod(baseGroup, [294, 1139, 25], [318, 1117, 25], 4, edgeMetal);
  rod(baseGroup, [318, 1117, 25], [395, 1151, 25], 4, edgeMetal);
  rod(baseGroup, [176, 1154, 30], [249, 1155, 30], 4.5, edgeMetal);
  piston(baseGroup, [137, 866, -2], [145, 953, -2], 22, 5);
  piston(baseGroup, [184, 876, -8], [215, 949, -8], 8, 10);
  plate(baseGroup, 'M 98 799 Q 134 781 184 802 L 196 858 L 184 876 Q 141 885 94 870 Z', 35, 13, armor, 3);
  seam(baseGroup, 'M 103 819 Q 142 807 188 820 M 97 856 Q 143 845 193 860', 18);
  for (const x of [120, 171]) bolt(baseGroup, x, 864, 19);
  plate(baseGroup, 'M 87 704 L 101 708 L 104 773 L 79 819 L 78 855 L 84 856 L 82 868 L 68 863 L 65 817 L 88 771 Z', 14, 18, edgeMetal, 1);
  plate(baseGroup, 'M 180 745 L 194 749 L 195 778 L 218 826 L 220 873 L 203 875 L 202 837 L 179 787 Z', 14, 18, armor, 1);
  plate(baseGroup, 'M 102 695 L 174 716 L 176 765 Q 142 784 106 765 Z', 37, 4, armor, 3);
  rod(baseGroup, [114, 713, 28], [115, 764, 28], 3, edgeMetal);
  rod(baseGroup, [138, 722, 28], [139, 757, 28], 3, steel);

  const upperBodyGroup = group(robotRoot, [151, 740]);
  cable(upperBodyGroup, [[109, 425, -14], [58, 385, -12], [5, 404, -9], [0, 442, -8], [44, 440, -4], [105, 385, -4], [148, 379, -6], [188, 417, -6]], 2.5);
  plate(upperBodyGroup, 'M 94 398 Q 158 409 217 453 Q 268 486 284 548 C 299 602 286 658 271 699 L 249 754 Q 221 771 181 751 L 58 694 C 39 642 20 575 27 513 Q 31 458 62 421 Z', 69, 6, armor, 7);
  seam(upperBodyGroup, 'M 38 519 C 32 578 47 639 62 668 L 183 714 L 243 743 M 104 422 Q 154 444 225 471 L 250 480', 14);
  seam(upperBodyGroup, 'M 257 498 Q 273 550 273 597 L 261 655 M 50 632 L 71 643', 15, true);
  plate(upperBodyGroup, 'M 61 658 L 167 687 L 157 726 L 59 694 Z', 7, 19, armor, 1.5);
  plate(upperBodyGroup, 'M 97 663 L 158 685 L 151 709 L 88 690 Z', 3, 25, edgeMetal, 0.7);
  disc(upperBodyGroup, 123, 521, 80, 7, 18, edgeMetal);
  ring(upperBodyGroup, 123, 521, 74, 2.5, 23, armor);
  bearing(upperBodyGroup, 123, 521, 63, 26, true);
  ring(upperBodyGroup, 123, 521, 47, 1.5, 44, armor);
  seam(upperBodyGroup, 'M 65 490 Q 87 454 121 455 L 140 451 M 52 521 Q 48 568 85 591 M 164 462 Q 185 477 193 507', 29);
  plate(upperBodyGroup, 'M 119 390 L 207 426 L 200 444 L 109 409 Z', 28, 5, edgeMetal, 2);
  plate(upperBodyGroup, 'M 125 386 L 206 422 L 202 432 L 116 402 Z', 24, 13, armor, 1);

  const neckAndHeadGroup = group(upperBodyGroup, [169, 405]);
  piston(neckAndHeadGroup, [152, 394, -3], [202, 336, -3], 10, 9);
  piston(neckAndHeadGroup, [189, 413, 8], [224, 355, 8], 11, 7);
  rod(neckAndHeadGroup, [168, 382, 2], [216, 335, 2], 4, armor);
  const headGroup = group(neckAndHeadGroup, [213, 345]);

  // Swept helmet, exposed ear drive, face vent and hanging cheek plate.
  const helmetShell = plate(headGroup, 'M 167 280 C 169 228 208 190 248 192 C 303 188 360 225 381 270 Q 400 318 377 359 L 360 379 L 349 417 L 337 422 L 328 435 L 309 425 L 289 359 L 239 340 L 206 327 Q 167 305 167 280 Z', 72, 9, armor, 5);
  seam(headGroup, 'M 173 245 L 205 265 M 184 226 L 197 241 M 205 209 L 216 234 M 241 197 L 237 225 Q 277 224 302 247 L 330 226 M 276 217 L 285 197 M 259 196 L 254 215', 16);
  seam(headGroup, 'M 296 252 L 327 233 L 340 229 L 350 241 L 333 250 Q 351 279 350 308 L 383 338 M 347 238 L 366 267 L 383 273', 17);
  plate(headGroup, 'M 251 349 L 270 342 L 291 350 L 318 431 L 289 455 L 270 450 L 241 412 Z', 15, 44, armor, 2.5);
  seam(headGroup, 'M 250 365 L 246 406 L 269 444 M 291 361 L 299 357 L 311 386 L 302 391', 49);
  bolt(headGroup, 263, 367, 50, 3.2);
  bearing(headGroup, 253, 299, 53, 35, true);
  ring(headGroup, 253, 299, 47, 2, 46, armor);
  ring(headGroup, 253, 299, 40, 1, 49, steel);
  ring(headGroup, 253, 299, 33, 1.3, 49, edgeMetal);
  ring(headGroup, 253, 299, 20, 1.4, 51, armor);
  plate(headGroup, 'M 329 359 Q 333 342 345 344 Q 359 348 362 367 L 346 382 Q 332 380 329 359 Z', 5, 21, recess, 1);
  seam(headGroup, 'M 333 359 Q 342 346 348 353 L 358 368 M 337 369 L 351 357 M 342 376 L 356 364', 29);
  rod(headGroup, [335, 363, 26], [345, 352, 26], 1.7, edgeMetal);
  rod(headGroup, [338, 370, 26], [352, 356, 26], 1.7, edgeMetal);
  rod(headGroup, [344, 376, 26], [359, 362, 26], 1.7, edgeMetal);
  bolt(headGroup, 331, 331, 20, 2);
  // Both sides carry the reference's ear and face details when the head swivels.
  const farSide = new THREE.Group();
  farSide.position.z = -54 * UNIT;
  farSide.scale.z = -1;
  for (const part of headGroup.children) {
    if (part !== helmetShell) farSide.add(part.clone(true));
  }
  headGroup.add(farSide);
  const earWireAnchor = group(headGroup, [354, 377], -4);

  const shoulderArmGroup = group(upperBodyGroup, [123, 521], 49);
  // The relaxed pose is in the drawing; these pivots add the repair gestures.
  plate(shoulderArmGroup, 'M 137 545 L 168 540 L 211 574 L 239 636 L 223 670 L 190 677 L 155 636 L 113 583 Z', 32, 14, armor, 3);
  seam(shoulderArmGroup, 'M 140 559 L 177 603 L 203 645 M 170 550 L 205 586 L 225 627 M 120 585 L 157 570', 20);
  plate(shoulderArmGroup, 'M 167 637 Q 195 613 223 622 L 238 641 L 224 660 L 198 669 Z', 39, 20, edgeMetal, 2);
  seam(shoulderArmGroup, 'M 179 643 Q 198 627 224 634 M 188 656 Q 206 643 233 644', 26);
  piston(shoulderArmGroup, [211, 654, 12], [232, 714, 12], 13, 7);
  const elbowGroup = group(shoulderArmGroup, [240, 741]);
  plate(elbowGroup, 'M 222 712 Q 208 715 207 740 C 207 767 233 787 260 782 L 273 763 L 276 711 L 259 684 Z', 34, 16, armor, 3);
  plate(elbowGroup, 'M 260 683 Q 309 661 360 642 L 406 622 L 426 635 L 438 680 L 376 710 L 285 768 Q 290 720 260 683 Z', 39, 7, armor, 3);
  seam(elbowGroup, 'M 280 693 L 403 638 M 298 722 L 419 664 M 297 741 L 367 703 L 425 677 M 268 702 L 279 722 M 271 764 L 272 754', 14);
  plate(elbowGroup, 'M 396 624 L 409 618 L 422 625 L 442 673 L 430 682 L 419 680 Z', 43, 13, edgeMetal, 1.5);
  bearing(elbowGroup, 240, 740, 25, 26);
  piston(elbowGroup, [428, 642, 4], [456, 628, 4], 18, 6);
  const handGroup = group(elbowGroup, [452, 626]);
  const musicPlayerGroup = group(handGroup, [506, 594]);
  plate(musicPlayerGroup, 'M 480 521 L 531 520 L 546 535 L 551 643 L 541 670 L 482 671 L 466 649 L 465 544 Z', 32, 0, armor, 2);
  plate(musicPlayerGroup, 'M 511 522 L 534 525 L 541 546 L 540 639 L 548 645 L 539 668 L 509 665 Z', 5, 18, edgeMetal, 1.5);
  seam(musicPlayerGroup, 'M 506 526 L 503 574 L 468 579 M 506 580 L 507 637 L 476 632 M 481 665 L 501 666 M 517 645 L 536 645 L 539 666', 22);
  plate(musicPlayerGroup, 'M 496 516 L 504 515 L 501 535 L 494 534 Z', 6, 20, steel, 0.8);
  plate(musicPlayerGroup, 'M 472 646 L 483 646 L 483 655 L 473 655 Z', 3, 22, recess, 0.5);
  plate(musicPlayerGroup, 'M 489 648 L 500 648 L 500 659 L 489 659 Z', 3, 22, armor, 0.5);
  piston(musicPlayerGroup, [538, 520, -2], [539, 484, -2], 6, 5);
  const playerWireAnchor = group(musicPlayerGroup, [539, 484], -2);
  for (let i = 0; i < 4; i++) {
    const y = 548 + i * 23;
    const path = 'M 548 ' + (y - 6) + ' Q 576 ' + (y - 10) + ' 581 ' + (y - 2) + ' L 583 ' + (y + 7) + ' Q 581 ' + (y + 14) + ' 550 ' + (y + 11) + ' Q 541 ' + (y + 5) + ' 548 ' + (y - 6) + ' Z';
    plate(musicPlayerGroup, path, 16, 21, armor, 2);
    seam(musicPlayerGroup, 'M 567 ' + (y - 6) + ' Q 573 ' + (y + 1) + ' 569 ' + (y + 11) + ' M 578 ' + (y - 4) + ' L 579 ' + (y + 7), 25);
  }
  plate(musicPlayerGroup, 'M 436 607 L 445 576 L 448 554 L 463 536 L 478 534 L 489 541 L 483 552 L 468 552 L 460 577 L 455 597 L 447 612 Z', 18, 22, armor, 2);
  seam(musicPlayerGroup, 'M 441 586 L 456 592 M 445 576 L 461 582 M 454 552 L 464 557 M 469 536 L 475 546', 27);
  const weldTorchGroup = group(handGroup, [501, 600], 16);
  weldTorchGroup.visible = false;
  rod(weldTorchGroup, [462, 620, 1], [494, 599, 1], 9, armor);
  rod(weldTorchGroup, [494, 599, 1], [525, 577, 1], 5, steel);
  const torchTip = group(weldTorchGroup, [526, 576], 1);
  torchTip.add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), glow));

  // Reuse one tube buffer between the moving headphone and player anchors.
  const wirePoints = Array.from({ length: 5 }, (_, i) => new THREE.Vector3(i, i * 2, 0));
  const wireCurve = new THREE.CatmullRomCurve3(wirePoints);
  const wireSegments = 36;
  const wireSides = 6;
  const wireRadius = 1.8 * UNIT;
  const wireGeometry = new THREE.TubeGeometry(wireCurve, wireSegments, wireRadius, wireSides, false);
  wireGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  wireGeometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  const headphoneWireMesh = new THREE.Mesh(wireGeometry, cableMaterial);
  headphoneWireMesh.frustumCulled = false;
  robotRoot.add(headphoneWireMesh);
  const wirePoint = new THREE.Vector3();
  const wireNormal = new THREE.Vector3();

  function updateHeadphoneWire() {
    if (!headphoneWireMesh.visible) return;
    robotRoot.updateMatrixWorld(true);
    earWireAnchor.getWorldPosition(wirePoints[0]);
    playerWireAnchor.getWorldPosition(wirePoints[4]);
    robotRoot.worldToLocal(wirePoints[0]);
    robotRoot.worldToLocal(wirePoints[4]);
    const start = wirePoints[0];
    const end = wirePoints[4];
    wirePoints[1].set(start.x + 7, start.y - 12, start.z - 1);
    wirePoints[2].set(start.x + (end.x - start.x) * 0.64, start.y - 12, start.z - 1);
    wirePoints[3].set(end.x - 4, end.y + 9, end.z - 1);
    wireCurve.updateArcLengths();
    const frames = wireCurve.computeFrenetFrames(wireSegments, false);
    for (let i = 0; i <= wireSegments; i++) {
      wireCurve.getPointAt(i / wireSegments, wirePoint);
      for (let j = 0; j <= wireSides; j++) {
        const angle = j / wireSides * Math.PI * 2;
        wireNormal.copy(frames.normals[i]).multiplyScalar(-Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle));
        const index = i * (wireSides + 1) + j;
        wireGeometry.attributes.position.setXYZ(index, wirePoint.x + wireRadius * wireNormal.x, wirePoint.y + wireRadius * wireNormal.y, wirePoint.z + wireRadius * wireNormal.z);
        wireGeometry.attributes.normal.setXYZ(index, wireNormal.x, wireNormal.y, wireNormal.z);
      }
    }
    wireGeometry.attributes.position.needsUpdate = true;
    wireGeometry.attributes.normal.needsUpdate = true;
  }

  const flameGroup = group(baseGroup, [213, 1169], -15);
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0x81d8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(4.6, 32, 20, 1, true), flameMaterial);
  outerFlame.rotation.z = Math.PI;
  outerFlame.position.y = -14;
  const coreFlame = new THREE.Mesh(new THREE.ConeGeometry(2, 21, 16), glow);
  coreFlame.rotation.z = Math.PI;
  coreFlame.position.y = -9;
  flameGroup.add(outerFlame, coreFlame);
  flameGroup.visible = false;

  Object.assign(robotRoot.userData, {
    upperBodyGroup, neckAndHeadGroup, headGroup, shoulderArmGroup, elbowGroup,
    handGroup, musicPlayerGroup, weldTorchGroup, torchTip, headphoneWireMesh,
    flameGroup, updateHeadphoneWire, textures: [metalGrain], isBobbing: true, isFlying: false,
  });
  updateHeadphoneWire();
  return robotRoot;
}
