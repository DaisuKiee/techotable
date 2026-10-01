import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, User, Calendar, Brain, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import ctuBg from '../assets/images/backgrounds/ctu-bg.png';
import { usePrograms } from '../hooks/usePrograms';

const SignupPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { programs } = usePrograms();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    studentId: '',
    email: '',
    program: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: '',
    color: ''
  });
  const [passwordMatch, setPasswordMatch] = useState(true);

  // Page entrance animation
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Default the program selection to the first program from the database,
  // and reset it if the current pick is no longer an active program.
  useEffect(() => {
    if (programs.length === 0) return;
    const codes = programs.map(p => p.code);
    if (!codes.includes(formData.program)) {
      setFormData(prev => ({ ...prev, program: codes[0] }));
    }
  }, [programs, formData.program]);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError('');

    // Check password strength
    if (name === 'password') {
      checkPasswordStrength(value);
      // Check if passwords match
      if (formData.confirmPassword) {
        setPasswordMatch(value === formData.confirmPassword);
      }
    }

    // Check if confirm password matches
    if (name === 'confirmPassword') {
      setPasswordMatch(value === formData.password);
    }
  };

  const checkPasswordStrength = (password) => {
    let score = 0;
    if (!password) {
      setPasswordStrength({ score: 0, label: '', color: '' });
      return;
    }

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Contains lowercase and uppercase
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;

    // Contains numbers
    if (/\d/.test(password)) score++;

    // Contains special characters
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Set strength label and color
    if (score <= 2) {
      setPasswordStrength({ score, label: 'Weak', color: 'text-red-600' });
    } else if (score === 3) {
      setPasswordStrength({ score, label: 'Fair', color: 'text-yellow-600' });
    } else if (score === 4) {
      setPasswordStrength({ score, label: 'Good', color: 'text-blue-600' });
    } else {
      setPasswordStrength({ score, label: 'Strong', color: 'text-green-600' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (passwordStrength.score < 3) {
      setError('Please use a stronger password (mix of uppercase, lowercase, numbers, and special characters)');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          studentId: formData.studentId,
          program: formData.program
        })
      });

      const data = await response.json();

      if (data.success) {
        // Show success toast notification
        toast.success(
          `Account created successfully! Please check your email (${formData.email}) to verify your account.`,
          {
            duration: 5000,
            icon: '📧',
            style: {
              background: '#10B981',
              color: '#fff',
              padding: '16px',
              borderRadius: '10px',
            },
          }
        );
        
        navigate('/login', { 
          state: { 
            message: 'Account created! Please check your email to verify your account.',
            email: formData.email 
          } 
        });
      } else {
        setError(data.message || 'Failed to create account');
      }
    } catch (err) {
      setError('An error occurred during signup. Please try again.');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen flex relative overflow-hidden">
      {/* Page Loading Overlay with Skeleton */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-500 ${pageLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex h-full">
          {/* Left side - Skeleton for Signup Form */}
          <div className="w-full lg:w-2/5 bg-white flex items-center justify-center p-8">
            <div className="w-full max-w-md animate-pulse">
              {/* Logo skeleton */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div>
                  <div className="h-5 w-40 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 w-32 bg-gray-200 rounded"></div>
                </div>
              </div>
              
              {/* Title skeleton */}
              <div className="mb-8">
                <div className="h-9 w-64 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-48 bg-gray-200 rounded"></div>
              </div>

              {/* Input skeletons */}
              <div className="space-y-4 mb-5">
                <div className="h-12 w-full bg-gray-200 rounded-lg"></div>
                <div className="h-12 w-full bg-gray-200 rounded-lg"></div>
                <div className="h-12 w-full bg-gray-200 rounded-lg"></div>
                <div className="h-12 w-full bg-gray-200 rounded-lg"></div>
                <div className="h-12 w-full bg-gray-200 rounded-lg"></div>
              </div>

              {/* Button skeleton */}
              <div className="h-12 w-full bg-gray-300 rounded-lg"></div>
            </div>
          </div>

          {/* Right side - Skeleton for Promo Content */}
          <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 relative overflow-hidden">
            <div className="absolute top-20 right-20 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 flex items-center justify-center p-16 w-full">
              <div className="max-w-xl animate-pulse">
                <div className="mb-6">
                  <div className="h-12 w-96 bg-white/10 rounded mb-3"></div>
                  <div className="h-12 w-80 bg-white/10 rounded"></div>
                </div>
                
                <div className="mb-8">
                  <div className="h-5 w-full bg-white/10 rounded mb-2"></div>
                  <div className="h-5 w-5/6 bg-white/10 rounded"></div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                    <div className="w-12 h-12 bg-white/10 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-5 w-40 bg-white/10 rounded mb-2"></div>
                      <div className="h-4 w-full bg-white/10 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side - Signup Form */}
      <div className={`w-full lg:w-2/5 bg-white flex items-start justify-center p-8 relative transition-all duration-700 delay-300 overflow-y-auto ${
        pageLoading ? 'opacity-0 translate-x-[-50px]' : 'opacity-100 translate-x-0'
      }`}>
        <div className="w-full max-w-md py-8">
          {/* Logo and Title */}
          <div className="mb-8 pt-4">
            <div className="flex items-center gap-3 mb-6">
              <img src={ctuLogo} alt="CTU Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-yellow-500 bg-clip-text text-transparent">
                  CTU Daanbantayan
                </h1>
                <p className="text-xs text-gray-500">Smart Timetabling System</p>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Create student account
            </h2>
            <p className="text-gray-600 text-sm">
              Already have an account? <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline cursor-pointer font-medium">Sign in</button>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Juan"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Dela Cruz"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="you@ctu.edu.ph"
              />
            </div>

            {/* Student ID */}
            <div>
              <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1.5">
                Student ID
              </label>
              <input
                id="studentId"
                name="studentId"
                type="text"
                required
                value={formData.studentId}
                onChange={handleChange}
                className="block w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="2024-12345"
              />
            </div>

            {/* Program */}
            <div>
              <label htmlFor="program" className="block text-sm font-medium text-gray-700 mb-1.5">
                Program
              </label>
              <select
                id="program"
                name="program"
                value={formData.program}
                onChange={handleChange}
                className="block w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                {programs.map(prog => (
                  <option key={prog._id} value={prog.code}>
                    {prog.code} - {prog.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Password Strength:</span>
                    <span className={`text-xs font-semibold ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        passwordStrength.score <= 2 ? 'bg-red-500' :
                        passwordStrength.score === 3 ? 'bg-yellow-500' :
                        passwordStrength.score === 4 ? 'bg-blue-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Use 8+ characters with uppercase, lowercase, numbers & symbols
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:ring-2 transition-all ${
                    formData.confirmPassword && !passwordMatch
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className="mt-1.5">
                  {passwordMatch ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Passwords match
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Passwords do not match
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg mt-2"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Side - Promotional Content */}
      <div className={`hidden lg:flex lg:w-3/5 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 relative overflow-hidden transition-all duration-700 delay-300 ${
        pageLoading ? 'opacity-0 translate-x-[50px]' : 'opacity-100 translate-x-0'
      }`}>
        {/* Background Image Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${ctuBg})` }}
        ></div>
        
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        
        {/* Content */}
        <div className="relative z-10 flex items-center justify-center p-16 w-full">
          <div className="max-w-xl">
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
              Join CTU Daanbantayan
              <span className="block bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                Student Community
              </span>
            </h2>
            
            <p className="text-lg text-blue-100 mb-8 leading-relaxed">
              Register as a student to access your personalized schedule, view class updates, and stay connected with your academic journey at CTU Daanbantayan.
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Your Schedule, Anytime</h3>
                  <p className="text-sm text-blue-200">Access your class schedule 24/7 from any device</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Real-Time Updates</h3>
                  <p className="text-sm text-blue-200">Get instant notifications about schedule changes</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Connect with Classmates</h3>
                  <p className="text-sm text-blue-200">Stay connected with your peers and instructors</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/20">
              <p className="text-sm text-blue-200">
                © 2026 Cebu Technological University - Daanbantayan Campus
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
