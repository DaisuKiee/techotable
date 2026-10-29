import { useState } from 'react';
import { Sun, Moon, CheckCircle } from 'lucide-react';
import { authAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';

const ShiftSelectionModal = ({ user, onShiftSelected }) => {
  const [selectedShift, setSelectedShift] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedShift) {
      toast.error('Please select a shift');
      return;
    }

    setSaving(true);
    try {
      const response = await authAPI.updateProfile({ shift: selectedShift });
      
      // Update localStorage and call parent callback
      const updatedUser = response.data.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      toast.success(`${selectedShift} shift selected successfully!`);
      
      // Update parent component
      if (onShiftSelected) {
        await onShiftSelected(updatedUser);
      }
    } catch (error) {
      console.error('Shift selection error:', error);
      toast.error(getErrorMessage(error, 'Failed to save shift selection'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-opacity-95 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 md:p-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
            <Sun className="text-white" size={40} />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome, {user?.firstName}!
          </h2>
          <p className="text-gray-600 text-lg">
            Please select your class shift to continue
          </p>
        </div>

        {/* Shift Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Day Shift */}
          <button
            onClick={() => setSelectedShift('Day')}
            className={`relative p-8 rounded-2xl border-4 transition-all duration-300 transform hover:scale-102 ${
              selectedShift === 'Day'
                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-2xl scale-102'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-xl'
            }`}
          >
            {selectedShift === 'Day' && (
              <div className="absolute top-4 right-4">
                <CheckCircle className="text-blue-600" size={32} fill="currentColor" />
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-5 transition-all duration-300 ${
                selectedShift === 'Day' 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg' 
                  : 'bg-gradient-to-br from-gray-200 to-gray-300'
              }`}>
                <Sun 
                  className={selectedShift === 'Day' ? 'text-white' : 'text-gray-600'} 
                  size={48} 
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Day Shift</h3>
              <p className="text-gray-600 text-center mb-3 text-sm">
                Morning and afternoon classes
              </p>
              <p className="text-blue-600 font-bold text-xl mb-4">
                7:00 AM - 4:00 PM
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <p className="flex items-center justify-center">
                  <span className="text-green-600 mr-2">✓</span> Regular daytime schedule
                </p>
                <p className="flex items-center justify-center">
                  <span className="text-green-600 mr-2">✓</span> More course options
                </p>
                <p className="flex items-center justify-center">
                  <span className="text-green-600 mr-2">✓</span> Active campus life
                </p>
              </div>
            </div>
          </button>

          {/* Night Shift */}
          <button
            onClick={() => setSelectedShift('Night')}
            className={`relative p-8 rounded-2xl border-4 transition-all duration-300 transform hover:scale-102 ${
              selectedShift === 'Night'
                ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100 shadow-2xl scale-102'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-xl'
            }`}
          >
            {selectedShift === 'Night' && (
              <div className="absolute top-4 right-4">
                <CheckCircle className="text-indigo-600" size={32} fill="currentColor" />
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-5 transition-all duration-300 ${
                selectedShift === 'Night' 
                  ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg' 
                  : 'bg-gradient-to-br from-gray-200 to-gray-300'
              }`}>
                <Moon 
                  className={selectedShift === 'Night' ? 'text-white' : 'text-gray-600'} 
                  size={48} 
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Night Shift</h3>
              <p className="text-gray-600 text-center mb-3 text-sm">
                Evening classes for working students
              </p>
              <p className="text-indigo-600 font-bold text-xl mb-4">
                4:00 PM - 10:00 PM
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <p className="flex items-center justify-center">
                  <span className="text-green-600 mr-2">✓</span> Work during the day
                </p>
                <p className="flex items-center justify-center">
                  <span className="text-green-600 mr-2">✓</span> Evening schedule
                </p>
                <p className="flex items-center justify-center">
                  <span className="text-green-600 mr-2">✓</span> Flexible learning
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Info Message */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-900 text-center">
            <span className="font-semibold">💡 Note:</span> You can change your shift later from your profile settings if needed.
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!selectedShift || saving}
          className={`w-full py-5 rounded-xl font-bold text-lg transition-all duration-300 ${
            selectedShift && !saving
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-2xl transform hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
              Saving...
            </div>
          ) : (
            `Continue with ${selectedShift || '...'} Shift`
          )}
        </button>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Your shift selection helps us show you the most relevant class schedules
        </p>
      </div>
    </div>
  );
};

export default ShiftSelectionModal;
