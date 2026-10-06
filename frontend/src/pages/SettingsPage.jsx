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
  AlertCircle, Info, Moon, Sun, Monitor
} from 'lucide-react';

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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary">{t('settings.title')}</h1>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted">
                {t('settings.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border-subtle p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-700 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-hover'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Account Info Card */}
            <div className="mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary">{t('settings.accountActive')}</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-dark-text-secondary">
                {t('settings.accountVerified')}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border-subtle p-6">
              
              {/* Security Tab */}
              {activeTab === 'security' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">{t('settings.securitySettings')}</h2>
                    <p className="text-gray-600 dark:text-dark-text-muted">{t('settings.securitySubtitle')}</p>
                  </div>

                  {/* Change Password */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Key className="w-5 h-5 text-blue-600" />
                      {t('settings.changePassword')}
                    </h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('settings.currentPassword')}
                        </label>
                        <input
                          type="password"
                          value={securityForm.currentPassword}
                          onChange={(e) => setSecurityForm({...securityForm, currentPassword: e.target.value})}
                          required
                          className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border-default dark:bg-dark-elevated dark:text-dark-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t('settings.currentPassword')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('settings.newPassword')}
                        </label>
                        <input
                          type="password"
                          value={securityForm.newPassword}
                          onChange={(e) => setSecurityForm({...securityForm, newPassword: e.target.value})}
                          required
                          minLength={6}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border-default dark:bg-dark-elevated dark:text-dark-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t('settings.newPassword')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('settings.confirmPassword')}
                        </label>
                        <input
                          type="password"
                          value={securityForm.confirmPassword}
                          onChange={(e) => setSecurityForm({...securityForm, confirmPassword: e.target.value})}
                          required
                          minLength={6}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border-default dark:bg-dark-elevated dark:text-dark-text-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t('settings.confirmPassword')}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {loading ? t('settings.updating') : t('settings.updatePassword')}
                      </button>
                    </form>
                  </div>

                  {/* Security Recommendations */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">{t('settings.passwordTips')}</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          <li>• {t('settings.tip1')}</li>
                          <li>• {t('settings.tip2')}</li>
                          <li>• {t('settings.tip3')}</li>
                          <li>• {t('settings.tip4')}</li>
                          <li>• {t('settings.tip5')}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Notification Preferences</h2>
                    <p className="text-gray-600">Choose what notifications you want to receive</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-gray-900">Email Notifications</h3>
                          <p className="text-sm text-gray-600">Receive updates via email</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.emailNotifications}
                          onChange={(e) => setNotifications({...notifications, emailNotifications: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Bell className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-gray-900">Schedule Updates</h3>
                          <p className="text-sm text-gray-600">Notify when schedules change</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.scheduleUpdates}
                          onChange={(e) => setNotifications({...notifications, scheduleUpdates: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Smartphone className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-gray-900">Faculty Assignments</h3>
                          <p className="text-sm text-gray-600">Alerts for new assignments</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.facultyAssignments}
                          onChange={(e) => setNotifications({...notifications, facultyAssignments: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-gray-900">System Alerts</h3>
                          <p className="text-sm text-gray-600">Important system notifications</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.systemAlerts}
                          onChange={(e) => setNotifications({...notifications, systemAlerts: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-gray-900">Weekly Digest</h3>
                          <p className="text-sm text-gray-600">Summary of weekly activity</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.weeklyDigest}
                          onChange={(e) => setNotifications({...notifications, weeklyDigest: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleNotificationSave}
                    disabled={loading}
                    className="mt-6 flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('settings.appearanceSettings')}</h2>
                    <p className="text-gray-600">{t('settings.appearanceSubtitle')}</p>
                  </div>

                  <div className="space-y-6">
                    {/* Theme Selection */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('settings.theme')}</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <button
                          onClick={() => setAppearance({...appearance, theme: 'light'})}
                          className={`p-4 border-2 rounded-lg transition-all ${
                            appearance.theme === 'light'
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-dark-border-default hover:border-gray-300 dark:hover:border-dark-border-strong'
                          }`}
                        >
                          <Sun className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                          <p className="font-medium text-gray-900">{t('settings.light')}</p>
                        </button>
                        <button
                          onClick={() => setAppearance({...appearance, theme: 'dark'})}
                          className={`p-4 border-2 rounded-lg transition-all ${
                            appearance.theme === 'dark'
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-dark-border-default hover:border-gray-300 dark:hover:border-dark-border-strong'
                          }`}
                        >
                          <Moon className="w-8 h-8 mx-auto mb-2 text-indigo-600" />
                          <p className="font-medium text-gray-900">{t('settings.dark')}</p>
                        </button>
                        <button
                          onClick={() => setAppearance({...appearance, theme: 'system'})}
                          className={`p-4 border-2 rounded-lg transition-all ${
                            appearance.theme === 'system'
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-dark-border-default hover:border-gray-300 dark:hover:border-dark-border-strong'
                          }`}
                        >
                          <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                          <p className="font-medium text-gray-900">{t('settings.system')}</p>
                        </button>
                      </div>
                    </div>

                    {/* Language */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        {t('settings.language')}
                      </h3>
                      <select
                        value={appearance.language}
                        onChange={(e) => setAppearance({...appearance, language: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="fil">Filipino</option>
                        <option value="ceb">Cebuano</option>
                      </select>
                    </div>

                    {/* Timezone */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('settings.timezone')}</h3>
                      <select
                        value={appearance.timezone}
                        onChange={(e) => setAppearance({...appearance, timezone: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                        <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleAppearanceSave}
                    disabled={loading}
                    className="mt-6 flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? t('settings.saving') : t('settings.saveAppearance')}
                  </button>
                </div>
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Privacy Settings</h2>
                    <p className="text-gray-600">Control who can see your information</p>
                  </div>

                  <div className="space-y-6">
                    {/* Profile Visibility */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Profile Visibility</h3>
                      <select
                        value={privacy.profileVisibility}
                        onChange={(e) => setPrivacy({...privacy, profileVisibility: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="public">Public - Anyone can view</option>
                        <option value="program-only">Program Only - Only your program members</option>
                        <option value="private">Private - Only you</option>
                      </select>
                    </div>

                    {/* Contact Info Visibility */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                      
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">Show Email Address</h4>
                          <p className="text-sm text-gray-600">Allow others to see your email</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privacy.showEmail}
                            onChange={(e) => setPrivacy({...privacy, showEmail: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">Show Phone Number</h4>
                          <p className="text-sm text-gray-600">Allow others to see your phone</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privacy.showPhone}
                            onChange={(e) => setPrivacy({...privacy, showPhone: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">Allow Messages</h4>
                          <p className="text-sm text-gray-600">Let others send you messages</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privacy.allowMessages}
                            onChange={(e) => setPrivacy({...privacy, allowMessages: e.target.checked})}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePrivacySave}
                    disabled={loading}
                    className="mt-6 flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Saving...' : 'Save Privacy Settings'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;
