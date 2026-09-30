import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { 
  GraduationCap, BookOpen, Calendar, Users, 
  Sun, Moon, Check
} from 'lucide-react';
import { usePrograms } from '../hooks/usePrograms';

const SectionModal = ({ section, faculty, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    program: 'BSIT',
    yearLevel: 1,
    sectionLetter: 'A',
    shift: 'Day',
    academicYear: '2024-2025',
    semester: 1,
    maxStudents: 40,
    adviser: '',
    description: ''
  });
  
  const [errors, setErrors] = useState({});

  const { programCodes: programs } = usePrograms();
  const yearLevels = [1, 2, 3, 4];
  const sectionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const shifts = ['Day', 'Night'];

  useEffect(() => {
    if (section) {
      setFormData({
        program: section.program || 'BSIT',
        yearLevel: section.yearLevel || 1,
        sectionLetter: section.sectionLetter || 'A',
        shift: section.shift || 'Day',
        academicYear: section.academicYear || '2024-2025',
        semester: section.semester || 1,
        maxStudents: section.maxStudents || 40,
        adviser: section.adviser?._id || section.adviser || '',
        description: section.description || ''
      });
    }
  }, [section]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({}); // Clear previous errors
    try {
      await onSubmit(formData);
    } catch (error) {
      // If there's an adviser validation error, mark the field
      if (error.response?.data?.message?.toLowerCase().includes('adviser') || 
          error.response?.data?.message?.toLowerCase().includes('advisory')) {
        setErrors({ adviser: error.response.data.message });
      }
    }
  };

  const footerContent = (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="section-form"
        className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl"
      >
        <Check className="w-5 h-5" />
        {section ? 'Update Section' : 'Create Section'}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={section ? 'Edit Section' : 'Create New Section'}
      subtitle={section ? 'Update section information' : 'Add a new section to the system'}
      icon={GraduationCap}
      size="lg"
      formId="section-form"
      footerContent={footerContent}
    >
      <form onSubmit={handleSubmit} id="section-form" className="space-y-6">
        {/* Section Code Preview */}
        <div className="bg-blue-600 text-white rounded-xl p-4">
          <div className="text-sm font-medium opacity-90 mb-1">Section Code Preview</div>
          <div className="text-2xl font-bold">
            {formData.program}-{formData.yearLevel}{formData.sectionLetter}
          </div>
          <div className="text-sm opacity-90 mt-1">
            {formData.shift} Shift • {formData.academicYear} • Semester {formData.semester}
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Program */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Program <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.program}
                onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                required
              >
                {programs.map(prog => (
                  <option key={prog} value={prog}>{prog}</option>
                ))}
              </select>
            </div>

            {/* Year Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Year Level <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.yearLevel}
                onChange={(e) => setFormData({ ...formData, yearLevel: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                required
              >
                {yearLevels.map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>

            {/* Section Letter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Section Letter <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {sectionLetters.slice(0, 8).map(letter => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setFormData({ ...formData, sectionLetter: letter })}
                    className={`px-3 py-2.5 rounded-lg font-semibold transition-all ${
                      formData.sectionLetter === letter
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            {/* Shift */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Shift <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {shifts.map(shift => (
                  <button
                    key={shift}
                    type="button"
                    onClick={() => setFormData({ ...formData, shift })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                      formData.shift === shift
                        ? shift === 'Day'
                          ? 'bg-yellow-500 text-white shadow-lg scale-105'
                          : 'bg-blue-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {shift === 'Day' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    {shift}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Academic Period */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Academic Period
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Academic Year */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Academic Year <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                placeholder="2024-2025"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                required
              />
            </div>

            {/* Semester */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Semester <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map(sem => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setFormData({ ...formData, semester: sem })}
                    className={`px-4 py-2.5 rounded-lg font-semibold transition-all ${
                      formData.semester === sem
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {sem === 1 ? '1st' : '2nd'} Sem
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Section Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Max Students */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Maximum Students
              </label>
              <input
                type="number"
                value={formData.maxStudents}
                onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) })}
                min="1"
                max="100"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>

            {/* Adviser */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Section Adviser <span className="text-gray-400 font-normal text-xs">(Optional)</span>
              </label>
              <select
                value={formData.adviser}
                onChange={(e) => {
                  setFormData({ ...formData, adviser: e.target.value });
                  setErrors({ ...errors, adviser: null }); // Clear error when user changes
                }}
                className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all ${
                  errors.adviser 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                }`}
              >
                <option value="">No adviser assigned</option>
                {faculty.map(fac => (
                  <option key={fac._id} value={fac._id}>
                    {fac.user?.firstName} {fac.user?.lastName}
                  </option>
                ))}
              </select>
              {errors.adviser && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-start gap-1">
                  <span className="text-base">⚠</span>
                  <span>{errors.adviser}</span>
                </p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Add any additional notes or information about this section..."
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all resize-none"
              />
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          <span className="text-red-500">*</span> Required fields
        </p>
      </form>
    </BaseModal>
  );
};

export default SectionModal;
