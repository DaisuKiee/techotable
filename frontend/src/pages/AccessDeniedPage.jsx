import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldX, ArrowLeft, AlertTriangle } from 'lucide-react';

const AccessDeniedPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [errorDetails, setErrorDetails] = useState(null);
  
  useEffect(() => {
    // Try to get error details from location state first
    if (location.state?.errorDetails) {
      setErrorDetails(location.state.errorDetails);
    } else {
      // Otherwise, check sessionStorage
      const stored = sessionStorage.getItem('accessDeniedDetails');
      if (stored) {
        try {
          setErrorDetails(JSON.parse(stored));
          // Clear after reading
          sessionStorage.removeItem('accessDeniedDetails');
        } catch (e) {
          console.error('Failed to parse error details:', e);
        }
      }
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header with Red Accent */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6">
            <div className="flex items-center justify-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                <ShieldX className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Access Denied
              </h1>
              <p className="text-gray-600 text-lg">
                You do not have permission to access this resource
              </p>
            </div>

            {/* Error Details (if available) */}
            {errorDetails && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 mb-2">
                      Resource Details
                    </h3>
                    <div className="space-y-2 text-sm text-orange-800">
                      {errorDetails.resourceType && (
                        <div className="flex">
                          <span className="font-medium w-32">Resource Type:</span>
                          <span>{errorDetails.resourceType}</span>
                        </div>
                      )}
                      {errorDetails.resourceProgram && (
                        <div className="flex">
                          <span className="font-medium w-32">Program:</span>
                          <span className="font-semibold">{errorDetails.resourceProgram}</span>
                        </div>
                      )}
                      {errorDetails.userProgram && (
                        <div className="flex">
                          <span className="font-medium w-32">Your Program:</span>
                          <span className="font-semibold">{errorDetails.userProgram}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Information Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span className="text-blue-600">ℹ️</span>
                Why am I seeing this?
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>You may be trying to access data from a different program</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Your account might not have the required permissions for this action</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>The resource you're trying to access may have been removed or restricted</span>
                </li>
              </ul>
            </div>

            {/* Help Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                Need access to this resource?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                If you believe you should have access to this resource, please contact your 
                system administrator or the program coordinator for assistance.
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Contact:</span>
                <span>IT Support - CTU Daanbantayan</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Error Code: 403 Forbidden</p>
          <p className="mt-1">
            If this issue persists, please contact technical support
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
