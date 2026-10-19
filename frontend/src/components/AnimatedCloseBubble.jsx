import React, { useRef } from 'react';

// Chat bubble with an animated X inside (the "close chat" button icon).
// - Bubble pops in and floats gently
// - The X draws itself in, then spins 90deg when a parent with the
//   `group` class is hovered (your floating button already has it)
// Usage: <AnimatedCloseBubble className="w-20 h-20 drop-shadow-lg" />
let bubbleCounter = 0;

const AnimatedCloseBubble = ({ className = '', ...props }) => {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `close-bubble-${++bubbleCounter}`;
  const gradId = idRef.current;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Close chat"
      {...props}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c8cff" />
          <stop offset="1" stopColor="#5865f2" />
        </linearGradient>
      </defs>

      <style>{`
        .cb-pop   { animation: cb-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; transform-origin: 100px 110px; }
        .cb-float { animation: cb-float 3s ease-in-out 0.5s infinite; transform-origin: 100px 100px; }
        .cb-x     { transform-origin: 100px 85px; transition: transform 0.3s ease; }
        .group:hover .cb-x { transform: rotate(90deg); }
        .cb-line  { stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0;
                    animation: cb-draw 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.25s forwards; }
        .cb-line-2 { animation-delay: 0.4s; }
        @keyframes cb-pop   { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes cb-float { 0%,100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-5px) rotate(1.5deg); } }
        @keyframes cb-draw  { 0% { stroke-dashoffset: 1; opacity: 0; } 10% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .cb-pop, .cb-float { animation: none; }
          .cb-line { animation: none; stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>

      <g className="cb-pop">
        <g className="cb-float">
          {/* bubble */}
          <path
            d="M50 25 H150 A30 30 0 0 1 180 55 V115 A30 30 0 0 1 150 145 H85 L45 180 L55 145 H50 A30 30 0 0 1 20 115 V55 A30 30 0 0 1 50 25 Z"
            fill={`url(#${gradId})`}
          />
          {/* animated X */}
          <g className="cb-x" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round">
            <path className="cb-line" d="M78 63 L122 107" pathLength="1" />
            <path className="cb-line cb-line-2" d="M122 63 L78 107" pathLength="1" />
          </g>
        </g>
      </g>
    </svg>
  );
};

export default AnimatedCloseBubble;
