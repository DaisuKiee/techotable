import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DebugAuthPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const localStorageToken = localStorage.getItem('token');
  const localStorageUser = localStorage.getItem('user');
  
  let parsedUser = null;
  try {
    parsedUser = localStorageUser ? JSON.parse(localStorageUser) : null;
  } catch (e) {
    console.error('Failed to parse user:', e);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔍 Authentication Debug</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Auth Context */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-600">Auth Context</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">isAuthenticated:</span> <span className={auth.isAuthenticated ? 'text-emerald-600' : 'text-red-600'}>{String(auth.isAuthenticated)}</span></div>
              <div><span className="font-semibold">loading:</span> {String(auth.loading)}</div>
              <div><span className="font-semibold">token exists:</span> <span className={auth.token ? 'text-emerald-600' : 'text-red-600'}>{String(!!auth.token)}</span></div>
              <div><span className="font-semibold">user exists:</span> <span className={auth.user ? 'text-emerald-600' : 'text-red-600'}>{String(!!auth.user)}</span></div>
            </div>
          </div>

          {/* LocalStorage */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-600">LocalStorage</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">token exists:</span> <span className={localStorageToken ? 'text-emerald-600' : 'text-red-600'}>{String(!!localStorageToken)}</span></div>
              <div><span className="font-semibold">user exists:</span> <span className={localStorageUser ? 'text-emerald-600' : 'text-red-600'}>{String(!!localStorageUser)}</span></div>
              {localStorageToken && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <div className="font-semibold text-xs text-gray-600 mb-1">Token (first 20 chars):</div>
                  <div className="font-mono text-xs break-all">{localStorageToken.substring(0, 20)}...</div>
                </div>
              )}
            </div>
          </div>

          {/* User Data from Context */}
          {auth.user && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-emerald-600">User (from Context)</h2>
              <div className="space-y-2 text-sm">
                <div><span className="font-semibold">Email:</span> {auth.user.email}</div>
                <div><span className="font-semibold">Name:</span> {auth.user.firstName} {auth.user.lastName}</div>
                <div><span className="font-semibold">Role:</span> {auth.user.role}</div>
                <div><span className="font-semibold">Verified:</span> <span className={auth.user.isEmailVerified ? 'text-emerald-600' : 'text-red-600'}>{String(auth.user.isEmailVerified)}</span></div>
                {auth.user.program && <div><span className="font-semibold">Program:</span> {auth.user.program}</div>}
                {auth.user.studentId && <div><span className="font-semibold">Student ID:</span> {auth.user.studentId}</div>}
              </div>
            </div>
          )}

          {/* User Data from LocalStorage */}
          {parsedUser && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-orange-600">User (from LocalStorage)</h2>
              <div className="space-y-2 text-sm">
                <div><span className="font-semibold">Email:</span> {parsedUser.email}</div>
                <div><span className="font-semibold">Name:</span> {parsedUser.firstName} {parsedUser.lastName}</div>
                <div><span className="font-semibold">Role:</span> {parsedUser.role}</div>
                <div><span className="font-semibold">Verified:</span> <span className={parsedUser.isEmailVerified ? 'text-emerald-600' : 'text-red-600'}>{String(parsedUser.isEmailVerified)}</span></div>
                {parsedUser.program && <div><span className="font-semibold">Program:</span> {parsedUser.program}</div>}
                {parsedUser.studentId && <div><span className="font-semibold">Student ID:</span> {parsedUser.studentId}</div>}
              </div>
            </div>
          )}

          {/* Role Checks */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-600">Role Checks</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">isAdmin:</span> {String(auth.isAdmin)}</div>
              <div><span className="font-semibold">isScheduler:</span> {String(auth.isScheduler)}</div>
              <div><span className="font-semibold">isProgramManager:</span> {String(auth.isProgramManager)}</div>
              <div><span className="font-semibold">isFaculty:</span> {String(auth.isFaculty)}</div>
              <div><span className="font-semibold">isStudent:</span> {String(auth.isStudent)}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Try Dashboard
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                Go to Login
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Clear All & Reload
              </button>
            </div>
          </div>
        </div>

        {/* Raw Data */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Raw Data (JSON)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">Context User:</h3>
              <pre className="bg-gray-900 text-emerald-400 p-4 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(auth.user, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">LocalStorage User:</h3>
              <pre className="bg-gray-900 text-emerald-400 p-4 rounded text-xs overflow-auto max-h-64">
                {localStorageUser || 'null'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugAuthPage;
