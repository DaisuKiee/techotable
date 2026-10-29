import React from 'react';

// Icon tile colours. Same look in every page's summary row.
const TONES = {
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300',
  teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300',
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
        onClick ? 'hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500' : ''
      } ${
        active
          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400 dark:border-indigo-500 dark:bg-indigo-900/30'
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
        {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-gray-200 align-middle dark:bg-gray-700" /> : value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{hint}</div>}
    </Tag>
  );
};

export default StatCard;
