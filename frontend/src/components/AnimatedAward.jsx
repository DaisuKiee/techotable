import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedAward
 *
 * Sequence:
 *   1. Medal circle draws in
 *   2. Ribbons draw down from the medal and settle with a small bounce (left, then right)
 *   3. Star spins and pops into the centre
 *   4. A single twinkle: the star swells and turns one point (72deg) so it ends looking
 *      identical, which makes the loop seamless
 *   5. Optional: the twinkle repeats every few seconds (idle is still)
 *
 * Props
 *   size            number | string   Width/height. Default: undefined (use className)
 *   color           string            Stroke/fill colour. Default: 'currentColor'
 *   strokeWidth     number            Default: 2
 *   speed           number            1 = default, 2 = twice as fast. Default: 1
 *   loop            boolean           Repeat the twinkle periodically. Default: false
 *   replayOnHover   boolean           Replay the intro on hover / focus. Default: false
 *   title           string | null     Accessible name. Pass null if purely decorative.
 *
 * Respects prefers-reduced-motion: renders a static icon.
 *
 * Usage: <AnimatedAward className="w-6 h-6" />
 */

const CSS = `
  .aaw { overflow: visible; }
  .aaw * { transform-box: fill-box; }

  @keyframes aaw-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    1%   { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  /* Ribbons settle into place with a small overshoot */
  @keyframes aaw-drop {
    0%   { transform: translateY(-5px); }
    60%  { transform: translateY(1.2px); }
    100% { transform: translateY(0); }
  }

  /* Star spins in from nothing. Two full points of rotation keeps it symmetrical at rest */
  @keyframes aaw-pop {
    0%   { transform: scale(0)   rotate(-144deg); opacity: 0; }
    60%  { transform: scale(1.3) rotate(10deg);   opacity: 1; }
    100% { transform: scale(1)   rotate(0deg);    opacity: 1; }
  }

  /* A five-point star looks the same after 72deg, so the end state matches the start */
  @keyframes aaw-twinkle {
    0%   { transform: scale(1)    rotate(0deg); }
    12%  { transform: scale(1.3)  rotate(36deg); }
    24%  { transform: scale(1)    rotate(72deg); }
    100% { transform: scale(1)    rotate(72deg); }
  }

  .aaw-shape {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aaw-draw calc(0.5s * var(--aaw-k)) cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .aaw-disc .aaw-shape { animation-delay: calc(0.05s * var(--aaw-k)); animation-duration: calc(0.8s * var(--aaw-k)); }
  .aaw-rib-l .aaw-shape { animation-delay: calc(0.55s * var(--aaw-k)); }
  .aaw-rib-r .aaw-shape { animation-delay: calc(0.7s  * var(--aaw-k)); }

  .aaw-ribbon { animation: aaw-drop calc(0.55s * var(--aaw-k)) cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  .aaw-rib-l  { animation-delay: calc(0.55s * var(--aaw-k)); }
  .aaw-rib-r  { animation-delay: calc(0.7s  * var(--aaw-k)); }

  /* Pivot is the star's centre in viewBox units, not its bounding-box centre */
  .aaw .aaw-pop,
  .aaw .aaw-twinkle {
    transform-box: view-box;
    transform-origin: 12px 8px;
  }

  .aaw-pop {
    animation: aaw-pop calc(0.6s * var(--aaw-k)) cubic-bezier(0.34, 1.56, 0.64, 1)
               calc(0.95s * var(--aaw-k)) both;
  }

  .aaw-twinkle {
    animation: aaw-twinkle calc(4s * var(--aaw-k)) ease-in-out calc(1.9s * var(--aaw-k)) 1 both;
  }
  .aaw-loop .aaw-twinkle { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aaw-shape, .aaw-ribbon, .aaw-pop, .aaw-twinkle { animation: none; }
  }
`;

const AnimatedAward = forwardRef(function AnimatedAward(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Award',
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
  const classes = ['aaw', loop ? 'aaw-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aaw-k': 1 / Math.max(speed, 0.1), ...style }}
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
        {/* Ribbons: paths start at the medal and run down to the tail */}
        <g className="aaw-ribbon aaw-rib-l">
          <path className="aaw-shape" d="M8.21 13.89L7 23L12 20" pathLength="1" />
        </g>
        <g className="aaw-ribbon aaw-rib-r">
          <path className="aaw-shape" d="M15.79 13.88L17 23L12 20" pathLength="1" />
        </g>

        {/* Medal */}
        <g className="aaw-disc">
          <circle className="aaw-shape" cx="12" cy="8" r="7" pathLength="1" />
        </g>

        {/* Star centred on the medal. Pop and twinkle are nested so their transforms don't collide */}
        <g className="aaw-pop">
          <g className="aaw-twinkle">
            <path
              d="M12 4.6L12.88 6.79L15.23 6.95L13.43 8.46L14 10.75L12 9.5L10 10.75L10.57 8.46L8.77 6.95L11.12 6.79Z"
              fill={color}
              strokeWidth={Math.max(strokeWidth * 0.5, 0.5)}
            />
          </g>
        </g>
      </g>
    </svg>
  );
});

export default AnimatedAward;