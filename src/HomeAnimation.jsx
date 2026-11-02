import React, { useEffect, useRef, useState } from 'react';
import { createSparkAudio } from './lib/home-animation/audio';
import './home-animation.css';

export function useHomeAnimation() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const robotRef = useRef(null);
  const stationRef = useRef(null);
  const sparkSoundRef = useRef(null);
  const dreamsRef = useRef(null);
  const controllerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false;
    let generation = 0;
    let sparkAudio = null;

    async function start() {
      const currentGeneration = ++generation;
      controllerRef.current?.dispose();
      controllerRef.current = null;
      sparkAudio?.dispose();
      sparkAudio = null;
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
          dreamsLink: dreamsRef.current,
          onUnavailable: () => {
            setReady(false);
            sparkAudio?.dispose();
          },
        });
        sparkAudio = createSparkAudio(sparkSoundRef.current);
        setReady(true);
      } catch {
        // Dreams remains a normal link if the decorative scene cannot load.
        if (!cancelled && currentGeneration === generation) {
          controllerRef.current?.dispose();
          controllerRef.current = null;
          sparkAudio?.dispose();
          sparkAudio = null;
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
      sparkAudio?.dispose();
    };
  }, []);

  return {
    dreamsLinkProps: { ref: dreamsRef, className: 'dreams-link' },
    animation: (
      <div ref={stageRef} className={`home-animation${ready ? ' is-ready' : ''}`} aria-hidden="true">
        <canvas ref={canvasRef} className="home-animation-canvas" />
        <div ref={robotRef} className="home-animation-robot" />
        <div ref={stationRef} className="home-animation-station" />
        <audio ref={sparkSoundRef} data-source="/audio/broken-button-spark.mp3" preload="none" loop />
      </div>
    ),
  };
}
