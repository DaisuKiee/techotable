import React from 'react';

const MinimalDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-600 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl">
        <div className="text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">SUCCESS!</h1>
          <p className="text-2xl text-gray-700 mb-6">You've reached the dashboard!</p>
          
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-6 mb-6">
            <p className="text-lg font-semibold text-emerald-800">
              ✅ Authentication is working!
            </p>
            <p className="text-emerald-700 mt-2">
              If you can see this page, the login system is functional.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="/dashboard"
              className="block w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Try Real Dashboard
            </a>
            <a
              href="/test-login"
              className="block w-full py-3 px-6 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
              Back to Test Login
            </a>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            This is a minimal test page with NO Layout, NO API calls, NO complex logic.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MinimalDashboard;
