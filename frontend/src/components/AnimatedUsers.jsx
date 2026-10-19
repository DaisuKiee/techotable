import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedUsers
 *
 * Sequence:
 *   1. Front user draws in (head, then shoulders)
 *   2. Back user slides out from behind the front user while drawing
 *   3. A small greeting bob: front user first, then back user, heads leading shoulders
 *   4. Optional: the bob repeats every few seconds (idle is still, not constant motion)
 *
 * Props
 *   size            number | string   Width/height. Default: undefined (use className)
 *   color           string            Stroke colour. Default: 'currentColor'
 *   strokeWidth     number            Default: 2
 *   speed           number            1 = default, 2 = twice as fast. Default: 1
 *   loop            boolean           Repeat the bob periodically. Default: false
 *   replayOnHover   boolean           Replay the intro on hover / focus. Default: false
 *   title           string | null     Accessible name. Pass null if purely decorative.
 *
 * Respects prefers-reduced-motion: renders a static icon.
 *
 * Usage: <AnimatedUsers className="w-6 h-6" />
 */

const CSS = `
  .aau { overflow: visible; }
  .aau * { transform-box: fill-box; }

  @keyframes aau-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    1%   { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  /* Back user steps out from behind the front user */
  @keyframes aau-enter {
    0%   { transform: translateX(-5px); }
    100% { transform: translateX(0); }
  }

  /* Short bob followed by a long rest, so looping reads as an occasional nod */
  @keyframes aau-bob {
    0%   { transform: translateY(0); }
    10%  { transform: translateY(calc(var(--aau-amp) * -1)); }
    20%  { transform: translateY(calc(var(--aau-amp) * 0.3)); }
    28%  { transform: translateY(0); }
    100% { transform: translateY(0); }
  }

  .aau-shape {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aau-draw calc(0.5s * var(--aau-k)) cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* Draw order: front head, front shoulders, back head, back shoulders */
  .aau-front .aau-head .aau-shape  { animation-delay: calc(0.05s * var(--aau-k)); }
  .aau-front .aau-torso .aau-shape { animation-delay: calc(0.25s * var(--aau-k)); }
  .aau-back  .aau-head .aau-shape  { animation-delay: calc(0.45s * var(--aau-k)); }
  .aau-back  .aau-torso .aau-shape { animation-delay: calc(0.6s  * var(--aau-k)); }

  .aau-back {
    animation: aau-enter calc(0.6s * var(--aau-k)) cubic-bezier(0.22, 1, 0.36, 1)
               calc(0.4s * var(--aau-k)) both;
  }

  .aau-head, .aau-torso {
    animation: aau-bob calc(4s * var(--aau-k)) ease-in-out 1 both;
  }
  .aau-loop .aau-head, .aau-loop .aau-torso { animation-iteration-count: infinite; }

  /* Heads travel further than shoulders, so each person feels like one body */
  .aau-head  { --aau-amp: 2px;   }
  .aau-torso { --aau-amp: 1.2px; }

  .aau-front .aau-head,
  .aau-front .aau-torso { animation-delay: calc(1.3s  * var(--aau-k)); }
  .aau-back  .aau-head,
  .aau-back  .aau-torso { animation-delay: calc(1.45s * var(--aau-k)); }

  @media (prefers-reduced-motion: reduce) {
    .aau-shape, .aau-back, .aau-head, .aau-torso { animation: none; }
  }
`;

const AnimatedUsers = forwardRef(function AnimatedUsers(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Users',
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
  const classes = ['aau', loop ? 'aau-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aau-k': 1 / Math.max(speed, 0.1), ...style }}
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
        {/* Back user is first in the DOM so the front user overlaps it */}
        <g className="aau-user aau-back">
          <g className="aau-head">
            <path className="aau-shape" d="M16 3.13a4 4 0 0 1 0 7.75" pathLength="1" />
          </g>
          <g className="aau-torso">
            <path className="aau-shape" d="M22 21v-2a4 4 0 0 0-3-3.87" pathLength="1" />
          </g>
        </g>

        <g className="aau-user aau-front">
          <g className="aau-head">
            <circle className="aau-shape" cx="9" cy="7" r="4" pathLength="1" />
          </g>
          <g className="aau-torso">
            <path className="aau-shape" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" pathLength="1" />
          </g>
        </g>
      </g>
    </svg>
  );
});

export default AnimatedUsers;