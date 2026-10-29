import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ModalShell, ModalButton, useModalTitleId } from './modal/ModalShell';

const TONES = {
  danger: { tile: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300', button: 'danger', ring: 'focus:ring-red-500/30 focus:border-red-500' },
  warning: { tile: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', button: 'primary', ring: 'focus:ring-amber-500/30 focus:border-amber-500' },
};

/**
 * Confirmation that requires typing a word (for irreversible bulk actions).
 * Escape / focus / stacking come from ModalShell.
 */
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
  const titleId = useModalTitleId();
  const tone = TONES[type] || TONES.danger;

  useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  // Surrounding spaces from a paste shouldn't block the match
  const isMatching = inputValue.trim() === confirmationText;
  // "Doesn't match" waits until they've typed enough to be wrong, instead of
  // appearing from the first keystroke
  const showMismatch = !isMatching && inputValue.trim().length >= confirmationText.length;

  const handleConfirm = () => {
    if (!isMatching) return;
    onConfirm();
    onClose();
  };

  return (
    <ModalShell onClose={onClose} size="sm" labelledBy={titleId} guardDirty={false}>
      <div className="px-6 pb-6 pt-6">
        <div className="text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${tone.tile}`}>
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <div className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{message}</div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
        </div>

        <div className="mt-5">
          <label htmlFor={`${titleId}-input`} className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">
            Type <code className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-900 dark:bg-gray-700 dark:text-white">{confirmationText}</code> to confirm
          </label>
          <input
            id={`${titleId}-input`}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className={`w-full rounded-lg border-2 px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white ${tone.ring} ${
              isMatching ? 'border-emerald-500' : showMismatch ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          <div className="mt-1.5 h-5 text-xs" aria-live="polite">
            {isMatching && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Confirmed</span>
            )}
            {showMismatch && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5" /> Doesn't match - check the spelling and capitals</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <ModalButton variant="secondary" onClick={onClose} className="sm:flex-1">{cancelButtonText}</ModalButton>
          <ModalButton variant={tone.button} onClick={handleConfirm} disabled={!isMatching} className="sm:flex-1">
            {confirmButtonText}
          </ModalButton>
        </div>
      </div>
    </ModalShell>
  );
};

export default TypeToConfirmDialog;
