import React from 'react';
import { Bone } from './ui/Skeleton';

// Icon tile colours. Colour carries meaning, so there are only five:
//   blue   = neutral counts and information (the brand colour)
//   emerald = good / done     orange = warning, needs attention
//   red    = failed / problem  gray  = nothing to report
//   yellow = highlight only (CTU gold, Day shift)
// Older colour names still work and map onto these.
const BLUE = 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300';
const EMERALD = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300';
const ORANGE = 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300';
const RED = 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300';
const TONES = {
  blue: BLUE, indigo: BLUE, sky: BLUE, violet: BLUE, purple: BLUE, teal: BLUE, cyan: BLUE,
  emerald: EMERALD, green: EMERALD,
  orange: ORANGE, amber: ORANGE,
  // Yellow is a highlight (the CTU gold, the Day shift), never a warning
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  red: RED, rose: RED,
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
};

/**
 * Summary number card: label, icon tile, big value, one-line hint.
 * With onClick it becomes a toggle button (e.g. a quick filter) and `active`
 * highlights it.
 */
const StatCard = ({ icon: Icon, label, value, hint, tone = 'indigo', active = false, onClick, title, loading = false, className = '' }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick && { type: 'button', onClick, 'aria-pressed': active })}
      title={title}
      className={`min-w-0 rounded-xl border p-4 text-left shadow-sm transition-all ${className} ${
        onClick ? 'hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500' : ''
      } ${
        active
          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400 dark:border-blue-500 dark:bg-blue-900/30'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
        {Icon && (
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${TONES[tone] || TONES.indigo}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 truncate text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
        {loading ? <Bone as="span" className="inline-block h-7 w-12 align-middle" /> : value}
      </div>
      {(hint || loading) && (
        <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
          {loading ? <Bone as="span" className="inline-block h-3 w-24 align-middle" /> : hint}
        </div>
      )}
    </Tag>
  );
};

export default StatCard;
