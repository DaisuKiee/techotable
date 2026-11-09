import React from 'react';

const SimpleTestPage = () => {
  return (
    <div className="min-h-screen bg-emerald-500 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl">
        <h1 className="text-4xl font-bold text-emerald-600 mb-4">✅ Success!</h1>
        <p className="text-xl">If you can see this page, routing works!</p>
        <p className="mt-4">This page has NO authentication, NO redirects, NOTHING.</p>
        <div className="mt-6">
          <a href="/test-login" className="text-blue-600 underline">Back to Test Login</a>
        </div>
      </div>
    </div>
  );
};

export default SimpleTestPage;
