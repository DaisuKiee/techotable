import React, { useRef } from 'react';

// Animated BarChart icon - represents growth / data visualization
//
// Intro (plays once):
//  1. Baseline draws in from left to right
//  2. Bars rise out of the baseline one after another, with a small bounce
//  3. A trend line draws across the top, then the arrow tip lands
//
// Idle (optional, `loop`):
//  - Bars gently sway up and down in a staggered wave, like live data
//
// Props:
//  - color        stroke color of the bars and baseline (default: currentColor)
//  - accentColor  stroke color of the trend line (default: same as color)
//  - strokeWidth  stroke width in viewBox units (default: 2)
//  - animate      false = static icon (default: true)
//  - loop         false = play the intro only, no idle sway (default: true)
//  - speed        animation speed multiplier, 2 = twice as fast (default: 1)
//
// Usage: <AnimatedBarChart className="w-6 h-6" />
// Tip: change the React `key` to replay the intro (e.g. on tab change).

let idCounter = 0;

const AnimatedBarChart = ({
  className = '',
  color = 'currentColor',
  accentColor,
  strokeWidth = 2,
  animate = true,
  loop = true,
  speed = 1,
  style,
  ...props
}) => {
  // Unique clip-path id so several icons on one page never clash
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `abc-clip-${++idCounter}`;
  const clipId = idRef.current;

  const accent = accentColor || color;
  const classes = [
    'abc-root',
    animate ? 'abc-animate' : '',
    animate && loop ? 'abc-loop' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={classes}
      style={{ '--abc-speed': speed, ...style }}
      role="img"
      aria-label="Bar chart"
      {...props}
    >
      <style>{`
        /* ---------- Keyframes ---------- */

        /* Bars slide up from below the baseline (translate instead of scale,
           so the stroke never gets squashed while growing) */
        @keyframes abc-rise {
          0%   { transform: translateY(15px); }
          65%  { transform: translateY(-1.2px); }
          100% { transform: translateY(0); }
        }

        /* Idle: bars dip slightly into the baseline and come back */
        @keyframes abc-sway {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(var(--abc-dip)); }
        }

        /* Line drawing (paths use pathLength="1") */
        @keyframes abc-draw {
          0%   { stroke-dashoffset: 1; opacity: 0; }
          1%   { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }

        /* Arrow tip slides into place at the end of the trend line */
        @keyframes abc-tip {
          0%   { opacity: 0; transform: translate(-1.5px, 1.5px); }
          100% { opacity: 1; transform: translate(0, 0); }
        }

        /* ---------- Intro ---------- */

        .abc-root.abc-animate .abc-baseline {
          stroke-dasharray: 1 1;
          animation: abc-draw calc(0.45s / var(--abc-speed)) ease-out both;
        }

        .abc-root.abc-animate .abc-bar {
          animation: abc-rise calc(0.8s / var(--abc-speed)) cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc((0.3s + var(--abc-i) * 0.14s) / var(--abc-speed));
        }

        .abc-root.abc-animate .abc-trend {
          stroke-dasharray: 1 1;
          animation: abc-draw calc(0.7s / var(--abc-speed)) ease-in-out both;
          animation-delay: calc(1.1s / var(--abc-speed));
        }

        .abc-root.abc-animate .abc-tip {
          animation: abc-tip calc(0.3s / var(--abc-speed)) ease-out both;
          animation-delay: calc(1.7s / var(--abc-speed));
        }

        /* ---------- Idle sway (after the intro) ---------- */

        .abc-root.abc-loop .abc-bar {
          animation-name: abc-rise, abc-sway;
          animation-duration: calc(0.8s / var(--abc-speed)), calc(3.4s / var(--abc-speed));
          animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1), ease-in-out;
          animation-delay:
            calc((0.3s + var(--abc-i) * 0.14s) / var(--abc-speed)),
            calc((2.4s + var(--abc-i) * 0.35s) / var(--abc-speed));
          animation-fill-mode: both, none;
          animation-iteration-count: 1, infinite;
        }

        /* ---------- Reduced motion: show the finished icon ---------- */
        @media (prefers-reduced-motion: reduce) {
          .abc-root .abc-baseline,
          .abc-root .abc-bar,
          .abc-root .abc-trend,
          .abc-root .abc-tip {
            animation: none !important;
            stroke-dasharray: none !important;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      <defs>
        {/* Hides everything below the baseline, so bars appear to rise out of it */}
        <clipPath id={clipId}>
          <rect x="0" y="0" width="24" height="20" />
        </clipPath>
      </defs>

      {/* Bars (ascending, left to right) */}
      <g clipPath={`url(#${clipId})`}>
        <path
          className="abc-bar"
          style={{ '--abc-i': '0', '--abc-dip': '1.6px' }}
          d="M4 20V16H8V20"
        />
        <path
          className="abc-bar"
          style={{ '--abc-i': '1', '--abc-dip': '2.2px' }}
          d="M10 20V14H14V20"
        />
        <path
          className="abc-bar"
          style={{ '--abc-i': '2', '--abc-dip': '1.8px' }}
          d="M16 20V11H20V20"
        />
      </g>

      {/* Baseline */}
      <path className="abc-baseline" d="M2 20H22" pathLength="1" />

      {/* Trend line and arrow tip */}
      <path className="abc-trend" d="M4 11L9 8L13 9.5L19 4" pathLength="1" stroke={accent} />
      <path className="abc-tip" d="M15 4H19V8" stroke={accent} />
    </svg>
  );
};

export default AnimatedBarChart;