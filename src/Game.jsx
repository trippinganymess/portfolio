import React, { useEffect, useRef } from 'react';

export default function Game({ onNavigate }) {
  const frameRef = useRef(null);

  useEffect(() => {
    const frame = frameRef.current;
    let frameDocument;
    let gameController;
    function navigateFromFrame(event) {
      gameController = frame.contentWindow?.killASpirit || gameController;
      onNavigate(event);
    }
    function connectNavigation() {
      frameDocument?.removeEventListener('click', navigateFromFrame);
      frameDocument = frame.contentDocument;
      gameController = frame.contentWindow?.killASpirit;
      frameDocument?.addEventListener('click', navigateFromFrame);
    }
    frame.addEventListener('load', connectNavigation);
    connectNavigation();
    return () => {
      frame.removeEventListener('load', connectNavigation);
      frameDocument?.removeEventListener('click', navigateFromFrame);
      gameController?.dispose();
    };
  }, [onNavigate]);

  return (
    <iframe
      ref={frameRef}
      className="game-frame"
      src="/games/kill-a-spirit/index.html"
      title="Kill a Spirit"
      allow="autoplay"
    />
  );
}
