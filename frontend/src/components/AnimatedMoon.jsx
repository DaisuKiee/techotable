import React, { useState } from 'react';

// Animated Moon icon: night shift
//
// Timeline (scaled by `speed`, shifted by `delay`):
//   0.00s  crescent outline draws in
//   0.55s  crescent fills with a soft glow and a halo fades in
//   0.95s  stars pop into the open side of the crescent, one by one
//   1.00s  idle: the moon rocks gently, halo and fill breathe, stars twinkle
//
// Usage:
//   <AnimatedMoon className="w-6 h-6" />
//   <AnimatedMoon className="w-8 h-8" color="#a5b4fc" stars={false} replayOnHover />

const STARS = [
  { cx: 17.5, cy: 7.5, r: 0.8 },
  { cx: 14.6, cy: 9.6, r: 0.55 },
  { cx: 19.6, cy: 4.6, r: 0.6 },
];

const MOON_PATH = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';

const AnimatedMoon = ({
  className = '',
  color = 'currentColor',
  strokeWidth = 2,
  speed = 1,             // 1 = default, 2 = twice as fast
  delay = 0,             // seconds before everything starts
  rock = true,           // gentle rocking after the intro
  rockAngle = 5,         // degrees each way
  glow = true,           // soft fill + halo that breathe
  stars = true,          // twinkling stars in the crescent
  replayOnHover = false, // restart the intro on hover
  title = 'Moon',
  style,
  onMouseEnter,
  ...props
}) => {
  const [runKey, setRunKey] = useState(0);

  const handleMouseEnter = (e) => {
    if (replayOnHover) setRunKey((k) => k + 1);
    onMouseEnter?.(e);
  };

  const t = 1 / Math.max(speed, 0.1);

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
      {...props}
      onMouseEnter={handleMouseEnter}
      style={{
        '--mn-t': `${t}`,
        '--mn-delay': `${delay}s`,
        '--mn-rock': `${rockAngle}deg`,
        overflow: 'visible',
        ...style,
      }}
    >
      <title>{title}</title>
      <style>{`
        @keyframes mn-draw {
          from { stroke-dashoffset: 1.05; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes mn-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mn-breathe {
          from { opacity: 1; }
          to   { opacity: 0.35; }
        }
        /* Starts and ends at 0deg, so the idle loop never jumps */
        @keyframes mn-rock {
          0%, 100% { transform: rotate(0deg); }
          25%      { transform: rotate(calc(var(--mn-rock) * -1)); }
          75%      { transform: rotate(var(--mn-rock)); }
        }
        @keyframes mn-star-pop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes mn-twinkle {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(0.55); opacity: 0.3; }
        }

        /* Base styles are the FINAL (static) state. Animations use fill-mode
           "backwards" to supply the starting state, so reduced motion simply
           removes the animations and shows the finished moon. */

        /* Rock around the moon's own center (the viewBox center, 12,12) */
        .mn-rock {
          transform-box: view-box;
          transform-origin: 50% 50%;
        }
        .mn-rock.mn-rock-on {
          animation: mn-rock calc(5s * var(--mn-t)) ease-in-out
                     calc(var(--mn-delay) + 1s * var(--mn-t)) infinite;
        }

        /* Outline draw-in. Dash gap is longer than the path and the start
           offset is slightly over 1, so no round-cap dot shows up early. */
        .mn-outline {
          stroke-dasharray: 1 2;
          animation: mn-draw calc(0.9s * var(--mn-t)) cubic-bezier(0.22, 1, 0.36, 1)
                     var(--mn-delay) backwards;
        }

        .mn-fill,
        .mn-halo {
          animation: mn-fade calc(0.6s * var(--mn-t)) ease-out
                     calc(var(--mn-delay) + 0.55s * var(--mn-t)) backwards,
                     mn-breathe calc(3.2s * var(--mn-t)) ease-in-out
                     calc(var(--mn-delay) + 1.4s * var(--mn-t)) infinite alternate;
        }

        .mn-star {
          transform-box: fill-box;
          transform-origin: center;
          animation: mn-star-pop calc(0.4s * var(--mn-t))
                     cubic-bezier(0.34, 1.56, 0.64, 1)
                     calc(var(--mn-delay) + (0.95s + var(--i) * 0.15s) * var(--mn-t)) backwards,
                     mn-twinkle calc(2.4s * var(--mn-t)) ease-in-out
                     calc(var(--mn-delay) + (1.7s + var(--i) * 0.45s) * var(--mn-t)) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .mn-rock, .mn-outline, .mn-fill, .mn-halo, .mn-star {
            animation: none !important;
          }
        }
      `}</style>

      <g className={`mn-rock${rock ? ' mn-rock-on' : ''}`}>
        {/* Halo: a wide, faint stroke of the same shape (no filters, so it stays cheap) */}
        {glow && (
          <path
            className="mn-halo"
            d={MOON_PATH}
            strokeWidth={strokeWidth * 2.8}
            strokeOpacity="0.12"
          />
        )}

        {/* Soft inner fill */}
        {glow && (
          <path
            className="mn-fill"
            d={MOON_PATH}
            fill={color}
            fillOpacity="0.14"
            stroke="none"
          />
        )}

        {/* Crescent outline (draws in) */}
        <path className="mn-outline" d={MOON_PATH} pathLength="1" />
      </g>

      {/* Stars sit outside the rocking group so they stay still while the moon sways */}
      {stars &&
        STARS.map((s, i) => (
          <circle
            key={i}
            className="mn-star"
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={color}
            stroke="none"
            style={{ '--i': i }}
          />
        ))}
    </svg>
  );
};

export default AnimatedMoon;