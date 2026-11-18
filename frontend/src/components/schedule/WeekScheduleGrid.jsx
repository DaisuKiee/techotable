/**
 * A weekly timetable grid — Monday to Saturday, 7 AM to 10 PM on the half hour.
 *
 * Shared by the room drawer and the faculty drawer so both read the same way:
 * classes sit as coloured blocks, a lunch band is shaded, and optional "blocked"
 * windows (a room out of use) are hatched. Callers map their own records to the
 * generic `classes` / `blocked` shape, so the look never drifts between pages.
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const GRID_START = 7 * 60;
const GRID_END = 22 * 60;
const STEP = 30;
const ROW_PX = 20;
const ROWS = (GRID_END - GRID_START) / STEP;

const toMin = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hourLabel = (h24) => `${((h24 + 11) % 12) + 1} ${h24 < 12 ? 'AM' : 'PM'}`;
const fmtTime = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
export const fmtRange = (a, b) => `${fmtTime(a)}–${fmtTime(b)}`;

/** Place a {day, startTime, endTime} block on the grid, clamped to the window. */
const place = (day, start, end) => {
  const col = DAYS.indexOf(day);
  if (col < 0) return null;
  const s = Math.max(GRID_START, toMin(start));
  const e = Math.min(GRID_END, toMin(end));
  if (e <= s) return null;
  return {
    gridColumn: col + 2,
    gridRow: `${Math.floor((s - GRID_START) / STEP) + 2} / span ${Math.max(1, Math.ceil((e - s) / STEP))}`,
  };
};

const BLUE = 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100';

/**
 * @param classes {{ _id, timeSlots:[{day,startTime,endTime}], main, sub?, tone?, title? }[]}
 * @param blocked {{ day,startTime,endTime,reason? }[]}
 */
export default function WeekScheduleGrid({ classes = [], blocked = [], showLunch = true }) {
  const lunchRow = (12 * 60 - GRID_START) / STEP + 2;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <div
        className="relative grid min-w-[640px] bg-white text-xs dark:bg-gray-800"
        style={{ gridTemplateColumns: '52px repeat(6, minmax(0, 1fr))', gridTemplateRows: `28px repeat(${ROWS}, ${ROW_PX}px)` }}
      >
        <div className="sticky left-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900" />
        {DAYS.map((d, i) => (
          <div key={d} className="flex items-center justify-center border-b border-l border-gray-200 bg-gray-50 font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300" style={{ gridColumn: i + 2, gridRow: 1 }}>
            {d.slice(0, 3)}
          </div>
        ))}

        {/* Hour lines and labels */}
        {Array.from({ length: ROWS / 2 }, (_, h) => (
          <div key={h} className="contents">
            <div className="sticky left-0 z-10 -mt-1.5 bg-white pr-1.5 text-right text-[10px] text-gray-400 dark:bg-gray-800" style={{ gridColumn: 1, gridRow: `${h * 2 + 2} / span 2` }}>
              {hourLabel(7 + h).replace(' ', ' ')}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700/60" style={{ gridColumn: '2 / span 6', gridRow: `${h * 2 + 2} / span 2` }} />
          </div>
        ))}
        {DAYS.map((d, i) => (
          <div key={`col-${d}`} className="border-l border-gray-100 dark:border-gray-700/60" style={{ gridColumn: i + 2, gridRow: `2 / span ${ROWS}` }} />
        ))}
        {showLunch && (
          <div className="flex items-center justify-center bg-gray-100/80 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:bg-gray-900/60" style={{ gridColumn: '2 / span 6', gridRow: `${lunchRow} / span 2` }}>
            Lunch break
          </div>
        )}

        {blocked.map((b, i) => {
          const pos = place(b.day, b.startTime, b.endTime);
          return pos && (
            <div key={`b${i}`} title={`Blocked ${fmtRange(b.startTime, b.endTime)}${b.reason ? `: ${b.reason}` : ''}`}
              className="z-[1] m-0.5 overflow-hidden rounded border border-orange-300 px-1.5 py-0.5 text-orange-900 dark:border-orange-700 dark:text-orange-200"
              style={{ ...pos, background: 'repeating-linear-gradient(135deg, rgba(251,191,36,.18) 0 6px, rgba(251,191,36,.35) 6px 12px)' }}>
              <div className="truncate font-semibold">Blocked</div>
              {b.reason && <div className="truncate text-[10px]">{b.reason}</div>}
            </div>
          );
        })}

        {classes.flatMap((c) => (c.timeSlots || []).map((slot, i) => {
          const pos = place(slot.day, slot.startTime, slot.endTime);
          if (!pos) return null;
          return (
            <div key={`${c._id || c.main}-${i}`} className={`z-[2] m-0.5 overflow-hidden rounded border px-1.5 py-0.5 leading-tight ${c.tone || BLUE}`} style={pos}
              title={c.title || `${c.main}${c.sub ? `\n${c.sub}` : ''}\n${fmtRange(slot.startTime, slot.endTime)}`}>
              <div className="truncate font-semibold">{c.main}</div>
              {c.sub && <div className="truncate text-[10px] opacity-80">{c.sub}</div>}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
