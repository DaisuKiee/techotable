import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, ArrowDown, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI, getErrorMessage } from '../services/api';
import TermsContent from './TermsContent';
import TERMS from '../content/terms';

// Pages a signed-in user can still open without accepting (to read the terms)
const OPEN_PATHS = ['/terms'];

/**
 * After login, anyone who hasn't accepted the current Terms of Use and Privacy
 * Notice sees this before anything else. Acceptance (version + time) is stored
 * on their account by the server. A new version asks everyone again.
 */
const TermsGate = () => {
  const { user, isAuthenticated, loadUser, logout } = useAuth();
  const location = useLocation();
  const [agreed, setAgreed] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const agreeRef = useRef(null);

  const needsAcceptance = isAuthenticated
    && user?.termsCurrentVersion
    && user.termsAcceptedVersion !== user.termsCurrentVersion
    && !OPEN_PATHS.includes(location.pathname);
  const isUpdate = !!user?.termsAcceptedVersion;

  // Lock the page behind it
  useEffect(() => {
    if (!needsAcceptance) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [needsAcceptance]);

  // Short text on a tall screen never scrolls; count that as read
  useEffect(() => {
    const el = scrollRef.current;
    if (needsAcceptance && el && el.scrollHeight <= el.clientHeight + 8) setReadToEnd(true);
  }, [needsAcceptance]);

  if (!needsAcceptance) return null;

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadToEnd(true);
  };

  const accept = async () => {
    setSaving(true);
    setError('');
    try {
      await authAPI.acceptTerms(TERMS.version);
      await loadUser();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your answer. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100500] flex items-end justify-center bg-gray-950/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <div className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-800 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700 sm:px-6">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="terms-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {isUpdate ? 'We updated our terms' : 'Before you continue'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isUpdate
                ? 'Please review the updated Terms of Use and Privacy Notice.'
                : `Hi ${user?.firstName || 'there'}, please read and accept the Terms of Use and Privacy Notice to use the system.`}
            </p>
          </div>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto px-5 py-5 sm:px-6" tabIndex={0} aria-label="Terms of Use and Privacy Notice">
          <TermsContent />
        </div>

        <div className="space-y-3 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/40 sm:px-6">
          {!readToEnd && (
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
            >
              <ArrowDown className="h-3.5 w-3.5" /> Scroll to the end to continue
            </button>
          )}
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
          <label className={`flex items-start gap-3 text-sm ${readToEnd ? 'cursor-pointer text-gray-800 dark:text-gray-200' : 'cursor-not-allowed text-gray-400 dark:text-gray-500'}`}>
            <input
              ref={agreeRef}
              type="checkbox"
              checked={agreed}
              disabled={!readToEnd}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <span>
              I have read and agree to the Terms of Use, and I consent to the processing of my personal information as described in the Privacy Notice.
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={!agreed || saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} I agree and continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsGate;
