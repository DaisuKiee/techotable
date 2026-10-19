import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Settings, Lock, Bell, Eye, Globe, Shield,
  Save, Key, Mail, Smartphone, CheckCircle,
  AlertCircle, Info, Moon, Sun, Monitor,
  EyeOff, Check, Loader2, Clock, Users, Phone, MessageSquare, Calendar
} from 'lucide-react';

/* ---------- Reusable UI pieces (presentation only) ---------- */

const inputCls =
  'w-full px-4 py-2.5 bg-white dark:bg-dark-elevated text-gray-900 dark:text-dark-text-primary border border-gray-300 dark:border-dark-border-default rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-shadow';

const Toggle = ({ checked, onChange, label }) => (
  <label className="relative inline-flex items-center cursor-pointer shrink-0">
    <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="sr-only peer" />
    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-focus-visible:ring-4 peer-focus-visible:ring-blue-300/60 peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow after:transition-all peer-checked:after:translate-x-5" />
  </label>
);

const SettingRow = ({ icon: Icon, title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 dark:border-dark-border-subtle bg-gray-50/70 dark:bg-dark-elevated/60 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <div className="p-2 rounded-lg bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border-subtle">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      )}
      <div className="min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-dark-text-primary">{title}</h4>
        <p className="text-sm text-gray-500 dark:text-dark-text-muted">{description}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} label={title} />
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-6 pb-4 border-b border-gray-100 dark:border-dark-border-subtle">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">{title}</h2>
    <p className="mt-1 text-gray-500 dark:text-dark-text-muted">{subtitle}</p>
  </div>
);

const SubHeading = ({ icon: Icon, children }) => (
  <h3 className="text-base font-semibold text-gray-900 dark:text-dark-text-primary mb-3 flex items-center gap-2">
    {Icon && <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
    {children}
  </h3>
);

const SaveButton = ({ loading, onClick, type = 'button', children }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={loading}
    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
    {children}
  </button>
);

const PasswordField = ({ label, value, onChange, placeholder, minLength }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          minLength={minLength}
          className={`${inputCls} pr-11`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};
const strengthMeta = [
  { label: 'Too weak', color: 'bg-red-500' },
  { label: 'Weak', color: 'bg-red-500' },
  { label: 'Fair', color: 'bg-yellow-500' },
  { label: 'Good', color: 'bg-blue-500' },
  { label: 'Strong', color: 'bg-green-500' }
];

/* ---------- Page ---------- */

const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, language, timezone, updateTheme, updateLanguage, updateTimezone, reloadTheme } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Load saved tab from localStorage, default to 'security'
    return localStorage.getItem('settingsActiveTab') || 'security';
  });

  // Security Settings
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    scheduleUpdates: true,
    facultyAssignments: true,
    systemAlerts: true,
    weeklyDigest: false
  });

  // Appearance Settings - now using theme context
  const [appearance, setAppearance] = useState({
    theme: theme,
    language: language,
    timezone: timezone
  });

  // Update appearance state when theme context changes
  useEffect(() => {
    setAppearance({
      theme: theme,
      language: language,
      timezone: timezone
    });
  }, [theme, language, timezone]);

  // Save active tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('settingsActiveTab', activeTab);
  }, [activeTab]);

  // Privacy Settings
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public', // public, private, program-only
    showEmail: false,
    showPhone: false,
    allowMessages: true
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await authAPI.getSettings();
      const settings = response.data.data;

      if (settings.notifications) {
        setNotifications(settings.notifications);
      }
      if (settings.appearance) {
        setAppearance(settings.appearance);
      }
      if (settings.privacy) {
        setPrivacy(settings.privacy);
      }
    } catch (error) {
      console.error('Load settings error:', error);
      // Use defaults if loading fails
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (securityForm.newPassword !== securityForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (securityForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword
      });

      toast.success('Password changed successfully');
      setSecurityForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSave = async () => {
    setLoading(true);
    try {
      await authAPI.updateSettings({ notifications });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Failed to save notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleAppearanceSave = async () => {
    setLoading(true);
    try {
      // Save to database
      await authAPI.updateSettings({ appearance });

      // Update theme context directly (no additional API calls)
      updateTheme(appearance.theme);
      updateLanguage(appearance.language);
      updateTimezone(appearance.timezone);

      toast.success('Appearance settings saved and applied');
    } catch (error) {
      toast.error('Failed to save appearance settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacySave = async () => {
    setLoading(true);
    try {
      await authAPI.updateSettings({ privacy });
      toast.success('Privacy settings saved');
    } catch (error) {
      toast.error('Failed to save privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'security', label: t('settings.security'), icon: Lock },
    { id: 'notifications', label: t('settings.notifications'), icon: Bell },
    { id: 'appearance', label: t('settings.appearance'), icon: Eye },
    { id: 'privacy', label: t('settings.privacy'), icon: Shield }
  ];

  // UI-only derived values
  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';
  const initials = displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const strength = getStrength(securityForm.newPassword);
  const passwordsMatch = securityForm.confirmPassword && securityForm.newPassword === securityForm.confirmPassword;
  const passwordsMismatch = securityForm.confirmPassword && securityForm.newPassword !== securityForm.confirmPassword;

  const notificationItems = [
    { key: 'emailNotifications', icon: Mail, title: 'Email Notifications', description: 'Receive updates via email' },
    { key: 'scheduleUpdates', icon: Calendar, title: 'Schedule Updates', description: 'Notify when schedules change' },
    { key: 'facultyAssignments', icon: Smartphone, title: 'Faculty Assignments', description: 'Alerts for new assignments' },
    { key: 'systemAlerts', icon: AlertCircle, title: 'System Alerts', description: 'Important system notifications' },
    { key: 'weeklyDigest', icon: Mail, title: 'Weekly Digest', description: 'Summary of weekly activity' }
  ];

  const themeOptions = [
    { id: 'light', label: t('settings.light'), icon: Sun, iconCls: 'text-yellow-500', preview: 'bg-white border-gray-200', bar: 'bg-gray-200' },
    { id: 'dark', label: t('settings.dark'), icon: Moon, iconCls: 'text-indigo-500', preview: 'bg-gray-800 border-gray-700', bar: 'bg-gray-600' },
    { id: 'system', label: t('settings.system'), icon: Monitor, iconCls: 'text-gray-500', preview: 'bg-gradient-to-r from-white to-gray-800 border-gray-300', bar: 'bg-gray-400' }
  ];

  const privacyToggles = [
    { key: 'showEmail', icon: Mail, title: 'Show Email Address', description: 'Allow others to see your email' },
    { key: 'showPhone', icon: Phone, title: 'Show Phone Number', description: 'Allow others to see your phone' },
    { key: 'allowMessages', icon: MessageSquare, title: 'Allow Messages', description: 'Let others send you messages' }
  ];

  const tipKeys = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-600/20">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">{t('settings.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted">{t('settings.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-6 self-start">
            {/* Profile summary */}
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border-subtle p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold flex items-center justify-center shrink-0">
                {initials || 'U'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-dark-text-primary truncate">{displayName}</p>
                {user?.email && <p className="text-xs text-gray-500 dark:text-dark-text-muted truncate">{user.email}</p>}
              </div>
            </div>

            {/* Tabs: horizontal scroll on mobile, vertical on desktop */}
            <nav
              className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border-subtle p-2 flex lg:flex-col gap-1 overflow-x-auto"
              role="tablist"
              aria-label="Settings sections"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap lg:w-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      active
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                        : 'text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-hover'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Account status */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary">{t('settings.accountActive')}</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-dark-text-secondary">{t('settings.accountVerified')}</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3">
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border-subtle p-6 sm:p-8">

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div role="tabpanel">
                  <SectionHeader title={t('settings.securitySettings')} subtitle={t('settings.securitySubtitle')} />

                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                    <div className="xl:col-span-3">
                      <SubHeading icon={Key}>{t('settings.changePassword')}</SubHeading>
                      <form onSubmit={handlePasswordChange} className="space-y-4">
                        <PasswordField
                          label={t('settings.currentPassword')}
                          value={securityForm.currentPassword}
                          onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                          placeholder={t('settings.currentPassword')}
                        />
                        <div>
                          <PasswordField
                            label={t('settings.newPassword')}
                            value={securityForm.newPassword}
                            onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                            placeholder={t('settings.newPassword')}
                            minLength={6}
                          />
                          {securityForm.newPassword && (
                            <div className="mt-2">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map((i) => (
                                  <div
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                                      i <= strength ? strengthMeta[strength].color : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                  />
                                ))}
                              </div>
                              <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-muted">
                                Strength: {strengthMeta[strength].label}
                              </p>
                            </div>
                          )}
                        </div>
                        <div>
                          <PasswordField
                            label={t('settings.confirmPassword')}
                            value={securityForm.confirmPassword}
                            onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                            placeholder={t('settings.confirmPassword')}
                            minLength={6}
                          />
                          {passwordsMatch && (
                            <p className="mt-1 text-xs text-green-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Passwords match</p>
                          )}
                          {passwordsMismatch && (
                            <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Passwords do not match</p>
                          )}
                        </div>
                        <SaveButton type="submit" loading={loading}>
                          {loading ? t('settings.updating') : t('settings.updatePassword')}
                        </SaveButton>
                      </form>
                    </div>

                    {/* Tips */}
                    <div className="xl:col-span-2 self-start bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-dark-text-primary mb-2">{t('settings.passwordTips')}</h4>
                          <ul className="text-sm text-gray-700 dark:text-dark-text-secondary space-y-2">
                            {tipKeys.map((k) => (
                              <li key={k} className="flex gap-2">
                                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <span>{t(`settings.${k}`)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div role="tabpanel">
                  <SectionHeader title="Notification Preferences" subtitle="Choose what notifications you want to receive" />
                  <div className="space-y-3">
                    {notificationItems.map(({ key, icon, title, description }) => (
                      <SettingRow
                        key={key}
                        icon={icon}
                        title={title}
                        description={description}
                        checked={notifications[key]}
                        onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                      />
                    ))}
                  </div>
                  <div className="mt-6">
                    <SaveButton onClick={handleNotificationSave} loading={loading}>
                      {loading ? 'Saving...' : 'Save Preferences'}
                    </SaveButton>
                  </div>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div role="tabpanel">
                  <SectionHeader title={t('settings.appearanceSettings')} subtitle={t('settings.appearanceSubtitle')} />

                  <div className="space-y-8">
                    {/* Theme */}
                    <div>
                      <SubHeading>{t('settings.theme')}</SubHeading>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {themeOptions.map(({ id, label, icon: Icon, iconCls, preview, bar }) => {
                          const selected = appearance.theme === id;
                          return (
                            <button
                              key={id}
                              onClick={() => setAppearance({ ...appearance, theme: id })}
                              aria-pressed={selected}
                              className={`relative p-4 border-2 rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                selected
                                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                                  : 'border-gray-200 dark:border-dark-border-default hover:border-gray-300 dark:hover:border-dark-border-strong'
                              }`}
                            >
                              {selected && (
                                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                              <div className={`h-14 rounded-lg border mb-3 p-2 flex flex-col gap-1.5 ${preview}`}>
                                <div className={`h-2 w-2/3 rounded ${bar}`} />
                                <div className={`h-2 w-1/2 rounded ${bar}`} />
                              </div>
                              <div className="flex items-center gap-2">
                                <Icon className={`w-5 h-5 ${iconCls}`} />
                                <p className="font-medium text-gray-900 dark:text-dark-text-primary">{label}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Language */}
                      <div>
                        <SubHeading icon={Globe}>{t('settings.language')}</SubHeading>
                        <select
                          value={appearance.language}
                          onChange={(e) => setAppearance({ ...appearance, language: e.target.value })}
                          className={inputCls}
                        >
                          <option value="en">English</option>
                          <option value="fil">Filipino</option>
                          <option value="ceb">Cebuano</option>
                        </select>
                      </div>

                      {/* Timezone */}
                      <div>
                        <SubHeading icon={Clock}>{t('settings.timezone')}</SubHeading>
                        <select
                          value={appearance.timezone}
                          onChange={(e) => setAppearance({ ...appearance, timezone: e.target.value })}
                          className={inputCls}
                        >
                          <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                          <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                          <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <SaveButton onClick={handleAppearanceSave} loading={loading}>
                      {loading ? t('settings.saving') : t('settings.saveAppearance')}
                    </SaveButton>
                  </div>
                </div>
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <div role="tabpanel">
                  <SectionHeader title="Privacy Settings" subtitle="Control who can see your information" />

                  <div className="space-y-8">
                    {/* Profile Visibility */}
                    <div>
                      <SubHeading icon={Users}>Profile Visibility</SubHeading>
                      <select
                        value={privacy.profileVisibility}
                        onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.value })}
                        className={inputCls}
                      >
                        <option value="public">Public - Anyone can view</option>
                        <option value="program-only">Program Only - Only your program members</option>
                        <option value="private">Private - Only you</option>
                      </select>
                    </div>

                    {/* Contact Info Visibility */}
                    <div>
                      <SubHeading>Contact Information</SubHeading>
                      <div className="space-y-3">
                        {privacyToggles.map(({ key, icon, title, description }) => (
                          <SettingRow
                            key={key}
                            icon={icon}
                            title={title}
                            description={description}
                            checked={privacy[key]}
                            onChange={(e) => setPrivacy({ ...privacy, [key]: e.target.checked })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <SaveButton onClick={handlePrivacySave} loading={loading}>
                      {loading ? 'Saving...' : 'Save Privacy Settings'}
                    </SaveButton>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;