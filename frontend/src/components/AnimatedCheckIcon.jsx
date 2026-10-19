import React from 'react';

/**
 * Animated check icon with circle draw, fill, and checkmark animations
 * White background with black checkmark and black outline
 * @param {Object} props
 * @param {string} props.className - CSS classes for sizing (e.g., 'w-5 h-5')
 * @param {number} props.size - Size in pixels (alternative to className)
 */
const AnimatedCheckIcon = ({ 
  className = 'w-5 h-5', 
  size 
}) => {
  // Extract size from className if provided (e.g., 'w-5 h-5' -> 20px)
  const getSize = () => {
    if (size) return size;
    if (className.includes('w-12')) return 48;
    if (className.includes('w-10')) return 40;
    if (className.includes('w-8')) return 32;
    if (className.includes('w-6')) return 24;
    if (className.includes('w-5')) return 20;
    if (className.includes('w-4')) return 16;
    if (className.includes('w-3')) return 12;
    return 20; // default
  };

  const iconSize = getSize();
  
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 120 120" 
      width={iconSize} 
      height={iconSize}
      className={className}
      role="img" 
      aria-label="Check"
    >
      <style>
        {`
          .anim-circle {
            fill: none;
            stroke: #000000;
            stroke-width: 6;
            stroke-linecap: round;
            stroke-dasharray: 327;
            stroke-dashoffset: 327;
            transform: rotate(-90deg);
            transform-origin: 60px 60px;
            animation: draw-circle 0.7s ease-out forwards;
          }
          .anim-fill {
            fill: #ffffff;
            opacity: 0;
            transform-origin: 60px 60px;
            animation: fill-in 0.35s ease-out 0.7s forwards;
          }
          .anim-check {
            fill: none;
            stroke: #000000;
            stroke-width: 8;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 60;
            stroke-dashoffset: 60;
            animation: draw-check 0.4s ease-out 0.9s forwards;
          }
          .anim-badge {
            transform-origin: 60px 60px;
            animation: pop 0.5s ease-out 1.1s;
          }
          .anim-ring {
            fill: none;
            stroke: #000000;
            stroke-width: 3;
            opacity: 0;
            transform-origin: 60px 60px;
            animation: pulse 0.8s ease-out 1.1s;
          }
          @keyframes draw-circle { to { stroke-dashoffset: 0; } }
          @keyframes fill-in { to { opacity: 1; } }
          @keyframes draw-check { to { stroke-dashoffset: 0; } }
          @keyframes pop {
            0%   { transform: scale(1); }
            50%  { transform: scale(1.12); }
            100% { transform: scale(1); }
          }
          @keyframes pulse {
            0%   { opacity: 0.6; transform: scale(1); }
            100% { opacity: 0;   transform: scale(1.5); }
          }
          @media (prefers-reduced-motion: reduce) {
            .anim-circle, .anim-fill, .anim-check, .anim-badge, .anim-ring { 
              animation-duration: 0.01s; 
              animation-delay: 0s; 
            }
          }
        `}
      </style>
      <g className="anim-badge">
        <circle className="anim-fill" cx="60" cy="60" r="52"/>
        <circle className="anim-circle" cx="60" cy="60" r="52"/>
        <path className="anim-check" d="M38 62 L54 78 L83 44"/>
      </g>
      <circle className="anim-ring" cx="60" cy="60" r="52"/>
    </svg>
  );
};

export default AnimatedCheckIcon;