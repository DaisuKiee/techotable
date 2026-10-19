import React, { useState } from 'react';

// Animated TrendingUp icon: growth / average metrics
// - Line draws left to right, with each dot popping as the line reaches it
// - Arrow head draws in once the line finishes
// - Optional gentle pulse on the arrow, optional replay on hover
//
// Usage:
//   <AnimatedTrendingUp className="w-6 h-6" />
//   <AnimatedTrendingUp className="w-8 h-8" color="#10b981" replayOnHover pulse={false} />

const AnimatedTrendingUp = ({
  className = '',
  color = 'currentColor',
  strokeWidth = 2,
  duration = 0.9,        // seconds for the line to draw
  delay = 0,             // seconds before everything starts
  pulse = true,          // idle pulse on the arrow after the intro
  replayOnHover = false, // restart the intro when hovered
  title = 'Trending Up',
  onMouseEnter,
  ...props
}) => {
  const [runKey, setRunKey] = useState(0);

  const handleMouseEnter = (e) => {
    if (replayOnHover) setRunKey((k) => k + 1);
    onMouseEnter?.(e);
  };

  return (
    <svg
      key={runKey}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={title}
      onMouseEnter={handleMouseEnter}
      style={{
        '--tu-duration': `${duration}s`,
        '--tu-delay': `${delay}s`,
        overflow: 'visible',
      }}
      {...props}
    >
      <title>{title}</title>
      <style>{`
        @keyframes tu-draw {
          from { stroke-dashoffset: 1; opacity: 1; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes tu-pop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tu-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.12); opacity: 0.85; }
        }

        /* Line follows a linear timeline so dot timing stays in sync */
        .tu-line {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          opacity: 0;
          animation: tu-draw var(--tu-duration) linear var(--tu-delay) forwards;
        }

        /* Arrow head draws after the line reaches the end */
        .tu-arrow {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          opacity: 0;
          animation: tu-draw 0.25s ease-out
                     calc(var(--tu-delay) + var(--tu-duration)) forwards;
        }

        /* transform-box makes scale() originate from each shape's own center
           (without it, SVG scales from the viewBox origin and dots fly in
           from the top-left corner) */
        .tu-pop,
        .tu-pulse {
          transform-box: fill-box;
          transform-origin: center;
        }
        .tu-pop {
          opacity: 0;
          animation: tu-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .tu-pulse-on {
          animation: tu-pulse 2s ease-in-out
                     calc(var(--tu-delay) + var(--tu-duration) + 0.6s) infinite;
        }

        /* Dots pop as the line passes them (approx. 0%, 32%, 57% of path length) */
        .tu-dot-1 { animation-delay: calc(var(--tu-delay) + 0s); }
        .tu-dot-2 { animation-delay: calc(var(--tu-delay) + var(--tu-duration) * 0.32); }
        .tu-dot-3 { animation-delay: calc(var(--tu-delay) + var(--tu-duration) * 0.57); }

        @media (prefers-reduced-motion: reduce) {
          .tu-line, .tu-arrow, .tu-pop, .tu-pulse-on {
            animation: none !important;
            stroke-dashoffset: 0;
            transform: none;
            opacity: 1;
          }
        }
      `}</style>

      {/* Main trend line (drawn left to right) */}
      <polyline
        className="tu-line"
        points="2 17 8.5 10.5 13.5 15.5 22 7"
        pathLength="1"
      />

      {/* Arrow head (top right) */}
      <polyline
        className="tu-arrow"
        points="16 7 22 7 22 13"
        pathLength="1"
      />

      {/* Data point dots */}
      <g className="tu-pulse-wrap">
        <circle className="tu-pop tu-dot-1" cx="2" cy="17" r="1.25" fill={color} stroke="none" />
        <circle className="tu-pop tu-dot-2" cx="8.5" cy="10.5" r="1.25" fill={color} stroke="none" />
        <circle className="tu-pop tu-dot-3" cx="13.5" cy="15.5" r="1.25" fill={color} stroke="none" />
      </g>

      {/* Invisible pulse target on the arrow tip (kept separate so pulse
          doesn't conflict with the draw animation) */}
      {pulse && (
        <circle
          className="tu-pulse tu-pulse-on"
          cx="22"
          cy="7"
          r="0.01"
          fill="none"
          stroke="none"
        />
      )}
    </svg>
  );
};

export default AnimatedTrendingUp;