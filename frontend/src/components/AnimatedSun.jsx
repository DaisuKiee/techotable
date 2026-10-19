import React, { useState } from 'react';

// Animated Sun icon: day shift
//
// Timeline (scaled by `speed`, shifted by `delay`):
//   0.00s  core pops in
//   0.30s  rays burst outward one after another while the ring rotates into place
//   1.20s  idle: ring spins slowly, a warm halo radiates from the core,
//          and a wave of "breathing" ripples around the rays
//
// Usage:
//   <AnimatedSun className="w-6 h-6" />
//   <AnimatedSun className="w-8 h-8" color="#f59e0b" rayCount={10} replayOnHover />

const AnimatedSun = ({
  className = '',
  color = 'currentColor',
  glowColor,             // halo color, defaults to `color`
  strokeWidth = 2,
  rayCount = 8,          // 4-12
  speed = 1,             // 1 = default, 2 = twice as fast
  delay = 0,             // seconds before everything starts
  spin = true,           // slow rotation of the rays after the intro
  spinDuration = 20,     // seconds per full revolution (at speed = 1)
  breathe = true,        // rays extend and retract in a wave
  glow = true,           // radiating halo around the core
  replayOnHover = false, // restart the intro on hover
  title = 'Sun',
  style,
  onMouseEnter,
  ...props
}) => {
  const [runKey, setRunKey] = useState(0);

  const handleMouseEnter = (e) => {
    if (replayOnHover) setRunKey((k) => k + 1);
    onMouseEnter?.(e);
  };

  const count = Math.min(Math.max(Math.round(rayCount), 4), 12);
  const step = 360 / count;
  const t = 1 / Math.max(speed, 0.1);

  return (
    <svg
      key={runKey}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={title}
      {...props}
      onMouseEnter={handleMouseEnter}
      style={{
        '--sn-t': `${t}`,
        '--sn-delay': `${delay}s`,
        '--sn-spin': `${spinDuration}`,
        overflow: 'visible',
        ...style,
      }}
    >
      <title>{title}</title>
      <style>{`
        @keyframes sn-core-pop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes sn-ray-out {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes sn-breathe {
          0%, 100% { stroke-dashoffset: 0; }
          50%      { stroke-dashoffset: 0.4; }
        }
        @keyframes sn-spin-in {
          from { transform: rotate(-90deg); }
          to   { transform: rotate(0deg); }
        }
        @keyframes sn-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes sn-halo {
          0%       { transform: scale(1);   opacity: 0; }
          15%      { opacity: 0.4; }
          80%, 100% { transform: scale(1.8); opacity: 0; }
        }

        /* Base styles are the FINAL (static) state. Animations use fill-mode
           "backwards"/"both" to supply the starting state, so reduced motion
           just removes the animations and shows a complete sun. */

        /* Scale/rotate around the sun's own center. transform-box makes the
           origin explicit instead of relying on the viewBox happening to be
           centered on the sun. */
        .sn-core,
        .sn-halo {
          transform-box: fill-box;
          transform-origin: center;
        }
        .sn-rays {
          transform-box: view-box;
          transform-origin: 50% 50%;
        }

        .sn-core {
          animation: sn-core-pop calc(0.45s * var(--sn-t))
                     cubic-bezier(0.34, 1.56, 0.64, 1) var(--sn-delay) both;
        }

        .sn-halo {
          opacity: 0.18;
          animation: sn-halo calc(2.8s * var(--sn-t)) ease-out
                     calc(var(--sn-delay) + 0.5s * var(--sn-t)) infinite backwards;
        }

        /* Ring: rotates into place, then (optionally) spins forever.
           The spin starts exactly where the intro ends, so there is no jump. */
        .sn-rays {
          animation: sn-spin-in calc(0.9s * var(--sn-t)) ease-out
                     calc(var(--sn-delay) + 0.3s * var(--sn-t)) backwards;
        }
        .sn-rays.sn-spin-on {
          animation: sn-spin-in calc(0.9s * var(--sn-t)) ease-out
                     calc(var(--sn-delay) + 0.3s * var(--sn-t)) backwards,
                     sn-spin calc(var(--sn-spin) * 1s * var(--sn-t)) linear
                     calc(var(--sn-delay) + 1.2s * var(--sn-t)) infinite;
        }

        /* Every ray is drawn inner -> outer, so draw-in and retract always
           move the same way. dasharray "1 2" keeps the gap longer than the
           path so no stray round-cap dot appears. --i staggers the rays. */
        .sn-ray {
          stroke-dasharray: 1 2;
          animation: sn-ray-out calc(0.4s * var(--sn-t)) ease-out
                     calc(var(--sn-delay) + 0.3s * var(--sn-t) + var(--i) * 0.05s * var(--sn-t))
                     backwards;
        }
        .sn-ray.sn-breathe {
          animation: sn-ray-out calc(0.4s * var(--sn-t)) ease-out
                     calc(var(--sn-delay) + 0.3s * var(--sn-t) + var(--i) * 0.05s * var(--sn-t))
                     backwards,
                     sn-breathe calc(2s * var(--sn-t)) ease-in-out
                     calc(var(--sn-delay) + 1.3s * var(--sn-t) + var(--i) * 0.12s * var(--sn-t))
                     infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .sn-core, .sn-halo, .sn-rays, .sn-ray {
            animation: none !important;
          }
        }
      `}</style>

      {/* Warm halo behind the core */}
      {glow && (
        <circle
          className="sn-halo"
          cx="12"
          cy="12"
          r="4"
          fill={glowColor || color}
          stroke="none"
        />
      )}

      {/* Core */}
      <circle className="sn-core" cx="12" cy="12" r="4" />

      {/* Rays: one line, rotated into place. Each is drawn inner -> outer. */}
      <g className={`sn-rays${spin ? ' sn-spin-on' : ''}`}>
        {Array.from({ length: count }, (_, i) => (
          <g key={i} transform={`rotate(${step * i} 12 12)`} style={{ '--i': i }}>
            <line
              className={`sn-ray${breathe ? ' sn-breathe' : ''}`}
              x1="12"
              y1="3"
              x2="12"
              y2="1"
              pathLength="1"
            />
          </g>
        ))}
      </g>
    </svg>
  );
};

export default AnimatedSun;