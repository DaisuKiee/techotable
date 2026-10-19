import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedBookOpen
 *
 * Sequence:
 *   1. The two pages draw outward from the spine while sliding apart, so the book opens
 *   2. Text lines write in: left page, then right page
 *   3. The right page flutters once, like a leaf about to turn
 *   4. Optional: the flutter repeats every few seconds (idle is still)
 *
 * Props
 *   size            number | string   Width/height. Default: undefined (use className)
 *   color           string            Stroke colour. Default: 'currentColor'
 *   strokeWidth     number            Default: 2
 *   speed           number            1 = default, 2 = twice as fast. Default: 1
 *   loop            boolean           Repeat the flutter periodically. Default: false
 *   replayOnHover   boolean           Replay the intro on hover / focus. Default: false
 *   title           string | null     Accessible name. Pass null if purely decorative.
 *
 * Respects prefers-reduced-motion: renders a static icon.
 *
 * Usage: <AnimatedBookOpen className="w-6 h-6" />
 */

const CSS = `
  .aab { overflow: visible; }
  .aab * { transform-box: fill-box; }

  @keyframes aab-draw {
    0%   { stroke-dashoffset: 1; opacity: 0; }
    1%   { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }

  /* Pages start stacked near the spine and slide out to their resting positions */
  @keyframes aab-open {
    0%   { transform: translateX(var(--aab-dx)); }
    100% { transform: translateX(0); }
  }

  /* The right leaf lifts at its outer edge and drops back, hinged on the spine.
     Skew and a light squeeze are used instead of a big scale so strokes stay even. */
  @keyframes aab-flutter {
    0%   { transform: skewY(0deg)  scaleX(1); }
    10%  { transform: skewY(-6deg) scaleX(0.94); }
    20%  { transform: skewY(2deg)  scaleX(1.02); }
    28%  { transform: skewY(0deg)  scaleX(1); }
    100% { transform: skewY(0deg)  scaleX(1); }
  }

  .aab-shape {
    stroke-dasharray: 1 1;
    stroke-dashoffset: 0;
    animation: aab-draw calc(0.3s * var(--aab-k)) cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* Page outlines: each path starts at the spine so it draws outward */
  .aab-page .aab-shape {
    animation-duration: calc(0.65s * var(--aab-k));
    animation-delay: calc(0.05s * var(--aab-k));
  }

  .aab-open {
    animation: aab-open calc(0.65s * var(--aab-k)) cubic-bezier(0.34, 1.56, 0.64, 1)
               calc(0.05s * var(--aab-k)) both;
  }
  .aab-open-l { --aab-dx: 3px; }
  .aab-open-r { --aab-dx: -3px; }

  /* Text lines write in one after another */
  .aab-l1 { animation-delay: calc(0.6s  * var(--aab-k)); }
  .aab-l2 { animation-delay: calc(0.75s * var(--aab-k)); }
  .aab-r1 { animation-delay: calc(0.9s  * var(--aab-k)); }
  .aab-r2 { animation-delay: calc(1.05s * var(--aab-k)); }

  /* Hinge is the spine at x = 12 in viewBox units */
  .aab .aab-flutter {
    transform-box: view-box;
    transform-origin: 12px 12px;
    animation: aab-flutter calc(4s * var(--aab-k)) ease-in-out calc(1.8s * var(--aab-k)) 1 both;
  }
  .aab-loop .aab-flutter { animation-iteration-count: infinite; }

  @media (prefers-reduced-motion: reduce) {
    .aab-shape, .aab-open, .aab-flutter { animation: none; }
  }
`;

const AnimatedBookOpen = forwardRef(function AnimatedBookOpen(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = false,
    replayOnHover = false,
    title = 'Open book',
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
        {/* Left page. Path starts at the spine and runs outward. Its inner edge is the spine */}
        <g className="aab-page aab-open aab-open-l">
          <path className="aab-shape" d="M12 7a4 4 0 0 0-4-4H2v15h7a3 3 0 0 1 3 3z" pathLength="1" />
        </g>
        <path className="aab-shape aab-l1" d="M6 8h3" pathLength="1" />
        <path className="aab-shape aab-l2" d="M6 12h3" pathLength="1" />

        {/* Right page and its text move together, so the flutter never separates them */}
        <g className="aab-flutter">
          <g className="aab-page aab-open aab-open-r">
            <path className="aab-shape" d="M12 7a4 4 0 0 1 4-4h6v15h-7a3 3 0 0 0-3 3z" pathLength="1" />
          </g>
          <path className="aab-shape aab-r1" d="M15 8h3" pathLength="1" />
          <path className="aab-shape aab-r2" d="M15 12h3" pathLength="1" />
        </g>
      </g>
    </svg>
  );
});

export default AnimatedBookOpen;