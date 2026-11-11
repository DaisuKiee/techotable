import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * App-wide confirmation modal, used instead of the browser's window.confirm.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Discard 3 cards?', message: '…', confirmText: 'Discard' }))) return;
 *
 * Resolves true when confirmed, false when cancelled or dismissed (Esc,
 * backdrop). Options are passed straight to ConfirmDialog: title, message,
 * confirmText, cancelText, type ('danger' | 'warning'), itemName, footnote.
 */
const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    // A second request while one is open cancels the first
    if (resolver.current) resolver.current(false);
    resolver.current = resolve;
    setOptions(opts);
  }), []);

  const settle = (answer) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOptions(null);
    if (resolve) resolve(answer);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        isOpen={!!options}
        type="warning"
        footnote={null}
        {...(options || {})}
        onConfirm={() => settle(true)}
        // ConfirmDialog calls onClose after onConfirm too; settle() only answers once
        onClose={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  // Outside the provider (tests, isolated renders) fall back to the browser
  return confirm || ((opts = {}) => Promise.resolve(window.confirm(opts.message || opts.title || 'Are you sure?')));
};

export default ConfirmContext;
