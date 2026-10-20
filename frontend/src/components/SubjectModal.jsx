import { useState, useEffect } from 'react';
import { subjectAPI } from '../services/api';
import toast from 'react-hot-toast';
import { BookOpen, GraduationCap, CheckSquare, X } from 'lucide-react';
import { usePrograms } from '../hooks/usePrograms';
import { useAuth } from '../context/AuthContext';

const SEMESTERS = [1, 2];
const YEAR_LEVELS = [1, 2, 3, 4];
const SUBJECT_TYPES = ['Lecture', 'Laboratory', 'Both'];

const SubjectModal = ({ mode, subject, onClose }) => {
  const { programCodes: PROGRAMS } = usePrograms();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Initialize with user's program if they're a program manager
  const initialProgram = user?.role === 'program_manager' && user?.program ? user.program : 'BSIT';
  
  const [formData, setFormData] = useState({
    subjectCode: '',
    subjectName: '',
    description: '',
    units: 3,
    lectureHours: 3,
    labHours: 0,
    program: initialProgram,
    yearLevel: 1,
    semester: 1,
    type: 'Lecture',
    prerequisites: [],
    isActive: true
  });

  useEffect(() => {
    if (mode === 'edit' && subject) {
      setFormData({
        subjectCode: subject.subjectCode || '',
        subjectName: subject.subjectName || '',
        description: subject.description || '',
        units: subject.units || 3,
        lectureHours: subject.lectureHours || 3,
        labHours: subject.labHours || 0,
        program: subject.program || initialProgram,
        yearLevel: subject.yearLevel || 1,
        semester: subject.semester || 1,
        type: subject.type || 'Lecture',
        isActive: subject.isActive !== false
      });
    }
  }, [mode, subject, initialProgram]);

  // Escape closes the panel
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setErrorMessage(''); // Clear error when user starts typing
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleGenerateCode = async () => {
    try {
      const response = await subjectAPI.generateCode();
      const generatedCode = response.data.data.subjectCode;
      setFormData({
        ...formData,
        subjectCode: generatedCode
      });
      toast.success(`Generated code: ${generatedCode}`);
    } catch (error) {
      console.error('Generate code error:', error);
      toast.error('Could not generate code');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        units: Number(formData.units) || 0,
        lectureHours: Number(formData.lectureHours) || 0,
        labHours: Number(formData.labHours) || 0,
        yearLevel: Number(formData.yearLevel),
        semester: Number(formData.semester)
      };

      console.log('[SubjectModal] Submitting:', mode, submitData);

      if (mode === 'create') {
        const response = await subjectAPI.create(submitData);
        console.log('[SubjectModal] Create response:', response);
        toast.success('Subject created successfully');
      } else {
        const response = await subjectAPI.update(subject._id, submitData);
        console.log('[SubjectModal] Update response:', response);
        toast.success('Subject updated successfully');
      }
      onClose(true);
    } catch (error) {
      console.error('[SubjectModal] Submit error:', error);
      console.error('[SubjectModal] Error response:', error.response);
      console.error('[SubjectModal] Error response data:', error.response?.data);
      
      // Show specific validation errors if available
      let errorMsg = '';
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        errorMsg = `Validation error: ${errorMessages}`;
      } else {
        errorMsg = error.response?.data?.message || error.message || 'Operation failed';
      }
      
      console.log('[SubjectModal] About to call toast.error with:', errorMsg);
      setErrorMessage(errorMsg); // Show error on screen
      toast.error(errorMsg); // Also show toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100001] flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose(false)} />

      <aside className="relative w-full sm:max-w-2xl h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-1">
                {mode === 'create' ? 'Create a new subject' : 'Update subject information'}
              </p>
              <h2 className="text-2xl font-bold text-white break-words">
                {mode === 'create' ? 'Add New Subject' : 'Edit Subject'}
              </h2>
            </div>
            <button
              onClick={() => onClose(false)}
              className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex-shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Preview Info */}
          <div className="mt-2 text-sm text-white/90">
            {formData.program} • Year {formData.yearLevel} • Semester {formData.semester} • {formData.units} units • Lec: {formData.lectureHours}h • Lab: {formData.labHours}h
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50 dark:bg-gray-900">
          
          {/* Error Message Display */}
          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <X className="w-3 h-3 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Error</h3>
                <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage('')}
                className="flex-shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} id="subject-form">
              {/* Basic Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Basic Information
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">* Required</span>
                </div>
                <div className="space-y-4">
                  {/* Course Code and Units in a row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Course Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Course Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="subjectCode"
                        value={formData.subjectCode}
                        onChange={handleChange}
                        placeholder="ENTER COURSE CODE"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all uppercase text-sm"
                        style={{ textTransform: 'uppercase' }}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Leave empty to auto-generate (e.g., K3P9X7M2)
                      </p>
                    </div>

                    {/* Units */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Units <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="units"
                        value={formData.units}
                        onChange={handleChange}
                        required
                        min="1"
                        max="12"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all text-sm"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Credit units (max 12 for OJT/Practicum)
                      </p>
                    </div>
                  </div>

                  {/* Hours: Lecture and Lab */}
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Lecture Hours */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lecture Hours <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="lectureHours"
                          value={formData.lectureHours}
                          onChange={handleChange}
                          required
                          min="0"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Hours per week for lecture
                        </p>
                      </div>

                      {/* Lab Hours */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Lab Hours
                        </label>
                        <input
                          type="number"
                          name="labHours"
                          value={formData.labHours}
                          onChange={handleChange}
                          min="0"
                          max="20"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Hours per week for laboratory
                        </p>
                      </div>
                    </div>
                    
                    {/* Total Contact Hours Info */}
                    <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Total Contact Hours per Week:
                        </span>
                        <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                          {(parseInt(formData.lectureHours) || 0) + (parseInt(formData.labHours) || 0)} hours
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Used for schedule allocation (Lec + Lab)
                      </p>
                    </div>
                  </div>

                  {/* Subject Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="subjectName"
                      value={formData.subjectName}
                      onChange={handleChange}
                      required
                      placeholder="e.g., Web Development"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all text-sm"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="3"
                      placeholder="Brief description of the subject..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all resize-none text-sm"
                    />
                  </div>

                  {/* Subject Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {SUBJECT_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, type })}
                          className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                            formData.type === type
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Status */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all"
                    />
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active (available for scheduling)
                    </label>
                  </div>
                </div>
              </div>

              {/* Curriculum Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Curriculum Information
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">* Required</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Program */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Program <span className="text-red-500">*</span>
                    </label>
                    {user?.role === 'program_manager' ? (
                      <input
                        type="text"
                        value={formData.program}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed text-sm"
                      />
                    ) : (
                      <select
                        name="program"
                        value={formData.program}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all text-sm"
                      >
                        {PROGRAMS.map(prog => (
                          <option key={prog} value={prog}>{prog}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Year Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Year Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="yearLevel"
                      value={formData.yearLevel}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all text-sm"
                    >
                      {YEAR_LEVELS.map(year => (
                        <option key={year} value={year}>Year {year}</option>
                      ))}
                    </select>
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Semester <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SEMESTERS.map(sem => (
                        <button
                          key={sem}
                          type="button"
                          onClick={() => setFormData({ ...formData, semester: sem })}
                          className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                            formData.semester === sem
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {sem === 1 ? '1st' : '2nd'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="subject-form"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{mode === 'create' ? 'Creating...' : 'Updating...'}</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>{mode === 'create' ? 'Create Subject' : 'Update Subject'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default SubjectModal;
