import React, { useEffect, useRef } from 'react';
import { createFireflies } from './lib/fireflies';

export default function Fireflies({ enabled = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const animation = createFireflies(canvasRef.current);
    return () => animation.dispose();
  }, [enabled]);

  return enabled ? <canvas ref={canvasRef} className="fireflies" aria-hidden="true" /> : null;
}
