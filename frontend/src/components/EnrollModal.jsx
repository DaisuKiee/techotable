import React, { useState } from 'react';
import { classSpaceAPI } from '../services/api';
import toast from 'react-hot-toast';
import { X, UserPlus, Key, AlertCircle, BookOpen } from 'lucide-react';
import AnimatedCheckIcon from './AnimatedCheckIcon';

/**
 * Join-by-code modal.
 *
 * Which code to enter depends on the student type, so the copy adapts:
 *   - regular   -> SECTION enrollment code, joins every subject of the section
 *   - irregular -> SUBJECT class code, joins one subject at a time
 *
 * The backend decides based on the student's own record; `studentType` here only
 * controls the wording so the student knows what to paste.
 */
const EnrollModal = ({ studentType = 'regular', onClose }) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);

  const isIrregular = studentType === 'irregular';

  const copy = isIrregular
    ? {
        heading: 'Join a Subject',
        label: 'Subject Class Code',
        hint: '8-character code for a single subject, from your instructor',
        cta: 'Join Subject',
        bullets: [
          'You join this one subject only',
          'The subject is added to your enrolled subject list',
          "You can see that teacher's announcements and materials",
        ],
      }
    : {
        heading: 'Join Your Section',
        label: 'Section Enrollment Code',
        hint: '8-character code from your program manager',
        cta: 'Join Section',
        bullets: [
          'Your section, year, semester and adviser are set automatically',
          'Every subject in your section appears as a class',
          'You can see announcements and materials from each teacher',
        ],
      };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await classSpaceAPI.join(trimmed);
      const { data, joined, message } = response.data;

      setResult({ success: true, joined, data, message });
      toast.success(message || 'Joined successfully');

      // Give the confirmation a beat to register, then refresh the class list
      setTimeout(() => onClose('reload'), 1800);
    } catch (error) {
      const message = error.response?.data?.message || 'Could not join. Please try again.';
      setResult({ success: false, message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onClose(false)}
      />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{copy.heading}</h3>
              <p className="text-xs text-blue-100">
                {isIrregular ? 'Irregular student' : 'Regular student'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {result?.success ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <AnimatedCheckIcon className="w-6 h-6" color="#16a34a" />
                <div>
                  <p className="font-bold text-green-900 dark:text-green-100">
                    {result.joined === 'subject' ? 'Subject joined' : 'Enrolled in section'}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                    {result.message}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
                {result.joined === 'subject' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-gray-900 dark:text-white text-lg">
                        {result.data?.subjectCode}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {result.data?.subjectName}
                    </p>
                    {result.data?.sectionCode && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Section {result.data.sectionCode}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-gray-900 dark:text-white text-lg">
                        {result.data?.sectionCode}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Program</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {result.data?.program}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Year Level</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Year {result.data?.yearLevel}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Academic Year</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {result.data?.academicYear}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Semester</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Sem {result.data?.semester}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Subjects</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {result.data?.classCount ?? 0}
                        </p>
                      </div>
                      {result.data?.adviser && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">Adviser</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {result.data.adviser}
                          </p>
                        </div>
                      )}
                    </div>
                    {result.data?.classCount === 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        No subjects are scheduled for this section yet. They will appear here
                        once your program manager publishes the timetable.
                      </p>
                    )}
                  </>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">Loading your classes...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {copy.label}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase().replace(/\s/g, ''));
                      setResult(null);
                    }}
                    placeholder="e.g. K3P9X7M2"
                    maxLength={8}
                    required
                    autoFocus
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-lg tracking-widest text-center uppercase transition-all"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 text-center">
                  {copy.hint}
                </p>
              </div>

              {result?.success === false && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="text-red-700 dark:text-red-300">{result.message}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      💡 Make sure you're using the correct 8-character enrollment code,
                      not a subject code like "CC 112" or section name.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                  <p className="font-semibold">What happens when you join?</p>
                  <ul className="space-y-0.5 text-blue-700 dark:text-blue-400">
                    {copy.bullets.map((b, i) => (
                      <li key={i}>• {b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onClose(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length < 8}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {copy.cta}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrollModal;
