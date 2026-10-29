import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle2, X, Clock } from 'lucide-react';
import ctuLogo from '../../assets/images/logos/ctulogo.png';
import ctuBg from '../../assets/images/backgrounds/ctu-bg.jpg';
import { ThemeToggle } from '../Layout';

/**
 * Shared frame for the login and sign-up pages.
 *
 * Both pages used to open behind a 500 ms skeleton overlay - a fixed delay
 * before anyone could type, on pages with nothing to load. The content now
 * renders immediately and only animates in with CSS.
 */

// A week from the real timetable view, so the panel shows what the system
// produces instead of describing it.
const WEEK = [
  { day: 0, row: 0, span: 2, code: 'CC 111', room: 'COTE-28', tone: 'bg-blue-400/90' },
  { day: 1, row: 1, span: 1, code: 'GEC-RPH', room: 'COTE-01', tone: 'bg-yellow-400/90' },
  { day: 2, row: 0, span: 2, code: 'CC 112', room: 'COTE-01', tone: 'bg-emerald-400/90' },
  { day: 3, row: 2, span: 2, code: 'CC 112 L', room: 'COTE-27', tone: 'bg-sky-400/90' },
  { day: 0, row: 3, span: 1, code: 'GEE-TEM', room: 'COTE-01', tone: 'bg-violet-400/90' },
  { day: 4, row: 1, span: 2, code: 'AP 1', room: 'COTE-29', tone: 'bg-rose-400/90' },
  { day: 2, row: 3, span: 1, code: 'PATHFR 1', room: 'COTE-01', tone: 'bg-amber-400/90' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TIMES = ['8 AM', '9 AM', '10 AM', '11 AM'];

const WeekPreview = () => (
  <div className="auth-rise rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-md" style={{ animationDelay: '.25s' }}>
    <div className="mb-3 flex items-center justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">BSIT-1A · This week</p>
        <p className="text-sm font-semibold text-white">Generated timetable</p>
      </div>
      <span className="auth-pop inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200" style={{ animationDelay: '1.4s' }}>
        <CheckCircle2 className="h-3.5 w-3.5" /> 0 conflicts
      </span>
    </div>
    <div className="grid grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] gap-1">
      <div />
      {DAYS.map((d) => (
        <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase text-blue-200/80">{d}</div>
      ))}
      <div className="relative col-span-6 grid grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] gap-1" style={{ gridTemplateRows: 'repeat(4, 2.1rem)' }}>
        {TIMES.map((t, row) => (
          <React.Fragment key={t}>
            <div className="pr-1 pt-0.5 text-right text-[9px] text-blue-200/60" style={{ gridColumn: 1, gridRow: row + 1 }}>{t}</div>
            {DAYS.map((d, day) => (
              <div key={d} className="rounded-md bg-white/[0.04]" style={{ gridColumn: day + 2, gridRow: row + 1 }} />
            ))}
          </React.Fragment>
        ))}
        {WEEK.map((c, i) => (
          <div
            key={c.code + c.day}
            className={`auth-drop overflow-hidden rounded-md px-1.5 py-1 text-slate-900 shadow-sm dark:text-slate-900 ${c.tone}`}
            style={{ gridColumn: c.day + 2, gridRow: `${c.row + 1} / span ${c.span}`, animationDelay: `${0.45 + i * 0.12}s` }}
          >
            <p className="truncate text-[10px] font-bold leading-tight">{c.code}</p>
            {c.span > 1 && <p className="truncate text-[9px] leading-tight opacity-75">{c.room}</p>}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const AuthLayout = ({
  children,
  eyebrow,
  title,
  highlight,
  description,
  features = [],
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-white dark:bg-dark-app lg:h-screen lg:overflow-hidden">
      <style>{`
        @keyframes auth-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes auth-drop { from { opacity: 0; transform: translateY(-10px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes auth-pop  { 0% { opacity: 0; transform: scale(.6); } 70% { transform: scale(1.08); } 100% { opacity: 1; transform: none; } }
        @keyframes auth-drift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(18px, -14px); } }
        .auth-rise  { animation: auth-rise .55s cubic-bezier(.22, 1, .36, 1) both; }
        .auth-drop  { animation: auth-drop .45s cubic-bezier(.22, 1, .36, 1) both; }
        .auth-pop   { animation: auth-pop .45s cubic-bezier(.34, 1.56, .64, 1) both; }
        .auth-drift { animation: auth-drift 14s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .auth-rise, .auth-drop, .auth-pop, .auth-drift { animation: none !important; }
        }
      `}</style>

      {/* Form panel */}
      <div className="relative flex w-full flex-col lg:w-[44%] lg:overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="group inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-blue-700 dark:text-dark-text-secondary dark:hover:text-dark-blue-info"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to home
          </button>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <div className="auth-rise mb-8 flex items-center gap-3">
              <img src={ctuLogo} alt="CTU logo" className="h-12 w-12 object-contain" />
              <div>
                <p className="bg-gradient-to-r from-blue-700 to-yellow-500 bg-clip-text text-lg font-bold text-transparent dark:from-blue-400 dark:to-yellow-300">
                  CTU Daanbantayan
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-text-muted">Smart Timetabling System</p>
              </div>
            </div>
            {children}
          </div>
        </div>

        <p className="px-5 pb-5 text-center text-xs text-gray-400 dark:text-dark-text-muted sm:px-8 lg:hidden">
          © {new Date().getFullYear()} Cebu Technological University · Daanbantayan Campus
        </p>
      </div>

      {/* Brand panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 lg:flex">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.12]" style={{ backgroundImage: `url(${ctuBg})` }} />
        <div className="auth-drift absolute -right-24 top-10 h-80 w-80 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="auth-drift absolute -left-16 bottom-0 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" style={{ animationDelay: '-7s' }} />

        <div className="relative z-10 flex w-full flex-col justify-center px-12 py-10 xl:px-20">
          <div className="max-w-xl">
            {eyebrow && (
              <p className="auth-rise mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300">{eyebrow}</p>
            )}
            <h2 className="auth-rise mb-4 text-4xl font-black leading-tight text-white xl:text-5xl" style={{ animationDelay: '.05s' }}>
              {title}
              {highlight && (
                <span className="block bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">{highlight}</span>
              )}
            </h2>
            {description && (
              <p className="auth-rise mb-7 text-base leading-relaxed text-blue-100/90" style={{ animationDelay: '.1s' }}>{description}</p>
            )}

            <WeekPreview />

            {features.length > 0 && (
              <ul className="mt-7 grid grid-cols-1 gap-3 xl:grid-cols-3">
                {features.map(({ icon: Icon, title: ft, text }, i) => (
                  <li key={ft} className="auth-rise flex gap-3 xl:flex-col" style={{ animationDelay: `${0.35 + i * 0.08}s` }}>
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-yellow-300">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">{ft}</span>
                      <span className="block text-xs leading-relaxed text-blue-200/80">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-10 border-t border-white/10 pt-5 text-xs text-blue-200/70">
              © {new Date().getFullYear()} Cebu Technological University · Daanbantayan Campus
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Error or success banner above a form. */
const ALERT_TONES = {
  error: { cls: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200', Icon: AlertCircle },
  success: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200', Icon: CheckCircle2 },
  info: { cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100', Icon: Clock },
};

export const FormAlert = ({ tone = 'error', children, onDismiss }) => {
  const { cls, Icon } = ALERT_TONES[tone] || ALERT_TONES.error;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`auth-rise mb-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm ${cls}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-70 transition-opacity hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const inputClass = (invalid, withIcon, withTrailing) => `block w-full rounded-xl border bg-white py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-[border-color,box-shadow] focus:outline-none focus:ring-4 dark:bg-dark-card dark:text-dark-text-primary dark:placeholder-gray-500 ${
  withIcon ? 'pl-10' : 'pl-3.5'
} ${withTrailing ? 'pr-11' : 'pr-3.5'} ${
  invalid
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 dark:border-red-500/70'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/15 dark:border-dark-border-default dark:focus:border-blue-400'
}`;

/**
 * Labelled input with an optional leading icon, inline error and hint.
 * Errors are tied to the input with aria-describedby so screen readers
 * announce them with the field.
 */
export const AuthField = React.forwardRef(({
  label, icon: Icon, error, hint, trailing, as = 'input', children, className = '', labelAside, ...props
}, ref) => {
  const id = useId();
  const inputId = props.id || id;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const Control = as;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary">{label}</label>
        {labelAside}
      </div>
      <div className="relative">
        {Icon && (
          <Icon className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 ${error ? 'text-red-400' : 'text-gray-400'}`} />
        )}
        <Control
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClass(!!error, !!Icon, !!trailing)}
          {...props}
        >
          {children}
        </Control>
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-gray-500 dark:text-dark-text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
AuthField.displayName = 'AuthField';

/** Password input with show/hide and a Caps Lock warning. */
export const PasswordField = React.forwardRef(({ hint, error, onBlur, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const checkCaps = (e) => setCapsLock(!!e.getModifierState?.('CapsLock'));

  return (
    <AuthField
      ref={ref}
      type={visible ? 'text' : 'password'}
      error={error}
      hint={!error && capsLock ? 'Caps Lock is on' : hint}
      onKeyUp={checkCaps}
      onKeyDown={checkCaps}
      onBlur={(e) => { setCapsLock(false); onBlur?.(e); }}
      trailing={(
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-hover dark:hover:text-dark-text-secondary"
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      )}
      {...props}
    />
  );
});
PasswordField.displayName = 'PasswordField';

const STATUS_TONES = {
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  info: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  error: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
};

/**
 * A result screen inside the form panel: "check your email", "password
 * updated", "link expired" and so on. Same frame as the forms, so finishing
 * a step doesn't throw the user onto a differently styled page.
 */
export const AuthStatus = ({ icon, tone = 'info', title, children, actions }) => (
  <div className="auth-rise text-center" role={tone === 'error' ? 'alert' : 'status'}>
    <div className={`auth-pop mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${STATUS_TONES[tone]}`}>
      {icon}
    </div>
    <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">{title}</h1>
    <div className="mb-7 space-y-2 text-sm text-gray-600 dark:text-dark-text-secondary">{children}</div>
    {actions && <div className="space-y-3 text-left">{actions}</div>}
  </div>
);

/** Outlined button for the secondary action next to a SubmitButton. */
export const SecondaryButton = ({ children, className = '', ...props }) => (
  <button
    type="button"
    className={`flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-border-default dark:bg-dark-card dark:text-dark-text-secondary dark:hover:bg-dark-hover ${className}`}
    {...props}
  >
    {children}
  </button>
);

/** Primary submit button with a busy state. */
export const SubmitButton = ({ loading, loadingText, children, type = 'submit', ...props }) => (
  <button
    type={type}
    disabled={loading}
    className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-px hover:from-blue-800 hover:to-blue-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
    {...props}
  >
    {loading ? (
      <>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        {loadingText}
      </>
    ) : children}
  </button>
);
