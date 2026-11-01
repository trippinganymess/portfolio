/* The game clock supplies the same wind envelope used by the scenery. */
(function () {
  'use strict';

  window.createGameAudio = function ({ onStatusChange = function () {} } = {}) {
    const filenames = {
      music: 'fun-in-kyoto.mp3',
      wind: 'windy-beach-waves.mp3',
      crow: 'crow-reverb.mp3',
    };
    const tracks = {};
    let context = null;
    let master = null;
    let initialized = false;
    let started = false;
    let enabled = true;
    let paused = false;
    let disposed = false;
    let crowFlying = false;
    let wind = 0;
    let startPromise = null;
    let status = '';

    function report(message) {
      if (!disposed && message !== status) {
        status = message;
        onStatusChange(message);
      }
    }

    function active() {
      return started && enabled && !paused && !disposed;
    }

    function wanted(name) {
      return active() && (name !== 'crow' || crowFlying);
    }

    function setGain(node, value, immediate) {
      if (!context || !node || disposed) return;
      node.gain.cancelScheduledValues(context.currentTime);
      if (immediate) node.gain.setValueAtTime(value, context.currentTime);
      else node.gain.setTargetAtTime(value, context.currentTime, 0.08);
    }

    function windGain() {
      // A still lake is silent; the sound rises smoothly as the gust arrives.
      const amount = Math.max(0, Math.min(1, (wind - 0.04) / 0.96));
      return amount * amount * (3 - 2 * amount) * 0.5;
    }

    function updateGains(immediate) {
      if (!initialized) return;
      setGain(master, active() ? 0.85 : 0, true);
      setGain(tracks.music.gain, 0.35, immediate);
      setGain(tracks.wind.gain, windGain(), immediate);
      setGain(tracks.crow.gain, crowFlying ? 0.65 : 0, immediate);
    }

    function describeFailure(name, error) {
      if (disposed || !started) return;
      // Pausing an in-flight play request is normal on mute, pause, or landing.
      if (error && error.name === 'AbortError') return;
      if (error && error.name === 'NotAllowedError') {
        report('Sound is paused by your browser. Reload and enter the dream to retry.');
        return;
      }
      const label = name === 'music' ? 'Background music' : name === 'wind' ? 'Wave audio' : 'Crow audio';
      report(label + ' could not load. You can keep playing.');
    }

    function playTrack(name, prime) {
      const track = tracks[name];
      if (!track || disposed || (!prime && !wanted(name))) return Promise.resolve(false);
      if (track.pending) {
        track.retryAfterAbort = wanted(name);
        return track.pending;
      }
      if (!track.media.paused) return Promise.resolve(true);
      let interrupted = false;
      track.priming = prime;
      try {
        // Called for every element directly inside the initial Start gesture.
        // Web Audio gains keep the wind/crow silent during this unlock step.
        const attempt = track.media.play();
        track.pending = Promise.resolve(attempt).then(function () {
          if (!wanted(name)) track.media.pause();
          return true;
        }).catch(function (error) {
          interrupted = error && error.name === 'AbortError';
          describeFailure(name, error);
          return false;
        }).finally(function () {
          track.pending = null;
          track.priming = false;
          const retry = interrupted && track.retryAfterAbort && wanted(name);
          track.retryAfterAbort = false;
          if (retry) playTrack(name, false);
        });
        return track.pending;
      } catch (error) {
        track.priming = false;
        describeFailure(name, error);
        return Promise.resolve(false);
      }
    }

    function resumeContext() {
      if (!context || context.state === 'closed' || disposed) return Promise.resolve(false);
      if (context.state === 'running') return Promise.resolve(true);
      return context.resume().then(function () { return true; }).catch(function () {
        report('Sound is paused by your browser. Reload and enter the dream to retry.');
        return false;
      });
    }

    function reconcilePlayback() {
      if (!started || !initialized || disposed) return;
      updateGains(false);
      if (active()) {
        resumeContext();
        Object.keys(tracks).forEach(function (name) {
          if (wanted(name)) playTrack(name, false);
          else if (!tracks[name].priming) tracks[name].media.pause();
        });
      } else {
        Object.values(tracks).forEach(function (track) {
          if (!track.priming) track.media.pause();
        });
      }
      // Let initial play() requests finish through silent gains before pausing.
      // Interrupting crow priming here can revoke its later autoplay permission.
      // The master is already silent on pause/mute; keep the unlocked context
      // alive so a pending suspend cannot race a quick unmute or tab return.
    }

    function createTracks() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        report('Audio is unavailable in this browser. You can keep playing.');
        return false;
      }
      try {
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        Object.keys(filenames).forEach(function (name) {
          const media = new Audio(new URL('./audio/' + filenames[name], document.baseURI).href);
          media.preload = 'auto';
          media.loop = true;
          const source = context.createMediaElementSource(media);
          const gain = context.createGain();
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(master);
          const onError = function () { describeFailure(name, media.error); };
          media.addEventListener('error', onError);
          tracks[name] = {
            media: media, source: source, gain: gain, pending: null,
            retryAfterAbort: false, priming: false, onError: onError,
          };
        });
        initialized = true;
        return true;
      } catch (error) {
        report('Audio could not start. You can keep playing.');
        return false;
      }
    }

    function start() {
      if (disposed) return Promise.resolve(false);
      if (started) {
        reconcilePlayback();
        return startPromise || Promise.resolve(initialized);
      }
      started = true;
      if (!createTracks()) return Promise.resolve(false);
      updateGains(true);
      // Do not await resume before play(): all three elements need the gesture.
      const resume = resumeContext();
      const attempts = Object.keys(tracks).map(function (name) { return playTrack(name, true); });
      startPromise = Promise.all([resume].concat(attempts)).then(function (results) {
        if (disposed) return false;
        reconcilePlayback();
        const succeeded = results.every(Boolean);
        if (succeeded) report('');
        return succeeded;
      });
      return startPromise;
    }

    function setEnabled(value) {
      const next = Boolean(value);
      // Routine HUD/visibility synchronization must preserve loading errors.
      if (next && !enabled && initialized) report('');
      enabled = next;
      reconcilePlayback();
    }

    function setPaused(value) {
      paused = Boolean(value);
      reconcilePlayback();
    }

    function update(value) {
      wind = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      if (tracks.wind) setGain(tracks.wind.gain, windGain(), false);
    }

    function setCrowFlying(value) {
      const next = Boolean(value);
      if (next === crowFlying || disposed) return;
      crowFlying = next;
      if (tracks.crow) {
        // Restart the actual supplied call at takeoff, and cut it at landing.
        if (next) {
          try { tracks.crow.media.currentTime = 0; } catch (error) { /* Metadata may still be loading. */ }
        }
        setGain(tracks.crow.gain, next ? 0.65 : 0, true);
      }
      reconcilePlayback();
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      Object.values(tracks).forEach(function (track) {
        track.media.pause();
        track.media.removeEventListener('error', track.onError);
        track.media.removeAttribute('src');
        track.media.load();
        track.source.disconnect();
        track.gain.disconnect();
      });
      if (master) master.disconnect();
      if (context && context.state !== 'closed') context.close().catch(function () {});
    }

    function getState() {
      const trackStates = {};
      Object.keys(tracks).forEach(function (name) {
        const track = tracks[name];
        trackStates[name] = {
          paused: track.media.paused,
          currentTime: track.media.currentTime,
          readyState: track.media.readyState,
          priming: track.priming,
          gain: track.gain.gain.value,
          error: track.media.error ? track.media.error.code : null,
        };
      });
      return {
        started: started,
        enabled: enabled,
        paused: paused,
        disposed: disposed,
        crowFlying: crowFlying,
        wind: wind,
        windGain: windGain(),
        contextState: context ? context.state : 'uninitialized',
        masterGain: master ? master.gain.value : 0,
        status: status,
        tracks: trackStates,
      };
    }

    return {
      start: start,
      setEnabled: setEnabled,
      setPaused: setPaused,
      update: update,
      setCrowFlying: setCrowFlying,
      dispose: dispose,
      getState: getState,
    };
  };
})();
