import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TermsContent from '../components/TermsContent';
import TERMS from '../content/terms';

/** Public Terms of Use and Privacy Notice (linked from login and sign-up). */
const TermsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const accepted = user?.termsAcceptedAt && user?.termsAcceptedVersion === user?.termsCurrentVersion;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to={isAuthenticated ? '/dashboard' : '/login'}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> {isAuthenticated ? 'Back to the dashboard' : 'Back to sign in'}
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Terms of Use &amp; Privacy Notice</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Version {TERMS.version}</p>
            </div>
          </div>

          {accepted && (
            <p className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              You accepted this version on {new Date(user.termsAcceptedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
            </p>
          )}

          <TermsContent />
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
