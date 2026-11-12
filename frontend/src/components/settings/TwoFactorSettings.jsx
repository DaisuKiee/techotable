import React, { useCallback, useEffect, useState } from 'react';
import {
  startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
import {
  Fingerprint, Smartphone, Mail, KeyRound, ShieldCheck, ShieldAlert, Trash2,
  Plus, Copy, Check, Loader2, Download, AlertTriangle,
} from 'lucide-react';
import { authAPI } from '../../services/api';

/**
 * Managing your own second factors.
 *
 * Ordered by how much protection each one actually gives: passkeys first,
 * then an authenticator app, then emailed codes last - an emailed code is
 * only as strong as the mailbox it lands in, and saying so is more useful
 * than listing them as equals.
 */

/* ------------------------------------------------------------- recovery */

/**
 * Recovery codes are shown exactly once. Making that obvious - and making it
 * easy to save them - is the difference between a working safety net and a
 * support ticket in three months.
 */
function RecoveryCodes({ codes, onDone }) {
  const [copied, setCopied] = useState(false);

  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      toast.error('Could not copy. Select the codes and copy them manually.');
    }
  };

  const download = () => {
    const blob = new Blob(
      [`CTU Daanbantayan Timetabling - recovery codes\nGenerated ${new Date().toLocaleString()}\n\n${text}\n\nEach code works once. Keep this somewhere only you can reach.\n`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ctu-timetable-recovery-codes.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h4 className="font-semibold text-amber-900 dark:text-amber-200">
            Save these now - they will not be shown again
          </h4>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Each code works once. They are how you get back in if you lose your phone.
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-white p-3 font-mono text-sm dark:bg-gray-900 sm:grid-cols-2">
        {codes.map((code) => (
          <span key={code} className="text-gray-800 dark:text-gray-200">{code}</span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={download} className="flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40">
          <Download className="h-4 w-4" />
          Download
        </button>
        <button type="button" onClick={onDone} className="ml-auto rounded-lg px-3 py-1.5 text-sm text-amber-800 underline dark:text-amber-200">
          I have saved them
        </button>
      </div>
    </div>
  );
}

/** Re-type the password before anything that weakens the account. */
function PasswordConfirm({ title, action, onConfirm, onCancel, danger }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onConfirm(password);
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
      <p className="text-sm text-gray-700 dark:text-gray-300">{title}</p>
      <input
        type="password"
        value={password}
        autoComplete="current-password"
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Your password"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !password}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {busy ? 'Working…' : action}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- the panel */

export default function TwoFactorSettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [confirming, setConfirming] = useState(null); // { kind, id }
  const [busy, setBusy] = useState(null);
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [webauthnReady, setWebauthnReady] = useState(false);
  const [platformAuth, setPlatformAuth] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await authAPI.twoFactorStatus();
      setStatus(data.data);
    } catch (_) {
      toast.error('Could not load your security settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setWebauthnReady(browserSupportsWebAuthn());
    platformAuthenticatorIsAvailable().then(setPlatformAuth).catch(() => setPlatformAuth(false));
  }, []);

  const apply = (data) => {
    if (data?.status) setStatus(data.status);
    if (data?.recoveryCodes) setRecoveryCodes(data.recoveryCodes);
  };

  const fail = (err, fallback) => toast.error(err.response?.data?.message || fallback);

  /* ---------------------------------------------------------- passkeys */

  const addPasskey = async () => {
    setBusy('passkey');
    try {
      const { data: options } = await authAPI.passkeyRegisterOptions();
      const response = await startRegistration({ optionsJSON: options.data });
      const { data } = await authAPI.passkeyRegister({ response });
      apply(data.data);
      toast.success(data.message);
    } catch (err) {
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
        fail(err, 'That device could not be registered.');
      }
    } finally {
      setBusy(null);
    }
  };

  const removePasskey = async (id, password) => {
    try {
      const { data } = await authAPI.deletePasskey(id, password);
      apply(data.data);
      setConfirming(null);
      toast.success(data.message);
    } catch (err) {
      fail(err, 'Could not remove that passkey.');
    }
  };

  /* -------------------------------------------------------------- TOTP */

  const beginTotp = async () => {
    setBusy('totp');
    try {
      const { data } = await authAPI.totpSetup();
      setTotpSetup(data.data);
    } catch (err) {
      fail(err, 'Could not start setup.');
    } finally {
      setBusy(null);
    }
  };

  const confirmTotp = async () => {
    setBusy('totp-confirm');
    try {
      const { data } = await authAPI.totpEnable(totpCode);
      apply(data.data);
      setTotpSetup(null);
      setTotpCode('');
      toast.success(data.message);
    } catch (err) {
      fail(err, 'That code was not accepted.');
    } finally {
      setBusy(null);
    }
  };

  const removeTotp = async (password) => {
    try {
      const { data } = await authAPI.totpDisable(password);
      apply(data.data);
      setConfirming(null);
      toast.success(data.message);
    } catch (err) {
      fail(err, 'Could not remove the authenticator app.');
    }
  };

  /* ------------------------------------------------------------- email */

  const toggleEmail = async (enable) => {
    setBusy('email');
    try {
      const { data } = enable
        ? await authAPI.emailFactorEnable()
        : await authAPI.emailFactorDisable();
      apply(data.data);
      toast.success(data.message);
    } catch (err) {
      fail(err, 'Could not change email codes.');
    } finally {
      setBusy(null);
    }
  };

  const newRecoveryCodes = async (password) => {
    try {
      const { data } = await authAPI.regenerateRecoveryCodes(password);
      setRecoveryCodes(data.data.recoveryCodes);
      setConfirming(null);
      await load();
      toast.success(data.message);
    } catch (err) {
      fail(err, 'Could not generate new codes.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your security settings…
      </div>
    );
  }
  if (!status) return null;

  const { methods, enrolled, required, graceDaysLeft, mustEnrolNow } = status;

  return (
    <div className="space-y-5">
      {/* Where this account stands */}
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${
        enrolled
          ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
          : mustEnrolNow
          ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
          : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'}`}
      >
        {enrolled
          ? <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
          : <ShieldAlert className={`mt-0.5 h-5 w-5 flex-shrink-0 ${mustEnrolNow ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />}
        <div>
          <h3 className={`font-semibold ${
            enrolled ? 'text-green-900 dark:text-green-200'
              : mustEnrolNow ? 'text-red-900 dark:text-red-200'
              : 'text-amber-900 dark:text-amber-200'}`}
          >
            {enrolled ? 'Two-step verification is on' : 'Two-step verification is off'}
          </h3>
          <p className={`text-sm ${
            enrolled ? 'text-green-800 dark:text-green-300'
              : mustEnrolNow ? 'text-red-800 dark:text-red-300'
              : 'text-amber-800 dark:text-amber-300'}`}
          >
            {enrolled
              ? 'Someone who learns your password still cannot sign in as you.'
              : required && mustEnrolNow
              ? 'Your account now requires a second step. Set one up below to keep using the system.'
              : required
              ? `Required for your account. You have ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'} to set it up.`
              : 'Add a second step so a stolen password is not enough on its own.'}
          </p>
        </div>
      </div>

      {recoveryCodes && (
        <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />
      )}

      {/* ---- passkeys ---- */}
      <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Fingerprint className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Fingerprint, face or security key
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Strongest
                </span>
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {platformAuth
                  ? 'Use this device’s fingerprint or face. It also lets you sign in with no password at all.'
                  : 'Use a security key, or your phone. It also lets you sign in with no password at all.'}
              </p>
            </div>
          </div>
          {webauthnReady && (
            <button
              type="button"
              onClick={addPasskey}
              disabled={busy === 'passkey'}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy === 'passkey' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          )}
        </div>

        {!webauthnReady && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This browser does not support passkeys. Try Chrome, Edge or Safari.
          </p>
        )}

        {status.passkeys.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
            {status.passkeys.map((pk) => (
              <li key={pk.id} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{pk.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                      {pk.lastUsedAt ? ` · last used ${new Date(pk.lastUsedAt).toLocaleDateString()}` : ' · not used yet'}
                      {pk.backedUp ? ' · synced across your devices' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirming({ kind: 'passkey', id: pk.id })}
                    className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    aria-label={`Remove ${pk.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {confirming?.kind === 'passkey' && confirming.id === pk.id && (
                  <PasswordConfirm
                    danger
                    title={`Remove ${pk.name}? That device will no longer sign you in.`}
                    action="Remove"
                    onConfirm={(password) => removePasskey(pk.id, password)}
                    onCancel={() => setConfirming(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- authenticator app ---- */}
      <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Authenticator app</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A 6-digit code from Google Authenticator, Microsoft Authenticator or Authy. Works without a signal.
              </p>
            </div>
          </div>
          {methods.totp ? (
            <button
              type="button"
              onClick={() => setConfirming({ kind: 'totp' })}
              className="flex-shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={beginTotp}
              disabled={busy === 'totp' || !!totpSetup}
              className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy === 'totp' ? 'Starting…' : 'Set up'}
            </button>
          )}
        </div>

        {methods.totp && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
            <Check className="h-4 w-4" /> Enabled
          </p>
        )}

        {confirming?.kind === 'totp' && (
          <PasswordConfirm
            danger
            title="Remove the authenticator app from this account?"
            action="Remove"
            onConfirm={removeTotp}
            onCancel={() => setConfirming(null)}
          />
        )}

        {totpSetup && (
          <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              1. Scan this with your authenticator app:
            </p>
            <img src={totpSetup.qr} alt="QR code for your authenticator app" className="mx-auto rounded-lg bg-white p-2" width={200} height={200} />
            <details className="text-sm">
              <summary className="cursor-pointer text-blue-600 dark:text-blue-400">Can’t scan? Enter this key instead</summary>
              <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs dark:bg-gray-900 dark:text-gray-200">
                {totpSetup.secret}
              </code>
            </details>
            <p className="text-sm text-gray-700 dark:text-gray-300">2. Enter the 6-digit code it shows:</p>
            <div className="flex gap-2">
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="000000"
                className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={confirmTotp}
                disabled={totpCode.length !== 6 || busy === 'totp-confirm'}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === 'totp-confirm' ? 'Checking…' : 'Turn on'}
              </button>
              <button
                type="button"
                onClick={() => { setTotpSetup(null); setTotpCode(''); }}
                className="rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---- emailed codes ---- */}
      <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Emailed code
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Weakest
                </span>
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A 6-digit code to your inbox. Easiest to use, but only as safe as your email account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleEmail(!methods.email)}
            disabled={busy === 'email'}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
              methods.email
                ? 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {busy === 'email' ? 'Working…' : methods.email ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </section>

      {/* ---- recovery codes ---- */}
      <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Recovery codes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {methods.recoveryCodesLeft > 0
                  ? `${methods.recoveryCodesLeft} unused code${methods.recoveryCodesLeft === 1 ? '' : 's'} left. Use one if you lose your phone.`
                  : 'None left. Generate a new set so you are not locked out.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirming({ kind: 'recovery' })}
            className="flex-shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {methods.recoveryCodesLeft > 0 ? 'Generate new' : 'Generate'}
          </button>
        </div>

        {confirming?.kind === 'recovery' && (
          <PasswordConfirm
            title="Generating a new set makes every existing recovery code stop working."
            action="Generate new codes"
            onConfirm={newRecoveryCodes}
            onCancel={() => setConfirming(null)}
          />
        )}
      </section>
    </div>
  );
}
