import React, { useState } from 'react';

// Animated DoorOpen icon: rooms / spaces
//
// Timeline (scaled by `speed`, shifted by `delay`):
//   0.00s  door + frame outline draw in
//   0.45s  handle pops
//   0.50s  door swings open on its hinge (overshoots, then settles)
//   0.60s  soft light spills through the doorway
//   1.05s  person steps out of the doorway and walks right
//   1.90s  door starts a slow idle sway (optional)
//
// Usage:
//   <AnimatedDoorOpen className="w-6 h-6" />
//   <AnimatedDoorOpen className="w-8 h-8" color="#6366f1" replayOnHover idle={false} />

const AnimatedDoorOpen = ({
  className = '',
  color = 'currentColor',
  strokeWidth = 2,
  speed = 1,             // 1 = default, 2 = twice as fast
  delay = 0,             // seconds before everything starts
  openAngle = 60,        // final door angle in degrees (clamped to 20-75)
  idle = true,           // slow door sway after the intro
  glow = true,           // soft light spilling through the doorway
  person = true,         // person walking through
  replayOnHover = false, // restart the intro on hover
  title = 'Door Open',
  style,
  onMouseEnter,
  ...props
}) => {
  const [runKey, setRunKey] = useState(0);

  const handleMouseEnter = (e) => {
    if (replayOnHover) setRunKey((k) => k + 1);
    onMouseEnter?.(e);
  };

  const angle = Math.min(Math.max(openAngle, 20), 75);
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
        '--dr-t': `${t}`,
        '--dr-delay': `${delay}s`,
        '--dr-open': `${angle}deg`,
        overflow: 'visible',
        ...style,
      }}
    >
      <title>{title}</title>
      <style>{`
        @keyframes dr-draw {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes dr-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dr-pop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.5); }
          100% { transform: scale(1); }
        }
        /* Same transform function list in every keyframe so it interpolates cleanly.
           No transform-origin in here: it's set once on the element below. */
        @keyframes dr-swing {
          0%   { transform: perspective(60px) rotateY(0deg); }
          60%  { transform: perspective(60px) rotateY(calc(var(--dr-open) + 8deg)); }
          100% { transform: perspective(60px) rotateY(var(--dr-open)); }
        }
        @keyframes dr-sway {
          from { transform: perspective(60px) rotateY(var(--dr-open)); }
          to   { transform: perspective(60px) rotateY(calc(var(--dr-open) - 6deg)); }
        }
        @keyframes dr-walk {
          from { transform: translateX(-9px); opacity: 0; }
          40%  { opacity: 1; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes dr-bob {
          0%, 50%, 100% { transform: translateY(0); }
          25%, 75%      { transform: translateY(-1px); }
        }

        /* Base styles are the FINAL state; animations use fill-mode "both" to
           supply the starting state. Reduced motion just removes the animations. */

        /* Draw-in. The dash gap is slightly longer than the path so no
           round-cap dot shows at the end while the path is "undrawn". */
        .dr-line {
          stroke-dasharray: 1 1.1;
          animation: dr-draw calc(0.55s * var(--dr-t)) ease-out var(--dr-delay) both;
        }

        /* Pivot at the door's own hinge edge. transform-box: fill-box makes
           origin percentages relative to the shape, not the whole viewBox. */
        .dr-door,
        .dr-handle {
          transform-box: fill-box;
        }
        .dr-door {
          transform-origin: 0% 50%;
          transform: perspective(60px) rotateY(var(--dr-open));
          animation: dr-swing calc(0.9s * var(--dr-t)) cubic-bezier(0.22, 1, 0.36, 1)
                     calc(var(--dr-delay) + 0.5s * var(--dr-t)) both;
        }
        .dr-door.dr-idle {
          animation: dr-swing calc(0.9s * var(--dr-t)) cubic-bezier(0.22, 1, 0.36, 1)
                     calc(var(--dr-delay) + 0.5s * var(--dr-t)) both,
                     dr-sway calc(3s * var(--dr-t)) ease-in-out
                     calc(var(--dr-delay) + 1.9s * var(--dr-t)) infinite alternate;
        }

        .dr-handle {
          transform-origin: center;
          animation: dr-pop calc(0.3s * var(--dr-t)) cubic-bezier(0.34, 1.56, 0.64, 1)
                     calc(var(--dr-delay) + 0.45s * var(--dr-t)) both;
        }

        .dr-glow {
          animation: dr-fade calc(0.7s * var(--dr-t)) ease-out
                     calc(var(--dr-delay) + 0.6s * var(--dr-t)) both;
        }

        .dr-person {
          animation: dr-walk calc(0.85s * var(--dr-t)) cubic-bezier(0.25, 0.8, 0.4, 1)
                     calc(var(--dr-delay) + 1.05s * var(--dr-t)) both;
        }
        .dr-bob {
          animation: dr-bob calc(0.85s * var(--dr-t)) ease-in-out
                     calc(var(--dr-delay) + 1.05s * var(--dr-t)) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .dr-line, .dr-door, .dr-handle, .dr-glow, .dr-person, .dr-bob {
            animation: none !important;
          }
        }
      `}</style>

      {/* Soft light spilling through the open doorway (behind everything) */}
      {glow && (
        <path
          className="dr-glow"
          d="M8 5L13 4a2 2 0 0 1 2 2V20L8 19Z"
          fill={color}
          fillOpacity="0.15"
          stroke="none"
        />
      )}

      {/* Door frame (top-right corner + right jamb) */}
      <path className="dr-line" d="M13 4a2 2 0 0 1 2 2v14" pathLength="1" />

      {/* Person: outer group walks, inner group bobs, so transforms don't clash */}
      {person && (
        <g className="dr-person">
          <g className="dr-bob">
            <circle cx="20.5" cy="9" r="2" />
            <path d="M18.5 20v-4a2 2 0 0 1 4 0v4" />
          </g>
        </g>
      )}

      {/* Door panel + handle share one group so they always move together */}
      <g className={`dr-door${idle ? ' dr-idle' : ''}`}>
        <path className="dr-line" d="M13 4H5a2 2 0 0 0-2 2v14h10Z" pathLength="1" />
        <circle className="dr-handle" cx="10.5" cy="12" r="1" fill={color} stroke="none" />
      </g>
    </svg>
  );
};

export default AnimatedDoorOpen;