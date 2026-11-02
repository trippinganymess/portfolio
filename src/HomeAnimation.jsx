import React, { useEffect, useRef, useState } from 'react';
import { createHomeAudioLoader } from './lib/home-animation/audio';
import './home-animation.css';

const messages = {
  intact: '',
  broken: 'Lightning broke Dreams. Use Launch on the landing pad to send the robot.',
  launching: 'The robot is launching.',
  fixing: 'The robot is repairing Dreams.',
  fixed: 'Dreams is repaired. You can enter now.',
};

export function useHomeAnimation() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const flashRef = useRef(null);
  const robotRef = useRef(null);
  const stationRef = useRef(null);
  const launchRef = useRef(null);
  const launchSoundRef = useRef(null);
  const lightningSoundRef = useRef(null);
  const repairSoundRef = useRef(null);
  const sparkSoundRef = useRef(null);
  const dreamsRef = useRef(null);
  const controllerRef = useRef(null);
  const [state, setState] = useState('intact');
  const [ready, setReady] = useState(false);
  const [flightReady, setFlightReady] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false;
    let generation = 0;
    let audioLoader = null;

    async function start() {
      const currentGeneration = ++generation;
      controllerRef.current?.dispose();
      controllerRef.current = null;
      audioLoader?.dispose();
      audioLoader = null;
      setReady(false);
      setFlightReady(false);
      setState('intact');
      if (motion.matches) return;

      const currentAudioLoader = createHomeAudioLoader({
        lightningSound: lightningSoundRef.current,
        sparkSound: sparkSoundRef.current,
        launchSound: launchSoundRef.current,
        repairSound: repairSoundRef.current,
        onFlightReady: () => {
          if (!cancelled && currentGeneration === generation) setFlightReady(true);
        },
      });
      audioLoader = currentAudioLoader;

      try {
        const { createHomeAnimation } = await import('./lib/home-animation/controller');
        if (cancelled || currentGeneration !== generation) return;
        controllerRef.current = createHomeAnimation({
          stage: stageRef.current,
          canvas: canvasRef.current,
          flash: flashRef.current,
          robotAnchor: robotRef.current,
          stationElement: stationRef.current,
          launchSound: launchSoundRef.current,
          lightningSound: lightningSoundRef.current,
          repairSound: repairSoundRef.current,
          sparkSound: sparkSoundRef.current,
          audioLoader: currentAudioLoader,
          dreamsLink: dreamsRef.current,
          onStateChange: setState,
          onUnavailable: () => {
            setReady(false);
            setState('intact');
          },
        });
        setReady(true);
      } catch {
        currentAudioLoader.dispose();
        // Navigation remains available when WebGL cannot be initialized.
        if (!cancelled && currentGeneration === generation) {
          setReady(false);
          setState('intact');
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
      audioLoader?.dispose();
    };
  }, []);

  const blocked = ready && ['broken', 'launching', 'fixing'].includes(state);

  return {
    dreamsLinkProps: {
      ref: dreamsRef,
      className: `dreams-link dreams-link--${state}`,
      'aria-disabled': blocked || undefined,
      'aria-describedby': blocked ? 'home-animation-status' : undefined,
      onClick(event) {
        if (!controllerRef.current?.isBlocked()) return;
        event.preventDefault();
        if (state === 'broken') {
          controllerRef.current.hint();
          launchRef.current?.focus({ preventScroll: true });
        }
      },
    },
    animation: (
      <div ref={stageRef} className={`home-animation${ready ? ' is-ready' : ''}`} data-state={state}>
        <canvas ref={canvasRef} className="home-animation-canvas" aria-hidden="true" />
        <div ref={flashRef} className="home-animation-flash" aria-hidden="true" />
        <div ref={robotRef} className="home-animation-robot" aria-hidden="true" />
        <div ref={stationRef} className="home-animation-station">
          <button
            ref={launchRef}
            className="home-animation-launch"
            type="button"
            aria-label="Launch robot"
            aria-describedby="home-animation-status"
            hidden={!ready}
            disabled={!ready || !flightReady || state !== 'broken'}
            onClick={() => controllerRef.current?.launch()}
          >
            <span className="launch-indicator" aria-hidden="true" />
            <span>Launch</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M 8 12 V 3 M 4 7 L 8 3 L 12 7 M 4 13 H 12" />
            </svg>
          </button>
        </div>
        <audio ref={lightningSoundRef} data-source="/audio/lightning-strike.mp3" preload="none" aria-hidden="true" />
        <audio ref={launchSoundRef} data-source="/audio/robot-launch.mp3" preload="none" aria-hidden="true" />
        <audio ref={repairSoundRef} data-source="/audio/robot-repair.mp3" preload="none" loop aria-hidden="true" />
        <audio ref={sparkSoundRef} data-source="/audio/broken-button-spark.mp3" preload="none" aria-hidden="true" />
        <p id="home-animation-status" className="home-animation-status" role="status">{state === 'broken' && !flightReady ? 'Lightning broke Dreams. The robot is getting ready to launch.' : messages[state]}</p>
      </div>
    ),
  };
}
