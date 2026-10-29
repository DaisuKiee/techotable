import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, CheckCircle, XCircle } from 'lucide-react';
import { ModalShell, ModalHeader, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';
import { studentAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import AnimatedUserCheck from './AnimatedUserCheck';

const ManageSectionStudentsModal = ({ section, onClose, onSuccess }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningIds, setAssigningIds] = useState(new Set());

  useEffect(() => {
    loadStudents();
  }, [section]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      // Get all students in the same program
      const response = await studentAPI.getAll({ 
        program: section.program
      });
      setStudents(response.data.data || []);
    } catch (error) {
      console.error('Load students error:', error);
      toast.error(getErrorMessage(error, 'Failed to load students'));
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSection = async (student) => {
    setAssigningIds(prev => new Set(prev).add(student._id));
    
    try {
      await studentAPI.assignSectionCode(student._id, {
        sectionCode: section.sectionCode,
        studentType: 'regular'
      });
      
      toast.success(`Assigned ${student.user?.firstName} to ${section.sectionCode}`);
      loadStudents();
      onSuccess();
    } catch (error) {
      console.error('Assign section error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign section');
    } finally {
      setAssigningIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(student._id);
        return newSet;
      });
    }
  };

  const filteredStudents = students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${student.user?.firstName} ${student.user?.lastName}`.toLowerCase();
    const studentId = student.studentId.toLowerCase();
    const email = student.user?.email?.toLowerCase() || '';
    
    return fullName.includes(searchLower) || 
           studentId.includes(searchLower) || 
           email.includes(searchLower);
  });

  // Separate assigned and unassigned students
  const assignedStudents = filteredStudents.filter(s => s.sectionCode === section.sectionCode);
  const unassignedStudents = filteredStudents.filter(s => s.sectionCode !== section.sectionCode);

  const titleId = useModalTitleId();

  return (
    <ModalShell onClose={onClose} size="xl" labelledBy={titleId} guardDirty={false}>
      <ModalHeader
        id={titleId}
        icon={Users}
        title="Manage section students"
        subtitle={`${section.sectionCode} · ${section.program} Year ${section.yearLevel} · ${assignedStudents.length} assigned`}
        onClose={onClose}
      />

        {/* Search */}
        <div className="px-5 py-3 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, student ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              data-modal-ignore-dirty
            />
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Assigned Students Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Assigned Students ({assignedStudents.length})
                  </h3>
                </div>
                {assignedStudents.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <AnimatedUserCheck className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">No students assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedStudents.map(student => (
                      <div
                        key={student._id}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {student.user?.profilePicture ? (
                              <img
                                src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${student.user.profilePicture}`}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                  {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {student.user?.firstName} {student.user?.lastName}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {student.studentId} • {student.user?.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">Assigned</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unassigned Students Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Available Students ({unassignedStudents.length})
                  </h3>
                </div>
                {unassignedStudents.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchTerm ? 'No students match your search' : 'All students have been assigned'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unassignedStudents.map(student => {
                      const isAssigning = assigningIds.has(student._id);
                      
                      return (
                        <div
                          key={student._id}
                          className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {student.user?.profilePicture ? (
                                <img
                                  src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${student.user.profilePicture}`}
                                  alt=""
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                  <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">
                                    {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {student.user?.firstName} {student.user?.lastName}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {student.studentId} • {student.user?.email}
                                </p>
                                {student.sectionCode && (
                                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    Currently in: {student.sectionCode}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAssignSection(student)}
                              disabled={isAssigning}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAssigning ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Assigning...
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  Assign to Section
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <ModalFooter info={`${unassignedStudents.length} student${unassignedStudents.length === 1 ? '' : 's'} not in this section`}>
          <ModalButton variant="secondary" onClick={onClose}>Close</ModalButton>
        </ModalFooter>
    </ModalShell>
  );
};

export default ManageSectionStudentsModal;
