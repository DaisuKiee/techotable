import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedBuilding
 * Building/room icon with construction/grow animation
 */

const CSS = `
  .aab { overflow: visible; }
  .aab * { transform-box: fill-box; }

  @keyframes aab-build {
    0%   { transform: scaleY(0); opacity: 0; }
    20%  { opacity: 1; }
    100% { transform: scaleY(1); opacity: 1; }
  }

  @keyframes aab-window-light {
    0%, 100% { opacity: 0.3; }
    50%      { opacity: 1; }
  }

  @keyframes aab-door-open {
    0%   { transform: scaleY(0); }
    100% { transform: scaleY(1); }
  }

  @keyframes aab-grow {
    0%, 100% { transform: scaleY(1); }
    50%      { transform: scaleY(1.03); }
  }

  .aab-structure {
    transform-origin: center bottom;
    animation: aab-build calc(1.2s * var(--aab-k)) cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .aab-door {
    transform-origin: center bottom;
    animation: aab-door-open calc(0.5s * var(--aab-k)) ease-out calc(1s * var(--aab-k)) both;
  }

  .aab-window {
    animation: aab-window-light calc(2s * var(--aab-k)) ease-in-out calc(1.5s * var(--aab-k)) both;
  }

  .aab-window:nth-child(1) { animation-delay: calc(1.5s * var(--aab-k)); }
  .aab-window:nth-child(2) { animation-delay: calc(1.7s * var(--aab-k)); }
  .aab-window:nth-child(3) { animation-delay: calc(1.9s * var(--aab-k)); }
  .aab-window:nth-child(4) { animation-delay: calc(2.1s * var(--aab-k)); }
  .aab-window:nth-child(5) { animation-delay: calc(2.3s * var(--aab-k)); }

  .aab-idle {
    transform-origin: center bottom;
    animation: aab-grow calc(5s * var(--aab-k)) ease-in-out calc(2.5s * var(--aab-k)) both;
  }

  .aab-loop .aab-window { animation-iteration-count: infinite; }
  .aab-loop .aab-idle { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aab-structure, .aab-door, .aab-window, .aab-idle { animation: none; }
  }
`;

const AnimatedBuilding = forwardRef(function AnimatedBuilding(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Building',
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
        <g className="aab-idle">
          <g className="aab-structure">
            {/* Building frame */}
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            
            {/* Door */}
            <g className="aab-door">
              <path d="M9 22v-4h6v4" />
            </g>
            
            {/* Windows (animated lights) */}
            <g>
              <path className="aab-window" d="M8 6h.01" />
              <path className="aab-window" d="M12 6h.01" />
              <path className="aab-window" d="M16 6h.01" />
              <path className="aab-window" d="M8 10h.01" />
              <path className="aab-window" d="M12 10h.01" />
              <path className="aab-window" d="M16 10h.01" />
              <path className="aab-window" d="M8 14h.01" />
              <path className="aab-window" d="M12 14h.01" />
              <path className="aab-window" d="M16 14h.01" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
});

export default AnimatedBuilding;
