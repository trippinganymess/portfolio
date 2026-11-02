(function () {
  'use strict';
  var deferred = document.currentScript.hasAttribute('data-defer-load');

  // The game shares its parent player's track when opened inside the site.
  var sharedMusic;
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin) {
      sharedMusic = window.parent.siteMusic;
    }
  } catch (error) { /* Standalone playback also works in other embeds. */ }

  var music = sharedMusic || createMusic();
  window.siteMusic = music;
  document.addEventListener('pointerdown', music.play, true);
  document.addEventListener('keydown', music.play, true);
  if (!deferred) music.load();

  function createMusic() {
    var audio = new Audio();
    audio.setAttribute('data-source', '/audio/robot-listening.mp3');
    var loadPromise = null;
    var positionKey = 'messtripping:robot-music-position';
    var savedPosition = 0;
    var suspensions = new Set();
    var pageActive = true;
    audio.preload = 'none';
    audio.loop = true;
    audio.volume = 0.08;

    try { savedPosition = Number(window.sessionStorage.getItem(positionKey)) || 0; }
    catch (error) { /* Playback does not require storage access. */ }

    audio.addEventListener('loadedmetadata', function () {
      if (Number.isFinite(savedPosition) && savedPosition > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = savedPosition % audio.duration;
      }
      play();
    }, { once: true });

    function play() {
      if (!audio.getAttribute('src') || !pageActive || document.hidden || suspensions.size || !audio.paused) return;
      // A denied autoplay attempt is retried inside the next user gesture.
      audio.play().catch(function () {});
    }

    function load() {
      if (!loadPromise) {
        loadPromise = window.loadCompleteAudio(audio, '/audio/robot-listening.mp3').then(function () {
          play();
          return true;
        }).catch(function () {
          loadPromise = null;
          return false;
        });
      }
      return loadPromise;
    }

    function savePosition() {
      if (!audio.readyState) return;
      try { window.sessionStorage.setItem(positionKey, String(audio.currentTime)); }
      catch (error) { /* Keep playing if storage is unavailable. */ }
    }

    function suspend() {
      var token = {};
      suspensions.add(token);
      savePosition();
      audio.pause();
      // Each sequence releases only its own pause, preserving other pauses.
      return function () {
        if (suspensions.delete(token)) play();
      };
    }

    audio.addEventListener('timeupdate', savePosition);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        savePosition();
        audio.pause();
      } else {
        play();
      }
    });
    window.addEventListener('pagehide', function () {
      pageActive = false;
      savePosition();
      audio.pause();
    });
    window.addEventListener('pageshow', function () {
      pageActive = true;
      play();
    });

    return { audio: audio, load: load, play: play, suspend: suspend };
  }
})();
