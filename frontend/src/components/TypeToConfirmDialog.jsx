import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, AlertCircle } from 'lucide-react';

const TypeToConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmationText = '', // The text user must type
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  type = 'danger', // 'danger' or 'warning'
  placeholder = 'Type to confirm'
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setIsMatching(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setIsMatching(inputValue === confirmationText);
  }, [inputValue, confirmationText]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isMatching) {
      onConfirm();
      onClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && isMatching) {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const typeColors = {
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/50',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300 dark:disabled:bg-red-900',
      inputFocus: 'focus:ring-red-500 focus:border-red-500'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      icon: 'text-yellow-600 dark:text-yellow-400',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/50',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 disabled:bg-yellow-300 dark:disabled:bg-yellow-900',
      inputFocus: 'focus:ring-yellow-500 focus:border-yellow-500'
    }
  };

  const colors = typeColors[type] || typeColors.danger;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity z-[9999]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[10000] overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full transform transition-all pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <div className="p-6">
              {/* Icon */}
              <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${colors.iconBg} mb-4`}>
                <AlertTriangle className={`h-8 w-8 ${colors.icon}`} />
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {title}
                </h3>
                <div className="text-gray-600 dark:text-gray-300 mb-4">
                  {message}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  This action cannot be undone.
                </p>
              </div>

              {/* Type to confirm section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Type <span className="font-bold text-gray-900 dark:text-white">"{confirmationText}"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={placeholder}
                  autoFocus
                  className={`w-full px-4 py-3 border-2 ${
                    inputValue && !isMatching 
                      ? 'border-red-300 dark:border-red-600' 
                      : isMatching 
                        ? 'border-green-500 dark:border-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                  } rounded-lg ${colors.inputFocus} transition-all dark:bg-gray-700 dark:text-white`}
                />
                
                {/* Validation feedback */}
                {inputValue && !isMatching && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>Text doesn't match. Please try again.</span>
                  </div>
                )}
                
                {isMatching && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Confirmed! You can proceed.</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold"
                >
                  {cancelButtonText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!isMatching}
                  className={`flex-1 px-4 py-2.5 ${colors.button} text-white rounded-lg transition-all font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {confirmButtonText}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TypeToConfirmDialog;
