import React, { useState } from 'react';
import { studentAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiX, FiUpload, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import AnimatedCheckIcon from './AnimatedCheckIcon';

const BulkImportModal = ({ onClose, onComplete }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await studentAPI.bulkImport(formData);
      setResults(response.data.data);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (results?.success?.length > 0) {
      onComplete();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Bulk Import Students</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <FiAlertCircle className="w-5 h-5" />
              Instructions
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
              <li>Download the CSV template by clicking "CSV Template" on the Student Management page</li>
              <li>Fill in the student data following the template format</li>
              <li>Required columns: studentId, email, firstName, lastName, program</li>
              <li>Default password is "student123" if not specified</li>
              <li>Upload the completed CSV file below</li>
            </ul>
          </div>

          {/* File Upload */}
          {!results && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiUpload className="w-4 h-4" />
                  {loading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              {file && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 mb-1">
                    <AnimatedCheckIcon className="w-5 h-5" color="#16a34a" />
                    <span className="font-semibold">Successful</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{results.success.length}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800 mb-1">
                    <FiXCircle className="w-5 h-5" />
                    <span className="font-semibold">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-900">{results.failed.length}</p>
                </div>
              </div>

              {/* Success List */}
              {results.success.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <AnimatedCheckIcon className="w-5 h-5" color="#16a34a" />
                    Successfully Imported Students
                  </h3>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Student ID</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {results.success.map((item) => (
                          <tr key={item.row} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{item.row}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.studentId}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Failed List */}
              {results.failed.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <FiXCircle className="w-5 h-5 text-red-600" />
                    Failed Imports
                  </h3>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Student ID</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {results.failed.map((item) => (
                          <tr key={item.row} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{item.row}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.studentId}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{item.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          {results ? (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;
