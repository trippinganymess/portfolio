import React, { useEffect, useRef } from 'react';

export function useDreamsSpark(enabled) {
  const linkRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let controller;
    let cancelled = false;
    let generation = 0;
    async function start() {
      const current = ++generation;
      controller?.dispose();
      controller = null;
      if (motion.matches) return;
      try {
        const { createNavSpark } = await import('./lib/home-animation/nav-spark');
        if (cancelled || current !== generation) return;
        controller = createNavSpark({ canvas: canvasRef.current, link: linkRef.current });
      } catch {
        // The ordinary Dreams link works without the decorative canvas.
      }
    }
    start();
    motion.addEventListener('change', start);
    return () => {
      cancelled = true;
      generation++;
      motion.removeEventListener('change', start);
      controller?.dispose();
    };
  }, [enabled]);

  return {
    linkRef,
    spark: enabled ? <canvas ref={canvasRef} className="dreams-spark" aria-hidden="true" /> : null,
  };
}
