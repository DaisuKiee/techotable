import React, { forwardRef, useCallback, useState } from 'react';

/**
 * AnimatedClock
 *
 * Clock icon. By default the hands sweep around (decorative). Pass `time`
 * (a Date) to show that time instead: the hands point at the real hour and
 * minute and don't spin.
 *
 * The hands used to be one polyline rotated about "12px 12px" while
 * `transform-box: fill-box` was set on every child. Fill-box makes the origin
 * relative to the hand's own bounding box (x 12-16, y 6-14), so the pivot
 * landed outside the face and the hand swung off the clock. Hands now use
 * `transform-box: view-box`, so 12px 12px really is the centre.
 */

const CSS = `
  .aacl { overflow: visible; }
  .aacl-hand { transform-box: view-box; transform-origin: 12px 12px; }
  .aacl-face { transform-box: fill-box; transform-origin: center; }

  @keyframes aacl-spin { from { transform: rotate(var(--aacl-from, 0deg)); } to { transform: rotate(calc(var(--aacl-from, 0deg) + 360deg)); } }
  @keyframes aacl-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }

  .aacl-spin .aacl-minute { animation: aacl-spin calc(8s * var(--aacl-k)) linear infinite; }
  .aacl-spin .aacl-hour { animation: aacl-spin calc(96s * var(--aacl-k)) linear infinite; }
  .aacl-spin .aacl-face { animation: aacl-pulse calc(6s * var(--aacl-k)) ease-in-out infinite; }
  .aacl-once .aacl-minute { animation-iteration-count: 1; }
  .aacl-once .aacl-hour { animation-iteration-count: 1; }
  .aacl-once .aacl-face { animation-iteration-count: 1; }

  @media (prefers-reduced-motion: reduce) {
    .aacl-spin .aacl-minute, .aacl-spin .aacl-hour, .aacl-spin .aacl-face { animation: none; }
  }
`;

const AnimatedClock = forwardRef(function AnimatedClock(
  {
    className = '',
    color = 'currentColor',
    strokeWidth = 2,
    size,
    speed = 1,
    loop = true,
    time,
    replayOnHover = false,
    title = 'Clock',
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

  // A real time: hour hand moves through the hour too (e.g. 3:30 sits halfway to 4)
  const showsTime = time instanceof Date && !Number.isNaN(time.getTime());
  const minuteDeg = showsTime ? time.getMinutes() * 6 : 0;
  const hourDeg = showsTime ? (time.getHours() % 12) * 30 + time.getMinutes() * 0.5 : 60;

  const decorative = title === null;
  const classes = ['aacl', !showsTime ? 'aacl-spin' : '', !showsTime && !loop ? 'aacl-once' : '', className]
    .filter(Boolean).join(' ');

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
      style={{ '--aacl-k': 1 / Math.max(speed, 0.1), ...style }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : (showsTime ? time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : title)}
      focusable="false"
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      {...props}
    >
      {!decorative && <title>{showsTime ? time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : title}</title>}
      <style>{CSS}</style>

      <g key={runId}>
        <circle className="aacl-face" cx="12" cy="12" r="10" />
        {/* Hour hand: shorter. Both start pointing at 12 and rotate about the centre. */}
        <line
          className="aacl-hand aacl-hour"
          x1="12" y1="12" x2="12" y2="8"
          style={showsTime ? { transform: `rotate(${hourDeg}deg)` } : { '--aacl-from': `${hourDeg}deg`, transform: `rotate(${hourDeg}deg)` }}
        />
        <line
          className="aacl-hand aacl-minute"
          x1="12" y1="12" x2="12" y2="6"
          style={showsTime ? { transform: `rotate(${minuteDeg}deg)` } : undefined}
        />
        <circle cx="12" cy="12" r="0.6" fill={color} stroke="none" />
      </g>
    </svg>
  );
});

export default AnimatedClock;
