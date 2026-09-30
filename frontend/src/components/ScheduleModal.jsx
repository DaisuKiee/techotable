import { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { scheduleAPI, facultyAPI, subjectAPI, roomAPI } from '../services/api';
import toast from 'react-hot-toast';
import { 
  Calendar, Plus, Trash2, Check, BookOpen, 
  Users, DoorOpen, GraduationCap, Clock 
} from 'lucide-react';
import { usePrograms } from '../hooks/usePrograms';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ScheduleModal = ({ mode, schedule, subjects: propSubjects, sections: propSections, faculty: propFaculty, rooms: propRooms, onClose, onDelete }) => {
  const { programCodes: PROGRAMS } = usePrograms();
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [formData, setFormData] = useState({
    subject: '',
    faculty: '',
    room: '',
    program: 'BSIT',
    yearLevel: 1,
    section: 'A',
    shift: 'Day',
    academicYear: '2024-2025',
    semester: 1,
    timeSlots: [{ day: 'Monday', startTime: '08:00', endTime: '09:00', type: 'Lecture' }],
    maxStudents: 40,
    isPublished: false,
    isActive: true
  });

  useEffect(() => {
    // Use props data if available, otherwise load from API
    if (propSubjects && propFaculty && propRooms) {
      setSubjects(propSubjects);
      setFaculty(propFaculty);
      setRooms(propRooms);
    } else {
      loadData();
    }
    
    if (mode === 'edit' && schedule) {
      setFormData({
        subject: schedule.subject?._id || '',
        faculty: schedule.faculty?._id || '',
        room: schedule.room?._id || '',
        program: schedule.program || 'BSIT',
        yearLevel: schedule.yearLevel || 1,
        section: schedule.section || 'A',
        shift: schedule.shift || 'Day',
        academicYear: schedule.academicYear || '2024-2025',
        semester: schedule.semester || 1,
        timeSlots: schedule.timeSlots && schedule.timeSlots.length > 0 
          ? schedule.timeSlots 
          : [{ day: 'Monday', startTime: '08:00', endTime: '09:00', type: 'Lecture' }],
        maxStudents: schedule.maxStudents || 40,
        isPublished: schedule.isPublished || false,
        isActive: schedule.isActive !== false
      });
    }
  }, [mode, schedule, propSubjects, propFaculty, propRooms]);

  const loadData = async () => {
    try {
      const [subjectsRes, facultyRes, roomsRes] = await Promise.all([
        subjectAPI.getAll(),
        facultyAPI.getAll(),
        roomAPI.getAll()
      ]);
      setSubjects(subjectsRes.data.data || []);
      setFaculty(facultyRes.data.data || []);
      setRooms(roomsRes.data.data || []);
    } catch (error) {
      console.error('Load data error:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const addTimeSlot = () => {
    setFormData({
      ...formData,
      timeSlots: [...formData.timeSlots, { day: 'Monday', startTime: '08:00', endTime: '09:00', type: 'Lecture' }]
    });
  };

  const updateTimeSlot = (index, field, value) => {
    const newSlots = [...formData.timeSlots];
    newSlots[index][field] = value;
    setFormData({
      ...formData,
      timeSlots: newSlots
    });
  };

  const removeTimeSlot = (index) => {
    if (formData.timeSlots.length > 1) {
      setFormData({
        ...formData,
        timeSlots: formData.timeSlots.filter((_, i) => i !== index)
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        yearLevel: parseInt(formData.yearLevel),
        semester: parseInt(formData.semester),
        maxStudents: parseInt(formData.maxStudents)
      };

      if (mode === 'create') {
        await scheduleAPI.create(submitData);
        toast.success('Schedule created successfully');
      } else {
        await scheduleAPI.update(schedule._id, submitData);
        toast.success('Schedule updated successfully');
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

  const handleDelete = async () => {
    if (mode === 'edit' && schedule) {
      const confirmed = window.confirm('Are you sure you want to delete this schedule?');
      if (!confirmed) return;
      await onDelete(schedule._id);
      onClose(true);
    }
  };

  const footerContent = (
    <div className="flex gap-3">
      {mode === 'edit' && (
        <button
          type="button"
          onClick={handleDelete}
          className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold"
        >
          Delete
        </button>
      )}
      <div className="flex gap-3 ml-auto w-full">
        <button
          type="button"
          onClick={() => onClose(false)}
          className="flex-1 px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="schedule-form"
          disabled={loading}
          className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {loading ? (
            'Saving...'
          ) : (
            <>
              <Check className="w-5 h-5" />
              {mode === 'create' ? 'Create Schedule' : 'Update Schedule'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={() => onClose(false)}
      title={mode === 'create' ? 'Add Schedule Entry' : 'Edit Schedule Entry'}
      subtitle={mode === 'create' ? 'Create a new schedule for the timetable' : 'Update schedule information'}
      icon={Calendar}
      size="xl"
      formId="schedule-form"
      footerContent={footerContent}
    >
      <form onSubmit={handleSubmit} id="schedule-form" className="space-y-6">
        {/* Basic Assignment Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Assignment Details
          </h3>
          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <select
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              >
                <option value="">Select subject...</option>
                {subjects.map(subj => (
                  <option key={subj._id} value={subj._id}>
                    {subj.subjectCode} - {subj.subjectName} ({subj.program})
                  </option>
                ))}
              </select>
            </div>

            {/* Faculty */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Faculty <span className="text-red-500">*</span>
              </label>
              <select
                name="faculty"
                value={formData.faculty}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              >
                <option value="">Select faculty...</option>
                {faculty.map(fac => (
                  <option key={fac._id} value={fac._id}>
                    {fac.user?.firstName} {fac.user?.lastName} - {fac.employeeId}
                  </option>
                ))}
              </select>
            </div>

            {/* Room */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Room <span className="text-red-500">*</span>
              </label>
              <select
                name="room"
                value={formData.room}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              >
                <option value="">Select room...</option>
                {rooms.map(room => (
                  <option key={room._id} value={room._id}>
                    {room.roomCode || room.roomNumber} — {room.roomName || room.building} (Cap: {room.capacity})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Section Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                {[1, 2, 3, 4].map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Section <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="section"
                value={formData.section}
                onChange={handleChange}
                required
                placeholder="e.g., A, B, C"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>

            {/* Shift */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Shift/Schedule <span className="text-red-500">*</span>
              </label>
              <select
                name="shift"
                value={formData.shift}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              >
                <option value="Day">Day Schedule (7:00 AM - 4:00 PM)</option>
                <option value="Night">Night Schedule (4:00 PM - 10:00 PM)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Academic Period */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Academic Period
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Semester */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Semester <span className="text-red-500">*</span>
              </label>
              <select
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Academic Year <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="academicYear"
                value={formData.academicYear}
                onChange={handleChange}
                required
                placeholder="e.g., 2024-2025"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>

            {/* Max Students */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Max Students <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="maxStudents"
                value={formData.maxStudents}
                onChange={handleChange}
                required
                min="1"
                max="200"
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* Time Slots Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Time Slots
          </h3>
          <div className="space-y-3">
            {formData.timeSlots.map((slot, index) => (
              <div key={index} className="border-2 border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Day
                    </label>
                    <select
                      value={slot.day}
                      onChange={(e) => updateTimeSlot(index, 'day', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      {DAYS.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateTimeSlot(index, 'startTime', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateTimeSlot(index, 'endTime', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Type
                    </label>
                    <select
                      value={slot.type}
                      onChange={(e) => updateTimeSlot(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="Lecture">Lecture</option>
                      <option value="Laboratory">Laboratory</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(index)}
                      disabled={formData.timeSlots.length === 1}
                      className="w-full px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-all font-semibold text-sm flex items-center justify-center gap-1"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addTimeSlot}
            className="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-semibold transition-all"
          >
            <Plus size={18} />
            Add Time Slot
          </button>
        </div>

        {/* Settings Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Schedule Settings
          </h3>
          <div className="space-y-3">
            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                name="isPublished"
                checked={formData.isPublished}
                onChange={handleChange}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-2 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                Published <span className="text-gray-500 font-normal">(visible to students)</span>
              </span>
            </label>
            <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-2 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                Active <span className="text-gray-500 font-normal">(schedule is currently in use)</span>
              </span>
            </label>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="text-red-500">*</span> Required fields
        </p>
      </form>
    </BaseModal>
  );
};

export default ScheduleModal;
