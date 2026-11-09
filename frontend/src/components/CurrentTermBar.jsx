import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Archive, AlertTriangle } from 'lucide-react';
import { termAPI } from '../services/api';
import { useLiveRefresh } from '../context/NotificationContext';

/** One line: the current term, how long is left, and links to Semesters / Archive. */
const CurrentTermBar = () => {
  const [term, setTerm] = useState(null);
  const [isSet, setIsSet] = useState(true);
  const [summary, setSummary] = useState(null);

  // Program managers get their own program's term; the scheduling office a
  // summary of how many programs have their semesters set up
  const load = useCallback(() => {
    termAPI.current()
      .then((res) => {
        setTerm(res.data.data);
        setIsSet(res.data.isSet);
        setSummary(res.data.perProgram ? { configured: res.data.configured, total: res.data.perProgram.length } : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(['term'], load);

  if (!term) return null;

  return (
    <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border px-3 py-2 text-sm ${
      isSet || summary
        ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        : 'border-orange-200 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-900/20'
    }`}
    >
      {summary ? (
        <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <CalendarRange className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Semesters set up for <strong>{summary.configured} of {summary.total}</strong> programs
        </span>
      ) : isSet ? (
        <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <CalendarRange className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span><strong>{term.label}</strong> · {term.status === 'current' ? `${term.daysLeft} days left` : 'between terms'}</span>
        </span>
      ) : (
        <span className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
          <AlertTriangle className="h-4 w-4" />
          Semester dates for {term.academicYear} aren’t set up yet. Set them on the Semesters page.
        </span>
      )}
      <span className="ml-auto flex gap-3 text-xs font-medium">
        <Link to="/semesters" className="text-blue-600 hover:underline dark:text-blue-400">Semesters</Link>
        <Link to="/semesters?tab=archive" className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
          <Archive className="h-3.5 w-3.5" /> Archive
        </Link>
      </span>
    </div>
  );
};

export default CurrentTermBar;
