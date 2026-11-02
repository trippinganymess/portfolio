import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { createSketchRobot, ROBOT_HEIGHT } from './robot';
import { createLandingStation } from './station';
import { createEffects } from './effects';

export function createHomeAnimation({ stage, canvas, flash, robotAnchor, stationElement, launchSound, lightningSound, repairSound, sparkSound, audioLoader, dreamsLink, onStateChange, onUnavailable }) {
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
  const weldLight = new THREE.PointLight(0xdceeff, 0, 240, 2);
  const flashLight = new THREE.PointLight(0xc9dcff, 0, 650, 2);
  scene.add(weldLight, flashLight);

  const robot = createSketchRobot();
  robot.rotation.y = 0.08;
  scene.add(robot);
  mainLight.target = robot;
  rimLight.target = robot;
  const rig = robot.userData;
  const landingStation = createLandingStation();
  scene.add(landingStation);
  const effects = createEffects(scene);
  const motion = { travel: 0, flash: 0, facing: -1 };
  const station = new THREE.Vector3();
  const hover = new THREE.Vector3();
  const impact = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const weldSpot = new THREE.Vector3();
  const torchOffset = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const exhaustPosition = new THREE.Vector3();
  const keyLightOffset = new THREE.Vector3(-170, 280, 330);
  const rimLightOffset = new THREE.Vector3(180, 110, -160);
  let bounds;
  let scale = 1;
  let state = 'intact';
  let timeline = null;
  let resizeObserver = null;
  let frame = 0;
  let disposed = false;
  let lastFrame = null;
  let elapsed = 0;
  let strikeRemaining = 1.8;
  let noteRemaining = 0.65;
  let exhaustRemaining = 0;
  let shortRemaining = 0.4;
  let weldRemaining = 0;
  let discharge = 0;
  let shadowRemaining = 0;
  let welding = false;
  const sounds = [lightningSound, launchSound, repairSound, sparkSound];
  const activeSounds = new Set();
  const resumeSounds = new Set();
  const primedSounds = new Set();
  const soundVersions = new Map(sounds.map(sound => [sound, 0]));

  function nextSoundVersion(sound) {
    const version = soundVersions.get(sound) + 1;
    soundVersions.set(sound, version);
    return version;
  }

  function playCurrentSound(sound) {
    const version = nextSoundVersion(sound);
    sound.play()?.catch(() => {
      // A blocked or cancelled cue must never play later, out of sync.
      if (soundVersions.get(sound) === version) activeSounds.delete(sound);
    });
  }

  function playSound(sound, volume) {
    if (disposed) return;
    resumeSounds.delete(sound);
    if (sound.currentTime !== 0) sound.currentTime = 0;
    sound.muted = false;
    sound.volume = volume;
    activeSounds.add(sound);
    playCurrentSound(sound);
  }

  function pauseSound(sound) {
    nextSoundVersion(sound);
    activeSounds.delete(sound);
    resumeSounds.delete(sound);
    sound.pause();
    sound.muted = false;
  }

  function stopSound(sound) {
    pauseSound(sound);
    if (sound.readyState > 0 && sound.currentTime !== 0) sound.currentTime = 0;
  }

  function primeSounds() {
    if (disposed || document.hidden) return;
    // Unlock the same media elements during a gesture for later timed cues.
    // Priming is muted, so the fan is only audible while the torch is working.
    for (const sound of sounds) {
      if (sound.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) continue;
      if (activeSounds.has(sound) || primedSounds.has(sound)) continue;
      const version = nextSoundVersion(sound);
      const position = sound.currentTime;
      primedSounds.add(sound);
      sound.muted = true;
      sound.play()?.then(() => {
        if (disposed || soundVersions.get(sound) !== version) return;
        sound.pause();
        if (sound.currentTime !== position) sound.currentTime = position;
        sound.muted = false;
      }).catch(() => {
        if (disposed || soundVersions.get(sound) !== version) return;
        primedSounds.delete(sound);
        sound.muted = false;
      });
    }
  }

  function setState(next) {
    state = next;
    onStateChange(next);
  }

  function cancelTimeline() {
    timeline?.kill();
    timeline = null;
    welding = false;
    weldLight.intensity = 0;
    stopSound(launchSound);
    stopSound(repairSound);
    stopSound(sparkSound);
  }

  function newTimeline() {
    cancelTimeline();
    // This clock pauses with the tab, including every callback in the sequence.
    timeline = gsap.timeline({ paused: true });
    return timeline;
  }

  function linkPosition(anchorX, anchorY, target) {
    const link = dreamsLink.getBoundingClientRect();
    target.set(
      link.left + link.width * anchorX - bounds.left - bounds.width / 2,
      bounds.height / 2 - (link.top + link.height * anchorY - bounds.top),
      105,
    );
    return target;
  }

  function updateRobotPosition() {
    const facing = motion.facing < 0 ? Math.min(-0.025, motion.facing) : Math.max(0.025, motion.facing);
    robot.scale.set(scale * facing, scale, scale);
    robot.updateMatrixWorld(true);
    rig.torchTip.getWorldPosition(torchOffset);
    torchOffset.sub(robot.position);
    linkPosition(0.22, 0.4, hover);
    hover.sub(torchOffset);
    hover.z = 80;
    robot.position.lerpVectors(station, hover, motion.travel);
    if (rig.isFlying && !welding) robot.position.y += Math.sin(elapsed * 9) * 0.6;
    mainLight.position.copy(robot.position).add(keyLightOffset);
    rimLight.position.copy(robot.position).add(rimLightOffset);
  }

  function lookAtBrokenButton() {
    robot.updateMatrixWorld(true);
    linkPosition(0.3, 0.4, lookTarget);
    rig.neckAndHeadGroup.worldToLocal(lookTarget);
    lookTarget.sub(rig.headGroup.position);
    return {
      y: lookTarget.x < 0 ? Math.PI : 0,
      z: THREE.MathUtils.clamp(Math.atan2(lookTarget.y, Math.abs(lookTarget.x)) + 0.3, -0.2, 1.65),
    };
  }

  function resize() {
    if (disposed) return;
    bounds = stage.getBoundingClientRect();
    const button = robotAnchor.getBoundingClientRect();
    const dock = stationElement.getBoundingClientRect();
    scale = button.height / ROBOT_HEIGHT;
    robot.scale.set(scale * motion.facing, scale, scale);
    station.set(
      button.left + button.width / 2 - bounds.left - bounds.width / 2,
      bounds.height / 2 - (button.top + button.height / 2 - bounds.top),
      80,
    );
    landingStation.position.set(bounds.width / 2 - dock.width / 2, -bounds.height / 2, 80);
    landingStation.userData.resize(dock.width, dock.height, station.x - landingStation.position.x + 6.3 * scale);
    origin.set(-bounds.width / 2 + 10, bounds.height / 2 - 10, 10);
    linkPosition(0.3, 0.5, impact);
    camera.left = -bounds.width / 2;
    camera.right = bounds.width / 2;
    camera.top = bounds.height / 2;
    camera.bottom = -bounds.height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(bounds.width, bounds.height, false);
    renderer.shadowMap.needsUpdate = true;
    updateRobotPosition();
    if (state === 'broken') Object.assign(rig.headGroup.rotation, lookAtBrokenButton());
    rig.updateHeadphoneWire();
    if (state !== 'intact') effects.resizeStrike(origin, impact);
  }

  function strike() {
    // Never create lightning until BOTH complete strike files are available.
    if (disposed || !audioLoader.canStrike()) return;
    strikeRemaining = null;
    effects.createStrike(origin, linkPosition(0.3, 0.5, impact));
    rig.isBobbing = false;
    setState('broken');
    const reaction = newTimeline();
    // The source's silent lead-in is trimmed to the thunder around 9 seconds.
    playSound(lightningSound, 0.6);
    playSound(sparkSound, 0.3);
    reaction.fromTo(motion, { flash: 0.85 }, { flash: 0, duration: 0.32, ease: 'power3.out' }, 0);
    reaction.to(rig.upperBodyGroup.rotation, { z: -0.035, duration: 0.45, ease: 'back.out(1.4)' }, 0);
    reaction.to(rig.headGroup.rotation, { ...lookAtBrokenButton(), duration: 0.65, ease: 'power2.inOut' }, 0.05);
    reaction.to(rig.elbowGroup.rotation, { z: 0.04, duration: 0.45, ease: 'power2.out' }, 0.05);
  }

  function launch() {
    if (disposed || state !== 'broken' || !audioLoader.canLaunch()) return;
    const repairTimeline = newTimeline();
    motion.flash = 0;
    setState('launching');
    // Start playback inside the user's click so browser autoplay rules are met.
    primeSounds();
    playSound(launchSound, 0.55);
    rig.musicPlayerGroup.visible = false;
    rig.headphoneWireMesh.visible = false;
    repairTimeline.to(motion, { facing: 1, duration: 0.32, ease: 'sine.inOut' });
    repairTimeline.to(rig.headGroup.rotation, { y: 0, z: -0.12, duration: 0.32 }, '<');
    repairTimeline.to(lightningSound, { volume: 0, duration: 0.2 }, 0);
    repairTimeline.call(() => stopSound(lightningSound), [], 0.2);
    repairTimeline.call(() => {
      setState('fixing');
      rig.weldTorchGroup.visible = true;
      rig.flameGroup.visible = true;
      rig.isFlying = true;
    });
    repairTimeline.addLabel('liftOff');
    repairTimeline.to(motion, { travel: 1, duration: 1.7, ease: 'power3.inOut' }, 'liftOff');
    repairTimeline.to(rig.upperBodyGroup.rotation, { z: 0, duration: 0.5 }, '<');
    repairTimeline.to(rig.headGroup.rotation, { z: -0.12, y: 0, duration: 0.5 }, '<');
    repairTimeline.to(rig.shoulderArmGroup.rotation, { z: 0.12, duration: 0.4 }, '-=0.5');
    repairTimeline.to(rig.elbowGroup.rotation, { z: 0.08, duration: 0.4 }, '<');
    repairTimeline.to(launchSound, { volume: 0, duration: 0.3, ease: 'power1.out' }, 'liftOff+=1.4');
    repairTimeline.call(() => {
      stopSound(launchSound);
      stopSound(sparkSound);
      playSound(repairSound, 0.3);
      welding = true;
      weldRemaining = 0;
    });
    repairTimeline.to(rig.handGroup.rotation, { z: 0.055, duration: 0.13, repeat: 11, yoyo: true });
    repairTimeline.to(repairSound, { volume: 0, duration: 0.16 }, '-=0.16');
    repairTimeline.call(() => {
      stopSound(repairSound);
      stopSound(sparkSound);
      welding = false;
      weldLight.intensity = 0;
      rig.weldTorchGroup.visible = false;
      setState('fixed');
      effects.sparks(linkPosition(0.22, 0.4, weldSpot), 14, 0xe6f3ff, 100);
    });
    repairTimeline.addLabel('returnToPad', '+=0.2');
    repairTimeline.call(() => playSound(launchSound, 0.48), [], 'returnToPad');
    repairTimeline.to(motion, { travel: 0, duration: 1.4, ease: 'power3.inOut' }, 'returnToPad');
    repairTimeline.to(rig.shoulderArmGroup.rotation, { z: 0, duration: 0.5 }, '-=0.65');
    repairTimeline.to(rig.elbowGroup.rotation, { z: 0, duration: 0.5 }, '<');
    repairTimeline.to(rig.headGroup.rotation, { z: -0.12, y: 0, duration: 0.5 }, '<');
    repairTimeline.to(rig.handGroup.rotation, { z: 0, duration: 0.5 }, '<');
    repairTimeline.to(launchSound, { volume: 0, duration: 0.18 }, 'returnToPad+=1.22');
    repairTimeline.call(() => {
      stopSound(launchSound);
      rig.flameGroup.visible = false;
      rig.isFlying = false;
    });
    repairTimeline.to(motion, { facing: -1, duration: 0.32, ease: 'sine.inOut' });
    repairTimeline.call(() => {
      rig.musicPlayerGroup.visible = true;
      rig.headphoneWireMesh.visible = true;
      rig.isBobbing = true;
    });
  }

  function hint() {
    if (disposed || state !== 'broken') return;
    effects.shortCircuit(linkPosition(0.3, 0.5, impact), 1.25);
    playSound(sparkSound, 0.3);
    discharge = 4.5;
  }

  function animate(now) {
    if (disposed) return;
    const delta = lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    elapsed += delta;
    // Only the completed thunder and spark downloads unlock this countdown.
    if (strikeRemaining !== null && audioLoader.canStrike()) {
      strikeRemaining -= delta;
      if (strikeRemaining <= 0) strike();
    }
    if (timeline) timeline.totalTime(Math.min(timeline.totalTime() + delta, timeline.totalDuration()));

    if (rig.isBobbing) {
      rig.headGroup.rotation.z = -0.12 + Math.sin(elapsed * 3.8) * 0.035;
      rig.elbowGroup.rotation.z = Math.sin(elapsed * 3.8 - 0.5) * 0.018;
      rig.upperBodyGroup.rotation.z = Math.sin(elapsed * 1.9) * 0.006;
      noteRemaining -= delta;
      if (noteRemaining <= 0) {
        effects.musicNote(robot.position, scale);
        noteRemaining = 1.2;
      }
    }
    updateRobotPosition();
    if (rig.isBobbing || (timeline && timeline.totalTime() < timeline.totalDuration())) rig.updateHeadphoneWire();
    landingStation.userData.update(elapsed, motion.travel);

    if (rig.isFlying) {
      rig.flameGroup.scale.y = 0.9 + Math.sin(elapsed * 55) * 0.14;
      exhaustRemaining -= delta;
      if (exhaustRemaining <= 0) {
        rig.flameGroup.getWorldPosition(exhaustPosition);
        effects.exhaust(exhaustPosition, scale);
        exhaustRemaining = 0.065;
      }
    }
    if (welding) {
      rig.torchTip.getWorldPosition(weldSpot);
      weldLight.position.copy(weldSpot);
      weldLight.position.z += 12;
      weldRemaining -= delta;
      if (weldRemaining <= 0) {
        weldLight.intensity = 2.5 + Math.random() * 5;
        effects.shortCircuit(weldSpot, 0.45);
        effects.sparks(weldSpot, 12, 0xffd39a, 125);
        weldRemaining = 0.055 + Math.random() * 0.08;
      }
    }
    if (['broken', 'launching', 'fixing'].includes(state) && !welding) {
      shortRemaining -= delta;
      if (shortRemaining <= 0) {
        effects.shortCircuit(linkPosition(0.25, 0.45, impact), 0.7 + Math.random() * 0.5);
        playSound(sparkSound, 0.3);
        discharge = 3 + Math.random() * 2;
        shortRemaining = 0.5 + Math.random() * 1.1;
      }
    }
    discharge *= Math.exp(-delta * 22);
    linkPosition(0.25, 0.45, impact);
    flashLight.position.copy(impact);
    flashLight.position.z += 35;
    flashLight.intensity = motion.flash * 10 + discharge;
    flash.style.opacity = String(Math.max(motion.flash, discharge * 0.025));
    flash.style.setProperty('--impact-x', (impact.x + bounds.width / 2).toFixed(1) + 'px');
    flash.style.setProperty('--impact-y', (bounds.height / 2 - impact.y).toFixed(1) + 'px');
    effects.update(delta, elapsed);
    shadowRemaining -= delta;
    if (shadowRemaining <= 0 && (rig.isBobbing || rig.isFlying || (timeline && timeline.totalTime() < timeline.totalDuration()))) {
      renderer.shadowMap.needsUpdate = true;
      shadowRemaining = 1 / 30;
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }

  function visibilityChanged() {
    cancelAnimationFrame(frame);
    lastFrame = null;
    if (document.hidden) {
      for (const sound of sounds) {
        nextSoundVersion(sound);
        if (activeSounds.has(sound) && !sound.ended) resumeSounds.add(sound);
        sound.pause();
        if (!activeSounds.has(sound)) sound.muted = false;
      }
    } else if (!disposed) {
      for (const sound of resumeSounds) {
        if (activeSounds.has(sound)) playCurrentSound(sound);
      }
      resumeSounds.clear();
      frame = requestAnimationFrame(animate);
    }
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
    cancelTimeline();
    sounds.forEach(stopSound);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibilityChanged);
    document.removeEventListener('pointerdown', primeSounds, true);
    document.removeEventListener('keydown', primeSounds, true);
    canvas.removeEventListener('webglcontextlost', contextLost);
    effects.dispose();
    disposeResources(robot);
    disposeResources(landingStation);
    rig.textures.forEach(texture => texture.dispose());
    environment.dispose();
    mainLight.shadow.dispose();
    renderer.dispose();
    flash.style.opacity = '0';
  }

  try {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resizeObserver.observe(robotAnchor);
    resizeObserver.observe(stationElement);
    resizeObserver.observe(dreamsLink.offsetParent);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibilityChanged);
    document.addEventListener('pointerdown', primeSounds, true);
    document.addEventListener('keydown', primeSounds, true);
    canvas.addEventListener('webglcontextlost', contextLost);
    resize();
    if (!document.hidden) {
      frame = requestAnimationFrame(animate);
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return { launch, hint, dispose, isBlocked: () => !disposed && ['broken', 'launching', 'fixing'].includes(state) };
}
