export function createSparkAudio(sound) {
  const abortController = new AbortController();
  let resource = null;
  let disposed = false;
  let loaded = false;

  sound.loop = true;
  sound.volume = 0.3;

  function play() {
    if (disposed || !loaded || document.hidden || !sound.paused) return;
    // Gestures retry playback when the browser blocks background audio.
    sound.play()?.catch(() => {});
  }

  function visibilityChanged() {
    if (document.hidden) sound.pause();
    else play();
  }

  document.addEventListener('pointerdown', play, true);
  document.addEventListener('keydown', play, true);
  document.addEventListener('visibilitychange', visibilityChanged);

  window.loadCompleteAudio(sound, '/audio/broken-button-spark.mp3', abortController.signal)
    .then(loadedResource => {
      if (disposed) {
        loadedResource.dispose();
        return;
      }
      resource = loadedResource;
      loaded = true;
      play();
    })
    .catch(() => { /* Visual sparks and navigation remain available without audio. */ });

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('pointerdown', play, true);
      document.removeEventListener('keydown', play, true);
      document.removeEventListener('visibilitychange', visibilityChanged);
      abortController.abort();
      sound.pause();
      resource?.dispose();
    },
  };
}
