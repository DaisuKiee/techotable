import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedCalendar
 * Calendar icon where the current page folds up over the binding
 * and reveals the next day underneath.
 *
 * Props
 * - size          number | string   icon size (default 24)
 * - color         string            stroke color (default currentColor)
 * - strokeWidth   number            (default 2)
 * - speed         number            1 = normal, 2 = twice as fast
 * - loop          boolean           keep flipping forever
 * - replayOnHover boolean           replay on mouse enter
 * - playKey       any               change this value to replay from outside
 * - title         string | null     accessible name; null = decorative icon
 */

const CSS = `
  .aac { overflow: visible; }

  /* view-box makes transform-origin use real icon coordinates (0-24) */
  .aac-pop, .aac-old, .aac-new { transform-box: view-box; }
  .aac-pop { transform-origin: 12px 12px; }
  .aac-old { transform-origin: 12px 10px; } /* hinge = header line */

  /* ---------- one-shot ---------- */
  @keyframes aac-fold {
    0%, 12% { transform: scaleY(1); opacity: 1; }
    55%     { transform: scaleY(0); opacity: 1; }
    56%     { opacity: 0; }
    100%    { transform: scaleY(0); opacity: 0; }
  }

  @keyframes aac-reveal {
    0%, 30% { opacity: 0; }
    60%     { opacity: 1; }
    100%    { opacity: 1; }
  }

  @keyframes aac-pop {
    0%, 50% { transform: scale(1); }
    62%     { transform: scale(1.06); }
    78%     { transform: scale(0.99); }
    100%    { transform: scale(1); }
  }

  /* ---------- loop: fold up, hold, fall back down ---------- */
  @keyframes aac-fold-loop {
    0%, 10% { transform: scaleY(1); opacity: 1; }
    40%     { transform: scaleY(0); opacity: 1; }
    41%     { opacity: 0; }
    86%     { transform: scaleY(0); opacity: 0; }
    100%    { transform: scaleY(1); opacity: 1; }
  }

  @keyframes aac-reveal-loop {
    0%, 20% { opacity: 0; }
    45%     { opacity: 1; }
    84%     { opacity: 1; }
    100%    { opacity: 0; }
  }

  @keyframes aac-pop-loop {
    0%, 36% { transform: scale(1); }
    46%     { transform: scale(1.06); }
    58%     { transform: scale(0.99); }
    68%, 100% { transform: scale(1); }
  }

  .aac-old {
    animation: aac-fold calc(1.6s * var(--aac-k)) cubic-bezier(0.6, 0, 0.3, 1)
               calc(0.15s * var(--aac-k)) both;
  }
  .aac-new {
    opacity: 0;
    animation: aac-reveal calc(1.6s * var(--aac-k)) ease-out
               calc(0.15s * var(--aac-k)) both;
  }
  .aac-pop {
    animation: aac-pop calc(1.6s * var(--aac-k)) ease-out
               calc(0.15s * var(--aac-k)) both;
  }

  .aac-loop .aac-old {
    animation-name: aac-fold-loop;
    animation-duration: calc(4s * var(--aac-k));
    animation-iteration-count: infinite;
    animation-delay: 0s;
  }
  .aac-loop .aac-new {
    animation-name: aac-reveal-loop;
    animation-duration: calc(4s * var(--aac-k));
    animation-iteration-count: infinite;
    animation-delay: 0s;
  }
  .aac-loop .aac-pop {
    animation-name: aac-pop-loop;
    animation-duration: calc(4s * var(--aac-k));
    animation-iteration-count: infinite;
    animation-delay: 0s;
  }

  /* Reduced motion: show a complete, static calendar */
  @media (prefers-reduced-motion: reduce) {
    .aac-pop, .aac-old, .aac-new { animation: none !important; }
    .aac-new { opacity: 0; }
    .aac-old { opacity: 1; transform: none; }
  }
`;

const AnimatedCalendar = forwardRef(function AnimatedCalendar(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size = 24,
    speed = 1,
    loop = false,
    replayOnHover = false,
    playKey,
    title = 'Calendar',
    style,
    onMouseEnter,
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

  const decorative = title === null;
  const classes = ['aac', loop ? 'aac-loop' : '', className].filter(Boolean).join(' ');
  const k = 1 / Math.max(Number(speed) || 1, 0.1);

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
      style={{ '--aac-k': k, ...style }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {!decorative && <title>{title}</title>}
      <style>{CSS}</style>

      {/* Changing the key remounts the group, which restarts every animation */}
      <g key={`${runId}-${String(playKey)}`} className="aac-pop">
        {/* Static frame */}
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />

        {/* Next day (revealed underneath) */}
        <path className="aac-new" d="M8 14h.01M12 14h.01M12 18h.01M16 18h.01" />

        {/* Current day: the page that folds up around the header hinge */}
        <g className="aac-old">
          <path d="M3 10v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </g>
      </g>
    </svg>
  );
});

export default AnimatedCalendar;