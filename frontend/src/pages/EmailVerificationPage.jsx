import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { XCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import AnimatedCheckIcon from '../components/AnimatedCheckIcon';

const EmailVerificationPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await api.get(`/auth/verify-email/${token}`);
      
      if (response.data.success) {
        setStatus('success');
        setMessage(response.data.message);
        
        // Show success toast
        toast.success('Email verified successfully! Welcome to CTU Daanbantayan! 🎉', {
          duration: 4000,
          icon: '✅',
          style: {
            background: '#10B981',
            color: '#fff',
            padding: '16px',
            borderRadius: '10px',
          },
        });
        
        // Auto-login user
        if (response.data.token) {
          // Save to localStorage first
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          // Set auth state
          setAuth(response.data.user, response.data.token);
          
          // Wait a bit longer to ensure state updates, then redirect to login with success message
          setTimeout(() => {
            navigate('/login', {
              state: {
                message: 'Email verified successfully! Please log in with your credentials.',
                email: response.data.user.email,
                autoVerified: true
              }
            });
          }, 2000);
        }
      }
    } catch (error) {
      setStatus('error');
      const errorMessage = error.response?.data?.message || 'Email verification failed';
      setMessage(errorMessage);
      
      // Show error toast
      toast.error(errorMessage, {
        duration: 5000,
        icon: '❌',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '10px',
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-400 rounded-full blur-2xl opacity-40"></div>
            <img src={ctuLogo} alt="CTU Logo" className="w-20 h-20 object-contain relative z-10" />
          </div>
        </div>

        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-yellow-500 bg-clip-text text-transparent mb-2">
          CTU Daanbantayan
        </h1>
        <p className="text-sm text-gray-500 mb-8">Smart Timetabling System</p>

        {/* Status Display */}
        {status === 'verifying' && (
          <div>
            <div className="flex justify-center mb-4">
              <Loader className="w-16 h-16 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Your Email</h2>
            <p className="text-gray-600">Please wait while we verify your email address...</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <AnimatedCheckIcon className="w-10 h-10" color="#16a34a" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                🎉 Redirecting you to login page...
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationPage;
