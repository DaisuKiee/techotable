import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import i18n from '../i18n';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

/**
 * The theme is cached on the device as well as in the user's server settings.
 *
 * It used to live only on the server, fetched after login. So the login and
 * signup pages were always light, and every page load painted light first and
 * flipped to dark once the request returned. public/index.html reads this same
 * key before React starts, so the right theme is on screen from the first frame.
 */
const THEME_KEY = 'theme';
const VALID_THEMES = ['light', 'dark', 'system'];

const readStoredTheme = () => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return VALID_THEMES.includes(t) ? t : 'light';
  } catch {
    return 'light';
  }
};

const systemPrefersDark = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readStoredTheme); // light, dark, system
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [loading, setLoading] = useState(true);
  // What is actually on screen once "system" is resolved
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    readStoredTheme() === 'dark' || (readStoredTheme() === 'system' && systemPrefersDark()) ? 'dark' : 'light'
  );

  useEffect(() => {
    loadThemeSettings();
  }, []);

  useEffect(() => {
    applyTheme();
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage blocked: the theme still applies for this visit
    }

    // In system mode, follow the OS live (e.g. auto dark at sunset) instead of
    // only checking once when the page loads.
    if (theme !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [theme]);

  const loadThemeSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authAPI.getSettings();
      const settings = response.data.data;
      
      if (settings.appearance) {
        setTheme(settings.appearance.theme || 'light');
        const lang = settings.appearance.language || 'en';
        setLanguage(lang);
        i18n.changeLanguage(lang); // Sync with i18n
        setTimezone(settings.appearance.timezone || 'Asia/Manila');
      }
    } catch (error) {
      console.error('Load theme error:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = () => {
    const root = document.documentElement;
    const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark());

    // Light mode is the absence of the class - default styles are light
    root.classList.remove('light', 'dark');
    if (dark) root.classList.add('dark');
    setResolvedTheme(dark ? 'dark' : 'light');
  };

  /**
   * Flip between light and dark from anywhere (the header toggle) and save it
   * to the user's settings, so it follows them to other devices. Saving is
   * best-effort: the switch itself never waits on the network.
   */
  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (localStorage.getItem('token')) {
      authAPI
        .updateSettings({ appearance: { theme: next, language, timezone } })
        .catch((error) => console.error('Save theme error:', error));
    }
  };

  const updateTheme = (newTheme) => {
    setTheme(newTheme);
  };

  const updateLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage); // Update i18n language
  };

  const updateTimezone = (newTimezone) => {
    setTimezone(newTimezone);
  };

  const value = {
    theme,
    resolvedTheme,
    toggleTheme,
    language,
    timezone,
    loading,
    updateTheme,
    updateLanguage,
    updateTimezone,
    reloadTheme: loadThemeSettings
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
