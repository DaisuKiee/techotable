import React from 'react';
import { Check } from 'lucide-react';

/**
 * One password rule set for every form that creates a password - student
 * sign-up, faculty sign-up and password reset. They used to disagree: reset
 * accepted any 6 characters while sign-up wanted 8 and a mix.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: '8+ characters', test: (p) => p.length >= 8 },
  { id: 'case', label: 'Upper & lowercase', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'number', label: 'A number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH = [
  { label: '', bar: 'bg-gray-200 dark:bg-dark-border-default', text: '' },
  { label: 'Weak', bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { label: 'Good', bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
];

/** Error message for a new password, or undefined when it is acceptable. */
export const passwordProblem = (password) => {
  if (!password) return 'Choose a password';
  if (password.length < 8) return 'Use at least 8 characters';
  // At least three of the four rules
  if (PASSWORD_RULES.filter((r) => r.test(password)).length < 3) {
    return 'Too weak - meet at least 3 of the rules below';
  }
  return undefined;
};

/** Error message for the confirmation field, or undefined. */
export const confirmProblem = (password, confirm) => {
  if (!confirm) return 'Re-enter your password';
  if (confirm !== password) return 'Passwords do not match';
  return undefined;
};

/**
 * While typing: flag a mismatch only once the confirmation is as long as the
 * password, so nobody is told "doesn't match" halfway through typing it.
 */
export const liveConfirmProblem = (password, confirm) => (
  confirm && confirm.length >= password.length && confirm !== password ? 'Passwords do not match' : undefined
);

/** Four-segment strength bar and a live checklist of the rules. */
export const PasswordChecklist = ({ password }) => {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const strength = password ? Math.max(1, passed) : 0;

  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="mb-2 flex items-center gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              n <= strength ? STRENGTH[strength].bar : STRENGTH[0].bar
            }`}
          />
        ))}
        <span className={`ml-1 w-12 text-right text-xs font-semibold ${STRENGTH[strength].text}`}>
          {STRENGTH[strength].label}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-dark-text-muted'}`}>
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors ${ok ? 'bg-emerald-500 text-white' : 'border border-gray-300 dark:border-dark-border-default'}`}>
                {ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
