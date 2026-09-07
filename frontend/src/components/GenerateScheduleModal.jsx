import React, { useState, useCallback, useEffect } from 'react';
import { scheduleAPI, sectionAPI } from '../services/api';
import toast from 'react-hot-toast';
import { X, Wand2, Loader, CheckCircle, AlertTriangle, Calendar, Sparkles } from 'lucide-react';

const YEAR_LEVELS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];

const GenerateScheduleModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ortoolsStatus, setOrtoolsStatus] = useState(null);
  const [availableSections, setAvailableSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  // A constraint solve can run for the full time limit. Without a visible
  // counter a 60-second wait behind a static spinner looks like a hang.
  const [elapsed, setElapsed] = useState(0);
  const [formData, setFormData] = useState({
    section: '', // Section ID
    method: 'greedy', // 'greedy' or 'ortools'
    timeLimit: 60, // seconds for OR-Tools
    useAIRecommendations: true // Use AI RAG for faculty recommendations
  });

  // Check OR-Tools availability on mount
  useEffect(() => {
    checkOrtoolsAvailability();
  }, []);

  useEffect(() => {
    if (!generating) return;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [generating]);

  const fetchAvailableSections = useCallback(async () => {
    setLoadingSections(true);
    console.log('=== FETCHING ALL SECTIONS ===');
    
    try {
      const response = await sectionAPI.getAll();
      
      console.log('Sections response:', response.data);
      
      if (response.data.success) {
        setAvailableSections(response.data.data || []);
        console.log('Available sections:', response.data.data);
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
      setAvailableSections([]);
    } finally {
      setLoadingSections(false);
      console.log('=== SECTIONS FETCH COMPLETE ===');
    }
  }, []);

  // Fetch sections on mount
  useEffect(() => {
    fetchAvailableSections();
  }, [fetchAvailableSections]);

  const checkOrtoolsAvailability = async () => {
    try {
      const response = await scheduleAPI.checkORToolsStatus();
      setOrtoolsStatus(response.data.ortools);
    } catch (error) {
      console.error('Failed to check OR-Tools status:', error);
      setOrtoolsStatus({ available: false });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: ['timeLimit'].includes(name) ? parseInt(value) || 1 : value
    });
  };

  const handleAIToggle = () => {
    setFormData(prev => ({
      ...prev,
      useAIRecommendations: !prev.useAIRecommendations
    }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    console.log('=== GENERATE SCHEDULE PREVIEW CLICKED ===');
    console.log('Form Data:', formData);
    
    if (!formData.section) {
      console.error('No section selected!');
      toast.error('Please select a section');
      return;
    }

    // Find the selected section to get its details
    const selectedSection = availableSections.find(s => s._id === formData.section);
    if (!selectedSection) {
      toast.error('Selected section not found');
      return;
    }

    setGenerating(true);
    setPreviewData(null);

    try {
      const generateData = {
        program: selectedSection.program,
        yearLevel: parseInt(selectedSection.yearLevel),
        semester: parseInt(selectedSection.semester),
        shift: selectedSection.shift,
        section: selectedSection.sectionLetter,
        academicYear: selectedSection.academicYear,
        method: formData.method,
        timeLimit: parseInt(formData.timeLimit),
        useAIRecommendations: formData.useAIRecommendations
      };

      console.log('Sending preview request:', generateData);
      const response = await scheduleAPI.preview(generateData);
      console.log('Preview response:', response.data);
      
      const payload = response.data;
      const body = payload.data || {};
      const preview = body.preview || body;

      if (payload.success) {
        const scheduled = preview.schedules?.length || 0;

        setPreviewData({
          success: true,
          message: payload.message,
          method: payload.method,
          methodNote: body.methodNote || preview.methodNote,
          aiUsed: payload.aiUsed || formData.useAIRecommendations,
          // Solver notes: relaxed room capacity, subjects left alone, and so on
          diagnostics: body.diagnostics || preview.diagnostics || [],
          skipped: body.skipped || preview.skipped || [],
          preview,
          sectionInfo: selectedSection
        });

        // A successful solve with nothing to place is not worth a success toast
        if (scheduled === 0) {
          toast(payload.message || 'Nothing to schedule for this section', { duration: 6000 });
        } else {
          toast.success(`${scheduled} class${scheduled === 1 ? '' : 'es'} ready to review`);
        }
      } else {
        setPreviewData({
          success: false,
          message: payload.message,
          method: payload.method,
          blockers: payload.blockers || body.blockers || [],
          diagnostics: payload.diagnostics || body.diagnostics || [],
        });
        toast.error(payload.message || 'Could not generate a preview');
      }
    } catch (error) {
      console.error('Generate preview failed:', error);

      // A solver timeout or a dead server has no response body, so reading
      // error.response.data.message alone produced a bare "Failed to generate
      // preview" with nothing the user could act on.
      let message;
      let hint;

      if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
        message = `The request timed out after about ${formData.timeLimit + 45}s.`;
        hint = 'Lower the optimization time limit, or pick the Greedy method for a fast result.';
      } else if (!error.response) {
        message = 'Could not reach the server.';
        hint = 'Check that the backend is running, then try again.';
      } else {
        message = error.response.data?.message
          || error.response.data?.error
          || `The server returned ${error.response.status}.`;
        hint = error.response.data?.blockers?.length ? null : undefined;
      }

      setPreviewData({
        success: false,
        message,
        hint,
        blockers: error.response?.data?.blockers || [],
      });
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSchedules = async () => {
    if (!previewData || !previewData.preview || !previewData.preview.schedules) {
      toast.error('No schedules to save');
      return;
    }

    setSaving(true);

    try {
      console.log('Saving schedules:', previewData.preview.schedules);
      const response = await scheduleAPI.savePreview({
        schedules: previewData.preview.schedules
      });

      if (response.data.success) {
        toast.success(`Successfully saved ${response.data.saved} schedule(s)!`);
        onClose(true); // Refresh parent
      } else {
        toast.error(response.data.message || 'Failed to save schedules');
      }
    } catch (error) {
      console.error('Save schedules error:', error);
      toast.error(error.response?.data?.message || 'Failed to save schedules');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // If schedules were saved, refresh the parent
    if (previewData?.success && !previewData.preview) {
      onClose(true);
    } else {
      onClose(false);
    }
  };

  const isORTools = formData.method === 'ortools';
  // Both generators nest their numbers differently; read once, guarded, so a
  // missing field can't blow up the whole panel.
  const stats = previewData?.preview?.statistics || {};

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'partial':
        return 'text-orange-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'partial':
        return <AlertTriangle size={20} className="text-orange-600" />;
      case 'failed':
        return <AlertTriangle size={20} className="text-red-600" />;
      default:
        return null;
    }
  };

  return (
    /*
     * Fixed-height panel with its own scrolling body. The dialog used to grow
     * with its content and rely on the page scrolling, so once a preview was
     * rendered the action buttons were pushed off screen.
     */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-white rounded-xl text-left shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-purple-600 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0">
              <Wand2 className="text-white mr-3 flex-shrink-0" size={22} />
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                  Schedule Generator
                </h3>
                <p className="text-xs text-purple-200 truncate">
                  {isORTools ? 'Google OR-Tools constraint solver' : 'Greedy algorithm'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="text-purple-100 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Form: body scrolls, footer stays put */}
        <form onSubmit={handleGenerate} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Generate an optimized schedule using AI recommendations. The system will automatically
                assign faculty, rooms, and time slots based on qualifications, availability, and workload.
              </p>

              <div className="grid grid-cols-1 gap-4">
                {/* Section Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Section *
                  </label>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    required
                    disabled={generating || loadingSections}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">-- Select a Section --</option>
                    {availableSections.map(section => (
                      <option key={section._id} value={section._id}>
                        {section.sectionCode} ({section.program} - Year {section.yearLevel} - {section.shift}) - {section.currentStudents || 0}/{section.maxStudents} students
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {loadingSections ? 'Loading sections...' : `${availableSections.length} section${availableSections.length !== 1 ? 's' : ''} available`}
                  </p>
                </div>


              </div>

              {/* Advanced Options */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <Wand2 size={18} className="mr-2 text-purple-600" />
                  Advanced Options
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* AI Recommendations Toggle */}
                  <div className="md:col-span-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Sparkles size={20} className="text-purple-600 mr-2" />
                        <div>
                          <h5 className="text-sm font-semibold text-purple-900">
                            AI-Powered Faculty Recommendations
                          </h5>
                          <p className="text-xs text-purple-700 mt-1">
                            Uses RAG to match faculty expertise with subjects (Gemini 2.5 Flash)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAIToggle}
                        disabled={generating}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 ${
                          formData.useAIRecommendations ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.useAIRecommendations ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Generation Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Generation Method
                    </label>
                    <select
                      name="method"
                      value={formData.method}
                      onChange={handleChange}
                      disabled={generating}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="greedy">Greedy Algorithm (Fast)</option>
                      <option value="ortools" disabled={!ortoolsStatus?.available}>
                        Google OR-Tools (Optimal) {!ortoolsStatus?.available && '- Not Available'}
                      </option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.method === 'greedy' ? (
                        'Fast algorithm, good results for most cases'
                      ) : (
                        'Advanced constraint solver, finds optimal solutions'
                      )}
                    </p>
                  </div>

                  {/* Time Limit (OR-Tools only) */}
                  {isORTools && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Optimization time limit
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {[15, 30, 60, 120].map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, timeLimit: preset }))}
                            disabled={generating}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                              formData.timeLimit === preset
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-purple-400'
                            }`}
                          >
                            {preset}s
                          </button>
                        ))}
                        <input
                          type="number"
                          name="timeLimit"
                          value={formData.timeLimit}
                          onChange={handleChange}
                          disabled={generating}
                          min="10"
                          max="300"
                          aria-label="Optimization time limit in seconds"
                          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        The solver searches for up to this long, so generating will take
                        about {formData.timeLimit}s. Longer budgets can find better timetables.
                      </p>
                    </div>
                  )}
                </div>

                {/* OR-Tools Status */}
                {ortoolsStatus && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    ortoolsStatus.available 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <p className="text-sm flex items-center">
                      {ortoolsStatus.available ? (
                        <>
                          <CheckCircle size={16} className="text-green-600 mr-2" />
                          <span className="text-green-800">
                            Google OR-Tools is available and ready
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} className="text-yellow-600 mr-2" />
                          <span className="text-yellow-800">
                            Google OR-Tools is not installed. Install with: pip install ortools
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Results */}
            {previewData && previewData.success && previewData.preview && (
              <div className="mb-6">
                {/* Preview Header */}
                <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-purple-900">
                          Schedule Preview - {previewData.sectionInfo?.sectionCode}
                        </h4>
                        {previewData.aiUsed && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-900">
                            <Sparkles size={12} className="mr-1" />
                            AI-Powered
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-purple-700">
                        {stats.scheduledSubjects ?? 0} of {stats.totalSubjects ?? 0} subjects scheduled
                      </p>
                      {previewData.methodNote && (
                        <p className="text-xs text-purple-600 mt-1 italic">
                          {previewData.methodNote}
                        </p>
                      )}
                    </div>
                    <CheckCircle className="text-purple-600" size={24} />
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-600 font-medium">Scheduled</p>
                    <p className="text-2xl font-bold text-green-700">
                      {stats.scheduledSubjects ?? 0}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 font-medium">Not placed</p>
                    <p className="text-2xl font-bold text-red-700">
                      {stats.failedSubjects ?? 0}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-600 font-medium">Conflicts</p>
                    <p className="text-2xl font-bold text-orange-700">
                      {stats.conflictsDetected ?? 0}
                    </p>
                  </div>
                </div>

                {/* Solver detail. Worth showing: it explains what the optimizer
                    actually balanced, and whether it ran out of time. */}
                {stats.solverTime !== undefined && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <dt className="text-gray-500">Solve time</dt>
                        <dd className="font-semibold text-gray-900">{stats.solverTime}s</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Busiest teacher</dt>
                        <dd className="font-semibold text-gray-900">
                          {stats.busiestFacultyUnits || 0} units
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Matched on experience</dt>
                        <dd className="font-semibold text-gray-900">
                          {stats.assignmentsWithExperience || 0}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Existing classes avoided</dt>
                        <dd className="font-semibold text-gray-900">
                          {stats.existingBlocksRespected || 0}
                        </dd>
                      </div>
                    </dl>
                    {stats.hitTimeLimit && (
                      <p className="text-xs text-gray-600 mt-2">
                        The solver used its full {formData.timeLimit}s budget, so this is a good
                        timetable rather than a proven-best one. Raise the time limit to search further.
                      </p>
                    )}
                  </div>
                )}

                {/* Solver notes, e.g. room capacity relaxed */}
                {previewData.diagnostics?.length > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-900 mb-1.5">Worth knowing</p>
                    <ul className="space-y-1">
                      {previewData.diagnostics.map((d, i) => (
                        <li key={i} className="text-xs text-amber-800 flex gap-2">
                          <span className="text-amber-500 flex-shrink-0">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Subjects left alone because they already have a schedule */}
                {previewData.skipped?.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      Already scheduled, left untouched ({previewData.skipped.length})
                    </p>
                    <p className="text-xs text-blue-800">
                      {previewData.skipped.map(s => s.subject_code || s.subjectCode).join(', ')}
                    </p>
                  </div>
                )}

                {/* Scheduled Subjects */}
                {previewData.preview.schedules && previewData.preview.schedules.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">
                      ✓ Scheduled Subjects ({previewData.preview.schedules.length})
                    </h5>
                    <div className="space-y-2">
                      {previewData.preview.schedules.map((schedule, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-300 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900">
                                  {schedule.metadata.subjectCode}
                                </span>
                                {/* Guarded: the OR-Tools path did not send units,
                                    which rendered a bare " units" badge */}
                                {schedule.metadata.units != null && (
                                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                    {schedule.metadata.units} units
                                  </span>
                                )}
                                {schedule.metadata.facultyExperience > 0 && (
                                  <span
                                    className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded inline-flex items-center gap-1"
                                    title="Assigned to a teacher who has taught this subject before"
                                  >
                                    <Sparkles size={10} />
                                    experienced
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mb-1">
                                {schedule.metadata.subjectName}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Faculty:</span>
                              <span className="ml-1 text-gray-900 font-medium">
                                {schedule.metadata.facultyName}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Room:</span>
                              <span className="ml-1 text-gray-900 font-medium">
                                {schedule.metadata.roomName || schedule.metadata.roomNumber || 'TBA'}
                                {schedule.metadata.roomCapacity
                                  ? ` (cap. ${schedule.metadata.roomCapacity})`
                                  : ''}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {schedule.timeSlots.map((slot, slotIdx) => (
                              <span key={slotIdx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                {slot.day} {slot.startTime}-{slot.endTime}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed Subjects */}
                {previewData.preview.failed && previewData.preview.failed.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-red-700 mb-2">
                      ✗ Failed Subjects ({previewData.preview.failed.length})
                    </h5>
                    <div className="space-y-2">
                      {previewData.preview.failed.map((fail, idx) => (
                        <div key={idx} className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-center justify-between">
                            <div>
                              {/* Greedy reports `subject`, the solver `subjectCode` */}
                              <span className="font-semibold text-red-900">
                                {fail.subjectCode || fail.subject}
                              </span>
                              {fail.subjectName && (
                                <span className="text-sm text-red-700 ml-2">- {fail.subjectName}</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-red-600 mt-1">{fail.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {previewData.preview.conflicts && previewData.preview.conflicts.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-orange-700 mb-2">
                      ⚠ Conflicts Detected ({previewData.preview.conflicts.length})
                    </h5>
                    <div className="space-y-2">
                      {previewData.preview.conflicts.map((conflict, idx) => (
                        <div key={idx} className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-orange-900">{conflict.subject}</span>
                              {conflict.subjectName && (
                                <span className="text-sm text-orange-700 ml-2">- {conflict.subjectName}</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-orange-600 mt-1">{conflict.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Failed Generation. The solver explains WHY (section already full,
                no lab room, load caps), so surface that instead of a bare
                "Failed to generate preview". */}
            {previewData && !previewData.success && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={22} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-red-800 mb-1">
                      Could not generate a schedule
                    </h4>
                    <p className="text-sm text-red-700 break-words">{previewData.message}</p>

                    {previewData.hint && (
                      <p className="text-sm text-red-600 mt-2">{previewData.hint}</p>
                    )}

                    {previewData.blockers?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {previewData.blockers.map((b, i) => (
                          <li key={i} className="text-xs text-red-700 flex gap-2">
                            <span className="text-red-400 flex-shrink-0">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      type="button"
                      onClick={() => setPreviewData(null)}
                      className="mt-3 text-xs font-medium text-red-800 underline hover:no-underline"
                    >
                      Change the settings and try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {generating && (
              <div className="mb-6 p-6 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex flex-col items-center justify-center">
                  <Loader className="animate-spin text-purple-600" size={40} />
                  <p className="mt-4 text-sm font-medium text-purple-900">
                    {isORTools ? 'Solving the timetable' : 'Building the schedule'}
                    {elapsed > 0 && ` · ${elapsed}s`}
                  </p>
                  {isORTools ? (
                    <>
                      <div className="w-full max-w-xs h-1.5 bg-purple-200 rounded-full mt-3 overflow-hidden">
                        <div
                          className="h-full bg-purple-600 transition-all duration-1000"
                          style={{
                            width: `${Math.min(100, (elapsed / Math.max(1, formData.timeLimit)) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-purple-700 mt-2">
                        The solver uses up to {formData.timeLimit}s to search for the best timetable.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-purple-700 mt-1">This usually takes a moment.</p>
                  )}
                </div>
              </div>
            )}

            {/* AI Info Box */}
            {!generating && !previewData && (
              <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center">
                  <Sparkles size={16} className="mr-2" />
                  How AI Generation Works
                </h4>
                <ul className="text-xs text-purple-800 space-y-1">
                  {formData.useAIRecommendations && (
                    <>
                      <li>• <strong>RAG-Powered Matching:</strong> Analyzes faculty teaching history and subject expertise</li>
                      <li>• <strong>Experience Scoring:</strong> Prioritizes faculty with most years teaching specific subjects</li>
                      <li>• <strong>Smart Recommendations:</strong> Shows match percentages based on qualifications and experience</li>
                    </>
                  )}
                  <li>• Balances teaching workload across faculty members</li>
                  <li>• Assigns appropriate rooms based on subject type and capacity</li>
                  <li>• Optimizes time slots to avoid conflicts</li>
                  <li>• Considers faculty availability and preferences</li>
                  <li>• Ensures curriculum requirements are met</li>
                  <li className="text-purple-900 font-medium mt-2">• <strong>Preview First:</strong> Review and approve before saving to database</li>
                </ul>
              </div>
            )}

          </div>

          {/* Actions: pinned so they stay reachable however long the preview is */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={generating || saving}
              className="px-4 py-2 border border-gray-300 bg-white rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {previewData?.success && previewData.preview ? 'Cancel' : 'Close'}
            </button>

            {/* Generate, and re-generate once a preview exists */}
            {(!previewData || (previewData.success && !previewData.preview?.schedules?.length)) && (
              <button
                type="submit"
                disabled={generating || !formData.section}
                className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader className="animate-spin mr-2" size={18} />
                    Solving{elapsed > 0 ? ` ${elapsed}s` : ''}...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} className="mr-2" />
                    Generate Preview
                  </>
                )}
              </button>
            )}

            {previewData?.success && previewData.preview?.schedules?.length > 0 && (
              <>
                <button
                  type="submit"
                  disabled={generating || saving}
                  className="flex items-center justify-center px-4 py-2 border border-purple-300 text-purple-700 bg-white rounded-lg hover:bg-purple-50 disabled:opacity-50 transition-colors"
                >
                  {generating ? (
                    <>
                      <Loader className="animate-spin mr-2" size={18} />
                      Solving{elapsed > 0 ? ` ${elapsed}s` : ''}...
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} className="mr-2" />
                      Regenerate
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedules}
                  disabled={saving || generating}
                  className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader className="animate-spin mr-2" size={18} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} className="mr-2" />
                      Save {previewData.preview.schedules.length} class
                      {previewData.preview.schedules.length !== 1 ? 'es' : ''}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default GenerateScheduleModal;
