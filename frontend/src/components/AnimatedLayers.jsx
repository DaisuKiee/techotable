import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedLayers
 *
 * Sequence:
 *   1. The stack builds from the bottom up. Each layer draws in while dropping
 *      onto the one beneath it (bottom chevron, middle chevron, then the top diamond)
 *   2. The stack fans out: top layer lifts, bottom layer drops, then both settle back
 *   3. Optional: the fan repeats every few seconds (idle is still)
 *
 * Props
 *   size            number | string   Width/height. Default: undefined (use className)
 *   color           string            Stroke colour. Default: 'currentColor'
 *   strokeWidth     number            Default: 2
 *   speed           number            1 = default, 2 = twice as fast. Default: 1
 *   loop            boolean           Repeat the fan periodically. Default: false
 *   replayOnHover   boolean           Replay the intro on hover / focus. Default: false
 *   title           string | null     Accessible name. Pass null if purely decorative.
 *
 * Respects prefers-reduced-motion: renders a static icon.
 *
 * Usage: <AnimatedLayers className="w-6 h-6" />
 */

const CSS = `
  .aal { overflow: visible; }
  .aal * { transform-box: fill-box; }

  @keyframes aal-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    1%   { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  /* Each layer lands on the stack with a small overshoot */
  @keyframes aal-drop {
    0%   { transform: translateY(var(--aal-from)); }
    60%  { transform: translateY(0.8px); }
    100% { transform: translateY(0); }
  }

  /* Top layer lifts, then settles with a tiny overshoot */
  @keyframes aal-fan-up {
    0%   { transform: translateY(0); }
    14%  { transform: translateY(-2.5px); }
    30%  { transform: translateY(0.5px); }
    40%  { transform: translateY(0); }
    100% { transform: translateY(0); }
  }

  /* Bottom layer mirrors the top */
  @keyframes aal-fan-down {
    0%   { transform: translateY(0); }
    14%  { transform: translateY(2.5px); }
    30%  { transform: translateY(-0.5px); }
    40%  { transform: translateY(0); }
    100% { transform: translateY(0); }
  }

  .aal-shape {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aal-draw calc(0.45s * var(--aal-k)) cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .aal-drop {
    animation: aal-drop calc(0.55s * var(--aal-k)) cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* Build order, bottom to top. Draw and drop share the same delay */
  .aal-bottom .aal-drop, .aal-bottom .aal-shape { animation-delay: calc(0.05s * var(--aal-k)); }
  .aal-middle .aal-drop, .aal-middle .aal-shape { animation-delay: calc(0.3s  * var(--aal-k)); }
  .aal-top    .aal-drop, .aal-top    .aal-shape { animation-delay: calc(0.55s * var(--aal-k)); }

  .aal-bottom .aal-drop { --aal-from: -6px; }
  .aal-middle .aal-drop { --aal-from: -6px; }
  .aal-top    .aal-drop { --aal-from: -8px; }

  /* The fan is on its own nested group so it never collides with the drop transform */
  .aal-top .aal-fan {
    animation: aal-fan-up calc(4s * var(--aal-k)) ease-in-out calc(1.6s * var(--aal-k)) 1 both;
  }
  .aal-bottom .aal-fan {
    animation: aal-fan-down calc(4s * var(--aal-k)) ease-in-out calc(1.6s * var(--aal-k)) 1 both;
  }
  .aal-loop .aal-fan { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aal-shape, .aal-drop, .aal-fan { animation: none; }
  }
`;

const AnimatedLayers = forwardRef(function AnimatedLayers(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Layers',
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
  const classes = ['aal', loop ? 'aal-loop' : '', className].filter(Boolean).join(' ');

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
      style={{ '--aal-k': 1 / Math.max(speed, 0.1), ...style }}
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
        {/* Bottom layer: the lowest chevron */}
        <g className="aal-bottom">
          <g className="aal-drop">
            <g className="aal-fan">
              <path className="aal-shape" d="M2 17l10 5 10-5" pathLength="1" />
            </g>
          </g>
        </g>

        {/* Middle layer: stays put during the fan so it anchors the stack */}
        <g className="aal-middle">
          <g className="aal-drop">
            <path className="aal-shape" d="M2 12l10 5 10-5" pathLength="1" />
          </g>
        </g>

        {/* Top layer: the diamond */}
        <g className="aal-top">
          <g className="aal-drop">
            <g className="aal-fan">
              <path className="aal-shape" d="M12 2L2 7l10 5 10-5z" pathLength="1" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
});

export default AnimatedLayers;