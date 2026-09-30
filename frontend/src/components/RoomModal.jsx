import { useState, useEffect } from 'react';
import { roomAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, DoorOpen, Users, Monitor, Building, Clock } from 'lucide-react';
import BaseModal from './BaseModal';

const ROOM_TYPES = ['Lecture Room', 'Laboratory', 'Computer Lab', 'Workshop', 'Auditorium', 'Conference Room'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const RoomModal = ({ mode, room, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    roomNumber: '',
    roomName: '',
    building: '',
    capacity: 30,
    type: 'Lecture Room',
    equipment: [{ name: '', quantity: 1, condition: 'Good' }],
    unavailableSlots: [],
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
    if (mode === 'edit' && room) {
      // Ensure equipment is in object format
      let equipmentData = [{ name: '', quantity: 1, condition: 'Good' }];
      if (room.equipment && room.equipment.length > 0) {
        equipmentData = room.equipment.map(eq => {
          // Handle both string and object formats
          if (typeof eq === 'string') {
            return { name: eq, quantity: 1, condition: 'Good' };
          }
          return {
            name: eq.name || '',
            quantity: eq.quantity || 1,
            condition: eq.condition || 'Good'
          };
        });
      }

      setFormData({
        roomNumber: room.roomNumber || '',
        roomName: room.roomName || '',
        building: room.building || '',
        capacity: room.capacity || 30,
        type: room.type || 'Lecture Room',
        equipment: equipmentData,
        unavailableSlots: room.unavailableSlots || [],
        isActive: room.isActive !== false
      });
    }
  }, [mode, room]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleEquipmentChange = (index, field, value) => {
    const newEquipment = [...formData.equipment];
    newEquipment[index][field] = field === 'quantity' ? parseInt(value) || 1 : value;
    setFormData({
      ...formData,
      equipment: newEquipment
    });
  };

  const addEquipment = () => {
    setFormData({
      ...formData,
      equipment: [...formData.equipment, { name: '', quantity: 1, condition: 'Good' }]
    });
  };

  const removeEquipment = (index) => {
    const newEquipment = formData.equipment.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      equipment: newEquipment.length > 0 ? newEquipment : [{ name: '', quantity: 1, condition: 'Good' }]
    });
  };

  const addUnavailableSlot = () => {
    setFormData({
      ...formData,
      unavailableSlots: [
        ...formData.unavailableSlots,
        { day: 'Monday', startTime: '08:00', endTime: '09:00', reason: '' }
      ]
    });
  };

  const updateUnavailableSlot = (index, field, value) => {
    const newSlots = [...formData.unavailableSlots];
    newSlots[index][field] = value;
    setFormData({
      ...formData,
      unavailableSlots: newSlots
    });
  };

  const removeUnavailableSlot = (index) => {
    setFormData({
      ...formData,
      unavailableSlots: formData.unavailableSlots.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        capacity: parseInt(formData.capacity),
        equipment: formData.equipment.filter(eq => eq.name.trim() !== '')
      };

      if (mode === 'create') {
        await roomAPI.create(submitData);
        toast.success('Room created successfully');
      } else {
        await roomAPI.update(room._id, submitData);
        toast.success('Room updated successfully');
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

  return (
    <BaseModal
      isOpen={true}
      onClose={() => onClose(false)}
      title={mode === 'create' ? 'Add New Room' : 'Edit Room'}
      subtitle={mode === 'create' ? 'Create a new room or facility' : 'Update room information'}
      icon={DoorOpen}
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
            form="room-form"
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
                <DoorOpen className="w-5 h-5" />
                <span>{mode === 'create' ? 'Create Room' : 'Update Room'}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="bg-gray-50 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="p-6" id="room-form">
            {/* Room Preview Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-4 mb-6 shadow-lg">
              <div className="text-sm font-medium opacity-90 mb-1">Room Preview</div>
              <div className="text-2xl font-bold">
                {formData.roomNumber || 'Room Number'} {formData.roomName ? `- ${formData.roomName}` : ''}
              </div>
              <div className="text-sm opacity-90 mt-1">
                {formData.building || 'Building'} • {formData.type} • Capacity: {formData.capacity}
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Basic Information
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">* Required</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Room Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Room Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="roomNumber"
                    value={formData.roomNumber}
                    onChange={handleChange}
                    required
                    placeholder="e.g., R101, LAB-A"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>

                {/* Room Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    name="roomName"
                    value={formData.roomName}
                    onChange={handleChange}
                    placeholder="e.g., Programming Lab"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>

                {/* Building */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Building <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="building"
                    value={formData.building}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Main Building, ICT Building"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Capacity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    required
                    min="1"
                    max="500"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                  />
                </div>

                {/* Room Type */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Room Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ROOM_TYPES.map(type => (
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

            {/* Equipment & Facilities */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 border-2 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Equipment & Facilities
              </h3>
              <div className="space-y-3">
                {formData.equipment.map((equipment, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <input
                      type="text"
                      value={equipment.name}
                      onChange={(e) => handleEquipmentChange(index, 'name', e.target.value)}
                      placeholder="Equipment name (e.g., Projector)"
                      className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                    />
                    <input
                      type="number"
                      value={equipment.quantity}
                      onChange={(e) => handleEquipmentChange(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      min="1"
                      className="w-20 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                    />
                    <select
                      value={equipment.condition}
                      onChange={(e) => handleEquipmentChange(index, 'condition', e.target.value)}
                      className="w-32 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm transition-all"
                    >
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Broken">Broken</option>
                    </select>
                    {formData.equipment.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEquipment(index)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEquipment}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Equipment
                </button>
              </div>
            </div>

            {/* Unavailable Time Slots */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Unavailable Time Slots
              </h3>
              {formData.unavailableSlots.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 italic">No unavailable slots configured</p>
              ) : (
                <div className="space-y-3 mb-3">
                  {formData.unavailableSlots.map((slot, index) => (
                    <div key={index} className="border-2 border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                        <select
                          value={slot.day}
                          onChange={(e) => updateUnavailableSlot(index, 'day', e.target.value)}
                          className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                        >
                          {DAYS.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateUnavailableSlot(index, 'startTime', e.target.value)}
                          className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                        />
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateUnavailableSlot(index, 'endTime', e.target.value)}
                          className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => removeUnavailableSlot(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={slot.reason || ''}
                        onChange={(e) => updateUnavailableSlot(index, 'reason', e.target.value)}
                        placeholder="Reason (optional)"
                        className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                      />
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addUnavailableSlot}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Unavailable Slot
              </button>
            </div>
          </form>
        </div>
      </BaseModal>
  );
};

export default RoomModal;
