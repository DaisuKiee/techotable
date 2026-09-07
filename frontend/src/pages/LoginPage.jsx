import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Calendar, Brain, Users } from 'lucide-react';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import ctuBg from '../assets/images/backgrounds/ctu-bg.png';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Page entrance animation
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      setLoginSuccess(true);
      // Wait for animation to complete before navigating
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } else {
      setLoading(false);
    }
  };

  // Quick login for testing
  const quickLogin = async (email, password) => {
    setFormData({ email, password });
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      setLoginSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Success Animation Overlay */}
      {loginSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Expanding Circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-20 h-20 border-4 border-white/30 rounded-full animate-ping"></div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animation-delay-300">
              <div className="w-32 h-32 border-4 border-white/20 rounded-full animate-ping"></div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animation-delay-500">
              <div className="w-44 h-44 border-4 border-white/10 rounded-full animate-ping"></div>
            </div>
          </div>

          {/* Success Content */}
          <div className="relative z-10 text-center animate-fadeInScale">
            {/* Success Checkmark */}
            <div className="mb-6 inline-flex items-center justify-center">
              <div className="w-24 h-24 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center border-4 border-white/30 animate-scaleIn">
                <svg className="w-12 h-12 text-white animate-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Success Text */}
            <h2 className="text-3xl font-bold text-white mb-2 animate-fadeInUp">
              Login Successful!
            </h2>
            <p className="text-lg text-blue-100 animate-fadeInUp animation-delay-200">
              Redirecting to dashboard...
            </p>

            {/* Loading Dots */}
            <div className="flex items-center justify-center gap-2 mt-6 animate-fadeInUp animation-delay-400">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce animation-delay-100"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce animation-delay-200"></div>
            </div>
          </div>
        </div>
      )}

      {/* Page Loading Overlay with Skeleton */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-500 ${pageLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex h-full">
          {/* Left side - Skeleton for Login Form */}
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

              {/* Email input skeleton */}
              <div className="mb-5">
                <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                <div className="h-12 w-full bg-gray-200 rounded-lg"></div>
              </div>

              {/* Password input skeleton */}
              <div className="mb-5">
                <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
                <div className="h-12 w-full bg-gray-200 rounded-lg"></div>
              </div>

              {/* Button skeleton */}
              <div className="h-12 w-full bg-gray-300 rounded-lg"></div>
            </div>
          </div>

          {/* Right side - Skeleton for Promo Content */}
          <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-20 right-20 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 flex items-center justify-center p-16 w-full">
              <div className="max-w-xl animate-pulse">
                {/* Title skeleton */}
                <div className="mb-6">
                  <div className="h-12 w-96 bg-white/10 rounded mb-3"></div>
                  <div className="h-12 w-80 bg-white/10 rounded"></div>
                </div>
                
                {/* Description skeleton */}
                <div className="mb-8">
                  <div className="h-5 w-full bg-white/10 rounded mb-2"></div>
                  <div className="h-5 w-5/6 bg-white/10 rounded"></div>
                </div>

                {/* Feature cards skeleton */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                    <div className="w-12 h-12 bg-white/10 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-5 w-40 bg-white/10 rounded mb-2"></div>
                      <div className="h-4 w-full bg-white/10 rounded"></div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                    <div className="w-12 h-12 bg-white/10 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-5 w-48 bg-white/10 rounded mb-2"></div>
                      <div className="h-4 w-full bg-white/10 rounded"></div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                    <div className="w-12 h-12 bg-white/10 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-5 w-44 bg-white/10 rounded mb-2"></div>
                      <div className="h-4 w-full bg-white/10 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side - Login Form */}
      <div className={`w-full lg:w-2/5 bg-white flex items-center justify-center p-8 relative transition-all duration-700 delay-300 ${
        pageLoading ? 'opacity-0 translate-x-[-50px]' : 'opacity-100 translate-x-0'
      }`}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors duration-300 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>

        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="mb-8">
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
              Log in to your account
            </h2>
            <p className="text-gray-600 text-sm">
              New to CTU Timetabling? <button onClick={() => navigate('/signup')} className="text-blue-600 hover:underline cursor-pointer font-medium">Create an account</button>
            </p>
          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 animate-fadeIn">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="flex-shrink-0 text-green-600 hover:text-green-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="you@ctu.edu.ph"
              />
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
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
              Revolutionize Your
              <span className="block bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                Academic Scheduling
              </span>
            </h2>
            
            <p className="text-lg text-blue-100 mb-8 leading-relaxed">
              Experience the power of AI-driven timetabling. Save hours, eliminate conflicts, and optimize resources with our intelligent scheduling system.
            </p>

            {/* Features */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">AI-Powered Intelligence</h3>
                  <p className="text-sm text-blue-200">Advanced algorithms optimize schedules in seconds</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Real-Time Scheduling</h3>
                  <p className="text-sm text-blue-200">Generate complete semester schedules instantly</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Collaborative Platform</h3>
                  <p className="text-sm text-blue-200">Faculty and students work seamlessly together</p>
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

export default LoginPage;
