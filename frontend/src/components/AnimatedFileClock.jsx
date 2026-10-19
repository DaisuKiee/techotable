import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedFileClock
 * File with clock icon - pulse animation for pending actions
 */

const CSS = `
  .aafc { overflow: visible; }
  .aafc * { transform-box: fill-box; }

  @keyframes aafc-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.6; transform: scale(1.05); }
  }

  @keyframes aafc-tick {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(90deg); }
  }

  @keyframes aafc-ping {
    0%   { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  .aafc-file {
    animation: aafc-pulse calc(2s * var(--aafc-k)) ease-in-out calc(0.3s * var(--aafc-k)) both;
  }

  .aafc-hand {
    transform-origin: 16px 16px;
    animation: aafc-tick calc(1.5s * var(--aafc-k)) ease-in-out calc(0.8s * var(--aafc-k)) both;
  }

  .aafc-dot {
    transform-origin: center;
    animation: aafc-ping calc(1.5s * var(--aafc-k)) ease-out calc(1.5s * var(--aafc-k)) infinite;
  }

  .aafc-loop .aafc-file { animation-iteration-count: infinite; }
  .aafc-loop .aafc-hand { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aafc-file, .aafc-hand, .aafc-dot { animation: none; }
  }
`;

const AnimatedFileClock = forwardRef(function AnimatedFileClock(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = true,
    replayOnHover = false,
    title = 'Pending',
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
  const classes = ['aafc', loop ? 'aafc-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aafc-k': 1 / Math.max(speed, 0.1), ...style }}
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
        <g className="aafc-file">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </g>
        <circle cx="16" cy="16" r="6" />
        <g className="aafc-hand">
          <polyline points="16 14 16 16 17 17" />
        </g>
        <circle className="aafc-dot" cx="20" cy="11" r="1" fill={color} />
      </g>
    </svg>
  );
});

export default AnimatedFileClock;
