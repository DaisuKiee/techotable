import React from 'react';
import ctuLogo from '../assets/images/logos/ctulogo.png';

// Campus walk-in loader: a student walks along the campus path to the CTU
// gate, the doorway lights up, and they step inside.
//
// Timeline (all scaled by `duration`, in fractions of it):
//   0.00  scene fades in; trees, lamps and gate are already standing
//   0.00  student walks in from the left (legs, arms and backpack swing)
//   0.70  doorway starts to glow as they approach
//   0.86  student reaches the door and fades into it
//   0.00-1.00  progress line under the scene fills in step with the walk
//
// Usage:
//   <CampusWalkLoader duration={2.2} />
//   <CampusWalkLoader duration={0.8} compact />   // short page transitions

const CampusWalkLoader = ({
  duration = 2.2,          // seconds; match the screen's real display time
  title = 'CTU Daanbantayan',
  subtitle = 'Smart Timetabling System',
  caption = 'Heading to campus…',
  compact = false,         // no title/caption, smaller scene
  fading = false,          // fade the whole screen out (end of preload)
}) => (
  <div
    className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 px-4 transition-opacity duration-300 ${
      fading ? 'opacity-0' : 'opacity-100'
    }`}
    style={{ '--cw-d': `${duration}s` }}
    role="status"
    aria-label={`${title} is loading`}
  >
    <style>{`
      @keyframes cw-in    { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      @keyframes cw-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      @keyframes cw-halo  { 0%, 100% { opacity: .35; transform: scale(1); } 50% { opacity: .55; transform: scale(1.08); } }
      @keyframes cw-twinkle { 0%, 100% { opacity: .15; } 50% { opacity: .8; } }
      @keyframes cw-cloud { from { transform: translateX(-40px); } to { transform: translateX(40px); } }

      /* The walk: enter from the left, reach the door, step inside */
      @keyframes cw-walk {
        0%   { transform: translateX(0);     opacity: 0; }
        8%   { opacity: 1; }
        86%  { transform: translateX(262px); opacity: 1; }
        100% { transform: translateX(276px) scale(.82); opacity: 0; }
      }
      @keyframes cw-bob   { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.6px); } }
      @keyframes cw-leg-a { 0%, 100% { transform: rotate(26deg); }  50% { transform: rotate(-26deg); } }
      @keyframes cw-leg-b { 0%, 100% { transform: rotate(-26deg); } 50% { transform: rotate(26deg); } }
      @keyframes cw-arm-a { 0%, 100% { transform: rotate(-30deg); } 50% { transform: rotate(30deg); } }
      @keyframes cw-arm-b { 0%, 100% { transform: rotate(30deg); }  50% { transform: rotate(-30deg); } }
      @keyframes cw-door  { 0%, 68% { opacity: .15; } 88%, 100% { opacity: 1; } }
      @keyframes cw-beam  { 0%, 72% { opacity: 0; } 90%, 100% { opacity: .3; } }
      @keyframes cw-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes cw-dust  { 0% { opacity: .5; transform: translate(0, 0) scale(.6); } 100% { opacity: 0; transform: translate(-6px, -3px) scale(1.4); } }

      .cw-fade-in  { animation: cw-in .5s ease-out both; }
      .cw-logo     { animation: cw-float 3s ease-in-out infinite; }
      .cw-halo     { animation: cw-halo 3s ease-in-out infinite; }
      .cw-star     { animation: cw-twinkle 2.4s ease-in-out infinite; }
      .cw-cloud    { animation: cw-cloud 9s ease-in-out infinite alternate; }

      .cw-walker   { animation: cw-walk var(--cw-d) cubic-bezier(.45, .05, .55, .95) both; }
      .cw-bob      { animation: cw-bob .5s ease-in-out infinite; }
      /* Limbs swing from the hip / shoulder: the top-centre of each line */
      .cw-limb     { transform-box: fill-box; transform-origin: 50% 0%; }
      .cw-leg-a    { animation: cw-leg-a .5s ease-in-out infinite; }
      .cw-leg-b    { animation: cw-leg-b .5s ease-in-out infinite; }
      .cw-arm-a    { animation: cw-arm-a .5s ease-in-out infinite; }
      .cw-arm-b    { animation: cw-arm-b .5s ease-in-out infinite; }
      .cw-dust     { transform-box: fill-box; transform-origin: center; animation: cw-dust .5s ease-out infinite; }
      .cw-door     { animation: cw-door var(--cw-d) ease-in both; }
      .cw-beam     { animation: cw-beam var(--cw-d) ease-in both; }
      .cw-progress { transform-origin: left; animation: cw-progress var(--cw-d) cubic-bezier(.45, .05, .55, .95) both; }

      /* Reduced motion: a still scene with the student at the gate */
      @media (prefers-reduced-motion: reduce) {
        .cw-fade-in, .cw-logo, .cw-halo, .cw-star, .cw-cloud, .cw-bob, .cw-limb, .cw-dust,
        .cw-door, .cw-beam, .cw-progress { animation: none !important; }
        .cw-walker { animation: none !important; transform: translateX(230px); }
      }
    `}</style>

    {/* Night sky */}
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {[
        [8, 14, 0], [18, 32, 0.6], [30, 9, 1.2], [44, 22, 0.3], [62, 12, 1.6],
        [74, 28, 0.9], [86, 16, 0.2], [92, 36, 1.3], [12, 48, 1.8], [80, 52, 0.5],
      ].map(([x, y, delay], i) => (
        <span
          key={i}
          className="cw-star absolute h-1 w-1 rounded-full bg-white"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>

    <div className="relative flex w-full max-w-md flex-col items-center text-center">
      {!compact && (
        <div className="cw-fade-in relative mb-5 flex items-center justify-center">
          <div className="cw-halo absolute h-28 w-28 rounded-full bg-yellow-400/40 blur-2xl sm:h-32 sm:w-32" />
          <img
            src={ctuLogo}
            alt="CTU Logo"
            className="cw-logo relative z-10 h-20 w-20 object-contain sm:h-24 sm:w-24"
          />
        </div>
      )}

      {!compact && (
        <div className="cw-fade-in mb-6" style={{ animationDelay: '.1s' }}>
          <h2 className="mb-1.5 bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm text-gray-300 sm:text-base">{subtitle}</p>
        </div>
      )}

      {/* The scene */}
      <svg
        viewBox="0 0 340 120"
        className={`cw-fade-in w-full ${compact ? 'max-w-[300px]' : 'max-w-[460px]'}`}
        style={{ animationDelay: '.15s', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Drifting cloud */}
        <g className="cw-cloud" fill="#ffffff" opacity=".08">
          <ellipse cx="120" cy="22" rx="26" ry="7" />
          <ellipse cx="136" cy="17" rx="14" ry="7" />
        </g>

        {/* Ground and path */}
        <path d="M0 101 H340" stroke="#334155" strokeWidth="2" />
        <path d="M0 106 H262" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 7" strokeLinecap="round" />

        {/* Trees */}
        {[52, 128, 196].map((x) => (
          <g key={x}>
            <rect x={x - 1.5} y="84" width="3" height="17" rx="1" fill="#78350f" />
            <circle cx={x} cy="80" r="10" fill="#166534" />
            <circle cx={x - 5} cy="84" r="7" fill="#15803d" />
            <circle cx={x + 5} cy="83" r="7" fill="#14532d" />
          </g>
        ))}

        {/* Lamp posts with a soft pool of light */}
        {[90, 164, 232].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="101" rx="10" ry="2.5" fill="#facc15" opacity=".12" />
            <rect x={x - 0.75} y="72" width="1.5" height="29" fill="#64748b" />
            <circle cx={x} cy="71" r="2.6" fill="#fde68a" />
            <circle cx={x} cy="71" r="6" fill="#fde68a" opacity=".18" />
          </g>
        ))}

        {/* CTU gate */}
        <g>
          {/* Light spilling out of the doorway once the student is near */}
          <path className="cw-beam" d="M277 101 L266 112 H310 L299 101 Z" fill="#facc15" />
          <rect x="250" y="62" width="76" height="39" rx="2" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.2" />
          <path d="M244 63 L288 40 L332 63 Z" fill="#1e40af" stroke="#60a5fa" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="288" cy="54" r="5" fill="#facc15" />
          <text x="288" y="56.3" textAnchor="middle" fontSize="5" fontWeight="700" fill="#1e3a8a">CTU</text>
          {[256, 270, 306, 320].map((x) => (
            <rect key={x} x={x - 2} y="65" width="4" height="36" fill="#93c5fd" opacity=".35" />
          ))}
          {/* Doorway: dark until the student arrives, then warm light */}
          <path d="M277 101 V79 a11 11 0 0 1 22 0 V101 Z" fill="#0f172a" />
          <path className="cw-door" d="M277 101 V79 a11 11 0 0 1 22 0 V101 Z" fill="#fde68a" />
          {/* Flag on the roof */}
          <rect x="287.4" y="30" width="1.2" height="12" fill="#cbd5e1" />
          <path d="M288.6 30.5 h9 l-2.5 3 l2.5 3 h-9 Z" fill="#facc15" />
        </g>

        {/* The student. Outer group walks, inner group bobs, limbs swing,
            so no two animations fight over the same transform. */}
        <g transform="translate(14 101)">
          <g className="cw-walker">
            <g className="cw-bob">
              {/* Drawn slightly larger than the scenery so the walk reads at a glance */}
              <g transform="scale(1.3)">
              {/* Dust kicked up behind the heels */}
              <circle className="cw-dust" cx="-6" cy="-1" r="1.6" fill="#94a3b8" />

              {/* Back leg + back arm (drawn first, behind the body) */}
              <line className="cw-limb cw-leg-b" x1="0" y1="-12" x2="0" y2="0" stroke="#1e293b" strokeWidth="3.2" strokeLinecap="round" />
              <line className="cw-limb cw-arm-b" x1="0" y1="-24" x2="0" y2="-14" stroke="#1d4ed8" strokeWidth="2.6" strokeLinecap="round" />

              {/* Backpack */}
              <rect x="-7.5" y="-25" width="5" height="10" rx="1.6" fill="#facc15" />
              {/* Body (school shirt) */}
              <rect x="-3" y="-26" width="6" height="15" rx="2.5" fill="#3b82f6" />
              {/* Head and hair */}
              <circle cx="0.5" cy="-31" r="4.6" fill="#f5c9a1" />
              <path d="M-4 -32 a4.8 4.8 0 0 1 9.2 -1.6 q-3.4 -0.4 -5.2 1.4 q-1.6 -0.8 -4 0.2 Z" fill="#1f2937" />
              <circle cx="2.6" cy="-31.4" r=".6" fill="#1f2937" />

              {/* Front leg + front arm */}
              <line className="cw-limb cw-leg-a" x1="0" y1="-12" x2="0" y2="0" stroke="#334155" strokeWidth="3.2" strokeLinecap="round" />
              <line className="cw-limb cw-arm-a" x1="0" y1="-24" x2="0" y2="-14" stroke="#60a5fa" strokeWidth="2.6" strokeLinecap="round" />
              </g>
            </g>
          </g>
        </g>
      </svg>

      {/* Progress along the path, in step with the walk */}
      <div className={`mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10 ${compact ? 'max-w-[200px]' : 'max-w-[260px]'}`}>
        <div className="cw-progress h-full rounded-full bg-gradient-to-r from-blue-500 via-yellow-400 to-white" />
      </div>

      {!compact && caption && (
        <p className="cw-fade-in mt-3 text-xs tracking-wide text-blue-200/80" style={{ animationDelay: '.3s' }}>
          {caption}
        </p>
      )}
    </div>
  </div>
);

export default CampusWalkLoader;
