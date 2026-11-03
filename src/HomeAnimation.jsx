import React, { useEffect, useRef, useState } from 'react';
import './home-animation.css';

export function useHomeAnimation({ persistent = false } = {}) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const robotRef = useRef(null);
  const stationRef = useRef(null);
  const controllerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false;
    let generation = 0;

    async function start() {
      const currentGeneration = ++generation;
      controllerRef.current?.dispose();
      controllerRef.current = null;
      setReady(false);
      if (motion.matches) return;

      try {
        const { createHomeAnimation } = await import('./lib/home-animation/controller');
        if (cancelled || currentGeneration !== generation) return;
        controllerRef.current = createHomeAnimation({
          stage: stageRef.current,
          canvas: canvasRef.current,
          robotAnchor: robotRef.current,
          stationElement: stationRef.current,
          onUnavailable: () => {
            setReady(false);
          },
          scrollReactive: persistent,
        });
        setReady(true);
      } catch {
        // Dreams remains a normal link if the decorative scene cannot load.
        if (!cancelled && currentGeneration === generation) {
          controllerRef.current?.dispose();
          controllerRef.current = null;
          setReady(false);
        }
      }
    }

    start();
    motion.addEventListener('change', start);
    return () => {
      cancelled = true;
      generation++;
      motion.removeEventListener('change', start);
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [persistent]);

  return {
    animation: (
      <>
        <div ref={stageRef} className={`home-animation${persistent ? ' home-animation-persistent' : ''}${ready ? ' is-ready' : ''}`} aria-hidden="true">
          <canvas ref={canvasRef} className="home-animation-canvas" />
          <div ref={robotRef} className="home-animation-robot" />
          {!persistent && <div ref={stationRef} className="home-animation-station" />}
        </div>
        {persistent && <div ref={stationRef} className="home-animation-page-station" aria-hidden="true" />}
      </>
    ),
  };
}
