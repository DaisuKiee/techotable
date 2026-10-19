import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedAlertCircle
 *
 * Sequence (one orchestrated moment, then a quiet idle):
 *   1. Circle draws itself in
 *   2. Exclamation stem draws down
 *   3. Dot drops in and bounces
 *   4. A single attention shake
 *   5. A ripple ring expands from the circle (the circle itself never distorts)
 *
 * Props
 *   size            number | string   Width/height. Default: undefined (use className)
 *   color           string            Stroke colour. Default: 'currentColor'
 *   strokeWidth     number            Default: 2
 *   speed           number            1 = default, 2 = twice as fast. Default: 1
 *   loop            boolean           Keep rippling after the intro. Default: true
 *   shake           boolean           Play the attention shake. Default: true
 *   replayOnHover   boolean           Replay the intro on hover / focus. Default: false
 *   title           string | null     Accessible name. Pass null if purely decorative.
 *
 * Respects prefers-reduced-motion: renders a static icon with no ripple.
 *
 * Usage: <AnimatedAlertCircle className="w-6 h-6 text-red-500" />
 */

const CSS = `
  .aac { overflow: visible; }
  .aac * { transform-box: fill-box; }

  @keyframes aac-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    1%   { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  /* Dot falls in from above and settles with a small bounce */
  @keyframes aac-drop {
    0%   { transform: translateY(-5px) scale(0); opacity: 0; }
    55%  { transform: translateY(1px)  scale(1.3); opacity: 1; }
    75%  { transform: translateY(-0.5px) scale(0.92); }
    100% { transform: translateY(0)    scale(1); opacity: 1; }
  }

  /* Whole icon wobbles around its centre, like a notification buzz */
  @keyframes aac-shake {
    0%, 100% { transform: rotate(0deg); }
    15%      { transform: rotate(-9deg); }
    35%      { transform: rotate(8deg); }
    55%      { transform: rotate(-5deg); }
    75%      { transform: rotate(3deg); }
  }

  /* Ripple: expands and fades, then rests so the loop feels like a heartbeat */
  @keyframes aac-ripple {
    0%   { transform: scale(1);   opacity: 0.55; }
    40%  { transform: scale(1.7); opacity: 0; }
    100% { transform: scale(1.7); opacity: 0; }
  }

  .aac-body {
    transform-origin: 50% 50%;
    animation: aac-shake calc(0.55s * var(--aac-k)) ease-in-out calc(1.35s * var(--aac-k)) 1;
  }
  .aac-no-shake .aac-body { animation: none; }

  .aac-circle,
  .aac-stem {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
  }

  .aac-circle {
    animation: aac-draw calc(0.7s * var(--aac-k)) cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .aac-stem {
    animation: aac-draw calc(0.3s * var(--aac-k)) cubic-bezier(0.22, 1, 0.36, 1)
               calc(0.55s * var(--aac-k)) both;
  }
  .aac-dot {
    transform-origin: 50% 50%;
    animation: aac-drop calc(0.45s * var(--aac-k)) cubic-bezier(0.34, 1.56, 0.64, 1)
               calc(0.8s * var(--aac-k)) both;
  }

  .aac-ripple {
    transform-origin: 50% 50%;
    opacity: 0;
    animation: aac-ripple calc(2.8s * var(--aac-k)) ease-out calc(1.4s * var(--aac-k)) 1 both;
  }
  .aac-loop .aac-ripple { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aac-circle, .aac-stem, .aac-dot, .aac-body { animation: none; }
    .aac-ripple { animation: none; opacity: 0; }
  }
`;

const AnimatedAlertCircle = forwardRef(function AnimatedAlertCircle(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = true,
    shake = true,
    replayOnHover = false,
    title = 'Alert',
    style,
    onMouseEnter,
    onFocus,
    ...props
  },
  ref
) {
  // Changing the key on the animated group remounts it, which restarts every animation.
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
  const classes = [
    'aac',
    loop ? 'aac-loop' : '',
    shake ? '' : 'aac-no-shake',
    className,
  ]
    .filter(Boolean)
    .join(' ');

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
      style={{ '--aac-k': 1 / Math.max(speed, 0.1), ...style }}
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
        {/* Ripple sits behind the icon so the circle stays crisp */}
        <circle className="aac-ripple" cx="12" cy="12" r="10" strokeWidth={strokeWidth * 0.75} />

        <g className="aac-body">
          <circle className="aac-circle" cx="12" cy="12" r="10" pathLength="1" />
          <line className="aac-stem" x1="12" y1="7.5" x2="12" y2="13" pathLength="1" />
          {/* Zero-length line + round cap = a perfect dot */}
          <line className="aac-dot" x1="12" y1="16.5" x2="12.01" y2="16.5" />
        </g>
      </g>
    </svg>
  );
});

export default AnimatedAlertCircle;