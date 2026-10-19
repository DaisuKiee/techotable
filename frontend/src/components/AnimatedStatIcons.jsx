/**
 * AnimatedStatIcons
 * 
 * Central export file for all animated stat card icons used in Dashboard.
 * Each icon is a separate component with sophisticated animations following
 * the AnimatedUsers.jsx pattern.
 */

// Import existing animated components
export { default as AnimatedUsers } from './AnimatedUsers';
export { default as AnimatedBookOpen } from './AnimatedBookOpen';
export { default as AnimatedUserCheck } from './AnimatedUserCheck';
export { default as AnimatedDoorOpen } from './AnimatedDoorOpen';

// Import newly created animated components (sophisticated versions)
export { default as AnimatedCalendar } from './AnimatedCalendar';
export { default as AnimatedClock } from './AnimatedClock';
export { default as AnimatedUserX } from './AnimatedUserX';
export { default as AnimatedFileClock } from './AnimatedFileClock';
export { default as AnimatedBell } from './AnimatedBell';
export { default as AnimatedFaculty } from './AnimatedFaculty';
export { default as AnimatedStudents } from './AnimatedStudents';
export { default as AnimatedBuilding } from './AnimatedBuilding';
export { default as AnimatedClassSpace } from './AnimatedClassSpace';

// Optional: Wallet and Banknote (not currently used in Dashboard)
import React from 'react';

export const AnimatedWallet = ({ className = "h-6 w-6", ...props }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: 'scalePulse 4s ease-in-out infinite' }}
    {...props}
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    <style>{`
      @keyframes scalePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `}</style>
  </svg>
);

export const AnimatedBanknote = ({ className = "h-6 w-6", ...props }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: 'slide 5s ease-in-out infinite' }}
    {...props}
  >
    <rect width="20" height="12" x="2" y="6" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
    <style>{`
      @keyframes slide {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(2px); }
      }
    `}</style>
  </svg>
);
