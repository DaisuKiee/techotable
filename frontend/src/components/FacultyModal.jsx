import React, { useState, useEffect } from 'react';
import { facultyAPI, userAPI, programAPI } from '../services/api';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, User, Users, Mail, Award, BookOpen, Save, UserCheck, Clock } from 'lucide-react';

const FacultyModal = ({ mode, faculty, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [formData, setFormData] = useState({
    user: '',
    employeeId: '',
    employmentType: 'Regular',
    position: 'Instructor',
    specialization: [''],
    programs: [],
    maxLoad: 36,
    isActive: true
  });

  useEffect(() => {
    loadUsers();
    loadPrograms();
    if (mode === 'edit' && faculty) {
      setFormData({
        user: faculty.user?._id || '',
        employeeId: faculty.employeeId || '',
        employmentType: faculty.employmentType || 'Regular',
        position: faculty.position || 'Instructor',
        specialization: faculty.specialization || [''],
        programs: faculty.programs || [],
        maxLoad: faculty.maxLoad || 36,
        isActive: faculty.isActive !== false
      });
    }
  }, [mode, faculty]);

  // // Disable body scroll when modal is open
  // useEffect(() => {
  //   document.body.style.overflow = 'hidden';
  //   return () => {
  //     document.body.style.overflow = 'unset';
  //   };
  // }, []);

  const loadUsers = async () => {
    try {
      // Get users with role 'faculty' that don't have a faculty profile yet
      const response = await userAPI.getByRole('faculty');
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Load users error:', error);
    }
  };

  const loadPrograms = async () => {
    try {
      const response = await programAPI.getAll({ isActive: true });
      setPrograms(response.data.data || []);
    } catch (error) {
      console.error('Load programs error:', error);
      toast.error('Failed to load programs');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSpecializationChange = (index, value) => {
    const newSpecializations = [...formData.specialization];
    newSpecializations[index] = value;
    setFormData({
      ...formData,
      specialization: newSpecializations
    });
  };

  const addSpecialization = () => {
    setFormData({
      ...formData,
      specialization: [...formData.specialization, '']
    });
  };

  const removeSpecialization = (index) => {
    const newSpecializations = formData.specialization.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      specialization: newSpecializations.length > 0 ? newSpecializations : ['']
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty specializations
      const cleanedData = {
        ...formData,
        specialization: formData.specialization.filter(s => s.trim() !== '')
      };

      if (mode === 'create') {
        await facultyAPI.create(cleanedData);
        toast.success('Faculty member created successfully');
      } else {
        await facultyAPI.update(faculty._id, cleanedData);
        toast.success('Faculty member updated successfully');
      }
      onClose(true); // true = refresh list
    } catch (error) {
      console.error('Submit error:', error);
      const message = error.response?.data?.message || 'Operation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] animate-fadeIn flex items-start justify-center p-4 pt-8 overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative z-[10000] animate-slideUp">
        {/* Header - Sticky */}
        <div className="bg-teal-600 text-white px-6 py-5 rounded-t-2xl flex items-center justify-between flex-shrink-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {mode === 'create' ? 'Add New Faculty' : 'Edit Faculty'}
              </h2>
              <p className="text-teal-100 text-sm">
                {mode === 'create' ? 'Create a new faculty profile' : 'Update faculty information'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Faculty Preview Card (Edit Mode) */}
          {mode === 'edit' && faculty && (
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl p-5 mb-6 border-2 border-teal-200 dark:border-teal-800">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="h-16 w-16 rounded-full bg-teal-600 flex items-center justify-center ring-4 ring-teal-200 dark:ring-teal-800">
                    <User className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {faculty.user?.firstName} {faculty.user?.lastName}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {faculty.user?.email}
                    </span>
                    <span className="px-2.5 py-1 bg-teal-600 text-white text-xs font-bold rounded">
                      {faculty.employeeId}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded ${
                      faculty.employmentType === 'Regular'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    }`}>
                      {faculty.employmentType || 'Regular'}
                    </span>
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      faculty.isActive 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}>
                      <UserCheck className="w-3 h-3" />
                      {faculty.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Workload: {faculty.currentLoad || 0} / {faculty.maxLoad} hrs/week</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} id="faculty-form">
            <div className="space-y-6">
              {/* User Information Section */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">User Information</h3>
                </div>

                {/* User Selection (Only for create mode) */}
                {mode === 'create' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Select User Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="user"
                      value={formData.user}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white transition-all"
                    >
                      <option value="">Choose a user...</option>
                      {users.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Users with role "faculty" who don't have a profile yet
                    </p>
                  </div>
                )}

                {/* Employee ID */}
                <div className={mode === 'create' ? 'mt-4' : ''}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleChange}
                    required
                    placeholder="e.g., FAC-2024-001"
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                  />
                </div>

                {/* Employment Type */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Employment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white transition-all appearance-none bg-white dark:bg-gray-700"
                  >
                    <option value="Regular">Regular Instructor</option>
                    <option value="Part-time">Part-time Instructor</option>
                  </select>
                </div>

                {/* Position */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Position <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white transition-all appearance-none bg-white dark:bg-gray-700"
                  >
                    <option value="Instructor">Instructor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Professor">Professor</option>
                    <option value="Chairman">Chairman (12-15 hrs admin)</option>
                    <option value="Dean">Dean (9 hrs admin)</option>
                    <option value="CD">CD (6 hrs admin)</option>
                  </select>
                  {['Chairman', 'Dean', 'CD'].includes(formData.position) && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                      ℹ️ Administrative hours will be added to teaching load
                    </p>
                  )}
                </div>
              </div>

              {/* Academic Information Section */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Academic Information</h3>
                </div>

                {/* Specializations */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Specializations
                  </label>
                  <div className="space-y-2">
                    {formData.specialization.map((spec, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={spec}
                          onChange={(e) => handleSpecializationChange(index, e.target.value)}
                          placeholder="e.g., Web Development, Database Management"
                          className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                        />
                        {formData.specialization.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSpecialization(index)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                            title="Remove specialization"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addSpecialization}
                    className="mt-3 flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Specialization
                  </button>
                  
                  {/* Specialization Chips Preview */}
                  {formData.specialization.filter(s => s.trim()).length > 0 && (
                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.specialization.filter(s => s.trim()).map((spec, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                          >
                            <BookOpen className="w-3 h-3 mr-1" />
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Programs - Multi-select */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Qualified Programs <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {programs.map((prog) => (
                      <label key={prog._id} className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-teal-500 dark:hover:border-teal-500 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={formData.programs?.includes(prog.code) || false}
                          onChange={(e) => {
                            const currentPrograms = formData.programs || [];
                            const newPrograms = e.target.checked
                              ? [...currentPrograms, prog.code]
                              : currentPrograms.filter(p => p !== prog.code);
                            setFormData({ ...formData, programs: newPrograms });
                          }}
                          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                          {prog.code} - {prog.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Select all programs this faculty member is qualified to teach
                  </p>
                </div>
              </div>

              {/* Workload & Status Section */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Workload & Status</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Max Teaching Hours */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Max Teaching Hours (per week) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="maxLoad"
                      value={formData.maxLoad}
                      onChange={handleChange}
                      required
                      min="0"
                      max="40"
                      placeholder="36"
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      ⚠️ Standard: 36 hours (can go up to 40 with warning)
                    </p>
                  </div>

                  {/* Active Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <div className="flex items-center h-12 px-4 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleChange}
                        className="h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded cursor-pointer"
                      />
                      <label className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        Active (can be assigned to schedules)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer - Sticky */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3 border-t-2 border-gray-200 dark:border-gray-600 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="faculty-form"
            disabled={loading}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{mode === 'create' ? 'Creating...' : 'Updating...'}</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>{mode === 'create' ? 'Create Faculty' : 'Update Faculty'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyModal;
