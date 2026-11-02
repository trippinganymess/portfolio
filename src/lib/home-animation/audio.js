export function createHomeAudioLoader({ lightningSound, sparkSound, launchSound, repairSound, listeningMusic, onFlightReady }) {
  const abortController = new AbortController();
  const loaded = new Set();
  let strikeLoaded = false;
  let flightLoaded = false;
  let disposed = false;

  async function load(sound, source) {
    const resource = await window.loadCompleteAudio(sound, source, abortController.signal);
    if (disposed) {
      resource.dispose();
      return;
    }
    loaded.add(resource);
  }

  // These two full downloads and decoder checks must finish before stage two.
  Promise.all([
    load(lightningSound, '/audio/lightning-strike.mp3'),
    load(sparkSound, '/audio/broken-button-spark.mp3'),
  ]).then(() => {
    if (disposed) return;
    strikeLoaded = true;

    Promise.all([
      load(launchSound, '/audio/robot-launch.mp3'),
      load(repairSound, '/audio/robot-repair.mp3'),
    ]).then(() => {
      if (disposed) return;
      flightLoaded = true;
      onFlightReady();
    }).catch(() => { /* Launch stays disabled if a robot cue cannot load. */ });
    listeningMusic.load();
  }).catch(() => {
    // A failed strike cue leaves Dreams intact and navigation available.
    dispose();
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    loaded.forEach(resource => resource.dispose());
    loaded.clear();
  }

  function ready(sounds) {
    return !disposed && sounds.every(sound => sound.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA);
  }

  return {
    canStrike: () => strikeLoaded && ready([lightningSound, sparkSound]),
    canLaunch: () => flightLoaded && !disposed,
    dispose,
  };
}
