(function () {
  'use strict';

  window.loadCompleteAudio = async function (audio, source, signal) {
    // blob() waits for the entire response body, including its final byte.
    const response = await fetch(source, { signal });
    if (!response.ok) throw new Error('Audio request failed: ' + response.status);
    const blob = await response.blob();
    if (signal?.aborted) throw new DOMException('Audio loading cancelled', 'AbortError');
    const objectUrl = URL.createObjectURL(blob);

    function dispose() {
      if (audio.getAttribute('src') === objectUrl) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      URL.revokeObjectURL(objectUrl);
    }

    try {
      await new Promise((resolve, reject) => {
        function cleanup() {
          audio.removeEventListener('canplaythrough', ready);
          audio.removeEventListener('error', failed);
          signal?.removeEventListener('abort', cancelled);
        }
        function ready() {
          if (audio.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
          cleanup();
          resolve();
        }
        function failed() {
          cleanup();
          reject(audio.error || new Error('Audio could not be decoded'));
        }
        function cancelled() {
          cleanup();
          reject(new DOMException('Audio loading cancelled', 'AbortError'));
        }
        audio.addEventListener('canplaythrough', ready);
        audio.addEventListener('error', failed);
        signal?.addEventListener('abort', cancelled, { once: true });
        audio.setAttribute('data-source', source);
        audio.preload = 'auto';
        audio.src = objectUrl;
        audio.load();
        if (signal?.aborted) cancelled();
        else ready();
      });
      return { dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  };
})();
