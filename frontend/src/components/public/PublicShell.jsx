import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ctuLogo from '../../assets/images/logos/ctulogo.png';
import { useAuth } from '../../context/AuthContext';

/*
 * Frame for the public pages that are not the landing page - /docs and
 * /updates. It carries the landing page's colours and brand so the site reads
 * as one thing, but none of its scroll machinery: these pages are read, not
 * scrolled through as a pitch.
 */

const LINKS = [
  { to: '/docs', label: 'Docs' },
  { to: '/updates', label: 'Updates' },
];

const PublicShell = ({ eyebrow, title, lead, children }) => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-blue-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60">
            <img src={ctuLogo} alt="" className="h-9 w-9 object-contain transition-transform duration-300 group-hover:scale-105" />
            <span className="hidden text-sm font-bold leading-tight text-white sm:block">
              CTU Daanbantayan
              <span className="block text-[11px] font-medium text-gray-400">Smart Timetabling</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium">
            {LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition-colors ${
                    isActive ? 'bg-white/10 text-yellow-300' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3.5 py-2 font-semibold text-blue-950 transition-colors hover:bg-yellow-300"
            >
              {isAuthenticated ? 'Dashboard' : 'Log in'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {(eyebrow || title || lead) && (
        <div className="border-b border-white/10 bg-gradient-to-b from-blue-950/60 to-transparent">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            {eyebrow && <p className="mb-3 text-sm font-semibold text-yellow-400">{eyebrow}</p>}
            {title && <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>}
            {lead && <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{lead}</p>}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">{children}</main>

      <footer className="border-t border-white/10 bg-gray-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left lg:px-8">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <img src={ctuLogo} alt="" className="h-6 w-6 object-contain" />
            <span>
              <span className="font-semibold text-gray-300">CTU Daanbantayan · College of Technology Education</span>
              <span className="block">© {new Date().getFullYear()} Capstone Group 1.</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link to="/" className="hover:text-yellow-300">Home</Link>
            <Link to="/docs" className="hover:text-yellow-300">Docs</Link>
            <Link to="/updates" className="hover:text-yellow-300">Updates</Link>
            <Link to="/terms" className="hover:text-yellow-300">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicShell;
