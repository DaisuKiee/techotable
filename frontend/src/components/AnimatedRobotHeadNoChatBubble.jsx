import React, { useRef } from 'react';

// Robot head only (no chat bubble). Animated with pure CSS inside the SVG.
// Usage: <AnimatedRobotHeadNoChatBubble className="w-20 h-20" />

let headCounter = 0;

const AnimatedRobotHeadNoChatBubble = ({ className = '', ...props }) => {
  // unique gradient id so several heads on one page never clash
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `robot-head-${++headCounter}`;
  const gradId = idRef.current;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="AI assistant robot head"
      {...props}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b9bff" />
          <stop offset="1" stopColor="#5865f2" />
        </linearGradient>
      </defs>
      <style>{`
        .rh-float { animation: rh-float 2.6s ease-in-out infinite; transform-origin: 60px 70px; }
        .rh-eyes  { animation: rh-scan 5s ease-in-out infinite; }
        .rh-eye   { animation: rh-blink 4s infinite, rh-glow 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .rh-bulb  { animation: rh-pulse 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .rh-mouth { animation: rh-talk 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes rh-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-4px) rotate(2deg); } }
        @keyframes rh-scan  { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-4px); } 70% { transform: translateX(4px); } }
        @keyframes rh-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes rh-glow  { 0%,100% { opacity: .65; } 50% { opacity: 1; } }
        @keyframes rh-pulse { 0%,100% { transform: scale(1); opacity: .8; } 50% { transform: scale(1.5); opacity: 1; } }
        @keyframes rh-talk  { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(.6); } }
        @media (prefers-reduced-motion: reduce) {
          .rh-float, .rh-eyes, .rh-eye, .rh-bulb, .rh-mouth { animation: none; }
        }
      `}</style>
      <g className="rh-float">
        {/* antenna */}
        <line x1="60" y1="20" x2="60" y2="36" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <circle className="rh-bulb" cx="60" cy="14" r="7" fill="#5eead4" stroke="#fff" strokeWidth="3" />
        {/* ears */}
        <rect x="5" y="58" width="12" height="30" rx="6" fill="#5865f2" stroke="#fff" strokeWidth="3" />
        <rect x="103" y="58" width="12" height="30" rx="6" fill="#5865f2" stroke="#fff" strokeWidth="3" />
        {/* head */}
        <rect x="14" y="34" width="92" height="76" rx="26" fill={`url(#${gradId})`} stroke="#fff" strokeWidth="4" />
        {/* visor */}
        <rect x="26" y="50" width="68" height="34" rx="17" fill="#2b2d42" />
        <g className="rh-eyes">
          <circle className="rh-eye" cx="45" cy="67" r="7" fill="#5eead4" />
          <circle className="rh-eye" cx="75" cy="67" r="7" fill="#5eead4" />
        </g>
        {/* mouth */}
        <rect className="rh-mouth" x="48" y="94" width="24" height="6" rx="3" fill="#fff" />
      </g>
    </svg>
  );
};

export default AnimatedRobotHeadNoChatBubble;
