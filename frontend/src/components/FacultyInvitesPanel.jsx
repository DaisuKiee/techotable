import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Link as LinkIcon, X, Copy, Check, Clock, Users, Plus, Loader2, Ban, CalendarClock, Info,
} from 'lucide-react';
import { facultyInviteAPI, getErrorMessage } from '../services/api';
import ConfirmDialog from './ConfirmDialog';

/**
 * Faculty invite links for a program: create one that lasts until a chosen
 * date, share it with the program's teachers, see who signed up with it,
 * and cancel it early if needed.
 */

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const PRESETS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

const STATUS = {
  active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  revoked: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  used_up: { label: 'Limit reached', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
};

/** <input type="datetime-local"> value for a Date, in local time. */
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** End of the day `days` from now. */
const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d;
};

const linkFor = (code) => `${window.location.origin}/faculty-signup?invite=${encodeURIComponent(code)}`;

const until = (date) => {
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.round(ms / 3600000);
  if (hours < 24) return `in ${Math.max(1, hours)} hour${hours === 1 ? '' : 's'}`;
  // Whole days left: "2 weeks" (to 11:59 PM) reads "14 days", not 15
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
};

const fmt = (date) => new Date(date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

const FacultyInvitesPanel = ({ programs = [], lockedProgram = '', onClose }) => {
  const [invites, setInvites] = useState(null);
  const [showOld, setShowOld] = useState(false);
  const [program, setProgram] = useState(lockedProgram || '');
  const [expires, setExpires] = useState(() => toLocalInput(daysFromNow(7)));
  const [maxUses, setMaxUses] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(null);
  const [copied, setCopied] = useState(null);
  const [toRevoke, setToRevoke] = useState(null);

  const load = useCallback(() => {
    facultyInviteAPI.list(lockedProgram ? {} : { program: program || undefined })
      .then((res) => setInvites(res.data.data || []))
      .catch((err) => { setInvites([]); toast.error(getErrorMessage(err, 'Could not load invite links')); });
  }, [lockedProgram, program]);

  useEffect(() => { load(); }, [load]);

  const expiresDate = useMemo(() => new Date(expires), [expires]);
  const expiryProblem = Number.isNaN(expiresDate.getTime())
    ? 'Choose a date and time'
    : expiresDate.getTime() - Date.now() < 30 * 60 * 1000
      ? 'Pick a time at least 30 minutes from now'
      : expiresDate.getTime() - Date.now() > 90 * 86400000
        ? 'A link can last at most 90 days'
        : null;

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(linkFor(code));
      setCopied(code);
      toast.success('Invite link copied');
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      toast.error('Could not copy. Select the link and copy it yourself.');
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!program || expiryProblem) return;
    setCreating(true);
    try {
      const res = await facultyInviteAPI.create({
        program,
        expiresAt: expiresDate.toISOString(),
        maxUses: maxUses === '' ? null : Number(maxUses),
        note: note.trim(),
      });
      const invite = res.data.data;
      setJustCreated(invite.code);
      setInvites((list) => [invite, ...(list || [])]);
      setNote('');
      setMaxUses('');
      copy(invite.code);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create the invite link'));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    const target = toRevoke;
    setToRevoke(null);
    try {
      const res = await facultyInviteAPI.revoke(target._id);
      setInvites((list) => list.map((i) => (i._id === target._id ? res.data.data : i)));
      toast.success('Invite link cancelled. It no longer works.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel the link'));
    }
  };

  const visible = (invites || []).filter((i) => showOld || i.status === 'active');
  const hiddenCount = (invites || []).length - visible.length;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm dark:border-blue-900/50 dark:bg-gray-800" aria-label="Faculty invite links">
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-blue-600 to-blue-600 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 p-2"><LinkIcon className="h-5 w-5" /></div>
          <div>
            <h3 className="text-lg font-bold">Faculty invite links</h3>
            <p className="text-sm text-blue-100">
              Share a link with your {lockedProgram || 'program’s'} teachers. Whoever signs up with it joins {lockedProgram || 'that program'} and waits for your approval.
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/20" aria-label="Close invite links">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Create */}
      <form onSubmit={create} className="grid gap-4 border-b border-gray-100 p-5 dark:border-gray-700 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <label htmlFor="invite-program" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Program</label>
          {lockedProgram ? (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{lockedProgram}</p>
          ) : (
            <select id="invite-program" value={program} onChange={(e) => setProgram(e.target.value)} className={inputCls} required>
              <option value="">Choose a program…</option>
              {programs.map((p) => <option key={p.code} value={p.code}>{p.code}{p.name ? ` · ${p.name}` : ''}</option>)}
            </select>
          )}
        </div>

        <div className="lg:col-span-5">
          <label htmlFor="invite-expires" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Link expires</label>
          <input
            id="invite-expires"
            type="datetime-local"
            value={expires}
            min={toLocalInput(new Date(Date.now() + 30 * 60 * 1000))}
            max={toLocalInput(new Date(Date.now() + 90 * 86400000))}
            onChange={(e) => setExpires(e.target.value)}
            className={inputCls}
            aria-invalid={!!expiryProblem}
            required
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setExpires(toLocalInput(daysFromNow(p.days)))}
                className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300"
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className={`mt-1 text-xs ${expiryProblem ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {expiryProblem || `Works until ${fmt(expiresDate)} (${until(expiresDate)}).`}
          </p>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="invite-max" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Sign-up limit</label>
          <input id="invite-max" type="number" min="1" max="500" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="No limit" className={inputCls} />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="invite-note" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Note (optional)</label>
          <input id="invite-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New hires" className={inputCls} />
        </div>

        <div className="flex items-center justify-between gap-3 lg:col-span-12">
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Info className="h-3.5 w-3.5" /> Anyone with the link can sign up until it expires, so share it only with your teachers.
          </p>
          <button
            type="submit"
            disabled={creating || !program || !!expiryProblem}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create link
          </button>
        </div>
      </form>

      {/* Links */}
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {showOld ? 'All recent links' : 'Active links'}{invites ? ` (${visible.length})` : ''}
          </h4>
          {(hiddenCount > 0 || showOld) && (
            <button type="button" onClick={() => setShowOld((v) => !v)} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
              {showOld ? 'Hide expired & cancelled' : `Show ${hiddenCount} expired or cancelled`}
            </button>
          )}
        </div>

        {invites === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
            No active invite links. Create one above and send it to your teachers.
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((inv) => {
              const status = STATUS[inv.status] || STATUS.expired;
              const active = inv.status === 'active';
              return (
                <li
                  key={inv._id}
                  className={`rounded-lg border p-4 ${justCreated === inv.code ? 'border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700'} ${active ? '' : 'opacity-70'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">{inv.program}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                    {inv.note && <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{inv.note}</span>}
                    {justCreated === inv.code && <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">New: copied to clipboard</span>}
                  </div>

                  {active && (
                    <div className="mt-2 flex gap-2">
                      <input
                        readOnly
                        value={linkFor(inv.code)}
                        onFocus={(e) => e.target.select()}
                        aria-label={`Invite link for ${inv.program}`}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-300"
                      />
                      <button type="button" onClick={() => copy(inv.code)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                        {copied === inv.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied === inv.code ? 'Copied' : 'Copy'}
                      </button>
                      <button type="button" onClick={() => setToRevoke(inv)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/20" title="Stop this link from working">
                        <Ban className="h-4 w-4" /> <span className="hidden sm:inline">Cancel</span>
                      </button>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {active ? <CalendarClock className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {inv.status === 'revoked'
                        ? `Cancelled ${fmt(inv.revokedAt)}`
                        : active ? `Expires ${fmt(inv.expiresAt)} (${until(inv.expiresAt)})` : `Expired ${fmt(inv.expiresAt)}`}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {inv.maxUses ? `${inv.uses} of ${inv.maxUses} signed up` : `${inv.uses} signed up`}
                    </span>
                    {inv.createdBy && <span>Made by {inv.createdBy}</span>}
                  </div>

                  {inv.signups?.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400">Who signed up</summary>
                      <ul className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
                        {inv.signups.map((s, i) => (
                          <li key={`${s.email}-${i}`}>{s.name} · {s.email} · {fmt(s.at)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          New sign-ups appear on <strong>Pending Approvals</strong>. Once approved, they’re asked to complete their faculty profile.
        </p>
      </div>

      <ConfirmDialog
        isOpen={!!toRevoke}
        title="Cancel this invite link?"
        message={toRevoke ? `The ${toRevoke.program} link${toRevoke.note ? ` “${toRevoke.note}”` : ''} will stop working right away. Teachers who already signed up are not affected.` : ''}
        confirmText="Cancel link"
        cancelText="Keep it"
        type="warning"
        footnote={null}
        onConfirm={revoke}
        onClose={() => setToRevoke(null)}
      />
    </section>
  );
};

export default FacultyInvitesPanel;
