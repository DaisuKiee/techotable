import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedBell
 * Bell icon with ringing animation for announcements
 */

const CSS = `
  .aab { overflow: visible; }
  .aab * { transform-box: fill-box; }

  @keyframes aab-ring {
    0%, 100% { transform: rotate(0deg); }
    10%, 30% { transform: rotate(-15deg); }
    20%, 40% { transform: rotate(15deg); }
    50% { transform: rotate(0deg); }
  }

  @keyframes aab-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.3); opacity: 0; }
  }

  @keyframes aab-fade-in {
    0%   { opacity: 0; transform: scale(0.8); }
    100% { opacity: 1; transform: scale(1); }
  }

  .aab-bell {
    transform-origin: 12px 4px;
    animation: aab-ring calc(1.5s * var(--aab-k)) ease-in-out calc(0.3s * var(--aab-k)) both;
  }

  .aab-dot {
    transform-origin: center;
    animation: aab-fade-in calc(0.4s * var(--aab-k)) ease-out calc(0.8s * var(--aab-k)) both,
               aab-pulse calc(2s * var(--aab-k)) ease-in-out calc(1.5s * var(--aab-k)) infinite;
  }

  .aab-loop .aab-bell { 
    animation: aab-ring calc(1.5s * var(--aab-k)) ease-in-out calc(4s * var(--aab-k)) infinite; 
  }

  @media (prefers-reduced-motion: reduce) {
    .aab-bell, .aab-dot { animation: none; }
  }
`;

const AnimatedBell = forwardRef(function AnimatedBell(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = true,
    replayOnHover = false,
    title = 'Notifications',
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
  const classes = ['aab', loop ? 'aab-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aab-k': 1 / Math.max(speed, 0.1), ...style }}
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
        <g className="aab-bell">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </g>
        <circle className="aab-dot" cx="19" cy="6" r="2.5" fill="#ef4444" stroke="none" />
      </g>
    </svg>
  );
});

export default AnimatedBell;
