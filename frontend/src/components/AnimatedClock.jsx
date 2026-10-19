import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedClock
 * Clock icon with rotating hands
 */

const CSS = `
  .aacl { overflow: visible; }
  .aacl * { transform-box: fill-box; }

  @keyframes aacl-tick-minute {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes aacl-tick-hour {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(30deg); }
  }

  @keyframes aacl-pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.05); }
  }

  .aacl-minute {
    transform-origin: 12px 12px;
    animation: aacl-tick-minute calc(8s * var(--aacl-k)) linear calc(0.2s * var(--aacl-k)) both;
  }

  .aacl-hour {
    transform-origin: 12px 12px;
    animation: aacl-tick-hour calc(8s * var(--aacl-k)) linear calc(0.2s * var(--aacl-k)) both;
  }

  .aacl-circle {
    transform-origin: center;
    animation: aacl-pulse calc(6s * var(--aacl-k)) ease-in-out calc(1s * var(--aacl-k)) both;
  }

  .aacl-loop .aacl-minute { animation-iteration-count: infinite; }
  .aacl-loop .aacl-hour { animation-iteration-count: infinite; }
  .aacl-loop .aacl-circle { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aacl-minute, .aacl-hour, .aacl-circle { animation: none; }
  }
`;

const AnimatedClock = forwardRef(function AnimatedClock(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = true,
    replayOnHover = false,
    title = 'Clock',
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
  const classes = ['aacl', loop ? 'aacl-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aacl-k': 1 / Math.max(speed, 0.1), ...style }}
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
        <circle className="aacl-circle" cx="12" cy="12" r="10" />
        <g className="aacl-minute">
          <polyline points="12 6 12 12 16 14" />
        </g>
      </g>
    </svg>
  );
});

export default AnimatedClock;
