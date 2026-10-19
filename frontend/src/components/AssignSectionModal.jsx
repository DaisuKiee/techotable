import React, { useState } from 'react';
import { X, Users, BookOpen } from 'lucide-react';
import { studentAPI } from '../services/api';
import toast from 'react-hot-toast';
import { usePrograms } from '../hooks/usePrograms';
import AnimatedCheckIcon from './AnimatedCheckIcon';

const AssignSectionModal = ({ student, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    program: student.program || '',
    yearLevel: '',
    sectionLetter: '',
    studentType: student.studentType || 'regular'
  });
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  const { programCodes: programs } = usePrograms();
  const yearLevels = [1, 2, 3, 4];
  const sectionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  const generateSectionCode = () => {
    const { program, yearLevel, sectionLetter } = formData;
    
    if (!program || !yearLevel || !sectionLetter) {
      toast.error('Please fill all fields to generate section code');
      return;
    }
    
    const code = `${program}-${yearLevel}${sectionLetter}`;
    setGeneratedCode(code);
    toast.success(`Generated section code: ${code}`);
  };

  const handleAssign = async () => {
    if (!generatedCode) {
      toast.error('Please generate a section code first');
      return;
    }

    try {
      setLoading(true);
      await studentAPI.assignSectionCode(student._id, {
        sectionCode: generatedCode,
        studentType: formData.studentType
      });
      
      toast.success('Section code assigned successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Assign section error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign section code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Assign Section Code</h2>
              <p className="text-blue-100 text-sm">
                {student.user?.firstName} {student.user?.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Student Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Student ID:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{student.studentId}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Current Program:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{student.program}</span>
            </div>
            {student.sectionCode && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Current Section:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{student.sectionCode}</span>
              </div>
            )}
          </div>

          {/* Student Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Student Type
            </label>
            <select
              value={formData.studentType}
              onChange={(e) => setFormData({ ...formData, studentType: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="regular">Regular</option>
              <option value="irregular">Irregular</option>
            </select>
          </div>

          {/* Program */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Program
            </label>
            <select
              value={formData.program}
              onChange={(e) => {
                setFormData({ ...formData, program: e.target.value });
                setGeneratedCode('');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Program</option>
              {programs.map(prog => (
                <option key={prog} value={prog}>{prog}</option>
              ))}
            </select>
          </div>

          {/* Year Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Year Level
            </label>
            <select
              value={formData.yearLevel}
              onChange={(e) => {
                setFormData({ ...formData, yearLevel: e.target.value });
                setGeneratedCode('');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Year Level</option>
              {yearLevels.map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>

          {/* Section Letter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Section Letter
            </label>
            <select
              value={formData.sectionLetter}
              onChange={(e) => {
                setFormData({ ...formData, sectionLetter: e.target.value });
                setGeneratedCode('');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select Section</option>
              {sectionLetters.map(letter => (
                <option key={letter} value={letter}>Section {letter}</option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateSectionCode}
            type="button"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Generate Section Code
          </button>

          {/* Generated Code Display */}
          {generatedCode && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AnimatedCheckIcon className="w-6 h-6" color="#16a34a" />
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                    Generated Section Code:
                  </p>
                  <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">
                    {generatedCode}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={loading || !generatedCode}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <AnimatedCheckIcon className="w-5 h-5" color="currentColor" />
                Assign Section
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignSectionModal;
