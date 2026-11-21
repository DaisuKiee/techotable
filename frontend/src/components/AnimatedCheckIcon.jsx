import React from 'react';

/**
 * Animated success check. A ring draws on, the disc fades in, the checkmark
 * strokes in with a little spring, then the badge pops and a ring ripples out.
 *
 * Two looks:
 *  - 'outline' (default): colour ring + soft tinted disc + colour check.
 *    Reads well inline and at small sizes.
 *  - 'solid': a filled colour badge with a white check and a glossy highlight.
 *    Made for big empty-state "all done" moments.
 *
 * Colour comes from `color` (defaults to the system success green) and applies
 * to the ring, disc tint and — in the outline look — the check. 'currentColor'
 * is fine. Sizing follows the className (e.g. 'w-5 h-5', 'w-20 h-20'); pass
 * `size` for an explicit pixel size.
 *
 * @param {Object} props
 * @param {string} [props.className]
 * @param {number} [props.size]
 * @param {string} [props.color]
 * @param {'outline'|'solid'} [props.variant]
 */
const AnimatedCheckIcon = ({ className = 'w-5 h-5', size, color = '#16a34a', variant = 'outline' }) => {
  const solid = variant === 'solid';
  const checkColor = solid ? '#ffffff' : color;
  const discOpacity = solid ? 1 : 0.14;
  // When a pixel size is given use it; otherwise let the className/CSS size the
  // SVG so any Tailwind width works (the old numeric map missed w-16, w-20, …).
  const box = size ? { width: size, height: size } : { width: '100%', height: '100%' };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      {...box}
      className={className}
      role="img"
      aria-label="Success"
    >
      <style>{`
        .ac-circle {
          fill: none;
          stroke-width: 6;
          stroke-linecap: round;
          stroke-dasharray: 327;
          stroke-dashoffset: 327;
          transform: rotate(-90deg);
          transform-origin: 60px 60px;
          animation: ac-draw-circle 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .ac-fill { opacity: 0; animation: ac-fill-in 0.32s ease-out 0.5s forwards; }
        .ac-check {
          fill: none;
          stroke-width: 9;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 64;
          stroke-dashoffset: 64;
          transform-origin: 60px 60px;
          animation: ac-draw-check 0.38s cubic-bezier(0.65, 0, 0.35, 1) 0.7s forwards,
                     ac-check-pop 0.32s ease-out 1.04s;
        }
        .ac-badge {
          transform-origin: 60px 60px;
          animation: ac-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 1.02s;
        }
        .ac-ring {
          fill: none;
          stroke-width: 3;
          opacity: 0;
          transform-origin: 60px 60px;
          animation: ac-pulse 0.75s ease-out 1.02s;
        }
        @keyframes ac-draw-circle { to { stroke-dashoffset: 0; } }
        @keyframes ac-fill-in { to { opacity: 1; } }
        @keyframes ac-draw-check { to { stroke-dashoffset: 0; } }
        @keyframes ac-check-pop { 0%,100% { transform: scale(1); } 45% { transform: scale(1.14); } }
        @keyframes ac-pop { 0% { transform: scale(1); } 45% { transform: scale(1.1); } 100% { transform: scale(1); } }
        @keyframes ac-pulse { 0% { opacity: 0.55; transform: scale(1); } 100% { opacity: 0; transform: scale(1.6); } }
        @media (prefers-reduced-motion: reduce) {
          .ac-circle, .ac-fill, .ac-check, .ac-badge, .ac-ring {
            animation-duration: 0.01s !important;
            animation-delay: 0s !important;
          }
          .ac-ring { display: none; }
        }
      `}</style>
      <g className="ac-badge">
        <circle className="ac-fill" cx="60" cy="60" r="52" style={{ fill: color, fillOpacity: discOpacity }} />
        <circle className="ac-circle" cx="60" cy="60" r="52" style={{ stroke: color }} />
        {solid && (
          <ellipse className="ac-fill" cx="44" cy="42" rx="20" ry="10" style={{ fill: '#ffffff', fillOpacity: 0.18 }} />
        )}
        <path className="ac-check" d="M40 63 L54 77 L82 45" style={{ stroke: checkColor }} />
      </g>
      <circle className="ac-ring" cx="60" cy="60" r="52" style={{ stroke: color }} />
    </svg>
  );
};

export default AnimatedCheckIcon;
