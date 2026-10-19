import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedStudents
 * Multiple users icon with wave animation for student groups
 */

const CSS = `
  .aas { overflow: visible; }
  .aas * { transform-box: fill-box; }

  @keyframes aas-wave {
    0%, 100% { opacity: 1; transform: translateY(0); }
    50% { opacity: 0.85; transform: translateY(-2px); }
  }

  @keyframes aas-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    20%  { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  @keyframes aas-fade-slide {
    0%   { opacity: 0; transform: translateX(-3px); }
    100% { opacity: 1; transform: translateX(0); }
  }

  /* Sequential drawing */
  .aas-front-body {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aas-draw calc(0.5s * var(--aas-k)) ease-out both;
  }

  .aas-front-head {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aas-draw calc(0.4s * var(--aas-k)) ease-out calc(0.2s * var(--aas-k)) both;
  }

  .aas-back {
    animation: aas-fade-slide calc(0.6s * var(--aas-k)) ease-out calc(0.4s * var(--aas-k)) both;
  }

  .aas-back-body {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aas-draw calc(0.4s * var(--aas-k)) ease-out calc(0.6s * var(--aas-k)) both;
  }

  .aas-back-head {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aas-draw calc(0.3s * var(--aas-k)) ease-out calc(0.8s * var(--aas-k)) both;
  }

  /* Wave animations */
  .aas-front-body { animation: aas-draw calc(0.5s * var(--aas-k)) ease-out both, aas-wave calc(3s * var(--aas-k)) ease-in-out calc(1.2s * var(--aas-k)) both; }
  .aas-front-head { animation: aas-draw calc(0.4s * var(--aas-k)) ease-out calc(0.2s * var(--aas-k)) both, aas-wave calc(3s * var(--aas-k)) ease-in-out calc(1.4s * var(--aas-k)) both; }
  .aas-back-body-wave { animation: aas-wave calc(3s * var(--aas-k)) ease-in-out calc(1.6s * var(--aas-k)) both; }
  .aas-back-head-wave { animation: aas-wave calc(3s * var(--aas-k)) ease-in-out calc(1.8s * var(--aas-k)) both; }

  .aas-loop .aas-front-body,
  .aas-loop .aas-front-head,
  .aas-loop .aas-back-body-wave,
  .aas-loop .aas-back-head-wave { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aas-front-body, .aas-front-head, .aas-back, .aas-back-body, .aas-back-head, .aas-back-body-wave, .aas-back-head-wave { animation: none; }
  }
`;

const AnimatedStudents = forwardRef(function AnimatedStudents(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Students',
    style,
    onMouseEnter,
    onFocus,
    ...props
  },
  ref
) {
  const [runId, setRunId] = useState(0);
  const replay = useCallback(() => setRunId((n) => n + 1), []);

  const handleMouseEnter = (e) => {
    if (replayOnHover) replay();
    onMouseEnter?.(e);
  };
  const handleFocus = (e) => {
    if (replayOnHover) replay();
    onFocus?.(e);
  };

  const decorative = title === null;
  const classes = ['aas', loop ? 'aas-loop' : '', className].filter(Boolean).join(' ');

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={classes}
      style={{ '--aas-k': 1 / Math.max(speed, 0.1), ...style }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      {...props}
    >
      {!decorative && <title>{title}</title>}
      <style>{CSS}</style>

      <g key={runId}>
        {/* Back user (drawn first so front user overlaps) */}
        <g className="aas-back">
          <g className="aas-back-body-wave">
            <path className="aas-back-body" d="M22 21v-2a4 4 0 0 0-3-3.87" pathLength="1" />
          </g>
          <g className="aas-back-head-wave">
            <path className="aas-back-head" d="M16 3.13a4 4 0 0 1 0 7.75" pathLength="1" />
          </g>
        </g>

        {/* Front user */}
        <path className="aas-front-body" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" pathLength="1" />
        <circle className="aas-front-head" cx="9" cy="7" r="4" pathLength="1" />
      </g>
    </svg>
  );
});

export default AnimatedStudents;
