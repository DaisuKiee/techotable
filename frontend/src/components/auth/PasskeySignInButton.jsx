import React, { useEffect, useState } from 'react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Fingerprint, Loader2 } from 'lucide-react';
import { authAPI } from '../../services/api';

/**
 * Sign in with a passkey and no password at all.
 *
 * The browser decides which credential to offer, so nothing is typed - not
 * even an e-mail address. Because the signature is bound to this origin, a
 * convincing copy of this page cannot obtain anything it can reuse, which is
 * the one attack a careful person with a strong password still loses to.
 *
 * Hidden entirely on browsers without WebAuthn rather than shown broken.
 */
export default function PasskeySignInButton({ onSignedIn, onError }) {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  if (!supported) return null;

  const signIn = async () => {
    setBusy(true);
    try {
      const { data: start } = await authAPI.passkeyLoginOptions();
      const response = await startAuthentication({ optionsJSON: start.data.options });
      const { data } = await authAPI.passkeyLogin({
        sessionKey: start.data.sessionKey,
        response,
      });
      onSignedIn(data.data);
    } catch (err) {
      // Closing the system prompt is a normal thing to do, not an error
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        setBusy(false);
        return;
      }
      onError(
        err.response?.data?.message
        || 'No passkey could be used on this device. Sign in with your password instead.',
      );
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">or</span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
        {busy ? 'Waiting for your device…' : 'Sign in with fingerprint or face'}
      </button>
    </div>
  );
}
