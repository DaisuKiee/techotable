import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedGraduationCap
 *
 * Sequence:
 *   1. Mortarboard draws in
 *   2. Band rises up under the board and draws in
 *   3. Tassel cord draws down from the corner
 *   4. The cap toss: it hops up, tilts, and lands, while the tassel lags behind
 *      and settles like a damped pendulum
 *   5. Optional: the toss repeats every few seconds (idle is still)
 *
 * Props
 *   size            number | string   Width/height. Default: undefined (use className)
 *   color           string            Stroke colour. Default: 'currentColor'
 *   strokeWidth     number            Default: 2
 *   speed           number            1 = default, 2 = twice as fast. Default: 1
 *   loop            boolean           Repeat the toss periodically. Default: false
 *   replayOnHover   boolean           Replay the intro on hover / focus. Default: false
 *   title           string | null     Accessible name. Pass null if purely decorative.
 *
 * Respects prefers-reduced-motion: renders a static icon.
 *
 * Usage: <AnimatedGraduationCap className="w-6 h-6" />
 */

const CSS = `
  .aag { overflow: visible; }
  .aag * { transform-box: fill-box; }

  @keyframes aag-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    1%   { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  /* Band settles up into the underside of the board, with a small overshoot */
  @keyframes aag-rise {
    0%   { transform: translateY(-3px); }
    100% { transform: translateY(0); }
  }

  /* The cap toss: quick launch, tilt at the apex, soft landing, then rest */
  @keyframes aag-toss {
    0%   { transform: translateY(0)      rotate(0deg); }
    9%   { transform: translateY(-5px)   rotate(-10deg); }
    19%  { transform: translateY(0.6px)  rotate(2deg); }
    25%  { transform: translateY(0)      rotate(0deg); }
    100% { transform: translateY(0)      rotate(0deg); }
  }

  /* Tassel lags the cap, then swings out and settles (decreasing amplitude) */
  @keyframes aag-swing {
    0%   { transform: rotate(0deg); }
    9%   { transform: rotate(16deg); }
    19%  { transform: rotate(-18deg); }
    29%  { transform: rotate(10deg); }
    39%  { transform: rotate(-5deg); }
    49%  { transform: rotate(2deg); }
    58%  { transform: rotate(0deg); }
    100% { transform: rotate(0deg); }
  }

  .aag-shape {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aag-draw calc(0.55s * var(--aag-k)) cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .aag-board .aag-shape  { animation-delay: calc(0.05s * var(--aag-k)); animation-duration: calc(0.7s * var(--aag-k)); }
  .aag-band .aag-shape   { animation-delay: calc(0.45s * var(--aag-k)); }
  .aag-cord .aag-shape   { animation-delay: calc(0.8s  * var(--aag-k)); animation-duration: calc(0.3s * var(--aag-k)); }

  .aag-band {
    animation: aag-rise calc(0.5s * var(--aag-k)) cubic-bezier(0.34, 1.56, 0.64, 1)
               calc(0.45s * var(--aag-k)) both;
  }

  .aag-toss {
    transform-origin: 50% 55%;
    animation: aag-toss calc(5s * var(--aag-k)) cubic-bezier(0.33, 0, 0.2, 1)
               calc(1.4s * var(--aag-k)) 1 both;
  }

  /* Pivot is the top of the cord, where it hangs from the board's corner */
  .aag-cord {
    transform-origin: 50% 0%;
    animation: aag-swing calc(5s * var(--aag-k)) ease-in-out calc(1.4s * var(--aag-k)) 1 both;
  }

  .aag-loop .aag-toss,
  .aag-loop .aag-cord { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aag-shape, .aag-band, .aag-toss, .aag-cord { animation: none; }
  }
`;

const AnimatedGraduationCap = forwardRef(function AnimatedGraduationCap(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Graduation cap',
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
  const classes = ['aag', loop ? 'aag-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aag-k': 1 / Math.max(speed, 0.1), ...style }}
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
        {/* One wrapper moves everything together so the pieces never drift apart */}
        <g className="aag-toss">
          {/* Band sits behind the board in the DOM */}
          <g className="aag-band">
            <path className="aag-shape" d="M6 13v3a6 6 0 0 0 12 0v-3" pathLength="1" />
          </g>

          {/* Mortarboard */}
          <g className="aag-board">
            <path className="aag-shape" d="M2 10l10-5 10 5-10 5z" pathLength="1" />
          </g>

          {/* Tassel cord hangs from the board's right corner */}
          <g className="aag-cord">
            <line className="aag-shape" x1="22" y1="10" x2="22" y2="16" pathLength="1" />
          </g>
        </g>
      </g>
    </svg>
  );
});

export default AnimatedGraduationCap;