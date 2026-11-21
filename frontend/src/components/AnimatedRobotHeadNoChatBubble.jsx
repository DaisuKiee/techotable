import React, { useRef } from 'react';

// B-LO — the assistant mascot (head only, no chat bubble).
// Rebuilt as a clean, rounded robot whose whole face lives on one glossy
// visor: two glowing eyes and a mouth bar. Coloured to the system palette
// (brand-blue body, emerald "online" accents, slate screen). Pure-CSS
// animation inside the SVG; the mouth only moves while `talking` is true.
// Usage: <AnimatedRobotHeadNoChatBubble className="w-20 h-20" talking={isAnswering} />

let headCounter = 0;

const AnimatedRobotHeadNoChatBubble = ({ className = '', talking = false, ...props }) => {
  // unique gradient ids so several heads on one page never clash
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `blo-head-${++headCounter}`;
  const uid = idRef.current;
  const body = `${uid}-body`;
  const visor = `${uid}-visor`;
  const glow = `${uid}-glow`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      className={`${className} ${talking ? 'rh-talking' : ''}`}
      role="img"
      aria-label="AI assistant robot head"
      {...props}
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
        .rh-float { animation: rh-float 2.8s ease-in-out infinite; transform-origin: 60px 72px; }
        .rh-eyes  { animation: rh-scan 5s ease-in-out infinite; }
        .rh-eye   { animation: rh-blink 4.2s infinite; transform-box: fill-box; transform-origin: center; }
        .rh-glow  { animation: rh-glow 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .rh-bulb  { animation: rh-pulse 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .rh-mouth { transform-box: fill-box; transform-origin: center; }
        .rh-talking .rh-mouth { animation: rh-talk 0.85s ease-in-out infinite; }
        .rh-talking .rh-eye   { animation: rh-blink 2.6s infinite; }
        @keyframes rh-float { 0%,100% { transform: translateY(0) rotate(-1.8deg); } 50% { transform: translateY(-4px) rotate(1.8deg); } }
        @keyframes rh-scan  { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-3.5px); } 70% { transform: translateX(3.5px); } }
        @keyframes rh-blink { 0%,93%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.12); } }
        @keyframes rh-glow  { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: .9; transform: scale(1.12); } }
        @keyframes rh-pulse { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.4); opacity: 1; } }
        @keyframes rh-talk  { 0%,100% { transform: scaleX(1) scaleY(1); } 50% { transform: scaleX(.6) scaleY(1.9); } }
        @media (prefers-reduced-motion: reduce) {
          .rh-float, .rh-eyes, .rh-eye, .rh-glow, .rh-bulb, .rh-mouth { animation: none; }
        }
      `}</style>

      <g className="rh-float">
        {/* antenna */}
        <line x1="60" y1="17" x2="60" y2="33" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <circle className="rh-glow" cx="60" cy="12" r="11" fill={`url(#${glow})`} />
        <circle className="rh-bulb" cx="60" cy="12" r="6" fill="#34d399" stroke="#fff" strokeWidth="2.5" />

        {/* ear pods */}
        <rect x="6" y="56" width="12" height="26" rx="6" fill="#1d4ed8" stroke="#fff" strokeWidth="3" />
        <rect x="102" y="56" width="12" height="26" rx="6" fill="#1d4ed8" stroke="#fff" strokeWidth="3" />

        {/* head */}
        <rect x="18" y="32" width="84" height="74" rx="26" fill={`url(#${body})`} stroke="#fff" strokeWidth="4" />
        {/* glossy top highlight */}
        <ellipse cx="45" cy="47" rx="20" ry="9" fill="#fff" opacity="0.18" />

        {/* visor (the whole face lives here) */}
        <rect x="27" y="46" width="66" height="42" rx="20" fill={`url(#${visor})`} />
        <rect x="33" y="51" width="30" height="7" rx="3.5" fill="#fff" opacity="0.12" />

        {/* eyes */}
        <g className="rh-eyes">
          <circle className="rh-glow" cx="47" cy="63" r="10" fill={`url(#${glow})`} />
          <circle className="rh-glow" cx="73" cy="63" r="10" fill={`url(#${glow})`} />
          <circle className="rh-eye" cx="47" cy="63" r="6.5" fill="#5eeab0" />
          <circle className="rh-eye" cx="73" cy="63" r="6.5" fill="#5eeab0" />
        </g>

        {/* mouth bar */}
        <rect className="rh-mouth" x="52" y="76" width="16" height="4" rx="2" fill="#34d399" opacity="0.9" />
      </g>
    </svg>
  );
};

export default AnimatedRobotHeadNoChatBubble;
