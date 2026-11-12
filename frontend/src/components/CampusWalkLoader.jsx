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
  // Fill the parent instead of the whole screen, for loading one area of a
  // page (the schedule builder's workspace) while the rest stays usable
  inline = false,
}) => (
  <div
    className={`${
      inline
        // Inside the app, so it follows the theme: a daylight panel in light
        // mode, the night scene in dark mode. The full-screen version always
        // stays night, since the landing page it covers is dark either way.
        ? 'relative h-full w-full rounded-2xl border border-gray-200 bg-gradient-to-br from-sky-50 via-white to-slate-100 dark:border-gray-700 dark:from-blue-900 dark:via-blue-950 dark:to-gray-950'
        : 'fixed inset-0 z-50 bg-gradient-to-br from-blue-900 via-blue-950 to-gray-950'
    } flex items-center justify-center overflow-hidden px-4 transition-opacity duration-300 ${
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
      /* Waddle: rock over each foot and bounce on every step */
      @keyframes cw-bob {
        0%, 100% { transform: translateY(0) rotate(-4deg); }
        25%      { transform: translateY(-1.8px) rotate(0deg); }
        50%      { transform: translateY(0) rotate(4deg); }
        75%      { transform: translateY(-1.8px) rotate(0deg); }
      }
      @keyframes cw-squish { 0%, 50%, 100% { transform: scale(1.04, .96); } 25%, 75% { transform: scale(.98, 1.02); } }
      @keyframes cw-blink  { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(.1); } }
      @keyframes cw-shadow { 0%, 50%, 100% { transform: scaleX(1); opacity: .35; } 25%, 75% { transform: scaleX(.85); opacity: .25; } }
      @keyframes cw-leg-a { 0%, 100% { transform: rotate(24deg); }  50% { transform: rotate(-24deg); } }
      @keyframes cw-leg-b { 0%, 100% { transform: rotate(-24deg); } 50% { transform: rotate(24deg); } }
      @keyframes cw-arm-a { 0%, 100% { transform: rotate(-34deg); } 50% { transform: rotate(34deg); } }
      @keyframes cw-arm-b { 0%, 100% { transform: rotate(34deg); }  50% { transform: rotate(-34deg); } }
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
      .cw-bob      { transform-box: fill-box; transform-origin: 50% 100%; animation: cw-bob .5s ease-in-out infinite; }
      .cw-squish   { transform-box: fill-box; transform-origin: 50% 100%; animation: cw-squish .5s ease-in-out infinite; }
      .cw-blink    { transform-box: fill-box; transform-origin: center; animation: cw-blink 2.6s ease-in-out infinite; }
      .cw-shadow   { transform-box: fill-box; transform-origin: center; animation: cw-shadow .5s ease-in-out infinite; }
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
        .cw-squish, .cw-blink, .cw-shadow,
        .cw-door, .cw-beam, .cw-progress { animation: none !important; }
        .cw-walker { animation: none !important; transform: translateX(230px); }
      }
    `}</style>

    {/* Night sky: stars only make sense against the dark scene */}
    <div
      className={`pointer-events-none absolute inset-0 ${inline ? 'hidden dark:block' : ''}`}
      aria-hidden="true"
    >
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
        <g
          className={`cw-cloud ${inline ? 'text-slate-300 opacity-80 dark:text-white dark:opacity-10' : 'text-white opacity-10'}`}
          fill="currentColor"
        >
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

        {/* CTU Daanbantayan building: two storeys, flat roof and a covered
            second-floor walkway, like the campus itself. It used to be a
            columned hall under a triangular pediment, which read as a
            generic ivy-league temple rather than this school. */}
        <g>
          {/* Light spilling out of the doorway once the student is near */}
          <path className="cw-beam" d="M280 101 L269 112 H307 L296 101 Z" fill="#facc15" />

          {/* Flat roof slab, overhanging a little */}
          <rect x="242" y="52" width="92" height="5" rx="1" fill="#1e40af" stroke="#60a5fa" strokeWidth="1" />
          {/* Two-storey block */}
          <rect x="246" y="57" width="84" height="44" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.2" />
          {/* Signage band under the roof line */}
          <rect x="260" y="58.6" width="56" height="3.6" rx="1" fill="#facc15" opacity=".7" />

          {/* Walkway rail between the floors */}
          <rect x="246" y="77" width="84" height="2.4" fill="#1e40af" />
          <rect x="246" y="79.4" width="84" height="0.9" fill="#60a5fa" opacity=".45" />

          {/* Classroom windows, upper and lower floor */}
          {[252, 263, 311, 322].map((x) => (
            <rect key={`u${x}`} x={x} y="65.5" width="7" height="9" rx="1" fill="#93c5fd" opacity=".4" />
          ))}
          {[252, 263, 311, 322].map((x) => (
            <rect key={`l${x}`} x={x} y="84" width="7" height="10" rx="1" fill="#93c5fd" opacity=".32" />
          ))}

          {/* CTU seal on the facade, above the entrance */}
          <circle cx="288" cy="69" r="6.4" fill="#ffffff" stroke="#facc15" strokeWidth=".8" />
          <image href={ctuLogo} x="282.6" y="63.6" width="10.8" height="10.8" preserveAspectRatio="xMidYMid meet" />

          {/* Entrance canopy, doorway (dark until the student arrives) and steps */}
          <rect x="273" y="81" width="30" height="2.4" rx="1" fill="#1e40af" stroke="#60a5fa" strokeWidth=".6" />
          <rect x="280" y="84" width="16" height="17" rx="1" fill="#0f172a" />
          <rect className="cw-door" x="280" y="84" width="16" height="17" rx="1" fill="#fde68a" />
          <rect x="276" y="99.4" width="24" height="1.8" rx=".6" fill="#475569" />

          {/* Flagpole on the roof */}
          <rect x="287.4" y="38" width="1.2" height="14" fill="#cbd5e1" />
          <path d="M288.6 38.5 h9 l-2.5 3 l2.5 3 h-9 Z" fill="#facc15" />
        </g>

        {/* The student: a chubby kid in the school polo, waddling to class.
            Outer group walks, the next rocks/bounces, the body squishes and
            the limbs swing, so no two animations fight over one transform. */}
        <g transform="translate(14 101)">
          <g className="cw-walker">
            {/* Shadow stays on the ground while the body bounces */}
            <ellipse className="cw-shadow" cx="0" cy="0.5" rx="11" ry="1.8" fill="#020617" />
            <g className="cw-bob">
              {/* Drawn slightly larger than the scenery so the walk reads at a glance */}
              <g transform="scale(1.2)">
              {/* Dust kicked up behind the heels */}
              <circle className="cw-dust" cx="-9" cy="-1" r="1.6" fill="#94a3b8" />

              {/* Back leg + back arm (drawn first, behind the body) */}
              <g className="cw-limb cw-leg-b">
                <rect x="-4.6" y="-10" width="5" height="9.4" rx="2.4" fill="#172554" />
                <ellipse cx="-1.4" cy="-0.9" rx="3.4" ry="1.7" fill="#0f172a" />
              </g>
              <g className="cw-limb cw-arm-b">
                <rect x="-1.4" y="-22" width="4" height="7.5" rx="2" fill="#dbeafe" />
                <circle cx="0.6" cy="-14" r="2.1" fill="#e8b48c" />
              </g>

              <g className="cw-squish">
                {/* Backpack with a strap over the shoulder */}
                <rect x="-13" y="-24" width="7" height="12" rx="3" fill="#facc15" />
                <rect x="-12.2" y="-18.5" width="5.4" height="4.2" rx="1.4" fill="#eab308" />
                {/* Round tummy: white polo over navy pants */}
                <ellipse cx="0" cy="-14.5" rx="9" ry="9.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".6" />
                <path d="M-8.4 -11 A9 9.5 0 0 0 8.4 -11 Z" fill="#1e3a8a" />
                <rect x="-8.4" y="-11.6" width="16.8" height="1.4" fill="#0f172a" opacity=".55" />
                <ellipse cx="-3" cy="-17" rx="3.4" ry="4.4" fill="#ffffff" opacity=".7" />
                <path d="M-6.4 -14.2 L-7.2 -21" stroke="#ca8a04" strokeWidth="1.6" strokeLinecap="round" />
                {/* Collar and school ID on a lanyard */}
                <path d="M-1.5 -23.4 L2 -20.6 L5.4 -23.2" fill="none" stroke="#2563eb" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 -20.6 L4.2 -16.4" stroke="#2563eb" strokeWidth=".7" />
                <rect x="2.8" y="-16.6" width="3.4" height="4.2" rx=".6" fill="#facc15" />
                <rect x="3.5" y="-15.8" width="2" height="1.4" rx=".3" fill="#1e3a8a" />

                {/* Big round head */}
                <circle cx="1.5" cy="-29.5" r="7.6" fill="#f5c9a1" />
                <circle cx="-1.6" cy="-28.6" r="1.7" fill="#e8b48c" />
                {/* Hair with a little fringe */}
                <path
                  d="M-6.2 -26.4 C-7.8 -33.6 -2 -38.6 3.8 -37.2 C7.6 -36.3 9.6 -33.6 9.2 -31 C6.8 -32.8 4 -33 2 -31.6 C0.8 -33 -1.2 -32.6 -2.2 -30.8 C-3.2 -28.8 -4.4 -27.2 -6.2 -26.4 Z"
                  fill="#1f2937"
                />
                {/* Glasses, blinking eye, rosy cheek and a smile */}
                <g className="cw-blink">
                  <circle cx="5.6" cy="-29.6" r=".85" fill="#1f2937" />
                </g>
                <circle cx="5.6" cy="-29.6" r="2.3" fill="none" stroke="#1f2937" strokeWidth=".6" />
                <path d="M3.3 -29.8 L-0.4 -29.2" stroke="#1f2937" strokeWidth=".6" />
                <circle cx="6.4" cy="-26.4" r="1.6" fill="#fb7185" opacity=".45" />
                <path d="M6.6 -24.9 q1.4 .9 2.6 -.2" fill="none" stroke="#7c2d12" strokeWidth=".6" strokeLinecap="round" />
              </g>

              {/* Front leg + front arm */}
              <g className="cw-limb cw-leg-a">
                <rect x="-0.6" y="-10" width="5" height="9.4" rx="2.4" fill="#1e3a8a" />
                <ellipse cx="2.6" cy="-0.9" rx="3.4" ry="1.7" fill="#1e293b" />
              </g>
              <g className="cw-limb cw-arm-a">
                <rect x="-1.6" y="-22" width="4.2" height="7.5" rx="2.1" fill="#eff6ff" stroke="#93c5fd" strokeWidth=".6" />
                <circle cx="0.5" cy="-14" r="2.2" fill="#f5c9a1" />
              </g>
              </g>
            </g>
          </g>
        </g>
      </svg>

      {/* Progress along the path, in step with the walk */}
      <div className={`mt-4 h-1 w-full overflow-hidden rounded-full ${inline ? 'bg-slate-900/10 dark:bg-white/10' : 'bg-white/10'} ${compact ? 'max-w-[200px]' : 'max-w-[260px]'}`}>
        <div className={`cw-progress h-full rounded-full bg-gradient-to-r from-blue-500 via-yellow-400 ${inline ? 'to-blue-600 dark:to-white' : 'to-white'}`} />
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
