import React, { useState, useEffect } from 'react';
import { studentAPI, sectionAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Users, Mail, Lock, User, GraduationCap, Phone, MapPin, UserCheck, FileText } from 'lucide-react';
import { usePrograms } from '../hooks/usePrograms';
import BaseModal from './BaseModal';

const StudentModal = ({ student, onClose }) => {
  const { programCodes } = usePrograms();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    middleName: '',
    studentId: '',
    program: 'BSIT',
    yearLevel: 1,
    section: '',
    studentType: 'regular',
    academicYear: '2024-2025',
    semester: 1,
    contactNumber: '',
    address: {
      street: '',
      barangay: '',
      city: '',
      province: '',
      zipCode: ''
    },
    guardianInfo: {
      name: '',
      relationship: '',
      contactNumber: ''
    },
    emergencyContact: {
      name: '',
      relationship: '',
      contactNumber: ''
    },
    enrollmentStatus: 'enrolled',
    gpa: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // // Disable body scroll when modal is open
  // useEffect(() => {
  //   document.body.style.overflow = 'hidden';
  //   return () => {
 

  // Fetch sections when program or year level changes
  useEffect(() => {
    fetchSections();
  }, [formData.program, formData.yearLevel]);

  const fetchSections = async () => {
    if (!formData.program || !formData.yearLevel) return;
    
    setLoadingSections(true);
    try {
      const response = await sectionAPI.getAll();
      const allSections = response.data.data || [];
      
      // Filter sections by program and year level
      const filteredSections = allSections.filter(
        s => s.program === formData.program && s.yearLevel === parseInt(formData.yearLevel)
      );
      
      setSections(filteredSections);
      
      // Auto-select first section if current selection is invalid
      if (filteredSections.length > 0 && !student) {
        const currentSectionValid = filteredSections.some(s => s.sectionLetter === formData.section);
        if (!currentSectionValid) {
          setFormData(prev => ({ ...prev, section: filteredSections[0].sectionLetter }));
        }
      } else if (filteredSections.length === 0) {
        setFormData(prev => ({ ...prev, section: '' }));
      }
    } catch (error) {
      console.error('Failed to fetch sections:', error);
      toast.error('Failed to load sections');
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => {
    if (student) {
      setFormData({
        email: student.user?.email || '',
        password: '', // Don't populate password for edit
        firstName: student.user?.firstName || '',
        lastName: student.user?.lastName || '',
        middleName: student.user?.middleName || '',
        studentId: student.studentId || '',
        program: student.program || 'BSIT',
        yearLevel: student.yearLevel || 1,
        section: student.section || '',
        studentType: student.studentType || 'regular',
        academicYear: student.academicYear || '2024-2025',
        semester: student.semester || 1,
        contactNumber: student.contactNumber || '',
        address: student.address || {
          street: '',
          barangay: '',
          city: '',
          province: '',
          zipCode: ''
        },
        guardianInfo: student.guardianInfo || {
          name: '',
          relationship: '',
          contactNumber: ''
        },
        emergencyContact: student.emergencyContact || {
          name: '',
          relationship: '',
          contactNumber: ''
        },
        enrollmentStatus: student.enrollmentStatus || 'enrolled',
        gpa: student.gpa || '',
        notes: student.notes || ''
      });
    }
  }, [student]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If section is changed, auto-fill semester and academic year from the selected section
    if (name === 'section') {
      const selectedSection = sections.find(s => s.sectionLetter === value);
      if (selectedSection) {
        setFormData(prev => ({
          ...prev,
          section: value,
          semester: selectedSection.semester,
          academicYear: selectedSection.academicYear
        }));
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.studentId || !formData.email || !formData.firstName || !formData.lastName || !formData.program) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!student && !formData.password) {
      toast.error('Password is required for new students');
      return;
    }

    setLoading(true);
    try {
      if (student) {
        await studentAPI.update(student._id, formData);
        toast.success('Student updated successfully');
      } else {
        await studentAPI.create(formData);
        toast.success('Student created successfully');
      }
      onClose(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={() => onClose(false)}
      title={student ? 'Edit Student' : 'Add New Student'}
      subtitle={student ? 'Update student information' : 'Create a new student record'}
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
            form="student-form"
            disabled={loading}
            className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{student ? 'Updating...' : 'Creating...'}</span>
              </>
            ) : (
              <span>{student ? 'Update Student' : 'Create Student'}</span>
            )}
          </button>
        </div>
      }
    >
      <div className="bg-gray-50 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="p-6" id="student-form">
            {/* Student Preview Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-4 mb-6 shadow-lg">
              <div className="text-sm font-medium opacity-90 mb-1">Student Preview</div>
              <div className="text-2xl font-bold">
                {formData.studentId || 'Student ID'} - {formData.firstName || 'First'} {formData.lastName || 'Last'}
              </div>
              <div className="text-sm opacity-90 mt-1">
                {formData.program} • Year {formData.yearLevel} • Section {formData.section || 'N/A'} • {formData.studentType}
              </div>
              <div className="text-xs opacity-80 mt-1">
                {formData.academicYear || 'Academic Year'} • Semester {formData.semester}
              </div>
            </div>
            {/* Basic Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Basic Information
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">* Required</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Student ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="studentId"
                    value={formData.studentId}
                    onChange={handleChange}
                    disabled={!!student}
                    placeholder="e.g., 2024-00001"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all disabled:bg-gray-100 dark:disabled:bg-gray-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="student@ctu.edu.ph"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    required
                  />
                </div>
                {!student && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Juan"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Dela Cruz"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    placeholder="Santos"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    placeholder="09123456789"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Academic Information
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">* Required</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Program <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="program"
                    value={formData.program}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    required
                  >
                    {programCodes.map(prog => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Year Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="yearLevel"
                    value={formData.yearLevel}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                    required
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    disabled={loadingSections || sections.length === 0}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                    required
                  >
                    {loadingSections ? (
                      <option value="">Loading sections...</option>
                    ) : sections.length === 0 ? (
                      <option value="">No sections available</option>
                    ) : (
                      <>
                        <option value="">Select Section</option>
                        {sections.map(section => (
                          <option key={section._id} value={section.sectionLetter}>
                            Section {section.sectionLetter} - {section.shift} ({section.currentStudents || 0}/{section.maxStudents})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {sections.length === 0 && !loadingSections && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      No sections found for {formData.program} Year {formData.yearLevel}. Please create a section first.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Student Type
                  </label>
                  <select
                    name="studentType"
                    value={formData.studentType}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  >
                    <option value="regular">Regular</option>
                    <option value="irregular">Irregular</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    name="academicYear"
                    value={formData.academicYear}
                    readOnly
                    placeholder="Auto-filled from section"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all bg-gray-50 dark:bg-gray-600 cursor-not-allowed"
                    title="This field is automatically filled based on the selected section"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Auto-filled from selected section
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Semester
                  </label>
                  <input
                    type="text"
                    name="semester"
                    value={formData.semester === 1 ? '1st Semester' : '2nd Semester'}
                    readOnly
                    placeholder="Auto-filled from section"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all bg-gray-50 dark:bg-gray-600 cursor-not-allowed"
                    title="This field is automatically filled based on the selected section"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Auto-filled from selected section
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Enrollment Status
                  </label>
                  <select
                    name="enrollmentStatus"
                    value={formData.enrollmentStatus}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  >
                    <option value="enrolled">Enrolled</option>
                    <option value="not_enrolled">Not Enrolled</option>
                    <option value="dropped">Dropped</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    GPA
                  </label>
                  <input
                    type="number"
                    name="gpa"
                    value={formData.gpa}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="5"
                    placeholder="1.00"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Guardian Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Guardian Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={formData.guardianInfo.name}
                    onChange={(e) => handleNestedChange('guardianInfo', 'name', e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.guardianInfo.relationship}
                    onChange={(e) => handleNestedChange('guardianInfo', 'relationship', e.target.value)}
                    placeholder="e.g., Father, Mother"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={formData.guardianInfo.contactNumber}
                    onChange={(e) => handleNestedChange('guardianInfo', 'contactNumber', e.target.value)}
                    placeholder="09123456789"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact.name}
                    onChange={(e) => handleNestedChange('emergencyContact', 'name', e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => handleNestedChange('emergencyContact', 'relationship', e.target.value)}
                    placeholder="e.g., Sibling"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContact.contactNumber}
                    onChange={(e) => handleNestedChange('emergencyContact', 'contactNumber', e.target.value)}
                    placeholder="09123456789"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Additional notes about the student..."
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all resize-none"
              />
            </div>
          </form>
        </div>
      </BaseModal>
  );
};

export default StudentModal;
