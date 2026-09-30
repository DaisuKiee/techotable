import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' or 'warning'
  itemName = '' // Name of the item being deleted
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const typeColors = {
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/50',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      icon: 'text-yellow-600 dark:text-yellow-400',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/50',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    }
  };

  const colors = typeColors[type] || typeColors.danger;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity z-[60]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[70] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
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
                  {itemName && (
                    <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                        {itemName}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  This action cannot be undone.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`flex-1 px-4 py-2.5 ${colors.button} text-white rounded-lg transition-all font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;
