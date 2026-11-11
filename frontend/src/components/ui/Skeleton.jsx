/**
 * Loading skeletons, shared by every page (see SKILLS.MD).
 *
 *   <SkeletonRegion label="Loading rooms">  …<Bone className="h-4 w-24" />…  </SkeletonRegion>
 *   <div className="sk-enter">…real content…</div>
 *
 * - Bone: one placeholder block. Colour comes from the --sk-* tokens in
 *   index.css, so it follows light/dark mode; the slow shimmer turns into a
 *   static block when the user prefers reduced motion.
 * - SkeletonRegion: wraps a skeleton. It stays invisible for the first
 *   ~200 ms, so fast loads never flash a placeholder, then fades in. It keeps
 *   its size while invisible, so nothing moves when it appears.
 * - sk-enter / sk-stagger (CSS classes): fade the real content in (~150 ms)
 *   instead of popping; sk-stagger staggers a grid or list's children.
 *
 * Build skeletons at the real content's sizes (same paddings, heights,
 * grid columns) so swapping in data causes no layout shift.
 */

/** One placeholder block. Shape it with Tailwind sizes and radius. */
export const Bone = ({ className = '', style, as: Tag = 'span' }) => {
  const display = /(^|\s)(inline-block|inline-flex|flex|hidden)(\s|$)/.test(className) ? '' : 'block ';
  const radius = /(^|\s)rounded/.test(className) ? '' : 'rounded ';
  return <Tag aria-hidden="true" style={style} className={`sk ${display}${radius}${className}`} />;
};

/** Lines of placeholder text; the last line is shorter so it reads as text. */
export const BoneText = ({ lines = 2, className = 'h-3', gap = 'space-y-2', last = '60%' }) => (
  <span aria-hidden="true" className={`block ${gap}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Bone key={i} className={className} style={i === lines - 1 && lines > 1 ? { width: last } : undefined} />
    ))}
  </span>
);

/** Wraps a skeleton: announces loading, waits ~200 ms, then fades in. */
export const SkeletonRegion = ({ label = 'Loading', className = '', as: Tag = 'div', children }) => (
  <Tag role="status" aria-busy="true" aria-label={label} className={`sk-reveal ${className}`}>
    <span className="sr-only">{label}…</span>
    {children}
  </Tag>
);

/* ---------- Shared shapes (dashboards) ---------- */

/** A "today" class row: time column, colour bar, title / name / meta lines. */
export const MeetingRowSkeleton = ({ badge = false }) => (
  <li className="flex gap-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700 sm:p-4">
    <div className="flex w-20 flex-shrink-0 flex-col items-end">
      <span className="flex h-5 items-center"><Bone className="h-3.5 w-14" /></span>
      <span className="flex h-4 items-center"><Bone className="h-3 w-12" /></span>
    </div>
    <Bone className="w-1 flex-shrink-0 rounded-full" />
    <div className="min-w-0 flex-1">
      <div className="flex h-6 items-center gap-2"><Bone className="h-4 w-20" />{badge && <Bone className="h-5 w-16 rounded-md" />}</div>
      <div className="flex h-5 items-center"><Bone className="h-3 w-3/5" /></div>
      <div className="mt-1.5 flex h-4 items-center gap-4"><Bone className="h-3 w-16" /><Bone className="h-3 w-24" /></div>
    </div>
  </li>
);

/** A class card: code + badge, name, two meta lines, optional counts footer. */
export const ClassCardSkeleton = ({ footer = false }) => (
  <div className="flex flex-col rounded-xl border border-gray-200 p-4 dark:border-gray-700">
    <div className="flex h-6 items-center justify-between gap-2"><Bone className="h-4 w-20" /><Bone className="h-5 w-14 rounded-md" /></div>
    <div className="flex h-5 items-center"><Bone className="h-3 w-4/5" /></div>
    <div className="mt-2 flex h-4 items-center"><Bone className="h-3 w-2/3" /></div>
    <div className="mt-1 flex h-4 items-center"><Bone className="h-3 w-1/3" /></div>
    {footer && (
      <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-2 dark:border-gray-700">
        <span className="flex h-4 items-center gap-3"><Bone className="h-3 w-8" /><Bone className="h-3 w-8" /><Bone className="h-3 w-8" /></span>
        <Bone className="ml-auto h-3 w-12" />
      </div>
    )}
  </div>
);

/* ---------- Shared shapes (My Schedule pages) ---------- */

/** The "today / up next" strip: a small caps line and one sentence. */
export const TodayStripSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <span className="flex h-4 items-center"><Bone className="h-2.5 w-40" /></span>
    <span className="mt-1 flex h-5 items-center"><Bone className="h-3.5 w-72 max-w-full" /></span>
  </div>
);

/** Search box + view switch + refresh, at the real controls' heights. */
export const ScheduleToolbarSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Bone className="h-[38px] flex-1 rounded-lg" />
      <div className="flex items-center gap-2">
        <Bone className="h-[38px] w-[7.5rem] rounded-lg sm:w-[15.5rem]" />
        <Bone className="h-[38px] w-[38px] rounded-lg" />
      </div>
    </div>
  </div>
);

/** The week grid: day header row, time column, hour lines. */
export const WeekGridSkeleton = ({ rowH = 80, timeCol = 72, days = 5, hours = 10 }) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div className="overflow-x-auto">
      <div className="min-w-[800px]" style={{ display: 'grid', gridTemplateColumns: `${timeCol}px repeat(${days}, minmax(0, 1fr))` }}>
        <div className="flex items-center justify-center border-b border-r border-gray-200 py-3 dark:border-gray-600">
          <span className="flex h-9 items-center"><Bone className="h-3 w-8" /></span>
        </div>
        {Array.from({ length: days }).map((_, d) => (
          <div key={d} className="flex flex-col items-center border-b border-r border-gray-200 py-3 dark:border-gray-600">
            <span className="flex h-5 items-center"><Bone className="h-3.5 w-16" /></span>
            <span className="flex h-4 items-center"><Bone className="h-2.5 w-12" /></span>
          </div>
        ))}
        <div className="relative border-r border-gray-200 dark:border-gray-600" style={{ height: hours * rowH }}>
          {Array.from({ length: hours }).map((_, i) => (
            <Bone key={i} className="absolute right-2 h-3 w-9" style={{ top: i * rowH + 8 }} />
          ))}
        </div>
        {Array.from({ length: days }).map((_, d) => (
          <div key={d} className="relative border-r border-gray-200 dark:border-gray-600" style={{ height: hours * rowH }}>
            {Array.from({ length: hours }).map((_, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-gray-100 dark:border-gray-700/60" style={{ top: i * rowH }} />
            ))}
            {/* a couple of class blocks per day, in varied places */}
            {[(d * 3) % hours, (d * 3 + 4) % hours].map((h, k) => (
              <Bone key={k} className="absolute inset-x-1 rounded-lg" style={{ top: h * rowH + 2, height: rowH * (k ? 1 : 1.5) - 4 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Bone;
