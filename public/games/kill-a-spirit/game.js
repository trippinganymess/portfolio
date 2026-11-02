import * as ThreeCore from './vendor/three/build/three.module.js';
import { EffectComposer } from './vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/examples/jsm/postprocessing/OutputPass.js';
import './audio.js';
import './scenery.js';
const THREE = { ...ThreeCore, EffectComposer, RenderPass, UnrealBloomPass };

export function initGame() {
    let gameStarted = false;
    let elapsed = 0;
    let windStrength = 0;
    let lastShatterAt = -Infinity;
    let shakeStrength = 0;
    const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let lastFrameAt = performance.now();
    let disposed = false;
    let graphicsLost = false;
    const isPaused = () => document.hidden || graphicsLost;


    /********************************************************************
     * 1. COLOR PALETTE & CONFIGURATION (From Chalk Drawing Reference)
     ********************************************************************/
    const PALETTE = {
      chalkWhite: 0xeef2f5,
      silverBlue: 0xb8c6d9,
      slateGray: 0x2a2e33,
      blackboardNight: 0x0d0f12,
      warmWood: 0x3b2d26,
      fireflyWarm: 0xffdf9e,
      fireflyIce: 0xcbe0f5
    };

    const CONFIG = {
      catchesToSlay: 8,         // Eight touches fade the spirit all the way to zero
      respawnDelay: 1.25,        // Seconds after blast before new spirit materializes
      spawnGracePeriod: 1.05,    // Seconds of spawn protection while materializing
      collisionRadius: 2.35,     // Touch radius in 3D world units
      fireflyCount: 190
    };

    /********************************************************************
     * 2. WEB AUDIO SYNTHESIZER (Chalk Shatter & Ethereal Night Chimes)
     ********************************************************************/
    class SoundEngine {
      constructor() {
        this.ctx = null;
        this.enabled = false;
        this.master = null;
      }

      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            this.ctx = new AudioCtx();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.65;
            this.master.connect(this.ctx.destination);
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      }

      playBlastSound(luminosity = 1.0) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // 1. Crisp Chalk Shatter / Dust Burst (Filtered White Noise)
        const bufferSize = this.ctx.sampleRate * 0.9;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.22));
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(2200, now);
        bandpass.frequency.exponentialRampToValueAtTime(420, now + 0.75);
        bandpass.Q.value = 1.4;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.32, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        whiteNoise.connect(bandpass);
        bandpass.connect(noiseGain);
        noiseGain.connect(this.master);
        whiteNoise.start(now);

        // 2. Deep Hollow Blackboard Resonance Thump
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(125, now);
        subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.55);

        subGain.gain.setValueAtTime(0.38, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        subOsc.connect(subGain);
        subGain.connect(this.master);
        subOsc.start(now);
        subOsc.stop(now + 0.62);

        // 3. Mystical Silver-Blue Crystalline Chimes
        const baseFreq = 320 + luminosity * 120;
        const ratios = [1, 1.25, 1.5, 1.875, 2.25, 3.0];
        ratios.forEach((ratio, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          const freq = baseFreq * ratio * (0.98 + Math.random() * 0.04);
          osc.frequency.setValueAtTime(freq, now + idx * 0.035);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.992, now + 1.4);

          const peak = (0.09 / (idx + 1)) * (0.4 + 0.6 * luminosity);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(peak, now + idx * 0.035 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35 + idx * 0.12);

          osc.connect(gain);
          gain.connect(this.master);
          osc.start(now + idx * 0.035);
          osc.stop(now + 1.55 + idx * 0.12);
        });
      }

      playSpawnChime(luminosity = 1.0) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * (0.6 + 0.4 * luminosity), now + i * 0.06);

          gain.gain.setValueAtTime(0.0001, now + i * 0.06);
          gain.gain.linearRampToValueAtTime(0.05 * Math.max(0.3, luminosity), now + i * 0.06 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.8);

          osc.connect(gain);
          gain.connect(this.master);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.85);
        });
      }
    }

    const sound = new SoundEngine();

    /********************************************************************
     * 3. PROCEDURAL TEXTURES (Chalk Grain, Glow Sprites, Mist)
     ********************************************************************/
    function createChalkGrainTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#d8e0e8';
      ctx.fillRect(0, 0, 256, 256);

      const imgData = ctx.getImageData(0, 0, 256, 256);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const grain = 175 + Math.random() * 80;
        const streak = Math.sin((i / 4) * 0.03) * 18;
        const val = Math.min(255, Math.max(90, grain + streak));
        data[i] = val;
        data[i + 1] = val + 3;
        data[i + 2] = Math.min(255, val + 8);
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(8, 2);
      return tex;
    }

    function createSoftGlowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.22, 'rgba(238, 242, 245, 0.85)');
      grad.addColorStop(0.5, 'rgba(184, 198, 217, 0.32)');
      grad.addColorStop(1.0, 'rgba(13, 15, 18, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      return new THREE.CanvasTexture(canvas);
    }

    function createMistTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(128, 64, 8, 128, 64, 120);
      grad.addColorStop(0.0, 'rgba(184, 198, 217, 0.22)');
      grad.addColorStop(0.55, 'rgba(42, 46, 51, 0.12)');
      grad.addColorStop(1.0, 'rgba(13, 15, 18, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 128);
      return new THREE.CanvasTexture(canvas);
    }

    const chalkGrainTex = createChalkGrainTexture();
    const glowSpriteTex = createSoftGlowTexture();

    /********************************************************************
     * 4. THREE.JS SCENE, CAMERA, RENDERER & POST-PROCESSING
     ********************************************************************/
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1428);

    const camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    camera.position.set(0, 0.3, window.innerWidth / window.innerHeight < 0.8 ? 31 : 19.5);
    const restingCameraPosition = new THREE.Vector2(0, 0.3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    container.appendChild(renderer.domElement);

    // Selective UnrealBloomPass: High threshold (0.76) so ONLY the Chalk Spirit,
    // Blast Particles & Fireflies glow—keeping the twilight sky, clouds & lake crisp.
    let composer = null;
    let bloomPass = null;
    try {
      const renderPass = new THREE.RenderPass(scene, camera);
      bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.52, // controlled bloom strength
        0.48, // tight radius
        0.76  // high threshold prevents sky/cloud wash-out
      );
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } catch (e) {
      composer = null;
    }

    /********************************************************************
     * 5. LIGHTING (Moody Twilight Rim + Dynamic Chalk Spirit Glow)
     ********************************************************************/
    const ambientLight = new THREE.AmbientLight(0xc8b8d0, 0.48);
    scene.add(ambientLight);

    const twilightDirLight = new THREE.DirectionalLight(0xd98a6c, 0.56);
    twilightDirLight.position.set(-8, 14, 10);
    scene.add(twilightDirLight);

    const lakeBounceLight = new THREE.DirectionalLight(0x247ba0, 0.42);
    lakeBounceLight.position.set(0, -14, 8);
    scene.add(lakeBounceLight);

    // Dynamic PointLight attached to the Chalk Spirit
    const spiritLight = new THREE.PointLight(PALETTE.chalkWhite, 2.2, 24, 1.6);
    scene.add(spiritLight);

    // Transient Blast Flash Light
    const blastFlashLight = new THREE.PointLight(PALETTE.silverBlue, 0, 38, 1.5);
    scene.add(blastFlashLight);

    // One scenery wind field also controls the corresponding recorded ambience.
    const atmosphere = window.createGameAudio({
      onStatusChange(message) {
        document.getElementById('audio-status').textContent = message;
      }
    });
    const scenery = window.createDreamScenery(THREE, scene, {
      onCrowFlightChange(flying) {
        atmosphere.setCrowFlying(flying);
      }
    });
    const { lakeShaderMat } = scenery;

    /********************************************************************
     * 7. ANIMATED 3D FIREFLIES IN THE TWILIGHT NIGHT
     ********************************************************************/
    const firefliesData = [];
    const fireflyPositions = new Float32Array(CONFIG.fireflyCount * 3);
    const fireflyColors = new Float32Array(CONFIG.fireflyCount * 3);

    const colorWarm = new THREE.Color(PALETTE.fireflyWarm);
    const colorIce = new THREE.Color(PALETTE.fireflyIce);
    const colorChalk = new THREE.Color(PALETTE.chalkWhite);

    for (let i = 0; i < CONFIG.fireflyCount; i++) {
      const x = (Math.random() - 0.5) * 38;
      const y = -6.5 + Math.random() * 16;
      const z = -22 + Math.random() * 25;

      fireflyPositions[i * 3] = x;
      fireflyPositions[i * 3 + 1] = y;
      fireflyPositions[i * 3 + 2] = z;

      const baseCol = Math.random() > 0.32 ? colorWarm : (Math.random() > 0.5 ? colorIce : colorChalk);
      fireflyColors[i * 3] = baseCol.r;
      fireflyColors[i * 3 + 1] = baseCol.g;
      fireflyColors[i * 3 + 2] = baseCol.b;

      firefliesData.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        vx: 0,
        vy: 0,
        vz: 0,
        freqX: 0.25 + Math.random() * 0.45,
        freqY: 0.35 + Math.random() * 0.55,
        freqZ: 0.2 + Math.random() * 0.35,
        ampX: 0.8 + Math.random() * 1.8,
        ampY: 0.6 + Math.random() * 1.4,
        ampZ: 0.6 + Math.random() * 1.5,
        pulseSpeed: 1.5 + Math.random() * 3.2,
        phase: Math.random() * Math.PI * 2,
        baseColor: baseCol.clone()
      });
    }

    const fireflyGeo = new THREE.BufferGeometry();
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
    fireflyGeo.setAttribute('color', new THREE.BufferAttribute(fireflyColors, 3));

    const fireflyMat = new THREE.PointsMaterial({
      size: 0.68,
      map: glowSpriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const fireflySystem = new THREE.Points(fireflyGeo, fireflyMat);
    scene.add(fireflySystem);

    /********************************************************************
     * 8. 3D CHALK ARTWORK SCULPTURE BUILDER (Faithful to Chalk Image)
     ********************************************************************/
    function createChalkSpiritModel() {
      const root = new THREE.Group();
      const dynamicMaterials = [];
      const shardCurves = []; // Saved curves for generating 3D line shards upon blast

      // Shared Chalk Materials (emissiveIntensity > 0.76 so the Chalk Spirit blooms radiantly)
      function makeChalkMaterial(hexColor, emissiveHex, emissiveIntensity = 1.15, opacity = 0.98) {
        const mat = new THREE.MeshStandardMaterial({
          color: hexColor,
          emissive: emissiveHex,
          emissiveIntensity: emissiveIntensity,
          map: chalkGrainTex,
          roughness: 0.72,
          metalness: 0.08,
          transparent: true,
          opacity: opacity
        });
        mat.userData.baseEmissiveIntensity = emissiveIntensity;
        mat.userData.baseOpacity = opacity;
        dynamicMaterials.push(mat);
        return mat;
      }

      const primaryChalkMat = makeChalkMaterial(PALETTE.chalkWhite, PALETTE.chalkWhite, 1.22, 0.98);
      const secondaryChalkMat = makeChalkMaterial(PALETTE.silverBlue, PALETTE.silverBlue, 0.98, 0.94);
      const faintChalkMat = makeChalkMaterial(PALETTE.silverBlue, PALETTE.silverBlue, 0.68, 0.78);
      const darkSlateCoreMat = makeChalkMaterial(PALETTE.slateGray, PALETTE.silverBlue, 0.24, 0.90);

      // Helper to add a 3D chalk stroke tube along 3D control points
      function addChalkStroke(pointsArray, radius = 0.042, mat = primaryChalkMat, closed = false, tubularSegments = 48) {
        const vectors = pointsArray.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0));
        const curve = new THREE.CatmullRomCurve3(vectors, closed);
        const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, 7, closed);
        const mesh = new THREE.Mesh(geo, mat);
        root.add(mesh);

        // Save curve samples for blast shards & dust particles
        shardCurves.push({
          points: curve.getPoints(Math.min(28, Math.max(10, Math.floor(tubularSegments / 2)))),
          radius,
          color: mat.color.getHex()
        });
        return mesh;
      }

      /* ================================================================
       * A. CENTRAL ELONGATED FACE OUTLINE & NECK LINES
       * ================================================================ */
      // Main left temple -> slender cheek -> squared-off chin -> lower right jaw
      addChalkStroke([
        [-1.34, 2.08, 0.22],
        [-1.25, 1.38, 0.28],
        [-0.98, 0.62, 0.34],
        [-0.84, -0.15, 0.36],
        [-0.74, -0.82, 0.38],
        [-0.56, -1.16, 0.40],
        [-0.12, -1.20, 0.40],
        [0.26, -1.04, 0.36]
      ], 0.046, primaryChalkMat, false, 56);

      // Right inner cheek / diagonal jaw contour line
      addChalkStroke([
        [0.45, -0.62, 0.34],
        [0.68, 0.02, 0.32],
        [0.92, 0.68, 0.28]
      ], 0.036, primaryChalkMat, false, 28);

      // Three Vertical/Curved Neck Lines Beneath the Chin
      addChalkStroke([
        [-0.28, -1.32, 0.26],
        [-0.25, -1.55, 0.24],
        [-0.22, -1.78, 0.22]
      ], 0.034, primaryChalkMat, false, 18);

      addChalkStroke([
        [0.25, -1.38, 0.26],
        [0.32, -1.78, 0.24],
        [0.40, -2.18, 0.20]
      ], 0.035, primaryChalkMat, false, 20);

      addChalkStroke([
        [0.58, -1.30, 0.26],
        [0.64, -1.68, 0.24],
        [0.70, -2.06, 0.20]
      ], 0.034, primaryChalkMat, false, 20);

      /* ================================================================
       * B. EXPRESSIVE WAVY EYEBROWS (With Left Outward Curl)
       * ================================================================ */
      // Left eyebrow sweeping out into dramatic curl on the left
      addChalkStroke([
        [-2.38, 1.88, 0.32],
        [-1.92, 1.62, 0.36],
        [-1.60, 1.72, 0.40],
        [-1.42, 2.22, 0.44],
        [-1.08, 2.45, 0.46],
        [-0.72, 2.32, 0.45],
        [-0.52, 2.12, 0.42]
      ], 0.052, primaryChalkMat, false, 52);

      // Double-chalk thickening stroke along left brow arch
      addChalkStroke([
        [-1.68, 1.68, 0.38],
        [-1.48, 2.15, 0.42],
        [-1.12, 2.38, 0.44],
        [-0.78, 2.26, 0.43]
      ], 0.034, secondaryChalkMat, false, 32);

      // Left outer eye flick line
      addChalkStroke([
        [-1.82, 1.48, 0.34],
        [-1.56, 1.46, 0.36],
        [-1.34, 1.54, 0.38]
      ], 0.032, secondaryChalkMat, false, 20);

      // Right eyebrow arching across and dipping into right temple wave
      addChalkStroke([
        [-0.36, 2.08, 0.42],
        [0.02, 2.24, 0.45],
        [0.45, 2.28, 0.46],
        [0.82, 2.10, 0.42],
        [1.02, 1.76, 0.38],
        [1.08, 1.48, 0.35],
        [1.36, 1.46, 0.32]
      ], 0.048, primaryChalkMat, false, 48);

      /* ================================================================
       * C. TWO LARGE SWIRLING CHALK EYES & DOUBLE EYELID ARCS
       * ================================================================ */
      const eyeTrackGroups = [];

      function buildSwirlingEye(cx, cy, cz, rx, ry) {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(cx, cy, cz);
        eyeGroup.userData.basePos = new THREE.Vector3(cx, cy, cz);
        root.add(eyeGroup);
        eyeTrackGroups.push(eyeGroup);

        // Dark slate backing disc with silver-blue rim
        const discGeo = new THREE.CircleGeometry(rx * 0.94, 28);
        const discMesh = new THREE.Mesh(discGeo, darkSlateCoreMat);
        discMesh.scale.set(1, ry / rx, 1);
        discMesh.position.z = -0.02;
        eyeGroup.add(discMesh);

        // Outer chalk iris ring
        const ringPts = [];
        for (let i = 0; i <= 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          ringPts.push([
            Math.cos(a) * rx,
            Math.sin(a) * ry,
            0.02
          ]);
        }
        const ringVecs = ringPts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
        const ringCurve = new THREE.CatmullRomCurve3(ringVecs, true);
        const ringMesh = new THREE.Mesh(
          new THREE.TubeGeometry(ringCurve, 40, 0.038, 7, true),
          primaryChalkMat
        );
        eyeGroup.add(ringMesh);

        // Inner swirling silver-blue chalk spiral (matching the scribbled chalk iris!)
        const spiralPts = [];
        const turns = 3.6;
        const steps = 65;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const angle = t * Math.PI * 2 * turns;
          const radX = (0.12 + 0.78 * t) * rx;
          const radY = (0.12 + 0.78 * t) * ry;
          const jitter = Math.sin(i * 1.9) * 0.018;
          spiralPts.push(new THREE.Vector3(
            Math.cos(angle) * (radX + jitter),
            Math.sin(angle) * (radY + jitter),
            0.03 + (1 - t) * 0.04
          ));
        }
        const spiralCurve = new THREE.CatmullRomCurve3(spiralPts);
        const spiralMesh = new THREE.Mesh(
          new THREE.TubeGeometry(spiralCurve, 64, 0.026, 6, false),
          secondaryChalkMat
        );
        eyeGroup.add(spiralMesh);

        // Secondary textured chalk scribble inside iris
        const scribblePts = [];
        for (let i = 0; i <= 28; i++) {
          const t = i / 28;
          const a = -t * Math.PI * 4.5 + 0.8;
          scribblePts.push(new THREE.Vector3(
            Math.cos(a) * rx * 0.58 * t,
            Math.sin(a) * ry * 0.58 * t,
            0.045
          ));
        }
        const scribbleCurve = new THREE.CatmullRomCurve3(scribblePts);
        const scribbleMesh = new THREE.Mesh(
          new THREE.TubeGeometry(scribbleCurve, 36, 0.022, 5, false),
          primaryChalkMat
        );
        eyeGroup.add(scribbleMesh);

        // Record world-offset points for blast shards
        shardCurves.push({
          points: spiralPts.map(v => v.clone().add(new THREE.Vector3(cx, cy, cz))),
          radius: 0.03,
          color: PALETTE.silverBlue
        });
      }

      // Left Eye (slightly higher) & Eyelid / Under-eye Double Arcs
      buildSwirlingEye(-0.98, 1.56, 0.46, 0.28, 0.29);

      // Left upper eyelid crease
      addChalkStroke([
        [-1.30, 1.76, 0.44],
        [-1.12, 1.98, 0.46],
        [-0.88, 2.02, 0.46],
        [-0.70, 1.88, 0.44]
      ], 0.032, primaryChalkMat, false, 28);

      // Left under-eye bag arc 1
      addChalkStroke([
        [-1.25, 1.42, 0.45],
        [-1.02, 1.22, 0.47],
        [-0.78, 1.24, 0.47],
        [-0.62, 1.42, 0.45]
      ], 0.034, primaryChalkMat, false, 28);

      // Left under-eye bag arc 2 (lower double curve)
      addChalkStroke([
        [-1.18, 1.24, 0.44],
        [-0.95, 1.12, 0.46],
        [-0.70, 1.18, 0.45],
        [-0.56, 1.36, 0.44]
      ], 0.030, secondaryChalkMat, false, 28);

      // Right Eye (slightly lower) & Eyelid / Under-eye Arcs
      buildSwirlingEye(0.42, 1.34, 0.46, 0.30, 0.33);

      // Right upper eyelid crease
      addChalkStroke([
        [0.10, 1.72, 0.44],
        [0.42, 1.88, 0.46],
        [0.72, 1.74, 0.45],
        [0.86, 1.48, 0.43]
      ], 0.035, primaryChalkMat, false, 30);

      // Right under-eye curved arc
      addChalkStroke([
        [0.02, 1.36, 0.45],
        [0.14, 1.02, 0.46],
        [0.36, 0.88, 0.46],
        [0.56, 0.86, 0.44]
      ], 0.034, primaryChalkMat, false, 28);

      /* ================================================================
       * D. S-CURVED NOSE & PURSED LIPS
       * ================================================================ */
      // Continuous S-curved nose line down the center
      addChalkStroke([
        [-0.22, 1.44, 0.50],
        [-0.18, 1.18, 0.54],
        [-0.38, 0.96, 0.58],
        [-0.52, 0.74, 0.62],
        [-0.46, 0.54, 0.60],
        [-0.28, 0.52, 0.58],
        [-0.16, 0.60, 0.55],
        [-0.18, 0.42, 0.52]
      ], 0.042, primaryChalkMat, false, 44);

      // Subtle Pursed Lips (> < / cupid's bow & lower mark)
      addChalkStroke([
        [-0.09, 0.08, 0.50],
        [0.01, 0.01, 0.53],
        [0.11, 0.08, 0.50]
      ], 0.032, primaryChalkMat, false, 18);

      addChalkStroke([
        [-0.07, -0.22, 0.48],
        [0.02, -0.16, 0.51],
        [0.10, -0.20, 0.48]
      ], 0.030, primaryChalkMat, false, 18);

      /* ================================================================
       * E. TWO SMALL GLOWING FILLED HEARTS (Lower-Right Cheek/Jaw)
       * ================================================================ */
      function buildChalkHeart(hx, hy, hz, scale, tiltZ) {
        const heartPts = [];
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          const x = 16 * Math.pow(Math.sin(t), 3);
          const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
          heartPts.push([
            hx + (x / 16) * scale * Math.cos(tiltZ) - (y / 16) * scale * Math.sin(tiltZ),
            hy + (x / 16) * scale * Math.sin(tiltZ) + (y / 16) * scale * Math.cos(tiltZ),
            hz
          ]);
        }
        addChalkStroke(heartPts, 0.028, primaryChalkMat, true, 40);

        // Inner dusty silver-blue chalk fill strokes inside the heart
        for (let s = 0.35; s <= 0.72; s += 0.32) {
          const fillPts = heartPts.map(p => [
            hx + (p[0] - hx) * s,
            hy + (p[1] - hy) * s,
            hz - 0.01
          ]);
          addChalkStroke(fillPts, 0.024, secondaryChalkMat, true, 26);
        }
      }

      // Upper Heart & Lower Smaller Heart near right cheek
      buildChalkHeart(1.06, -0.02, 0.42, 0.23, -0.18);
      buildChalkHeart(1.01, -0.44, 0.42, 0.16, -0.12);

      /* ================================================================
       * F. PROMINENT GLOWING 3D CRESCENT MOON (Below Face/Neck)
       * ================================================================ */
      // Outer crescent curve (from upper-left sharp tip sweeping down to bottom center)
      const moonOuter1 = [
        [-1.88, -1.86, 0.46],
        [-1.32, -1.56, 0.50],
        [-0.62, -1.68, 0.52],
        [0.04, -2.18, 0.54],
        [0.48, -2.95, 0.52],
        [0.62, -3.82, 0.48],
        [0.42, -4.68, 0.44],
        [-0.08, -5.25, 0.40]
      ];
      addChalkStroke(moonOuter1, 0.055, primaryChalkMat, false, 64);

      // Double-lined outer crescent contour (matching the double chalk line in drawing)
      const moonOuter2 = moonOuter1.map(p => [p[0] + 0.09, p[1] + 0.05, p[2] - 0.02]);
      addChalkStroke(moonOuter2, 0.036, secondaryChalkMat, false, 56);

      // Inner crescent curve
      const moonInner = [
        [-1.88, -1.86, 0.46],
        [-1.35, -1.96, 0.48],
        [-0.78, -2.35, 0.50],
        [-0.44, -2.98, 0.50],
        [-0.42, -3.72, 0.48],
        [-0.68, -4.32, 0.45],
        [-1.18, -4.58, 0.42]
      ];
      addChalkStroke(moonInner, 0.048, primaryChalkMat, false, 54);

      // Dusty Silver-Blue Chalk Shading Ribs inside the Crescent Moon
      for (let m = 0.22; m <= 0.78; m += 0.26) {
        const ribPts = [];
        const len = Math.min(moonOuter1.length, moonInner.length);
        for (let i = 0; i < len; i++) {
          ribPts.push([
            moonInner[i][0] * (1 - m) + moonOuter1[i][0] * m,
            moonInner[i][1] * (1 - m) + moonOuter1[i][1] * m,
            0.44
          ]);
        }
        addChalkStroke(ribPts, 0.028, faintChalkMat, false, 40);
      }

      /* ================================================================
       * G. INTRICATE SWIRLING CLOUDS & WAVY HAIR TENDRILS (Layered 3D Z-Depth)
       * ================================================================ */
      // 1. High Overarching Crown / Canopy Curve (Top Right of Blackboard)
      addChalkStroke([
        [-0.08, 4.45, -0.18],
        [0.58, 4.58, -0.12],
        [1.18, 4.32, -0.05],
        [1.34, 3.85, 0.02],
        [1.22, 3.38, 0.08],
        [1.56, 2.78, 0.14],
        [2.12, 2.08, 0.18]
      ], 0.048, primaryChalkMat, false, 56);

      // 2. Upper-Left Sweeping Hair & Cloud Border
      addChalkStroke([
        [-2.52, 4.25, -0.12],
        [-2.82, 3.88, -0.06],
        [-2.84, 3.32, 0.0],
        [-3.38, 2.92, 0.06],
        [-3.42, 2.15, 0.12],
        [-3.15, 1.38, 0.18],
        [-2.62, 1.08, 0.24],
        [-2.05, 1.18, 0.28],
        [-2.18, 1.46, 0.28],
        [-2.48, 1.56, 0.26],
        [-2.25, 1.85, 0.25],
        [-2.42, 2.08, 0.22]
      ], 0.044, primaryChalkMat, false, 68);

      // 3. Top-Left Corner Cloud Loops
      addChalkStroke([
        [-3.95, 4.55, -0.25],
        [-3.45, 4.22, -0.20],
        [-3.48, 3.88, -0.16],
        [-3.82, 3.72, -0.14],
        [-3.52, 3.42, -0.12],
        [-4.02, 3.22, -0.15]
      ], 0.038, secondaryChalkMat, false, 38);

      // 4. Mid-Left Billowing Cloud Fingers & Tendrils
      addChalkStroke([
        [-3.88, 0.72, 0.08],
        [-3.32, 0.42, 0.14],
        [-3.52, 0.05, 0.18],
        [-3.02, -0.02, 0.22],
        [-3.48, -0.45, 0.20],
        [-2.85, -0.68, 0.24],
        [-2.28, -0.52, 0.28],
        [-2.02, -0.05, 0.30],
        [-1.78, -0.12, 0.30],
        [-1.75, -0.82, 0.26],
        [-2.45, -1.08, 0.22],
        [-2.82, -1.52, 0.18],
        [-2.42, -2.05, 0.20]
      ], 0.044, primaryChalkMat, false, 72);

      // 5. Lower-Left Swirling Cloud Waves (Beside & Under Crescent Moon)
      addChalkStroke([
        [-3.72, -2.58, 0.12],
        [-3.18, -2.62, 0.18],
        [-3.08, -2.28, 0.22],
        [-2.82, -2.68, 0.24],
        [-2.18, -2.85, 0.28],
        [-1.95, -3.45, 0.26],
        [-2.42, -4.18, 0.24],
        [-1.92, -4.12, 0.28],
        [-1.45, -3.98, 0.32]
      ], 0.042, primaryChalkMat, false, 58);

      addChalkStroke([
        [-3.45, -4.35, 0.16],
        [-2.95, -4.15, 0.20],
        [-2.58, -4.78, 0.24],
        [-2.05, -4.92, 0.28],
        [-1.65, -4.55, 0.32],
        [-1.32, -5.05, 0.34],
        [-0.78, -4.85, 0.36],
        [-0.45, -5.32, 0.36]
      ], 0.042, primaryChalkMat, false, 56);

      // 6. Right-Side Wavy Hair Lock Contour
      addChalkStroke([
        [1.15, 2.34, 0.22],
        [1.44, 2.02, 0.25],
        [1.38, 1.56, 0.26],
        [1.18, 1.18, 0.28],
        [1.62, 0.85, 0.26],
        [1.52, 0.45, 0.28],
        [1.24, 0.28, 0.30]
      ], 0.044, primaryChalkMat, false, 48);

      // 7. Mid-Right Cascading Cloud Curls
      addChalkStroke([
        [2.08, 0.68, 0.12],
        [1.68, 0.25, 0.18],
        [1.88, -0.32, 0.22],
        [1.42, -0.68, 0.26],
        [1.92, -0.92, 0.22],
        [2.48, -0.82, 0.16],
        [2.88, -0.25, 0.10],
        [3.15, -0.28, 0.08]
      ], 0.042, primaryChalkMat, false, 54);

      // 8. Lower-Right Interlocking Cloud Tendrils (Framing Neck & Moon)
      addChalkStroke([
        [0.96, -0.82, 0.32],
        [0.64, -1.18, 0.34],
        [0.68, -1.52, 0.32],
        [0.98, -1.78, 0.30],
        [0.88, -2.18, 0.30],
        [0.58, -2.42, 0.32],
        [0.82, -2.75, 0.30],
        [1.26, -2.78, 0.28],
        [1.18, -3.22, 0.28],
        [0.88, -3.58, 0.30],
        [1.35, -3.95, 0.26],
        [1.62, -4.38, 0.24],
        [0.88, -4.55, 0.28],
        [1.72, -4.92, 0.24],
        [1.52, -5.28, 0.26],
        [0.42, -5.18, 0.32]
      ], 0.045, primaryChalkMat, false, 78);

      // 9. Far Lower-Right Cloud Plumes
      addChalkStroke([
        [1.65, -1.55, 0.18],
        [1.42, -1.92, 0.20],
        [1.88, -2.18, 0.18],
        [2.05, -1.85, 0.16],
        [2.42, -2.28, 0.14],
        [2.28, -2.75, 0.16],
        [1.78, -2.85, 0.20],
        [2.25, -3.28, 0.16],
        [2.02, -4.45, 0.14],
        [2.38, -5.15, 0.12]
      ], 0.038, secondaryChalkMat, false, 60);

      // 10. Deep Parallax Volume Echo Tendrils (Seated slightly behind at Z = -0.38)
      addChalkStroke([
        [-2.75, 2.65, -0.38],
        [-1.85, 3.35, -0.42],
        [-0.45, 3.65, -0.44],
        [0.95, 3.15, -0.40],
        [1.75, 1.85, -0.36]
      ], 0.032, faintChalkMat, false, 40);

      addChalkStroke([
        [-2.35, -1.45, -0.35],
        [-1.35, -2.85, -0.38],
        [0.15, -3.45, -0.38],
        [1.45, -2.45, -0.34]
      ], 0.030, faintChalkMat, false, 36);

      /* ================================================================
       * H. CHALK DUST AURA PARTICLES ORBITING THE SCULPTURE
       * ================================================================ */
      const auraCount = 140;
      const auraPositions = new Float32Array(auraCount * 3);
      for (let i = 0; i < auraCount; i++) {
        const c = shardCurves[i % shardCurves.length];
        const pt = c.points[Math.floor(Math.random() * c.points.length)];
        auraPositions[i * 3] = pt.x + (Math.random() - 0.5) * 0.45;
        auraPositions[i * 3 + 1] = pt.y + (Math.random() - 0.5) * 0.45;
        auraPositions[i * 3 + 2] = pt.z + (Math.random() - 0.5) * 0.45;
      }
      const auraGeo = new THREE.BufferGeometry();
      auraGeo.setAttribute('position', new THREE.BufferAttribute(auraPositions, 3));
      const auraMat = new THREE.PointsMaterial({
        color: PALETTE.chalkWhite,
        size: 0.24,
        map: glowSpriteTex,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      auraMat.userData.baseOpacity = 0.68;
      dynamicMaterials.push(auraMat);

      const auraPoints = new THREE.Points(auraGeo, auraMat);
      root.add(auraPoints);

      // Scale overall sculpture slightly to fit the 3D stage harmoniously
      root.scale.setScalar(0.88);

      return {
        group: root,
        dynamicMaterials,
        shardCurves,
        eyeTrackGroups,
        auraPoints
      };
    }

    // Instantiate the Chalk Spirit
    const spirit = createChalkSpiritModel();
    scene.add(spirit.group);

    /********************************************************************
     * 9. 3D CURSOR RETICLE & TRAIL
     ********************************************************************/
    const cursorGroup = new THREE.Group();
    scene.add(cursorGroup);

    const cursorCoreGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const cursorCoreMat = new THREE.MeshBasicMaterial({
      color: PALETTE.chalkWhite
    });
    const cursorCore = new THREE.Mesh(cursorCoreGeo, cursorCoreMat);
    cursorGroup.add(cursorCore);

    const cursorHaloMat = new THREE.SpriteMaterial({
      map: glowSpriteTex,
      color: PALETTE.silverBlue,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const cursorHalo = new THREE.Sprite(cursorHaloMat);
    cursorHalo.scale.set(1.15, 1.15, 1);
    cursorGroup.add(cursorHalo);

    // Subtle Ring Around Cursor
    const cursorRingGeo = new THREE.RingGeometry(0.24, 0.28, 32);
    const cursorRingMat = new THREE.MeshBasicMaterial({
      color: PALETTE.chalkWhite,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    });
    const cursorRing = new THREE.Mesh(cursorRingGeo, cursorRingMat);
    cursorGroup.add(cursorRing);

    /********************************************************************
     * 10. BLAST SHATTER SYSTEM (Dust Particles, 3D Shards & Shockwaves)
     ********************************************************************/
    const activeBlasts = [];

    function createBlastEffect(originPos, originQuat, scaleVal, luminosity) {
      const blastGroup = new THREE.Group();
      scene.add(blastGroup);

      // 1. 520 Glowing Chalk Dust & Silver-Blue Ember Particles
      const dustCount = 520;
      const dustPos = new Float32Array(dustCount * 3);
      const dustCol = new Float32Array(dustCount * 3);
      const dustVel = [];

      const cWhite = new THREE.Color(PALETTE.chalkWhite);
      const cSilver = new THREE.Color(PALETTE.silverBlue);
      const cWood = new THREE.Color(PALETTE.warmWood);

      for (let i = 0; i < dustCount; i++) {
        // Sample directly from the sculpture's curves for an authentic shatter silhouette
        const curveInfo = spirit.shardCurves[i % spirit.shardCurves.length];
        const localPt = curveInfo.points[Math.floor(Math.random() * curveInfo.points.length)].clone();
        localPt.multiplyScalar(scaleVal);
        localPt.applyQuaternion(originQuat);
        const worldPt = localPt.add(originPos);

        dustPos[i * 3] = worldPt.x;
        dustPos[i * 3 + 1] = worldPt.y;
        dustPos[i * 3 + 2] = worldPt.z;

        // Outward radial velocity + swirl
        const radial = localPt.clone().normalize();
        const speed = 3.5 + Math.random() * 11.5;
        dustVel.push(new THREE.Vector3(
          radial.x * speed + (Math.random() - 0.5) * 4.5,
          radial.y * speed + (Math.random() - 0.5) * 4.5 + 1.2,
          radial.z * speed + (Math.random() - 0.5) * 5.5
        ));

        const colChoice = Math.random() > 0.35 ? cWhite : (Math.random() > 0.2 ? cSilver : cWood);
        const bright = Math.max(0.25, luminosity * 1.15);
        dustCol[i * 3] = colChoice.r * bright;
        dustCol[i * 3 + 1] = colChoice.g * bright;
        dustCol[i * 3 + 2] = colChoice.b * bright;
      }

      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));

      const dustMat = new THREE.PointsMaterial({
        size: 0.36,
        map: glowSpriteTex,
        vertexColors: true,
        transparent: true,
        opacity: Math.max(0.35, luminosity),
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const dustPoints = new THREE.Points(dustGeo, dustMat);
      blastGroup.add(dustPoints);

      // 2. 65+ Tumbling 3D Chalk Line Shards
      const shards = [];
      const shardMat = new THREE.LineBasicMaterial({
        color: PALETTE.chalkWhite,
        transparent: true,
        opacity: Math.max(0.35, luminosity)
      });

      spirit.shardCurves.forEach((curveObj) => {
        const pts = curveObj.points;
        const step = 3;
        for (let i = 0; i < pts.length - step; i += step) {
          const pA = pts[i].clone().multiplyScalar(scaleVal).applyQuaternion(originQuat);
          const pB = pts[i + step].clone().multiplyScalar(scaleVal).applyQuaternion(originQuat);
          const mid = pA.clone().add(pB).multiplyScalar(0.5);

          const localA = pA.clone().sub(mid);
          const localB = pB.clone().sub(mid);

          const lineGeo = new THREE.BufferGeometry().setFromPoints([localA, localB]);
          const lineMesh = new THREE.Line(lineGeo, shardMat);
          lineMesh.position.copy(mid).add(originPos);
          blastGroup.add(lineMesh);

          const outDir = mid.clone().normalize();
          const spd = 4.2 + Math.random() * 8.5;
          shards.push({
            mesh: lineMesh,
            vel: new THREE.Vector3(
              outDir.x * spd + (Math.random() - 0.5) * 3,
              outDir.y * spd + (Math.random() - 0.5) * 3,
              outDir.z * spd + (Math.random() - 0.5) * 4
            ),
            rotVel: new THREE.Vector3(
              (Math.random() - 0.5) * 9,
              (Math.random() - 0.5) * 9,
              (Math.random() - 0.5) * 9
            )
          });
        }
      });

      // 3. Dual Expanding Shockwave Rings
      const ringGeo = new THREE.RingGeometry(0.4, 0.58, 48);
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: PALETTE.chalkWhite,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75 * Math.max(0.3, luminosity),
        blending: THREE.AdditiveBlending
      });
      const ring1 = new THREE.Mesh(ringGeo, ringMat1);
      ring1.position.copy(originPos);
      blastGroup.add(ring1);

      const ringMat2 = new THREE.MeshBasicMaterial({
        color: PALETTE.silverBlue,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55 * Math.max(0.3, luminosity),
        blending: THREE.AdditiveBlending
      });
      const ring2 = new THREE.Mesh(ringGeo, ringMat2);
      ring2.position.copy(originPos);
      ring2.rotation.x = 0.45;
      ring2.rotation.y = -0.35;
      blastGroup.add(ring2);

      // Push nearby fireflies outward from the blast wave
      for (let i = 0; i < firefliesData.length; i++) {
        const f = firefliesData[i];
        const dx = f.baseX - originPos.x;
        const dy = f.baseY - originPos.y;
        const dz = f.baseZ - originPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 120 && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / 11) * 9.5;
          f.vx += (dx / dist) * force;
          f.vy += (dy / dist) * force;
          f.vz += (dz / dist) * force;
        }
      }

      // Trigger Flash Light
      blastFlashLight.position.copy(originPos);
      blastFlashLight.position.z += 2.0;
      blastFlashLight.intensity = 5.5 * Math.max(0.3, luminosity);

      activeBlasts.push({
        group: blastGroup,
        dustPoints,
        dustVel,
        dustMat,
        shards,
        shardMat,
        ring1,
        ringMat1,
        ring2,
        ringMat2,
        age: 0,
        maxAge: 1.85
      });
    }

    /********************************************************************
     * 11. INTERACTIVE STATE, CURSOR CHASE & RESPAWN DIMMING LOGIC
     ********************************************************************/
    const state = {
      generation: 1,
      luminosity: 1.0,
      blastCount: 0,
      chaseSpeedMultiplier: 1.0,
      status: 'ACTIVE', // 'ACTIVE' | 'BLASTED' | 'MATERIALIZING' | 'SLAIN'
      victoryAt: null,
      respawnTimer: 0,
      graceTimer: 0.8,
      spiritPos: new THREE.Vector3(0, 0.5, 0),
      spiritVel: new THREE.Vector3(0, 0, 0),
      cursorWorld: new THREE.Vector3(4.5, 1.5, 0),
      pointerNDC: new THREE.Vector2(0.35, 0.15),
      hasPointerMoved: false
    };

    // Every spirit material, including its aura, reaches exactly zero opacity.
    function applyLuminosityToSpirit(lum) {
      spirit.dynamicMaterials.forEach((mat) => {
        if (mat.emissiveIntensity !== undefined && mat.userData.baseEmissiveIntensity !== undefined) {
          mat.emissiveIntensity = mat.userData.baseEmissiveIntensity * lum;
        }
        if (mat.userData.baseOpacity !== undefined) {
          mat.opacity = mat.userData.baseOpacity * lum;
        }
      });

      spiritLight.intensity = 2.2 * lum;
      lakeShaderMat.uniforms.uSpiritLum.value = lum;

      // Keep the sun and dream atmosphere glowing as the spirit disappears.
      if (bloomPass) bloomPass.strength = 0.58;
    }

    function triggerSpiritBlast() {
      if (!gameStarted || isPaused() || state.status !== 'ACTIVE') return;

      state.status = 'BLASTED';
      state.blastCount++;
      state.respawnTimer = CONFIG.respawnDelay;
      lastShatterAt = elapsed;
      scenery.reactToShatter(spirit.group.position);

      // Play synthesized blast sound
      sound.playBlastSound(state.luminosity);

      // Spawn 3D shatter particles & shards at spirit's current pose
      createBlastEffect(
        spirit.group.position.clone(),
        spirit.group.quaternion.clone(),
        spirit.group.scale.x,
        state.luminosity
      );

      // Hide main spirit until respawn
      spirit.group.visible = false;
      spiritLight.intensity = 0;
      lakeShaderMat.uniforms.uSpiritLum.value = 0.0;
    }

    function spawnNextSpirit() {
      state.luminosity = Math.max(0, 1 - state.blastCount / CONFIG.catchesToSlay);
      applyLuminosityToSpirit(state.luminosity);
      if (state.luminosity === 0) {
        state.status = 'SLAIN';
        state.victoryAt = elapsed;
        spirit.group.visible = false;
        cursorGroup.visible = false;
        document.getElementById('victory-screen').hidden = false;
        return;
      }
      state.generation++;

      // Choose a new spawn position safely away from the current cursor position
      const angle = Math.random() * Math.PI * 2;
      const dist = 5.5 + Math.random() * 3.0;
      let spawnX = state.cursorWorld.x + Math.cos(angle) * dist;
      let spawnY = state.cursorWorld.y + Math.sin(angle) * (dist * 0.65);

      // Keep new spirits reachable in narrow viewports too.
      const stageHalfWidth = Math.min(7.5, Math.tan(camera.fov * Math.PI / 360) * camera.position.z * camera.aspect - 2.2);
      const limitX = Math.max(1.3, stageHalfWidth);
      spawnX = Math.max(-limitX, Math.min(limitX, spawnX));
      spawnY = Math.max(-3.6, Math.min(4.2, spawnY));

      // If still too close to cursor after clamping, flip side
      if (Math.hypot(spawnX - state.cursorWorld.x, spawnY - state.cursorWorld.y) < 4.2) {
        spawnX = state.cursorWorld.x > 0 ? -limitX : limitX;
        spawnY = state.cursorWorld.y > 0 ? -2.2 : 2.5;
      }

      state.spiritPos.set(spawnX, spawnY, 0);
      state.spiritVel.set(0, 0, 0);
      spirit.group.position.copy(state.spiritPos);
      spirit.group.rotation.set(0, 0, 0);
      spirit.group.scale.setScalar(0.05);
      spirit.group.visible = true;

      state.status = 'MATERIALIZING';
      state.graceTimer = CONFIG.spawnGracePeriod;

      sound.playSpawnChime(state.luminosity);
    }

    /********************************************************************
     * 12. POINTER & TOUCH INPUT HANDLING
     ********************************************************************/
    const raycaster = new THREE.Raycaster();
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPoint = new THREE.Vector3();

    function updateCursorFromClientXY(clientX, clientY) {
      state.pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
      state.pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
      state.hasPointerMoved = true;

      raycaster.setFromCamera(state.pointerNDC, camera);
      if (raycaster.ray.intersectPlane(interactionPlane, intersectPoint)) {
        state.cursorWorld.copy(intersectPoint);
        // Keep cursor within comfortable 3D stage bounds
        state.cursorWorld.x = Math.max(-12, Math.min(12, state.cursorWorld.x));
        state.cursorWorld.y = Math.max(-6.5, Math.min(6.5, state.cursorWorld.y));
      }
    }

    function handlePointer(event) {
      if (!gameStarted || isPaused() || state.status === 'SLAIN' || event.target.closest('button, a')) return;
      updateCursorFromClientXY(event.clientX, event.clientY);
    }
    renderer.domElement.addEventListener('pointermove', handlePointer);
    renderer.domElement.addEventListener('pointerdown', handlePointer);
    function syncPause() {
      lastFrameAt = performance.now();
      sound.enabled = gameStarted && !isPaused();
      if (sound.master) sound.master.gain.setTargetAtTime(sound.enabled ? 0.65 : 0, sound.ctx.currentTime, 0.025);
      atmosphere.setPaused(isPaused());
    }
    document.addEventListener('visibilitychange', syncPause);
    renderer.domElement.addEventListener('webglcontextlost', () => {
      graphicsLost = true;
      syncPause();
    });
    document.getElementById('btn-start').addEventListener('click', () => {
      if (gameStarted) return;
      gameStarted = true;
      elapsed = 0;
      lastFrameAt = performance.now();
      state.spiritPos.set(0, 0.5, 0);
      state.spiritVel.set(0, 0, 0);
      state.hasPointerMoved = false;
      sound.init();
      atmosphere.start().catch(() => {});
      syncPause();
      document.getElementById('start-screen').hidden = true;
      renderer.domElement.tabIndex = 0;
      renderer.domElement.focus({ preventScroll: true });
    });
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.position.z = camera.aspect < 0.8 ? 31 : 19.5;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
    });
    function dispose() {
      if (disposed) return;
      disposed = true;
      atmosphere.dispose();
      if (sound.master) sound.master.gain.value = 0;
      if (sound.ctx) sound.ctx.close().catch(() => {});
      if (composer) composer.dispose();
      renderer.dispose();
    }
    window.addEventListener('pagehide', event => {
      atmosphere.setPaused(true);
      if (sound.master) sound.master.gain.value = 0;
      if (!event.persisted) dispose();
    });
    window.addEventListener('pageshow', () => { if (!disposed) syncPause(); });

    /********************************************************************
     * 13. MAIN ANIMATION LOOP
     ********************************************************************/

    function animate() {
      if (disposed) return;
      requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
      lastFrameAt = now;
      if (isPaused()) return;
      elapsed += dt;
      // A smooth 12-second gust passes through every 22 seconds.
      const phase = (elapsed + 3) % 22;
      const naturalGust = phase < 12 ? Math.pow(Math.sin(phase / 12 * Math.PI), 2) : 0;
      windStrength = naturalGust;
      if (state.status === 'SLAIN' && elapsed - state.victoryAt >= 3) {
        document.getElementById('haunting-message').hidden = false;
      }

      // 1. Update 3D Cursor Reticle
      cursorGroup.position.lerp(state.cursorWorld, 0.35);
      cursorRing.rotation.z = elapsed * 1.8;
      const pulseScale = 1.0 + Math.sin(elapsed * 5.0) * 0.12;
      cursorRing.scale.setScalar(pulseScale);

      // 2. Update Chalk Spirit Behaviour (Chasing, Materializing, Collision)
      if (gameStarted && state.status === 'BLASTED') {
        state.respawnTimer -= dt;
        if (state.respawnTimer <= 0) {
          spawnNextSpirit();
        }
      } else if (gameStarted && (state.status === 'MATERIALIZING' || state.status === 'ACTIVE')) {
        if (state.status === 'MATERIALIZING') {
          state.graceTimer -= dt;
          const progress = 1.0 - Math.max(0, state.graceTimer / CONFIG.spawnGracePeriod);
          const easeOutBack = 1 + 1.7 * Math.pow(progress - 1, 3) + 0.7 * Math.pow(progress - 1, 2);
          spirit.group.scale.setScalar(0.88 * Math.max(0.05, easeOutBack));

          if (state.graceTimer <= 0) {
            spirit.group.scale.setScalar(0.88);
            state.status = 'ACTIVE';
          }
        }

        // Smooth Spring-Chase Physics Toward Cursor
        const toCursor = new THREE.Vector3().subVectors(state.cursorWorld, state.spiritPos);
        const accelStrength = 4.4 * state.chaseSpeedMultiplier;
        const dir = toCursor.clone().normalize();
        state.spiritVel.addScaledVector(dir, accelStrength * dt);

        // Gentle idle floating weave
        state.spiritVel.x += Math.cos(elapsed * 1.7) * 0.45 * dt;
        state.spiritVel.y += Math.sin(elapsed * 2.1) * 0.55 * dt;

        // Damping
        const damping = Math.exp(-2.4 * dt);
        state.spiritVel.multiplyScalar(damping);

        // Cap max speed
        const maxSpeed = 5.5 * state.chaseSpeedMultiplier;
        if (state.spiritVel.length() > maxSpeed) {
          state.spiritVel.setLength(maxSpeed);
        }

        state.spiritPos.addScaledVector(state.spiritVel, dt);

        // Apply position + subtle floating Z depth
        spirit.group.position.set(
          state.spiritPos.x,
          state.spiritPos.y + Math.sin(elapsed * 2.3) * 0.14,
          Math.sin(elapsed * 1.4) * 0.25
        );

        // Bank & Rotate 3D Sculpture smoothly toward cursor & velocity vector
        const targetRotY = THREE.MathUtils.clamp(toCursor.x * 0.085, -0.48, 0.48);
        const targetRotX = THREE.MathUtils.clamp(-toCursor.y * 0.065, -0.35, 0.35);
        const targetRotZ = THREE.MathUtils.clamp(-state.spiritVel.x * 0.055, -0.32, 0.32);

        spirit.group.rotation.y = THREE.MathUtils.lerp(spirit.group.rotation.y, targetRotY, 5 * dt);
        spirit.group.rotation.x = THREE.MathUtils.lerp(spirit.group.rotation.x, targetRotX, 5 * dt);
        spirit.group.rotation.z = THREE.MathUtils.lerp(spirit.group.rotation.z, targetRotZ, 5 * dt);

        // Eye-tracking: Both swirling chalk eyes subtly look toward the cursor
        const eyeOffsetX = THREE.MathUtils.clamp(toCursor.x * 0.025, -0.09, 0.09);
        const eyeOffsetY = THREE.MathUtils.clamp(toCursor.y * 0.025, -0.09, 0.09);
        spirit.eyeTrackGroups.forEach((eyeGrp, idx) => {
          eyeGrp.position.x = eyeGrp.userData.basePos.x + eyeOffsetX;
          eyeGrp.position.y = eyeGrp.userData.basePos.y + eyeOffsetY;
          eyeGrp.rotation.z = Math.sin(elapsed * 1.5 + idx) * 0.08;
        });

        // Sync dynamic PointLight & Lake Shader Reflection with Spirit
        spiritLight.position.set(
          spirit.group.position.x,
          spirit.group.position.y + 0.4,
          spirit.group.position.z + 2.2
        );
        lakeShaderMat.uniforms.uSpiritPos.value.copy(spirit.group.position);

        // Check Collision between Cursor and Chalk Spirit (Face + Moon Hitbox)
        if (state.status === 'ACTIVE' && state.hasPointerMoved) {
          const faceCenter = new THREE.Vector2(
            spirit.group.position.x,
            spirit.group.position.y + 0.85
          );
          const moonCenter = new THREE.Vector2(
            spirit.group.position.x - 0.2,
            spirit.group.position.y - 2.1
          );
          const cursor2D = new THREE.Vector2(state.cursorWorld.x, state.cursorWorld.y);

          const dFace = cursor2D.distanceTo(faceCenter);
          const dMoon = cursor2D.distanceTo(moonCenter);

          if (dFace < CONFIG.collisionRadius || dMoon < CONFIG.collisionRadius * 0.95) {
            triggerSpiritBlast();
          }
        }
      }

      // 3. Update Active Blast Shatter Simulations
      for (let i = activeBlasts.length - 1; i >= 0; i--) {
        const b = activeBlasts[i];
        b.age += dt;
        const lifeRatio = b.age / b.maxAge;

        if (lifeRatio >= 1.0) {
          const geometries = new Set();
          const materials = new Set();
          b.group.traverse(object => {
            if (object.geometry) geometries.add(object.geometry);
            if (object.material) materials.add(object.material);
          });
          geometries.forEach(geometry => geometry.dispose());
          materials.forEach(material => material.dispose());
          scene.remove(b.group);
          activeBlasts.splice(i, 1);
          continue;
        }

        // Update Chalk Dust Particles
        const posAttr = b.dustPoints.geometry.attributes.position;
        const drag = Math.exp(-1.85 * dt);
        for (let p = 0; p < b.dustVel.length; p++) {
          const v = b.dustVel[p];
          v.multiplyScalar(drag);
          v.x += (Math.sin(elapsed * 3.0 + p * 0.1) * 1.4 + windStrength * 5) * dt;
          v.y += (Math.cos(elapsed * 2.5 + p * 0.15) * 1.2 + 0.8) * dt;

          posAttr.setXYZ(
            p,
            posAttr.getX(p) + v.x * dt,
            posAttr.getY(p) + v.y * dt,
            posAttr.getZ(p) + v.z * dt
          );
        }
        posAttr.needsUpdate = true;
        b.dustMat.opacity = (1.0 - lifeRatio) * Math.max(0.35, state.luminosity);

        // Update Tumbling 3D Chalk Line Shards
        b.shards.forEach((s) => {
          s.vel.multiplyScalar(drag);
          s.vel.y -= 1.8 * dt;
          s.mesh.position.addScaledVector(s.vel, dt);
          s.mesh.rotation.x += s.rotVel.x * dt;
          s.mesh.rotation.y += s.rotVel.y * dt;
          s.mesh.rotation.z += s.rotVel.z * dt;
        });
        b.shardMat.opacity = Math.pow(1.0 - lifeRatio, 1.4) * Math.max(0.35, state.luminosity);

        // Update Expanding Shockwave Rings
        const ringScale1 = 1.0 + b.age * 14.5;
        b.ring1.scale.setScalar(ringScale1);
        b.ringMat1.opacity = Math.max(0, (1.0 - lifeRatio * 1.25) * 0.65);

        const ringScale2 = 1.0 + b.age * 10.5;
        b.ring2.scale.setScalar(ringScale2);
        b.ringMat2.opacity = Math.max(0, (1.0 - lifeRatio * 1.15) * 0.45);
      }

      // Decay Blast Flash Light
      if (blastFlashLight.intensity > 0.01) {
        blastFlashLight.intensity *= Math.exp(-5.5 * dt);
      } else {
        blastFlashLight.intensity = 0;
      }

      // 4. Animate 190 Night Fireflies
      const ffPos = fireflyGeo.attributes.position;
      const ffCol = fireflyGeo.attributes.color;
      for (let i = 0; i < CONFIG.fireflyCount; i++) {
        const f = firefliesData[i];

        f.vx *= Math.exp(-2.2 * dt);
        f.vy *= Math.exp(-2.2 * dt);
        f.vz *= Math.exp(-2.2 * dt);

        f.baseX += f.vx * dt;
        f.baseY += f.vy * dt;
        f.baseZ += f.vz * dt;

        const fx = f.baseX + Math.sin(elapsed * f.freqX + f.phase) * f.ampX;
        const fy = f.baseY + Math.cos(elapsed * f.freqY + f.phase) * f.ampY;
        const fz = f.baseZ + Math.sin(elapsed * f.freqZ + f.phase * 0.7) * f.ampZ;

        ffPos.setXYZ(i, fx, fy, fz);

        // Asynchronous Firefly Glow Flicker
        const flicker = 0.25 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * f.pulseSpeed + f.phase), 2.2);
        ffCol.setXYZ(
          i,
          f.baseColor.r * flicker,
          f.baseColor.g * flicker,
          f.baseColor.b * flicker
        );
      }
      ffPos.needsUpdate = true;
      ffCol.needsUpdate = true;

      // The same gust envelope drives every wind effect and the wave recording.
      scenery.update(dt, elapsed, windStrength, gameStarted);
      atmosphere.update(windStrength);

      // Subtle Parallax Camera Sway with Cursor
      const camTargetX = state.pointerNDC.x * 0.65;
      const camTargetY = 0.3 + state.pointerNDC.y * 0.45;
      restingCameraPosition.x = THREE.MathUtils.lerp(restingCameraPosition.x, camTargetX, 2.5 * dt);
      restingCameraPosition.y = THREE.MathUtils.lerp(restingCameraPosition.y, camTargetY, 2.5 * dt);
      camera.position.x = restingCameraPosition.x;
      camera.position.y = restingCameraPosition.y;
      camera.lookAt(0, -0.35, -8);
      // A short, bounded tremor settles completely instead of accumulating drift.
      const shatterAge = elapsed - lastShatterAt;
      shakeStrength = !motionPreference?.matches && shatterAge >= 0 && shatterAge < 0.65
        ? Math.pow(1 - shatterAge / 0.65, 2) : 0;
      if (shakeStrength > 0) {
        camera.rotateX(Math.sin(shatterAge * 71) * 0.0022 * shakeStrength);
        camera.rotateY(Math.sin(shatterAge * 89 + 0.7) * 0.0018 * shakeStrength);
        camera.rotateZ(Math.sin(shatterAge * 59) * 0.0012 * shakeStrength);
      }

      // Render via Bloom Composer or Standard Renderer
      if (composer) {
        composer.render(dt);
      } else {
        renderer.render(scene, camera);
      }
    }

    applyLuminosityToSpirit(1.0);
    spirit.group.position.copy(state.spiritPos);
    spirit.group.scale.setScalar(0.88);
    cursorGroup.visible = false;
    renderer.domElement.addEventListener('pointerenter', () => { cursorGroup.visible = gameStarted && state.status !== 'SLAIN'; });
    renderer.domElement.addEventListener('pointerleave', () => { cursorGroup.visible = false; });
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-start').textContent = 'Enter the dream';
    document.getElementById('loading-note').textContent = 'Headphones recommended';
    // The host disposes the dream when its frame is removed.
    window.killASpirit = { dispose, getState: () => ({
      started: gameStarted, paused: isPaused(), elapsed, wind: windStrength,
      crow: scenery.getCrowState(), flock: scenery.getCrowFlockState(), audio: atmosphere.getState(),
      generation: state.generation, blasts: state.blastCount, spirit: state.status,
      opacity: state.luminosity, materialOpacities: spirit.dynamicMaterials.map(material => material.opacity),
      shakeStrength,
      render: { calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries }
    }) };
    animate();
  
}
