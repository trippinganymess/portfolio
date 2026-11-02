import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createSketchRobot, ROBOT_HEIGHT } from './robot';
import { createLandingStation } from './station';
import { createEffects } from './effects';

export function createHomeAnimation({ stage, canvas, robotAnchor, stationElement, dreamsLink, onUnavailable }) {
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
  const landingStation = createLandingStation();
  scene.add(landingStation);
  const effects = createEffects(scene);
  const station = new THREE.Vector3();
  const sparkOrigin = new THREE.Vector3();
  const keyLightOffset = new THREE.Vector3(-170, 280, 330);
  const rimLightOffset = new THREE.Vector3(180, 110, -160);
  let bounds;
  let scale = 1;
  let resizeObserver = null;
  let frame = 0;
  let disposed = false;
  let lastFrame = null;
  let elapsed = 0;
  let sparkRemaining = 0;
  let noteRemaining = 0.65;
  let shadowRemaining = 0;

  function linkPosition(anchorX, anchorY) {
    const link = dreamsLink.getBoundingClientRect();
    sparkOrigin.set(
      link.left + link.width * anchorX - bounds.left - bounds.width / 2,
      bounds.height / 2 - (link.top + link.height * anchorY - bounds.top),
      105,
    );
    return sparkOrigin;
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
    scale = anchor.height / ROBOT_HEIGHT;
    station.set(
      anchor.left + anchor.width / 2 - bounds.left - bounds.width / 2,
      bounds.height / 2 - (anchor.top + anchor.height / 2 - bounds.top),
      80,
    );
    landingStation.position.set(bounds.width / 2 - dock.width / 2, -bounds.height / 2, 80);
    landingStation.userData.resize(dock.width, dock.height, station.x - landingStation.position.x + 6.3 * scale);
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
    rig.headGroup.rotation.z = -0.12 + Math.sin(elapsed * 3.8) * 0.035;
    rig.elbowGroup.rotation.z = Math.sin(elapsed * 3.8 - 0.5) * 0.018;
    rig.upperBodyGroup.rotation.z = Math.sin(elapsed * 1.9) * 0.006;
    updateRobotPosition();
    rig.updateHeadphoneWire();
    landingStation.userData.update(elapsed);

    noteRemaining -= delta;
    if (noteRemaining <= 0) {
      effects.musicNote(robot.position, scale);
      noteRemaining = 1.2;
    }
    sparkRemaining -= delta;
    if (sparkRemaining <= 0) {
      effects.sparks(linkPosition(0.25 + Math.random() * 0.5, 0.3 + Math.random() * 0.4), 3, 0xd7e7ff, 65);
      sparkRemaining = 0.06;
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
    document.removeEventListener('visibilitychange', visibilityChanged);
    canvas.removeEventListener('webglcontextlost', contextLost);
    effects.dispose();
    disposeResources(robot);
    disposeResources(landingStation);
    rig.textures.forEach(texture => texture.dispose());
    environment.dispose();
    mainLight.shadow.dispose();
    renderer.dispose();
  }

  try {
    resizeObserver = new ResizeObserver(resize);
    for (const element of [stage, robotAnchor, stationElement, dreamsLink, dreamsLink.offsetParent]) {
      if (element) resizeObserver.observe(element);
    }
    window.addEventListener('resize', resize);
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
