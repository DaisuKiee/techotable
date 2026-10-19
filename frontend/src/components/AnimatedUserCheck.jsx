import React from 'react';

// AnimatedUserCheck.jsx
// Animated replacement for lucide-react's <UserCheck /> in the "Faculty Approval Queue" header.
// Same geometry as the Lucide icon (24x24 viewBox), so it drops into the same spot.
// Usage:  <AnimatedUserCheck className="w-10 h-10" />
// It inherits the text color (currentColor), so it stays white like your current icon.

export default function AnimatedUserCheck({ className = "w-10 h-10", loop = true }) {
  return (
    <>
      <style>{`
        .auc-shoulders, .auc-head, .auc-check {
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .auc-shoulders {
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
          animation: auc-draw 0.6s ease-out 0.1s forwards;
        }
        .auc-head {
          stroke-dasharray: 26;
          stroke-dashoffset: 26;
          transform-origin: 9px 7px;
          animation: auc-draw 0.6s ease-out 0.3s forwards;
        }
        .auc-check {
          stroke-dasharray: 9;
          stroke-dashoffset: 9;
          transform-origin: 20px 11px;
          animation:
            auc-draw 0.35s ease-out 0.9s forwards,
            auc-pop 0.4s ease-out 1.25s;
        }
        .auc-svg.auc-loop .auc-shoulders,
        .auc-svg.auc-loop .auc-head,
        .auc-svg.auc-loop .auc-check {
          animation-iteration-count: 1;
        }
        .auc-float { animation: auc-float 3s ease-in-out 1.7s infinite; transform-origin: 12px 12px; }
        @keyframes auc-draw { to { stroke-dashoffset: 0; } }
        @keyframes auc-pop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.35); }
        }
        @keyframes auc-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auc-shoulders, .auc-head, .auc-check, .auc-float {
            animation: none; stroke-dashoffset: 0;
          }
        }
      `}</style>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className={`auc-svg ${loop ? "auc-loop" : ""} ${className}`}
        aria-hidden="true"
      >
        <g className="auc-float">
          <path className="auc-shoulders" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle className="auc-head" cx="9" cy="7" r="4" />
          <polyline className="auc-check" points="16 11 18 13 22 9" />
        </g>
      </svg>
    </>
  );
}
