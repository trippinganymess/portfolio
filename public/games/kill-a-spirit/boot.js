function showError(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-screen').hidden = false;
}

try {
  const { initGame } = await import('./game.js');
  initGame();
  document.querySelector('canvas')?.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showError('The graphics connection was interrupted. Reload to return to the lake.');
  });
} catch (error) {
  console.error('Unable to open Kill a Spirit:', error);
  showError('Please reload in a browser with WebGL 2 and hardware acceleration enabled.');
}
