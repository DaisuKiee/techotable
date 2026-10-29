import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * One shell for every modal in the app.
 *
 * Twenty-odd modals each rolled their own overlay, and most of them were
 * missing the basics: Escape didn't close them, the page scrolled behind
 * them, focus stayed on the button underneath (so Tab walked the page), and
 * their z-index ranged from z-40 to z-[100001], so which one ended up on top
 * depended on the page. The shell gives all of them the same behaviour:
 *
 *  - Escape closes the TOPMOST modal only (stacked modals close one by one)
 *  - backdrop click closes, but not when a text selection merely ends there
 *  - focus moves to the first field, Tab is trapped inside, and focus goes
 *    back to the opener on close
 *  - page scroll is locked while any modal is open (counted, so closing one
 *    of two stacked modals doesn't unlock it)
 *  - bottom sheet on phones, centred dialog from sm: up
 *  - accidental dismissals (Escape / backdrop) of a form you've typed in ask
 *    "Discard changes?" first
 *  - `busy` blocks closing while a save is in flight
 */

const stack = [];
let lockCount = 0;
let savedOverflow = '';

const lockScroll = () => {
  if (lockCount++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
};
const unlockScroll = () => {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = savedOverflow;
  }
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD = 'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([readonly]), select:not([disabled]), textarea:not([disabled])';
const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
  '2xl': 'sm:max-w-6xl',
  full: 'sm:max-w-[min(96vw,1400px)]',
};

// Above every page-level overlay in the app (the schedule builder sits at
// z-[100000]) and below the toaster (999999).
const BASE_Z = 100100;

export const ModalShell = ({
  open = true,
  onClose,
  children,
  size = 'lg',
  labelledBy,
  label,
  busy = false,
  guardDirty = true,
  closeOnBackdrop = true,
  focusFirstField = true,
  panelClassName = '',
  variant = 'dialog', // 'dialog' (centred; sheet on phones) | 'drawer' (full-height, from the right)
}) => {
  const drawer = variant === 'drawer';
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const dirtyRef = useRef(false);
  const downOnBackdrop = useRef(false);
  const tokenRef = useRef({});
  const [depth, setDepth] = useState(0);
  const [askDiscard, setAskDiscard] = useState(false);

  // Accidental dismissals go through the dirty check; explicit buttons inside
  // the modal call onClose directly.
  const requestClose = useCallback(() => {
    if (busy) return;
    if (guardDirty && dirtyRef.current) {
      setAskDiscard(true);
      return;
    }
    onClose?.();
  }, [busy, guardDirty, onClose]);

  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  const askDiscardRef = useRef(askDiscard);
  askDiscardRef.current = askDiscard;

  useEffect(() => {
    if (!open) return undefined;
    const token = tokenRef.current;
    openerRef.current = document.activeElement;
    stack.push(token);
    setDepth(stack.length - 1);
    lockScroll();

    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return; // only the top modal
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (askDiscardRef.current) setAskDiscard(false);
        else requestCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(visible);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (!panelRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);

    // Any typing inside marks the form dirty
    const panel = panelRef.current;
    const markDirty = (e) => {
      if (e.target?.closest?.('[data-modal-ignore-dirty]')) return;
      dirtyRef.current = true;
    };
    panel?.addEventListener('input', markDirty);

    // Focus the first field (or the first control) once content has painted
    const raf = requestAnimationFrame(() => {
      if (!panelRef.current || panelRef.current.contains(document.activeElement)) return;
      const auto = panelRef.current.querySelector('[autofocus], [data-autofocus]');
      const field = focusFirstField && [...panelRef.current.querySelectorAll(FIELD)].find(visible);
      const any = [...panelRef.current.querySelectorAll(FOCUSABLE)].find(visible);
      (auto || field || any || panelRef.current).focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      panel?.removeEventListener('input', markDirty);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      dirtyRef.current = false;
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, focusFirstField]);

  if (!open) return null;

  return createPortal(
    <div
      className={drawer ? 'fixed inset-0 flex justify-end' : 'fixed inset-0 flex items-end justify-center sm:items-center sm:p-4'}
      style={{ zIndex: BASE_Z + depth * 10 }}
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (closeOnBackdrop && downOnBackdrop.current && e.target === e.currentTarget) requestClose();
        downOnBackdrop.current = false;
      }}
    >
      <style>{`
        @keyframes ms-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ms-up   { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes ms-pop  { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes ms-in-right { from { transform: translateX(100%); } to { transform: none; } }
        .ms-backdrop { animation: ms-fade .18s ease-out both; }
        .ms-drawer   { animation: ms-in-right .3s cubic-bezier(.22, 1, .36, 1) both; }
        .ms-panel    { animation: ms-up .26s cubic-bezier(.22, 1, .36, 1) both; }
        @media (min-width: 640px) { .ms-panel { animation-name: ms-pop; } }
        @media (prefers-reduced-motion: reduce) { .ms-backdrop, .ms-panel, .ms-drawer { animation: none; } }
      `}</style>

      <div className="ms-backdrop pointer-events-none absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        className={drawer
          ? `ms-drawer relative flex h-full w-full flex-col overflow-hidden bg-white text-left shadow-2xl outline-none dark:bg-gray-800 ${SIZES[size] || SIZES.lg} ${panelClassName}`
          : `ms-panel relative flex w-full max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-white text-left shadow-2xl ring-1 ring-black/5 outline-none dark:bg-gray-800 dark:ring-white/10 sm:max-h-[88vh] sm:rounded-2xl ${SIZES[size] || SIZES.lg} ${panelClassName}`}
      >
        {/* Grab handle: signals "sheet" on phones */}
        {!drawer && (
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        {children}

        {askDiscard && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 p-6 backdrop-blur-sm dark:bg-gray-900/70" role="alertdialog" aria-label="Discard changes?">
            <div className="ms-panel w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <p className="text-base font-semibold text-gray-900 dark:text-white">Discard your changes?</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">What you've entered in this form will be lost.</p>
              <div className="mt-4 flex justify-end gap-2">
                <ModalButton variant="secondary" onClick={() => setAskDiscard(false)} data-autofocus>
                  Keep editing
                </ModalButton>
                <ModalButton variant="danger" onClick={() => { setAskDiscard(false); onClose?.(); }}>
                  Discard
                </ModalButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const TONES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

/** Title row: tinted icon tile, title, optional subtitle, close button. */
export const ModalHeader = ({ id, icon: Icon, tone = 'blue', title, subtitle, onClose, closeDisabled, children }) => (
  <div className="flex flex-shrink-0 items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700 sm:px-6">
    {Icon && (
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONES[tone] || TONES.blue}`}>
        <Icon className="h-5 w-5" />
      </span>
    )}
    <div className="min-w-0 flex-1 pt-0.5">
      <h2 id={id} className="truncate text-lg font-semibold leading-tight text-gray-900 dark:text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      {children}
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        disabled={closeDisabled}
        aria-label="Close"
        className="-mr-1.5 -mt-0.5 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <X className="h-5 w-5" />
      </button>
    )}
  </div>
);

/** Scrollable content area. */
export const ModalBody = ({ children, className = '' }) => (
  <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${className}`}>{children}</div>
);

/** Action row: optional info on the left, buttons on the right (stacked full-width on phones). */
export const ModalFooter = ({ children, info }) => (
  <div className="flex flex-shrink-0 flex-col-reverse gap-2 border-t border-gray-200 bg-gray-50/80 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40 sm:flex-row sm:items-center sm:justify-end sm:px-6">
    {info && <div className="mr-auto text-xs text-gray-500 dark:text-gray-400 sm:pr-4">{info}</div>}
    {children}
  </div>
);

const BUTTON_TONES = {
  primary: 'bg-blue-700 text-white shadow-sm hover:bg-blue-800 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-500',
};

/** Footer button with a busy state. */
export const ModalButton = ({ variant = 'primary', loading = false, loadingText, icon: Icon, children, className = '', type = 'button', disabled, ...props }) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${BUTTON_TONES[variant]} ${className}`}
    {...props}
  >
    {loading ? (
      <>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {loadingText || children}
      </>
    ) : (
      <>
        {Icon && <Icon className="h-4 w-4" />}
        {children}
      </>
    )}
  </button>
);

/** Stable id for ModalHeader <-> ModalShell aria-labelledby. */
export const useModalTitleId = () => `modal-title-${useId().replace(/:/g, '')}`;

export default ModalShell;
