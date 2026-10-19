import React, { useState, useEffect } from 'react';
import { UserX, Clock, Mail, Building2, GraduationCap, BookOpen, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import Layout from '../components/Layout';
import dashboardBg from '../assets/images/backgrounds/bg.jpg';
import AnimatedUserCheck from '../components/AnimatedUserCheck';

const FacultyApprovalPage = () => {
  const [pendingFaculty, setPendingFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingFaculty();
  }, []);

  const fetchPendingFaculty = async () => {
    try {
      setLoading(true);
      const response = await api.get('/faculty/pending');
      setPendingFaculty(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pending faculty:', error);
      toast.error('Failed to load pending faculty accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (facultyId, facultyName) => {
    if (!window.confirm(`Are you sure you want to approve ${facultyName}?`)) {
      return;
    }

    try {
      setActionLoading(facultyId);
      await api.put(`/faculty/${facultyId}/approve`);
      toast.success(`${facultyName} has been approved!`);
      
      // Remove from list
      setPendingFaculty(prev => prev.filter(f => f._id !== facultyId));
    } catch (error) {
      console.error('Error approving faculty:', error);
      toast.error(error.response?.data?.message || 'Failed to approve faculty account');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (faculty) => {
    setSelectedFaculty(faculty);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setActionLoading(selectedFaculty._id);
      await api.put(`/faculty/${selectedFaculty._id}/reject`, {
        reason: rejectionReason.trim()
      });
      toast.success(`${selectedFaculty.fullName} has been rejected`);
      
      // Remove from list
      setPendingFaculty(prev => prev.filter(f => f._id !== selectedFaculty._id));
      setShowRejectModal(false);
      setSelectedFaculty(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting faculty:', error);
      toast.error(error.response?.data?.message || 'Failed to reject faculty account');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading pending approvals...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div 
            className="rounded-2xl shadow-xl p-8 text-white bg-cover bg-center relative overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url(${dashboardBg})`
            }}
          >
            <div className="flex items-center justify-between relative z-10">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <AnimatedUserCheck className="w-10 h-10" />
                  Faculty Approval Queue
                </h1>
                <p className="text-white/90 text-lg">
                  Review and approve pending faculty registrations
                </p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold">{pendingFaculty.length}</div>
                <div className="text-white/80">Pending</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          {pendingFaculty.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="80" height="80" role="img" aria-label="Done">
                  <style>
                    {`
                      .circle {
                        fill: none;
                        stroke: #22c55e;
                        stroke-width: 6;
                        stroke-linecap: round;
                        stroke-dasharray: 327;
                        stroke-dashoffset: 327;
                        transform: rotate(-90deg);
                        transform-origin: 60px 60px;
                        animation: draw-circle 0.7s ease-out forwards;
                      }
                      .fill {
                        fill: #22c55e;
                        opacity: 0;
                        transform-origin: 60px 60px;
                        animation: fill-in 0.35s ease-out 0.7s forwards;
                      }
                      .check {
                        fill: none;
                        stroke: #ffffff;
                        stroke-width: 8;
                        stroke-linecap: round;
                        stroke-linejoin: round;
                        stroke-dasharray: 60;
                        stroke-dashoffset: 60;
                        animation: draw-check 0.4s ease-out 0.9s forwards;
                      }
                      .badge {
                        transform-origin: 60px 60px;
                        animation: pop 0.5s ease-out 1.1s;
                      }
                      .ring {
                        fill: none;
                        stroke: #22c55e;
                        stroke-width: 3;
                        opacity: 0;
                        transform-origin: 60px 60px;
                        animation: pulse 0.8s ease-out 1.1s;
                      }
                      @keyframes draw-circle { to { stroke-dashoffset: 0; } }
                      @keyframes fill-in { to { opacity: 1; } }
                      @keyframes draw-check { to { stroke-dashoffset: 0; } }
                      @keyframes pop {
                        0%   { transform: scale(1); }
                        50%  { transform: scale(1.12); }
                        100% { transform: scale(1); }
                      }
                      @keyframes pulse {
                        0%   { opacity: 0.6; transform: scale(1); }
                        100% { opacity: 0;   transform: scale(1.5); }
                      }
                      @media (prefers-reduced-motion: reduce) {
                        .circle, .fill, .check, .badge, .ring { animation-duration: 0.01s; animation-delay: 0s; }
                      }
                    `}
                  </style>
                  <g className="badge">
                    <circle className="fill" cx="60" cy="60" r="52"/>
                    <circle className="circle" cx="60" cy="60" r="52"/>
                    <path className="check" d="M38 62 L54 78 L83 44"/>
                  </g>
                  <circle className="ring" cx="60" cy="60" r="52"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                All Caught Up!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                There are no pending faculty registrations at the moment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingFaculty.map((faculty) => (
                <div
                  key={faculty._id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden border-2 border-yellow-200 dark:border-yellow-700"
                >
                  <div className="p-6">
                    {/* Header with Status Badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                          {faculty.firstName?.charAt(0)}{faculty.lastName?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {faculty.fullName || `${faculty.firstName} ${faculty.lastName}`}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Pending since: {formatDate(faculty.pendingApprovalDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Pending Approval
                      </div>
                    </div>

                    {/* Faculty Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Email</div>
                          <div className="text-gray-900 dark:text-white font-medium">{faculty.email}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Department</div>
                          <div className="text-gray-900 dark:text-white font-medium">
                            {faculty.facultyProfile?.department || 'Not specified'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Qualification</div>
                          <div className="text-gray-900 dark:text-white font-medium">
                            {faculty.facultyProfile?.qualification || 'Not specified'}
                          </div>
                        </div>
                      </div>

                      {faculty.facultyProfile?.specialization && (
                        <div className="flex items-start gap-3">
                          <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Specialization</div>
                            <div className="text-gray-900 dark:text-white font-medium">
                              {faculty.facultyProfile.specialization}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleApprove(faculty._id, faculty.fullName || `${faculty.firstName} ${faculty.lastName}`)}
                        disabled={actionLoading === faculty._id}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === faculty._id ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="20" height="20" role="img" aria-label="Approve" className="inline-block">
                              <style>
                                {`
                                  .circle {
                                    fill: none;
                                    stroke: currentColor;
                                    stroke-width: 6;
                                    stroke-linecap: round;
                                    stroke-dasharray: 327;
                                    stroke-dashoffset: 327;
                                    transform: rotate(-90deg);
                                    transform-origin: 60px 60px;
                                    animation: draw-circle 0.7s ease-out forwards;
                                  }
                                  .fill {
                                    fill: currentColor;
                                    opacity: 0;
                                    transform-origin: 60px 60px;
                                    animation: fill-in 0.35s ease-out 0.7s forwards;
                                  }
                                  .check {
                                    fill: none;
                                    stroke: #ffffff;
                                    stroke-width: 8;
                                    stroke-linecap: round;
                                    stroke-linejoin: round;
                                    stroke-dasharray: 60;
                                    stroke-dashoffset: 60;
                                    animation: draw-check 0.4s ease-out 0.9s forwards;
                                  }
                                  .badge {
                                    transform-origin: 60px 60px;
                                    animation: pop 0.5s ease-out 1.1s;
                                  }
                                  .ring {
                                    fill: none;
                                    stroke: currentColor;
                                    stroke-width: 3;
                                    opacity: 0;
                                    transform-origin: 60px 60px;
                                    animation: pulse 0.8s ease-out 1.1s;
                                  }
                                  @keyframes draw-circle { to { stroke-dashoffset: 0; } }
                                  @keyframes fill-in { to { opacity: 1; } }
                                  @keyframes draw-check { to { stroke-dashoffset: 0; } }
                                  @keyframes pop {
                                    0%   { transform: scale(1); }
                                    50%  { transform: scale(1.12); }
                                    100% { transform: scale(1); }
                                  }
                                  @keyframes pulse {
                                    0%   { opacity: 0.6; transform: scale(1); }
                                    100% { opacity: 0;   transform: scale(1.5); }
                                  }
                                  @media (prefers-reduced-motion: reduce) {
                                    .circle, .fill, .check, .badge, .ring { animation-duration: 0.01s; animation-delay: 0s; }
                                  }
                                `}
                              </style>
                              <g className="badge">
                                <circle className="fill" cx="60" cy="60" r="52"/>
                                <circle className="circle" cx="60" cy="60" r="52"/>
                                <path className="check" d="M38 62 L54 78 L83 44"/>
                              </g>
                              <circle className="ring" cx="60" cy="60" r="52"/>
                            </svg>
                            Approve Account
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleRejectClick(faculty)}
                        disabled={actionLoading === faculty._id}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-5 h-5" />
                        Reject Account
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reject Modal */}
        {showRejectModal && selectedFaculty && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-600 to-rose-600 p-6 text-white rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                    <UserX className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Reject Faculty Account</h2>
                    <p className="text-red-100 text-sm mt-1">
                      {selectedFaculty.fullName || `${selectedFaculty.firstName} ${selectedFaculty.lastName}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this application..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This reason will be recorded in the system logs
                </p>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedFaculty(null);
                    setRejectionReason('');
                  }}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={!rejectionReason.trim() || actionLoading === selectedFaculty._id}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === selectedFaculty._id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FacultyApprovalPage;
