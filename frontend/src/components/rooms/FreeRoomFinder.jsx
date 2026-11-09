import { useEffect, useState } from 'react';
import { SearchCheck, Loader2, ChevronDown, X } from 'lucide-react';
import { roomAPI, getErrorMessage } from '../../services/api';
import { DAYS, ROOM_TYPES, TIME_OPTIONS, fmtTime, fmtRange, typeMeta, toMin } from './roomMeta';

const SELECT = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

// Default to the next weekday class hour, so the first answer is useful as is
const defaults = () => {
  const now = new Date();
  const dayIdx = now.getDay() === 0 ? 0 : Math.min(5, now.getDay() - 1);
  const hour = Math.min(20, Math.max(7, now.getHours() + 1));
  const start = `${String(hour === 12 ? 13 : hour).padStart(2, '0')}:00`;
  return { day: DAYS[dayIdx], startTime: start, endTime: `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`, minCapacity: '', type: '' };
};

/**
 * "Which rooms are free on Tuesday 1-3 PM for 40 students?" Answers from the
 * selected term's classes and each room's blocked times.
 */
const FreeRoomFinder = ({ term, onOpenRoom, onClose }) => {
  const [q, setQ] = useState(defaults);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTaken, setShowTaken] = useState(false);

  const set = (key, value) => setQ((prev) => {
    const next = { ...prev, [key]: value };
    // Keep the range valid when the start moves past the end
    if (key === 'startTime' && toMin(next.endTime) <= toMin(value)) {
      next.endTime = TIME_OPTIONS[Math.min(TIME_OPTIONS.length - 1, TIME_OPTIONS.indexOf(value) + 2)];
    }
    return next;
  });

  useEffect(() => {
    if (toMin(q.endTime) <= toMin(q.startTime)) return undefined;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      roomAPI.getAvailable({
        day: q.day,
        startTime: q.startTime,
        endTime: q.endTime,
        minCapacity: q.minCapacity || undefined,
        roomType: q.type && q.type !== 'labs' ? q.type : undefined,
        labOnly: q.type === 'labs' ? true : undefined,
        ...(term ? { academicYear: term.academicYear, semester: term.semester } : {}),
      })
        .then((res) => setResult(res.data))
        .catch((err) => setError(getErrorMessage(err, 'Could not check free rooms')))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, term]);

  const free = result?.data || [];
  const taken = result?.unavailable || [];

  return (
    <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/30" aria-label="Find a free room">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><SearchCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Find a free room</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">Checks {result?.term?.label || term?.label || 'this term'}’s classes and each room’s blocked times.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-white/70 dark:hover:bg-gray-800" title="Close"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Day
          <select value={q.day} onChange={(e) => set('day', e.target.value)} className={`${SELECT} mt-1 block`}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">From
          <select value={q.startTime} onChange={(e) => set('startTime', e.target.value)} className={`${SELECT} mt-1 block`}>
            {TIME_OPTIONS.slice(0, -1).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">To
          <select value={q.endTime} onChange={(e) => set('endTime', e.target.value)} className={`${SELECT} mt-1 block`}>
            {TIME_OPTIONS.filter((t) => toMin(t) > toMin(q.startTime)).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Seats for
          <input type="number" min={1} value={q.minCapacity} onChange={(e) => set('minCapacity', e.target.value)} placeholder="Any" className={`${SELECT} mt-1 block w-24`} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Type
          <select value={q.type} onChange={(e) => set('type', e.target.value)} className={`${SELECT} mt-1 block`}>
            <option value="">Any room</option>
            <option value="labs">Any lab room</option>
            {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {loading && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-blue-500" />}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : result && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-gray-800 dark:text-gray-200">
            <strong>{free.length}</strong> room{free.length === 1 ? '' : 's'} free on {q.day}, {fmtRange(q.startTime, q.endTime)}
            {free.length > 0 && <span className="text-gray-500 dark:text-gray-400"> · smallest that fits first</span>}
          </p>
          {free.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Nothing matches. Try another time, fewer seats or any room type.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {free.map((room) => {
                const Icon = typeMeta(room.roomType).icon;
                return (
                  <button key={room._id} type="button" onClick={() => onOpenRoom(room)}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-gray-800 dark:hover:bg-emerald-900/20">
                    <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-gray-900 dark:text-white">{room.roomCode}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{room.capacity} seats</span>
                  </button>
                );
              })}
            </div>
          )}
          {taken.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowTaken((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" aria-expanded={showTaken}>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTaken ? 'rotate-180' : ''}`} />
                {taken.length} matching room{taken.length === 1 ? ' is' : 's are'} taken
              </button>
              {showTaken && (
                <ul className="mt-2 grid gap-1 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-2 lg:grid-cols-3">
                  {taken.map((t) => <li key={t._id}><span className="font-semibold text-gray-800 dark:text-gray-200">{t.roomCode}</span>: {t.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default FreeRoomFinder;
