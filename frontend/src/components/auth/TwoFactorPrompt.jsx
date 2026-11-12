import React, { useEffect, useMemo, useRef, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
import {
  Fingerprint, Smartphone, Mail, KeyRound, ArrowLeft, Loader2, ShieldCheck,
} from 'lucide-react';
import { authAPI } from '../../services/api';

/**
 * The second step of signing in, after the password was accepted.
 *
 * The server has already said which methods this account can use, so only
 * those are offered. A passkey is tried first where one exists: it is both
 * the safest and the fastest, and it needs no typing.
 */

const METHOD_META = {
  passkey: {
    icon: Fingerprint,
    label: 'Use fingerprint or face',
    hint: 'Verify with this device',
  },
  totp: {
    icon: Smartphone,
    label: 'Authenticator app',
    hint: 'The 6-digit code from your app',
  },
  email: {
    icon: Mail,
    label: 'Email me a code',
    hint: 'A 6-digit code to your inbox',
  },
  recovery: {
    icon: KeyRound,
    label: 'Use a recovery code',
    hint: 'One of the codes you saved',
  },
};

/** Pick the strongest method the account actually has. */
const preferredMethod = (methods) => ['passkey', 'totp', 'email', 'recovery']
  .find((m) => methods[m]) || 'totp';

export default function TwoFactorPrompt({ challenge, onVerified, onCancel }) {
  const { challengeToken, methods, emailHint } = challenge;

  const [method, setMethod] = useState(() => preferredMethod(methods));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const available = useMemo(
    () => Object.keys(METHOD_META).filter((m) => methods[m]),
    [methods],
  );

  const isRecovery = method === 'recovery';

  useEffect(() => {
    setCode('');
    setError(null);
    if (method !== 'passkey') inputRef.current?.focus();
  }, [method]);

  const fail = (message) => {
    setError(message);
    setCode('');
    inputRef.current?.focus();
  };

  const submitCode = async (value) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await authAPI.twoFactorVerify({ challengeToken, method, code: value });
      onVerified(data.data);
    } catch (err) {
      fail(err.response?.data?.message || 'That code could not be verified.');
    } finally {
      setBusy(false);
    }
  };

  /** Six digits is unambiguous, so submit as soon as the last one lands. */
  const onCodeChange = (raw) => {
    const cleaned = isRecovery
      ? raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 14)
      : raw.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    if (!isRecovery && cleaned.length === 6) submitCode(cleaned);
  };

  const usePasskey = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data: optionsResponse } = await authAPI.twoFactorPasskeyOptions(challengeToken);
      const response = await startAuthentication({ optionsJSON: optionsResponse.data });
      const { data } = await authAPI.twoFactorPasskeyVerify({ challengeToken, response });
      onVerified(data.data);
    } catch (err) {
      // The browser throws this when the person closes the prompt themselves
      const cancelled = err?.name === 'NotAllowedError' || err?.name === 'AbortError';
      setError(cancelled
        ? 'That was cancelled. Try again, or choose another method below.'
        : err.response?.data?.message || err.message || 'Your device could not be verified.');
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    setSending(true);
    setError(null);
    try {
      const { data } = await authAPI.twoFactorSendCode(challengeToken);
      setEmailSent(true);
      toast.success(data.message || 'Code sent.');
      inputRef.current?.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'We could not send the code.');
    } finally {
      setSending(false);
    }
  };

  // Asking for the code the moment email is chosen saves a pointless click
  useEffect(() => {
    if (method === 'email' && !emailSent) sendEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const Icon = METHOD_META[method].icon;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            One more step
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your password was correct. Confirm it is you.
          </p>
        </div>
      </div>

      {method === 'passkey' ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={usePasskey}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
            {busy ? 'Waiting for your device…' : 'Verify with this device'}
          </button>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Your fingerprint or face never leaves your device.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="twofa-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {isRecovery ? 'Recovery code' : 'Verification code'}
            </span>
          </label>

          {method === 'email' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {sending
                ? 'Sending a code…'
                : emailSent
                ? `We sent a code to ${emailHint}. It expires in 10 minutes.`
                : `We will send a code to ${emailHint}.`}
            </p>
          )}

          <input
            id="twofa-code"
            ref={inputRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && code) submitCode(code); }}
            inputMode={isRecovery ? 'text' : 'numeric'}
            autoComplete={isRecovery ? 'off' : 'one-time-code'}
            placeholder={isRecovery ? 'xxxx-xxxx-xxxx' : '000000'}
            disabled={busy}
            className={`w-full rounded-lg border px-4 py-3 text-center font-mono text-gray-900 dark:bg-gray-800 dark:text-white ${
              isRecovery ? 'text-lg tracking-widest' : 'text-2xl tracking-[0.5em]'
            } ${error
              ? 'border-red-400 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600'}`}
          />

          <div className="flex items-center justify-between gap-3">
            {method === 'email' ? (
              <button
                type="button"
                onClick={sendEmail}
                disabled={sending}
                className="text-sm text-blue-600 hover:underline disabled:opacity-60 dark:text-blue-400"
              >
                {sending ? 'Sending…' : 'Send another code'}
              </button>
            ) : <span />}

            <button
              type="button"
              onClick={() => submitCode(code)}
              disabled={busy || code.length < (isRecovery ? 12 : 6)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Verify'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {available.length > 1 && (
        <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Another way
          </p>
          <div className="grid gap-2">
            {available.filter((m) => m !== method).map((m) => {
              const { icon: AltIcon, label, hint } = METHOD_META[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <AltIcon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span>
                    <span className="block text-gray-800 dark:text-gray-200">{label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </button>
    </div>
  );
}
