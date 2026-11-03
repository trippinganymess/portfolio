import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createSketchRobot, ROBOT_HEIGHT } from './robot';
import { createLandingStation } from './station';
import { createEffects } from './effects';
import { createRobotCrows } from './crows';

export function createHomeAnimation({ stage, canvas, robotAnchor, stationElement, onUnavailable, scrollReactive = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  camera.position.z = 600;

  // A neutral studio environment gives the metal something to reflect.
  const environmentScene = new RoomEnvironment();
  environmentScene.traverse(object => {
    if (object.material?.isMeshBasicMaterial) object.material.color.multiplyScalar(0.08);
    if (object.isLight) object.intensity *= 0.3;
  });
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environment = environmentGenerator.fromScene(environmentScene, 0.045);
  scene.environment = environment.texture;
  environmentGenerator.dispose();
  disposeResources(environmentScene);
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x353861, 0.32));
  const mainLight = new THREE.DirectionalLight(0xfff1db, 1.8);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  Object.assign(mainLight.shadow.camera, { left: -210, right: 210, top: 260, bottom: -210, near: 10, far: 950 });
  mainLight.shadow.camera.updateProjectionMatrix();
  mainLight.shadow.bias = -0.0003;
  mainLight.shadow.normalBias = 0.12;
  mainLight.shadow.radius = 3;
  scene.add(mainLight);
  const rimLight = new THREE.DirectionalLight(0xc3d9ff, 0.85);
  scene.add(rimLight);
  const robot = createSketchRobot();
  robot.rotation.y = 0.08;
  scene.add(robot);
  mainLight.target = robot;
  rimLight.target = robot;
  const rig = robot.userData;
  const crows = createRobotCrows({ scene, robot, onPhaseChange: phase => { stage.dataset.crowState = phase; } });
  const landingStation = createLandingStation();
  scene.add(landingStation);
  const effects = createEffects(scene);
  const station = new THREE.Vector3();
  const keyLightOffset = new THREE.Vector3(-170, 280, 330);
  const rimLightOffset = new THREE.Vector3(180, 110, -160);
  let bounds;
  let scale = 1;
  let resizeObserver = null;
  let frame = 0;
  let disposed = false;
  let lastFrame = null;
  let elapsed = 0;
  let noteRemaining = 0.65;
  let shadowRemaining = 0;
  let fall = scrollReactive ? 1 : 0;
  let thrust = 0;
  let landing = 0;
  let pageProgress = 0;
  let remainingScroll = 0;
  let atEnd = false;
  let dockHeight = 0;
  let scrollSpeed = 0;
  let scrollDirection = 1;
  let previousScroll = window.scrollY;
  let scrollTime = performance.now();
  const upperBodyY = rig.upperBodyGroup.position.y;

  function readJourney() {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - bounds.height);
    const scroll = THREE.MathUtils.clamp(window.scrollY, 0, maxScroll);
    pageProgress = maxScroll ? scroll / maxScroll : 1;
    remainingScroll = maxScroll - scroll;
    atEnd = remainingScroll <= 2;
    const dock = stationElement.getBoundingClientRect();
    landingStation.position.set(
      dock.left + dock.width / 2 - bounds.left - bounds.width / 2,
      bounds.height / 2 - (dock.bottom - bounds.top),
      80,
    );
  }

  function onScroll() {
    const now = performance.now();
    scrollSpeed = THREE.MathUtils.clamp((window.scrollY - previousScroll) / Math.max(now - scrollTime, 16), -3, 3);
    if (Math.abs(window.scrollY - previousScroll) > 0.5) scrollDirection = Math.sign(window.scrollY - previousScroll);
    previousScroll = window.scrollY;
    scrollTime = now;
    readJourney();
  }

  function updateRobotPosition() {
    robot.scale.set(-scale, scale, scale);
    robot.position.copy(station);
    mainLight.position.copy(robot.position).add(keyLightOffset);
    rimLight.position.copy(robot.position).add(rimLightOffset);
  }

  function resize() {
    if (disposed) return;
    bounds = stage.getBoundingClientRect();
    const anchor = robotAnchor.getBoundingClientRect();
    const dock = stationElement.getBoundingClientRect();
    dockHeight = dock.height;
    scale = anchor.height / ROBOT_HEIGHT;
    station.set(
      anchor.left + anchor.width / 2 - bounds.left - bounds.width / 2,
      bounds.height / 2 - (anchor.top + anchor.height / 2 - bounds.top),
      80,
    );
    landingStation.position.set(dock.left + dock.width / 2 - bounds.left - bounds.width / 2, bounds.height / 2 - (dock.bottom - bounds.top), 80);
    landingStation.userData.resize(dock.width, dock.height, station.x - landingStation.position.x + 6.3 * scale);
    if (scrollReactive) readJourney();
    camera.left = -bounds.width / 2;
    camera.right = bounds.width / 2;
    camera.top = bounds.height / 2;
    camera.bottom = -bounds.height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(bounds.width, bounds.height, false);
    renderer.shadowMap.needsUpdate = true;
    updateRobotPosition();
    rig.updateHeadphoneWire();
  }

  function animate(now) {
    if (disposed) return;
    const delta = lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    elapsed += delta;
    const headMotion = crows.advance(delta);
    const moving = scrollReactive && !atEnd;
    const targetFall = moving && scrollDirection > 0 ? 1 : 0;
    const targetThrust = moving && scrollDirection < 0 ? 1 : 0;
    const blend = 1 - Math.exp(-delta * 12);
    fall = THREE.MathUtils.lerp(fall, targetFall, blend);
    thrust = THREE.MathUtils.lerp(thrust, targetThrust, blend);
    landing = THREE.MathUtils.lerp(landing, scrollReactive && atEnd ? 1 : 0, blend);
    const action = Math.max(fall, thrust);
    rig.headGroup.rotation.z = -0.12 + (Math.sin(elapsed * 3.8) * 0.035 + headMotion.roll) * (1 - action) + fall * Math.sin(elapsed * 12) * 0.08 - thrust * 0.16;
    rig.headGroup.rotation.y = headMotion.yaw * (1 - action);
    rig.shoulderArmGroup.rotation.z = fall * (2.55 + Math.sin(elapsed * 14) * 0.1) - thrust * 0.5;
    rig.elbowGroup.rotation.z = Math.sin(elapsed * 3.8 - 0.5) * 0.018 * (1 - action) - fall * 0.9 - thrust * 0.3;
    rig.secondArmGroup.rotation.z = fall * (3.2 - Math.sin(elapsed * 13) * 0.12) - thrust * 0.75;
    rig.secondElbowGroup.rotation.z = -fall * 1.65 - thrust * 0.2;
    rig.secondArmGroup.visible = action > 0.03;
    rig.gestureHandGroup.visible = action > 0.03;
    rig.musicPlayerGroup.visible = action < 0.15;
    rig.headphoneWireMesh.visible = action < 0.15;
    rig.upperBodyGroup.rotation.z = Math.sin(elapsed * 1.9) * 0.006 * (1 - action) + fall * 0.07 - thrust * 0.08 - landing * 0.12;
    rig.upperBodyGroup.position.y = upperBodyY - landing * 12;
    rig.rocketPackGroup.visible = thrust > 0.03;
    for (const [index, jet] of rig.rocketJets.entries()) {
      const flicker = 0.85 + Math.sin(elapsed * 55 + index * 2) * 0.15;
      jet.flame.scale.set(0.85 + thrust * 0.2, thrust * flicker, 1);
      jet.plumeMaterial.opacity = thrust * 0.65;
    }
    updateRobotPosition();
    robot.rotation.z = fall * (Math.sin(elapsed * 8) * 0.06 + scrollSpeed * 0.05) - thrust * 0.09;
    if (scrollReactive) {
      const flightStart = station.y + Math.min(48, bounds.height * 0.06);
      const flightEnd = station.y + Math.min(12, bounds.height * 0.02);
      const progress = THREE.MathUtils.smoothstep(pageProgress, 0, 1);
      const airborneY = THREE.MathUtils.lerp(flightStart, flightEnd, progress) + Math.sin(elapsed * 2.2) * 5;
      robot.position.y = THREE.MathUtils.lerp(airborneY, station.y, landing);
    }
    landingStation.visible = !scrollReactive || remainingScroll < dockHeight + 40;
    mainLight.position.copy(robot.position).add(keyLightOffset);
    rimLight.position.copy(robot.position).add(rimLightOffset);
    stage.dataset.motion = scrollReactive && atEnd ? (landing > 0.96 ? 'landed' : 'landing') : targetThrust || thrust > 0.08 ? 'ascending' : targetFall || fall > 0.08 ? 'falling' : 'idle';
    stage.dataset.atEnd = String(atEnd);
    stage.dataset.pageProgress = pageProgress.toFixed(4);
    stage.dataset.padVisible = String(landingStation.visible);
    stage.dataset.landing = landing.toFixed(3);
    stage.dataset.fall = fall.toFixed(3);
    stage.dataset.thrust = thrust.toFixed(3);
    crows.update(elapsed, bounds, scale);
    rig.updateHeadphoneWire();
    landingStation.userData.update(elapsed);

    noteRemaining -= delta;
    if (noteRemaining <= 0 && action < 0.1) {
      effects.musicNote(robot.position, scale);
      noteRemaining = 1.2;
    }
    effects.update(delta, elapsed);
    shadowRemaining -= delta;
    if (shadowRemaining <= 0) {
      renderer.shadowMap.needsUpdate = true;
      shadowRemaining = 1 / 30;
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }

  function visibilityChanged() {
    cancelAnimationFrame(frame);
    lastFrame = null;
    if (!document.hidden && !disposed) frame = requestAnimationFrame(animate);
  }

  function contextLost(event) {
    event.preventDefault();
    dispose();
    onUnavailable();
  }

  function disposeResources(root) {
    const geometries = new Set();
    const materials = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of [].concat(object.material)) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', visibilityChanged);
    canvas.removeEventListener('webglcontextlost', contextLost);
    effects.dispose();
    crows.dispose();
    delete stage.dataset.crowState;
    delete stage.dataset.motion;
    delete stage.dataset.atEnd;
    delete stage.dataset.pageProgress;
    delete stage.dataset.padVisible;
    delete stage.dataset.landing;
    delete stage.dataset.fall;
    delete stage.dataset.thrust;
    disposeResources(robot);
    disposeResources(landingStation);
    rig.textures.forEach(texture => texture.dispose());
    environment.dispose();
    mainLight.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  try {
    resizeObserver = new ResizeObserver(resize);
    for (const element of [stage, robotAnchor, stationElement]) {
      if (element) resizeObserver.observe(element);
    }
    window.addEventListener('resize', resize);
    if (scrollReactive) {
      window.addEventListener('scroll', onScroll, { passive: true });
      for (const section of document.querySelectorAll('.scroll-section')) resizeObserver.observe(section);
    }
    document.addEventListener('visibilitychange', visibilityChanged);
    canvas.addEventListener('webglcontextlost', contextLost);
    resize();
    if (!document.hidden) frame = requestAnimationFrame(animate);
  } catch (error) {
    dispose();
    throw error;
  }

  return { dispose };
}
