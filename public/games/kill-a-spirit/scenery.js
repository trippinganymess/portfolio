import { createCrowModel, poseCrowWings } from '../../lib/crow-model.js';

/* A living woodblock-print landscape. All textures are painted locally. */
window.createDreamScenery = function createDreamScenery(THREE, scene, { onCrowFlightChange } = {}) {
  const group = new THREE.Group();
  group.name = 'Japanese twilight garden';
  scene.add(group);
  const TAU = Math.PI * 2;
  let seed = 7391;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function canvasTexture(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  function washi(ctx, width, height, amount = 0.055) {
    for (let i = 0; i < width * height / 25; i++) {
      const x = random() * width;
      const y = random() * height;
      ctx.strokeStyle = random() > 0.5 ? `rgba(252,231,207,${amount})` : `rgba(45,31,65,${amount})`;
      ctx.lineWidth = 0.4 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + random() * 7, y + random() * 2);
      ctx.stroke();
    }
  }
  function plane(width, height, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  function flatMaterial(color, extra = {}) {
    return new THREE.MeshBasicMaterial({ color, ...extra });
  }
  function shapeMesh(points, material, parent = group) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    parent.add(mesh);
    return mesh;
  }

  const skyTexture = canvasTexture(1024, 1024, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#555180');
    gradient.addColorStop(0.2, '#867da8');
    gradient.addColorStop(0.4, '#c09ebf');
    gradient.addColorStop(0.52, '#edbacb');
    gradient.addColorStop(0.61, '#f7d0b8');
    gradient.addColorStop(0.72, '#cbbdcf');
    gradient.addColorStop(1, '#6d7caa');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    washi(ctx, width, height, 0.055);
  });
  plane(115, 65, flatMaterial(0xffffff, { map: skyTexture }), 0, 5, -32);

  const glowTexture = canvasTexture(256, 256, (ctx) => {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,231,213,.62)');
    gradient.addColorStop(0.28, 'rgba(255,209,209,.28)');
    gradient.addColorStop(0.6, 'rgba(251,192,216,.1)');
    gradient.addColorStop(1, 'rgba(244,192,224,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  });
  const sunHalo = plane(34, 30, flatMaterial(0xffffff, { map: glowTexture, transparent: true, depthWrite: false }), -4.5, 7.2, -29.8);
  sunHalo.name = 'Twilight sun halo';
  const sun = new THREE.Mesh(new THREE.CircleGeometry(3.15, 96), flatMaterial(new THREE.Color(1.4, 1.02, .68)));
  sun.position.set(-4.5, 7.2, -29.6);
  sun.name = 'Twilight sun';
  group.add(sun);
  plane(13, 13, flatMaterial(0xffdcc0, { map: glowTexture, transparent: true, depthWrite: false, opacity: .65, blending: THREE.AdditiveBlending }), -4.5, 7.2, -29.5).name = 'Warm sun glow';
  plane(45, 27, flatMaterial(0xf4d0ef, { map: glowTexture, transparent: true, depthWrite: false, opacity: .26 }), -5, 7, -25.4).name = 'Rose twilight haze';

  const cloudTexture = canvasTexture(768, 256, (ctx, width, height) => {
    for (let i = 0; i < 35; i++) {
      const x = 80 + random() * (width - 160);
      const y = 112 + (random() - 0.5) * 45;
      const radius = 35 + random() * 48;
      const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
      gradient.addColorStop(0, 'rgba(244,211,213,.34)');
      gradient.addColorStop(0.65, 'rgba(235,199,212,.12)');
      gradient.addColorStop(1, 'rgba(231,193,210,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(2.4, 0.7);
      ctx.translate(-x, -y);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
    washi(ctx, width, height, 0.03);
  });
  const clouds = [
    [-17, 11.5, -27.5, 23, 4.8], [8, 13, -27, 29, 4.7],
    [-4, 6.5, -26.5, 22, 2.1], [17, 8.4, -26, 25, 3.8],
    [-22, 3.7, -25.8, 24, 2.5], [1, 17, -28, 26, 3.8],
  ].map(([x, y, z, width, height], i) => ({
    mesh: plane(width, height, flatMaterial(0xffffff, { map: cloudTexture, transparent: true, depthWrite: false, opacity: i === 2 ? 0.68 : 0.94 }), x, y, z),
    y, phase: i * 1.9, speed: 0.11 + i * 0.018,
  }));

  // Separate translucent ink layers give the mountain ridges their depth.
  function mountain(points, z, colors, name) {
    const texture = canvasTexture(1024, 512, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 150; i++) {
        const x = random() * width;
        ctx.strokeStyle = 'rgba(222,205,198,.06)';
        ctx.lineWidth = 1 + random() * 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x - 80, 160, x + 90, 320, x - 150, height);
        ctx.stroke();
      }
      washi(ctx, width, height, 0.085);
    });
    const mesh = shapeMesh([...points, [46, -5], [-46, -5]], flatMaterial(0xffffff, { map: texture }));
    mesh.position.z = z;
    mesh.name = name;
    const position = mesh.geometry.attributes.position;
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + 46) / 92, (position.getY(i) + 5) / 21);
    return mesh;
  }
  mountain([[-46, 12], [-28, 7], [-22, 9], [-17, 5], [-12, 4], [-7, 0], [-2, 1], [4, 6.1], [7, 6.2], [13, 0.5], [17, 4], [23, 9], [31, 7], [46, 13]], -25.2, ['#c5b6d4', '#9eabd0'], 'Distant ink mountains');
  mountain([[-46, 11], [-29, 9], [-22, 10], [-16, 5.7], [-10, 2.7], [-5, -0.9], [0, 0.8], [5, 5.5], [6.2, 5.6], [11.5, 0.1], [17, 2.6], [22, 7.8], [29, 10.3], [46, 12]], -23.1, ['#9b91b6', '#7d91b5'], 'Fuji mountain');
  const snow = shapeMesh([[3.0, 3.7], [5, 5.5], [6.2, 5.6], [8.2, 3.7], [6.9, 4.05], [6.2, 3.8], [5.7, 4.25], [4.7, 4.0], [4.3, 4.18]], flatMaterial(0xd8c7ce, { transparent: true, opacity: 0.64 }));
  snow.position.z = -23.0;
  mountain([[-46, 9], [-25, 7], [-20, 8], [-15, 5], [-11, 1.3], [-7, -1.3], [-1, -2.1], [7, -1.6], [11, 0], [17, 4], [21, 9], [25, 10], [46, 15]], -20.9, ['#626b93', '#526f8f'], 'Near indigo slopes');

  const mistTexture = canvasTexture(512, 128, (ctx, width, height) => {
    ctx.translate(width / 2, height / 2);
    ctx.scale(1, height / width);
    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, width / 2);
    gradient.addColorStop(0, 'rgba(238,221,243,.78)');
    gradient.addColorStop(.5, 'rgba(228,213,241,.4)');
    gradient.addColorStop(1, 'rgba(223,210,237,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(-width / 2, -width / 2, width, width);
  });
  const mists = [
    [-7, -3.8, -17.5, 46, 2.1, .36], [7, -2.5, -17.8, 50, 2.5, .38],
    [-3, -1.1, -18.1, 59, 3.0, .32], [5, .6, -20.2, 55, 3.5, .30],
    [-6, 2.1, -22.4, 49, 3.6, .25], [4, 4.0, -24.1, 47, 4.5, .24],
  ].map(([x, y, z, width, height, opacity], i) => ({
    mesh: plane(width, height, flatMaterial(i % 2 ? 0xf4dcf1 : 0xe5dff9, { map: mistTexture, transparent: true, depthWrite: false, opacity }), x, y, z),
    x, y, phase: i * 1.8,
  }));

  // The water is a painted, animated plane: ripples and seigaiha wave arcs
  // grow from the same gust value that moves the leaves and plays the waves.
  const lakeShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uWind: { value: 0 },
      uSpiritPos: { value: new THREE.Vector3() }, uSpiritLum: { value: 1 },
      uShatterRipples: { value: Array.from({ length: 4 }, () => new THREE.Vector3(0, -4.5, -100)) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uWind;
      uniform vec3 uSpiritPos;
      uniform float uSpiritLum;
      uniform vec3 uShatterRipples[4];
      varying vec2 vUv;
      varying vec3 vWorldPos;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float depth = 1.0 - vUv.y;
        vec3 color = mix(vec3(.45,.42,.59), vec3(.14,.22,.36), smoothstep(0., 1., depth));
        float phase = vUv.y * 125.0 + sin(vUv.x * 31.0 + uTime * .22) * 2.3;
        float ripple = sin(phase - uTime * (1.0 + uWind * 1.3));
        float fine = sin(vUv.y * 420. + sin(vUv.x * 100. + uTime * .5) * 3. - uTime * 2.8);
        color += vec3(.08,.11,.15) * (ripple * .28 + fine * .16) * (.3 + uWind * .7);
        float sunPath = exp(-pow((vWorldPos.x + 3.5 + ripple * .6) / (1.2 + depth * 6.), 2.));
        float glint = smoothstep(.44, .96, sin(phase * 1.55 - uTime * 2.0 + fine * .2));
        color += vec3(.48,.28,.22) * sunPath * glint * (1.0 - depth * .55);
        float rolling = sin(vUv.y * 56. - uTime * 1.35 + sin(vUv.x * 20.) * 1.3);
        float crest = smoothstep(.95 - uWind * .08, 1.0, rolling);
        color += vec3(.15,.21,.22) * crest * uWind * (.2 + depth * .7);
        // Understated traditional overlapping wave pattern in the foreground.
        vec2 tile = vec2(vUv.x * 35., depth * 12. - uTime * .028);
        tile.x += mod(floor(tile.y), 2.) * .5;
        vec2 arc = vec2(fract(tile.x) - .5, fract(tile.y) * .55);
        float arcs = abs(sin(length(arc) * 39.));
        color += vec3(.10,.14,.18) * smoothstep(.94, 1., arcs) * smoothstep(.28,.8,depth) * .14;
        float spirit = exp(-pow((vWorldPos.x - uSpiritPos.x) * .38, 2.) - pow((vWorldPos.y + 7.) * .21, 2.));
        color += vec3(.11,.19,.25) * spirit * uSpiritLum * glint;
        for (int i = 0; i < 4; i++) {
          float age = uTime - uShatterRipples[i].z;
          float active = step(0., age) * (1. - step(2.8, age));
          vec2 delta = vWorldPos.xy - uShatterRipples[i].xy;
          delta.y *= 2.8;
          float front = length(delta) - age * 28.;
          float ring = exp(-front * front * 1.7);
          float wake = sin(front * 6.) * exp(-abs(front) * .65) * .25;
          color += vec3(.30,.38,.46) * (ring + wake) * active * max(0., 1. - age / 2.8);
        }
        color += (hash(floor(vUv * vec2(1600.,900.))) - .5) * .025;
        gl_FragColor = vec4(color, 1.);
      }
    `,
  });
  plane(105, 37, lakeShaderMat, 0, -20.25, -18.9).name = 'Wind stirred lake';

  // Curved ink branches and individually moving canopy clusters.
  const barkMaterial = flatMaterial(0x393652);
  function branch(parent, points, radius) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radius, 5, false), barkMaterial);
    parent.add(mesh);
    return mesh;
  }
  const blossomTexture = canvasTexture(256, 256, (ctx) => {
    for (let i = 0; i < 650; i++) {
      const angle = random() * TAU;
      const radius = Math.sqrt(random()) * 114;
      const x = 128 + Math.cos(angle) * radius;
      const y = 128 + Math.sin(angle) * radius * 0.66;
      ctx.fillStyle = ['#ad7398', '#cd96b5', '#e7b3c3', '#f0c5cf', '#f8d2cf'][Math.floor(random() * 5)];
      ctx.globalAlpha = 0.65 + random() * 0.35;
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + random() * 9, 2 + random() * 5, random() * TAU, 0, TAU);
      ctx.fill();
    }
  });
  const trees = [];
  const crowPerches = [];
  const soilTexture = canvasTexture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#777c87';
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 17000; i++) {
      ctx.fillStyle = ['#9a96a0', '#686c79', '#a29fa4', '#858794'][Math.floor(random() * 4)];
      ctx.globalAlpha = .12 + random() * .22;
      ctx.fillRect(random() * width, random() * height, 1 + random() * 5, 1 + random() * 3);
    }
    ctx.globalAlpha = .25;
    for (let i = 0; i < 160; i++) {
      const x = random() * width;
      const y = random() * height;
      ctx.strokeStyle = i % 2 ? '#c1b1b8' : '#484d65';
      ctx.lineWidth = .5 + random() * 1.5;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y - 3); ctx.lineTo(x + 32, y + 5); ctx.lineTo(x + 55, y + 2); ctx.stroke();
    }
  });
  const mossTexture = canvasTexture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#83988c'; ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 20000; i++) {
      ctx.fillStyle = ['#a4afa0', '#627d75', '#bcc0aa', '#8d9f89', '#687f79'][Math.floor(random() * 5)];
      ctx.globalAlpha = .2 + random() * .5;
      ctx.beginPath(); ctx.ellipse(random() * width, random() * height, 1 + random() * 3, 1 + random() * 6, random(), 0, TAU); ctx.fill();
    }
  });
  const bankMaterial = new THREE.MeshStandardMaterial({ map: soilTexture, roughness: 1, color: 0xc8c1d5, emissive: 0x353549, emissiveIntensity: .18 });
  const groundMaterial = new THREE.MeshStandardMaterial({ map: mossTexture, roughness: 1, color: 0xd5e0d3, emissive: 0x2d433b, emissiveIntensity: .2 });
  const contactTexture = canvasTexture(128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(33,36,59,.55)');
    gradient.addColorStop(.6, 'rgba(45,48,76,.24)');
    gradient.addColorStop(1, 'rgba(45,48,76,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  });
  function islandGround(anchor, width = 5.8, depth = 2.5) {
    // A rounded, uneven 3D bank replaces a flat platform. Its upper surface
    // overlaps the root or pillar origin; all ground shares the same anchor.
    function terrain(geometry, surface) {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        const angle = Math.atan2(z, x);
        const outline = 1 + Math.sin(angle * 5) * .075 + Math.sin(angle * 9 + 1) * .035;
        position.setXYZ(i, x * width * outline, surface ? y * .83 - .59 + Math.sin(x * 5 + z * 4) * .015 : y * .83 - .63, z * depth * outline);
      }
      geometry.computeVertexNormals();
      return geometry;
    }
    const bank = new THREE.Mesh(terrain(new THREE.SphereGeometry(1, 40, 20), false), bankMaterial);
    bank.name = 'Sloped island bank'; anchor.add(bank);
    const ground = new THREE.Mesh(terrain(new THREE.SphereGeometry(.995, 40, 14, 0, TAU, 0, Math.PI / 2), true), groundMaterial);
    ground.name = 'Mossy island ground'; anchor.add(ground);
    for (let i = 0; i < 13; i++) {
      const angle = i / 13 * TAU + .13;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(.24 + random() * .35, 1), bankMaterial);
      rock.position.set(Math.cos(angle) * width * (.75 + random() * .16), -.28 - random() * .19, Math.sin(angle) * depth * .83);
      rock.scale.set(1.4 + random() * .4, .7 + random() * .5, .8 + random() * .5);
      rock.rotation.set(random(), random(), random());
      anchor.add(rock);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width * 2.7, 2.9), flatMaterial(0xffffff, { map: contactTexture, transparent: true, depthWrite: false }));
    shadow.position.set(0, -1.4, depth + .12);
    shadow.name = 'Island water contact shadow'; anchor.add(shadow);
    for (let i = 0; i < 2; i++) {
      const waterline = new THREE.Mesh(new THREE.RingGeometry(.986, 1, 80), flatMaterial(0xd6c5e2, { transparent: true, opacity: i ? .12 : .23, depthWrite: false, side: THREE.DoubleSide }));
      waterline.scale.set(width * (1.08 + i * .15), .23 + i * .12, 1);
      waterline.position.set(0, -1.37 - i * .13, depth + .2);
      anchor.add(waterline);
    }
  }
  function cherryTree(x, y, z, scale, mirror = 1) {
    const anchor = new THREE.Group();
    anchor.name = mirror === 1 ? 'Left tree island' : 'Right tree island';
    anchor.position.set(x, y, z);
    anchor.scale.set(scale * mirror, scale, scale);
    group.add(anchor);
    islandGround(anchor);
    const tree = new THREE.Group();
    tree.name = 'Rooted cherry tree';
    anchor.add(tree);
    branch(tree, [[0,0,0], [.35,2,0], [.1,4,0], [1,6.5,0], [2.2,8.6,0]], .19);
    branch(tree, [[.2,3.1,0], [1.6,4.5,.1], [3,5.9,.1], [4.8,6.7,.1]], .10);
    branch(tree, [[.1,4.2,0], [-1.1,5.7,.1], [-2.1,6.6,.1], [-3.6,7.1,.1]], .095);
    branch(tree, [[.7,6,0], [-.4,7.8,0], [-.1,9,0]], .09);
    branch(tree, [[1.6,7.4,0], [3,8.3,.1], [4.2,8.5,.1]], .065);
    branch(tree, [[2.6,5.65,.1], [3.6,6.35,.1], [4.45,6.5,.15]], .055);
    const clusters = [
      [-3.1,7.15,2.9,1.5], [-1.5,7.3,3.2,1.6], [0,8.8,3.2,1.7],
      [1.9,8.6,3.4,1.7], [3.6,8.45,3,1.6], [4.8,6.9,2.1,1.3],
      [2.3,6.5,2.6,1.5], [-.8,6.5,2.7,1.2],
    ].map(([cx, cy, width, height], i) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), flatMaterial(0xffffff, { map: blossomTexture, transparent: true, alphaTest: 0.08, depthWrite: false, side: THREE.DoubleSide }));
      mesh.position.set(cx, cy, 0.25 + i * 0.02);
      tree.add(mesh);
      return { mesh, x: cx, y: cy, phase: random() * TAU };
    });
    // Exposed branches face into the scene, so all twenty resting places stay
    // visible in portrait and sit in front of the surrounding blossom planes.
    const slots = [[.4,3.8],[2.1,4.6],[3.8,5.3],[.4,5.4],[1.9,6.2],[3.6,6.9],[.1,7.0],[1.4,7.9],[3.0,8.5],[4.6,7.95]];
    slots.forEach(([px, py], i) => {
      branch(tree, [[Math.max(.2, px * .4),py - .55,.6],[px - .4,py - .08,.9],[px,py,1.08],[px + .3,py + .02,1.08]], .04);
      const perch = new THREE.Object3D();
      perch.position.set(px, py, 1.08);
      perch.name = `Crow perch ${trees.length}-${i}`;
      tree.add(perch);
      crowPerches.push({ id: `${trees.length}-${i}`, treeId: trees.length, object: perch });
    });
    trees.push({ group: tree, anchor, clusters, phase: random() * TAU });
  }
  cherryTree(-12, -3.7, -11.8, 1.12);
  cherryTree(17.8, -4.4, -10, .88, -1);

  // The torii's feet are embedded in a third rocky, moss-covered island.
  const shrineAnchor = new THREE.Group();
  shrineAnchor.name = 'Shrine island';
  shrineAnchor.position.set(8.7, -3.1, -16.7);
  group.add(shrineAnchor);
  islandGround(shrineAnchor, 3.6, 1.9);
  const torii = new THREE.Group();
  torii.name = 'Grounded torii';
  torii.position.y = .26;
  shrineAnchor.add(torii);
  const vermilion = flatMaterial(0xa6656b);
  function bar(parent, width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  bar(torii, .20, 3.4, .20, -1.05, 1.5, 0, vermilion).rotation.z = -.035;
  bar(torii, .20, 3.4, .20, 1.05, 1.5, 0, vermilion).rotation.z = .035;
  bar(torii, 3.5, .18, .3, 0, 3.18, 0, vermilion);
  bar(torii, 2.8, .15, .18, 0, 2.55, 0, vermilion);
  bar(torii, .16, .66, .15, 0, 2.85, 0, vermilion);
  const roof = shapeMesh([[-1.95,3.4],[-1.6,3.28],[0,3.24],[1.6,3.28],[1.95,3.4],[1.8,3.12],[0,3.04],[-1.8,3.12]], flatMaterial(0x302e45), torii);
  roof.position.z = .18;
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(.72, .11, .30), bankMaterial);
    step.position.set(0, .16 - i * .09, .4 + i * .38);
    shrineAnchor.add(step);
  }

  const petalTexture = canvasTexture(64, 64, (ctx) => {
    ctx.scale(1.65, 1.65);
    ctx.translate(3.5, 3);
    ctx.shadowColor = '#ffbfec';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffe7f2';
    ctx.beginPath();
    ctx.moveTo(16, 30);
    ctx.bezierCurveTo(-2, 17, 2, 0, 13, 4);
    ctx.lineTo(16, 8);
    ctx.lineTo(19, 4);
    ctx.bezierCurveTo(31, 0, 35, 17, 16, 30);
    ctx.fill();
  });
  const petals = [];
  const petalMaterial = flatMaterial(0xffffff, { map: petalTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const petalGeometry = new THREE.PlaneGeometry(.17, .24);
  for (let i = 0; i < 74; i++) {
    const mesh = new THREE.Mesh(petalGeometry, petalMaterial);
    mesh.position.set(-15 + random() * 31, -6 + random() * 17, -11 + random() * 10);
    const scale = .45 + random() * .8;
    mesh.scale.setScalar(scale);
    group.add(mesh);
    petals.push({ mesh, phase: random() * TAU, speed: .35 + random() * .55 });
  }

  const moteCount = 34;
  const motePositions = new Float32Array(moteCount * 3);
  const moteData = Array.from({ length: moteCount }, () => ({
    x: (random() - .5) * 32, y: -7 + random() * 18, z: -10 + random() * 15,
    phase: random() * TAU, speed: .04 + random() * .08,
  }));
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMaterial = new THREE.PointsMaterial({ map: glowTexture, color: 0xecd6ff, size: .72, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending });
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  motes.name = 'Dream motes';
  group.add(motes);

  const dustCount = 185;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustData = [];
  for (let i = 0; i < dustCount; i++) {
    // Two narrow sources trace the summit and the nearer right-hand ridge.
    const summit = i < dustCount * .72;
    const data = {
      x: (summit ? 5.4 : 16.8) + (random() - .5) * 1.5,
      y: (summit ? 5.5 : 3.6) + (random() - .5) * .8,
      z: (summit ? -22 : -19.7) + random() * .5,
      phase: random() * TAU, speed: .3 + random() * .7,
    };
    dustPositions.set([data.x, data.y, data.z], i * 3);
    dustData.push(data);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({ color: 0xf1d5bd, map: glowTexture, size: .11, transparent: true, opacity: 0, depthWrite: false });
  const mountainDust = new THREE.Points(dustGeometry, dustMaterial);
  mountainDust.name = 'Windblown mountain dust';
  group.add(mountainDust);

  // Crow clones share every geometry and material. Twenty branch slots plus
  // four spare models allow new arrivals while older birds visibly fly away.
  const crowTemplate = createCrowModel(THREE);
  const crowPool = [];
  const crowScale = .78;
  const crowPoolLimit = 24;
  const crowArrivalInterval = 12;
  let crowId = 0;
  let gameAge = 0;
  let waves = 0;
  let nextArrivalAt = crowArrivalInterval;
  let lastWaveSize = 0;
  let waveBag = [];
  let flockFlying = false;
  let dustTravel = 0;
  let lastSceneElapsed = 0;
  let rippleIndex = 0;
  const isFlying = (bird) => ['incoming', 'departing', 'startled', 'circling'].includes(bird.state);
  const isGrounded = (bird) => bird.state === 'perched' || bird.state === 'startle-pending';

  function drawWaveSize() {
    if (!waveBag.length) {
      waveBag = [1, 1, 1, 1, 2, 2, 3];
      for (let i = waveBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [waveBag[i], waveBag[j]] = [waveBag[j], waveBag[i]];
      }
    }
    return waveBag.pop();
  }
  function acquireCrow() {
    let bird = crowPool.find((entry) => entry.state === 'idle');
    if (!bird && crowPool.length < crowPoolLimit) {
      const model = crowTemplate.clone(true);
      model.visible = false;
      group.add(model);
      bird = {
        model, state: 'idle',
        eye: model.getObjectByName('crow-eye'), legs: model.getObjectByName('crow-legs'),
        wings: [1, -1].map((direction) => ({ pivot: model.getObjectByName(`crow-wing-${direction}`), direction })),
        start: new THREE.Vector3(), entryStart: new THREE.Vector3(), destination: new THREE.Vector3(),
        controlA: new THREE.Vector3(), controlB: new THREE.Vector3(),
      };
      crowPool.push(bird);
    }
    return bird;
  }
  function outsidePoint(view, edge = Math.random()) {
    const z = -8 - Math.random() * 7;
    const halfHeight = Math.tan(24 * Math.PI / 180) * (view.cameraDepth - z);
    const halfWidth = halfHeight * view.aspect;
    if (edge < .4) return new THREE.Vector3(-halfWidth - 3.5, 2 + Math.random() * 7, z);
    if (edge < .8) return new THREE.Vector3(halfWidth + 3.5, 2 + Math.random() * 7, z);
    return new THREE.Vector3((Math.random() - .5) * halfWidth * 1.5, halfHeight + 4, z);
  }
  function perchDestination(bird) {
    bird.perch.object.getWorldPosition(bird.destination);
    bird.destination.y += .2 * crowScale;
  }
  function beginDeparture(bird, view) {
    bird.state = 'departing';
    bird.start.copy(bird.model.position);
    bird.destination.copy(outsidePoint(view));
    bird.exitSide = Math.random() < .5 ? -1 : 1;
    bird.exitHeight = bird.start.y + 4 + Math.random() * 3;
    bird.flightStartsAt = gameAge;
    bird.duration = 5 + Math.random() * 1.5;
    bird.arcHeight = 2.5 + Math.random() * 2;
    bird.perch = null;
    bird.model.userData.perchId = null;
  }
  function choosePerch(preferredTree, view) {
    const reserved = new Set(crowPool.filter((bird) => bird.perch && bird.state !== 'idle' && bird.state !== 'departing').map((bird) => bird.perch.id));
    const free = crowPerches.filter((perch) => !reserved.has(perch.id));
    if (free.length) {
      const preferred = free.filter((perch) => perch.treeId === preferredTree);
      const candidates = preferred.length ? preferred : free;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const resting = crowPool.filter((bird) => bird.state === 'perched').sort((a, b) => a.landedAt - b.landedAt);
    const oldest = resting.find((bird) => bird.perch.treeId === preferredTree) || resting[0];
    if (!oldest) return null;
    const perch = oldest.perch;
    beginDeparture(oldest, view);
    return perch;
  }
  function arrive(view) {
    const count = drawWaveSize();
    waves++;
    lastWaveSize = count;
    for (let i = 0; i < count; i++) {
      const bird = acquireCrow();
      if (!bird) continue;
      const preferredTree = (waves + i) % 2;
      const perch = choosePerch(preferredTree, view);
      bird.id = ++crowId;
      bird.model.name = `Crow ${bird.id}`;
      bird.state = perch ? 'incoming' : 'circling';
      bird.perch = perch;
      bird.preferredTree = preferredTree;
      bird.model.userData.perchId = perch?.id ?? null;
      bird.start.copy(outsidePoint(view));
      bird.entryStart.copy(bird.start);
      bird.model.position.copy(bird.start);
      bird.model.visible = true;
      bird.flightStartsAt = gameAge + i * (.55 + Math.random() * .35);
      bird.scheduledAt = nextArrivalAt;
      bird.duration = 8.5 + Math.random() * 3;
      bird.arcHeight = 2 + Math.random() * 2.5;
      bird.phase = Math.random() * TAU;
      bird.flapSpeed = 10.5 + Math.random() * 3;
      bird.landedAt = null;
      bird.reactionAt = null;
      bird.legs.visible = false;
      bird.eye.visible = true;
      bird.model.rotation.set(0, 0, 0);
      if (perch) perchDestination(bird);
      else holdingDestination(bird);
      bird.model.scale.set(bird.destination.x > bird.start.x ? -crowScale : crowScale, crowScale, crowScale);
    }
  }
  function setWingPose(bird, elapsed, fold) {
    poseCrowWings(THREE, bird.wings, elapsed, bird.flapSpeed, bird.phase, fold);
  }
  function holdingDestination(bird) {
    bird.destination.set(2.2, 8.1, 3.3);
    trees[bird.preferredTree].anchor.localToWorld(bird.destination);
  }
  function reactToShatter(origin) {
    const aspect = window.innerWidth / window.innerHeight || 1.6;
    const cameraDepth = aspect < .8 ? 31 : 19.5;
    const projectionScale = (cameraDepth + 18.9) / Math.max(5, cameraDepth - origin.z);
    const x = THREE.MathUtils.clamp(origin.x * projectionScale, -38, 38);
    const y = -4.5 - Math.max(0, -origin.y) * .4;
    lakeShaderMat.uniforms.uShatterRipples.value[rippleIndex].set(x, y, lastSceneElapsed);
    rippleIndex = (rippleIndex + 1) % 4;
    let reactions = 0;
    for (const bird of crowPool) {
      if (bird.state !== 'perched') continue;
      const shore = trees[bird.perch.treeId].anchor.position;
      const distance = Math.hypot(shore.x - x, (shore.y - 1 - y) * 2.8);
      bird.state = 'startle-pending';
      bird.reactionAt = gameAge;
      bird.flightStartsAt = gameAge + THREE.MathUtils.clamp(.2 + distance / 28, .2, 1.3);
      bird.duration = 3.1 + Math.random() * 1.5;
      bird.loopRadius = .7 + Math.random() * .6;
      bird.arcHeight = 2.1 + Math.random() * 1.2;
      bird.loopDepth = 1.1 + Math.random() * .7;
      reactions++;
    }
    return reactions;
  }
  function updateFlock(dt, elapsed, started, view) {
    if (started) gameAge += dt;
    group.updateMatrixWorld(true);
    for (const bird of crowPool) {
      if (bird.state === 'idle') continue;
      if (bird.perch) perchDestination(bird);
      if (bird.state === 'startle-pending' && gameAge >= bird.flightStartsAt) {
        bird.state = 'startled';
        bird.start.copy(bird.destination);
      }
      if (bird.state === 'circling') {
        holdingDestination(bird);
      }
      if (bird.state === 'departing') {
        // Resize can widen the view during an exit. Keep the endpoint outside
        // the current viewport before returning this model to the spare pool.
        const halfWidth = Math.tan(24 * Math.PI / 180) * (view.cameraDepth - bird.destination.z) * view.aspect;
        bird.destination.x = bird.exitSide * (halfWidth + 3.5);
        bird.destination.y = bird.exitHeight;
      }
      if (isGrounded(bird)) {
        bird.model.position.copy(bird.destination);
        bird.model.rotation.set(0, 0, trees[bird.perch.treeId].group.rotation.z);
        bird.legs.visible = true;
        bird.eye.visible = Math.sin(elapsed * .7 + bird.phase) < .996;
        setWingPose(bird, elapsed, 1);
        continue;
      }
      const progress = THREE.MathUtils.clamp((gameAge - bird.flightStartsAt) / bird.duration, 0, 1);
      if (bird.state === 'startled') {
        bird.model.position.copy(bird.destination);
        bird.model.position.x += Math.sin(progress * TAU) * bird.loopRadius;
        bird.model.position.y += Math.sin(progress * Math.PI) * bird.arcHeight;
        bird.model.position.z += Math.sin(progress * Math.PI) * bird.loopDepth;
        bird.model.rotation.y = Math.sin(progress * TAU) * .35;
        bird.model.rotation.z = Math.sin(progress * TAU) * .16;
        bird.legs.visible = progress < .08 || progress > .82;
        const fold = progress < .1 ? 1 - THREE.MathUtils.smoothstep(progress, 0, .1) : THREE.MathUtils.smoothstep(progress, .83, 1);
        setWingPose(bird, elapsed, fold);
        if (progress === 1) {
          bird.state = 'perched';
          bird.landedAt = gameAge;
          bird.model.position.copy(bird.destination);
          bird.model.rotation.set(0, 0, trees[bird.perch.treeId].group.rotation.z);
        }
        continue;
      }
      if (bird.state === 'circling' && progress === 1) {
        const circleAge = gameAge - bird.flightStartsAt - bird.duration;
        bird.model.position.copy(bird.destination);
        bird.model.position.x += Math.sin(circleAge * 1.6) * 1.0;
        bird.model.position.y += Math.sin(circleAge * .8) * .5;
        bird.model.position.z += Math.sin(circleAge * 1.6) * .5;
        bird.legs.visible = false;
        setWingPose(bird, elapsed, 0);
        continue;
      }
      bird.controlA.copy(bird.start).lerp(bird.destination, .28);
      bird.controlB.copy(bird.start).lerp(bird.destination, .76);
      bird.controlA.y += bird.arcHeight;
      bird.controlB.y += bird.arcHeight * .65;
      bird.controlA.z += 1.2;
      bird.controlB.z += .8;
      const q = 1 - progress;
      bird.model.position.copy(bird.start).multiplyScalar(q * q * q)
        .addScaledVector(bird.controlA, 3 * q * q * progress)
        .addScaledVector(bird.controlB, 3 * q * progress * progress)
        .addScaledVector(bird.destination, progress * progress * progress);
      bird.model.scale.x = bird.destination.x > bird.start.x ? -crowScale : crowScale;
      bird.model.rotation.z = Math.sin(progress * TAU + bird.phase) * .12;
      const fold = bird.state === 'incoming' ? THREE.MathUtils.smoothstep(progress, .87, 1) : bird.state === 'departing' ? 1 - THREE.MathUtils.smoothstep(progress, 0, .12) : 0;
      bird.legs.visible = bird.state === 'incoming' ? progress > .82 : bird.state === 'departing' && progress < .12;
      setWingPose(bird, elapsed, fold);
      if (progress === 1) {
        if (bird.state === 'incoming') {
          bird.state = 'perched';
          bird.landedAt = gameAge;
          bird.model.rotation.z = trees[bird.perch.treeId].group.rotation.z;
        } else {
          bird.state = 'idle';
          bird.model.visible = false;
        }
      }
    }
    // Resolve waiting arrivals after every bird has updated. A bird that just
    // landed can free its slot before another hit queues a new reaction.
    for (const bird of crowPool) {
      if (bird.state !== 'circling') continue;
      const perch = choosePerch(bird.preferredTree, view);
      if (!perch) continue;
      bird.perch = perch;
      bird.model.userData.perchId = perch.id;
      bird.state = 'incoming';
      bird.start.copy(bird.model.position);
      bird.flightStartsAt = gameAge;
      bird.duration = 3.4 + Math.random() * 1.2;
      perchDestination(bird);
    }
    if (started && gameAge + 1e-8 >= nextArrivalAt) {
      arrive(view);
      nextArrivalAt += crowArrivalInterval;
    }
    const flying = crowPool.some(isFlying);
    if (flying !== flockFlying) {
      flockFlying = flying;
      onCrowFlightChange?.(flying);
    }
  }
  function getCrowFlockState() {
    const active = crowPool.filter((bird) => bird.state !== 'idle');
    return {
      total: active.length, flying: active.filter(isFlying).length,
      perched: active.filter(isGrounded).length,
      pendingStartles: active.filter((bird) => bird.state === 'startle-pending').length,
      startled: active.filter((bird) => bird.state === 'startled').length,
      waves, nextArrivalAt, gameAge, lastWaveSize, poolSize: crowPool.length,
      poolLimit: crowPoolLimit, perchCapacity: crowPerches.length,
      birds: active.map((bird) => ({
        id: bird.id, state: bird.state, perchId: bird.perch?.id ?? null, treeIndex: bird.perch?.treeId ?? null,
        position: bird.model.position.toArray(), startPosition: bird.entryStart.toArray(), flightOrigin: bird.start.toArray(),
        targetPosition: bird.destination.toArray(), scheduledAt: bird.scheduledAt,
        flightStartsAt: bird.flightStartsAt, landedAt: bird.landedAt, reactionAt: bird.reactionAt,
      })),
    };
  }

  function update(dt, elapsed, wind, started) {
    lastSceneElapsed = elapsed;
    wind = THREE.MathUtils.clamp(wind, 0, 1);
    lakeShaderMat.uniforms.uTime.value = elapsed;
    lakeShaderMat.uniforms.uWind.value = wind;
    // Keep the two tree silhouettes, the landing branch and the gate within
    // the narrower field of view used by the game's portrait camera.
    const aspect = window.innerWidth / window.innerHeight || 1.6;
    const cameraDepth = aspect < .8 ? 31 : 19.5;
    const halfView = (z) => Math.tan(24 * Math.PI / 180) * (cameraDepth - z) * aspect;
    trees[0].anchor.position.x = -Math.min(12, halfView(trees[0].anchor.position.z) * .78);
    trees[1].anchor.position.x = Math.min(17.8, halfView(trees[1].anchor.position.z) * .85);
    shrineAnchor.position.x = Math.min(8.7, halfView(shrineAnchor.position.z) * .63);
    clouds.forEach(({ mesh, y, speed, phase }) => {
      mesh.position.x += dt * speed * (.16 + wind * 2.9);
      if (mesh.position.x > 48) mesh.position.x = -48;
      mesh.position.y = y + Math.sin(elapsed * .06 + phase) * .16;
    });
    mists.forEach(({ mesh, x, y, phase }) => {
      mesh.position.x = x + Math.sin(elapsed * .045 + phase) * (2.6 + wind * 2);
      mesh.position.y = y + Math.sin(elapsed * .08 + phase) * .14;
    });
    trees.forEach((tree) => {
      tree.group.rotation.z = -.012 * wind + Math.sin(elapsed * 1.1 + tree.phase) * (.002 + wind * .015);
      tree.clusters.forEach(({ mesh, x, y, phase }) => {
        mesh.position.x = x + wind * .16 + Math.sin(elapsed * 2 + phase) * (.025 + wind * .17);
        mesh.position.y = y + Math.sin(elapsed * 2.9 + phase) * (.012 + wind * .07);
        mesh.rotation.z = Math.sin(elapsed * 1.8 + phase) * (.012 + wind * .07);
      });
    });
    petals.forEach(({ mesh, phase, speed }) => {
      mesh.position.x += dt * (wind * 2.9 + .12) * speed;
      mesh.position.y -= dt * (.12 + wind * .23) * speed;
      mesh.position.y += Math.sin(elapsed * 1.7 + phase) * dt * wind * .28;
      mesh.rotation.x = elapsed * (.5 + wind * 2) + phase;
      mesh.rotation.z = elapsed * (.25 + wind) + phase;
      if (mesh.position.x > 23 || mesh.position.y < -8) mesh.position.set(-14 + random() * 6, 3 + random() * 6, -11 + random() * 10);
    });
    const motePosition = moteGeometry.attributes.position;
    moteData.forEach((data, i) => {
      data.x += dt * (.02 + wind * .28);
      if (data.x > 20) data.x = -20;
      motePosition.setXYZ(i, data.x + Math.sin(elapsed * data.speed + data.phase), data.y + Math.sin(elapsed * .13 + data.phase) * .8, data.z);
    });
    motePosition.needsUpdate = true;
    moteMaterial.opacity = .18 + Math.sin(elapsed * .3) * .04;
    dustTravel += dt * wind * 3.2;
    dustMaterial.opacity = wind * .65;
    const positions = dustGeometry.attributes.position;
    dustData.forEach((data, i) => {
      const travel = (dustTravel * data.speed + data.phase * 2) % 14;
      const spread = .08 + travel * .075;
      positions.setXYZ(i, data.x + travel, data.y + Math.sin(elapsed * .7 + data.phase) * wind * spread - travel * .075, data.z + travel * .045);
    });
    positions.needsUpdate = true;

    updateFlock(dt, elapsed, started, { aspect, cameraDepth });
  }

  return {
    lakeShaderMat, update, reactToShatter, getCrowFlockState,
    getCrowState: () => flockFlying ? 'flying' : waves ? 'perched' : 'waiting',
  };
};
