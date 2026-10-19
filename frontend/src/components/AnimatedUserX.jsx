import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedUserX
 * User with X icon - shake animation for inactive users
 */

const CSS = `
  .aaux { overflow: visible; }
  .aaux * { transform-box: fill-box; }

  @keyframes aaux-shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
    20%, 40%, 60%, 80% { transform: translateX(2px); }
  }

  @keyframes aaux-cross-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    50%  { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  .aaux-user {
    animation: aaux-shake calc(1s * var(--aaux-k)) ease-in-out calc(0.5s * var(--aaux-k)) both;
  }

  .aaux-cross {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aaux-cross-draw calc(0.6s * var(--aaux-k)) ease-out calc(1.2s * var(--aaux-k)) both;
  }

  .aaux-loop .aaux-user { 
    animation: aaux-shake calc(1s * var(--aaux-k)) ease-in-out calc(5s * var(--aaux-k)) infinite; 
  }

  @media (prefers-reduced-motion: reduce) {
    .aaux-user, .aaux-cross { animation: none; }
  }
`;

const AnimatedUserX = forwardRef(function AnimatedUserX(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Inactive User',
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
  const classes = ['aaux', loop ? 'aaux-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aaux-k': 1 / Math.max(speed, 0.1), ...style }}
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
        <g className="aaux-user">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </g>
        <g className="aaux-cross">
          <line x1="17" y1="8" x2="23" y2="14" pathLength="1" />
          <line x1="23" y1="8" x2="17" y2="14" pathLength="1" />
        </g>
      </g>
    </svg>
  );
});

export default AnimatedUserX;
