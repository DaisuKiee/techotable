import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TestLoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, token } = useAuth();
  const [email, setEmail] = useState('admin@ctu.edu.ph');
  const [password, setPassword] = useState('admin123');
  const [log, setLog] = useState([]);

  const addLog = (message, type = 'info') => {
    setLog(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleLogin = async () => {
    addLog('🔄 Starting login...', 'info');
    
    try {
      addLog(`📧 Email: ${email}`, 'info');
      addLog(`🔒 Password: ${'*'.repeat(password.length)}`, 'info');
      
      addLog('📡 Calling login API...', 'info');
      const result = await login(email, password);
      
      addLog(`📊 Login result: ${JSON.stringify(result)}`, result.success ? 'success' : 'error');
      
      if (result.success) {
        addLog('✅ Login successful!', 'success');
        addLog('🔍 Checking localStorage...', 'info');
        
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        addLog(`Token in localStorage: ${storedToken ? '✅ YES' : '❌ NO'}`, storedToken ? 'success' : 'error');
        addLog(`User in localStorage: ${storedUser ? '✅ YES' : '❌ NO'}`, storedUser ? 'success' : 'error');
        
        if (storedToken) {
          addLog(`Token: ${storedToken.substring(0, 20)}...`, 'info');
        }
        
        if (storedUser) {
          addLog(`User: ${storedUser}`, 'info');
        }
        
        addLog('⏳ Waiting 2 seconds before redirect...', 'info');
        setTimeout(() => {
          addLog('🚀 Redirecting to dashboard...', 'info');
          navigate('/dashboard');
        }, 2000);
      } else {
        addLog(`❌ Login failed: ${result.message}`, 'error');
      }
    } catch (error) {
      addLog(`💥 Error: ${error.message}`, 'error');
      addLog(`Stack: ${error.stack}`, 'error');
    }
  };

  const checkAuth = () => {
    addLog('🔍 Checking authentication state...', 'info');
    addLog(`isAuthenticated: ${isAuthenticated}`, isAuthenticated ? 'success' : 'error');
    addLog(`user exists: ${!!user}`, !!user ? 'success' : 'error');
    addLog(`token exists: ${!!token}`, !!token ? 'success' : 'error');
    
    if (user) {
      addLog(`User: ${JSON.stringify(user)}`, 'info');
    }
  };

  const clearStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    addLog('🗑️ Storage cleared!', 'success');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">🧪 Test Login Debug</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Login Form */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Login Form</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded text-white"
                />
              </div>
              
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold"
              >
                🚀 Test Login
              </button>
              
              <button
                onClick={checkAuth}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 rounded"
              >
                🔍 Check Auth State
              </button>
              
              <button
                onClick={clearStorage}
                className="w-full py-2 bg-red-600 hover:bg-red-700 rounded"
              >
                🗑️ Clear Storage & Reload
              </button>
              
              <div className="pt-4 space-y-2 text-sm">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  → Go to Dashboard
                </button>
                <button
                  onClick={() => navigate('/dashboard-test')}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  → Dashboard (Unprotected)
                </button>
                <button
                  onClick={() => navigate('/debug-auth')}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  → Debug Auth Page
                </button>
              </div>
            </div>
          </div>
          
          {/* Log Output */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Console Log</h2>
              <button
                onClick={() => setLog([])}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Clear Log
              </button>
            </div>
            
            <div className="bg-black rounded p-4 h-[500px] overflow-y-auto font-mono text-sm">
              {log.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No logs yet. Click "Test Login" to start.
                </div>
              ) : (
                <div className="space-y-1">
                  {log.map((entry, index) => (
                    <div
                      key={index}
                      className={`
                        ${entry.type === 'success' ? 'text-emerald-400' : ''}
                        ${entry.type === 'error' ? 'text-red-400' : ''}
                        ${entry.type === 'info' ? 'text-blue-400' : ''}
                      `}
                    >
                      <span className="text-gray-500">[{entry.time}]</span> {entry.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Current State */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Current State</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className={`p-4 rounded ${isAuthenticated ? 'bg-emerald-900' : 'bg-red-900'}`}>
              <div className="text-2xl mb-2">{isAuthenticated ? '✅' : '❌'}</div>
              <div className="text-sm">Authenticated</div>
            </div>
            <div className={`p-4 rounded ${!!user ? 'bg-emerald-900' : 'bg-red-900'}`}>
              <div className="text-2xl mb-2">{!!user ? '✅' : '❌'}</div>
              <div className="text-sm">User Loaded</div>
            </div>
            <div className={`p-4 rounded ${!!token ? 'bg-emerald-900' : 'bg-red-900'}`}>
              <div className="text-2xl mb-2">{!!token ? '✅' : '❌'}</div>
              <div className="text-sm">Token Exists</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestLoginPage;
