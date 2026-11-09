import React from 'react';

/*
 * A manila folder (a section, a year level...), drawn inline. On hover the flap tips forward
 * and the sheets inside rise. `transform-box: fill-box` makes each origin
 * relative to the shape rather than the whole SVG.
 */
const FOLDER_EASE = 'transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] motion-reduce:transition-none [transform-box:fill-box]';
const FolderGlyph = () => (
  <span className="relative block">
    <svg viewBox="0 0 96 78" className="relative z-10 h-20 w-24 overflow-visible transition-transform duration-300 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 motion-reduce:transition-none" aria-hidden="true">
      <defs>
        <linearGradient id="folderBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#f6c445" /></linearGradient>
        <linearGradient id="folderFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fde08a" /><stop offset="100%" stopColor="#f8c84e" /></linearGradient>
      </defs>
      <path d="M3 13a7 7 0 0 1 7-7h24.6a4 4 0 0 1 2.9 1.2l5.2 5.3a4 4 0 0 0 2.9 1.2H86a7 7 0 0 1 7 7v44a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7z" fill="url(#folderBack)" />
      <g className={`${FOLDER_EASE} origin-bottom group-hover:-translate-y-[9px] group-hover:rotate-[7deg] group-focus-visible:-translate-y-[9px] group-focus-visible:rotate-[7deg]`}>
        <path d="M38 18h24l8 8v20H38z" fill="#f3f4f6" /><path d="M62 18l8 8h-8z" fill="#d6dae0" />
      </g>
      <g className={`${FOLDER_EASE} origin-bottom group-hover:-translate-y-[6px] group-hover:-rotate-[4deg] group-focus-visible:-translate-y-[6px] group-focus-visible:-rotate-[4deg]`}>
        <path d="M31 15h24l9 9v20H31z" fill="#ffffff" /><path d="M55 15l9 9h-9z" fill="#dfe3e8" />
        <g fill="#c9ced6"><rect x="36" y="24" width="14" height="1.6" rx=".8" /><rect x="36" y="28" width="19" height="1.6" rx=".8" /><rect x="36" y="32" width="11" height="1.6" rx=".8" /></g>
      </g>
      <path d="M3 32h90v32a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7z" fill="url(#folderFront)" className={`${FOLDER_EASE} origin-bottom group-hover:[transform:scaleY(.82)_skewX(-7deg)] group-focus-visible:[transform:scaleY(.82)_skewX(-7deg)]`} />
    </svg>
    <span aria-hidden="true" className="absolute -bottom-1 left-1/2 h-2 w-16 -translate-x-1/2 rounded-full bg-black/10 blur-[3px] transition-all duration-300 group-hover:w-20 group-hover:bg-black/15 motion-reduce:transition-none" />
  </span>
);

export default FolderGlyph;
