import React, { useMemo, useState } from 'react';
import { Sparkles, ArrowUpRight, Wrench, Check } from 'lucide-react';
import PublicShell from '../components/public/PublicShell';
import usePageMeta from '../hooks/usePageMeta';
import { UPDATES, KIND_LABEL } from '../content/updates';

/*
 * Public release notes. Newest first, with the most recent release marked so
 * someone checking "did my problem get fixed?" can see the answer without
 * reading dates.
 *
 * Colours follow the system's meaning rather than decoration: blue for
 * information, green for something that got better, grey for a repair.
 */

const KIND_STYLE = {
  new: {
    chip: 'bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30',
    dot: 'text-blue-400',
    Icon: Sparkles,
  },
  improved: {
    chip: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
    dot: 'text-emerald-400',
    Icon: ArrowUpRight,
  },
  fixed: {
    chip: 'bg-gray-500/15 text-gray-300 ring-1 ring-inset ring-gray-500/30',
    dot: 'text-gray-400',
    Icon: Wrench,
  },
};

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'new', label: 'New' },
  { key: 'improved', label: 'Improved' },
  { key: 'fixed', label: 'Fixed' },
];

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const UpdatesPage = () => {
  const [filter, setFilter] = useState('all');

  usePageMeta({
    title: 'Updates',
    description:
      'Release notes for the CTU Daanbantayan Smart Timetabling System: what is new, what improved and what was fixed, newest first.',
    path: '/updates',
  });

  // Filtering hides individual changes, then any release left with none.
  const releases = useMemo(() => {
    if (filter === 'all') return UPDATES;
    return UPDATES.map((release) => ({
      ...release,
      changes: release.changes.filter((change) => change.kind === filter),
    })).filter((release) => release.changes.length > 0);
  }, [filter]);

  const latestId = UPDATES[0]?.id;

  return (
    <PublicShell
      eyebrow="What's new"
      title="Updates"
      lead="Every change to the timetabling system, newest first — written for the people who use it rather than the people who built it."
    >
      {/* Filters */}
      <div className="mb-10 flex flex-wrap gap-2" role="group" aria-label="Filter updates by kind">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={active}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-yellow-400 text-blue-950'
                  : 'bg-white/5 text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {releases.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center text-gray-400">
          Nothing under that heading yet.
        </p>
      ) : (
        <ol className="relative space-y-12 border-l border-white/10 pl-6 sm:pl-10">
          {releases.map((release) => (
            <li key={release.id} id={release.id} className="relative scroll-mt-24">
              {/* Timeline marker */}
              <span
                aria-hidden="true"
                className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-gray-950 sm:-left-[47px] ${
                  release.id === latestId ? 'bg-yellow-400' : 'bg-gray-600'
                }`}
              />

              <div className="mb-3 flex flex-wrap items-center gap-3">
                <time dateTime={release.date} className="text-sm font-medium text-gray-400">
                  {formatDate(release.date)}
                </time>
                {release.id === latestId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 px-2.5 py-0.5 text-xs font-semibold text-yellow-300 ring-1 ring-inset ring-yellow-400/30">
                    <Check className="h-3 w-3" /> Latest
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{release.title}</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-gray-400">{release.summary}</p>

              <ul className="mt-6 max-w-3xl space-y-3">
                {release.changes.map((change, index) => {
                  const style = KIND_STYLE[change.kind] ?? KIND_STYLE.improved;
                  const { Icon } = style;
                  return (
                    <li
                      key={index}
                      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-start sm:gap-4"
                    >
                      <span
                        className={`inline-flex w-fit flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {KIND_LABEL[change.kind] ?? change.kind}
                      </span>
                      <p className="text-sm leading-relaxed text-gray-300 sm:pt-1">{change.text}</p>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-14 border-t border-white/10 pt-8 text-sm text-gray-500">
        Looking for how something works rather than when it changed? That is in the{' '}
        <a href="/docs" className="font-medium text-yellow-400 underline-offset-4 hover:underline">
          documentation
        </a>
        .
      </p>
    </PublicShell>
  );
};

export default UpdatesPage;
