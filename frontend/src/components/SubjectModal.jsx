import { useState, useEffect } from 'react';
import { subjectAPI } from '../services/api';
import toast from 'react-hot-toast';
import { BookOpen, GraduationCap, Layers, CheckSquare } from 'lucide-react';
import { usePrograms } from '../hooks/usePrograms';
import BaseModal from './BaseModal';

const SEMESTERS = [1, 2];
const YEAR_LEVELS = [1, 2, 3, 4];
const SUBJECT_TYPES = ['Lecture', 'Laboratory', 'Both'];

const SubjectModal = ({ mode, subject, onClose }) => {
  const { programCodes: PROGRAMS } = usePrograms();
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [formData, setFormData] = useState({
    subjectCode: '',
    subjectName: '',
    description: '',
    units: 3,
    program: 'BSIT',
    yearLevel: 1,
    semester: 1,
    type: 'Lecture',
    prerequisites: [],
    requiredQualification: '',
    isActive: true
  });

  // // Disable body scroll when modal is open
  // useEffect(() => {
  //   document.body.style.overflow = 'hidden';
  //   return () => {
  //     document.body.style.overflow = 'unset';
  //   };
  // }, []);

  useEffect(() => {
    loadSubjects();
    if (mode === 'edit' && subject) {
      setFormData({
        subjectCode: subject.subjectCode || '',
        subjectName: subject.subjectName || '',
        description: subject.description || '',
        units: subject.units || 3,
        program: subject.program || 'BSIT',
        yearLevel: subject.yearLevel || 1,
        semester: subject.semester || 1,
        type: subject.type || 'Lecture',
        prerequisites: subject.prerequisites?.map(p => p._id) || [],
        requiredQualification: subject.requiredQualification || '',
        isActive: subject.isActive !== false
      });
    }
  }, [mode, subject]);

  const loadSubjects = async () => {
    try {
      const response = await subjectAPI.getAll();
      setSubjects(response.data.data || []);
    } catch (error) {
      console.error('Load subjects error:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
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

  const handlePrerequisiteToggle = (subjectId) => {
    const current = formData.prerequisites || [];
    if (current.includes(subjectId)) {
      setFormData({
        ...formData,
        prerequisites: current.filter(id => id !== subjectId)
      });
    } else {
      setFormData({
        ...formData,
        prerequisites: [...current, subjectId]
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        units: parseInt(formData.units),
        yearLevel: parseInt(formData.yearLevel),
        semester: parseInt(formData.semester)
      };

      if (mode === 'create') {
        await subjectAPI.create(submitData);
        toast.success('Subject created successfully');
      } else {
        await subjectAPI.update(subject._id, submitData);
        toast.success('Subject updated successfully');
      }
      onClose(true);
    } catch (error) {
      console.error('Submit error:', error);
      const message = error.response?.data?.message || 'Operation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Filter subjects for prerequisites (exclude current subject and same/higher level)
  const availablePrerequisites = subjects.filter(s => 
    s._id !== subject?._id && 
    s.program === formData.program &&
    (s.yearLevel < formData.yearLevel || 
     (s.yearLevel === formData.yearLevel && s.semester < formData.semester))
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={() => onClose(false)}
      title={mode === 'create' ? 'Add New Subject' : 'Edit Subject'}
      subtitle={mode === 'create' ? 'Create a new subject for curriculum' : 'Update subject information'}
      icon={BookOpen}
      size="large"
      footerContent={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="flex-1 px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="subject-form"
            disabled={loading}
            className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{mode === 'create' ? 'Creating...' : 'Updating...'}</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-5 h-5" />
                <span>{mode === 'create' ? 'Create Subject' : 'Update Subject'}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="bg-gray-50 dark:bg-gray-900">
            <form onSubmit={handleSubmit} className="p-6" id="subject-form">
              {/* Subject Preview Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-4 mb-6 shadow-lg">
                <div className="text-sm font-medium opacity-90 mb-1">Subject Preview</div>
                <div className="text-2xl font-bold">
                  {formData.subjectCode || 'Subject Code'} - {formData.subjectName || 'Subject Name'}
                </div>
                <div className="text-sm opacity-90 mt-1">
                  {formData.program} • Year {formData.yearLevel} • Semester {formData.semester} • {formData.units} {formData.units === 1 ? 'unit' : 'units'}
                </div>
              </div>

              {/* Basic Information */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Basic Information
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">* Required</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Subject Code */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Subject Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="subjectCode"
                        value={formData.subjectCode}
                        onChange={handleChange}
                        required
                        placeholder="e.g., IT311"
                        className="flex-1 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all uppercase"
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateCode}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap"
                        title="Generate random code"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Generate
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Click "Generate" for a random code (e.g., AB1234)
                    </p>
                  </div>
                  </div>

                  {/* Units */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Units <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="units"
                      value={formData.units}
                      onChange={handleChange}
                      required
                      min="1"
                      max="6"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    />
                  </div>

                  {/* Subject Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Subject Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="subjectName"
                      value={formData.subjectName}
                      onChange={handleChange}
                      required
                      placeholder="e.g., Web Development"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="3"
                      placeholder="Brief description of the subject..."
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all resize-none"
                    />
                  </div>

                  {/* Subject Type */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Subject Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {SUBJECT_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, type })}
                          className={`px-3 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                            formData.type === type
                              ? 'bg-blue-600 text-white shadow-md scale-105'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Status */}
                  <div className="md:col-span-2 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all"
                    />
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active (available for scheduling)
                    </label>
                  </div>
                </div>
              </div>

              {/* Curriculum Information */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Curriculum Information
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">* Required</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Program */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Program <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="program"
                      value={formData.program}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    >
                      {PROGRAMS.map(prog => (
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
                      name="yearLevel"
                      value={formData.yearLevel}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    >
                      {YEAR_LEVELS.map(year => (
                        <option key={year} value={year}>Year {year}</option>
                      ))}
                    </select>
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Semester <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SEMESTERS.map(sem => (
                        <button
                          key={sem}
                          type="button"
                          onClick={() => setFormData({ ...formData, semester: sem })}
                          className={`px-3 py-2.5 rounded-lg font-semibold transition-all ${
                            formData.semester === sem
                              ? 'bg-blue-600 text-white shadow-md scale-105'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {sem === 1 ? '1st' : '2nd'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Required Qualification */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Required Qualification
                    </label>
                    <input
                      type="text"
                      name="requiredQualification"
                      value={formData.requiredQualification}
                      onChange={handleChange}
                      placeholder="e.g., Master's in Computer Science"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Prerequisites */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Prerequisites
                </h3>
                {availablePrerequisites.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No available prerequisites for this program and level
                  </p>
                ) : (
                  <div className="border-2 border-gray-200 dark:border-gray-600 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                    {availablePrerequisites.map(prereq => (
                      <label
                        key={prereq._id}
                        className="flex items-start py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.prerequisites.includes(prereq._id)}
                          onChange={() => handlePrerequisiteToggle(prereq._id)}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5 transition-all"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {prereq.subjectCode} - {prereq.subjectName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Year {prereq.yearLevel} • Semester {prereq.semester} • {prereq.units} {prereq.units === 1 ? 'unit' : 'units'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </div>
        </BaseModal>
  );
};

export default SubjectModal;
