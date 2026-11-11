import React from 'react';
import { Clock, MapPin, Megaphone, Paperclip, Users, ArrowUpRight } from 'lucide-react';
import { Bone, SkeletonRegion } from '../ui/Skeleton';
import {
  WEEK, accentFor, tint, toMin, fmtTime, fmtRange, todayName, nextMeeting, describeNext,
  subjectCodeOf, subjectNameOf, facultyNameOf, timeSlotsOf, roomOf, initialsOf, avatarSrc, fileKind,
} from './classMeta';

/** Round photo, or initials on a tinted disc. */
export const Avatar = ({ name, picture, size = 36, hex = '#475569', className = '' }) => {
  const src = avatarSrc(picture);
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36, background: tint(hex, 0.14), color: hex }}
    >
      {src ? <img src={src} alt={name || ''} className="h-full w-full object-cover" /> : initialsOf(name)}
    </span>
  );
};

/** Square file-type tile: PDF, DOC, PPT... */
export const FileBadge = ({ material, size = 40 }) => {
  const k = fileKind(material);
  return (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center rounded-lg font-mono font-bold tracking-tight"
      style={{ width: size, height: size, fontSize: size * 0.26, background: tint(k.hex, 0.12), color: k.hex, boxShadow: `inset 0 0 0 1px ${tint(k.hex, 0.25)}` }}
    >
      {k.kind}
    </span>
  );
};

/** Six cells, Mon–Sat; lit where the class meets, today outlined. */
export const WeekStrip = ({ slots, hex }) => {
  const days = new Set(slots.map((s) => s.day));
  const today = todayName();
  return (
    <div className="flex gap-1" aria-label={`Meets ${[...days].join(', ') || 'no days set'}`}>
      {WEEK.map((d) => {
        const on = days.has(d);
        return (
          <span
            key={d}
            title={on ? `${d}: ${slots.filter((s) => s.day === d).map(fmtRange).join(', ')}` : d}
            className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold ${
              on ? 'text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-700/60 dark:text-gray-500'
            } ${d === today ? 'ring-2 ring-offset-1 ring-gray-900/70 ring-offset-white dark:ring-white/70 dark:ring-offset-gray-800' : ''}`}
            style={on ? { background: hex } : undefined}
          >
            {d[0]}
          </span>
        );
      })}
    </div>
  );
};

/* Day window for the rhythm chart */
const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const pct = (m) => `${((Math.min(Math.max(m, DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;

/**
 * The week as six thin tracks with the class's meetings drawn to scale.
 * Reads instantly as "mornings, three times a week" without parsing times.
 */
export const WeekRhythm = ({ slots, hex }) => {
  const today = todayName();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    <div>
      <div className="space-y-1.5">
        {WEEK.map((d) => {
          const mine = slots.filter((s) => s.day === d);
          const isToday = d === today;
          return (
            <div key={d} className="flex items-center gap-2">
              <span className={`w-8 text-[11px] font-semibold ${isToday ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                {d.slice(0, 3)}
              </span>
              <div className={`relative h-4 flex-1 rounded ${isToday ? 'bg-gray-200/80 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                {mine.map((s, i) => (
                  <span
                    key={i}
                    title={`${d} ${fmtRange(s)}`}
                    className="absolute inset-y-0 rounded"
                    style={{ left: pct(toMin(s.startTime)), width: `calc(${pct(toMin(s.endTime))} - ${pct(toMin(s.startTime))})`, background: hex }}
                  />
                ))}
                {isToday && nowMin > DAY_START && nowMin < DAY_END && (
                  <span className="absolute -inset-y-0.5 w-0.5 rounded bg-gray-900 dark:bg-white" style={{ left: pct(nowMin) }} title="Now" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between pl-10 text-[10px] text-gray-400">
        <span>7 AM</span><span>12 PM</span><span>4 PM</span><span>9 PM</span>
      </div>
    </div>
  );
};

/** Status pill for the next meeting. */
export const NextPill = ({ next, hex, compact = false, className = '' }) => {
  if (!next) return null;
  const live = next.state === 'live';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
      style={live ? { background: hex, color: '#fff' } : { background: tint(hex, 0.1), color: hex }}
    >
      {live ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <Clock className="h-3 w-3" />}
      {describeNext(next, compact)}
    </span>
  );
};

/**
 * Today's meetings across every class, in time order, with where each one
 * stands. The page opens on "what do I have now", not a wall of cards.
 */
export const TodayRail = ({ classes, onOpen }) => {
  const today = todayName();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const items = classes
    .flatMap((cs) => timeSlotsOf(cs).filter((s) => s.day === today).map((s) => ({ cs, s })))
    .sort((a, b) => toMin(a.s.startTime) - toMin(b.s.startTime));

  if (!items.length) {
    const upcoming = classes
      .map((cs) => ({ cs, next: nextMeeting(timeSlotsOf(cs), now) }))
      .filter((x) => x.next)
      .sort((a, b) => a.next.ahead - b.next.ahead || toMin(a.next.slot.startTime) - toMin(b.next.slot.startTime))[0];
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span className="font-medium text-gray-700 dark:text-gray-200">No classes {today === 'Sunday' ? 'on Sunday' : 'today'}.</span>
        {upcoming && (
          <button type="button" onClick={() => onOpen(upcoming.cs)} className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
            Next up: <strong className="font-semibold">{subjectCodeOf(upcoming.cs)}</strong> · {describeNext(upcoming.next)}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Today">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Today <span className="font-normal text-gray-400">· {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </h2>
        <span className="text-xs text-gray-400">{items.length} {items.length === 1 ? 'meeting' : 'meetings'}</span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map(({ cs, s }, i) => {
          const hex = accentFor(subjectCodeOf(cs));
          const start = toMin(s.startTime);
          const end = toMin(s.endTime);
          const state = nowMin >= end ? 'done' : nowMin >= start ? 'live' : 'soon';
          const progress = state === 'live' ? ((nowMin - start) / (end - start)) * 100 : state === 'done' ? 100 : 0;
          return (
            <button
              key={`${cs._id}-${i}`}
              type="button"
              onClick={() => onOpen(cs)}
              className={`group relative w-56 flex-shrink-0 overflow-hidden rounded-xl border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-800 ${
                state === 'live' ? 'border-transparent shadow-md' : 'border-gray-200 dark:border-gray-700'
              } ${state === 'done' ? 'opacity-60' : ''}`}
              style={state === 'live' ? { boxShadow: `0 0 0 2px ${hex}` } : undefined}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
                <span style={{ color: hex }}>{state === 'live' ? 'Now' : state === 'done' ? 'Done' : fmtIn(start - nowMin)}</span>
                <span className="text-gray-400">{fmtTime(s.startTime)}</span>
              </div>
              <p className="mt-1 truncate font-mono text-sm font-bold text-gray-900 dark:text-white">{subjectCodeOf(cs)}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {cs.sectionCode}{roomOf(cs) ? ` · ${roomOf(cs)}` : ''}
              </p>
              <span className="absolute inset-x-0 bottom-0 h-1 bg-gray-100 dark:bg-gray-700">
                <span className="block h-full" style={{ width: `${progress}%`, background: hex }} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const fmtIn = (mins) => (mins < 60 ? `In ${mins} min` : `In ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} m` : ''}`);

/**
 * One class, drawn as a timetable entry rather than a photo card: a coloured
 * spine, the code, the week it meets and what's next.
 */
export const ClassCard = ({ cs, onOpen, showSection = true }) => {
  const code = subjectCodeOf(cs);
  const hex = accentFor(code);
  const name = subjectNameOf(cs);
  const teacher = facultyNameOf(cs);
  const slots = timeSlotsOf(cs);
  const next = nextMeeting(slots);
  const room = roomOf(cs);
  const posts = cs.announcements?.length ?? cs.announcementCount ?? 0;
  const files = cs.materials?.length ?? cs.materialCount ?? 0;
  const students = cs.enrolledStudents?.length ?? cs.enrolledCount;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(cs)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(cs); } }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white pl-1.5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: hex }} aria-hidden="true" />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className="rounded-md px-2 py-0.5 font-mono text-xs font-bold tracking-wide"
            style={{ background: tint(hex, 0.1), color: hex }}
          >
            {code}
          </span>
          {showSection && cs.sectionCode && (
            <span className="text-xs font-medium text-gray-400">{cs.sectionCode}</span>
          )}
        </div>

        <h3 className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug text-gray-900 dark:text-white">
          {name || code}
        </h3>

        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {teacher ? (
            <>
              <Avatar name={teacher} picture={cs.faculty?.user?.profilePicture} size={20} hex={hex} />
              <span className="truncate">{teacher}</span>
            </>
          ) : (
            <span className="italic">No teacher assigned</span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <WeekStrip slots={slots} hex={hex} />
          {room && (
            <span className="inline-flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
              <MapPin className="h-3 w-3 flex-shrink-0" />{room}
            </span>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 dark:border-gray-700/70">
        {next ? <NextPill next={next} hex={hex} compact className="!px-2 !py-0.5 whitespace-nowrap" /> : <span className="text-xs text-gray-400">No meeting times</span>}
        <span className="flex items-center gap-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1" title="Posts"><Megaphone className="h-3.5 w-3.5" />{posts}</span>
          <span className="inline-flex items-center gap-1" title="Files"><Paperclip className="h-3.5 w-3.5" />{files}</span>
          {students != null && <span className="inline-flex items-center gap-1" title="Students"><Users className="h-3.5 w-3.5" />{students}</span>}
        </span>
      </footer>
    </article>
  );
};

/** Loading: cards shaped exactly like ClassCard (accent bar, chip, 2-line title, teacher, week strip, footer). */
export const GridSkeleton = () => (
  <SkeletonRegion label="Loading classes" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white pl-1.5 dark:border-gray-700 dark:bg-gray-800">
        <Bone className="absolute inset-y-0 left-0 w-1.5 rounded-none" />
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <Bone className="h-5 w-20 rounded-md" />
            <span className="flex h-4 items-center"><Bone className="h-2.5 w-12" /></span>
          </div>
          <div className="mt-2.5 min-h-[2.5rem] space-y-1.5 pt-1">
            <Bone className="h-3.5 w-11/12" />
            <Bone className="h-3.5" style={{ width: i % 2 ? '45%' : '60%' }} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Bone className="h-5 w-5 rounded-full" /><Bone className="h-3 w-28" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex gap-1">{WEEK.map((d) => <Bone key={d} className="h-6 w-6 rounded-md" />)}</div>
            <Bone className="h-3 w-12" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 dark:border-gray-700/70">
          <Bone className="h-[22px] w-24 rounded-full" />
          <span className="flex items-center gap-3"><Bone className="h-3 w-7" /><Bone className="h-3 w-7" /><Bone className="h-3 w-7" /></span>
        </div>
      </div>
    ))}
  </SkeletonRegion>
);
