(function () {
  var selector = 'a, button, [role="button"]';
  var clickSound = new Audio('/audio/ui-click.mp3');
  clickSound.preload = 'auto';
  clickSound.volume = 0.5;
  window.siteClickSound = clickSound;

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element) || !target.closest(selector)) return;
    clickSound.currentTime = 0;
    clickSound.play().catch(function () {});
  }, true);
})();
