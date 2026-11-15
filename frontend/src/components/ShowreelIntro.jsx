import React, { useEffect, useRef, useState } from 'react';
import ctuLogo from '../assets/images/logos/ctulogo.png';

/*
 * Motion-graphics intro for the landing page — a short showreel that tells the
 * product's story instead of just spinning: the CTU seal ignites, the name
 * snaps in, a week's timetable draws itself and the classes fly in and lock
 * into their slots, and it finishes on a "0 conflicts" seal. Same blue-and-gold
 * language as the page it hands off to.
 *
 * Deliberately short (~3.2s) and skippable — an intro should impress, never
 * make someone wait. Reduced-motion gets the final frame at once.
 *
 * Timing is pure CSS (keyframes + delays), so nothing re-renders mid-sequence;
 * `onDone` fires once when it finishes or when skipped.
 */

// One class block in the demo timetable: grid cell, how many columns it spans,
// a tone, and the direction it flies in from.
const CELL_W = 52;
const CELL_H = 40;
const COLS = 5;
const ROWS = 4;

const BLOCKS = [
  { col: 0, row: 0, span: 2, tone: 'from-sky-400 to-blue-600', fx: -160, fy: -60, delay: 0.00 },
  { col: 2, row: 0, span: 1, tone: 'from-emerald-400 to-emerald-600', fx: 0, fy: -140, delay: 0.10 },
  { col: 4, row: 0, span: 1, tone: 'from-amber-300 to-amber-500', fx: 160, fy: -60, delay: 0.20 },
  { col: 1, row: 1, span: 2, tone: 'from-violet-400 to-indigo-600', fx: 160, fy: 20, delay: 0.16 },
  { col: 3, row: 1, span: 2, tone: 'from-amber-300 to-amber-500', fx: 160, fy: -20, delay: 0.28 },
  { col: 0, row: 2, span: 1, tone: 'from-blue-400 to-blue-700', fx: -160, fy: 80, delay: 0.24 },
  { col: 1, row: 2, span: 1, tone: 'from-emerald-400 to-emerald-600', fx: 0, fy: 150, delay: 0.34 },
  { col: 2, row: 3, span: 2, tone: 'from-sky-400 to-blue-600', fx: 40, fy: 150, delay: 0.40 },
  { col: 4, row: 2, span: 1, tone: 'from-violet-400 to-indigo-600', fx: 170, fy: 60, delay: 0.46 },
];

const DAYS = ['M', 'T', 'W', 'TH', 'F'];

export default function ShowreelIntro({ onDone, duration = 3.2 }) {
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);
  const reduce = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.();
  };

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(finish, 500);
      return () => clearTimeout(t);
    }
    // Fade near the end, then hand off.
    const fadeAt = setTimeout(() => setFading(true), duration * 1000);
    const doneAt = setTimeout(finish, duration * 1000 + 450);
    return () => { clearTimeout(fadeAt); clearTimeout(doneAt); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { setFading(true); setTimeout(finish, 180); };

  return (
    <div
      role="status"
      aria-label="CTU Daanbantayan Smart Timetabling System is loading"
      onClick={skip}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-900 via-blue-950 to-gray-950 transition-opacity duration-300 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <style>{`
        @keyframes si-logo { 0% { opacity: 0; transform: scale(.4) rotate(-20deg); } 60% { transform: scale(1.12) rotate(4deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
        @keyframes si-ring { to { stroke-dashoffset: 0; } }
        @keyframes si-halo { 0% { opacity: 0; transform: scale(.6); } 40% { opacity: .9; } 100% { opacity: .45; transform: scale(1.5); } }
        @keyframes si-rise { from { transform: translateY(115%); } to { transform: translateY(0); } }
        @keyframes si-underline { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes si-grid-v { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes si-grid-h { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes si-block {
          0%   { opacity: 0; transform: translate(var(--fx), var(--fy)) scale(.55); }
          70%  { opacity: 1; transform: translate(0,0) scale(1.08); }
          85%  { transform: translate(0,0) scale(.96); }
          100% { opacity: 1; transform: translate(0,0) scale(1); }
        }
        @keyframes si-scan { 0% { transform: translateX(-110%); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateX(110%); opacity: 0; } }
        @keyframes si-seal { 0% { opacity: 0; transform: scale(0); } 55% { transform: scale(1.18); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes si-burst { 0% { opacity: .8; transform: scale(.3); } 100% { opacity: 0; transform: scale(2.1); } }
        @keyframes si-check { to { stroke-dashoffset: 0; } }
        @keyframes si-particle { 0% { opacity: 0; } 30% { opacity: .6; } 100% { opacity: 0; transform: translateY(-40px); } }

        .si-logo { animation: si-logo .7s cubic-bezier(.2,1.3,.4,1) both; }
        .si-halo { animation: si-halo 1.1s ease-out both; }
        .si-ring { stroke-dasharray: 190; stroke-dashoffset: 190; animation: si-ring .9s ease-out .25s both; }
        .si-rise { display: inline-block; animation: si-rise .7s cubic-bezier(.16,1,.3,1) both; }
        .si-underline { transform-origin: left; animation: si-underline .6s cubic-bezier(.16,1,.3,1) .7s both; }

        .si-grid-v { transform-origin: top; animation: si-grid-v .5s ease-out both; }
        .si-grid-h { transform-origin: left; animation: si-grid-h .5s ease-out both; }
        .si-block  { animation: si-block .75s cubic-bezier(.2,1.1,.3,1) both; }
        .si-scan   { animation: si-scan .8s ease-in-out 2.3s both; }
        .si-seal   { animation: si-seal .6s cubic-bezier(.2,1.4,.4,1) 2.55s both; }
        .si-burst  { animation: si-burst .7s ease-out 2.55s both; }
        .si-check  { stroke-dasharray: 26; stroke-dashoffset: 26; animation: si-check .4s ease-out 2.85s both; }
        .si-particle { animation: si-particle 2.4s ease-in-out infinite; }

        .si-skip { opacity: 0; animation: si-fadein .4s ease-out 1s both; }
        @keyframes si-fadein { to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .si-logo,.si-halo,.si-ring,.si-rise,.si-underline,.si-grid-v,.si-grid-h,
          .si-block,.si-scan,.si-seal,.si-burst,.si-check,.si-particle,.si-skip {
            animation: none !important; opacity: 1 !important; transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

      {/* Drifting particles for depth */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {[[12, 70, 0], [28, 82, .8], [46, 64, 1.6], [66, 78, .4], [84, 68, 1.2], [92, 84, 2]].map(([x, y, d], i) => (
          <span key={i} className="si-particle absolute h-1 w-1 rounded-full bg-yellow-300/70"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
        ))}
      </div>

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Logo ignition */}
        <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
          <span className="si-halo absolute inset-0 rounded-full bg-yellow-400/40 blur-2xl" aria-hidden="true" />
          <svg viewBox="0 0 68 68" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle className="si-ring" cx="34" cy="34" r="30" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" transform="rotate(-90 34 34)" />
          </svg>
          <img src={ctuLogo} alt="CTU Logo" className="si-logo relative z-10 h-16 w-16 object-contain" />
        </div>

        {/* Kinetic title */}
        <div className="mb-1 overflow-hidden">
          <h1 className="si-rise text-2xl font-black tracking-tight text-white sm:text-3xl">
            Smart Timetabling
          </h1>
        </div>
        <div className="overflow-hidden">
          <span className="si-rise bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl"
            style={{ animationDelay: '.1s' }}>
            System
          </span>
        </div>
        <span className="si-underline mt-2 block h-0.5 w-40 rounded bg-gradient-to-r from-blue-500 via-yellow-400 to-yellow-300" aria-hidden="true" />

        {/* The timetable assembling itself */}
        <div
          className="relative mt-7"
          style={{ width: COLS * CELL_W, height: ROWS * CELL_H + 18 }}
          aria-hidden="true"
        >
          {/* Day header */}
          <div className="absolute left-0 top-0 flex w-full" style={{ height: 16 }}>
            {DAYS.map((d, i) => (
              <span key={d} className="si-grid-h text-center text-[10px] font-bold tracking-wide text-blue-200/70"
                style={{ width: CELL_W, animationDelay: `${0.6 + i * 0.05}s` }}>{d}</span>
            ))}
          </div>

          <div className="absolute left-0" style={{ top: 18, width: COLS * CELL_W, height: ROWS * CELL_H }}>
            {/* Grid lines */}
            {Array.from({ length: COLS + 1 }).map((_, i) => (
              <span key={`v${i}`} className="si-grid-v absolute top-0 w-px bg-white/10"
                style={{ left: i * CELL_W, height: ROWS * CELL_H, animationDelay: `${0.65 + i * 0.04}s` }} />
            ))}
            {Array.from({ length: ROWS + 1 }).map((_, i) => (
              <span key={`h${i}`} className="si-grid-h absolute left-0 h-px bg-white/10"
                style={{ top: i * CELL_H, width: COLS * CELL_W, animationDelay: `${0.75 + i * 0.04}s` }} />
            ))}

            {/* Class blocks flying into their slots */}
            {BLOCKS.map((b, i) => (
              <div
                key={i}
                className={`si-block absolute rounded-md bg-gradient-to-br ${b.tone} shadow-lg shadow-black/40`}
                style={{
                  left: b.col * CELL_W + 3,
                  top: b.row * CELL_H + 3,
                  width: b.span * CELL_W - 6,
                  height: CELL_H - 6,
                  '--fx': `${b.fx}px`,
                  '--fy': `${b.fy}px`,
                  animationDelay: `${1.15 + b.delay}s`,
                }}
              >
                <span className="absolute left-1 top-1 h-1 w-4 rounded-full bg-white/50" />
              </div>
            ))}

            {/* Gold scan sweep across the finished grid */}
            <span className="si-scan pointer-events-none absolute inset-y-0 w-16"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(250,204,21,.35), transparent)' }} />
          </div>

          {/* "0 conflicts" seal */}
          <div className="absolute -right-3 -top-3 flex items-center gap-1.5">
            <span className="si-burst absolute right-3 top-3 h-10 w-10 rounded-full bg-emerald-400/40" />
            <span className="si-seal flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 backdrop-blur-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path className="si-check" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[11px] font-bold text-emerald-300">0 conflicts</span>
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className="si-skip absolute bottom-6 right-6 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-yellow-400/60 hover:text-yellow-300"
      >
        Skip intro
      </button>
    </div>
  );
}
