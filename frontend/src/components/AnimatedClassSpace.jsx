import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedClassSpace
 * Grid layout icon with sequential pulse animation for class spaces
 */

const CSS = `
  .aacs { overflow: visible; }
  .aacs * { transform-box: fill-box; }

  @keyframes aacs-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    20%  { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  @keyframes aacs-pulse {
    0%, 100% { opacity: 1; fill: none; }
    50% { opacity: 0.5; fill: currentColor; fill-opacity: 0.15; }
  }

  @keyframes aacs-pop {
    0%   { transform: scale(0); opacity: 0; }
    50%  { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  /* Sequential drawing of grid squares */
  .aacs-grid-1 {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    transform-origin: center;
    animation: 
      aacs-draw calc(0.4s * var(--aacs-k)) ease-out both,
      aacs-pop calc(0.5s * var(--aacs-k)) cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .aacs-grid-2 {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    transform-origin: center;
    animation: 
      aacs-draw calc(0.4s * var(--aacs-k)) ease-out calc(0.15s * var(--aacs-k)) both,
      aacs-pop calc(0.5s * var(--aacs-k)) cubic-bezier(0.34, 1.56, 0.64, 1) calc(0.15s * var(--aacs-k)) both;
  }

  .aacs-grid-3 {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    transform-origin: center;
    animation: 
      aacs-draw calc(0.4s * var(--aacs-k)) ease-out calc(0.3s * var(--aacs-k)) both,
      aacs-pop calc(0.5s * var(--aacs-k)) cubic-bezier(0.34, 1.56, 0.64, 1) calc(0.3s * var(--aacs-k)) both;
  }

  .aacs-grid-4 {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    transform-origin: center;
    animation: 
      aacs-draw calc(0.4s * var(--aacs-k)) ease-out calc(0.45s * var(--aacs-k)) both,
      aacs-pop calc(0.5s * var(--aacs-k)) cubic-bezier(0.34, 1.56, 0.64, 1) calc(0.45s * var(--aacs-k)) both;
  }

  /* Pulsing animation after drawing */
  .aacs-pulse-1 { animation: aacs-pulse calc(4s * var(--aacs-k)) ease-in-out calc(1.2s * var(--aacs-k)) both; }
  .aacs-pulse-2 { animation: aacs-pulse calc(4s * var(--aacs-k)) ease-in-out calc(1.7s * var(--aacs-k)) both; }
  .aacs-pulse-3 { animation: aacs-pulse calc(4s * var(--aacs-k)) ease-in-out calc(2.2s * var(--aacs-k)) both; }
  .aacs-pulse-4 { animation: aacs-pulse calc(4s * var(--aacs-k)) ease-in-out calc(2.7s * var(--aacs-k)) both; }

  .aacs-loop .aacs-pulse-1,
  .aacs-loop .aacs-pulse-2,
  .aacs-loop .aacs-pulse-3,
  .aacs-loop .aacs-pulse-4 { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aacs-grid-1, .aacs-grid-2, .aacs-grid-3, .aacs-grid-4, .aacs-pulse-1, .aacs-pulse-2, .aacs-pulse-3, .aacs-pulse-4 { animation: none; }
  }
`;

const AnimatedClassSpace = forwardRef(function AnimatedClassSpace(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Class Space',
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
  const classes = ['aacs', loop ? 'aacs-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aacs-k': 1 / Math.max(speed, 0.1), ...style }}
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
        {/* Top-left */}
        <g className="aacs-pulse-1">
          <rect className="aacs-grid-1" width="7" height="7" x="3" y="3" rx="1" pathLength="1" />
        </g>
        
        {/* Top-right */}
        <g className="aacs-pulse-2">
          <rect className="aacs-grid-2" width="7" height="7" x="14" y="3" rx="1" pathLength="1" />
        </g>
        
        {/* Bottom-right */}
        <g className="aacs-pulse-3">
          <rect className="aacs-grid-3" width="7" height="7" x="14" y="14" rx="1" pathLength="1" />
        </g>
        
        {/* Bottom-left */}
        <g className="aacs-pulse-4">
          <rect className="aacs-grid-4" width="7" height="7" x="3" y="14" rx="1" pathLength="1" />
        </g>
      </g>
    </svg>
  );
});

export default AnimatedClassSpace;
