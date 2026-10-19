import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedFaculty
 * Graduation cap icon with bouncing animation for faculty/teachers
 */

const CSS = `
  .aaf { overflow: visible; }
  .aaf * { transform-box: fill-box; }

  @keyframes aaf-bounce {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-4px) rotate(-2deg); }
    50% { transform: translateY(-6px) rotate(2deg); }
    75% { transform: translateY(-2px) rotate(-1deg); }
  }

  @keyframes aaf-tassel-swing {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-15deg); }
    75% { transform: rotate(15deg); }
  }

  @keyframes aaf-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    20%  { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  .aaf-cap {
    transform-origin: center bottom;
    animation: aaf-bounce calc(2.5s * var(--aaf-k)) ease-in-out calc(0.5s * var(--aaf-k)) both;
  }

  .aaf-tassel {
    transform-origin: 22px 10px;
    animation: aaf-tassel-swing calc(2s * var(--aaf-k)) ease-in-out calc(0.8s * var(--aaf-k)) both;
  }

  .aaf-base {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aaf-draw calc(0.8s * var(--aaf-k)) ease-out both;
  }

  .aaf-top {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aaf-draw calc(0.6s * var(--aaf-k)) ease-out calc(0.3s * var(--aaf-k)) both;
  }

  .aaf-loop .aaf-cap { animation-iteration-count: infinite; }
  .aaf-loop .aaf-tassel { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aaf-cap, .aaf-tassel, .aaf-base, .aaf-top { animation: none; }
  }
`;

const AnimatedFaculty = forwardRef(function AnimatedFaculty(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Faculty',
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
  const classes = ['aaf', loop ? 'aaf-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aaf-k': 1 / Math.max(speed, 0.1), ...style }}
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
        <g className="aaf-cap">
          {/* Base (students) */}
          <path className="aaf-base" d="M6 12v5c3 3 9 3 12 0v-5" pathLength="1" />
          
          {/* Cap top */}
          <path className="aaf-top" d="M2 10l10-5 10 5-10 5z" pathLength="1" />
          
          {/* Tassel */}
          <g className="aaf-tassel">
            <line x1="22" y1="10" x2="22" y2="16" />
          </g>
        </g>
      </g>
    </svg>
  );
});

export default AnimatedFaculty;
