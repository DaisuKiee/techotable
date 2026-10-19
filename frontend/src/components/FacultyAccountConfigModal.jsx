import React, { useState, useEffect } from 'react';
import { X, Settings, Clock, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const FacultyAccountConfigModal = ({ isOpen, onClose, onSave }) => {
  const [linkExpirationHours, setLinkExpirationHours] = useState(48);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load existing configuration from localStorage
    const savedConfig = localStorage.getItem('facultyAccountConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setLinkExpirationHours(config.linkExpirationHours || 48);
      } catch (error) {
        console.error('Error loading config:', error);
      }
    }
  }, [isOpen]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validate configuration
      if (linkExpirationHours < 1 || linkExpirationHours > 720) {
        toast.error('Link expiration must be between 1 and 720 hours (30 days)');
        return;
      }

      const config = { linkExpirationHours };

      // Save configuration to localStorage
      localStorage.setItem('facultyAccountConfig', JSON.stringify(config));

      // Call parent save handler if provided
      if (onSave) {
        await onSave(config);
      }

      toast.success('Link expiration saved successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLinkExpirationHours(48);
    toast.success('Reset to default (48 hours)');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Faculty Account Configuration</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Configure settings for faculty account creation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-6">
            {/* Link Expiration Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Registration Link Expiration
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Link Expiration Time (Hours)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={linkExpirationHours}
                      onChange={(e) => setLinkExpirationHours(parseInt(e.target.value) || 48)}
                      className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {linkExpirationHours}h
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        ≈ {Math.round(linkExpirationHours / 24 * 10) / 10} days
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    How long the registration link remains valid before it expires (1-720 hours / 30 days max)
                  </p>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: '24 Hours', hours: 24 },
                      { label: '48 Hours', hours: 48 },
                      { label: '7 Days', hours: 168 },
                      { label: '30 Days', hours: 720 }
                    ].map((preset) => (
                      <button
                        key={preset.hours}
                        onClick={() => setLinkExpirationHours(preset.hours)}
                        className={`px-3 py-2 rounded-lg font-medium transition-all ${
                          linkExpirationHours === preset.hours
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 border border-gray-300 dark:border-gray-600">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Faculty can register using the signup link until it expires</li>
                    <li>After registration, accounts are pending and require approval</li>
                    <li>Managers can approve or reject accounts from the Approval page</li>
                    <li>Link expiration is calculated from the current time</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Expiration Setting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyAccountConfigModal;
