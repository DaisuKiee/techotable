import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * BaseModal - Consistent Modal Component following CTU Daanbantayan Design System
 * 
 * Design Standards:
 * - Navy blue (#1e40af) and yellow (#fbbf24) brand colors
 * - Consistent spacing: 16px/24px system
 * - Sticky header and footer
 * - Scrollable body only
 * - Accessibility: Esc to close, focus trap, ARIA attributes
 * - Responsive: Full-screen on mobile, centered on desktop
 */

const BaseModal = ({
  // Display props
  isOpen = true,
  title,
  subtitle,
  icon: Icon,
  size = 'lg', // 'sm', 'md', 'lg', 'xl', '2xl', 'full'
  
  // Content
  children,
  
  // Footer actions
  onClose,
  onSubmit,
  submitText = 'Save',
  submitIcon: SubmitIcon,
  cancelText = 'Cancel',
  showFooter = true,
  footerContent, // Custom footer content
  
  // State
  loading = false,
  submitDisabled = false,
  
  // Behavior
  closeOnEscape = true,
  closeOnBackdrop = true,
  preventClose = false, // For critical flows
  
  // Style
  headerColor = 'navy', // 'navy', 'yellow', 'custom'
  customHeaderClass,
  
  // Form
  formId,
  
  // Accessibility
  ariaLabel,
  ariaDescribedBy,
}) => {
  const modalRef = useRef(null);
  const firstFocusRef = useRef(null);
  const lastFocusRef = useRef(null);
  const triggerRef = useRef(null);

  // Size classes
  const sizeClasses = {
    sm: 'w-full max-w-md',
    md: 'w-full max-w-2xl',
    lg: 'w-full max-w-4xl',
    xl: 'w-full max-w-5xl',
    '2xl': 'w-full max-w-6xl',
    full: 'w-full max-w-full'
  };

  // Header color classes (Brand: Navy Blue & Yellow)
  const headerColorClasses = {
    navy: 'bg-gradient-to-r from-blue-900 to-blue-800 text-white',
    yellow: 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-900',
    custom: customHeaderClass || 'bg-gradient-to-r from-blue-900 to-blue-800 text-white'
  };

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store trigger element
      triggerRef.current = document.activeElement;
      
      // Simply prevent body scroll - don't use position fixed which breaks viewport positioning
      // The modal overlay is fixed to viewport, so it will always appear in view
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore body scroll
        document.body.style.overflow = '';

        // Return focus to trigger
        if (triggerRef.current && triggerRef.current.focus) {
          triggerRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape || preventClose) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, preventClose, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Get all focusable elements
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const focusableArray = Array.from(focusableElements);
    firstFocusRef.current = focusableArray[0];
    lastFocusRef.current = focusableArray[focusableArray.length - 1];

    // Focus first element
    if (firstFocusRef.current) {
      firstFocusRef.current.focus();
    }

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusRef.current) {
          e.preventDefault();
          lastFocusRef.current?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusRef.current) {
          e.preventDefault();
          firstFocusRef.current?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }, [isOpen, children]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdrop && !preventClose) {
      onClose?.();
    }
  };

  // Handle close button click
  const handleClose = () => {
    if (!preventClose) {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-1 pb-4 px-2 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      aria-describedby={ariaDescribedBy}
    >
      {/* Modal Container */}
      <div
        ref={modalRef}
        className={`
          ${sizeClasses[size]}
          mx-4
          mt-1 mb-1
          bg-white dark:bg-gray-800
          rounded-2xl
          shadow-2xl
          flex flex-col
          max-h-[calc(100vh-8rem)]
          animate-slideUp
          overflow-hidden
        `}
      >
        {/* Header - Sticky */}
        <div className={`
          ${headerColorClasses[headerColor]}
          px-6 py-5
          flex items-center justify-between
          flex-shrink-0
          shadow-lg
          rounded-t-2xl
        `}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {Icon && (
              <div className="flex-shrink-0">
                <Icon className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm opacity-90 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {!preventClose && (
            <button
              type="button"
              onClick={handleClose}
              className="flex-shrink-0 ml-4 p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </div>

        {/* Footer - Sticky */}
        {showFooter && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-b-2xl">
            {footerContent || (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading || preventClose}
                  className="flex-1 px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  {cancelText}
                </button>
                <button
                  type={formId ? 'submit' : 'button'}
                  form={formId}
                  onClick={!formId ? onSubmit : undefined}
                  disabled={loading || submitDisabled}
                  className="flex-1 px-5 py-2.5 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      {SubmitIcon && <SubmitIcon className="w-5 h-5" />}
                      {submitText}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;
