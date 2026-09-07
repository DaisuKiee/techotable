import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import ctuBg from '../assets/images/backgrounds/ctu-bg.png';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.forgotPassword({ email });
      
      if (response.data.success) {
        setSubmitted(true);
      } else {
        setError(response.data.message || 'Failed to process request');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex">
        {/* Left Side - Success Message */}
        <div className="w-full lg:w-2/5 bg-white flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Check Your Email
              </h2>
              <p className="text-gray-600 mb-2">
                If a matching account was found, we've sent a password reset link to:
              </p>
              <p className="text-blue-600 font-semibold mb-4">{email}</p>
              <p className="text-sm text-gray-500">
                The link will expire in 10 minutes for security reasons.
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Check your email inbox</li>
                <li>Click the reset password link</li>
                <li>Create a new password</li>
                <li>Log in with your new password</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg"
              >
                Back to Login
              </button>
              
              <button
                onClick={() => setSubmitted(false)}
                className="w-full py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-300"
              >
                Try Different Email
              </button>
            </div>

            {/* Help Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
          </div>
        </div>

        {/* Right Side - Promotional Content */}
        <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-10"
            style={{ backgroundImage: `url(${ctuBg})` }}
          ></div>
          
          <div className="absolute top-20 right-20 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 flex items-center justify-center p-16 w-full">
            <div className="max-w-xl text-center">
              <div className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">
                Check Your Email
              </h2>
              <p className="text-xl text-blue-100">
                We've sent you a secure link to reset your password.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="w-full lg:w-2/5 bg-white flex items-center justify-center p-8 relative">
        {/* Back Button */}
        <button
          onClick={() => navigate('/login')}
          className="absolute top-6 left-6 flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors duration-300 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Login</span>
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
              Forgot Password?
            </h2>
            <p className="text-gray-600 text-sm">
              No worries! Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="you@ctu.edu.ph"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Promotional Content */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${ctuBg})` }}
        ></div>
        
        <div className="absolute top-20 right-20 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex items-center justify-center p-16 w-full">
          <div className="max-w-xl">
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
              Secure Password
              <span className="block bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                Recovery
              </span>
            </h2>
            
            <p className="text-lg text-blue-100 mb-8 leading-relaxed">
              We take your account security seriously. Follow the simple steps to regain access to your CTU Daanbantayan account safely.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-white">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Enter Your Email</h3>
                  <p className="text-sm text-blue-200">Provide the email address associated with your account</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-white">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Check Your Inbox</h3>
                  <p className="text-sm text-blue-200">Receive a secure password reset link via email</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-white">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Create New Password</h3>
                  <p className="text-sm text-blue-200">Set a strong, unique password for your account</p>
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

export default ForgotPasswordPage;
