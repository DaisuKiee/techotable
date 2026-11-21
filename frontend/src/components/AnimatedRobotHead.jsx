import React, { useRef } from 'react';

// B-LO — the chat-bubble mascot: a rounded speech bubble holding the rebuilt
// robot head (one glossy visor with two glowing eyes + a mouth bar). Coloured
// to the system palette (brand-blue body, emerald accents, slate screen).
// Idle it floats, blinks and pulses its antenna; the mouth only moves while
// `talking` is true. Pure-CSS animation inside the SVG.
// Usage: <AnimatedRobotHead className="w-20 h-20" talking={isAnswering} />

let bubbleCounter = 0;

export default function AnimatedRobotHead({ className = 'w-10 h-10', talking = false }) {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `blo-bub-${++bubbleCounter}`;
  const uid = idRef.current;
  const body = `${uid}-body`;
  const visor = `${uid}-visor`;
  const glow = `${uid}-glow`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={`${className} ${talking ? 'brh-talking' : ''}`}
      role="img"
      aria-label="Chat bubble with a robot AI assistant head"
    >
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#7cb0fb" />
          <stop offset="0.5" stopColor="#2f6bf0" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={visor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.55" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        .bub-float  { animation: bub-float 3s ease-in-out infinite; transform-origin: 100px 100px; }
        .bub-shadow { animation: bub-shadow 3s ease-in-out infinite; transform-origin: 100px 192px; }
        .bub-spark  { animation: bub-spark 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .brh-eyes   { animation: brh-scan 5s ease-in-out infinite; }
        .brh-eye    { animation: brh-blink 4.2s infinite; transform-box: fill-box; transform-origin: center; }
        .brh-glow   { animation: brh-glow 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .brh-bulb   { animation: brh-pulse 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .brh-mouth  { transform-box: fill-box; transform-origin: center; }
        .brh-talking .brh-mouth { animation: brh-talk 0.85s ease-in-out infinite; }
        .brh-talking .brh-eye   { animation: brh-blink 2.6s infinite; }
        @keyframes bub-float  { 0%,100% { transform: translateY(0) rotate(-1.4deg); } 50% { transform: translateY(-8px) rotate(1.4deg); } }
        @keyframes bub-shadow { 0%,100% { transform: scaleX(1); opacity: .22; } 50% { transform: scaleX(.8); opacity: .12; } }
        @keyframes bub-spark  { 0%,100% { transform: scale(.5) rotate(0); opacity: .3; } 50% { transform: scale(1.1) rotate(45deg); opacity: 1; } }
        @keyframes brh-scan   { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-3px); } 70% { transform: translateX(3px); } }
        @keyframes brh-blink  { 0%,93%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.12); } }
        @keyframes brh-glow   { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: .9; transform: scale(1.12); } }
        @keyframes brh-pulse  { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.4); opacity: 1; } }
        @keyframes brh-talk   { 0%,100% { transform: scaleX(1) scaleY(1); } 50% { transform: scaleX(.6) scaleY(1.9); } }
        @media (prefers-reduced-motion: reduce) {
          .bub-float, .bub-shadow, .bub-spark, .brh-eyes, .brh-eye, .brh-glow, .brh-bulb, .brh-mouth { animation: none !important; }
        }
      `}</style>

      <ellipse className="bub-shadow" cx="100" cy="192" rx="44" ry="6" fill="#000" opacity=".2" />

      <g className="bub-float">
        {/* speech bubble with a tail */}
        <path
          d="M56 22 H144 A38 38 0 0 1 182 60 V108 A38 38 0 0 1 144 146 H90 L46 182 L60 146 H56 A38 38 0 0 1 18 108 V60 A38 38 0 0 1 56 22 Z"
          fill={`url(#${body})`}
        />
        {/* sparkle */}
        <path className="bub-spark" d="M158 44 L161 53 L170 56 L161 59 L158 68 L155 59 L146 56 L155 53 Z" fill="#fff" />

        {/* the rebuilt head, placed inside the bubble */}
        <g transform="translate(100 84) scale(0.92) translate(-60 -70)">
          {/* antenna */}
          <line x1="60" y1="17" x2="60" y2="33" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <circle className="brh-glow" cx="60" cy="12" r="11" fill={`url(#${glow})`} />
          <circle className="brh-bulb" cx="60" cy="12" r="6" fill="#34d399" stroke="#fff" strokeWidth="2.5" />

          {/* ear pods */}
          <rect x="6" y="56" width="12" height="26" rx="6" fill="#bfdbfe" stroke="#fff" strokeWidth="3" />
          <rect x="102" y="56" width="12" height="26" rx="6" fill="#bfdbfe" stroke="#fff" strokeWidth="3" />

          {/* head */}
          <rect x="18" y="32" width="84" height="74" rx="26" fill="#fff" />
          <ellipse cx="45" cy="47" rx="20" ry="9" fill={`url(#${body})`} opacity="0.12" />

          {/* visor */}
          <rect x="27" y="46" width="66" height="42" rx="20" fill={`url(#${visor})`} />
          <rect x="33" y="51" width="30" height="7" rx="3.5" fill="#fff" opacity="0.12" />

          {/* eyes */}
          <g className="brh-eyes">
            <circle className="brh-glow" cx="47" cy="63" r="10" fill={`url(#${glow})`} />
            <circle className="brh-glow" cx="73" cy="63" r="10" fill={`url(#${glow})`} />
            <circle className="brh-eye" cx="47" cy="63" r="6.5" fill="#5eeab0" />
            <circle className="brh-eye" cx="73" cy="63" r="6.5" fill="#5eeab0" />
          </g>

          {/* mouth bar */}
          <rect className="brh-mouth" x="52" y="76" width="16" height="4" rx="2" fill="#34d399" opacity="0.9" />
        </g>
      </g>
    </svg>
  );
}
