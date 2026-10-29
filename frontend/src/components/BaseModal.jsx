import React from 'react';
import { ModalShell, ModalHeader, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';

/**
 * BaseModal - the standard form modal (header, scrolling body, action footer).
 *
 * Behaviour (Escape, focus, scroll lock, stacking, phone sheet, "discard
 * changes?") comes from ModalShell, shared with every other modal. The props
 * are unchanged, so existing callers keep working.
 *
 * Fixes over the previous version:
 *  - it sat pinned to the top of the screen (items-start, pt-1) instead of
 *    centred, and capped its height at 100vh-8rem, wasting a third of a laptop
 *    screen
 *  - focus went to the close button, so typing did nothing until you clicked
 *    into the first field; it now lands in the first field
 *  - Escape and backdrop clicks still closed it while a save was in progress
 *  - closing a modal opened from another modal re-enabled page scroll under
 *    the one still open
 *  - Ctrl/Cmd+Enter now submits
 */

const HEADER_TONES = { navy: 'blue', yellow: 'amber', custom: 'blue' };
// Callers also pass "large"/"medium"/"small", which the old size table didn't
// know - those modals had no max width at all and spanned the whole screen.
const SIZE_MAP = {
  sm: 'sm', small: 'sm', md: 'md', medium: 'md', lg: 'lg', large: 'lg',
  xl: 'xl', '2xl': '2xl', full: 'full',
};

const BaseModal = ({
  // Display props
  isOpen = true,
  title,
  subtitle,
  icon,
  size = 'lg', // 'sm', 'md', 'lg', 'xl', '2xl', 'full'
  tone, // icon tile colour: blue | indigo | purple | emerald | amber | red

  // Content
  children,

  // Footer actions
  onClose,
  onSubmit,
  submitText = 'Save',
  submitIcon,
  cancelText = 'Cancel',
  showFooter = true,
  footerContent, // Custom footer content
  footerInfo, // Small text on the left of the footer

  // State
  loading = false,
  submitDisabled = false,

  // Behavior
  closeOnEscape = true,
  closeOnBackdrop = true,
  preventClose = false, // For critical flows

  // Style
  headerColor = 'navy', // kept for compatibility; picks the icon tile colour

  // Form
  formId,

  // Accessibility
  ariaLabel,
}) => {
  const titleId = useModalTitleId();
  const blocked = loading || preventClose;

  const submit = () => {
    if (loading || submitDisabled) return;
    if (formId) document.getElementById(formId)?.requestSubmit();
    else onSubmit?.();
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={closeOnEscape || closeOnBackdrop ? onClose : undefined}
      size={SIZE_MAP[size] || 'lg'}
      labelledBy={title ? titleId : undefined}
      label={ariaLabel}
      busy={blocked || !closeOnEscape}
      closeOnBackdrop={closeOnBackdrop}
    >
      <ModalHeader
        id={titleId}
        icon={icon}
        tone={tone || HEADER_TONES[headerColor] || 'blue'}
        title={title}
        subtitle={subtitle}
        onClose={preventClose ? undefined : onClose}
        closeDisabled={loading}
      />

      {/* Body - scrolls; Ctrl/Cmd+Enter submits from anywhere inside */}
      <div
        className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60 dark:bg-gray-900/40"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && showFooter && !footerContent) {
            e.preventDefault();
            submit();
          }
        }}
      >
        {children}
      </div>

      {showFooter && (
        footerContent ? (
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50/80 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40 sm:px-6">
            {footerContent}
          </div>
        ) : (
          <ModalFooter
            info={footerInfo || <span className="hidden sm:inline">Ctrl + Enter to {String(submitText).toLowerCase()}</span>}
          >
            <ModalButton variant="secondary" onClick={onClose} disabled={blocked}>
              {cancelText}
            </ModalButton>
            <ModalButton
              type={formId ? 'submit' : 'button'}
              form={formId}
              onClick={formId ? undefined : onSubmit}
              loading={loading}
              loadingText="Saving…"
              disabled={submitDisabled}
              icon={submitIcon}
            >
              {submitText}
            </ModalButton>
          </ModalFooter>
        )
      )}
    </ModalShell>
  );
};

export default BaseModal;
