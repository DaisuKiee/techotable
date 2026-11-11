import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, School } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ScheduleBuilder from '../components/ScheduleBuilder';
import { Bone, SkeletonRegion } from '../components/ui/Skeleton';
import { sectionAPI, subjectAPI, facultyAPI, roomAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

/** June onwards counts as the start of a new academic year. */
const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

/**
 * The schedule builder on its own page: the whole content area is the
 * workspace, the section lives in the URL (?section=<id>) so a link or a
 * refresh lands on the same timetable, and switching sections is one select.
 */
const ScheduleBuilderPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const sectionId = params.get('section') || '';

  const [sections, setSections] = useState(null); // null = loading
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);

  // Sections, faculty and rooms: once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sec, fac, room] = await Promise.allSettled([
        sectionAPI.getAllLightweight(),
        facultyAPI.getAll({ isActive: true }),
        roomAPI.getAll({ isActive: true }),
      ]);
      if (cancelled) return;
      if (sec.status === 'fulfilled') setSections(sec.value.data.data || []);
      else { setSections([]); toast.error(getErrorMessage(sec.reason, 'Could not load sections')); }
      if (fac.status === 'fulfilled') setFaculty(fac.value.data.data || []);
      if (room.status === 'fulfilled') setRooms(room.value.data.data || []);
    })();
    return () => { cancelled = true; };
  }, []);

  // Program managers only build their own program's sections
  const sectionOptions = useMemo(() => (sections || [])
    .filter((s) => user?.role !== 'program_manager' || !user?.program || s.program === user.program)
    .filter((s) => !s.academicYear || s.academicYear === academicYear)
    .sort((a, b) => String(a.sectionCode).localeCompare(String(b.sectionCode))), [sections, user, academicYear]);

  const selectedSection = useMemo(
    () => (sections || []).find((s) => String(s._id) === String(sectionId)) || null,
    [sections, sectionId]
  );

  // A linked section from another academic year switches the year to match
  useEffect(() => {
    if (selectedSection?.academicYear && selectedSection.academicYear !== academicYear) {
      setAcademicYear(selectedSection.academicYear);
    }
  }, [selectedSection, academicYear]);

  const filters = useMemo(() => (selectedSection ? {
    program: selectedSection.program,
    yearLevel: selectedSection.yearLevel,
    semester: selectedSection.semester,
    shift: selectedSection.shift,
    academicYear: selectedSection.academicYear || academicYear,
  } : null), [selectedSection, academicYear]);

  // Subjects for the chosen section's program, year and semester
  useEffect(() => {
    if (!filters) return undefined;
    let cancelled = false;
    subjectAPI.getAll({ isActive: true, program: filters.program, yearLevel: filters.yearLevel, semester: filters.semester })
      .then((res) => { if (!cancelled) setSubjects(res.data.data || []); })
      .catch((err) => toast.error(getErrorMessage(err, 'Could not load subjects')));
    return () => { cancelled = true; };
  }, [filters]);

  const selectSection = (id) => setParams(id ? { section: id } : {}, { replace: false });

  const years = useMemo(() => {
    const start = parseInt(currentAcademicYear().slice(0, 4), 10);
    return [-1, 0, 1].map((o) => `${start + o}-${start + o + 1}`);
  }, []);

  const loading = sections === null;
  const ready = !!(selectedSection && filters);

  return (
    <Layout>
      <div className="mx-auto flex h-[calc(100dvh-7.5rem)] min-h-[640px] max-w-[1800px] flex-col gap-3 lg:h-[calc(100dvh-6.25rem)]">
        {/* Page bar: back, title, year + section */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          <Link
            to={selectedSection ? `/schedules?section=${selectedSection._id}` : '/schedules'}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Schedules
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Schedule builder</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={academicYear}
              onChange={(e) => { setAcademicYear(e.target.value); if (selectedSection) selectSection(''); }}
              aria-label="Academic year"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {!selectedSection && (
              <select
                value=""
                onChange={(e) => selectSection(e.target.value)}
                aria-label="Section to build"
                disabled={loading || !sectionOptions.length}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">{loading ? 'Loading sections…' : 'Choose a section…'}</option>
                {sectionOptions.map((s) => (
                  <option key={s._id} value={s._id}>{s.sectionCode} · Year {s.yearLevel} · Sem {s.semester} · {s.shift}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Workspace */}
        <div className="min-h-0 flex-1">
          {loading && sectionId ? (
            <SkeletonRegion label="Loading the builder" className="flex h-full gap-3">
              <Bone className="h-full w-64 rounded-2xl" />
              <Bone className="h-full flex-1 rounded-2xl" />
            </SkeletonRegion>
          ) : ready ? (
            <ScheduleBuilder
              key={selectedSection._id}
              fill
              filters={filters}
              subjects={subjects}
              sections={sectionOptions}
              faculty={faculty}
              rooms={rooms}
              selectedSection={selectedSection}
              sectionOptions={sectionOptions}
              onSelectSection={selectSection}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                <School className="h-7 w-7" />
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Choose a section to build</h2>
              <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                {sectionId && !loading
                  ? 'That section wasn’t found for this account. Pick one from the list.'
                  : sectionOptions.length || loading
                    ? 'The section sets the program, year level, semester and shift. Then drag subjects onto the week.'
                    : `No sections exist for ${academicYear}. Create one on the Sections page first.`}
              </p>
              {!loading && sectionOptions.length > 0 && (
                <select
                  value=""
                  onChange={(e) => selectSection(e.target.value)}
                  aria-label="Choose a section"
                  className="mt-5 rounded-lg border-2 border-blue-500 px-4 py-2.5 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-blue-300"
                >
                  <option value="">Choose a section…</option>
                  {sectionOptions.map((s) => (
                    <option key={s._id} value={s._id}>{s.sectionCode} · Year {s.yearLevel} · Sem {s.semester} · {s.shift}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ScheduleBuilderPage;
