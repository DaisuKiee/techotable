import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Load user on mount
  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
    } catch (error) {
      console.error('Load user error:', error);
      // Token might be invalid
      logout();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Store a completed sign-in. Shared by the password path, the second-factor
   * path and passwordless passkeys, so a session is always established the
   * same way.
   */
  const establishSession = (authToken, authUser) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(authUser));
    setToken(authToken);
    setUser(authUser);
  };

  /**
   * The password step.
   *
   * When the account has a second factor the server answers with
   * `twoFactorRequired` and a short-lived challenge instead of a session, and
   * the caller shows the verification step. No token exists yet at that
   * point, which is the whole point of the design: a stolen password on its
   * own buys nothing.
   */
  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });

      if (response.data.twoFactorRequired) {
        return { success: false, twoFactorRequired: true, challenge: response.data.data };
      }

      const { token: authToken, user: authUser } = response.data.data;
      establishSession(authToken, authUser);
      toast.success(`Welcome back, ${authUser.firstName}!`);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  /** The second factor checked out, or a passkey signed in on its own. */
  const completeLogin = ({ token: authToken, user: authUser, recoveryCodesLeft }) => {
    establishSession(authToken, authUser);
    toast.success(`Welcome back, ${authUser.firstName}!`);
    if (typeof recoveryCodesLeft === 'number' && recoveryCodesLeft <= 2) {
      toast(
        `Only ${recoveryCodesLeft} recovery code${recoveryCodesLeft === 1 ? '' : 's'} left. Generate a new set in Settings.`,
        { icon: '⚠️', duration: 8000 },
      );
    }
    return { success: true };
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      const { token, user } = response.data.data; // Fixed: response.data.data instead of response.data
      
      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setToken(token);
      setUser(user);
      
      toast.success('Registration successful!');
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = () => {
    // End the session on the server too, so the token stops working even if
    // it was copied. Best-effort: signing out never waits on the network.
    const current = localStorage.getItem('token');
    if (current) authAPI.logout(current).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  };

  const updateUserProfile = async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      const updatedUser = response.data.data;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Profile updated successfully');
      return { success: true, user: updatedUser };
    } catch (error) {
      const message = error.response?.data?.message || 'Update failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  // Manually set authentication (used for email verification auto-login)
  const setAuth = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const value = {
    user,
    token,
    loading,
    login,
    completeLogin,
    register,
    logout,
    updateUserProfile,
    setAuth,
    loadUser,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isScheduler: user?.role === 'scheduling_officer',
    isProgramManager: user?.role === 'program_manager',
    isFaculty: user?.role === 'faculty',
    isStudent: user?.role === 'student',
    userProgram: user?.program || null
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
