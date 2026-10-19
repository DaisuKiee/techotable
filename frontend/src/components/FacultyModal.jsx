import React, { useState, useEffect } from 'react';
import { facultyAPI, userAPI, programAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, User, Users, Mail, Award, BookOpen, Clock } from 'lucide-react';
import BaseModal from './BaseModal';
import { useAuth } from '../context/AuthContext';
import AnimatedUserCheck from './AnimatedUserCheck';

const FacultyModal = ({ mode, faculty, onClose }) => {
  const { user } = useAuth();
  const isProgramManager = user?.role === 'program_manager';
  
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [formData, setFormData] = useState({
    // User account fields (for creation)
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    contactNumber: '',
    // Faculty profile fields
    user: '',
    employeeId: '',
    employmentType: 'Regular',
    position: 'Instructor',
    specializations: [''],
    programs: [],
    qualifications: [],
    experiencedSubjects: [],
    maxTeachingHours: 36,
    isActive: true,
    // Educational Background (from Excel template)
    bachelorsDegree: { degree: '', major: '', minor: '' },
    mastersDegree: { degree: '', major: '', minor: '' },
    doctoralDegree: { degree: '', major: '', minor: '' },
    specialTraining: '',
    administrativeDesignation: '',
    researchInvolvement: '',
    extensionInvolvement: '',
    productionInvolvement: ''
  });

  useEffect(() => {
    loadUsers();
    loadPrograms();
    if (mode === 'edit' && faculty) {
      setFormData({
        // User info (for display in edit mode)
        firstName: faculty.user?.firstName || '',
        lastName: faculty.user?.lastName || '',
        email: faculty.user?.email || '',
        password: '', // Don't populate password in edit mode
        contactNumber: faculty.user?.contactNumber || '',
        // Faculty profile
        user: faculty.user?._id || '',
        employeeId: faculty.employeeId || '',
        employmentType: faculty.employmentType || 'Regular',
        position: faculty.position || 'Instructor',
        specializations: faculty.specializations || [''],
        programs: faculty.programs || [],
        qualifications: faculty.qualifications || [],
        experiencedSubjects: faculty.experiencedSubjects || [],
        maxTeachingHours: faculty.maxTeachingHours || 36,
        isActive: faculty.isActive !== false,
        // Educational Background
        bachelorsDegree: faculty.bachelorsDegree || { degree: '', major: '', minor: '' },
        mastersDegree: faculty.mastersDegree || { degree: '', major: '', minor: '' },
        doctoralDegree: faculty.doctoralDegree || { degree: '', major: '', minor: '' },
        specialTraining: faculty.specialTraining || '',
        administrativeDesignation: faculty.administrativeDesignation || '',
        researchInvolvement: faculty.researchInvolvement || '',
        extensionInvolvement: faculty.extensionInvolvement || '',
        productionInvolvement: faculty.productionInvolvement || ''
      });
    }
  }, [mode, faculty]);

  // Auto-select program for program managers in create mode
  useEffect(() => {
    if (mode === 'create' && isProgramManager && user?.program && programs.length > 0) {
      const managerProgram = programs.find(p => p.programCode === user.program);
      if (managerProgram && !formData.programs.includes(user.program)) {
        setFormData(prev => ({
          ...prev,
          programs: [user.program]
        }));
      }
    }
  }, [mode, isProgramManager, user?.program, programs, formData.programs]);

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
      let programList = response.data.data || [];
      
      // Filter programs for program managers - only show their own program
      if (isProgramManager && user?.program) {
        programList = programList.filter(p => p.programCode === user.program);
      }
      
      setPrograms(programList);
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

  const handleDegreeChange = (degreeType, field, value) => {
    setFormData({
      ...formData,
      [degreeType]: {
        ...formData[degreeType],
        [field]: value
      }
    });
  };

  const handleSpecializationChange = (index, value) => {
    const newSpecializations = [...formData.specializations];
    newSpecializations[index] = value;
    setFormData({
      ...formData,
      specializations: newSpecializations
    });
  };

  const addSpecialization = () => {
    setFormData({
      ...formData,
      specializations: [...formData.specializations, '']
    });
  };

  const removeSpecialization = (index) => {
    const newSpecializations = formData.specializations.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      specializations: newSpecializations.length > 0 ? newSpecializations : ['']
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty specializations
      const cleanedData = {
        ...formData,
        specializations: formData.specializations.filter(s => s.trim() !== '')
      };

      if (mode === 'create') {
        // Create user account first, then faculty profile
        const userData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          contactNumber: formData.contactNumber,
          role: 'faculty'
        };

        // Call backend endpoint that creates both user and faculty profile
        await facultyAPI.create({
          ...cleanedData,
          ...userData
        });
        
        toast.success('Faculty account created successfully');
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
    <BaseModal
      isOpen={true}
      onClose={() => onClose(false)}
      title={mode === 'create' ? 'Add New Faculty' : 'Edit Faculty'}
      subtitle={mode === 'create' ? 'Create a new faculty profile' : 'Update faculty information'}
      icon={Users}
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
            form="faculty-form"
            disabled={loading}
            className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{mode === 'create' ? 'Creating...' : 'Updating...'}</span>
              </>
            ) : (
              <span>{mode === 'create' ? 'Create Faculty' : 'Save Changes'}</span>
            )}
          </button>
        </div>
      }
    >
      <div className="bg-gray-50 dark:bg-gray-900 p-6">
          {/* Faculty Preview Card (Edit Mode) */}
          {mode === 'edit' && faculty && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 mb-6 border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {faculty.user?.profilePicture ? (
                    <img
                      src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${faculty.user.profilePicture}`}
                      alt={`${faculty.user.firstName} ${faculty.user.lastName}`}
                      className="h-16 w-16 rounded-full object-cover ring-4 ring-blue-200 dark:ring-blue-800"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center ring-4 ring-blue-200 dark:ring-blue-800"
                    style={{ display: faculty.user?.profilePicture ? 'none' : 'flex' }}
                  >
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
                    <span className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded">
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
                      <AnimatedUserCheck className="w-3 h-3" />
                      {faculty.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Workload: {faculty.currentTeachingHours || 0} / {faculty.maxTeachingHours || 36} hrs/week</span>
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
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">User Information</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">* Required</span>
                </div>

                {/* User Account Creation (Only for create mode) */}
                {mode === 'create' && (
                  <div className="space-y-4 mb-4 pb-4 border-b-2 border-gray-300 dark:border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* First Name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          required
                          placeholder="e.g., John"
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                        />
                      </div>

                      {/* Last Name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          required
                          placeholder="e.g., Doe"
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          placeholder="e.g., john.doe@ctu.edu.ph"
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          placeholder="Min. 6 characters"
                          minLength={6}
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                        />
                      </div>

                      {/* Contact Number */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Contact Number
                        </label>
                        <input
                          type="tel"
                          name="contactNumber"
                          value={formData.contactNumber}
                          onChange={handleChange}
                          placeholder="e.g., +63 912 345 6789"
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      A faculty account will be created with these credentials
                    </p>
                  </div>
                )}

                {/* 2-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Employee ID */}
                  <div>
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
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                    />
                  </div>

                  {/* Employment Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Employment Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="employmentType"
                      value={formData.employmentType}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all appearance-none bg-white dark:bg-gray-700"
                    >
                      <option value="Regular">Regular Instructor</option>
                      <option value="Part-time">Part-time Instructor</option>
                    </select>
                  </div>

                  {/* Position - Full width for better visibility of options */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Position <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all appearance-none bg-white dark:bg-gray-700"
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
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Administrative hours will be added to teaching load
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Information Section */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Academic Information</h3>
                </div>

                {/* Specializations */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Specializations
                  </label>
                  <div className="space-y-2">
                    {formData.specializations.map((spec, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={spec}
                          onChange={(e) => handleSpecializationChange(index, e.target.value)}
                          placeholder="e.g., Web Development, Database Management"
                          className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 transition-all"
                        />
                        {formData.specializations.length > 1 && (
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
                    className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Specialization
                  </button>
                  
                  {/* Specialization Chips Preview */}
                  {formData.specializations.filter(s => s.trim()).length > 0 && (
                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.specializations.filter(s => s.trim()).map((spec, idx) => (
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
                      <label key={prog._id} className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-all">
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
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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

              {/* Educational Background Section (from Excel Template) */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border-2 border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Educational Background</h3>
                  <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium">Optional - Based on Faculty Profiles</span>
                </div>

                {/* Bachelor's Degree */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-blue-200 dark:border-blue-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Bachelor's Degree
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Degree
                      </label>
                      <input
                        type="text"
                        value={formData.bachelorsDegree.degree}
                        onChange={(e) => handleDegreeChange('bachelorsDegree', 'degree', e.target.value)}
                        placeholder="e.g., BS Computer Science"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Major
                      </label>
                      <input
                        type="text"
                        value={formData.bachelorsDegree.major}
                        onChange={(e) => handleDegreeChange('bachelorsDegree', 'major', e.target.value)}
                        placeholder="e.g., Computer Science"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Minor
                      </label>
                      <input
                        type="text"
                        value={formData.bachelorsDegree.minor}
                        onChange={(e) => handleDegreeChange('bachelorsDegree', 'minor', e.target.value)}
                        placeholder="e.g., Mathematics"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Master's Degree */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-purple-200 dark:border-purple-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    Master's Degree
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Degree
                      </label>
                      <input
                        type="text"
                        value={formData.mastersDegree.degree}
                        onChange={(e) => handleDegreeChange('mastersDegree', 'degree', e.target.value)}
                        placeholder="e.g., MIT, MAEd"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Major
                      </label>
                      <input
                        type="text"
                        value={formData.mastersDegree.major}
                        onChange={(e) => handleDegreeChange('mastersDegree', 'major', e.target.value)}
                        placeholder="e.g., Information Technology"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Minor
                      </label>
                      <input
                        type="text"
                        value={formData.mastersDegree.minor}
                        onChange={(e) => handleDegreeChange('mastersDegree', 'minor', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Doctoral Degree */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-green-200 dark:border-green-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-green-600" />
                    Doctoral Degree
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Degree
                      </label>
                      <input
                        type="text"
                        value={formData.doctoralDegree.degree}
                        onChange={(e) => handleDegreeChange('doctoralDegree', 'degree', e.target.value)}
                        placeholder="e.g., Ph.D., Ed.D."
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Major
                      </label>
                      <input
                        type="text"
                        value={formData.doctoralDegree.major}
                        onChange={(e) => handleDegreeChange('doctoralDegree', 'major', e.target.value)}
                        placeholder="e.g., Educational Management"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Minor
                      </label>
                      <input
                        type="text"
                        value={formData.doctoralDegree.minor}
                        onChange={(e) => handleDegreeChange('doctoralDegree', 'minor', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Special Training */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Special Training & Certifications
                    </label>
                    <textarea
                      name="specialTraining"
                      value={formData.specialTraining}
                      onChange={handleChange}
                      rows="3"
                      placeholder="e.g., Full Stack Web Development, AWS Certified, etc."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 resize-none"
                    />
                  </div>

                  {/* Administrative Designation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Administrative Designation
                    </label>
                    <input
                      type="text"
                      name="administrativeDesignation"
                      value={formData.administrativeDesignation}
                      onChange={handleChange}
                      placeholder="e.g., Director, Coordinator, etc."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Academic Involvement */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Research */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Research Involvement
                    </label>
                    <textarea
                      name="researchInvolvement"
                      value={formData.researchInvolvement}
                      onChange={handleChange}
                      rows="2"
                      placeholder="Research projects, publications, etc."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 resize-none"
                    />
                  </div>

                  {/* Extension */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Extension Activities
                    </label>
                    <textarea
                      name="extensionInvolvement"
                      value={formData.extensionInvolvement}
                      onChange={handleChange}
                      rows="2"
                      placeholder="Community outreach, training, etc."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 resize-none"
                    />
                  </div>

                  {/* Production */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Production Activities
                    </label>
                    <textarea
                      name="productionInvolvement"
                      value={formData.productionInvolvement}
                      onChange={handleChange}
                      rows="2"
                      placeholder="Production projects, outputs, etc."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 resize-none"
                    />
                  </div>
                </div>

                <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  These fields match the Faculty Profiles Excel template structure
                </p>
              </div>


            </div>
          </form>
        </div>
      </BaseModal>
  );
};

export default FacultyModal;
