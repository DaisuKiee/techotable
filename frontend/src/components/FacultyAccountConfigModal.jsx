import React, { useState, useEffect } from 'react';
import { Settings, Clock, Info, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';

import { getErrorMessage } from '../services/api';
// Must match MAX_INVITE_HOURS in backend/controllers/auth.controller.js. This
// allowed up to 30 days while the server caps invites at 14, so a "30 days"
// setting quietly produced 14-day links.
const MAX_HOURS = 24 * 14;
const DEFAULT_HOURS = 48;

const PRESETS = [
  { label: '1 day', hours: 24 },
  { label: '2 days', hours: 48 },
  { label: '7 days', hours: 168 },
  { label: '14 days', hours: MAX_HOURS },
];

const describe = (hours) => {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} day${days === 1 ? '' : 's'}`;
};

const FacultyAccountConfigModal = ({ isOpen, onClose, onSave }) => {
  const [linkExpirationHours, setLinkExpirationHours] = useState(DEFAULT_HOURS);
  const [isSaving, setIsSaving] = useState(false);
  const titleId = useModalTitleId();

  useEffect(() => {
    // Load existing configuration from localStorage
    const savedConfig = localStorage.getItem('facultyAccountConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setLinkExpirationHours(Math.min(MAX_HOURS, config.linkExpirationHours || DEFAULT_HOURS));
      } catch (error) {
        console.error('Error loading config:', error);
      }
    }
  }, [isOpen]);

  const valid = Number.isInteger(linkExpirationHours) && linkExpirationHours >= 1 && linkExpirationHours <= MAX_HOURS;

  const handleSave = async () => {
    if (!valid) return;
    try {
      setIsSaving(true);
      const config = { linkExpirationHours };

      // Save configuration to localStorage
      localStorage.setItem('facultyAccountConfig', JSON.stringify(config));

      // Call parent save handler if provided
      if (onSave) {
        await onSave(config);
      }

      toast.success(`Invite links will last ${describe(linkExpirationHours)}`);
      onClose();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error(getErrorMessage(error, 'Failed to save configuration'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} size="md" labelledBy={titleId} busy={isSaving}>
      <ModalHeader
        id={titleId}
        icon={Settings}
        tone="indigo"
        title="Faculty invite settings"
        subtitle="How long a new invite link stays valid"
        onClose={onClose}
        closeDisabled={isSaving}
      />

      <ModalBody className="space-y-5">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4 text-indigo-500" /> Link lifetime
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((preset) => (
              <button
                key={preset.hours}
                type="button"
                onClick={() => setLinkExpirationHours(preset.hours)}
                aria-pressed={linkExpirationHours === preset.hours}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  linkExpirationHours === preset.hours
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="invite-hours" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Or a custom number of hours
          </label>
          <div className="flex items-center gap-3">
            <input
              id="invite-hours"
              type="number"
              min="1"
              max={MAX_HOURS}
              value={Number.isNaN(linkExpirationHours) ? '' : linkExpirationHours}
              onChange={(e) => setLinkExpirationHours(parseInt(e.target.value, 10))}
              aria-invalid={!valid}
              className={`w-32 rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white ${
                valid ? 'border-gray-300 focus:ring-indigo-500/40 dark:border-gray-600' : 'border-red-400 focus:ring-red-500/30'
              }`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {valid ? <>= <strong className="text-gray-900 dark:text-white">{describe(linkExpirationHours)}</strong></> : <span className="text-red-600 dark:text-red-400">Enter 1 to {MAX_HOURS} hours (14 days)</span>}
            </span>
          </div>
        </div>

        <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <ul className="list-disc space-y-1 pl-4">
            <li>Applies to links created after you save - existing links keep their expiry.</li>
            <li>Anyone with an unexpired link can request a faculty account.</li>
            <li>New accounts stay pending until approved on the Pending Approvals page.</li>
          </ul>
        </div>
      </ModalBody>

      <ModalFooter>
        <ModalButton
          variant="secondary"
          icon={RotateCcw}
          onClick={() => setLinkExpirationHours(DEFAULT_HOURS)}
          disabled={isSaving || linkExpirationHours === DEFAULT_HOURS}
          className="sm:mr-auto"
        >
          Default (2 days)
        </ModalButton>
        <ModalButton variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</ModalButton>
        <ModalButton onClick={handleSave} loading={isSaving} loadingText="Saving..." disabled={!valid}>
          Save
        </ModalButton>
      </ModalFooter>
    </ModalShell>
  );
};

export default FacultyAccountConfigModal;
