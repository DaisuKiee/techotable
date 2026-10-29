import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalShell, ModalButton, useModalTitleId } from './modal/ModalShell';

const TONES = {
  danger: { tile: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300', button: 'danger' },
  warning: { tile: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', button: 'primary' },
};

/**
 * Yes/no confirmation.
 *
 *  - Focus starts on Cancel, so a stray Enter can't confirm a destructive action
 *  - If onConfirm returns a promise, the dialog stays open with a spinner until
 *    it settles. It used to close instantly, so a slow or failing delete gave
 *    no feedback until a toast appeared over an empty page.
 *  - Escape, focus trap and stacking come from ModalShell.
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' or 'warning'
  itemName = '', // Name of the item being deleted
  // Shown under the message. Pass null for reversible actions - it used to be
  // hard-coded, so "deactivate (you can reactivate later)" also said
  // "This action cannot be undone."
  footnote = 'This action cannot be undone.'
}) => {
  const [busy, setBusy] = useState(false);
  const titleId = useModalTitleId();
  const tone = TONES[type] || TONES.danger;

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      const result = onConfirm?.();
      if (result && typeof result.then === 'function') {
        setBusy(true);
        await result;
      }
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <ModalShell onClose={onClose} size="sm" labelledBy={titleId} busy={busy} guardDirty={false} focusFirstField={false}>
      <div className="px-6 pb-6 pt-6 text-center">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${tone.tile}`}>
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{message}</div>
        {itemName && (
          <p className="mt-4 break-words rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 dark:bg-gray-700 dark:text-white">
            {itemName}
          </p>
        )}
        {footnote && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{footnote}</p>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <ModalButton variant="secondary" onClick={onClose} disabled={busy} className="sm:flex-1" data-autofocus>
            {cancelText}
          </ModalButton>
          <ModalButton variant={tone.button} onClick={handleConfirm} loading={busy} className="sm:flex-1">
            {confirmText}
          </ModalButton>
        </div>
      </div>
    </ModalShell>
  );
};

export default ConfirmDialog;
