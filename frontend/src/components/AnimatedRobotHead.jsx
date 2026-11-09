import React from 'react';

// AnimatedRobotHead.jsx
// Animated chat bubble with AI robot assistant head
// Features: floating bubble, bobbing robot head, blinking eyes, talking mouth, antenna pulse, sparkle
// Usage: <AnimatedRobotHead className="w-10 h-10" />

export default function AnimatedRobotHead({ className = "w-10 h-10" }) {
  return (
    <>
      <style>{`
        .arh-float  { animation: arh-float 3s ease-in-out infinite; transform-origin: 100px 100px; }
        .arh-head   { animation: arh-bob 2.4s ease-in-out infinite; transform-origin: 100px 100px; }
        .arh-eyes   { animation: arh-scan 5s ease-in-out infinite; }
        .arh-eye    { animation: arh-blink 4s infinite; transform-box: fill-box; transform-origin: center; }
        .arh-glow   { animation: arh-glow 1.6s ease-in-out infinite; }
        .arh-bulb   { animation: arh-pulse 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .arh-spark  { animation: arh-twinkle 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .arh-mouth  { animation: arh-talk 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .arh-shadow { animation: arh-shadow 3s ease-in-out infinite; transform-origin: 100px 190px; }
        @keyframes arh-float  { 0%,100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-8px) rotate(1.5deg); } }
        @keyframes arh-bob    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes arh-scan   { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-3px); } 70% { transform: translateX(3px); } }
        @keyframes arh-blink  { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes arh-glow   { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
        @keyframes arh-pulse  { 0%,100% { transform: scale(1); opacity: .8; } 50% { transform: scale(1.5); opacity: 1; } }
        @keyframes arh-twinkle{ 0%,100% { transform: scale(.5) rotate(0); opacity: .3; } 50% { transform: scale(1.1) rotate(45deg); opacity: 1; } }
        @keyframes arh-talk   { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(.6); } }
        @keyframes arh-shadow { 0%,100% { transform: scaleX(1); opacity: .22; } 50% { transform: scaleX(.8); opacity: .12; } }
        @media (prefers-reduced-motion: reduce) {
          .arh-float, .arh-head, .arh-eyes, .arh-eye, .arh-glow, .arh-bulb, .arh-spark, .arh-mouth, .arh-shadow {
            animation: none !important;
          }
        }
      `}</style>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 200 200" 
        className={className}
        role="img" 
        aria-label="Chat bubble with a robot AI assistant head"
      >
        <defs>
          <linearGradient id="bubble" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7c8cff"/>
            <stop offset="1" stopColor="#5865f2"/>
          </linearGradient>
        </defs>

        <ellipse className="arh-shadow" cx="100" cy="190" rx="42" ry="6" fill="#000" opacity=".2"/>
        
        <g className="arh-float">
          <path d="M50 25 H150 A30 30 0 0 1 180 55 V115 A30 30 0 0 1 150 145 H85 L45 180 L55 145 H50 A30 30 0 0 1 20 115 V55 A30 30 0 0 1 50 25 Z" fill="url(#bubble)"/>
          <path className="arh-spark" d="M158 42 L161 50 L169 53 L161 56 L158 64 L155 56 L147 53 L155 50 Z" fill="#fff"/>
          
          <g className="arh-head">
            {/* antenna */}
            <line x1="100" y1="50" x2="100" y2="62" stroke="#fff" strokeWidth="4" strokeLinecap="round"/>
            <circle className="arh-bulb" cx="100" cy="46" r="5" fill="#5eead4"/>
            
            {/* ears */}
            <rect x="60" y="76" width="8" height="20" rx="4" fill="#dfe3ff"/>
            <rect x="132" y="76" width="8" height="20" rx="4" fill="#dfe3ff"/>
            
            {/* head */}
            <rect x="66" y="62" width="68" height="52" rx="16" fill="#fff"/>
            
            {/* visor */}
            <rect x="75" y="72" width="50" height="22" rx="11" fill="#2b2d42"/>
            <g className="arh-eyes">
              <circle className="arh-eye arh-glow" cx="90" cy="83" r="4.5" fill="#5eead4"/>
              <circle className="arh-eye arh-glow" cx="110" cy="83" r="4.5" fill="#5eead4"/>
            </g>
            
            {/* mouth */}
            <rect className="arh-mouth" x="91" y="101" width="18" height="4" rx="2" fill="#5865f2"/>
          </g>
        </g>
      </svg>
    </>
  );
}
